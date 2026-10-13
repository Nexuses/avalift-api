const ddbDocClient = require("./ddbClient");
const {
  PutCommand,
  UpdateCommand,
  QueryCommand,
  GetCommand,
} = require("@aws-sdk/lib-dynamodb");
const { getChauffeurNamesByRideId } = require("./chauffeurRidesDAO");
const { addServerLog } = require("../services/serverLogsService");
const { v4: uuidv4 } = require('uuid');


const saveNotification = async (notification) => {
  const pk = `${notification.recipient_type.toUpperCase()}#${
    notification.recipient_id
  }`;
  const sk = notification.notification_id;

  console.log(`Saving notification for ${pk}`);

  const params = {
    TableName: "Notifications",
    Key: {
      PK: pk,
      SK: sk,
    },
    UpdateExpression: `
            SET recipient_type = :recipient_type,
                recipient_id = :recipient_id,
                title = :title,
                body = :body,
                #data = :data,
                #status = :status,
                delivery_time = :delivery_time,
                notification_type = :notification_type,
                messageId = :messageId,
                errorMessage = :errorMessage
        `,
    ExpressionAttributeValues: {
      ":recipient_type": notification.recipient_type,
      ":recipient_id": notification.recipient_id,
      ":title": notification.title,
      ":body": notification.body,
      ":data": notification.data || {}, // Ensure empty object instead of undefined
      ":status": notification.status,
      ":delivery_time": notification.delivery_time,
      ":notification_type": notification.notification_type,
      ":messageId": notification.messageId || null,
      ":errorMessage": notification.errorMessage || null,
    },
    ExpressionAttributeNames: {
      "#status": "status", // Alias for reserved "status"
      "#data": "data", // Alias for reserved "data"
    },
    ReturnValues: "UPDATED_NEW", // Returns the newly updated attributes
  };

  try {
    const response = await ddbDocClient.send(new UpdateCommand(params));
    console.log("Notification updated in DynamoDB:", response.Attributes);
  } catch (error) {
    await addServerLog({
      log_level: "ERROR",
      service_name: "saveNotification",
      error_message: `saveNotification DAO error - ${error.message}.`,
    });
    console.error("Error updating notification in DynamoDB:", error);
    throw error;
  }
};

const getRideStatusByRideId = async (rideId, customerId) => {
  //console.log("rideID", rideId)
  //console.log("custID", customerId)
  const params = {
    TableName: "Rides",
    Key: {
      PK: `${customerId}`,
      SK: `#${rideId}`, // Ride ID as Sort Key
    },
  };

  try {
    const command = new GetCommand(params);
    const response = await ddbDocClient.send(command);
    //console.log("Response", response.Item)
    return response.Item || []; // Default to "Unknown" if ride not found
  } catch (error) {
    await addServerLog({
      log_level: "ERROR",
      service_name: "getRideStatusByRideId",
      error_message: `getRideStatusByRideId DAO error - ${error.message}.`,
    });
    console.error(`Error fetching ride status for rideId ${rideId}:`, error);
    return "Unknown"; // Handle errors gracefully
  }
};

