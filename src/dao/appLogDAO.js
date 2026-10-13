
const ddbDocClient = require('./ddbClient');
const { PutCommand } = require("@aws-sdk/lib-dynamodb");



exports.upsertAppLog = async (
    user_id,
    module,
    errorlog
  ) => {
    if (!user_id) {
      throw new Error("user_id is required and cannot be null");
    }
    if (!errorlog) {
      throw new Error("errorlog is required and cannot be null");
    }
  
    // Generate the current datetime as an ISO string
    const dateObj = new Date();
    const datetimeStr = dateObj.toISOString();
  
    // Derive the partition key from datetimeStr (YYYYMMDD)
    const dateKey = datetimeStr.split("T")[0].replace(/-/g, ""); // e.g. "2025-03-08" -> "20250308"
  
    // Create a unique sort key by combining 'APPLOG', current timestamp and a random number
    const uniqueSuffix = `${datetimeStr}-${Math.floor(Math.random() * 1000000)}`;
    const sortKey = `APPLOG#${uniqueSuffix}`;
  
    const params = {
      TableName: "AppLogs",
      Item: {
        PK: dateKey,           // Partition key: the date as YYYYMMDD
        SK: sortKey,           // Sort key: composite prefix and unique suffix
        datetime: datetimeStr, // Current datetime in ISO format
        user_id,
        module,
        errorlog,
      },
    };
  
    try {
      const command = new PutCommand(params);
      await ddbDocClient.send(command);
      console.log(`App log added for date ${dateKey} with sort key ${sortKey} at ${datetimeStr}`);
    } catch (error) {
      console.error("Error adding app log:", error);
      throw error;
    }
  };
  