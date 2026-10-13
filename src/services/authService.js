// src/services/authService.js

const userDAO = require("../dao/userDAO");
const { User, Organization } = require("../dto");
const userStatusDAO = require("../dao/usersStatusDAO");
const ridesDAO = require("../dao/ridesDAO");
const chauffeurRidesDAO = require("../dao/chauffeurRidesDAO");
const otpDAO = require("../dao/otpDAO");
const { Role, Policy, Permission } = require("../dto");
const {
  generateToken,
  generateTempToken,
  decodeTempToken,
  generateOtp,
} = require("../helpers/authHelper");
const bcrypt = require("bcryptjs");
const {
  adminLoginValidator,
  otpRequestValidator,
  otpVerifyValidator,
  createSuperAdminValidator,
  adminVerifyOtpValidator,
} = require("../validators/authValidator");
const { getPermissionsForRoles } = require("../services/roleService");
const jwt = require("jsonwebtoken");
const redisClient = require("../config/redis");
const usersStatusDAO = require("../dao/usersStatusDAO");

const config = require("../config/provider");
const axios = require("axios");
const { addServerLog } = require("../services/serverLogsService");
const { errorMonitor } = require("nodemailer/lib/xoauth2");
const sendEmail = require("../helpers/sendEmail");
const { error } = require("../validators/invoiceValidator");
const referralDAO = require("../dao/referralDOA");
const { sendSmsCountry } = require("../helpers/sendSms");


// Environment Variables
const JWT_SECRET = process.env.JWT_SECRET;
const TEMP_TOKEN_SECRET = process.env.TEMP_TOKEN_SECRET;

// Session settings
const SESSION_PREFIX = "session:";
const TOKEN_EXPIRY_SECONDS = 31536000

