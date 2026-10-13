const express = require("express");
const router = express.Router();

const customerRidesController = require("../controllers/customerRidesController");
const chauffeurRidesController = require("../controllers/chauffeurRidesController");
const chauffeurCustomerRidesController = require("../controllers/chauffeurCustomerRidesController");
const pdRidesController = require("../controllers/pdRidesController");
const rideController = require('../controllers/rideController');
const pricingController = require("../controllers/pricingController");
const tipController = require("../controllers/tipController");
const authenticate = require('../middlewares/authMiddleware');
const authorize = require('../middlewares/authorize');

router.use(authenticate);

// Customer Routes
router.post("/customers/request", authorize('orders.create'), customerRidesController.requestRide);
router.post("/customers/calculate-estimate", authorize('orders.view'), customerRidesController.calculateEstimate);
router.post("/customers/complete", authorize('orders.create'), customerRidesController.initiateRideCompletion);
router.post("/customers/cancel-ride", authorize('orders.create'), customerRidesController.cancelRide);
router.post("/customers/schedule-request", authorize('orders.create'), customerRidesController.scheduledRide);
router.post("/customers/reschedule-request", authorize('orders.create'), customerRidesController.reScheduledRide);
router.get("/ride-history/:page/:limit", authorize('orders.view'), rideController.getRideHistory);
router.put("/customers/change-extend-rate-type", authorize('orders.update'), customerRidesController.changeRateType);
router.post("/customers/change-destination", customerRidesController.changeDestination);
router.post("/customers/rides/is-current-ride", authorize('orders.view'), customerRidesController.isCurrentRide);
router.post("/customers/rides/add-tip", authorize('orders.update'), tipController.addTip);


// Chauffeur Routes
router.post("/chauffeurs", authorize('drivers.manage'), chauffeurRidesController.requestRide);
router.post("/chauffeurs/drop", authorize('drivers.manage'), chauffeurRidesController.requestDrop);
router.post("/chauffeurs/respond", authorize('drivers.manage'), chauffeurCustomerRidesController.respondToRide);
router.put("/chauffeurs/status/on-the-way", authorize('drivers.manage'), rideController.updateRideStatusController);
router.post("/chauffeurs/complete", authorize('drivers.manage'), chauffeurCustomerRidesController.completeRide);
router.post("/chauffeurs/reached", authorize('drivers.manage'), chauffeurCustomerRidesController.markChauffeurReached);
router.post("/chauffeurs/start-ride", authorize('drivers.manage'), chauffeurCustomerRidesController.startCustomerRide);
router.post("/chauffeurs/other-charges", authorize('drivers.view'), pricingController.getOtherChargesForOrg);
router.get("/chauffeurs/active-ride", authorize('drivers.view'), chauffeurCustomerRidesController.getActiveRideForChauffeur);
router.get("/chauffeurs/active-ride/customer-extra-details", authorize("drivers.view"), chauffeurCustomerRidesController.getCustomerExtraDetailsFromActiveRide);
router.get("/chauffeurs/scheduled-ride", authorize('drivers.view'), chauffeurCustomerRidesController.getScheduleRideForChauffeur);
router.post("/chauffeurs/create-audit", authorize('drivers.manage'), chauffeurCustomerRidesController.createAudit);
//router.post("/chauffeurs/rides/add-tip", authorize('orders.update'), tipController.addTip);

// PD Routes
router.post("/pd/:pdRideId/chauffeurs", authorize('drivers.manage'), pdRidesController.addChauffeur);
router.delete("/pd/:pdRideId/chauffeurs/:chauffeurId", authorize('drivers.manage'), pdRidesController.dropChauffeur);

router.post('/pd-accept-ride-request', authorize('drivers.manage'), rideController.handleRideRequest);
router.post('/pd-picked-chauffeur', authorize('drivers.manage'), pdRidesController.pickedChauffeur);
router.post('/pd-drop-chauffeur', authorize('drivers.manage'), pdRidesController.droppedChauffeur);
router.get('/get-pd-ride-history/:page/:limit', authorize('drivers.view'), pdRidesController.pickedAndDroppedChauffeurs);
router.post('/pd-history-admin', authorize('drivers.view'), rideController.getpdRideHistory);
router.post('/get-chauffeurs-with-pd', authorize('drivers.view'), rideController.getChauffeursWithPD);

router.post('/get-customer-status/:customer_id', authorize('users.view'), customerRidesController.getCustomerStatus);
router.post('/get-ride-by-id/:ride_id', authorize('drivers.view'), rideController.getRidebyId);


module.exports = router;
