'use strict';
module.exports = {
  up: async (queryInterface) => {
    return queryInterface.bulkInsert('Permissions', [
      // Orders Permissions
      { id: 1, name: 'orders.view', value: null },
      { id: 2, name: 'orders.create', value: null },
      { id: 3, name: 'orders.update', value: null },
      { id: 4, name: 'orders.delete', value: null },

      // Users Permissions
      { id: 5, name: 'users.view', value: null },
      { id: 6, name: 'users.create', value: null },
      { id: 7, name: 'users.update', value: null },
      { id: 8, name: 'users.delete', value: null },

      // Drivers Permissions
      { id: 9, name: 'drivers.view', value: null },
      { id: 10, name: 'drivers.manage', value: null }, 

      // Roles Permissions
      { id: 11, name: 'roles.view', value: null },    
      { id: 12, name: 'roles.create', value: null },  
      { id: 13, name: 'roles.update', value: null },
      { id: 14, name: 'roles.delete', value: null },

      // Reports Permissions
      { id: 15, name: 'reports.view', value: null },
      { id: 16, name: 'reports.generate', value: null },


      // Allowed Organization Permissions
      { id: 17, name: 'allowed_organization', value: '*' }, // Access to all orgs
      { id: 18, name: 'allowed_organization', value: '1' },
      { id: 19, name: 'allowed_organization', value: '2' },


      // Additional Feature Permissions
      { id: 20, name: 'driver.management', value: null },
      { id: 21, name: 'customer.management', value: null },
      { id: 22, name: 'chauffeur.management', value: null },
      { id: 23, name: 'price.management', value: null },
      { id: 24, name: 'pd.management', value: null },
      { id: 25, name: 'ride.management', value: null },
      { id: 26, name: 'coupon.management', value: null },
      { id: 27, name: 'cash.management', value: null },
      { id: 28, name: 'vehicle.management', value: null },
      { id: 29, name: 'wallet.management', value: null },
      { id: 30, name: 'revenuereport.management', value: null },
      { id: 31, name: 'dashboard.management', value: null },
      { id: 32, name: 'organization.management', value: null },

      { id: 33, name: 'pd_ride.view', value: null },
      { id: 34, name: 'invoice.view', value: null },
      { id: 35, name: 'invoicereport.view', value: null },
      { id: 36, name: 'customerwallet.view', value: null },
      { id: 37, name: 'chauffeurwallet.view', value: null },
      { id: 38, name: 'pdwallet.view', value: null },
      { id: 39, name: 'adminwallet.view', value: null },

      // Operator-specific (if not already defined)
      { id: 40, name: 'chauffeur.available.view', value: null },
      { id: 41, name: 'ride.cancel', value: null },
      { id: 42, name: 'ride.create', value: null },
      { id: 43, name: 'ride.reassign', value: null },
      { id: 44, name: 'vehicles.create', value: null },
      { id: 45, name: 'vehicles.update', value: null },
      { id: 46, name: 'brand.create', value: null },
      { id: 47, name: 'brand.update', value: null },
      { id: 48, name: 'brand.delete', value: null },
      { id: 49, name: 'vehicles.view', value: null },
      { id: 50, name: 'organizations.view', value: null },
      { id: 51, name: 'organizations.create', value: null },
      { id: 52, name: 'organizations.update', value: null },
      { id: 53, name: 'organizations.createAdmin', value: null },
      { id: 54, name: 'organizations.updateAdmin', value: null },
      { id: 55, name: 'organizations.viewUsers', value: null },
      { id: 56, name: 'organizations.delete', value: null },
      { id: 57, name: 'vehicles.delete', value: null },
      { id: 58, name: 'coupons.create', value: null },
      { id: 59, name: 'coupons.update', value: null },
      { id: 60, name: 'coupons.delete', value: null },
      { id: 61, name: 'coupons.view', value: null },
      { id: 62, name: 'userGroups.create', value: null },
      { id: 63, name: 'userGroups.view', value: null },
      { id: 64, name: 'userGroups.update', value: null },
      { id: 65, name: 'userGroups.delete', value: null },
      { id: 66, name: 'userGroups.addMember', value: null },
      { id: 67, name: 'userGroups.viewMembers', value: null },
      { id: 68, name: 'userGroups.updateMember', value: null },
      { id: 69, name: 'userGroups.removeMember', value: null },
      { id: 70, name: 'locations.create', value: null },
      { id: 71, name: 'locations.view', value: null },
    ], {});
  },

  down: async (queryInterface) => {
    return queryInterface.bulkDelete('Permissions', null, {});
  },
};

