// src/validators/userValidator.js
const Joi = require('joi');

const userCreationSchema = Joi.object({
  mobile_number: Joi.string().pattern(/^[0-9]{10,15}$/).required(),
  email_id: Joi.string().email().required(),
  first_name: Joi.string().min(2).max(50).required(),
  last_name: Joi.string().min(2).max(50).required(),
  password: Joi.string().min(6).required(),
  type_id: Joi.number().integer().required(),
  role_id: Joi.number().integer().required(),
  is_active: Joi.boolean(),
  status_id: Joi.number().integer(),
});

const userUpdateSchema = Joi.object({
  mobile_number: Joi.string().pattern(/^[0-9]{10,15}$/),
  email_id: Joi.string().email(),
  first_name: Joi.string().min(2).max(50),
  last_name: Joi.string().min(2).max(50),
  password: Joi.string().min(6),
  type_id: Joi.number().integer(),
  role_id: Joi.number().integer(),
  is_active: Joi.boolean(),
  status_id: Joi.number().integer(),
  device_id: Joi.string().optional(),
}).min(1);

const documentSchema = Joi.object({
  name: Joi.string()
    .required()
    .valid('license', 'agreement') // Specify allowed values or remove `.valid` for general strings
    .label('Document Name'),
  url: Joi.string()
    .uri()
    .required()
    .label('Document URL'),
});

const validateUserCreation = (data) => {
  const { error, value } = userCreationSchema.validate(data);
  if (error) {
    const err = new Error(`Validation error: ${error.details[0].message}`);
    err.statusCode = 400;
    throw err;
  }
  return value;
};

const validateUserUpdate = (data) => {
  const { error, value } = userUpdateSchema.validate(data);
  if (error) {
    const err = new Error(`Validation error: ${error.details[0].message}`);
    err.statusCode = 400;
    throw err;
  }
  return value;
};


const userProfileUpdateSchema = Joi.object({
  first_name: Joi.string().optional(),
  last_name: Joi.string().optional(),
  email_id: Joi.string()
    .email()
    .allow('', null) // Explicitly allow both empty string and null
    .optional()
    .custom((value, helpers) => {
      if (value === '') {
        return null; // Transform empty string to null
      }
      return value;
    }),
}).min(1);



// Export validation functions
module.exports = {
  validateUserCreation,
  validateUserUpdate,
  validateUserProfileUpdate : (data) => userProfileUpdateSchema.validateAsync(data),
};
