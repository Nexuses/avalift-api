const rideService = require('../services/rideService');
const pdRidesService = require('../services/pdRidesService');
const { rideRequestSchema } = require('../validators/pdRidesValidator');
const { addServerLog } = require("../services/serverLogsService"); // Update path if needed

module.exports = {
  getRideBookOptions: async (req, res) => {
    try {
      const options = await rideService.getRideBookOptions();

      res.status(200).json({
        success: true,
        status: 200,
        message: 'Dropdown options fetched successfully',
        data: options,
      });
    } catch (error) {
      console.error("Error in getRideBookOptions:", error);
      await addServerLog({
        log_level: "ERROR",
        service_name: "getRideBookOptions",
        error_message: `getRideBookOptions Controller error - ${error.message}.`
      });
      res.status(500).json({
        success: false,
        status: 500,
        message: 'Failed to fetch dropdown options',
        error: error.message,
      });
    }
  },

  handleRideRequest: async (req, res) => {
    const driver_id = req.user.id;
    const { action, ride_id, chauffeur_id, current_lat, current_long } = req.body;

    try {
      // Validate the request body
      const { error } = rideRequestSchema.validate({ action, ride_id, chauffeur_id });
      if (error) {
        return res.status(400).json({ error: error.details[0].message });
      }
      const result = await rideService.processRideRequest(action, driver_id, ride_id, chauffeur_id, current_lat, current_long);
      res.status(200).json({
        success: true,
        status: 200,
        message: 'Ride request handled successfully',
        data: result,
      });
    } catch (error) {
      console.error("Error in handleRideRequest:", error);
      await addServerLog({
        log_level: "ERROR",
        service_name: "handleRideRequest",
        error_message: `handleRideRequest Controller error - ${error.message}.`
      });
      res.status(error.statusCode || 500).json({ error: error.message });
    }
  },

  getpdRideHistory: async (req, res) => {
    const { pd_id, from_date, to_date, action } = req.body;
    try {
      const items = await pdRidesService.fetchRides(pd_id, action, from_date, to_date);
      res.status(200).json({
        success: true,
        status: 200,
        message: "Rides fetched successfully.",
        data: items,
      });
    } catch (error) {
      console.error("Error in getpdRideHistory:", error);
      await addServerLog({
        log_level: "ERROR",
        service_name: "getpdRideHistory",
        error_message: `getpdRideHistory Controller error - ${error.message}.`
      });
      res.status(error.statusCode || 500).json({ error: error.message });
    }
  },

  getChauffeursWithPD: async (req, res) => {
    const { pd_id, action } = req.body;
    try {
      const items = await rideService.getChauffersWithPD(pd_id, action);
      res.status(200).json({
        success: true,
        status: 200,
        message: "Chauffeurs retrieved successfully.",
        data: items,
      });
    } catch (error) {
      console.error("Error in getChauffeursWithPD:", error);
      await addServerLog({
        log_level: "ERROR",
        service_name: "getChauffeursWithPD",
        error_message: `getChauffeursWithPD Controller error - ${error.message}.`
      });
      res.status(error.statusCode || 500).json({ error: error.message });
    }
  },

  getRidebyId: async (req, res) => {
    const { ride_id } = req.params;
    try {
      if (!ride_id) {
        return res.status(400).json({ error: "ride_id is required" });
      }
      const ride = await rideService.getRideById(ride_id);
      if (!ride) {
        return res.status(404).json({ error: "Ride not found" });
      }
      res.status(200).json(ride);
    } catch (error) {
      console.error("Error in getRidebyId:", error);
      await addServerLog({
        log_level: "ERROR",
        service_name: "getRidebyId",
        error_message: `getRidebyId Controller error - ${error.message}.`
      });
      res.status(error.statusCode || 500).json({ error: "Internal Server Error" });
    }
  },

  getRideHistory: async (req, res) => {
    try {
      const customerId = req.user.id;
      const { page, limit } = req.params;

      if (!customerId) {
        return res.status(401).json({
          success: false,
          status: 401,
          message: "Unauthorized: Customer ID not found in token.",
        });
      }

      const rides = await rideService.getRideHistory(customerId, page, limit);

      res.status(200).json({
        success: true,
        status: 200,
        data: rides,
        message: "Ride history retrieved successfully.",
      });
    } catch (error) {
      console.error("Error in getRideHistory:", error);
      await addServerLog({
        log_level: "ERROR",
        service_name: "getRideHistory",
        error_message: `getRideHistory Controller error - ${error.message}.`
      });
      res.status(500).json({ success: false, status: 500, message: error.message });
    }
  },

  getChauffeurRidebyId: async (req, res) => {
    const { ride_id } = req.body;
    try {
      if (!ride_id) {
        return res.status(400).json({ error: "ride_id is required" });
      }
      const ride = await rideService.getChauffeurRideById(ride_id);
      if (!ride) {
        return res.status(404).json({ error: "Ride not found" });
      }
      res.status(200).json(ride);
    } catch (error) {
      console.error("Error in getChauffeurRidebyId:", error);
      await addServerLog({
        log_level: "ERROR",
        service_name: "getChauffeurRidebyId",
        error_message: `getChauffeurRidebyId Controller error - ${error.message}.`
      });
      res.status(error.statusCode || 500).json({ error: "Internal Server Error" });
    }
  },

  updateRideStatusController: async (req, res) => {
    try {
      const { ride_id } = req.body;
      const chauffeur_id = req.user.id; // Extracted from token

      if (!ride_id) {
        return res.status(400).json({ status: 400, success: false, message: "Ride ID is required" });
      }


      const updatedRide = await rideService.updateRideStatus(ride_id, chauffeur_id);

      return res.status(200).json({
        status: 200,
        success: true,
        message: "Ride status updated to On-The-Way",
        data: { ride_id: updatedRide.ride_id },
      });
    } catch (error) {
      return res.status(400).json({ status: 400, success: false, message: error.message });
    }
  },

  getRateTypes: async (req, res) => {
    try {
      const options = await rideService.getRideRateTypes();

      res.status(200).json({
        success: true,
        status: 200,
        message: 'Rate Types options fetched successfully',
        data: options,
      });
    } catch (error) {
      console.error("Error in getRateTypes:", error);
      await addServerLog({
        log_level: "ERROR",
        service_name: "getRateTypes",
        error_message: `getRateTypes Controller error - ${error.message}.`
      });
      res.status(500).json({
        success: false,
        status: 500,
        message: 'Failed to fetch rate types options',
        error: error.message,
      });
    }
  },
  createRateType: async (req, res) => {
    try {
      const rateType = await rideService.createRideRateType(req.body);

      res.status(200).json({
        success: true,
        status: 200,
        message: 'Rate Types options created successfully',
      });
    } catch (error) {
      console.error("Error in createRateType:", error);
      await addServerLog({
        log_level: "ERROR",
        service_name: "createRateType",
        error_message: `createRateType Controller error - ${error.message}.`
      });
      res.status(500).json({
        success: false,
        status: 500,
        message: 'Failed to create rate types options',
        error: error.message,
      });
    }
  },
  updateRateType: async (req, res) => {
    try {
      const rateType = await rideService.updateRideRateType(req.body);

      res.status(200).json({
        success: true,
        status: 200,
        message: 'Rate Types options updated successfully',
      });
    } catch (error) {
      console.error("Error in updateRateType:", error);
      await addServerLog({
        log_level: "ERROR",
        service_name: "updateRateType",
        error_message: `updateRateType Controller error - ${error.message}.`
      });
      res.status(500).json({
        success: false,
        status: 500,
        message: 'Failed to update rate types options',
        error: error.message,
      });
    }
  }

};

  