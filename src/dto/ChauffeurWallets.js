const { Model, DataTypes } = require('sequelize');
const { Sequelize } = require('.');

module.exports = (sequelize) => {
    class ChauffeurWallet extends Model {
        static associate(models) {
            // Associate UserWallet with User
            ChauffeurWallet.belongsTo(models.User, { foreignKey: 'user_id', as: "User" });
            ChauffeurWallet.belongsTo(models.User, { foreignKey: 'hand_over_user_id', as: "Hand-Over-User" });
        }
    }

    ChauffeurWallet.init(
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
            modelName: 'ChauffeurWallet',
            tableName: 'ChauffeurWallets',
            timestamps: true,
            indexes: [
                {
                    name: 'chauffeur_wallet_user_id_index',
                    fields: ['user_id'],
                },
                {
                    name: 'chauffeur_wallet_transaction_date_index',
                    fields: ['transaction_date'],
                },
                {
                    name: 'chauffeur_wallet_unique_id',
                    unique: true,
                    fields: ['user_id', 'transaction_date']
                }
            ],
        }
    );

    return ChauffeurWallet;
};
