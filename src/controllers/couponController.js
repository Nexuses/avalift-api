const {
  createCouponService,
  updateCouponService,
  markCouponInactiveService,
  fetchApplicableCoupons,
  getAllCoupons,
  getCouponById
} = require("../services/couponService");
const { addServerLog } = require("../services/serverLogsService");
const { ValidationError } = require('sequelize');

const createCouponController = async (req, res) => {
  try {
    const { coupon, rules, applicable_user_groups } = req.body;
    const newCoupon = await createCouponService(coupon, rules, applicable_user_groups);
    return res.status(201).json({
      message: "Coupon created successfully",
      coupon: newCoupon
    });
  } catch (error) {
    // Sequelize validation error, extract and return the details
    if (error instanceof ValidationError) {
      const validationMessages = error.errors.map(e => ({
        field: e.path,
        message: e.message
      }));
      return res.status(400).json({
        error: "Validation failed",
        details: validationMessages
      });
    }

    console.error("Error in createCouponController:", error);
    await addServerLog({
      log_level: "ERROR",
      service_name: "createCouponController",
      error_message: `createCouponController error - ${error.message}.`
    });
    return res.status(500).json({ error: error.message || "Internal server error" });
  }
};

const updateCouponController = async (req, res) => {
  try {
    const couponId = req.params.id;
    const { coupon, rules, applicable_user_groups } = req.body;
    const updatedCoupon = await updateCouponService(couponId, coupon, rules, applicable_user_groups);
    res.status(200).json({
      message: "Coupon updated successfully",
      coupon: updatedCoupon
    });
  } catch (error) {
    console.error("Error in updateCouponController:", error);
    await addServerLog({
      log_level: "ERROR",
      service_name: "updateCouponController",
      error_message: `updateCouponController error - ${error.message}.`
    });
    res.status(500).json({ error: error.message || "Internal server error" });
  }
};

const deleteCouponController = async (req, res) => {
  try {
    const couponId = req.params.id;
    await markCouponInactiveService(couponId);
    res.status(200).json({ message: "Coupon marked inactive successfully" });
  } catch (error) {
    console.error("Error in deleteCouponController:", error);
    await addServerLog({
      log_level: "ERROR",
      service_name: "deleteCouponController",
      error_message: `deleteCouponController error - ${error.message}.`
    });
    res.status(500).json({ error: error.message || "Internal server error" });
  }
};

const getApplicableCoupons = async (req, res, next) => {
  try {
    const userId = req.user.id;
    if (!userId) {
      return res.status(400).json({ error: "User id missing" });
    }
    const coupons = await fetchApplicableCoupons(userId);
    res.status(200).json({
      status: 200,
      success: true,
      //data: [], // changed fro live testing on 24 may
      data: coupons, //changed for live testing on 24 may-welcome coupon
      message: "Fetched applicable coupons for a user.",
    });
  } catch (error) {
    console.error("Error in getApplicableCoupons controller:", error);
    await addServerLog({
      log_level: "ERROR",
      service_name: "getApplicableCoupons",
      error_message: `getApplicableCoupons Controller error - ${error.message}.`
    });
    next(error);
  }
};

const getAllCouponsController = async (req, res) => {
  try {
    const coupons = await getAllCoupons();
    res.status(200).json(coupons);
  } catch (error) {
    console.error("Error in getAllCouponsController:", error);
    await addServerLog({
      log_level: "ERROR",
      service_name: "getAllCouponsController",
      error_message: `getAllCouponsController error - ${error.message}.`
    });
    res.status(500).json({ error: error.message || "Internal server error" });
  }
};

const getCouponByIdController = async (req, res) => {
  try {
    const couponId = req.params.id;
    const coupon = await getCouponById(couponId);
    res.status(200).json(coupon);
  } catch (error) {
    console.error("Error in getCouponByIdController:", error);
    await addServerLog({
      log_level: "ERROR",
      service_name: "getCouponByIdController",
      error_message: `getCouponByIdController error - ${error.message}.`
    });
    res.status(500).json({ error: error.message || "Internal server error" });
  }
};

module.exports = {
  createCouponController,
  updateCouponController,
  deleteCouponController,
  getApplicableCoupons,
  getAllCouponsController,
  getCouponByIdController
};
