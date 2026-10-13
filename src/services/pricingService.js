const Joi = require("joi");
const {
  getActivePricingsInRange,
  deactivatePricing,
  getPricingById,
  insertPricing,
  updatePricing,
  getPricingForOrg,
} = require("../dao/pricingsDAO");
const { addServerLog } = require("../services/serverLogsService");

/**
 * Joi validation schema for pricing data
 */
const chargeSchema = Joi.object({
  isPercentage: Joi.boolean().required(),
  value: Joi.number().min(0).required(),
});

const pricingSchema = Joi.object({
  currency: Joi.string().valid("AED", "INR").required(),

  mandatory_charges: Joi.object()
    .pattern(Joi.string(), chargeSchema)
    .required(),

  other_charges: Joi.object()
    .pattern(Joi.string(), chargeSchema)
    .optional(),

  vat: Joi.number().min(0).required().default(5),

  effective_from: Joi.date().required(),

  effective_to: Joi.date().optional(),

  organization_id: Joi.number().required(),

  is_active: Joi.boolean().default(true),

  rates: Joi.object({
    base_fare: Joi.number(),
    per_min: Joi.number(),
    per_hour_tiers: Joi.object()
      .pattern(
        Joi.number().integer().min(1).max(12),
        Joi.number().min(0)
      )
      .optional(),
    half_day: Joi.number(),
    full_day: Joi.number(),
    rta_test: Joi.number(),
    garage_ride: Joi.number(),
    fixed: Joi.number(),
  }).required(),
}).custom((value, helpers) => {
    const { organization_id: orgId, rates } = value;
    const requiredForOrg1 = [
      "base_fare",
      "per_min",
      "per_hour_tiers",
      "half_day",
      "full_day",
      "rta_test",
      "garage_ride",
      "fixed",
    ];
    if (orgId === 1) {
      for (const field of requiredForOrg1) {
        if (rates[field] === undefined) {
          return helpers.error("any.custom", {
            message: `'${field}' is required when organization is Avalift`,
          });
        }
      }
      // also ensure all 12 tiers exist:
      const tiers = Object.keys(rates.per_hour_tiers || {}).map(Number);
      for (let h = 1; h <= 12; ++h) {
        if (!tiers.includes(h)) {
          return helpers.error("any.custom", {
            message: `Missing per_hour_tiers['${h}'] for organization 1`,
          });
        }
      }
    } else {
      // for other orgs, only fixed is required
      if (rates.fixed === undefined) {
        return helpers.error("any.custom", {
          message: "'fixed' is required when organization is not Avalift",
        });
      }
    }
    return value;
  });

/**
 * Adds or updates a pricing entry.
 *
 * @param {object} pricingData The pricing details
 * @param {string|number} allowedOrganisation The org ID or "*" for super-user
 * @returns {Promise<string>} The pricing_id of the newly created/updated pricing.
 */
const addPricingService = async (pricingData, allowedOrganisation) => {
  try {
    // 1. Validate input with Joi
    const { error } = pricingSchema.validate(pricingData);
    if (error) {
      throw Object.assign(new Error(error.details?.[0]?.context?.message || error.message), { statusCode: 400 });
    }

    // 2. Determine final organization_id
    if (allowedOrganisation === "*") {
      if (!pricingData.organization_id) {
        throw Object.assign(new Error("Organization ID is required when allowedOrganisation is '*'."), { statusCode: 400 });
      }
    } else {
      pricingData.organization_id = allowedOrganisation;
    }

    const { organization_id, currency, effective_from, effective_to, is_active } =
      pricingData;

    // 3. Ensure date consistency
    const effectiveFromDate = new Date(effective_from);
    const effectiveToDate = effective_to
      ? new Date(effective_to)
      : new Date("9999-12-31");

    if (effectiveFromDate > effectiveToDate) {
      throw Object.assign(
        new Error("Invalid date range: effective_from must be before effective_to"),
        { statusCode: 400 }
      );
    }

    // 4. Generate the pricing_id
    const pricing_id = `${currency}#${effectiveFromDate.toISOString()}`;

    // 5. If the new pricing is active, ensure only one active pricing exists for the time range.
    if (is_active) {
      const overlappingActivePricings = await getActivePricingsInRange(
        organization_id,
        currency,
        effectiveFromDate.toISOString(),
        effectiveToDate.toISOString()
      );

      // Deactivate any active pricing that isn’t the current pricing record.
      for (const pricing of overlappingActivePricings) {
        if (pricing.pricing_id !== pricing_id) {
          await deactivatePricing(organization_id, pricing.pricing_id);
        }
      }
    }

    // 6. Prepare the pricing record with updated date formats
    const pricingItem = {
      ...pricingData,
      pricing_id,
      effective_from: effectiveFromDate.toISOString(),
      effective_to: effectiveToDate.toISOString(),
    };

    // 7. Insert or update the pricing record based on its existence.
    const existingPricing = await getPricingById(organization_id, pricing_id);
    if (existingPricing) {
      // Instead of deactivating, update the existing pricing record with new details.
      await updatePricing(organization_id, pricing_id, pricingItem);
    } else {
      await insertPricing(pricingItem);
    }

    return pricing_id;
  } catch (error) {
    console.error("Error in addPricingService:", error.message);
    await addServerLog({
      log_level: "ERROR",
      service_name: "addPricingService",
      error_message: `addPricingService service error - ${error.message}.`
    });
    throw error;
  }
};

