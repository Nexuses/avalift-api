const { UserGroup, User, UserGroupMembership } = require("../dto");
const { Op } = require('sequelize');
const { addServerLog } = require("../services/serverLogsService"); 

// Create a new user group
const createUserGroupDAO = async (groupData) => {
  try {
    return await UserGroup.create(groupData);
  } catch (error) {
    await addServerLog({
      log_level: "ERROR",
      service_name: "createUserGroupDAO",
      error_message: `createUserGroupDAO DAO error - ${error.message}.`
    });
    throw error;
  }
};

// Retrieve all user groups along with their members
const getAllUserGroupsDAO = async () => {
  try {
    return await UserGroup.findAll({
      include: [
        {
          model: User,
          as: "users",
          through: { attributes: [] },
        },
      ],
    });
  } catch (error) {
    await addServerLog({
      log_level: "ERROR",
      service_name: "getAllUserGroupsDAO",
      error_message: `getAllUserGroupsDAO DAO error - ${error.message}.`
    });
    throw error;
  }
};

// Update a user group based on groupId from body
const updateGroup = async (groupId, groupData) => {
  try {
    const group = await UserGroup.findByPk(groupId);
    if (!group) throw new Error("Group not found");
    await group.update(groupData);
    return group;
  } catch (error) {
    await addServerLog({
      log_level: "ERROR",
      service_name: "updateGroup",
      error_message: `updateGroup DAO error - ${error.message}.`
    });
    throw error;
  }
};

// Delete a user group based on groupId from body
const deleteGroup = async (groupId) => {
  try {
    const group = await UserGroup.findByPk(groupId);
    if (!group) throw new Error("Group not found");
    return await group.destroy();
  } catch (error) {
    await addServerLog({
      log_level: "ERROR",
      service_name: "deleteGroup",
      error_message: `deleteGroup DAO error - ${error.message}.`
    });
    throw error;
  }
};

// Add a user to a group membership
const addUserToGroupDAO = async (groupId, userId) => {
  try {
    // Optionally check if the membership already exists
    const [membership, created] = await UserGroupMembership.findOrCreate({
      where: { user_id: userId, user_group_id: groupId },
    });
    return { membership, created };
  } catch (error) {
    await addServerLog({
      log_level: "ERROR",
      service_name: "addUserToGroupDAO",
      error_message: `addUserToGroupDAO DAO error - ${error.message}.`
    });
    throw error;
  }
};

// Get members of a group
const getMembers = async (groupId) => {
  try {
    // Find all membership records for the given groupId
    const memberships = await UserGroupMembership.findAll({
      where: { user_group_id: groupId },
    });

    // Extract the user IDs from the membership records
    const userIds = memberships.map((membership) => membership.user_id);

    // If no users are found, return an empty array
    if (userIds.length === 0) return [];

    // Query the User model for all users with IDs in the userIds array
    const users = await User.findAll({
      where: { id: { [Op.in]: userIds } },
    });

    return users;
  } catch (error) {
    await addServerLog({
      log_level: "ERROR",
      service_name: "getMembers",
      error_message: `getMembers DAO error - ${error.message}.`
    });
    throw error;
  }
};

// Update membership details (if any additional attributes exist)
const updateMember = async (groupId, userId, updateData) => {
  try {
    const membership = await UserGroupMembership.findOne({
      where: { user_id: userId, user_group_id: groupId },
    });
    if (!membership) throw new Error("Membership not found");
    await membership.update(updateData);
    return membership;
  } catch (error) {
    await addServerLog({
      log_level: "ERROR",
      service_name: "updateMember",
      error_message: `updateMember DAO error - ${error.message}.`
    });
    throw error;
  }
};

// Remove a user from a group
const removeMember = async (groupId, userId) => {
  try {
    const membership = await UserGroupMembership.findOne({
      where: { user_id: userId, user_group_id: groupId },
    });
    if (!membership) throw new Error("Membership not found");
    return await membership.destroy();
  } catch (error) {
    await addServerLog({
      log_level: "ERROR",
      service_name: "removeMember",
      error_message: `removeMember DAO error - ${error.message}.`
    });
    throw error;
  }
};

/**
 * Fetches all user group IDs for a given user.
 *
 * @param {number} userId - The ID of the user.
 * @returns {Promise<number[]>} - Array of user group IDs.
 */
const getUserGroupIdsByUserId = async (userId) => {
  try {
    const memberships = await UserGroupMembership.findAll({
      where: { user_id: userId },
      attributes: ['user_group_id']
    });
    return memberships.map(membership => membership.user_group_id);
  } catch (error) {
    await addServerLog({
      log_level: "ERROR",
      service_name: "getUserGroupIdsByUserId",
      error_message: `getUserGroupIdsByUserId DAO error - ${error.message}.`
    });
    throw error;
  }
}

module.exports = {
  createUserGroupDAO,
  getAllUserGroupsDAO,
  updateGroup,
  deleteGroup,
  addUserToGroupDAO,
  getMembers,
  updateMember,
  removeMember,
  getUserGroupIdsByUserId
};
