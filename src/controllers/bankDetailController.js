// src/controllers/bankDetailController.js
const bankDetailService = require('../services/bankDetailService');

module.exports = {
  createBankDetail: async (req, res) => {
    try {
      const created = await bankDetailService.createBankDetail(req.body);
      res.status(201).json({
        success: true,
        status: 201,
        data: created,
      });
    } catch (error) {
      console.error('Error creating BankDetail:', error);
      res.status(error.statusCode || 400).json({
        success: false,
        status: error.statusCode || 400,
        message: error.message || 'Failed to create bank detail',
      });
    }
  },

  getBankDetailById: async (req, res) => {
    try {
      const detail = await bankDetailService.getBankDetailById(req.body);
      res.status(200).json({
        success: true,
        status: 200,
        data: detail,
      });
    } catch (error) {
      console.error('Error fetching BankDetail:', error);
      res.status(error.statusCode || 400).json({
        success: false,
        status: error.statusCode || 400,
        message: error.message || 'Failed to fetch bank detail',
      });
    }
  },

  getAllBankDetails: async (req, res) => {
    try {
      const detail = await bankDetailService.getAllBankDetails();
      res.status(200).json({
        success: true,
        status: 200,
        data: detail,
      });
    } catch (error) {
      console.error('Error fetching BankDetails:', error);
      res.status(error.statusCode || 400).json({
        success: false,
        status: error.statusCode || 400,
        message: error.message || 'Failed to fetch bank detail',
      });
    }
  },

  updateBankDetail: async (req, res) => {
    try {
      const updated = await bankDetailService.updateBankDetail(req.params.id, req.body);
      res.status(200).json({
        success: true,
        status: 200,
        data: updated,
      });
    } catch (error) {
      console.error('Error updating BankDetail:', error);
      res.status(error.statusCode || 400).json({
        success: false,
        status: error.statusCode || 400,
        message: error.message || 'Failed to update bank detail',
      });
    }
  },

  deleteBankDetail: async (req, res) => {
    try {
      await bankDetailService.deleteBankDetail(req.params.id);
      res.status(200).json({
        success: true,
        status: 200,
        message: 'Bank detail deleted (soft) successfully',
      });
    } catch (error) {
      console.error('Error deleting BankDetail:', error);
      res.status(error.statusCode || 400).json({
        success: false,
        status: error.statusCode || 400,
        message: error.message || 'Failed to delete bank detail',
      });
    }
  },
};
