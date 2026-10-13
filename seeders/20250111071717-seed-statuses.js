"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Insert seed data into the "Statuses" table
    await queryInterface.bulkInsert("Statuses", [
      {
        name: "Online", // First status
        createdAt: new Date(), // Automatically set the current timestamp
        updatedAt: new Date(),
      },
      {
        name: "Offline", // Second status
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        name: "Authorised",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        name: "Paid",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        name: "Completed",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        name: "Started",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        name: "Initiated",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        name: "Wallet-Credit",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        name: "Wallet-Debit",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        name: "Cash-Debit",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        name: "Card-Debit",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        name: "Cash-Credit",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        name: "Cash-Adjustment",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        name: "Cancel-Ride-Penalty",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        name: "Pending",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        name: "Cash-Wallet-Adjustment",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        name: "Card-Wallet-Adjustment",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        name: "Card-Verified",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        name: "Review-Pending",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        name: "Payment-Completed",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        name: "Payment-Pending",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        name: "Apple-Pay-Payment-Pending",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        name: "Referral-Payment",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        name: 'Apple-Pay-Payment-Pending',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        name: "Requested",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        name: "On-The-Way",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        name: "Accepted",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        name: "Cancelled",
        createdAt: new Date(),
        updatedAt: new Date(),
      },

    ]);
  },

  down: async (queryInterface, Sequelize) => {
    // Remove all entries in the "Statuses" table
    await queryInterface.bulkDelete("Statuses", {
      name: [
        "Online",
        "Offline",
        "Authorised",
        "Paid",
        "Completed",
        "Started",
        "Initiated",
        "Wallet-Credit",
        "Wallet-Debit",
        "Cash-Debit",
        "Card-Debit",
        "Cash-Credit",
        "Cash-Adjustment",
        "Cancel-Ride-Penalty",
        "Pending",
        "Cash-Wallet-Adjustment",
        "Card-Wallet-Adjustment",
        "Card-Verified",
        "Review-Pending",
        "Payment-Completed",
        "Payment-Pending",
        "Requested",
        "On-The-Way",
        "Accepted",
        "Cancelled",
      ], // Delete only the seeded entries
    });
  },
};
