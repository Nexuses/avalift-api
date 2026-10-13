// models/UserGroupMembership.js
const { Model, DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  class UserGroupMembership extends Model {}

  UserGroupMembership.init(
    {
      user_id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        references: {
          model: "Users",
          key: "id",
        },
        onDelete: "CASCADE",
      },
      user_group_id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        references: {
          model: "UserGroups",
          key: "id",
        },
        onDelete: "CASCADE",
      },
    },
    {
      sequelize,
      modelName: "UserGroupMembership",
      tableName: "UserGroupMemberships",
      timestamps: false,
    }
  );

  return UserGroupMembership;
};
