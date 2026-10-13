const { addServerLog } = require("../services/serverLogsService");
const { ChauffeurTipWallet, User, sequelize, ChauffeurTipWalletLog  } = require("../dto");
//const { ChauffeurTipWalletLog } = require("../dto");
const { Op, literal } = require("sequelize");

const createChauffeurTipWallet = async (chauffeurId) => {
  try {
    const existingWallet = await ChauffeurTipWallet.findOne({
      where: { chauffeur_id: chauffeurId },
    });

    if (existingWallet) {
      console.log(`Wallet already exists for chauffeur ID: ${chauffeurId}`);
      return existingWallet;
    }

    const newWallet = await ChauffeurTipWallet.create({
      chauffeur_id: chauffeurId,
      balance: 0.0,
    });

    console.log(`Created tip wallet for chauffeur ID: ${chauffeurId}`);
    return newWallet;
  } catch (error) {
    console.error(`Error creating tip wallet for chauffeur ID: ${chauffeurId}`, error);
    await addServerLog({
      log_level: "ERROR",
      service_name: "createChauffeurTipWallet",
      error_message: `Error creating tip wallet for chauffeur ID: ${chauffeurId} - ${error.message}`,
    });
    throw new Error("Failed to create chauffeur tip wallet");
  }
};

const getChauffeurTipWalletByChauffeurId = async (chauffeurId) => {
  try {
    const wallet = await ChauffeurTipWallet.findOne({
      where: { chauffeur_id: chauffeurId },
      attributes: ['chauffeur_id', 'balance'],
      // include: [
      //   { model: ChauffeurTipWalletLog, as: 'ChauffeurTipWalletLogs' },

      // ],
    });

    return wallet;
  } catch (error) {
    console.error(`Error fetching tip wallet for chauffeur ID: ${chauffeurId}`, error);
    await addServerLog({
      log_level: "ERROR",
      service_name: "getChauffeurTipWalletByChauffeurId",
      error_message: `Error fetching tip wallet for chauffeur ID: ${chauffeurId} - ${error.message}`,
    });
    throw new Error("Failed to fetch chauffeur tip wallet");
  }
};

const getChauffeurTipWalletBalances = async (searchString, fromDate, toDate, page, limit) => {
  try {
    const offset = (page - 1) * limit;

    // ---------------------------------------------
    // BUILD SEARCH CLAUSES
    // ---------------------------------------------
    let walletWhere = {};         // Used for ChauffeurTipWallet
    let chauffeurWhere = {};      // Used for JOIN on Chauffeur in date filter case
    let logWhere = {};            // Used for ChauffeurTipWalletLog

    const s = searchString?.trim();

    if (s) {
      const isNumeric = /^\d+$/.test(s);

      if (isNumeric) {
        // Search by Chauffeur ID
        walletWhere = { '$Chauffeur.id$': s };
        chauffeurWhere = { id: s };

      } else {
        const parts = s.split(" ");

        if (parts.length === 1) {
          // Single-term search (first, last, or full name)
          walletWhere = {
            [Op.or]: [
              { '$Chauffeur.first_name$': { [Op.iLike]: `%${s}%` } },
              { '$Chauffeur.last_name$': { [Op.iLike]: `%${s}%` } },
              sequelize.where(
                sequelize.fn(
                  "concat",
                  sequelize.col("Chauffeur.first_name"),
                  " ",
                  sequelize.col("Chauffeur.last_name")
                ),
                { [Op.iLike]: `%${s}%` }
              )
            ]
          };

          chauffeurWhere = {
            [Op.or]: [
              { first_name: { [Op.iLike]: `%${s}%` } },
              { last_name: { [Op.iLike]: `%${s}%` } },
              sequelize.where(
                sequelize.fn(
                  "concat",
                  sequelize.col("Chauffeur.first_name"),
                  " ",
                  sequelize.col("Chauffeur.last_name")
                ),
                { [Op.iLike]: `%${s}%` }
              )
            ]
          };

        } else {
          // Full name "first last"
          const first = parts[0];
          const last = parts.slice(1).join(" ");

          walletWhere = {
            [Op.and]: [
              { '$Chauffeur.first_name$': { [Op.iLike]: `%${first}%` } },
              { '$Chauffeur.last_name$': { [Op.iLike]: `%${last}%` } }
            ]
          };

          chauffeurWhere = {
            [Op.and]: [
              { first_name: { [Op.iLike]: `%${first}%` } },
              { last_name: { [Op.iLike]: `%${last}%` } }
            ]
          };
        }
      }
    }

    const isDateFiltered = Boolean(fromDate) && Boolean(toDate);

    // ---------------------------------------------
    // CASE 1: NO DATE FILTER → Return Wallet Table
    // ---------------------------------------------
    if (!isDateFiltered) {
      const { rows, count } = await ChauffeurTipWallet.findAndCountAll({
        where: walletWhere,
        attributes: { exclude: ["createdAt", "updatedAt"] },
        include: [
          {
            model: User,
            as: "Chauffeur",
            attributes: ["id", "first_name", "last_name"],
          }
        ],
        limit,
        offset,
        order: [["balance", "DESC"]]
      });

      return {
        wallets: rows,
        totalRecords: count,
        currentPage: page,
        totalPages: Math.ceil(count / limit),
      };
    }

    // ---------------------------------------------
    // CASE 2: DATE FILTER → SUM FROM LOG TABLE
    // ---------------------------------------------

    const start = new Date(`${fromDate}T00:00:00.000Z`);
    const end   = new Date(`${toDate}T23:59:59.999Z`);

    logWhere = {
      createdAt: { [Op.between]: [start, end] },
      status: "SUCCESS"
    };

    // FETCH AGGREGATED LOGS
    const logs = await ChauffeurTipWalletLog.findAll({
      attributes: [
        "chauffeur_id",
        [sequelize.fn("SUM", sequelize.col("amount")), "balance"]
      ],
      where: logWhere,
      include: [
        {
          model: User,
          as: "Chauffeur",
          required: true, // ensures JOIN
          attributes: ["id", "first_name", "last_name"],
          where: chauffeurWhere
        }
      ],
      group: ["ChauffeurTipWalletLog.chauffeur_id", "Chauffeur.id"],
      order: [[sequelize.literal('"balance"'), "DESC"]],
      limit,
      offset
    });

    // DISTINCT COUNT WITH JOIN
    const countDistinct = await ChauffeurTipWalletLog.count({
      where: logWhere,
      include: [
        {
          model: User,
          as: "Chauffeur",
          required: true,
          attributes: [],
          where: chauffeurWhere
        }
      ],
      distinct: true,
      col: "chauffeur_id"
    });

    return {
      wallets: logs,
      totalRecords: countDistinct,
      currentPage: page,
      totalPages: Math.ceil(countDistinct / limit)
    };

  } catch (error) {
    console.error("Error fetching chauffeur tip wallet balances:", error);
    throw new Error("Failed to fetch chauffeur tip wallet balances");
  }
};




