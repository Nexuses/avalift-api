// src/routes/authRoutes.js

const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const sampleController = require('../controllers/sampleController');
const authenticate = require('../middlewares/authMiddleware');
const passport = require("passport");

// Request OTP 
router.post('/request-otp', authController.requestOtp);
router.post(`/request-otp-chauffeur-pd`, authController.requestOtpChauffeurPd);

// Verify OTP 
router.post('/verify-otp', authController.verifyOtp);
router.post(`/verify-otp-chauffeur-pd`, authController.verifyOtpChauffeurPd);

// Complete Registration - for customers.
router.post('/complete-registration', authController.completeRegistration);

// Redirect to Google
router.get("/google", passport.authenticate("google", { scope: ["email", "profile"] }));

// Callback after Google login
router.get(
  "/google/callback",
  passport.authenticate("google", { session: false, failureRedirect: "/login" }),
  authController.googleCallbackHandler
);

// routes/authRoutes.js
router.post("/auth/google", authController.googleSSOAppHandler);


// Admin Login
router.post('/admin-login', authController.adminLogin);

//Super User Creation
router.post('/create-super-admin', authController.createSuperAdmin);

//test-permissions
router.post('/get-permissions', sampleController.getPermissionForRoleId);

//change password
router.post("/change-password", authenticate, authController.changePassword);

//forgot password
router.post("/forgot-password", authController.forgotPassword);

//logout
router.post("/logout", authenticate, authController.logout);

// admin forgot password
router.post('/admin-forgot-password', authController.adminForgotPassword);
router.post('/admin-verify-otp', authController.adminVerifyOtp);

//read os app versions
router.get('/get-app-version', authController.getAppVersion);

module.exports = router;
