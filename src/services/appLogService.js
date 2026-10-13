const appLogDAO = require('../dao/appLogDAO');
const { addServerLog } = require("../services/serverLogsService");

const createAppLogs = async (customer_id, data) => {
  const { module, error_log } = data;

  try {
    return await appLogDAO.upsertAppLog(customer_id, module, error_log);
  } catch (error) {
    await addServerLog({
      log_level: "ERROR",
      service_name: "AppLogsService",
      endpoint: "createAppLogs",
      status_code: 500,
      error_message: error.message,
      metadata: { customer_id, module },
    });
    throw error;
  }
};

module.exports = {
  createAppLogs,
};
