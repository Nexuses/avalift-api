const vehicleDAO = require("../dao/vehicleDAO");
const userDAO = require("../dao/userDAO");
const ridesDAO = require("../dao/ridesDAO");
const vehicleMasterDAO = require("../dao/vehicleMasterDAO");
const { addServerLog } = require("../services/serverLogsService");
const {deleteFromS3} = require("../utils/s3Uploader");
const{Vehicle,VehicleDetail } = require("../dto");

module.exports = {
  createVehicle: async (vehicleData, user_id) => {
    try {
      const { registration_no } = vehicleData;

    // Check if VIN already exists
    vehicleData.user_id = user_id;
    const existingVehicle = await vehicleDAO.findByVin(registration_no);
    if (existingVehicle) {
      throw new Error("Vehicle with this registration number already exists");
    }

      // Call DAO to create the vehicle and details
      return await vehicleDAO.create(vehicleData);
    } catch (error) {
      await addServerLog({
        log_level: "ERROR",
        service_name: "createVehicle",
        error_message: `createVehicle failed: ${error.message}`,
      });
      throw error;
    }
  },

  // New Method to Fetch All Vehicles
  getAllVehicles: async (organizationId, page, limit, search) => {
    try {
      // Calculate the offset for pagination
      const offset = (page - 1) * limit;

      // Fetch vehicles with pagination
      const { vehicles, totalCount } = await vehicleDAO.findAllVehicles(
        organizationId,
        limit,
        offset,
        search
      );

      // Calculate total pages
      const totalPages = Math.ceil(totalCount / limit);

      return {
        currentPage: page,
        totalPages,
        totalItems: totalCount,
        vehicles,
      };
    } catch (error) {
      await addServerLog({
        log_level: "ERROR",
        service_name: "getAllVehicles",
        error_message: `getAllVehicles failed: ${error.message}`,
      });
      console.error("Service Error: Unable to fetch vehicles", error);
      throw new Error("Service Error: Unable to fetch vehicles");
    }
},

  
  updateVehicle: async (id, vehicleData) => {
    try{
      // Check if vehicle exists
      const vehicle = await vehicleDAO.getById(id);
      if (!vehicle) {
        throw new Error("Vehicle not found");
      }

      // // Check if the vehicle belongs to this user
      // if (vehicle.user_id !== userId) {
      //   throw new Error("Unauthorized to update this vehicle");
      // }
  
      // check vehicle got active ride
      const activeRides = await vehicleDAO.getActiveRidesForVehicle(id);
      if (activeRides && activeRides.length > 0) {
        throw new Error(
          "Vehicle has existing or pending rides. Cannot update at this moment."
        );
      }
    // Check if registration_no is provided
    if (vehicleData.registration_no) {
      const existingVehicle = await vehicleDAO.findByVin(
        vehicleData.registration_no
      );
      // Allow update if no vehicle found OR the found vehicle is the same vehicle
      if (existingVehicle && existingVehicle.id !== parseInt(id)) {
        throw new Error("Registration number already exists");
      }
    }


    // Delete old images from S3 if new media_data is provided
    if (vehicleData.vehicleDetails && vehicleData.vehicleDetails.media_data) {
      const existingDetail = await VehicleDetail.findOne({ where: { vehicle_id: id } });
      if (existingDetail && existingDetail.media_data) {
        await Promise.all(existingDetail.media_data.map(deleteFromS3));
      }
    }

  
    // Update Vehicle
    return await vehicleDAO.update(id, vehicleData);
  }catch (error) {
    await addServerLog({
      log_level: "ERROR",
      service_name: "updateVehicle",
      error_message: `updateVehicle failed: ${error.message}`,
    });
    throw error;
  }
},

  // Delete Vehicle
  deleteVehicle: async (id, user_id) => {
    try {

      const vehicle = await vehicleDAO.getById(id);
      if (!vehicle) {
        throw new Error("Vehicle not found");
      }

      const checkVehicle = await vehicleDAO.findByVinAndUser(vehicle.registration_no, user_id);
      if (!checkVehicle) {
        throw new Error("You cannot delete a vehicle that does not belong to you.");
      }
      // Check if vehicle has existing ride
      const rides = await vehicleDAO.getActiveRidesForVehicle(id);
      if (rides && rides.length > 0) {
        throw new Error(
          "Vehicle has existing or pending rides. Cannot delete at this moment."
        );
      }

      return await vehicleDAO.delete(id);
    } catch (error) {
      await addServerLog({
        log_level: "ERROR",
        service_name: "deleteVehicle",
        error_message: `deleteVehicle failed: ${error.message}`,
      });
      throw error;
    }
  },

  updateVehicleAdmin: async (id, vehicleData) => {
    try {
      // Check if vehicle exists
      const vehicle = await vehicleDAO.getById(id);
      if (!vehicle) {
        throw new Error("Vehicle not found");
      }
      // Check unique registration number if provided
      if (vehicleData.registration_no) {
        const existingVehicle = await vehicleDAO.findByVin(
          vehicleData.registration_no
        );
        console.log("existingVehicle:", existingVehicle);
        console.log("id:", id);
        console.log("existingVehicle.id:", existingVehicle.id);
        if (existingVehicle && existingVehicle.id !== id) {
          throw new Error("Registration number already exists");
        }
      }
      return await vehicleDAO.update(id, vehicleData);
    } catch (error) {
      await addServerLog({
        log_level: "ERROR",
        service_name: "updateVehicleAdmin",
        error_message: `updateVehicleAdmin failed: ${error.message}`,
      });
      throw error;
    }
  },
  


  getAllVehiclesOfUser: async (user_id) => {
    try {
      let vehicles = await vehicleDAO.findAllVehiclesOfUser(user_id);
      // Convert Sequelize instances to plain objects
      vehicles = vehicles.map((vehicle) => vehicle.get({ plain: true }));
      return await fetchVehicleBrandImages(vehicles);
    } catch (error) {
      await addServerLog({
        log_level: "ERROR",
        service_name: "getAllVehiclesOfUser",
        error_message: `getAllVehiclesOfUser failed: ${error.message}`,
      });
      console.error("Service Error: Unable to fetch vehicles", error);
      throw new Error("Service Error: Unable to fetch vehicles");
    }
  },

  getAllVehiclesOfOrganization: async (organizationId) => {
    try {
      const result = await vehicleDAO.findAllVehiclesOfOrganization(organizationId);
      let vehicles = result.vehicles; // Extract the actual array
      console.log(vehicles);
  
      vehicles = vehicles.map(vehicle => vehicle.get({ plain: true }));
      return await fetchVehicleBrandImages(vehicles);
    } catch (error) {
      await addServerLog({
        log_level: "ERROR",
        service_name: "getAllVehiclesOfOrganization",
        error_message: `getAllVehiclesOfOrganization failed: ${error.message}`,
      });
      console.error("Service Error: Unable to fetch org vehicles", error);
      throw new Error("Service Error: Unable to fetch vehicles for organization");
    }
  },
fetchPlateFormats: async() =>{
    try {
      const uaeRegions = {
        "Abu Dhabi": "AD",
        "Dubai": "DXB",
        "Sharjah": "SHJ",
        "Ajman": "AJ",
        "Ras Al Khaimah": "RAK",
        "Fujairah": "FUJ",
        "Umm Al Quwain": "UAQ",
        "Al Ain": "AIN",
      };

      const plateFormats = {
        AD: {
            name: "Abu Dhabi",
            numberLength: 4,    // Length of numeric part
            textLength: 2       // Length of text part (e.g., letters or Arabic characters)
        },
        DXB: {
            name: "Dubai",
            numberLength: 5,
            textLength: 2
        },
        SHJ: {
            name: "Sharjah",
            numberLength: 4,
            textLength: 2
        },
        AJ: {
            name: "Ajman",
            numberLength: 4,
            textLength: 2
        },
        RAK: {
            name: "Ras Al Khaimah",
            numberLength: 4,
            textLength: 2
        },
        FUJ: {
            name: "Fujairah",
            numberLength: 4,
            textLength: 2
        },
        UAQ: {
            name: "Umm Al Quwain",
            numberLength: 4,
            textLength: 2
        },
        AIN: {
            name: "Al Ain",
            numberLength: 4,
            textLength: 2
        }
    };
    
      return {uaeRegions, plateFormats};
    } catch (error) {
      console.error('Error fetching plate formats:', error);
      await addServerLog({
        log_level: "ERROR",
        service_name: "fetchPlateFormats",
        error_message: `fetchPlateFormats failed: ${error.message}`,
      });
      throw error;
    }
  },
  validatePlateNumber: async(emirateName, plateNumber) => {
    try{
    const format = await vehicleDAO.findPlateFormat(emirateName);
  
    if (!format) return { valid: false, message: "Emirate not found" };
  
    const [code, numberPart] = plateNumber.split('-');
    if (!code || !numberPart) {
      return { valid: false, message: "Invalid plate format (missing parts)" };
    }
  
    // 1. Validate digit length
    if (!/^\d+$/.test(numberPart) || numberPart.length !== format.number_of_digits) {
      return { valid: false, message: `Plate number must be ${format.number_of_digits} digits` };
    }
  
    // 2. Validate code
    const startCode = format.starting_plate_code;
    const endCode = format.ending_plate_code;
  
    const isAlphaRange = /^[A-Z]{1,2}$/.test(code);
    const isNumRange = /^\d+$/.test(code);
  
    const normalizeCode = (str) => str.replace(/\s/g, '').toUpperCase();
  
    if (startCode && endCode) {
      const normalizedStart = normalizeCode(startCode);
      const normalizedEnd = normalizeCode(endCode);
      const normalizedCode = normalizeCode(code);
  
      if (isAlphaRange && /^[A-Z]+$/.test(normalizedStart)) {
        if (normalizedCode < normalizedStart || normalizedCode > normalizedEnd) {
          return { valid: false, message: `Code must be between ${startCode} and ${endCode}` };
        }
      } else if (isNumRange && /^\d+$/.test(normalizedStart)) {
        const codeNum = parseInt(normalizedCode);
        const startNum = parseInt(normalizedStart);
        const endNum = parseInt(normalizedEnd);
        if (codeNum < startNum || codeNum > endNum) {
          return { valid: false, message: `Code number must be between ${startCode} and ${endCode}` };
        }
      } else {
        return { valid: false, message: "Unsupported plate code format" };
      }
    }
  
    return { valid: true, message: "Plate number is valid" };
  }catch(error){
  await addServerLog({
    log_level: "ERROR",
    service_name: "validatePlateNumber",
    error_message: `validatePlateNumber failed: ${error.message}`,
  });
  throw error;
  }
  },
   // vehicleService.js

 generatePlateCodes: async () => {

  const formats = await vehicleDAO.getPlateFormats();
  const results = [];

  formats.forEach(({ emirate_name, start_code_type, starting_plate_code, ending_plate_code, number_of_digits, region_url }) => {
    const codes = [];

    const generateAlpha = (start, end) => {
      const s = start.charCodeAt(0);
      const e = end.charCodeAt(0);
      for (let i = s; i <= e; i++) {
        codes.push(String.fromCharCode(i));
      }
    };

    const generateDoubleAlpha = (start, end) => {

      for (let i = 65; i <= 90; i++) {
        codes.push(String.fromCharCode(i));
      }

      for (let i = 65; i <= 90; i++) {
        for (let j = 65; j <= 90; j++) {
          const code = String.fromCharCode(i) + String.fromCharCode(j);
          if (code >= start && code <= end) codes.push(code);
        }
      }
    };

    const generateNumeric = (start, end) => {
      for (let i = parseInt(start); i <= parseInt(end); i++) {
        codes.push(i.toString());
      }
    };

    switch (start_code_type) {
      case "alpha":
        generateAlpha(starting_plate_code, ending_plate_code);
        break;
      case "double_alpha":
        generateDoubleAlpha(starting_plate_code, ending_plate_code);
        break;
      case "numeric":
        generateNumeric(starting_plate_code, ending_plate_code);
        break;
      case "custom":
        codes.push("Any");
        break;
      default:
        break;
    }

    results.push ({
      emirateName: emirate_name,
      plateCodes: codes,
      numberOfDigits: number_of_digits,
      imageUrl: region_url
    });
  });

  return results;
},

adminDeleteVehicle: async (id) => {
  try {

    const vehicle = await vehicleDAO.getById(id);
    if (!vehicle) {
      throw new Error("Vehicle not found");
    }

    // const checkVehicle = await vehicleDAO.findByVinAndUser(vehicle.registration_no, user_id);
    // if (!checkVehicle) {
    //   throw new Error("You cannot delete a vehicle that does not belong to you.");
    // }
    // Check if vehicle has existing ride
    const rides = await vehicleDAO.getActiveRidesForVehicle(id);
    if (rides && rides.length > 0) {
      throw new Error(
        "Vehicle has existing or pending rides. Cannot delete at this moment."
      );
    }

    return await vehicleDAO.delete(id);
  } catch (error) {
    await addServerLog({
      log_level: "ERROR",
      service_name: "deleteVehicle",
      error_message: `deleteVehicle failed: ${error.message}`,
    });
    throw error;
  }
},
orgDeleteVehicle: async (id, org_id) => {
  try {

    const vehicle = await vehicleDAO.getById(id);
    if (!vehicle) {
      throw new Error("Vehicle not found");
    }

    const checkOrgVehicle = await vehicleDAO.isVehicleInOrganization(org_id, vehicle.id);
    if (!checkOrgVehicle) {
      throw new Error("You cannot delete a vehicle that does not belong to your organization.");
    }
    const rides = await vehicleDAO.getActiveRidesForVehicle(id);
    if (rides && rides.length > 0) {
      throw new Error(
        "Vehicle has existing or pending rides. Cannot delete at this moment."
      );
    }

    return await vehicleDAO.delete(id);
  } catch (error) {
    await addServerLog({
      log_level: "ERROR",
      service_name: "deleteVehicle",
      error_message: `deleteVehicle failed: ${error.message}`,
    });
    throw error;
  }
},

};



