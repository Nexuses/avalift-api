const ddbDocClient = require("./ddbClient");
const { PutCommand, QueryCommand } = require("@aws-sdk/lib-dynamodb");
const { addServerLog } = require("../services/serverLogsService"); // Update the path as needed

// Function to store user location
const saveUserLocation = async (user_id, latitude, longitude) => {
  try {
    const date_time = new Date().toISOString();  

    const params = {
      TableName: "LocationsHistory",
      Item: {
        user_id,        
        date_time,      
        latitude,
        longitude
      }
    };

    await ddbDocClient.send(new PutCommand(params));

    console.log(`Location saved for user: ${user_id} at ${date_time}`);
    return { success: true, message: "Location stored successfully" };
  } catch (error) {
    console.error("Error saving location:", error);
    await addServerLog({
      log_level: "ERROR",
      service_name: "saveUserLocation",
      error_message: `saveUserLocation DAO error - ${error.message}.`
    });
    return { success: false, message: "Failed to store location", error };
  }
};

/**
 * Fetch all pings for a driver between two ISO timestamps.
 * Results are sorted ascending (oldest ➜ newest).
 */
const getDriverLocations = async (userId, startTime, endTime) => {
  try {
    const params = {
      TableName: 'LocationsHistory',
      KeyConditionExpression:
        'user_id = :userId AND date_time BETWEEN :startTime AND :endTime',
      ExpressionAttributeValues: {
        ':userId': userId,
        ':startTime': startTime,
        ':endTime': endTime,
      },
      ScanIndexForward: true,
    };

    const data = await ddbDocClient.send(new QueryCommand(params));
    return data.Items || [];
  } catch (err) {
    await addServerLog({
      log_level: 'ERROR',
      service_name: 'getDriverLocations',
      error_message: `getDriverLocations DAO error – ${err.message}.`,
    });
    return [];
  }
};

module.exports = {
  saveUserLocation,
  getDriverLocations,
};
