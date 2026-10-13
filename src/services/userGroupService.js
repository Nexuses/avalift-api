const userGroupDao = require("../dao/userGroupDAO");
const { addServerLog } = require("./serverLogsService");

const createUserGroup = async (groupData) => {
  try {
    return await userGroupDao.createUserGroupDAO(groupData);
  } catch (error) {
    await addServerLog({
      log_level: "ERROR",
      service_name: "createUserGroup",
      error_message: `createUserGroup service error - ${error.message}.`
    });
    throw error;
  }
};

const getAllUserGroups = async () => {
  try {
    return await userGroupDao.getAllUserGroupsDAO();
  } catch (error) {
    await addServerLog({
      log_level: "ERROR",
      service_name: "getAllUserGroups",
      error_message: `getAllUserGroups service error - ${error.message}.`
    });
    throw error;
  }
};

const updateGroup = async (groupId, groupData) => {
  try {
    return await userGroupDao.updateGroup(groupId, groupData);
  } catch (error) {
    await addServerLog({
      log_level: "ERROR",
      service_name: "updateGroup",
      error_message: `updateGroup service error - ${error.message}.`
    });
    throw error;
  }
};

const deleteGroup = async (groupId) => {
  try {
    return await userGroupDao.deleteGroup(groupId);
  } catch (error) {
    await addServerLog({
      log_level: "ERROR",
      service_name: "deleteGroup",
      error_message: `deleteGroup service error - ${error.message}.`
    });
    throw error;
  }
};

const addUserToGroup = async (groupId, userId) => {
  try {
    return await userGroupDao.addUserToGroupDAO(groupId, userId);
  } catch (error) {
    await addServerLog({
      log_level: "ERROR",
      service_name: "addUserToGroup",
      error_message: `addUserToGroup service error - ${error.message}.`
    });
    throw error;
  }
};

const getMembers = async (groupId) => {
  try {
    return await userGroupDao.getMembers(groupId);
  } catch (error) {
    await addServerLog({
      log_level: "ERROR",
      service_name: "getMembers",
      error_message: `getMembers service error - ${error.message}.`
    });
    throw error;
  }
};

const updateMember = async (groupId, userId, updateData) => {
  try {
    return await userGroupDao.updateMember(groupId, userId, updateData);
  } catch (error) {
    await addServerLog({
      log_level: "ERROR",
      service_name: "updateMember",
      error_message: `updateMember service error - ${error.message}.`
    });
    throw error;
  }
};

const removeMember = async (groupId, userId) => {
  try {
    return await userGroupDao.removeMember(groupId, userId);
  } catch (error) {
    await addServerLog({
      log_level: "ERROR",
      service_name: "removeMember",
      error_message: `removeMember service error - ${error.message}.`
    });
    throw error;
  }
};

module.exports = {
  createUserGroup,
  getAllUserGroups,
  updateGroup,
  deleteGroup,
  addUserToGroup,
  getMembers,
  updateMember,
  removeMember,
};
