const { model } = require('mongoose');
const { Model, DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    class ChauffeurWalletLog extends Model {
        static associate(models) {
            //ChauffeurWalletLog.belongsTo(models.Status, { foreignKey: 'payment_status_id' });
            ChauffeurWalletLog.belongsTo(models.User, { foreignKey: 'user_id', as: "User" });
            ChauffeurWalletLog.belongsTo(models.ChauffeurWallet, { foreignKey: 'chauffeur_wallet_id' });
            ChauffeurWalletLog.belongsTo(models.User, { foreignKey: 'pd_user_id', as: "PD-User" });
        }
    }

    ChauffeurWalletLog.init(
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
            pd_user_id: {
                type: DataTypes.INTEGER,
                allowNull: true,
                references: {
                    model: 'Users',
                    key: 'id',
                },
            },
            pd_transaction_date: {
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
            modelName: 'ChauffeurWalletLog',
            tableName: 'ChauffeurWalletLogs',
            timestamps: true,
            indexes: [
                {
                    name: 'chauffeur_wallet_log_user_id_index',
                    fields: ['user_id'],
                },
                {
                    name: 'chauffeur_wallet_log_pd_user_id_index',
                    fields: ['pd_user_id'],
                },
            ],
        }
    );

    return ChauffeurWalletLog;
};
