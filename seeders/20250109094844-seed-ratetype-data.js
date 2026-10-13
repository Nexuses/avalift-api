'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.bulkInsert('RateTypes', [
      {
        type_category: 'rate_type',
        type_name: 'fixed',
        display_name: 'Fixed',
        duration_hours: null,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        type_category: 'rate_type',
        type_name: 'per_hour',
        display_name: 'Per Hour',
        duration_hours: 1,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        type_category: 'rate_type',
        type_name: 'half_day',
        display_name: 'Half Day',
        duration_hours: 4,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        type_category: 'rate_type',
        type_name: 'per_minute',
        display_name: 'Per Minute',
        duration_hours: null,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        type_category: 'rate_type',
        type_name: 'full_day',
        display_name: 'Full Day',
        duration_hours: 8,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        type_category: 'rate_type',
        type_name: 'rta_test',
        display_name: 'RTA Test',
        duration_hours: null,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        type_category: 'rate_type',
        type_name: 'garage_ride',
        display_name: 'Garage Ride',
        duration_hours: null,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ]);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.bulkDelete('RateTypes', null, {});
  }
};
