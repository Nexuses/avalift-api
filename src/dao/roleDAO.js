const { Role,Policy } = require('../dto');
const { Op } = require('sequelize');
const { addServerLog } = require("../services/serverLogsService");  

module.exports = {
  findByName: async (name) => {
    try {
      return await Role.findOne({ where: { name } });
    } catch (error) {
      await addServerLog({
        log_level: "ERROR",
        service_name: "findByName",
        error_message: `findByName DAO error - ${error.message}.`
      });
      throw error;
    }
  },

  findById: async (id) => {
    try {
      return await Role.findByPk(id);
    } catch (error) {
      await addServerLog({
        log_level: "ERROR",
        service_name: "findById",
        error_message: `findById DAO error - ${error.message}.`
      });
      throw error;
    }
  },

  createRole: async ({ name, policies }) => {
    try {
      return await Role.create({ name, policies });
    } catch (error) {
      await addServerLog({
        log_level: "ERROR",
        service_name: "createRole",
        error_message: `createRole DAO error - ${error.message}.`
      });
      throw error;
    }
  },

  findAdminRoles: async () => {
    try {
      // Find all roles where name starts with 'admin' and contains 'ziezzu'
      const adminRoles = await Role.findAll({
        where: {
          // name: {
          //   [Op.and]: [
          //     { [Op.like]: 'admin%' },
          //     { [Op.like]: '%ziezzu%' }
          //   ]}
          [Op.or]: [
            {
              name: {
                [Op.and]: [
                  { [Op.like]: 'admin%' },
                  { [Op.like]: '%zeizzu%' }
                ]
              }
            },
            { name: 'accountant' },
            { name: 'operator' },
            { name: {
            [Op.and]: [
              { [Op.like]: 'admin%' },
              { [Op.like]: '%ziezzu%' }
            ]}
          },
          ]

          
        }
      });

      // Process the results to extract the last part after the dots
      const processedRoles = adminRoles.map(role => {
        const nameParts = role.name.split('.');
        const displayName = nameParts[nameParts.length - 1];
        return {
          id: role.id,
          name: role.display_name? role.display_name : displayName,
        };
      });

      return processedRoles;
    } catch (error) {
      await addServerLog({
        log_level: "ERROR",
        service_name: "findAdminRoles",
        error_message: `findAdminRoles DAO error - ${error.message}.`
      });
      throw new Error(`Error fetching admin roles: ${error.message}`);
    }
  },

  findRolesContainingAndExcluding: async (includeKeywords, excludeKeywords) => {
    try {
      return await Role.findAll({
        where: {
          name: {
            [Op.and]: [
              ...includeKeywords.map(keyword => ({
                [Op.like]: `%${keyword}%`
              })),
              ...excludeKeywords.map(keyword => ({
                [Op.notLike]: `%${keyword}%`
              }))
            ]
          }
        }
      });
    } catch (error) {
      await addServerLog({
        log_level: "ERROR",
        service_name: "findRolesContainingAndExcluding",
        error_message: `findRolesContainingAndExcluding DAO error - ${error.message}.`
      });
      throw error;
    }
  },


  findRolesContaining: async (includeKeywords) => {
    try {
      return await Role.findAll({
        where: {
          [Op.or]: [
            {
              [Op.and]: includeKeywords.map(keyword => ({
                name: {
                  [Op.like]: `%${keyword}%`
                }
              }))
            },
            {
              name: {
                [Op.like]: '%admin.zeizzu%'  // explicitly looking for "ziezzu admin"
              }
            }
          ]
        },
        order: [['id', 'DESC']]
      });
    } catch (error) {
      await addServerLog({
        log_level: "ERROR",
        service_name: "findRolesContaining",
        error_message: `findRolesContaining DAO error - ${error.message}.`
      });
      throw error;
    }
  },


  createRoles : async (roleData) => {
      try {
        return await Role.create(roleData);
      } catch (error) {
        console.error("Sequelize Validation Error:", error.errors?.map(e => e.message));
        throw error;
      }
  },

  createPolicy : async (policyData) => {
      try {
        return await Policy.create(policyData);
      } catch (error) {
        console.error("Sequelize Validation Error:", error.errors?.map(e => e.message));
        throw error;
      }
  },

  // updateRolePolicies : async (roleId, policyIds) => {
  //     const role = await Role.findByPk(roleId);
  //     if (!role) return null;

  //     role.policies = policyIds;
  //     await role.save();
  //     return role;
  // },

  updateRolePolicies: async (roleId, policyIds) => {
    const role = await Role.findByPk(roleId);
    if (!role) return null;
  
    // Assume role.policies is an array of IDs (adjust if it's a relation)
    const existingPolicyIds = role.policies || [];
  
    // Merge and deduplicate
    const updatedPolicyIds = Array.from(new Set([...existingPolicyIds, ...policyIds]));
  
    role.policies = updatedPolicyIds;
    await role.save();
  
    return role;
  },

  removeRolePolicies : async (roleId, policyIdsToRemove) => {
    const role = await Role.findByPk(roleId);
    console.log(role);
    if (!role) return null;
  
    role.policies = role.policies.filter(
      (id) => !policyIdsToRemove.includes(id)
    );
    
    await role.save();
    return role;
    
  }



};
