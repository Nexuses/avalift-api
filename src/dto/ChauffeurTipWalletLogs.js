const { Model, DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  class ChauffeurTipWalletLog extends Model {
    static associate(models) {
      ChauffeurTipWalletLog.belongsTo(models.User, {
        foreignKey: "chauffeur_id",
        as: "Chauffeur",
      });

      ChauffeurTipWalletLog.belongsTo(models.ChauffeurTipWallet, {
        foreignKey: "chauffeur_tip_wallet_id",
      });
    }
  }

  ChauffeurTipWalletLog.init(
    {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },

      chauffeur_tip_wallet_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },

      ride_id: { type: DataTypes.STRING, allowNull: true },

      chauffeur_id: { type: DataTypes.INTEGER, allowNull: false },

      amount: { type: DataTypes.DECIMAL(10, 2), allowNull: false },

      previous_balance: { type: DataTypes.DECIMAL(10, 2), allowNull: false },

      current_balance: { type: DataTypes.DECIMAL(10, 2), allowNull: false },

      transaction_type: {
        type: DataTypes.ENUM("CREDIT", "DEBIT"),
        allowNull: false,
      },

      status: {
        type: DataTypes.ENUM("PENDING", "SUCCESS", "FAILED"),
        defaultValue: "SUCCESS",
      },

      reference_id: { type: DataTypes.STRING, allowNull: true },

      processed_by: { type: DataTypes.INTEGER, allowNull: true },

      description: { type: DataTypes.STRING(255), allowNull: true },
    },
    {
      sequelize,
      modelName: "ChauffeurTipWalletLog",
      tableName: "ChauffeurTipWalletLogs",
      timestamps: true,
    }
  );

  return ChauffeurTipWalletLog;
};
