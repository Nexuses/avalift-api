'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // 1. Fetch all chauffeurs (role_id = 3)
    const chauffeurs = await queryInterface.sequelize.query(
      `SELECT id FROM "Users" WHERE role_id = 4 AND is_active = true`,
      { type: Sequelize.QueryTypes.SELECT }
    );

    if (!chauffeurs.length) {
      console.log('No chauffeurs found. Skipping wallet creation.');
      return;
    }

    const walletsToInsert = chauffeurs.map((c) => ({
      chauffeur_id: c.id,
      balance: 0.0,
      createdAt: new Date(),
      updatedAt: new Date(),
    }));

    // 2. Insert wallet row for each chauffeur
    await queryInterface.bulkInsert('ChauffeurTipWallet', walletsToInsert);
  },

  async down(queryInterface, Sequelize) {
    // Remove created wallets
    await queryInterface.sequelize.query(
      `DELETE FROM "ChauffeurTipWallet" 
       WHERE chauffeur_id IN (SELECT id FROM "Users" WHERE role_id = 4)`
    );
  }
};
