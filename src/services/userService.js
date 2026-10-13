// src/services/userService.js
const UserDAO = require("../dao/userDAO");
const { updateUserProfile } = require("../dao/userProfilesDAO");
const UserValidator = require("../validators/userValidator");
const hashPassword = require("../helpers/hashPassword");
const adminValidator = require("../validators/adminValidator");
const UserProfileDAO = require("../dao/userProfilesDAO");
const path = require("path");
const fs = require("fs");
const userDAO = require("../dao/userDAO");
const searchHelper = require("../helpers/searchHelper");
const paymentsDAO = require("../dao/paymentsDAO");
const ridesDAO = require("../dao/ridesDAO");
const roleDAO = require("../dao/roleDAO");
const { addServerLog } = require("./serverLogsService");
const { createAdminUserRequestSchema, updateAdminUserRequestSchema } = require("../validators/adminValidator");
const bcrypt = require('bcryptjs');
const chauffeurRidesDAO = require('../dao/chauffeurRidesDAO');
const { getPermissionsForRoles } = require("../services/roleService");

const {uploadFileStreamToS3} = require('../utils/s3Uploader');
require("dotenv").config();
const s3 = require('../config/s3Client');
const chauffeurTipWalletDAO = require("../dao/chauffeurTipWalletDAO");
const erpDAO = require("../dao/erpDAO");




const createUser = async (userData) => {
  const validatedData = UserValidator.validateUserCreation(userData);

  // Hash password
  validatedData.password = await hashPassword(validatedData.password);

  // Check for existing email
  const existingUser = await UserDAO.getUserByEmail(validatedData.email_id);
  if (existingUser) {
    const error = new Error("Email already in use");
    error.statusCode = 409;
    throw error;
  }

  // Create user
  return await UserDAO.createUser(validatedData);
};

// const getUser = async (id) => {
//   const user = await UserDAO.getUserById(id);
//   if (!user) {
//     const error = new Error('User not found');
//     error.statusCode = 404;
//     throw error;
//   }
//   return user;
// };

const updateUser = async (id, updateData) => {
  const validatedData = UserValidator.validateUserUpdate(updateData);

  // If password is being updated, hash it
  if (validatedData.password) {
    validatedData.password = await hashPassword(validatedData.password);
  }

  // Update user
  return await UserDAO.updateUser(id, validatedData);
};

const deleteUser = async (id) => {
  try {
    const user = await userDAO.findById(id);
    if (!user) {
      const error = new Error("User not found");
      error.statusCode = 400;
      throw error;
    }
    let userRole = await roleDAO.findById(user.role_id);
    if (userRole.name !== "individual") {
      const error = new Error("Only customer accounts can be deleted.");
      error.statusCode = 400;
      throw error;
    }

    const isNegative = await userDAO.findNegativeBalanceById(id);
    if (isNegative) {
      const error = new Error(
        "Could not delete as your wallet has a negative balance."
      );
      error.statusCode = 400;
      throw error;
    }
    const onGoingRides = await ridesDAO.getActiveRidesByCustomerId(id.toString());
    if (onGoingRides.length > 0) {
      const error = new Error(
        "Could not delete as you have ongoing or upcoming rides."
      );
      error.statusCode = 400;
      throw error;
    }
    return await UserDAO.deleteUser(id);
  } catch (error) {
    console.error("Error in delete user service:", error.message);
    await addServerLog({
      log_level: "ERROR",
      service_name: "deleteUser",
      error_message: `deleteUser service error - ${error.message}.`
    });
    throw error;
  }
};


