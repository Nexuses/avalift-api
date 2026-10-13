const ddbDocClient = require("../dao/ddbClient");
const { PutCommand,QueryCommand, UpdateCommand } = require("@aws-sdk/lib-dynamodb");
const { addServerLog } = require("../services/serverLogsService"); 

/**
 * Save an audit record to DynamoDB.
 * @param {object} auditRecord - The audit record to store.
 */
exports.saveAudit = async (auditRecord) => {
  const params = {
    TableName: "VehicleAudit",
    Item: auditRecord,
  };

  try {
    await ddbDocClient.send(new PutCommand(params));
  } catch (error) {
    console.error("Error saving audit record:", error);
    await addServerLog({
      log_level: "ERROR",
      service_name: "saveAudit",
      error_message: `saveAudit DAO error - ${error.message}.`
    });
    throw error;
  }
};

/**
 * Retrieve audit records by ride_id.
 * @param {string} ride_id - The ride ID to query by.
 * @returns {Array} - An array of audit records.
 */
exports.getAuditByRideId = async (ride_id) => {
  const params = {
    TableName: "VehicleAudit",
    KeyConditionExpression: "ride_id = :ride_id",
    ExpressionAttributeValues: {
      ":ride_id": ride_id,
    },
  };

  try {
    const data = await ddbDocClient.send(new QueryCommand(params));
    return data.Items || [];
  } catch (error) {
    console.error("Error fetching audit records:", error);
    await addServerLog({
      log_level: "ERROR",
      service_name: "getAuditByRideId",
      error_message: `getAuditByRideId DAO error - ${error.message}.`
    })
    throw error;
  }
};

exports.updateAuditTable = async (ride_id, pdfPath) => {
  const params = {
    TableName: 'VehicleAudit',
    Key: {
      ride_id: ride_id
    },
    UpdateExpression: 'SET report_url = :report_url',
    ExpressionAttributeValues: {
      ':report_url': pdfPath
    },
    ReturnValues: 'UPDATED_NEW'
  };

  try {
    const result = await ddbDocClient.send(new UpdateCommand(params));
    console.log('Successfully updated audit table:', result);
    return result;
  } catch (error) {
    console.error('Error updating audit table:', error);
    await addServerLog({
      log_level: "ERROR",
      service_name: "updateAuditTable",
      error_message: `updateAuditTable DAO error - ${error.message}.`
    })
    throw error;
  }
};
