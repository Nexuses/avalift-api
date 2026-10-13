const {
  createUserGroup,
  getAllUserGroups,
  addUserToGroup,
  updateGroup,
  deleteGroup,
  getMembers,
  updateMember,
  removeMember,
} = require("../services/userGroupService");
const { addServerLog } = require("../services/serverLogsService"); // Update path if needed

const createUserGroupController = async (req, res) => {
  try {
    const groupData = req.body;
    const newGroup = await createUserGroup(groupData);
    res.status(201).json({ message: "User group created successfully", group: newGroup });
  } catch (error) {
    console.error("Error in createUserGroupController:", error);
    await addServerLog({
      log_level: "ERROR",
      service_name: "createUserGroupController",
      error_message: `createUserGroupController error - ${error.message}.`
    });
    res.status(500).json({ error: error.message || "Internal server error" });
  }
};

const getAllUserGroupsController = async (req, res) => {
  try {
    const groups = await getAllUserGroups();
    res.status(200).json({ groups });
  } catch (error) {
    console.error("Error in getAllUserGroupsController:", error);
    await addServerLog({
      log_level: "ERROR",
      service_name: "getAllUserGroupsController",
      error_message: `getAllUserGroupsController error - ${error.message}.`
    });
    res.status(500).json({ error: error.message || "Internal server error" });
  }
};

const updateUserGroupController = async (req, res) => {
  try {
    const { groupId, ...groupData } = req.body;
    const updatedGroup = await updateGroup(groupId, groupData);
    res.status(200).json({ message: "Group updated", group: updatedGroup });
  } catch (error) {
    console.error("Error in updateUserGroupController:", error);
    await addServerLog({
      log_level: "ERROR",
      service_name: "updateUserGroupController",
      error_message: `updateUserGroupController error - ${error.message}.`
    });
    res.status(500).json({ error: error.message || "Internal server error" });
  }
};

const deleteUserGroupController = async (req, res) => {
  try {
    const { groupId } = req.body;
    await deleteGroup(groupId);
    res.status(204).send();
  } catch (error) {
    console.error("Error in deleteUserGroupController:", error);
    await addServerLog({
      log_level: "ERROR",
      service_name: "deleteUserGroupController",
      error_message: `deleteUserGroupController error - ${error.message}.`
    });
    res.status(500).json({ error: error.message || "Internal server error" });
  }
};

// Membership operations
const addUserToGroupController = async (req, res) => {
  try {
    const { groupId, userId } = req.body;
    const { membership, created } = await addUserToGroup(groupId, userId);
    if (!created) {
      return res.status(200).json({
        message: "User is already a member of this group",
        membership,
      });
    }
    res.status(201).json({ message: "User added to group successfully", membership });
  } catch (error) {
    console.error("Error in addUserToGroupController:", error);
    await addServerLog({
      log_level: "ERROR",
      service_name: "addUserToGroupController",
      error_message: `addUserToGroupController error - ${error.message}.`
    });
    res.status(500).json({ error: error.message || "Internal server error" });
  }
};

const getMembersController = async (req, res) => {
  try {
    const { groupId } = req.body;
    const members = await getMembers(groupId);
    res.status(200).json({ members });
  } catch (error) {
    console.error("Error in getMembersController:", error);
    await addServerLog({
      log_level: "ERROR",
      service_name: "getMembersController",
      error_message: `getMembersController error - ${error.message}.`
    });
    res.status(500).json({ error: error.message || "Internal server error" });
  }
};

const updateMemberController = async (req, res) => {
  try {
    const { groupId, userId, ...updateData } = req.body;
    const membership = await updateMember(groupId, userId, updateData);
    res.status(200).json({ message: "Membership updated", membership });
  } catch (error) {
    console.error("Error in updateMemberController:", error);
    await addServerLog({
      log_level: "ERROR",
      service_name: "updateMemberController",
      error_message: `updateMemberController error - ${error.message}.`
    });
    res.status(500).json({ error: error.message || "Internal server error" });
  }
};

const removeMemberController = async (req, res) => {
  try {
    const { groupId, userId } = req.body;
    await removeMember(groupId, userId);
    res.status(204).send();
  } catch (error) {
    console.error("Error in removeMemberController:", error);
    await addServerLog({
      log_level: "ERROR",
      service_name: "removeMemberController",
      error_message: `removeMemberController error - ${error.message}.`
    });
    res.status(500).json({ error: error.message || "Internal server error" });
  }
};

module.exports = {
  createUserGroupController,
  getAllUserGroupsController,
  updateUserGroupController,
  deleteUserGroupController,
  addUserToGroupController,
  getMembersController,
  updateMemberController,
  removeMemberController,
};
