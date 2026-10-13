const appLogService = require("../services/appLogService");
const { addServerLog } = require("../services/serverLogsService");



module.exports = {
createAppLogs: async (req, res) => {
    try {

        const user_id = req.user.id;
        
      const response = await appLogService.createAppLogs(user_id, req.body);
      res.status(201).json({
        success: true,
        status: 201,
        message: "App logs created successfully",
        //data: response
    });
    } catch (error) {
      console.error("Error creating app logs:", error.message);
      await addServerLog({
        log_level: "ERROR",
        service_name: "createAppLogs",
        error_message: `createAppLogs Controller error - ${error.message}.`
      });
      res.status(error.statusCode || 400).json({
        success: false,
        status: error.statusCode || 400,
        message: "Failed to create app logs.",
        error: error.message,
      });
    }
  },
}