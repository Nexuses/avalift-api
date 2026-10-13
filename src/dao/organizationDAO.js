const { Organization, Permission, Policy, Role, User } = require("../dto");
const { Op } = require("sequelize");
const ridesDAO = require("../dao/ridesDAO");
const { OrganizationInvoice } = require("../dto");
const { CustomerWalletLog } = require("../dto");


const { addServerLog } = require("../services/serverLogsService"); // Update the path as needed

module.exports = {
  getById: async (id) => {
    try {
      return await Organization.findByPk(id);
    } catch (error) {
      console.error("Error in getById:", error);
      await addServerLog({
        log_level: "ERROR",
        service_name: "getById",
        error_message: `getById DAO error - ${error.message}.`
      });
      throw error;
    }
  },

  findByNameOrMobileOrEmail: async (name, country_code, mobile_number, email_id) => {
    try {
      return await Organization.findOne({
        where: {
          [Op.or]: [{ name }, { country_code, mobile_number },{ email_id }],
        },
      });
    } catch (error) {
      console.error("Error in findByNameOrMobile:", error);
      await addServerLog({
        log_level: "ERROR",
        service_name: "findByNameOrMobile",
        error_message: `findByNameOrMobile DAO error - ${error.message}.`
      });
      throw error;
    }
  },

  findById: async (id) => {
    try {
      const organisation = await Organization.findOne({ where: { id,is_deleted: false } });
      if (!organisation) {
        throw new Error(`Organisation with ID ${id} not found.`);
      }
      return organisation;
    } catch (error) {
      console.error("Error fetching organisation by ID:", error);
      await addServerLog({
        log_level: "ERROR",
        service_name: "findById",
        error_message: `findById DAO error - ${error.message}.`
      });
      throw error;
    }
  },

  // Check for unpaid invoices (is_paid: false)
  hasUnpaidInvoices :async (organizationId) => {
      return await OrganizationInvoice.findOne({
      where: {
          organization_id: organizationId,
          is_paid: false
        }
    });
  },

  hasUnpaidCustomerWalletLogs: async (organizationId) => {
    try {
      // Step 1: Get rides for this organization from DynamoDB
      const rides = await ridesDAO.getRidesByOrganizationIdAndStatuses(organizationId);
  
      if (!rides || rides.length === 0) {
        console.log(`No rides found for organization ID: ${organizationId}`);
        return false; // No rides found for this organization
      }
  
      // Step 2: Extract ride IDs safely
      const rideIds = [];
  
      rides.forEach((ride, index) => {
        console.log(`Processing ride ${index + 1}:`, JSON.stringify(ride, null, 2));
  
        if (ride && typeof ride.ride_id === 'string' && ride.ride_id.trim() !== '') {
          rideIds.push(ride.ride_id);
        } else {
          console.warn(`Missing or invalid ride_id for ride ${index + 1}:`, ride);
        }
      });
  
      console.log('Collected Ride IDs:', rideIds);
  
      // Step 3: If there are no rideIds, return false
      if (rideIds.length === 0) {
        console.log(`No valid ride IDs found for organization ID: ${organizationId}`);
        return false;
      }
  
      // Step 4: Check CustomerWalletLogs for those rideIds
      const unpaidLog = await CustomerWalletLog.findOne({
        where: {
          ride_id: {
            [Op.in]: rideIds,
          },
          is_paid: false,
          is_invoice_created: false,
        },
      });
  
      console.log('unpaidLog:', unpaidLog);
  
      // Step 5: Return true if an unpaid log exists, false otherwise
      return unpaidLog !== null;
  
    } catch (error) {
      console.error('Error in hasUnpaidCustomerWalletLogs:', error);
      // If error, depending on your error-handling strategy, you could throw or return false
      throw error; // or return false;
    }
  },
 
  deleteOrganization: async (organizationId) => {

    

    const updatedFields = {
      is_deleted: true,
      email_id: `${organizationId }email_deleted`,
      mobile_number: `${organizationId}mobile_number_deleted`,
      name: `${organizationId}name_deleted`,
      address:`${organizationId}address_deleted`,
    };


    return await Organization.update(
      updatedFields,
      {
        where: {
          id: organizationId,
          is_deleted: false, // Prevents re-deleting if already deleted
        
        },
        validate: false,
      }
    );
  },


  createOrganization: async (data) => {
    try {
      return await Organization.create(data);
    } catch (error) {
      console.error("Error creating organization:", error);
      await addServerLog({
        log_level: "ERROR",
        service_name: "createOrganization",
        error_message: `createOrganization DAO error - ${error.message}.`
      });
      throw error;
    }
  },

  updateOrganization: async (id, data) => {
    try {
      return await Organization.update(data, { where: { id } });
    } catch (error) {
      console.error("Error updating organization:", error);
      await addServerLog({
        log_level: "ERROR",
        service_name: "updateOrganization",
        error_message: `updateOrganization DAO error - ${error.message}.`
      });
      throw error;
    }
  },

  getAllOrganizations: async () => {
    try {
      return await Organization.findAll({
        where: {
          name: {
            [Op.notILike]: 'avalift' // case-insensitive
          }
        },
        order: [['id', 'DESC']]
      });
    } catch (error) {
      console.error("Error fetching all organizations:", error);
      await addServerLog({
        log_level: "ERROR",
        service_name: "getAllOrganizations",
        error_message: `getAllOrganizations DAO error - ${error.message}.`
      });
      throw error;
    }
  },

  getUsersForOrganization: async (organizationId) => {
    try {
      if (!organizationId) {
        throw new Error("Invalid organization id input.");
      }

      let permissionIds = [];

      if (organizationId === "*" || organizationId === "1") {
        // Fetch all `allowed_organization` permissions, excluding "*" and "1"
        const permissions = await Permission.findAll({
          where: {
            name: "allowed_organization",
            value: {
              [Op.notIn]: ["*", "1"],
            },
          },
        });

        if (!permissions || permissions.length === 0) {
          return [];
        }
        permissionIds = permissions.map((permission) => permission.id);
      } else {
        // Normal case: find specific organization permission
        const permission = await Permission.findOne({
          where: {
            name: "allowed_organization",
            value: String(organizationId),
          },
        });

        if (!permission) {
          return [];
        }
        permissionIds = [permission.id];
      }

      // Fetch policies that reference the found permissions
      const policies = await Policy.findAll({
        where: {
          permissions: {
            [Op.overlap]: permissionIds, // Finds any policy containing one of these permissions
          },
        },
      });

      if (!policies || policies.length === 0) {
        return [];
      }
      const policyIds = policies.map((policy) => policy.id);

      // Fetch roles that reference those policies
      const roles = await Role.findAll({
        where: {
          policies: {
            [Op.overlap]: policyIds,
          },
        },
      });

      if (!roles || roles.length === 0) {
        return [];
      }
      const roleIds = roles.map((role) => role.id);

      // Extract organization info from role names (Assumption: Role names contain org names)
      const roleToOrgMap = roles.reduce((acc, role) => {
        const match = role.name.match(/admin\.(.*?)\./); // e.g. extracts "afsaltoursandtravels" from "admin.afsaltoursandtravels.normal"
        const orgName = match ? match[1] : "Unknown"; // Fallback if no match
        acc[role.id] = { id: role.id, name: orgName };
        return acc;
      }, {});

      // Fetch users and include their inferred organization details
      const users = await User.findAll({
        attributes: { exclude: ["password"] },
        where: {
          role_id: {
            [Op.in]: roleIds,
          },
          is_active: true,
        },
        order: [["id", "DESC"]],
      });

      const usersWithOrgDetails = users.map((user) => ({
        ...user.toJSON(),
        organization_name: roleToOrgMap[user.role_id]?.name || "Unknown",
      }));

      return usersWithOrgDetails;
    } catch (error) {
      console.error("Error fetching users for organization:", error);
      await addServerLog({
        log_level: "ERROR",
        service_name: "getUsersForOrganization",
        error_message: `getUsersForOrganization DAO error - ${error.message}.`
      });
      throw error;
    }
  },

  fetchOrganizationDetails: async (organizationIds) => {
    if (!organizationIds.length) return {};

    const organizationDetails = {};

    try {
      await Promise.all(
        organizationIds.map(async (id) => {
          const organization = await Organization.findOne({ where: { id } });
          if (organization) {
            organizationDetails[id] = {
              name: organization.name,
              phone: `${organization.country_code}${organization.mobile_number}`,
            };
          }
        })
      );
    } catch (error) {
      await addServerLog({
        log_level: "ERROR",
        service_name: "fetchOrganizationDetails",
        error_message: `fetchOrganizationDetails DAO error - ${error.message}.`,
      });
      console.error("Error fetching organization from PostgreSQL:", error);
    }

    return organizationDetails;
  },

  fetchOrganizationName: async (organizationId) => {
    const organization = await Organization.findOne({ where: { id: organizationId } });
    return organization?.name;
  },

  updateOrganizationStatus : async (organizationId, isActive) => {
  return await Organization.update(
    { is_active: isActive },
    { where: { id: organizationId }, returning: true }
  );
  },

  findOrganizationByName: async (name) => {
    return await Organization.findOne({ where: { name } });
  },

};
