const { User } = require("../dto");
const ridesDAO = require("../dao/ridesDAO");
const vehicleDAO = require("../dao/vehicleDAO");
const adminPanelDOA = require("../dao/adminPanelDAO");
const auditDAO = require("../dao/auditDAO");
const pricingDAO = require("../dao/pricingsDAO");
const { calculateEstimatedAmount } = require("../utils/calculateRate");
const { updateNotificationStatus } = require("../dao/notificationDOA");
const userDAO = require("../dao/userDAO");
const { queuePushNotification } = require("../adaptors/notificationService");
const {
  buildRideDeclinedNotificationData,
} = require("./adminPanelNotificationDataBuilder");
const { getWalletDetailsByUser } = require("../services/paymentsService");
const { addServerLog } = require("../services/serverLogsService");
const { createUserCommissionRecord } = require("../services/commissionService");
const chauffeurRidesDOA = require("../dao/chauffeurRidesDAO");
const rideDAO = require("../dao/rideDAO");
require("dotenv").config();
const { tipQueue } = require("../queues/tipQueue");
const {scheduleHourlyEndWarn, cancelHourlyEndWarn} = require("../helpers/scheduleHelper");

/**
 * Chauffeur responds to a ride request (accept/decline).
 */
const respondToRide = async (rideId, customerId, chauffeurId, response) => {
  try {
    const customerRide = await ridesDAO.getRide(`${customerId}`, `#${rideId}`);
    if (!customerRide) {
      const error = new Error("Customer ride not found.");
      error.statusCode = 404;
      throw error;
    }
    const { PK, SK } = customerRide;

    if (response === "accept") {
      if (customerRide.status !== "Requested") {
        const error = new Error("Ride has already been accepted or cancelled.");
        error.statusCode = 404;
        throw error;
      }
      // Check if the chauffeur already has an active ride
      const existingChauffeurRide = await getActiveRideForChauffeur(
        chauffeurId
      );
      if (existingChauffeurRide) {
        const error = new Error("You already have a customer ride!");
        error.statusCode = 400;
        throw error;
      }

      // Check if the ride has already been accepted
      if (customerRide.chauffeur_id !== 0) {
        const error = new Error("Ride has already been accepted.");
        error.statusCode = 400;
        throw error;
      }

      const chauffeurDetails = await userDAO.findById(chauffeurId);
      const chauffeurName = `${chauffeurDetails.first_name} ${chauffeurDetails.last_name}`;

      // Update ride details for acceptance
      customerRide.status = "Accepted";
      customerRide.chauffeur_id = chauffeurId;
      customerRide.planned_end_time = new Date(Date.now() + customerRide.estimated_time_in_minutes * 60 * 1000).toISOString();
      customerRide.chauffeur_name = chauffeurName;
      customerRide.lower_chauffeur_name = chauffeurName.toLowerCase();
      customerRide.status_log.push({
        status: "Accepted",
        datetime: new Date().toISOString(),
      });

      // Fetch chauffeur details (used for notification data)
      const chauffeur = await userDAO.findByUserId(chauffeurId);

      // Build notification data for the customer
      const notificationData = {
        title: "Chauffeur has accepted your request!",
        body: "Your chauffeur will reach at the pickup location shortly.",
        data: {
          ride_id: rideId.toString(),
          chauffeur_id: chauffeurId.toString(),
          chauffeur_name: `${chauffeur.first_name} ${chauffeur.last_name}`,
          chauffeur_mobile: `${chauffeur.country_code}${chauffeur.mobile_number}`,
          notification_type: "chauffeur_accepted",
        },
        notification_type: "chauffeur_accepted",
        recipient_type: "customer",
        recipient_id: customerRide.customer_id.toString(),
      };

      // Retrieve customer device id to send notification
      const customerDeviceId = await userDAO.findDeviceIdByUserId(
        customerRide.customer_id
      );

      // Update the ride record in the database
      await ridesDAO.updateRideByPkSk(PK, SK, customerRide);

      // Update notification status (if needed)
      await updateNotificationStatus(chauffeurId, rideId, "Accepted");

      // Send push notification if possible and record the outcome in the message
      let notificationMessage = "";
      if (customerDeviceId) {
        await queuePushNotification(customerDeviceId, notificationData);
        console.log(
          `Notification sent to customer ID: ${customerRide.customer_id}`
        );
        notificationMessage = " and customer notified.";
      } else {
        console.warn(
          `No device ID found for customer ID: ${customerRide.customer_id}`
        );
        notificationMessage = " but notification to customer was not sent.";
      }

      let vehicle = null;
      // If vehicle_id exists, fetch vehicle details
      if (customerRide.vehicle_id) {
        vehicle = await vehicleDAO.getById(customerRide.vehicle_id);
      }

      // Return the fully structured response data for an accepted ride
      return {
        data: {
          action: "accept",
          rideId: customerRide.ride_id,
          customerId: customerRide.customer_id,
          customer_details: customerRide.customer_details,
          estimated_amount: customerRide.estimated_amount,
          requested_pickup_point: customerRide.requested_pickup_point,
          requested_drop_point: customerRide.requested_drop_point,
          requested_pickup: customerRide.requested_pickup,
          requested_drop: customerRide.requested_drop,
          vehicle_details: vehicle || "NA",
        },
        message: `Chauffeur accepted the ride${notificationMessage}`,
      };
    } else {
      // Handle decline
      if (customerRide.chauffeur_id === chauffeurId) {
        const error = new Error(
          "You have already accepted this ride and cannot decline it."
        );
        error.statusCode = 400;
        throw error;
      } else {
        await updateNotificationStatus(chauffeurId, rideId, "Declined");

        // Notify admin(s) about the ride decline
        try {
          const [checkRideStatus] = await chauffeurRidesDOA.getRideStatus(
            rideId
          );
          //console.log("checkRideStatus: ", checkRideStatus);
          //console.log("checkRideStatus.status: ", checkRideStatus.status);

          if (checkRideStatus?.status === "Requested") {
            const adminUsers = await adminPanelDOA.fetchDeviceIds();
            if (adminUsers && adminUsers.length > 0) {
              await Promise.all(
                adminUsers.map(async ({ user_id, device_id }) => {
                  try {
                    const notificationData =
                      await buildRideDeclinedNotificationData(
                        customerRide,
                        user_id,
                        chauffeurId
                      );
                    await queuePushNotification(device_id, notificationData);
                    console.log(`Notification sent to Admin ID: ${user_id}`);
                  } catch (notificationError) {
                    console.error(
                      `Failed to send notification to Admin ID ${user_id}: ${notificationError.message}`
                    );
                  }
                })
              );
            } else {
              console.warn("No active admin users found with valid device IDs.");
            }
          }
        } catch (err) {
          console.error(
            "Error fetching admin device IDs or sending notifications: ",
            err.message
          );
        }

        // Return the fully structured response data for a declined ride
        return {
          data: {
            action: "decline",
            rideId: customerRide.ride_id,
            customerId: customerRide.customer_id,
          },
          message: "Chauffeur declined the ride.",
        };
      }
    }
  } catch (error) {
    await addServerLog({
      log_level: "ERROR",
      service_name: "respondToRide",
      error_message: `respondToRide service error - ${error.message}.`,
    });
    throw error;
  }
};

