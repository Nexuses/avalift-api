'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.bulkInsert('BankDetails', [
      {
        account_number: '0353596624001',
        bank_name: 'RAK Bank',
        iban: 'AE350400000353596624001',
        branch_name: 'Al Quoz',
        default: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      }
    ]);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete('BankDetails', null, {});
  },
};
