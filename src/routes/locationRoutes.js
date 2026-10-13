const express = require('express');
const router = express.Router();
const authenticate = require('../middlewares/authMiddleware');
const authorize = require('../middlewares/authorize');
const locationController = require('../controllers/locationController');

router.use(authenticate);

// Route to create or update a location (Requires 'locations.create' permission)
router.post('/updatelocation', authorize('locations.create'), locationController.createOrUpdateLocation);

// Route to get the current location (Requires 'locations.view' permission)
router.post('/getlocation', authorize('locations.view'), locationController.getCurrentLocation);

// Route to find nearby users (Requires 'locations.view' permission)
router.post('/getnearbyuser', authorize('locations.view'), locationController.findNearbyUsers);


module.exports = router;