const getChauffeurTipWalletLogsByChauffeurId = async (chauffeurId, page, limit) => {
  try {
    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 10;
    const offset = (pageNum - 1) * limitNum;
    const { rows, count } = await ChauffeurTipWalletLog.findAndCountAll({
      where: { chauffeur_id: chauffeurId },
      limit,
      offset,
      order: [['createdAt', 'DESC']]
    });

    return {
      logs: rows,
      totalRecords: count,
      currentPage: pageNum,
      totalPages: Math.ceil(count / limitNum)
    };
  } catch (error) {
    console.error(`Error fetching tip wallet logs for chauffeur ID: ${chauffeurId}`, error);
    await addServerLog({
      log_level: "ERROR",
      service_name: "getChauffeurTipWalletLogsByChauffeurId",
      error_message: `Error fetching tip wallet logs for chauffeur ID: ${chauffeurId} - ${error.message}`,
    });
    throw new Error("Failed to fetch chauffeur tip wallet logs");
  }
};

const deductFromChauffeurTipWallet = async (chauffeurId, amount, referenceId, adminId) => {
  return sequelize.transaction(async (t) => {
    const wallet = await ChauffeurTipWallet.findOne({
      where: { chauffeur_id: chauffeurId },
      lock: t.LOCK.UPDATE,
      transaction: t,
    });

    if (!wallet) throw new Error("Tip wallet not found");
    if (parseFloat(wallet.balance) < parseFloat(amount))
      throw new Error("Insufficient balance");

    const previousBalance = parseFloat(wallet.balance);
    const newBalance = previousBalance - parseFloat(amount);

    await wallet.update(
      { balance: newBalance },
      { transaction: t }
    );

    await ChauffeurTipWalletLog.create(
      {
        chauffeur_id: chauffeurId,
        chauffeur_tip_wallet_id: wallet.id,
        amount: -amount,
        previous_balance: previousBalance,
        current_balance: newBalance,
        transaction_type: "DEBIT",
        reference_id: referenceId,
        processed_by: adminId,
        status: "SUCCESS",
        description: "Tip payout processed",
      },
      { transaction: t }
    );

    return wallet;
  });
};


module.exports = {
  createChauffeurTipWallet,
  getChauffeurTipWalletByChauffeurId,
  getChauffeurTipWalletBalances,
  getChauffeurTipWalletLogsByChauffeurId,
  deductFromChauffeurTipWallet
};