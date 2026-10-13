// src/dto/Otp.js
const { Model, DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  class Otp extends Model {
    static associate(models) {
      Otp.belongsTo(models.User, { foreignKey: 'user_id', as: 'user' });
    }
  }

  Otp.init(
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      user_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
          model: 'Users',
          key: 'id',
        },
      },
      email_id: {
        type: DataTypes.STRING,
        allowNull: true,
        validate: {
          isEmail: true,
        },
      },
      mobile_number: {
        type: DataTypes.STRING,
        allowNull: true,
        validate: {
          isNumeric: true,
          len: [10, 15],
        },
      },
      otp_code: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      expires_at: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      is_used: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },
    },
    {
      sequelize,
      modelName: 'Otp',
      tableName: 'Otps',
      timestamps: true,
    }
  );

  return Otp;
};
