// src/services/referralService.js
const userDAO = require("../dao/userDAO");
const { addServerLog } = require("../services/serverLogsService");
const referralDOA = require("../dao/referralDOA");
require("dotenv").config();




const createAndGetReferralCode = async (user_id) => {
    try {
        const userDetails = await userDAO.findById(user_id);

        if (!userDetails) {
            const err = new Error("User not found.");
            err.statusCode = 400;
            throw err;
        }
        const referralAmount = process.env.REFERRAL_REWARD_AMOUNT;
        const referralCode = await referralDOA.createReferralEntry(user_id);
        return result ={
          id: referralCode.id, 
          referral_code: referralCode.referral_code,
          refferer_id: referralCode.referrer_id,
          referral_amount: `AED ${referralAmount}`,
        }
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

  module.exports = {
    createAndGetReferralCode
  };