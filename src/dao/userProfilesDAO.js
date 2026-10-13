// userProfileDAO.js
const ddbDocClient = require('./ddbClient');
const { PutCommand, GetCommand, UpdateCommand, DeleteCommand,ScanCommand,QueryCommand  } = require("@aws-sdk/lib-dynamodb");
const { S3Client, PutObjectCommand,DeleteObjectCommand } = require('@aws-sdk/client-s3');
const {addServerLog} = require('../services/serverLogsService');
require('dotenv').config();

/**
 * Create a new user profile.
 * @param {string} userId - Unique identifier for the user.
 * @param {object} documents - Documents map, e.g., { license: 's3://...' }
 * @param {object} images
 */
const createUserProfile = async (userId, documents, images) => {
  console.log("Creating user profile", userId);
  console.log("with documents", documents);
  const params = {
    TableName: "UserProfiles",
    Item: {
      user_id:String(userId),
      documents,
      images,
    },
    
  };

  try {
    const command = new PutCommand(params);
    await ddbDocClient.send(command);
    console.log(`User profile created for userId: ${userId}`);
  } catch (error) {
    await addServerLog({
      log_level: "ERROR",
      service_name: "createUserProfile",
      error_message: `createUserProfile DAO error - ${error.message}.`
    });
    console.error("Error creating user profile:", error);
    throw error;
  }
};

/**
 * Retrieve a user profile by userId.
 * @param {string} userId 
 * @returns {object} User profile
 */
const getUserProfile = async (userId) => {
    const params = {
      TableName: "UserProfiles",
      Key: { user_id: String(userId) },
    };
  
    try {
      const command = new GetCommand(params);
      const response = await ddbDocClient.send(command);
      //return response.Item;
      const profile = response.Item || {}; // Ensure profile is an object

        // Ensure documents is always an array
        profile.documents = Array.isArray(profile.documents) ? profile.documents : [];

        return profile;
    } catch (error) {
      await addServerLog({
        log_level: "ERROR",
        service_name: "getUserProfile",
        error_message: `getUserProfile DAO error - ${error.message}.`
      })
      console.error("Error retrieving user profile:", error);
      throw error;
    }
  };

  /**
 * Check if emirates_id or licence_number already exist in DynamoDB for another user.
 * @param {string} userId 
 * @param {string} emiratesId 
 * @param {string} licenceNumber 
 * @returns {boolean} - Returns `true` if either value exists for a different user.
 */
const checkUniqueFields = async (userId, emiratesId, licenceNumber) => {
  const params = {
    TableName: "UserProfiles",
    FilterExpression: "(#eid = :eid OR #licence = :licence) AND #userId <> :userId",
    ExpressionAttributeNames: {
      "#eid": "emirates_id",
      "#licence": "licence_number",
      "#userId": "user_id",
    },
    ExpressionAttributeValues: {
      ":eid": emiratesId || "N/A", // Use dummy value if not provided
      ":licence": licenceNumber || "N/A",
      ":userId": String(userId),
    },
  };

  try {
    console.log("Checking uniqueness in UserProfiles:", params);
    const result = await ddbDocClient.send(new ScanCommand(params));

    if (result.Items.length > 0) {
      let conflictFields = [];
      if (result.Items.some(item => item.emirates_id === emiratesId)) {
        conflictFields.push("emirates_id");
       
      }
      if (result.Items.some(item => item.licence_number === licenceNumber)) {
        conflictFields.push("licence_number");
      }

      throw new Error(`The following fields must be unique and are already in use: ${conflictFields.join(", ")}`);
    }
  } catch (error) {
    await addServerLog({
      log_level: "ERROR",
      service_name: "checkUniqueFields",
      error_message: `checkUniqueFields DAO error - ${error.message}.`
    });
    console.error("Error checking unique fields in DynamoDB:", error.message);
    error.statusCode = error.statusCode || 400; 
    throw error;
  }
};


/**
 * Update user profile in DynamoDB.
 * @param {string} userId 
 * @param {object} profileData - Fields to update {emirates_id, emiratesId_validity, licence_number, licence_validity}
 * @param {array} documents - Array of document objects [{ name, path }]
 */
