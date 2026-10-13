const { Model, DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  class CurrentLocation extends Model {
    static associate(models) {
      // Define associations here
      CurrentLocation.belongsTo(models.User, { foreignKey: 'user_id', as: 'user' });
      //
    }
  }

  CurrentLocation.init(
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
          model: 'Users',
          key: 'id',
        },
      },
      user_type: {
        type: DataTypes.ENUM('pd', 'chauffeur'),
        allowNull: false,
      },
      current_lat: {
        type: DataTypes.DOUBLE,
        allowNull: false,
      },
      current_long: {
        type: DataTypes.DOUBLE,
        allowNull: false,
      },
      location: {
        type: DataTypes.GEOGRAPHY('POINT', 4326),
        allowNull: false,
      },
    },
    {
      sequelize,
      modelName: 'CurrentLocation',
      tableName: 'Currentlocations',
      timestamps: true,
    }
  );

  return CurrentLocation;
};
