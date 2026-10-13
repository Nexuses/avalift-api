const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient } = require("@aws-sdk/lib-dynamodb");

// Initialize DynamoDB Client
const client = new DynamoDBClient({ region: process.env.AWS_REGION });

// Create DynamoDB Document Client
const ddbDocClient = DynamoDBDocumentClient.from(client);


module.exports = ddbDocClient;
