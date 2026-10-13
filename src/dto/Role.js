// models/Role.js
const { Model, DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  class Role extends Model {}

  Role.init(
    {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      name: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      display_name: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      policies: {
        type: DataTypes.ARRAY(DataTypes.INTEGER), // Array of Policy IDs
        allowNull: false,
        defaultValue: [],
      },
    },
    {
      sequelize,
      modelName: 'Role',
      tableName: 'Roles',
      timestamps: false,
    }
  );

  return Role;
};