const createChauffeurOrPd = async (data, documents = [],is_salaried = null) => {
  await adminValidator.adminCreateUserValidator(data);
  const {
    mobile_number,
    email_id,
    first_name,
    country_code,
    last_name,
    role,
    emirates_id,
    emiratesId_validity,
    licence_number,
    licence_validity,
  } = data;
  //let userId;
  // if (country_code && mobile_number) {
  //   userId = {
  //     country_code,
  //     mobile_number,
  //   };
  // }
  // Validate required fields
  if (!country_code || !mobile_number) {
    throw new Error("Country code and mobile number are required.");
  }

  // Check if the user already exists
  //let existingUser = await UserDAO.findByEmailOrMobile(userId);

  // Find the role by name
  const roleRecord = await UserDAO.findRoleByName(role);
  if (!roleRecord) {
    throw new Error(`Role '${role}' does not exist.`);
  }

  const type = await UserDAO.findTypeIdByName("db");

  // Check if mobile_number already exists
  if (mobile_number) {
    const mobileExists = await UserDAO.checkMobileExist(
      country_code,
      mobile_number
    );
    if (mobileExists) {
      throw new Error(
        `Mobile number '${country_code}${mobile_number}' already exists.`
      );
    }
  }

  //  Check if email_id already exists
  if (email_id) {
    const emailExists = await UserDAO.checkEmailExist(email_id);
    if (emailExists) {
      throw new Error(`Email '${email_id}' already exists.`);
    }
  }

  // if (existingUser) {
  //   const previousRole = existingUser.role ? existingUser.role.name : "Unknown";

  //   // Check if the existing user has the 'individual' role before allowing change to 'pd' or 'chauffeur'
  //   if (previousRole !== "individual") {
  //     throw new Error(
  //       'Only users with the role "individual" can be updated to "pd" or "chauffeur".'
  //     );
  //   }

  //   // Prepare update data
  //   const updateData = { role_id: roleRecord.id };

  //   // If email_id is provided and does not exist in the table, add it
  //   if (email_id && !existingUser.email_id) {
  //     updateData.email_id = email_id;
  //   }

  //   // Update the existing user's role
  //   await UserDAO.updateUser(existingUser.id, updateData);

  //   console.log("updated data :", updateData);

  //   // If documents are provided, update the UserProfiles table
  //   if (documents.length > 0) {
  //     await UserProfileDAO.updateUserProfile(
  //       String(existingUser.id),
  //       documents,
  //       emirates_id,
  //       emiratesId_validity,
  //       licence_number,
  //       licence_validity
  //     );

  //     console.log("Updating user profile with:", {
  //       userId: String(existingUser.id),
  //       documents,
  //       emirates_id,
  //       emiratesId_validity,
  //       licence_number,
  //       licence_validity,
  //     });
  //   }
  //   // Fetch updated profile from DynamoDB
  //   const userProfile = await UserProfileDAO.getUserProfile(existingUser.id);
    
  //   return {
  //     message: `User role changed from '${previousRole}' to '${role}'.`,
  //     user: {
  //       ...existingUser.dataValues,
  //       userProfile,
  //     },
  //   };
  // } else {
    // **Check Uniqueness Before Creating a New User**
  await UserProfileDAO.checkUniqueFields(null, emirates_id, licence_number);
    // Create a new user
  const newUser = await UserDAO.createUser({
      email_id,
      mobile_number,
      country_code,
      first_name,
      last_name,
      type_id: type.id,
      role_id: roleRecord.id,
      is_salaried: role === "chauffeur" ? is_salaried === 'true' : null // save only for chauffeurs
  });

    console.log("Created new user:", newUser.dataValues);
    // create trip wallet for chauffeur
    if (newUser.role_id === 4) {
      await chauffeurTipWalletDAO.createChauffeurTipWallet(newUser.id);
    }

  const userId = String(newUser.id);

    // If documents are provided, update the UserProfiles table
  if (documents.length > 0) {
      await UserProfileDAO.createUserProfiles(
        //String(userId),
        userId,
        documents,
        emirates_id,
        emiratesId_validity,
        licence_number,
        licence_validity
      );
  }

  if(data.erp_chauffeur_code && data.erp_ac_name_cash && data.erp_ac_code_cash && data.erp_ac_code_online && data.erp_ac_name_online){
    console.log("Creating ERP Mapping Code for new user:", newUser.id);
    await erpDAO.createErpMappingCode({
      chauffeur_id: newUser.id,
      chauffeur_code: data.erp_chauffeur_code,
      chauffeur_name: `${first_name} ${last_name}`,
      ac_code_cash: data.erp_ac_code_cash,
      ac_name_cash: data.erp_ac_name_cash,
      ac_code_online: data.erp_ac_code_online,
      ac_name_online: data.erp_ac_name_online
    });
  }

  console.log("Updated profile in DynamoDB for new user:", {
      userId: userId,
      documents,
      emirates_id,
      emiratesId_validity,
      licence_number,
      licence_validity,
  });

    // Fetch updated profile from DynamoDB
  const userProfile = await UserProfileDAO.getUserProfile(userId);

    
  return {
      message: `New user with role '${role}' created successfully.`,
      user: {
        ...newUser.dataValues,
        userProfile,
      },
  };
};

