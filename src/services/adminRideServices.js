require("dotenv").config();
const ridesDAO = require("../dao/ridesDAO");
const pricingDAO = require("../dao/pricingsDAO");
const userDAO = require("../dao/userDAO");
const adminPanelDAO = require("../dao/adminPanelDAO");
const chauffeurNotification = require("./chauffeurNotificationDataBuilder");
const notificationService = require("../adaptors/notificationService");
const { queuePushNotification } = require("../adaptors/notificationService");
const { calculateEstimatedAmount } = require("../utils/calculateRate");
const { generateOtp } = require("../utils/generalFunctionUtils");
const { adminCreateRideSchema } = require("../validators/rideRequestValidator");
const ridesAdminPanelDAO = require("../dao/ridesAdminpanelDOA");
const pricingsDAO = require("../dao/pricingsDAO");
const { User } = require("../dto");
require("dotenv").config();
const paymentsService = require("./paymentsService");
const {
  buildCustomerRideRequestNotificationData,
  buildAcceptNotification,
  buildOrganisationRideRequestNotificationData,
  buildOrganisationScheduledRideRequestNotificationData,
} = require("./customerNotificationDataBuilder");
// const  {getAvailableChauffeurs}  = require('./adminRideServices');
const { removeScheduledRide } = require("../helpers/scheduleHelper");
const { getWalletDetailsByUser } = require("../services/paymentsService");
const { addServerLog } = require("../services/serverLogsService"); // Adjust path if needed
const vehicleDAO = require("../dao/vehicleDAO");
const {
  scheduledRideRequestBodySchema,
  scheduledRideRequestDbSchema,
} = require("../validators/adminValidator");
const { saveOrUpdateScheduledRide } = require("../helpers/scheduleHelper");
const {
  buildNotifyCustomerAboutRescheduleFromAdmin,
} = require("../services/adminPanelNotificationDataBuilder");
const paymentsDAO = require("../dao/paymentsDAO");
const auditDAO = require("../dao/auditDAO");
const rideExportService = require("../services/rideExportService");
const chauffeurRidesDAO = require("../dao/chauffeurRidesDAO");
const organizationsDAO = require("../dao/organizationDAO");
const currentLocationDOA = require("../dao/currentLocationsDAO");
const {
  checkNegativeBalanceAndActiveRide,
} = require("../utils/checkPreviousRideAndNegativeBallance");
const { validateRegion, validateEditRegion } = require("../validators/vehicleValidator");
const rideDAO = require("../dao/rideDAO");
const { sendBulkNotification } = require("../workers/bulkNotification");
const notificationDOA = require("../dao/notificationDOA");
const { scheduleHourlyEndWarn, cancelHourlyEndWarn } = require("../helpers/scheduleHelper");

