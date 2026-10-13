const invoiceService = require('../services/invoiceServices');
const rideService = require('../services/rideService');
const invoicePaymentSchema = require('../validators/invoiceValidator');
const rideController = require('./rideController');
const { addServerLog } = require("../services/serverLogsService"); // Update path if needed

module.exports = {
  generateInvoice: async (req, res) => {
    try {
      const { organization_id, start_date, end_date } = req.body;

      if (!organization_id || !start_date || !end_date) {
        return res.status(400).json({ error: "organization_id, start_date, and end_date are required" });
      }

      const invoiceData = await invoiceService.generateInvoice(organization_id, start_date, end_date);

      res.status(200).json({
        success: true,
        message: "Invoice generated successfully",
        data: invoiceData,
      });
    } catch (error) {
      console.error("Error generating invoice:", error.message);
      await addServerLog({
        log_level: "ERROR",
        service_name: "generateInvoice",
        error_message: `generateInvoice Controller error - ${error.message}.`
      });
      res.status(500).json({ success: false, error: error.message });
    }
  },

  invoicePayment: async (req, res) => {
    try {
      await invoicePaymentSchema.validateAsync(req.body, { abortEarly: false });

      const { invoice_number, user_id } = req.body;

      if (!invoice_number || !user_id) {
        return res.status(400).json({
          success: false,
          message: "Invoice number and user id are required.",
        });
      }

      const payment = await invoiceService.invoicePayment(invoice_number, user_id);

      return res.status(200).json({
        success: true,
        message: `Invoice ${invoice_number} has been successfully paid.`,
        data: payment,
      });
    } catch (error) {
      console.error("Error in invoice payment:", error.message);
      await addServerLog({
        log_level: "ERROR",
        service_name: "invoicePayment",
        error_message: `invoicePayment Controller error - ${error.message}.`
      });
      if (error.message.includes("not found") ||
          error.message.includes("Incorrect payment amount") ||
          error.message.includes("already paid")) {
        return res.status(400).json({ success: false, error: error.message });
      }
      res.status(500).json({ success: false, message: "Internal server error", error: error.message });
    }
  },

  getInvoices: async (req, res) => {
    try {
      let { page, limit, organization_id, is_paid } = req.body;

      const invoices = await invoiceService.getInvoices(page, limit, organization_id, is_paid);

      res.status(200).json({
        success: true,
        message: "Invoices fetched successfully",
        data: invoices.rows,
        totalRecords: invoices.count,
        totalPages: Math.ceil(invoices.count / limit),
        currentPage: page,
      });
    } catch (error) {
      console.error("Error fetching invoices:", error.message);
      await addServerLog({
        log_level: "ERROR",
        service_name: "getInvoices",
        error_message: `getInvoices Controller error - ${error.message}.`
      });
      res.status(500).json({
        success: false,
        message: "Failed to fetch invoices",
        error: error.message,
      });
    }
  },

  getInvoicebyId: async (req, res) => {
    try {
      const { invoice_id } = req.body;
      const invoice = await invoiceService.getInvoicebyId(invoice_id);

      res.status(200).json({
        success: true,
        message: "Invoice fetched successfully",
        data: invoice,
      });
    } catch (error) {
      console.error("Error fetching invoice by Id:", error.message);
      await addServerLog({
        log_level: "ERROR",
        service_name: "getInvoicebyId",
        error_message: `getInvoicebyId Controller error - ${error.message}.`
      });
      res.status(500).json({
        success: false,
        message: "Failed to fetch invoice by Id",
        error: error.message,
      });
    }
  },

  getOrgRides: async (req, res) => {
    try {
      const { organization_id, start_date, end_date } = req.body;
      const orgRides = await invoiceService.getOrgRides(organization_id, start_date, end_date);
      res.status(200).json({
        success: true,
        message: "Organization rides fetched successfully",
        data: orgRides,
      });
    } catch (error) {
      console.error("Error fetching organisational rides:", error.message);
      await addServerLog({
        log_level: "ERROR",
        service_name: "getOrgRides",
        error_message: `getOrgRides Controller error - ${error.message}.`
      });
      res.status(500).json({
        success: false,
        message: "Failed to fetch organisational rides",
        error: error.message,
      });
    }
  },

  getCreditedRides: async (req, res) => {
    try {
      const { start_date, end_date, chauffeur_id, pageNumber, pageSize, organization_id } = req.body;
      const orgRides = await invoiceService.getCreditedRides(start_date, end_date, chauffeur_id, pageNumber, pageSize, organization_id);
      res.status(200).json({
        success: true,
        message: "Organization rides fetched successfully",
        data: orgRides,
      });
    } catch (error) {
      console.error("Error fetching organisational rides:", error.message);
      await addServerLog({
        log_level: "ERROR",
        service_name: "getCreditedRides",
        error_message: `getCreditedRides Controller error - ${error.message}.`
      });
      res.status(500).json({
        success: false,
        message: "Failed to fetch organisational rides",
        error: error.message,
      });
    }
  }
};
