// savedLocationsDAO.js
const { addItemWithAutoIncrement } = require("../dao/counterDAO");
const ddbDocClient = require('./ddbClient');
const { PutCommand, GetCommand, UpdateCommand, DeleteCommand } = require("@aws-sdk/lib-dynamodb");


/**
 * Save a new location for a user.
 * 
 * @param {string} user_id 
 * @param {object} location_data - { name, address_line1, ..., latitude, longitude }
 * @returns {string} - The generated ID of the newly added location.
 *  */
const saveLocation = async ( user_id, location_data) => {
  // Generate a new auto-incremented ID with a prefix for location (e.g., "L" for location)
  const formattedId = await addItemWithAutoIncrement("SavedLocations", location_data, "id", "L");


  const params = {
    TableName: "SavedLocations",
    Item: {
      // id:formattedId, // The auto-incremented ID,
      // user_id,
      ...location_data,
    },
  };

  try {
    const command = new PutCommand(params);
    await ddbDocClient.send(command);
    console.log(`Location saved with id: ${formattedId}`);
    return formattedId;  // Return the generated ID
  } catch (error) {
    await addServerLog({
      log_level: "ERROR",
      service_name: "saveLocation",
      error_message: `saveLocation DAO error - ${error.message}.`
    });
    console.error("Error saving location:", error);
    throw error;
  }
};

/**
 * Retrieve all saved locations for a user.
 * @param {string} user_id 
 * @returns {Array} List of saved locations
 */
 const getSavedLocations = async (user_id) => {
    const params = {
      TableName: "SavedLocations",
      IndexName: "user_id-index", // Ensure you have a Global Secondary Index (GSI) on user_id - Have to be added in the table
      KeyConditionExpression: "user_id = :uid",
      ExpressionAttributeValues: {
        ":uid": user_id,
      },
    };
  
    try {
      const command = new QueryCommand(params);
      const response = await ddbDocClient.send(command);
      return response.Items;
    } catch (error) {
      await addServerLog({
        log_level: "ERROR",
        service_name: "getSavedLocations",
        error_message: `getSavedLocations DAO error - ${error.message}.`
      })
      console.error("Error retrieving saved locations:", error);
      throw error;
    }
  };
  
  module.exports = {
    getSavedLocations,
    saveLocation
  }