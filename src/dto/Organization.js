// models/Organization.js
const { Model, DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  class Organization extends Model {}

  Organization.init(
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
      address: {
        type: DataTypes.STRING,
        allowNull: true, // Optional field
      },
      country_code: { 
        type: DataTypes.STRING(5), 
        allowNull: false,
        defaultValue: '+1', 
        validate: {
          notEmpty: true,
          is: /^\+\d{1,4}$/, 
        },
      },
      mobile_number: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
          notEmpty: true,
          isNumeric: true, // Validates numeric values
          len: [7, 15], // Validates length between 8 and 15 digits
        },
      },
      email_id: {
        type: DataTypes.STRING,
        allowNull: true,
        unique: true,
        validate: {
          isEmail: true,
        },
      },
      organization_logo: {
        type: DataTypes.STRING,
        allowNull: true, // optional during creation
      },

      is_active: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
      },

      is_deleted: {  // Added soft delete flag
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },
      
    },
    {
      sequelize,
      modelName: 'Organization',
      tableName: 'Organizations',
      timestamps: false, 


      defaultScope: {
        where: {
          is_deleted: false,
        },
      },

      scopes: {
        withDeleted: {
          where: {},
        },
      },
    }
  );

  return Organization;
};
