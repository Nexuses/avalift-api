'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.bulkInsert(
      'erp_skus',
      [
        {
          id: Sequelize.literal('gen_random_uuid()'),
          service_type: 'per_min',
          sku_code: 'I0000001EAC',
          product_title: 'PAY PER MINUTE',
          currency: 'AED',
          unique_code: 'I0000001',
          is_active: true,
          created_at: new Date(),
          updated_at: new Date()
        },
        {
          id: Sequelize.literal('gen_random_uuid()'),
          service_type: 'per_hour',
          sku_code: 'I0000002EAC',
          product_title: 'HOURLY',
          currency: 'AED',
          unique_code: 'I0000002',
          is_active: true,
          created_at: new Date(),
          updated_at: new Date()
        },
        {
          id: Sequelize.literal('gen_random_uuid()'),
          service_type: 'full_day',
          sku_code: 'I0000003EAC',
          product_title: 'DAILY',
          currency: 'AED',
          unique_code: 'I0000003',
          is_active: true,
          created_at: new Date(),
          updated_at: new Date()
        },
        {
          id: Sequelize.literal('gen_random_uuid()'),
          service_type: 'rta_test',
          sku_code: 'I0000009EAC',
          product_title: 'RTA Passing',
          currency: 'AED',
          unique_code: 'I0000009',
          is_active: true,
          created_at: new Date(),
          updated_at: new Date()
        },        
        {
          id: Sequelize.literal('gen_random_uuid()'),
          service_type: 'garage_ride',
          sku_code: 'I0000012EAC',
          product_title: 'GARAGE RIDE',
          currency: 'AED',
          unique_code: 'I0000012',
          is_active: true,
          created_at: new Date(),
          updated_at: new Date()
        },
        {
          id: Sequelize.literal('gen_random_uuid()'),
          service_type: 'half_day',
          sku_code: 'I0000014EAC',
          product_title: 'HALF DAY',
          currency: 'AED',
          unique_code: 'I0000014',
          is_active: true,
          created_at: new Date(),
          updated_at: new Date()
        },
        {
          id: Sequelize.literal('gen_random_uuid()'),
          service_type: 'cancelation_fee',
          sku_code: 'I0000007EAC',
          product_title: 'Ride Cancellation Charge',
          currency: 'AED',
          unique_code: 'I0000007',
          is_active: true,
          created_at: new Date(),
          updated_at: new Date()
        },
        {
          id: Sequelize.literal('gen_random_uuid()'),
          service_type: 'tip',
          sku_code: 'I0000015EAC',
          product_title: 'Tip',
          currency: 'AED',
          unique_code: 'I0000015',
          is_active: true,
          created_at: new Date(),
          updated_at: new Date()
        }
      ],
      {
        ignoreDuplicates: true // IMPORTANT
      }
    );
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete(
      'erp_skus',
      {
        service_type: [
          'PAY_PER_MINUTE',
          'PAY_PER_KM',
          'WAITING_CHARGE'
        ]
      }
    );
  }
};
