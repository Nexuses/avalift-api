'use strict';
const bcrypt = require('bcryptjs');

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Hash passwords
    const hashedPassword1 = await bcrypt.hash('Admin@avalift', 10);
    //const hashedPassword2 = await bcrypt.hash('password456', 10);

    // Insert user data
    await queryInterface.bulkInsert('Users', [
      {
        country_code: '+1',
        mobile_number: '1234567890',
        email_id: 'adminuser@avalift.com',
        first_name: 'Admin',
        last_name: 'User',
        password: hashedPassword1,
        type_id: 1,
        role_id: 5,
        status_id: 1,
        is_active: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ], {});
  },

  down: async (queryInterface, Sequelize) => {
    // Remove seeded data
    await queryInterface.bulkDelete('Users', {
      email_id: { [Sequelize.Op.in]: ['adminuser@zeizzu.com'] }
    }, {});
  }
};
