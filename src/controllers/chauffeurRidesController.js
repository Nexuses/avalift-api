const { messaging } = require("firebase-admin");
const chauffeurRidesService = require("../services/chauffeurRidesService");
const chauffeurService = require("../services/chauffeurService");
const { addServerLog } = require("../services/serverLogsService");
const userDAO = require("../dao/userDAO");

module.exports = {
  /**
   * Handles ride requests from chauffeurs.
   * POST /api/chauffeurs/rides
   */
  requestRide: async (req, res) => {
    try {
      const orgId = req.user.organization_id;
      const userId = req.user.id;
      const rideId = await chauffeurRidesService.requestRide(
        req.body,
        userId,
        orgId
      );
      await chauffeurRidesService.notifyNearbyPd(rideId, userId);

      res.status(201).json({
        success: true,
        status: 201,
        message: "Pickup requested successfully.",
        data: rideId,
      });
    } catch (error) {
      console.error("Error in requestRide:", error.message);
      await addServerLog({
        log_level: "ERROR",
        service_name: "requestRide",
        error_message: `requestRide Controller error - ${error.message}.`
      });
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || "Internal Server Error",
        details: error.details || [],
      });
    }
  },

  requestDrop: async (req, res) => {
    try {
      const orgId = req.user.organization_id;
      const chauffeurId = req.user.id;
      const rideId = await chauffeurRidesService.addDropRequest(
        req.body,
        chauffeurId,
        orgId
      );
      res.status(201).json({
        success: true,
        status: 201,
        message: "Drop requested successfully.",
        data: rideId,
      });
    } catch (error) {
      console.error("Error in requestDrop:", error.message);
      await addServerLog({
        log_level: "ERROR",
        service_name: "requestDrop",
        error_message: `requestDrop Controller error - ${error.message}.`
      });
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || "Internal Server Error",
        details: error.details || [],
      });
    }
  },

  getTopChauffeurs: async (req, res) => {
    try {
      const result = await chauffeurRidesService.getTopChauffeursByRides();
      res.status(200).json({
        success: true,
        status: 200,
        message: "Top chauffeurs fetched successfully",
        data: result,
      });
    } catch (error) {
      console.error("Error in getTopChauffeurs:", error.message);
      await addServerLog({
        log_level: "ERROR",
        service_name: "getTopChauffeurs",
        error_message: `getTopChauffeurs Controller error - ${error.message}.`
      });
      res.status(500).json({
        success: false,
        status: 500,
        message: "Internal Server Error",
      });
    }
  },

  getChauffeurReviews : async (req, res) => {
    try {
      const { chauffeur_id ,page,limit } = req.params;
  
      if (!chauffeur_id) {
        return res.status(400).json({success:false,status:400, message: 'Chauffeur ID is required' });
      }

      const user = await userDAO.findByUserId(chauffeur_id);


      if (!user) {
        return res.status(404).json({
        success: false,
        status: 404,
        message: "User not found",
        });
      }

      if (user.role?.name !== "chauffeur") {
        return res.status(400).json({
        success: false,
        status: 400,
        message: "User is not a chauffeur",
        });
      }


      const pageNum = parseInt(page) || 1;
      const limitNum = parseInt(limit) || 10;
  
      const reviews = await chauffeurRidesService.listChauffeurReviews(chauffeur_id,pageNum,limitNum);
      return res.status(200).json({success:true,status:200,message:`reviews of chauffeur:${chauffeur_id} fetched successfully`,data: reviews });
    } catch (error) {
      // ✅ Check for specific error message
      if (error.message?.includes("User with ID") && error.message?.includes("not found")) {
        return res.status(404).json({
          success: false,
          status: 404,
          message: "User not found",
        });
      }

    console.error('Error getting chauffeur reviews:', error);
      console.error('Error getting chauffeur reviews:', error);
      return res.status(500).json({success:false,status:500, message: 'Internal server error' });
    }
  }
};
