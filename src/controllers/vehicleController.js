const vehicleValidator = require("../validators/vehicleValidator");
const vehicleService = require("../services/vehicleService");
const { use } = require("../routes");
const { addServerLog } = require("../services/serverLogsService"); // Update the path if needed
const {uploadToS3} = require("../utils/s3Uploader");
const  {VehicleDetail} = require("../dto")
module.exports = {
  // Create a new vehicle
createVehicle: async (req, res) => {
    try {
      // Validate request payload
      const user_id = req.user.id;
      const vehicleData = await vehicleValidator.validateVehicle(req.body);

      console.log("vehicleData:", vehicleData);

      const files = req.files;

      const imageUrls = [];

      if (files && files.length > 0) {
        for (const file of files) {
          const fileExtension = file.originalname.split(".").pop();
          const fileName = `Vehicle_images/Vehicles/${Date.now()}.${fileExtension}`;
          const imageUrl = await uploadToS3(file.buffer, fileName, file.mimetype);
          imageUrls.push(imageUrl);
        }
      }

      // Attach image URLs to media_data in vehicleDetails
      vehicleData.vehicleDetails = vehicleData.vehicleDetails || {};
      vehicleData.vehicleDetails.media_data = imageUrls;
      vehicleData.vehicleDetails.emirate_name = vehicleData.emirate_name;


      // Call service to create vehicle and vehicle details
      const vehicle = await vehicleService.createVehicle(vehicleData, user_id);

      res.status(201).json({
        success: true,
        status: 201,
        message: "Vehicle created successfully",
        data: vehicle,
      });
    } catch (error) {
      console.error("Error in createVehicle:", error);
      await addServerLog({
        log_level: "ERROR",
        service_name: "createVehicle",
        error_message: `createVehicle Controller error - ${error.message}.`
      });
      res.status(400).json({
        success: false,
        status: 400,
        message: "Failed to create vehicle",
        error: error.message,
      });
    }
  },
  createVehicleByAdmin: async (req, res) => {
    try {
      const vehicleData = await vehicleValidator.validateCreateVehicleByAdmin(req.body, { abortEarly: false });
      console.log("vehicleData:", vehicleData);
      const files = req.files;

      const imageUrls = [];

      if (files && files.length > 0) {
        for (const file of files) {
          const fileExtension = file.originalname.split(".").pop();
          const fileName = `Vehicle_images/Vehicles/${Date.now()}.${fileExtension}`;
          const imageUrl = await uploadToS3(file.buffer, fileName, file.mimetype);
          imageUrls.push(imageUrl);
        }
      }

      // Attach image URLs to media_data in vehicleDetails
      vehicleData.vehicleDetails = vehicleData.vehicleDetails || {};
      vehicleData.vehicleDetails.media_data = imageUrls;
      vehicleData.vehicleDetails.emirate_name = vehicleData.emirate_name;

      const vehicle = await vehicleService.createVehicle(vehicleData, vehicleData.user_id);

      res.status(201).json({
        success: true,
        status: 201,
        message: "Vehicle created successfully",
        data: vehicle,
      });
    } catch (error) {
      console.error("Error in createVehicleByAdmin:", error);
      await addServerLog({
        log_level: "ERROR",
        service_name: "createVehicleByAdmin",
        error_message: `createVehicleByAdmin Controller error - ${error.message}.`,
      });
      res.status(400).json({
        success: false,
        status: 400,
        message: "Failed to create vehicle",
        error: error.message,
      });
    }
  },

  // New Method to Fetch All Vehicles (for organization)
  getAllVehicles: async (req, res) => {
    try {
      // Extract organization ID from token
      const org_id = req.user.organization_id;
      const { page, limit } = req.params;
      const { search_string } = req.body;

      console.log("Organization", org_id)

      const vehicles = await vehicleService.getAllVehicles(org_id, page, limit, search_string);
      res
        .status(200)
        .json({
          success: true,
          status: 200,
          message: "Vehicles retrieved successfully",
          data: vehicles,
        });
    } catch (error) {
      console.error("Error in getAllVehicles:", error);
      await addServerLog({
        log_level: "ERROR",
        service_name: "getAllVehicles",
        error_message: `getAllVehicles Controller error - ${error.message}.`
      });
      res.status(500).json({
        success: false,
        status: 500,
        message: "Failed to retrieve vehicles",
        error: error.message,
      });
    }
  },

  // New Method to Fetch All Vehicles of a User
  getAllVehiclesOfUser: async (req, res) => {
    try {
      const user_id = req.user.id;
      const vehicles = await vehicleService.getAllVehiclesOfUser(user_id);
      res.status(200).json({
        success: true,
        status: 200,
        message: "Vehicles retrieved successfully",
        data: vehicles,
      });
    } catch (error) {
      console.error("Error in getAllVehiclesOfUser:", error);
      await addServerLog({
        log_level: "ERROR",
        service_name: "getAllVehiclesOfUser",
        error_message: `getAllVehiclesOfUser Controller error - ${error.message}.`
      });
      res.status(500).json({
        success: false,
        status: 500,
        message: "Failed to retrieve vehicles",
        error: error.message,
      });
    }
  },

  // Update vehicle (customer)
  // Update vehicle (customer)
  updateVehicle: async (req, res) => {
    try {
      const { id } = req.params;
      console.log("updateVehicle", req.body);
      const vehicleData = await vehicleValidator.validateUpdateVehicle(req.body);
      //const userId = req.user.id;
      
         // Handle file uploads
      let mediaData = [];
      if (req.files && req.files.length > 0) {
      // Upload each file to S3
          mediaData = await Promise.all(
          req.files.map(async (file) => {
            const fileName = `Vehicle_images/Vehicles/${Date.now()}-${file.originalname}`;
            const mimeType = file.mimetype;
            const location = await uploadToS3(file.buffer, fileName, mimeType);
            return location;
          })
        );
      } 

      // Fetch existing vehicleDetail if needed
      let existingVehicleDetail = null;
      if (mediaData.length === 0 && req.body.media_data !== "null") {
         existingVehicleDetail = await VehicleDetail.findOne({ where: { vehicle_id: id } });
      }

      // Merge media_data into vehicleDetails
      if (mediaData.length > 0) {
        vehicleData.vehicleDetails = {
          ...vehicleData.vehicleDetails,
          media_data: mediaData,
        };
      }else if (req.body.media_data === "null") {
        // Explicit request to clear media_data
        vehicleData.vehicleDetails = {
          ...vehicleData.vehicleDetails,
          media_data: null,
        };
      }else if (existingVehicleDetail?.media_data) {
        vehicleData.vehicleDetails = {
          ...vehicleData.vehicleDetails,
          media_data: existingVehicleDetail.media_data,
        };
      }
    
      vehicleData.vehicleDetails.emirate_name = vehicleData.emirate_name;

      //const updatedVehicle = await vehicleService.updateVehicle(id, vehicleData,userId);
      
      const updatedVehicle = await vehicleService.updateVehicle(id, vehicleData);

      res.status(200).json({
        success: true,
        status: 200,
        message: "Vehicle updated successfully",
        data: updatedVehicle,
      });
    } catch (error) {
      console.error("Error in updateVehicle:", error);
      await addServerLog({
        log_level: "ERROR",
        service_name: "updateVehicle",
        error_message: `updateVehicle Controller error - ${error.message}.`
      });
      if (
        error.message === "Vehicle not found" ||
        error.message === "Registration number already exists"
      || error.message === "Unauthorized to update this vehicle"
      ) {
        return res.status(400).json({
          success: false,
          status: 400,
          message: error.message,
        });
      }
      res.status(500).json({
        success: false,
        status: 500,
        message: "Internal Server Error",
        error: error.message,
      });
    }
  },

  // Delete Vehicle (customer)
  deleteVehicle: async (req, res) => {
    try {
      const { id } = req.params;
      const user_id = req.user.id;
      await vehicleService.deleteVehicle(id, user_id);
      res.status(200).json({
        success: true,
        status: 200,
        message: "Vehicle deleted successfully",
      });
    } catch (error) {
      console.error("Error in deleteVehicle:", error);
      await addServerLog({
        log_level: "ERROR",
        service_name: "deleteVehicle",
        error_message: `deleteVehicle Controller error - ${error.message}.`
      });
      res.status(400).json({
        success: false,
        status: 400,
        message: "Failed to delete vehicle",
        error: error.message,
      });
    }
  },

  // Update Vehicle by Admin
// updateVehicleByAdmin: async (req, res) => {
//   try {
//     const { id } = req.params; // Get vehicle ID from URL

    
//     const vehicleData = await vehicleValidator.validateUpdateVehicleByAdmin(req.body);

//     // Call service to update vehicle
//     const updatedVehicle = await vehicleService.updateVehicleAdmin(id, vehicleData);

//     res.status(200).json({
//       success: true,
//       status: 200,
//       message: "Vehicle updated successfully",
//       data: updatedVehicle,
//     });
//   } catch (error) {
    
//     if (error.message === "Vehicle not found" || error.message === "Registration number already exists") {
//       return res.status(400).json({
//         success: false,
//         status: 400,
//         message: error.message,
//       });
//     }

//     res.status(500).json({
//       success: false,
//       status: 500,
//       message: "Internal Server Error",
//       error: error.message,
//     });
//   }
//   },

updateVehicleByAdmin: async (req, res) => {
  const { id } = req.params;
  const vehicleData = req.body;

  try {

    // Handle file uploads
    let mediaData = [];
    if (req.files && req.files.length > 0) {
      // Upload each file to S3
      mediaData = await Promise.all(
        req.files.map(async (file) => {
          const fileName = `Vehicle_images/Vehicles/${Date.now()}-${file.originalname}`;
          const mimeType = file.mimetype;
          const location = await uploadToS3(file.buffer, fileName, mimeType);
          return location;
        })
      );
    }

    // Merge media_data into vehicleDetails
    if (mediaData.length > 0) {
      vehicleData.vehicleDetails = {
        ...vehicleData.vehicleDetails,
        media_data: mediaData,
      };
    }

    const updatedVehicle = await vehicleService.updateVehicle(id, vehicleData);
    res.status(200).json({
      success: true,
      status: 200,
      message: "Vehicle updated successfully",
      data: updatedVehicle,
    });
  } catch (error) {
    console.error("Error updating vehicle:", error);

    if (error.message === "Vehicle not found" || error.message === "Registration number already exists") {
      return res.status(400).json({
        success: false,
        status: 400,
        message: error.message,
      });
    }

    res.status(500).json({
      success: false,
      status: 500,
      message: "Internal Server Error",
      error: error.message,
    });
  }
},


  getVehiclesbyId: async (req, res) => {
    const { customer_id } = req.params;
    try {
      const vehicles = await vehicleService.getAllVehiclesOfUser(customer_id);
      res.status(200).json({
        success: true,
        status: 200,
        message: "Vehicles retrieved successfully",
        data: vehicles,
      });
    } catch (error) {
      console.error("Error in getVehiclesbyId:", error);
      await addServerLog({
        log_level: "ERROR",
        service_name: "getVehiclesbyId",
        error_message: `getVehiclesbyId Controller error - ${error.message}.`
      });
      res.status(500).json({
        success: false,
        status: 500,
        message: "Failed to retrieve vehicles",
        error: error.message,
      });
    }
  },

  getVehiclesByOrganizationId: async (req, res) => {
    const { organization_id } = req.params;
  
    try {
      const vehicles = await vehicleService.getAllVehiclesOfOrganization(organization_id);
      res.status(200).json({
        success: true,
        status: 200,
        message: "Vehicles retrieved successfully",
        data: vehicles,
      });
    } catch (error) {
      console.error("Error in getVehiclesByOrganizationId:", error);
      await addServerLog({
        log_level: "ERROR",
        service_name: "getVehiclesByOrganizationId",
        error_message: `getVehiclesByOrganizationId Controller error - ${error.message}`,
      });
      res.status(500).json({
        success: false,
        status: 500,
        message: "Failed to retrieve vehicles for organization",
        error: error.message,
      });
    }
  },
  

  // Update vehicle model for a brand
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
      const result = await vehicleService.updateModel(brand, old_model, new_model);
      res.status(200).json({
        success: true,
        status: 200,
        message: `Model for brand ${brand} updated successfully from ${old_model} to "${new_model}".`,
        data: result,
      });
    } catch (error) {
      console.error("Error in updateModel:", error);
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
      console.error("Error in listBrandsAndModels:", error);
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
  getCountryPlateFormats: async(req,res)=>{
    try {
      const countryPlateFormats = await vehicleService.generatePlateCodes();
      
      res.status(200).json({
        success: true,
        status: 200,
        data: countryPlateFormats,
        message: "Country plate formats fetched successfully",
      });
    } catch (error) {
      console.error("Error in getCountryPlateFormats:", error);
      await addServerLog({
        log_level: "ERROR",
        service_name: "getCountryPlateFormats",
        error_message: `Error fetching country plate formats: ${error.message}`,
      });
      res.status(500).json({
        success: false,
        status: error.status || 500,
        message: "Failed to fetch country plate formats",
        error: error.message,
      });
    }
},

AdminDeleteVehicle: async (req, res) => {
  try {
    const { id } = req.params;
    //const user_id = req.user.id;
    await vehicleService.adminDeleteVehicle(id);
    res.status(200).json({
      success: true,
      status: 200,
      message: "Vehicle deleted successfully",
    });
  } catch (error) {
    console.error("Error in deleteVehicle:", error);
    await addServerLog({
      log_level: "ERROR",
      service_name: "deleteVehicle",
      error_message: `deleteVehicle Controller error - ${error.message}.`
    });
    res.status(400).json({
      success: false,
      status: 400,
      message: "Failed to delete vehicle",
      error: error.message,
    });
  }
},

orgUserDeleteVehicle: async (req, res) => {
  try {
    const { id } = req.params;
    const org_id = req.user.organization_id;
    await vehicleService.orgDeleteVehicle(id, org_id);
    res.status(200).json({
      success: true,
      status: 200,
      message: "Vehicle deleted successfully",
    });
  } catch (error) {
    console.error("Error in deleteVehicle:", error);
    await addServerLog({
      log_level: "ERROR",
      service_name: "deleteVehicle",
      error_message: `deleteVehicle Controller error - ${error.message}.`
    });
    res.status(400).json({
      success: false,
      status: 400,
      message: "Failed to delete vehicle",
      error: error.message,
    });
  }
},


};
