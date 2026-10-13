// routes/userProfileRoutes.js
const express = require('express');
const userProfileController = require('../controllers/userProfilesController');
const authenticate = require('../middlewares/authMiddleware');
const router = express.Router();
//const {uploadProfileImageMiddleware} = require('../services/uploadS3Services');
const  {uploadProfileImageMiddleware} = require('../services/uploadDocumentService');
const authorize = require('../middlewares/authorize');

/**
 * Route to create a user profile.
 */
//router.post('/user-profile',authenticate, userProfileController.createUserProfile);

// Route to upload profile image - Requires permission to upload profile images
router.post("/upload/profile-image", authenticate, authorize('users.update'), userProfileController.uploadProfileImageController);
// Route to upload profile image - Requires permission to upload profile images
router.post("/upload/profile-image", authenticate, authorize('users.update'), userProfileController.uploadProfileImageController);

router.delete("/remove/profile-image", authenticate, userProfileController.removeProfileImageController);


module.exports = router;
