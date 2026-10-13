
// src/routes/savedLocationRoutes.js

const express = require('express');
const router = express.Router();
const authenticate = require('../middlewares/authMiddleware');
const savedLocationController = require('../controllers/savedLocationsController');

const authorize = require('../middlewares/authorize'); // Ensure this is included for authorization checks

// Save a location - Only authorized users with 'locations.save' permission
router.post('/save-location', authenticate, authorize('locations.save'), savedLocationController.saveLocation);


module.exports = router;
