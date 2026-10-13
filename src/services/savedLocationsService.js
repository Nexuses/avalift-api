// src/services/savedLocationService.js

const savedLocationDAO = require('../dao/savedLocationsDAO');
const { addServerLog } = require('./serverLogsService');

module.exports = {
  // Save location data into DynamoDB
  saveLocation: async (user_id, location_data) => {
    try {
      // Call DAO to save the location in DynamoDB
      await savedLocationDAO.saveLocation(user_id, location_data);
    } catch (error) {
      console.error('Error in saving location in service:', error);
      await addServerLog({
        log_level: "ERROR",
        service_name: "saveLocation",
        error_message: `saveLocation service error - ${error.message}.`
      });
      throw new Error('Error saving location');
    }
  },
};