// const fetchVehicleBrandImages = async (vehicles) => {
//   try {
//     return Promise.all(
//       vehicles.map(async (vehicle) => {
//         console.log("vehicle:", vehicle);
//         if (!vehicle?.vehicleDetail) {
//           // Optionally log skipped vehicle for debugging
//           console.warn(`Skipped vehicle with null vehicleDetail: ${vehicle?.id}`);
//           return vehicle;
//         }
//         const make = vehicle.vehicleDetail.make;
//         const model = vehicle.vehicleDetail.model;
//         const brandImage = await vehicleMasterDAO.getBrandImage(make, model);
//         return {
//           ...vehicle,
//           vehicleDetail: {
//             ...vehicle.vehicleDetail, 
//             is_others, 
//             brandImage: brandImage || "Image not found",
//           },
//         };
//       })
//     );
//   } catch (error) {
//     await addServerLog({
//       log_level: "ERROR",
//       service_name: "fetchVehicleBrandImages",
//       error_message: `fetchVehicleBrandImages failed: ${error.message}`,
//     });
//     throw error;
//   }
// };



const fetchVehicleBrandImages = async (vehicles) => {
  try {
    return Promise.all(
      vehicles.map(async (vehicle) => {
        if (!vehicle?.vehicleDetail) {
          // Optionally log skipped vehicle for debugging
          console.warn(`Skipped vehicle with null vehicleDetail: ${vehicle?.id}`);
          return vehicle;
        }
        const { make, model, media_data, ...restDetails } = vehicle.vehicleDetail;

        const hasMediaData = Array.isArray(media_data) && media_data.length > 0;

        let image;
        let is_others = false;

        if (hasMediaData) {
          image = media_data[0];
          is_others = true;
        } else {
          //const brandImageData = await vehicleMasterDAO.getBrandImage(make, model);
          const brandImageData = await vehicleMasterDAO.getBrandImage(make,"brand_details" );

          //image = (brandImageData.length > 0 && brandImageData[0].brandImage) || null;
          image=brandImageData.brandImage || null;
        }

        return {
          ...vehicle,
          vehicleDetail: {
            ...restDetails, // exclude media_data and brandImage
            make,
            model,
            image, // ✅ only one field shown in the response
            is_others, 
          },
        };
      })
    );
  } catch (error) {
    await addServerLog({
      log_level: "ERROR",
      service_name: "fetchVehicleBrandImages",
      error_message: `fetchVehicleBrandImages failed: ${error.message}`,
    });
    throw error;
  }
};


