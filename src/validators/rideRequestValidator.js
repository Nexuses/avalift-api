const Joi = require("joi");

const rideRequestBodySchema = Joi.object({
  is_customer_available: Joi.boolean().required().messages({
    "any.required": "Customer availability status is required",
  }),

  customer_extra_details: Joi.object({
    key_details: Joi.string().optional().allow(null, ""),
    instructions: Joi.string().optional().allow(null, ""),
    parking_instructions: Joi.string().optional().allow(null, ""),
  }).optional(),

  coupon_ids: Joi.array()
    .items(Joi.number().integer())
    .required()
    .messages({
      "array.base": "Coupon IDs must be an array of integers",
      "any.required": "Coupon IDs are required",
    })
    .default([]),

  estimated_time_in_minutes: Joi.number().optional().allow(null),

  estimated_amount: Joi.number().optional().allow(null),

  ride_type: Joi.string().valid("instant", "scheduled").required().messages({
    "any.only": "Ride type must be either 'instant' or 'scheduled'",
    "any.required": "Ride type is required",
  }),

  rate_type: Joi.string()
    .valid(
      "per_min",
      "per_hour",
      "full_day",
      "half_day",
      "garage_ride",
      "rta_test"
    )
    .required()
    .messages({
      "any.only":
        "Rate type must be either 'per_min' / 'per_hour' / 'full_day' / 'half_day'",
      "any.required": "Rate type is required",
    }),

  requested_pickup_point: Joi.string().min(5).required().messages({
    "any.required": "Requested pickup point is required",
    "string.min": "Requested pickup point must be at least 5 characters",
  }),

  requested_drop_point: Joi.alternatives().conditional("rate_type", {
    is: "per_min",
    then: Joi.string().min(5).required().messages({
      "any.required": "Requested drop point is required",
      "string.min": "Requested drop point must be at least 5 characters",
    }),
    otherwise: Joi.string()
      .min(5)
      .optional()
      .allow(null, "")
      .default(null)
      .messages({
        "string.min": "Requested drop point must be at least 5 characters",
      }),
  }),

  requested_pickup: Joi.object({
    lat: Joi.number().required().messages({
      "any.required": "Requested pickup latitude is required",
    }),
    long: Joi.number().required().messages({
      "any.required": "Requested pickup longitude is required",
    }),
  })
    .required()
    .messages({
      "any.required": "Requested pickup location is required",
    }),

  requested_drop: Joi.alternatives().conditional("rate_type", {
    is: "per_min",
    then: Joi.object({
      lat: Joi.number().required().messages({
        "any.required": "Requested drop latitude is required",
      }),
      long: Joi.number().required().messages({
        "any.required": "Requested drop longitude is required",
      }),
    })
      .required()
      .messages({
        "any.required": "Requested drop location is required",
      }),
    otherwise: Joi.any().default(null),
  }),

  paymentDetails: Joi.object({
    payment_method: Joi.string()
      .valid("Card", "Wallet", "POS", "Cash", "Apple Pay")
      .required()
      .messages({
        "any.required": "Payment method is required",
        "any.only":
          "Payment method should be 'Card', 'Wallet', 'POS','Cash', or 'Apple Pay'",
      }),
    card: Joi.string().optional().allow(null, "").messages({
      "string.empty": "Card details cannot be empty if provided",
    }),
  })
    .required()
    .messages({
      "any.required": "Payment details are required",
    }),

  vehicleDetails: Joi.object({
    vehicle_id: Joi.string().required().messages({
      "any.required": "Vehicle ID is required",
    }),
    color: Joi.string().optional().allow(null, ""),
    make: Joi.string().optional().allow(null, ""),
    brand: Joi.string().optional().allow(null, ""),
  })
    .required()
    .messages({
      "any.required": "Vehicle details are required",
    }),
});

