const { getChauffeurTipWalletBalances } = require('../dao/chauffeurTipWalletDAO');
const tipService = require('../services/tipService');

module.exports={
addTip: async (req, res) => {
  try {
    const userId = req.user.id;
    const { ride_id, tip_amount, respond_to_tip, tip_status } = req.body;
    const tip = await tipService.addTip(userId, ride_id, tip_amount, respond_to_tip, tip_status);
     return res.status(200).json({
      success: true,
      message: "Tip updated successfully",
      data: tip.final_price_calculation
    });

  } catch (error) {
    console.error("Error adding tip:", error);

    return res.status(400).json({
      success: false,
      message: error.message || "Failed to add tip"
    });
  }
},

getChauffeurTipWalletBalances: async (req, res) => {
    try {
        const { page, limit } = req.params;
        const {searchString, fromDate, toDate} = req.body;
        const wallet = await tipService.getChauffeurTipWalletBalances(searchString, fromDate, toDate, page, limit);
        return res.status(200).json({
            success: true,
            data: wallet
        });
    } catch (error) {
        console.error("Error fetching chauffeur tip wallet balances:", error);
        return res.status(400).json({
      success: false,
      message: error.message || "Failed to add tip"
    });
  }
},

getChauffeurTipWalletLogsById: async (req, res) => {
    try {
        const { page, limit } = req.params;
        const { chauffeurId } = req.body;
        const logs = await tipService.getChauffeurTipWalletLogsById(chauffeurId, page, limit);
        return res.status(200).json({
            success: true,
            data: logs
        });
    } catch (error) {
        console.error("Error fetching chauffeur tip wallet logs:", error);
        return res.status(400).json({
      success: false,
      message: error.message || "Failed to get tip wallet logs"
    });
  }
},

tipPayout: async (req, res) => {
  try {
    const { chauffeurId, amount } = req.body;
    const userId = req.user.id;

    const payoutResult = await tipService.processTipPayout(chauffeurId, amount, userId);

    return res.status(200).json({
      success: true,
      message: "Tip payout processed successfully",
      data: payoutResult
    });
  } catch (error) {
    console.error("Error processing tip payout:", error);
    return res.status(400).json({
      success: false,
      message: error.message || "Failed to process tip payout"
    });
  }
},

};