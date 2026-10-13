const { CurrentLocation, User } = require("../dto");
const ddbDocClient = require('./ddbClient');
const { getNextId } = require("./counterDAO");
const { addServerLog } = require("../services/serverLogsService");
const { GetCommand, PutCommand, QueryCommand, UpdateCommand, ScanCommand } = require("@aws-sdk/lib-dynamodb");

// addRide: Generates a sequential ride_id, assigns it to rideData, and inserts the ride into DynamoDB.
const addRide = async (rideData) => {
  // Generate a sequential ride_id
  const numericRideId = await getNextId("ChauffeurRides");
  const rideId = numericRideId.toString().padStart(7, "0"); // e.g., '0000123'

  // Assign ride_id to rideData
  rideData.ride_id = rideId;
  rideData.pd_id = 0;

  // PK and SK for ChauffeurRides
  const PK = `CHAUFFEUR#${rideData.chauffeur_id}`;
  const SK = `RIDE#${rideId}`;

  // Create the ride item
  const rideItem = {
    PK,
    SK,
    user_type: "Chauffeur",
    ...rideData,
  };

  console.log("Adding ride:", rideItem);

  // Insert the ride into DynamoDB
  const params = {
    TableName: "ChauffeurRides",
    Item: rideItem,
  };

  try {
    const command = new PutCommand(params);
    await ddbDocClient.send(command);
    return rideItem;
  } catch (error) {
    console.error("Error adding ride:", error);
    await addServerLog({
      log_level: "ERROR",
      service_name: "addRide",
      error_message: `addRide DAO error - ${error.message}.`
    });
    throw error;
  }
};

const getUserLocation = async (user_id) => {
  try {
    console.log("Getting user location", user_id);
    const user = await CurrentLocation.findOne({
      where: { user_id: user_id },
      attributes: ['current_lat', 'current_long'],
    });
    console.log(user);
    if (!user) {
      throw new Error("User location not found");
    }
    return { lat: user.current_lat, long: user.current_long };
  } catch (error) {
    console.error("Error fetching user location: ", error.message);
    await addServerLog({
      log_level: "ERROR",
      service_name: "getUserLocation",
      error_message: `getUserLocation DAO error - ${error.message}.`
    });
    throw error;
  }
};

const fetchDeviceIdsByUserIds = async (userIds) => {
  try {
    return await User.findAll({
      where: {
        id: userIds,
        role_id: 3,
        is_active: true,
        status_id: 1,
      },
      attributes: ['device_id'],
    }).then((results) => results.map((user) => user.device_id));
  } catch (error) {
    console.error("Error in fetchDeviceIdsByUserIds:", error.message);
    await addServerLog({
      log_level: "ERROR",
      service_name: "fetchDeviceIdsByUserIds",
      error_message: `fetchDeviceIdsByUserIds DAO error - ${error.message}.`
    });
    throw error;
  }
};

const fetchAllIdsofPD = async () => {
  try {
    return await User.findAll({
      where: { role_id: 3, is_active: true, status_id: 1 },
      attributes: ['device_id', 'id'],
    }).then((results) =>
      results.map((user) => ({
        device_id: user.device_id,
        user_id: user.id,
      }))
    );
  } catch (error) {
    console.error("Error in fetchAllIdsofPD:", error.message);
    await addServerLog({
      log_level: "ERROR",
      service_name: "fetchAllIdsofPD",
      error_message: `fetchAllIdsofPD DAO error - ${error.message}.`
    });
    throw error;
  }
};

/**
 * Fetches all rides for a chauffeur.
 * @param {string} user_id - Chauffeur's user ID.
 * @returns {array} - List of rides for the chauffeur.
 */
