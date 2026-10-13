const vehicleMasterService = require('../services/vehicleMasterService');
const vehicleMasterValidator = require("../validators/vehicleMasterValidator");
const { addServerLog } = require("../services/serverLogsService"); // Update path if needed

module.exports = {
  // Controller to fetch models by brand
  getModelsByBrand: async (req, res) => {
    try {
      const { brand } = req.params;
      // Call service to fetch models
      const models = await vehicleMasterService.getModelsByBrand(brand);
      // Filter out the model name "brand_details"
      const filteredModels = models.filter(model => model !== "brand_details");
      // Add "Others" option to the filtered list
      const modelsWithOthers = [...filteredModels, 'Others'];

      res.status(200).json({
        success: true,
        status: 200,
        message: `Models fetched successfully for brand: ${brand}`,
        data: {
          brand,
          models: modelsWithOthers,
        },
      });
    } catch (error) {
      console.error('Controller Error in getModelsByBrand:', error);
      await addServerLog({
        log_level: "ERROR",
        service_name: "getModelsByBrand",
        error_message: `getModelsByBrand Controller error - ${error.message}.`
      });
      res.status(400).json({
        success: false,
        status: 400,
        message: 'Failed to fetch models',
        error: error.message,
      });
    }
  },

  getAllBrands: async (req, res) => {
    try {
      const brands = await vehicleMasterService.getAllBrands();
      const brandsWithOthers = [...brands, { brand: "Others", brandImage: null }];
      res.status(200).json({
        success: true,
        status: 200,
        message: 'Brands fetched successfully',
        data: brandsWithOthers
      });
    } catch (error) {
      console.error('Controller Error in getAllBrands:', error);
      await addServerLog({
        log_level: "ERROR",
        service_name: "getAllBrands",
        error_message: `getAllBrands Controller error - ${error.message}.`
      });
      res.status(500).json({
        success: false,
        status: 500,
        message: 'Failed to fetch brands',
        error: error.message
      });
    }
  },
  
  createBrand: async (req, res) => {
    try {
      const { brand_name, brand_image } = req.body;
      if (!brand_image || !brand_name) {
        return res.status(400).json({
          success: false,
          message: "Brand name and image are required."
        });
      }

      const savedBrand = await vehicleMasterService.createBrand(brand_name, brand_image);
      res.status(201).json({
        success: true,
        status: 201,
        message: "Brand added successfully",
        data: savedBrand,
      });
    } catch (error) {
      console.error("Error in createBrandController:", error);
      await addServerLog({
        log_level: "ERROR",
        service_name: "createBrand",
        error_message: `createBrand Controller error - ${error.message}.`
      });
      res.status(error.statusCode || 500).json({
        success: false,
        status: error.statusCode || 500,
        message: "Failed to create brand.",
        error: error.message,
      });
    }
  },

  addModelToBrand: async (req, res) => {
    try {
      const { brand, model, brand_image } = req.body;
      if (!brand || !model) {
        return res.status(400).json({
          success: false,
          status: 400,
          message: "Brand and model are required.",
        });
      }
      const result = await vehicleMasterService.addModelToBrand(brand, model, brand_image);
      res.status(201).json({
        success: true,
        status: 201,
        message: `Model ${model} added successfully to brand ${brand}.`,
        data: result,
      });
    } catch (error) {
      console.error("Controller Error in addModelToBrand:", error);
      await addServerLog({
        log_level: "ERROR",
        service_name: "addModelToBrand",
        error_message: `addModelToBrand Controller error - ${error.message}.`
      });
      res.status(400).json({
        success: false,
        status: 400,
        message: "Failed to add model to brand.",
        error: error.message,
      });
    }
  },

  updateBrand: async (req, res) => {
    try {
      const { old_brand_name, new_brand_name, new_brand_image } = req.body;
      if (!old_brand_name || !new_brand_name || !new_brand_image) {
        return res.status(400).json({
          success: false,
          status: 400,
          message: "Old brand name, new brand name and new brand image are required."
        });
      }
      const result = await vehicleMasterService.updateBrand(old_brand_name, new_brand_name, new_brand_image);
      console.log("result:", result);
      if (!result) {
        return res.status(404).json({
          success: false,
          status: 404,
          message: `Brand '${old_brand_name}' not found.`
        });
      }
      return res.status(200).json({
        success: true,
        status: 200,
        message: "Brand updated successfully",
        data: result
      });
    } catch (error) {
      console.error("Error in updateBrand controller:", error);
      await addServerLog({
        log_level: "ERROR",
        service_name: "updateBrand",
        error_message: `updateBrand Controller error - ${error.message}.`
      });
      return res.status(500).json({ success: false, status: 500, message: "Internal server error" });
    }
  },

  updateModel: async (req, res) => {
    try {
      const { brand, old_model, new_model } = req.body;
      if (!brand || !old_model || !new_model) {
        return res.status(400).json({
          success: false,
          status: 400,
          message: "Brand, old model, and new model are required.",
        });
      }
      const result = await vehicleMasterService.updateModel(brand, old_model, new_model);
      res.status(200).json({
        success: true,
        status: 200,
        message: `Model for brand ${brand} updated successfully from ${old_model} to "${new_model}".`,
        data: result,
      });
    } catch (error) {
      console.error("Controller Error in updateModel:", error);
      await addServerLog({
        log_level: "ERROR",
        service_name: "updateModel",
        error_message: `updateModel Controller error - ${error.message}.`
      });
      res.status(500).json({
        success: false,
        status: 500,
        message: "Failed to update model.",
        error: error.message,
      });
    }
  },

  listBrandsAndModels: async (req, res) => {
    try {
      const brandsWithModels = await vehicleMasterService.getBrandsWithModels();
      res.status(200).json({
        success: true,
        status: 200,
        data: brandsWithModels,
        message: "Brands and models fetched successfully",
      });
    } catch (error) {
      console.error("Error in listing brands and models:", error);
      await addServerLog({
        log_level: "ERROR",
        service_name: "listBrandsAndModels",
        error_message: `listBrandsAndModels Controller error - ${error.message}.`
      });
      res.status(500).json({
        success: false,
        status: 500,
        message: "Failed to fetch brands and models",
        error: error.message,
      });
    }
  },

  deleteModelFromBrand: async (req, res) => {
    try {
      const { brand, model } = req.body;
  
      if (!brand || !model) {
        return res.status(400).json({
          success: false,
          status: 400,
          message: "Brand and model are required to delete.",
        });
      }
  
      const result = await vehicleMasterService.deleteModelFromBrand(brand, model);
      res.status(200).json({
        success: true,
        status: 200,
        message: `Model ${model} deleted successfully from brand ${brand}.`,
        data: result,
      });
    } catch (error) {
      console.error("Controller Error in deleteModelFromBrand:", error);
      await addServerLog({
        log_level: "ERROR",
        service_name: "deleteModelFromBrand",
        error_message: `deleteModelFromBrand Controller error - ${error.message}.`,
      });
      res.status(400).json({
        success: false,
        status: 400,
        message: "Failed to delete model from brand.",
        error: error.message,
      });
    }
  },

  deleteBrand: async (req, res) => {
    try {
      const { brand } = req.body;
      if (!brand) {
        return res.status(400).json({ success: false, message: "Brand is required." });
      }
  
      await vehicleMasterService.deleteBrand(brand);
  
      res.status(200).json({
        success: true,
        status: 200,
        message: `Brand ${brand} and all associated models deleted successfully.`,
      });
    } catch (error) {
      console.error("Controller Error in deleteBrand:", error);
      const isBrandNotFound = error.message.includes("No entries found for brand");

      await addServerLog({
        log_level: "ERROR",
        service_name: "deleteBrand",
        error_message: `Controller error - ${error.message}`,
      });

      if (isBrandNotFound) {
        return res.status(400).json({
          success: false,
          status: 400,
          message: `Brand "${req.body.brand}" doesn't exist in the table.`,
        });
      }

      res.status(500).json({ success: false, status: 500, message: "Internal Server Error" });
    }
  },
  
  getModelsForAdminPanel: async (req, res) => {
    try {
      const { brand } = req.params;
      // Call service to fetch models
      const models = await vehicleMasterService.getModelsByBrand(brand);
      // Filter out the model name "brand_details"
      const filteredModels = models.filter(model => model !== "brand_details");
      // Add "Others" option to the filtered list
      //const modelsWithOthers = [...filteredModels, 'Others'];

      res.status(200).json({
        success: true,
        status: 200,
        message: `Models fetched successfully for brand: ${brand}`,
        data: {
          brand,
          models: filteredModels,
        },
      });
    } catch (error) {
      console.error('Controller Error in getModelsByBrand:', error);
      await addServerLog({
        log_level: "ERROR",
        service_name: "getModelsByBrand",
        error_message: `getModelsByBrand Controller error - ${error.message}.`
      });
      res.status(400).json({
        success: false,
        status: 400,
        message: 'Failed to fetch models',
        error: error.message,
      });
    }
  },
  
};
