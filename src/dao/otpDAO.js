const { Otp } = require('../dto'); // Assuming Otp model is defined
const { Op } = require('sequelize');
const { addServerLog } = require("../services/serverLogsService"); // Update the path as needed

module.exports = {
  // Create OTP for existing user
  createOtp: async ({ user_id, otp_code, expires_at }) => {
    try {
      // Mark all previous OTPs as used for this user/email/phone
      await Otp.update(
        { is_used: true },
        {
          where: {
            user_id,
            is_used: false,
          },
        }
      );
      // Create new OTP entry
      return await Otp.create({
        user_id,
        otp_code,
        expires_at,
        is_used: false,
      });
    } catch (error) {
      console.error("Error creating OTP:", error);
      await addServerLog({
        log_level: "ERROR",
        service_name: "createOtp",
        error_message: `createOtp DAO error - ${error.message}.`
      });
      throw error;
    }
  },

  // Create OTP for new user
  createOtpForNewUser: async ({ email_id, mobile_number, otp_code, expires_at }) => {
    try {
      // Mark all previous OTPs as used for the same email or mobile number
      await Otp.update(
        { is_used: true },
        {
          where: {
            [Op.or]: [
              email_id ? { email_id } : {},
              mobile_number ? { mobile_number } : {},
            ],
            is_used: false,
          },
        }
      );

      // Create a new OTP entry
      return await Otp.create({
        email_id,
        mobile_number,
        otp_code,
        expires_at,
        is_used: false,
      });
    } catch (error) {
      console.error("Error creating OTP for new user:", error);
      await addServerLog({
        log_level: "ERROR",
        service_name: "createOtpForNewUser",
        error_message: `createOtpForNewUser DAO error - ${error.message}.`
      });
      throw error;
    }
  },

  // Verify OTP for existing user
  verifyOtpForUser: async (user_id, otp_code) => {
    try {
      const otpRecord = await Otp.findOne({
        where: {
          user_id,
          otp_code,
          is_used: false,
          expires_at: { [Op.gt]: new Date() },
        },
        order: [['createdAt', 'DESC']],
      });

      if (!otpRecord) {
        return false;
      }

      // Mark OTP as used
      otpRecord.is_used = true;
      await otpRecord.save();

      return true;
    } catch (error) {
      console.error("Error verifying OTP for user:", error);
      await addServerLog({
        log_level: "ERROR",
        service_name: "verifyOtpForUser",
        error_message: `verifyOtpForUser DAO error - ${error.message}.`
      });
      throw error;
    }
  },

  // Verify OTP for new user
  verifyOtpForNewUser: async (email_id, mobile_number, otp_code) => {
    try {
      const conditions = {
        [Op.or]: [],
        otp_code,
        is_used: false,
        expires_at: { [Op.gt]: new Date() },
      };

      if (email_id) {
        conditions[Op.or].push({ email_id });
      }
      if (mobile_number) {
        conditions[Op.or].push({ mobile_number });
      }

      if (conditions[Op.or].length === 0) {
        return false;
      }

      const otpRecord = await Otp.findOne({
        where: conditions,
        order: [['createdAt', 'DESC']],
      });

      return !!otpRecord;
    } catch (error) {
      console.error("Error verifying OTP for new user:", error);
      await addServerLog({
        log_level: "ERROR",
        service_name: "verifyOtpForNewUser",
        error_message: `verifyOtpForNewUser DAO error - ${error.message}.`
      });
      throw error;
    }
  }
};