const getOtherChargesForOrg = async (data) => {
  try {
    const { org_id } = data;

    if (!org_id) {
      throw new Error("Can't find any organization for the user.");
    }

    const pricing = await getPricingForOrg(org_id, "AED");
    console.log("Pricing: ", pricing);

    if (!pricing || pricing.length === 0 || !pricing[0]) {
      throw new Error("Pricing details not found.");
    }

    const otherChargesObj = pricing[0].other_charges || {};
    const otherChargeNames = Object.keys(otherChargesObj);

    return {
      other_charges: otherChargeNames,
    };
  } catch (error) {
    console.error("Error in getOtherChargesForOrg:", error.message);
    await addServerLog({
      log_level: "ERROR",
      service_name: "getOtherChargesForOrg",
      error_message: `getOtherChargesForOrg service error - ${error.message}.`
    });
    throw error;
  }
};


const editPricingService = async (organization_id, pricing_id, updatedData) => {
  try {

    console.log("pricing_id: ", pricing_id);
    if(!pricing_id){
      const err = new Error("Can't find any pricing for the user.");
      err.statusCode = 400;
      throw err;
    }
    // 1. Validate updated data with Joi
    // const { error } = pricingSchema.validate(updatedData);
    // if (error) {
    //   throw new Error(`Validation error: ${error.details[0].message}`);
    // }

    // 2. Retrieve the existing pricing record
    const existingPricing = await getPricingById(organization_id, pricing_id);
    if (!existingPricing) {
      const err = new Error(`Pricing with id ${pricing_id} not found.`);
      err.statusCode = 404;
      throw err;
    }

    if(existingPricing.is_active === false){
      const err = new Error(`Pricing with id ${pricing_id} is not active.`);
      err.statusCode = 409;
      throw err;
    }

    // 3. Ensure date consistency for the updated data
    const effectiveFromDate = updatedData.effective_from? new Date(updatedData.effective_from): new Date(existingPricing.effective_from);
    const effectiveToDate = updatedData.effective_to
      ? new Date(updatedData.effective_to)
      : new Date(existingPricing.effective_to);

      console.log("effectiveFromDate: ", effectiveFromDate);
      console.log("effectiveToDate: ", effectiveToDate);

//      if (updatedData.effective_from || updatedData.effective_to) {
    if (effectiveFromDate > effectiveToDate) {
      const err = new Error("Invalid date range: effective_from must be before effective_to");
      err.statusCode = 400;
      throw err;
    }
//      }



    // 4. If the updated pricing is active, ensure no other active pricing overlaps.
    if (updatedData.is_active? updatedData.is_active : existingPricing.is_active) {
      const overlappingActivePricings = await getActivePricingsInRange(
        organization_id,
        updatedData.currency? updatedData.currency : existingPricing.currency,
        effectiveFromDate.toISOString(),
        effectiveToDate.toISOString()
      );

      console.log("overlappingActivePricings: ", overlappingActivePricings);

      for (const pricing of overlappingActivePricings) {
        if (pricing.pricing_id !== pricing_id) {
          console.log("pricing.pricing_id: ", pricing.pricing_id);
          console.log("pricing_id: ", pricing_id);
          await deactivatePricing(organization_id, pricing.pricing_id);
        }
      }
    }

    // 5. Merge existing pricing with the updated data
    const updatedPricingItem = {
      ...existingPricing,
      ...updatedData,
      rates: {
        ...existingPricing.rates,
        ...updatedData.rates,
        per_hour_tiers: {
          ...existingPricing.rates?.per_hour_tiers,
          ...updatedData.rates?.per_hour_tiers
        }
      },
      mandatory_charges: {
        ...existingPricing.mandatory_charges,
        ...updatedData.mandatory_charges
      },
      other_charges: {
        ...existingPricing.other_charges,
        ...updatedData.other_charges
      },

      effective_from: effectiveFromDate.toISOString(),
      effective_to: effectiveToDate.toISOString(),
    };

    console.log("updatedPricingItem: ", updatedPricingItem);

    // 6. Update the pricing record
    await updatePricing(organization_id, pricing_id, updatedPricingItem);

    return updatedPricingItem;
  } catch (error) {
    console.error("Error in editPricingService:", error.message);
    await addServerLog({
      log_level: "ERROR",
      service_name: "editPricingService",
      error_message: `editPricingService error - ${error.message}.`
    });
    throw error;
  }
};

const getPricingService = async (data) => {
  try {
    const { organization_id, pricing_id } = data;
    return await getPricingById(organization_id, pricing_id);
  } catch (error) {
    console.error("Error in getPricingById:", error.message);
    await addServerLog({
      log_level: "ERROR",
      service_name: "getPricingById",
      error_message: `getPricingById service error - ${error.message}.`
    });
    throw error;
  }
};


module.exports = {
  addPricingService,
  getOtherChargesForOrg,
  editPricingService,
  getPricingService
};