const updateChauffeurOrPd = async (userId, data, documents = [],is_salaried = null) => {
  await adminValidator.adminUpdateUserValidator(data);

  try {
    const {
      email_id,
      first_name,
      last_name,
      country_code,
      mobile_number,
      emirates_id,
      emiratesId_validity,
      licence_number,
      licence_validity,
      erp_chauffeur_code,
      erp_ac_name_cash,
      erp_ac_code_cash,
      erp_ac_code_online,
      erp_ac_name_online
    } = data;

    // Find the user by ID
    let existingUser = await UserDAO.findById(userId);
    if (!existingUser) {
      throw new Error(`User with ID ${userId} not found.`);
    }

    // Prepare update data
    const updateData = {
      first_name,
      last_name,
      email_id,
      country_code,
      mobile_number,
    };


    // ✅ Add this condition
    if (is_salaried !== null && is_salaried !== undefined) {
      updateData.is_salaried = is_salaried;
    }


    // Update user details
    await UserDAO.updatePdChauffeurUser(userId, updateData);

    // Prepare update data for DynamoDB
    const profileUpdateData = {
      emirates_id,
      emiratesId_validity,
      licence_number,
      licence_validity,
    };

    // Only add documents if provided
    if (documents.length > 0) {
      profileUpdateData.documents = documents;
    }

    // Update UserProfile in DynamoDB (Even if `documents` is missing)
    const result = await UserProfileDAO.updateUserProfile(userId, profileUpdateData);
    console.log("here", result)
    // Fetch updated user details, including profile data
    const updatedUser = await UserDAO.findById(userId); // PostgreSQL
    const userProfile = await UserProfileDAO.getUserProfile(userId); // DynamoDB
    // Update or create ERP Chauffeur Code
    if(existingUser.role_id === 4){
    const erpUpsertData = {
      chauffeur_name: `${first_name} ${last_name}`,
      chauffeur_id: userId,
    };

    if (erp_chauffeur_code !== undefined)
      erpUpsertData.chauffeur_code = erp_chauffeur_code;

    if (erp_ac_code_cash !== undefined)
      erpUpsertData.ac_code_cash = erp_ac_code_cash;

    if (erp_ac_name_cash !== undefined)
      erpUpsertData.ac_name_cash = erp_ac_name_cash;

    if (erp_ac_code_online !== undefined)
      erpUpsertData.ac_code_online = erp_ac_code_online;

    if (erp_ac_name_online !== undefined)
      erpUpsertData.ac_name_online = erp_ac_name_online;

    // Only UPSERT if at least one ERP field is provided
    if (Object.keys(erpUpsertData).length > 1) {
      await erpDAO.upsertErpMappingCode(erpUpsertData);
    }
  }


    return {
      message: `User updated successfully.`,
      user: {
        id: userId,
        ...updatedUser.dataValues, // PostgreSQL data
        emiratesId: emirates_id ||userProfile.emirates_id,
        emiratesIdValidity: emiratesId_validity||userProfile.emirates_id_validity ,
        licenceNumber: licence_number ||userProfile.licence_number,
        licenceValidity: licence_validity||userProfile.licence_validity ,
        updatedAt: new Date(),
        erp_chauffeur_code: erp_chauffeur_code,
        ac_code_cash: erp_ac_code_cash,
        ac_name_cash: erp_ac_name_cash,
        ac_code_online: erp_ac_code_online,
        ac_name_online: erp_ac_name_online
      },
    };
  } catch (error) {
    console.error("Service Error in updateChauffeurOrPd:", error.message);
    await addServerLog({
      log_level: "ERROR",
      service_name: "updateChauffeurOrPd",
      error_message: `updateChauffeurOrPd service error - ${error.message}.`
    });
    throw error;
  }
};

const convertPathToBase64 = (file) => {
  try {
    if (!file || !file.path) {
      console.error("Invalid file object:", file);
      return null;
    }
    const fullPath = path.resolve(__dirname, "../", file.path);
    console.log("Resolved Path:", fullPath);

    if (!fs.existsSync(fullPath)) {
      console.error("File does not exist:", fullPath);
      return null;
    }
    const fileBuffer = fs.readFileSync(fullPath);
    return fileBuffer.toString("base64");
  } catch (error) {
    console.error("Error reading or converting file to Base64:", error);
    return null;
  }
};

const getIndividualCustomers = async (
  search_string = "",
  page = 1,
  limit = 10
) => {
  try {
    const users = await UserDAO.findAllUsersByRole("individual");
    const filteredUsers = searchHelper.searchUsers(users, search_string);
    console.log('Filtered users count:', filteredUsers.length);
    console.log('Filtered users:', JSON.stringify(filteredUsers.slice(0, 3)));
    const totalCount = filteredUsers.length;
    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;
    const paginatedUsers = filteredUsers.slice(startIndex, endIndex);
    console.log('Pagination - Start:', startIndex, 'End:', endIndex, 'Page size:', paginatedUsers.length);

    const usersWithProfiles = await Promise.all(
      paginatedUsers.map(async (user) => {
        const profile = await UserProfileDAO.getUserProfile(user.id);
        const documents =
          profile && profile.documents
            ? profile.documents.map((file) => ({
                name: file.name,
                base64: convertPathToBase64(file),
              }))
            : null;

        return {
          ...user.toJSON(),
          documents,
        };
      })
    );

    return { users: usersWithProfiles, totalCount };
  } catch (error) {
    console.error("Error in getIndividualCustomers:", error.message);
    await addServerLog({
      log_level: "ERROR",
      service_name: "getIndividualCustomers",
      error_message: `getIndividualCustomers service error - ${error.message}.`
    });
    throw error;
  }
};

