const userDAO = require("../dao/userDAO");
const pdRidesService = require("../services/pdRidesService");
const {}=require("../validators/pdRidesValidator");
const { addServerLog } = require("../services/serverLogsService"); // Update path if needed


module.exports = {
  /**
   * Adds a chauffeur to a PD ride.
   * POST /api/pd/rides/:pdRideId/chauffeurs
   */
  addChauffeur: async (req, res) => {
    const { pdRideId } = req.params;
    const { chauffeur_id } = req.body;
    try {
      // Note: drop_point is referenced in the service call but not defined in this snippet.
      await pdRidesService.addChauffeurToPDRide(pdRideId, { chauffeur_id, drop_point });
      res.status(200).json({
        success: true,
        message: `Chauffeur ${chauffeur_id} added to PD ride ${pdRideId} successfully.`,
      });
    } catch (error) {
      console.error("Error in addChauffeur:", error);
      await addServerLog({
        log_level: "ERROR",
        service_name: "addChauffeur",
        error_message: `addChauffeur Controller error - ${error.message}.`
      });
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || "Internal Server Error",
        details: error.details || [],
      });
    }
  },

  /**
   * Drops a chauffeur from a PD ride.
   * DELETE /api/pd/rides/:pdRideId/chauffeurs/:chauffeurId
   */
  dropChauffeur: async (req, res) => {
    const { pdRideId, chauffeurId } = req.params;
    try {
      await pdRidesService.dropChauffeurFromPDRide(pdRideId, chauffeurId);
      res.status(200).json({
        success: true,
        message: `Chauffeur ${chauffeurId} dropped from PD ride ${pdRideId} successfully.`,
      });
    } catch (error) {
      console.error("Error in dropChauffeur:", error);
      await addServerLog({
        log_level: "ERROR",
        service_name: "dropChauffeur",
        error_message: `dropChauffeur Controller error - ${error.message}.`
      });
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || "Internal Server Error",
        details: error.details || [],
      });
    }
  },

  pickedChauffeur: async (req, res) => {
    const pd_id = req.user.id;
    const { chauffeur_id, ride_id, pickup, pickup_point } = req.body;
    try {
      const messageData = {
        chauffeur_id,
        pd_id,
        status: "Picked",
        requested_pickup: pickup,
        ride_id,
        requested_pickup_point: pickup_point,
        updatedAt: new Date().toISOString(), 
      };
      const chauffeur = await userDAO.getChauffeurName(chauffeur_id);
      const validatePickupData = (messageData) => {
        const { error } = rideSchemaPickup.validate(messageData);
        if (error) {
          return { valid: false, message: error.details[0].message };
        }
      }
      await pdRidesService.pickup(messageData);
      res.status(200).json({
        success: true,
        message: `Chauffeur ${chauffeur.first_name + " " + chauffeur.last_name || chauffeur_id} picked up successfully`,
      });
    } catch (error) {
      console.error("Error in pickedChauffeur:", error);
      await addServerLog({
        log_level: "ERROR",
        service_name: "pickedChauffeur",
        error_message: `pickedChauffeur Controller error - ${error.message}.`
      });
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || "Internal Server Error",
        details: error.details || [],
      });
    }
  },

  droppedChauffeur: async (req, res) => {
    const pd_id = req.user.id;
    const { chauffeur_id, ride_id, drop, drop_point } = req.body;
    try {
      const messageData = {
        chauffeur_id,
        pd_id,
        status: "Dropped",
        requested_drop: drop,
        ride_id,
        requested_drop_point: drop_point,
        updatedAt: new Date().toISOString(), 
      };
      const chauffeur = await userDAO.getChauffeurName(chauffeur_id);
      // Optionally, validate messageData using rideSchemaDrop (not shown here)
      await pdRidesService.drop(messageData);
      res.status(200).json({
        success: true,
        message: `Chauffeur ${chauffeur.first_name + " " + chauffeur.last_name || chauffeur_id} dropped successfully.`,
      });
    } catch (error) {
      console.error("Error in droppedChauffeur:", error);
      await addServerLog({
        log_level: "ERROR",
        service_name: "droppedChauffeur",
        error_message: `droppedChauffeur Controller error - ${error.message}.`
      });
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || "Internal Server Error",
        details: error.details || [],
      });
    }
  },

  pickedAndDroppedChauffeurs: async (req, res) => {
    const { page, limit } = req.params;
    const pd_id = req.user.id;
    try { 
      const rideHistory = await pdRidesService.pdRideHistory(pd_id, page, limit);
      res.status(200).json({
        success: true,
        rideHistory,
      });
    } catch (error) {
      console.error("Error in pickedAndDroppedChauffeurs:", error);
      await addServerLog({
        log_level: "ERROR",
        service_name: "pickedAndDroppedChauffeurs",
        error_message: `pickedAndDroppedChauffeurs Controller error - ${error.message}.`
      });
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || "Internal Server Error",
        details: error.details || [],
      });
    }
  },

  assignPD: async (req, res) => {
    const { pd_id, ride_id, chauffeur_id } = req.body; 
    try {
      const ride = await pdRidesService.assignPD(pd_id, chauffeur_id, ride_id);
      res.status(200).json({
        success: true,
        message: `PD ${pd_id} assigned to ride ${ride_id} successfully`,
        data: ride,
      });
    } catch (error) {
      console.error("Error in assignPD:", error); 
      await addServerLog({
        log_level: "ERROR",
        service_name: "assignPD",
        error_message: `assignPD Controller error - ${error.message}.`
      });
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || "Internal Server Error",
        details: error.details || [],
      });
    }
  },

  reAssignPD: async (req, res) => {
    const { pd_id, ride_id, chauffeur_id } = req.body; 
    try {
      const ride = await pdRidesService.reAssignPD(pd_id, chauffeur_id, ride_id);
      res.status(200).json({
        success: true,
        message: `PD ${pd_id} assigned to ride ${ride_id} successfully`,
        data: ride,
      });
    } catch (error) {
      console.error("Error in reAssignPD:", error); 
      await addServerLog({
        log_level: "ERROR",
        service_name: "reAssignPD",
        error_message: `reAssignPD Controller error - ${error.message}.`
      });
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || "Internal Server Error",
        details: error.details || [],
      });
    }
  },

  getAllRides: async (req, res) => {
    const { pd_id } = req.params;
    try {
      const ride = await pdRidesService.getAllRides(pd_id);
      res.status(200).json({
        success: true,
        message: `PD ${pd_id} rides fetched successfully`,
        data: ride,
      });
    } catch (error) {
      console.error("Error in getAllRides:", error); 
      await addServerLog({
        log_level: "ERROR",
        service_name: "getAllRides",
        error_message: `getAllRides Controller error - ${error.message}.`
      });
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || "Internal Server Error",
        details: error.details || [],
      });
    }
  },

  getPendingPickupsAndDrops: async (req, res) => {
    const pd_id = req.user.id;
    try {
      const rides = await pdRidesService.fetchPendingPickupsAndDrops(pd_id);
      res.status(200).json({
        success: true,
        message: `PD ${pd_id} pending rides fetched successfully`,
        data: rides,
      });
    } catch (error) {
      console.error("Error in getPendingPickupsAndDrops:", error);
      await addServerLog({
        log_level: "ERROR",
        service_name: "getPendingPickupsAndDrops",
        error_message: `getPendingPickupsAndDrops Controller error - ${error.message}.`
      });
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || "Internal Server Error",
        details: error.details || [],
      });
    }
  },

  fetchPdNotifications: async (req, res) => {
    try {
      const pdId = req.user.id;
      if (!pdId) {
        return res.status(400).json({ 
          success: false,
          status: 400,
          error: "Pd ID is required" 
        });
      }
      const notifications = await pdRidesService.getPdNotifications(pdId, req.params);
      res.status(200).json({ 
        success: true,
        message: 'Fetched notifications',
        status: 200,
        data: notifications 
      });
    } catch (error) {
      console.error("Error fetching notifications:", error.message);
      await addServerLog({
        log_level: "ERROR",
        service_name: "fetchPdNotifications",
        error_message: `fetchPdNotifications Controller error - ${error.message}.`
      });
      res.status(500).json({ 
        success: false,
        status: 500,
        message: 'Failed to fetch notifications',
        error: error.message,
      });
    }
  },

  fetchPdRideStatus: async (req, res) => {
    try {
      const rideStatus = await pdRidesService.getRideStatus(req.body);
      res.status(200).json({ 
        success: true,
        status: 200,
        message: "Status fetched successfully",
        data: rideStatus
      });
    } catch (error) {
      console.error("Error fetching status:", error.message);
      await addServerLog({
        log_level: "ERROR",
        service_name: "fetchPdRideStatus",
        error_message: `fetchPdRideStatus Controller error - ${error.message}.`
      });
      res.status(500).json({ 
        success: false,
        status: 500,
        message: 'Failed to fetch status',
        error: error.message,
      });
    }
  },

  pdSummary: async (req, res) => {
    try {
      const { start_date, end_date } = req.body;
      const user_id = req.user.id;
      const summary = await pdRidesService.rideSummary(start_date, end_date, user_id);
      res.status(200).json({
        success: true,
        status: 200,
        message: "PD Ride Summary fetched successfully",
        data: summary
      });
    } catch (error) {
      console.error("Error in pdSummary:", error);
      await addServerLog({
        log_level: "ERROR",
        service_name: "pdSummary",
        error_message: `pdSummary Controller error - ${error.message}.`
      });
      res.status(500).json({
        success: false,
        status: error.status || 500,
        message: "Error in fetching PD Summary",
        error: error.message
      });
    }
  },

  getAllChauffeursWithPD: async (req, res) => {
    try {
      const { pd_id } = req.body;
      const chauffeurs = await pdRidesService.fetchChauffeursWithPd(pd_id);
      res.status(200).json({
        success: true,
        status: 200,
        message: "Chauffeurs fetched successfully",
        data: chauffeurs
      });
    } catch (error) {
      console.error("Error in getAllChauffeursWithPD:", error);
      await addServerLog({
        log_level: "ERROR",
        service_name: "getAllChauffeursWithPD",
        error_message: `getAllChauffeursWithPD Controller error - ${error.message}.`
      });
      res.status(error.statusCode || 500).json({
        success: false,
        status: error.statusCode || 500,
        message: "Error in getting chauffeurs with PD",
        error: error.message || "Internal Server Error",
      });
    }
  },
};