/**
 * Marks the ride as 'Started'
 * @param {string} rideId - The ride_id of the ride.
 * @param {string} customerId - The chauffeur's ID.
 */
const startCustomerRide = async (rideId, customer_id, chauffeur_id) => {
  try {
    const customerRide = await ridesDAO.getRide(`${customer_id}`, `#${rideId}`);
    if (!customerRide) {
      const error = new Error("Ride not found.");
      error.statusCode = 404;
      throw error;
    }

    if (customerRide.chauffeur_id.toString() !== chauffeur_id.toString()) {
      const error = new Error(
        "Only the assigned chauffeur can start the ride."
      );
      error.statusCode = 400;
      throw error;
    }

    const notAllowedStatuses = [
      "Started",
      "Payment Initiated",
      "Review-Pending",
      "Completed",
    ];
    if (notAllowedStatuses.includes(customerRide.status)) {
      const error = new Error("The ride has already been started.");
      error.statusCode = 400;
      throw error;
    }

    if (customerRide.status !== "Reached Customer") {
      const error = new Error(
        "The ride status must be 'Reached Customer' before starting the trip."
      );
      error.statusCode = 400;
      throw error;
    }

    await ridesDAO.updateRideByPkSk(`${customer_id}`, `#${rideId}`, {
      planned_end_time: new Date(Date.now() + customerRide.estimated_time_in_minutes * 60 * 1000).toISOString(),
      status: "Started",
      status_log: [
        ...customerRide.status_log,
        { status: "Started", datetime: new Date().toISOString() },
      ],
    });

    if(customerRide.rate_type === "per_hour"){
      await scheduleHourlyEndWarn(customerRide);
    }

    const customer = await userDAO.findDeviceIdByUserId(customer_id);

    if (!customer || !customer.device_id) {
      console.warn(
        `No device ID found for customer ID: ${customer.customer_id}`
      );
      return {
        message: "The ride has been started, but no notification sent.",
      };
    }

    const notificationData = {
      title: "Your ride has started!",
      body: "Your ride has started",
      data: {
        ride_id: rideId.toString(),
        chauffeur_id: customer_id.toString(),
      },
      notification_type: "ride_started",
      recipient_type: "customer",
      recipient_id: customerRide.customer_id.toString(),
    };

    await queuePushNotification(customer.device_id, notificationData);

    return { message: "The ride has been started" };
  } catch (error) {
    await addServerLog({
      log_level: "ERROR",
      service_name: "startCustomerRide",
      error_message: `startCustomerRide service error - ${error.message}.`,
    });
    throw error;
  }
};

