// src/validators/adminValidator.js

const Joi = require("joi");

const adminCreateUserSchema = Joi.object({
  email_id: Joi.string().email().optional(),
  mobile_number: Joi.string()
    .pattern(/^\d{6,14}$/)
    .required(),
  first_name: Joi.string().required(),
  country_code: Joi.string()
    .pattern(/^\+\d{1,4}$/)
    .required(),
  last_name: Joi.string().required(),
  role: Joi.string()
    .valid("pd", "chauffeur", "individual", "corporate")
    .insensitive()
    .required(),
  emirates_id: Joi.string()
    .pattern(/^\d{15}$/) // Example: 15-digit Emirates ID format
    .required()
    .allow(null, ""), // Allows null or empty values
  emiratesId_validity: Joi.date()
    .iso() // Ensures ISO date format (YYYY-MM-DD)
    .greater("now") // Ensures date is in the future
    .required()
    .allow(null, ""),
  licence_number: Joi.string()
    .pattern(/^[A-Za-z0-9]{5,20}$/) // Alphanumeric 5-20 characters
    .required()
    .allow(null, ""),
  licence_validity: Joi.date().iso().greater("now").required().allow(null, ""),
  is_salaried: Joi.boolean().optional(),
  licence_doc: Joi.string().optional().allow(null, "").default(""),
  emirates_id_doc: Joi.string().optional().allow(null, "").default(""),
  erp_chauffeur_code: Joi.string().optional().allow(null, ""),
  erp_ac_code_cash: Joi.string().optional().allow(null, ""),
  erp_ac_code_online: Joi.string().optional().allow(null, ""),
  erp_ac_name_cash: Joi.string().optional().allow(null, ""),
  erp_ac_name_online: Joi.string().optional().allow(null, ""),
});

const adminUpdateUserSchema = Joi.object({
  email_id: Joi.string().email().optional(),
  mobile_number: Joi.string()
    .pattern(/^\d{6,14}$/)
    .optional(),
  first_name: Joi.string().optional(),
  last_name: Joi.string().optional(),
  country_code: Joi.string()
    .pattern(/^\+\d{1,4}$/)
    .optional(),
  emirates_id: Joi.string()
    .pattern(/^\d{15}$/)
    .optional()
    .allow(null, ""),
  emiratesId_validity: Joi.date()
    .iso()
    .greater("now")
    .optional()
    .allow(null, ""),
  licence_number: Joi.string()
    .pattern(/^[A-Za-z0-9]{5,20}$/)
    .optional()
    .allow(null, ""),
  licence_validity: Joi.date().iso().greater("now").optional().allow(null, ""),
  //documents: Joi.string().optional().allow(null, "").default(""),
  licence_doc: Joi.string().optional().allow(null, "").default(""),
  emirates_id_doc: Joi.string().optional().allow(null, "").default(""),
  is_salaried: Joi.boolean().optional(),
  erp_chauffeur_code: Joi.string().optional().allow(null, ""),
  erp_ac_code_cash: Joi.string().optional().allow(null, ""),
  erp_ac_code_online: Joi.string().optional().allow(null, ""),
  erp_ac_name_cash: Joi.string().optional().allow(null, ""),
  erp_ac_name_online: Joi.string().optional().allow(null, ""),
});

const createCustomerSchema = Joi.object({
  first_name: Joi.string().required(),
  last_name: Joi.string().required(),
  mobile_number: Joi.string()
    .pattern(/^\d{6,14}$/)
    .required(),
  role: Joi.string().required(),
  country_code: Joi.string()
    .pattern(/^\+\d{1,4}$/)
    .required(),
  email_id: Joi.string().email().optional(),
});

const customerUpdateSchema = Joi.object({
  email_id: Joi.string().email().optional(),
  mobile_number: Joi.string()
    .pattern(/^\d{6,14}$/)
    .optional(),
  first_name: Joi.string().optional(),
  last_name: Joi.string().optional(),
  country_code: Joi.string()
    .pattern(/^\+\d{1,4}$/)
    .optional(),
  is_active: Joi.boolean().optional(),
  status_id: Joi.number().integer().optional(),
  device_id: Joi.string().optional(),
}).min(1); // Ensures at least one field is provided for update

