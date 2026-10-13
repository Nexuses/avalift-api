// validators/pdRidesValidator.js

const Joi = require('joi');

// Schema for adding a chauffeur to a PD ride
const pdAddChauffeurSchema = Joi.object({
  chauffeur_id: Joi.string().required(),
  drop_point: Joi.string().required(),
});

// Schema for dropping a chauffeur from a PD ride
const pdDropChauffeurSchema = Joi.object({
  chauffeur_id: Joi.string().required(),
});



const rideRequestSchema = Joi.object({
    ride_id: Joi.string().required().pattern(/^\d{7}$/), 
    action: Joi.string().valid('accept', 'decline').required(),
    chauffeur_id: Joi.number().required(),
});


const rideSchemaPickup = Joi.object({
  chauffeurId: Joi.number().required(),
  pdId: Joi.string().required(),
  rideId: Joi.string().required(),
  pickup: Joi.object({
    lat: Joi.object({
      N: Joi.string().regex(/^-?\d+\.\d+$/).required(), // Validate latitude as a string that can be converted to a number
    }).required(),
    long: Joi.object({
      N: Joi.string().regex(/^-?\d+\.\d+$/).required(), // Validate longitude as a string that can be converted to a number
    }).required(),
  }).required(),
  pickupPoint: Joi.string().required(),
});

const rideSchemaDrop = Joi.object({
  chauffeurId: Joi.number().required(),
  pdId: Joi.string().required(),
  rideId: Joi.string().required(),
  drop: Joi.object({
    lat: Joi.object({
      N: Joi.string().regex(/^-?\d+\.\d+$/).required(), // Validate latitude as a string that can be converted to a number
    }).required(),
    long: Joi.object({
      N: Joi.string().regex(/^-?\d+\.\d+$/).required(), // Validate longitude as a string that can be converted to a number
    }).required(),
  }).required(),
  dropPoint: Joi.string().required(),
});


module.exports = {
  pdAddChauffeurSchema,
  pdDropChauffeurSchema,
  rideRequestSchema,
  rideSchemaPickup,
  rideSchemaDrop
};
