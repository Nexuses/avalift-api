require('dotenv').config();
const {
  CouponMaster,
  CouponRule,
  CouponUserGroup,
  CouponUsage,
  UserGroup
} = require("../dto");
const { get } = require("../routes/authRoutes");
const db = require("../dto");
const { Op } = require("sequelize");
const { addServerLog } = require("../services/serverLogsService"); // Update the path as needed

/**
 * Fetch coupons applicable for a user based on their group memberships.
 *
 * A coupon is applicable if:
 * - It is unrestricted (i.e. no record in CouponUserGroups for that coupon), or
 * - It has at least one CouponUserGroup record with a user_group_id that appears in userGroupIds.
 *
 * @param {number[]} userGroupIds - Array of user group IDs.
 * @returns {Promise<Array>} - List of applicable CouponMaster objects.
 */
const getApplicableCouponsForUser = async (userGroupIds) => {
  try {
    let conditions = [];
    // Ensure only valid coupons are considered based on date
    const currentDate = new Date(new Date().toISOString()); // Ensures precise comparison
    console.log("current date", currentDate)

    conditions.push(
      {
        valid_from: { [Op.lte]: currentDate }, // Coupon should be valid from a past/current date
        valid_to: { [Op.gte]: currentDate },   // Coupon should still be valid
        is_active: true, // Ensure coupon is active
      },
    );
    console.log("conditions", conditions)
    conditions.push(
      db.sequelize.literal(
        `"CouponMaster"."id" NOT IN (SELECT DISTINCT "coupon_id" FROM "CouponUserGroups")`
      )
    );
    if (userGroupIds.length > 0) {
      const userGroupIdsList = userGroupIds.join(",");
      conditions.push(
        db.sequelize.literal(
          `"CouponMaster"."id" IN (SELECT DISTINCT "coupon_id" FROM "CouponUserGroups" WHERE "user_group_id" IN (${userGroupIdsList}))`
        )
      );
    }
    const coupons = await CouponMaster.findAll({
      where: {
        [Op.and]: conditions,
      },
    });
    return coupons;
  } catch (error) {
    console.error("Error fetching applicable coupons for user:", error);
    await addServerLog({
      log_level: "ERROR",
      service_name: "getApplicableCouponsForUser",
      error_message: `getApplicableCouponsForUser DAO error - ${error.message}.`
    });
    throw error;
  }
};

const createCouponDAO = async (couponData, rules, userGroupIds) => {
  try {
    // Create coupon record
    const newCoupon = await CouponMaster.create(couponData);

    // Create coupon rules if provided
    if (rules && Array.isArray(rules)) {
      const couponRules = rules.map((rule) => ({
        ...rule,
        coupon_id: newCoupon.id,
      }));
      await CouponRule.bulkCreate(couponRules);
    }

    // Create coupon-user group associations if provided
    if (userGroupIds && Array.isArray(userGroupIds) && userGroupIds.length > 0) {
      const groupAssociations = userGroupIds.map((groupId) => ({
        coupon_id: newCoupon.id,
        user_group_id: groupId,
      }));
      await CouponUserGroup.bulkCreate(groupAssociations);
    }

    return newCoupon;
  } catch (error) {
    console.error("Error creating coupon:", error);
    await addServerLog({
      log_level: "ERROR",
      service_name: "createCouponDAO",
      error_message: `createCouponDAO error - ${error.message}.`
    });
    throw error;
  }
};

// Retrieve all coupons with their associated rules (using alias) and user groups
const getAllCouponsDAO = async () => {
  try {
    return await CouponMaster.findAll({
      where: { is_active: true },
      include: [
        {
          model: CouponRule,
          as: "rules",
        },
        {
          model: UserGroup,
          as: "applicable_user_groups",
          through: {
            attributes: [],
          },
        },
      ],
    });
  } catch (error) {
    console.error("Error fetching all coupons:", error);
    await addServerLog({
      log_level: "ERROR",
      service_name: "getAllCouponsDAO",
      error_message: `getAllCouponsDAO error - ${error.message}.`
    });
    throw error;
  }
};

