const { Model, DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    class AdminWalletLog extends Model {
        static associate(models) {
            AdminWalletLog.belongsTo(models.Status, { foreignKey: 'payment_status_id' });
            AdminWalletLog.belongsTo(models.User, { foreignKey: 'user_id' });
            AdminWalletLog.belongsTo(models.AdminWallet, { foreignKey: 'admin_wallet_id' });
        }
    }

    AdminWalletLog.init(
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
            payment_type_id: { //new
                type: DataTypes.INTEGER, //payment types- id (cash, card, pos, wallet - related id)
                allowNull: true,
                references: {
                    model: 'PaymentTypes',
                    key: 'id',
                },
            },
            transaction_type_id: {
                type: DataTypes.INTEGER,  //wallet-credit, wallet-debit, cash-credit,cash-debit, card-debit
                references: {
                    model: 'Statuses',
                    key: 'id',
                },
            },
            ride_id: {
                type: DataTypes.STRING,
                allowNull: true,
            },
            ride_amount: {
                type: DataTypes.DECIMAL(10, 2),
                allowNull: false,
                defaultValue: 0.0,
            },
            adjusted_ride_amount: {
                type: DataTypes.DECIMAL(10, 2),
                allowNull: false,
                defaultValue: 0.0,
            },
            transaction_date: {
                type: DataTypes.DATE,
                allowNull: false,
            },
            amount_paid: {
                type: DataTypes.DECIMAL(10, 2),
                allowNull: true,
            },
            coupon_id: {
                type: DataTypes.ARRAY(DataTypes.INTEGER),
                allowNull: true,
            },
            discount_amount: {
                type: DataTypes.DECIMAL(10, 2),
                allowNull: true,
                defaultValue: 0.0,
            },
            tip_amount: {
                type: DataTypes.DECIMAL(10, 2),
                allowNull: true,
                defaultValue: 0.0,
            },
            has_customer_paid: {
                type: DataTypes.BOOLEAN,  //payment status (0 for verify payment and 1 for sale payment)
                allowNull: true
            },
            payment_status_id: {
                type: DataTypes.INTEGER,
                allowNull: true, //Payment-Completed
                references: {
                    model: 'Statuses',
                    key: 'id',
                },
            },
            base_fare: {
                type: DataTypes.DECIMAL(10, 2),
                allowNull: false,
                defaultValue: 0.0,
            },
            rate_type: {
                type: DataTypes.STRING,
                allowNull: false,
                defaultValue: 'Not found',
            },
            rates: {
                type: DataTypes.DECIMAL(10, 2),
                allowNull: false,
                defaultValue: 0.0,
            },
            mandatory_charges: {
                type: DataTypes.DECIMAL(10, 2),
                allowNull: false,
                defaultValue: 0.0,
            },
            other_charges: {
                type: DataTypes.DECIMAL(10, 2),
                allowNull: false,
                defaultValue: 0.0,
            },
            is_coupon_applied: {
                type: DataTypes.BOOLEAN,
                allowNull: false,
                defaultValue: false
            },
            vat: {
                type: DataTypes.DECIMAL(10, 2),
                allowNull: false,
                defaultValue: 0.0,
            },
            is_invoice_created: {
                type: DataTypes.BOOLEAN,
                allowNull: false,
                defaultValue: false
            },
            ride_minutes: {
                type: DataTypes.INTEGER,
                allowNull: false,
                defaultValue: 0
            },
            // hand_over_user_id: {
            //     type: DataTypes.INTEGER,
            //     allowNull: true,
            //     references: {
            //         model: 'Users',
            //         key: 'id',
            //     },
            // },
            // hand_over_transaction_date: {
            //     type: DataTypes.DATE,
            //     allowNull: true,
            // },
            // hand_over_amount: {
            //     type: DataTypes.DECIMAL(10, 2),
            //     allowNull: true,
            //     defaultValue: 0.0,
            // },
            // outstanding_balance: {
            //     type: DataTypes.DECIMAL(10, 2),
            //     allowNull: true,
            //     defaultValue: 0.0,
            // },
            admin_wallet_id: {
                type: DataTypes.INTEGER,
                allowNull: true, //link to admin wallet
                references: {
                    model: 'AdminWallets',
                    key: 'id',
                },
            },
            total_after_discount: {
                type: DataTypes.DECIMAL(10, 2),
                allowNull: false,
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
            modelName: 'AdminWalletLog',
            tableName: 'AdminWalletLogs',
            timestamps: true,
            indexes: [
                {
                    name: 'admin_wallet_log_user_id_index',
                    fields: ['user_id'],
                },
                {
                    name: 'admin_wallet_log_payment_status_id_index',
                    fields: ['payment_status_id'],
                },
                {
                    name: 'admin_wallet_log_ride_id_index',
                    fields: ['ride_id'],
                },
            ],
        }
    );

    return AdminWalletLog;
};
