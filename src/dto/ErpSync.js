const { Model, DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  class ErpSync extends Model {
    static associate(models) {
      // Optional association if you have Ride model
      // ErpSync.belongsTo(models.Ride, { foreignKey: 'ride_id' });
    }
  }

  ErpSync.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
      },

      ride_id: {
        type: DataTypes.STRING(50),
        allowNull: false,
        unique: true
      },

      invoice_id: {
        type: DataTypes.STRING(100),
        allowNull: true
      },

      status: {
        type: DataTypes.ENUM('PENDING', 'SUCCESS', 'FAILED'),
        allowNull: false,
        defaultValue: 'PENDING'
      },

      error_message: {
        type: DataTypes.TEXT,
        allowNull: true
      }
    },
    {
      sequelize,
      modelName: 'ErpSync',
      tableName: 'erp_syncs',
      timestamps: true,
      createdAt: 'created_at',
      updatedAt: false,
      indexes: [
        {
          name: 'erp_sync_ride_id_unique',
          unique: true,
          fields: ['ride_id']
        }
      ]
    }
  );

  return ErpSync;
};
