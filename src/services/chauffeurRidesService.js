// services/chauffeurRidesService.js
//const ridesDAO = require("../dao/ridesDAO");
const chauffeurDAO = require("../dao/chauffeurRidesDAO");
const currentLocationsDAO = require("../dao/currentLocationsDAO");
const {
  chauffeurRideRequestDbSchema,
  chauffeurRideRequestBodySchema,
  chauffeurDropRequestBodySchema,
  chauffeurDropRequestDbSchema,
} = require("../validators/chauffeurRidesValidator");
const { queuePushNotification } = require("../adaptors/notificationService");
const {
  buildPickUpNotificationData,
} = require("./chauffeurNotificationDataBuilder");
const userDAO = require("../dao/userDAO");
const { addServerLog } = require("../services/serverLogsService");
const reviewDAO = require("../dao/reviewDAO");
const adminPanelDAO = require("../dao/adminPanelDAO");
const { buildChauffeurRideCreationNotificationData } = require("./adminPanelNotificationDataBuilder");
const notificationService = require("../adaptors/notificationService");
require('dotenv').config();

// Assume addServerLog is globally available or imported
// async function addServerLog({ log_level, service_name, error_message }) { ... }

/**
 * Handles ride requests made by chauffeurs.
 * @param {string} userId The name of the
 * @param {object} rideData - Data from the chauffeur ride request.
 * @param {string} orgId - Organization ID.
 * @returns {string} - The ride_id of the newly created chauffeur ride.
 */
const requestRide = async (rideData, userId, orgId) => {
  try {
    // Check for existing pending rides
    const existingPendingRide = await chauffeurDAO.checkPendingRideForChauffeur(
      userId
    );
    console.log("existing pending ride", existingPendingRide);
    if (existingPendingRide.length !== 0) {
      const error = new Error(`User already has a pending ride with ride ID: ${existingPendingRide[0].ride_id}.`);
      error.statusCode = 400;
      throw error;
    }

    const changedRideData = {
      user_id: userId,
      ...rideData,
    };

    // Validate request body (Frontend Input)
    const validatedRideData =
      await chauffeurRideRequestBodySchema.validateAsync(changedRideData, {
        abortEarly: false,
      });

    console.log("validated data", validatedRideData);

    const user = await userDAO.findById(userId);

    const data = {
      chauffeur_id: validatedRideData.user_id.toString(),
      chauffeur_name: `${user.first_name} ${user.last_name}`,
      lower_chauffeur_name: `${user.first_name} ${user.last_name}`.toLowerCase(),
      requested_pickup_point: validatedRideData.requested_pickup_point,
      requested_pickup: validatedRideData.requested_pickup,
      //estimated_time_in_minutes: validatedRideData.estimated_time_in_minutes,
      status: "Requested",
      status_log: [{ status: "Requested", datetime: new Date().toISOString() }],
      organisation_id: orgId,
      order_date: new Date().toISOString(),
      pd_id: 0,
      pd_name: "",
      lower_pd_name: "",
      //user_type: "Chauffeur"
    };

    console.log("validated data", data);

    try {
      // Validate data before inserting into DB
      const dbRideData = await chauffeurRideRequestDbSchema.validateAsync(
        data,
        {
          abortEarly: false,
        }
      );

      console.log("validated data inside try", dbRideData);

      // Assign to CHAUFFEUR entity type and add ride
      const rideId = await chauffeurDAO.addRide(dbRideData); // change the function

      console.log("rideid", rideId);
      // === Notification Logic: Notify Admins Only ===
      // Fetch the list of admin users for ziezzu.
      const adminUsers = await adminPanelDAO.getZiezzuAdmins();

      // For each admin with a valid device ID, queue a push notification.
      await Promise.all(
        adminUsers.map(async (admin) => {
          if (admin.device_id) {
            const notificationData =
              buildChauffeurRideCreationNotificationData(rideId, admin);
            await notificationService.queuePushNotification(
              admin.device_id,
              notificationData
            );
          }
        })
      );

      return rideId; // This is the auto-incremented ride_id with prefix
    } catch (dbValidationError) {
      await addServerLog({
        log_level: "ERROR",
        service_name: "requestRide_dbValidation",
        error_message: `requestRide database validation error - ${dbValidationError.message}.`
      });
      console.error("Database Validation Failed: ", dbValidationError.details);
      const dbValidationErrorMsg = new Error("Database Validation Error");
      dbValidationErrorMsg.statusCode = 500;
      dbValidationErrorMsg.details = dbValidationError.details.map(
        (err) => err.message
      );
      throw dbValidationErrorMsg;
    }
  } catch (error) {
    if (error.isJoi) {
      await addServerLog({
        log_level: "ERROR",
        service_name: "requestRide_validation",
        error_message: `requestRide validation error - ${error.message}.`
      });
      console.error("Request Validation Failed: ", error.details);
      const validationError = new Error("Validation Error");
      validationError.statusCode = 400;
      validationError.details = error.details.map((err) => err.message);
      throw validationError;
    }
    await addServerLog({
      log_level: "ERROR",
      service_name: "requestRide",
      error_message: `requestRide service error - ${error.message}.`
    });
    console.error("Request Ride Error: ", error.message);
    throw error;
  }
};

