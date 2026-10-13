const Joi = require("joi");

const addReviewSchema = Joi.object({
  ride_id: Joi.string().required().messages({
    "any.required": "Ride ID is required.",
    "string.empty": "Ride ID cannot be empty.",
  }),
  reviewee_id: Joi.number().integer().strict().required().messages({
    "any.required": "Reviewee ID is required.",
    "number.base": "Reviewee ID must be a number.",
    "number.integer": "Reviewee ID must be an integer.",
  }),
  rating: Joi.number().integer().min(1).max(5).required().messages({
    "any.required": "Rating is required.",
    "number.base": "Rating must be a number.",
    "number.min": "Rating must be at least 1.",
    "number.max": "Rating cannot be more than 5.",
  }),
  comment: Joi.alternatives().try(Joi.string().allow("").required(), Joi.valid(null)).messages({
    "any.required": "Comment is required but can be null.",
    "string.empty": "Comment can be an empty string but not undefined.",
  }),
});

module.exports = {
  validateReview: (data) => addReviewSchema.validateAsync(data),
};
