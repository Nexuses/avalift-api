const chauffeurCustomerRidesService = require("../services/chauffeurCustomerRidesService");
const auditService = require("../services/auditService");
const { uploadToS3 } = require("../utils/s3Uploader");
const { addServerLog } = require("../services/serverLogsService");

module.exports = {
  /**
   * Chauffeur responds to a ride request.
   */
  respondToRide: async (req, res) => {
    const { response, customer_id, ride_id } = req.body;
    const chauffeurId = req.user.id;

    try {
      const result = await chauffeurCustomerRidesService.respondToRide(
        ride_id,
        customer_id,
        chauffeurId,
        response
      );
      res.status(200).json({
        success: true,
        status: 200,
        data: result.data,
        message: result.message,
      });
    } catch (error) {
      console.error("Error in respondToRide controller:", error.message);
      await addServerLog({
        log_level: "ERROR",
        service_name: "respondToRide",
        error_message: `respondToRide Controller error - ${error.message}.`,
      });
      res.status(error.statusCode || 500).json({
        success: false,
        status: error.statusCode || 500,
        message: error.message || "Internal Server Error",
        details: error.details || [],
      });
    }
  },

  /**
   * Completes a customer ride by the chauffeur.
   * POST /api/chauffeurs/rides/complete
   */
  completeRide: async (req, res) => {
    const { ride_id, customer_id } = req.body;
    const chauffeur_id = req.user.id;
    const end_time = new Date();
    try {
      await chauffeurCustomerRidesService.completeCustomerRide(
        ride_id,
        customer_id,
        end_time,
        chauffeur_id
      );
      res.status(200).json({
        success: true,
        status: 200,
        message: "Payment initiated successfully.",
      });
    } catch (error) {
      console.error("Error in completeRide controller:", error.message);
      await addServerLog({
        log_level: "ERROR",
        service_name: "completeRide",
        error_message: `completeRide Controller error - ${error.message}.`,
      });
      res.status(error.statusCode || 500).json({
        success: false,
        status: error.statusCode || 500,
        message: error.message || "Internal Server Error",
        details: error.details || [],
      });
    }
  },

  /**
   * Marks the ride as 'Reached Pickup' and notifies the customer.
   */
  markChauffeurReached: async (req, res) => {
    try {
      const { customer_id, ride_id } = req.body;
      console.log("PAYLOAD - Customer ID:", customer_id);
      console.log("PAYLOAD - Ride ID:", ride_id);
      const chauffeur_id = req.user.id;
      const result = await chauffeurCustomerRidesService.markChauffeurReachedService(
        ride_id,
        customer_id,
        chauffeur_id
      );
      return res.status(200).json({
        success: true,
        status: 200,
        data: { ride_id: result.ride?.ride_id },
        message: result.message,
      });
    } catch (error) {
      console.error("Error in markChauffeurReached controller:", error.message);
      await addServerLog({
        log_level: "ERROR",
        service_name: "markChauffeurReached",
        error_message: `markChauffeurReached Controller error - ${error.message}.`,
      });
      return res.status(error.statusCode || 500).json({
        success: false,
        status: error.statusCode || 500,
        message: error.message || "Internal Server Error",
      });
    }
  },

  startCustomerRide: async (req, res) => {
    try {
      const { ride_id, customer_id } = req.body;
      const chauffeur_id = req.user.id;
      console.log("Chauffeur ID:", chauffeur_id);
      const response = await chauffeurCustomerRidesService.startCustomerRide(
        ride_id,
        customer_id,
        chauffeur_id
      );
      res.status(200).json({
        success: true,
        status: 200,
        message: response.message,
        data: {},
      });
    } catch (error) {
      console.error("Error in startCustomerRide controller:", error.message);
      await addServerLog({
        log_level: "ERROR",
        service_name: "startCustomerRide",
        error_message: `startCustomerRide Controller error - ${error.message}.`,
      });
      res.status(error.statusCode || 500).json({
        success: false,
        status: error.statusCode || 500,
        message: error.message || "Internal Server Error",
      });
    }
  },

  /**
   * GET active ride for a given chauffeur.
   */
  getActiveRideForChauffeur: async (req, res) => {
    const chauffeurId = req.user.id;
    try {
      const ride = await chauffeurCustomerRidesService.getActiveRideForChauffeur(chauffeurId);
      if (ride) {
        return res.status(200).json({
          success: true,
          status: 200,
          data: [ride],
          message: "Active ride found for the chauffeur.",
        });
      } else {
        return res.status(200).json({
          success: true,
          status: 200,
          data: [],
          message: "No active rides found for this chauffeur.",
        });
      }
    } catch (error) {
      console.error("Error in getActiveRideForChauffeur controller:", error.message);
      await addServerLog({
        log_level: "ERROR",
        service_name: "getActiveRideForChauffeur",
        error_message: `getActiveRideForChauffeur Controller error - ${error.message}.`,
      });
      res.status(500).json({ error: "Internal Server Error" });
    }
  },

  getCustomerExtraDetailsFromActiveRide: async (req, res) => {
    const chauffeurId = req.user.id;

  
    try {
      const customerExtraDetails = await chauffeurCustomerRidesService.getCustomerExtraDetailsFromActiveRide(chauffeurId);
  
      if (customerExtraDetails) {
        return res.status(200).json({
          success: true,
          status: 200,
          data: customerExtraDetails,
          message: "Customer extra details found for active ride.",
        });
      } else {
        return res.status(200).json({
          success: true,
          status: 200,
          data: {},
          message: "No  customer extra details found for this chauffeur.",
        });
      }
    } catch (error) {
      console.error("Error in getCustomerExtraDetailsFromActiveRide controller:", error.message);
      await addServerLog({
        log_level: "ERROR",
        service_name: "getCustomerExtraDetailsFromActiveRide",
        error_message: `Controller error - ${error.message}`,
      });
      res.status(500).json({ error: "Internal Server Error" });
    }
  },

  uploadImages: async (req, res) => {
    try {
      const { ride_id, customer_id } = req.body;
      if (!ride_id || !customer_id) {
        return res.status(400).json({ success: false, message: "ride_id and customer_id are required." });
      }
      if (!req.files || req.files.length === 0) {
        return res.status(400).json({ success: false, message: "At least one after-ride image is required." });
      }
      const uploadedFiles = [];
      for (const file of req.files) {
        const fileName = `after_ride_images/${customer_id}/${ride_id}/${Date.now()}_${file.originalname}`;
        const s3Url = await uploadToS3(file.buffer, fileName, file.mimetype);
        uploadedFiles.push(s3Url);
      }
      const savedRideImages = await chauffeurCustomerRidesService.saveAfterRideImages(uploadedFiles, ride_id, customer_id);
      res.status(201).json({
        success: true,
        status: 201,
        message: "After-ride images uploaded successfully",
        data: savedRideImages,
      });
    } catch (error) {
      console.error("Error in uploadImages controller:", error.message);
      await addServerLog({
        log_level: "ERROR",
        service_name: "uploadImages",
        error_message: `uploadImages Controller error - ${error.message}.`,
      });
      res.status(500).json({
        success: false,
        status: 500,
        message: "Internal Server Error",
        error: error.message,
      });
    }
  },

  /**
   * GET scheduled ride for a given chauffeur.
   */
  getScheduleRideForChauffeur: async (req, res) => {
    const chauffeurId = req.user.id;
    try {
      const ride = await chauffeurCustomerRidesService.getScheduledRideForChauffeur(chauffeurId);
      if (ride) {
        return res.status(200).json({
          success: true,
          status: 200,
          data: [ride],
          message: "Scheduled ride found for the chauffeur.",
        });
      } else {
        return res.status(200).json({
          success: true,
          status: 200,
          data: [],
          message: "No Scheduled rides found for this chauffeur.",
        });
      }
    } catch (error) {
      console.error("Error in getScheduleRideForChauffeur controller:", error.message);
      await addServerLog({
        log_level: "ERROR",
        service_name: "getScheduleRideForChauffeur",
        error_message: `getScheduleRideForChauffeur Controller error - ${error.message}.`,
      });
      res.status(500).json({ error: "Internal Server Error" });
    }
  },

  uploadBeforeRideImages: async (req, res) => {
    try {
      const { ride_id, customer_id } = req.body;
      if (!ride_id || !customer_id) {
        return res.status(400).json({ success: false, message: "ride_id and customer_id are required." });
      }
      const uploadedFiles = [];
      for (const file of req.files) {
        const fileName = `before_ride_images/${customer_id}/${ride_id}/${Date.now()}_${file.originalname}`;
        const s3Url = await uploadToS3(file.buffer, fileName, file.mimetype);
        uploadedFiles.push(s3Url);
      }
      const savedRideImages = await chauffeurCustomerRidesService.saveBeforeRideImages(uploadedFiles, ride_id, customer_id);
      res.status(201).json({
        success: true,
        status: 201,
        message: "Before-ride images uploaded successfully",
        data: savedRideImages,
      });
    } catch (error) {
      console.error("Error in uploadBeforeRideImages controller:", error.message);
      await addServerLog({
        log_level: "ERROR",
        service_name: "uploadBeforeRideImages",
        error_message: `uploadBeforeRideImages Controller error - ${error.message}.`,
      });
      res.status(500).json({ success: false, message: "Failed to upload files" });
    }
  },

  createAudit: async (req, res) => {
    try {
      await auditService.processAuditRequest(req);
      res.status(200).json({status: 200,success: true,data:[], message: "Audit stored successfully" });
    } catch (error) {
      console.error("Error in createAudit controller:", error.message);
      await addServerLog({
        log_level: "ERROR",
        service_name: "createAudit",
        error_message: `createAudit Controller error - ${error.message}.`,
      });
      res.status(500).send({ message: "Error storing audit", error: error.message });
    }
  },
};