const createOrganizationSchema = Joi.object({
  name: Joi.string().required(),
  country_code: Joi.string()
    .pattern(/^\+\d{1,4}$/)
    .required(),
  mobile_number: Joi.string()
    .pattern(/^\d{6,14}$/)
    .required(),
  address: Joi.string().required(),
  email_id: Joi.string().email().required(),
  //organization_logo: Joi.string().uri().optional(), 
  organization_logo: Joi.string().uri().optional().allow(null, ''),
});

const updateOrganizationSchema = Joi.object({
  name: Joi.string().optional(),
  country_code: Joi.string()
    .pattern(/^\+\d{1,4}$/)
    .optional(),
  mobile_number: Joi.string()
    .pattern(/^\d{6,14}$/)
    .optional(),
  address: Joi.string().optional(),
  email_id: Joi.string().email().optional(),
  organization_logo: Joi.string().uri().optional().allow(null, ''),
});

const updateOrganizationAdminSchema = Joi.object({
  email_id: Joi.string().email().optional(),

  mobile_number: Joi.string()
    .pattern(/^\d{6,15}$/)
    .optional(),

  country_code: Joi.string()
    .pattern(/^\+\d{1,4}$/)
    .optional(),

  first_name: Joi.string().max(50).optional(),

  last_name: Joi.string().max(50).optional(),

  password: Joi.string().optional(),
});

const createAdminUserRequestSchema = Joi.object({
  first_name: Joi.string().required(),
  last_name: Joi.string().required(),
  mobile_number: Joi.string()
    .pattern(/^\d{6,14}$/)
    .optional(),
  role_id: Joi.number().required(),
  country_code: Joi.string()
    .pattern(/^\+\d{1,4}$/)
    .required(),
  email_id: Joi.string().email().required(),
  password: Joi.string().required(),
});

const createAdminUserDbSchema = Joi.object({
  first_name: Joi.string().required(),
  last_name: Joi.string().required(),
  mobile_number: Joi.string()
    .pattern(/^\d{6,14}$/)
    .optional(),
  role_id: Joi.number().required(),
  country_code: Joi.string()
    .pattern(/^\+\d{1,4}$/)
    .required(),
  email_id: Joi.string().email().required(),
  password: Joi.string().required(),
  is_active: Joi.boolean().optional(),
  status_id: Joi.number().integer().optional(),
});

const updateAdminUserRequestSchema = Joi.object({
  first_name: Joi.string().optional(),
  last_name: Joi.string().optional(),
  mobile_number: Joi.string()
    .pattern(/^\d{6,14}$/)
    .optional(),
  role_id: Joi.number().optional(),
  country_code: Joi.string()
    .pattern(/^\+\d{1,4}$/)
    .optional(),
  email_id: Joi.string().email().optional(),
  password: Joi.string().optional(),
}).min(1);

const scheduledRideRequestBodySchema = Joi.object({
  is_customer_available: Joi.boolean().optional().messages({
    "any.required": "Customer availability status is required",
  }),

  customer_extra_details: Joi.object({
    key_details: Joi.string().optional().allow(null, ""),
    instructions: Joi.string().optional().allow(null, ""),
    parking_instructions: Joi.string().optional().allow(null, ""),
  }).optional(),

  coupon_ids: Joi.array()
    .items(Joi.number().integer())
    .optional()
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
    .valid("per_min", "per_hour", "full_day", "half_day", "fixed")
    .required()
    .messages({
      "any.only":
        "Rate type must be either 'per_min' / 'per_hour' / 'full_day' / 'half_day' / 'fixed",
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
      .valid("Card", "Wallet", "POS", "Cash", "Wallet Credit")
      .optional()
      .messages({
        "any.required": "Payment method is required",
        "any.only":
          "Payment method should be 'Card', 'Wallet', 'POS', 'Wallet Credit' or 'Cash'",
      }),
    card: Joi.string().optional().allow(null, "").messages({
      "string.empty": "Card details cannot be empty if provided",
    }),
  })
    .optional()
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

  chauffeur_id: Joi.number().optional().default(0),
  chauffeur_name: Joi.string().optional().default("").allow(null, ""),
  organisation_id: Joi.number().optional(),
  organisation_ride: Joi.bool().optional(),
  hours_booked: Joi.number().integer().allow(null),
});