/**
 * Completes a chauffeur's ride.
 * @param {string} rideId - The ride_id of the ride.
 * @param {string} chauffeurId - The ID of the chauffeur completing the ride.
 * @param {string} endTime - Optional end time.
 */
const completeChauffeurRide = async (rideId, chauffeurId, endTime) => {
  const SK = `RIDE#${rideId}`;

  const chauffeurRide = await chauffeurDAO.getRide(`CHAUFFEUR#${chauffeurId}`, SK); // need to change this
  if (!chauffeurRide) {
    const error = new Error("Ride not found.");
    error.statusCode = 404;
    throw error;
  }

  chauffeurRide.status = "Completed";
  chauffeurRide.end_time = endTime || new Date().toISOString();
  chauffeurRide.status_log.push({
    status: "Completed",
    datetime: chauffeurRide.end_time,
  });

  await chauffeurDAO.updateRide(chauffeurRide);

  if (chauffeurRide.customer_id) {
    const customerRide = await chauffeurDAO.getRide(
      `CUSTOMER#${chauffeurRide.customer_id}`,
      `RIDE#${chauffeurRide.ride_id}`
    );
    if (customerRide) {
      customerRide.status = "Completed";
      customerRide.end_time = chauffeurRide.end_time;
      customerRide.status_log.push({
        status: "Completed",
        datetime: chauffeurRide.end_time,
      });
      await chauffeurDAO.updateRide(customerRide); // look this function
    }
  }
  await chauffeurDAO.updateRide(PK, SK, chauffeurRide);

  return { message: "Ride completed successfully." };
};

/**
 * Handles adding a drop request to an existing ride.
 * @param {object} dropData - Data for the drop request.
 * @param {string} chauffeurId - The chauffeur's ID.
 * @returns {string} - A success message or throws an error.
 */
