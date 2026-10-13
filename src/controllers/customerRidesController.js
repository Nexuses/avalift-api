const customerRidesService = require("../services/customerRidesService");
const ridesDAO = require("../dao/ridesDAO");
const { addServerLog } = require("../services/serverLogsService"); // Update path if needed
const { changeDestinationService } = require("../services/changeDestinationServices");

module.exports = {
  /**
   * Handles ride requests from customers.
   * POST /api/customers/rides
   */
  requestRide: async (req, res) => {
    try {
      const user_id = req.user.id;
      const orgId = req.user.organization_id;
      const rideResponse = await customerRidesService.requestRide(
        req.body,
        orgId,
        user_id
      );
      res.status(201).json({
        success: true,
        status: 201,
        data: {
          ride_id: rideResponse.ride_id,
        },
        message: rideResponse.message,
      });
    } catch (error) {
      console.error("Error in requestRide:", error.message);
      await addServerLog({
        log_level: "ERROR",
        service_name: "requestRide",
        error_message: `requestRide Controller error - ${error.message}.`,
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
   * Completes a customer's ride.
   * POST /api/customers/rides/:rideId/complete
   */
  initiateRideCompletion: async (req, res) => {
    const customerId = req.user.id;
    const { ride_id } = req.body;
    try {
      await customerRidesService.initiateEndRide(ride_id, customerId);
      res.status(200).json({
        success: true,
        status: 200,
        data: {},
        message: "Successfully initiated ride completion",
      });
    } catch (error) {
      console.error("Error in initiateRideCompletion:", error.message);
      await addServerLog({
        log_level: "ERROR",
        service_name: "initiateRideCompletion",
        error_message: `initiateRideCompletion Controller error - ${error.message}.`,
      });
      res.status(error.statusCode || 500).json({
        success: false,
        status: error.statusCode || 500,
        message: error.message || "Internal Server Error",
        details: error.details || [],
      });
    }
  },

  calculateEstimate: async (req, res) => {
    const orgId = req.user.organization_id;
    const user_id = req.user.id;
    try {
      const estimatedAmount = await customerRidesService.calculateEstimatedFare(
        req.body,
        orgId,
        user_id
      );
      res.status(200).json({
        success: true,
        status: 200,
        data: estimatedAmount,
        message: "Successfully calculated the estimated amount",
      });
    } catch (error) {
      console.error("Error in calculateEstimate:", error.message);
      await addServerLog({
        log_level: "ERROR",
        service_name: "calculateEstimate",
        error_message: `calculateEstimate Controller error - ${error.message}.`,
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
   * Cancels a customer's ride and updates chauffeur's ride entry if assigned.
   * POST /api/rides/cancel
   */
  cancelRide: async (req, res) => {
    try {
      const { ride_id, cancellation_reason } = req.body;
      const userId = req.user.id; // Extracted from token by middleware

      const result = await customerRidesService.cancelRide(
        ride_id,
        userId,
        cancellation_reason
      );

      res.status(200).json({
        success: true,
        status: 200,
        message: result,
        data: {},
      });
    } catch (error) {
      console.error("Error in cancelRide:", error.message);
      await addServerLog({
        log_level: "ERROR",
        service_name: "cancelRide",
        error_message: `cancelRide Controller error - ${error.message}.`,
      });
      res.status(error.statusCode || 500).json({
        success: false,
        status: error.statusCode || 500,
        message: error.message,
      });
    }
  },

  getCustomerStatus: async (req, res) => {
    try {
      const { customer_id } = req.params;
      const response = await customerRidesService.getCustomerStatus(
        customer_id
      );
      res.status(200).json({
        success: true,
        status: 200,
        message: "Ride Status fetched Successfully",
        data: response,
      });
    } catch (error) {
      console.error("Error in getCustomerStatus:", error.message);
      await addServerLog({
        log_level: "ERROR",
        service_name: "getCustomerStatus",
        error_message: `getCustomerStatus Controller error - ${error.message}.`,
      });
      res.status(error.statusCode || 500).json({
        success: false,
        status: error.statusCode || 500,
        message: error.message,
      });
    }
  },

  fetchActiveRidesByCustomer: async (req, res) => {
    try {
      const customerId = req.user.id;
      if (!customerId) {
        return res.status(400).json({
          success: false,
          status: 400,
          error: "Customer ID is required",
        });
      }
      const rides = await customerRidesService.getActiveRidesByCustomerId(
        customerId
      );
      res.status(200).json({
        success: true,
        status: 200,
        message:
          rides.length !== 0
            ? "Active Rides fetched successfully"
            : "No active rides found",
        data: rides.length !== 0 ? rides : [],
      });
    } catch (error) {
      console.error("Error in fetchActiveRidesByCustomer:", error.message);
      await addServerLog({
        log_level: "ERROR",
        service_name: "fetchActiveRidesByCustomer",
        error_message: `fetchActiveRidesByCustomer Controller error - ${error.message}.`,
      });
      res.status(500).json({
        success: false,
        status: 500,
        message: "Failed to fetch active rides",
        error: error.message,
      });
    }
  },

  /**
   * Handles scheduled ride requests from customers.
   * POST /api/customers/scheduled_rides
   */
  scheduledRide: async (req, res) => {
    try {
      const user_id = req.user.id;
      const orgId = req.user.organization_id;
      const rideResponse = await customerRidesService.scheduleRide(
        req.body,
        orgId,
        user_id
      );
      res.status(201).json({
        success: true,
        status: 201,
        data: {
          ride_id: rideResponse.ride_id,
        },
        message: rideResponse.message,
      });
    } catch (error) {
      console.error("Error in scheduledRide:", error.message);
      await addServerLog({
        log_level: "ERROR",
        service_name: "scheduledRide",
        error_message: `scheduledRide Controller error - ${error.message}.`,
      });
      res.status(error.statusCode || 500).json({
        success: false,
        status: error.statusCode || 500,
        message: error.message || "Internal Server Error",
        details: error.details || [],
      });
    }
  },

  changeRateType: async (req, res) => {
    try {
      const customer_id = req.user.id;
      const organisation_id = req.user.organization_id;
      const response = await customerRidesService.changeRateType(
        req.body,
        customer_id,
        organisation_id
      );
      res.status(200).json({
        status: 200,
        success: true,
        message: "Rate type changed successfully",
        data: response,
      });
    } catch (error) {
      console.error("Error in changeRateType:", error);
      await addServerLog({
        log_level: "ERROR",
        service_name: "changeRateType",
        error_message: `changeRateType Controller error - ${error.message}.`,
      });
      res.status(error.status || 500).json({
        error: error.message || "Internal server error.",
      });
    }
  },

  reScheduledRide: async (req, res) => {
    try {
      console.log(req.user);
      const user_id = req.user.id;
      const orgId = req.user.organization_id;
      const rideResponse = await customerRidesService.rescheduleRide(
        req.body,
        orgId,
        user_id
      );
      res.status(200).json({
        success: true,
        status: 200,
        data: {
          ride_id: rideResponse.ride_id,
        },
        message: rideResponse.message,
      });
    } catch (error) {
      console.error("Error in reScheduledRide:", error.message);
      await addServerLog({
        log_level: "ERROR",
        service_name: "reScheduledRide",
        error_message: `reScheduledRide Controller error - ${error.message}.`,
      });
      res.status(error.statusCode || 500).json({
        success: false,
        status: error.statusCode || 500,
        message: error.message || "Internal Server Error",
        details: error.details || [],
      });
    }
  },
  isCurrentRide: async (req, res) => {
    try {
      const isThereACurrentRide = await customerRidesService.isThereACurrentRide(req.body);
      res.status(200).json({
        success: true,
        status: 200,
        data: {isThereACurrentRide},
        message: "Successfully fetched current ride status",
      });
    } catch (error) {
      console.error("Error in isCurrentRide:", error.message);
      await addServerLog({
        log_level: "ERROR",
        service_name: "isCurrentRide",
        error_message: `isCurrentRide Controller error - ${error.message}.`
      });
      res.status(error.statusCode || 500).json({
        success: false,
        status: error.statusCode || 500,
        message: error.message || "Internal Server Error",
        details: error.details || [],
      });
    }
  },

  changeDestination: async (req, res) => {
    try {
      const { ride_id, new_drop, additional_mins } = req.body;
      const userId = req.user.id; 
      const orgId = req.user.organization_id;

      const result = await changeDestinationService(
        ride_id,
        new_drop,
        orgId,
        userId,
        additional_mins
      );

      res.status(200).json({
        success: true,
        status: 200,
        message: "Ride destination changed successfully",
        data: result,
      });
    } catch (error) {
      console.error("Error in changeDestination:", error.message);
      await addServerLog({
        log_level: "ERROR",
        service_name: "changeDestination",
        error_message: `changeDestination Controller error - ${error.message}.`,
      });
      res.status(error.statusCode || 500).json({
        success: false,
        status: error.statusCode || 500,
        message: error.message || "Internal Server Error",
        details: error.details || [],
      });
    }
  },
     
};
