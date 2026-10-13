const { Model, DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  class SavedCards extends Model {
    static associate(models) {
      // Associate SavedCards with User
      SavedCards.belongsTo(models.User, { foreignKey: 'user_id' });
    }
  }

  SavedCards.init(
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      user_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: 'Users', // Name of the table for User
          key: 'id',
        },
      },
      name: {              //name + 4 digits 
        type: DataTypes.STRING,
        allowNull: false,
      },
      logo: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      slug_id: {            //CardRef
        type: DataTypes.STRING,
        allowNull: false,
      },
      is_active: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      status_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 1,
      },
      is_default: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      card_bin: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      card_end: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      pay_method: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      meta_data: {
        type: DataTypes.JSON,
        allowNull: true,
      },
    },
    {
      sequelize,
      modelName: 'SavedCards',
      tableName: 'SavedCards',
      timestamps: true,
      indexes: [
        {
          name: 'saved_cards_user_id_index',
          fields: ['user_id'],
        },
        {
          name: 'user_card_index',
          fields: ['user_id', 'card_bin', 'card_end'],
        },
      ]
    }
  );

  return SavedCards;
};