const scheduledRideRequestBodySchema = Joi.object({
  is_customer_available: Joi.boolean().required().messages({
    "any.required": "Customer availability status is required",
  }),

  customer_extra_details: Joi.object({
    key_details: Joi.string().optional().allow(null, ""),
    instructions: Joi.string().optional().allow(null, ""),
    parking_instructions: Joi.string().optional().allow(null, ""),
  }).optional(),

  coupon_ids: Joi.array()
    .items(Joi.number().integer())
    .required()
    .messages({
      "array.base": "Coupon IDs must be an array of integers",
      "any.required": "Coupon IDs are required",
    })
    .default([]),

  estimated_time_in_minutes: Joi.number().optional().allow(null),

  estimated_amount: Joi.number().optional().allow(null),

  ride_type: Joi.string().valid("scheduled").required().messages({
    "any.only": "Ride type must be 'scheduled'",
    "any.required": "Ride type is required",
  }),

  rate_type: Joi.string()
    .valid(
      "per_min",
      "per_hour",
      "full_day",
      "half_day",
      "garage_ride",
      "rta_test"
    )
    .required()
    .messages({
      "any.only":
        "Rate type must be either 'per_min' / 'per_hour' / 'full_day' / 'half_day'",
      "any.required": "Rate type is required",
    }),

  requested_pickup_point: Joi.string().min(5).required().messages({
    "any.required": "Requested pickup point is required",
    "string.min": "Requested pickup point must be at least 5 characters",
  }),

  requested_drop_point: Joi.alternatives().conditional("rate_type", {
    is: "per_min",
    then: Joi.string().min(5).required().messages({
      "any.required": "Requested drop point is required",
      "string.min": "Requested drop point must be at least 5 characters",
    }),
    otherwise: Joi.string()
      .min(5)
      .optional()
      .allow(null, "")
      .default(null)
      .messages({
        "string.min": "Requested drop point must be at least 5 characters",
      }),
  }),

  // New field specific to scheduled rides
  scheduled_pickup: Joi.string()
    .isoDate()
    .required()
    .custom((value, helpers) => {
      if (new Date(value) <= new Date()) {
        return helpers.error(
          "any.invalid",
          "Scheduled pickup must be in the future."
        );
      }
      return value;
    })
    .messages({
      "any.required": "Scheduled pickup time is required",
      "string.isoDate":
        "Scheduled pickup time must be in ISO 8601 format (YYYY-MM-DDTHH:mm:ss.sssZ)",
      "any.invalid": "Scheduled pickup time must be in the future.",
    }),

  requested_pickup: Joi.object({
    lat: Joi.number().required().messages({
      "any.required": "Requested pickup latitude is required",
    }),
    long: Joi.number().required().messages({
      "any.required": "Requested pickup longitude is required",
    }),
  })
    .required()
    .messages({
      "any.required": "Requested pickup location is required",
    }),

  requested_drop: Joi.alternatives().conditional("rate_type", {
    is: "per_min",
    then: Joi.object({
      lat: Joi.number().required().messages({
        "any.required": "Requested drop latitude is required",
      }),
      long: Joi.number().required().messages({
        "any.required": "Requested drop longitude is required",
      }),
    })
      .required()
      .messages({
        "any.required": "Requested drop location is required",
      }),
    otherwise: Joi.any().default(null),
  }),

  paymentDetails: Joi.object({
    payment_method: Joi.string()
      .valid("Card", "Wallet", "POS", "Cash", "Apple Pay")
      .required()
      .messages({
        "any.required": "Payment method is required",
        "any.only":
          "Payment method should be 'Card', 'Wallet', 'POS', 'Apple Pay', or 'Cash'",
      }),
    card: Joi.string().optional().allow(null, "").messages({
      "string.empty": "Card details cannot be empty if provided",
    }),
  })
    .required()
    .messages({
      "any.required": "Payment details are required",
    }),

  vehicleDetails: Joi.object({
    vehicle_id: Joi.string().required().messages({
      "any.required": "Vehicle ID is required",
    }),
    color: Joi.string().optional().allow(null, ""),
    make: Joi.string().optional().allow(null, ""),
    brand: Joi.string().optional().allow(null, ""),
  })
    .required()
    .messages({
      "any.required": "Vehicle details are required",
    }),
});

/**
 * Schema for Database Insertion (After Backend Processing)
 */