const fetchAllRidesForChauffeur = async (user_id) => {
  console.log('Fetching all', user_id);
  const params = {
    TableName: "Rides",
    KeyConditionExpression: "PK = :pkValue",
    FilterExpression: "chauffeur_id = :user_id",
    ExpressionAttributeValues: {
      ":pkValue": "CUSTOMER", // Static PK value for chauffeurs.
      ":user_id": user_id, // Chauffeur ID to filter rides.
    },
  };

  console.log(params);

  try {
    const command = new QueryCommand(params);
    const response = await ddbDocClient.send(command);
    console.log("Found rides: ", response.Items);
    return response.Items || [];
  } catch (error) {
    console.error("Error fetching all rides for chauffeur: ", error);
    await addServerLog({
      log_level: "ERROR",
      service_name: "fetchAllRidesForChauffeur",
      error_message: `fetchAllRidesForChauffeur DAO error - ${error.message}.`
    });
    throw new Error("Error fetching chauffeur rides.");
  }
};

const getRideHistoryByChauffeurId = async (user_id, page, limit) => {
  console.log("Fetching rides for chauffeur:", user_id, "Page:", page, "Limit:", limit);

  const params = {
    TableName: "Rides",
    IndexName: "chauffeur_id-index", // Using Global Secondary Index (GSI)
    KeyConditionExpression: "chauffeur_id = :user_id",
    FilterExpression: "#status IN (:completed, :cancelled, :payment_pending, :review_pending, :applepaystatus)",
    ExpressionAttributeNames: {
      "#status": "status", // Alias for reserved keyword
    },
    ExpressionAttributeValues: {
      ":user_id": user_id,
      ":completed": "Completed",
      ":cancelled": "Cancelled",
      ":payment_pending": "Payment-Pending",
      ":review_pending": "Review-Pending",
      ":applepaystatus": "Apple-Pay-Payment-Completed",
    },
    Limit: limit,
    ScanIndexForward: false, // Sorting in descending order (latest first)
  };

  let allRides = [];
  let lastEvaluatedKey = null;
  let totalItems = 0;

  try {
    do {
      if (lastEvaluatedKey) {
        params.ExclusiveStartKey = lastEvaluatedKey;
      }

      const response = await ddbDocClient.send(new QueryCommand(params));
      lastEvaluatedKey = response.LastEvaluatedKey;

      if (response.Items) {
        allRides = allRides.concat(response.Items);
        totalItems += response.Items.length;
      }
    } while (lastEvaluatedKey);

    // Sorting rides by `ride_id` (descending order, newest first)
    allRides.sort((a, b) => parseInt(b.ride_id, 10) - parseInt(a.ride_id, 10));

    // Pagination logic (manually slicing after full data fetch)
    const totalPages = Math.ceil(totalItems / limit);
    let paginatedRides = allRides.slice((page - 1) * limit, page * limit);

    // Convert organisation_id into int
    paginatedRides = paginatedRides.map(ride => {
      if (ride.organisation_id === "*" || ride.organisation_id === "1") {
        ride.organisation_id = 1;
      } else {
        ride.organisation_id = parseInt(ride.organisation_id) || 0;
      }
      return ride;
    });

    return {
      rides: paginatedRides,
      totalPages,
      currentPage: page,
    };

  } catch (error) {
    console.error("Error fetching ride history for chauffeur:", error);
    await addServerLog({
      log_level: "ERROR",
      service_name: "getRideHistoryByChauffeurId",
      error_message: `getRideHistoryByChauffeurId DAO error - ${error.message}.`
    });
    throw new Error("Database error: Unable to fetch ride history.");
  }
};

const fetchPickedUpChauffeurs = async (pd_id) => {
  try {
    const params = {
      TableName: 'PDPickupDrop',
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
      ExpressionAttributeValues: {
        ':pk': `PD#${pd_id}`,
        ':prefix': 'PICKUP#',
      },
    };

    const result = await ddbDocClient.send(new QueryCommand(params));
    return result.Items || [];
  } catch (error) {
    console.error("Error fetching picked chauffeurs:", error);
    await addServerLog({
      log_level: "ERROR",
      service_name: "fetchPickedUpChauffeurs",
      error_message: `fetchPickedUpChauffeurs DAO error - ${error.message}.`
    });
    throw error;
  }
};