const updateUserProfile = async (userId, profileData) => {
  console.log("Updating user profile:", userId, profileData);

  if (!userId) {
    throw new Error("Missing or invalid 'user_id' for Update operation.");
  }

  // Extract profile fields
  const { emirates_id, emiratesId_validity, licence_number, licence_validity, documents } = profileData;

  // **Check for uniqueness before updating**
  await checkUniqueFields(userId, emirates_id, licence_number);

  // Build update expressions dynamically
  let updateExpressionParts = [];
  let expressionAttributeValues = {};
  let expressionAttributeNames = {};

  if (emirates_id !== undefined) {
    updateExpressionParts.push("#eid = :eid");
    expressionAttributeValues[":eid"] = emirates_id;
    expressionAttributeNames["#eid"] = "emirates_id";
  }

  if (emiratesId_validity !== undefined) {
    updateExpressionParts.push("#eid_validity = :eid_validity");
    expressionAttributeValues[":eid_validity"] = emiratesId_validity;
    expressionAttributeNames["#eid_validity"] = "emirates_id_validity";
  }

  if (licence_number !== undefined) {
    updateExpressionParts.push("#licence = :licence");
    expressionAttributeValues[":licence"] = licence_number;
    expressionAttributeNames["#licence"] = "licence_number";
  }

  if (licence_validity !== undefined) {
    updateExpressionParts.push("#licence_validity = :licence_validity");
    expressionAttributeValues[":licence_validity"] = licence_validity;
    expressionAttributeNames["#licence_validity"] = "licence_validity";
  }

  if (Array.isArray(documents) && documents.length > 0) {
    updateExpressionParts.push("#docs = :docs");
    expressionAttributeValues[":docs"] = documents;
    expressionAttributeNames["#docs"] = "documents";
  }

  if (updateExpressionParts.length === 0) {
    console.log("No updates provided, skipping update.");
    return { message: "No updates provided." };
  }

  const updateExpression = "SET " + updateExpressionParts.join(", ");


  const params = {
    TableName: "UserProfiles",
    Key: { user_id: String(userId) },
    UpdateExpression: updateExpression,
    ExpressionAttributeValues: expressionAttributeValues,
    ExpressionAttributeNames: expressionAttributeNames,
    ReturnValues: "UPDATED_NEW",
  };

  try {
    console.log("Updating user profile with parameters:", params);
    const command = new UpdateCommand(params);
    const response = await ddbDocClient.send(command);

    console.log(`User profile updated successfully for userId: ${userId}`);
    console.log("responce from doa", response);
    return response.Attributes;
  } catch (error) {
    await addServerLog({
      log_level: "ERROR",
      service_name: "updateUserProfile",
      error_message: `updateUserProfile DAO error - ${error.message}.`
    });
    console.error("Error updating user profile in DynamoDB:", error);
    throw error;
  }
};

/**
 * Create a new user profile after checking for unique fields.
 * @param {string} userId 
 * @param {array} documents - Array of document objects [{ name, path }]
 * @param {string} emiratesId
 * @param {string} emiratesIdValidity
 * @param {string} licenceNumber
 * @param {string} licenceValidity
 * @returns {object} - Created user profile.
 */
const createUserProfiles = async (userId, documents, emiratesId, emiratesIdValidity, licenceNumber, licenceValidity) => {
  console.log("Creating user profile:", userId);
  console.log("Documents:", documents);
  console.log("Emirates ID:", emiratesId);
  console.log("Emirates ID Validity:", emiratesIdValidity);
  console.log("Licence Number:", licenceNumber);
  console.log("Licence Validity:", licenceValidity);

  if (!userId) {
    throw new Error("Missing or invalid 'user_id' for Create operation.");
  }

  // **Check for uniqueness before creating**
  //await checkUniqueFields(userId, emiratesId, licenceNumber);

  // Ensure `documents` is an array, or set to an empty array if not provided
  documents = Array.isArray(documents) ? documents : [];

  // Prepare the item to insert
  const newUserProfile = {
    user_id: String(userId),
    documents,
    emirates_id: emiratesId || null,
    emirates_id_validity: emiratesIdValidity || null,
    licence_number: licenceNumber || null,
    licence_validity: licenceValidity || null,
    created_at: new Date().toISOString(),
  };

  const params = {
    TableName: "UserProfiles",
    Item: newUserProfile,
  }

  try {
    console.log("Creating new user profile with parameters:", params);

    const command = new PutCommand(params);
    await ddbDocClient.send(command);

    console.log(`User profile created successfully for userId: ${userId}`);
    return newUserProfile;
  } catch (error) {
    await addServerLog({
      log_level: "ERROR",
      service_name: "createUserProfiles",
      error_message: `createUserProfiles DAO error - ${error.message}.`
    })
    console.error("Error creating user profile in DynamoDB:", error);
    throw error;
  }
};
  



