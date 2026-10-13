// dao/ridesDAO.js

const { addServerLog } = require("../services/serverLogsService");
const { getNextId } = require("./counterDAO");
const ddbDocClient = require("./ddbClient");

const {
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
  ScanCommand,
} = require("@aws-sdk/lib-dynamodb");

/**
 * Adds a new ride to the RideTable with an auto-incremented ride_id.
 * @param {object} rideData - The data to be inserted into the RideTable.
 * @param {string} entityType - Type of entity ('CHAUFFEUR', 'CUSTOMER', 'PD_DRIVER').
 * @returns {object} - The ride item that was added.
 */
const addRide = async (rideData, entityType) => {
  let categoryKey;
  switch (entityType) {
    case "CUSTOMER":
      categoryKey = "RideTable-Cust";
      break;
    case "CHAUFFEUR":
      categoryKey = "RideTable-Chau";
      break;
    case "PD_DRIVER":
      categoryKey = "RideTable-PD";
      break;
    default:
      throw new Error("Invalid entity type.");
  }

  try {
    // Generate a sequential ride_id
    const numericRideId = await getNextId(categoryKey); // Fetch the next numeric ID
    const rideId = numericRideId.toString().padStart(7, "0"); // e.g., '0000123'

    // Assign ride_id to rideData
    rideData.ride_id = rideId;

    //Assign false to is_ride_extended - 31-July-2025
    //to handle half day and full day ride extension with per hour option
    rideData.is_ride_extended = false;
    rideData.ride_extension_mts = 0;

    // Assign PK and SK based on entityType
    let PK, SK;
    switch (entityType) {
      case "CUSTOMER":
        PK = `${rideData.customer_id}`;
        SK = `#${rideId}`;
        break;
      case "CHAUFFEUR":
        PK = `CHAUFFEUR`;
        SK = `${rideData.chauffeur_id}#${rideId}`;
        break;
      case "PD_DRIVER":
        PK = `PD_DRIVER#${rideData.pd_driver_id}#DATE#${rideData.date}`;
        SK = `DETAILS`;
        break;
      default:
        throw new Error("Invalid entity type.");
    }

    // Create the ride item
    const rideItem = {
      PK,
      SK,
      all_rides_pk: "All Rides",
      ...rideData,
    };
    console.log(rideItem);

    // Insert the ride into DynamoDB
    const params = {
      TableName: "Rides",
      Item: rideItem,
    };

    const command = new PutCommand(params);
    await ddbDocClient.send(command);
    return rideItem;
  } catch (error) {
    console.error("Error adding ride:", error);
    await addServerLog({
      log_level: "ERROR",
      service_name: "addRide",
      error_message: `addRide DAO error - ${error.message}.`,
    });
    throw error;
  }
};

const addOrgRide = async (rideData) => {
  try {
    const numericRideId = await getNextId("RideTable-Org"); // Unique ID for organization rides
    const rideId = numericRideId.toString().padStart(7, "0"); // e.g., "0000123"
    rideData.ride_id = rideId;

    const rideItem = {
      PK: `ORG#${rideData.organisation_id}`,
      SK: `#${rideId}`,
      all_rides_pk: "All Rides",
      ...rideData,
    };

    const params = {
      TableName: "Rides",
      Item: rideItem,
    };

    const command = new PutCommand(params);
    await ddbDocClient.send(command);
    return rideItem;
  } catch (error) {
    console.error("Error adding organization ride:", error);
    await addServerLog({
      log_level: "ERROR",
      service_name: "addOrgRide",
      error_message: `addOrgRide DAO error - ${error.message}`,
    });
    throw error;
  }
};


/**
 * Retrieves a specific ride item.
 * @param {string} PK
 * @param {string} SK
 * @returns {object|null} - The ride item or null if not found.
 */
const getRide = async (PK, SK) => {
  const params = {
    TableName: "Rides",
    Key: {
      PK,
      SK,
    },
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
      error_message: `getRide DAO error - ${error.message}.`,
    });
    throw error;
  }
};

/**
 * Retrieves a specific ride by rideId.
 * @param {string} ride_id - The unique identifier for the ride.
 * @returns {object|null} - The ride item or null if not found.
 */
const getRideById = async (ride_id) => {
  const params = {
    TableName: "Rides",
    IndexName: "ride_id_index",
    KeyConditionExpression: "ride_id = :ride_id",
    ExpressionAttributeValues: {
      ":ride_id": ride_id,
    },
    ProjectionExpression:
      "#status, requested_pickup_point, requested_pickup, PK, SK, chauffeur_id, customer_id, status_log, ride_id, scheduled_pickup, estimated_time_in_minutes, planned_end_time, ride_type, requested_drop_point, order_date, vehicle_id, estimated_amount, requested_drop, organisation_ride, apple_pay_paid, chauffeur_initiate_apple_pay, apple_pay_payment_failed, final_price_calculation, end_time, customer_details, coupon_code, rate_type, paymentDetails",
    ExpressionAttributeNames: {
      "#status": "status", // Alias reserved keyword
    },
  };

  try {
    const command = new QueryCommand(params);
    const response = await ddbDocClient.send(command);

    //console.log("Response Items:", response.Items);

    // Return the first matching item or null if none are found
    return response.Items && response.Items.length > 0
      ? response.Items[0]
      : null;
  } catch (error) {
    console.error("Error fetching ride by rideId:", { ride_id, error });
    await addServerLog({
      log_level: "ERROR",
      service_name: "getRideById",
      error_message: `getRideById DAO error - ${error.message}.`,
    });
    throw error;
  }
};

/**
 * Updates a ride item using its partition key (PK) and sort key (SK).
 * @param {string} pk - The partition key value of the ride.
 * @param {string} sk - The sort key value of the ride.
 * @param {object} updates - The key-value pairs of attributes to update.
 */