const getCorporateCustomers = async () => {
  try {
    const users = await UserDAO.findAllByRole("corporate");
    const usersWithProfiles = await Promise.all(
      users.map(async (user) => {
        const profile = await UserProfileDAO.getUserProfile(user.id);
        const documents =
          profile && profile.documents
            ? profile.documents.map((file) => ({
                name: file.name,
                base64: convertPathToBase64(file),
              }))
            : null;

        return {
          ...user.toJSON(),
          documents,
        };
      })
    );

    return usersWithProfiles;
  } catch (error) {
    console.error("Error in getCorporateCustomers:", error.message);
    await addServerLog({
      log_level: "ERROR",
      service_name: "getCorporateCustomers",
      error_message: `getCorporateCustomers service error - ${error.message}.`
    });
    throw error;
  }
};

const getAllChauffeurs = async () => {
  try {
    const chauffeurs = await UserDAO.findAllByRole("chauffeur");
    const chauffeursWithProfiles = await Promise.all(
      chauffeurs.map(async (chauffeur) => {
        const profile = await UserProfileDAO.getUserProfile(chauffeur.id);
        const erp_chauffeur_code = await erpDAO.getErpMappingCode(chauffeur.id);
        return {
          ...chauffeur.toJSON(),
          emirates_id: profile.emirates_id || null,
          emiratesId_validity: profile.emirates_id_validity || null,
          licence_number: profile.licence_number || null,
          licence_validity: profile.licence_validity || null,
          documents: profile.documents || [],
          erp_chauffeur_code: erp_chauffeur_code ? erp_chauffeur_code.chauffeur_code : null,
          erp_ac_name_cash: erp_chauffeur_code ? erp_chauffeur_code.ac_name_cash : null,
          erp_ac_code_cash: erp_chauffeur_code ? erp_chauffeur_code.ac_code_cash : null,
          erp_ac_code_online: erp_chauffeur_code ? erp_chauffeur_code.ac_code_online : null,
          erp_ac_name_online: erp_chauffeur_code ? erp_chauffeur_code.ac_name_online : null,
        };
      })
    );

    return chauffeursWithProfiles;
  } catch (error) {
    console.error("Error in getAllChauffeurs:", error.message);
    await addServerLog({
      log_level: "ERROR",
      service_name: "getAllChauffeurs",
      error_message: `getAllChauffeurs service error - ${error.message}.`
    });
    throw error;
  }
};

const getAllPd = async () => {
  try {
    const pd = await UserDAO.findAllByRole("pd");

    const pdWithProfiles = await Promise.all(
      pd.map(async (user) => {
        const profile = await UserProfileDAO.getUserProfile(user.id);
        return {
          ...user.toJSON(),
          emirates_id: profile.emirates_id || null,
          emiratesId_validity: profile.emirates_id_validity || null,
          licence_number: profile.licence_number || null,
          licence_validity: profile.licence_validity || null,
          documents: profile.documents || [],
        };
      })
    );
    return pdWithProfiles;
  } catch (error) {
    console.error("Error in getAllPDs service:", error.message);
    await addServerLog({
      log_level: "ERROR",
      service_name: "getAllPd",
      error_message: `getAllPd service error - ${error.message}.`
    });
    throw error;
  }
};

const getUserProfileData = async (userId) => {
  try {
    const user = await UserDAO.findByUserId(userId);
    if (!user) {
      throw new Error("User not found.");
    }

    const userProfile = await UserProfileDAO.getUserProfile(userId);

    console.log("User profile", userProfile);

    let documents = userProfile ? userProfile.documents || [] : [];
    let images = userProfile && userProfile.images ? userProfile.images : null;
    let profileImage = null;

    console.log("images", images);

    if (!Array.isArray(documents)) {
      console.error("Documents is not an array, fixing format...");
      documents = [];
    }

    const convertedDocuments = await Promise.all(
      documents.map(async (doc) => {
        try {
          const { name, path: docPath } = doc;
          if (!docPath) throw new Error("Invalid document path");
          const fullDocPath = docPath.startsWith("src/") ? docPath : `src/${docPath}`;
          const filePath = path.resolve(process.cwd(), fullDocPath);

          console.log("Document Name:", name);
          console.log("Attempting to read file:", filePath);

          const fileBuffer = await fs.promises.readFile(filePath);
          const base64Content = fileBuffer.toString("base64");

          return {
            name: name,
            value: base64Content,
          };
        } catch (err) {
          console.error(`Error reading file ${doc.path}:`, err.message);
          return {
            name: doc.name,
            error: "Error converting file to Base64",
          };
        }
      })
    );

    if (images) {
      const BASE_S3_URL = `https://${process.env.S3_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com`;
      imageUrl = `${BASE_S3_URL}/${images}`;

      console.log("Resolved S3 profile image URL:", imageUrl);
      profileImage = imageUrl;
      console.log("Resolved profile image URL:", imageUrl);
    }

    const filteredDocuments = convertedDocuments.filter((doc) => !doc.error);

    return {
      user_id: user.id,
      first_name: user.first_name,
      last_name: user.last_name,
      email_id: user.email_id,
      country_code: user.country_code,
      mobile_number: user.mobile_number,
      images: profileImage,
      documents: filteredDocuments.length > 0 ? filteredDocuments : null,
      customer_support_number: process.env.CUSTOMER_SUPPORT_NUMBER || null,
    };
  } catch (error) {
    console.error("Error fetching user profile data:", error.message);
    await addServerLog({
      log_level: "ERROR",
      service_name: "getUserProfileData",
      error_message: `getUserProfileData service error - ${error.message}.`
    });
    throw new Error(error.message);
  }
};

