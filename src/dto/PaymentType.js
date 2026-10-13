// src/dto/Type.js
const { Model, DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  class PaymentType extends Model { }

  PaymentType.init(
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      name: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      for_display: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      is_active: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      }
    },
    {
      sequelize,
      modelName: 'PaymentType',
      tableName: 'PaymentTypes',
      timestamps: true,
    }
  );

  return PaymentType;
};