const getNotificationsByChauffeurId = async (chauffeurId, page, limit) => {
  const params = {
    TableName: "Notifications",
    KeyConditionExpression: "PK = :pk",
    FilterExpression:
      "#status IN (:delivered, :declined, :accepted) AND #notification_type = :newRide",
    ExpressionAttributeValues: {
      ":pk": `CHAUFFEUR#${chauffeurId}`,
      ":delivered": "delivered",
      ":declined": "Declined",
      ":accepted": "Accepted",
      ":newRide": "new_ride_request",
    },
    ExpressionAttributeNames: {
      "#status": "status",
      "#notification_type": "notification_type",
    },
    ScanIndexForward: false,
  };

  let allNotifications = [];
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
        allNotifications = allNotifications.concat(response.Items);
        totalItems += response.Items.length;
      }
    } while (lastEvaluatedKey); // Loop until all notifications are fetched

    // Sorting by delivery time (newest first)
    allNotifications.sort(
      (a, b) => new Date(b.delivery_time) - new Date(a.delivery_time)
    );

    // Pagination Logic
    const totalPages = Math.ceil(totalItems / limit);
    const paginatedNotifications = allNotifications.slice(
      (page - 1) * limit,
      page * limit
    );

    //if (!response.Items) return [];

    // Fetch ride status for each notification if needed
    const notificationsWithRideStatus = await Promise.all(
      paginatedNotifications.map(async (notification) => {
        let rideStatus = {
          status: "Unknown",
          customer_details: { name: "Unknown Customer" }, // Default values
        };

        if (notification.data?.ride_id && notification.data?.customer_id) {
          try {
            rideStatus =
              (await getRideStatusByRideId(
                notification.data.ride_id,
                notification.data.customer_id
              )) || rideStatus;
          } catch (error) {
            console.error(
              `Error fetching ride status for ride ID: ${notification.data.ride_id}`,
              error
            );
          }
        }

        return {
          notification_id: notification.notification_id,
          customer_name:
            rideStatus.customer_details?.name || "Unknown Customer",
          ride_status: rideStatus.status,
          title: notification.title,
          body: notification.body,
          data: notification.data,
          status: notification.status,
          delivery_time: notification.delivery_time,
          notification_type: notification.notification_type,
        };
      })
    );

    // Sort notifications by delivery_time in descending order (newest first)
    //notificationsWithRideStatus.sort((a, b) => new Date(b.delivery_time) - new Date(a.delivery_time));

    return {
      notifications: notificationsWithRideStatus,
      totalPages,
      currentPage: page,
    };
  } catch (error) {
    await addServerLog({
      log_level: "ERROR",
      service_name: "getNotificationsByChauffeurId",
      error_message: `getNotificationsByChauffeurId DAO error - ${error.message}.`,
    });
    console.error("Error fetching notifications:", error);
    throw new Error("Database error: Unable to fetch notifications");
  }
};

const updateNotificationStatus = async (chauffeurId, rideId, status) => {
  try {
    // Step 1: Query all notifications for this chauffeur
    const queryParams = {
      TableName: "Notifications",
      KeyConditionExpression: "PK = :pk",
      ExpressionAttributeValues: {
        ":pk": `CHAUFFEUR#${chauffeurId}`,
      },
    };

    const queryCommand = new QueryCommand(queryParams);
    const queryResponse = await ddbDocClient.send(queryCommand);

    if (!queryResponse.Items || queryResponse.Items.length === 0) {
      console.warn(`No notifications found for Chauffeur ${chauffeurId}`);
      return;
    }

    // Step 2: Find the notification related to the rideId
    const notificationItem = queryResponse.Items.find(
      (item) => item.data.ride_id === rideId
    );

    if (!notificationItem) {
      console.warn(
        `No matching notification found for Chauffeur ${chauffeurId} and Ride ${rideId}`
      );
      return;
    }

    const notificationId = notificationItem.SK; // Get the correct SK

    // Step 3: Update the notification status
    const updateParams = {
      TableName: "Notifications",
      Key: {
        PK: `CHAUFFEUR#${chauffeurId}`,
        SK: notificationId, // Use the correct SK
      },
      UpdateExpression: "SET #status = :status",
      ExpressionAttributeNames: {
        "#status": "status",
      },
      ExpressionAttributeValues: {
        ":status": status,
      },
      ReturnValues: "UPDATED_NEW",
    };

    const updateCommand = new UpdateCommand(updateParams);
    const updateResponse = await ddbDocClient.send(updateCommand);

    console.log(
      `Notification status updated to ${status} for Chauffeur ${chauffeurId}, Notification ${notificationId}`
    );
    return updateResponse;
  } catch (error) {
    await addServerLog({
      log_level: "ERROR",
      service_name: "updateNotificationStatus",
      error_message: `updateNotificationStatus DAO error - ${error.message}.`,
    });
    console.error("Error updating notification status:", error);
    throw error;
  }
};