const createCustomer = async (customerData) => {
  try {
    await adminValidator.customerCreateValidator(customerData);

    const existingUser = await userDAO.findByEmailOrMobile({
      mobile_number: customerData.mobile_number,
      country_code: customerData.country_code,
    });

    if (existingUser) {
      const error = new Error(
        `A user with mobile number ${customerData.mobile_number} already exists.`
      );
      error.status = 409;
      throw error;
    }

    if (customerData.email_id) {
      const emailExists = await UserDAO.checkEmailExist(customerData.email_id);
      if (emailExists) {
        const error = new Error(
          `Email '${customerData.email_id}' already exists.`
        );
        error.status = 409;
        throw error;
      }
    }

    const role = await userDAO.findRoleByName(customerData.role);
    if (!role) {
      const error = new Error(`Role '${customerData.role}' not found.`);
      error.status = 409;
      throw error;
    }

    const newCustomer = {
      first_name: customerData.first_name,
      last_name: customerData.last_name,
      email_id: customerData.email_id,
      mobile_number: customerData.mobile_number,
      role_id: role.id,
      country_code: customerData.country_code,
    };

    return await userDAO.createUser(newCustomer);
  } catch (error) {
    console.error("Error in createCustomer service:", error.message);
    await addServerLog({
      log_level: "ERROR",
      service_name: "createCustomer",
      error_message: `createCustomer service error - ${error.message}.`
    });
    throw error;
  }
};

const updateCustomer = async (userId, updatedFields) => {
  const user = await userDAO.findById(userId);
  if (!user) throw new Error("User doesn't exist");

  const updatedUser = await userDAO.updateCustomer(userId, updatedFields);
  return updatedUser;
};

const processUserProfile = async (userId, userData, profileImage) => {
  try {
    console.log("Processing User Data:", userData);
    console.log("Processing Profile Image:", profileImage);

    if (!userId) {
      throw new Error("User ID is required.");
    }

    const { first_name, last_name, email_id, documents } = userData;

    let existingUser = await UserDAO.findByUserId(userId);
    if (!existingUser) {
      console.log(`User with ID ${userId} not found.`);
      throw new Error("User not found. Cannot proceed.");
    }

    let userProfile = await UserProfileDAO.getUserProfile(userId);
    console.log("User Profile:", userProfile);
    let isNewProfile = false;

    if (!userProfile) {
      userProfile = { user_id: String(userId), documents: {} };
      await UserProfileDAO.createUserProfile(userId, userProfile.documents);
      console.log(`New profile created in DynamoDB for user ${userId}`);
      isNewProfile = true;
    }

    const updatedFields = {};
    if (first_name) updatedFields.first_name = first_name;
    if (last_name) updatedFields.last_name = last_name;
    if (email_id) updatedFields.email_id = email_id;

    if (Object.keys(updatedFields).length > 0) {
      await UserDAO.updateUser(userId, updatedFields);
      console.log(`User ${userId} updated successfully in PostgreSQL.`);
    }

    console.log("updated feild", updatedFields);
    let updatedDocuments = { ...userProfile.documents };

    if (documents) {
      updatedDocuments = { ...updatedDocuments, ...documents };
    }

    let updatedImages = { ...userProfile.images };
    if (profileImage) {
      updatedImages = { ...updatedImages, ...profileImage };
    }
    console.log("updated images", updatedImages);

    if (
      Object.keys(updatedDocuments).length > 0 ||
      Object.keys(updatedImages).length > 0
    ) {
      await UserProfileDAO.updateUserProfile(
        userId,
        updatedDocuments,
        updatedImages
      );
      console.log(
        `User profile documents updated in DynamoDB for user ${userId}`
      );
    }

    return {
      isNewProfile,
      profile: {
        user_id: userId,
        first_name: updatedFields.first_name || existingUser.first_name,
        last_name: updatedFields.last_name || existingUser.last_name,
        email_id: updatedFields.email_id || existingUser.email_id,
        documents: updatedDocuments,
        images: updatedImages,
      },
    };
  } catch (error) {
    console.error("Error processing user profile:", error.message);
    await addServerLog({
      log_level: "ERROR",
      service_name: "processUserProfile",
      error_message: `processUserProfile service error - ${error.message}.`
    });
    throw new Error(`Error processing user profile: ${error.message}`);
  }
};

