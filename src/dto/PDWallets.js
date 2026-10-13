const { Model, DataTypes } = require('sequelize');
const { Sequelize } = require('.');

module.exports = (sequelize) => {
    class PDWallet extends Model {
        static associate(models) {
            // Associate UserWallet with User
            PDWallet.belongsTo(models.User, { foreignKey: 'user_id' });
            PDWallet.belongsTo(models.User, { foreignKey: 'hand_over_user_id', as: "Hand-Over-User" });
        }
    }

    PDWallet.init(
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
                    model: 'Users',
                    key: 'id',
                },
                unique: true,
            },
            transaction_date: {
                type: DataTypes.DATEONLY,
                allowNull: false,
            },
            wallet_balance: {
                type: DataTypes.DECIMAL(10, 2),
                allowNull: false,
                defaultValue: 0.0,
            },
            hand_over_user_id: {
                type: DataTypes.INTEGER,
                allowNull: true,
                references: {
                    model: 'Users',
                    key: 'id',
                },
            },
            hand_over_amount: {
                type: DataTypes.DECIMAL(10, 2),
                allowNull: true,
                defaultValue: 0.0,
            },
            hand_over_transaction_date: {
                type: DataTypes.DATE,
                allowNull: true,
            },
        },
        {
            sequelize,
            modelName: 'PDWallet',
            tableName: 'PDWallets',
            timestamps: true,
            indexes: [
                {
                    name: 'pd_wallet_user_id_index',
                    fields: ['user_id'],
                },
                {
                    name: 'pd_wallet_transaction_date_index',
                    fields: ['transaction_date'],
                },
                {
                    name: 'pd_wallet_unique_id',
                    unique: true,
                    fields: ['user_id', 'transaction_date']
                }
            ],
        }
    );

    return PDWallet;
};