const rideRequestDbSchema = Joi.object({
  customer_id: Joi.string().required(),

  chauffeur_id: Joi.number().default(0),
  chauffeur_name: Joi.string().optional().allow(null, "").default(""),

  coupon_ids: Joi.array()
    .items(Joi.number().integer())
    .required()
    .messages({
      "array.base": "Coupon IDs must be an array of integers",
      "any.required": "Coupon IDs are required",
    })
    .default([]),

  is_customer_available: Joi.boolean().required(),

  customer_extra_details: Joi.object({
    key_details: Joi.string().optional().allow(null, ""),
    instructions: Joi.string().optional().allow(null, ""),
    parking_instructions: Joi.string().optional().allow(null, ""),
  }).optional(),

  estimated_time_in_minutes: Joi.number().optional().allow(null),

  estimated_amount: Joi.number().required(),

  ride_type: Joi.string().valid("instant", "scheduled").required(),

  rate_type: Joi.string()
    .valid(
      "per_min",
      "per_hour",
      "full_day",
      "half_day",
      "garage_ride",
      "rta_test"
    )
    .required(),

  requested_pickup_point: Joi.string().required(),

  requested_drop_point: Joi.alternatives().conditional("rate_type", {
    is: "per_min",
    then: Joi.string().required().messages({
      "any.required": "Requested drop point is required",
    }),
    otherwise: Joi.any().default(null),
  }),

  requested_pickup: Joi.object({
    lat: Joi.number().required(),
    long: Joi.number().required(),
  }).required(),

  requested_drop: Joi.alternatives().conditional("rate_type", {
    is: "per_min",
    then: Joi.object({
      lat: Joi.number().required().messages({
        "any.required": "Requested drop latitude is required",
      }),
      long: Joi.number().required().messages({
        "any.required": "Requested drop longitude is required",
      }),
    })
      .required()
      .messages({
        "any.required": "Requested drop location is required",
      }),
    otherwise: Joi.any().default(null),
  }),

  status: Joi.string().valid("Requested").default("Requested"),

  order_date: Joi.string().isoDate().required().messages({
    "any.required": "Order date is required",
    "string.isoDate":
      "Order date must be in ISO 8601 format (YYYY-MM-DDTHH:mm:ss.sssZ)",
  }),

  planned_end_time: Joi.string().isoDate().required().messages({
    "any.required": "Planned end time is required",
    "string.isoDate":
      "Planned end time must be in ISO 8601 format (YYYY-MM-DDTHH:mm:ss.sssZ)",
  }),

  status_log: Joi.array()
    .items(
      Joi.object({
        status: Joi.string().valid("Requested").required(),
        datetime: Joi.string()
          .isoDate()
          .default(() => new Date().toISOString()),
      })
    )
    .default([{ status: "Requested", datetime: new Date().toISOString() }]),

  organisation_id: Joi.string().required(),
  otp: Joi.string().required(),

  paymentDetails: Joi.object({
    payment_method: Joi.string().required().messages({
      "any.required": "Payment method is required",
    }),
    card: Joi.string().optional().allow(null, "").messages({
      "string.empty": "Card details cannot be empty if provided",
    }),
  })
    .required()
    .messages({
      "any.required": "Payment details are required",
    }),

  customer_details: Joi.object({
    id: Joi.number().required().default("NA"),
    name: Joi.string().required().default("NA"),
    mobile_number: Joi.string().optional().allow(null, "").default("NA"),
    country_code: Joi.string().optional().allow(null, "").default("NA"),
  }).required(),

  customer_name: Joi.string().optional().default("NA"),
  lower_customer_name: Joi.string().optional().default("NA"),
  lower_chauffeur_name: Joi.string().optional().allow(null, "").default("NA"),
  vehicle_id: Joi.string().optional(),
  vehicleDetails: Joi.object({
    vehicle_id: Joi.string().required().messages({
      "any.required": "Vehicle ID is required",
    }),
    color: Joi.string().optional().allow(null, "").default("NA"),
    make: Joi.string().optional().allow(null, "").default("NA"),
    brand: Joi.string().optional().allow(null, "").default("NA"),
  })
    .required()
    .messages({
      "any.required": "Vehicle details are required",
    }),
    chauffeur_initiate_apple_pay: Joi.boolean().optional(),
    apple_pay_paid: Joi.boolean().optional(),
    apple_pay_payment_failed: Joi.boolean().optional(),
    respond_to_tip: Joi.boolean().optional(),
}).options({ stripUnknown: false });

