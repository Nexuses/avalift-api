  // src/dto/Status.js
  const { Model, DataTypes } = require('sequelize');

  module.exports = (sequelize) => {
    class Status extends Model {
      static associate(models) {
        Status.hasMany(models.User, { foreignKey: 'status_id' });
      }
    }

    Status.init(
      {
        id: {
          type: DataTypes.INTEGER,
          primaryKey: true,
          autoIncrement: true,
        },
        name: { 
          type: DataTypes.STRING,
          allowNull: false,
        },
      },
      {
        sequelize,
        modelName: 'Status',
        tableName: 'Statuses',
        timestamps: true,
      }
    );

    return Status;
  };
