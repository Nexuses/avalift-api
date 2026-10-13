// src/validators/authValidator.js

const Joi = require("joi");

// Complete Registration Validator
const completeRegistrationSchema = Joi.object({
  temp_token: Joi.string().required(),
  first_name: Joi.string().required(),
  last_name: Joi.string().required(),
  password: Joi.when("type", {
    is: "admin",
    then: Joi.string().min(6).required(),
    otherwise: Joi.forbidden(),
  }),
  role: Joi.string()
    .valid("individual", "corporate", "chauffeur", "pd")
    .required(),
});

// Admin Login Validator
const adminLoginSchema = Joi.object({
  email_id: Joi.string().email().required(),
  password: Joi.string().required(),
  device_id: Joi.string().required()
});

// OTP Request Validator
const otpRequestSchema = Joi.object({
  email_id: Joi.string().email(),
  country_code: Joi.string().pattern(/^\+\d{1,4}$/).required(),
  mobile_number: Joi.string().pattern(/^[0-9]{7,15}$/),
})
  .or("email_id", "mobile_number")
  .messages({
    "object.missing": "Either email_id or mobile_number is required.",
  });

// OTP Verify Validator
const otpVerifySchema = Joi.object({
  email_id: Joi.string().email(),
  country_code: Joi.string().pattern(/^\+\d{1,4}$/).required(),
  mobile_number: Joi.string().pattern(/^[0-9]{7,15}$/),
  otp_code: Joi.string().length(4).required(),
  device_id: Joi.string().optional(),
  os_type: Joi.string().optional(),
  device_model: Joi.string().optional(),
})
  .or("email_id", "mobile_number")
  .messages({
    "object.missing": "Either email_id or mobile_number is required.",
  });

const createSuperAdminSchema = Joi.object({
  email_id:Joi.string().email(),
  password: Joi.string().required(),
  country_code: Joi.string().pattern(/^\+\d{1,4}$/).required(),
  mobile_number: Joi.string().pattern(/^[0-9]{7,15}$/).required(),
  first_name: Joi.string().required(),
  last_name: Joi.string().required(),
});

const adminVerifyOtpSchema = Joi.object({
  otp_code: Joi.string()
    .required()
    .pattern(/^[0-9]+$/) // Ensure it's numeric
    .length(4) // Example: Assuming OTP is 6 digits
    .messages({
      'string.empty': 'OTP code is required.',
      'string.pattern.base': 'OTP code must be numeric.',
      'string.length': 'OTP code must be 4 digits long.',
    }),

  email_id: Joi.string()
    .required()
    .email()
    .messages({
      'string.empty': 'Email ID is required.',
      'string.email': 'Invalid email ID format.',
    }),

  os_type: Joi.string()
    .required()
    // .valid('android', 'ios', 'web', 'other') // Example: Restricting to specific OS types
    .messages({
      'string.empty': 'OS type is required.',
      // 'any.only': 'Invalid OS type. Allowed values are: android, ios, web, other.',
    }),

  device_id: Joi.string()
    .required()
    .min(1)
    .messages({
      'string.empty': 'Device ID is required.',
      'string.min': 'Device ID cannot be empty.',
    }),

  device_model: Joi.string()
    .optional()
    .min(1)
    .messages({
      'string.min': 'Device model cannot be empty if provided.',
    }),
});

module.exports = {
  // Removed 'signupValidator' to enforce OTP-based flow
  adminLoginValidator: (data) => {
    return adminLoginSchema.validateAsync(data);
  },
  otpRequestValidator: (data) => {
    return otpRequestSchema.validateAsync(data);
  },
  otpVerifyValidator: (data) => {
    return otpVerifySchema.validateAsync(data);
  },
  completeRegistrationValidator: (data) =>{
    return completeRegistrationSchema.validateAsync(data);
  },
  createSuperAdminValidator: (data) => {
    return createSuperAdminSchema.validateAsync(data);
  },
  adminVerifyOtpValidator: (data) => {
    return adminVerifyOtpSchema.validateAsync(data);
  },
};
