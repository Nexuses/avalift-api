const express = require('express');
const router = express.Router();
const rideController = require('../controllers/rideController');
const pdRidesController = require('../controllers/pdRidesController');
const authenticate = require('../middlewares/authMiddleware');
const authorize = require('../middlewares/authorize');
router.use(authenticate);
// Endpoint for Dropdown Options ("Half Day" and "Full Day")
// router.get('/ride-booking-options', rideController.getRideBookOptions);

//rate type list
router.get('/get-rate-types', authorize('orders.create'), rideController.getRateTypes)
router.post('/create-rate-type', authorize('orders.create'), rideController.createRateType);
router.put('/update-rate-type', authorize('orders.create'), rideController.updateRateType);

module.exports = router;
