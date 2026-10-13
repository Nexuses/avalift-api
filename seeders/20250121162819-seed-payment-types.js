'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    //data for Payment Types used for display on UI and for backend process
    const rowsToInsert = [
      { name: 'Cash', for_display: true, createdAt: new Date(), updatedAt: new Date() },
      { name: 'Wallet-Topup', for_display: false, createdAt: new Date(), updatedAt: new Date() },
      { name: 'Wallet-Payment', for_display: false, createdAt: new Date(), updatedAt: new Date() },
      { name: 'Card-Verify', for_display: false, createdAt: new Date(), updatedAt: new Date() },
      { name: 'Card-Sale', for_display: false, createdAt: new Date(), updatedAt: new Date() },
      { name: 'POS', for_display: true, createdAt: new Date(), updatedAt: new Date() },
      { name: 'Card', for_display: true, createdAt: new Date(), updatedAt: new Date() },
      { name: 'Wallet', for_display: true, createdAt: new Date(), updatedAt: new Date() },
      { name: 'Wallet-Corporate-Payment', for_display: false, createdAt: new Date(), updatedAt: new Date() },
      { name: 'Apple Pay', for_display: true, createdAt: new Date(), updatedAt: new Date() },
    ];

    const existingPaymentTypes = await queryInterface.sequelize.query(
      `SELECT name from "PaymentTypes" WHERE name IN (:values)`,
      {
        type: Sequelize.QueryTypes.SELECT,
        replacements: { values: rowsToInsert.map((rec) => rec.name) },
      }
    );

    //get existing row value
    const existingRow = existingPaymentTypes.map((rec) => rec.name);

    //filter out records
    const newRows = rowsToInsert.filter((rec) => !existingRow.includes(rec.name))

    if (newRows.length > 0) {
      await queryInterface.bulkInsert('PaymentTypes', newRows.map((rec) => ({
        ...rec
      })))
    }
  },

  down: async (queryInterface, Sequelize) => {
    // Remove all roles
    const values = ['Cash', 'Wallet-Topup', 'Wallet-Payment', 'Card-Verify', 'Card-Sale', 'POS', 'Card', 'Wallet'];
    return queryInterface.bulkDelete('PaymentTypes', { name: { [Sequelize.Op.in]: values }, });
  }
};
