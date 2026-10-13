// models/UserGroup.js
const { Model, DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  class UserGroup extends Model {
    static associate(models) {
      UserGroup.belongsToMany(models.CouponMaster, {
        through: models.CouponUserGroup,
        foreignKey: 'user_group_id',
        as: 'coupons',
      });
      UserGroup.belongsToMany(models.User, {
        through: models.UserGroupMembership,
        foreignKey: 'user_group_id',
        as: 'users',
      });
    }
  }

  UserGroup.init(
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      group_name: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
      },
      description: {
        type: DataTypes.STRING,
        allowNull: true,
      },
    },
    {
      sequelize,
      modelName: 'UserGroup',
      tableName: 'UserGroups',
      timestamps: true,
    }
  );

  return UserGroup;
};
