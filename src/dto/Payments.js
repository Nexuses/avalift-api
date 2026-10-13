const { Model, DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  class Payments extends Model {
    static associate(models) {
      // Associate Payments with Order
      Payments.belongsTo(models.User, { foreignKey: 'user_id' });
      Payments.belongsTo(models.PaymentType, { foreignKey: 'payment_type_id' });
      Payments.belongsTo(models.Status, { foreignKey: 'payment_status_id' });
    }
  }

  Payments.init(
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      payment_type_id: { //new
        type: DataTypes.INTEGER, //payment types- id (cash, card, pos, wallet - related id)
        allowNull: true,
        references: {
          model: 'PaymentTypes',
          key: 'id',
        },
      },
      method: {  //new
        type: DataTypes.STRING, //create - telr payment method 
        allowNull: true,
      },
      currency: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      amount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0.0,
      },
      cust_ref: {
        type: DataTypes.STRING,
        allowNull: false
      },
      cart_id_ref: {
        type: DataTypes.INTEGER,
        allowNull: false
      },
      description: {
        type: DataTypes.TEXT, // Description of the payment
        allowNull: true,
      },
      order_ref: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      order_url: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      is_paid: { //--
        type: DataTypes.BOOLEAN,  //payment status (0 for verify payment and 1 for sale payment)
        allowNull: false
      },
      invoice_id: {
        type: DataTypes.STRING, // transaction
        allowNull: true,
        unique: false,
      },
      outstanding_amt: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
        defaultValue: 0.0,
      },
      meta_data: {
        type: DataTypes.JSON, // user_id
        allowNull: true,
      },
      status_id: {
        type: DataTypes.INTEGER,   //telr payment status
        references: {
          model: 'Statuses',
          key: 'id',
        },
      },
      user_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: 'Users',
          key: 'id',
        },
      },
      transaction_ref: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      ride_id: {
        type: DataTypes.STRING,
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
      amount_to_be_paid: {
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
      payment_status_id: {
        type: DataTypes.INTEGER,
        allowNull: true, //Card-Verified, Payment-Completed
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
        allowNull: false
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
      admin_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
          model: 'Users',
          key: 'id',
        },
      },
      final_price_calculation: {
        type: DataTypes.JSON, // user_id
        allowNull: true,
      },
    },
    {
      sequelize,
      modelName: 'Payments',
      tableName: 'Payments', // Adjust table name as needed
      timestamps: true,
      indexes: [
        {
          fields: ['user_id'],
          name: 'payments_user_id_index',
        },
        {
          fields: ['ride_id'],
          name: 'payments_ride_id_index',
        },
        {
          fields: ['chauffeur_id'],
          name: 'payments_chauffeur_id_index',
        },
        {
          fields: ['payment_status_id'],
          name: 'payments_payment_status_id_index',
        },
        {
          fields: ['payment_type_id'],
          name: 'payments_payment_type_id_index',
        },
        {
          name: 'payment_unique_id',
          unique: true,
          fields: ['user_id', 'ride_id', 'createdAt']
        }
      ],
    }
  );

  return Payments;
};
