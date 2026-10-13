// commissionService.js
const { UserCommission } = require("../dto"); 
require('dotenv').config();
const { fn, col } = require('sequelize');


const calculateCommission = (rideAmount, commissionPercentage) => {
  // Calculate the commission amount
  const commissionAmount = (rideAmount * commissionPercentage) / 100;

  return commissionAmount;
};

const createUserCommissionRecord = async ({
  userId,
  roleId,
  rideId,
  rideAmount,
}) => {
  // Read the commission percentage from environment variable
  const COMMISSION_PERCENTAGE = parseFloat(process.env.COMMISSION_PERCENTAGE);

  // Check if commission is applicable and calculate amount
  const commissionAmount = calculateCommission(rideAmount, COMMISSION_PERCENTAGE);
  if (!commissionAmount) {
    return null;
  }

  // Create the record in UserCommissions table
  // `commission` field is the percentage stored
  // `commission_amount` is the numeric value calculated
  // `is_percentage` is set to true to reflect a percentage-based commission
  return UserCommission.create({
    user_id: userId,
    role_id: roleId,
    ride_id: rideId,
    commission: COMMISSION_PERCENTAGE,
    is_percentage: true,
    ride_amount: rideAmount,
    commission_amount: commissionAmount,
  });
};

// Get the sum of all commissions
const getTotalCommissionSum = async () => {
  const result = await UserCommission.findOne({
    attributes: [[fn('SUM', col('commission_amount')), 'total_commission']],
    raw: true,
  });
  return parseFloat(result.total_commission) || 0;
};

// Get the sum of commissions for a specific chauffeur (user)
const getCommissionSumByUserId = async (userId) => {
  const result = await UserCommission.findOne({
    where: { user_id: userId },
    attributes: [[fn('SUM', col('commission_amount')), 'user_commission']],
    raw: true,
  });
  return parseFloat(result.user_commission) || 0;
};

module.exports = {
  calculateCommission,
  createUserCommissionRecord,
  getTotalCommissionSum,
  getCommissionSumByUserId
};