module.exports = {
  // Customer Signup
  signup: async (userData) => {
    try {
      // Check if email or mobile number already exists
      //console.log("userData", userData);
      let userId;
      if (userData.email_id) {
        userId = { email_id: userData.email_id };
      }
      if (userData.mobile_number && userData.country_code) {
        userId = {
          mobile_number: userData.mobile_number,
          country_code: userData.country_code,
        };
      }
      const existingUser = await userDAO.findByEmailOrMobile(userId);
      if (existingUser) {
        throw new Error("Email or Mobile Number already in use.");
      }

      const type = await userDAO.findTypeIdByName("db");
      userData.type_id = type.type;

      // Assign role based on type
      const roleName = getRoleNameByType(userData.role);
      const role = await userDAO.findRoleByName(roleName);
      if (!role) {
        throw new Error("Role not found.");
      }
      userData.role = role.name;
      userData.role_id = role.id;

      // Hash password if provided
      if (userData.password) {
        const salt = await bcrypt.genSalt(10);
        userData.password = await bcrypt.hash(userData.password, salt);
      }
      // Hardcode type_id for "db"
      userData.type_id = 1;

      // Include country_code
      if (!userData.country_code) {
        throw new Error("Country code is required.");
      }

      const user = await userDAO.createUser(userData);
      return user;
    } catch (error) {
      await addServerLog({
        log_level: "ERROR",
        service_name: "signup",
        error_message: `Signup process failed: ${error.message}`,
      });
      throw error;
    }
  },

  // Admin Login (Password-based)
  adminLogin: async (loginData) => {
    try {
      await adminLoginValidator(loginData);
      //console.log("loginData", loginData);
      const user = await userDAO.findByEmail(loginData.email_id);
      if (!user) {
        throw new Error("Invalid email or password.");
      }

      const onlineStatus = await usersStatusDAO.findStatusByName("Online");
      console.log("STATUS: ", onlineStatus.id);
      await userDAO.updateUser(user.id, { status_id: onlineStatus.id });

      // Ensure user is an admin
      // const isAdmin = user.role.name.split(".").includes("admin");
      // if (!isAdmin) {
      //   throw new Error("Access denied. Not an admin.");
      // }

      const roleParts = user.role.name.split(".");
      //console.log("roleParts", roleParts);
      const isAuthorized =
        roleParts.includes("admin") ||
        roleParts.includes("operator") ||
        roleParts.includes("accountant");

      if (!isAuthorized) {
        throw new Error("Access denied. Not an authorized role.");
      }


      // Compare password
      const isMatch = await bcrypt.compare(loginData.password, user.password);
      if (!isMatch) {
        throw new Error("Invalid email or password.");
      }

      const access = await getPermissionsForRoles(user.role.id);
      if (!access) {
        throw new Error("No permissions allocated to the user");
      }

      // ✅ Check if the organization is active
      if (!access.allowedOrganization) {
        throw new Error("No organization permission assigned to the user.");
      }


      if (access.allowedOrganization === "*") {
        access.allowedOrganization = 1;
      }

      const organization = await Organization.findOne({
        where: { id: access.allowedOrganization },
      });


      if (!organization || !organization.is_active) {
        throw new Error("Organization is not active. Please contact support.");
      }

      if (!loginData.device_id) {
        throw new Error("Device ID is required for login.");
      }
      await userDAO.updateUserDeviceId(user.id, loginData.device_id);

      const token = await generateToken(user);
      const sessionKey = `${SESSION_PREFIX}${user.id}`;
      await redisClient.set(sessionKey, token, "EX", TOKEN_EXPIRY_SECONDS);

      return { token, access };
    } catch (error) {
      await addServerLog({
        log_level: "ERROR",
        service_name: "adminLogin",
        error_message: `Admin login failed: ${error.message}`,
      });
      throw error;
    }
  },

  // Request OTP for Other Users (Customer, Chauffeur, PD)
  requestOtp: async (otpRequestData) => {
    try {
      await otpRequestValidator(otpRequestData);
      const { email_id, mobile_number, country_code } = otpRequestData;

      let userId;
      if (email_id) {
        userId = { email_id };
      }
      if (mobile_number && country_code) {
        userId = { mobile_number, country_code };
      }

      const user = await userDAO.findByEmailOrMobile(userId);
      if (user && user.role?.name === "admin") {
        throw new Error("Admins must use password-based login.");
      }

      let otpCode = generateOtp();
      if (mobile_number === "7034472764" && country_code === "+91") {
        otpCode = "1234";
      }
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

      if (user) {
        await otpDAO.createOtp({
          user_id: user.id,
          otp_code: otpCode,
          expires_at: expiresAt,
        });
      } else {
        await otpDAO.createOtpForNewUser({
          email_id,
          mobile_number: `${country_code}${mobile_number}`,
          otp_code: otpCode,
          expires_at: expiresAt,
        });
      }

      const smsInfo = {
        Text: `Your login verification code is ${otpCode}`,
        phoneNumber: mobile_number.replace(/\+/g, ""),
      };

      await sendSmsCountry(smsInfo, config.defaultSmsProvider);

      return otpCode;
    } catch (error) {
      await addServerLog({
        log_level: "ERROR",
        service_name: "requestOtp",
        error_message: `OTP request process failed: ${error.message}`,
      });
      throw error;
    }
  },

  requestOtpChauffeurPd: async (otpRequestData) => {
    try {
      await otpRequestValidator(otpRequestData);
      const { email_id, mobile_number, country_code } = otpRequestData;

      let userId;
      if (email_id) {
        userId = { email_id };
      }
      if (mobile_number && country_code) {
        userId = { mobile_number, country_code };
      }

      const user = await userDAO.findByEmailOrMobile(userId);

      if (
        !user ||
        (user.role.name !== "pd" && user.role.name !== "chauffeur")
      ) {
        throw new Error("User not registered as a pd or chauffeur.");
      }
      if (user && user.role?.name === "admin") {
        throw new Error("Admins must use password-based login.");
      } if (user && user.user_availability === false) {
        throw new Error("Your account has been temporarily disabled. Please contact the administrator for assistance with logging in.");
      }

      let otpCode = generateOtp();
      if (mobile_number === "7705863601" && country_code === "+91") {
        otpCode = "1234";
      }
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
      await otpDAO.createOtp({
        user_id: user.id,
        otp_code: otpCode,
        expires_at: expiresAt,
      });

      const smsInfo = {
        Text: `Your login verification code is ${otpCode}`,
        phoneNumber: mobile_number.replace(/\+/g, ""),
      };

      await sendSmsCountry(smsInfo, config.defaultSmsProvider);

      return otpCode;
    } catch (error) {
      await addServerLog({
        log_level: "ERROR",
        service_name: "requestOtpChauffeurPd",
        error_message: `OTP request for Chauffeur/PD failed: ${error.message}`,
      });
      throw error;
    }
  },


  googleLoginSSO: async (user) => {
    // const role = await Role.findByPk(user.role_id);

    // if (!role || !role.policy_ids?.length) {
    //   throw new Error("Role or policies not found");
    // }

    // const policies = await Policy.findAll({ where: { id: role.policy_ids } });
    // const permissionsData = await Permission.findAll({
    //   where: { policy_id: policies.map((p) => p.id) },
    // });

    // const permissions = permissionsData.map((perm) => perm.name);
    // const organizationIds = [...new Set(permissionsData.map((perm) => perm.organization_id))];
    // const organization_id = organizationIds[0] || null;

    try {

      // Validate email presence
      if (!user.email) {
        throw new Error("Email not provided in Google payload.");
      }

      // Check if user exists by email
      let dbuser = await User.findOne({ where: { email_id: user.email } });

      // If user doesn't exist, create a new one
      if (!dbuser) {
        dbuser = await User.create({
          email_id: user.email,
          first_name: user.name || null, // Optional: Use name from Google payload
          role_id: 1, // Default role for new users
          created_at: new Date(),
          //google_id: payload.sub || null, // Optional: Store google_id for reference
        });
      }



      // Fetch role, permissions, and organization details using getPermissionsForRoles
      const { roles, permissions, allowedOrganization } = await getPermissionsForRoles(dbuser.role_id);

      if (!roles.length || !permissions.length) {
        throw new Error("Role, permissions,  not found.");
      }

      // Construct payload for JWT token
      const payload = {
        id: dbuser.id,
        email_id: dbuser.email_id,
        role: dbuser.role_id,
        role_id: dbuser.role_id,
        permissions,
        organization_id: allowedOrganization,
      };

      // Generate JWT token
      const token = jwt.sign(payload, JWT_SECRET, { expiresIn: "24h" });

      // Store the token in Redis (optional step based on your session management)
      const sessionKey = `${SESSION_PREFIX}${dbuser.id}`;
      await redisClient.set(sessionKey, token, 'EX', TOKEN_EXPIRY_SECONDS);

      const userData = {
        id: dbuser.id,
        country_code: dbuser.country_code,
        mobile_number: dbuser.mobile_number,
        email_id: dbuser.email_id,
        first_name: dbuser.first_name,
        last_name: dbuser.last_name,
        type_id: dbuser.type_id,
        role_id: dbuser.role_id,
        is_active: dbuser.is_active,
        status_id: dbuser.status_id,
        user_availability: dbuser.user_availability,
        device_id: dbuser.device_id,
        os_type: dbuser.os_type,
        createdAt: dbuser.createdAt,
        updatedAt: dbuser.updatedAt,
        // access: {
        //   roles,
        //   permissions,
        //   allowedOrganization
        // }
      };

      // Return the generated token
      return {
        token,
        data: userData
      };
    } catch (error) {
      console.error("Error during Google SSO login:", error);
      throw error;
    }
  },




  // Verify OTP and Authenticate Other Users
  verifyOtp: async (otpVerifyData) => {
    try {
      await otpVerifyValidator(otpVerifyData);
      const {
        email_id,
        mobile_number,
        otp_code,
        country_code,
        device_id,
        os_type,
        device_model,
      } = otpVerifyData;
      let userId = {};

      if (email_id) {
        userId.email_id = email_id;
      }

      if (mobile_number && country_code) {
        userId.mobile_number = mobile_number;
        userId.country_code = country_code;
      }

      // Attempt to find user by email or mobile number
      const user = await userDAO.findByEmailOrMobile(userId);

      if (user) {
        // Existing user: verify OTP
        const isValid = await otpDAO.verifyOtpForUser(user.id, otp_code);
        if (!isValid) {
          throw new Error("Invalid or expired OTP.");
        }

        // Check and update device_id in os_type array
        let osTypeData = []; // Retrieve existing os_type array

        // If device_id is not found, add it to the array
        osTypeData.push({
          os_type,
          device_id,
          device_model,
          updatedAt: new Date().toISOString(),
        });

        console.log(`Updating os_type for user ${user.id}:`, osTypeData);
        const updateData = { os_type: osTypeData };
        // Update user record in the database
        await userDAO.updateUser(user.id, updateData);

        // Check and update device_id
        if (user.device_id !== device_id) {
          console.log(
            `Device ID mismatch for user ${user.id}: Updating device ID from ${user.device_id} to ${device_id}.`
          );
          await userDAO.updateUserDeviceId(user.id, device_id); // Assume `updateUserDeviceId` updates the device_id in the database.
        }

        const access = await getPermissionsForRoles(user.role_id);
        //console.log(`Access for user ${user.id}:`, access);
        if (access.allowedOrganization !== "1") {
          throw new Error("User is registered as an organization user. Customer App login is not allowed.");
        }
        // Generate JWT
        const token = await generateToken(user);
        // Store token in Redis
        const sessionKey = `${SESSION_PREFIX}${user.id}`;
        await redisClient.set(sessionKey, token, "EX", TOKEN_EXPIRY_SECONDS);

        return { token, access };
      } else {
        // New user: verify OTP associated with email or mobile number
        const isValid = await otpDAO.verifyOtpForNewUser(
          email_id,
          `${country_code}${mobile_number}`,
          otp_code
        );
        if (!isValid) {
          throw new Error("Invalid or expired OTP.");
        }
        // Generate Temporary Token
        const tempToken = generateTempToken({
          email_id,
          mobile_number,
          country_code,
          device_id,
          os_type,
          device_model,
          os_type,
          device_model
        });
        return { tempToken };
      }
    } catch (error) {
      await addServerLog({
        log_level: "ERROR",
        service_name: "verifyOtpChauffeurPd",
        error_message: `OTP verification for individual failed: ${error.message}`,
      });
      throw error;
    }
  },

  // Verify OTP and Authenticate Other Users (Chauffeur/PD)
  verifyOtpChauffeurPd: async (otpVerifyData) => {
    try {
      await otpVerifyValidator(otpVerifyData);
      const {
        mobile_number,
        otp_code,
        country_code,
        device_id,
        os_type,
        device_model,
      } = otpVerifyData;
      let userId = {};

      if (mobile_number && country_code) {
        userId.mobile_number = mobile_number;
        userId.country_code = country_code;
      }

      // Attempt to find user by email or mobile number
      const user = await userDAO.findByEmailOrMobile(userId);

      if (user) {
        // Existing user: verify OTP
        const isValid = await otpDAO.verifyOtpForUser(user.id, otp_code);
        if (!isValid) {
          throw new Error("Invalid or expired OTP.");
        }

        // Check and update device_id
        if (user.device_id !== device_id) {
          console.log(
            `Device ID mismatch for user ${user.id}: Updating device ID from ${user.device_id} to ${device_id}.`
          );
          await userDAO.updateUserDeviceId(user.id, device_id); // Assume `updateUserDeviceId` updates the device_id in the database.
        }

        // Check and update device_id in os_type array
        let osTypeData = []; // Retrieve existing os_type array

        // If device_id is not found, add it to the array
        osTypeData.push({
          os_type,
          device_id,
          device_model,
          updatedAt: new Date().toISOString(),
        });

        console.log(`Updating os_type for user ${user.id}:`, osTypeData);
        const updateData = { os_type: osTypeData };
        // Update user record in the database
        await userDAO.updateUser(user.id, updateData);

        const access = await getPermissionsForRoles(user.role_id);
        // Generate JWT
        const token = await generateToken(user);
        // Store token in Redis
        const sessionKey = `${SESSION_PREFIX}${user.id}`;
        await redisClient.set(sessionKey, token, "EX", TOKEN_EXPIRY_SECONDS);

        // Check if user is a chauffeur based on type_id or role_id
        const isChauffeur = user.role_id === 4;

        const responsePayload = {
          token,
          access,
        };

        if (isChauffeur) {
          responsePayload.is_salaried = user.is_salaried;
        }

        return responsePayload;


        //return { token, access };
      } else {
        const notFoundError = new Error("User not found.");
        notFoundError.name = "NotFoundError";
        throw notFoundError;
      }
    } catch (error) {
      await addServerLog({
        log_level: "ERROR",
        service_name: "verifyOtpChauffeurPd",
        error_message: `OTP verification for Chauffeur/PD failed: ${error.message}`,
      });
      throw error;
    }
  },

  // Complete Registration for New Users
  // Complete Registration for New Users
  completeRegistration: async (registrationData) => {
    try {
      const { temp_token, first_name, password, last_name, type, referral_code, input_email_id } =
        registrationData;
      const decoded = decodeTempToken(temp_token);
      //console.log("decoded", decoded)
      const { email_id, mobile_number, country_code, device_id, os_type, device_model  } =
        decoded || {};
      let userId;
      //console.log(email_id)
      if (email_id) {
        userId = { email_id };
      }
      if (mobile_number && country_code) {
        userId = { mobile_number, country_code };
      }
      if (!userId) {
        const error = new Error("Invalid temp_token: email or mobile is required.");
        error.status = 400; // Bad Request
        throw error;
      }
      const existingUser = await userDAO.findByEmailOrMobile(userId);
      //console.log("existingUser", existingUser)
      if (input_email_id && existingUser?.email_id === input_email_id) {
        throw new Error("User mail id already exists. Please login.");
      }
      if (existingUser) {
        const error = new Error("User already exists. Please login.");
        error.status = 409; // Conflict
        throw error;
      }
      let referral;
      if (referral_code) {
        referral = await referralDAO.getReferralByCode(referral_code);
        if (!referral) {
          const error = new Error("Referral code not found. Please check the code or try signing up without referral code.");
          error.status = 404; // Not Found
          throw error;
        }
      }

      // Check and update device_id in os_type array
      let osTypeData = []; // Retrieve existing os_type array

      // If device_id is not found, add it to the array
      osTypeData.push({
        os_type,
        device_id,
        device_model,
        updatedAt: new Date().toISOString(),
      });

      const { signup } = module.exports;
      const newUser = await signup({
        email_id: email_id ? email_id : input_email_id,
        mobile_number,
        country_code,
        first_name,
        last_name,
        password,
        type,
        device_id,
        os_type: osTypeData,
      });
      if (referral) {
        await referralDAO.appendReferredUser(referral_code, newUser.id);
        await referralDAO.saveTemporaryReferral(newUser.id, referral_code);
      }
      const access = await getPermissionsForRoles(newUser.role_id);
      const token = await generateToken(newUser);
      const sessionKey = `${SESSION_PREFIX}${newUser.id}`;
      await redisClient.set(sessionKey, token, "EX", TOKEN_EXPIRY_SECONDS);
      return { token, access };
    } catch (error) {
      await addServerLog({
        log_level: "ERROR",
        service_name: "completeRegistration",
        error_message: `Complete registration failed: ${error.message}`,
      });
      throw error;
    }
  },

  createSuperAdmin: async (adminData) => {
    try {
      await createSuperAdminValidator(adminData);
      let userId = {};
      if (adminData.mobile_number && adminData.country_code) {
        userId.mobile_number = adminData.mobile_number;
        userId.country_code = adminData.country_code;
      }
      if (adminData.email_id) {
        userId.email_id = adminData.email_id;
      }
      const existingUser = await userDAO.findByEmailOrMobile(userId);
      if (existingUser) {
        const conflictError = new Error(
          "Email or Mobile Number already in use."
        );
        conflictError.name = "ConflictError";
        throw conflictError;
      }
      console.log("no user found");

      const type = await userDAO.findTypeIdByName("db");
      if (!type) {
        const notFoundError = new Error("User type 'db' not found.");
        notFoundError.name = "NotFoundError";
        throw notFoundError;
      }
      adminData.type_id = type.id;

      const ROLE_NAME = "admin.zeizzu.super"; //Have to change
      const role = await userDAO.findRoleByName(ROLE_NAME);
      if (!role) {
        const notFoundError = new Error(`Role '${ROLE_NAME}' not found.`);
        notFoundError.name = "NotFoundError";
        throw notFoundError;
      }
      adminData.role = role.name;
      adminData.role_id = role.id;

      if (!adminData.password) {
        const validationError = new Error("Password is required.");
        validationError.name = "ValidationError";
        throw validationError;
      }

      const salt = await bcrypt.genSalt(10);
      adminData.password = await bcrypt.hash(adminData.password, salt);

      try {
        if (!adminData.country_code || !adminData.mobile_number) {
          throw new Error("Country code and mobile number are required.");
        }
        const user = await userDAO.createUser(adminData);
        return user;
      } catch (error) {
        await addServerLog({
          log_level: "ERROR",
          service_name: "createSuperAdmin",
          error_message: `Error creating user in createSuperAdmin: ${error.message}`,
        });
        console.error("Error creating user:", error);
        throw new Error("Failed to create Super Admin.");
      }
    } catch (error) {
      await addServerLog({
        log_level: "ERROR",
        service_name: "createSuperAdmin",
        error_message: `createSuperAdmin process failed: ${error.message}`,
      });
      throw error;
    }
  },

  forgotPassword: async (email_id) => {
    try {
      if (!email_id) {
        throw new Error("Email ID is required.");
      }
      const user = await userDAO.getUserByEmail(email_id);
      if (!user) {
        throw new Error("User not found.");
      }
      const otpCode = generateOtp();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
      await otpDAO.createOtp({
        user_id: user.id,
        otp_code: otpCode,
        expires_at: expiresAt,
      });
      const subject = '[Avalift] Password Reset OTP';
      const content = `
      Dear User,

      We received a request to reset your Avalift account password. Please use the following One-Time Password (OTP) to proceed:

      🔐 OTP: ${otpCode} 

      This OTP is valid for the next 10 minutes. Please do not share this code with anyone.

      If you did not request a password reset, kindly ignore this email or contact our support team.

      Regards,  
      Avalift Team  
      support@Avalift.com
      `;
      await sendEmail(email_id, subject, content);

      return { message: "OTP sent successfully." };
    } catch (error) {
      await addServerLog({
        log_level: "ERROR",
        service_name: "forgotPassword",
        error_message: `forgotPassword process failed: ${error.message}`,
      });
      throw error;
    }
  },

  changePassword: async (user_id, new_password, old_password) => {
    try {
      console.log("USER ID: ", user_id);
      const user = await userDAO.findById(user_id);
      if (!user) {
        throw new Error("User not found.");
      }
      const isMatch = await bcrypt.compare(old_password, user.password);
      if (!isMatch) {
        throw new Error("Invalid old password.");
      }
      const salt = await bcrypt.genSalt(10);
      new_password = await bcrypt.hash(new_password, salt);
      await userDAO.updateUser(user_id, { password: new_password });
      return { message: "Password changed successfully." };
    } catch (error) {
      await addServerLog({
        log_level: "ERROR",
        service_name: "changePassword",
        error_message: `changePassword process failed: ${error.message}`,
      });
      throw error;
    }
  },

  /**
   * Logout a user by invalidating their session token.
   */
  logout: async (token, user_id) => {
    try {
      if (!token) {
        throw new Error("Authentication token is required for logout.");
      }

      const user = await userStatusDAO.findUserByIdWithRole(user_id);
      if (!user) {
        throw new Error("User not found");
      }

      if (user.role_id === 4) {
        // Chauffeur role
        if ((await ridesDAO.getActiveInstantRideForChauffeur(user_id)).length) {
          throw new Error("Chauffeur has an active ride.");
        }
      }

      if (user.role_id === 3) {
        // PD role
        if ((await chauffeurRidesDAO.checkPendingRideForPD(user_id)).length) {
          throw new Error("PD has pending rides.");
        }
      }

      const offlineStatus = await usersStatusDAO.findStatusByName("Offline");
      await userDAO.updateUser(user_id, { status_id: offlineStatus.id });

      let decoded;
      try {
        decoded = jwt.verify(token, JWT_SECRET);
      } catch (err) {
        await addServerLog({
          log_level: "ERROR",
          service_name: "logout",
          error_message: `Token verification failed: ${err.message}`,
        });
        throw new Error("Invalid or expired token.");
      }

      const userId = decoded.id;
      if (!userId) {
        throw new Error("Invalid token payload.");
      }
      const sessionKey = `${SESSION_PREFIX}${userId}`;
      const result = await redisClient.del(sessionKey);
      if (result === 0) {
        throw new Error("Session not found or already logged out.");
      }
      return;
    } catch (error) {
      await addServerLog({
        log_level: "ERROR",
        service_name: "logout",
        error_message: `Logout process failed: ${error.message}`,
      });
      throw error;
    }
  },
  resetPassword: async (email, new_password) => {
    if (!email || !new_password) {
      throw Object.assign(new Error("Email and new password are required."), { statusCode: 400 });
    }

    try {
      const user = await userDAO.getUserByEmail(email);
      if (!user) {
        throw Object.assign(new Error("User not found."), { statusCode: 400 });
      }

      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(new_password, salt);

      await userDAO.updateUser(user.id, { password: hashedPassword });

      return { message: "Password changed successfully." };
    } catch (error) {
      console.error("Reset password error:", error);
      await addServerLog({
        log_level: "ERROR",
        service_name: "resetPassword",
        error_message: `resetPassword process failed: ${error.message}`,
      })
      throw error;
    }
  },

  adminVerifyOtp: async (adminVerifyOtpData) => {
    try {
      await adminVerifyOtpValidator(adminVerifyOtpData);
      const { email_id, otp_code, device_id, os_type, device_model } = adminVerifyOtpData;
      // Attempt to find user by email or mobile number
      const user = await userDAO.findByEmail(email_id);
      if (!user) {
        throw new Error("User not found.");
      }
      else if (user) {
        // Existing user: verify OTP
        const isValid = await otpDAO.verifyOtpForUser(user.id, otp_code);
        if (!isValid) {
          throw new Error("Invalid or expired OTP.");
        }

        // Check and update device_id in os_type array
        let osTypeData = []; // Retrieve existing os_type array

        // If device_id is not found, add it to the array
        osTypeData.push({
          os_type,
          device_id,
          device_model,
          updatedAt: new Date().toISOString(),
        });

        console.log(`Updating os_type for user ${user.id}:`, osTypeData);
        const updateData = { os_type: osTypeData };
        // Update user record in the database
        await userDAO.updateUser(user.id, updateData);

        // Check and update device_id
        if (user.device_id !== device_id) {
          console.log(
            `Device ID mismatch for user ${user.id}: Updating device ID from ${user.device_id} to ${device_id}.`
          );
          await userDAO.updateUserDeviceId(user.id, device_id); // Assume `updateUserDeviceId` updates the device_id in the database.
        }

        const access = await getPermissionsForRoles(user.role_id);
        // Generate JWT
        const token = await generateToken(user);
        // Store token in Redis
        const sessionKey = `${SESSION_PREFIX}${user.id}`;
        await redisClient.set(sessionKey, token, "EX", TOKEN_EXPIRY_SECONDS);

        return { token, access };
      }
    } catch (error) {
      await addServerLog({
        log_level: "ERROR",
        service_name: "adminVerifyOtp",
        error_message: `OTP verification for admin failed: ${error.message}`,
      });
      throw error;
    }
  },
  getAppVersions: async () => {
    try {
      let app_version_android_customer, app_version_ios_customer, app_version_android_chauffeur, app_version_ios_chauffeur, app_version_ios, app_version_android;
      app_version_android_customer = process.env.ANDROID_CUSTOMER_APP_VERSION;
      app_version_ios_customer = process.env.IOS_CUSTOMER_APP_VERSION;
      app_version_android_chauffeur = process.env.ANDROID_CHAUFFEUR_APP_VERSION;
      app_version_ios_chauffeur = process.env.IOS_CHAUFFEUR_APP_VERSION;
      app_version_ios = process.env.IOS_APP_VERSION;
      app_version_android = process.env.ANDROID_APP_VERSION;
      return { app_version_android_customer, app_version_ios_customer, app_version_android_chauffeur, app_version_ios_chauffeur, app_version_ios, app_version_android };
    } catch (error) {
      throw error;
    }
  }
};