module.exports = {
  createRide: async (rideData, user_id, organisation_id) => {
    try {
      // Check if the user has an active ride
      // if (rideData.organisation_ride === false) {
      //   const existingRides = await ridesDAO.getActiveRidesForCustomer(user_id);
      //   if (existingRides.length > 0) {
      //     const rideIds = existingRides.map((ride) => ride.ride_id);
      //     throw new Error(
      //       `You already have an active ride: ${rideIds}. Please complete it first.`
      //     );
      //   }
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
          `Another ride is already active with this vehicle. Please choose another vehicle.`
        );
        error.statusCode = 400;
        throw error;
      }

      if (!organisation_id) {
        throw new Error("Organization Id of admin cannot be null.");
      }

      // Validate ride data
      const validatedRideData = await adminCreateRideSchema.validateAsync(
        rideData,
        {
          abortEarly: false,
        }
      );

      // Set organization ID
      const finalOrganisationId =
        organisation_id !== "*" ? organisation_id : rideData.organisation_id;

      // Fetch pricing for organization
      const pricing = await pricingDAO.getPricingForOrg(
        finalOrganisationId,
        "AED"
      );

      // Fetch wallet details
      const user_wallet = await paymentsService.getWalletDetailsByUser(user_id);
      const walletBalance = user_wallet.success
        ? user_wallet.wallet_balance
        : 0;

      // Estimate ride amount
      const customerDetails = {
        organization_id: finalOrganisationId,
        customer_id: user_id,
      };
      const estimatedAmount = await calculateEstimatedAmount(
        rideData.rate_type,
        rideData.estimated_time_in_minutes,
        pricing[0],
        [],
        walletBalance,
        [],
        customerDetails
      );

      if (!estimatedAmount?.base_fare) {
        throw new Error("Invalid estimated amount calculated.");
      }

      // Fetch customer details
      const customer_details = await userDAO.findByUserId(user_id);
      const selectedCustomerDetails = {
        id: customer_details.id,
        name: `${customer_details.first_name} ${customer_details.last_name}`,
        mobile_number: customer_details.mobile_number,
        country_code: customer_details.country_code,
      };

      // Ensure 'organisation_ride' is provided
      if (!("organisation_ride" in rideData)) {
        throw new Error("organisation_ride must be provided");
      }

      console.log(
        "Org_id:",
        organisation_id,
        "Chauffeur ID:",
        rideData.chauffeur_id,
        "Chauffeur Name:",
        rideData.chauffeur_name
      );

      // ✅ Allow rides without a chauffeur
      if (
        !rideData.chauffeur_id ||
        rideData.chauffeur_id === 0 ||
        !rideData.chauffeur_name?.trim()
      ) {
        console.warn(
          `Warning: Chauffeur details are missing. This ride will be assigned without a chauffeur.`
        );
        rideData.chauffeur_id = 0; // Default to 0 when no chauffeur is assigned
        rideData.chauffeur_name = "";
        rideData.status = "Requested"; // 🚗 If no chauffeur, ride stays "Requested"
      } else {
        rideData.status = "Accepted"; // ✅ If chauffeur exists, set ride to "Accepted"
      }

      // ✅ Set status log based on ride status
      const statusLogEntry =
        rideData.status === "Accepted"
          ? {
            status: "Accepted",
            datetime: new Date().toISOString(),
            action: "Created and assigned by Admin",
          }
          : {
            status: "Requested",
            datetime: new Date().toISOString(),
            action: "Created by Admin",
          };

      // Prepare ride data
      const data = {
        ...rideData,
        customer_id: user_id,
        estimated_amount: estimatedAmount.base_fare,
        otp: generateOtp(),
        status_log: [statusLogEntry],
        organisation_id: finalOrganisationId,
        updatedAt: new Date().toISOString(),
        customer_details: selectedCustomerDetails,
        order_date: new Date().toISOString(),
        planned_end_time: new Date(
          Date.now() + rideData.estimated_time_in_minutes * 60 * 1000
        ).toISOString(),
        vehicle_id: rideData.vehicleDetails?.vehicle_id || null,
        customer_name: selectedCustomerDetails.name,
        lower_customer_name: selectedCustomerDetails.name.toLowerCase(),
        chauffeur_initiate_apple_pay: false,
        apple_pay_paid: false,
        apple_pay_payment_failed: false,
      };

      const ride = await ridesDAO.addRide(data, "CUSTOMER");

      // Handle notifications
      if (rideData.status === "Accepted") {
        // ✅ Send notification to assigned chauffeur
        const messageData =
          await chauffeurNotification.buildAssignNotificationData(data);
        const user = await userDAO.findDeviceIdByUserId(rideData.chauffeur_id);
        await notificationService.queuePushNotification(user, messageData);
      } else if (
        rideData.status === "Requested" &&
        rideData.organisation_ride === false
      ) {
        // may be here need to send the notification to org user
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
          return {
            ride_id: ride.ride_id,
            message:
              "No nearby chauffeurs available at the moment. Please assign a chauffeur.",
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
                const notificationData =
                  buildCustomerRideRequestNotificationData(ride, chauffeur);
                console.log("Notification data:", notificationData);
                await queuePushNotification(
                  chauffeur.device_id,
                  notificationData
                );
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

        return ride;
      }
    } catch (error) {
      console.error("Error creating ride:", error.message);
      await addServerLog({
        log_level: "ERROR",
        service_name: "createRide",
        error_message: `createRide Service error - ${error.message}.`,
      });
      throw error;
    }
  },

  createOrgRide: async (rideData, user_id, organisation_id) => {
    try {
      console.log("User ID:", user_id);
      console.log("Organisation ID:", organisation_id);
      // if (organisation_id === 1) {
      //   throw new Error("This endpoint is only for corporate customers.");
      // }

      // Ensure that this endpoint is used only for organisation rides.
      // if (!rideData.organisation_ride) {
      //   throw new Error("This endpoint only accepts organisation rides.");
      // }
      let notifyAdmin = false;
      if (organisation_id === "*" || organisation_id === "1") {
        organisation_id = rideData.organisation_id
        const orgUser = await organizationsDAO.getUsersForOrganization(organisation_id);
        if (orgUser.length > 0) {
          user_id = orgUser[0].id;
        }
        notifyAdmin = true
      }

      let vehicleId = rideData.vehicleDetails.vehicle_id;
      console.log(vehicleId);
      const existingRidesForVehicle = await vehicleDAO.getActiveRidesForVehicle(
        vehicleId
      );
      if (existingRidesForVehicle && existingRidesForVehicle.length > 0) {
        const error = new Error(
          `Another ride is already active with this vehicle. Please choose another vehicle.`
        );
        error.statusCode = 400;
        throw error;
      }

      if (!organisation_id) {
        throw new Error("Organization Id of admin cannot be null.");
      }

      // Validate ride data using the same schema as admin rides.
      const validatedRideData = await adminCreateRideSchema.validateAsync(
        rideData,
        {
          abortEarly: false,
        }
      );

      // Fetch pricing information.
      const pricing = await pricingDAO.getPricingForOrg(organisation_id, "AED");

      // Fetch wallet details.
      const user_wallet = await paymentsService.getWalletDetailsByUser(user_id);
      const walletBalance = user_wallet.success
        ? user_wallet.wallet_balance
        : 0;

      // Calculate the estimated amount for the ride.
      const customerDetails = {
        organization_id: organisation_id,
        customer_id: user_id,
      };
      const estimatedAmount = await calculateEstimatedAmount(
        rideData.rate_type,
        rideData.estimated_time_in_minutes,
        pricing[0],
        [],
        walletBalance,
        [],
        customerDetails
      );

      if (!estimatedAmount?.base_fare) {
        throw new Error("Invalid estimated amount calculated.");
      }

      // Fetch customer details.
      const customer_details = await userDAO.findByUserId(user_id);
      const selectedCustomerDetails = {
        id: customer_details.id,
        name: `${customer_details.first_name} ${customer_details.last_name}`,
        mobile_number: customer_details.mobile_number,
        country_code: customer_details.country_code,
      };

      let statusLogEntry = [];

      // For organisation rides, we assume no chauffeur assignment at creation.
      if (rideData.chauffeur_id !== 0) {
        rideData.status = "Accepted";

        statusLogEntry = [
          {
            status: "Requested",
            datetime: new Date().toISOString(),
            action: "Created by Admin User",
          },
          {
            status: "Accepted",
            datetime: new Date().toISOString(),
            action: "Assigned by Admin User",
          },
        ];
      } else {
        rideData.status = "Requested";

        // Log the ride creation status.
        statusLogEntry = [
          {
            status: "Requested",
            datetime: new Date().toISOString(),
            action: "Created by Organisation User",
          }
        ];
      }

      // Prepare the ride data object.
      const data = {
        ...rideData,
        customer_id: user_id.toString(),
        estimated_amount:
          rideData.rate_type === "fixed"
            ? estimatedAmount.final_total_amount
            : estimatedAmount.base_fare,
        otp: generateOtp(),
        status_log: statusLogEntry,
        organisation_id: organisation_id,
        updatedAt: new Date().toISOString(),
        customer_details: selectedCustomerDetails,
        order_date: new Date().toISOString(),
        planned_end_time: new Date(
          Date.now() + rideData.estimated_time_in_minutes * 60 * 1000
        ).toISOString(),
        vehicle_id: rideData.vehicleDetails?.vehicle_id || null,
        customer_name: selectedCustomerDetails.name,
        lower_customer_name: selectedCustomerDetails.name.toLowerCase(),
      };

      const ride = await ridesDAO.addRide(data, "CUSTOMER");

      if (notifyAdmin === false) {
        // === Notification Logic: Notify Admins Only ===
        // Fetch the list of admin users for ziezzu.
        const adminUsers = await adminPanelDAO.getZiezzuAdmins();

        // For each admin with a valid device ID, queue a push notification.
        await Promise.all(
          adminUsers.map(async (admin) => {
            if (admin.device_id) {
              const notificationData =
                buildOrganisationRideRequestNotificationData(ride, admin);
              await notificationService.queuePushNotification(
                admin.device_id,
                notificationData
              );
            }
          })
        );
      }

      // === Notification Logic: Notify Chauffeurs ===
      if (rideData.chauffeur_id !== 0) {
        // Fetch chauffeur details
        const chauffeurDeviceId = await userDAO.findDeviceIdByUserId(rideData.chauffeur_id);
        if (chauffeurDeviceId) {
          const notificationData =
            await chauffeurNotification.buildAssignNotificationData(ride);
          await notificationService.queuePushNotification(
            chauffeurDeviceId,
            notificationData
          );
        }
      }

      return ride;
    } catch (error) {
      console.error("Error creating organisation ride:", error.message);
      await addServerLog({
        log_level: "ERROR",
        service_name: "createOrgRide",
        error_message: `createOrgRide Service error - ${error.message}.`,
      });
      throw error;
    }
  },

  getAvailableChauffeurs: async () => {
    try {
      // Step 1: Fetch all available chauffeurs
      const allChauffeurs = await userDAO.findAvailabaleChauffeur();
      const chauffeurIds = allChauffeurs.map((chauffeur) => chauffeur.id);

      // Step 2: Check for active rides using getActiveRideForChauffeur()
      const availableChauffeurs = [];
      for (const chauffeurId of chauffeurIds) {
        const activeRide = await ridesDAO.getActiveRideForChauffeur(
          chauffeurId
        );

        if (!activeRide || activeRide.length === 0) {
          availableChauffeurs.push(chauffeurId); // Only keep chauffeurs with NO active rides
        }
      }

      // Step 3: Map filtered chauffeur IDs back to chauffeur details
      const mappedResult = availableChauffeurs
        .map((chauffeurId) => {
          const chauffeur = allChauffeurs.find((c) => c.id === chauffeurId);
          return chauffeur
            ? {
              id: chauffeur.id,
              name: `${chauffeur.first_name} ${chauffeur.last_name}`,
            }
            : null;
        })
        .filter((chauffeur) => chauffeur !== null);

      return mappedResult;
    } catch (error) {
      console.error("Error fetching available chauffeurs:", error.message);
      await addServerLog({
        log_level: "ERROR",
        service_name: "getAvailableChauffeurs",
        error_message: `getAvailableChauffeurs Service error - ${error.message}.`,
      });
      throw error;
    }
  },

  cancelRide: async (data, user_id) => {
    try {
      const { ride_id, customer_id, cancellation_reason, cancellation_origin } =
        data;
      // Validate required parameters
      if (!ride_id || !customer_id) {
        const error = new Error(
          "Missing required parameters: rideId and userId"
        );
        error.statusCode = 400;
        throw error;
      }

      // Convert userId to string for consistency
      const changedUserID = customer_id.toString();

      // Fetch ride details
      const ride = await ridesDAO.getRide(changedUserID, `#${ride_id}`);
      if (!ride) {
        const error = new Error("Ride not found.");
        error.statusCode = 404;
        throw error;
      }

      // Check if ride is already cancelled or in an invalid state for cancellation
      const notAllowedStatuses = [
        "Review-Pending",
        "Payment-Pending",
        "Cancelled",
      ];
      if (notAllowedStatuses.includes(ride.status)) {
        const error = new Error(
          `Ride cannot be cancelled when in '${ride.status}' status.`
        );
        error.statusCode = 400;
        throw error;
      }

      // Initialize cancellation amount and other variables
      let cancellationAmount = 0;
      let pricing;
      const paymentMethod = ride.paymentDetails?.payment_method || "Cash";
      const now = new Date();

      // Retrieve pricing information
      try {
        pricing = await pricingDAO.getPricingForOrg(
          ride.organisation_id,
          "AED"
        );
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

      // Differentiate logic based on cancellation origin
      if (cancellation_origin === "admin") {
        // For company-side cancellations (admin), you may want to
        // process cancellation without applying the usual fee logic.
        // Optionally, you could decide to deduct a fixed amount if needed.
        console.log("Cancellation initiated from company side.");
        // Example: set cancellation amount to 0 or a predefined fee.
        cancellationAmount = 0;
      } else if (cancellation_origin === "user") {
        // For user-side cancellation, use the detailed fee logic.
        if (ride.status === "Requested") {
          console.log("Ride in requested state - no cancellation fee applied.");
          cancellationAmount = 0;
        } else if (
          ride.status === "Accepted" ||
          ride.status === "Reached Customer" || ride.status === "On-The-Way"
        ) {
          console.log(
            "Ride in accepted state or reached customer - calculating fee."
          );
          const acceptedLog = ride.status_log.find(
            (log) => log.status === "Accepted"
          );
          const reachedLog = ride.status_log.find(
            (log) => log.status === "Reached Customer"
          );

          if (acceptedLog && reachedLog) {
            const acceptedTime = new Date(acceptedLog.datetime);
            const reachedTime = new Date(reachedLog.datetime);
            const diffMins = (reachedTime - acceptedTime) / (1000 * 60);
            // If driver reached within 10 minutes, charge base fare
            if (diffMins <= 10 && ride.rate_type !== "rta_test" && ride.rate_type !== "garage_ride") {
              cancellationAmount = pricing[0].rates.base_fare;
            } else {
              cancellationAmount = 0;
            }
          }
        } else if (ride.status === "Started") {
          console.log("Ride in started state - else if block");
          if (
            ride.rate_type ===
            ("per_hour" ||
              "full_day" ||
              "half_day" ||
              "garage_ride" ||
              "rta_test")
          ) {
            console.log("Hourly rate if block");
            // For hourly rides, canceling after start costs the entire ride amount.
            cancellationAmount = ride.estimated_amount;
          } else if (ride.rate_type === "per_min") {
            console.log("Per minute else if block");
            const startedLog = ride.status_log.find(
              (log) => log.status === "Started"
            );
            if (!startedLog) {
              const error = new Error(
                "Invalid ride status log: 'Started' event missing."
              );
              error.statusCode = 500;
              throw error;
            }
            const startedTime = new Date(startedLog.datetime);
            const minutesElapsed = (now - startedTime) / (1000 * 60);
            cancellationAmount =
              pricing[0].rates.base_fare +
              Math.ceil(minutesElapsed) * pricing[0].rates.per_min;
          } else {
            console.log("Default else block");
            // Default to base fare if ride type is not specified
            cancellationAmount = pricing[0].rates.base_fare;
          }
        }
        // If cancellation amount is more than zero, update the wallet accordingly.
        cancellationAmount = Math.round(cancellationAmount) || 0;
        if (cancellationAmount > 0) {
          let cancelWalletResponse = null;
          try {
            cancelWalletResponse = await paymentsService.cancelRideWalletUpdate(
              {
                customer_id: customer_id,
                ride_id: ride_id,
                cancelation_amount: cancellationAmount,
                payment_type: "Wallet",
              }
            );
            if (!cancelWalletResponse.success) {
              const error = new Error("Failed to deduct wallet balance.");
              await addServerLog({
                log_level: "ERROR",
                error_message: `Failed to deduct ${cancellationAmount} AED from the wallet. ${cancelWalletResponse.error}`,
              });
              error.statusCode = 500;
              throw error;
            }
          } catch (walletError) {
            const error = new Error(
              `Cannot deduct wallet amount of ${cancellationAmount} AED.`
            );
            error.statusCode = 400;
            throw error;
          }
        }
      } else {
        // If the origin is not recognized, throw an error.
        const error = new Error("Invalid cancellation origin provided.");
        error.statusCode = 400;
        throw error;
      }

      // Build final price calculation object
      let final_price_calculation = { final_total_amount: cancellationAmount };

      // Update the ride status and add the cancellation log
      await ridesDAO.updateRideByPkSk(ride.PK, ride.SK, {
        status: "Cancelled",
        final_price_calculation,
        ...(cancellationAmount > 0 && {
          paymentDetails: {
            payment_method: "Wallet", // Update to "Wallet" only if wallet is debited
            card: null, // Explicitly set card to null
          },
        }), // If cancellationAmount === 0, paymentDetails remains unchanged
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
            action_by: cancellation_origin === "admin" ? `ADMIN (${user_id})` : `Customer (${user_id})`,
          },
        ],
        end_time: new Date().toISOString()
      });

      // (Optional) Send notifications if needed (for chauffeurs, admin, etc.)
      // If required, add conditions to send notifications only when appropriate.

      // Remove the ride from the scheduled rides queue
      await removeScheduledRide(ride.ride_id);

      if (ride.rate_type === "per_hour") {
        // If it's an hourly ride, clear any scheduled end warnings
        await cancelHourlyEndWarn(ride.ride_id);
      }

      return cancellation_origin === "admin"
        ? "Ride cancelled via company panel."
        : "Ride successfully cancelled. You can now book a new ride.";
    } catch (error) {
      console.error("Error cancelling the ride:", error.message);
      await addServerLog({
        log_level: "ERROR",
        service_name: "cancelRide",
        error_message: `cancelRide Service error - ${error.message}.`,
      });
      throw error;
    }
  },

  fetchRideByStatus: async (data) => {
    try {
      const rides = await ridesAdminPanelDAO.fetchRideByStatus(data);
      return rides;
    } catch (error) {
      console.error("Failed to fetch ride by status:", error.message);
      await addServerLog({
        log_level: "ERROR",
        service_name: "fetchRideByStatus",
        error_message: `fetchRideByStatus Service error - ${error.message}.`,
      });
      throw error;
    }
  },

  fetchFares: async () => {
    try {
      const fares = await pricingsDAO.fetchFares();

      if (!fares || fares.length === 0) {
        return [];
      }

      //console.log("fares", fares)

      const organizationIds = [
        ...new Set(fares.map((fare) => fare.organization_id).filter(Boolean)),
      ];

      //console.log("ids", organizationIds)

      const orgMap = await organizationsDAO.fetchOrganizationDetails(
        organizationIds
      );
      //console.log("here", orgMap)

      const filteredFares = fares.map((fare) => ({
        ...fare,
        organisation_name:
          orgMap[fare.organization_id]?.name || "Unknown Organization",
      }));

      return filteredFares;
    } catch (error) {
      console.error("Failed to fetch fare:", error.message);
      await addServerLog({
        log_level: "ERROR",
        service_name: "fetchFares",
        error_message: `fetchFares Service error - ${error.message}.`,
      });
      throw error;
    }
  },

  /**
   * Marks the ride status as 'Reached Customer' and notifies the customer.
   * @param {string} rideId - The ride ID.
   * @param {string} customerId - The customer's ID.
   * @returns {object} - The updated ride data.
   */
  adminMarksChauffeurReachedService: async (rideId, customerId) => {
    try {
      if (!rideId || !customerId) {
        throw new Error("rideId and customerId are required.");
      }
      const ride = await ridesDAO.getRide(`${customerId}`, `#${rideId}`);
      if (!ride) {
        const error = new Error("Ride not found.");
        error.statusCode = 400;
        throw error;
      }

      if (ride.status === "Reached Customer") {
        return { message: "Already marked as 'Reached Customer'", ride: null };
      }
      if (ride.status !== "Accepted" && ride.status !== "On-The-Way") {
        const error = new Error(
          "Cannot mark as reached. Ride is not in 'Accepted' or 'On-The-Way' status."
        );
        error.statusCode = 400;
        throw error;
      }
      const updatedRide = await ridesDAO.updateRideByPkSk(ride.PK, ride.SK, {
        status: "Reached Customer",
        status_log: [
          ...ride.status_log,
          {
            status: "Reached Customer",
            datetime: new Date().toISOString(),
            action: "By admin",
          },
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
      let chauffeurId = ride.chauffeur_id.toString();
      const notificationData = {
        title: "Your chauffeur has arrived!",
        body: `Your chauffeur has reached your pickup location: ${ride.requested_pickup_point} and your ride will start soon.`,
        data: {
          ride_id: rideId.toString(),
          chauffeur_id: chauffeurId.toString(),
          notification_type: "chauffeur_reached",
        },
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
        service_name: "adminMarksChauffeurReachedService",
        error_message: `adminMarksChauffeurReachedService service error - ${error.message}.`,
      });
      throw error;
    }
  },

  adminMarksChauffeurOnTheWayService: async (rideId, customerId) => {
    try {
      if (!rideId || !customerId) {
        throw new Error("rideId and customerId are required.");
      }
      const ride = await ridesDAO.getRide(`${customerId}`, `#${rideId}`);
      if (!ride) {
        const error = new Error("Ride not found.");
        error.statusCode = 400;
        throw error;
      }

      if (ride.status === "On-The-Way") {
        return { message: "Already marked as 'On-The-Way'", ride: null };
      }
      if (ride.status !== "Accepted") {
        const error = new Error(
          "Cannot mark as On-The-Way. Ride is not in 'Accepted' status."
        );
        error.statusCode = 400;
        throw error;
      }
      const updatedRide = await ridesDAO.updateRideByPkSk(ride.PK, ride.SK, {
        status: "On-The-Way",
        status_log: [
          ...ride.status_log,
          {
            status: "On-The-Way",
            datetime: new Date().toISOString(),
            action: "By admin",
          },
        ],
      });
      console.log(`Ride ${rideId} marked as 'On-The-Way'`);
      const customer = await User.findByPk(ride.customer_id, {
        attributes: ["device_id"],
      });
      if (!customer || !customer.device_id) {
        console.warn(`No device ID found for customer ID: ${ride.customer_id}`);
        return {
          message:
            "Ride marked as 'On-The-Way', but no notification sent (customer device ID not found).",
          ride: updatedRide,
        };
      }
      let chauffeurId = ride.chauffeur_id.toString();
      const notificationData = {
        title: "Your chauffeur is on the way!",
        body: `Your chauffeur is on the way to your pickup location: ${ride.requested_pickup_point}.`,
        data: {
          ride_id: rideId.toString(),
          chauffeur_id: chauffeurId.toString(),
        },
        notification_type: "chauffeur_on_the_way",
        recipient_type: "customer",
        recipient_id: ride.customer_id.toString(),
      };
      await queuePushNotification(customer.device_id, notificationData);
      console.log(`Notification sent to customer ID: ${ride.customer_id}`);
      return {
        message:
          "Ride status updated to 'On-The-Way' and notification sent to customer.",
        ride: updatedRide,
      };
    } catch (error) {
      await addServerLog({
        log_level: "ERROR",
        service_name: "adminMarksChauffeurOnTheWayService",
        error_message: `adminMarksChauffeurOnTheWayService service error - ${error.message}.`,
      });
      throw error;
    }
  },
  /**
   * Marks the ride as 'Started'
   * @param {string} rideId - The ride_id of the ride.
   * @param {string} customerId - The chauffeur's ID.
   */
  adminStartsCustomerRide: async (rideId, customer_id) => {
    try {
      const customerRide = await ridesDAO.getRide(
        `${customer_id}`,
        `#${rideId}`
      );
      if (!customerRide) {
        const error = new Error("Ride not found.");
        error.statusCode = 404;
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
          {
            status: "Started",
            datetime: new Date().toISOString(),
            action: "By admin",
          },
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
        service_name: "adminStartsCustomerRide",
        error_message: `adminStartsCustomerRide service error - ${error.message}.`,
      });
      throw error;
    }
  },

  /**
   * Completes a customer's ride.
   * @param {string} rideId - The ride_id of the ride.
   * @param {string} customerId - The ID of the customer completing the ride.
   */
  adminInitiatesCustomerRidePaymentService: async (rideId, customerId, end_time) => {
    try {
      const customerRide = await ridesDAO.getRide(
        `${customerId}`,
        `#${rideId}`
      );
      if (!customerRide) {
        const error = new Error("Ride not found.");
        error.statusCode = 404;
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
        action: "By Admin",
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
      // switch (customerRide.rate_type) {
      //   case "per_hour":
      //   if (startedStatus && paymentInitiatedStatus) {
      //     const startedTime = new Date(startedStatus.datetime);
      //     const paymentInitiatedTime = new Date(paymentInitiatedStatus.datetime);
      //     const plannedEndTime = new Date(customerRide.planned_end_time);

      //     const actualMinutes = Math.floor(
      //       (paymentInitiatedTime - startedTime) / (1000 * 60)
      //     );

      //     const plannedMinutes = customerRide.estimated_time_in_minutes;
      //     // Math.floor(
      //     //   (customerRide.estimated_time_in_minutes) / (1000 * 60)
      //     // );

      //     const plannedHours = Math.ceil(plannedMinutes / 60);

      //     if (customerRide.is_ride_extended) {
      //       // Use ride_extension_mts as planned
      //       plannedMinues = customerRide.ride_extension_mts;
      //       //remainingMinutes = actualMinutes - plannedMinues;
      //       remainingMinutes = Math.floor((end_time - plannedEndTime) / 60000);
      //     } else {
      //       // Regular case: round up booked planned hours, then per-minute extra
      //       plannedMinues = plannedHours * 60;
      //       remainingMinutes =
      //         actualMinutes > plannedMinues
      //           ? actualMinutes - plannedMinues
      //           : 0;
      //     }

      //     estimated_time_in_minutes = plannedMinutes;

      //     console.log(
      //       "Planned Hours:",
      //       plannedHours,
      //       "Planned Minutes:",
      //       plannedMinues,
      //       "Actual Minutes:",
      //       actualMinutes,
      //       "Remaining Extra Minutes:",
      //       remainingMinutes,
      //       "Is Extended:",
      //       customerRide.is_ride_extended
      //     );
      //   }
      //   break;
      //   // case "per_hour":
      //   //   if (startedStatus) {
      //   //     const perHourMinutes = 60;
      //   //     const startedTime = new Date(startedStatus.datetime);
      //   //     const totalHours = Math.floor((end_time - startedTime) / 60000);
      //   //     console.log('is ride exte', customerRide.is_ride_extended);
      //   //     if (customerRide.is_ride_extended) {
      //   //       plannedMinues = customerRide.ride_extension_mts;
      //   //       remainingMinutes = totalHours - plannedMinues - perHourMinutes;
      //   //     } else {
      //   //       //minutes calculated for ride extension over standard time
      //   //       // if (totalHours > perHourMinutes) {
      //   //       //   estimated_time_in_minutes = totalHours - perHourMinutes;
      //   //       // } else {
      //   //       //   estimated_time_in_minutes = 0;
      //   //       // }
      //   //       if (startedStatus && paymentInitiatedStatus) {
      //   //         const startedTime = new Date(startedStatus.datetime);
      //   //         const paymentInitiatedTime = new Date(paymentInitiatedStatus.datetime);
      //   //         estimated_time_in_minutes = Math.floor(
      //   //           (paymentInitiatedTime - startedTime) / (1000 * 60)
      //   //         );
      //   //       }
      //   //       plannedMinues = 0;
      //   //       remainingMinutes = 0;
      //   //     }
      //   //   }
      //   //   console.log('estimated_time_in_minutes', estimated_time_in_minutes);
      //   //   console.log('planned mi', plannedMinues);
      //   //   console.log('remain min', remainingMinutes);
      //   //   break;
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

      const HOURLY_MINUTES = 60;
      const ROUNDING_THRESHOLD = 10;

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
      await ridesDAO.updateRideByPkSk(
        `${customerId}`,
        `#${rideId}`,
        customerRide
      );

      if (customerRide.rate_type === "per_hour") {
        await cancelHourlyEndWarn(customerRide.ride_id);
      }

      return { message: "Payment Initiated Successfully." };
    } catch (error) {
      await addServerLog({
        log_level: "ERROR",
        service_name: "adminInitiatesCustomerRidePaymentService",
        error_message: `adminInitiatesCustomerRidePaymentService - ${error.message}.`,
      });
      throw error;
    }
  },

  scheduleRideFromAdmin: async (rideData, user_id, orgId) => {
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
      // Validate input and ensure scheduled pickup time is in the future
      let validatedRideData;
      try {
        validatedRideData = await scheduledRideRequestBodySchema.validateAsync(
          rideData,
          { abortEarly: false }
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

      const currentTime = new Date();
      const scheduledPickupTime = new Date(validatedRideData.scheduled_pickup);
      if (
        !validatedRideData.scheduled_pickup ||
        scheduledPickupTime <= currentTime
      ) {
        const error = new Error("Scheduled pickup time must be in the future.");
        error.statusCode = 400;
        throw error;
      }

      // Require ride to be scheduled at least 1 hour from now
      const oneHourLater = new Date(currentTime.getTime() + 60 * 60 * 1000);
      if (scheduledPickupTime < oneHourLater) {
        const error = new Error(
          "You can only schedule a ride at least 1 hour in advance. Please select a later time."
        );
        error.statusCode = 400;
        throw error;
      }

      if (!orgId) {
        throw new Error("Organization ID cannot be null.");
      }
      // If orgId is "*", use rideData.organisation_id; otherwise use orgId
      const finalOrganisationId =
        orgId !== "*" ? orgId : rideData.organisation_id;

      // Check if user has an active ride
      // const existingRides = await ridesDAO.getActiveRidesForCustomer(user_id);
      // if (existingRides.length > 0) {
      //   const rideIds = existingRides.map((ride) => ride.ride_id);
      //   throw new Error(
      //     `User already has an active ride: ${rideIds}. Please complete it first.`
      //   );
      // }

      // Check for overlapping rides for the selected vehicle
      const vehicleId = validatedRideData.vehicleDetails.vehicle_id;
      const overlappingRides = await vehicleDAO.getOverlappingRidesForVehicle(
        vehicleId,
        scheduledPickupTime.toISOString(),
        validatedRideData.estimated_time_in_minutes
      );
      if (overlappingRides.length > 0) {
        const error = new Error(
          "The selected vehicle has overlapping rides during the scheduled time window. " +
          "Please choose another vehicle or adjust the scheduled time."
        );
        error.statusCode = 400;
        throw error;
      }

      // Fetch pricing for the organization
      let pricing;
      try {
        pricing = await pricingDAO.getPricingForOrg(finalOrganisationId, "AED");
        if (!Array.isArray(pricing) || pricing.length === 0) {
          throw new Error(
            "Pricing information not found for the organization."
          );
        }
      } catch (pricingError) {
        console.error("Error fetching pricing: ", pricingError.message);
        const error = new Error("Failed to retrieve pricing information.");
        error.statusCode = 500;
        throw error;
      }

      // Fetch user wallet details
      const user_wallet = await paymentsService.getWalletDetailsByUser(user_id);
      const walletBalance = user_wallet.success
        ? user_wallet.wallet_balance
        : 0;

      // Calculate estimated amount
      let estimatedAmount;
      const { rate_type, estimated_time_in_minutes, coupon_ids } =
        validatedRideData;

      const customerDetailsForCalc = {
        organization_id: finalOrganisationId,
        customer_id: user_id,
      };

      try {
        estimatedAmount = await calculateEstimatedAmount(
          rate_type,
          estimated_time_in_minutes,
          pricing[0],
          [],
          walletBalance,
          coupon_ids,
          customerDetailsForCalc
        );
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

      // Fetch the customer details
      const customer_details = await userDAO.findByUserId(user_id);
      const selectedCustomerDetails = {
        id: customer_details.id,
        name: `${customer_details.first_name} ${customer_details.last_name}`,
        mobile_number: customer_details.mobile_number,
        country_code: customer_details.country_code,
      };

      // Handle chauffeur assignment logic
      //   - If chauffeur_id is provided & valid -> set ride status to "Scheduled-Assigned" (or "Accepted")
      //   - Else -> set ride status to "Scheduled-Requested"
      let rideStatus, chauffeurId, chauffeurName;

      if (
        !validatedRideData.chauffeur_id ||
        Number(validatedRideData.chauffeur_id) === 0 ||
        !validatedRideData.chauffeur_name?.trim()
      ) {
        // No chauffeur assigned
        chauffeurId = 0;
        chauffeurName = "";
        rideStatus = "Requested";
        console.warn(
          "Warning: No chauffeur assigned. This scheduled ride will remain in 'Scheduled-Requested' status."
        );
      } else {
        // Chauffeur assigned
        chauffeurId = validatedRideData.chauffeur_id;
        chauffeurName = validatedRideData.chauffeur_name;
        rideStatus = "Accepted";
      }

      // Prepare the ride data object
      const data = {
        ...validatedRideData,
        customer_id: String(user_id),
        organisation_id: String(finalOrganisationId),
        estimated_time_in_minutes,
        estimated_amount: estimatedAmount.final_total_amount,
        chauffeur_id: chauffeurId,
        chauffeur_name: chauffeurName,
        lower_chauffeur_name: chauffeurName.toLowerCase(),
        customer_name: selectedCustomerDetails.name,
        lower_customer_name: selectedCustomerDetails.name.toLowerCase(),
        customer_details: selectedCustomerDetails,
        // otp: generateOtp(), // optional for scheduled rides
        order_date: new Date().toISOString(),
        status: rideStatus,
        status_log: [
          {
            status: rideStatus,
            datetime: new Date().toISOString(),
            action: "Scheduled ride created by Admin",
          },
        ],
        vehicle_id: vehicleId,
        planned_end_time: new Date(
          scheduledPickupTime.getTime() + estimated_time_in_minutes * 60 * 1000
        ).toISOString(),
        chauffeur_initiate_apple_pay: false,
        apple_pay_paid: false,
        apple_pay_payment_failed: false,
      };

      // Validate the data (for DB insertion) if you have a separate schema
      let dbRideData;
      try {
        dbRideData = await scheduledRideRequestDbSchema.validateAsync(data, {
          abortEarly: false,
        });
      } catch (dbValidationError) {
        console.error(
          "Database Validation Failed: ",
          dbValidationError.details
        );
        const dbValidationErrorMsg = new Error("Database Validation Error");
        dbValidationErrorMsg.statusCode = 500;
        dbValidationErrorMsg.details = Array.isArray(dbValidationError.details)
          ? dbValidationError.details.map((err) => err.message)
          : ["Unknown database validation error"];
        throw dbValidationErrorMsg;
      }

      // Add the scheduled ride to the database
      let ride;
      try {
        ride = await ridesDAO.addRide(dbRideData, "CUSTOMER");
      } catch (addRideError) {
        console.error("Error adding ride to database: ", addRideError.message);
        const error = new Error("Failed to add ride to the database.");
        error.statusCode = 500;
        throw error;
      }

      // If chauffeur is not assigned => store in Redis & send 'scheduled creation' notifications
      // If chauffeur is assigned => send confirmation notification to the customer
      if (chauffeurId === 0) {
        // No chauffeur: Add to Redis for scheduling logic/notifications
        await saveOrUpdateScheduledRide(ride.ride_id, ride.scheduled_pickup);
        console.log(
          `Ride ${ride.ride_id} scheduled/updated in Redis for pickup at ${ride.scheduled_pickup}`
        );
      } else {
        // Chauffeur is assigned.
        // await saveOrUpdateScheduledRide(ride.ride_id, ride.scheduled_pickup);
        try {
          const notificationData =
            chauffeurNotification.buildScheduledAssignNotificationData(ride);
          const chauffeurDeviceId = await userDAO.findDeviceIdByUserId(
            ride.chauffeur_id
          );
          if (chauffeurDeviceId) {
            await queuePushNotification(chauffeurDeviceId, notificationData);
            console.log(
              `Scheduled Ride Confirmation notification sent to Chauffeur: ${ride.chauffeur_id}`
            );
          }
        } catch (confirmationError) {
          console.error(
            "Error sending scheduled ride confirmation to Chauffeur:",
            confirmationError.message
          );
          await addServerLog({
            log_level: "ERROR",
            service_name: "scheduleRideFromAdmin",
            error_message: `Customer notification error - ${confirmationError.message}.`,
          });
        }

        //send a confirmation notification to the customer:
        try {
          const notificationData = buildAcceptNotification(ride);
          // If you store the customer's device info somewhere:
          const customerDeviceId = await userDAO.findDeviceIdByUserId(user_id);
          if (customerDeviceId) {
            await queuePushNotification(customerDeviceId, notificationData);
            console.log(
              `Scheduled Ride Confirmation notification sent to Customer: ${user_id}`
            );
          }
        } catch (confirmationError) {
          console.error(
            "Error sending scheduled ride confirmation to customer:",
            confirmationError.message
          );
          await addServerLog({
            log_level: "ERROR",
            service_name: "scheduleRideFromAdmin",
            error_message: `Customer notification error - ${confirmationError.message}.`,
          });
        }
      }

      // Return success response
      return {
        ride_id: ride.ride_id,
        message: "Scheduled ride created successfully from Admin panel",
        statusCode: 201,
      };
    } catch (error) {
      if (error.isJoi) {
        // Validation error from Joi
        console.error("Request Validation Failed: ", error.details);
        const validationError = new Error("Validation Error");
        validationError.statusCode = 400;
        validationError.details = Array.isArray(error.details)
          ? error.details.map((err) => err.message)
          : ["Invalid request data"];
        await addServerLog({
          log_level: "ERROR",
          service_name: "scheduleRideFromAdmin",
          error_message: `Validation error - ${error.message}.`,
        });
        throw validationError;
      }

      if (!error.statusCode) {
        console.error("Schedule Ride Error: ", error.message);
        error.statusCode = 500;
      }
      await addServerLog({
        log_level: "ERROR",
        service_name: "scheduleRideFromAdmin",
        error_message: `scheduleRideFromAdmin service error - ${error.message}.`,
      });
      throw error;
    }
  },

  rescheduleRideFromAdmin: async (data, orgId) => {
    try {
      const { ride_id, new_scheduled_pickup } = data;

      // Fetch the existing ride
      const existingRide = await ridesDAO.getRideById(ride_id);
      if (!existingRide) {
        const error = new Error("Ride not found.");
        error.statusCode = 404;
        throw error;
      }

      // Admin panel assumed to have proper authorization,
      // but you may add additional admin checks if required.

      const currentTime = new Date();
      const scheduledTime = new Date(existingRide.scheduled_pickup);
      const newScheduledTime = new Date(new_scheduled_pickup);

      // Prevent same scheduled time update
      if (newScheduledTime.getTime() === scheduledTime.getTime()) {
        const error = new Error(
          "Reschedule pickup time cannot be the same as the existing scheduled pickup time."
        );
        error.statusCode = 400;
        throw error;
      }

      // Limit the number of reschedules to 3 attempts
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

      // Ensure rescheduling is done at least 1 hour before the current pickup time
      const timeDifferenceInHours =
        (scheduledTime - currentTime) / (1000 * 60 * 60);
      if (timeDifferenceInHours <= 1) {
        const error = new Error(
          "Rescheduling must be done at least 1 hour before the pickup time."
        );
        error.statusCode = 400;
        throw error;
      }

      // Ensure the new scheduled time is in the future
      if (newScheduledTime <= currentTime) {
        const error = new Error(
          "New scheduled pickup time must be in the future."
        );
        error.statusCode = 400;
        throw error;
      }

      // Calculate time shift (in minutes) to adjust the planned end time
      const timeShiftMinutes = (newScheduledTime - scheduledTime) / (1000 * 60);
      let newPlannedEndTime = existingRide.planned_end_time
        ? new Date(existingRide.planned_end_time)
        : new Date(newScheduledTime);
      newPlannedEndTime.setMinutes(
        newPlannedEndTime.getMinutes() + timeShiftMinutes
      );

      // Check for overlapping rides for the same vehicle
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

      // Unassign chauffeur if one was previously assigned and notify them
      if (existingRide.chauffeur_id && existingRide.chauffeur_id !== 0) {
        const chauffeurId = existingRide.chauffeur_id;
        existingRide.chauffeur_id = 0;
        existingRide.chauffeur_name = "";
        existingRide.lower_chauffeur_name = "";
        try {
          const chauffeurDeviceId = await userDAO.findDeviceIdByUserId(
            chauffeurId
          );
          if (chauffeurDeviceId) {
            const notificationData =
              chauffeurNotification.buildScheduleRideRemovedNotificationData(
                existingRide
              );
            await queuePushNotification(chauffeurDeviceId, notificationData);
            console.log(`Notification sent to Chauffeur ID: ${chauffeurId}`);
          }
        } catch (notificationError) {
          console.error(
            `Failed to notify Chauffeur ID ${chauffeurId}:`,
            notificationError.message
          );
        }
      }

      // Update ride schedule and planned end time
      existingRide.scheduled_pickup = newScheduledTime.toISOString();
      existingRide.planned_end_time = newPlannedEndTime.toISOString();
      existingRide.status = "Requested";
      existingRide.status_log.push({
        status: "Rescheduled",
        datetime: new Date().toISOString(),
        action: "Ride rescheduled by admin",
      });

      // Save the updated ride in the database
      const updatedRide = await ridesDAO.updateRideByPkSk(
        existingRide.PK,
        existingRide.SK,
        existingRide
      );

      // Update ride schedule in Redis
      await saveOrUpdateScheduledRide(
        updatedRide.ride_id,
        updatedRide.scheduled_pickup
      );
      console.log(
        `Ride ${updatedRide.ride_id} rescheduled to ${updatedRide.scheduled_pickup}`
      );

      // Notify the customer about the reschedule
      try {
        const customerDevice = await userDAO.findDeviceIdByUserId(
          updatedRide.customer_id
        );
        if (customerDevice) {
          const notificationData =
            buildNotifyCustomerAboutRescheduleFromAdmin(updatedRide); // need to change this
          await queuePushNotification(
            customerDevice.device_id,
            notificationData
          );
          console.log(
            `Notification sent to Customer ID: ${updatedRide.customer_id}`
          );
        }
      } catch (notificationError) {
        console.error(
          "Error sending notification to customer:",
          notificationError.message
        );
      }

      return {
        ride_id: updatedRide.ride_id,
        message: "Ride rescheduled successfully from admin panel",
        statusCode: 200,
        data: {
          ride_id: updatedRide.ride_id,
          new_scheduled_pickup: updatedRide.scheduled_pickup,
        },
      };
    } catch (error) {
      await addServerLog({
        log_level: "ERROR",
        service_name: "rescheduleRideFromAdmin",
        error_message: `rescheduleRideFromAdmin service error - ${error.message}.`,
      });
      throw error;
    }
  },
  getChauffeurWalletLogs: async (start_date, end_date) => {
    try {
      const logs = await paymentsDAO.getChauffeurWalletLogs(
        start_date,
        end_date
      );
      return logs;
    } catch (error) {
      await addServerLog({
        log_level: "ERROR",
        service_name: "getChauffeurWalletLogs",
        error_message: `getChauffeurWalletLogs service error - ${error.message}.`,
      });
      throw error;
    }
  },

  getPDWalletLogs: async (start_date, end_date) => {
    try {
      const logs = await paymentsDAO.getPDWalletLogs(start_date, end_date);
      return logs;
    } catch (error) {
      await addServerLog({
        log_level: "ERROR",
        service_name: "getPDWalletLogs",
        error_message: `getPDWalletLogs service error - ${error.message}.`,
      });
      throw error;
    }
  },
  getAdminWalletLogs: async (start_date, end_date) => {
    try {
      const logs = await paymentsDAO.getAdminWalletLogs(start_date, end_date);
      return logs;
    } catch (error) {
      await addServerLog({
        log_level: "ERROR",
        service_name: "getAdminWalletLogs",
        error_message: `getAdminWalletLogs service error - ${error.message}.`,
      });
      throw error;
    }
  },

  cancelPdRide: async (data) => {
    const { ride_id, chauffeur_id } = data;
    try {
      const ride = await chauffeurRidesDAO.getRideById(ride_id);
      if (!ride) {
        throw new Error("Ride not found");
      }

      if (ride.status === "Cancelled") {
        throw new Error("Ride is already cancelled");
      }

      if (ride.status === "Completed") {
        throw new Error("Ride is already completed");
      }

      const updatedRideData = {
        ...ride,
        status: "Cancelled",
        status_log: [
          ...ride.status_log,
          {
            status: "Cancelled",
            datetime: new Date().toISOString(),
            action: "Ride cancelled by admin",
          },
        ],
      };

      const updatedRide = await chauffeurRidesDAO.updateRideByPkSk(
        chauffeur_id,
        ride_id,
        updatedRideData
      );

      return {
        message: "Ride cancelled successfully",
        statusCode: 200,
        data: {
          ride_id: updatedRide.ride_id,
          status: updatedRide.status,
        },
      };
    } catch (error) {
      await addServerLog({
        log_level: "ERROR",
        service_name: "cancelPdRide",
        error_message: `cancelPdRide service error - ${error.message}.`,
      });
      throw error;
    }
  },
  getVehicleAudit: async (ride_id) => {
    try {
      const logs = await auditDAO.getAuditByRideId(ride_id);

      const pdfPath = await rideExportService.exportVehicleAuditToPdf(logs);
      await auditDAO.updateAuditTable(ride_id, pdfPath[0].url);
      return pdfPath;
    } catch (error) {
      await addServerLog({
        log_level: "ERROR",
        service_name: "getVehicleAudit",
        error_message: `getVehicleAudit service error - ${error.message}.`,
      });
      throw error;
    }
  },

  scheduleOrgRide: async (rideData, user_id, organisation_id) => {
    try {
      // Ensure this endpoint is used for organization rides only
      if (!rideData.organisation_ride) {
        throw new Error("This endpoint only accepts organisation rides.");
      }

      if (!organisation_id) {
        throw new Error("Organization ID is required.");
      }

      // Validate input using the same schema
      let validatedRideData;
      try {
        validatedRideData = await scheduledRideRequestBodySchema.validateAsync(
          rideData,
          {
            abortEarly: false,
          }
        );
      } catch (validationError) {
        const error = new Error("Validation Error");
        error.statusCode = 400;
        error.details = Array.isArray(validationError.details)
          ? validationError.details.map((err) => err.message)
          : ["Invalid request data"];
        throw error;
      }

      // Validate scheduled pickup time
      const currentTime = new Date();
      const scheduledPickupTime = new Date(validatedRideData.scheduled_pickup);

      if (
        !validatedRideData.scheduled_pickup ||
        scheduledPickupTime <= currentTime
      ) {
        throw new Error("Scheduled pickup time must be in the future.");
      }

      // const oneHourLater = new Date(currentTime.getTime() + 60 * 60 * 1000);
      // if (scheduledPickupTime < oneHourLater) {
      //   throw new Error("Scheduled ride must be at least 1 hour in advance.");
      // }

      // Fetch pricing
      const pricing = await pricingDAO.getPricingForOrg(organisation_id, "AED");
      if (!Array.isArray(pricing) || pricing.length === 0) {
        throw new Error("Pricing info not found.");
      }

      // Fetch user wallet
      const user_wallet = await paymentsService.getWalletDetailsByUser(user_id);
      const walletBalance = user_wallet.success
        ? user_wallet.wallet_balance
        : 0;

      const estimatedAmount = await calculateEstimatedAmount(
        validatedRideData.rate_type,
        validatedRideData.estimated_time_in_minutes,
        pricing[0],
        [],
        walletBalance,
        validatedRideData.coupon_ids || [],
        { organization_id: organisation_id, customer_id: user_id }
      );

      if (!estimatedAmount || typeof estimatedAmount.base_fare !== "number") {
        throw new Error("Failed to calculate estimated fare.");
      }

      // Fetch customer details
      const customer_details = await userDAO.findByUserId(user_id);
      const selectedCustomerDetails = {
        id: customer_details.id,
        name: `${customer_details.first_name} ${customer_details.last_name}`,
        mobile_number: customer_details.mobile_number,
        country_code: customer_details.country_code,
      };

      // Set ride status
      const rideStatus = "Requested";

      const rideDataToSave = {
        ...validatedRideData,
        customer_id: String(user_id),
        organisation_id: String(organisation_id),
        estimated_time_in_minutes: validatedRideData.estimated_time_in_minutes,
        estimated_amount: estimatedAmount.final_total_amount,
        customer_name: selectedCustomerDetails.name,
        lower_customer_name: selectedCustomerDetails.name.toLowerCase(),
        customer_details: selectedCustomerDetails,
        order_date: new Date().toISOString(),
        status: rideStatus,
        status_log: [
          {
            status: rideStatus,
            datetime: new Date().toISOString(),
            action: "Scheduled ride created by Organisation User",
          },
        ],
        vehicle_id: validatedRideData.vehicleDetails.vehicle_id || null,
        planned_end_time: new Date(
          scheduledPickupTime.getTime() +
          validatedRideData.estimated_time_in_minutes * 60 * 1000
        ).toISOString(),
      };

      console.log("rideDataToSave", rideDataToSave);

      // DB validation
      const dbRideData = await scheduledRideRequestDbSchema.validateAsync(
        rideDataToSave,
        {
          abortEarly: false,
        }
      );

      // Add to DB
      const ride = await ridesDAO.addRide(dbRideData, "CUSTOMER");

      //console.log("ride",ride);
      await saveOrUpdateScheduledRide(ride.ride_id, ride.scheduled_pickup);
      console.log(
        `Ride ${ride.ride_id} scheduled/updated in Redis for pickup at ${ride.scheduled_pickup}`
      );
      // Notify admins
      const adminUsers = await adminPanelDAO.fetchDeviceIds();
      //console.log("adminUsers",adminUsers);

      await Promise.all(
        adminUsers.map(async (admin) => {
          if (admin.device_id) {
            const notificationData =
              buildOrganisationScheduledRideRequestNotificationData(
                ride,
                admin
              );
            await notificationService.queuePushNotification(
              admin.device_id,
              notificationData
            );
          }
        })
      );

      return {
        ride_id: ride.ride_id,
        message: "Scheduled ride created successfully from Organisation panel",
        statusCode: 201,
      };
    } catch (error) {
      console.error("Error in scheduleOrgRide:", error.message);
      await addServerLog({
        log_level: "ERROR",
        service_name: "scheduleOrgRide",
        error_message: `scheduleOrgRide service error - ${error.message}.`,
      });

      if (!error.statusCode) {
        error.statusCode = 500;
      }
      throw error;
    }
  },
  addNewRegion: async (data) => {
    try {
      const validatedData = await validateRegion(data);
      const response = await vehicleDAO.addNewRegion(validatedData);
      return response;
    } catch (error) {
      console.error("Error in addNewRegion Service:", error.message);
      await addServerLog({
        log_level: "ERROR",
        service_name: "addNewRegion",
        error_message: `addNewRegion Service error - ${error.message}.`
      });
      throw error;
    }
  },
  editRegion: async (data) => {
    try {
      const validatedData = await validateEditRegion(data);
      const response = await vehicleDAO.editRegion(validatedData);
      return response;
    } catch (error) {
      console.error("Error in editRegion Service:", error.message);
      await addServerLog({
        log_level: "ERROR",
        service_name: "editRegion",
        error_message: `editRegion Service error - ${error.message}.`
      });
      throw error;
    }
  },

  sendBulkNotification: async(data) => {
    try {
      const { title, message, userType } = data;
      const userTypes = ['individual', 'chauffeur', 'pd'];
      if (!userTypes.includes(userType)) {
        throw new Error('Invalid user type. Must be individual, chauffeur, or pd.');
      }
      const result = await sendBulkNotification(title, message, userType);
      return result;
    } catch (error) {
      console.error("Error in sendBulkNotification Service:", error.message);
      await addServerLog({
        log_level: "ERROR",
        service_name: "sendBulkNotification",
        error_message: `sendBulkNotification Service error - ${error.message}.`
      });
      throw error;
    }
  },

  getBulkNotification: async() => {
    try {
      const result = await notificationDOA.getBulkNotifications();
      return result;
    } catch (error) {
      console.error("Error in getBulkNotification Service:", error.message);
      await addServerLog({
        log_level: "ERROR",
        service_name: "getBulkNotification",
        error_message: `getBulkNotification Service error - ${error.message}.`
      });
      throw error;
    }
  }
};
