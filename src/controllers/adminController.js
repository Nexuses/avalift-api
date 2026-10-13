const { updateUserProfile } = require("../dao/userProfilesDAO");
const userService = require("../services/userService");
const chauffeurService = require("../services/chauffeurAdminPanelService");
const validator = require("../validators/rideRequestValidator");
const adminRideServices = require("../services/adminRideServices");
const adminPanelNotificationDataBuilder = require("../services/adminPanelNotificationDataBuilder");
const { customerUpdateValidator,validateCreateRole,validateCreatePolicy,validateAssociatePolicies,validateDeassociatePolicies } = require("../validators/adminValidator");
const chauffeurCustomerRidesService = require("../services/chauffeurCustomerRidesService");
const paymentsService = require("../services/paymentsService");
const chauffeurAdminPanelService = require("../services/chauffeurAdminPanelService");
const s3 = require('../config/s3Client');
require("dotenv").config();
const rideExportService = require("../services/rideExportService");
const { addServerLog } = require("../services/serverLogsService"); // Adjust path if needed
const userProfileService = require("../services/userProfilesService");
const authService = require("../services/authService");
const {  PutObjectCommand } = require('@aws-sdk/client-s3');
const vehicleDAO = require("../dao/vehicleDAO");
const UserProfileDAO = require("../dao/userProfilesDAO");
const roleService = require("../services/roleService");
const usersStatusService = require("../services/usersStatusService");

