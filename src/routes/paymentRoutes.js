const express = require('express');
const router = express.Router();
const authenticate = require('../middlewares/authMiddleware');
const authorize = require('../middlewares/authorize');
const paymentsController = require('../controllers/paymentsController');
const { auth } = require('firebase-admin');

router.post('/verify-payment', authenticate, authorize('orders.create'), paymentsController.verifyPayment);
router.get('/verify-payment-success', paymentsController.verifyPaymentSuccess);
router.get('/verify-payment-process', paymentsController.verifyPaymentProcess);
router.get('/verify-payment-failure', paymentsController.verifyPaymentDeclined);
router.get('/verify-payment-cancelled', paymentsController.verifyPaymentCancelled);

router.get('/verify-quick-link-payment-success', paymentsController.verifyQuickLinkPaymentSuccess);
router.get('/verify-quick-link-payment-process', paymentsController.verifyQuickLinkPaymentProcess);
router.get('/verify-quick-link-payment-failure', paymentsController.verifyQuickLinkPaymentDeclined);
router.get('/verify-quick-link-payment-cancelled', paymentsController.verifyQuickLinkPaymentCancelled);

// Sale Payment Route
router.post('/sale-payment', authenticate, authorize('orders.update'), paymentsController.salePayment);

// User Cards and Payment Method Routes
router.get('/user-cards', authenticate, authorize('users.view'), paymentsController.getUserCards);
router.post('/select-payment-method', authenticate, authorize('users.view'), paymentsController.selectPaymentMethod);
router.post('/remove-user-card', authenticate, authorize('users.update'), paymentsController.removeUserCardById);

// Cash Payment Route
router.post('/cash-payment', authenticate, authorize('drivers.manage'), paymentsController.cashRidePayment);

// Chauffeur Ride Invoice
router.post('/driver-ride-invoice', authenticate, authorize('drivers.view'), paymentsController.getRidesForChauffeur);

// Payment Status and Expense Details Routes
router.post('/get-payment-status', authenticate, authorize('drivers.view'), paymentsController.getPaymentStatus);
router.get('/get-expense-details', authenticate, authorize('users.view'), paymentsController.getExpenseDetails);

// Wallet Top Up Route
router.post('/wallet-top-up', authenticate, authorize('orders.create'), paymentsController.walletTopup);

// Wallet Ride Payment Route
router.post('/wallet-ride-payment', authenticate, authorize('orders.update'), paymentsController.rideWalletPayment);

// Customer Wallet Details and History Routes
router.get('/get-user-wallet-detail', authenticate, authorize('users.view'), paymentsController.userWalletDetailsById);
router.get('/get-customer-wallet-history', authenticate, authorize('users.view'), paymentsController.getCustomerWalletHistory);

// Cancel Ride Route
router.post('/cancel-ride', authenticate, authorize('orders.update'), paymentsController.cancelRideProcessPayment);

// Customer Wallet Creation
router.post('/create-customer-wallet', authenticate, authorize('users.create'), paymentsController.createCustomerWallet);

// Corporate Customer Wallet Routes
router.post('/create-corporate-customer-wallet', authenticate, authorize('users.create'), paymentsController.corporateCustomerWallet);
router.post('/corporate-wallet-ride-payment', authenticate, authorize('orders.update'), paymentsController.corporateRideWalletPayment);

// Payment Type Routes
router.post('/create-payment-type', authenticate, authorize('orders.create'), paymentsController.createPaymentType);

// Chauffeur Wallet and Cash Handling Routes
router.post('/create-chauffeur-wallet', authenticate, authorize('drivers.manage'), paymentsController.createChauffeurWallet);
router.get('/get-chauffeur-cash-handling-details', authenticate, authorize('drivers.view'), paymentsController.getChauffeurCashDetails);

//chauffeur cash handling process app
router.post('/chauffeur-pd-cash-handling', authenticate, authorize('drivers.manage'), paymentsController.chaufferCashHandOverProcess);

// PD Cash Handling Routes
router.post('/pd-admin-cash-handling', authenticate, authorize('drivers.manage'), paymentsController.pdCashHandOverProcess);
router.post('/get-pd-users-list', authenticate, authorize('drivers.view'), paymentsController.getPDUsersList);
router.get('/get-pd-cash-handling-details', authenticate, authorize('drivers.view'), paymentsController.getPDCashDetails);

// Admin Users List Route
router.post('/get-admin-users-list', authenticate, authorize('roles.view'), paymentsController.getAdminUsersList);

// Apple Pay for iOS Route
router.post('/customer-apple-pay-invoke', authenticate, authorize('orders.create'), paymentsController.customerApplePayInvoke);

//refund payment
router.post('/refund-payment', authenticate, paymentsController.refundPayment);

router.post('/get-refund-topup-trans', authenticate, paymentsController.getTopupTransRefByUserId);

// Get Chauffeur Hand Over Details app
router.post('/get-chauffeur-hand-over-details-by-id', authenticate, authorize('drivers.manage'), paymentsController.getChauffeurHandOverDetails);

// Get PD Hand Over Details app
router.post('/get-pd-hand-over-details-by-id', authenticate, authorize('drivers.manage'), paymentsController.getPDHandOverDetails);

// get user cards by id for admin
router.post('/get-user-cards-by-id', authenticate, authorize('users.view'), paymentsController.getUserCardsById);

module.exports = router;
