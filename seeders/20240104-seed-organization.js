module.exports = {
  up: async (queryInterface) => {
    return queryInterface.bulkInsert('Organizations', [
      {
        id: 1,
        name: 'Avalift',
        address: 'Al Joud Bldg, Office #M26, SZR, Dubai', // need to change
        country_code: '+971', // need to change
        mobile_number: '563900935', // need to change
        email_id: 'contact@avalift.ae',
        is_deleted: false,
      },
    ]);
  },

  down: async (queryInterface) => {
    return queryInterface.bulkDelete('Organizations', {
      id: 1
    }, {});
  }
};