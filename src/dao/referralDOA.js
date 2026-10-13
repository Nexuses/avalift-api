// src/dao/referralDAO.js
const { where } = require("sequelize");
const { Referral, User, TemporaryReferral } = require("../dto");
const { addServerLog } = require("../services/serverLogsService");
const {generateReferralCode} = require("../utils/referralCodeGenerator");

module.exports = {
  createReferralEntry: async (userId) => {
    try {
      const user = await User.findByPk(userId);
      if (!user) throw new Error("User not found");

      const existingReferral = await Referral.findOne({ where: { referrer_id: user.id } });
      if (existingReferral) return existingReferral;

      let referralCode;
      let isUnique = false;

      while (!isUnique) {
        referralCode = generateReferralCode(user.first_name);
        const existing = await Referral.findOne({ where: { referral_code: referralCode } });
        if (!existing) isUnique = true;
      }

      const referral = await Referral.create({
        referrer_id: user.id,
        referral_code: referralCode,
      });

      return referral;
    } catch (error) {
      await addServerLog({
        log_level: "ERROR",
        service_name: "createReferralEntry",
        error_message: `Referral creation failed - ${error.message}`,
      });
      throw error;
    }
  },

  getReferralByCode: async (code) => {
    try {
      return await Referral.findOne({
        where: { referral_code: code },
        //include: [{ model: User, as: "referrer" }],
      });
    } catch (error) {
      await addServerLog({
        log_level: "ERROR",
        service_name: "getReferralByCode",
        error_message: `Error checking referral code - ${error.message}`,
      });
      throw error;
    }
  },

  markReferralUsed: async (code, referredUserId) => {
    try {
      const referral = await Referral.findOne({ where: { referral_code: code } });
      if (!referral) throw new Error("Referral code not found");

      referral.referred_user_id = referredUserId;
      referral.reward_status = "pending"; // or logic based
      referral.rewarded_at = null;

      await referral.save();
      return referral;
    } catch (error) {
      await addServerLog({
        log_level: "ERROR",
        service_name: "markReferralUsed",
        error_message: `Failed to mark referral used - ${error.message}`,
      });
      throw error;
    }
  },

  getReferralCodeByUser: async (userId) => {
    try {
      const referral = await Referral.findOne({ where: { referrer_id: userId } });
      return referral?.referral_code || null;
    } catch (error) {
      await addServerLog({
        log_level: "ERROR",
        service_name: "getReferralCodeByUser",
        error_message: `Error getting referral code - ${error.message}`,
      });
      throw error;
    }
  },

    saveTemporaryReferral: async (user_id, referral_code) => {
    try {
      const referral = await TemporaryReferral.create({
        user_id,
        referral_code,
      });
      return referral;
    } catch (error) {
      console.error('Error saving temporary referral:', error);
      throw error;
    }
  },

  appendReferredUser: async (referral_code, user_id) => {
    try {
    const referral = await Referral.findOne({ where: {referral_code} });
      if (!referral) throw new Error('Referral not found');
  
      const existingIds = referral.referred_user_ids || [];
  
      // Prevent duplicates
      if (!existingIds.includes(user_id)) {
        referral.referred_user_ids = [...existingIds, user_id];
        await referral.save();
      }
  
      return referral;
    } catch (error) {
      console.error('Error appending referred user:', error);
      throw error;
    }
  },

  checkTemporaryReferral: async (user_id) => {
    try {
      const referralUser = await TemporaryReferral.findOne({
       where: { user_id }});
      return referralUser;
    } catch (error) {
      console.error('Error saving temporary referral:', error);
      throw error;
    }
  },

  updateReferralEntry: async (referrer_id, updateData) => {
    try {
      const referral = await Referral.findOne({ where: { referrer_id } });
      if (!referral) throw new Error("Referral not found");

      await referral.update(updateData);

      return referral;
    } catch (error) {
      await addServerLog({
        log_level: "ERROR",
        service_name: "updateReferralEntry",
        error_message: `Referral update failed - ${error.message}`,
      });
      throw error;
    }
  },

  deleteTemporaryReferral: async (user_id) => {
    try {
      const deletedCount = await TemporaryReferral.destroy({
        where: { user_id },
      });

      return deletedCount > 0;
    } catch (error) {
      console.error('Error deleting temporary referral:', error);
      throw error;
    }
  },

};
