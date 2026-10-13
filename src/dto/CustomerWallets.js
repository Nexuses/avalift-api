const { Model, DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    class CustomerWallet extends Model {
        static associate(models) {
            // Associate UserWallet with User
            CustomerWallet.belongsTo(models.User, { foreignKey: 'user_id' });
        }
    }

    CustomerWallet.init(
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
            is_org: {
                type: DataTypes.BOOLEAN,
                allowNull: false,
                defaultValue: false
            }
        },
        {
            sequelize,
            modelName: 'CustomerWallet',
            tableName: 'CustomerWallets',
            timestamps: true,
            indexes: [
                {
                    name: 'customer_wallet_user_id_index',
                    fields: ['user_id'],
                    unique: true,
                },
            ],
        }
    );

    return CustomerWallet;
};