const scheduledRideRequestDbSchema = Joi.object({
  customer_id: Joi.string().required(),

  chauffeur_id: Joi.number().default(0),

  chauffeur_name: Joi.string().optional().allow(null, "").default(""),

  coupon_ids: Joi.array()
    .items(Joi.number().integer())
    .optional()
    .messages({
      "array.base": "Coupon IDs must be an array of integers",
      "any.required": "Coupon IDs are required",
    })
    .default([]),

  is_customer_available: Joi.boolean().optional(),

  customer_extra_details: Joi.object({
    key_details: Joi.string().optional().allow(null, ""),
    instructions: Joi.string().optional().allow(null, ""),
    parking_instructions: Joi.string().optional().allow(null, ""),
  }).optional(),

  estimated_time_in_minutes: Joi.number().optional().allow(null),

  estimated_amount: Joi.number().required(),

  ride_type: Joi.string().valid("scheduled").required(),

  rate_type: Joi.string()
    .valid("per_min", "per_hour", "full_day", "half_day", "fixed")
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

  status: Joi.string().valid("Requested", "Accepted").default("Requested"),

  order_date: Joi.string().isoDate().required().messages({
    "any.required": "Order date is required",
    "string.isoDate":
      "Order date must be in ISO 8601 format (YYYY-MM-DDTHH:mm:ss.sssZ)",
  }),

  status_log: Joi.array()
    .items(
      Joi.object({
        status: Joi.string().valid("Requested", "Accepted").required(),
        datetime: Joi.string()
          .isoDate()
          .default(() => new Date().toISOString()),
        action: Joi.string().optional(),
      })
    )
    .default([
      {
        status: "Requested",
        datetime: new Date().toISOString(),
        action: "Ride scheduled by admin",
      },
    ]),

  organisation_id: Joi.string().required(),
  //otp: Joi.string().required(),

  hours_booked: Joi.number().integer().allow(null),

  paymentDetails: Joi.object({
    payment_method: Joi.string().optional().messages({
      "any.required": "Payment method is required",
    }),
    card: Joi.string().optional().allow(null, "").messages({
      "string.empty": "Card details cannot be empty if provided",
    }),
  })
    .optional()
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
  organisation_ride: Joi.boolean().required(),
  chauffeur_initiate_apple_pay: Joi.boolean().optional(),
  apple_pay_paid: Joi.boolean().optional(),
  apple_pay_payment_failed: Joi.boolean().optional(),
}).options({ stripUnknown: false });

const createRoleSchema = Joi.object({
  name: Joi.string().required(),
  display_name: Joi.string().trim().optional().allow('', null),
  policies: Joi.array()
    .items(Joi.number().integer().positive())
    .optional()
    .messages({
      'array.base': '"policies" must be an array of positive integers',
    }),
});

const createPolicySchema = Joi.object({
  name: Joi.string().required(),
  permissions: Joi.array()
    .items(Joi.number().integer().positive())
    .optional(),
});

const associatePoliciesSchema = Joi.object({
  policy_ids: Joi.array()
    .items(Joi.number().integer().positive())
    .min(1)
    .required(),
});

const deassociatePoliciesSchema = Joi.object({
  policy_ids: Joi.array()
    .items(Joi.number().integer().positive())
    .min(1)
    .required()
    .messages({
      'array.base': '"policy_ids" must be an array of integers',
      'array.min': '"policy_ids" must contain at least one policy ID',
      'any.required': '"policy_ids" is required',
    }),
});



module.exports = {
  adminCreateUserValidator: (data) => adminCreateUserSchema.validateAsync(data),
  adminUpdateUserValidator: (data) => adminUpdateUserSchema.validateAsync(data),
  customerUpdateValidator: (data) => customerUpdateSchema.validateAsync(data),
  validateCreateRole: (data) => createRoleSchema.validateAsync(data),
  validateCreatePolicy: (data) => createPolicySchema.validateAsync(data),
  validateAssociatePolicies: (data) => associatePoliciesSchema.validateAsync(data),
  validateDeassociatePolicies: (data) => deassociatePoliciesSchema.validateAsync(data),
  adminOrganizationUserValidator: (data) =>
    createOrganizationSchema.validateAsync(data),
  adminOrganizationUpdateValidator: (data) =>
    updateOrganizationSchema.validateAsync(data),
  adminOrganizationAdminUpdateValidator: (data) =>
    updateOrganizationAdminSchema.validateAsync(data),
  customerCreateValidator: (data) => createCustomerSchema.validateAsync(data),
  createAdminUserRequestSchema,
  createAdminUserDbSchema,
  updateAdminUserRequestSchema,
  scheduledRideRequestBodySchema,
  scheduledRideRequestDbSchema,
};