const updateRideByPkSk = async (pk, sk, updates) => {
  // Remove PK and SK from updates if they exist (keys cannot be updated)
  const { PK, SK, ...validUpdates } = updates;

  // Build the UpdateExpression and ExpressionAttributeValues dynamically
  const updateExpressions = [];
  const expressionAttributeValues = {};
  const expressionAttributeNames = {};

  for (const [key, value] of Object.entries(validUpdates)) {
    updateExpressions.push(`#${key} = :${key}`);
    expressionAttributeValues[`:${key}`] = value;
    expressionAttributeNames[`#${key}`] = key;
  }

  const params = {
    TableName: "Rides",
    Key: { PK: pk, SK: sk },
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
      error_message: `updateRideByPkSk DAO error - ${error.message}.`,
    });
    throw error;
  }
};

// Function to get a ride request by rideId
const getRideRequest = async (rideId) => {
  const params = {
    TableName: "RideTable",
    Key: { rideId },
  };

  try {
    // Assuming dynamodb.get is available in context; if not, wrap similar to others.
    const result = await dynamodb.get(params).promise();
    return result.Item;
  } catch (error) {
    console.error("Error getting ride request:", error);
    await addServerLog({
      log_level: "ERROR",
      service_name: "getRideRequest",
      error_message: `getRideRequest DAO error - ${error.message}.`,
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
    TableName: "Rides",
    Key: key,
    UpdateExpression: `SET ${updateExpression.join(", ")}`,
    ExpressionAttributeNames: expressionAttributeNames,
    ExpressionAttributeValues: expressionAttributeValues,
    ReturnValues: "UPDATED_NEW",
  };

  try {
    const result = await ddbDocClient.send(new UpdateCommand(params));
    console.log("RideTable update result:", result);
    return result.Attributes;
  } catch (error) {
    console.error("Error updating RideTable:", error);
    await addServerLog({
      log_level: "ERROR",
      service_name: "updateRideTable",
      error_message: `updateRideTable DAO error - ${error.message}.`,
    });
    throw error;
  }
};

const createEntryInRideTable = async (targetTable, itemData) => {
  const params = {
    TableName: targetTable,
    Item: itemData,
  };

  try {
    const command = new PutCommand(params);
    await ddbDocClient.send(command);
    console.log(`Item added to ${targetTable}`);
  } catch (error) {
    console.error(`Error adding item to ${targetTable}:`, error);
    await addServerLog({
      log_level: "ERROR",
      service_name: "createEntryInRideTable",
      error_message: `createEntryInRideTable DAO error - ${error.message}.`,
    });
    throw error;
  }
};

const fetchPickedUpChauffeurs = async (params) => {
  try {
    const result = await ddbDocClient.send(new QueryCommand(params));
    return {
      chauffeursPicked: result.Items.filter((item) => item.status === "Picked"),
      pickedCount: result.Items.filter((item) => item.status === "Picked")
        .length,
    };
  } catch (error) {
    console.error("Error fetching picked chauffeurs:", error);
    await addServerLog({
      log_level: "ERROR",
      service_name: "fetchPickedUpChauffeurs",
      error_message: `fetchPickedUpChauffeurs DAO error - ${error.message}.`,
    });
    throw error;
  }
};

const fetchDroppedChauffeurs = async (params) => {
  try {
    const result = await ddbDocClient.send(new QueryCommand(params));
    return {
      chauffeursDropped: result.Items.filter(
        (item) => item.status === "Dropped"
      ),
      droppedCount: result.Items.filter((item) => item.status === "Dropped")
        .length,
    };
  } catch (error) {
    console.error("Error fetching dropped chauffeurs:", error);
    await addServerLog({
      log_level: "ERROR",
      service_name: "fetchDroppedChauffeurs",
      error_message: `fetchDroppedChauffeurs DAO error - ${error.message}.`,
    });
    throw error;
  }
};

/**
 * Retrieves active rides for a customer where status is NOT 'Completed'.
 * @param {string} customerId - The customer's ID.
 * @returns {Array} - List of active rides.
 */
const getActiveRidesForCustomer = async (customerId) => {
  if (typeof customerId !== "string") {
    customerId = String(customerId);
  }

  const activeStatuses = [
    "Requested",
    "Accepted",
    "Started",
    "On-The-Way",
    "Reached Customer",
    "Payment Initiated",
    "Review-Pending",
  ];

  // Function to perform a single query for a specific status
  const queryByStatus = async (status) => {
    const params = {
      TableName: "Rides",
      IndexName: "CustomerIndex",
      KeyConditionExpression: "customer_id = :customerId AND #status = :status",
      ExpressionAttributeNames: {
        "#status": "status",
        "#ride_type": "ride_type",
      },
      ExpressionAttributeValues: {
        ":customerId": customerId,
        ":status": status,
        ":rideType": "instant",
      },
      FilterExpression: "#ride_type = :rideType",
      ExpressionAttributeValues: {
        ":customerId": customerId,
        ":status": status,
        ":rideType": "instant", // Ensuring this is used in FilterExpression
      },
    };

    try {
      const command = new QueryCommand(params);
      const response = await ddbDocClient.send(command);
      return response.Items || [];
    } catch (error) {
      console.error(`Error fetching rides with status ${status}:`, error);
      await addServerLog({
        log_level: "ERROR",
        service_name: "getActiveRidesForCustomer",
        error_message: `queryByStatus (status: ${status}) error - ${error.message}.`,
      });
      throw error;
    }
  };

  try {
    const ridesPerStatus = await Promise.all(
      activeStatuses.map((status) => queryByStatus(status))
    );
    const allActiveRides = ridesPerStatus.flat();
    return allActiveRides;
  } catch (error) {
    console.error("Error fetching active rides:", error);
    await addServerLog({
      log_level: "ERROR",
      service_name: "getActiveRidesForCustomer",
      error_message: `getActiveRidesForCustomer DAO error - ${error.message}.`,
    });
    throw error;
  }
};

const getAllActiveRidesForCustomer = async (customerId) => {
  if (!customerId) {
    throw new Error("Customer ID is required.");
  }

  if (typeof customerId !== "string") {
    customerId = String(customerId);
  }

  const activeStatuses = [
    "Requested",
    "Accepted",
    "On-The-Way",
    "Started",
    "Reached Customer",
    "Payment Initiated",
    "Review-Pending",
  ];

  const queryByStatus = async (status) => {
    let items = [];
    let lastEvaluatedKey = null;
    const params = {
      TableName: "Rides",
      IndexName: "CustomerIndex",
      KeyConditionExpression: "customer_id = :customerId AND #status = :status",
      ExpressionAttributeNames: {
        "#status": "status",
      },
      ExpressionAttributeValues: {
        ":customerId": customerId,
        ":status": status,
      },
    };

    try {
      do {
        if (lastEvaluatedKey) {
          params.ExclusiveStartKey = lastEvaluatedKey;
        }

        const command = new QueryCommand(params);
        const response = await ddbDocClient.send(command);
        items = items.concat(response.Items || []);
        lastEvaluatedKey = response.LastEvaluatedKey;
      } while (lastEvaluatedKey);

      console.log("rides:", items);
      return items;
    } catch (error) {
      console.error(`Error querying rides for status ${status}:`, error);
      await addServerLog({
        log_level: "ERROR",
        service_name: "getAllActiveRidesForCustomer",
        error_message: `queryByStatus (status: ${status}) error - ${error.message}.`,
      });
      throw error;
    }
  };

  try {
    const resultsPerStatus = await Promise.all(
      activeStatuses.map((status) => queryByStatus(status))
    );
    const allActiveRides = resultsPerStatus.flat();
    return allActiveRides;
  } catch (error) {
    console.error("Error fetching all active rides for customer:", error);
    await addServerLog({
      log_level: "ERROR",
      service_name: "getAllActiveRidesForCustomer",
      error_message: `getAllActiveRidesForCustomer DAO error - ${error.message}.`,
    });
    throw error;
  }
};

/**
 * Checks if the user already has a ride that is not cancelled or completed.
 * @param {string} userId - User ID.
 * @returns {object|null} - Ride details or null if no valid ride exists.
 */
const checkPendingRideForChauffeur = async (userId) => {
  const params = {
    TableName: "Rides",
    KeyConditionExpression: "PK = :pkValue AND begins_with(SK, :skPrefix)",
    FilterExpression:
      "#status <> :cancelledStatus AND #status <> :completedStatus",
    ExpressionAttributeNames: {
      "#status": "status",
    },
    ExpressionAttributeValues: {
      ":pkValue": "CHAUFFEUR",
      ":skPrefix": `${userId}#`,
      ":cancelledStatus": "Cancelled",
      ":completedStatus": "Completed",
    },
  };

  try {
    const command = new QueryCommand(params);
    const response = await ddbDocClient.send(command);
    return response.Items || [];
  } catch (error) {
    console.error("Error checking for rides:", error);
    await addServerLog({
      log_level: "ERROR",
      service_name: "checkPendingRideForChauffeur",
      error_message: `checkPendingRideForChauffeur DAO error - ${error.message}.`,
    });
    throw new Error("Error checking ride status.");
  }
};

const fetchRidesWithStatus = async (pk, status) => {
  const queryParams = {
    TableName: "Rides",
    KeyConditionExpression: "PK = :pk",
    FilterExpression: "#status = :status",
    ExpressionAttributeNames: {
      "#status": "status",
    },
    ExpressionAttributeValues: {
      ":pk": pk,
      ":status": status,
    },
  };
  try {
    const command = new QueryCommand(queryParams);
    const result = await ddbDocClient.send(command);
    return result.Items;
  } catch (error) {
    console.error("Error fetching items:", error);
    await addServerLog({
      log_level: "ERROR",
      service_name: "fetchRidesWithStatus",
      error_message: `fetchRidesWithStatus DAO error - ${error.message}.`,
    });
    throw error;
  }
};

const fetchRidesWithStatusAndDateRange = async (
  pd_id,
  action,
  from_date,
  to_date
) => {
  try {
    const statuses = action ? [action] : ["Picked", "Dropped"];
    const queries = [];

    for (let status of statuses) {
      const queryParams = {
        TableName: "PDPickupDrop",
        IndexName: "status-updatedAt-index",
        KeyConditionExpression:
          "#status = :status AND #updatedAt BETWEEN :fromDate AND :toDate",
        ExpressionAttributeNames: {
          "#status": "status",
          "#updatedAt": "updatedAt",
        },
        ExpressionAttributeValues: {
          ":status": status,
          ":fromDate": from_date || "1970-01-01T00:00:00Z",
          ":toDate": to_date || new Date().toISOString(),
        },
        ScanIndexForward: false,
      };

      if (pd_id) {
        queryParams.FilterExpression = "#pd_id = :pd_id";
        queryParams.ExpressionAttributeNames["#pd_id"] = "pd_id";
        queryParams.ExpressionAttributeValues[":pd_id"] = pd_id;
      }

      queries.push(ddbDocClient.send(new QueryCommand(queryParams)));
    }

    const results = await Promise.all(queries);
    const combinedResults = results.flatMap((result) => result.Items || []);
    return combinedResults;
  } catch (error) {
    console.error("Error fetching rides:", error);
    await addServerLog({
      log_level: "ERROR",
      service_name: "fetchRidesWithStatusAndDateRange",
      error_message: `fetchRidesWithStatusAndDateRange DAO error - ${error.message}.`,
    });
    throw error;
  }
};

const fetchRidesWithStatusByPD = async (pk, pd_id, action) => {
  const queryParams = {
    TableName: "Rides",
    KeyConditionExpression: "PK = :pk",
    FilterExpression: "#status = :status AND #pd_id = :pd_id",
    ExpressionAttributeNames: {
      "#status": "status",
      "#pd_id": "pd_id",
    },
    ExpressionAttributeValues: {
      ":pk": pk,
      ":status": action,
      ":pd_id": pd_id,
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
      error_message: `fetchRidesWithStatusByPD DAO error - ${error.message}.`,
    });
    throw error;
  }
};

/**
 * Checks if a ride exists by ride_id.
 * @param {string} ride_id - The unique identifier for the ride.
 * @returns {boolean} - Returns true if the ride exists, false otherwise.
 */
const findRideById = async (ride_id) => {
  const params = {
    TableName: "Rides",
    IndexName: "ride_id_index",
    KeyConditionExpression: "ride_id = :ride_id",
    ExpressionAttributeValues: {
      ":ride_id": ride_id,
    },
    ProjectionExpression: "ride_id",
  };

  try {
    const command = new QueryCommand(params);
    const response = await ddbDocClient.send(command);
    console.log("Ride existence check response:", response.Items);
    return response.Items && response.Items.length > 0;
  } catch (error) {
    console.error("Error checking ride existence:", error);
    await addServerLog({
      log_level: "ERROR",
      service_name: "findRideById",
      error_message: `findRideById DAO error - ${error.message}.`,
    });
    throw new Error("Database error: Unable to verify ride.");
  }
};

const fetchCompletedAndCancelledRides = async () => {
  try {
    const statuses = ["Completed", "Cancelled", "Review-Pending"];
    let allResults = [];

    for (const status of statuses) {
      const queryParams = {
        TableName: "Rides",
        IndexName: "status-index",
        KeyConditionExpression: "#status = :statusValue",
        FilterExpression:
          "attribute_exists(#chauffeur_id) AND #chauffeur_id <> :emptyString",
        ProjectionExpression: "chauffeur_id",
        ExpressionAttributeNames: {
          "#status": "status",
          "#chauffeur_id": "chauffeur_id",
        },
        ExpressionAttributeValues: {
          ":statusValue": status,
          ":emptyString": "",
        },
      };

      const result = await ddbDocClient.send(new QueryCommand(queryParams));
      if (result.Items) {
        allResults = allResults.concat(
          result.Items.map((item) => item.chauffeur_id)
        );
      }
    }

    return allResults;
  } catch (error) {
    console.error("Error fetching rides:", error);
    await addServerLog({
      log_level: "ERROR",
      service_name: "fetchCompletedAndCancelledRides",
      error_message: `fetchCompletedAndCancelledRides DAO error - ${error.message}.`,
    });
    throw error;
  }
};

const fetchChauffeursInRidesTable = async () => {
  const queryParams = {
    TableName: "Rides",
    IndexName: "all_rides_pk-index",
    KeyConditionExpression: "#allRidesPK = :allRidesPKValue",
    FilterExpression:
      "attribute_exists(#chauffeur_id) AND #chauffeur_id <> :emptyString",
    ProjectionExpression: "chauffeur_id",
    ExpressionAttributeNames: {
      "#allRidesPK": "all_rides_pk",
      "#chauffeur_id": "chauffeur_id",
    },
    ExpressionAttributeValues: {
      ":allRidesPKValue": "All Rides",
      ":emptyString": "",
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
      error_message: `fetchChauffeursInRidesTable DAO error - ${error.message}.`,
    });
    throw error;
  }
};