//Calculate estimate amount for customers.
const calculateEstimateSchema = Joi.object({
  rate_type: Joi.string()
    .valid(
      "per_min",
      "per_hour",
      "full_day",
      "half_day",
      "garage_ride",
      "rta_test",
      "fixed"
    )
    .required()
    .messages({
      "any.only":
        "Rate type must be either 'per_min' / 'per_hour' / 'half_day' / 'full_day'",
      "any.required": "Rate type is required",
    }),
  estimated_time_in_minutes: Joi.number().required(),
  organisation_id: Joi.string().optional(),
  coupon_ids: Joi.array()
    .items(Joi.number().integer())
    .optional()
    .messages({
      "array.base": "Coupon IDs must be an array of integers",
      "any.required": "Coupon IDs are required",
    })
    .default([]),
    coupon_code: Joi.string().optional().allow(null, ""),
});
const assignChauffeurSchema = (ride_id, chauffeur_id, customer_id) => {
  const schema = Joi.object({
    ride_id: Joi.string().required(),
    chauffeur_id: Joi.number().required(),
    customer_id: Joi.string().required(),
  });

  return schema.validate({ ride_id, chauffeur_id, customer_id });
};

const adminCreateRideSchema = Joi.object({
  is_customer_available: Joi.boolean().required(),

  customer_extra_details: Joi.object({
    key_details: Joi.string().optional(),
    instructions: Joi.string().optional(),
    parking_instructions: Joi.string().optional(),
  }).optional(),

  estimated_time_in_minutes: Joi.number().integer().positive().required(),
  hours_booked: Joi.number().integer().allow(null),

  ride_type: Joi.string().valid("scheduled", "instant").required(),

  rate_type: Joi.when("organisation_ride", {
    is: true,
    then: Joi.string().valid("fixed").required(),
    otherwise: Joi.string()
      .valid(
        "per_min",
        "per_hour",
        "half_day",
        "fixed",
        "full_day",
        "garage_ride",
        "rta_test"
      )
      .required(),
  }),

  requested_pickup_point: Joi.string().required(),
  requested_drop_point: Joi.string().required(),

  requested_pickup: Joi.object({
    lat: Joi.number().required(),
    long: Joi.number().required(),
  }).required(),

  requested_drop: Joi.object({
    lat: Joi.number().required(),
    long: Joi.number().required(),
  }).required(),

  paymentDetails: Joi.object({
    payment_method: Joi.string().valid("Card", "Cash", "Wallet", "Wallet Credit", "Apple Pay").required(),
    card: Joi.string().allow("").optional(),
  }).required(),

  vehicleDetails: Joi.object({
    vehicle_id: Joi.string().required(),
    color: Joi.string().required(),
    make: Joi.string().required(),
    brand: Joi.string().required(),
  }).required(),

  chauffeur_id: Joi.number().optional(),
  chauffeur_name: Joi.string().optional().allow(""),
  organisation_id: Joi.number().optional(),
  organisation_ride: Joi.boolean().required(),
});


/**
 * Schema for Scheduled Ride Database Insertion (After Backend Processing)
 */
