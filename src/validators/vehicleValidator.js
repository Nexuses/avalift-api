// src/validators/vehicleValidator.js

const Joi = require("joi");
const { validate } = require("./invoiceValidator");
const vehicleDAO = require("../dao/vehicleDAO");
const {
  validatePlate
} = require("../helpers/vehicleHelper");

const plateCodeValidator = async (value, payload) => {
  try {
    const emirate = (payload.emirate_name || "").trim();

    if (!emirate) {
      throw new Error("emirate_name is required for plate validation");
    }

    const formats = await vehicleDAO.getPlateFormats();
    const fmt = formats.find(f => f.emirate_name === emirate);

    if (!fmt) {
      throw new Error(`No plate format defined for '${emirate}'`);
    }

    const {
      start_code_type,
      starting_plate_code,
      ending_plate_code,
      number_of_digits
    } = fmt;

    const plate = value.trim();

    // Handle "numeric" format
    console.log("plate", plate);
    console.log("Number of digits", number_of_digits);

    if (start_code_type === "numeric") {
      // Remove the first two digits
      const trimmedPlate = plate.slice(2); // remove first two characters

      // Check that the remaining is all digits
      if (!/^\d+$/.test(trimmedPlate)) {
        throw new Error(`Plate must be numeric after removing first two digits`);
      }

      const numericValue = parseInt(plate[0], 10); // check and change need to handle 51 
      const start = parseInt(starting_plate_code, 10);
      const end = parseInt(ending_plate_code, 10);

      if (numericValue < start || numericValue > end) {
        throw new Error(`Plate must be between ${start} and ${end}`);
      }

      return plate; // or return original `plate` if needed
    }



    // Handle "alpha" format
    if (start_code_type === "alpha") {
      // const re = new RegExp(`^[A-Z][0-9]{${number_of_digits}}$`);
      // if (!re.test(plate)) {
      //   throw new Error(`Format must match A${"0".repeat(number_of_digits)}`);
      // }
      const prefix = plate[0];
      if (prefix < starting_plate_code || prefix > ending_plate_code) {
        throw new Error(`Prefix must be between ${starting_plate_code} and ${ending_plate_code}`);
      }
      return plate;
    }

    // Handle "double_alpha" format
    if (start_code_type === "double_alpha") {
      //valid plate code A-ZZ0-9
      await validatePlate(plate, number_of_digits);

      // const re = new RegExp(`^[A-Z]{2}[0-9]{${number_of_digits}}$`);
      // if (!re.test(plate)) {
      //   throw new Error(`Format must match AA${"0".repeat(number_of_digits)}`);
      // }
      const prefix = plate.slice(0, 2);
      if (prefix < starting_plate_code || prefix > ending_plate_code) {
        throw new Error(`Prefix must be between ${starting_plate_code} and ${ending_plate_code}`);
      }
      return plate;
    }

    if (start_code_type === "custom") {
      if (plate === "Any") {
        return plate;
      }

      // Allow AA000-style plates for "custom" as well
      const re = new RegExp(`^[A-Z]{2}[0-9]{${number_of_digits}}$`);
      if (!re.test(plate)) {
        throw new Error(`Custom plates must match 'Any' or AA${"0".repeat(number_of_digits)}`);
      }

      return plate;
    }

    return plate;
  } catch (err) {
    console.error("plateCodeValidator failed:", err);
    throw new Error(err.message || "Internal plate validation error");
  }
};



const vehicleDetailsSchema = Joi.object({
  color: Joi.string().optional(),
  fuel_type: Joi.string().valid("petrol", "ev").required(),
  make: Joi.string().required(),
  model: Joi.string().required(),
  media_data: Joi.array().items(Joi.string().uri()).optional(),
  emirate_name: Joi.string().optional(),
});

const vehicleSchema = Joi.object({
  emirate_name: Joi.string().optional(),
  registration_no: Joi.string().required(),
  is_active: Joi.boolean(),
  vehicleDetails: vehicleDetailsSchema.required(),
}).external(async (validated) => {
  validated.registration_no = await plateCodeValidator(validated.registration_no, validated);
});;

const createVehicleByAdminSchema = Joi.object({
  emirate_name: Joi.string().optional(),
  registration_no: Joi.string().required(),
  is_active: Joi.boolean(),
  user_id: Joi.string().required(),
  vehicleDetails: vehicleDetailsSchema.required(),
}).external(async (validated) => {
  validated.registration_no = await plateCodeValidator(validated.registration_no, validated);
});



const updateVehicleByAdminSchema = Joi.object({
  registration_no: Joi.string().optional(),
  is_active: Joi.boolean().optional(),
  vehicleDetails: vehicleDetailsSchema.optional(),
}).external(async (validated) => {
  validated.registration_no = await plateCodeValidator(validated.registration_no, validated);
});

const updateVehicleSchema = Joi.object({
  registration_no: Joi.string().optional(),
  is_active: Joi.boolean().optional(),
  vehicleDetails: vehicleDetailsSchema.optional(),
  media_data: Joi.any().optional(),
  emirate_name: Joi.string().optional(),
}).external(async (validated) => {
  validated.registration_no = await plateCodeValidator(validated.registration_no, validated);
});

const addRegionSchema = Joi.object({
  emirate_name: Joi.string().required(),
  start_code_type: Joi.string().required(),
  starting_plate_code: Joi.string().required(),
  ending_plate_code: Joi.string().required(),
  number_of_digits: Joi.number().required(),
  plate_image: Joi.string().optional(),
  region_url: Joi.string().required(),
});

const editRegionSchema = Joi.object({
  emirate_name: Joi.string().optional(),
  start_code_type: Joi.string().optional(),
  starting_plate_code: Joi.string().optional(),
  ending_plate_code: Joi.string().optional(),
  number_of_digits: Joi.number().optional(),
  plate_image: Joi.string().optional(),
  region_url: Joi.string().optional(),
});


module.exports = {
  validateVehicle: async (data) => vehicleSchema.validateAsync(data, { abortEarly: false }),
  validateCreateVehicleByAdmin: async (data) => createVehicleByAdminSchema.validateAsync(data, { abortEarly: false }),
  validateUpdateVehicle: async (data) => updateVehicleSchema.validateAsync(data, { abortEarly: false }),
  validateUpdateVehicleByAdmin: async (data) => updateVehicleByAdminSchema.validateAsync(data, { abortEarly: false }),
  validateRegion: (data) => addRegionSchema.validateAsync(data),
  validateEditRegion: (data) => editRegionSchema.validateAsync(data),
};
