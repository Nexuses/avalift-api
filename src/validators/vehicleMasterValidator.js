const Joi = require('joi');

// Schema for creating a brand
const createBrandSchema = Joi.object({
    brand_name: Joi.string().required(),
});

// Schema for creating a model
const createModelSchema = Joi.object({
    brand: Joi.string().required(),
    model:Joi.string().required(),
});

// Schema for updating a brand
const updateBrandSchema = Joi.object({
    old_brand_name: Joi.string().required(),
    new_brand_name: Joi.string().required(),
});

// Schema for updating a model
const updateModelSchema = Joi.object({
    brand: Joi.string().required(),
    old_model:Joi.string().required(),
    new_model:Joi.string().required(),
});


module.exports = {
    validateCreateBrand: (data) => createBrandSchema.validateAsync(data),
    validateCreateModel: (data) => createModelSchema.validateAsync(data),
    validateUpdateBrand: (data) => updateBrandSchema.validateAsync(data),
    validateUpdateModel: (data) => updateModelSchema.validateAsync(data),
  };