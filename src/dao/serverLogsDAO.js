// serverLogsDAO.js

const ddbDocClient = require('./ddbClient');
const { PutCommand, QueryCommand } = require("@aws-sdk/lib-dynamodb");

/**
 * Insert a new server log entry.
 * The partition key (PK) is derived from the current datetime in YYYYMMDD format,
 * and the sort key (SK) is constructed as log_level#<uniqueSuffix>.
 * 
 * @param {string} log_level - Log level (e.g. "ERROR", "INFO", "WARN")
 * @param {string} service_name - Name of the service or microservice (optional).
 * @param {string} endpoint - API endpoint or source function (optional).
 * @param {number} status_code - HTTP status code or custom status (optional).
 * @param {string} error_message - Error message (required).
 * @param {object} metadata - Additional metadata (optional).
 */
exports.upsertServerLog = async (
  log_level,
  service_name,
  endpoint,
  status_code,
  error_message,
  metadata
) => {
  if (!log_level) {
    throw new Error("log_level is required and cannot be null");
  }
  if (!error_message) {
    throw new Error("error_message is required and cannot be null");
  }

  // Generate the current datetime as an ISO string
  const dateObj = new Date();
  const datetimeStr = dateObj.toISOString();

  // Derive the partition key from datetimeStr (YYYYMMDD)
  const dateKey = datetimeStr.split("T")[0].replace(/-/g, ""); // e.g. "2025-03-08" -> "20250308"

  // Create a unique sort key by combining log_level, current timestamp and a random number
  const uniqueSuffix = `${datetimeStr}-${Math.floor(Math.random() * 1000000)}`;
  const sortKey = `${log_level}#${uniqueSuffix}`;

  const params = {
    TableName: "ServerLogs",
    Item: {
      PK: dateKey,            // Partition key: the date as YYYYMMDD
      SK: sortKey,            // Sort key: composite of log_level and unique suffix
      datetime: datetimeStr,  // Current datetime in ISO format
      service_name,
      endpoint,
      status_code,
      error_message,
      metadata,
    },
  };

  try {
    const command = new PutCommand(params);
    await ddbDocClient.send(command);
    console.log(`Server log added for date ${dateKey} with sort key ${sortKey} at ${datetimeStr}`);
  } catch (error) {
    console.error("Error adding server log:", error);
    throw error;
  }
};

/**
 * Retrieve server logs by date.
 * The function queries the ServerLogs table using the partition key (date in YYYYMMDD format).
 * 
 * @param {string} dateKey - The date in YYYYMMDD format (e.g. "20250308")
 * @returns {Promise<Array>} - A list of server log entries for that date.
 */
exports.getServerLogsByDate = async (dateKey) => {
  const params = {
    TableName: "ServerLogs",
    KeyConditionExpression: "PK = :pk",
    ExpressionAttributeValues: {
      ":pk": dateKey,
    },
  };

  try {
    const command = new QueryCommand(params);
    const response = await ddbDocClient.send(command);
    return response.Items;
  } catch (error) {
    console.error("Error retrieving server logs:", error);
    throw error;
  }
};
