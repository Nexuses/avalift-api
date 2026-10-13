"use strict";

module.exports = {
  up: async (queryInterface) => {
    return queryInterface.bulkInsert(
      "Roles",
      [
        {
          id: 1,
          name: "individual",
          policies: [7, 10, 15],
          display_name: null,
        },
        {
          id: 2,
          name: "corporate",
          policies: [7, 10],
          display_name: null,
        },
        {
          id: 3,
          name: "pd",
          policies: [8, 10],
          display_name: null,
        },
        {
          id: 4,
          name: "chauffeur",
          policies: [8, 10],
          display_name: null,
        },
        {
          id: 5,
          name: "admin.zeizzu.super",
          policies: [1, 2, 3, 4, 5, 9, 12, 13, 14, 15, 16, 17, 18],
          display_name: "Super Admin",
        },
        {
          id: 6,
          name: "admin.zeizzu.normal",
          policies: [1, 2, 3, 4, 5, 9, 10, 12, 13, 14, 15, 16, 17, 18],
          display_name: "Admin",
        },
        {
          id: 7,
          name: "org1_user",
          policies: [7, 10],
          display_name: null,
        },
        {
          id: 8,
          name: "org2_user",
          policies: [7, 11],
          display_name: null,
        },
        {
          id: 9,
          name: "admin.zeizzu.accountant",
          policies: [19, 9],
          display_name: "Accountant",
        },
        {
          id: 10,
          name: "admin.zeizzu.operator",
          policies: [20, 9],
          display_name: "Operator",
        },
        // Add more roles as needed
      ],
      {}
    );
  },

  down: async (queryInterface, Sequelize) => {
    return queryInterface.bulkDelete(
      "Roles",
      {
        id: { [Sequelize.Op.in]: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] },
      },
      {}
    );
  }
}  
