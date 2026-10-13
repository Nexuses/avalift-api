// services/reviewService.js

const { string } = require("joi");
const reviewDAO = require("../dao/reviewDAO");
const ridesDAO = require("../dao/ridesDAO"); // Import Ride DAO
const { addServerLog } = require("./serverLogsService");
const referralDAO = require("../dao/referralDOA");
const paymentsDAO = require("../dao/paymentsDAO");
const erpQueue = require("../queues/erpQueue");

module.exports = {
  addReview: async (reviewData) => {
    try {
      let { ride_id, reviewer_id, reviewee_id, rating, comment } = reviewData;

      // Ensure IDs are converted to strings
      reviewer_id = reviewer_id.toString();
      reviewee_id = reviewee_id.toString();

      // Check if the ride exists in the database
      const customerRide = await ridesDAO.getRide(reviewer_id, `#${ride_id}`);
      if (!customerRide) {
        const error = new Error("The ride does not exist.");
        throw error;
      }

      const { PK, SK } = customerRide;

      const tempRef = await referralDAO.checkTemporaryReferral(customerRide.customer_id);
      console.log("🔍 Temporary referral check result:", tempRef);

      let isFirst = false;
      if (tempRef) {
        isFirst = await ridesDAO.isFirstRide(customerRide.customer_id);
        console.log("🚦 Is this the first ride?", isFirst);
      }

      if (customerRide.status !== "Review-Pending" && customerRide.status !== "Apple-Pay-Payment-Completed") {
        const error = new Error("Can not review a ride until the payment is complete.");
        throw error;
      }

      // Check if review already exists for this ride and reviewer
      const existingReview = await reviewDAO.findReview(ride_id, reviewer_id);
      if (existingReview) {
        const error = new Error("You have already reviewed this ride.");
        throw error;
      }

      // Ensure status_log is initialized as an array
      if (!Array.isArray(customerRide.status_log)) {
        customerRide.status_log = [];
      }

      // Original ride data for rollback purposes
      const originalRide = {
        ...customerRide,
        status_log: [...customerRide.status_log],
      };

      // Update ride details for acceptance
      customerRide.status = "Completed";
      customerRide.status_log.push({
        status: "Completed",
        datetime: new Date().toISOString(),
      });

      const updatedRide = await ridesDAO.updateRideByPkSk(PK, SK, customerRide);

      if (updatedRide) {
        console.log("✅ updatedRide exists:", updatedRide);
      
        if (tempRef && isFirst) {
          const referralRecord = await referralDAO.getReferralByCode(tempRef.referral_code);
          console.log("📋 Referral record fetched:", referralRecord);
      
          if (referralRecord) {
            const updateData = {
              reward_amount: parseFloat(process.env.REFERRAL_REWARD_AMOUNT),
              reward_event: 'first_ride',
              rewarded_at: new Date().toISOString(),
              reward_type: 'wallet',
              reward_status: 'credited',
            };
            console.log("💰 Preparing to update referral with data:", updateData);
      
            try {
              const updatedRef = await referralDAO.updateReferralEntry(referralRecord.referrer_id, updateData);
              console.log("✅ Referral record updated:", updatedRef);
      
              await referralDAO.deleteTemporaryReferral(tempRef.user_id);
              console.log("🧹 Temporary referral entry deleted for user_id:", tempRef.user_id);
      
              const updatedWallet = await paymentsDAO.creditReferralRewardToWallet(
                updatedRef.referrer_id,
                updateData.reward_amount
              );
              console.log("💳 Wallet updated successfully:", updatedWallet);
            } catch (err) {
              console.error("❌ Error during referral reward update:", err);
              await addServerLog({
                log_level: 'ERROR',
                service_name: 'addReview–referralFlow',
                error_message: `Referral award failed: ${err.message}`,
              });
            }
          } else {
            console.log("⚠️ No referral record found for code:", tempRef.referral_code);
          }
        } else {
          if (!tempRef) {
            console.log("ℹ️ No temporary referral found for customer_id:", updatedRide.customer_id);
          } else if (!isFirst) {
            console.log("ℹ️ Not the customer's first completed ride. Skipping referral reward.");
          }
        }
      } else {
        console.log("❌ updatedRide is undefined or null. Skipping referral flow.");
      }


      try {
        // Then, add the review
        await reviewDAO.addReview({
          ride_id,
          reviewer_id,
          reviewee_id,
          rating,
          comment,
        });
      } catch (error) {
        // If adding the review fails, roll back the ride update
        await ridesDAO.updateRideByPkSk(PK, SK, originalRide);
        await addServerLog({
          log_level: "ERROR",
          service_name: "addReview",
          error_message: `addReview service error - ${error.message}.`
        });
        throw error;
      }

      // erpQueue add job
       await erpQueue.add(
            {
                rideId: updatedRide.ride_id,
                source: 'USER_REVIEW'
            },
            {
                jobId: `erp-${updatedRide.ride_id}`
            }
        );
        console.log(`ERP job queued for Ride ${updatedRide.ride_id}`);
      return;
    } catch (error) {
      await addServerLog({
        log_level: "ERROR",
        service_name: "addReview",
        error_message: `addReview service error - ${error.message}.`
      });
      throw error;
    }
  },
};
