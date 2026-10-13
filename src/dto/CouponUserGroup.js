// models/CouponUserGroup.js
const { Model, DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  class CouponUserGroup extends Model {}

  CouponUserGroup.init(
    {
      coupon_id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        references: {
          model: 'CouponMasters',
          key: 'id',
        },
        onDelete: 'CASCADE',
      },
      user_group_id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        references: {
          model: 'UserGroups',
          key: 'id',
        },
        onDelete: 'CASCADE',
      },
    },
    {
      sequelize,
      modelName: 'CouponUserGroup',
      tableName: 'CouponUserGroups',
      timestamps: false,
    }
  );

  return CouponUserGroup;
};