// Retrieve a single coupon by ID with its associated rules and user groups
const getCouponByIdDAO = async (couponId) => {
  try {
    return await CouponMaster.findByPk(couponId, {
      include: [
        {
          model: CouponRule,
          as: "rules",
        },
        {
          model: UserGroup,
          as: "applicable_user_groups",
          through: {
            attributes: [],
          },
        },
      ],
    });
  } catch (error) {
    console.error("Error fetching coupon by ID:", error);
    await addServerLog({
      log_level: "ERROR",
      service_name: "getCouponByIdDAO",
      error_message: `getCouponByIdDAO error - ${error.message}.`
    });
    throw error;
  }
};

const updateCouponDAO = async (couponId, couponData, rules, userGroupIds) => {
  try {
    const coupon = await CouponMaster.findByPk(couponId);
    if (!coupon) {
      throw new Error("Coupon not found");
    }
    await coupon.update(couponData);

    // Remove existing rules and add new ones
    await CouponRule.destroy({ where: { coupon_id: couponId } });
    if (rules && Array.isArray(rules)) {
      const couponRules = rules.map((rule) => ({
        ...rule,
        coupon_id: couponId,
      }));
      await CouponRule.bulkCreate(couponRules);
    }

    // Remove existing group associations and add new ones
    await CouponUserGroup.destroy({ where: { coupon_id: couponId } });
    if (userGroupIds && Array.isArray(userGroupIds) && userGroupIds.length > 0) {
      const groupAssociations = userGroupIds.map((groupId) => ({
        coupon_id: couponId,
        user_group_id: groupId,
      }));
      await CouponUserGroup.bulkCreate(groupAssociations);
    }

    return coupon;
  } catch (error) {
    console.error("Error updating coupon:", error);
    await addServerLog({
      log_level: "ERROR",
      service_name: "updateCouponDAO",
      error_message: `updateCouponDAO error - ${error.message}.`
    });
    throw error;
  }
};

const markCouponInactiveDAO = async (couponId) => {
  try {
    const coupon = await CouponMaster.findByPk(couponId);
    if (!coupon) {
      throw new Error("Coupon not found");
    }
    await coupon.update({ is_active: false });
    return coupon;
  } catch (error) {
    console.error("Error marking coupon inactive:", error);
    await addServerLog({
      log_level: "ERROR",
      service_name: "markCouponInactiveDAO",
      error_message: `markCouponInactiveDAO error - ${error.message}.`
    });
    throw error;
  }
};

const getCouponUsageForUser = async (couponId, customerId) => {
  try {
    const usageCount = await CouponUsage.count({
      where: {
        coupon_id: couponId,
        customer_id: customerId,
      },
    });
    return usageCount;
  } catch (error) {
    console.error("Error getting coupon usage for user:", error);
    await addServerLog({
      log_level: "ERROR",
      service_name: "getCouponUsageForUser",
      error_message: `getCouponUsageForUser DAO error - ${error.message}.`
    });
    throw error;
  }
};

const getTotalCouponUsage = async (couponId, customerId) => {
  try {
    const usageCount = await CouponUsage.count({
      where: {
        coupon_id: couponId,
      },
    });
    return usageCount;
  } catch (error) {
    console.error("Error getting total coupon usage:", error);
    await addServerLog({
      log_level: "ERROR",
      service_name: "getTotalCouponUsage",
      error_message: `getTotalCouponUsage DAO error - ${error.message}.`
    });
    throw error;
  }
};

