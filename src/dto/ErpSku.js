// models/ErpSku.js
const { Model, DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  class ErpSku extends Model {
    static associate(models) {}
  }

  ErpSku.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
      },
      service_type: {
        type: DataTypes.STRING(50),
        allowNull: false,
        unique: true
      },
      sku_code: {
        type: DataTypes.STRING(50),
        allowNull: false
      },
      product_title: {
        type: DataTypes.STRING(100)
      },
      currency: {
        type: DataTypes.STRING(10),
        defaultValue: 'AED'
      },
      is_active: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
      },
      unique_code: {
        type: DataTypes.STRING(100),
        allowNull: false,
        unique: true
      }
    },
    {
      sequelize,
      modelName: 'ErpSku',
      tableName: 'erp_skus',
      timestamps: true,
      underscored: true
    }
  );

  return ErpSku;
};
