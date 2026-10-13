'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Define the types to be inserted
    const types = [
      {
        type: 'db',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        type: 'sso',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        type: 'per_km',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        type: 'per_hour',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    // Insert the types into the 'Types' table
    return queryInterface.bulkInsert('Types', types, {});
  },

  down: async (queryInterface, Sequelize) => {
    // Delete all entries from the 'Types' table
    return queryInterface.bulkDelete('Types', null, {});
  },
};
