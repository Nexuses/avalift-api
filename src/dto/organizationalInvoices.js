const { Model, DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  class OrganizationInvoice extends Model {
    static associate(models) {
      // Link OrganizationInvoice to Organization
      OrganizationInvoice.belongsTo(models.Organization, {
        foreignKey: "organization_id",
        as: "organization",
      });
    }
  }

  OrganizationInvoice.init(
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      invoice_number: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true, // Ensure unique invoice numbers
      },
      organization_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: "Organizations", // Ensure Organizations table exists
          key: "id",
        },
      },
      organization_name:{
        type:DataTypes.STRING,
        allowNull:false
      },
      invoice_date: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW, // Auto set to current timestamp
      },
      start_date: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      end_date: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      total_amount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
      },
      amount_paid: {
        type: DataTypes.DECIMAL(10, 2),
        defaultValue: 0.0,
      },
      is_paid: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },
      invoice_file: {
        type: DataTypes.STRING, // Store the file path or URL
        allowNull: false,
      },
      ride_ids: {
        type: DataTypes.ARRAY(DataTypes.STRING), // Store ride IDs as an array
        allowNull: false,
        defaultValue: [],
      },
    },
    {
      sequelize,
      modelName: "OrganizationInvoice",
      tableName: "OrganizationInvoices",
      timestamps: true, // Enables createdAt and updatedAt
    }
  );

  return OrganizationInvoice;
};
