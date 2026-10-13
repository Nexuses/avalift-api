const { User } = require("../dto");
const ridesDAO = require("../dao/ridesDAO");
const userDAO = require("../dao/userDAO");
const pricingDAO = require("../dao/pricingsDAO");
const couponDAO = require("../dao/couponDAO");
const currentLocationsDAO = require("../dao/currentLocationsDAO");
const paymentsService = require("../services/paymentsService");
const adminPanelDOA = require("../dao/adminPanelDAO");
const reviewDAO = require("../dao/reviewDAO");
const userProfileDAO = require("../dao/userProfilesDAO");
const { calculateEstimatedAmount } = require("../utils/calculateRate");
const {
  rideRequestDbSchema,
  rideRequestBodySchema,
  calculateEstimateSchema,
  scheduledRideRequestDbSchema,
  scheduledRideRequestBodySchema,
  changeRateTypeSchema,
} = require("../validators/rideRequestValidator");
const { getNearbyUsers } = require("./locationServices");
const { generateOtp } = require("../utils/generalFunctionUtils");
const { custom } = require("joi");
const { queuePushNotification } = require("../adaptors/notificationService");
const {
  buildCancelRideFromCustomerNotificationData,
  buildScheduleRideRemovedNotificationData,
} = require("./chauffeurNotificationDataBuilder");
const {
  buildCustomerRideRequestNotificationData,
} = require("./customerNotificationDataBuilder");
const {
  buildRideCreationNotificationData,
  buildScheduledRideNotificationData,
  buildReScheduledRideNotificationData,
  buildRideCancelNotificationData,
} = require("./adminPanelNotificationDataBuilder");
const vehicleDAO = require("../dao/vehicleDAO");
const { addServerLog } = require("./serverLogsService");
require("dotenv").config();
const { saveOrUpdateScheduledRide } = require("../helpers/scheduleHelper");
const { removeScheduledRide } = require("../helpers/scheduleHelper");
const currentLocationDOA = require("../dao/currentLocationsDAO");
const {
  checkNegativeBalanceAndActiveRide,
} = require("../utils/checkPreviousRideAndNegativeBallance");
const { scheduleHourlyEndWarn } = require("../helpers/scheduleHelper");


/**
 * Handles ride requests made by customers.
 * Ensures no existing ride is active before allowing a new request.
 * Finds nearby chauffeurs and sends notifications.
 * @param {object} rideData - Data from the customer ride request.
 * @param {string} orgId - Organization ID.
 * @param {string} user_id - Customer ID.
 * @returns {string} - The ride_id of the newly created customer ride.
 */