module.exports = {

  createPdChauffeurUser: async (req, res) => {
    try {
      // Check if files were uploaded
      if (!req.files || req.files.length === 0) {
        return res.status(400).json({
          success: false,
          status: 400,
          message: "No documents uploaded.",
        });
      }
  
      const BUCKET_NAME = process.env.S3_BUCKET;
      const FOLDER_NAME = 'pd/chauffeur-documents';
  
      if (!BUCKET_NAME) {
        throw new Error("S3_BUCKET environment variable is not set.");
      }
  
      // Upload documents to S3
      const uploadedDocuments = [];
  
      for (const file of req.files) {
        const docType = file.fieldname;
  
        if (!file.buffer) {
          throw new Error(`Missing buffer for ${docType}`);
        }
  
        const extension = file.originalname.split('.').pop();
        const fileKey = `${FOLDER_NAME}/${Date.now()}-${docType}.${extension}`;
  
        const command = new PutObjectCommand({
          Bucket: BUCKET_NAME,
          Key: fileKey,
          Body: file.buffer,
          ContentType: file.mimetype,
        });
  
        await s3.send(command);
  
        uploadedDocuments.push({
          type: docType,
          name: file.originalname,
          url: `https://${BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${fileKey}`,
        });
      }
  
      // Create the user and attach the documents
      const newUser = await userService.createChauffeurOrPd(
        req.body,
        uploadedDocuments,
        req.body.is_salaried
      );
  
      console.log("req body:", req.body);
      console.log("newUser:", newUser);
  
      const { user } = newUser;
      const userProfile = user.userProfile || {};
  
      res.status(201).json({
        success: true,
        status: 201,
        message: newUser.message,
        user: {
          id: user.id,
          country_code: user.country_code,
          mobile_number: user.mobile_number,
          first_name: user.first_name,
          last_name: user.last_name,
          role_id: user.role_id,
          email_id: user.email_id,
          emirates_id: userProfile.emirates_id || null,
          emiratesId_validity: userProfile.emirates_id_validity || null,
          licence_number: userProfile.licence_number || null,
          licence_validity: userProfile.licence_validity || null,
          is_salaried: user.is_salaried || false,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
          documents: uploadedDocuments,
        },
      });
    } catch (error) {
      console.error("Error creating pd/chauffeur user:", error.message);
      await addServerLog({
        log_level: "ERROR",
        service_name: "createPdChauffeurUser",
        error_message: `createPdChauffeurUser Controller error - ${error.message}.`
      });
      res.status(error.statusCode || 400).json({
        success: false,
        status: error.statusCode || 400,
        message: "Failed to create pd/chauffeur user.",
        error: error.message,
      });
    }
  },

  updatePdChauffeurUser: async (req, res) => {
    try {
      const userId = req.params.userId;
      const data = req.body;
      const is_salaried = data.is_salaried;
  
      if (!userId) {
        return res.status(400).json({
          success: false,
          status: 400,
          message: "User ID is required for updating.",
        });
      }
  
      console.log("userid:", userId);
      console.log("req.files:", req.files);
  
      const allFiles = Object.values(req.files || {}).flat();
  
      if (allFiles.length > 10) {
        return res.status(400).json({
          success: false,
          status: 400,
          message: "You can only upload up to 10 documents.",
        });
      }
  
      const BUCKET_NAME = process.env.S3_BUCKET;
      if (!BUCKET_NAME) {
        throw new Error("S3_BUCKET_NAME is not defined in environment variables.");
      }
  
      console.log("S3_BUCKET_NAME:", BUCKET_NAME);
      console.log("AWS_REGION:", process.env.AWS_REGION);
  
      // Get existing user documents
      const profile = await UserProfileDAO.getUserProfile(userId);
      const existingDocs = profile.documents || [];
  
      const docMap = new Map(existingDocs.map(doc => [doc.type, doc]));
  
      const FOLDER_NAME = 'pd/chauffeur-documents';
  
      for (const file of allFiles) {
        const docType = file.fieldname;
  
        console.log("Processing file:", {
          type: docType,
          originalname: file.originalname,
          mimetype: file.mimetype,
          bufferExists: !!file.buffer,
        });
  
        if (!file.buffer) {
          throw new Error(`File buffer is missing for document type: ${docType}`);
        }
  
        const extension = file.originalname.split('.').pop();
        const fileKey = `${FOLDER_NAME}/${userId}/${docType}-${Date.now()}.${extension}`;
  
        const command = new PutObjectCommand({
          Bucket: BUCKET_NAME,
          Key: fileKey,
          Body: file.buffer,
          ContentType: file.mimetype,
        });
  
        await s3.send(command);
  
        docMap.set(docType, {
          type: docType,
          name: file.originalname,
          url: `https://${BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${fileKey}`,
        });
      }
  
      const mergedDocuments = Array.from(docMap.values());
  
      const updatedUser = await userService.updateChauffeurOrPd(
        userId,
        data,
        mergedDocuments,
        is_salaried
      );
  
      return res.status(200).json({
        success: true,
        status: 200,
        message: updatedUser.message,
        user: {
          id: updatedUser.user.id,
          mobile_number: updatedUser.user.mobile_number,
          first_name: updatedUser.user.first_name,
          last_name: updatedUser.user.last_name,
          country_code: updatedUser.user.country_code,
          email_id: updatedUser.user.email_id,
          emirates_id: updatedUser.user.emiratesId || null,
          emiratesId_validity: updatedUser.user.emiratesIdValidity || null,
          licence_number: updatedUser.user.licenceNumber || null,
          licence_validity: updatedUser.user.licenceValidity || null,
          is_salaried: updatedUser.user.is_salaried || null,
          updatedAt: updatedUser.user.updatedAt,
          documents: mergedDocuments,
        },
      });
    } catch (error) {
      console.error("Error updating pd/chauffeur user:", error.message);
      await addServerLog({
        log_level: "ERROR",
        service_name: "updatePdChauffeurUser",
        error_message: `updatePdChauffeurUser Controller error - ${error.message}`,
      });
      return res.status(error.statusCode || 500).json({
        success: false,
        status: error.statusCode || 500,
        message: error.message || "Internal server error while updating user.",
      });
    }
  },

  createCustomer: async (req, res) => {
    try {
      const { first_name, last_name, email_id, role, mobile_number, country_code } = req.body;
      if (!first_name || !last_name || !mobile_number || !role || !country_code) {
        return res.status(400).json({
          success: false,
          status: 400,
          message: "Missing required fields: first_name, last_name, mobile_number, or role",
        });
      }
      const newCustomer = await userService.createCustomer(req.body);
      return res.status(201).json({
        success: true,
        status: 201,
        message: "Customer created successfully.",
        data: {
          id: newCustomer.id,
          mobile_number: newCustomer.mobile_number,
          email_id: newCustomer.email_id,
          first_name: newCustomer.first_name,
          last_name: newCustomer.last_name,
          createdAt: newCustomer.createdAt,
          updatedAt: newCustomer.updatedAt,
        },
      });
    } catch (error) {
      console.error("Error in createCustomer controller:", error.message);
      await addServerLog({
        log_level: "ERROR",
        service_name: "createCustomer",
        error_message: `createCustomer Controller error - ${error.message}.`
      });
      const status = error.status || 500;
      return res.status(status).json({
        success: false,
        status: status,
        message: error.message || "An error occurred while creating the customer.",
      });
    }
  },

  updateCustomer: async (req, res) => {
    try {
      const userId = req.params.customer_id;
      if (!userId) {
        return res.status(400).json({
          success: false,
          status: 400,
          message: "User ID is required",
        });
      }
      const updatedFields = req.body;
      await customerUpdateValidator(updatedFields);
      const updatedUser = await userService.updateCustomer(userId, updatedFields);
      return res.status(200).json({
        success: true,
        status: 200,
        message: "User updated successfully",
        updatedUser,
      });
    } catch (error) {
      console.error("Error updating user:", error.message);
      if (error.message.includes("User doesn't exist")) {
        return res.status(404).json({
          success: false,
          status: 404,
          message: "User doesn't exist",
        });
      }
      if (error.message.includes("already existing")) {
        return res.status(409).json({
          success: false,
          status: 409,
          message: error.message,
        });
      }
      await addServerLog({
        log_level: "ERROR",
        service_name: "updateCustomer",
        error_message: `updateCustomer Controller error - ${error.message}.`
      });
      return res.status(500).json({
        success: false,
        status: 500,
        message: "Error updating user",
        error: error.message,
      });
    }
  },

  assignChauffeurToRide: async (req, res) => {
    const { ride_id } = req.params;
    const { chauffeur_id, customer_id } = req.body;
    const { error } = validator.assignChauffeurSchema(ride_id, chauffeur_id, customer_id);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }
    try {
      const ride = await chauffeurService.assignChauffeurToRide(ride_id, chauffeur_id, customer_id);
      res.status(201).json({
        success: true,
        status: 200,
        message: `Chauffeur ${chauffeur_id} assigned to ride ${ride_id} successfully.`,
        ride,
      });
    } catch (error) {
      console.error("Error assigning chauffeur:", error.message);
      await addServerLog({
        log_level: "ERROR",
        service_name: "assignChauffeurToRide",
        error_message: `assignChauffeurToRide Controller error - ${error.message}.`
      });
      res.status(error.statusCode || 400).json({
        success: false,
        status: error.statusCode || 400,
        message: "Failed to assign chauffeur.",
        error: error.message,
      });
    }
  },

  reassignChauffeurToRide: async (req, res) => {
    const { ride_id } = req.params;
    const { chauffeur_id, customer_id } = req.body;
    const { error } = validator.assignChauffeurSchema(ride_id, chauffeur_id, customer_id);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }
    try {
      const ride = await chauffeurService.reassignChauffeurToRide(ride_id, chauffeur_id, customer_id);
      res.status(201).json({
        success: true,
        status: 200,
        message: `Chauffeur ${chauffeur_id} re-assigned to ride ${ride_id} successfully.`,
        ride,
      });
    } catch (error) {
      console.error("Error re-assigning chauffeur:", error.message);
      await addServerLog({
        log_level: "ERROR",
        service_name: "reassignChauffeurToRide",
        error_message: `reassignChauffeurToRide Controller error - ${error.message}.`
      });
      res.status(error.statusCode || 400).json({
        success: false,
        status: error.statusCode || 400,
        message: "Failed to re-assign chauffeur.",
        error: error.message,
      });
    }
  },

  adminCreateRide: async (req, res) => {
    try {
      const { user_id } = req.params;
      const org_id = req.user.organization_id;
      const rideResponse = await adminRideServices.createRide(req.body, user_id, org_id);
      res.status(201).json({
        success: true,
        status: 200,
        message: `Ride created successfully for customer ${user_id}.`,
        rideResponse,
      });
    } catch (error) {
      console.error("Error creating ride:", error.message);
      await addServerLog({
        log_level: "ERROR",
        service_name: "adminCreateRide",
        error_message: `adminCreateRide Controller error - ${error.message}.`
      });
      res.status(error.statusCode || 400).json({
        success: false,
        status: error.statusCode || 400,
        details: error.details || [],
        error: error.message,
      });
    }
  },


  organisationAdminCreateRide: async (req, res) => {
    try {
      const org_id = req.user.organization_id;
      const user_id = req.user.id;

      const rideResponse = await adminRideServices.createOrgRide(req.body, user_id, org_id);
      res.status(201).json({
        success: true,
        status: 200,
        message: `Ride created successfully for organisation user ${user_id}.`,
        rideResponse,
      });
    } catch (error) {
      console.error("Error creating ride:", error.message);
      await addServerLog({
        log_level: "ERROR",
        service_name: "organisationAdminCreateRide",
        error_message: `organisationAdminCreateRide Controller error - ${error.message}.`
      });
      res.status(error.statusCode || 400).json({
        success: false,
        status: error.statusCode || 400,
        details: error.details || [],
        error: error.message,
      });
    }
  },


  adminCancelRide: async (req, res) => {
    try {
      const user_id = req.user.id;
      const rideResponse = await adminRideServices.cancelRide(req.body,user_id);
      res.status(200).json({
        success: true,
        status: 200,
        message: "Ride cancelled successfully!",
        rideResponse,
      });
    } catch (error) {
      console.error("Error cancelling ride:", error.message);
      await addServerLog({
        log_level: "ERROR",
        service_name: "adminCancelRide",
        error_message: `adminCancelRide Controller error - ${error.message}.`
      });
      res.status(error.statusCode || 400).json({
        success: false,
        status: error.statusCode || 400,
        message: "Failed to cancel the ride",
        error: error.message,
      });
    }
  },

  adminMarkChauffeurReached: async (req, res) => {
    try {
      const { customer_id, ride_id } = req.body;
      const result = await adminRideServices.adminMarksChauffeurReachedService(
        ride_id,
        customer_id,
      );
      return res.status(200).json({
        success: true,
        status: 200,
        data: { ride_id: result.ride?.ride_id },
        message: result.message,
      });
    } catch (error) {
      console.error("Error marking chauffeur as reached:", error.message);
      await addServerLog({
        log_level: "ERROR",
        service_name: "adminMarkChauffeurReached",
        error_message: `adminMarkChauffeurReached Controller error - ${error.message}.`
      });
      res.status(error.statusCode || 500).json({
        success: false,
        status: error.statusCode || 500,
        message: error.message || "Internal Server Error",
      });
    }
  },

  adminMarkChauffeurOnTheWay: async (req, res) => {
    try {
      const { customer_id, ride_id } = req.body;
      const result = await adminRideServices.adminMarksChauffeurOnTheWayService(
        ride_id,
        customer_id,
      );
      return res.status(200).json({
        success: true,
        status: 200,
        data: { ride_id: result.ride?.ride_id },
        message: result.message,
      });
    } catch (error) {
      console.error("Error marking chauffeur as on the way:", error.message);
      await addServerLog({
        log_level: "ERROR",
        service_name: "adminMarkChauffeurOnTheWay",
        error_message: `adminMarkChauffeurOnTheWay Controller error - ${error.message}.`
      });
      res.status(error.statusCode || 500).json({
        success: false,
        status: error.statusCode || 500,
        message: error.message || "Internal Server Error",
      });
    }
  },

  adminStartCustomerRide: async (req, res) => {
    try {
      const { ride_id, customer_id } = req.body;
      const response = await adminRideServices.adminStartsCustomerRide(ride_id, customer_id);
      res.status(200).json({
        success: true,
        status: 200,
        message: response.message,
        data: {},
      });
    } catch (error) {
      console.error("Error in adminStartCustomerRide controller:", error.message);
      await addServerLog({
        log_level: "ERROR",
        service_name: "adminStartCustomerRide",
        error_message: `adminStartCustomerRide Controller error - ${error.message}.`
      });
      res.status(error.statusCode || 500).json({
        success: false,
        status: error.statusCode || 500,
        message: error.message,
        details: error.details || [],
      });
    }
  },

  adminCompleteCustomerRide: async (req, res) => {
    const { ride_id, customer_id } = req.body;
    const end_time = new Date();
    try {
      await adminRideServices.adminInitiatesCustomerRidePaymentService(ride_id, customer_id, end_time);
      res.status(200).json({
        success: true,
        status: 200,
        message: "Payment initiated successfully.",
      });
    } catch (error) {
      console.error("Error in adminCompleteCustomerRide controller:", error.message);
      await addServerLog({
        log_level: "ERROR",
        service_name: "adminCompleteCustomerRide",
        error_message: `adminCompleteCustomerRide Controller error - ${error.message}.`
      });
      res.status(error.statusCode || 500).json({
        success: false,
        status: error.statusCode || 500,
        message: error.message || "Internal Server Error",
        details: error.details || [],
      });
    }
  },

  getRideByStatus: async (req, res) => {
    try {
      const { status } = req.body;
      const rides = await adminRideServices.fetchRideByStatus(status);
      res.status(200).json({
        success: true,
        status: 200,
        message: `Rides with status ${status} fetched successfully!`,
        rides,
      });
    } catch (error) {
      console.error("Error in getRideByStatus controller:", error.message);
      await addServerLog({
        log_level: "ERROR",
        service_name: "getRideByStatus",
        error_message: `getRideByStatus Controller error - ${error.message}.`
      });
      res.status(error.statusCode || 400).json({
        success: false,
        status: error.statusCode || 400,
        message: "Failed to fetch the ride",
        error: error.message,
      });
    }
  },

  adminNotificationListing: async (req, res) => {
    try {
      const adminId = req.user.id;
      const { page, limit } = req.params;
      if (!adminId) {
        return res.status(400).json({
          success: false,
          status: 400,
          error: "admin ID is required",
        });
      }
      const pageNumber = Math.max(1, parseInt(page, 10));
      const pageSize = Math.max(1, parseInt(limit, 10));
      const notifications = await adminPanelNotificationDataBuilder.adminNotifications(adminId, pageNumber, pageSize);
      return res.status(200).json({
        success: true,
        status: 200,
        data: notifications,
      });
    } catch (error) {
      console.error("Error fetching notifications:", error.message);
      await addServerLog({
        log_level: "ERROR",
        service_name: "adminNotificationListing",
        error_message: `adminNotificationListing Controller error - ${error.message}.`
      });
      res.status(500).json({
        success: false,
        status: 500,
        message: "Failed to fetch notifications",
        error: error.message,
      });
    }
  },

  fetchFare: async (req, res) => {
    try {
      const fares = await adminRideServices.fetchFares();
      return res.status(200).json({
        success: true,
        status: 200,
        message: "Fares fetched successfully",
        fares,
      });
    } catch (error) {
      console.error("Error fetching fares:", error.message);
      await addServerLog({
        log_level: "ERROR",
        service_name: "fetchFare",
        error_message: `fetchFare Controller error - ${error.message}.`
      });
      res.status(500).json({
        success: false,
        status: 500,
        message: "Failed to fetch fares",
        error: error.message,
      });
    }
  },

  fetchUserLogSummary: async (req, res) => {
    try {
      const userLogSummary = await chauffeurAdminPanelService.fetchUserLogSummary(req.body);
      return res.status(200).json({
        success: true,
        status: 200,
        message: "User log summary fetched successfully",
        userLogSummary,
      });
    } catch (error) {
      console.error("Error fetching user log summary:", error.message);
      await addServerLog({
        log_level: "ERROR",
        service_name: "fetchUserLogSummary",
        error_message: `fetchUserLogSummary Controller error - ${error.message}.`
      });
      res.status(500).json({
        success: false,
        status: 500,
        message: "Failed to fetch user log summary",
        error: error.message,
      });
    }
  },

  deleteUser: async (req, res) => {
    try {
      const { user_id } = req.body;
      const user = await userService.adminDeleteUser(user_id);
      return res.status(200).json({
        success: true,
        status: 200,
        message: "User deleted successfully",
        user,
      });
    } catch (error) {
      console.error("Error deleting user:", error.message);
      await addServerLog({
        log_level: "ERROR",
        service_name: "deleteUser",
        error_message: `deleteUser Controller error - ${error.message}.`
      });
      const statusCode = error.status || error.statusCode || 500;
      return res.status(statusCode).json({
        success: false,
        status: statusCode,
        message: "Failed to delete user",
        error: error.message || "An unknown error occurred",
      });
    }
  },

  fetchAvailableAdminRoles: async (req, res) => {
    try {
      const availableAdminRoles = await userService.getAdminUserTypes();
      return res.status(200).json({
        success: true,
        status: 200,
        message: "Available admin roles fetched successfully",
        data: availableAdminRoles,
      });
    } catch (error) {
      console.error("Error fetching available admin roles:", error.message);
      await addServerLog({
        log_level: "ERROR",
        service_name: "fetchAvailableAdminRoles",
        error_message: `fetchAvailableAdminRoles Controller error - ${error.message}.`
      });
      res.status(500).json({
        success: false,
        status: 500,
        message: "Failed to fetch available admin roles",
        error: error.message,
      });
    }
  },

  createAdminUser: async (req, res) => {
    try {

      //console.log("user check:", req.user);
      const role_id = req.user.role_id;
      const response = await userService.createAdminUsers(req.body, role_id);
      if (response.error) {
        return res.status(response.status).json({
          success: false,
          status: response.status,
          message: response.message,
        });
      }
      return res.status(201).json({
        success: true,
        status: 201,
        message: "User created successfully",
        data: response.data,
      });
    } catch (error) {
      console.error("Unexpected error creating admin user:", error.message);
      await addServerLog({
        log_level: "ERROR",
        service_name: "createAdminUser",
        error_message: `createAdminUser Controller error - ${error.message}.`
      });
      return res.status(500).json({
        success: false,
        status: 500,
        message: "An unexpected error occurred",
      });
    }
  },

  updateAdminUser: async (req, res) => {
    try {
      const { id } = req.params;
      const role_id = req.user.role_id;
      const response = await userService.updateAdminUser(id, req.body, role_id);
      if (response.error) {
        return res.status(response.status).json({
          success: false,
          status: response.status,
          message: response.message,
        });
      }
      return res.status(200).json(response);
    } catch (error) {
      console.error("Unexpected error updating admin user:", error.message);
      await addServerLog({
        log_level: "ERROR",
        service_name: "updateAdminUser",
        error_message: `updateAdminUser Controller error - ${error.message}.`
      });
      return res.status(500).json({
        success: false,
        status: 500,
        message: "An unexpected error occurred",
      });
    }
  },

  getAdminUsersById: async (req, res) => {
    try {
      const { id } = req.params;
      const response = await userService.findAdminUserById(id);
      if (response.error) {
        return res.status(response.status).json({
          success: false,
          status: response.status,
          message: response.message,
        });
      }
      return res.status(200).json({
        success: true,
        status: 200,
        message: "Admin user fetched successfully",
        data: response.data,
      });
    } catch (error) {
      console.error("Unexpected error fetching admin user:", error.message);
      await addServerLog({
        log_level: "ERROR",
        service_name: "getAdminUsersById",
        error_message: `getAdminUsersById Controller error - ${error.message}.`
      });
      return res.status(500).json({
        success: false,
        status: 500,
        message: "An unexpected error occurred",
      });
    }
  },

  getAdminUsers: async (req, res) => {
    try {
      const response = await userService.listAdminUsers();
      if (response.error) {
        return res.status(response.status).json({
          success: false,
          status: response.status,
          message: response.message,
        });
      }
      return res.status(200).json({
        success: true,
        status: 200,
        message: "Admin users fetched successfully",
        data: response.data,
      });
    } catch (error) {
      console.error("Unexpected error fetching admin users:", error.message);
      await addServerLog({
        log_level: "ERROR",
        service_name: "getAdminUsers",
        error_message: `getAdminUsers Controller error - ${error.message}.`
      });
      return res.status(500).json({
        success: false,
        status: 500,
        message: "An unexpected error occurred",
      });
    }
  },

  deleteAdminUser: async (req, res) => {
    try {
      const { id } = req.params;
      const role_id = req.user.role_id;
      const user_id = req.user.id;
      const response = await userService.softDeleteAdminUser(id, role_id, user_id);
      if (response.error) {
        return res.status(response.status).json({
          success: false,
          status: response.status,
          message: response.message,
        });
      }
      return res.status(200).json({
        success: true,
        status: 200,
        message: "User deleted successfully",
      });
    } catch (error) {
      console.error("Unexpected error deleting admin user:", error.message);
      await addServerLog({
        log_level: "ERROR",
        service_name: "deleteAdminUser",
        error_message: `deleteAdminUser Controller error - ${error.message}.`
      });
      return res.status(500).json({
        success: false,
        status: 500,
        message: "An unexpected error occurred",
      });
    }
  },

  adminCreateScheduledRide: async (req, res) => {
    try {
      const { user_id } = req.params;
      const org_id = req.user.organization_id;
      const rideResponse = await adminRideServices.scheduleRideFromAdmin(req.body, user_id, org_id);
      res.status(201).json({
        success: true,
        status: 200,
        message: `scheduled ride created successfully for customer ${user_id}.`,
        rideResponse,
      });
    } catch (error) {
      console.error("Error creating ride:", error.message);
      await addServerLog({
        log_level: "ERROR",
        service_name: "adminCreateRide",
        error_message: `adminCreateRide Controller error - ${error.message}.`
      });
      res.status(error.statusCode || 400).json({
        success: false,
        status: error.statusCode || 400,
        details: error.details || [],
        error: error.message,
      });
    }
  },

  adminReScheduleRide: async(req, res) => {
    try {
      const org_id = req.user.organization_id;
      const rideResponse = await adminRideServices.rescheduleRideFromAdmin(req.body, org_id);
      res.status(201).json({
        success: true,
        status: 200,
        message: `ride re scheduled successfully.`,
        rideResponse,
      });
    } catch (error) {
      console.error("Error creating ride:", error.message);
      await addServerLog({
        log_level: "ERROR",
        service_name: "adminCreateRide",
        error_message: `adminCreateRide Controller error - ${error.message}.`
      });
      res.status(error.statusCode || 400).json({
        success: false,
        status: error.statusCode || 400,
        details: error.details || [],
        error: error.message,
      });
    }
  },
  getCommission: async(req, res) => {
    try {

      const commission = await userProfileService.getCommission(req.body, req.params);
      res.status(200).json({
        success: true,
        status: 200,
        message: `Commission fetched successfully.`,
        commission,
      });
    } catch (error) {
      console.error("Error creating ride:", error.message);
      await addServerLog({
        log_level: "ERROR", 
        service_name: "getCommission",
        error_message: `getCommission Controller error - ${error.message}.`
      });
      res.status(error.statusCode || 500).json({
        success: false,
        status: error.statusCode || 500,
        message: "Error in getting commission",
        error: error.message,
      });
    }
  },
  exportChauffeurWalletLogs: async (req, res) => {
    try {
      const { start_date, end_date } = req.body;
  
      // ✅ Validate Input Dates
      if (!start_date || !end_date) {
        return res.status(400).json({ message: "Start date and end date are required." });
      }

      const logs = await adminRideServices.getChauffeurWalletLogs(start_date, end_date);

      return await rideExportService.exportChauffeurWalletLogsToExcel(logs, res);
      
      
    } catch (error) {
      console.error("Error in exportChauffeurWalletLogs:", error.message);
      await addServerLog({
        log_level: "ERROR",
        service_name: "exportChauffeurWalletLogs",
        error_message: `exportChauffeurWalletLogs Controller error - ${error.message}.`
      });
      return res.status(error.statusCode || 500).json({
        success: false,
        status: error.statusCode || 500,
        message: error.message,
      });
    }
  },
  exportPDWalletLogs: async (req, res) => {
    try {
      const { start_date, end_date } = req.body;
  
      // ✅ Validate Input Dates
      if (!start_date || !end_date) {
        return res.status(400).json({ message: "Start date and end date are required." });
      }

      const logs = await adminRideServices.getPDWalletLogs(start_date, end_date);

      return await rideExportService.exportPDWalletLogsToExcel(logs, res);
      
      
    } catch (error) {
      console.error("Error in exportPDWalletLogs:", error.message);
      await addServerLog({
        log_level: "ERROR",
        service_name: "exportPDWalletLogs",
        error_message: `exportPDWalletLogs Controller error - ${error.message}.`
      });
      return res.status(error.statusCode || 500).json({
        success: false,
        status: error.statusCode || 500,
        message: error.message,
      });
    }
  },
  exportAdminWalletLogs: async (req, res) => {
    try {
      const { start_date, end_date } = req.body;
  
      // ✅ Validate Input Dates
      if (!start_date || !end_date) {
        return res.status(400).json({ message: "Start date and end date are required." });
      }

      const logs = await adminRideServices.getAdminWalletLogs(start_date, end_date);

      return await rideExportService.exportAdminWalletLogsToExcel(logs, res);
      
      
    } catch (error) {
      console.error("Error in exportAdminWalletLogs:", error.message);
      await addServerLog({
        log_level: "ERROR",
        service_name: "exportAdminWalletLogs",
        error_message: `exportAdminWalletLogs Controller error - ${error.message}.`
      });
      return res.status(error.statusCode || 500).json({
        success: false,
        status: error.statusCode || 500,
        message: error.message,
      });
    }
  },
  exportVehicleAudit: async (req, res) => {
    try {
      const { ride_id} = req.body;
  
      // ✅ Validate Input Dates
      if (!ride_id) {
        return res.status(400).json({ message: "Ride id is required." });
      }

      const logs = await adminRideServices.getVehicleAudit(ride_id);

      // return await rideExportService.exportVehicleAuditToExcel(logs, res);
      return res.status(200).json({ success: true, status: 200, message: "success", data: logs });
      
    } catch (error) {
      console.error("Error in exportVehicleAudit:", error.message);
      await addServerLog({
        log_level: "ERROR",
        service_name: "exportVehicleAudit",
        error_message: `exportVehicleAudit Controller error - ${error.message}.`
      });
      return res.status(error.statusCode || 500).json({
        success: false,
        status: error.statusCode || 500,
        message: error.message,
      });
    }
  },

  adminCancelChauffeurPdRide: async (req, res) => {
    try {
      const rideResponse = await adminRideServices.cancelPdRide(req.body);
      res.status(200).json({
        success: true,
        status: 200,
        message: "Ride cancelled successfully!",
        rideResponse,
      });
    } catch (error) {
      console.error("Error cancelling ride:", error.message);
      await addServerLog({
        log_level: "ERROR",
        service_name: "adminCancelRide",
        error_message: `adminCancelRide Controller error - ${error.message}.`
      });
      res.status(error.statusCode || 400).json({
        success: false,
        status: error.statusCode || 400,
        message: "Failed to cancel the ride",
        error: error.message,
      });
    }
  },
  adminResetPassword: async (req, res) => {
    try {
      const { email, password } = req.body;
      const response = await authService.resetPassword(email, password);
      res.status(200).json({ success: true, status: 200, message: response.message });
    } catch (error) {
      console.error("Error in adminResetPassword:", error.message);
      await addServerLog({
        log_level: "ERROR",
        service_name: "adminResetPassword",
        error_message: `adminResetPassword Controller error - ${error.message}.`
      });
      return res.status(error.statusCode || 500).json({
        success: false,
        status: error.statusCode || 500,
        message: error.message,
      });
    }
  },

  adminMakeUserActiveOrInactive: async (req, res) => {
    try {
      const { enable } = req.body;
      const rideResponse = await userProfileService.userActiveInactive(req.body);
      res.status(200).json({
        success: true,
        status: 200,
        message: enable? "User enabled successfully!" : "User disabled successfully!",
        user_availability: rideResponse.user.user_availability,
      });
    } catch (error) {
      console.error("Failed to change user availability:", error.message);
      await addServerLog({
        log_level: "ERROR",
        service_name: "adminMakeUserActiveOrInactive",
        error_message: `admin Controller error - ${error.message}.`
      });
      res.status(error.statusCode || 400).json({
        success: false,
        status: error.statusCode || 400,
        message:  error.message || "Failed to change user availability",
        error: error.message,
      });
    }
  },
  addNewRegion: async (req, res) => {
    try {
      // const { emirate_name, start_code_type, starting_plate_code, ending_plate_code, number_of_digits } = req.body;
      const response = await adminRideServices.addNewRegion(req.body);
      res.status(200).json({ success: true, status: 200, message:'Region added successfully', data: response });
    } catch (error) {
      console.error("Error in addNewRegion Controller:", error.message);
      await addServerLog({
        log_level: "ERROR",
        service_name: "addNewRegion",
        error_message: `addNewRegion Controller error - ${error.message}.`
      });
      return res.status(error.statusCode || 500).json({
        success: false,
        status: error.statusCode || 500,
        message: error.message,
      });
    }
  },
  editRegion: async (req, res) => {
    try {
      const response = await adminRideServices.editRegion(req.body);
      res.status(200).json({ success: true, status: 200, message:'Region updated successfully', data: response });
    } catch (error) {
      console.error("Error in editRegion Controller:", error.message);
      await addServerLog({
        log_level: "ERROR",
        service_name: "editRegion",
        error_message: `editRegion Controller error - ${error.message}.`
      });
      return res.status(error.statusCode || 500).json({
        success: false,
        status: error.statusCode || 500,
        message: error.message,
      });
    }
  },
  getPlateCodeRegion: async(req, res) => {
    try{
      const regions = await vehicleDAO.getPlateCodeRegion();
      res.status(200).json({ success: true, status: 200, message:'Region fetched successfully', data: regions });
    } catch (error) {
      console.error("Error in getPlateCodeRegion Controller:", error.message);
      await addServerLog({
        log_level: "ERROR",
        service_name: "getPlateCodeRegion",
        error_message: `getPlateCodeRegion Controller error - ${error.message}.`
      });
      return res.status(error.statusCode || 500).json({
        success: false,
        status: error.statusCode || 500,
        message: error.message,
      });
    }
  },

  createRole : async (req, res) => {
    try {

       // Joi validation
      await validateCreateRole(req.body);

      const role = await roleService.createRole(req.body);
      return res.status(201).json({
        success:true,
        status:201,
        message: 'Role created successfully',
        data: role,
      });
    } catch (error) {
      return res.status(error.status || 500).json({
        success:false,
        status:error.status||500,
        message: error.message || 'Internal Server Error',
      });
    }
  },
  
  createPolicy : async (req, res) => {
    try {

      // Validate input using Joi
      await validateCreatePolicy(req.body);

      const policy = await roleService.createPolicy(req.body);
      return res.status(201).json({
        status:201,
        success:true,
        message: 'Policy created successfully',
        data: policy,
      });
    } catch (error) {
      return res.status(error.status || 500).json({
        success:false,
        status:error.status||500,
        message: error.message || 'Internal Server Error',
      });
    }
  },

  associatePoliciesToRole : async (req, res) => {
    try {
      const roleId = req.params.roleId;

      await validateAssociatePolicies(req.body);

      const { policy_ids } = req.body;
  
      const role = await roleService.associatePoliciesToRole(roleId, policy_ids);
  
      return res.status(200).json({
        success:true,
        status:200,
        message: 'Policies associated with role successfully',
        data: role,
      });
    } catch (error) {
      return res.status(error.status || 500).json({
        success:false,
        status:error.status||500,
        message: error.message || 'Internal Server Error',
      });
    }
  },

  deassociatePoliciesFromRole : async (req, res) => {
    try {
      const roleId = req.params.roleId;

      await validateDeassociatePolicies(req.body);

      const { policy_ids } = req.body;
  
      const   role   = await roleService.deassociatePoliciesFromRole(roleId, policy_ids);
  
      return res.status(200).json({
        status:200,
        success:true,
        message: "Policies deassociated from role successfully",
        data: role,
      });
    } catch (error) {
      return res.status(error.status || 500).json({
        success:false,
        status:error.status||500,
        message: error.message || 'Internal Server Error',
      });
    }
  },

  getAdminStatuses : async (req, res) =>{
    try {
      const statuses = await usersStatusService.getAdminStatuses();
      res.status(200).json({ status:200,success: true, data: statuses,message:"status fetched successfully" });
    } catch (error) {
      res.status(500).json({ status:500, success: false, error: error.message });
    }
  },

  sendBulkNotification: async (req, res) => {
    try {
      //const { title, message, userType } = req.body;
      // Call the bulk notification worker
      const result = await adminRideServices.sendBulkNotification(req.body);

      return res.status(200).json({
        success: true,
        status: 200,
        message: "Bulk notification is being processed.",
        data: result,
      });
    } catch (error) {
      console.error("Error in sendBulkNotification controller:", error.message);
      await addServerLog({
        log_level: "ERROR",
        service_name: "sendBulkNotification",
        error_message: `sendBulkNotification Controller error - ${error.message}.`
      });
      return res.status(error.statusCode || 500).json({
        success: false,
        status: error.statusCode || 500,
        message: error.message || "Internal Server Error",
      });
    }
  },

  getBulkNotification: async (req, res) => {
    try {
      const result = await adminRideServices.getBulkNotification();
      return res.status(200).json({
        success: true,
        status: 200,
        message: "Bulk notification fetched successfully.",
        data: result,
      });
    } catch (error) {
      console.error("Error in getBulkNotification controller:", error.message);
      await addServerLog({
        log_level: "ERROR",
        service_name: "getBulkNotification",
        error_message: `getBulkNotification Controller error - ${error.message}.`
      });
      return res.status(error.statusCode || 500).json({
        success: false,
        status: error.statusCode || 500,
        message: error.message || "Internal Server Error",
      });
    }
  },
};
