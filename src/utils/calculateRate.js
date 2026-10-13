// Ensure applyCouponsToRideByIds is available in your context, e.g.,
const { applyCouponsToRideByIds } = require("../services/couponService");

const calculateEstimatedAmount = async (
  rateType,
  time_in_minutes = 0,
  pricing,
  selectedOtherCharges = [],
  previous_balance = 0.0,
  couponIds = [],
  customerDetails = {},
  is_ride_extended = false,
  plannedMinutes = 0,
  remainingMinutes = 0
) => {
  let estimatedAmount = 0;
  console.log("Customer Details: ", customerDetails);

  time_in_minutes = Math.abs(time_in_minutes);
  console.log("Time in minutes: ", time_in_minutes);

  console.log('rateType', rateType);
  console.log('time_in_minutes', time_in_minutes);
  console.log('pricing', pricing);
  console.log('selectedOtherCharges', selectedOtherCharges);
  console.log('previous_balance', previous_balance);
  console.log('couponIds', couponIds);
  console.log('customerDetails', customerDetails);
  console.log('is_ride_extended', is_ride_extended);
  console.log('plannedMinutes', plannedMinutes);
  console.log('remainingMinutes', remainingMinutes);

  // Determine effective billable minutes
  const effectiveMinutes =
  plannedMinutes > 0
    ? plannedMinutes + remainingMinutes
    : time_in_minutes;

  console.log('effectiveMinutes', effectiveMinutes);

  const getHourlyTierAmount = (tiers, hours) => {
  if (!tiers || Object.keys(tiers).length === 0) {
    throw new Error("Hourly rate tiers are not configured.");
  }

  // If exact hour tier exists, use it
  if (tiers[hours.toString()] !== undefined) {
    return tiers[hours.toString()];
  }

  // Fallback → use the highest available tier
  const sortedHours = Object.keys(tiers)
    .map(Number)
    .filter((h) => !isNaN(h))
    .sort((a, b) => a - b);

  const lastHour = sortedHours[sortedHours.length - 1];

  return tiers[lastHour.toString()];
  };

const PER_MIN_THRESHOLD = 10;

const splitMinutesToHours = (totalMinutes) => {
  // Case 1: ≤ 10 minutes → pure per-minute
  if (totalMinutes <= PER_MIN_THRESHOLD) {
    return {
      hours: 0,
      minutes: totalMinutes
    };
  }

  let hours = Math.floor(totalMinutes / 60);
  let minutes = totalMinutes % 60;

  // Case 2: 11–59 minutes → minimum 1 hour
  if (hours === 0) {
    return {
      hours: 1,
      minutes: 0
    };
  }

  // Case 3: apply 10-min rounding after each hour
  if (minutes > PER_MIN_THRESHOLD) {
    hours += 1;
    minutes = 0;
  }

  return { hours, minutes };
};

  const capByLastHourlyTier = (tiers, hours, minutes) => {
    if (!tiers || Object.keys(tiers).length === 0) {
      return { hours, minutes };
    }

    const maxTierHour = Math.max(
      ...Object.keys(tiers)
        .map(Number)
        .filter((h) => !isNaN(h))
    );

    // If hours exceed last tier → cap
    if (hours >= maxTierHour) {
      return {
        hours: maxTierHour,
        minutes: 0
      };
    }

    return { hours, minutes };
  };




  //console.log('plannedMinutes & is_ride_extended', plannedMinutes, is_ride_extended);
  switch (rateType) {
    case "per_min":{
      estimatedAmount = (pricing.rates.per_min || 0) * time_in_minutes;
      break;
    }
    case "per_hour":{
      const tiers = pricing.rates.per_hour_tiers || {};
      const perMinRate = pricing.rates.per_min || 0;

      let { hours, minutes } = splitMinutesToHours(effectiveMinutes);
      ({ hours, minutes } = capByLastHourlyTier(tiers, hours, minutes));

      if (hours > 0) {
        estimatedAmount = getHourlyTierAmount(tiers, hours);
      }

      if (minutes > 0) {
        estimatedAmount += minutes * perMinRate;
      }

    break;
    }

  case "half_day": {
  const HALF_DAY_HOURS = 4;
  const tiers = pricing.rates.per_hour_tiers || {};
  const perMinRate = pricing.rates.per_min || 0;

  // const effectiveMinutes =
  //   plannedMinutes > 0
  //     ? plannedMinutes + remainingMinutes
  //     : time_in_minutes;

    let { hours, minutes } = splitMinutesToHours(effectiveMinutes);
    ({ hours, minutes } = capByLastHourlyTier(tiers, hours, minutes));

  // Below slab → hourly
  if (hours < HALF_DAY_HOURS) {
    if (hours > 0) {
      estimatedAmount = getHourlyTierAmount(tiers, hours);
    }
    if (minutes > 0) {
      estimatedAmount += minutes * perMinRate;
    }
    break;
  }

  // Exact slab → half-day
  if (hours === HALF_DAY_HOURS) {
    estimatedAmount = pricing.rates.half_day || 0;
    break;
  }

  // Above slab → PURE hourly (ignore half-day)
  estimatedAmount = getHourlyTierAmount(tiers, hours);
  break;
  }


  case "full_day": {
  const FULL_DAY_HOURS = 8;
  const tiers = pricing.rates.per_hour_tiers || {};
  const perMinRate = pricing.rates.per_min || 0;

  // const effectiveMinutes =
  //   plannedMinutes > 0
  //     ? plannedMinutes + remainingMinutes
  //     : time_in_minutes;

    let { hours, minutes } = splitMinutesToHours(effectiveMinutes);
    ({ hours, minutes } = capByLastHourlyTier(tiers, hours, minutes));

  // Below slab → hourly
  if (hours < FULL_DAY_HOURS) {
    if (hours > 0) {
      estimatedAmount = getHourlyTierAmount(tiers, hours);
    }
    if (minutes > 0) {
      estimatedAmount += minutes * perMinRate;
    }
    break;
  }

  // Exact slab → full-day
  if (hours === FULL_DAY_HOURS) {
    estimatedAmount = pricing.rates.full_day || 0;
    break;
  }

  // Above slab → PURE hourly
  estimatedAmount = getHourlyTierAmount(tiers, hours);
  break;
}

    case "fixed":{
      if (pricing.rates.fixed === undefined || pricing.rates.fixed === null) {
        throw new Error("Fixed rate not applicable for this organization.");
      }
      estimatedAmount = pricing.rates.fixed;
      break;
    }
    case "rta_test":{
      estimatedAmount = pricing.rates.rta_test || 70;
      break;
    }
    case "garage_ride":{
      estimatedAmount = pricing.rates.garage_ride || 55;
      break;
    }
    default:{
      throw new Error("Invalid rate type");
    }
  }

  // Add base fare only for specific rate types
  if (["per_min", "per_hour", "half_day", "full_day"].includes(rateType)) {
    estimatedAmount += pricing.rates.base_fare;
  }

  // Helper function to round to 2 decimal places
  const roundToTwoDecimals = (value) => Math.round(value * 100) / 100;

  // Function to apply charges based on selected types
  const applyCharges = (charges, baseFare, allowedKeys = null) => {
    let breakdown = {};
    let totalCharge = 0;

    Object.entries(charges || {}).forEach(([chargeName, charge]) => {
      // Only include charges if they are in the allowed list or if no list is provided (for mandatory charges)
      if (!allowedKeys || allowedKeys.includes(chargeName)) {
        let amount = charge.isPercentage
          ? (charge.value / 100) * baseFare
          : charge.value;
        amount = roundToTwoDecimals(amount);
        breakdown[chargeName] = amount;
        totalCharge += amount;
      }
    });

    totalCharge = roundToTwoDecimals(totalCharge);
    return { totalCharge, breakdown };
  };

  // Calculate mandatory charges (includes VAT if present)
  const mandatoryChargesResult = applyCharges(
    pricing.mandatory_charges,
    estimatedAmount
  );
  let subtotal = roundToTwoDecimals(
    estimatedAmount + mandatoryChargesResult.totalCharge
  );

  // Apply only the selected other charges (if any were passed)
  const otherChargesResult = applyCharges(
    pricing.other_charges,
    estimatedAmount,
    selectedOtherCharges
  );

  // Calculate the base amount normally (without considering a positive previous_balance)
  // This base amount is used for coupon discount and VAT calculation
  const couponVatBase = roundToTwoDecimals(
    subtotal + otherChargesResult.totalCharge
  );

  // If previous_balance is negative (i.e., an unpaid amount), add its absolute value to the total amount (for reference)
  let totalAmount = couponVatBase;
  if (previous_balance < 0) {
    totalAmount = roundToTwoDecimals(totalAmount + Math.abs(previous_balance));
  }

  // Use the base amount that excludes previous_balance for coupon discount calculation
  customerDetails.subtotal = couponVatBase;

  // ----------- Coupon Discount Calculation -----------
  let coupon_discount = 0;
  let appliedCoupons = [];
  let couponErrors = [];
  let isCouponApplied = false;

  if (
    couponIds.length > 0 &&
    customerDetails.customer_id &&
    customerDetails.organization_id
  ) {
    console.log("Coupons Applied");
    try {
      const couponResult = await applyCouponsToRideByIds(
        couponIds,
        customerDetails
      );
      coupon_discount = couponResult.totalDiscount;
      appliedCoupons = couponResult.appliedCoupons;
      couponErrors = couponResult.errors;
      isCouponApplied = true;
    } catch (err) {
      // Instead of throwing an error, mark coupon processing as failed.
      couponErrors.push({ error: err.message });
      coupon_discount = 0;
      appliedCoupons = [];
      isCouponApplied = false;
    }

    // If any coupon errors exist, flag should be false
    if (
      (couponErrors && couponErrors.length > 0) ||
      (appliedCoupons && appliedCoupons.length === 0)
    ) {
      isCouponApplied = false;
    }
  }

  // Total after applying coupon discount calculated on the base amount (excluding previous_balance)
  const total_after_discount = roundToTwoDecimals(
    couponVatBase - coupon_discount
  );
  //console.log('couponVatBase', total_after_discount);
  // ----------- VAT Calculation (exclude previous balance from VAT) -----------
  const vatRate = pricing.vat;
  const vat = roundToTwoDecimals(couponVatBase * (vatRate / 100));
  //console.log('vat', vatRate);
  // Final total includes the VAT added to the discounted base amount
  const final_total_amount = roundToTwoDecimals(
    total_after_discount +
    vat +
    (previous_balance < 0 ? Math.abs(previous_balance) : 0)
  );

  // Return a detailed breakdown
  return {
    base_fare: roundToTwoDecimals(estimatedAmount),
    previous_balance: previous_balance < 0 ? Math.abs(previous_balance) : 0.0,
    rates: pricing.rates,
    mandatory_charges: {
      total: mandatoryChargesResult.totalCharge,
      breakdown: mandatoryChargesResult.breakdown,
    },
    other_charges: {
      total: otherChargesResult.totalCharge,
      breakdown: otherChargesResult.breakdown,
    },
    estimated_total_amount: totalAmount, // Note: This total includes previous_balance if negative
    coupon_discount: roundToTwoDecimals(coupon_discount), // discount amount from coupons
    appliedCoupons, // details of applied coupons
    couponErrors, // any errors from coupon validation
    isCouponApplied, // flag indicating whether coupon processing succeeded
    total_after_discount, // total after coupon discount, before tax (excluding previous_balance)
    vat, // calculated VAT on the discounted base amount (excluding previous_balance)
    final_total_amount, // final amount payable after coupon discount and VAT
    vat_percentage: vatRate,
  };
};

module.exports = {
  calculateEstimatedAmount,
};