const getCouponsByIds = async (couponIds) => {
  try {
    const coupons = await CouponMaster.findAll({
      where: {
        id: couponIds,
      },
    });
    return coupons;
  } catch (error) {
    console.error("Error fetching coupons by IDs:", error);
    await addServerLog({
      log_level: "ERROR",
      service_name: "getCouponsByIds",
      error_message: `getCouponsByIds DAO error - ${error.message}.`
    });
    throw error;
  }
};

const getCouponById = async (couponId) => {
  try {
    if (!couponId) {
      throw new Error('couponId is required');
    }

    const coupon = await CouponMaster.findOne({
      where: { id: couponId },
      attributes: ['id', 'coupon_code']
    });

    return coupon;
  } catch (error) {
    console.error('Error fetching coupon by ID:', error);
    await addServerLog({
      log_level: 'ERROR',
      service_name: 'getCouponById',
      error_message: `getCouponById DAO error - ${error.message}.`
    });
    throw error;
  }
};

/**
 * Retrieves the applicable user group IDs for a given coupon.
 *
 * @param {number} couponId - The ID of the coupon.
 * @returns {Promise<number[]>} - An array of user group IDs associated with the coupon.
 */
const getApplicableUserGroupIds = async (couponId) => {
  try {
    const entries = await CouponUserGroup.findAll({
      where: { coupon_id: couponId },
      attributes: ["user_group_id"],
      raw: true,
    });
    return entries.map((entry) => entry.user_group_id);
  } catch (error) {
    console.error(`Error fetching user groups for coupon ${couponId}:`, error);
    await addServerLog({
      log_level: "ERROR",
      service_name: "getApplicableUserGroupIds",
      error_message: `getApplicableUserGroupIds DAO error - ${error.message}.`
    });
    throw error;
  }
};

const getCouponsByCode = async (coupon_code) => {
  try {
    const coupons = await CouponMaster.findAll({
      where: {
        coupon_code: coupon_code,
      },
    });
    return coupons;
  } catch (error) {
    console.error("Error fetching coupons by Code:", error);
    await addServerLog({
      log_level: "ERROR",
      service_name: "getCouponsByCode",
      error_message: `getCouponsByCode DAO error - ${error.message}.`
    });
    throw error;
  }
};

const getApplicableCpnforUser = async (userId) => {
  try {
    const coupons = await CouponMaster.findAll({
      where: {
        coupon_code: process.env.WELCOME_COUPON_CODE,
      },
      raw: true,
    });

    if (coupons && coupons.length > 0) {
      const couponUsage = await CouponUsage.findAll({
        where: { customer_id: userId },
        attributes: ["id"],
        raw: true,
      });

      if (couponUsage && couponUsage.length > 0) {
        console.log(`No coupon applicable for user ID`);
        return [];
      }

      // Format discount fields as strings
      const formattedCoupons = coupons.map(coupon => ({
        ...coupon,
        discount_value: coupon.discount_value.toString(),
        max_discount_amount: coupon.max_discount_amount !== null ? coupon.max_discount_amount.toString() : null,
      }));

      return formattedCoupons;
    } else {
      console.log(`No Welcome coupon found for user ID ${userId}`);
      await addServerLog({
        log_level: "ERROR",
        service_name: "getApplicableCpnforUser",
        error_message: `No Welcome coupon found for user ID ${userId}.`
      });
      return [];
    }
  } catch (error) {
    console.error("Error fetching applicable coupons for user:", error);
    await addServerLog({
      log_level: "ERROR",
      service_name: "getApplicableCpnforUser",
      error_message: `getApplicableCpnforUser DAO error - ${error.message}.`
    });
    throw error;
  }
};


module.exports = {
  createCouponDAO,
  getAllCouponsDAO,
  getCouponByIdDAO,
  updateCouponDAO,
  markCouponInactiveDAO,
  getCouponUsageForUser,
  getTotalCouponUsage,
  getCouponsByIds,
  getCouponById,
  getApplicableCouponsForUser,
  getApplicableUserGroupIds,
  getCouponsByCode,
  getApplicableCpnforUser
};
