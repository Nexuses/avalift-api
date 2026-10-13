'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.bulkInsert('UserPlates', [
      {
        emirate_name: "Abu Dhabi",
        start_code_type: "numeric",
        starting_plate_code: "1",
        ending_plate_code: "50",
        number_of_digits: 5,
        region_url: "https://brandlogos.net/wp-content/uploads/2017/03/abu-dhabi-logo.png",
      },
      {
        emirate_name: "Ajman",
        start_code_type: "alpha",
        starting_plate_code: "A",
        ending_plate_code: "Z",
        number_of_digits: 5,
        region_url: "https://images.all-free-download.com/images/graphiclarge/ajman_new_logo_title_free_vector_6823186.jpg",
      },
      {
        emirate_name: "Dubai",
        start_code_type: "double_alpha",
        starting_plate_code: "A",
        ending_plate_code: "ZZ",
        number_of_digits: 5,
        region_url: "https://inspirationalgeek.wordpress.com/wp-content/uploads/2015/09/dubai-logo1.jpg",
      },
      {
        emirate_name: "Fujairah",
        start_code_type: "alpha",
        starting_plate_code: "A",
        ending_plate_code: "Z",
        number_of_digits: 5,
        region_url: "https://cdn.textstudio.com/output/sample/normal/2/7/8/0/fujairah-logo-73-10872.webp",
      },
      {
        emirate_name: "Ras Al Khaimah",
        start_code_type: "alpha",
        starting_plate_code: "A",
        ending_plate_code: "Z",
        number_of_digits: 5,
        region_url: "https://cdn.vectorstock.com/i/2000v/31/53/gold-silhouette-of-ras-al-khaimah-on-black-vector-14593153.avif",
      },
      {
        emirate_name: "Sharjah",
        start_code_type: "numeric",
        starting_plate_code: "1",
        ending_plate_code: "50",
        number_of_digits: 5,
        region_url: "https://content.presspage.com/uploads/616/1920_sharjahlogonotofficial.jpg",
      },
      {
        emirate_name: "Umm Al Quwain",
        start_code_type: "alpha",
        starting_plate_code: "A",
        ending_plate_code: "Z",
        number_of_digits: 5,
        region_url: "https://as2.ftcdn.net/v2/jpg/11/21/10/97/1000_F_1121109768_aaZv0v3BByUUp1QCdYBgST0prPt7I6Uj.jpg",
      },
      {
        emirate_name: "Others",
        start_code_type: "custom",
        starting_plate_code: "Any",
        ending_plate_code: "Any",
        number_of_digits: 5,
        region_url: "Blank",
      },
    ]);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete('UserPlates', null, {});
  }
};
