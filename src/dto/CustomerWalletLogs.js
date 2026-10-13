const { model } = require('mongoose');
const { Model, DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    class CustomerWalletLog extends Model {
        static associate(models) {
            // Associate UserPayment with User
            CustomerWalletLog.belongsTo(models.User, { foreignKey: 'user_id' });
            CustomerWalletLog.belongsTo(models.PaymentType, { foreignKey: 'payment_type_id' });
            CustomerWalletLog.belongsTo(models.Status, { foreignKey: 'transaction_type_id' });
            //CustomerWalletLog.belongsTo(models.Status, { foreignKey: 'payment_status_id' });
            CustomerWalletLog.belongsTo(models.CustomerWallet, { foreignKey: 'customer_wallet_id' });
        }
    }

    CustomerWalletLog.init(
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
            top_up_amount: {
                type: DataTypes.DECIMAL(10, 2),
                allowNull: false,
                defaultValue: 0.0,
            },
            wallet_balance: {
                type: DataTypes.DECIMAL(10, 2),
                allowNull: false,
                defaultValue: 0.0,
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
            transaction_reference: {
                type: DataTypes.STRING,
                allowNull: true,
            },
            amount_to_be_paid: {
                type: DataTypes.DECIMAL(10, 2),
                allowNull: true,
            },
            coupon_id: {
                type: DataTypes.ARRAY(DataTypes.INTEGER),
                allowNull: true,
            },
            invoice_id: {
                type: DataTypes.STRING, // transaction
                allowNull: true,
                unique: false,
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
            chauffeur_id: {
                type: DataTypes.STRING,
                allowNull: true,
            },
            is_paid: {
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
            customer_wallet_id: {
                type: DataTypes.INTEGER,
                allowNull: true, //link to customer wallet
                references: {
                    model: 'CustomerWallets',
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
                defaultValue: "not provided",
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
            total_after_discount: {
                type: DataTypes.DECIMAL(10, 2),
                allowNull: false,
                defaultValue: 0.0,
            },
            cancelation_charges: {
                type: DataTypes.DECIMAL(10, 2),
                allowNull: false,
                defaultValue: 0.0,
            },
            admin_id: {
                type: DataTypes.INTEGER,
                allowNull: true,
                references: {
                    model: 'Users',
                    key: 'id',
                },
            },
            is_zeizzu_org: {
                type: DataTypes.BOOLEAN,
                allowNull: true,
                defaultValue: false
            },
            meta_data: {
                type: DataTypes.JSON,
                allowNull: true,
            },
            final_price_calculation: {
                type: DataTypes.JSON, // user_id
                allowNull: true,
            },
        },
        {
            sequelize,
            modelName: 'CustomerWalletLog',
            tableName: 'CustomerWalletLogs',
            timestamps: true,
            indexes: [
                {
                    name: 'customer_wallet_log_user_id_index',
                    fields: ['user_id'],
                },
                {
                    name: 'customer_wallet_log_ride_id_index',
                    fields: ['ride_id'],
                },
                {
                    name: 'customer_wallet_log_transaction_type_id_index',
                    fields: ['transaction_type_id'],
                },
                {
                    name: 'customer_wallet_log_transaction_date_index',
                    fields: ['transaction_date'],
                },
                {
                    name: 'customer_wallet_log_coupon_id_index',
                    fields: ['coupon_id'],
                },
                {
                    name: 'customer_wallet_log_payment_status_id_index',
                    fields: ['payment_status_id'],
                },
                {
                    name: 'customer_wallet_log_chauffeur_id_index',
                    fields: ['chauffeur_id'],
                },
                {
                    name: 'customer_wallet_log_payment_type_id_index',
                    fields: ['payment_type_id'],
                },
                {
                    name: 'customer_wallet_unique_id',
                    unique: true,
                    fields: ['user_id', 'ride_id', 'createdAt']
                },
            ],
        }
    );

    return CustomerWalletLog;
};