const addDropRequest = async (dropData, chauffeurId) => {
  try {
    // Validate the rideId and ensure the ride exists
    const existingRide = await chauffeurDAO.getActiveRideByChauffeurId(chauffeurId);
    if (!existingRide) {
      const notFoundError = new Error("Ride not found");
      notFoundError.statusCode = 404;
      throw notFoundError;
    }

    // Check if the ride status allows adding a drop request
    if (existingRide.status !== "Started") { // also check the status picked
      const invalidStatusError = new Error(
        "Cannot add drop request. Ride status must be 'Started'."
      );
      invalidStatusError.statusCode = 400;
      throw invalidStatusError;
    }

    // Ensure the ride has a valid pickup point with lat and long
    const { requested_pickup_point, requested_pickup, ride_id } = existingRide;
    if (!requested_pickup_point || !requested_pickup) {
      const invalidPickupError = new Error(
        "Invalid pickup point. Cannot add drop request."
      );
      invalidPickupError.statusCode = 400;
      throw invalidPickupError;
    }

    // Validate the drop request body (Frontend Input)
    const validatedDropData =
      await chauffeurDropRequestBodySchema.validateAsync(
        dropData,
        {
          abortEarly: false,
        }
      );

    const updatedStatusLog = [
      ...existingRide.status_log, // Keep existing logs
      {
        status: "Drop Requested",
        datetime: new Date().toISOString(),
      },
    ];

    // Add drop data to the ride
    const updatedRide = {
      ...existingRide,
      requested_drop_point: validatedDropData.requested_drop_point,
      requested_drop: validatedDropData.requested_drop,
      status: "Droprequest", // check the status
      status_log: updatedStatusLog
    };

    // Validate the updated ride data before updating the database
    const dbUpdatedRideData = await chauffeurDropRequestDbSchema.validateAsync(
      updatedRide,
      { abortEarly: false }
    );

    // Update the ride in the database
    const updatedResult = await chauffeurDAO.updateRideByPkSk(
      chauffeurId,
      ride_id,
      dbUpdatedRideData
    );

    return updatedResult;
  } catch (error) {
    if (error.isJoi) {
      await addServerLog({
        log_level: "ERROR",
        service_name: "addDropRequest_validation",
        error_message: `addDropRequest validation error - ${error.message}.`
      });
      console.error("Drop Request Validation Failed: ", error.details);
      const validationError = new Error("Validation Error");
      validationError.statusCode = 400;
      validationError.details = error.details.map((err) => err.message);
      throw validationError;
    }
    await addServerLog({
      log_level: "ERROR",
      service_name: "addDropRequest",
      error_message: `addDropRequest service error - ${error.message}.`
    });
    console.error("Add Drop Request Error: ", error.message);
    throw error;
  }
};

const findNearbyPd = async (rideData) => {
  try {
    const { chauffeur_id } = rideData;
    // Fetch the user's location based on user_id
    const userLocation = await chauffeurDAO.getUserLocation(chauffeur_id);
    if (!userLocation) {
      throw new Error("User location not found");
    }

    const { lat, long } = userLocation;

    // Pass the latitude and longitude to the nearbyUsers function
    const nearbyPDs = await currentLocationsDAO.findNearbyUsers(
      lat,
      long,
      process.env.NOTIFICATION_RADIUS, // make this dynamic
      "pd"
    );
    console.log(" near by pds", nearbyPDs);

    return nearbyPDs;
  } catch (error) {
    await addServerLog({
      log_level: "ERROR",
      service_name: "findNearbyPd",
      error_message: `findNearbyPd service error - ${error.message}.`
    });
    console.error("Find Nearby PD Error: ", error.message);
    throw error;
  }
};

const notifyNearbyPd = async (rideData, chauffeurId) => {
  try {
    let userIds = [];
    let deviceIds = [];

    // Find nearby PDs
    const nearbyPDs = await findNearbyPd(rideData);

    if (nearbyPDs && nearbyPDs.length > 0) {
      userIds = nearbyPDs.map((pd) => pd.user_id);
    } else {
      console.warn("No nearby PDs found. Fetching all PDs.");

      // Fetch all PDs
      const allPDs = await chauffeurDAO.fetchAllIdsofPD();

      // Filter out already notified PDs
      const filteredPDs = allPDs.filter(pd => !userIds.includes(pd.user_id));

      deviceIds = filteredPDs.map(pd => pd.device_id);
      userIds = filteredPDs.map(pd => pd.user_id);
    }

    // Notify PDs
    const notifications = [];

    for (const userId of userIds) {
      try {
        // Fetch device ID of the user
        const deviceId = await userDAO.findPdDeviceIdByUserId(userId);
        
        if (deviceId) {
            // Build notification data
            const notificationData = await buildPickUpNotificationData(rideData, userId, chauffeurId);
            
            // Push notification to the queue
            notifications.push(queuePushNotification(deviceId, notificationData));
        } else {
            console.warn(`User ${userId} has no registered device.`);
        }
    } catch (error) {
        console.error(`Skipping user ${userId} due to error: ${error.message}`);
        // Continue processing the next user
    }
}
 
    await Promise.all(notifications);

    return `Notification sent successfully to ${userIds.length} PDs.`;
  } catch (error) {
    await addServerLog({
      log_level: "ERROR",
      service_name: "notifyNearbyPd",
      error_message: `notifyNearbyPd service error - ${error.message}.`
    });
    console.error("Notify Nearby PD Error: ", error.message);
    throw error;
  }
};