const getNotificationsForAdmin = async (adminId, page, limit) => {
  const params = {
    TableName: "Notifications",
    KeyConditionExpression: "PK = :pk",
    FilterExpression: "#status = :status",
    ExpressionAttributeValues: {
      ":pk": `ADMIN#${adminId}`,
      ":status": "delivered",
    },
    ExpressionAttributeNames: {
      "#status": "status",
    },

    //ScanIndexForward: false,
  };

  try {
    // const command = new QueryCommand(params);
    // const response = await ddbDocClient.send(command);

    // return response.Items? response.Items : [];
    let allNotifications = [];
    let lastEvaluatedKey = null;

    do {
      if (lastEvaluatedKey) {
        params.ExclusiveStartKey = lastEvaluatedKey;
      } else {
        delete params.ExclusiveStartKey;
      }

      const response = await ddbDocClient.send(new QueryCommand(params));
      lastEvaluatedKey = response.LastEvaluatedKey;

      if (response.Items) {
        allNotifications = allNotifications.concat(response.Items);
      }
    } while (lastEvaluatedKey);

    console.log(`Total notifications fetched: ${allNotifications.length}`);


    allNotifications.sort(
      (a, b) => new Date(b.delivery_time) - new Date(a.delivery_time)
    );

    // Pagination logic
    const totalPages = Math.ceil(allNotifications.length / limit);
    const paginatedNotifications = allNotifications.slice(
      (page - 1) * limit,
      page * limit
    );

    console.log(
      `Returning page ${page} with ${paginatedNotifications.length} notifications`
    );

    return {
      notifications: paginatedNotifications,
      totalPages,
      currentPage: page,
    };
  } catch (error) {
    await addServerLog({
      log_level: "ERROR",
      service_name: "getNotificationsForAdmin",
      error_message: `getNotificationsForAdmin DAO error - ${error.message}.`,
    });
    console.error("Error fetching notifications:", error);
    throw new Error("Database error: Unable to fetch notifications");
  }
};

const updatePDNotificationStatus = async (pdId, rideId, status) => {
  try {
    // Step 1: Query all notifications for this PD
    const queryParams = {
      TableName: "Notifications",
      KeyConditionExpression: "PK = :pk",
      ExpressionAttributeValues: {
        ":pk": `PD#${pdId}`,
      },
    };

    const queryCommand = new QueryCommand(queryParams);
    const queryResponse = await ddbDocClient.send(queryCommand);

    if (!queryResponse.Items || queryResponse.Items.length === 0) {
      console.warn(`No notifications found for PD ${pdId}`);
      return;
    }

    // Step 2: Find the notification related to the rideId
    const notificationItem = queryResponse.Items.find(
      (item) => item.data.ride_id === rideId
    );

    if (!notificationItem) {
      console.warn(
        `No matching notification found for PD ${pdId} and Ride ${rideId}`
      );
      return;
    }

    const notificationId = notificationItem.SK; // Get the correct SK

    // Step 3: Update the notification status
    const updateParams = {
      TableName: "Notifications",
      Key: {
        PK: `PD#${pdId}`,
        SK: notificationId, // Use the correct SK
      },
      UpdateExpression: "SET #status = :status",
      ExpressionAttributeNames: {
        "#status": "status",
      },
      ExpressionAttributeValues: {
        ":status": status,
      },
      ReturnValues: "UPDATED_NEW",
    };

    const updateCommand = new UpdateCommand(updateParams);
    const updateResponse = await ddbDocClient.send(updateCommand);

    console.log(
      `Notification status updated to ${status} for PD ${pdId}, Notification ${notificationId}`
    );
    return updateResponse;
  } catch (error) {
    await addServerLog({
      log_level: "ERROR",
      service_name: "updatePDNotificationStatus",
      error_message: `updatePDNotificationStatus DAO error - ${error.message}.`,
    });
    console.error("Error updating notification status:", error);
    throw error;
  }
};