/**
 * Completes a customer's ride.
 * @param {string} rideId - The ride_id of the ride.
 * @param {string} customerId - The ID of the customer completing the ride.
 */
const completeCustomerRide = async (
  rideId,
  customerId,
  end_time,
  chauffeur_id
) => {
  try {
    const customerRide = await ridesDAO.getRide(`${customerId}`, `#${rideId}`);
    if (!customerRide) {
      const error = new Error("Ride not found.");
      error.statusCode = 404;
      throw error;
    }

    if (customerRide.chauffeur_id.toString() !== chauffeur_id.toString()) {
      const error = new Error(
        "Only the assigned chauffeur can mark the ride as completed."
      );
      error.statusCode = 400;
      throw error;
    }

    if (customerRide.status !== "Started") {
      const error = new Error(
        "Ride has to be started before initiating payment."
      );
      error.statusCode = 400;
      throw error;
    }


    customerRide.end_time = new Date().toISOString();
    customerRide.status = "Payment Initiated";

    if (!Array.isArray(customerRide.status_log)) {
      customerRide.status_log = [];
    }

    customerRide.status_log.push({
      status: "Payment Initiated",
      datetime: customerRide.end_time,
    });

    // Fetch Pricing Information
    let pricing;
    try {
      pricing = await pricingDAO.getPricingForOrg(
        customerRide.organisation_id,
        "AED"
      );
      if (!Array.isArray(pricing)) {
        pricing = [];
      }
    } catch (pricingError) {
      console.error("Error fetching pricing: ", pricingError.message);
      const error = new Error("Failed to retrieve pricing information.");
      error.statusCode = 500;
      throw error;
    }

    if (pricing.length === 0) {
      const error = new Error(
        "Pricing information not found for the organization."
      );
      error.statusCode = 404;
      throw error;
    }

    const user_wallet = await getWalletDetailsByUser(customerId);

    const startedStatus = customerRide.status_log.find(
      (status) => status.status === "Started"
    );
    const paymentInitiatedStatus = customerRide.status_log.find(
      (status) => status.status === "Payment Initiated"
    );

    let estimated_time_in_minutes = 0;
    if (startedStatus && paymentInitiatedStatus) {
      const startedTime = new Date(startedStatus.datetime);
      const paymentInitiatedTime = new Date(paymentInitiatedStatus.datetime);
      estimated_time_in_minutes = Math.floor(
        (paymentInitiatedTime - startedTime) / (1000 * 60)
      );
    }

    //half day calculation if extended over the standard hours the calculation will be based on half day price + remaining number of minutes by per_min rate
    let remainingMinutes = 0, plannedMinues = 0;
    const rateTypes = await rideDAO.findByTypeNames(["half_day", "full_day"]);
    const HOURLY_MINUTES = 60;
    const ROUNDING_THRESHOLD = 10;

    // switch (customerRide.rate_type) {
    //   case "per_hour":
    //   if (startedStatus && paymentInitiatedStatus) {
    //     const startedTime = new Date(startedStatus.datetime);
    //     const paymentInitiatedTime = new Date(paymentInitiatedStatus.datetime);

    //     const actualMinutes = Math.floor(
    //       (paymentInitiatedTime - startedTime) / (1000 * 60)
    //     );

    //     // --- CORE HOURLY BILLING LOGIC ---
    //     let hours = Math.floor(actualMinutes / HOURLY_MINUTES);
    //     let minutes = actualMinutes % HOURLY_MINUTES;

    //     if (minutes > ROUNDING_THRESHOLD) {
    //       hours += 1;
    //       minutes = 0;
    //     }

    //     // Minimum 1 hour charge safety (optional but recommended)
    //     if (hours === 0 && actualMinutes > 0) {
    //       hours = 1;
    //       minutes = 0;
    //     }

    //     plannedMinues = hours * HOURLY_MINUTES;
    //     remainingMinutes = minutes;

    //     // Used only for pricing reference
    //     estimated_time_in_minutes = actualMinutes;

    //     console.log(
    //       "Actual Minutes:", actualMinutes,
    //       "Billable Hours:", hours,
    //       "Planned Minutes:", plannedMinues,
    //       "Remaining Minutes:", remainingMinutes
    //     );
    //   }
    //   break;
    //   case "half_day":
    //     rateTypes.map((rateType) => {
    //       //get the half duration hours
    //       let duration = rateType.duration_hours || 4;

    //       if (rateType.type_name === customerRide.rate_type) {
    //         const halfDayMinutes = duration * 60;
    //         if (startedStatus) {
    //           const startedTime = new Date(startedStatus.datetime);
    //           const totalHours = Math.floor((end_time - startedTime) / 60000);
    //           if (customerRide.is_ride_extended) {
    //             plannedMinues = customerRide.ride_extension_mts;
    //             remainingMinutes = totalHours - plannedMinues - halfDayMinutes;
    //           } else {
    //             //minutes calculated for ride extension over standard time
    //             if (totalHours > halfDayMinutes) {
    //               estimated_time_in_minutes = totalHours - halfDayMinutes;
    //             } else {
    //               estimated_time_in_minutes = 0;
    //             }
    //             plannedMinues = 0;
    //             remainingMinutes = 0;
    //           }
    //         }
    //       }
    //     });
    //     break;
    //   case "full_day":
    //     rateTypes.map((rateType) => {
    //       //get the full duration hours
    //       let duration = rateType.duration_hours || 8;
    //       if (rateType.type_name === customerRide.rate_type) {
    //         const fullDayMinutes = duration * 60;
    //         if (startedStatus) {
    //           const startedTime = new Date(startedStatus.datetime);
    //           const totalHours = Math.floor((end_time - startedTime) / 60000);
    //           if (customerRide.is_ride_extended) {
    //             plannedMinues = customerRide.ride_extension_mts;
    //             remainingMinutes = totalHours - plannedMinues - fullDayMinutes;
    //           } else {
    //             if (totalHours > fullDayMinutes) {
    //               estimated_time_in_minutes = totalHours - fullDayMinutes;
    //             } else {
    //               estimated_time_in_minutes = 0;
    //             }
    //             plannedMinues = 0;
    //             remainingMinutes = 0;
    //           }
    //         }
    //       }
    //     });
    //     break;
    // }

const calculateBillingFromMinutes = (totalMinutes) => {
  // Case 1: 10 minutes or less → per-minute only
  if (totalMinutes <= ROUNDING_THRESHOLD) {
    return {
      billableMinutes: 0,
      remainingMinutes: totalMinutes
    };
  }

  // Case 2: More than 10 minutes → hourly billing starts
  let hours = Math.floor(totalMinutes / HOURLY_MINUTES);
  let remainder = totalMinutes % HOURLY_MINUTES;

  // 11–59 minutes → minimum 1 hour
  if (hours === 0) {
    return {
      billableMinutes: HOURLY_MINUTES,
      remainingMinutes: 0
    };
  }

  // 1 hour or more
  if (remainder > ROUNDING_THRESHOLD) {
    hours += 1;
    remainder = 0;
  }

  return {
    billableMinutes: hours * HOURLY_MINUTES,
    remainingMinutes: remainder
  };
};

if (startedStatus && paymentInitiatedStatus) {
  const startedTime = new Date(startedStatus.datetime);
  const paymentInitiatedTime = new Date(paymentInitiatedStatus.datetime);

  const actualMinutes = Math.floor(
    (paymentInitiatedTime - startedTime) / (1000 * 60)
  );

  const { billableMinutes, remainingMinutes: rem } =
    calculateBillingFromMinutes(actualMinutes);

  plannedMinues = billableMinutes;
  remainingMinutes = rem;
  estimated_time_in_minutes = actualMinutes;

  console.log({
    rateType: customerRide.rate_type,
    actualMinutes,
    plannedMinues,
    remainingMinutes
  });
}



    let customerDetails = {
      organization_id: customerRide.organisation_id,
      customer_id: customerRide.customer_id,
    };
    let estimatedAmount;
    try {
      if (user_wallet.success) {
        estimatedAmount = await calculateEstimatedAmount(
          customerRide.rate_type,
          estimated_time_in_minutes,
          pricing[0],
          [],
          user_wallet.wallet_balance,
          customerRide.coupon_ids,
          customerDetails,
          customerRide.is_ride_extended,
          plannedMinues,
          remainingMinutes
        );
      } else {
        estimatedAmount = await calculateEstimatedAmount(
          customerRide.rate_type,
          estimated_time_in_minutes,
          pricing[0],
          [],
          0,
          customerRide.coupon_ids,
          customerDetails,
          customerRide.is_ride_extended,
          plannedMinues,
          remainingMinutes
        );
      }
      if (!estimatedAmount || typeof estimatedAmount.base_fare !== "number") {
        const error = new Error("Invalid estimated amount calculated.");
        error.statusCode = 404;
        throw error;
      }
    } catch (calculationError) {
      console.error(
        "Error calculating estimated amount: ",
        calculationError.message
      );
      const error = new Error("Failed to calculate estimated amount.");
      error.statusCode = 404;
      throw error;
    }
    customerRide.final_price_calculation = estimatedAmount;
    Object.keys(customerRide).forEach((key) => {
      if (customerRide[key] === undefined) {
        delete customerRide[key];
      }
    });

    const TIP_WINDOW_MS = Number(process.env.TIP_WINDOW_MS || 120000);
    const tipExpiresAt = Date.now() + TIP_WINDOW_MS;

    // 🔒 ONLY fields that must be updated
    const rideUpdatePayload = {
      // lifecycle
      status: "Payment Initiated",
      end_time: customerRide.end_time,
      status_log: customerRide.status_log,

      // pricing
      final_price_calculation: estimatedAmount,

      // tip window init
      tip_status: "PENDING",
      tip_expires_at: tipExpiresAt,
      //tip_amount: 0,
      //respond_to_tip: false,
    };

    // ✅ SINGLE UPDATE — NOTHING ELSE
    await ridesDAO.updateRideByPkSk(
      `${customerId}`,
      `#${rideId}`,
      rideUpdatePayload
    );

    if(customerRide.rate_type === "per_hour"){
      await cancelHourlyEndWarn(customerRide.ride_id);
    }

  const job = await tipQueue.add(
    {
      rideId,
      customerId,
    },
    {
      delay: TIP_WINDOW_MS,
      jobId: `TIP_EXPIRE_${rideId}`, // idempotent
    }
  );

  console.log(`Tip expiry job added for ride ${rideId}:`, job);

    const chauffeurDetails = await userDAO.findByUserId(customerRide.chauffeur_id);

    if (chauffeurDetails.is_salaried === false) {
      const addCommission = await createUserCommissionRecord({
        userId: customerRide.chauffeur_id,
        roleId: 3,
        rideId: rideId,
        rideAmount: customerRide.final_price_calculation.final_total_amount,
      });
      console.log(`Commission added successfully for ride ${rideId} to chauffeur ${customerRide.chauffeur_id}`, addCommission);
    }


    return { message: "Payment Initiated Successfully." };
  } catch (error) {
    await addServerLog({
      log_level: "ERROR",
      service_name: "completeCustomerRide",
      error_message: `completeCustomerRide service error - ${error.message}.`,
    });
    throw error;
  }
};