const requestRide = async (rideData, orgId, user_id) => {
  try {
    // Check for Existing Active Rides
    // const existingRides = await ridesDAO.getActiveRidesForCustomer(user_id);
    // if (existingRides && existingRides.length > 0) {
    //   const rideIds = existingRides.map((ride) => ride.ride_id);
    //   const error = new Error(
    //     `You already have an active ride: ${rideIds}. Please complete it before requesting a new one.`
    //   );
    //   error.statusCode = 400;
    //   throw error;
    // }

    const checkAdjustedNegativeBalanceRide =
      await checkNegativeBalanceAndActiveRide(user_id);

    if (checkAdjustedNegativeBalanceRide) {
      const error = new Error(
        "You have a negative balance and should complete the ride with the adjusted negative amount first."
      );
      error.statusCode = 400;
      throw error;
    }

    let vehicleId = rideData.vehicleDetails.vehicle_id;
    console.log(vehicleId);
    const existingRidesForVehicle = await vehicleDAO.getActiveRidesForVehicle(
      vehicleId
    );
    if (existingRidesForVehicle && existingRidesForVehicle.length > 0) {
      const error = new Error(
        `Another ride is already active with this vehicle. Please choose another vehicle. (Ride ID: ${existingRidesForVehicle[0].ride_id})`
      );
      error.statusCode = 400;
      throw error;
    }

    let validatedRideData;
    try {
      validatedRideData = await rideRequestBodySchema.validateAsync(rideData, {
        abortEarly: false,
      });
    } catch (validationError) {
      console.error("Request Validation Failed: ", validationError.details);
      const validationErrorMsg = new Error("Validation Error");
      validationErrorMsg.statusCode = 400;
      validationErrorMsg.details = Array.isArray(validationError.details)
        ? validationError.details.map((err) => err.message)
        : ["Invalid request data"];
      throw validationErrorMsg;
    }

    const { rate_type, estimated_time_in_minutes, coupon_ids } =
      validatedRideData;

    // Fetch Pricing Information
    let pricing;
    try {
      pricing = await pricingDAO.getPricingForOrg(orgId, "AED");
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

    const user_wallet = await paymentsService.getWalletDetailsByUser(user_id);
    console.log("WALLET_BALANCE", user_wallet);

    // Calculate Estimated Amount
    let customerDetails = { organization_id: orgId, customer_id: user_id };
    let estimatedAmount;
    try {
      if (user_wallet.success) {
        estimatedAmount = await calculateEstimatedAmount(
          rate_type,
          estimated_time_in_minutes,
          pricing[0],
          [],
          user_wallet.wallet_balance,
          coupon_ids,
          customerDetails
        );
      } else {
        estimatedAmount = await calculateEstimatedAmount(
          rate_type,
          estimated_time_in_minutes,
          pricing[0],
          [],
          0,
          coupon_ids,
          customerDetails
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

    const customer_details = await userDAO.findByUserId(user_id);
    const selectedCustomerDetails = {
      id: customer_details.id,
      name: `${customer_details.first_name} ${customer_details.last_name}`,
      mobile_number: customer_details.mobile_number,
      country_code: customer_details.country_code,
    };

    await addServerLog({
      log_level: "INFO",
      error_message: `xxx - Estimated mins  ${estimated_time_in_minutes}`,
    });

    // Database Validation
    const data = {
      ...validatedRideData,
      estimated_time_in_minutes: estimated_time_in_minutes,
      customer_id: String(user_id),
      status: "Requested",
      estimated_amount: estimatedAmount.final_total_amount,
      chauffeur_id: 0,
      chauffeur_name: "",
      customer_name: selectedCustomerDetails.name,
      customer_details: selectedCustomerDetails,
      otp: generateOtp(),
      order_date: new Date().toISOString(),
      status_log: [{ status: "Requested", datetime: new Date().toISOString() }],
      organisation_id: orgId ? String(orgId) : null,
      planned_end_time: new Date(
        Date.now() + estimated_time_in_minutes * 60 * 1000
      ).toISOString(),
      vehicle_id: validatedRideData.vehicleDetails.vehicle_id,
      lower_customer_name: selectedCustomerDetails.name.toLowerCase(),
      lower_chauffeur_name: "",
      chauffeur_initiate_apple_pay: false,
      apple_pay_paid: false,
      apple_pay_payment_failed: false,
      respond_to_tip: false
    };

    let dbRideData;
    try {
      dbRideData = await rideRequestDbSchema.validateAsync(data, {
        abortEarly: false,
      });
    } catch (dbValidationError) {
      console.error("Database Validation Failed: ", dbValidationError.details);
      const dbValidationErrorMsg = new Error("Database Validation Error");
      dbValidationErrorMsg.statusCode = 500;
      dbValidationErrorMsg.details = Array.isArray(dbValidationError.details)
        ? dbValidationError.details.map((err) => err.message)
        : ["Unknown database validation error"];
      throw dbValidationErrorMsg;
    }

    // Add Ride to Database
    let ride;
    try {
      ride = await ridesDAO.addRide(dbRideData, "CUSTOMER");
    } catch (addRideError) {
      console.error("Error adding ride to database: ", addRideError.message);
      const error = new Error("Failed to add ride to the database.");
      error.statusCode = 500;
      throw error;
    }

    // Find Nearby Chauffeurs
    let nearbyChauffeurs = [];
    try {
      nearbyChauffeurs = await currentLocationDOA.findNearbyUsers(
        rideData.requested_pickup.lat,
        rideData.requested_pickup.long,
        process.env.NOTIFICATION_RADIUS,
        "chauffeur"
      );
      console.log("radius", process.env.NOTIFICATION_RADIUS);
      if (!Array.isArray(nearbyChauffeurs)) {
        nearbyChauffeurs = [];
      }
    } catch (chauffeursError) {
      console.error(
        "Error fetching nearby chauffeurs: ",
        chauffeursError.message
      );
      await addServerLog({
        log_level: "ERROR",
        service_name: "requestRide",
        error_message: `Error fetching nearby chauffeurs - ${chauffeursError.message}.`,
      });
      throw new Error("Failed to fetch nearby chauffeurs.");
    }

    // `Found ${nearbyChauffeurs.length} nearby chauffeurs`;

    // No Nearby Chauffeurs
    if (nearbyChauffeurs.length === 0) {
          // admin panel notification
    try {
      // Fetch all admin users' device IDs along with user IDs
      const adminUsers = await adminPanelDOA.fetchDeviceIds();
      if (adminUsers.length === 0) {
        console.warn("No active admin users found with valid device IDs.");
      } else {
        await Promise.all(
          adminUsers.map(async ({ user_id, device_id }) => {
            try {
              const notificationData = buildRideCreationNotificationData(
                ride,
                user_id
              );
              await queuePushNotification(device_id, notificationData);
              console.log(`Notification sent to Admin ID: ${user_id}`);
            } catch (notificationError) {
              console.error(
                `Failed to send notification to Admin ID ${user_id}: `,
                notificationError.message
              );
            }
          })
        );
      }
    } catch (error) {
      console.error(
        "Error fetching admin device IDs or sending notifications: ",
        error.message
      );
      await addServerLog({
        log_level: "ERROR",
        service_name: "requestRide",
        error_message: `Admin panel notification error - ${error.message}.`,
      });
    }
      return {
        ride_id: ride.ride_id,
        message:
          "No nearby chauffeurs available at the moment. Contact admin or cancel the ride.",
        statusCode: 200,
      };
    }

    // Fetch Chauffeurs' Device IDs and Send Notifications
    try {
      const nearbyChauffeurIDs = nearbyChauffeurs.map(
        (chauffeur) => chauffeur.user_id
      );
      // Fetch only online chauffeurs who are in the nearby list
      const onlineChauffeurs = await User.findAll({
        where: {
          id: nearbyChauffeurIDs,
          status_id: 1,
          user_availability: true, // to check chauffeur is available or not (disable, enable)
        },
        attributes: ["id", "device_id"],
      });
      if (onlineChauffeurs.length === 0) {
        console.warn("No online chauffeurs available for notifications.");
      }
      // Filter chauffeurs who already have an active ride
      let availableChauffeurs = [];
      for (const chauffeur of onlineChauffeurs) {
        const activeRide = await ridesDAO.getActiveRideForChauffeur(
          chauffeur.id
        );
        if (!activeRide || activeRide.length === 0) {
          availableChauffeurs.push(chauffeur);
        }
      }
      if (availableChauffeurs.length === 0) {
        console.warn("No available chauffeurs without an active ride.");
      }
      await Promise.all(
        availableChauffeurs.map(async (chauffeur) => {
          if (chauffeur.device_id) {
            const notificationData = buildCustomerRideRequestNotificationData(
              ride,
              chauffeur
            );
            console.log("Notification data:", notificationData);
            await queuePushNotification(chauffeur.device_id, notificationData);
          } else {
            console.warn(
              `No device ID found for online chauffeur ID: ${chauffeur.id}`
            );
          }
        })
      );
    } catch (notificationBatchError) {
      console.error(
        "Error sending notifications to chauffeurs: ",
        notificationBatchError.message
      );
      await addServerLog({
        log_level: "ERROR",
        service_name: "requestRide",
        error_message: `Error sending notifications to chauffeurs - ${notificationBatchError.message}.`,
      });
    }

    // admin panel notification
    try {
      // Fetch all admin users' device IDs along with user IDs
      const adminUsers = await adminPanelDOA.fetchDeviceIds();
      if (adminUsers.length === 0) {
        console.warn("No active admin users found with valid device IDs.");
      } else {
        await Promise.all(
          adminUsers.map(async ({ user_id, device_id }) => {
            try {
              const notificationData = buildRideCreationNotificationData(
                ride,
                user_id
              );
              await queuePushNotification(device_id, notificationData);
              console.log(`Notification sent to Admin ID: ${user_id}`);
            } catch (notificationError) {
              console.error(
                `Failed to send notification to Admin ID ${user_id}: `,
                notificationError.message
              );
            }
          })
        );
      }
    } catch (error) {
      console.error(
        "Error fetching admin device IDs or sending notifications: ",
        error.message
      );
      await addServerLog({
        log_level: "ERROR",
        service_name: "requestRide",
        error_message: `Admin panel notification error - ${error.message}.`,
      });
    }

    return {
      ride_id: ride.ride_id,
      message: "Ride requested successfully",
      statusCode: 201,
    };
  } catch (error) {
    if (error.isJoi) {
      console.error("Request Validation Failed: ", error.details);
      const validationError = new Error("Validation Error");
      validationError.statusCode = 400;
      validationError.details = Array.isArray(error.details)
        ? error.details.map((err) => err.message)
        : ["Invalid request data"];
      await addServerLog({
        log_level: "ERROR",
        service_name: "requestRide",
        error_message: `Validation error in requestRide - ${error.message}.`,
      });
      throw validationError;
    }
    if (!error.statusCode) {
      console.error("Request Ride Error: ", error.message);
      error.statusCode = 500; // Generic Internal Server Error
    }
    await addServerLog({
      log_level: "ERROR",
      service_name: "requestRide",
      error_message: `requestRide service error - ${error.message}.`,
    });
    throw error;
  }
};

/**
 * Notify the chauffeur about ride completion initiated by the customer.
 * @param {string} rideId - The ride_id of the ride.
 * @param {string} customerId - The customer's user id.
 */
const initiateEndRide = async (rideId, customerId) => {
  try {
    // Retrieve the customer ride
    const customerRide = await ridesDAO.getRide(
      `${customerId}`,
      `#${rideId}` // SK
    );
    if (!customerRide) {
      const error = new Error("Ride not found.");
      error.statusCode = 404;
      throw error;
    }
    if (customerRide.chauffeur_id === 0) {
      const error = new Error("Your ride has not been accepted.");
      error.statusCode = 400;
      throw error;
    }
    if (customerRide.status !== "Started") {
      const error = new Error("Your ride has not been started.");
      error.statusCode = 400;
      throw error;
    }
    const chauffeurDeviceId = await userDAO.findDeviceIdByUserId(
      customerRide.chauffeur_id
    );
    if (!chauffeurDeviceId) {
      const error = new Error("Could not intimate the chauffeur!");
      error.statusCode = 404;
      throw error;
    }
    if (customerRide && chauffeurDeviceId) {
      // Prepare notification data
      const notificationData = {
        recipient_type: "DRIVER",
        recipient_id: chauffeurDeviceId,
        notification_type: "CUSTOMER_INITIATED_RIDE_COMPLETION",
        title: "Customer Initiated Ride Completion",
        body: `The customer has initiated ride completion for ride ${rideId}. Please take the required steps.`,
        data: {
          ride_id: rideId,
          customer_id: customerId,
        },
      };
      // Queue notification to chauffeur
      await queuePushNotification(chauffeurDeviceId, notificationData);
    }
    return {
      message:
        "Chauffeur notified about ride completion initiation by the customer.",
    };
  } catch (error) {
    console.error("Error in initiateEndRide:", error.message);
    await addServerLog({
      log_level: "ERROR",
      service_name: "initiateEndRide",
      error_message: `initiateEndRide service error - ${error.message}.`,
    });
    throw error;
  }
};

/**
 * Calculates estimated price for a customer's ride.
 * @param {object} rideData - Ride Details for calculating the estimated amount.
 * @param {string} orgId - Organization ID for pricing.
 * @param {string} user_id - User ID to fetch wallet details.
 * @returns {Promise<number>} - The estimated fare amount.
 */
const calculateEstimatedFare = async (rideData, orgId, user_id) => {
  try {
    // Validate ride data from frontend
    const validatedRideData = await calculateEstimateSchema.validateAsync(
      rideData,
      { abortEarly: false }
    );
    // Destructure necessary values
    const {
      rate_type,
      estimated_time_in_minutes,
      coupon_ids,
      coupon_code,
      organization_id,
    } = validatedRideData;
    // Resolve Organization ID
    if (orgId === "*" || !orgId) {
      orgId = organization_id || rideData.organisation_id; // Fallback to rideData if undefined
      console.log("Organization ID set from payload:", orgId);
    } else {
      console.log("Organization ID taken from provided parameter:", orgId);
    }
    // Fetch pricing for the organization
    const pricing = await pricingDAO.getPricingForOrg(orgId, "AED");
    if (!pricing || pricing.length === 0) {
      throw new Error(
        `Pricing information not found for organization ID: ${orgId}`
      );
    }
    // Fetch user wallet details
    const user_wallet = await paymentsService.getWalletDetailsByUser(user_id);
    console.log("User Wallet Details:", user_wallet);
    // Prepare customer details
    const customerDetails = { organization_id: orgId, customer_id: user_id };

    if (coupon_code) {
      // Fetch coupon details
      const couponDetails = await couponDAO.getCouponsByCode(coupon_code);
      if (couponDetails?.length > 0) {
        const { id } = couponDetails[0].dataValues;
        coupon_ids.push(id);
      } else {
        const error = new Error(`Coupon code "${coupon_code}" not found`);
        error.status = 404;
        throw error;
      }
    }
    //console.log("Coupon IDs:", coupon_ids);
    // Calculate estimated amount
    let estimatedAmount;
    if (user_wallet.success) {
      estimatedAmount = calculateEstimatedAmount(
        rate_type,
        estimated_time_in_minutes,
        pricing[0],
        [],
        user_wallet.wallet_balance,
        coupon_ids,
        customerDetails
      );
    } else {
      estimatedAmount = calculateEstimatedAmount(
        rate_type,
        estimated_time_in_minutes,
        pricing[0],
        [],
        user_wallet.wallet_balance,
        coupon_ids,
        customerDetails
      );
    }
    return estimatedAmount;
  } catch (error) {
    console.error("Error calculating estimated fare:", error.message);
    await addServerLog({
      log_level: "ERROR",
      service_name: "calculateEstimatedFare",
      error_message: `calculateEstimatedFare service error - ${error.message}.`,
    });
    throw error;
  }
};

/**
 * Cancels a ride for a customer and updates the chauffeur's ride entry if assigned.
 * Cancellation rules:
 * - If the ride is still in a “Requested” state (i.e. not accepted by any driver), cancellation is free.
 * - If the ride has been accepted by a driver:
 *    • If the driver has not yet reached the pickup location (i.e. no "Reached Customer" event exists) then cancellation is free.
 *    • If the driver has reached the pickup location within 10 mins of accepting the ride, then the cancellation fee would be applied:
 *         - Otherwise cancellation is not applied.
 * - For rides that have “Started”:
 *    • For hourly rides: canceling after start will cost the whole ride amount.
 *    • For per-minute rides: cancellation cost equals the base fare plus the cost corresponding to the time already spent.
 *
 * @param {string} rideId - The Ride ID to cancel.
 * @param {string} userId - The ID of the customer (extracted from token).
 * @param {string} cancellation_reason - Reason for cancellation.
 * @returns {string} - Success or failure message.
 */
const cancelRide = async (rideId, userId, cancellation_reason) => {
  try {
    if (!rideId) {
      const error = new Error("Missing required parameter: rideId");
      error.statusCode = 400;
      throw error;
    }
    const changedUserID = userId.toString();
    // Fetch the ride details from the database
    const ride = await ridesDAO.getRide(changedUserID, `#${rideId}`);
    if (!ride) {
      const error = new Error("Ride not found.");
      error.statusCode = 404;
      throw error;
    }
    if (ride.status === "Cancelled") {
      const error = new Error("Ride has been cancelled already.");
      error.statusCode = 400;
      throw error;
    }
    const now = new Date();
    let cancellationAmount = 0;
    let pricing;
    const paymentMethod = ride.paymentDetails?.payment_method || "Cash";
    // Retrieve pricing information.
    try {
      pricing = await pricingDAO.getPricingForOrg(ride.organisation_id, "AED");
      if (!Array.isArray(pricing) || pricing.length === 0) {
        const error = new Error(
          "Pricing information not found for the organization."
        );
        error.statusCode = 404;
        throw error;
      }
    } catch (pricingError) {
      console.error("Error fetching pricing: ", pricingError.message);
      const error = new Error("Failed to retrieve pricing information.");
      error.statusCode = 500;
      throw error;
    }
    // Can not cancel while in these statuses.
    canNotCancelStatuses = [
      "Payment Initiated",
      "Review-Pending",
      "Completed",
      "Cancelled",
      "Started",
    ];
    if (canNotCancelStatuses.includes(ride.status)) {
      const error = new Error(
        `Ride can not be cancelled while in '${ride.status}' status.`
      );
      error.statusCode = 400;
      throw error;
    }
    let currentTime = new Date();
    //console.log("Current Time:", currentTime);

    // Cancellation logic for non-started rides (Requested state)
    if (ride.status === "Requested") {
      if (ride.ride_type?.toLowerCase() === "scheduled") {
        const scheduledPickupTime = new Date(ride.scheduled_pickup);
        //console.log("Scheduled Pickup Time:", scheduledPickupTime);
        //console.log("Current Time:", currentTime);
        if (
          scheduledPickupTime - currentTime < 3600000 &&
          scheduledPickupTime > currentTime
        ) {
          const error = new Error(
            "Ride can not be cancelled within 1 hour of scheduled time."
          );
          error.statusCode = 400;
          throw error;
        }
      }
      console.log("Ride in requested state - first if block");
      cancellationAmount = 0;
    }
    // Cancellation logic for accepted rides (but not started)
    else if (
      ride.status === "Accepted" ||
      ride.status === "Reached Customer" ||
      ride.status === "On-The-Way"
    ) {
      console.log("Ride in accepted state or reached customer - else if block");
      const acceptedLog = ride.status_log.find(
        (log) => log.status === "Accepted"
      );
      const reachedLog = ride.status_log.find(
        (log) => log.status === "Reached Customer"
      );
      // If both events exist, calculate the time difference between acceptance and reaching the customer
      if (acceptedLog && reachedLog) {
        const acceptedTime = new Date(acceptedLog.datetime);
        const reachedTime = new Date(reachedLog.datetime);
        const diffMins = (reachedTime - acceptedTime) / (1000 * 60);
        // If the driver reached within 10 minutes of accepting, charge the base fare
        if (
          diffMins <= 10 &&
          ride.rate_type !== "rta_test" &&
          ride.rate_type !== "garage_ride"
        ) {
          cancellationAmount = pricing[0].rates.base_fare;
        } else {
          cancellationAmount = 0;
        }
      } else {
        // If either event is missing, assume no fee is applied
        cancellationAmount = 0;
      }
    }
    console.log("Rate Type: ", ride.rate_type);
    console.log("Ride Status: ", ride.status);
    console.log("CANCELLATION AMOUNT: ", cancellationAmount);
    let cancelWalletResponse = null;
    cancellationAmount = Math.round(cancellationAmount) || 0;
    // If a deduction is needed, update the customer's wallet.
    if (cancellationAmount > 0) {
      try {
        cancelWalletResponse = await paymentsService.cancelRideWalletUpdate({
          customer_id: userId,
          ride_id: rideId,
          cancelation_amount: cancellationAmount,
          //payment_type: paymentMethod,
          payment_type: "Wallet",
        });
        if (!cancelWalletResponse.success) {
          const error = new Error("Failed to deduct wallet balance.");
          await addServerLog({
            log_level: "ERROR",
            service_name: "cancelRide",
            error_message: `Failed to deduct ${cancellationAmount} AED from the wallet. ${cancelWalletResponse.error}`,
          });
          error.statusCode = 500;
          throw error;
        }
      } catch (err) {
        const error = new Error(
          `Can not deduct wallet by ${cancellationAmount} AED. ${err.message}`
        );
        error.statusCode = 400;
        throw error;
      }
    }
    let final_price_calculation = {
      final_total_amount: cancellationAmount || 0,
    };
    // Update customer's ride entry to "Cancelled"
    await ridesDAO.updateRideByPkSk(ride.PK, ride.SK, {
      status: "Cancelled",
      final_price_calculation,
      ...(cancellationAmount > 0 && {
        paymentDetails: {
          payment_method: "Wallet", // Update to "Wallet" only if wallet is debited
          card: null, // Explicitly set card to null
        },
      }),
      status_log: [
        ...(ride.status_log || []),
        {
          status: "Cancelled",
          datetime: now.toISOString(),
          message: `The ride has been cancelled${cancellationAmount > 0
            ? ` by deducting ${cancellationAmount} AED from the wallet.`
            : "."
            }`,
          cancellation_reason: cancellation_reason || "Not Provided",
          chauffeur_id: null,
          action_by: `Customer (${userId})`,
        },
      ],
      end_time: new Date().toISOString(),
    });
    let canNotSendNotifStatuses = [
      "Completed",
      "Payment Initiated",
      "Requested",
      "Cancelled",
    ];
    // Send notification to the chauffeur
    if (
      !canNotSendNotifStatuses.includes(ride.status) &&
      ride.chauffeur_id !== 0
    ) {
      const chauffeurDeviceId = await userDAO.findDeviceIdByUserId(
        ride.chauffeur_id
      );
      if (chauffeurDeviceId) {
        const notificationData =
          await buildCancelRideFromCustomerNotificationData(ride);
        await queuePushNotification(chauffeurDeviceId, notificationData);
      }
    }
    // Send notification to the admin
    try {
      const adminUsers = await adminPanelDOA.fetchDeviceIds();
      if (adminUsers && adminUsers.length > 0) {
        await Promise.all(
          adminUsers.map(async ({ user_id, device_id }) => {
            try {
              const notificationData = await buildRideCancelNotificationData(
                ride,
                user_id
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
    } catch (err) {
      console.error(
        "Error fetching admin device IDs or sending notifications: ",
        err.message
      );
      await addServerLog({
        log_level: "ERROR",
        service_name: "cancelRide",
        error_message: `Admin notification error in cancelRide - ${err.message}.`,
      });
    }
    await removeScheduledRide(ride.ride_id);
    return "Ride successfully canceled. You can now book a new ride.";
  } catch (error) {
    console.error("Cancel Ride Error:", error.message);
    await addServerLog({
      log_level: "ERROR",
      service_name: "cancelRide",
      error_message: `cancelRide service error - ${error.message}.`,
    });
    throw error;
  }
};

const getCustomerStatus = async (customer_id) => {
  try {
    // Fetch all active rides for the customer.
    const activeRides = await ridesDAO.getAllActiveRidesForCustomer(
      customer_id
    );
    console.log(activeRides);
    if (!activeRides || !activeRides.length) {
      const error = new Error("No active rides");
      error.statusCode = 400;
      throw error;
    }
    // Optionally filter out any null rides.
    const validRides = activeRides.filter((ride) => ride);
    // Process each ride individually, handling any failures gracefully.
    const ridesResults = await Promise.allSettled(
      validRides.map(async (ride) => {
        const {
          ride_id,
          status,
          chauffeur_id,
          after_ride_images,
          ride_type,
          planned_end_time,
          rate_type,
          status_log,
          paymentDetails,
          final_price_calculation,
          chauffeur_initiate_apple_pay,
          respond_to_tip
        } = ride;
        let current_location = null;
        let chauffeur_details = null;
        let isAfterRideImages = !!after_ride_images;
        // If a chauffeur is assigned, fetch their details.
        if (chauffeur_id) {
          current_location =
            await currentLocationsDAO.findCurrentLocationByUserId(chauffeur_id);
          const chauffeur = await userDAO.findByUserId(chauffeur_id);
          const chauffeurRatingsCount = await reviewDAO.getAverageRating(
            chauffeur_id
          );
          const chauffeur_profile = await userProfileDAO.getUserProfile(
            chauffeur_id
          );

          chauffeur_details = {
            mobile_number: `${chauffeur.country_code}${chauffeur.mobile_number}`,
            name: `${chauffeur.first_name} ${chauffeur.last_name}`,
            average_rating_count: chauffeurRatingsCount,
            profile_pic:
              `https://${process.env.S3_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${chauffeur_profile.images}` ||
              null,
          };
        }
        // Extract the 'Started' status datetime from status_log
        let startedTime = null;
        if (status_log && Array.isArray(status_log)) {
          const startedLog = status_log.find((log) => log.status === "Started");
          if (startedLog) {
            startedTime = startedLog.datetime;
          }
        }
        return {
          ride_id,
          status,
          ride_type,
          chauffeur_id: chauffeur_id || null,
          current_location,
          chauffeur_details,
          isAfterRideImages,
          planned_end_time,
          rate_type,
          started_time: startedTime || "",
          payment_method: paymentDetails?.payment_method || "",
          final_price_calculation,
          chauffeur_initiate_apple_pay,
          respond_to_tip
        };
      })
    );
    // Extract the successful results.
    const ridesData = ridesResults
      .filter((result) => result.status === "fulfilled")
      .map((result) => result.value);
    return { rides: ridesData };
  } catch (error) {
    console.error("Getting customer status error:", error.message);
    await addServerLog({
      log_level: "ERROR",
      service_name: "getCustomerStatus",
      error_message: `getCustomerStatus service error - ${error.message}.`,
    });
    throw error;
  }
};

const getActiveRidesByCustomerId = async (customerId) => {
  try {
    if (!customerId) {
      throw new Error("Customer ID is required");
    }
    const changedCustomerId = customerId.toString();
    const activeRides = await ridesDAO.getActiveRidesByCustomerId(
      changedCustomerId
    );
    //console.log("activeRides", activeRides);
    //console.log("activeRides length", activeRides.length);
    if (!activeRides && activeRides.length === 0) {
      const error = new Error("No active rides found");
      error.statusCode = 404;
      throw error;
    }
    //Map through the rides and get chauffeur id
    const ridesWithChauffeurDetails = await Promise.all(
      activeRides.map(async (ride) => {
        let chauffeurDetails = null;
        if (ride.chauffeur_id) {
          chauffeurDetails = await userDAO.findByUserId(ride.chauffeur_id);
          const chauffeur_profile = await userProfileDAO.getUserProfile(
            ride.chauffeur_id
          );
          chauffeurDetails = {
            mobile_number: `${chauffeurDetails.country_code}${chauffeurDetails.mobile_number}`,
            name: `${chauffeurDetails.first_name} ${chauffeurDetails.last_name}`,
            profile_pic:
              `https://${process.env.S3_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${chauffeur_profile.images}` ||
              null,
          };
        }
        return {
          ...ride,
          chauffeur_details: chauffeurDetails,
        };
      })
    );
    //console.log("ridesWithChauffeurDetails", ridesWithChauffeurDetails);
    return ridesWithChauffeurDetails;
  } catch (error) {
    console.error("Getting customer Rides error:", error.message);
    await addServerLog({
      log_level: "ERROR",
      service_name: "getActiveRidesByCustomerId",
      error_message: `getActiveRidesByCustomerId service error - ${error.message}.`,
    });
    throw error;
  }
};

const scheduleRide = async (rideData, orgId, user_id) => {
  try {
    const checkAdjustedNegativeBalanceRide =
      await checkNegativeBalanceAndActiveRide(user_id);

    if (checkAdjustedNegativeBalanceRide) {
      const error = new Error(
        "You have a negative balance and should complete the ride with the adjusted negative amount first."
      );
      error.statusCode = 400;
      throw error;
    }
    // Validate the request payload.
    let validatedRideData;
    try {
      validatedRideData = await scheduledRideRequestBodySchema.validateAsync(
        rideData,
        {
          abortEarly: false,
        }
      );
    } catch (validationError) {
      console.error("Request Validation Failed: ", validationError.details);
      const validationErrorMsg = new Error("Validation Error");
      validationErrorMsg.statusCode = 400;
      validationErrorMsg.details = Array.isArray(validationError.details)
        ? validationError.details.map((err) => err.message)
        : ["Invalid request data"];
      throw validationErrorMsg;
    }
    // Ensure the scheduled pickup time is in the future.
    const {
      scheduled_pickup,
      rate_type,
      estimated_time_in_minutes,
      coupon_ids,
    } = validatedRideData;
    const currentTime = new Date();
    const scheduledPickupTime = new Date(scheduled_pickup);
    if (!scheduled_pickup || scheduledPickupTime <= currentTime) {
      const error = new Error("Scheduled pickup time must be in the future.");
      error.statusCode = 400;
      throw error;
    }
    // Ensure the ride is scheduled at least 1 hour ahead
    const oneHourLater = new Date(currentTime.getTime() + 60 * 60 * 1000);
    if (scheduledPickupTime < oneHourLater) {
      const error = new Error(
        "You can only schedule a ride at least 1 hour in advance. Please select a later time."
      );
      error.statusCode = 400;
      throw error;
    }
    // Get the vehicle ID
    const vehicleId = rideData.vehicleDetails.vehicle_id;
    // Check for overlapping rides for the vehicle.
    const overlappingRides = await vehicleDAO.getOverlappingRidesForVehicle(
      vehicleId,
      scheduledPickupTime.toISOString(),
      estimated_time_in_minutes
    );
    if (overlappingRides.length > 0) {
      const error = new Error(
        `The selected vehicle has overlapping rides during the scheduled time window. Please choose another vehicle or adjust the scheduled time.`
      );
      error.statusCode = 400;
      throw error;
    }
    // Fetch pricing information.
    let pricing;
    try {
      pricing = await pricingDAO.getPricingForOrg(orgId, "AED");
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
    const user_wallet = await paymentsService.getWalletDetailsByUser(user_id);
    let customerDetails = { organization_id: orgId, customer_id: user_id };
    // Calculate estimated amount.
    let estimatedAmount;
    try {
      if (user_wallet.success) {
        estimatedAmount = await calculateEstimatedAmount(
          rate_type,
          estimated_time_in_minutes,
          pricing[0],
          [],
          user_wallet.wallet_balance,
          coupon_ids,
          customerDetails
        );
      } else {
        estimatedAmount = await calculateEstimatedAmount(
          rate_type,
          estimated_time_in_minutes,
          pricing[0],
          [],
          user_wallet.wallet_balance,
          coupon_ids,
          customerDetails
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
    // Retrieve customer details.
    const customer_details = await userDAO.findByUserId(user_id);
    const selectedCustomerDetails = {
      id: customer_details.id,
      name: `${customer_details.first_name} ${customer_details.last_name}`,
      mobile_number: customer_details.mobile_number,
      country_code: customer_details.country_code,
    };
    // Prepare data to be stored.
    const data = {
      ...validatedRideData,
      estimated_time_in_minutes: estimated_time_in_minutes,
      customer_id: String(user_id),
      status: "Requested",
      estimated_amount: estimatedAmount.final_total_amount,
      chauffeur_id: 0,
      chauffeur_name: "",
      customer_name: selectedCustomerDetails.name,
      customer_details: selectedCustomerDetails,
      //otp: generateOtp(), // if needed for verification purposes.
      order_date: new Date().toISOString(),
      status_log: [
        { status: "Schedule Requested", datetime: new Date().toISOString() },
      ],
      organisation_id: orgId ? String(orgId) : null,
      vehicle_id: validatedRideData.vehicleDetails.vehicle_id,
      planned_end_time: new Date(
        new Date(scheduledPickupTime).getTime() +
        estimated_time_in_minutes * 60 * 1000
      ).toISOString(),
      lower_customer_name: selectedCustomerDetails.name.toLowerCase(),
      lower_chauffeur_name: "",
      chauffeur_initiate_apple_pay: false,
      apple_pay_paid: false,
      apple_pay_payment_failed: false,
    };
    // Validate data against the database schema.
    let dbRideData;
    try {
      dbRideData = await scheduledRideRequestDbSchema.validateAsync(data, {
        abortEarly: false,
      });
    } catch (dbValidationError) {
      console.error("Database Validation Failed: ", dbValidationError.details);
      const dbValidationErrorMsg = new Error("Database Validation Error");
      dbValidationErrorMsg.statusCode = 500;
      dbValidationErrorMsg.details = Array.isArray(dbValidationError.details)
        ? dbValidationError.details.map((err) => err.message)
        : ["Unknown database validation error"];
      throw dbValidationErrorMsg;
    }
    // Add the scheduled ride to the database.
    let ride;
    try {
      ride = await ridesDAO.addRide(dbRideData, "CUSTOMER");
    } catch (addRideError) {
      console.error("Error adding ride to database: ", addRideError.message);
      const error = new Error("Failed to add ride to the database.");
      error.statusCode = 500;
      throw error;
    }
    // 2. Also save/update in Redis
    await saveOrUpdateScheduledRide(ride.ride_id, ride.scheduled_pickup);
    console.log(
      `Ride ${ride.ride_id} scheduled/updated in Redis for pickup at ${ride.scheduled_pickup}`
    );
    // Notify the admin panel about the new scheduled ride.
    try {
      // Fetch all admin users' device IDs along with user IDs.
      const adminUsers = await adminPanelDOA.fetchDeviceIds();
      if (adminUsers.length === 0) {
        console.warn("No active admin users found with valid device IDs.");
      } else {
        await Promise.all(
          adminUsers.map(async ({ user_id, device_id }) => {
            try {
              const notificationData = buildScheduledRideNotificationData(
                ride,
                user_id
              );
              await queuePushNotification(device_id, notificationData);
              console.log(`Notification sent to Admin ID: ${user_id}`);
            } catch (notificationError) {
              console.error(
                `Failed to send notification to Admin ID ${user_id}: `,
                notificationError.message
              );
            }
          })
        );
      }
    } catch (notificationError) {
      console.error(
        "Error fetching admin device IDs or sending notifications: ",
        notificationError.message
      );
      await addServerLog({
        log_level: "ERROR",
        service_name: "scheduleRide",
        error_message: `Admin notification error in scheduleRide - ${notificationError.message}.`,
      });
    }
    return {
      ride_id: ride.ride_id,
      message: "Scheduled ride requested successfully",
      statusCode: 201,
    };
  } catch (error) {
    if (error.isJoi) {
      console.error("Request Validation Failed: ", error.details);
      const validationError = new Error("Validation Error");
      validationError.statusCode = 400;
      validationError.details = Array.isArray(error.details)
        ? error.details.map((err) => err.message)
        : ["Invalid request data"];
      await addServerLog({
        log_level: "ERROR",
        service_name: "scheduleRide",
        error_message: `Validation error in scheduleRide - ${error.message}.`,
      });
      throw validationError;
    }
    if (!error.statusCode) {
      console.error("Schedule Ride Error: ", error.message);
      error.statusCode = 500; // Generic Internal Server Error.
    }
    await addServerLog({
      log_level: "ERROR",
      service_name: "scheduleRide",
      error_message: `scheduleRide service error - ${error.message}.`,
    });
    throw error;
  }
};

const changeRateType = async (inputData, customer_id, organisation_id) => {
  // Validate input using Joi
  const { error, value } = changeRateTypeSchema.validate(inputData, {
    abortEarly: false,
  });
  if (error) {
    throw {
      status: 400,
      message: error.details.map((e) => e.message).join(", "),
    };
  }
  // Use validated values
  const { new_rate_type, additional_minutes, ride_id } = value;

  // Retrieve the ride entry
  const ride = await ridesDAO.getRide(`${customer_id}`, `#${ride_id}`);
  if (!ride) {
    throw { status: 404, message: "Ride not found." };
  }
  const { PK, SK } = ride;
  const currentRateType = ride.rate_type;
  const statusLog = ride.status_log || [];

  // Calculate elapsed minutes using "Started" entry.
  const startedEntry = statusLog.find((entry) => entry.status === "Started");
  if (!startedEntry) {
    throw {
      status: 400,
      message: "Ride must be started before changing the rate type.",
    };
  }
  const startedTime = new Date(startedEntry.datetime);
  const currentTime = new Date();
  const elapsedMinutes = Math.abs((currentTime - startedTime) / 60000);
  // per_min rides are not eligible for extension.
  if (currentRateType === "per_min") {
    throw {
      status: 400,
      message: "Extension not supported for per_min rides.",
    };
  }

  // For per_hour rides:
  if (currentRateType === "per_hour") {
    if (new_rate_type === "per_hour") {
      //Allow for extension of per_hour rides.
    } else if (new_rate_type === "half_day") {
      if (elapsedMinutes > 240) {
        throw {
          status: 400,
          message: "Cannot change to half_day as elapsed time exceeds 4 hours.",
        };
      }
    } else if (new_rate_type === "full_day") {
      if (elapsedMinutes > 480) {
        throw {
          status: 400,
          message: "Cannot change to full_day as elapsed time exceeds 8 hours.",
        };
      }
    }
  }

  // For half_day rides:
  if (currentRateType === "half_day") {
    if (new_rate_type === "half_day") {
      throw {
        status: 400,
        message: "You are already on a Half Day ride.",
      };
    } else if (new_rate_type === "per_hour") {
      // Downgrading to per_hour is allowed.
    } else if (new_rate_type === "full_day") {
      throw {
        status: 400,
        message: "Cannot change to Full day ride."
      }
    }
  }

  // For full_day rides:
  if (currentRateType === "full_day") {
    if (new_rate_type === "full_day") {
      throw {
        status: 400,
        message: "You are already on a Full Day ride.",
      };
    } else if (new_rate_type === "half_day") {
      if (elapsedMinutes > 240) {
        throw {
          status: 400,
          message:
            "Cannot downgrade to half_day as elapsed time exceeds 4 hours.",
        };
      }
    } else if (new_rate_type === "per_hour") {
      if (elapsedMinutes > 480) {
        throw {
          status: 400,
          message:
            "Cannot downgrade to per_hour as elapsed time exceeds 8 hours.",
        };
      }
    }
  }

  // Calculate new planned end time based on the new rate type.
  let newPlannedEndTime;
  // For half_day and full_day rides, planned_end_time is fixed from the ride's start time.
  if (new_rate_type === "half_day") {
    throw {
      status: 400,
      message: "Cannot change to Half day ride."
    }
  } else if (new_rate_type === "full_day") {
    throw {
      status: 400,
      message: "Cannot change to Full day ride."
    }
  } else {
    // For per_hour (or no change in rate type): extend current planned_end_time by additional_minutes.
    newPlannedEndTime = ride.planned_end_time
      ? new Date(ride.planned_end_time)
      : new Date(); // fallback to now if not set
    newPlannedEndTime.setMinutes(
      newPlannedEndTime.getMinutes() + additional_minutes
    );
  }

  // Recalculate estimated time from the ride’s start in minutes
  const newEstimatedTimeInMinutes = Math.round(
    (newPlannedEndTime - startedTime) / 60000
  );

  //Calculate additional time
  let ride_extension_mts = ride.ride_extension_mts;
  ride_extension_mts += additional_minutes;

  // Fetch pricing information.
  let pricing;
  try {
    pricing = await pricingDAO.getPricingForOrg(organisation_id, "AED");
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

  const user_wallet = await paymentsService.getWalletDetailsByUser(customer_id);
  console.log("WALLET_BALANCE", user_wallet);

  //as for half day and full day rate type is not modified as part of change rate type
  //explicitly passing the current rate type as new rate type if changed.
  // Calculate Estimated Amount
  let customerDetails = {
    organization_id: organisation_id,
    customer_id: customer_id,
  };

  let estimatedAmount;
  try {
    if (user_wallet.success) {
      estimatedAmount = await calculateEstimatedAmount(
        //new_rate_type,
        new_rate_type !== currentRateType ? currentRateType : new_rate_type,
        //additional_minutes + ride.estimated_time_in_minutes,
        additional_minutes,
        pricing[0],
        [],
        user_wallet.wallet_balance,
        ride.coupon_ids,
        customerDetails,
        true, //ride extended
        ride_extension_mts,
        0
      );
    } else {
      estimatedAmount = await calculateEstimatedAmount(
        //new_rate_type,
        new_rate_type !== currentRateType ? currentRateType : new_rate_type,
        //additional_minutes + ride.estimated_time_in_minutes,
        additional_minutes,
        pricing[0],
        [],
        0,
        ride.coupon_ids,
        customerDetails,
        true, // ride extended
        ride_extension_mts,
        0
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
    const error = new Error(
      calculationError.message || "Failed to calculate estimated amount."
    );
    error.statusCode = 404;
    throw error;
  }
  // Update the ride's rate_type along with planned_end_time and estimated_time_in_minutes.
  const updateData = {
    //only per-hour will be allowed for extension. so no need to change the rate type to per hour for the base rate type - half day and full day.
    //rate_type: new_rate_type,
    //since the ride is extended to calculate the rate for half day and full day this flag is set to true
    is_ride_extended: true, //extension flag
    estimated_amount: estimatedAmount.final_total_amount,
    planned_end_time: newPlannedEndTime.toISOString(),
    estimated_time_in_minutes: newEstimatedTimeInMinutes,
    ride_extension_mts //extension minutes
  };

  const updatedRide = await ridesDAO.updateRideByPkSk(PK, SK, updateData);
  await scheduleHourlyEndWarn(updatedRide)
  return "Rate type updated successfully.";
};

const rescheduleRide = async (data, orgId, user_id) => {
  try {
    const { ride_id, new_scheduled_pickup } = data;
    // Fetch the existing ride
    const existingRide = await ridesDAO.getRideById(ride_id);
    if (!existingRide) {
      const error = new Error("Ride not found.");
      error.statusCode = 404;
      throw error;
    }

    // Check authorization
    if (existingRide.customer_id !== String(user_id)) {
      const error = new Error("Unauthorized: You cannot reschedule this ride.");
      error.statusCode = 403;
      throw error;
    }
    // Time check
    const currentTime = new Date();
    const scheduledTime = new Date(existingRide.scheduled_pickup);
    const timeDifferenceInHours =
      (scheduledTime - currentTime) / (1000 * 60 * 60);
    const newScheduledTime = new Date(new_scheduled_pickup);

    if (newScheduledTime.getTime() === scheduledTime.getTime()) {
      const error = new Error(
        "Reschedule pickup time cannot be the same as the existing scheduled pickup time."
      );
      error.statusCode = 400;
      throw error;
    }
    // Restrict rescheduling to a maximum of 3 times
    const rescheduleAttempts = existingRide.status_log.filter(
      (log) => log.status === "Rescheduled"
    ).length;

    if (rescheduleAttempts >= 3) {
      const error = new Error(
        "You have reached the maximum rescheduling limit."
      );
      error.statusCode = 400;
      throw error;
    }

    if (timeDifferenceInHours <= 1) {
      const error = new Error(
        "Rescheduling must be done at least 1 hour before the pickup time."
      );
      error.statusCode = 400;
      throw error;
    }

    if (newScheduledTime <= new Date()) {
      const error = new Error(
        "New scheduled pickup time must be in the future."
      );
      error.statusCode = 400;
      throw error;
    }

    // Calculate time shift (difference between new and old scheduled pickup time)
    const timeShiftMinutes =
      (newScheduledTime - new Date(existingRide.scheduled_pickup)) /
      (1000 * 60);

    // Update planned end time based on existing planned end time and the time shift
    let newPlannedEndTime = existingRide.planned_end_time
      ? new Date(existingRide.planned_end_time)
      : new Date(newScheduledTime); // If no planned end time, use the new scheduled pickup

    newPlannedEndTime.setMinutes(
      newPlannedEndTime.getMinutes() + timeShiftMinutes
    );

    // Check for overlapping rides
    const overlappingRides = await vehicleDAO.getOverlappingRidesForVehicle(
      existingRide.vehicle_id,
      newScheduledTime.toISOString(),
      existingRide.estimated_time_in_minutes
    );

    if (overlappingRides.length > 0) {
      const error = new Error("The selected vehicle has overlapping rides.");
      error.statusCode = 400;
      throw error;
    }

    // Unassign chauffeur if assigned
    let chauffeurNotificationSent = false;
    if (existingRide.chauffeur_id && existingRide.chauffeur_id !== 0) {
      const chauffeurId = existingRide.chauffeur_id;
      existingRide.chauffeur_id = 0;
      existingRide.status = "Requested";
      existingRide.chauffeur_name = "";
      existingRide.lower_chauffeur_name = "";

      // Notify the chauffeur about unassignment
      try {
        const chauffeurDeviceId = await userDAO.findDeviceIdByUserId(
          chauffeurId
        );
        if (chauffeurDeviceId) {
          const notificationData =
            buildScheduleRideRemovedNotificationData(existingRide);
          await queuePushNotification(chauffeurDeviceId, notificationData);
          console.log(`Notification sent to Chauffeur ID: ${chauffeurId}`);
          chauffeurNotificationSent = true;
        }
      } catch (chauffeurNotificationError) {
        console.error(
          `Failed to notify Chauffeur ID ${chauffeurId}: `,
          chauffeurNotificationError.message
        );
      }
    }

    // Update the ride
    existingRide.scheduled_pickup = newScheduledTime.toISOString();
    existingRide.planned_end_time = newPlannedEndTime.toISOString();
    //existingRide.status = "Requested";
    existingRide.status_log.push({
      status: "Rescheduled",
      datetime: new Date().toISOString(),
    });

    const updatedRide = await ridesDAO.updateRideByPkSk(
      existingRide.PK,
      existingRide.SK,
      existingRide
    );

    await saveOrUpdateScheduledRide(
      updatedRide.ride_id,
      existingRide.scheduled_pickup
    );

    console.log(
      `Ride ${updatedRide.ride_id} rescheduled to ${existingRide.scheduled_pickup}`
    );

    // Notify the admin panel about the new scheduled ride.
    try {
      // Fetch all admin users' device IDs along with user IDs.
      const adminUsers = await adminPanelDOA.fetchDeviceIds();
      if (adminUsers.length === 0) {
        console.warn("No active admin users found with valid device IDs.");
      } else {
        await Promise.all(
          adminUsers.map(async ({ user_id, device_id }) => {
            try {
              const notificationData = buildReScheduledRideNotificationData(
                updatedRide,
                user_id
              );
              await queuePushNotification(device_id, notificationData);
              console.log(`Notification sent to Admin ID: ${user_id}`);
            } catch (notificationError) {
              console.error(
                `Failed to send notification to Admin ID ${user_id}: `,
                notificationError.message
              );
            }
          })
        );
      }
    } catch (notificationError) {
      console.error(
        "Error fetching admin device IDs or sending notifications: ",
        notificationError.message
      );
    }

    return {
      ride_id: updatedRide.ride_id,
      message: "Ride rescheduled successfully",
      statusCode: 200,
      data: {
        ride_id: updatedRide.ride_id,
        new_scheduled_pickup: updatedRide.scheduled_pickup,
      },
    };
  } catch (error) {
    await addServerLog({
      log_level: "ERROR",
      service_name: "rescheduleRide",
      error_message: `rescheduleRide service error - ${error.message}.`,
    });
    throw error;
  }
};

const isThereACurrentRide = async (data) => {
  try {
    const { vehicle_id } = data;
    if (!vehicle_id) {
      const error = new Error("Vehicle ID is required");
      error.statusCode = 400;
      throw error;
    }
    const existingRidesForVehicle = await vehicleDAO.getActiveRidesForVehicle(
      vehicle_id
    );
    return existingRidesForVehicle.length > 0;
  } catch (error) {
    await addServerLog({
      log_level: "ERROR",
      service_name: "isThereACurrentRide",
      error_message: `isThereACurrentRide service error - ${error.message}.`,
    });
    throw error;
  }
};

module.exports = {
  requestRide,
  initiateEndRide,
  calculateEstimatedFare,
  cancelRide,
  getCustomerStatus,
  getActiveRidesByCustomerId,
  scheduleRide,
  changeRateType,
  rescheduleRide,
  isThereACurrentRide,
};
