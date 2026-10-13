const roleService = require("../services/roleService");
const { addServerLog } = require("../services/serverLogsService"); // Update path if needed

module.exports = {
  getPermissionForRoleId: async (req, res) => {
    try {
      // Create the user with the specified role
      const result = await roleService.getPermissionsForRoles(req.body.roleIds);

      res.status(201).json({
        success: true,
        status: 200,
        message: "Permissions fetched successfully.",
        access: result,
      });
    } catch (error) {
      console.error("Error fetching permissions:", error);
      await addServerLog({
        log_level: "ERROR",
        service_name: "getPermissionForRoleId",
        error_message: `getPermissionForRoleId Controller error - ${error.message}.`
      });
      res.status(error.statusCode || 400).json({
        success: false,
        status: error.statusCode || 400,
        error: error.message,
      });
    }
  },
};
