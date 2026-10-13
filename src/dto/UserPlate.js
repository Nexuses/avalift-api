// src/dto/UserPlate.js

const { Model, DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  class UserPlate extends Model {
    static associate(models) {
      // Add associations if needed
    }
  }

  UserPlate.init(
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      emirate_name: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      start_code_type: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      starting_plate_code: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      ending_plate_code: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      number_of_digits: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 5,
      },
      plate_image: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      region_url:{
        type: DataTypes.STRING,
        allowNull: true
      }
    },
   
    {
      sequelize,
      modelName: "UserPlate",
      tableName: "UserPlates",
      timestamps: false,
    }
  );

  return UserPlate;
};