// Save the optional charges to the customer ride.
const saveOtherCharges = async (rideId, customerId, selectedOtherCharges) => {
  try {
    const PK = `${customerId}`;
    const SK = `#${rideId}`;
    const ride = await ridesDAO.getRide(PK, SK);
    if (!ride) {
      const error = new Error("Ride not found.");
      error.statusCode = 404;
      throw error;
    }
    const updatedRide = {
      ...ride,
      selected_other_charges: selectedOtherCharges,
    };
    await ridesDAO.updateRide(PK, SK, updatedRide);
    return updatedRide;
  } catch (error) {
    await addServerLog({
      log_level: "ERROR",
      service_name: "saveOtherCharges",
      error_message: `saveOtherCharges service error - ${error.message}.`,
    });
    throw error;
  }
};

/**
 * Marks the ride status as 'Reached Customer' and notifies the customer.
 * @param {string} rideId - The ride ID.
 * @param {string} customerId - The customer's ID.
 * @param {string} chauffeurId - The chauffeur's ID.
 * @returns {object} - The updated ride data.
 */
const markChauffeurReachedService = async (rideId, customerId, chauffeurId) => {
  try {
    if (!rideId || !chauffeurId) {
      throw new Error("rideId and chauffeurId are required.");
    }
    const ride = await ridesDAO.getRide(`${customerId}`, `#${rideId}`);
    if (!ride) {
      const error = new Error("Ride not found.");
      error.statusCode = 400;
      throw error;
    }
    if (ride.chauffeur_id.toString() !== chauffeurId.toString()) {
      const error = new Error(
        "Only the assigned chauffeur can mark the ride as reached."
      );
      error.statusCode = 400;
      throw error;
    }
    if (ride.status === "Reached Customer") {
      return { message: "Already marked as 'Reached Customer'", ride: null };
    }
    // if (ride.status !== "Accepted") {
    //   const error = new Error("Cannot mark as reached. Ride is not in 'Accepted' status.");
    //   error.statusCode = 400;
    //   throw error;
    // }
    if (ride.status !== "On-The-Way") {
      const error = new Error("Cannot mark as reached. Ride is not in 'On-The-Way' status.");
      error.statusCode = 400;
      throw error;
    }

    const updatedRide = await ridesDAO.updateRideByPkSk(ride.PK, ride.SK, {
      status: "Reached Customer",
      status_log: [
        ...ride.status_log,
        { status: "Reached Customer", datetime: new Date().toISOString() },
      ],
    });
    console.log(`Ride ${rideId} marked as 'Reached'`);
    const customer = await User.findByPk(ride.customer_id, {
      attributes: ["device_id"],
    });
    if (!customer || !customer.device_id) {
      console.warn(`No device ID found for customer ID: ${ride.customer_id}`);
      return {
        message:
          "Ride marked as 'Reached', but no notification sent (customer device ID not found).",
        ride: updatedRide,
      };
    }
    const notificationData = {
      title: "Your chauffeur has arrived!",
      body: `Your chauffeur has reached your pickup location: ${ride.requested_pickup_point} and your ride will start soon.`,
      data: {
        ride_id: rideId.toString(),
        chauffeur_id: chauffeurId.toString(),
        notification_type: "chauffeur_reached",
      },
      notification_type: "chauffeur_reached",
      recipient_type: "customer",
      recipient_id: ride.customer_id.toString(),
    };
    await queuePushNotification(customer.device_id, notificationData);
    console.log(`Notification sent to customer ID: ${ride.customer_id}`);
    return {
      message:
        "Ride status updated to 'Reached Customer' and notification sent to customer.",
      ride: updatedRide,
    };
  } catch (error) {
    await addServerLog({
      log_level: "ERROR",
      service_name: "markChauffeurReachedService",
      error_message: `markChauffeurReachedService service error - ${error.message}.`,
    });
    throw error;
  }
};

