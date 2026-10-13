const express = require("express");
const {
  addPricingService,
  getOtherChargesForOrg,
  editPricingService,
  getPricingService
} = require("../services/pricingService.js");
const { addServerLog } = require("../services/serverLogsService"); // Update path if needed


const router = express.Router();

module.exports = {
  /**
   * @desc Add a new pricing entry
   * @access Private
   */
  addPricing: async (req, res) => {
    try {
      const allowedOrganisation = req.user.organization_id;
      const pricingData = req.body;
      const pricingId = await addPricingService(pricingData, allowedOrganisation);

      res.status(201).json({
        success: true,
        status: 201,
        data: { pricingId },
        message: "Pricing added successfully",
      });
    } catch (error) {
      const status = error.statusCode || 500;
      const message = error.message || "Internal server error";

      console.error("Error in pricing controller (addPricing):", error);
      await addServerLog({
        log_level: "ERROR",
        service_name: "addPricing",
        error_message: `addPricing Controller error - ${error.message}.`
      });
      res.status(status ||500).json({
        success: false,
        status,
        message,
      });
    }
  },

  getOtherChargesForOrg: async (req, res) => {
    try {
      const pricing = await getOtherChargesForOrg(req.body);
      return res.status(200).json({
        success: true,
        status: 200,
        data: pricing,
        message: "Other charges fetched successfully",
      });
    } catch (error) {
      console.error("Error in pricing controller (getOtherChargesForOrg):", error);
      await addServerLog({
        log_level: "ERROR",
        service_name: "getOtherChargesForOrg",
        error_message: `getOtherChargesForOrg Controller error - ${error.message}.`
      });
      return res.status(error.statusCode || 500).json({
        success: false,
        status: error.statusCode || 500,
        data: null,
        error: error.message,
      });
    }
  },

  editPricing: async (req, res) => {
    try {
      const {organisation_id} = req.body;
      const {pricing_id} = req.body;
      const updatedData = req.body;
  
      const updatedPricing = await editPricingService(
        organisation_id,
        pricing_id,
        updatedData
      );
  
      res.status(200).json({
        success: true,
        status: 200,
        data: updatedPricing,
        message: "Pricing updated successfully",
      });
    } catch (error) {
      const status = error.statusCode || 500;

      console.error("Error in pricing controller (editPricing):", error);
      await addServerLog({
        log_level: "ERROR",
        service_name: "editPricing",
        error_message: `editPricing Controller error - ${error.message}.`,
      });
  
      res.status(status).json({
        success: false,
        status,
        message: error.message,
      });
    }
  },

  getPricing: async (req, res) => {
    try {
      const pricing = await getPricingService(req.body);
      return res.status(200).json({
        success: true,
        status: 200,
        data: pricing,
        message: "Pricing fetched successfully",
      });
    } catch (error) {
      console.error("Error in pricing controller (getPricingForOrg):", error);
      await addServerLog({
        log_level: "ERROR",
        service_name: "getPricingForOrg",
        error_message: `getPricingForOrg Controller error - ${error.message}.`
      });
      return res.status(error.statusCode || 500).json({
        success: false,
        status: error.statusCode || 500,
        data: null,
        error: error.message, 
      });
    }
  },
  
};
