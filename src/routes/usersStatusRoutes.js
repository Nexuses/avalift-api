const express = require("express");
const authenticate=require('../middlewares/authMiddleware');
const UserController = require("../controllers/usersStatusController");
const authorize = require('../middlewares/authorize');

const router = express.Router();

/// Route to update user status - Requires permission for updating user status
router.put("/status", authenticate, authorize('drivers.manage'), UserController.updateStatus);

// Route to create a new user status - Requires permission for creating user status
router.post('/status-create', authenticate, authorize('users.create'), UserController.createStatus);

module.exports = router;
