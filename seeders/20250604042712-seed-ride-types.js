'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.bulkInsert('RideTypes', [
      {
        ride_type: 'instant',
        ride_type_display: 'INSTANT',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        ride_type: 'scheduled',
        ride_type_display: 'SCHEDULED',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        ride_type: 'rta_test',
        ride_type_display: 'RTA_TEST',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        ride_type: 'garage_ride',
        ride_type_display: 'GARAGE_RIDE',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.bulkDelete('RideTypes', {
      ride_type: ['instant', 'scheduled', 'rta_test', 'garage_ride']
    });
  }
};