const scheduledRideRequestDbSchema = Joi.object({
  customer_id: Joi.string().required(),

  chauffeur_id: Joi.number().default(0),

  chauffeur_name: Joi.string().optional().allow(null, "").default(""),

  coupon_ids: Joi.array()
    .items(Joi.number().integer())
    .required()
    .messages({
      "array.base": "Coupon IDs must be an array of integers",
      "any.required": "Coupon IDs are required",
    })
    .default([]),

  is_customer_available: Joi.boolean().required(),

  customer_extra_details: Joi.object({
    key_details: Joi.string().optional().allow(null, ""),
    instructions: Joi.string().optional().allow(null, ""),
    parking_instructions: Joi.string().optional().allow(null, ""),
  }).optional(),

  estimated_time_in_minutes: Joi.number().optional().allow(null),

  estimated_amount: Joi.number().required(),

  ride_type: Joi.string().valid("scheduled").required(),

  rate_type: Joi.string()
    .valid(
      "per_min",
      "per_hour",
      "full_day",
      "half_day",
      "garage_ride",
      "rta_test"
    )
    .required(),

  requested_pickup_point: Joi.string().required(),

  requested_drop_point: Joi.alternatives().conditional("rate_type", {
    is: "per_min",
    then: Joi.string().required().messages({
      "any.required": "Requested drop point is required",
    }),
    otherwise: Joi.any().default(null),
  }),

  // New field for scheduled rides to capture the scheduled pickup time.
  scheduled_pickup: Joi.string().isoDate().required().messages({
    "any.required": "Scheduled pickup time is required",
    "string.isoDate":
      "Scheduled pickup time must be in ISO 8601 format (YYYY-MM-DDTHH:mm:ss.sssZ)",
  }),

  planned_end_time: Joi.string().isoDate().required().messages({
    "any.required": "Planned end time is required",
    "string.isoDate":
      "Planned end time must be in ISO 8601 format (YYYY-MM-DDTHH:mm:ss.sssZ)",
  }),

  requested_pickup: Joi.object({
    lat: Joi.number().required(),
    long: Joi.number().required(),
  }).required(),

  requested_drop: Joi.alternatives().conditional("rate_type", {
    is: "per_min",
    then: Joi.object({
      lat: Joi.number().required().messages({
        "any.required": "Requested drop latitude is required",
      }),
      long: Joi.number().required().messages({
        "any.required": "Requested drop longitude is required",
      }),
    })
      .required()
      .messages({
        "any.required": "Requested drop location is required",
      }),
    otherwise: Joi.any().default(null),
  }),

  status: Joi.string().valid("Requested").default("Requested"),

  order_date: Joi.string().isoDate().required().messages({
    "any.required": "Order date is required",
    "string.isoDate":
      "Order date must be in ISO 8601 format (YYYY-MM-DDTHH:mm:ss.sssZ)",
  }),

  status_log: Joi.array()
    .items(
      Joi.object({
        status: Joi.string().valid("Schedule Requested").required(),
        datetime: Joi.string()
          .isoDate()
          .default(() => new Date().toISOString()),
      })
    )
    .default([
      { status: "Schedule Requested", datetime: new Date().toISOString() },
    ]),

  organisation_id: Joi.string().required(),
  //otp: Joi.string().required(),

  paymentDetails: Joi.object({
    payment_method: Joi.string().required().messages({
      "any.required": "Payment method is required",
    }),
    card: Joi.string().optional().allow(null, "").messages({
      "string.empty": "Card details cannot be empty if provided",
    }),
  })
    .required()
    .messages({
      "any.required": "Payment details are required",
    }),

  customer_details: Joi.object({
    id: Joi.number().required().default("NA"),
    name: Joi.string().required().default("NA"),
    mobile_number: Joi.string().optional().allow(null, "").default("NA"),
    country_code: Joi.string().optional().allow(null, "").default("NA"),
  }).required(),

  customer_name: Joi.string().optional().default("NA"),
  lower_customer_name: Joi.string().optional().default("NA"),
  lower_chauffeur_name: Joi.string().optional().allow(null, "").default("NA"),
  vehicle_id: Joi.string().optional(),
  vehicleDetails: Joi.object({
    vehicle_id: Joi.string().required().messages({
      "any.required": "Vehicle ID is required",
    }),
    color: Joi.string().optional().allow(null, "").default("NA"),
    make: Joi.string().optional().allow(null, "").default("NA"),
    brand: Joi.string().optional().allow(null, "").default("NA"),
  })
    .required()
    .messages({
      "any.required": "Vehicle details are required",
    }),
    chauffeur_initiate_apple_pay: Joi.boolean().optional(),
    apple_pay_paid: Joi.boolean().optional(),
    apple_pay_payment_failed: Joi.boolean().optional(),
}).options({ stripUnknown: false });
// Joi schema to validate input parameters including additional_minutes
const changeRateTypeSchema = Joi.object({
  new_rate_type: Joi.string()
    .valid("per_hour", "half_day", "full_day")
    .required(),
  additional_minutes: Joi.number()
    .integer()
    .min(0)
    .when("new_rate_type", {
      is: "per_hour",
      then: Joi.required(),
      otherwise: Joi.optional().default(0),
    })
    .custom((value, helpers) => {
      if (value % 60 !== 0) {
        return helpers.error("any.custom", {
          message: "Additional minutes must be a multiple of 60",
        });
      }
      return value;
    }, "Multiples of 60 check"),
  ride_id: Joi.string().required(),
});

module.exports = {
  rideRequestBodySchema,
  rideRequestDbSchema,
  calculateEstimateSchema,
  assignChauffeurSchema,
  adminCreateRideSchema,
  scheduledRideRequestDbSchema,
  scheduledRideRequestBodySchema,
  changeRateTypeSchema,
};
