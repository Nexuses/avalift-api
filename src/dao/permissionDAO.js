const { Permission } = require('../dto');
const { addServerLog } = require("../services/serverLogsService"); // Update the path as needed

module.exports = {
  findOne: async ({ name, value }) => {
    try {
      return await Permission.findOne({ where: { name, value } });
    } catch (error) {
      await addServerLog({
        log_level: "ERROR",
        service_name: "findOne",
        error_message: `findOne DAO error - ${error.message}.`
      });
      throw error;
    }
  },

  findByName: async (name) => {
    try {
      return await Permission.findOne({ where: { name } });
    } catch (error) {
      await addServerLog({
        log_level: "ERROR",
        service_name: "findOne",
        error_message: `findOne DAO error - ${error.message}.`
      });
      throw error;
    }
  },

  create: async ({ name, value }) => {
    try {
      const [permission, created] = await Permission.findOrCreate({
        where: { name, value },
        defaults: { name, value }
      });
      return permission;
    } catch (error) {
      await addServerLog({
        log_level: "ERROR",
        service_name: "create",
        error_message: `create DAO error - ${error.message}.`
      });
      throw error;
    }
  }
};
