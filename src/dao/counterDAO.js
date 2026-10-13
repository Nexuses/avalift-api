// dao/counterDAO.js
const ddbDocClient = require('./ddbClient');
const { PutCommand, UpdateCommand } = require("@aws-sdk/lib-dynamodb");
const { addServerLog } = require("../services/serverLogsService"); // Update path if needed

/**
 * Atomically increments and retrieves the next ID for the specified table.
 * If the counter does not exist, it initializes it to 1.
 * @param {string} tableName - The name of the table for which to get the next ID.
 * @returns {Promise<number>} - The next auto-incremented ID.
 */
const getNextId = async (tableName) => {
  try {
    const params = {
      TableName: "CounterTable",
      Key: { table_name: tableName },
      UpdateExpression: "SET CurrentId = if_not_exists(CurrentId, :start) + :incr",
      ExpressionAttributeValues: {
        ":start": 1,
        ":incr": 1,
      },
      ReturnValues: "UPDATED_NEW",
    };

    const command = new UpdateCommand(params);
    const response = await ddbDocClient.send(command);
    return response.Attributes.CurrentId;
  } catch (error) {
    console.error(`Error getting next ID for ${tableName}:`, error);
    await addServerLog({
      log_level: "ERROR",
      service_name: "getNextId",
      error_message: `getNextId DAO error for table ${tableName} - ${error.message}.`
    });
    throw error;
  }
};

/**
 * Adds a new item to the specified DynamoDB table with an auto-incremented ID and a prefix.
 * @param {string} targetTable - The target table name (e.g., 'RideTable', 'Pricings').
 * @param {object} itemData - The data to be inserted into the table.
 * @param {string} idAttribute - The name of the ID attribute (e.g., 'ride_id', 'price_id').
 * @param {string} prefix - The prefix to prepend to the ID (e.g., 'RIDE#').
 * @returns {string} - The ID of the newly added item with the prefix.
 */
const addItemWithAutoIncrement = async (targetTable, itemData, idAttribute, prefix) => {
  try {
    const numericId = await getNextId(targetTable); // Fetch the next numeric ID from CounterTable
    const formattedId = `${prefix}${numericId.toString().padStart(7, '0')}`; // e.g., 'RIDE#0000123'

    // Assign the new formatted ID to the item data
    itemData[idAttribute] = formattedId;

    // Prepare the parameters for PutItem
    const params = {
      TableName: targetTable,
      Item: itemData,
    };

    console.log("First time", params.Item);

    const command = new PutCommand(params);
    await ddbDocClient.send(command);
    console.log(`Item added to ${targetTable} with ${idAttribute}: ${formattedId}`);
    return formattedId;
  } catch (error) {
    console.error(`Error adding item to ${targetTable}:`, error);
    await addServerLog({
      log_level: "ERROR",
      service_name: "addItemWithAutoIncrement",
      error_message: `addItemWithAutoIncrement DAO error for table ${targetTable} - ${error.message}.`
    });
    throw error;
  }
};

/**
 * Adds a new notification to the Notifications table with an auto-incremented SK.
 * @param {object} notificationData - The notification data to be inserted.
 * @param {string} prefix - The prefix to prepend to the SK (e.g., 'NOTIF#').
 * @returns {string} - The generated SK (notification ID).
 */
const addNotificationWithAutoIncrement = async (targetTable, itemData, idAttribute, prefix) => {
  try {
    const numericId = await getNextId(targetTable); // Fetch next numeric ID
    const formattedId = `${prefix}${numericId.toString().padStart(7, '0')}`; // e.g., 'NOTIF#0000123'

    // Assign the generated ID as SK and notification_id
    itemData.SK = formattedId;
    itemData[idAttribute] = formattedId;

    // Construct PK
    const pk = `${itemData.recipient_type.toUpperCase()}#${itemData.recipient_id}`;

    // Prepare the parameters for PutCommand
    const params = {
      TableName: "Notifications",
      Item: {
        PK: pk,
        SK: formattedId,
        notification_id: formattedId,
        recipient_type: itemData.recipient_type,
        recipient_id: itemData.recipient_id,
        title: itemData.title,
        body: itemData.body,
        data: itemData.data || {},
        status: itemData.status || "pending",
        delivery_time: itemData.delivery_time || new Date().toISOString(),
        notification_type: itemData.notification_type,
        messageId: itemData.messageId || null,
        errorMessage: itemData.errorMessage || null
      }
    };

    console.log("Saving notification:", JSON.stringify(params.Item, null, 2));

    const command = new PutCommand(params);
    await ddbDocClient.send(command);
    console.log(`Notification added with SK: ${formattedId}`);
    return formattedId;
  } catch (error) {
    console.error("Error adding notification:", error);
    await addServerLog({
      log_level: "ERROR",
      service_name: "addNotificationWithAutoIncrement",
      error_message: `addNotificationWithAutoIncrement DAO error - ${error.message}.`
    });
    throw error;
  }
};

module.exports = {
  getNextId,
  addItemWithAutoIncrement,
  addNotificationWithAutoIncrement
};
