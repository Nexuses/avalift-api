// src/routes/pdRoutes.js

const express = require('express');
const router = express.Router();
const authenticate = require('../middlewares/authMiddleware');
const authorize = require('../middlewares/authorize');
const pdController = require('../controllers/rideController');
const pdRideController = require('../controllers/pdRidesController');

// router.get('/dashboard', authenticate, authorize('pd'), pdController.getDashboard);
router.get('/pending-pickups-drops', authenticate,authorize('drivers.view'),pdRideController.getPendingPickupsAndDrops);
router.get('/notification-list/:page/:limit', authenticate,authorize('drivers.view'), pdRideController.fetchPdNotifications);
router.post('/get-pd-summary', authenticate,authorize('drivers.view'),pdRideController.pdSummary);


module.exports = router;
