//src/controllers/referralController.js
const referralService  = require("../services/referralService");
const { addServerLog } = require("../services/serverLogsService");
const generateReferralCode = require("../utils/referralCodeGenerator");

module.exports = {
generateReferralCode: async (req, res) => {
    const user_id = req.user.id;
    try {
      const items = await referralService.createAndGetReferralCode(user_id);
      res.status(200).json({
        success: true,
        status: 200,
        message: "Referral code retrieved successfully.",
        data: items,
      });
    } catch (error) {
      console.error("Error in referral code retrieval:", error);
      await addServerLog({
        log_level: "ERROR",
        service_name: "referralCode",
        error_message: `referralCode Controller error - ${error.message}.`
      });
      res.status(error.statusCode || 500).json({ error: error.message });
    }
  },
}