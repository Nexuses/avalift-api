// models/CouponUsage.js
const { Model, DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  class CouponUsage extends Model {
    static associate(models) {
      CouponUsage.belongsTo(models.CouponMaster, { foreignKey: 'coupon_id' });
      CouponUsage.belongsTo(models.User, { foreignKey: 'customer_id' });
    }
  }

  CouponUsage.init(
    {
      coupon_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: 'CouponMasters', key: 'id' },
      },
      customer_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: 'Users', key: 'id' },
      },
    },
    {
      sequelize,
      modelName: "CouponUsage",
      tableName: "CouponUsages",
      timestamps: true,
    }
  );

  return CouponUsage;
};
