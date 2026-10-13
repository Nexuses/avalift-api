// src/dto/Referral.js
const { Model, DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  class Referral extends Model {
    static associate(models) {
      Referral.belongsTo(models.User, {
        foreignKey: 'referrer_id',
        as: 'referrer',
      });
      Referral.belongsTo(models.User, {
        foreignKey: 'referred_user_id',
        as: 'referredUser',
      });
    }
  }

  Referral.init(
    {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },

      referrer_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: 'Users',
          key: 'id',
        },
      },

      referred_user_ids: {
        type: DataTypes.ARRAY(DataTypes.INTEGER),
        allowNull: true,
      },

      referral_code: {
        type: DataTypes.STRING,
        allowNull: true,
      },

      reward_type: {
        type: DataTypes.STRING, // e.g., 'wallet', 'coupon', 'cashback'
        allowNull: true,
      },

      reward_amount: {
        type: DataTypes.DECIMAL(10, 2),
        defaultValue: 0.0,
      },

      reward_status: {
        type: DataTypes.ENUM('pending', 'credited', 'failed'),
        defaultValue: 'pending',
      },

      reward_event: {
        type: DataTypes.STRING, // e.g., 'signup', 'first_ride', etc.
        allowNull: true,
      },

      rewarded_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
    },
    {
      sequelize,
      modelName: 'Referral',
      tableName: 'Referrals',
      timestamps: true,
    }
  );

  return Referral;
};
