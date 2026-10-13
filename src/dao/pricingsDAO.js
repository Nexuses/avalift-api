const ddbDocClient = require("./ddbClient.js");
const {
  PutCommand,
  QueryCommand,
  UpdateCommand,
  GetCommand,
  ScanCommand
} = require("@aws-sdk/lib-dynamodb");
const { addServerLog } = require("../services/serverLogsService"); // Update path if needed

/**
 * Fetches active pricings for a given organization and currency within a date range.
 * @param {number} organization_id
 * @param {string} currency
 * @param {string} effective_from
 * @param {string} effective_to
 * @returns {Promise<Array>} An array of matching pricing records.
 */
const getActivePricingsInRange = async (
  organization_id,
  currency,
  effective_from,
  effective_to
) => {
  const params = {
    TableName: "Pricings",
    KeyConditionExpression:
      "organization_id = :orgId AND begins_with(#pricing_id, :currency)",
    FilterExpression:
      "is_active = :active AND effective_from <= :end AND (attribute_not_exists(effective_to) OR effective_to >= :start)",
    ExpressionAttributeNames: {
      "#pricing_id": "pricing_id",
    },
    ExpressionAttributeValues: {
      ":orgId": String(organization_id),
      ":currency": String(currency),
      ":active": true,
      ":start": new Date(effective_from).toISOString(),
      ":end": new Date(effective_to).toISOString(),
    },
  };

  try {
    const { Items } = await ddbDocClient.send(new QueryCommand(params));
    return Items;
  } catch (error) {
    console.error("Error in getActivePricingsInRange:", error);
    await addServerLog({
      log_level: "ERROR",
      service_name: "getActivePricingsInRange",
      error_message: `getActivePricingsInRange DAO error - ${error.message}.`
    });
    throw error;
  }
};

/**
 * Deactivates a pricing record by setting `is_active` to false.
 * @param {number} organization_id
 * @param {string} pricing_id
 */
const deactivatePricing = async (organization_id, pricing_id) => {
  try {
    await ddbDocClient.send(
      new UpdateCommand({
        TableName: "Pricings",
        Key: {
          organization_id: String(organization_id),
          pricing_id: String(pricing_id),
        },
        UpdateExpression: "SET is_active = :inactive",
        ConditionExpression: "attribute_exists(pricing_id)",
        ExpressionAttributeValues: {
          ":inactive": false
        },
      })
    );
  } catch (error) {
    console.error("Error in deactivatePricing:", error);
    await addServerLog({
      log_level: "ERROR",
      service_name: "deactivatePricing",
      error_message: `deactivatePricing DAO error - ${error.message}.`
    });
    throw error;
  }
};

/**
 * Fetches a pricing record by org ID and pricing ID.
 * @param {number} organization_id
 * @param {string} pricing_id
 * @returns {Promise<object|null>}
 */
const getPricingById = async (organization_id, pricing_id) => {
  try {
    const result = await ddbDocClient.send(
      new GetCommand({
        TableName: "Pricings",
        Key: {
          organization_id: String(organization_id),
          pricing_id: String(pricing_id),
        },
      })
    );
    return result.Item || null;
  } catch (error) {
    console.error("Error in getPricingById:", error);
    await addServerLog({
      log_level: "ERROR",
      service_name: "getPricingById",
      error_message: `getPricingById DAO error - ${error.message}.`
    });
    throw error;
  }
};

/**
 * Inserts a new pricing record (conditionally if pricing_id doesn’t exist).
 * @param {object} pricingItem
 * @returns {Promise<void>}
 */
const insertPricing = async (pricingItem) => {
  const newItem = {
    ...pricingItem,
    organization_id: String(pricingItem.organization_id),
    pricing_id: String(pricingItem.pricing_id),
    effective_from: new Date(pricingItem.effective_from).toISOString(),
    effective_to: pricingItem.effective_to
      ? new Date(pricingItem.effective_to).toISOString()
      : null,
  };

  try {
    await ddbDocClient.send(
      new PutCommand({
        TableName: "Pricings",
        Item: newItem,
        ConditionExpression: "attribute_not_exists(pricing_id)",
      })
    );
  } catch (error) {
    console.error("Error in insertPricing:", error);
    await addServerLog({
      log_level: "ERROR",
      service_name: "insertPricing",
      error_message: `insertPricing DAO error - ${error.message}.`
    });
    throw error;
  }
};