/**
 * Returns the active customer ride for a given chauffeur.
 * If multiple active rides are found, returns the first one.
 */
const getActiveRideForChauffeur = async (chauffeurId) => {
  try {
    const rides = await ridesDAO.getActiveRideForChauffeur(chauffeurId);
    console.log("Fetched active rides:", rides);
    const recentRide = rides.length > 0 ? rides[0] : null;
    let is_organisation_ride = false;

    if (recentRide) {
      console.log("Recent Ride Details:", recentRide);
      is_organisation_ride = parseInt(recentRide.organisation_id) !== 1;
      recentRide.is_organisation_ride = is_organisation_ride;
      recentRide.organisation_id = parseInt(recentRide.organisation_id);
      recentRide.isBeforeRideImages = !!recentRide.before_ride_images;

      // Find vehicle audit for the ride and attach the isVehicleAuditComplete flag
      try {
        const vehicleAudit = await auditDAO.getAuditByRideId(
          recentRide.ride_id
        );
        // Assuming the audit object has a 'complete' property
        recentRide.isVehicleAuditComplete =
          vehicleAudit.length > 0 ? true : false;
        console.log("Vehicle Audit Details:", vehicleAudit);

        let vehicle = null;
        // If vehicle_id exists, fetch vehicle details
        if (recentRide.vehicle_id) {
          vehicle = await vehicleDAO.getById(recentRide.vehicle_id);
          recentRide.vehicle_details = vehicle || "NA";
        }
      } catch (auditError) {
        console.error("Error fetching vehicle audit:", auditError);
        recentRide.isVehicleAuditComplete = false;
      }
    } else {
      console.log("No active ride found for the chauffeur.");
    }

    return recentRide;
  } catch (error) {
    await addServerLog({
      log_level: "ERROR",
      service_name: "getActiveRideForChauffeur",
      error_message: `getActiveRideForChauffeur service error - ${error.message}.`,
    });
    throw error;
  }
};