const fetchDroppedChauffeurs = async (pd_id) => {
  try {
    const params = {
      TableName: 'PDPickupDrop',
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
      ExpressionAttributeValues: {
        ':pk': `PD#${pd_id}`,
        ':prefix': 'DROP#',
      },
    };
    const result = await ddbDocClient.send(new QueryCommand(params));
    return result.Items || [];
  } catch (error) {
    console.error("Error fetching dropped chauffeurs:", error);
    await addServerLog({
      log_level: "ERROR",
      service_name: "fetchDroppedChauffeurs",
      error_message: `fetchDroppedChauffeurs DAO error - ${error.message}.`
    });
    throw error;
  }
};

const fetchCompletedAndCancelledRides = async (pk) => {
  const queryParams = {
    TableName: "Rides",
    KeyConditionExpression: "PK = :pk",
    FilterExpression:
      "(#status = :completed OR #status = :cancelled) AND attribute_exists(#chauffeur_id) AND #chauffeur_id <> :nullValue",
    ProjectionExpression: "chauffeur_id",
    ExpressionAttributeNames: {
      "#status": "status",
      "#chauffeur_id": "chauffeur_id",
    },
    ExpressionAttributeValues: {
      ":pk": "CUSTOMER",
      ":completed": "Completed",
      ":cancelled": "Cancelled",
      ":nullValue": null,
    },
  };

  try {
    const data = await ddbDocClient
      .send(new QueryCommand(queryParams))
      .then((result) => result.Items.map((item) => item.chauffeur_id));
    return data;
  } catch (error) {
    console.error("Error fetching rides:", error);
    await addServerLog({
      log_level: "ERROR",
      service_name: "fetchCompletedAndCancelledRides",
      error_message: `fetchCompletedAndCancelledRides DAO error - ${error.message}.`
    });
    throw error;
  }
};

const fetchChauffeursInRidesTable = async () => {
  const queryParams = {
    TableName: "ChauffeurRides",
    KeyConditionExpression: "PK = :pk",
    FilterExpression: "attribute_exists(#chauffeur_id) AND #chauffeur_id <> :nullValue",
    ProjectionExpression: "chauffeur_id",
    ExpressionAttributeNames: {
      "#chauffeur_id": "chauffeur_id",
    },
    ExpressionAttributeValues: {
      ":pk": "CUSTOMER",
      ":nullValue": null,
    },
  };

  try {
    const result = await ddbDocClient.send(new QueryCommand(queryParams));
    const rideChauffeurIds = result.Items.map((item) => item.chauffeur_id);
    return rideChauffeurIds;
  } catch (error) {
    console.error("Error fetching chauffeurs in rides table:", error);
    await addServerLog({
      log_level: "ERROR",
      service_name: "fetchChauffeursInRidesTable",
      error_message: `fetchChauffeursInRidesTable DAO error - ${error.message}.`
    });
    throw error;
  }
};

const updateRideTable = async (key, updateData) => {
  const updateExpression = [];
  const expressionAttributeNames = {};
  const expressionAttributeValues = {};

  for (const [field, value] of Object.entries(updateData)) {
    updateExpression.push(`#${field} = :${field}`);
    expressionAttributeNames[`#${field}`] = field;
    expressionAttributeValues[`:${field}`] = value;
  }

  const params = {
    TableName: "ChauffeurRides",
    Key: key,
    UpdateExpression: `SET ${updateExpression.join(", ")}`,
    ExpressionAttributeNames: expressionAttributeNames,
    ExpressionAttributeValues: expressionAttributeValues,
    ReturnValues: "ALL_NEW",
  };

  try {
    const command = new UpdateCommand(params);
    const response = await ddbDocClient.send(command);
    console.log("RideTable update result:", response);
    return response.Attributes;
  } catch (error) {
    console.error("Error updating RideTable:", error);
    await addServerLog({
      log_level: "ERROR",
      service_name: "updateRideTable",
      error_message: `updateRideTable DAO error - ${error.message}.`
    });
    throw error;
  }
};

const getRide = async (PK, SK) => {
  const params = {
    TableName: "ChauffeurRides",
    Key: { PK, SK },
  };

  try {
    const command = new GetCommand(params);
    const response = await ddbDocClient.send(command);
    return response.Item || null;
  } catch (error) {
    console.error("Error fetching ride:", error);
    await addServerLog({
      log_level: "ERROR",
      service_name: "getRide",
      error_message: `getRide DAO error - ${error.message}.`
    });
    throw error;
  }
};

