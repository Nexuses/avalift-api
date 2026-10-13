// services/changeDestinationService.js
const { getRide, updateRideByPkSk } = require("../dao/ridesDAO.js");
const pricingDAO = require("../dao/pricingsDAO.js");
const paymentsService = require("./paymentsService.js");
const { calculateEstimatedAmount } = require("../utils/calculateRate.js");

/**
 * Update ride with new drop, update ETA/estimated_amount for per_min rides,
 * and append previous drop info to destination_change_history.
 *
 * @param {string} rideId
 * @param {{ lat: number, long: number, point: string }} newDrop
 * @param {string} orgId
 * @param {string} userId
 * @param {number} additionalMins
 */
const changeDestinationService = async (
  rideId,
  newDrop,
  orgId,
  userId,
  additionalMins = 0
) => {
  // Load existing ride
  const ride = await getRide(String(userId), `#${rideId}`);
  if (!ride) throw Object.assign(new Error("Ride not found"), { statusCode: 404 });

  const startedStatus = ride.status_log.find(
    (status) => status.status === "Started"
  );

  let estimated_time_in_minutes = 0;
  if (startedStatus) {
    const startedTime = new Date(startedStatus.datetime);
    const currentTime = new Date();
    estimated_time_in_minutes = Math.floor(
      (currentTime - startedTime) / (1000 * 60)
    );
  }

  // Calculate new ETA & amount (only for per_min rides)
  let newEta = estimated_time_in_minutes;
  //console.log("new eta outside",newEta);
  let newEstAmount = ride.estimated_amount;

  if (ride.rate_type === "per_min") {
    const [pricing] = await pricingDAO.getPricingForOrg(orgId, "AED");
    const wallet = await paymentsService.getWalletDetailsByUser(userId);
    const walletBal = wallet.success ? wallet.wallet_balance : 0;

    const totalMinutes = newEta + additionalMins;

    const customerDetails = { organization_id: orgId, customer_id: userId };

    const estimateResult = await calculateEstimatedAmount(
      ride.rate_type,
      totalMinutes,
      pricing,
      [],
      walletBal,
      ride.coupon_ids || [],
      customerDetails
    );

    newEta = totalMinutes;
    //console.log("newETA on if condition: ", newEta);
    newEstAmount = estimateResult.estimated_total_amount;
    //console.log("newEstAmount on if condition: ", newEstAmount);
  }

  // Build a flat history entry (stores the OLD state before change)
  const historyEntry = {
    drop: ride.requested_drop,
    point: ride.requested_drop_point,
    eta: ride.estimated_time_in_minutes,
    amount: ride.estimated_amount,
    changed_at: new Date().toISOString()
  };

  // Append new history entry
  const fullHistory = [...(ride.destination_change_history || []), historyEntry];


  if (typeof newEta !== 'number' || isNaN(newEta)) {
    console.error('Invalid newEta value:', newEta, 'Ride ID:', rideId);
    throw new Error('Invalid ETA value');
  }

  // Compute new planned_end_time
  const newPlannedEnd = new Date(Date.now() + newEta * 60000).toISOString();

  // Update ride with new drop, ETA, amount, planned_end_time & full history
  return updateRideByPkSk(String(userId), `#${rideId}`, {
    requested_drop: { lat: newDrop.lat, long: newDrop.long },
    requested_drop_point: newDrop.point,
    estimated_time_in_minutes: ["per_hour", "full_day", "half_day"].includes(ride.rate_type) ? ride.estimated_time_in_minutes : newEta,
    estimated_amount: ["per_hour", "full_day", "half_day"].includes(ride.rate_type) ? ride.estimated_amount : newEstAmount,
    planned_end_time: ["per_hour", "full_day", "half_day"].includes(ride.rate_type)
      ? ride.planned_end_time
      : newPlannedEnd,
    destination_change_history: fullHistory
  });
};

module.exports = { changeDestinationService };