const getNotificationsByPdId = async (pdId, page, limit) => {
  // console.log(typeof(page))
  const params = {
    TableName: "Notifications",
    KeyConditionExpression: "PK = :pk",
    FilterExpression:
      "#status IN (:delivered, :declined, :accepted) AND #notification_type = :newRide",
    ExpressionAttributeValues: {
      ":pk": `PD#${pdId}`,
      ":delivered": "delivered",
      ":declined": "Declined",
      ":accepted": "Accepted",
      ":newRide": "chauff-pickup-req-pd",
    },
    ExpressionAttributeNames: {
      "#status": "status",
      "#notification_type": "notification_type",
    },
  };

  let allNotifications = [];
  let lastEvaluatedKey = null;

  try {
    do {
      if (lastEvaluatedKey) {
        params.ExclusiveStartKey = lastEvaluatedKey;
      }

      const response = await ddbDocClient.send(new QueryCommand(params));
      lastEvaluatedKey = response.LastEvaluatedKey;

      if (response.Items && response.Items.length > 0) {
        allNotifications = allNotifications.concat(response.Items);
      } else {
        break; // Stop loop if no more items
      }
    } while (lastEvaluatedKey);

    if (allNotifications.length === 0) {
      return { notifications: [], totalPages: 0, currentPage: page };
    }

    // Process notifications
    let filteredNotifications = allNotifications.map(
      ({ PK, SK, errorMessage, messageId, recipient_type, ...rest }) => rest
    );
    filteredNotifications.sort(
      (a, b) => new Date(b.delivery_time) - new Date(a.delivery_time)
    );

    const chauffeurRidePairs = [
      ...new Set(
        filteredNotifications
          .map((n) => ({
            chauffeurId: n.data?.chauffeur_id,
            rideId: n.data?.ride_id,
          }))
          .filter((pair) => pair.chauffeurId && pair.rideId)
      ),
    ];

    if (chauffeurRidePairs.length > 0) {
      const rideDetails = await getChauffeurNamesByRideId(chauffeurRidePairs);
      filteredNotifications = filteredNotifications.map((notification) => ({
        ...notification,
        chauffeur_name:
          rideDetails[notification.data?.ride_id]?.chauffeurName ||
          "Unknown Chauffeur",
        ride_status:
          rideDetails[notification.data?.ride_id]?.status || "Unknown Status",
      }));
    }
    // Ensure pagination is handled correctly
    const totalPages =
      filteredNotifications.length > 0
        ? Math.ceil(filteredNotifications.length / limit)
        : 0;
    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;

    if (startIndex >= filteredNotifications.length) {
      return { notifications: [], totalPages, currentPage: page };
    }

    const paginatedNotifications = filteredNotifications.slice(
      startIndex,
      endIndex
    );

    return {
      notifications: paginatedNotifications,
      totalPages,
      currentPage: page,
    };
  } catch (error) {
    await addServerLog({
      log_level: "ERROR",
      service_name: "getNotificationsByPdId",
      error_message: `getNotificationsByPdId DAO error - ${error.message}.`,
    });
    console.error(" Error fetching notifications:", error);
    throw new Error("Database error: Unable to fetch notifications");
  }
};

const saveBulkNotificationDetails = async (title, body, userType, successCount, failureCount) => {
  const now = new Date();

  const item = {
    PK: `BULK`,
    SK: `NOTIF#${uuidv4()}`,
    title,
    body,
    user_type: userType,
    delivery_time: now.toISOString(),
    notification_type: "bulk",
    data: {successCount, failureCount},
  };

  const params = {
    TableName: "Notifications",
    Item: item,
  };

  try {
    await ddbDocClient.send(new PutCommand(params));
    console.log('✅ Bulk notification saved:', item);
    return item;
  } catch (error) {
    console.error('❌ Error saving notification:', error);
    throw error;
  }
};

const getBulkNotifications = async (userType, limit = 50) => {
  const params = {
    TableName: "Notifications",
    KeyConditionExpression: 'PK = :pk',
    ExpressionAttributeValues: {
      ':pk': `BULK`,
    },
    Limit: limit,
    ScanIndexForward: false, // false = sort descending (latest first)
  };

  try {
    const response = await ddbDocClient.send(new QueryCommand(params));
    const items = response.Items || [];
    console.log(`📬 Retrieved ${items.length} bulk notifications for ${userType}`);
    return items;
  } catch (error) {
    console.error('❌ Error fetching notifications:', error);
    throw error;
  }
};


module.exports = {
  saveNotification,
  getNotificationsByChauffeurId,
  updateNotificationStatus,
  getNotificationsForAdmin,
  updatePDNotificationStatus,
  getNotificationsByPdId,
  saveBulkNotificationDetails,
  getBulkNotifications
};
