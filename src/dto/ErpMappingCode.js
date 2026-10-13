const { Model, DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  class ErpMappingCode extends Model {
    static associate(models) {
      // Optional future association
      ErpMappingCode.belongsTo(models.User, { foreignKey: 'chauffeur_id', as: 'Chauffeur' });
    }
  }

  ErpMappingCode.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
      },
      chauffeur_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        unique: true,
        references: {
            model: 'Users',
            key: 'id'
        }
    },
      chauffeur_code: {
        type: DataTypes.STRING(10),
        allowNull: false
      },

      chauffeur_name: {
        type: DataTypes.STRING(100),
        allowNull: false
      },
      ac_code_cash: {
        type: DataTypes.STRING(20),
        allowNull: false
      },
      ac_code_online: {
        type: DataTypes.STRING(20),
        allowNull: false
      },
      ac_name_cash: {
        type: DataTypes.STRING(100),
        allowNull: false
      },
      ac_name_online: {
        type: DataTypes.STRING(100),
        allowNull: false
      },
      is_active: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
      }
    },
    {
      sequelize,
      modelName: 'ErpMappingCode',
      tableName: 'erp_mapping_code',
      timestamps: true,
      underscored: true,
      indexes: [
        {
          unique: true,
          fields: ['chauffeur_code', 'chauffeur_id']
        }
      ]
    }
  );

  return ErpMappingCode;
};
