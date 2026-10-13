const { Model, DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  class VehicleDetail extends Model {
    static associate(models) {
      VehicleDetail.belongsTo(models.Vehicle, { foreignKey: "vehicle_id" });
    }
  }

  VehicleDetail.init(
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      vehicle_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: "Vehicles",
          key: "id",
        },
      },
      color: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      fuel_type: {
        type: DataTypes.ENUM("petrol", "ev"),
        allowNull: true,
      },
      make: {
        type: DataTypes.STRING,
        allowNull: false, // Assuming every vehicle must have a make
      },
      model: {
        type: DataTypes.STRING,
        allowNull: false, // Assuming every vehicle must have a model
      },
      media_data: {
        type: DataTypes.ARRAY(DataTypes.STRING),
        allowNull: true,
      },
      emirate_name: {
        type: DataTypes.STRING,
        allowNull: true,
      },
    },
    {
      sequelize,
      modelName: "VehicleDetail",
      tableName: "VehicleDetails",
      timestamps: true,
    }
  );

  return VehicleDetail;
};
