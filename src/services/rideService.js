const { error } = require("winston");
const rideDAO = require("../dao/rideDAO");
const ridesDAO = require("../dao/ridesDAO");
const vehicleDAO = require("../dao/vehicleDAO");
const auditDAO = require("../dao/auditDAO");
const reviewDAO = require("../dao/reviewDAO");
const pdRidesService = require("./pdRidesService");
const User = require("../dao/userDAO");
const ridesAdminpanelDAO = require("../dao/ridesAdminpanelDOA");
const chauffeurRidesDAO = require("../dao/chauffeurRidesDAO");
const { date, number } = require("joi");
const chauffeurNotification = require("../services/chauffeurNotificationDataBuilder");
const notificationService = require("../adaptors/notificationService");
const {
  buildPDRideDeclinedNotificationData,
} = require("./adminPanelNotificationDataBuilder");
const { updatePDNotificationStatus } = require("../dao/notificationDOA");
const adminPanelDOA = require("../dao/adminPanelDAO");
const currentLocationService = require("../services/locationServices");
const { Payments, PaymentType, CustomerWalletLog } = require("../dto");
const paymentsDAO = require("../dao/paymentsDAO");
const couponDAO = require("../dao/couponDAO");
const userDAO = require("../dao/userDAO");
const { filterLocations } = require("../helpers/locationHelper");
const { getDriverLocations } = require("../dao/locationHistoryDAO");
const { addServerLog } = require("../services/serverLogsService");
const { getChauffeurRideDuration } = require("../dao/chauffeurRidesDAO");
const organizationDAO = require("../dao/organizationDAO");
const rideTypeDAO = require("../dao/rideDAO");
const rideValidator = require('../validators/rideValidator');
const { rideRequestBodySchema } = require("../validators/rideRequestValidator");


