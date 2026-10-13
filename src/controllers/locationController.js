const currentLocationService = require("../services/locationServices");
const { addServerLog } = require("../services/serverLogsService"); // Update path if needed

exports.createOrUpdateLocation = async (req, res) => {
  try {
    const user_id = req.user.id;
    const user_type = req.user.role;
    const result = await currentLocationService.createOrUpdateCurrentLocation(req.body, user_id, user_type);
    res.status(201).json({
      success: true,
      status: 201,
      message: "Location created/updated successfully.",
      // data: result,
    });
  } catch (error) {
    console.error("Error in createOrUpdateLocation:", error);
    await addServerLog({
      log_level: "ERROR",
      service_name: "createOrUpdateLocation",
      error_message: `createOrUpdateLocation Controller error - ${error.message}.`
    });
    res.status(error.statusCode || 500).json({
      success: false,
      status: error.statusCode || 500,
      message: error.message,
    });
  }
};

exports.getCurrentLocation = async (req, res) => {
  try {
    const result = await currentLocationService.getCurrentLocation(req.body);
    res.status(200).json({
      success: true,
      status: 200,
      message: "Location retrieved successfully.",
      data: result,
    });
  } catch (error) {
    console.error("Error in getCurrentLocation:", error);
    await addServerLog({
      log_level: "ERROR",
      service_name: "getCurrentLocation",
      error_message: `getCurrentLocation Controller error - ${error.message}.`
    });
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message,
    });
  }
};

exports.findNearbyUsers = async (req, res) => {
  try {
    const result = await currentLocationService.getAllChauffeursWithDetails(req.body);
    res.status(200).json({
      success: true,
      status: 200,
      message: "Nearby users retrieved successfully.",
      data: result,
    });
  } catch (error) {
    console.error("Error in findNearbyUsers:", error);
    await addServerLog({
      log_level: "ERROR",
      service_name: "findNearbyUsers",
      error_message: `findNearbyUsers Controller error - ${error.message}.`
    });
    res.status(error.statusCode || 500).json({
      success: false,
      status: error.statusCode || 500,
      message: error.message,
    });
  }
};
