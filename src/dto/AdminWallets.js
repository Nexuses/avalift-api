const { Model, DataTypes } = require('sequelize');
const { Sequelize } = require('.');

module.exports = (sequelize) => {
    class AdminWallet extends Model {
        static associate(models) {
            // Associate UserWallet with User
            AdminWallet.belongsTo(models.User, { foreignKey: 'user_id' });
        }
    }

    AdminWallet.init(
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
            wallet_balance: {
                type: DataTypes.DECIMAL(10, 2),
                allowNull: false,
                defaultValue: 0.0,
            },
            transaction_date: {
                type: DataTypes.DATE,
                allowNull: false,
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
            modelName: 'AdminWallet',
            tableName: 'AdminWallets',
            timestamps: true,
            indexes: [
                {
                    name: 'admin_wallet_user_id_index',
                    fields: ['user_id'],
                },
                {
                    name: 'admin_wallet_transaction_date_index_n',
                    fields: ['transaction_date'],
                },
                {
                    name: 'admin_wallet_unique_id',
                    fields: ['user_id', 'transaction_date'],
                }

            ],
        }
    );

    return AdminWallet;
};
