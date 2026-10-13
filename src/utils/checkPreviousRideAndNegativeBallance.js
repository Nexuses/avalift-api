const ridesDAO = require("../dao/ridesDAO");
const paymentsService = require("../services/paymentsService");

const checkNegativeBalanceAndActiveRide = async (userId) => {
  try {
    const userWallet = await paymentsService.getWalletDetailsByUser(userId);
    const hasNegativeBalance = userWallet.success && userWallet.wallet_balance < 0;

    const activeRides = await ridesDAO.getActiveRidesByCustomerId(userId.toString());
    const hasActiveRide = activeRides.length > 0;

    return hasNegativeBalance && hasActiveRide;
  } catch (error) {
    console.error(`Error checking balance and ride status for user ${userId}:`, error);
    throw new Error("Error checking user's balance and ride status.");
  }
};

module.exports = {
  checkNegativeBalanceAndActiveRide,
};

