// src/routes/userRoutes.js
const express = require('express');
const authenticate = require('../middlewares/authMiddleware');
const authorize = require('../middlewares/authorize');
const userController = require('../controllers/userController');
const userProfileController = require("../controllers/userProfilesController");
const customerRidesController = require("../controllers/customerRidesController");
const { uploadProfileImageMiddleware } = require("../services/uploadDocumentService");
const reviewController = require("../controllers/userReviewController");
const referralController = require('../controllers/referralController');
const vehicleController = require('../controllers/vehicleController');
const appLogController = require('../controllers/appLogController');

const router = express.Router();

// Create a new user
router.post('/', authenticate, authorize('users.create'), userController.createUser);

// Update a user
router.put('/:id', authenticate, authorize('users.update'), userController.updateUser);

// Delete a user
router.delete('/delete-user', authenticate, authorize('users.delete'), userController.deleteUser);

// Route to list all individual customers
router.post('/customers/individual', authenticate, authorize('users.view'), userController.listIndividualCustomers);

// Route to list all corporate customers
router.get('/customers/corporate', authenticate, authorize('users.view'), userController.listCorporateCustomers);

// Route to list all chauffeurs
router.get('/chauffeurs', authenticate, authorize('drivers.view'), userController.listAllChauffeurs);

// Route to list all pd
router.get('/pd', authenticate, authorize('drivers.view'), userController.listAllPd);

// Route to fetch all users grouped by role
router.get("/profile", authenticate, authorize('users.view'), userController.getUserProfile);

// Route to create or update user profile
router.post("/create-profile", authenticate, uploadProfileImageMiddleware, authorize('users.update'), userController.processUserProfile);

// Route to update device_id
router.post("/device-id", authenticate, authorize('users.update'), userController.updateDeviceId);

// Route to add a new review (Protected)
router.post("/add-review", authenticate, authorize('orders.update'), reviewController.addReview);

// Route to get existing rides for a customer
router.get("/customer/existing-rides", authenticate, authorize('orders.view'), customerRidesController.fetchActiveRidesByCustomer);

// Route to get user dashboard (Protected)
router.get('/dashboard', authenticate, authorize('drivers.view'), userController.userDashboard);

// Referral routes
router.post('/generate-and-get-referral-code', authenticate, referralController.generateReferralCode);

// Update profile details
router.put('/update/profile-details', authenticate, userController.updateUserDetails);

// Country plate format
router.get('/country-plate-formats', authenticate, authorize('users.view'), vehicleController.getCountryPlateFormats);

// App logs
router.post('/save-app-logs', authenticate, appLogController.createAppLogs);

// Mark Apple Pay payment failure
router.post('/mark-apple-pay-payment-failed', authenticate, userController.markApplePayPayment);

module.exports = router;