const getCustomerExtraDetailsFromActiveRide = async (chauffeurId) => {
  try {
    const rides = await ridesDAO.getActiveRideForChauffeur(chauffeurId);
    const recentRide = rides.length > 0 ? rides[0] : null;

    if (recentRide && recentRide.customer_extra_details) {
      return recentRide.customer_extra_details;
    }

    return null;
  } catch (error) {
    await addServerLog({
      log_level: "ERROR",
      service_name: "getCustomerExtraDetailsFromActiveRide",
      error_message: `Service error - ${error.message}`,
    });
    throw error;
  }
};

const getScheduledRideForChauffeur = async (chauffeurId) => {
  try {
    const rides = await ridesDAO.getScheduledRidesForChauffeur(chauffeurId);
    return rides.length > 0 ? rides : null;
  } catch (error) {
    await addServerLog({
      log_level: "ERROR",
      service_name: "getScheduledRideForChauffeur",
      error_message: `getScheduledRideForChauffeur service error - ${error.message}.`,
    });
    throw error;
  }
};

const saveAfterRideImages = async (imagePaths, rideId, customer_id) => {
  try {
    if (!imagePaths || imagePaths.length === 0) {
      throw new Error("No images provided to save.");
    }
    if (!rideId) {
      throw new Error("Ride ID is required to associate images.");
    }
    const updateData = { after_ride_images: imagePaths };
    const rideKey = { PK: `${customer_id}`, SK: `#${rideId}` };
    const ride = await ridesDAO.updateRideTable(rideKey, updateData);
    return { rideId, images: ride };
  } catch (error) {
    await addServerLog({
      log_level: "ERROR",
      service_name: "saveAfterRideImages",
      error_message: `saveAfterRideImages service error - ${error.message}.`,
    });
    throw error;
  }
};

const saveBeforeRideImages = async (imagePaths, rideId, customer_id) => {
  try {
    if (!imagePaths || imagePaths.length === 0) {
      throw new Error("No images provided to save.");
    }
    if (!rideId) {
      throw new Error("Ride ID is required to associate images.");
    }
    const updateData = { before_ride_images: imagePaths };
    const rideKey = { PK: `${customer_id}`, SK: `#${rideId}` };
    const ride = await ridesDAO.updateRideTable(rideKey, updateData);
    return { rideId, images: ride };
  } catch (error) {
    await addServerLog({
      log_level: "ERROR",
      service_name: "saveBeforeRideImages",
      error_message: `saveBeforeRideImages service error - ${error.message}.`,
    });
    throw error;
  }
};

module.exports = {
  respondToRide,
  markChauffeurReachedService,
  startCustomerRide,
  saveOtherCharges,
  completeCustomerRide,
  getActiveRideForChauffeur,
  saveAfterRideImages,
  getScheduledRideForChauffeur,
  saveBeforeRideImages,
  getCustomerExtraDetailsFromActiveRide
};
