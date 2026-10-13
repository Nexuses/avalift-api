// serverLogsService.js

const Joi = require("joi");
const serverLogsDao = require("../dao/serverLogsDAO");

/**
 * Joi schema for validating a server log entry.
 * - log_level and error_message are required.
 * - All other fields are optional.
 */
const logSchema = Joi.object({
  log_level: Joi.string().required(),
  service_name: Joi.string().optional(),
  endpoint: Joi.string().optional(),
  status_code: Joi.number().optional(),
  error_message: Joi.string().required(),
  metadata: Joi.object().optional()
});

/**
 * Add a new server log entry after validating the input.
 * The current datetime will be generated inside the DAO.
 * 
 * @param {object} logData - Object containing the log data:
 *    - log_level (required): Log level (e.g., "ERROR", "INFO", "WARN").
 *    - service_name (optional): Name of the service.
 *    - endpoint (optional): API endpoint or source function.
 *    - status_code (optional): HTTP status code.
 *    - error_message (required): The error message.
 *    - metadata (optional): Any additional metadata.
 * @returns {Promise<void>}
 */
exports.addServerLog = async (logData) => {
  // Validate logData against the Joi schema
  const { error, value } = logSchema.validate(logData, { abortEarly: false });
  if (error) {
    const errorMessage = error.details.map((d) => d.message).join(", ");
    throw new Error(`Validation error: ${errorMessage}`);
  }

  // Call the DAO function with the correct order:
  await serverLogsDao.upsertServerLog(
    value.log_level,
    value.service_name,     
    value.endpoint,         
    value.status_code,      
    value.error_message,    
    value.metadata          
  );
};

/**
 * Retrieve server logs by date.
 * This function calls the DAO to query the logs using the date as the partition key (in YYYYMMDD format).
 * 
 * @param {string} dateKey - The date in YYYYMMDD format (e.g., "20250308").
 * @returns {Promise<Array>} - A list of server log entries for that date.
 */
exports.getServerLogsByDate = async (dateKey) => {
  return await serverLogsDao.getServerLogsByDate(dateKey);
};