const updateUserDeviceId = async (userId, device_id) => {
  if (!userId || !device_id) {
    throw new Error("userId and deviceId are required");
  }

  try {
    const updatedUser = await userDAO.updateUserDeviceId(userId, device_id);
    console.log("UpdateUser:", updatedUser);

    if (updatedUser[0] === 0) {
      throw new Error(`User with ID ${userId} not found.`);
    }

    console.log(`Device ID updated for user ID: ${userId}`);
    return updatedUser;
  } catch (error) {
    console.error("Error in updateUserDeviceId service:", error);
    await addServerLog({
      log_level: "ERROR",
      service_name: "updateUserDeviceId",
      error_message: `updateUserDeviceId service error - ${error.message}.`
    });
    throw error;
  }
};

const adminDeleteUser = async (user_id) => {
  try {
    const user = await userDAO.findById(user_id);
    if (!user) {
      throw Object.assign(new Error("User does not exist."), { status: 404 });
    }
    if(user.role_id === 5 || user.role_id === 6) {
      throw Object.assign(new Error("Cannot delete admin user."), { status: 400 });
    }

    if (user.role_id === 1) {  // Customer role
      if ((await ridesDAO.getActiveRidesForCustomer(user_id)).length) {
        throw Object.assign(new Error("Customer has an active ride."), { status: 400 });
      }
      
      if (await userDAO.findNegativeBalanceById(user_id)) {
        throw Object.assign(new Error("Could not delete as user's wallet has a negative balance."), { status: 400 });
      }
    }

    if (user.role_id === 3) {  // PD role
      if (await chauffeurRidesDAO.checkPendingRideForPD(user_id)) {
        throw Object.assign(new Error("PD has pending rides."), { status: 400 });
      }

      const pdWallet = await paymentsDAO.findPDWalletById(user_id);
      if (pdWallet?.wallet_balance > 0) {
        throw Object.assign(new Error("PD has wallet balance."), { status: 400 });
      }
    }

    if (user.role_id === 4) {  // Chauffeur role
      if ((await chauffeurRidesDAO.checkPendingRideForChauffeur(user_id)).length) {
        throw Object.assign(new Error("Chauffeur has pending rides."), { status: 400 });
      }

      if ((await ridesDAO.getActiveInstantRideForChauffeur(user_id)).length) {
        throw Object.assign(new Error("Chauffeur has an active ride."), { status: 400 });
      }

      const chauffeurWallet = await paymentsDAO.findChauffeurWalletById(user_id);
      if (chauffeurWallet?.wallet_balance > 0) {
        throw Object.assign(new Error("Chauffeur has wallet balance."), { status: 400 });
      }
    }

    return await userDAO.deleteUser(user_id);

  } catch (error) {
    console.error(`Error in deleting user: ${error.message}`);
    await addServerLog({
      log_level: "ERROR",
      service_name: "adminDeleteUser",
      error_message: `adminDeleteUser service error - ${error.message}.`
    });
    throw error;
  }
};

const getAdminUserTypes = async () => {
  try {
    const userTypes = await roleDAO.findAdminRoles();
    console.log("User Types:", userTypes);
    return userTypes;
  } catch (error) {
    console.error("Error in getAdminUserTypes service:", error.message);
    await addServerLog({
      log_level: "ERROR",
      service_name: "getAdminUserTypes",
      error_message: `getAdminUserTypes service error - ${error.message}.`
    });
    throw error;
  }
};

const createAdminUsers = async (data, role_id) => {
  try {

    if (role_id !== 5 && data.role_id === 5) {
      return {
        error: true,
        status: 403,
        message: "You are not authorized to create admin users",
      };
    }
    
    if (!data) {
      return { error: true, status: 400, message: 'No data provided for creating admin user' };
    }

    const verifiedData = await createAdminUserRequestSchema.validateAsync(data, {
      abortEarly: false,
    });

    if (!verifiedData.email_id || !verifiedData.mobile_number) {
      return { error: true, status: 422, message: 'Email and phone are required fields' };
    }

    const existingEmailUser = await userDAO.findByEmail(verifiedData.email_id);
    if (existingEmailUser) {
      return { error: true, status: 409, message: 'A user with this email already exists' };
    }

    if (verifiedData.mobile_number) {
      const existingPhoneUser = await userDAO.findByPhone(verifiedData.mobile_number);
      if (existingPhoneUser) {
        return { error: true, status: 409, message: 'A user with this phone number already exists' };
      }
    }

    const salt = await bcrypt.genSalt(10);
    verifiedData.password = await bcrypt.hash(verifiedData.password, salt);

    const userData = {
      ...verifiedData,
      is_active: true,
      status_id: 2,
      type_id: 1,
    };

    const createdUser = await userDAO.createUser(userData);
    
    if (!createdUser) {
      return { error: true, status: 500, message: 'Failed to create admin user' };
    }

    // ✅ Fetch permissions and roles using the function you provided
    const roleAccess = await getPermissionsForRoles(verifiedData.role_id);

    const { password, ...userWithoutPassword } = createdUser.dataValues;

    // Include role + permission data in response
    const result = {
      ...userWithoutPassword,
      roles: roleAccess.roles,
      permissions: roleAccess.permissions,
      allowedOrganization: roleAccess.allowedOrganization,
    };


    console.log("Created Users:",  result  );
    return { error: false, status: 201, data: result};

  } catch (error) {
    console.error('Error creating admin user:', error.message);
    await addServerLog({
      log_level: "ERROR",
      service_name: "createAdminUsers",
      error_message: `createAdminUsers service error - ${error.message}.`
    });
    if (error.name === 'ValidationError') {
      return { 
        error: true, 
        status: 400, 
        message: `Validation failed: ${error.details.map(d => d.message).join(', ')}` 
      };
    }

    return { error: true, status: 500, message: 'An unexpected error occurred' };
  }
};

