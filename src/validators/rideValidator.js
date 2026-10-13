const Joi = require('joi');

const rateTypeSchema = Joi.object({
    display_name: Joi.string().min(5).max(50).required(),
    duration_hours: Joi.number().optional().allow(null),
    type_category: Joi.string().valid('rate_type', 'ride_frequency').required(),
    type_name: Joi.string().required()
});

module.exports = {
    createRateTypeValidator: (data) => {
        return rateTypeSchema.validateAsync(data);
    },
}