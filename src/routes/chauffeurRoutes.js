// src/routes/chauffeurRoutes.js

const express = require('express');
const router = express.Router();
const authenticate = require('../middlewares/authMiddleware');
const authorize = require('../middlewares/authorize');
const chauffeurController = require('../controllers/chauffeurController');
const pdRidesController = require('../controllers/pdRidesController');
const {uploadAfterRideImagesMiddleware, uploadBeforeRideImagesMiddleware} = require('../services/uploadDocumentService');
const chauffeurCustomerRides = require('../controllers/chauffeurCustomerRidesController');
const chauffeurRidesController = require('../controllers/chauffeurRidesController');
const multer = require("multer");
const storage = multer.memoryStorage();
const upload = multer({ storage });

router.use(authenticate);

router.get('/notification-list/:page/:limit', authorize('drivers.view'), chauffeurController.fetchChauffeurNotifications);
router.get('/ride-history/:page/:limit', authorize('drivers.view'), chauffeurController.fetchChauffeurRideHistory);
router.post('/check-ride-status', authorize('drivers.view'), chauffeurController.fetchRideStatus);
router.get('/top-chauffeurs-list', authorize('drivers.view'), chauffeurRidesController.getTopChauffeurs);

router.post('/upload-ride-images', authorize('drivers.manage'), upload.array("afterRide", 10), chauffeurCustomerRides.uploadImages);
router.post("/upload-before-ride-images", authorize('drivers.manage'), upload.array("beforeRide", 10), chauffeurCustomerRides.uploadBeforeRideImages);
router.post('/cancel-pickup-req', authorize('drivers.manage'), chauffeurController.cancelReq);
router.post('/check-pd-ride-status', authorize('drivers.view'), pdRidesController.fetchPdRideStatus);
router.post('/get-chauffeur-summary', authorize('drivers.view'), chauffeurController.chauffeurSummary);
router.get('/fetch-nearby-pd', authorize('drivers.view'), chauffeurController.fetchNearbyPds);
router.get('/fetch-active-chauffeur-pd-rides', authorize('drivers.view'), chauffeurController.fetchActiveChauffeurPdRides);

router.post('/activate-apple-pay-indication', authenticate, chauffeurController.activateApplePayIndication);
router.post('/get-apple-pay-status', authenticate, chauffeurController.checkApplePayPayment);

module.exports = router;
