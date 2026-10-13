const Joi = require("joi");

  // Chauffeur Ride Request Schema
  const chauffeurRideRequestBodySchema = Joi.object({
    user_id: Joi.number().required(), // Chauffeur ID
    //rate_type: Joi.string().required(),
    //estimated_time_in_minutes: Joi.number().required(),
    requested_pickup_point: Joi.string().required(),
    requested_pickup: Joi.object().required(),
    // Add other necessary fields
  });
  
  const chauffeurRideRequestDbSchema = Joi.object({
    //ride_id: Joi.string().required(),
    chauffeur_id: Joi.number().required(),
    chauffeur_name: Joi.string().required(),
    pd_id: Joi.number().optional().allow(null, 0), // pd_id is number
    //estimated_time_in_minutes: Joi.number().required(),
    lower_chauffeur_name: Joi.string().optional().default("NA"),
    lower_chauffeur_name: Joi.string().optional().default("NA"),
    status: Joi.string().required(),
    requested_pickup_point: Joi.string().required(),
    requested_pickup: Joi.object().required(),
    requested_drop_point: Joi.string().optional(),
    requested_drop: Joi.object().optional(),
    actual_pickup_point: Joi.string().optional(),
    actual_pickup: Joi.object().optional(),
    actual_drop_point: Joi.string().optional(),
    actual_drop: Joi.object().optional(),
    //estimated_amount: Joi.number().required(),
    order_date: Joi.string().required(),
    status_log: Joi.array()
      .items(
        Joi.object({
          status: Joi.string().required(),
          datetime: Joi.string().isoDate().required(),
        })
      )
      .required(),
    organisation_id: Joi.string().required(),
    user_type: Joi.string().optional().default("Chauffeur"),
    pd_id: Joi.number().optional().default(0),
    pd_name: Joi.string().optional().allow("").default("NA"),
    lower_pd_name: Joi.string().optional().allow("").default("NA"),
    // Add other necessary fields
  });
  
  const chauffeurDropRequestBodySchema = Joi.object({
    //ride_id: Joi.string().required(),
    //status: Joi.string().required(),
    requested_drop_point: Joi.string().required(),
    requested_drop: Joi.object().required(),
  });
  
  const chauffeurDropRequestDbSchema = Joi.object({
    PK: Joi.string().optional(),
    SK: Joi.string().optional(),
    ride_id: Joi.string().required(),
    requested_pickup_point: Joi.string().optional(),
    requested_pickup: Joi.object().optional(),
    actual_pickup_point: Joi.string().optional(),
    actual_pickup: Joi.object().optional(),
    actual_drop_point: Joi.string().optional(),
    actual_drop: Joi.object().optional(),
    status: Joi.string().required(),
    requested_drop_point: Joi.string().required(),
    requested_drop: Joi.object().required(),
    status_log: Joi.array()
      .items(
        Joi.object({
          action: Joi.string().optional(),
          status: Joi.string().required(),
          datetime: Joi.string().isoDate().required(),
        })
      )
      .required(),
  });


  module.exports = {
    chauffeurRideRequestBodySchema,
    chauffeurRideRequestDbSchema,
    chauffeurDropRequestBodySchema,
    chauffeurDropRequestDbSchema,
  };