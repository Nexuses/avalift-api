const express = require('express');
const router = express.Router();
const authenticate = require('../middlewares/authMiddleware');
const authorize = require('../middlewares/authorize');
const adminController = require('../controllers/adminController');
const vehicleController = require('../controllers/vehicleController');
const pricingController = require('../controllers/pricingController');
const userController = require('../controllers/userController');
const chauffeurAdminPanelController = require('../controllers/chauffeurAdminPanelController');
const ridesAdminpanelController = require('../controllers/ridesAdminPanelController');
const { uploadDocumentsMiddleware } = require("../services/uploadDocumentService");
const pdRidesController = require('../controllers/pdRidesController');
const paymentsController = require('../controllers/paymentsController');
const rideController = require('../controllers/rideController');
const organizationController = require('../controllers/organizationController');
const multer = require('multer');
const storage = multer.memoryStorage();
const upload = multer({ storage });
router.use(authenticate);
const invoiceController = require('../controllers/invoiceController');
const vehicleMasterController = require('../controllers/vehicleMasterController');
const chauffeurRidesController = require('../controllers/chauffeurRidesController');
const bankDetailController = require('../controllers/bankDetailController');
const tipController = require('../controllers/tipController');

router.post("/create-pd-chauffeur", upload.any(), adminController.createPdChauffeurUser);
router.put(
  "/update-pd-chauffeur/:userId",
  upload.any(),
  adminController.updatePdChauffeurUser
);

router.post("/add-pricing", authorize('orders.create'), pricingController.addPricing);
router.patch("/update-pricing", pricingController.editPricing);
router.post("/get-pricing", pricingController.getPricing);
router.get("/get-all-chauffeur-rides-by-id", authorize('drivers.view'), chauffeurAdminPanelController.getAllRidesOfChauffeur);
router.post("/get-all-chauffeur-rides/:page/:limit", authorize('drivers.view'), ridesAdminpanelController.getallChauffeurRides);
router.post("/get-all-rides/:page/:limit", authorize('orders.view'), ridesAdminpanelController.getallRides);

router.post("/create-vehicle", authorize('vehicles.create'), upload.array("media_data", 8),vehicleController.createVehicleByAdmin);
router.put('/update-vehicle/:id', authorize('vehicles.update'),upload.array("media_data", 8), vehicleController.updateVehicleByAdmin);
router.post("/create-customer", authorize('users.create'), adminController.createCustomer);
router.put("/update-customer/:customer_id", authorize('users.update'), adminController.updateCustomer);
router.post('/assign-chauffeur-to-ride/:ride_id', authorize('drivers.manage'), adminController.assignChauffeurToRide);
router.post('/re-assign-chauffeur/:ride_id', authorize('drivers.manage'), adminController.reassignChauffeurToRide);

router.post('/create-ride-for-customer/:user_id', authorize('orders.create'), adminController.adminCreateRide);
router.post('/create-ride-for-organisation', authorize('orders.create'), adminController.organisationAdminCreateRide);

router.get('/get-available-chauffeurs', authorize('drivers.view'), chauffeurAdminPanelController.getAvailableChauffeurs);
router.post(`/rides/cancel`, authorize('orders.update'), adminController.adminCancelRide);
router.post(`/rides/chauffeur-on-the-way`, authorize('orders.update'), adminController.adminMarkChauffeurOnTheWay);
router.post(`/rides/chauffeur-reached-customer`, authorize('orders.update'), adminController.adminMarkChauffeurReached);
router.post(`/rides/start-customer-ride`, authorize('orders.update'), adminController.adminStartCustomerRide);
router.post(`/rides/complete-customer-ride`, authorize('orders.update'), adminController.adminCompleteCustomerRide);
router.get('/notification-list-admin/:page/:limit', authorize('orders.view'), adminController.adminNotificationListing);

