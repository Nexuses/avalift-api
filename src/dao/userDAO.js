// src/dao/userDAO.js

const { User, Role, Type, CustomerWallet, UserCommission, CurrentLocation, ErpMappingCode } = require("../dto");
const { Op, literal } = require("sequelize");
const { getUserProfile } = require("../dao/userProfilesDAO");
require("dotenv").config();
const paymentsService = require("../services/paymentsService");
const ddbDocClient = require("./ddbClient");
const { addServerLog } = require("../services/serverLogsService");
const { UpdateCommand } = require("@aws-sdk/lib-dynamodb");
const { getDateNumber } = require("../utils/dateUtils");
const redisClient = require("../config/redis");

module.exports = {
  findByEmailOrMobile: async (userId) => {
    console.log("User ID in DAO layer: ", userId);
    try {
      // Build the OR conditions based on the presence of email_id or mobile_number with country_code
      const orConditions = [];

      if (userId.email_id) {
        orConditions.push({ email_id: userId.email_id });
      }

      if (userId.mobile_number && userId.country_code) {
        orConditions.push({
          mobile_number: userId.mobile_number,
          country_code: userId.country_code,
        });
      }

      if (orConditions.length === 0) {
        throw new Error(
          "Invalid userId object. Must contain email_id or both mobile_number and country_code."
        );
      }

      const user = await User.findOne({
        where: {
          [Op.or]: orConditions,
          //user_availability: true,
        },
        include: ["role", "type", "status"],
      });

      return user;
    } catch (error) {
      await addServerLog({
        log_level: "ERROR",
        service_name: "findByEmailOrMobile",
        error_message: `findByEmailOrMobile DAO error - ${error.message}.`,
      });
      console.error("Error in findByEmailOrMobile:", error);
      throw error;
    }
  },

  findRoleByName: async (roleName) => {
    try {
      return await Role.findOne({ where: { name: roleName } });
    } catch (error) {
      await addServerLog({
        log_level: "ERROR",
        service_name: "findRoleByName",
        error_message: `findRoleByName DAO error - ${error.message}.`,
      });
      throw error;
    }
  },

  findTypeIdByName: async (typeName) => {
    try {
      return await Type.findOne({
        where: { type: typeName },
      });
    } catch (error) {
      await addServerLog({
        log_level: "ERROR",
        service_name: "findTypeIdByName",
        error_message: `findTypeIdByName DAO error - ${error.message}.`,
      });
      throw error;
    }
  },

  createUser: async (userData) => {
    try {
      const newUser = await User.create(userData);
      if (userData.role_id) {
        await paymentsService.createCustomerWallet(newUser.id);
      }
      return newUser;
    } catch (error) {
      await addServerLog({
        log_level: "ERROR",
        service_name: "createUser",
        error_message: `createUser DAO error - ${error.message}.`,
      });
      console.error("Error creating user:", error);
      throw error;
    }
  },

  createOrgUser: async (userData) => {
    try {
      const newUser = await User.create(userData);
      if (userData.role_id) {
        let inputData = {
          customer_id: newUser.id,
        }
        await paymentsService.createCorporateCustomerWallet(inputData);
      }
      return newUser;
    } catch (error) {
      await addServerLog({
        log_level: "ERROR",
        service_name: "createUser",
        error_message: `createUser DAO error - ${error.message}.`,
      });
      console.error("Error creating user:", error);
      throw error;
    }
  },


  findByEmail: async (email) => {
    try {
      return await User.findOne({
        where: { email_id: email },
        include: ["role", "type", "status"],
      });
    } catch (error) {
      await addServerLog({
        log_level: "ERROR",
        service_name: "findByEmail",
        error_message: `findByEmail DAO error - ${error.message}.`,
      });
      throw error;
    }
  },

  findById: async (userId) => {
    try {
      // Find user by ID in the User table
      const user = await User.findOne({
        where: {
          id: userId, // Match user_id with the provided userId
          is_active: true,
          user_availability: true,
        },
      });

      // If user is found, return true, otherwise return false
      return user ? user : null;
    } catch (error) {
      await addServerLog({
        log_level: "ERROR",
        service_name: "findById",
        error_message: `findById DAO error - ${error.message}.`,
      });
      throw new Error("Error while checking if user exists");
    }
  },

  findAllByRole: async (roleName) => {
    try {
      const role = await Role.findOne({ where: { name: roleName } });

      if (!role) {
        throw new Error(`Role '${roleName}' not found.`);
      }

      const users = await User.findAll({
        where: { role_id: role.id },
        attributes: { exclude: ["password"] },
        order: [["id", "DESC"]], // Sort by userId in descending order
      });

      return users;
    } catch (error) {
      await addServerLog({
        log_level: "ERROR",
        service_name: "findAllByRole",
        error_message: `findAllByRole DAO error - ${error.message}.`,
      });
      console.error("Error in findAllByRole:", error);
      throw error;
    }
  },

  findAllUsersByRole: async (roleName) => {
    try {
      const role = await Role.findOne({ where: { name: roleName } });

      if (!role) {
        throw new Error(`Role '${roleName}' not found.`);
      }

      const users = await User.findAll({
        where: { role_id: role.id, is_active: true },
        attributes: { exclude: ["password"] },
        order: [["id", "DESC"]], // Sort by userId in descending order
      });

      return users;
    } catch (error) {
      await addServerLog({
        log_level: "ERROR",
        service_name: "findAllByRole",
        error_message: `findAllByRole DAO error - ${error.message}.`,
      });
      console.error("Error in findAllByRole:", error);
      throw error;
    }
  },

  updateUserDeviceId: async (userId, device_id) => {
    try {
      console.log("User:", userId);
      const user = await User.findByPk(userId); // Find the user by primary key (id)
      if (!user) {
        throw new Error(`User with ID ${userId} not found.`);
      }

      user.device_id = device_id; // Update the device_id field
      await user.save(); // Save the changes to the database

      console.log(`Device ID updated for user ID: ${userId}`);
      return user; // Optionally, return the updated user
    } catch (error) {
      await addServerLog({
        log_level: "ERROR",
        service_name: "updateUserDeviceId",
        error_message: `updateUserDeviceId DAO error - ${error.message}.`,
      });
      console.error("Error updating device ID:", error);
      throw error;
    }
  },

  /**
   * Finds the device_id for a given user_id.
   * @param {number} userId - The ID of the user.
   * @returns {Promise<string>} - The device_id of the user.
   * @throws {Error} - Throws an error if the user is not found.
   */
  findDeviceIdByUserId: async (userId) => {
    try {
      const user = await User.findOne({
        where: { id: userId },
        attributes: ["device_id"], // Fetch only the device_id field
      });

      if (!user) {
        throw new Error(`User with ID ${userId} not found.`);
      }

      return user.device_id;
    } catch (error) {
      await addServerLog({
        log_level: "ERROR",
        service_name: "findDeviceIdByUserId",
        error_message: `findDeviceIdByUserId DAO error - ${error.message}.`,
      });
      console.error("Error fetching device_id:", error);
      throw error;
    }
  },

  findPdDeviceIdByUserId: async (userId) => {
    try {
      const user = await User.findOne({
        where: { id: userId, role_id: 3 },
        attributes: ["device_id"], // Fetch only the device_id field
      });

      if (!user) {
        throw new Error(`User with ID ${userId} not found.`);
      }

      return user.device_id;
    } catch (error) {
      await addServerLog({
        log_level: "ERROR",
        service_name: "findDeviceIdByUserId",
        error_message: `findDeviceIdByUserId DAO error - ${error.message}.`,
      });
      console.error("Error fetching device_id:", error);
      throw error; // Re-throw the error for proper handling in the caller function
    }
  },

  findPdDeviceIdByUserId: async (userId) => {
    try {
      const user = await User.findOne({
        where: { id: userId, role_id: 3 },
        attributes: ["device_id"], // Fetch only the device_id field
      });

      if (!user) {
        throw new Error(`User with ID ${userId} not found.`);
      }

      return user.device_id;
    } catch (error) {
      await addServerLog({
        log_level: "ERROR",
        service_name: "findDeviceIdByUserId",
        error_message: `findDeviceIdByUserId DAO error - ${error.message}.`,
      });
      console.error("Error fetching device_id:", error);
      throw error; // Re-throw the error for proper handling in the caller function
    }
  },

  // Fetch user by ID and include role, type, status and documents if role is pd or chauffeur
  findByUserId: async (id) => {
    try {
      const user = await User.findOne({
        where: { id },
        include: ["role", "status"],
        attributes: { exclude: ["password"] },
      });

      if (!user) {
        throw new Error(`User with ID ${id} not found.`);
      }

      // Check if the user's role is 'pd' or 'chauffeur'
      if (user.role.name === "pd" || user.role.name === "chauffeur") {
        const userProfile = await getUserProfile(user.id);
        user.dataValues.documents = userProfile ? userProfile.documents : null;
      }

      return user;
    } catch (error) {
      await addServerLog({
        log_level: "ERROR",
        service_name: "findByUserId",
        error_message: `findByUserId DAO error - ${error.message}.`,
      });
      console.error("Error fetching user by ID:", error);
      throw error;
    }
  },

  getUserByEmail: async (email) => {
    try {
      return await User.findOne({
        where: { email_id: email },
        attributes: { exclude: ["password"] }, // Exclude sensitive fields like password
      });
    } catch (error) {
      await addServerLog({
        log_level: "ERROR",
        service_name: "getUserByEmail",
        error_message: `getUserByEmail DAO error - ${error.message}.`,
      });
      console.error("Error fetching user by email:", error.message);
      throw error;
    }
  },

  updateUser: async (userId, updatedFields) => {
    try {
      console.log("Updating user", userId);
      console.log("with updated fields", updatedFields);
      const result = await User.update(updatedFields, {
        where: { id: userId },
      });
      return result;
    } catch (error) {
      await addServerLog({
        log_level: "ERROR",
        service_name: "updateUser",
        error_message: `updateUser DAO error - ${error.message}.`,
      });
      console.error("Error updating user:", error);
      throw error;
    }
  },

  getChauffeurName: async (chauffeurId) => {
    try {
      const user = await User.findOne({
        attributes: ["first_name", "last_name"],
        where: { id: chauffeurId },
      });

      return user;
    } catch (error) {
      await addServerLog({
        log_level: "ERROR",
        service_name: "getChauffeurName",
        error_message: `getChauffeurName DAO error - ${error.message}.`,
      });
      console.error("Error fetching chauffeur name:", error);
      throw new Error("Failed to fetch chauffeur name.");
    }
  },

  fetchChauffeurDetails: async (chauffeurIds) => {
    if (!chauffeurIds.length) return {};

    const chauffeurDetails = {};

    try {
      // Fetch all chauffeurs in parallel using Promise.all
      await Promise.all(
        chauffeurIds.map(async (id) => {
          const chauffeur = await User.findOne({ where: { id } });
          if (chauffeur) {
            chauffeurDetails[id] = {
              name: `${chauffeur.first_name} ${chauffeur.last_name}`,
              phone: `${chauffeur.country_code}${chauffeur.mobile_number}`,
            };
          }
        })
      );
    } catch (error) {
      await addServerLog({
        log_level: "ERROR",
        service_name: "fetchChauffeurDetails",
        error_message: `fetchChauffeurDetails DAO error - ${error.message}.`,
      });
      console.error("Error fetching chauffeurs from PostgreSQL:", error);
    }

    return chauffeurDetails;
  },

  findUserRole: async (userId) => {
    try {
      const user = await User.findByPk(userId, {
        attributes: ["id", "role_id"],
      });

      return user ? user.role_id : null;
    } catch (error) {
      await addServerLog({
        log_level: "ERROR",
        service_name: "findUserRole",
        error_message: `findUserRole DAO error - ${error.message}.`,
      });
      throw new Error("Error while fetching user role");
    }
  },

  updateCustomer: async (userId, updatedFields) => {
    try {
      const userIdInt = Number(userId);
      if (isNaN(userIdInt)) {
        throw new Error("Invalid user ID format");
      }

      // Check if user exists
      const existingUser = await User.findByPk(userIdInt);
      if (!existingUser) {
        throw new Error(`No user found with ID ${userIdInt}`);
      }

      // Check if email_id already exists (excluding the current user)
      if (updatedFields.email_id) {
        const existingEmail = await User.findOne({
          where: {
            email_id: updatedFields.email_id,
            id: { [Op.ne]: userIdInt },
          },
        });

        if (existingEmail) {
          throw new Error(
            `Email ID ${updatedFields.email_id} is already existing.`
          );
        }
      }

      // Check if mobile_number already exists (excluding the current user)
      if (updatedFields.mobile_number && updatedFields.country_code) {
        const existingMobile = await User.findOne({
          where: {
            mobile_number: updatedFields.mobile_number,
            country_code: updatedFields.country_code,
            id: { [Op.ne]: userIdInt },
          },
        });

        if (existingMobile) {
          throw new Error(
            `Mobile number ${updatedFields.mobile_number} is already existing.`
          );
        }
      }

      // Perform the update operation
      const [updatedRowCount] = await User.update(updatedFields, {
        where: { id: userIdInt },
      });

      if (updatedRowCount === 0) {
        throw new Error(`No changes were made to user with ID ${userIdInt}`);
      }

      // Fetch and return the updated user details
      return await User.findByPk(userIdInt, {
        attributes: [
          "first_name",
          "last_name",
          "email_id",
          "mobile_number",
          "country_code",
          "is_active",
        ],
      });
    } catch (error) {
      await addServerLog({
        log_level: "ERROR",
        service_name: "updateCustomer",
        error_message: `updateCustomer DAO error - ${error.message}.`,
      });
      throw error;
    }
  },

  getAllChauffeurIds: async () => {
    try {
      console.log("Fetching all chauffeur IDs from PostgreSQL...");

      const chauffeurs = await User.findAll({
        attributes: ["id"],
        raw: true,
      });

      const chauffeurIds = chauffeurs.map((chauffeur) => chauffeur.id);

      console.log(`Total Chauffeurs Found: ${chauffeurIds.length}`);
      return chauffeurIds;
    } catch (error) {
      await addServerLog({
        log_level: "ERROR",
        service_name: "getAllChauffeurIds",
        error_message: `getAllChauffeurIds DAO error - ${error.message}.`,
      });
      console.error("Error fetching chauffeur IDs:", error);
      throw new Error("Failed to fetch chauffeur IDs.");
    }
  },

  updatePdChauffeurUser: async (userId, updatedFields) => {
    try {
      console.log("Updating user", userId);
      console.log("With updated fields", updatedFields);

      if (updatedFields.email_id) {
        const existingEmail = await User.findOne({
          where: {
            email_id: updatedFields.email_id,
            id: { [Op.ne]: userId },
          },
        });

        if (existingEmail) {
          const error = new Error(
            `Email ID ${updatedFields.email_id} is already in use by another user.`
          );
          error.statusCode = 400;
          throw error;
        }
      }

      if (updatedFields.mobile_number) {
        const existingMobile = await User.findOne({
          where: {
            mobile_number: updatedFields.mobile_number,
            id: { [Op.ne]: userId },
          },
        });

        if (existingMobile) {
          const error = new Error(
            `Mobile number ${updatedFields.mobile_number} is already in use by another user.`
          );
          error.statusCode = 400;
          throw error;
        }
      }

      const [updatedRowCount] = await User.update(updatedFields, {
        where: { id: userId },
      });

      if (updatedRowCount === 0) {
        const error = new Error(
          `No user found with ID ${userId} or no changes were made.`
        );
        error.statusCode = 400;
        throw error;
      }

      return await User.findByPk(userId, {
        attributes: [
          "first_name",
          "last_name",
          "email_id",
          "mobile_number",
          "country_code",
          "is_active",
          "role_id",
        ],
      });
    } catch (error) {
      await addServerLog({
        log_level: "ERROR",
        service_name: "updatePdChauffeurUser",
        error_message: `updatePdChauffeurUser DAO error - ${error.message}.`,
      });
      console.error("DAO Error:", error.message);
      error.statusCode = error.statusCode || 500;
      throw error;
    }
  },

  checkEmailExist: async (email) => {
    try {
      const user = await User.findOne({
        where: { email_id: email },
      });
      return user ? true : false;
    } catch (error) {
      await addServerLog({
        log_level: "ERROR",
        service_name: "checkEmailExist",
        error_message: `checkEmailExist DAO error - ${error.message}.`,
      });
      console.error("Error in checkEmailExist:", error);
      throw error;
    }
  },

  checkMobileExist: async (country_code, mobile_number) => {
    try {
      const user = await User.findOne({
        where: {
          country_code,
          mobile_number,
        },
      });
      return user ? true : false;
    } catch (error) {
      await addServerLog({
        log_level: "ERROR",
        service_name: "checkMobileExist",
        error_message: `checkMobileExist DAO error - ${error.message}.`,
      });
      console.error("Error in checkMobileExist:", error);
      throw error;
    }
  },

  updateDailyAggregate: async (userId, timestamp, duration, type) => {
    console.log("UpdateDailyAggregate called with:", {
      userId,
      timestamp,
      duration,
      type,
    });

    const dateNumber = getDateNumber(timestamp);
    const attributeName =
      type === "online" ? "online_duration" : "offline_duration";

    const params = {
      TableName: "UserStatusDailyAggregates",
      Key: {
        user_id: String(userId),
        date: dateNumber,
      },
      UpdateExpression: "ADD #attr :duration",
      ExpressionAttributeNames: {
        "#attr": attributeName,
      },
      ExpressionAttributeValues: {
        ":duration": duration,
      },
      ReturnValues: "UPDATED_NEW",
    };

    try {
      const result = await ddbDocClient.send(new UpdateCommand(params));
      console.log(
        "Daily aggregate update result:",
        JSON.stringify(result, null, 2)
      );
      return result;
    } catch (error) {
      await addServerLog({
        log_level: "ERROR",
        service_name: "updateDailyAggregate",
        error_message: `updateDailyAggregate DAO error - ${error.message}.`,
      });
      console.error("Error updating daily aggregate:", error);
      throw error;
    }
  },

  findMobileNumberByUserId: async (userId) => {
    try {
      const user = await User.findOne({
        where: { id: userId },
        attributes: ["country_code", "mobile_number"],
      });

      if (!user) {
        throw new Error(`User with ID ${userId} not found.`);
      }

      return user;
    } catch (error) {
      await addServerLog({
        log_level: "ERROR",
        service_name: "findMobileNumberByUserId",
        error_message: `findMobileNumberByUserId DAO error - ${error.message}.`,
      });
      console.error("Error fetching mobile number:", error);
      throw error;
    }
  },

  fetchAvailableChauffeursDeviceIds: async () => {
    try {
      const chauffeurs = await User.findAll({
        where: {
          role_id: process.env.CHAUFFEUR_ROLE_ID,
          is_active: true,
          status_id: process.env.ACTIVE_STATUS_ID,
          user_availability: true
        },
        attributes: ["id", "device_id"],
      });
      return chauffeurs;
    } catch (error) {
      await addServerLog({
        log_level: "ERROR",
        service_name: "fetchAvailableChauffeursDeviceIds",
        error_message: `fetchAvailableChauffeursDeviceIds DAO error - ${error.message}.`,
      });
      console.error("Error fetching chauffeurs", error);
      throw error;
    }
  },

  findAvailabaleChauffeur: async () => {
    try {
      const allChauffeurs = await User.findAll({
        where: {
          role_id: process.env.CHAUFFEUR_ROLE_ID,
          status_id: process.env.ACTIVE_STATUS_ID,
          is_active: true,
          user_availability: true
        },
      });

      return allChauffeurs;
    } catch (error) {
      await addServerLog({
        log_level: "ERROR",
        service_name: "findAvailabaleChauffeur",
        error_message: `findAvailabaleChauffeur DAO error - ${error.message}.`,
      });
      console.error(error.message);
      throw new Error(
        `Error in fetching available chauffeurs: ${error.message}`
      );
    }
  },

  findNegativeBalanceById: async (user_id) => {
    try {
      console.log("findUserWallet input", user_id);
      let customerWallet = await CustomerWallet.findOne({
        where: { user_id },
      });
      console.log("Customer Wallet", customerWallet);
      return customerWallet
        ? customerWallet.wallet_balance >= 0
          ? false
          : true
        : false;
    } catch (err) {
      await addServerLog({
        log_level: "ERROR",
        service_name: "findNegativeBalanceById",
        error_message: `findNegativeBalanceById DAO error - ${err.message}.`,
      });
      const error = new Error(
        `Could not findNegativeBalanceById ${err.message}`
      );
      error.statusCode = 400;
      throw error;
    }
  },

  deleteUser: async (userId) => {
    try {
      console.log(`Soft deleting user with ID: ${userId}`);

      const user = await User.findByPk(userId);
      if (!user) {
        throw new Error(`User with ID ${userId} not found.`);
      }

      await user.update(
        {
          first_name: "DELETED USER",
          last_name: "DELETED USER",
          mobile_number: `DELETED USER ${user.id}`,
          email_id: null,
          device_id: null,
          is_active: false,
        },
        { validate: false }
      );

      // 2. Delete session token from Redis
      const sessionKey = `session:${user.id}`;
      const result = await redisClient.del(sessionKey);
      console.log(`Redis session deleted: ${result > 0 ? "Yes" : "No session found"}`);
      console.log(sessionKey,"sessionKey")
      
      return { message: `User ${user.id} soft deleted successfully` };
    } catch (error) {
      await addServerLog({
        log_level: "ERROR",
        service_name: "deleteUser",
        error_message: `deleteUser DAO error - ${error.message}.`,
      });
      console.error("Error deleting user:", error);
      throw new Error(`Failed to delete user: ${error.message}`);
    }
  },

  findByPhone: async (phone) => {
    try {
      return await User.findOne({ where: { mobile_number: phone } });
    } catch (error) {
      await addServerLog({
        log_level: "ERROR",
        service_name: "findByPhone",
        error_message: `findByPhone DAO error - ${error.message}.`,
      });
      throw error;
    }
  },

  findByRoleIds: async (roleIds) => {
    try {
      return await User.findAll({
        where: {
          role_id: {
            [require("sequelize").Op.in]: roleIds,
          },
          is_active: true,
        },
        order: [['id', 'DESC']]
      });
    } catch (error) {
      await addServerLog({
        log_level: "ERROR",
        service_name: "findByRoleIds",
        error_message: `findByRoleIds DAO error - ${error.message}.`,
      });
      throw error;
    }
  },

  findChauffeurPD: async (chauffeurIds, pdIds) => {
    try {
      // ✅ Fetch names from `User` table
      const userResults = await User.findAll({
        attributes: ["id", "first_name", "last_name"],
        where: { id: { [Op.in]: [...chauffeurIds, ...pdIds] } },
        raw: true,
      });
      return userResults;
    } catch (error) {
      await addServerLog({
        log_level: "ERROR",
        service_name: "findChauffeurPD",
        error_message: `findChauffeurPD DAO error - ${error.message}.`,
      });
      throw error;
    }
  },

  getChauffeurNameOfTopTen: async (chauffeurIds) => {
    try {
      const users = await User.findAll({
        attributes: ["id", "first_name", "last_name"],
        where: {
          id: chauffeurIds, // Pass array directly here
        },
        raw: true, // Optional: return plain objects
      });

      return users; // This should be an array of users
    } catch (error) {
      await addServerLog({
        log_level: "ERROR",
        service_name: "getChauffeurNameOfTopTen",
        error_message: `getChauffeurNameOfTopTen DAO error - ${error.message}.`,
      });
      console.error("Error fetching chauffeur names:", error);
      throw new Error("Failed to fetch chauffeur names.");
    }
  },

  updateOrgAdminUser: async (userId, updatedFields) => {
    try {
      console.log("Updating user", userId);
      console.log("with updated fields", updatedFields);

      // Perform the update (this returns number of affected rows)
      await User.update(updatedFields, { where: { id: userId } });

      // Fetch the updated user and return it
      const updatedUser = await User.findOne({
        where: {
          id: userId,
          is_active: true,
        },
      });

      return updatedUser;
    } catch (error) {
      await addServerLog({
        log_level: "ERROR",
        service_name: "updateOrgAdminUser",
        error_message: `updateOrgAdminUser DAO error - ${error.message}.`,
      });
      console.error("Error updating user:", error);
      throw error;
    }
  },
  userCommissionPD: async(data) => {
    try {
      return await UserCommission.create({
        user_id: data.pd_id, 
        ride_id: data.ride_id,
        role_id: 3,
        commission: 10,
        is_percentage: false, 
        ride_amount: 0, 
        commission_amount:10
      });
    } catch (error) {
      await addServerLog({
        log_level: "ERROR",
        service_name: "userCommssion",
        error_message: `userCommssion DAO error - ${error.message}.`,
      });
      throw error;
    }
  },

  makeActiveInactive: async (user_id,enable) => {
    try {
      const user = await User.findByPk(user_id);
      if (!user) {
        throw new Error(`User with ID ${user_id} not found.`);
      }
      if(enable){
      user.user_availability = true;}
      else{
        user.user_availability = false;
      }
      await user.save();
      return user;
    } catch (error) {
      await addServerLog({
        log_level: "ERROR",
        service_name: "makeActiveInactive",
        error_message: `User DAO error - ${error.message}.`,
      });
      throw error;
    }
  },

fetchCustomerDetails: async (customerIds) => {
  if (!customerIds?.length) return {};

  const customerDetails = {};

  try {
    // Fetch all customers in one query instead of multiple findOne calls
    const customers = await User.findAll({
      where: { id: customerIds },
    });

    // Map found customers
    customers.forEach((customer) => {
      customerDetails[customer.id] = {
        name: `${customer.first_name} ${customer.last_name}`,
        phone: `${customer.country_code}${customer.mobile_number}`,
      };
    });

    // Find missing IDs and log them
    const foundIds = customers.map((c) => c.id);
    const missingIds = customerIds.filter((id) => !foundIds.includes(id));

    if (missingIds.length > 0) {
      await addServerLog({
        log_level: "WARN",
        service_name: "fetchCustomerDetails",
        error_message: `Customers not found for IDs: ${missingIds.join(", ")}`,
      });
    }
  } catch (error) {
    await addServerLog({
      log_level: "ERROR",
      service_name: "fetchCustomerDetails",
      error_message: `fetchCustomerDetails DAO error - ${error.message}.`,
    });
    console.error("Error fetching customer from PostgreSQL:", error);
  }

  return customerDetails;
},


  getUsersForSilentPush: async () => {
    try {

      const currentTime = new Date();
      const thresholdTime = new Date(currentTime.getTime() - 20 * 1000); // 20 seconds ago

      //console.log("thresholdTime",thresholdTime);
      //console.log("currentTime",currentTime);

      const lastUpdatedLocationTime = await CurrentLocation.findAll({
        where: {
          updatedAt: {
            [Op.lt]: thresholdTime,
          },
        },
        attributes: ["user_id"],
      })

      //console.log("here is lastUpdatedLocationTime",lastUpdatedLocationTime);

      const userIds = lastUpdatedLocationTime.map((location) => location.user_id);

     // console.log("userIds",userIds);

      const users = await User.findAll({
        where: {
          id: userIds,
          is_active: true,
          status_id: process.env.ACTIVE_STATUS_ID,
          user_availability: true,
          [Op.and]: [
            literal(`json_typeof("os_type") = 'array'`),
            literal(`EXISTS (
              SELECT 1 
              FROM json_array_elements("os_type"::json) AS elem
              WHERE elem->>'os_type' = 'iOS'
            )`)
          ] // subquery for taking os_type
        },
        attributes: ["id", "device_id"],
      });

      //console.log("users",users);

      // If user is found, return true, otherwise return false
      return users ? users : null;
    } catch (error) {
      await addServerLog({
        log_level: "ERROR",
        service_name: "findById",
        error_message: `findById DAO error - ${error.message}.`,
      });
      throw new Error("Error while checking if user exists");
    }
  },

  updateProfileDetails : async (userId, updateData) => {
    const { email_id } = updateData;
  
    // Check if email is already used by another user
    if (email_id) {
      const existingUser = await User.findOne({
        where: {
          email_id,
          id: { [Op.ne]: userId },
        },
      });
  
      if (existingUser) {
        throw new Error('Email already exists');
      }
    }
  
    // Update user profile
    await User.update(updateData, {
      where: { id: userId }
    });
  
    // Fetch updated user
    return await User.findByPk(userId, {
      attributes: ['id', 'first_name', 'last_name', 'email_id']
    });
  },

  findAllIndividualUsersByRole: async (roleName) => {
    try {
      const role = await Role.findOne({ where: { name: roleName } });

      if (!role) {
        throw new Error(`Role '${roleName}' not found.`);
      }

      const users = await User.findAll({
        where: { role_id: role.id, is_active: true, device_id: { [Op.ne]: null }   },
        attributes: ["id"],
        order: [["id", "DESC"]], // Sort by userId in descending order
      });

      return users;
    } catch (error) {
      await addServerLog({
        log_level: "ERROR",
        service_name: "findAllByRole",
        error_message: `findAllByRole DAO error - ${error.message}.`,
      });
      console.error("Error in findAllByRole:", error);
      throw error;
    }
  },
   findDeviceIdsForUsers: async(userIds) => {
  return await User.findAll({
    where: { id: userIds },
    attributes: ["id", "device_id"],
    raw: true,
  });
},
};
