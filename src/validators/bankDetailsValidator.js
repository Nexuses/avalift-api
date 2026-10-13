// src/validations/bankDetailValidation.js
const Joi = require('joi');

const createBankDetailSchema = Joi.object({
    account_number: Joi.string()
    .pattern(/^\d{10,16}$/)
    .required()
    .messages({
      'string.pattern.base': 'Account number must be 10 to 16 digits.',
    }),
  bank_name: Joi.string()
    .trim()
    .min(2)
    .max(100)
    .required(),

  iban: Joi.string()
    .trim()
    .pattern(/^[A-Z0-9]+$/)
    .min(15)
    .max(34)
    .required(),

  branch_name: Joi.string()
    .trim()
    .max(100)
    .optional()
    .allow(null, ''),

  default: Joi.boolean().default(true),
});

const updateBankDetailSchema = Joi.object({
    account_number: Joi.string()
    .pattern(/^\d{10,16}$/)
    .optional()
    .messages({
      'string.pattern.base': 'Account number must be 10 to 16 digits.',
    }),

  bank_name: Joi.string()
    .trim()
    .min(2)
    .max(100)
    .optional(),

  iban: Joi.string()
    .trim()
    .pattern(/^[A-Z0-9]+$/)
    .min(15)
    .max(34)
    .optional()
    .allow(null, ''),

  branch_name: Joi.string()
    .trim()
    .max(100)
    .optional()
    .allow(null, ''),

  default: Joi.boolean().optional(),
});

module.exports = {
  createBankDetailSchema,
  updateBankDetailSchema,
};
