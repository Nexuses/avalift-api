const {
  getRidesForUserType,
  getRidesForChauffeurs,
} = require("../services/ridesAdminPanelService");
const {getDistanceMetrics} = require("../services/locationServices");
const adminRides = require("../services/ridesAdminPanelService");
const { addServerLog } = require("../services/serverLogsService"); // Update path if needed
const ridesAdminpanelDOA = require("../dao/ridesAdminpanelDOA");
const excelService = require("../services/rideExportService");
module.exports = {
  getallRides: async (req, res) => {
    try {
      const result = await getRidesForUserType(req.body, req.params, req.user);
      res.status(200).json({
        success: true,
        status: 200,
        message: "Rides fetched successfully",
        data: result,
      });
    } catch (error) {
      console.error("Error fetching rides:", error);
      await addServerLog({
        log_level: "ERROR",
        service_name: "getallRides",
        error_message: `getallRides Controller error - ${error.message}.`,
      });
      res.status(error.statusCode || 500).json({
        success: false,
        status: error.statusCode || 500,
        message: "Failed to fetch active rides",
        error: error.message || "Internal server error",
      });
    }
  },

  getRevenueReport: async (req, res) => {
    try {
      const { start_date, end_date, chauffeur_id, pageNumber, pageSize } =
        req.body;
      const report = await adminRides.generateRevenueReport(
        chauffeur_id,
        start_date,
        end_date,
        pageNumber,
        pageSize
      );
      res.status(200).json({
        success: true,
        status: 200,
        message: "Rides fetched successfully",
        data: report,
      });
    } catch (error) {
      console.error("Error fetching revenue report:", error);
      await addServerLog({
        log_level: "ERROR",
        service_name: "getRevenueReport",
        error_message: `getRevenueReport Controller error - ${error.message}.`,
      });
      res.status(500).json({ error: error.message });
    }
  },

  getallChauffeurRides: async (req, res) => {
    try {
      const result = await getRidesForChauffeurs(req.body, req.params);
      res.status(200).json({
        success: true,
        status: 200,
        message: "Chauffeur Rides fetched successfully",
        data: result,
      });
    } catch (error) {
      console.error("Error fetching chauffeur rides:", error);
      await addServerLog({
        log_level: "ERROR",
        service_name: "getallChauffeurRides",
        error_message: `getallChauffeurRides Controller error - ${error.message}.`,
      });
      res.status(500).json({ error: error.message });
    }
  },

  getRevenueDetails: async (req, res) => {
    try {
      const { start_date, end_date } = req.body;
      const revenue = await adminRides.getRevenue(start_date, end_date);
      res.status(200).json({
        success: true,
        status: 200,
        message: "Rides revenue fetched successfully",
        data: revenue,
      });
    } catch (error) {
      console.error("Error fetching revenue details:", error);
      await addServerLog({
        log_level: "ERROR",
        service_name: "getRevenueDetails",
        error_message: `getRevenueDetails Controller error - ${error.message}.`,
      });
      res.status(500).json({ error: error.message });
    }
  },

  assignChauffeurToScheduledRide: async (req, res) => {
    try {
      const { ride_id, chauffeur_id } = req.body;
      const result = await adminRides.assignChauffeurToScheduledRide(
        ride_id,
        chauffeur_id
      );
      if (result.error) {
        return res.status(result.statusCode).json({ error: result.error });
      }
      res.status(200).json({
        success: true,
        status: 201,
        message: "Chauffeur assigned successfully",
        data: result,
      });
    } catch (error) {
      console.error("Error assigning chauffeur:", error);
      await addServerLog({
        log_level: "ERROR",
        service_name: "assignChauffeurToScheduledRide",
        error_message: `assignChauffeurToScheduledRide Controller error - ${error.message}.`,
      });
      res.status(500).json({ error: error.message });
    }
  },

  reAssignChauffeurToScheduledRide: async (req, res) => {
    try {
      const { ride_id, chauffeur_id } = req.body;
      const result = await adminRides.reassignChauffeurToScheduledRide(
        ride_id,
        chauffeur_id
      );
      if (result.error) {
        return res.status(result.statusCode).json({ error: result.error });
      }
      res.status(200).json({
        success: true,
        status: 201,
        message: "Chauffeur reassigned successfully",
        data: result,
      });
    } catch (error) {
      console.error("Error reassigning chauffeur:", error);
      await addServerLog({
        log_level: "ERROR",
        service_name: "reAssignChauffeurToScheduledRide",
        error_message: `reAssignChauffeurToScheduledRide Controller error - ${error.message}.`,
      });
      res.status(500).json({ error: error.message });
    }
  },
  exportRidesToExcel: async (req, res) => {
    try {
      const { start_date, end_date, chauffeur_id, status } = req.body;

      // ✅ Validate Input Dates
      if (!start_date || !end_date) {
        return res
          .status(400)
          .json({ message: "Start date and end date are required." });
      }

      // ✅ Fetch rides from DB
      const rides = await ridesAdminpanelDOA.fetchRidesByDateRange(
        start_date,
        end_date,
        chauffeur_id,
        status
      );

      if (!rides || rides.length === 0) {
        return res
          .status(404)
          .json({ message: "No rides found for the selected date range." });
      }

      // ✅ Directly send the Excel file in response
      return excelService.exportRidesToExcel(rides, res);
    } catch (error) {
      console.error("🚨 Error exporting rides:", error);
      res
        .status(500)
        .json({
          message: "Failed to export rides to Excel",
          error: error.message,
        });
    }
  },
  distanceMetricsController: async (req, res) => {
    try {
      const { user_id, start_time, end_time } = req.body;

      if (!user_id || !start_time || !end_time) {
        return res
          .status(400)
          .json({ message: "user_id, start_time & end_time are required" });
      }

      const metrics = await getDistanceMetrics(user_id, start_time, end_time);
      return res.json(metrics);
    } catch (err) {
      const code = err.statusCode || 500;
      return res.status(code).json({ message: err.message });
    }
  },
};