router.post('/get-ride-by-status', authorize('orders.view'), adminController.getRideByStatus);
router.get('/show-fares', authorize('orders.view'), adminController.fetchFare);
router.post('/admin-assign-pd', authorize('drivers.manage'), pdRidesController.assignPD);
router.post('/admin-reassign-pd', authorize('drivers.manage'), pdRidesController.reAssignPD);

router.post('/get-user-wallet-details', authorize('users.view'), paymentsController.userWalletDetails);
router.get('/get-pd-rides/:pd_id', authorize('orders.view'), pdRidesController.getAllRides);
router.post('/revenue-report', authorize('reports.generate'), ridesAdminpanelController.getRevenueReport);
router.post('/revenue-by-method', authorize('reports.generate'), ridesAdminpanelController.getRevenueDetails);
router.post('/get-chauffeur-ride-by-id', authorize('orders.view'), rideController.getChauffeurRidebyId);
router.post('/schedule-chauffeur-assign', authorize('drivers.manage'), ridesAdminpanelController.assignChauffeurToScheduledRide);
router.post('/schedule-chauffeur-reassign', authorize('drivers.manage'), ridesAdminpanelController.reAssignChauffeurToScheduledRide);

router.post('/get-user-wallet-balance', authorize('users.view'), paymentsController.usersWalletBalance);
router.post('/get-corporate-ride-payments', authorize('orders.view'), paymentsController.getCorporatePayments);
router.post('/get-chauffeur-wallet-balance', authorize('drivers.view'), paymentsController.getChauffeurWallets);
router.post('/get-pd-wallet-balance', authorize('drivers.view'), paymentsController.getPDWallets);
router.post('/org-payment-handling', authorize('orders.update'), paymentsController.orgSettlePaymentProcess);
router.post('/generate-invoice', authorize('reports.generate'), invoiceController.generateInvoice);
router.post('/invoice-payment', authorize('orders.update'), invoiceController.invoicePayment);
router.post('/get-invoices', authorize('orders.view'), invoiceController.getInvoices);
router.post('/get-invoice-by-id', authorize('orders.view'), invoiceController.getInvoicebyId);
router.post('/get-organisational-ride', authorize('orders.view'), invoiceController.getOrgRides);
router.post('/get-all-chauffeurs-with-pd', authorize('drivers.view'), pdRidesController.getAllChauffeursWithPD);
router.post('/get-credited-rides', authorize('orders.view'), invoiceController.getCreditedRides);
router.post('/get-all-users-log-summary', authorize('users.view'), adminController.fetchUserLogSummary);
router.delete('/delete-user', authorize('users.delete'), adminController.deleteUser);
router.post('/get-chauffeur-wallet-history', authorize('drivers.view'), paymentsController.getChauffeurWalletHistory);
router.post('/get-pd-wallet-history', authorize('drivers.view'), paymentsController.getPDWalletHistory);
router.post('/get-admin-wallet-history', authorize('reports.view'), paymentsController.getAdminWalletHistory);
router.get('/get-available-admin-roles', authorize('roles.view'), adminController.fetchAvailableAdminRoles);
router.post('/create-admin-user', authorize('roles.create'), adminController.createAdminUser);
router.post('/update-admin-user/:id', authorize('roles.update'), adminController.updateAdminUser);
router.get('/get-admin-user-by-id/:id', authorize('roles.view'), adminController.getAdminUsersById);
router.get('/get-all-admin-users', authorize('roles.view'), adminController.getAdminUsers);
router.delete('/delete-admin-user/:id', authorize('roles.delete'), adminController.deleteAdminUser);
router.post('/create-schedule-ride-from-admin/:user_id', authorize('orders.create'), adminController.adminCreateScheduledRide);
router.post('/export-rides-excel', authorize('reports.generate'), ridesAdminpanelController.exportRidesToExcel);
router.post('/re-schedule-ride-from-admin', authorize('orders.update'), adminController.adminReScheduleRide);
router.post('/get-commission-details/:page/:limit', authorize('reports.view'), adminController.getCommission);
router.post('/export-chauffeur-walletlogs', authorize('reports.generate'), adminController.exportChauffeurWalletLogs);
router.post('/export-pd-walletlogs', authorize('reports.generate'), adminController.exportPDWalletLogs);
router.post('/admin-cash-payment', authorize('orders.update'), paymentsController.adminCashRidePayment);
router.post('/export-admin-walletlogs', authorize('reports.generate'), adminController.exportAdminWalletLogs);
router.post('/export-vehicle-audit', authorize('reports.generate'), adminController.exportVehicleAudit);
router.post('/admin-cancel-chauffeur-pd-ride', authorize('orders.update'), adminController.adminCancelChauffeurPdRide);
router.post('/get-chauffeur-wallet-by-id', authorize('drivers.view'), paymentsController.getChauffeurWalletById);
router.post('/create-schedule-ride-from-org-user/:user_id', authorize('orders.create'), organizationController.adminCreateOrganizationScheduledRide);
router.post('/admin-wallet-ride-payment', authorize('orders.update'), paymentsController.adminRideWalletPayment);
router.post('/admin-quick-link-payment', authorize('orders.update'), paymentsController.createQuickLinkPayment);
router.post('/organization-pending-payment-amount', authorize('orders.view'), organizationController.pendingPaymentAmount);
router.post('/get-pd-wallet-by-id', authorize('drivers.view'), paymentsController.getPDWalletById);
router.post('/admin-reset-password', authorize('users.update'), adminController.adminResetPassword);
router.post('/make-user-active-inactive', authorize('users.update'), adminController.adminMakeUserActiveOrInactive);
router.post('/admin-quick-link-payment-response',authorize('orders.update'), paymentsController.createQuickLinkPaymentResponse);
router.post('/add-new-region', authorize('regions.create'), adminController.addNewRegion);
router.post('/edit-region', authorize('regions.update'), adminController.editRegion);
router.get('/get-plate-code-region',authorize('orders.view'), adminController.getPlateCodeRegion);
router.post('/get-chauffeur-revenue-by-id', paymentsController.getChauffeurRevenueById);

