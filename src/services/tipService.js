const ridesDAO = require("../dao/ridesDAO");
const tipDAO = require("../dao/chauffeurTipWalletDAO");
const { addServerLog } = require("../services/serverLogsService");

const addTip = async (userId, rideId, tipAmount, respondToTip, tip_status) => {
    try {
        // Validate ride existence
        const existingRide = await ridesDAO.getRideById(rideId);
        if (!existingRide) {
            throw new Error(`Ride with ID ${rideId} not found.`);
        }
        console.log("Existing Ride:", existingRide.customer_id);
        // Ensure ride belongs to the logged-in user
        if (existingRide.customer_id !== String(userId)) {
            throw new Error("Unauthorized: Ride does not belong to the customer.");
        }

         // Allow adding tip only before payment
        const allowedStatuses = ["Payment Initiated"];
        if (!allowedStatuses.includes(existingRide.status)) {
        throw new Error(
            `Tip cannot be added in the current ride status (${existingRide.status})`
        );
        }

        if(tipAmount !==0 && !respondToTip){
            throw new Error(
            `Tip amount and respond to tip is also needed`
        );
        }

        // Validate tip amount (0 allowed → means remove tip)
        if (tipAmount < 0 || !Number.isFinite(tipAmount)) {
        throw new Error(`Invalid tip amount: ${tipAmount}`);
        }

        if(tip_status && tip_status === true){ 
            const updateData = {
                tip_status: "RESPONDED",
                tip_decided_at: Date.now(),
            };
            const updatedRide = await ridesDAO.updateRideByPkSk(
                existingRide.PK,
                existingRide.SK,
                updateData
            );
            return updatedRide;
        }

        // if respondToTip is false and tipAmount is 0, need to update ride respond_to_tip flag
        if (!respondToTip && tipAmount === 0) {
            const updateData = {
                respond_to_tip: true,
                tip_status: "SKIPPED",
                tip_decided_at: Date.now(),
            };
            const updatedRide = await ridesDAO.updateRideByPkSk(
                existingRide.PK,
                existingRide.SK,
                updateData
            );
            return updatedRide;
        }

        // // Base total before tip (from final_price_calculation)
        // const baseTotal = Number(
        // existingRide.final_price_calculation?.final_total_amount || 0
        // );

        const originalBaseTotal =
            Number(existingRide.final_price_calculation?.final_total_amount_before_tip) ||
            Number(existingRide.final_price_calculation?.final_total_amount);

        //const oldTotal = Number(existingRide.final_price_calculation.final_total_amount);
        const oldTip = Number(existingRide.final_price_calculation?.tip_amount || 0);

        // If same tip, no need to recalc/update
        if (oldTip === tipAmount) {
        return existingRide;
        }
        // Calculate new total
        const updatedTotal = Number(
        (originalBaseTotal + tipAmount).toFixed(2)
        );

        const updatedFinalPrice = {
            ...existingRide.final_price_calculation,
            final_total_amount: updatedTotal,
            tip_amount: tipAmount,
            tip_added: tipAmount > 0,
            final_total_amount_before_tip: originalBaseTotal
        };

        // Build update payload
        const updateData = {
        final_price_calculation: updatedFinalPrice,
        respond_to_tip: true,
        tip_status: "CONFIRMED",
        tip_decided_at: Date.now(),
        };


        const updatedRide = await ridesDAO.updateRideByPkSk(
        existingRide.PK,
        existingRide.SK,
        updateData
        );

        return updatedRide;

    } catch (error) {
        await addServerLog({
        log_level: "ERROR",
        service_name: "addTip",
        error_message: `AddTip service error - ${error.message}`,
        });
        throw error;
    }
};

const getChauffeurTipWalletBalances = async (searchString, fromDate, toDate, page, limit) => {
    try {
        //const offset = (page - 1) * limit;
        const cleanFromDate =
        fromDate && fromDate.trim() !== "" ? fromDate.trim() : null;

        const cleanToDate =
        toDate && toDate.trim() !== "" ? toDate.trim() : null;
        const wallets = await tipDAO.getChauffeurTipWalletBalances(searchString, cleanFromDate, cleanToDate, page, limit);
        return wallets;
    } catch (error) {
        await addServerLog({
            log_level: "ERROR",
            service_name: "getChauffeurTipWalletBalances",
            error_message: `GetChauffeurTipWalletBalances service error - ${error.message}`,
        });
        throw error;
    }
};

const getChauffeurTipWalletLogsById = async (chauffeurId, page, limit) => {
    try {

        const pageNum = parseInt(page) || 1;
        const limitNum = parseInt(limit) || 10;

        if(pageNum < 1 || limitNum < 1){
            throw new Error("Invalid pagination parameters");
        }

        const wallet = await tipDAO.getChauffeurTipWalletByChauffeurId(chauffeurId);
        if (!wallet) {
            throw new Error(`Tip wallet not found for chauffeur ID: ${chauffeurId}`);
        }
        const logs = await tipDAO.getChauffeurTipWalletLogsByChauffeurId(chauffeurId, pageNum, limitNum);
        return logs;
    } catch (error) {
        await addServerLog({
            log_level: "ERROR",
            service_name: "getChauffeurTipWalletLogsById",
            error_message: `GetChauffeurTipWalletLogsById service error - ${error.message}`,
        });
        throw error;
    }
};

const processTipPayout = async (chauffeurId, amount, userId) => {
    try {
        const referenceId = `TIP_${chauffeurId}_${Date.now()}`;

        if (amount <= 0) throw new Error("Amount must be greater than 0");

        return await tipDAO.deductFromChauffeurTipWallet(
            chauffeurId,
            amount,
            referenceId,
            userId
        );
    } catch (error) {
        await addServerLog({
            log_level: "ERROR",
            service_name: "processTipPayout",
            error_message: `ProcessTipPayout service error - ${error.message}`,
        });
        throw error;
    }
};

const expireTipIfPending = async ({ rideId, customerId }) => {
  const now = Date.now();

  // Fetch ride using PK/SK pattern
  const ride = await ridesDAO.getRide(`${customerId}`, `#${rideId}`);
  if (!ride) {
    return {
      ok: false,
      reason: "RIDE_NOT_FOUND",
    };
  }

  // Fast-exit: if already decided, do nothing
  if (ride.tip_status !== "PENDING") {
    return {
      ok: true,
      expired: false,
      reason: "TIP_ALREADY_DECIDED",
      tip_status: ride.tip_status,
    };
  }

  try {
    const data = {
        tip_status: "EXPIRED",
        tip_amount: 0,
        respond_to_tip: true,
        tip_decided_at: now,
    };
    const updatedRide = await ridesDAO.updateRideByPkSk(
      ride.PK,
      ride.SK,
      data
    );

    return {
      ok: true,
      expired: true,
      rideId,
      tip_status: updatedRide.tip_status,
    };
  } catch (err) {
    /**
     * ConditionalCheckFailedException means:
     * - customer already CONFIRMED / SKIPPED the tip
     * - OR tip_expires_at is still in the future
     * Both cases are VALID → treat as no-op
     */
    if (err.name === "ConditionalCheckFailedException") {
      return {
        ok: true,
        expired: false,
        reason: "TIP_ALREADY_HANDLED_OR_NOT_EXPIRED",
      };
    }

    // Any other error should fail the job
    throw err;
  }
};




module.exports = {
    addTip,
    //getTipWalletDetails,
    getChauffeurTipWalletBalances,
    getChauffeurTipWalletLogsById,
    processTipPayout,
    expireTipIfPending
};