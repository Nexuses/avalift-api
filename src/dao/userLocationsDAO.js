// userLocationsService.js

const ddbDocClient = require('./ddbClient');
const { PutCommand, QueryCommand } = require("@aws-sdk/lib-dynamodb");
const {addServerLog} = require('../services/serverLogsService');


/**
 * Add a new location for a user.
 * @param {string} userId 
 * @param {string} datetime - ISO 8601 string
 * @param {number} latitude 
 * @param {number} longitude 
 * @param {string} status 
 */
export const addUserLocation = async (userId, datetime, latitude, longitude, status) => {
  const params = {
    TableName: "UserLocations",
    Item: {
      userId,
      datetime,
      latitude,
      longitude,
      status,
    },
  };

  try {
    const command = new PutCommand(params);
    await ddbDocClient.send(command);
    console.log(`Location added for userId: ${userId} at ${datetime}`);
  } catch (error) {
    await addServerLog({
      log_level: "ERROR",
      service_name: "addUserLocation",
      error_message: `addUserLocation DAO error - ${error.message
      }`
    });
    console.error("Error adding user location:", error);
    throw error;
  }
};

/**
 * Retrieve all locations for a user.
 * @param {string} userId 
 * @returns {Array} List of locations
 */
export const getUserLocations = async (userId) => {
    const params = {
      TableName: "UserLocations",
      KeyConditionExpression: "userId = :uid",
      ExpressionAttributeValues: {
        ":uid": userId,
      },
    };
  
    try {
      const command = new QueryCommand(params);
      const response = await ddbDocClient.send(command);
      return response.Items;
    } catch (error) {
      await addServerLog({
        log_level: "ERROR",
        service_name: "getUserLocations",
        error_message: `getUserLocations DAO error - ${error.message
        }`
      });
      console.error("Error retrieving user locations:", error);
      throw error;
    }
  };