const updateAdminUser = async (userId, data, role_id) => {
  try {
    if (!userId) {
      return { error: true, status: 400, message: 'User ID is required for updating admin user' };
    }

    if (!data || Object.keys(data).length === 0) {
      return { error: true, status: 400, message: 'No data provided for update' };
    }

    const existingUser = await userDAO.findById(userId);
    if (!existingUser) {
      return { error: true, status: 404, message: 'User not found' };
    }

    if (role_id !== 5 && existingUser.role_id === 5) {
      return { error: true, status: 403, message: 'You are not authorized to update admin users' };
    }

    const verifiedData = await updateAdminUserRequestSchema.validateAsync(data, {
      abortEarly: false,
    });

    const updatedFields = {};

    if (verifiedData.email_id && verifiedData.email_id !== existingUser.email_id) {
      const emailExists = await userDAO.findByEmail(verifiedData.email_id);
      if (emailExists) {
        return { error: true, status: 409, message: 'A user with this email already exists' };
      }
      updatedFields.email_id = verifiedData.email_id;
    }

    if (verifiedData.mobile_number && verifiedData.mobile_number !== existingUser.mobile_number) {
      const phoneExists = await userDAO.findByPhone(verifiedData.mobile_number);
      if (phoneExists) {
        return { error: true, status: 409, message: 'A user with this phone number already exists' };
      }
      updatedFields.mobile_number = verifiedData.mobile_number;
    }

    if (verifiedData.first_name) {
      updatedFields.first_name = verifiedData.first_name;
    }

    if (verifiedData.last_name) {
      updatedFields.last_name = verifiedData.last_name;
    }

    if (verifiedData.role_id) {
      updatedFields.role_id = verifiedData.role_id;
    }

    if (Object.keys(updatedFields).length === 0) {
      return { error: true, status: 400, message: 'No valid fields provided for update' };
    }

    const updatedUser = await userDAO.updateUser(userId, updatedFields);

    if (!updatedUser) {
      return { error: true, status: 500, message: 'Failed to update user' };
    }

    return { success: true, status: 200, message: 'User updated successfully' };

  } catch (error) {
    console.error('Error updating admin user:', error.message);
    await addServerLog({
      log_level: "ERROR",
      service_name: "updateAdminUser",
      error_message: `updateAdminUser service error - ${error.message}.`
    });
    if (error.name === 'ValidationError') {
      return { 
        error: true, 
        status: 400, 
        message: `Validation failed: ${error.details.map(d => d.message).join(', ')}` 
      };
    }

    return { error: true, status: 500, message: 'An unexpected error occurred' };
  }
};

const findAdminUserById = async (userId) => {
  try {
    if (!userId) {
      return { error: true, status: 400, message: 'User ID is required' };
    }

    const adminUser = await userDAO.findById(userId);

    if (!adminUser) {
      return { error: true, status: 404, message: 'Admin user not found' };
    }

    const { password, ...userWithoutPassword } = adminUser.dataValues;

    return { error: false, status: 200, data: userWithoutPassword };

  } catch (error) {
    console.error('Error fetching admin user by ID:', error.message);
    await addServerLog({
      log_level: "ERROR",
      service_name: "findAdminUserById",
      error_message: `findAdminUserById service error - ${error.message}.`
    });
    return { error: true, status: 500, message: 'An unexpected error occurred' };
  }
};