const getRideById = async (ride_id) => {
  const params = {
    TableName: "ChauffeurRides",
    IndexName: "ride_id_index",
    KeyConditionExpression: "ride_id = :ride_id",
    ExpressionAttributeValues: {
      ":ride_id": ride_id,
    },
    ProjectionExpression:
      "#status, requested_pickup_point, requested_pickup, PK, SK, status_log",
    ExpressionAttributeNames: {
      "#status": "status",
    },
  };

  try {
    const command = new QueryCommand(params);
    const response = await ddbDocClient.send(command);
    console.log("Response Items:", response.Items);
    return response.Items && response.Items.length > 0 ? response.Items[0] : null;
  } catch (error) {
    console.error("Error fetching ride by rideId:", { ride_id, error });
    await addServerLog({
      log_level: "ERROR",
      service_name: "getRideById",
      error_message: `getRideById DAO error - ${error.message}.`
    });
    throw error;
  }
};

const getActiveRideByChauffeurId = async (chauffeur_id) => {
  const params = {
    TableName: "ChauffeurRides",
    KeyConditionExpression: "PK = :pk",
    FilterExpression: "#status = :status",
    ExpressionAttributeValues: {
      ":pk": `CHAUFFEUR#${chauffeur_id}`,
      ":status": "Started",
    },
    ProjectionExpression:
      "#status, requested_pickup_point, requested_pickup, PK, SK, status_log, ride_id",
    ExpressionAttributeNames: {
      "#status": "status",
    },
  };

  try {
    console.log("params", params);
    const command = new QueryCommand(params);
    const response = await ddbDocClient.send(command);
    console.log("Response Items:", response.Items);
    return response.Items && response.Items.length > 0 ? response.Items[0] : null;
  } catch (error) {
    console.error("Error fetching active ride by chauffeurId:", { chauffeur_id, error });
    await addServerLog({
      log_level: "ERROR",
      service_name: "getActiveRideByChauffeurId",
      error_message: `getActiveRideByChauffeurId DAO error - ${error.message}.`
    });
    throw error;
  }
};

const fetchAllRidesForPD = async (user_id) => {
  console.log('Fetching all', user_id);
  const params = {
    TableName: "ChauffeurRides",
    IndexName: "pd_id-index",  // Ensure this GSI exists in your DynamoDB table
    KeyConditionExpression: "pd_id = :pd_id",
    ExpressionAttributeValues: {
      ":pd_id": user_id,
    },
  };

  try {
    const command = new QueryCommand(params);
    const response = await ddbDocClient.send(command);
    return response.Items || null;
  } catch (error) {
    console.error("Error fetching ride:", error);
    await addServerLog({
      log_level: "ERROR",
      service_name: "fetchAllRidesForPD",
      error_message: `fetchAllRidesForPD DAO error - ${error.message}.`
    });
    throw error;
  }
};

const fetchRidesWithStatusByPD = async (pd_id, action) => {
  console.log('PD Id:', pd_id, 'Action:', action);
  const queryParams = {
    TableName: "ChauffeurRides",
    IndexName: "pd_id-index",
    KeyConditionExpression: "#pd_id = :pd_id",
    FilterExpression: "#status IN (:started, :dropRequest)", // ✅ Use IN operator for multiple values
    ExpressionAttributeNames: {
      "#status": "status",
      "#pd_id": "pd_id",
    },
    ExpressionAttributeValues: {
      ":pd_id": Number(pd_id),
      ":started": "Started",
      ":dropRequest": "Droprequest",
    },
  };
  try {
    const data = await ddbDocClient.send(new QueryCommand(queryParams));
    return data.Items;
  } catch (error) {
    console.error("Error fetching rides:", error);
    await addServerLog({
      log_level: "ERROR",
      service_name: "fetchRidesWithStatusByPD",
      error_message: `fetchRidesWithStatusByPD DAO error - ${error.message}.`
    });
    throw error;
  }
};

