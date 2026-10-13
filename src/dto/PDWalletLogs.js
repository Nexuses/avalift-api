const { Model, DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    class PDWalletLog extends Model {
        static associate(models) {
            PDWalletLog.belongsTo(models.User, { foreignKey: 'user_id', as: "User" });
            PDWalletLog.belongsTo(models.User, { foreignKey: 'hand_over_user_id', as: "Hand-Over-User" });
        }
    }

    PDWalletLog.init(
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
            },
            hand_over_user_id: {
                type: DataTypes.INTEGER,
                allowNull: true,
                references: {
                    model: 'Users',
                    key: 'id',
                },
            },
            hand_over_transaction_date: {
                type: DataTypes.DATE,
                allowNull: true,
            },
            hand_over_amount: {
                type: DataTypes.DECIMAL(10, 2),
                allowNull: true,
                defaultValue: 0.0,
            },
            has_handed_over: {
                type: DataTypes.BOOLEAN,
                allowNull: false,
                defaultValue: false
            }
        },
        {
            sequelize,
            modelName: 'PDWalletLog',
            tableName: 'PDWalletLogs',
            timestamps: true,
            indexes: [
                {
                    name: 'pd_wallet_log_user_id_index',
                    fields: ['user_id'],
                },
                {
                    name: 'pd_wallet_log_hand_over_user_id_index',
                    fields: ['user_id'],
                },
            ],
        }
    );

    return PDWalletLog;
};
