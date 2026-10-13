const { Model, DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  class UserCommission extends Model {
    static associate(models) {
    UserCommission.belongsTo(models.User, { foreignKey: "user_id", as: "User" });
  }
}

  UserCommission.init(
    {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      user_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: "Users", // Referencing Users table
          key: "id",
        },
      },
      role_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: "Roles", // Referencing Roles table
          key: "id",
        },
      },
      ride_id: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
      },
      commission: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        validate: {
          min: 0,
        },
      },
      is_percentage: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      ride_amount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        validate: {
          min: 0,
        },
      },
      commission_amount: {
        type: DataTypes.DECIMAL(10, 2), // Virtual field (calculated dynamically)
        allowNull: false,
        validate: {
          min: 0,
        },
      },
      created_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
      },
      updated_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
      },
    },
    {
      sequelize,
      modelName: "UserCommission",
      tableName: "UserCommissions",
      timestamps: true,
      underscored: true, // Makes table column names snake_case
    }
  );

  return UserCommission;
};
