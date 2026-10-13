const adminRideServices = require('../services/adminRideServices');
const { getAllRidesForChauffeur } = require('../services/chauffeurAdminPanelService');
const UserService = require('../services/userService');
const { addServerLog } = require("../services/serverLogsService"); 

module.exports = {
  getAllRidesOfChauffeur: async (req, res) => {
    try {
      const rides = await getAllRidesForChauffeur(req.body);
      res.status(200).json({
        success: true,
        status: 200,
        message: "Rides fetched successfully",
        data: rides,
      });
    } catch (error) {
      console.error("Error fetching rides:", error.message);
      await addServerLog({
        log_level: "ERROR",
        service_name: "getAllRidesOfChauffeur",
        error_message: `getAllRidesOfChauffeur Controller error - ${error.message}.`
      });
      res.status(error.statusCode || 400).json({
        success: false,
        status: error.statusCode || 400,
        error: error.message,
      });
    }
  },

  getAvailableChauffeurs: async (req, res) => {
    try {
      const availableChauffeurs = await adminRideServices.getAvailableChauffeurs();
      res.status(200).json({
        success: true,
        status: 200,
        message: "Chauffeurs fetched successfully",
        data: availableChauffeurs,
      });
    } catch (error) {
      console.error("Error getting chauffeurs:", error.message);
      await addServerLog({
        log_level: "ERROR",
        service_name: "getAvailableChauffeurs",
        error_message: `getAvailableChauffeurs Controller error - ${error.message}.`
      });
      res.status(error.statusCode || 400).json({
        success: false,
        status: error.statusCode || 400,
        error: error.message,
      });
    }
  },
};