const getActiveRidesByCustomerId = async (customerId) => {
  const params = {
    TableName: "Rides",
    KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
    FilterExpression:
      "attribute_exists(#status) AND NOT (#status IN (:cancelled, :completed))",
    ExpressionAttributeValues: {
      ":pk": customerId,
      ":sk": "#",
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
    const items = response?.Items ?? [];
    console.log("Active rides:", items);

    return items;

  } catch (error) {
    console.error("Error fetching rides:", error);
    await addServerLog({
      log_level: "ERROR",
      service_name: "getActiveRidesByCustomerId",
      error_message: `getActiveRidesByCustomerId DAO error - ${error.message}.`,
      metadata: { customerId },
    });
    throw new Error("Database error: Unable to fetch rides");
  }
};

const getActiveRideForChauffeur = async (chauffeurId) => {
  if (chauffeurId == null || typeof chauffeurId !== "number") {
    console.warn("Invalid chauffeurId provided:", chauffeurId);
    return null;
  }

  const params = {
    TableName: "Rides",
    IndexName: "chauffeur_id-index",
    KeyConditionExpression: "#chauffeur = :chauffeurId",
    FilterExpression:
      "#status <> :cancelled AND #status <> :completed AND #status <> :reviewpending AND #status <> :paymentpending AND #status <> :applepaystatus",
    ExpressionAttributeNames: {
      "#chauffeur": "chauffeur_id",
      "#status": "status",
    },
    ExpressionAttributeValues: {
      ":chauffeurId": chauffeurId,
      ":cancelled": "Cancelled",
      ":completed": "Completed",
      ":reviewpending": "Review-Pending",
      ":paymentpending": "Payment-Pending",
      ":applepaystatus": "Apple-Pay-Payment-Completed",
    },
    ScanIndexForward: false,
  };

  try {
    const command = new QueryCommand(params);
    const response = await ddbDocClient.send(command);
    console.log(response);
    return response.Items;
  } catch (error) {
    console.error("Error fetching active ride for chauffeur:", error);
    await addServerLog({
      log_level: "ERROR",
      service_name: "getActiveRideForChauffeur",
      error_message: `getActiveRideForChauffeur DAO error - ${error.message}.`,
    });
    throw error;
  }
};

const getActiveInstantRideForChauffeur = async (chauffeurId) => {
  if (!chauffeurId || chauffeurId === "null") {
    console.warn("Invalid chauffeurId provided:", chauffeurId);
    return [];
  }

  const params = {
    TableName: "Rides",
    IndexName: "chauffeur_id-index",
    KeyConditionExpression: "#chauffeur = :chauffeurId",
    FilterExpression:
      "#status <> :cancelled AND #status <> :completed AND #status <> :reviewpending AND #status <> :paymentpending AND #rideType = :instant AND #status <> :applepaystatus",
    ExpressionAttributeNames: {
      "#chauffeur": "chauffeur_id",
      "#status": "status",
      "#rideType": "ride_type",
    },
    ExpressionAttributeValues: {
      ":chauffeurId": chauffeurId,
      ":cancelled": "Cancelled",
      ":completed": "Completed",
      ":instant": "instant",
      ":reviewpending": "Review-Pending",
      ":paymentpending": "Payment-Pending",
      ":applepaystatus": "Apple-Pay-Payment-Completed",
    },
  };

  try {
    const command = new QueryCommand(params);
    const response = await ddbDocClient.send(command);
    return response.Items || [];
  } catch (error) {
    console.error("Error fetching active instant ride for chauffeur:", error);
    await addServerLog({
      log_level: "ERROR",
      service_name: "getActiveInstantRideForChauffeur",
      error_message: `getActiveInstantRideForChauffeur DAO error - ${error.message}.`,
    });
    throw error;
  }
};

const getDashboardData = async (params) => {
  try {
    let items = [];
    let lastEvaluatedKey = null;

    do {
      if (lastEvaluatedKey) {
        params.ExclusiveStartKey = lastEvaluatedKey;
      }

      const data = await ddbDocClient.send(new QueryCommand(params));
      items = items.concat(data.Items || []);
      lastEvaluatedKey = data.LastEvaluatedKey;
    } while (lastEvaluatedKey);

    return items;
  } catch (error) {
    console.error("Error fetching dashboard:", error);
    await addServerLog({
      log_level: "ERROR",
      service_name: "getDashboardData",
      error_message: `getDashboardData DAO error - ${error.message}.`,
    });
    throw new Error("Database error: Unable to fetch dashboard data");
  }
};

/**
 * Retrieves rides for a customer with status "Completed" or "Cancelled", sorted by ride_id.
 * @param {string} customerId - The customer's ID.
 * @returns {Array} - List of rides.
 */
const getCustomerRides = async (customerId) => {
  if (typeof customerId !== "string") {
    customerId = String(customerId);
  }

  const queryRidesByStatus = async (statusValue) => {
    const params = {
      TableName: "Rides",
      IndexName: "CustomerIndex",
      KeyConditionExpression: "customer_id = :customerId AND #status = :status",
      ExpressionAttributeNames: {
        "#status": "status",
      },
      ExpressionAttributeValues: {
        ":customerId": customerId,
        ":status": statusValue,
      },
    };

    try {
      const command = new QueryCommand(params);
      const response = await ddbDocClient.send(command);
      return response.Items || [];
    } catch (error) {
      console.error(`Error fetching rides for status ${statusValue}:`, error);
      await addServerLog({
        log_level: "ERROR",
        service_name: "getCustomerRides",
        error_message: `queryRidesByStatus (status: ${statusValue}) error - ${error.message}.`,
      });
      throw error;
    }
  };

  try {
    const [completedRides, cancelledRides] = await Promise.all([
      queryRidesByStatus("Completed"),
      queryRidesByStatus("Cancelled"),
    ]);
    const combinedRides = [...completedRides, ...cancelledRides];
    combinedRides.sort(
      (a, b) => parseInt(b.ride_id, 10) - parseInt(a.ride_id, 10)
    );
    return combinedRides;
  } catch (error) {
    console.error("Error fetching customer rides:", error);
    await addServerLog({
      log_level: "ERROR",
      service_name: "getCustomerRides",
      error_message: `getCustomerRides DAO error - ${error.message}.`,
    });
    throw error;
  }
};

const getCustomerRideCalculation = async (statusLog) => {
  try {
    if (!Array.isArray(statusLog) || statusLog.length === 0) return "";

    const startedEntry = statusLog.find((entry) => entry.status === "Started");
    const completedEntry = statusLog.find(
      (entry) => entry.status === "Completed"
    );

    if (!startedEntry || !completedEntry) return "";

    const startTime = new Date(startedEntry.datetime);
    const endTime = new Date(completedEntry.datetime);

    const diffInMinutes = Math.round((endTime - startTime) / (1000 * 60));

    const hours = Math.floor(diffInMinutes / 60);
    const minutes = diffInMinutes % 60;

    if (hours > 0 && minutes > 0) {
      return `${hours} hours and ${minutes} minutes`;
    } else if (hours > 0) {
      return `${hours} hours`;
    } else {
      return `${minutes} minutes`;
    }

    // return diffInMinutes >= 60
    //   ? `${(diffInMinutes / 60).toFixed(2)} hours`
    //   : `${diffInMinutes} minutes`;
  } catch (error) {
    console.error("Error calculating customer ride duration:", error);
    await addServerLog({
      log_level: "ERROR",
      service_name: "getCustomerRideCalculation",
      error_message: `getCustomerRideCalculation DAO error - ${error.message}.`,
    });
    throw error;
  }
};

const getScheduledRidesForChauffeur = async (chauffeurId) => {
  if (!chauffeurId || chauffeurId === "null") {
    console.warn("Invalid chauffeurId provided:", chauffeurId);
    return [];
  }

  const params = {
    TableName: "Rides",
    KeyConditionExpression: "#pk = :pkValue",
    FilterExpression:
      "#chauffeur = :chauffeurId AND #rideType = :scheduled AND #status = :accepted",
    ExpressionAttributeNames: {
      "#pk": "PK",
      "#chauffeur": "chauffeur_id",
      "#rideType": "ride_type",
      "#status": "status",
    },
    ExpressionAttributeValues: {
      ":pkValue": "CUSTOMER",
      ":chauffeurId": chauffeurId,
      ":scheduled": "scheduled",
      ":accepted": "Accepted",
    },
  };

  try {
    const command = new QueryCommand(params);
    const response = await ddbDocClient.send(command);
    return response.Items || [];
  } catch (error) {
    console.error("Error fetching scheduled rides for chauffeur:", error);
    await addServerLog({
      log_level: "ERROR",
      service_name: "getScheduledRidesForChauffeur",
      error_message: `getScheduledRidesForChauffeur DAO error - ${error.message}.`,
    });
    throw error;
  }
};

const canApplyFirstRideCoupon = async (customerId) => {
  const params = {
    TableName: "Rides",
    IndexName: "CustomerIndex",
    KeyConditionExpression: "customer_id = :customerId",
    ExpressionAttributeValues: {
      ":customerId": customerId,
    },
  };

  try {
    const result = await ddbDocClient.send(new QueryCommand(params));

    const hasCompletedRide = result.Items.some((ride) => {
      if (Array.isArray(ride.status_log)) {
        const hasAccepted = ride.status_log.some((log) => log.status === "Accepted");
        const hasFinal = ride.status_log.some((log) =>
          ["Review-Pending", "Completed"].includes(log.status)
        );
        return hasAccepted && hasFinal;
      }
      return false;
    });

    return !hasCompletedRide;
  } catch (error) {
    console.error("Error checking coupon eligibility:", error);
    await addServerLog({
      log_level: "ERROR",
      service_name: "canApplyFirstRideCoupon",
      error_message: `canApplyFirstRideCoupon DAO error - ${error.message}.`,
    });
    throw error;
  }
};

const fetchRideIdsByOrganization = async (
  organizationId,
  startDate,
  endDate
) => {
  try {
    let allRideIds = [];
    const allowedStatuses = ["Payment-Pending"];

    for (const status of allowedStatuses) {
      if (!status) {
        console.warn("⚠️ Skipping empty status value.");
        continue;
      }

      const params = {
        TableName: "Rides",
        IndexName: "status-index",
        KeyConditionExpression: "#status = :statusValue",
        FilterExpression:
          "#organisation_id = :organizationId AND #order_date BETWEEN :startDate AND :endDate",
        ExpressionAttributeNames: {
          "#status": "status",
          "#organisation_id": "organisation_id",
          "#order_date": "order_date",
        },
        ExpressionAttributeValues: {
          ":statusValue": status,
          ":organizationId": String(organizationId),
          ":startDate": startDate,
          ":endDate": endDate,
        },
      };
      const result = await ddbDocClient.send(new QueryCommand(params));
      const rideIds = result.Items
        ? result.Items.map((item) => item.ride_id)
        : [];
      allRideIds = [...allRideIds, ...rideIds];
    }

    return allRideIds || [];
  } catch (error) {
    console.error("Error fetching organization rides:", error);
    await addServerLog({
      log_level: "ERROR",
      service_name: "fetchRideIdsByOrganization",
      error_message: `fetchRideIdsByOrganization DAO error - ${error.message}.`,
    });
    throw new Error(`Error in invoice generation: ${error.message}`);
  }
};

const getUpcomingRidesForNotification = async () => {
  const now = new Date();
  console.log(`🚀 Current time: ${now.toISOString()}`);

  const params = {
    TableName: "Rides",
    IndexName: "ride_type-index",
    KeyConditionExpression: "ride_type = :scheduled",
    ExpressionAttributeValues: {
      ":scheduled": "scheduled",
    },
    ProjectionExpression: "ride_id, scheduled_pickup, #status",
    ExpressionAttributeNames: {
      "#status": "status",
    },
  };

  try {
    const command = new QueryCommand(params);
    const response = await ddbDocClient.send(command);

    response.Items.forEach((ride) => {
      console.log(
        `🕒 Ride ID ${ride.ride_id} - Scheduled Pickup: ${ride.scheduled_pickup}`
      );
    });

    const upcomingRides = response.Items.filter((ride) => {
      const scheduledTime = new Date(ride.scheduled_pickup).getTime();
      const nowTime = now.getTime();
      const timeDifference = (scheduledTime - nowTime) / 60000;

      console.log(
        `🕒 Ride ${ride.ride_id}: Scheduled at ${ride.scheduled_pickup
        }, Now: ${now.toISOString()}, Time diff: ${timeDifference.toFixed(
          2
        )} min`
      );

      return (
        timeDifference >= 0 &&
        timeDifference <= 5 &&
        ride["status"] === "Requested"
      );
    });

    console.log(`✅ Found ${upcomingRides.length} upcoming rides`);
    return upcomingRides;
  } catch (error) {
    console.error("❌ Error fetching upcoming rides:", error);
    await addServerLog({
      log_level: "ERROR",
      service_name: "getUpcomingRidesForNotification",
      error_message: `getUpcomingRidesForNotification DAO error - ${error.message}.`,
    });
    throw error;
  }
};

const getScheduledRidesForToday = async () => {
  const now = new Date();
  const todayStart = new Date(now.setUTCHours(0, 0, 0, 0)).toISOString();
  const todayEnd = new Date(now.setUTCHours(23, 59, 59, 999)).toISOString();

  console.log(
    `🚀 Checking scheduled rides for today: ${todayStart} - ${todayEnd}`
  );

  const params = {
    TableName: "Rides",
    IndexName: "ride_type-index",
    KeyConditionExpression:
      "ride_type = :scheduled AND scheduled_pickup BETWEEN :start AND :end",
    FilterExpression: "#status = :requested",
    ExpressionAttributeValues: {
      ":scheduled": "scheduled",
      ":start": todayStart,
      ":end": todayEnd,
      ":requested": "Requested",
    },
    ExpressionAttributeNames: {
      "#status": "status",
    },
  };

  try {
    const command = new QueryCommand(params);
    const response = await ddbDocClient.send(command);

    if (!response.Items || response.Items.length === 0) {
      console.log(
        "⚠️ No scheduled rides with 'Requested' status found for today."
      );
      return [];
    }

    response.Items.forEach((ride) => {
      console.log(
        `🕒 Ride ID ${ride.ride_id} - Scheduled Pickup: ${ride.scheduled_pickup}`
      );
    });

    return response.Items;
  } catch (error) {
    console.error("❌ Error fetching scheduled rides for today:", error);
    await addServerLog({
      log_level: "ERROR",
      service_name: "getScheduledRidesForToday",
      error_message: `getScheduledRidesForToday DAO error - ${error.message}.`,
    });
    throw error;
  }
};

const fetchRideByUserIdAndDateRange = async (
  start_date,
  end_date,
  chauffeur_id
) => {
  try {
    const params = {
      TableName: "Rides",
      IndexName: "chauffeur_id-index",
      KeyConditionExpression: "#chauffeur_id = :chauffeur_id",
      ExpressionAttributeNames: {
        "#chauffeur_id": "chauffeur_id",
      },
      ExpressionAttributeValues: {
        ":chauffeur_id": chauffeur_id,
      },
    };

    // Filter expression components
    const filterExpressions = [];
    params.ExpressionAttributeNames["#status"] = "status";

    // ✅ Add status filter using OR (DynamoDB doesn't support IN)
    const allowedStatuses = [
      "Completed",
      "Payment-Pending",
      "Review-Pending",
      "Cancelled",
    ];
    const statusConditions = allowedStatuses.map((status, idx) => {
      const key = `:status${idx}`;
      params.ExpressionAttributeValues[key] = status;
      return `#status = ${key}`;
    });
    filterExpressions.push(`(${statusConditions.join(" OR ")})`);

    // ✅ Add date filter (ensure date is in ISO format)
    if (start_date && end_date) {
      params.ExpressionAttributeNames["#order_date"] = "order_date";
      params.ExpressionAttributeValues[":startDate"] = start_date;
      params.ExpressionAttributeValues[":endDate"] = end_date;
      filterExpressions.push("#order_date BETWEEN :startDate AND :endDate");
    }

    // Combine filters
    if (filterExpressions.length > 0) {
      params.FilterExpression = filterExpressions.join(" AND ");
    }

    // ✅ Fetch all paginated results
    let rides = [];
    let lastEvaluatedKey = null;
    do {
      if (lastEvaluatedKey) {
        params.ExclusiveStartKey = lastEvaluatedKey;
      }

      const data = await ddbDocClient.send(new QueryCommand(params));
      rides = rides.concat(data.Items || []);
      lastEvaluatedKey = data.LastEvaluatedKey;
    } while (lastEvaluatedKey);

    if (!rides.length) {
      throw Object.assign(
        new Error("No rides found for this chauffeur in the given date range."),
        { status: 400 }
      );
    }

    return rides;
  } catch (error) {
    console.error("Error while fetching chauffeur rides", error);
    await addServerLog({
      log_level: "ERROR",
      service_name: "fetchRideByUserIdAndDateRange",
      error_message: `fetchRideByUserIdAndDateRange DAO error - ${error.message}.`,
    });
    throw error;
  }
};

const orgRides = async (organization_id, start_date, end_date) => {
  try {
    const allowedStatuses = ["Payment-Pending"];

    if (!organization_id || !start_date || !end_date) {
      throw new Error(
        "Missing required parameters: organization_id, start_date, or end_date."
      );
    }

    const ridePromises = allowedStatuses.map(async (status) => {
      const params = {
        TableName: "Rides",
        IndexName: "status-index",
        KeyConditionExpression: "#status = :statusValue",
        FilterExpression:
          "#organisation_id = :organizationId AND #order_date BETWEEN :startDate AND :endDate",
        ExpressionAttributeNames: {
          "#status": "status",
          "#organisation_id": "organisation_id",
          "#order_date": "order_date",
        },
        ExpressionAttributeValues: {
          ":statusValue": status,
          ":organizationId": String(organization_id),
          ":startDate": start_date,
          ":endDate": end_date,
        },
      };

      const result = await ddbDocClient.send(new QueryCommand(params));
      return result.Items || [];
    });

    const rides = (await Promise.all(ridePromises)).flat();
    return rides;
  } catch (error) {
    console.error("Error fetching organization rides:", error);
    await addServerLog({
      log_level: "ERROR",
      service_name: "orgRides",
      error_message: `orgRides DAO error - ${error.message}.`,
    });
    throw new Error(
      `Error fetching organization rides in DAO: ${error.message}`
    );
  }
};

const getCreditedRides = async (
  start_date,
  end_date,
  chauffeur_id,
  organization_id
) => {
  try {
    const allowedStatuses = ["Payment-Pending"];

    if (!start_date || !end_date) {
      throw new Error("Missing required parameters: start_date or end_date.");
    }

    const ridePromises = allowedStatuses.map(async (status) => {
      let rides = [];
      let LastEvaluatedKey = undefined;

      do {
        const params = {
          TableName: "Rides",
          IndexName: "status-index",
          KeyConditionExpression: "#status = :statusValue",
          FilterExpression: "#order_date BETWEEN :startDate AND :endDate",
          ExpressionAttributeNames: {
            "#status": "status",
            "#order_date": "order_date",
          },
          ExpressionAttributeValues: {
            ":statusValue": status,
            ":startDate": start_date,
            ":endDate": end_date,
          },
          ExclusiveStartKey: LastEvaluatedKey, // Pagination token
        };

        if (chauffeur_id) {
          params.FilterExpression += " AND #chauffeur_id = :chauffeur_id";
          params.ExpressionAttributeNames["#chauffeur_id"] = "chauffeur_id";
          params.ExpressionAttributeValues[":chauffeur_id"] = chauffeur_id;
        }

        if (organization_id) {
          params.FilterExpression += " AND #organization_id = :organization_id";
          params.ExpressionAttributeNames["#organization_id"] =
            "organisation_id";
          params.ExpressionAttributeValues[":organization_id"] =
            String(organization_id);
        }

        const result = await ddbDocClient.send(new QueryCommand(params));
        rides = rides.concat(result.Items || []);
        LastEvaluatedKey = result.LastEvaluatedKey;
      } while (LastEvaluatedKey);

      return rides;
    });

    const allRides = (await Promise.all(ridePromises)).flat();
    return allRides;
  } catch (error) {
    console.error("Error in getting credited rides:", error.message);
    await addServerLog({
      log_level: "ERROR",
      service_name: "getCreditedRides",
      error_message: `getCreditedRides DAO error - ${error.message}.`,
    });
    throw error;
  }
};

const getAllRides = async (chauffeur_id, start_date, end_date) => {
  try {
    const allowedStatuses = ["Completed", "Cancelled", "Review-Pending"];

    if (!start_date || !end_date) {
      throw new Error("Missing required parameters: start_date or end_date.");
    }

    const allRides = [];

    for (const status of allowedStatuses) {
      let lastKey = undefined;

      do {
        const params = {
          TableName: "Rides",
          IndexName: "status-index",
          KeyConditionExpression: "#status = :statusValue",
          FilterExpression:
            "#end_time BETWEEN :startDate AND :endDate" +
            (chauffeur_id ? " AND #chauffeur_id = :chauffeurId" : ""),
          ExpressionAttributeNames: {
            "#status": "status",
            "#end_time": "end_time",
            ...(chauffeur_id && { "#chauffeur_id": "chauffeur_id" }),
          },
          ExpressionAttributeValues: {
            ":statusValue": status,
            ":startDate": start_date,
            ":endDate": end_date,
            ...(chauffeur_id && { ":chauffeurId": chauffeur_id }),
          },
          ExclusiveStartKey: lastKey,
        };

        const result = await ddbDocClient.send(new QueryCommand(params));
        if (result.Items) allRides.push(...result.Items);
        lastKey = result.LastEvaluatedKey;
      } while (lastKey);
    }

    return allRides;
  } catch (error) {
    console.error("Error in getAllRides:", error.message);
    await addServerLog({
      log_level: "ERROR",
      service_name: "getAllRides",
      error_message: `getAllRides DAO error - ${error.message}.`,
    });
    throw error;
  }
};

const getRidesByOrganizationIdAndStatuses = async (organizationId) => {
  try {
    const rideStatuses = [
      "Requested",
      "Accepted",
      "Started",
      "On-The-Way",
      "Reached Customer",
      "Payment Initiated",
      "Review-Pending",
      "Payment-Pending",
    ];

    const queries = rideStatuses.map((status) => {
      const params = {
        TableName: "Rides",
        IndexName: "status-index",
        KeyConditionExpression: "#status = :statusVal",
        FilterExpression: "organisation_id = :orgId",
        ExpressionAttributeNames: {
          "#status": "status",
        },
        ExpressionAttributeValues: {
          ":statusVal": status,
          ":orgId": organizationId,
        },
      };

      return ddbDocClient.send(new QueryCommand(params));
    });

    const responses = await Promise.all(queries);

    const results = responses.flatMap((response) => response.Items || []);

    console.log(
      `Found ${results.length} rides for organization: ${organizationId}`
    );
    return results;
  } catch (error) {
    console.error("Error fetching rides by organization and statuses:", error);
    throw error;
  }
};



/**
 * Updates the status log of a ride.
 * @param {string} pk - The primary key of the ride.
 * @param {string} sk - The sort key of the ride.
 *  @param {string} status - The new status to set.
 * @param {array} statusLog - The updated status log array.
 * @returns {object} - The updated ride details.
 */
const updateStatusLog = async (pk, sk, status, statusLog) => {
  const params = {
    TableName: "Rides",
    Key: { PK: pk, SK: sk },
    UpdateExpression: "SET  #status = :status,status_log = :status_log",
    ExpressionAttributeValues: {
      ":status": status,
      ":status_log": statusLog,
    },
    ExpressionAttributeNames: {
      "#status": "status", // Alias reserved keyword
    },
    ReturnValues: "ALL_NEW",
  };

  try {
    const command = new UpdateCommand(params);
    const response = await ddbDocClient.send(command);
    return response.Attributes;
  } catch (error) {
    console.error("Error updating status log:", error);
    throw error;
  }
};


const getRidesForOrganization = async (organization_id) => {
  try {
    const params = {
      TableName: "Rides",
      IndexName: "status-index", // Replace with actual GSI name if different
      KeyConditionExpression: "#status = :pendingStatus",
      FilterExpression: "organisation_id = :organizationId",
      ExpressionAttributeNames: {
        "#status": "status",
      },
      ExpressionAttributeValues: {
        ":pendingStatus": "Payment-Pending",
        ":organizationId": String(organization_id),
      },
    };

    const result = await ddbDocClient.send(new QueryCommand(params));
    return result.Items || [];
  } catch (error) {
    console.error("Error in getRidesForOrganization:", error.message);
    await addServerLog({
      log_level: "ERROR",
      service_name: "getRidesForOrganization",
      error_message: `getRidesForOrganization DAO error - ${error.message}.`,
    });
    throw error;
  }
};


const isFirstRide = async (customerId) => {
  try {
    const params = {
      TableName: 'Rides',
      IndexName: 'CustomerIndex',
      KeyConditionExpression: 'customer_id = :cid AND #st = :completed',
      ExpressionAttributeNames: { '#st': 'status' },
      ExpressionAttributeValues: {
        ':cid': customerId,
        ':completed': 'Completed',
      },
      Select: 'COUNT',
    };

    const { Count } = await ddbDocClient.send(new QueryCommand(params));
    // If no completed rides found, this is the first
    return Count === 0;
  } catch (error) {
    console.error('Error checking first ride:', error);
    await addServerLog({
      log_level: 'ERROR',
      service_name: 'isFirstRide',
      error_message: `First ride check failed - ${error.message}`,
    });
    throw error;
  }
};

module.exports = {
  addRide,
  addOrgRide,
  getRide,
  getRideRequest,
  updateRideTable,
  getRideById,
  updateRideByPkSk,
  createEntryInRideTable,
  fetchPickedUpChauffeurs,
  fetchDroppedChauffeurs,
  getActiveRidesForCustomer,
  checkPendingRideForChauffeur,
  fetchRidesWithStatus,
  fetchRidesWithStatusAndDateRange,
  fetchRidesWithStatusByPD,
  fetchCompletedAndCancelledRides,
  fetchChauffeursInRidesTable,
  getActiveRidesByCustomerId,
  findRideById,
  getDashboardData,
  getActiveRideForChauffeur,
  getCustomerRides,
  canApplyFirstRideCoupon,
  getScheduledRidesForChauffeur,
  getActiveInstantRideForChauffeur,
  getAllActiveRidesForCustomer,
  fetchRideIdsByOrganization,
  fetchRideByUserIdAndDateRange,
  getUpcomingRidesForNotification,
  getScheduledRidesForToday,
  orgRides,
  getCustomerRideCalculation,
  getCreditedRides,
  getAllRides,
  getRidesByOrganizationIdAndStatuses,
  getRidesForOrganization,
  updateStatusLog,
  isFirstRide
};
