// src/dto/BankDetail.js
const { Model, DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  class BankDetail extends Model {
    static associate(models) {
    }
  }

  BankDetail.init(
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      account_number: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
      },
      bank_name: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      iban: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      branch_name: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      default: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
    },
    {
      sequelize,
      modelName: 'BankDetail',
      tableName: 'BankDetails',
      timestamps: true,
      paranoid: true,
      deletedAt: 'deletedAt',
    }
  );

  return BankDetail;
};