// Create S3 client
const s3Client = new S3Client({
  region: process.env.AWS_REGION, 
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const BUCKET_NAME = process.env.S3_BUCKET;

//Upload file to S3

const uploadFileToS3 = async (fileBuffer, fileName, mimeType, folderName = "profile-images") => {
  const key = `${folderName}/${Date.now()}-${fileName}`;

  //const BUCKET_NAME = process.env.AWS_BUCKET_NAME;
  if (!BUCKET_NAME) {
    console.error("BUCKET_NAME is missing! Check environment variables.");
    throw new Error("S3 Bucket name is not configured.");
  }

  const params = {
    Bucket: BUCKET_NAME,
    Key: key,
    Body: fileBuffer,
    ContentType: mimeType,
  };

 
  console.log("bucketname:",BUCKET_NAME);

  try {
    const command = new PutObjectCommand(params);
    await s3Client.send(command);

    console.log("S3 upload success:", key);
    return key;
  } catch (error) {
    await addServerLog({
      log_level: "ERROR",
      service_name: "uploadFileToS3",
      error_message: `uploadFileToS3 DAO error - ${error.message}.`
    });
    console.error("S3 upload error:", error);
    throw new Error("Failed to upload file to S3.");
  }
};


/**
 * Update user profile with image key in DynamoDB
 */
const updateUserProfileWithImage = async (userId, s3Key) => {
  const createdAt = new Date().toISOString();

  const params = {
    TableName: "UserProfiles",
    Key: { user_id: String(userId) },
    UpdateExpression: 'SET #images = :newImage ,#createdAt = :createdAt',
    ExpressionAttributeNames: {
      '#images': 'images',
      '#createdAt': 'created_at'
    },
    ExpressionAttributeValues: {
      ':newImage': s3Key,
      ':createdAt': createdAt,
    },
    ReturnValues: 'UPDATED_NEW',
  };

  try {
    const command = new UpdateCommand(params);
    const response = await ddbDocClient.send(command);

    console.log("DynamoDB update success:", response);
    return response;
  } catch (error) {
    await addServerLog({
      log_level: "ERROR",
      service_name: "updateUserProfileWithImage",
      error_message: `updateUserProfileWithImage DAO error - ${error.message}.`
    });
    console.error("DynamoDB update error:", error);
    throw new Error("Failed to update user profile with image.");
  }
};

const clearUserProfileImage = async (userId) => {
  const params = {
    TableName: "UserProfiles",
    Key: { user_id: String(userId) },
    UpdateExpression: "REMOVE #images",
    ExpressionAttributeNames: {
      "#images": "images",
    },
    ReturnValues: "UPDATED_NEW",
  };

  try {
    const command = new UpdateCommand(params);
    const response = await ddbDocClient.send(command);

    console.log("Profile image cleared in DynamoDB:", response);
    return response;
  } catch (error) {
    await addServerLog({
      log_level: "ERROR",
      service_name: "clearUserProfileImage",
      error_message: `clearUserProfileImage DAO error - ${error.message}.`,
    });
    console.error("DynamoDB update error (clearUserProfileImage):", error);
    throw new Error("Failed to clear profile image.");
  }
};

const deleteFileFromS3 = async (key) => {
  const params = {
    Bucket: BUCKET_NAME,
    Key: key,
  };

  try {
    const command = new DeleteObjectCommand(params);
    await s3Client.send(command);

    console.log("S3 delete success:", key);
  } catch (error) {
    await addServerLog({
      log_level: "ERROR",
      service_name: "deleteFileFromS3",
      error_message: `deleteFileFromS3 DAO error - ${error.message}.`,
    });
    console.error("S3 delete error:", error);
    throw new Error("Failed to delete file from S3.");
  }
};

  /**
 * Delete a user profile by userId.
 * @param {string} userId 
 */
const deleteUserProfile = async (userId) => {
    const params = {
      TableName: "UserProfiles",
      Key: { user_id: userId },
    };
  
    try {
      const command = new DeleteCommand(params);
      await ddbDocClient.send(command);
      console.log(`User profile deleted for userId: ${userId}`);
    } catch (error) {
      await addServerLog({
        log_level: "ERROR",
        service_name: "deleteUserProfile",
        error_message: `deleteUserProfile DAO error - ${error.message}.`
      });
      console.error("Error deleting user profile:", error);
      throw error;
    }
  };

module.exports ={
  createUserProfile,
  getUserProfile,
  updateUserProfile,
  deleteUserProfile,
  checkUniqueFields,
  createUserProfiles,
  updateUserProfileWithImage,
  uploadFileToS3,
  clearUserProfileImage ,
  deleteFileFromS3

}