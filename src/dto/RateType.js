// src/dto/RateType.js
const { Model, DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  class RateType extends Model {
    // No associations, so no associate method is needed
  }

  RateType.init(
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      type_category: { 
        type: DataTypes.STRING,
        allowNull: false,
      },
      type_name: { 
        type: DataTypes.STRING,
        allowNull: false,
      },
      display_name: { 
        type: DataTypes.STRING,
        allowNull: false,
      },
      duration_hours: { 
        type: DataTypes.INTEGER,
        allowNull: true,  // duration_hours can be NULL
      },
    },
    {
      sequelize,
      modelName: 'RateType',
      tableName: 'RateTypes', 
      timestamps: true, 
    }
  );

  return RateType;
};
