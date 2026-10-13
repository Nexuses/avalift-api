const UserStatusService = require("../services/usersStatusService");
const { logUserStatusChange } = require("../dao/usersStatusDAO");
const { addServerLog } = require("../services/serverLogsService"); // Update path if needed

// updating the status of pd and chauffeur
const updateStatus = async (req, res) => {
  try {
    const userId = req.user.id;
    const { status_name } = req.body; // Destructure status_name from the request body

    console.log("userId", userId);

    if (!status_name) {
      return res.status(400).json({
        success: false,
        status: 400,
        message: "Status_name is required"
      });
    }

    await UserStatusService.updateUserStatus(userId, status_name);

    const logEntry = await logUserStatusChange(userId, status_name);
    console.log("Logged status change:", logEntry);
    return res.status(200).json({
      success: true,
      status: 200,
      message: "Status updated successfully"
    });
  } catch (error) {
    console.error("Error in updateStatus controller:", error);
    await addServerLog({
      log_level: "ERROR",
      service_name: "updateStatus",
      error_message: `updateStatus Controller error - ${error.message}.`
    });
    return res.status(400).json({
      success: false,
      status: 400,
      message: error.message
    });
  }
};

// Controller function to handle creating a new status
const createStatus = async (req, res) => {
  try {
    const { name } = req.body; // Extract the name from the request body
    if (!name) {
      return res.status(400).json({
        success: false,
        status: 400,
        message: "Status name is required"
      });
    }

    const newStatus = await UserStatusService.createStatus({ name }); // Call service to create status

    return res.status(201).json({
      success: true,
      status: 201,
      message: "Status created successfully",
      data: newStatus,
    });
  } catch (error) {
    console.error("Error in createStatus controller:", error);
    await addServerLog({
      log_level: "ERROR",
      service_name: "createStatus",
      error_message: `createStatus Controller error - ${error.message}.`
    });
    return res.status(500).json({
      success: false,
      status: 500,
      message: error.message
    });
  }
};

module.exports = {
  createStatus,
  updateStatus
};