router.get('/chauffeur-review/:chauffeur_id/:page/:limit', chauffeurRidesController.getChauffeurReviews);
router.get('/vehicle/models/:brand', vehicleMasterController.getModelsForAdminPanel);
router.post('/get-coupon-usage-summary', paymentsController.getCouponUsageSummary);
router.delete('/delete-vehicle/:id', vehicleController.AdminDeleteVehicle);
router.delete('/delete-organization-vehicle/:id', vehicleController.orgUserDeleteVehicle);
router.post('/add-bank-account-details', bankDetailController.createBankDetail);
router.post('/get-bank-account-details-by-id', bankDetailController.getBankDetailById);
router.get('/get-all-bank-details', bankDetailController.getAllBankDetails);
router.put('/update-bank-account-details/:id', bankDetailController.updateBankDetail);
router.delete('/delete-bank-account-details/:id', bankDetailController.deleteBankDetail);

router.get("/admin-statuses", adminController.getAdminStatuses);


//locationMetrics
router.post('/get-location-metrics', ridesAdminpanelController.distanceMetricsController);
router.post('/get-coupon-usage-details', paymentsController.getCouponWiseUsageDetails);

router.post('/send-bulk-notification', authorize('users.create'), adminController.sendBulkNotification);

router.get('/get-bulk-notification', authorize('users.create'), adminController.getBulkNotification);

router.post('/get-all-chauffeur-tip-wallet-balances/:page/:limit', authorize('drivers.view'), tipController.getChauffeurTipWalletBalances);
router.post('/get-chauffeur-tip-wallet-logs-by-id/:page/:limit', authorize('drivers.view'), tipController.getChauffeurTipWalletLogsById);
router.post('/tip-payout', authorize('drivers.manage'), tipController.tipPayout);

module.exports = router;