const updateRideByPkSk = async (chauffeur_id, ride_id, updates) => {
  const { PK, SK, ...validUpdates } = updates;
  console.log("Updating ride", ride_id);
  console.log("Chauffeur ID:", chauffeur_id);
  console.log("Valid updates:", updates);

  const updateExpressions = [];
  const expressionAttributeValues = {};
  const expressionAttributeNames = {};

  for (const [key, value] of Object.entries(validUpdates)) {
    updateExpressions.push(`#${key} = :${key}`);
    expressionAttributeValues[`:${key}`] = value;
    expressionAttributeNames[`#${key}`] = key;
  }

  const params = {
    TableName: "ChauffeurRides",
    Key: { 
      PK: PK, 
      SK: SK 
    },
    UpdateExpression: `SET ${updateExpressions.join(", ")}`,
    ExpressionAttributeValues: expressionAttributeValues,
    ExpressionAttributeNames: expressionAttributeNames,
    ReturnValues: "ALL_NEW",
  };

  try {
    const command = new UpdateCommand(params);
    const response = await ddbDocClient.send(command);
    console.log("Ride updated successfully:", response.Attributes);
    return response.Attributes;
  } catch (error) {
    console.error("Error updating ride:", error);
    await addServerLog({
      log_level: "ERROR",
      service_name: "updateRideByPkSk",
      error_message: `updateRideByPkSk DAO error - ${error.message}.`
    });
    throw error;
  }
};

const checkPendingRideForChauffeur = async (chauffeur_id) => {
  const params = {
    TableName: "ChauffeurRides",
    KeyConditionExpression: "PK = :pkValue",
    FilterExpression: "#status <> :cancelledStatus AND #status <> :completedStatus",
    ExpressionAttributeNames: {
      "#status": "status",
    },
    ExpressionAttributeValues: {
      ":pkValue": `CHAUFFEUR#${chauffeur_id}`,
      ":cancelledStatus": "Cancelled",
      ":completedStatus": "Completed",
    },
  };

  try {
    const command = new QueryCommand(params);
    const response = await ddbDocClient.send(command);
    return response.Items || [];
  } catch (error) {
    console.error("Error checking for rides: ", error);
    await addServerLog({
      log_level: "ERROR",
      service_name: "checkPendingRideForChauffeur",
      error_message: `checkPendingRideForChauffeur DAO error - ${error.message}.`
    });
    throw new Error("Error checking ride status.");
  }
};

const getRideDetails = async (ride_id) => {
  try {
    const params = {
      TableName: "ChauffeurRides",
      IndexName: "ride_id_index",
      KeyConditionExpression: "ride_id = :ride_id",
      ExpressionAttributeValues: {
        ":ride_id": ride_id,
      },
    };
     
    const command = new QueryCommand(params);
    const response = await ddbDocClient.send(command);
    return response.Items.length ? response.Items : null;
  } catch (error) {
    console.error('Error in getting ride details:', error.message);
    await addServerLog({
      log_level: "ERROR",
      service_name: "getRideDetails",
      error_message: `getRideDetails DAO error - ${error.message}.`
    });
    throw new Error('Database error: unable to fetch ride details');
  }
};

const getRideStatus = async (ride_id) => {
  try {
    const params = {
      TableName: "Rides",
      IndexName: "ride_id_index",
      KeyConditionExpression: "ride_id = :ride_id",
      ExpressionAttributeNames: {
        "#statusAttr": "status", 
        "#plannedEndTime": "planned_end_time", 
        "#rideId": "ride_id", 
        "#rateType": "rate_type",
        "#rideType": "ride_type",
        "#organisationId": "organisation_id",
        "#statusLog": "status_log",
        "#beforeRideImages": "before_ride_images",
        "#chauffeur_id": "chauffeur_id",
        "#paymentDetails": "payment_details",
        "#chauffeur_id": "chauffeur_id",
        "#paymentDetails": "payment_details",
        "#requested_drop_point": "requested_drop_point",
        "#requested_drop": "requested_drop",
        "#respond_to_tip": "respond_to_tip"
      },
      ExpressionAttributeValues: {
        ":ride_id": ride_id,
      },
      ProjectionExpression: "#rideId, #statusAttr, #rideType, #rateType, #plannedEndTime, #organisationId, #statusLog, #beforeRideImages, #chauffeur_id, #paymentDetails, #requested_drop_point, #requested_drop, #respond_to_tip",
    };

    const command = new QueryCommand(params);
    const response = await ddbDocClient.send(command);
   // console.log("DynamoDB Response: ", response);

    if (response.Items && response.Items.length > 0) {
      return response.Items;
    } else {
      return null;
    }
  } catch (error) {
    console.error("Error in getting ride status:", error.message);
    await addServerLog({
      log_level: "ERROR",
      service_name: "getRideStatus",
      error_message: `getRideStatus DAO error - ${error.message}.`
    });
    throw new Error("Database error: unable to fetch ride status");
  }
};