/**
 * Checks if the user already has a ride that is not cancelled or completed.
 * @param {string} userId - User ID.
 * @returns {object|null} - Ride details or null if no valid ride exists.
 */
const checkPendingRide = async (userId) => {
  const params = {
    TableName: "Rides", // Replace with your DynamoDB table name
    IndexName: "chauffeur_id-index", // Replace with your GSI name
    KeyConditionExpression: "chauffeur_id = :userId",
    FilterExpression:
      "status <> :cancelledStatus AND status <> :completedStatus",
    ExpressionAttributeValues: {
      ":userId": userId,
      ":cancelledStatus": "Cancelled",
      ":completedStatus": "Completed",
    },
  };

  try {
    const result = await dynamoDb.query(params).promise();
    return result.Items.length > 0 ? result.Items[0] : null;
  } catch (error) {
    await addServerLog({
      log_level: "ERROR",
      service_name: "checkPendingRide",
      error_message: `checkPendingRide service error - ${error.message}.`
    });
    console.error("Error checking for rides: ", error);
    throw new Error("Error checking ride status.");
  }
};

const getTopChauffeursByRides = async () => {
  try {
    // Step 1: Fetch completed rides
    const rides = await chauffeurDAO.getCompletedRidesForMonth();

    if (!rides || rides.length === 0) {
      return [];
    }

    // Step 2: Group rides by chauffeur_id and count them
    const chauffeurCounts = rides.reduce((acc, ride) => {
      const chauffeurId = ride.chauffeur_id;
      if (!chauffeurId) return acc;

      if (!acc[chauffeurId]) {
        acc[chauffeurId] = {
          chauffeur_id: chauffeurId,
          ride_count: 0,
        };
      }

      acc[chauffeurId].ride_count += 1;

      return acc;
    }, {});

    // Step 3: Convert object to array and sort by ride_count
    const sortedChauffeurs = Object.values(chauffeurCounts)
      .sort((a, b) => b.ride_count - a.ride_count)
      .slice(0, 10);

    const topChauffeurIds = sortedChauffeurs.map(item => item.chauffeur_id);

    // Step 4: Fetch chauffeur names from userDAO
    const chauffeursData = await userDAO.getChauffeurNameOfTopTen(topChauffeurIds);

    // Step 5: Create a map of chauffeur_id => full name
    const chauffeurNameMap = chauffeursData.reduce((map, user) => {
      map[user.id] = `${user.first_name} ${user.last_name}`.trim();
      return map;
    }, {});

    // Step 6: Merge chauffeur names with their ride counts
    const finalResult = sortedChauffeurs.map(item => ({
      chauffeur_id: item.chauffeur_id,
      chauffeur_name: chauffeurNameMap[item.chauffeur_id] || 'Unknown',
      ride_count: item.ride_count,
    }));

    console.log('finalResult:', finalResult);
    return finalResult;

  } catch (error) {
    await addServerLog({
      log_level: "ERROR",
      service_name: "getTopChauffeursByRides",
      error_message: `getTopChauffeursByRides service error - ${error.message}.`
    });
    console.error("Error in service:", error);
    throw new Error("Service error: Unable to fetch top chauffeurs.");
  }
};

const listChauffeurReviews = async (chauffeurId,page,limit) => {

  const offset = (page - 1) * limit;

  const allReviews = await reviewDAO.getReviewsByChauffeurId(chauffeurId);

  const paginated = allReviews.slice(offset, offset + limit);

  const reviews = paginated.map((item) => ({
    review_id: item.review_id,
    ride_id: item.ride_id,
    reviewer_id: item.reviewer_id,
    comment: item.comment,
    rating: item.rating ? Number(item.rating) : null,
    timestamp: item.timestamp,
  }));

  return {
    data: reviews,
    page,
    limit,
    total: allReviews.length,
    totalPages: Math.ceil(allReviews.length / limit),
  };
};





module.exports = {
  requestRide,
  completeChauffeurRide,
  addDropRequest,
  findNearbyPd,
  notifyNearbyPd,
  getTopChauffeursByRides,
  listChauffeurReviews
};
