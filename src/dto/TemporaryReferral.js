// src/dto/TemporaryReferral.js
const { Model, DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  class TemporaryReferral extends Model {}

  TemporaryReferral.init(
    {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },

      user_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },

      referral_code: {
        type: DataTypes.STRING,
        allowNull: false,
      },
    },
    {
      sequelize,
      modelName: 'TemporaryReferral',
      tableName: 'TemporaryReferrals',
      timestamps: true, // createdAt and updatedAt
    }
  );

  return TemporaryReferral;
};
