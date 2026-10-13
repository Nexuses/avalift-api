'use strict';

module.exports = {
  up: async (queryInterface) => {
    return queryInterface.bulkInsert('Policies', [
      // Orders Management Policy
      {
        id: 1,
        name: 'orders_management',
        permissions: [1, 2, 3, 4, 25], // orders.view, orders.create, orders.update, orders.delete, orders.export
      },

      // Users Management Policy
      {
        id: 2,
        name: 'users_management',
        permissions: [5, 6, 7, 8, 21, 24], // users.view, users.create, users.update, users.delete, users.assign_org, users.export
      },

      // Drivers Management Policy
      {
        id: 3,
        name: 'drivers_management',
        permissions: [9, 10, 22, 70 , 71], // drivers.view, drivers.manage, drivers.audit
      
      },

      // Roles Management Policy
      {
        id: 4,
        name: 'roles_management',
        permissions: [11, 12, 13, 14], // roles.view, roles.create, roles.update, roles.delete
      },

      // Reports Management Policy
      {
        id: 5,
        name: 'reports_management',
        permissions: [15, 16, 30], // reports.view, reports.generate, reports.export
       
      },

      // Limited Admin Policy (Excluding certain permissions)
      {
        id: 6,
        name: 'limited_admin',
        permissions: [1, 2, 3, 4, 5, 7, 8, 9, 10, 11, 13, 14, 15, 16,] // Excludes users.create (6) and roles.create (12)
        
      },

      // Customer Access Policy
      {
        id: 7,
        name: 'customer_access',
        permissions: [1, 2, 5, 3, 8, 49,7, 57,44,45,61], // orders.view, orders.create, users.view
      },

      // Driver Access Policy
      {
        id: 8,
        name: 'driver_access',
        permissions: [7,10,9,5,3, 70, 71, 49], // drivers.view, drivers.manage
      },

      // Organization Specific Access Policies
      {
        id: 9,
        name: 'organization_specific_access_all',
        permissions: [17], // allowed_organization with value '*'
      },
      {
        id: 10,
        name: 'organization_specific_access_org1',
        permissions: [18], // allowed_organization with value '1'
      },
      {
        id: 11,
        name: 'organization_specific_access_org2',
        permissions: [19], // allowed_organization with value '2'
      },

      // Price Management Policy
      {
        id: 12,
        name: 'price_management',
        permissions: [23], // pricing.manage
      },

      // Coupon Management Policy
      {
        id: 13,
        name: 'coupon_management',
        permissions: [26, 58, 59, 60, 61, 62, 63, 63, 65, 66, 67, 68, 69], // coupon.manage
      },
      // Cash Management Policy
      {
        id: 14,
        name: 'cash_management',
        permissions: [27], // cashbox.manage
      },

      // Vehicle Management Policy
      {
        id: 15,
        name: 'vehicle_management',
        permissions: [28, 44, 45, 49, 57], // vehicle.manage
      },

      // Wallet Management Policy
      {
        id: 16,
        name: 'wallet_management',
        permissions: [29], // wallet.manage
      },

      // Dashboard Management Policy
      {
        id: 17,
        name: 'dashboard_management',
        permissions: [31], // dashboard.access
      },

      // Organization Management Policy
      {
        id: 18,
        name: 'organization_management',
        permissions: [32, 50, 51, 52, 53, 54, 55, 56], // organization.manage
      },
      // Accountant Policy
      {
        id: 19,
        name: 'accountant_access',
        permissions: [1, 2, 5, 9, 15, 16, 18, 34, 35, 36, 37, 38, 39, 50, ],
      },

      // Operator Policy
      {
        id: 20,
        name: 'operator_access',
        permissions: [
          1, 2, 3, 5, 6, 7, 8, 9, 10, 11, 18, 40, 41, 42, 43, 44, 45,
          46, 47, 48, 49, 50, 51, 53, 54, 55, 58, 59, 61, 62, 63, 64,
          65, 66, 67, 68, 69, 71, 24
        ],
      }
      

    ], {});
  },

  down: async (queryInterface) => {
    return queryInterface.bulkDelete('Policies', null, {});
  },
};






