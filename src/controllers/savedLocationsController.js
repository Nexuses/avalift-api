const savedLocationService = require('../services/savedLocationsService');
const { addServerLog } = require("../services/serverLogsService"); // Update path if needed

module.exports = {
  // Save location in DynamoDB
  saveLocation: async (req, res) => {
    try {
      const user_id = req.user.id;
      const location_data = req.body;

      console.log("user_id:", user_id);

      // Validate input data
      if (!location_data) {
        return res.status(400).json({
          success: false,
          status: 400,
          message: 'Missing required fields (location_data)',
        });
      }

      // Call the service to save the location in DynamoDB
      await savedLocationService.saveLocation(user_id, location_data);

      return res.status(201).json({
        success: true,
        status: 201,
        message: 'Location saved successfully',
      });
    } catch (error) {
      console.error('Error saving location:', error);
      await addServerLog({
        log_level: "ERROR",
        service_name: "saveLocation",
        error_message: `saveLocation Controller error - ${error.message}.`
      });
      return res.status(500).json({
        success: false,
        status: 500,
        message: 'Error saving location',
        error: error.message,
      });
    }
  },
};
