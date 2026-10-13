// models/CouponRule.js
const { Model, DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  class CouponRule extends Model {}

  CouponRule.init(
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      coupon_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: 'CouponMasters',
          key: 'id',
        },
        onDelete: 'CASCADE',
      },
      rule_type: {
        type: DataTypes.ENUM('first_order', 'subtotal'),
        allowNull: false,
      },
      operator: {
        type: DataTypes.ENUM('greater_than', 'less_than', 'between'),
        allowNull: true,
      },
      value: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
      },
      value2: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
      },
    },
    {
      sequelize,
      modelName: 'CouponRule',
      tableName: 'CouponRules',
      timestamps: false,
    }
  );

  return CouponRule;
};