module.exports = {
  getRideBookOptions: async () => {
    // Fetch only Half Day and Full Day for dropdown
    const rateTypes = await rideDAO.findByTypeNames(["half_day", "full_day"]);

    // Map rate types to the required response format
    return rateTypes.map((rateType) => {
      let displayName = rateType.display_name;
      let duration = rateType.duration_hours;

      if (rateType.type_name === "half_day") {
        displayName = "Half Day";
        duration = 4;
      } else if (rateType.type_name === "full_day") {
        displayName = "Full Day";
        duration = 8;
      }

      return {
        type_category: rateType.type_category,
        type_name: rateType.type_name,
        display_name: `${displayName} ${duration}`,
      };
    });
  },

  processRideRequest: async (
    action,
    driverId,
    rideId,
    chauffeurId,
    current_lat,
    current_long
  ) => {
    try {
      if (!["accept", "decline"].includes(action)) {
        throw {
          statusCode: 400,
          message: 'Invalid action. Use "accept" or "decline".',
        };
      }

      const chauffeursPicked = await pdRidesService.chauffeursPicked(driverId);
      const chauffeursDropped = await pdRidesService.chauffeursDropped(
        driverId
      );

      const picked = chauffeursPicked.pickedCount || 0;
      const dropped = chauffeursDropped.droppedCount || 0;
      const limit = picked - dropped;

      if (limit >= 4) {
        throw {
          statusCode: 400,
          message: "Maximum limit reached, cannot accept any more pickups.",
        };
      }

      const rideRequest = await chauffeurRidesDAO.getRide(
        `CHAUFFEUR#${chauffeurId}`,
        `RIDE#${rideId}`
      );

      if (!rideRequest) {
        throw { statusCode: 404, message: "Ride request not found." };
      }

      if (rideRequest.status !== "Requested") {
        throw {
          statusCode: 400,
          message: "Ride request is no longer pending.",
        };
      }

      const updatedStatus = action === "accept" ? "Accepted" : "driverIgnored";
      const userName = await User.findById(driverId);

      const location = { current_lat, current_long };
      await currentLocationService.createOrUpdateCurrentLocation(
        location,
        driverId,
        "pd"
      );

      if (action === "accept") {
        if (!driverId) {
          throw {
            statusCode: 400,
            message: "Driver ID is required to accept a ride.",
          };
        }
        const name = `${userName.first_name} ${userName.last_name}`;
        const updateData = {
          pd_name: `${userName?.first_name || ""} ${userName?.last_name || ""
            }`.trim(),
          status: updatedStatus,
          updatedAt: new Date().toISOString(),
          pd_id: driverId,
          lower_pd_name: name.toLowerCase(),
          status_log: [
            ...(rideRequest.status_log || []),
            {
              action:
                action === "accept"
                  ? "PD Accepted ride request"
                  : "PD Declined ride request",
              status: action === "accept" ? "PD Accepted" : "PD Declined",
              datetime: new Date().toISOString(),
            },
          ],
        };

        const rideKey = {
          PK: `CHAUFFEUR#${chauffeurId}`,
          SK: `RIDE#${rideId}`,
        };

        try {
          const result = await chauffeurRidesDAO.updateRideTable(
            rideKey,
            updateData
          );
          console.log(`RideTable updated for ride ID: ${rideId}`);

          const chauffeur = await User.findDeviceIdByUserId(
            rideRequest.chauffeur_id
          );

          if (!chauffeur) {
            console.error("Chauffeur not found");
            throw { statusCode: 404, message: "Chauffeur not found" };
          }
          const chauffeurDetails = await userDAO.findMobileNumberByUserId(
            rideRequest.chauffeur_id
          );

          const chauffeurRide =
            await chauffeurNotification.buildAcceptNotification(rideRequest);
          await notificationService.queuePushNotification(
            chauffeur,
            chauffeurRide
          );

          return {
            action: "accept",
            rideId: result.ride_id,
            chauffeur_id: result.chauffeur_id,
            chauffeur_name: result.chauffeur_name,
            country_code: chauffeurDetails.country_code,
            mobile_number: chauffeurDetails.mobile_number,
            requested_pickup_point: result.requested_pickup_point,
            requested_pickup: result.requested_pickup,
          };
        } catch (error) {
          console.error("Error updating RideTable:", error);
          await addServerLog({
            log_level: "ERROR",
            service_name: "processRideRequest",
            error_message: `processRideRequest service error (updateRideTable) - ${error.message}.`,
          });
          throw {
            statusCode: 500,
            message: `Failed to update the ride. ${error.message}`,
          };
        }
      } else {
        // Handle decline
        if (rideRequest.pd_id === driverId) {
          const error = new Error(
            "You have already accepted this ride and cannot decline it."
          );
          error.statusCode = 400;
          throw error;
        } else {
          await updatePDNotificationStatus(driverId, rideId, "Declined");

          // Notify admin(s) about the ride decline
          try {
            const adminUsers = await adminPanelDOA.fetchDeviceIds();
            if (adminUsers && adminUsers.length > 0) {
              await Promise.all(
                adminUsers.map(async ({ user_id, device_id }) => {
                  try {
                    const notificationData =
                      await buildPDRideDeclinedNotificationData(
                        rideRequest,
                        user_id,
                        driverId
                      );
                    await notificationService.queuePushNotification(
                      device_id,
                      notificationData
                    );
                    console.log(`Notification sent to Admin ID: ${user_id}`);
                  } catch (notificationError) {
                    console.error(
                      `Failed to send notification to Admin ID ${user_id}: ${notificationError.message}`
                    );
                  }
                })
              );
            } else {
              console.warn(
                "No active admin users found with valid device IDs."
              );
            }
          } catch (err) {
            console.error(
              "Error fetching admin device IDs or sending notifications: ",
              err.message
            );
          }

          return {
            action: "decline",
            rideId: rideRequest.ride_id,
            chauffeur_id: rideRequest.chauffeur_id,
            chauffeur_name: rideRequest.chauffeur_name,
            requested_pickup_point: rideRequest.requested_pickup_point,
            requested_pickup: rideRequest.requested_pickup,
          };
        }
      }
    } catch (error) {
      console.error("Error in processRideRequest:", error);
      await addServerLog({
        log_level: "ERROR",
        service_name: "processRideRequest",
        error_message: `processRideRequest service error - ${error.message}.`,
      });
      throw error;
    }
  },

  getChauffersWithPD: async (pd_id, action) => {
    try {
      const rides = await chauffeurRidesDAO.fetchRidesWithStatusByPD(
        pd_id,
        action
      );

      if (!rides || rides.length === 0) {
        return [];
      }
      console.log(rides);
      return rides.map((ride) => ({
        chauffeur_id: ride.chauffeur_id,
        chauffeur_name: ride.chauffeur_name,
        pickup_point: ride.requested_pickup_point,
        order_date: ride.order_date,
      }));
    } catch (error) {
      console.error("Error getting chauffeurs:", error);
      await addServerLog({
        log_level: "ERROR",
        service_name: "getChauffersWithPD",
        error_message: `getChauffersWithPD service error - ${error.message}.`,
      });
      throw {
        statusCode: 500,
        message: `Failed to fetch chauffeurs. ${error.message}`,
      };
    }
  },

  // Updated getRideById DAO function name(params) {
    getRideById: async (ride_id, req) => {
      try {
        if (!ride_id) {
          throw new Error("ride_id is required");
        }
  
        // Fetch ride details (assumed to return an array of ride objects)
        const rides = await ridesAdminpanelDAO.getRideDetails(ride_id);
  
        // Fetch audit details for the given ride_id using your auditDAO
        const auditDetails = await auditDAO.getAuditByRideId(ride_id);
  
        // Fetch all chauffeurs and create a mapping for chauffeur names
        const chauffeurs = await User.findAllByRole("chauffeur");
        const chauffeurMap = {};
        chauffeurs.forEach((chauffeur) => {
          chauffeurMap[chauffeur.id] = {
            name: `${chauffeur.first_name} ${chauffeur.last_name}`,
            mobile_number: `${chauffeur.country_code} ${chauffeur.mobile_number}`,
          };
        });
  
        // Process each ride to include chauffeur name, driver locations, and audit details inside vehicle_audit
        const ridesWithDetails = await Promise.all(
          rides.map(async (ride) => {
            // Attach chauffeur name
            ride.chauffeur_name =
              chauffeurMap[ride.chauffeur_id] || "Unknown Chauffeur";
  
            // Initialize driver_locations as an object to hold specific status transitions
            ride.driver_locations = {};
  
            // Attach audit details inside vehicle_audit attribute
            const auditRecord = auditDetails.find(
              (audit) => audit.ride_id === ride.ride_id
            );
            if (auditRecord) {
              // Remove sensitive URLs
              const {
                signatureImageUrl,
                vehicleMarkingImageUrl,
                ...sanitizedAudit
              } = auditRecord;
              ride.vehicle_audit = sanitizedAudit;
            } else {
              ride.vehicle_audit = null;
            }
  
            // Calculate ride duration from status log if present
            ride.ride_duration = ride.status_log
              ? await getChauffeurRideDuration(ride.status_log)
              : "";
  
            ride.organisation_name = await organizationDAO.fetchOrganizationName(
              parseInt(ride.organisation_id)
            );
  
            ride.selected_coupon = null;
  
            if (Array.isArray(ride.coupon_ids) && ride.coupon_ids.length > 0) {
              const firstCouponId = ride.coupon_ids[0];
  
              const coupon = await couponDAO.getCouponById(firstCouponId);
              if (coupon) {
                ride.selected_coupon = {
                  coupon_id: coupon.coupon_id,
                  coupon_code: coupon.coupon_code,
                };
              }
            }
            // Define the required status transitions
            const statusTransitions = [
              {
                key: "acceptedToReachedCustomer",
                startStatus: "Accepted",
                endStatus: "Reached Customer",
              },
              {
                key: "ReachedCustomerToStarted",
                startStatus: "Reached Customer",
                endStatus: "Started",
              },
              {
                key: "StartedToPaymentInitiated",
                startStatus: "Started",
                endStatus: "Payment Initiated",
              },
            ];
  
            // Process driver locations for each status transition if a status_log exists
            if (ride.status_log && Array.isArray(ride.status_log)) {
              for (let transition of statusTransitions) {
                const startEntry = ride.status_log.find(
                  (entry) => entry.status === transition.startStatus
                );
                if (startEntry) {
                  const startTime = startEntry.datetime;
                  const endEntry = ride.status_log.find(
                    (entry) => entry.status === transition.endStatus
                  );
                  const endTime = endEntry
                    ? endEntry.datetime
                    : new Date().toISOString();
  
                  console.log(
                    `Fetching driver locations for ${transition.key} between ${startTime} and ${endTime}`
                  );
                  let driverLocations = await getDriverLocations(
                    String(ride.chauffeur_id),
                    startTime,
                    endTime
                  );
                  // Filter locations to only include points at least 200 meters apart
                  driverLocations = filterLocations(driverLocations, 30);
                  console.log(
                    `For ${transition.key}, ${driverLocations.length} locations after filtering`
                  );
                  ride.driver_locations[transition.key] = driverLocations;
                } else {
                  // If the start entry is missing, you may decide to assign an empty array or leave it undefined
                  ride.driver_locations[transition.key] = [];
                }
              }
            }
  
            // Retrieve and attach current location for the driver
            try {
              if(ride.chauffeur_id && ride.chauffeur_id !== 0) {
              const chauffeurCurrentLocation =
                await currentLocationService.getCurrentLocation({
                  user_id: ride.chauffeur_id,
                  user_type: "chauffeur",
                });
              ride.driverCurrentLocation = chauffeurCurrentLocation
                ? chauffeurCurrentLocation.location.coordinates
                : null;
              }
            } catch (locationError) {
              console.error(
                `Error fetching current location for chauffeur ${ride.chauffeur_id}: ${locationError.message}`
              );
              ride.driverCurrentLocation = null;
            }
  
            ride.reviews = null;
            if (ride_id && ride.customer_id) {
              const reviews = await reviewDAO.findReview(
                ride_id,
                ride.customer_id
              );
              ride.reviews = reviews;
            }
  
            let vehicle = null;
            // Fetch vehicle details
            if (ride.vehicle_id) {
              vehicle = await vehicleDAO.getById(ride.vehicle_id);
            }
            ride.vehicle_details = vehicle;
  
            return ride;
          })
        );
  
        return ridesWithDetails;
      } catch (error) {
        throw error;
      }
    },

  /**
   * Service to get ride history (completed rides) for a customer.
   * @param {string} customerId - The customer's ID.
   * @returns {Array} - List of completed rides.
   */
  getRideHistory: async (customerId, page, limit) => {
    try {
      if (!customerId) {
        throw new Error("Customer ID is required");
      }

      const pageNumber = Math.max(1, parseInt(page, 10) || 1);
      const pageSize = Math.max(1, parseInt(limit, 10) || 10);

      const rides = await ridesDAO.getCustomerRides(customerId);

      if (rides.length === 0) {
        return { rides: [], totalPages: 0, currentPage: pageNumber };
      }

      rides.forEach((ride) => {
        ride.organisation_id = parseInt(ride.organisation_id);
      });

      const rideIds = rides.map((ride) => ride.ride_id).filter((id) => id);
      const payments = await Payments.findAll({
        where: { ride_id: rideIds },
        include: [{ model: PaymentType, attributes: ["name"] }],
      });

      const paymentMap = payments.reduce((map, payment) => {
        if (payment.PaymentType?.name === "Card") {
          map[payment.ride_id] = payment.transaction_ref;
        }
        return map;
      }, {});

      // Fetch adjusted_ride_amount from CustomerWalletLogs
      const walletLogs = await CustomerWalletLog.findAll({
        where: { ride_id: rideIds },
        attributes: ["ride_id", "adjusted_ride_amount"],
      });

      // Create a map of ride_id -> adjusted_ride_amount
      const walletMap = walletLogs.reduce((map, log) => {
        map[log.ride_id] = log.adjusted_ride_amount;
        return map;
      }, {});

      const chauffeurIds = [
        ...new Set(rides.map((ride) => ride.chauffeur_id).filter((id) => id)),
      ];
      const chauffeurs = await Promise.all(
        chauffeurIds.map((id) => User.findById(id))
      );
      const chauffeurMap = chauffeurs.reduce((map, chauffeur) => {
        if (chauffeur) {
          map[chauffeur.id] = chauffeur.first_name;
        }
        return map;
      }, {});

      // Attach chauffeur name and determine correct estimated amount
      const updatedRides = await Promise.all(
        rides.map(async (ride) => {
          let finalAmount = ride.estimated_amount;
          let isCouponApplied = false;

          const payment = await Payments.findOne({
            where: { ride_id: ride.ride_id },
            include: [{ model: PaymentType, attributes: ["name"] }],
          });

          if (payment?.coupon_id && payment.coupon_id.length > 0) {
            isCouponApplied = true;
          }

          const rideDuration = await ridesDAO.getCustomerRideCalculation(
            ride.status_log
          );

          return {
            ...ride,
            chauffeur_name: chauffeurMap[ride.chauffeur_id] || "Unknown",
            transaction_id: paymentMap[ride.ride_id] || null,
            estimated_amount: finalAmount,
            is_coupon_applied: isCouponApplied,
            negative_balance: walletMap[ride.ride_id] || null,
            ride_duration: rideDuration,
          };
        })
      );

      const totalItems = updatedRides.length;
      const totalPages = Math.ceil(totalItems / pageSize);
      const paginatedRides = updatedRides.slice(
        (pageNumber - 1) * pageSize,
        pageNumber * pageSize
      );

      return {
        rides: paginatedRides,
        totalPages,
        currentPage: pageNumber,
      };
    } catch (error) {
      console.error("Error in ride history service:", error);
      await addServerLog({
        log_level: "ERROR",
        service_name: "getRideHistory",
        error_message: `getRideHistory service error - ${error.message}.`,
      });
      throw new Error("Error fetching ride history");
    }
  },

  getChauffeurRideById: async (ride_id) => {
    try {
      if (!ride_id) {
        throw new Error("ride_id is required");
      }

      const rides = await chauffeurRidesDAO.getRideDetails(ride_id);
      if (!rides || rides.length === 0) {
        throw new Error("No rides found for the given ride_id");
      }

      const chauffeurs = await User.findAllByRole("chauffeur");
      const chauffeurMap = chauffeurs.reduce((acc, chauffeur) => {
        acc[
          chauffeur.id
        ] = `${chauffeur.country_code} ${chauffeur.mobile_number}`;
        return acc;
      }, {});

      const pds = await User.findAllByRole("pd");
      const pdMap = pds.reduce((acc, pd) => {
        acc[pd.id] = `${pd.country_code} ${pd.mobile_number}`;
        return acc;
      }, {});

      const ridesWithDetails = rides.map((ride) => ({
        ...ride,
        chauffeur_number:
          chauffeurMap[ride.chauffeur_id] || "Unknown Chauffeur",
        pd_number: pdMap[ride.pd_id] || "Unknown PD",
      }));

      return ridesWithDetails;
    } catch (error) {
      console.error("Error fetching ride details:", error.message);
      await addServerLog({
        log_level: "ERROR",
        service_name: "getChauffeurRideById",
        error_message: `getChauffeurRideById service error - ${error.message}.`,
      });
      throw new Error(`Failed to get ride details: ${error.message}`);
    }
  },

  /**
 * Updates ride status to "On-The-Way" after "Accepted".
 * @param {string} ride_id - The unique ride identifier.
 * @param {string} chauffeur_id - Chauffeur ID from the token.
 * @returns {object} - The updated ride.
 */
  updateRideStatus: async (ride_id, chauffeur_id) => {
    // Fetch ride details
    const ride = await ridesDAO.getRideById(ride_id);
    if (!ride) {
      throw new Error("Ride not found");
    }

    // Check if the chauffeur is authorized to update the ride
    if (ride.chauffeur_id !== parseInt(chauffeur_id)) {
      throw new Error("Unauthorized to update this ride");
    }

    // Ensure current status is "Accepted"
    if (ride.status !== "Accepted") {
      throw new Error("Ride must be in 'Accepted' status to update to 'On-The-Way'");
    }

    // // Verify "Accepted" status exists
    // const statusLog = ride.status_log || [];
    // const acceptedIndex = statusLog.findIndex(
    //   (entry) => entry.status === "Accepted"
    // );

    // if (acceptedIndex === -1) {
    //   throw new Error("Ride has not been accepted yet");
    // }

    const statusLog = ride.status_log || [];

    // Check if "On-The-Way" already exists in the status log
    const alreadyOnTheWay = statusLog.some(entry => entry.status === "On-The-Way");

    if (alreadyOnTheWay) {
      throw new Error("Ride status is already updated to On-The-Way");
    }


    // // Append "On-The-Way" status
    // statusLog.splice(acceptedIndex + 1, 0, {
    //   datetime: new Date().toISOString(),
    //   status: "On-The-Way",
    // });

    // Add "On-The-Way" to status_log
    statusLog.push({
      datetime: new Date().toISOString(),
      status: "On-The-Way",
    });



    // Update status log in DB
    return await ridesDAO.updateStatusLog(ride.PK, ride.SK, "On-The-Way", statusLog);
  },
  getRideRateTypes: async () => {
    try {
      const rateTypes = await rideDAO.getRideRateTypes();
      console.log(rateTypes);
      return rateTypes;
    } catch (error) {
      console.error("Error in getRideRateTypes:", error);
      await addServerLog({
        log_level: "ERROR",
        service_name: "getRideRateTypes",
        error_message: `getRideRateTypes service error - ${error.message}.`,
      });
      throw error;
    }
  },
  createRideRateType: async (inputData) => {
    try {
      const validatedData = rideValidator.createRateTypeValidator(inputData);
      if (validatedData) {
        const {
          type_category,
          type_name,
          display_name, duration_hours } = inputData;

        let rideRateTypeInfo = {
          type_category,
          type_name,
          display_name, duration_hours
        };
        const rateTypes = await rideDAO.createRideRateType(rideRateTypeInfo);
        console.log(rateTypes);
        return rateTypes;
      }

    } catch (error) {
      console.error("Error in createRideRateType:", error);
      await addServerLog({
        log_level: "ERROR",
        service_name: "createRideRateType",
        error_message: `createRideRateType service error - ${error.message}.`,
      });
      throw error;
    }
  },
  updateRideRateType: async (inputData) => {
    try {
      const validatedData = rideValidator.createRateTypeValidator(inputData);
      if (validatedData) {
        const {
          type_category,
          type_name,
          display_name, duration_hours } = inputData;

        let rideRateTypeInfo = {
          type_category,
          type_name,
          display_name, duration_hours
        };
        const rateTypes = await rideDAO.updateRideRateType(rideRateTypeInfo);
        console.log(rateTypes);
        return rateTypes;
      }

    } catch (error) {
      console.error("Error in updateRideRateType:", error);
      await addServerLog({
        log_level: "ERROR",
        service_name: "updateRideRateType",
        error_message: `updateRideRateType service error - ${error.message}.`,
      });
      throw error;
    }
  }

};