const listAdminUsers = async () => {
  try {
    // Fetch roles that contain "ziezzu" or "admin"
    const adminRoles = await roleDAO.findRolesContaining([ 'admin', 'ziezzu']);

    if (!adminRoles || adminRoles.length === 0) {
      return { error: true, status: 404, message: 'No eligible admin roles found' };
    }

    // Create a map of role IDs to display names
    const roleMap = {};
    adminRoles.forEach(role => {
      roleMap[role.id] = role.display_name; // Store display name for each role
    });

    const adminRoleIds = Object.keys(roleMap); // Extract role IDs

    // Fetch users associated with these roles
    const adminUsers = await userDAO.findByRoleIds(adminRoleIds);

    //console.log("Admin Users:", adminUsers);

    if (!adminUsers || adminUsers.length === 0) {
      return { error: true, status: 404, message: 'No admin users found' };
    }

    // Remove passwords and attach display_name
    const usersWithRoleInfo = adminUsers.map(user => {
      const { password, role_id, ...userData } = user.dataValues;
      return {
        ...userData,
        role_id,
        display_name: roleMap[role_id]
      };
    });

    return { error: false, status: 200, data: usersWithRoleInfo };

  } catch (error) {
    console.error('Error listing admin users:', error.message);
    await addServerLog({
      log_level: "ERROR",
      service_name: "listAdminUsers",
      error_message: `listAdminUsers service error - ${error.message}.`
    });
    return { error: true, status: 500, message: 'An unexpected error occurred' };
  }
};


const softDeleteAdminUser = async (userId, role_id, user_id) => {
  try {
    if (!userId) {
      return { error: true, status: 400, message: 'User ID is required for deletion' };
    }

    // if (role_id !== 5) {
    //   return { error: true, status: 403, message: 'Only super admin user can perform this action' };
    // }

    const existingUser = await userDAO.findById(userId);
    if (!existingUser) {
      return { error: true, status: 404, message: 'Admin user not found' };
    }

    if (existingUser.role_id === 5 && role_id !== 5) {
      return { error: true, status: 400, message: 'Only super admin user can perform this action' };
    }

    if (existingUser.id === user_id) {
      return { error: true, status: 400, message: 'Cannot delete your own account' };
    }


    const updatedUser = await userDAO.deleteUser(userId);

    if (!updatedUser) {
      return { error: true, status: 500, message: 'Failed to delete user' };
    }

    return { success: true, status: 200, message: 'User deleted successfully' };

  } catch (error) {
    console.error('Error soft deleting admin user:', error.message);
    await addServerLog({
      log_level: "ERROR",
      service_name: "softDeleteAdminUser",
      error_message: `softDeleteAdminUser service error - ${error.message}.`
    });
    return { error: true, status: 500, message: 'An unexpected error occurred' };
  }
};

const updateProfileDetails = async (userId, profileData) => {

  //return await userDAO.updateProfileDetails(userId, profileData);
  const updateData = {};
  if (profileData.first_name !== undefined) updateData.first_name = profileData.first_name;
  if (profileData.last_name !== undefined) updateData.last_name = profileData.last_name;
  if (profileData.email_id !== undefined) {
    console.log('UserService email_id before transformation:', profileData.email_id); // Debug log
    updateData.email_id = profileData.email_id === '' ? null : profileData.email_id;
    console.log('UserService email_id after transformation:', updateData.email_id); // Debug log
  }

  return await userDAO.updateProfileDetails(userId, updateData);
};

const markApplePayPaymentFailed = async (userId, data) => {
  try {
    const {ride_id , apple_pay_payment_failed } = data;

    const checkRide = await ridesDAO.getRideById(ride_id);
    if (!checkRide) {
      throw new Error(`Ride with ID ${ride_id} not found.`);
    }

    // if (checkRide.customer_id !== userId) {
    //   throw new Error("Ride does not belong to the customer");
    // }

    if (checkRide.status !== "Payment Initiated") {
      throw new Error("Ride must be at 'Payment Initiated' status to mark Apple Pay payment failed");
    }

    const updateData = { apple_pay_payment_failed };
    const rideKey = { PK: `${checkRide.customer_id}`, SK: `#${checkRide.ride_id}` };
    const ride = await ridesDAO.updateRideTable(rideKey, updateData);
    return ride;
    //return await userDAO.markApplePayPaymentFailed(userId, data);
  }
  catch (error) {
    console.log("Error in markApplePayPaymentFailed service:", error.message);
    await addServerLog({
      log_level: "ERROR",
      service_name: "markApplePayPaymentFailed",
      error_message: `markApplePayPaymentFailed service error - ${error.message}.`
    });
    throw error;
  }
};


module.exports = {
  createUser,
  updateUser,
  deleteUser,
  createChauffeurOrPd,
  getIndividualCustomers,
  getCorporateCustomers,
  getAllChauffeurs,
  getAllPd,
  getUserProfileData,
  processUserProfile,
  updateUserDeviceId,
  createCustomer,
  updateCustomer,
  updateChauffeurOrPd,
  adminDeleteUser,
  getAdminUserTypes,
  createAdminUsers,
  updateAdminUser,
  findAdminUserById,
  listAdminUsers,
  softDeleteAdminUser,
  updateProfileDetails,
  markApplePayPaymentFailed
};
