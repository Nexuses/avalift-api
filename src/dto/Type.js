// src/dto/Type.js
const { Model, DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  class Type extends Model {
    static associate(models) {
      Type.hasMany(models.User, { foreignKey: 'type_id' });
    }
  }

  Type.init(
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      type: { 
        type: DataTypes.STRING,
        allowNull: false,
      },
      
    },
    {
      sequelize,
      modelName: 'Type',
      tableName: 'Types',
      timestamps: true,
    }
  );

  return Type;
};
