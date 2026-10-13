// models/CouponMaster.js
const { Model, DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  class CouponMaster extends Model {
    static associate(models) {
      // Many-to-many association with UserGroup via CouponUserGroup
      CouponMaster.belongsToMany(models.UserGroup, {
        through: models.CouponUserGroup,
        foreignKey: 'coupon_id',
        as: 'applicable_user_groups',
      });
      // Define one-to-many association with CouponRule
      CouponMaster.hasMany(models.CouponRule, {
        foreignKey: 'coupon_id',
        as: 'rules',
      });
      //CouponUsage association
      CouponMaster.hasMany(models.CouponUsage, {
        foreignKey: 'coupon_id',
        as: 'couponUsages',
      });
    }
  }

  CouponMaster.init(
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      coupon_description: {
        type: DataTypes.STRING(500),
        allowNull: true,
      },
      coupon_title: {
        type: DataTypes.STRING(150),
        allowNull: false,
      },
      coupon_code: {
        type: DataTypes.STRING(100),
        allowNull: false,
        unique: true,
      },
      discount_type: {
        type: DataTypes.ENUM('fixed', 'percentage'),
        allowNull: false,
      },
      discount_value: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      max_discount_amount: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      valid_from: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      valid_to: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      usage_limit: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      max_usage_per_user: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      is_active: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      organization_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      is_combinable: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      first_order_only: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      min_subtotal: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
      },
      max_subtotal: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
      },
    },
    {
      sequelize,
      modelName: 'CouponMaster',
      tableName: 'CouponMasters',
      timestamps: true,
      indexes: [
        {
          name: 'coupon_master_index',
          fields: ['coupon_code', 'valid_from', 'valid_to'],
          unique: true,
        },
      ],
    }
  );

  return CouponMaster;
};