const checkPendingRideForPD = async (pd_id, rideStatus) => {
  const params = {
    TableName: "ChauffeurRides",
    IndexName: "pd_id-index",
    KeyConditionExpression: "#pd_id = :pdIdValue",
    FilterExpression: "NOT (#status IN (:requestedStatus, :cancelledStatus, :completedStatus))",
    ExpressionAttributeNames: {
      "#status": "status",
      "#pd_id": "pd_id",
    },
    ExpressionAttributeValues: {
      ":pdIdValue": pd_id,
      ":requestedStatus": "Requested",
      ":cancelledStatus": "Cancelled",
      ":completedStatus": "Completed",
    },
  };
  
  try {
    const command = new QueryCommand(params);
    const response = await ddbDocClient.send(command);
    return response.Items || [];
  } catch (error) {
    console.error("Error checking for rides: ", error);
    await addServerLog({
      log_level: "ERROR",
      service_name: "checkPendingRideForPD",
      error_message: `checkPendingRideForPD DAO error - ${error.message}.`
    });
    throw new Error("Error checking ride status.");
  }
};

const getChauffeurNamesByRideId = async (chauffeurRidePairs) => {
  let rideDetails = {};

  for (const { chauffeurId, rideId } of chauffeurRidePairs) {
    if (!chauffeurId || !rideId) continue;

    const params = {
      TableName: "ChauffeurRides",
      KeyConditionExpression: "PK = :pk AND SK = :sk",
      ExpressionAttributeValues: {
        ":pk": `CHAUFFEUR#${chauffeurId}`,
        ":sk": `RIDE#${rideId}`
      },
    };

    try {
      const command = new QueryCommand(params);
      const response = await ddbDocClient.send(command);
      if (response.Items && response.Items.length > 0) {
        const rideInfo = response.Items[0];
        rideDetails[rideId] = {
          chauffeurName: rideInfo.chauffeur_name || "Unknown Chauffeur",
          status: rideInfo.status || "Unknown Status"
        };
      } else {
        rideDetails[rideId] = {
          chauffeurName: "Unknown Chauffeur",
          status: "Unknown Status"
        };
      }
    } catch (error) {
      console.error(`Error fetching ride ${rideId} for chauffeur ${chauffeurId}:`, error);
      rideDetails[rideId] = {
        chauffeurName: "Unknown Chauffeur",
        status: "Unknown Status"
      };
    }
  }

  return rideDetails;
};

const getPdRideStatus = async (ride_id) => {
  try {
    const params = {
      TableName: "ChauffeurRides",
      IndexName: "ride_id_index",
      KeyConditionExpression: "ride_id = :ride_id",
      ExpressionAttributeNames: {
        "#statusAttr": "status", 
        "#pd_id": "pd_id", 
        "#pd_name": "pd_name"
      },
      ExpressionAttributeValues: {
        ":ride_id": ride_id,
      },
      ProjectionExpression: "#statusAttr, #pd_id, #pd_name"
    };

    const command = new QueryCommand(params);
    const response = await ddbDocClient.send(command);

    console.log("DynamoDB Response: ", response);

    if (response.Items && response.Items.length > 0) {
      return response.Items;
    } else {
      return null;
    }
  } catch (error) {
    console.error("Error in getting ride status:", error.message);
    await addServerLog({
      log_level: "ERROR",
      service_name: "getPdRideStatus",
      error_message: `getPdRideStatus DAO error - ${error.message}.`
    });
    throw new Error("Database error: unable to fetch ride status");
  }
};

