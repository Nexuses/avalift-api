const { Policy } = require('../dto');
const { addServerLog } = require("../services/serverLogsService"); // Update the path as needed

module.exports = {
  findOne: async ({ name }) => {
    try {
      return await Policy.findOne({ where: { name } });
    } catch (error) {
      await addServerLog({
        log_level: "ERROR",
        service_name: "findOne",
        error_message: `findOne DAO error - ${error.message}.`
      });
      throw error;
    }
  },
  createPolicy: async ({ name, permissions }) => {
    try {
      return await Policy.create({ name, permissions });
    } catch (error) {
      await addServerLog({
        log_level: "ERROR",
        service_name: "createPolicy",
        error_message: `createPolicy DAO error - ${error.message}.`
      });
      throw error;
    }
  }
};
