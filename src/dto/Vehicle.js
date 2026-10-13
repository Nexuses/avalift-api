const { Model, DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  class Vehicle extends Model {
    static associate(models) {
      Vehicle.hasOne(models.VehicleDetail, {
        foreignKey: "vehicle_id",
        as: "vehicleDetail",
      });
      // Define association with User
      Vehicle.belongsTo(models.User, { foreignKey: "user_id" });
    }
  }

  Vehicle.init(
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
          model: "Users",
          key: "id",
        },
      },
      registration_no: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
      },
      is_active: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
      },
    },
    {
      sequelize,
      modelName: "Vehicle",
      tableName: "Vehicles",
      timestamps: true,

      // indexes: [
      //   {
      //     unique: true,
      //     fields: ["user_id", "registration_no"],
      //     name: "unique_user_registration"  // same name as your migration constraint
      //   },
      // ],
    }
  );

  return Vehicle;
};
