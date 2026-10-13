const Joi = require('joi');

const createLocationSchema = Joi.object({
    user_id: Joi.number().required(), // userId must be a string and is required
    user_type: Joi.string().required(),  // type must be a string and is required
    current_lat: Joi.number().min(-90).max(90).required(),
    current_long: Joi.number().min(-180).max(180).required(),
  });


module.exports = {
    createLocationSchema
}