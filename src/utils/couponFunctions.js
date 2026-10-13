// utils/couponFunctions.js
const {
  getCouponUsageForUser,
  getTotalCouponUsage,
  getApplicableUserGroupIds
} = require("../dao/couponDAO");
const { canApplyFirstRideCoupon } = require("../dao/ridesDAO");

const validateAndCalculateDiscount = async (coupon, ride, userGroups = []) => {
  const now = new Date();

  // 1. Validate coupon is active and within valid dates.
  if (!coupon.is_active) {
    throw new Error(`Coupon ${coupon.coupon_code} is inactive`);
  }
  if (now < new Date(coupon.valid_from) || now > new Date(coupon.valid_to)) {
    throw new Error(`Coupon ${coupon.coupon_code} is not valid at this time`);
  }

  // 2. Organization restriction.

  if (
    coupon.organization_id &&
    Number(coupon.organization_id) !== Number(ride.organization_id) // changed cause of different types
  ) {
    throw new Error(
      `Coupon ${coupon.coupon_code} is not applicable for this organization`
    );
  }

  // 3. User group check.
  const couponGroupIds = await getApplicableUserGroupIds(coupon.id);
  if (couponGroupIds.length > 0) {
    const intersection = couponGroupIds.filter((groupId) =>
      userGroups.includes(groupId)
    );
    if (intersection.length === 0) {
      throw new Error(
        `Coupon ${coupon.coupon_code} is not applicable for this user group`
      );
    }
  }

  // 4. First ride rule.
  if (coupon.first_order_only) {
    const isFirstRide = await canApplyFirstRideCoupon(ride.customer_id.toString());
    if (!isFirstRide) {
      throw new Error(
        `Coupon ${coupon.coupon_code} is only applicable on the first completed ride`
      );
    }
  }

  // 5. Enforce max usage per user if defined.
  if (coupon.max_usage_per_user) {
    const usageCount = await getCouponUsageForUser(coupon.id, ride.customer_id);
    if (usageCount >= coupon.max_usage_per_user) {
      throw new Error(
        `Coupon ${coupon.coupon_code} has reached its usage limit for this user`
      );
    }
  }

  // 5b. Total usage for a coupon.
  if (coupon.usage_limit) {
    const usageCount = await getTotalCouponUsage(coupon.id);
    if (usageCount >= coupon.usage_limit) {
      throw new Error(
        `Coupon ${coupon.coupon_code} has reached its overall usage limit`
      );
    }
  }

  // 6. Subtotal conditions.
  if (coupon.min_subtotal && ride.subtotal < coupon.min_subtotal) {
    throw new Error(
      `Ride subtotal must be at least ${coupon.min_subtotal} for coupon ${coupon.coupon_code}`
    );
  }
  if (coupon.max_subtotal && ride.subtotal > coupon.max_subtotal) {
    throw new Error(
      `Ride subtotal must not exceed ${coupon.max_subtotal} for coupon ${coupon.coupon_code}`
    );
  }

  // 7. Calculate discount.
  let discount = 0;
  if (coupon.discount_type === "fixed") {
    discount = parseFloat(coupon.discount_value);
  } else if (coupon.discount_type === "percentage") {
    discount =
      ride.subtotal * (parseFloat(coupon.discount_value) / 100);
    if (coupon.max_discount_amount) {
      discount = Math.min(discount, parseFloat(coupon.max_discount_amount));
    }
  }
  discount = Math.min(discount, ride.subtotal); // Ensure discount does not exceed subtotal.

  console.log("DISCOUNT: ",discount);
  return discount;
};

module.exports = { validateAndCalculateDiscount };