const getCompletedRidesForMonth = async () => {
  try {
    const currentDate = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(currentDate.getDate() - 30);

     
    const params = {
      TableName: "Rides",
      IndexName: "chauffeur_id-index",
      FilterExpression: "(#status = :completed OR #status = :paymentPending OR #status = :reviewPending) AND #order_date BETWEEN :start_date AND :end_date",
      ExpressionAttributeNames: {
        "#status": "status",
        "#order_date": "order_date",
      },
      ExpressionAttributeValues: {
        ":completed": "Completed",
        ":paymentPending": "Payment-Pending",
        ":reviewPending": "Review-Pending",
        ":start_date": thirtyDaysAgo.toISOString(),
        ":end_date": currentDate.toISOString(),
    
      },
    };

    console.log("Query Params:", params);

    let allRides = [];
    let lastEvaluatedKey = null;

    do {
      if (lastEvaluatedKey) {
        params.ExclusiveStartKey = lastEvaluatedKey;
      }

      const response = await ddbDocClient.send(new ScanCommand(params));
      lastEvaluatedKey = response.LastEvaluatedKey;
      if (response.Items) {
        allRides = allRides.concat(response.Items);
      }
    } while (lastEvaluatedKey);
    
    console.log("allrides:", allRides.length);
    return allRides;
  } catch (error) {
    console.error("Error fetching completed rides:", error);
    await addServerLog({
      log_level: "ERROR",
      service_name: "getCompletedRidesForMonth",
      error_message: `getCompletedRidesForMonth DAO error - ${error.message}.`
    });
    throw new Error("Database error: Unable to fetch completed rides.");
  }
};

const getChauffeurRideDuration = async (statusLog) => {
  try {
    const startedEntry = statusLog.find(entry => entry.status === "Started");
    const reviewPendingEntry = statusLog.find(entry => entry.status === "Payment Initiated");

    if (!startedEntry || !reviewPendingEntry) return "";

    const startTime = new Date(startedEntry.datetime);
    const endTime = new Date(reviewPendingEntry.datetime);

    const diffInMs = endTime - startTime;
    const totalSeconds = Math.floor(diffInMs / 1000);

    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    let result = [];
    if (hours > 0) result.push(`${hours} hr`);
    if (minutes > 0) result.push(`${minutes} min`);
    if (seconds > 0) result.push(`${seconds} sec`);

    return result.join(" and ");
  } catch (error) {
    console.error("Error calculating ride duration:", error.message);
    await addServerLog({
      log_level: "ERROR",
      service_name: "getChauffeurRideDuration",
      error_message: `getChauffeurRideDuration DAO error - ${error.message}.`
    });
    throw error;
  }
};



const rideSummary = async (startDate, endDate, pd_id) => {
  try {
    const params = {
      TableName: "ChauffeurRides",
      IndexName: "pd_id-index", // Ensure the index exists
      KeyConditionExpression: "#pd_id = :pd_id",
      ExpressionAttributeNames: {
        "#pd_id": "pd_id",
      },
      ExpressionAttributeValues: {
        ":pd_id": pd_id,
      },
    };
    
    if (startDate && endDate) {
      params.FilterExpression = "#updatedAt BETWEEN :startDate AND :endDate";
      params.ExpressionAttributeNames["#updatedAt"] = "updatedAt";
      params.ExpressionAttributeValues[":startDate"] = startDate;
      params.ExpressionAttributeValues[":endDate"] = endDate;
    }
    // Add status filter to include only "Completed" rides
    if (params.FilterExpression) {
      params.FilterExpression += " AND #status = :status";  // Combine with the existing filter
    } else {
      params.FilterExpression = "#status = :status";  // Apply filter directly if no other filter exists
    }
    
    params.ExpressionAttributeNames["#status"] = "status";
    params.ExpressionAttributeValues[":status"] = "Completed";  // You can replace this with other statuses as needed

    const data = await ddbDocClient.send(new QueryCommand(params));
    const rides = data.Items || [];
    return {
      total_rides: rides.length,
      rides,
    };
  } catch (error) {
    console.error("Error in fetching ride summary", error);
    await addServerLog({
      log_level: "ERROR",
      service_name: "rideSummary",
      error_message: `rideSummary DAO error - ${error.message}.`
    });
    throw new Error(`Error in fetching ride summary: ${error.message}`);
  }
};

