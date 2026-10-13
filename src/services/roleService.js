const { Role, Policy, Permission } = require("../dto");
const { addServerLog } = require("./serverLogsService");
const roleDAO = require("../dao/roleDAO");

async function getPermissionsForRoles(roleId) {
  try {
    if (!roleId) {
      throw new Error("Invalid role ID input.");
    }

    // Fetch role by ID
    const role = await Role.findOne({
      where: { id: roleId },
    });

    if (!role) {
      return { roles: [], permissions: [], allowedOrganization: null };
    }

    // Extract policy IDs from the role (ensure it's an array)
    const policyIds = Array.isArray(role.policies) ? role.policies : [];

    if (policyIds.length === 0) {
      return { roles: [role.name], permissions: [], allowedOrganization: null };
    }

    // Fetch policies linked to the role
    const policies = await Policy.findAll({
      where: { id: policyIds },
      order: [["id", "ASC"]],
    });

    if (policies.length === 0) {
      return { roles: [role.name], permissions: [], allowedOrganization: null };
    }

    // Extract unique permission IDs from policies
    const permissionIdsSet = new Set();
    policies.forEach((policy) => {
      if (Array.isArray(policy.permissions)) {
        policy.permissions.forEach((permId) => permissionIdsSet.add(permId));
      }
    });

    const permissionIds = Array.from(permissionIdsSet);
    if (permissionIds.length === 0) {
      return { roles: [role.name], permissions: [], allowedOrganization: null };
    }

    // Fetch permissions based on IDs
    const permissions = await Permission.findAll({
      where: { id: permissionIds },
      order: [["id", "ASC"]],
    });

    // Structure the output
    const response = {
      roles: [role.name], // Store role name
      permissions: [], // To store permission names
      allowedOrganization: null, // Placeholder for org ID
    };

    // Process permissions
    permissions.forEach((perm) => {
      if (perm.name === "allowed_organization") {
        //console.log("XXXXXXXXXXXX", perm);
        response.allowedOrganization = perm.value; // Set org ID
      } else {
        response.permissions.push(perm.name); // Store permission names
      }
    });

    return response;
  } catch (error) {
    console.error("Error fetching permissions for roles:", error);
    await addServerLog({
      log_level: "ERROR",
      service_name: "getPermissionsForRoles",
      error_message: `getPermissionsForRoles service error - ${error.message}.`
    });
    throw error;
  }
};

const createRole = async (data) => {
  const { name, display_name, policies } = data;

  if (!name) {
    throw { status: 400, message: 'Role name is required.' };
  }

  // Check if role name already exists
  const existingRole = await Role.findOne({ where: { name } });
  if (existingRole) {
    throw { status: 400, message: 'Role name already exists.' };
  }

  // Optional: Validate that policies is an array of integers
  if (policies && !Array.isArray(policies)) {
    throw { status: 400, message: 'Policies must be an array of integers.' };
  }

  if (policies && policies.length > 0) {
    const existingPolicies = await Policy.findAll({
      where: {
        id: policies,
      },
    });

    const existingPolicyIds = existingPolicies.map(p => p.id);
    const invalidPolicies = policies.filter(id => !existingPolicyIds.includes(id));

    if (invalidPolicies.length > 0) {
      throw {
        status: 400,
        message: `Invalid policy IDs: ${invalidPolicies.join(', ')}`,
      };
    }
  }

  return await roleDAO.createRoles({
    name,
    display_name,
    policies: policies || [],
  });
};


const createPolicy = async (data) => {
  const { name, permissions } = data;

  if (!name) {
    throw { status: 400, message: 'Policy name is required.' };
  }

   // Check if policy name already exists
   const existingPolicy = await Policy.findOne({ where: { name } });
   if (existingPolicy) {
     throw { status: 400, message: 'Policy name already exists.' };
   }

  if (permissions && !Array.isArray(permissions)) {
    throw { status: 400, message: 'Permissions must be an array of integers.' };
  }

  // Validate that all permission IDs exist in the database
  if (permissions && permissions.length > 0) {
    const existingPermissions = await Permission.findAll({
      where: { id: permissions },
      attributes: ['id'],
    });

    const existingPermissionIds = existingPermissions.map(p => p.id);

    const invalidPermissions = permissions.filter(id => !existingPermissionIds.includes(id));

    if (invalidPermissions.length > 0) {
      throw {
        status: 400,
        message: `Invalid permission IDs: ${invalidPermissions.join(', ')}`,
      };
    }
  }

  // Create the policy
  return await roleDAO.createPolicy({
    name,
    permissions: permissions || [],
  });
};

const associatePoliciesToRole = async (roleId, policyIds) => {
  if (!Array.isArray(policyIds)) {
    throw { status: 400, message: 'Policies must be an array of IDs.' };
  }

  // Optional: validate policies exist
  const count = await Policy.count({
    where: { id: policyIds },
  });

  if (count !== policyIds.length) {
    throw { status: 400, message: 'Some policy IDs are invalid.' };
  }

  const updatedRole = await roleDAO.updateRolePolicies(roleId, policyIds);
  if (!updatedRole) {
    throw { status: 404, message: 'Role not found.' };
  }

  return updatedRole;
};

const deassociatePoliciesFromRole = async (roleId, policyIdsToRemove) => {
  if (!Array.isArray(policyIdsToRemove)) {
    throw { status: 400, message: 'Policies must be an array of IDs.' };
  }

  // Validate that policy IDs are valid
  const count = await Policy.count({ where: { id: policyIdsToRemove } });
  if (count !== policyIdsToRemove.length) {
    throw { status: 400, message: 'Some policy IDs are invalid.' };
  }

  // Fetch the role and its policies
  const role = await Role.findByPk(roleId);
  if (!role) {
    throw { status: 404, message: 'Role not found.' };
  }

  const currentPolicyIds = role.policies || [];

  // Find which policy IDs are not currently associated
  const nonExistingPolicies = policyIdsToRemove.filter(
    (id) => !currentPolicyIds.includes(id)
  );

  if (nonExistingPolicies.length > 0) {
    throw {
      status: 400,
      message: `Policy ID(s) ${nonExistingPolicies.join(', ')} already removed from role.`,
    };
  }

  // If all checks pass, proceed to DAO to remove the policies
  const updatedRole = await roleDAO.removeRolePolicies(roleId, policyIdsToRemove);
  return updatedRole;
};





module.exports = {
  getPermissionsForRoles,
  createRole,
  createPolicy,
  associatePoliciesToRole,
  deassociatePoliciesFromRole
};
