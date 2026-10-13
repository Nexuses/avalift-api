// models/Policy.js
const { Model, DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  class Policy extends Model {}

  Policy.init(
    {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      name: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
      },
      permissions: {
        type: DataTypes.ARRAY(DataTypes.INTEGER), // Array of Permission IDs
        allowNull: false,
        defaultValue: [],
      },
    },
    {
      sequelize,
      modelName: 'Policy',
      tableName: 'Policies',
      timestamps: false,
    }
  );

  return Policy;
};