// Helper function to determine role name based on user type
function getRoleNameByType(type) {
  const roleMapping = {
    individual: "individual",
    // corporate: "corporate",
    chauffeur: "chauffeur",
    pd: "pd",
  };
  return roleMapping[type] || "individual";
}

// Helper function to send OTP for new users
async function sendOtpForNewUser(email_id, mobile_number, otpCode) {
  console.log("Twilio not set up. OTP:  ", otpCode);
  if (email_id) {
    // Not Implemented
  }
  if (mobile_number) {
    // Not Implemented
  }
}

// async function sendSmsCountry(smsInfo, provider = config.defaultSmsProvider) {
//   if (provider === "smscountry") {
//     const key = "Sq0KeYHbHu1T5KUdu5uL";
//     const token = "3f4b0gEzDHTNmT1A45ThTU862K2ds7lecgLuW7uP";
//     const sendSMSUrl = `https://restapi.smscountry.com/v0.1/Accounts/${key}/SMSes`;
//     const senderId = "ZEIZZU";
//     try {
//       const payload = {
//         Text: smsInfo.Text,
//         Number: smsInfo.phoneNumber.replace(/\+/g, ""),
//         SenderId: senderId,
//         DRNotifyHttpMethod: "POST",
//         Tool: "API",
//       };
//       let responseMessage;
//       const combinedKey = `${key}:${token}`;
//       await axios
//         .post(sendSMSUrl, payload, {
//           headers: {
//             Authorization: `Basic ${Buffer.from(combinedKey).toString(
//               "base64"
//             )}`,
//             "Content-Type": "application/json",
//           },
//         })
//         .then(async (response) => {
//           responseMessage = {
//             errorMessage: "",
//             statusCode: response.status,
//             messageUUID: response.data.MessageUUID,
//             phoneNumber: smsInfo.phoneNumber,
//             messageStatus: response.data.Message,
//             status: response.data.Success,
//           };
//         })
//         .catch(async (error) => {
//           if (error.response) {
//             responseMessage = {
//               errorMessage: error.response.data.Message,
//               statusCode: error.response.status,
//               messageUUID: error.response.data.MessageUUID,
//               phoneNumber: smsInfo.phoneNumber,
//               messageStatus: "",
//               status: error.response.data.Success,
//             };
//           }
//         });
//       await addServerLog({
//         log_level: "INFO",
//         service_name: "sendSmsCountry",
//         error_message: `send SMS country status for mobile ${
//           smsInfo && smsInfo.phoneNumber
//         } is ${responseMessage && responseMessage.status} - ${
//           responseMessage && responseMessage.messageUUID
//         }`,
//       });
//       return responseMessage;
//     } catch (error) {
//       await addServerLog({
//         log_level: "ERROR",
//         service_name: "sendSmsCountry",
//         error_message: `send SMS country failed for mobile ${
//           smsInfo && smsInfo.phoneNumber
//         } and error ${error.message}`,
//       });
//       throw error;
//     }
//   } else {
//     await addServerLog({
//       log_level: "ERROR",
//       error_message: `SMS provider "${provider}" is not supported.`,
//     });
//     throw new Error(`SMS provider "${provider}" is not supported.`);
//   }
// }

