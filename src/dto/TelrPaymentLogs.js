const { Model, DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    class TelrPaymentLogs extends Model {
        static associate(models) {
            TelrPaymentLogs.belongsTo(models.User, { foreignKey: 'user_id' });
        }
    }

    TelrPaymentLogs.init(
        {
            id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true,
            },
            request_meta_data: {
                type: DataTypes.JSON, // user_id
                allowNull: true,
            },
            response_meta_data: {
                type: DataTypes.JSON, // user_id
                allowNull: true,
            },
            user_id: {
                type: DataTypes.INTEGER,
                allowNull: false,
                references: {
                    model: 'Users',
                    key: 'id',
                },
            },
            payment_type: {
                type: DataTypes.STRING(50),
                allowNull: true
            },
            transaction_type: {
                type: DataTypes.STRING(50),
                allowNull: true
            },
            ride_id: {
                type: DataTypes.STRING(50),
                allowNull: true
            }
        },
        {
            sequelize,
            modelName: 'TelrPaymentLogs',
            tableName: 'TelrPaymentLogs',
            timestamps: true,
            indexes: [
                {
                    fields: ['user_id'],
                    name: 'TelrPaymentLogs_user_id_index',
                },
                {
                    name: 'TelrPaymentLogs_unique_id',
                    unique: true,
                    fields: ['user_id', 'createdAt']
                }
            ],
        }
    );

    return TelrPaymentLogs;
};