const fetchAllChauffeurswithPD = async (pd_id) => {
  try {
    const statuses = ["Started", "Droprequest"];
    let allRides = [];

    for (const status of statuses) {
      const params = {
        TableName: "ChauffeurRides",
        IndexName: "status-index", // Ensure this GSI exists
        KeyConditionExpression: "#status = :statusValue",
        ExpressionAttributeNames: {
          "#status": "status",
        },
        ExpressionAttributeValues: {
          ":statusValue": status,
        },
      };

      if (pd_id) {
        params.FilterExpression = "#pd_id = :pdValue";
        params.ExpressionAttributeNames["#pd_id"] = "pd_id";
        params.ExpressionAttributeValues[":pdValue"] = pd_id;
      }

      const result = await ddbDocClient.send(new QueryCommand(params));
      allRides = allRides.concat(result.Items || []);
    }

    console.log("Rides fetched successfully:", allRides);
    return allRides;
  } catch (error) {
    console.error(error);
    await addServerLog({
      log_level: "ERROR",
      service_name: "fetchAllChauffeurswithPD",
      error_message: `fetchAllChauffeurswithPD DAO error - ${error.message}.`
    });
    throw new Error(`Error in fetching Chauffeurs with PD: ${error.message}`);
  }
};

const getActiveChauffeurPdRides = async (chauffeurId) => {
  const params = {
    TableName: "ChauffeurRides",
    KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
    FilterExpression: "#status <> :cancelled AND #status <> :completed",
    ExpressionAttributeValues: {
      ":pk": `CHAUFFEUR#${chauffeurId}`,
      ":sk": "RIDE#",
      ":cancelled": "Cancelled",
      ":completed": "Completed",
    },
    ExpressionAttributeNames: {
      "#status": "status",
    },
  };

  try {
    const command = new QueryCommand(params);
    const response = await ddbDocClient.send(command);

    // Filtering out unwanted fields and converting organisation_id to an integer
    const filteredRides = response.Items.map(({ 
      PK, SK, lower_chauffeur_name, lower_pd_name, updatedAt, user_type, organisation_id, 
      ...rest 
    }) => ({
      ...rest,
      organisation_id: organisation_id ? parseInt(organisation_id, 10) : null, 
    }));

    return filteredRides;
  } catch (error) {
    console.error("Error fetching rides:", error);
    await addServerLog({
      log_level: "ERROR",
      service_name: "getActiveChauffeurPdRides",
      error_message: `getActiveChauffeurPdRides DAO error - ${error.message}.`
    });
    throw new Error("Database error: Unable to fetch rides");
  }
};

module.exports = {
  getUserLocation,
  fetchDeviceIdsByUserIds,
  fetchAllIdsofPD,
  fetchAllRidesForChauffeur,
  getRideHistoryByChauffeurId,
  addRide,
  getRideById,
  updateRideByPkSk,
  checkPendingRideForChauffeur,
  fetchPickedUpChauffeurs,
  fetchDroppedChauffeurs,
  fetchCompletedAndCancelledRides,
  fetchChauffeursInRidesTable,
  updateRideTable,
  getRide,
  fetchAllRidesForPD,
  fetchRidesWithStatusByPD,
  getRideDetails,
  getRideStatus,
  checkPendingRideForPD,
  getChauffeurNamesByRideId,
  getPdRideStatus,
  getActiveRideByChauffeurId,
  getCompletedRidesForMonth,
  getChauffeurRideDuration,
  rideSummary,
  fetchAllChauffeurswithPD,
  getActiveChauffeurPdRides
};
