// services/couponService.js
const {
  createCouponDAO,
  updateCouponDAO,
  markCouponInactiveDAO,
  getCouponByIdDAO,
  getAllCouponsDAO,
  getApplicableCouponsForUser,
  getCouponsByIds,
  getApplicableCpnforUser
} = require("../dao/couponDAO");
const { canApplyFirstRideCoupon } = require("../dao/ridesDAO");


const { getUserGroupIdsByUserId } = require("../dao/userGroupDAO");

// const {
//   getCouponsByIds,
//   //getApplicableCouponsForUser,
// } = require("../dao/couponDAO");

const { validateAndCalculateDiscount } = require("../utils/couponFunctions");
const { addServerLog } = require("../services/serverLogsService");
const organizationDAO = require("../dao/organizationDAO");

const createCouponService = async (couponData, rules, userGroupIds) => {
  try {
    return await createCouponDAO(couponData, rules, userGroupIds);
  } catch (error) {
    await addServerLog({
      log_level: "ERROR",
      service_name: "createCouponService",
      error_message: `createCouponService service error - ${error.message}.`
    });
    throw error;
  }
};

const updateCouponService = async (
  couponId,
  couponData,
  rules,
  userGroupIds
) => {
  try {
    return await updateCouponDAO(couponId, couponData, rules, userGroupIds);
  } catch (error) {
    await addServerLog({
      log_level: "ERROR",
      service_name: "updateCouponService",
      error_message: `updateCouponService service error - ${error.message}.`
    });
    throw error;
  }
};

const markCouponInactiveService = async (couponId) => {
  try {
    return await markCouponInactiveDAO(couponId);
  } catch (error) {
    await addServerLog({
      log_level: "ERROR",
      service_name: "markCouponInactiveService",
      error_message: `markCouponInactiveService service error - ${error.message}.`
    });
    throw error;
  }
};

/**
 * Applies multiple coupons (by their IDs) to a ride and returns the total discount.
 *
 * @param {Array} couponIds - Array of coupon IDs.
 * @param {Object} ride - The ride details (e.g., { subtotal, organizationId, customerId }).
 * @returns {Object} - { totalDiscount, appliedCoupons: [{ coupon_id, coupon_code, discount }], errors: [ ... ] }
 *
 * Throws an error if non-combinable coupon rules are violated.
 */
const applyCouponsToRideByIds = async (couponIds = [], ride) => {
  try {
    const coupons = await getCouponsByIds(couponIds);
    console.log("FETCHED COUPON: ", coupons);
    const userGroups = await getUserGroupIdsByUserId(ride.customer_id);

    const validCoupons = [];
    const errors = [];

    // Validate each coupon concurrently using Promise.allSettled
    const validations = await Promise.allSettled(
      coupons.map(async (coupon) => {
        const discount = await validateAndCalculateDiscount(
          coupon,
          ride,
          userGroups
        );
        return { coupon, discount };
      })
    );

    validations.forEach((result, index) => {
      if (result.status === "fulfilled") {
        validCoupons.push(result.value);
      } else {
        const coupon = coupons[index];
        errors.push({
          coupon_id: coupon.id,
          coupon_code: coupon.coupon_code,
          error: result.reason.message,
        });
      }
    });

    // Early return if no valid coupons
    if (validCoupons.length === 0) {
      return { totalDiscount: 0, appliedCoupons: [], errors };
    }

    // Check non-combinable coupons
    const nonCombinableCoupons = validCoupons.filter(
      ({ coupon }) => !coupon.is_combinable
    );

    if (nonCombinableCoupons.length > 1) {
      const error = new Error("Multiple non-combinable coupons cannot be combined");
      error.statusCode = 400;
      throw error;
    }

    if (nonCombinableCoupons.length === 1) {
      const applied = nonCombinableCoupons[0];
      const finalDiscount = Math.min(applied.discount, ride.subtotal);
      return {
        totalDiscount: finalDiscount,
        appliedCoupons: [
          {
            coupon_id: applied.coupon.id,
            coupon_code: applied.coupon.coupon_code,
            discount: finalDiscount,
          },
        ],
        errors,
      };
    }

    // Otherwise, sum discounts for all valid combinable coupons.
    let totalDiscount = validCoupons.reduce(
      (sum, { discount }) => sum + discount,
      0
    );
    totalDiscount = Math.min(totalDiscount, ride.subtotal);

    const appliedCoupons = validCoupons.map(({ coupon, discount }) => ({
      coupon_id: coupon.coupon_id,
      coupon_code: coupon.coupon_code,
      discount,
    }));

    return { totalDiscount, appliedCoupons, errors };
  } catch (error) {
    await addServerLog({
      log_level: "ERROR",
      service_name: "applyCouponsToRideByIds",
      error_message: `applyCouponsToRideByIds service error - ${error.message}.`
    });
    throw error;
  }
};

/**
 * Retrieves applicable coupons for a user by their ID.
 *
 * @param {number} userId - The user's ID.
 * @returns {Promise<Array>} - List of applicable coupon objects.
 */
const fetchApplicableCoupons = async (userId) => {
  try {
    //const userGroupId = await getUserGroupIdsByUserId(userId);
    //return await getApplicableCouponsForUser(userGroupId);
    const coupons = await getApplicableCpnforUser(userId);
    const isUsersFirstRide = await canApplyFirstRideCoupon(userId.toString());
    return {coupons, isUsersFirstRide};
  } catch (error) {
    await addServerLog({
      log_level: "ERROR",
      service_name: "fetchApplicableCoupons",
      error_message: `fetchApplicableCoupons service error - ${error.message}.`
    });
    throw error;
  }
};

const getAllCoupons = async () => {
  try {
    const coupons = await getAllCouponsDAO();
    return coupons;
  } catch (error) {
    await addServerLog({
      log_level: "ERROR",
      service_name: "getAllCoupons",
      error_message: `getAllCoupons service error - ${error.message}.`
    });
    throw new Error("Error in coupon service: " + error.message);
  }
};

const getCouponById = async (couponId) => {
  try {
    const coupon = await getCouponByIdDAO(couponId);
    if (!coupon) {
      throw new Error("Coupon not found");
    }


    const orgDetails = await organizationDAO.getById(coupon.organization_id);

    return {
      ...coupon.toJSON(), // converts Sequelize instance to plain object
      organisation_name: orgDetails ? orgDetails.name : null,
    };
  } catch (error) {
    await addServerLog({
      log_level: "ERROR",
      service_name: "getCouponById",
      error_message: `getCouponById service error - ${error.message}`,
    });
    throw new Error("Error in coupon service: " + error.message);
  }
};

module.exports = {
  createCouponService,
  updateCouponService,
  markCouponInactiveService,
  applyCouponsToRideByIds,
  fetchApplicableCoupons,
  getAllCoupons,
  getCouponById
};
