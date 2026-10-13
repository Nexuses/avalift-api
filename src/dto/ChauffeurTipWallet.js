// src/dto/ChauffeurTipWallet.js
const { Model, DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  class ChauffeurTipWallet extends Model {
    static associate(models) {
    ChauffeurTipWallet.belongsTo(models.User, {
        foreignKey: 'chauffeur_id',
        as: 'Chauffeur'
    });
    ChauffeurTipWallet.hasMany(models.ChauffeurTipWalletLog, {
        foreignKey: 'chauffeur_tip_wallet_id',
        as: 'ChauffeurTipWalletLogs',
        onDelete: "CASCADE"
    });
    }
  }
  ChauffeurTipWallet.init(
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
        chauffeur_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            unique: true,
            references: {
                model: 'Users',
                key: 'id'
            }
    },
        balance: { 
            type: DataTypes.DECIMAL(10, 2),
            allowNull: false,
            defaultValue: 0.00
    },
    },
    {
      sequelize,
      modelName: 'ChauffeurTipWallet',
      tableName: 'ChauffeurTipWallet',
      timestamps: true,
    }
  );

  return ChauffeurTipWallet;
};
