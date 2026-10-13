const Joi = require("joi");

const invoicePaymentSchema = Joi.object({
  invoice_number: Joi.string()
    .pattern(/^INV-\d+-\d+$/) // Matches the "INV-3-1741673422816" format
    .required()
    .messages({
      "string.pattern.base": "Invoice number must follow the format INV-<number>-<timestamp>.",
      "string.empty": "Invoice number is required.",
      "any.required": "Invoice number is required."
    }),


  user_id: Joi.number()
    .integer()
    .positive() // Ensures a valid positive integer
    .required()
    .messages({
      "number.base": "User ID must be a number.",
      "number.integer": "User ID must be an integer.",
      "number.positive": "User ID must be a positive number.",
      "any.required": "User ID is required."
    }),
});

module.exports = invoicePaymentSchema;
