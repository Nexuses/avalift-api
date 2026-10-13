const { Model, DataTypes } = require('sequelize');
const bcrypt = require('bcryptjs');

module.exports = (sequelize) => {
  class User extends Model {
    static associate(models) {
      User.belongsTo(models.Type, { foreignKey: 'type_id', as: 'type' });
      User.belongsTo(models.Role, { foreignKey: 'role_id', as: 'role' });
      User.belongsTo(models.Status, { foreignKey: 'status_id', as: 'status' });
      User.hasMany(models.Otp, { foreignKey: 'user_id', as: 'otps', onDelete: 'CASCADE' });
      User.hasOne(models.CurrentLocation, { foreignKey: 'user_id', as: 'currentLocation' });
      User.hasMany(models.Vehicle, { foreignKey: "user_id", as: "vehicles" });
      User.hasMany(models.UserCommission, { foreignKey: "user_id", as: "Commissions" });

    }
  }

  User.init(
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      country_code: {
        type: DataTypes.STRING(5),
        allowNull: true,
        defaultValue: '+1',
        validate: {
          notEmpty: true,
          is: /^\+\d{1,4}$/,
        },
      },
      mobile_number: {
        type: DataTypes.STRING,
        allowNull: true,
        validate: {
          notEmpty: true,
          isNumeric: true,
          len: [7, 15],
        },
      },
      email_id: {
        type: DataTypes.STRING,
        allowNull: true,
        validate: {
          isEmail: true,
        },
      },
      first_name: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      last_name: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      password: {
        type: DataTypes.STRING,
        allowNull: true,
      },

      type_id: {
        type: DataTypes.INTEGER,
        references: {
          model: 'Types',
          key: 'id',
        },
      },
      role_id: {
        type: DataTypes.INTEGER,
        references: {
          model: 'Roles',
          key: 'id',
        },
      },
      is_active: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
      },
      status_id: {
        type: DataTypes.INTEGER,
        references: {
          model: 'Statuses',
          key: 'id',
        },
      },
      user_availability: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
      },
      device_id: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      os_type: {
        type: DataTypes.JSON,
        allowNull: true,
        defaultValue: {},
      },
      is_salaried: {
        type: DataTypes.BOOLEAN,
        allowNull: true,
        defaultValue: false,
      }

    },
    {
      sequelize,
      modelName: 'User',
      tableName: 'Users',
      timestamps: true,
      indexes: [
        {
          unique: true,
          fields: ['country_code', 'mobile_number'],
          name: 'unique_country_mobile',
        },
      ],
    }
  );

  return User;
};
