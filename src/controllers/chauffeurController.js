const chauffeurService = require("../services/chauffeurService");
const locationServices = require("../services/locationServices");
const { addServerLog } = require("../services/serverLogsService"); 

module.exports = {
  fetchChauffeurNotifications: async (req, res) => {
    try {
      const chauffeurId = req.user.id;
      const { page, limit } = req.params;

      if (!chauffeurId) {
        return res.status(400).json({
          success: false,
          status: 400,
          error: "Chauffeur ID is required",
        });
      }

      const notifications = await chauffeurService.getChauffeurNotifications(chauffeurId, page, limit);
      return res.status(200).json({
        success: true,
        status: 200,
        data: notifications,
      });
    } catch (error) {
      console.error("Error fetching notifications:", error.message);
      await addServerLog({
        log_level: "ERROR",
        service_name: "fetchChauffeurNotifications",
        error_message: `fetchChauffeurNotifications Controller error - ${error.message}.`,
      });
      return res.status(500).json({
        success: false,
        status: 500,
        message: "Failed to fetch notifications",
        error: error.message,
      });
    }
  },

  fetchChauffeurRideHistory: async (req, res) => {
    try {
      const chauffeurId = req.user.id;
      if (!chauffeurId) {
        return res.status(400).json({
          success: false,
          status: 400,
          error: "Chauffeur ID is required",
        });
      }
      const completedRides = await chauffeurService.getChauffeurRideHistory(chauffeurId, req.params);
      return res.status(200).json({
        success: true,
        status: 200,
        message: completedRides.length !== 0 ? 'Ride history fetched successfully' : "No completed rides found",
        data: completedRides.length !== 0 ? completedRides : [],
      });
    } catch (error) {
      console.error("Error fetching ride history:", error.message);
      await addServerLog({
        log_level: "ERROR",
        service_name: "fetchChauffeurRideHistory",
        error_message: `fetchChauffeurRideHistory Controller error - ${error.message}.`,
      });
      return res.status(500).json({
        success: false,
        status: 500,
        message: "Failed to fetch ride history",
        error: error.message,
      });
    }
  },

  fetchRideStatus: async (req, res) => {
    try {
      const rideStatus = await chauffeurService.getRideStatus(req.body);
      return res.status(200).json({
        success: true,
        status: 200,
        message: "Status fetched successfully",
        rideStatus: rideStatus,
      });
    } catch (error) {
      console.error("Error fetching ride status:", error.message);
      await addServerLog({
        log_level: "ERROR",
        service_name: "fetchRideStatus",
        error_message: `fetchRideStatus Controller error - ${error.message}.`,
      });
      return res.status(500).json({
        success: false,
        status: 500,
        message: "Failed to fetch status",
        error: error.message,
      });
    }
  },

  cancelReq: async (req, res) => {
    try {
      const { ride_id } = req.body;
      const chauffeur_id = req.user.id;
      const ride = await chauffeurService.cancelRequest(ride_id, chauffeur_id);
      res.status(200).json({
        success: true,
        status: 200,
        message: `Pickup request ${ride_id} cancelled successfully`,
      });
    } catch (error) {
      console.error("Error cancelling pickup request:", error.message);
      await addServerLog({
        log_level: "ERROR",
        service_name: "cancelReq",
        error_message: `cancelReq Controller error - ${error.message}.`,
      });
      res.status(500).json({
        success: false,
        status: 500,
        message: "Internal Server Error",
        error: error.message,
      });
    }
  },

  chauffeurSummary: async (req, res) => {
    try {
      const { start_date, end_date } = req.body;
      const user_id = req.user.id;
      const serviceResponse = await chauffeurService.chauffeurSummary(start_date, end_date, user_id);
      return res.status(serviceResponse.status || 200).json({
        success: true,
        status: 200,
        message: serviceResponse.message || 'Chauffeur Summary fetched successfully',
        data: serviceResponse,
      });
    } catch (error) {
      console.error("Error in chauffeurSummary:", error.message);
      await addServerLog({
        log_level: "ERROR",
        service_name: "chauffeurSummary",
        error_message: `chauffeurSummary Controller error - ${error.message}.`,
      });
      const statusCode = error.status || error.statusCode || 500;
      return res.status(statusCode).json({
        success: false,
        status: statusCode,
        message: "Error in fetching chauffeur summary",
        error: error.message || "An unknown error occurred",
      });
    }
  },

  fetchNearbyPds: async (req, res) => {
    const chauffeurId = req.user.id;
    try {
      const pdList = await locationServices.getNearbyPds(chauffeurId);
      return res.status(200).json({
        success: true,
        status: 200,
        message: "Nearby PDs fetched successfully",
        data: pdList,
      });
    } catch (error) {
      console.error("Error fetching nearby PDs:", error.message);
      await addServerLog({
        log_level: "ERROR",
        service_name: "fetchNearbyPds",
        error_message: `fetchNearbyPds Controller error - ${error.message}.`,
      });
      return res.status(500).json({
        success: false,
        status: 500,
        message: "Error in fetching nearby PDs",
        error: error.message,
      });
    }
  },

  fetchActiveChauffeurPdRides: async (req, res) => {
    try {
      const chauffeurId = req.user.id;
      if (!chauffeurId) {
        return res.status(400).json({
          success: false,
          status: 400,
          error: "Customer ID is required",
        });
      }
      const rides = await chauffeurService.getActiveChauffeurPdRides(chauffeurId);
      return res.status(200).json({
        success: true,
        status: 200,
        message: rides.length !== 0 ? "Active Rides fetched successfully" : "No active rides found",
        data: rides.length !== 0 ? rides : [],
      });
    } catch (error) {
      console.error("Error fetching active rides:", error.message);
      await addServerLog({
        log_level: "ERROR",
        service_name: "fetchActiveChauffeurPdRides",
        error_message: `fetchActiveChauffeurPdRides Controller error - ${error.message}.`,
      });
      return res.status(500).json({
        success: false,
        status: 500,
        message: "Failed to fetch active rides",
        error: error.message,
      });
    }
  },

  activateApplePayIndication: async (req, res) => {
    try {
      const chauffeurId = req.user.id;
      const response = await chauffeurService.activateApplePayIndication(chauffeurId, req.body);
      
      return res.status(200).json({
        success: true,
        status: 200,
        message: "Apple Pay indication activated successfully",
        //data: response
    });
    } catch (error) {
      console.error("Error in activateApplePayIndication:", error.message);
      await addServerLog({
        log_level: "ERROR",
        service_name: "activateApplePayIndication",
        error_message: `activateApplePayIndication Controller error - ${error.message}.`,
      });
      return res.status(error.statusCode || 500).json({
        success: false,
        status: error.statusCode || 500,
        message: "Error in activating Apple Pay indication",
        error: error.message || "An unknown error occurred",
      });
    }
  },

  checkApplePayPayment: async (req, res) => {
    try {
      //const chauffeurId = req.user.id;
      const response = await chauffeurService.checkApplePayPayment(req.body);
      console.log(response);
  
      return res.status(200).json({
        success: true,
        status: 200,
        message: "Apple Pay payment checked successfully",
        apple_pay_paid: response.apple_pay_paid,
        apple_pay_payment_failed: response.apple_pay_payment_failed
      });
    } catch (error) {
      console.error("Error in checkApplePayPayment:", error.message);
      await addServerLog({
        log_level: "ERROR",
        service_name: "checkApplePayPayment",
        error_message: `checkApplePayPayment Controller error - ${error.message}.`,
      });
      return res.status(error.status || 500).json({
        success: false,
        status: error.status || 500,
        message: error.message || "Internal Server Error"
      });
    }
  }
  
};