/**
 * Updates an existing pricing record with provided fields.
 * @param {number} organization_id
 * @param {string} pricing_id
 * @param {object} updateData - Key/value pairs to update
 * @returns {Promise<void>}
 */
const updatePricing = async (organization_id, pricing_id, updateData) => {
  const fieldsToIgnore = ["organization_id", "pricing_id"];
  const updateExpressions = [];
  const expressionAttributeNames = {};
  const expressionAttributeValues = {};

  for (const [field, value] of Object.entries(updateData)) {
    if (!fieldsToIgnore.includes(field)) {
      const placeholder = `#${field}`;
      const valueRef = `:${field}`;

      if (field === "effective_from" || field === "effective_to") {
        expressionAttributeValues[valueRef] = new Date(value).toISOString();
      } else {
        expressionAttributeValues[valueRef] = value;
      }

      updateExpressions.push(`${placeholder} = ${valueRef}`);
      expressionAttributeNames[placeholder] = field;
    }
  }

  if (updateExpressions.length === 0) return;

  const UpdateExpression = "SET " + updateExpressions.join(", ");

  try {
    await ddbDocClient.send(
      new UpdateCommand({
        TableName: "Pricings",
        Key: {
          organization_id: String(organization_id),
          pricing_id: String(pricing_id),
        },
        UpdateExpression,
        ExpressionAttributeNames: expressionAttributeNames,
        ExpressionAttributeValues: expressionAttributeValues,
      })
    );
  } catch (error) {
    console.error("Error in updatePricing:", error);
    await addServerLog({
      log_level: "ERROR",
      service_name: "updatePricing",
      error_message: `updatePricing DAO error - ${error.message}.`
    });
    throw error;
  }
};

/**
 * Gets pricing for a given org & currency that is active for the current date.
 * @param {number} organization_id
 * @param {string} currency
 * @returns {Promise<Array>} matching pricing items
 */
const getPricingForOrg = async (organization_id, currency) => {
  const currentDate = new Date().toISOString();
  const params = {
    TableName: "Pricings",
    KeyConditionExpression:
      "organization_id = :orgId AND begins_with(#pricing_id, :currency)",
    FilterExpression:
      "effective_from <= :currentDate AND (attribute_not_exists(effective_to) OR effective_to >= :currentDate) AND is_active = :active",
    ExpressionAttributeNames: {
      "#pricing_id": "pricing_id",
    },
    ExpressionAttributeValues: {
      ":orgId": String(organization_id),
      ":currency": String(currency),
      ":currentDate": currentDate,
      ":active": true,
    },
  };

  try {
    const result = await ddbDocClient.send(new QueryCommand(params));
    return result.Items;
  } catch (error) {
    console.error("Error in getPricingForOrg:", error);
    await addServerLog({
      log_level: "ERROR",
      service_name: "getPricingForOrg",
      error_message: `getPricingForOrg DAO error - ${error.message}.`
    });
    throw error;
  }
};

const fetchFares = async () => {
  const queryParams = {
    TableName: "Pricings",
  };

  try {
    const data = await ddbDocClient.send(new ScanCommand(queryParams));
    return data.Items;
  } catch (error) {
    console.error("Error in fetchFares:", error);
    await addServerLog({
      log_level: "ERROR",
      service_name: "fetchFares",
      error_message: `fetchFares DAO error - ${error.message}.`
    });
    throw error;
  }
};

module.exports = {
  getActivePricingsInRange,
  deactivatePricing,
  getPricingById,
  insertPricing,
  updatePricing,
  getPricingForOrg,
  fetchFares
};
