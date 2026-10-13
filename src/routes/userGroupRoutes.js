// routes/userGroup.router.js
const express = require('express');
const router = express.Router();
const {
  createUserGroupController,
  getAllUserGroupsController,
  addUserToGroupController,
} = require('../controllers/userGroupController');

const authorize = require('../middlewares/authorize');

// Create a new user group - Only authorized roles with 'user-groups.create' permission
router.post('/user-groups', authenticate, authorize('userGroups.create'), createUserGroupController);

// Get all user groups - Only authorized roles with 'user-groups.view' permission
router.get('/user-groups', authenticate, authorize('userGroups.view'), getAllUserGroupsController);

// Add a user to a user group - Only authorized roles with 'user-groups.add-user' permission
router.post('/user-groups/:groupId/users', authenticate, authorize('userGroups.addUser'), addUserToGroupController);

module.exports = router;
