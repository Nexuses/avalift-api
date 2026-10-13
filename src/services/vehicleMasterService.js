const vehicleMasterDAO = require('../dao/vehicleMasterDAO');
const path = require('path'); 
const { addServerLog } = require("../services/serverLogsService");

module.exports = {
  // Service to fetch models by brand
  getModelsByBrand: async (brand) => {
    try {
      if (!brand) {
        throw new Error('Brand is required');
      }
      const models = await vehicleMasterDAO.getModelsByBrand(brand);
      if (!models || models.length === 0) {
        throw new Error(`No models found for brand: ${brand}`);
      }
      return models;
    } catch (error) {
      await addServerLog({
        log_level: "ERROR",
        service_name: "getModelsByBrand",
        error_message: `getModelsByBrand failed: ${error.message}`,
      });
      throw error;
    }
  },

  getAllBrands: async () => {
    try {
      return await vehicleMasterDAO.getAllBrands();
    } catch (error) {
      await addServerLog({
        log_level: "ERROR",
        service_name: "getAllBrands",
        error_message: `getAllBrands failed: ${error.message}`,
      });
      throw new Error(`Error fetching brands: ${error.message}`);
    }
  },

  // Add a new model to an existing brand
  addModelToBrand: async (brand, model, brand_image) => {
    try {
      if (!brand || !model) {
        throw new Error("Both brand and model are required.");
      }
      const checkModel =  await vehicleMasterDAO.getModelByLower(model)
      if(checkModel){
        const error = new Error(`Model '${model}' already exists.`)
        error.statusCode = 400
        throw error
      }
      return await vehicleMasterDAO.addModelToBrand(brand, model, brand_image);
    } catch (error) {
      await addServerLog({
        log_level: "ERROR",
        service_name: "addModelToBrand",
        error_message: `addModelToBrand failed: ${error.message}`,
      });
      throw error;
    }
  },

  createBrand: async (brand_name, brandImagePath) => {
    try {
      const checkBrand = await vehicleMasterDAO.getBrandByLower(brand_name);
      if (checkBrand) {
        const error = new Error(`Brand '${brand_name}' already exists.`);
        error.statusCode = 400;
        throw error;
      }
      return await vehicleMasterDAO.saveBrand(brand_name, brandImagePath);
    } catch (error) {
      await addServerLog({
        log_level: "ERROR",
        service_name: "createBrand",
        error_message: `createBrand failed: ${error.message}`,
      });
      throw error;
    }
  },

  updateBrand: async (old_brand_name, new_brand_name, new_brand_image) => {
    if (!old_brand_name || !new_brand_name) {
      throw new Error("Old brand name and new brand name are required.");
    }
    try {
      const result = await vehicleMasterDAO.updateBrand(old_brand_name, new_brand_name, new_brand_image);
      if (!result) {
        console.log(`Brand '${old_brand_name}' not found in DAO.`);
        return null;
      }
      return result;
    } catch (error) {
      await addServerLog({
        log_level: "ERROR",
        service_name: "updateBrand",
        error_message: `updateBrand failed: ${error.message}`,
      });
      console.error("Error in updateBrand service:", error);
      throw error; 
    }
  },

  // Service to handle updating the model for an existing brand
  updateModel: async (brand, old_model, new_model) => {
    try {
      if (!brand || !old_model || !new_model) {
        throw new Error("Brand, old model, and new model are required.");
      }
      return await vehicleMasterDAO.updateModelForBrand(brand, old_model, new_model);
    } catch (error) {
      await addServerLog({
        log_level: "ERROR",
        service_name: "updateModel",
        error_message: `updateModel failed: ${error.message}`,
      });
      throw error;
    }
  },

  getBrandsWithModels: async () => {
    try {
      const items = await vehicleMasterDAO.getAllBrandsAndModels();
      const brandsMap = {};

      items.forEach((item) => {
        let { brand, model, brandImage } = item;
        brand = brand.trim();
        if (!brandsMap[brand]) {
          brandsMap[brand] = {
            brandImage: brandImage || null,
            models: [],
          };
        }
        if (!brandsMap[brand].brandImage && brandImage) {
          brandsMap[brand].brandImage = brandImage;
        }
        if (model !== "brand_details" && !brandsMap[brand].models.includes(model)) {
          brandsMap[brand].models.push(model); 
        }
      });
      return brandsMap;
    } catch (error) {
      await addServerLog({
        log_level: "ERROR",
        service_name: "getBrandsWithModels",
        error_message: `getBrandsWithModels failed: ${error.message}`,
      });
      console.error("Error in service layer:", error);
      throw error;
    }
  },
  deleteModelFromBrand: async (brand, model) => {
    try {
      if (!brand || !model) {
        throw new Error("Both brand and model are required.");
      }
  
      return await vehicleMasterDAO.deleteModelFromBrand(brand, model);
    } catch (error) {
      await addServerLog({
        log_level: "ERROR",
        service_name: "deleteModelFromBrand",
        error_message: `deleteModelFromBrand failed: ${error.message}`,
      });
      throw error;
    }
  },

  deleteBrand: async (brand) => {
    try {
      return await vehicleMasterDAO.deleteBrand(brand);
    } catch (error) {
      await addServerLog({
        log_level: "ERROR",
        service_name: "deleteBrand",
        error_message: `Service error - ${error.message}`,
      });
      throw error;
    }
  }
  
  
};
