"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const now = new Date();

    // Define the updated and new roles
    const roles = [
      {
        id: 5,
        name: "admin.zeizzu.super",
        policies: [1, 2, 3, 4, 5, 9, 12, 13, 14, 15, 16, 17, 18],
        display_name: "Super Admin",
      },
      {
        id: 6,
        name: "admin.zeizzu.normal",
        policies: [1, 2, 3, 4, 5, 10, 12, 13, 14, 15, 16, 17, 18],
        display_name: "Admin",
      },
      {
        id: 9,
        name: "admin.zeizzu.accountant",
        policies: [19],
        display_name: "Accountant",
      },
      {
        id: 10,
        name: "admin.zeizzu.operator",
        policies: [20],
        display_name: "Operator",
      },
    ];

    for (const role of roles) {
      const [existing] = await queryInterface.sequelize.query(
        `SELECT id FROM "Roles" WHERE id = :id`,
        {
          replacements: { id: role.id },
          type: Sequelize.QueryTypes.SELECT,
        }
      );

      if (existing) {
        // Update if exists
        await queryInterface.bulkUpdate(
          "Roles",
          {
            name: role.name,
            policies: role.policies,
            display_name: role.display_name,
            //updatedAt: now,
          },
          { id: role.id }
        );
      } else {
        // Insert if not exists
        await queryInterface.bulkInsert("Roles", [
          {
            id: role.id,
            name: role.name,
            policies: role.policies,
            display_name: role.display_name,
            //createdAt: now,
            //updatedAt: now,
          },
        ]);
      }
    }
  },

  down: async () => {
    // Do nothing or add reversible logic only if needed
    return Promise.resolve();
  },
};
