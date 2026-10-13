require('dotenv').config();
const PaymentsValidator = require('../validators/paymentsValidator');
//const PaymentsDAO = require('../dao/paymentsDAO');
const { getCountryNameByCode, getCardLogoUrl, getPaymentStatusName, generateRandomAlphaNumericText } = require("../helpers/paymentHelper");
const axios = require('axios');
const xmlbuilder = require('xmlbuilder');
const xml2js = require('xml2js');
const { ValidationError } = require('sequelize');
const paymentsDAO = require('../dao/paymentsDAO');
const ridesDAO = require('../dao/ridesDAO');
const pricingDAO = require("../dao/pricingsDAO")
const { queuePushNotification } = require("../adaptors/notificationService");
const {
    buildCustomerRideRequestNotificationData,
} = require("./customerNotificationDataBuilder");
const {
    getPricingForOrg,
} = require("../dao/pricingsDAO");
const { calculateEstimatedAmount } = require("../utils/calculateRate");
const moment = require('moment');
const config = require('../config/provider');
const { Console } = require('winston/lib/winston/transports');
const { custom } = require('joi');
const { parse } = require('dotenv');

const { addServerLog } = require('./serverLogsService');

const c_r_a_status_name = 'Authorised';
//const aStatusName = 'Authorised';
const c_r_p_status_name = 'Payment Initiated';
const c_v_order_payment_type = 'verify';
const c_s_order_payment_type = 'sale';
const c_verify_amount = 0;
//const c_card_verify_payment_type = 'Card-Verify';
//const pStatusName = 'Paid';
//const c_r_c_status_name = 'Completed';  //constant ride completed status name
const c_r_c_status_name = 'Review-Pending';  //constant ride completed status name
const c_w_t_status_name = 'Topup'; //constant for wallet top up
const c_w_p_status_name = 'Payment'; //constant for wallet payment
const c_w_c_transaction_type = 'Wallet-Credit';
const c_w_d_transaction_type = 'Wallet-Debit';
const c_c_d_transaction_type = 'Cash-Debit';
const c_c_de_transaction_type = 'Card-Debit';
const c_c_p_status_name = 'Pending';
const c_c_h_status_name = 'Completed';
const c_c_payment_type_name = 'Cash';
const c_s_payment_type_name = 'Sale';
const c_c_r_p_transaction_type = 'Cancel-Ride-Penalty';
const c_w_a_transaction_type = 'Cash-Wallet-Adjustment';
const cr_w_a_transaction_type = 'Card-Wallet-Adjustment';
const c_c_v_status_name = 'Card-Verified';
const c_p_c_status_name = 'Payment-Completed';
const c_p_p_status_name = 'Payment-Pending';
const c_w_c_p_status_name = 'Corporate-Payment'; //constant for wallet payment
const c_r_s_status_name = 'started'; //ride status - lower case
const c_r_e_status_name = 'payment initiated';  //ride status - lower case
const c_c_c_transaction_type = 'Cash-Credit';

const c_a_p_status_name = 'Apple-Pay-Payment-Pending';
const c_a_c_status_name = 'Apple-Pay-Payment-Completed';

const getRideKeyInfo = async (user_id, ride_id) => {
    // const PK = `CUSTOMER`;
    // const SK = `${user_id}#${ride_id}`;
    const PK = `${user_id}`;
    const SK = `#${ride_id}`;
    return { PK, SK };
}

const walletTopupSuccess = async (salePaymentInfo, rideInfo) => {
    try {
        let walletOutput = {};
        let result = salePaymentInfo.resultPaymentInfo;
        if (result && result.remote && result.remote.auth && result.remote.payment && result.remote.auth.status === 'A') {
            const statusCode = await paymentsDAO.findStatusName(result.remote.auth.message);
            let status_code_id;
            if (statusCode && statusCode.id > 0) {
                status_code_id = statusCode.id;
            }
            rideInfo.metadata = result.remote;
            rideInfo.transaction_ref = result.remote.auth.tranref;
            rideInfo.status_code_id = status_code_id;
            let walletInfo = {};
            walletInfo.user_id = rideInfo.user_id;
            walletInfo.top_up_amount = rideInfo.amount;
            walletInfo.transaction_type_id = rideInfo.wallet_credit_status_id;
            walletInfo.transaction_reference = result.remote.auth.tranref;
            walletInfo.payment_type_id = rideInfo.payment_type_id;
            //console.log('h1');
            const newWalletRec = await paymentsDAO.createWalletRecord(rideInfo, walletInfo);
            console.log('Wallet Rec', newWalletRec);
            if (newWalletRec && newWalletRec.success) {
                walletOutput.response = newWalletRec && newWalletRec.wallet_balance;
                return {
                    success: true,
                    data: {
                        //wallet_payment_id: newWalletRec.wallet_payment_id,
                        walletOutput
                    }
                };
            } else {
                return {
                    success: false,
                    data: {
                        walletInfo
                    }
                };
            }
        }
        else {
            return {
                success: false, data:
                    { result }
            };
        }
    } catch (error) {
        //console.log('wallet topup success error -', error.message);
        await addServerLog({
            log_level: "ERROR",
            error_message: `wallet top up success error - ${error.message}.`
        });
        return {
            message: 'Failed to process Wallet Top up.',
            success: false,
            data: {},
            error_status_code: 500,
            error: error.message
        }
    }

}


const searchData = async (result, search_string) => {
    try {
        if (!search_string || typeof search_string !== 'string') {
            return result;
        }

        const sanitizedSearchString = search_string.trim().toLowerCase();

        //console.log(result.customerWalletRec.data);
        await Promise.all(result.customerWalletRec.data.map(async (userPayment) => {
            //console.log('1');
            //console.log(userPayment.user_id);
            //console.log('1.1');
            return (
                userPayment.user_id?.toString().toLowerCase().includes(sanitizedSearchString) ||
                userPayment.User.first_name?.toLowerCase().includes(sanitizedSearchString) ||
                userPayment.User.last_name?.toLowerCase().includes(sanitizedSearchString)
            );
        }));
        //console.log('2');



        return result.customerWalletRec.data.filter(user => {
            console.log('jj', user.CustomerWallet);
            return (
                user.user_id?.toString().toLowerCase().includes(sanitizedSearchString) ||
                user.User.first_name?.toLowerCase().includes(sanitizedSearchString) ||
                user.User.last_name?.toLowerCase().includes(sanitizedSearchString)
            );
        });
    } catch (error) {
        console.log('search data error -', error.message);
        await addServerLog({
            log_level: "ERROR",
            error_message: `search data error - ${error.message}.`
        });
    }

}

const getWalletDetails = async (start_date, end_date, page = 1, limit = 5, search_string = "") => {
    try {
        console.log('getWalletDetails input', start_date, end_date, page, limit, search_string);
        if (isValidDate(start_date) && isValidDate(end_date)) {
            if (start_date > end_date) {
                return {
                    success: false,
                    message: "Start Date cannot be greater than End date.",
                    data: {}
                }
            }
        }

        const result = await paymentsDAO.findUserWallet(start_date, end_date, page, limit, search_string);

        const data = {
            wallets: [],
        };

        return {
            success: true,
            message: "Wallet details fetched successfully",
            data: result
        }
    } catch (error) {
        console.log('get wallet details error -', error.message);
        await addServerLog({
            log_level: "ERROR",
            error_message: `get wallet details error - ${error.message}.`
        });
        return {
            success: false,
            message: "Error while fetching Wallet details.",
            data: {}
        }
    }
}


//wallet payment cash payment
const validateInputData = async (inputData) => {
    try {
        const {
            customer_id,
            ride_id, payment_type } = inputData;
        let card_slug_id;

        if (payment_type.toLowerCase() === 'card') {
            const { slug_id } = inputData;
            card_slug_id = slug_id;
        }
        let paymentOutput = {};
        //get customer information
        const customer = await paymentsDAO.findUserById(customer_id);
        if (customer === null) {
            paymentOutput = {};
            paymentOutput.error = `The Customer ${customer_id} is not found.`;
            paymentOutput.success = false;
            throw new Error(paymentOutput.error);
        }

        //get particular payment type record
        let payment_type_method;
        let paymentAPPStatus;
        if (payment_type.toLowerCase() === 'applepay') {
            payment_type_method = await paymentsDAO.getPaymentTypeMethodByName(true, false, payment_type);

            paymentAPPStatus = await paymentsDAO.findStatusName(c_a_p_status_name);
            if (!paymentAPPStatus) {
                paymentOutput = {};
                paymentOutput.error = `Status for ${c_p_c_status_name} not set.`;
                paymentOutput.success = false;
                throw new Error(paymentOutput.error);
            }
        } else {
            payment_type_method = await paymentsDAO.getPaymentTypeMethodByName(true, true, payment_type);
        }

        if (!payment_type_method) {
            paymentOutput = {};
            paymentOutput.error = `Payment Type Method ${payment_type} is not found.`;
            paymentOutput.success = false;
            throw new Error(paymentOutput.error);
        }
        let paymentCompletedStatus;

        paymentCompletedStatus = await paymentsDAO.findStatusName(c_p_c_status_name);
        if (!paymentCompletedStatus) {
            paymentOutput = {};
            paymentOutput.error = `Status for ${c_p_c_status_name} not set.`;
            paymentOutput.success = false;
            throw new Error(paymentOutput.error);
        }

        let cashDStatusCode, cashPStatusCode, cashWalletAStatusCode, cashCreditStatusCode;
        if (payment_type.toLowerCase() === 'cash') {
            //get status id from status table for Cash Debit status
            cashDStatusCode = await paymentsDAO.findStatusName(c_c_d_transaction_type);
            if (!cashDStatusCode) {
                paymentOutput = {};
                paymentOutput.error = `Status for Cash Debit not set.`;
                paymentOutput.success = false;
                throw new Error(paymentOutput.error);
            }
            //Pening status record
            //get status id from status table for Cash Debit status
            cashPStatusCode = await paymentsDAO.findStatusName(c_c_p_status_name);
            if (!cashPStatusCode) {
                paymentOutput = {};
                paymentOutput.error = `Status code ${c_c_p_status_name} not set.`;
                paymentOutput.success = false;
                throw new Error(paymentOutput.error);
            }

            //get status id from status table for Wallet Credit status
            cashWalletAStatusCode = await paymentsDAO.findStatusName(c_w_a_transaction_type);
            if (!cashWalletAStatusCode) {
                paymentOutput = {};
                paymentOutput.error = `Status for Cash Wallet Adjustment not set.`;
                paymentOutput.success = false;
                throw new Error(paymentOutput.error);
            }

            cashCreditStatusCode = await paymentsDAO.findStatusName(c_c_c_transaction_type);
            if (!cashCreditStatusCode) {
                paymentOutput = {};
                paymentOutput.error = `Status for Cash Credit not set.`;
                paymentOutput.success = false;
                throw new Error(paymentOutput.error);
            }
        }
        let walletDStatusCode, walletCStatusCode;
        if (payment_type.toLowerCase() === 'wallet') {
            //get status id from status table for Wallet Credit status
            walletDStatusCode = await paymentsDAO.findStatusName(c_w_d_transaction_type);
            if (!walletDStatusCode) {
                paymentOutput = {};
                paymentOutput.error = `Status for Wallet Payment not set.`;
                paymentOutput.success = false;
                throw new Error(paymentOutput.error);
            }
            //get status id from status table for Wallet Credit status
            walletCStatusCode = await paymentsDAO.findStatusName(c_w_c_transaction_type);
            if (!walletCStatusCode) {
                paymentOutput = {};
                paymentOutput.error = `Status for Wallet Top up not set.`;
                paymentOutput.success = false;
                throw new Error(paymentOutput.error);
            }
            let userInfo = {
                user_id: customer_id,
                w_d_transaction_type_id: walletDStatusCode.id,
                w_c_transaction_type_id: walletCStatusCode.id,
            };

            //zero balance
            const checkZeroNegBal = await paymentsDAO.findCustomerBalance(userInfo);

            let wallet_balance_amount = checkZeroNegBal && parseFloat(checkZeroNegBal.wallet_balance);
            if (checkZeroNegBal && wallet_balance_amount <= 0) {
                paymentOutput = {};
                paymentOutput.error = `Please top up the Wallet as the Balance is less than or equal to 0.`;
                paymentOutput.success = false;
                paymentOutput.wallet_balance = `${process.env.CURRENCY_CODE} ${checkZeroNegBal.wallet_balance}`
                throw new Error(paymentOutput.error);
            }
            if (!checkZeroNegBal) {
                paymentOutput = {};
                paymentOutput.error = `Wallet is not yet created for the user.`;
                paymentOutput.success = false;
                paymentOutput.wallet_balance = `${process.env.CURRENCY_CODE}`
                throw new Error(paymentOutput.error);
            }
        }
        let cardDStatusCode, payment_method, customerRec, cardAuthorisedStatusCode, cardWalletAStatusCode;
        if (payment_type.toLowerCase() === 'card') {
            //get status id from status table for Authorised status
            cardAuthorisedStatusCode = await paymentsDAO.findStatusName(c_r_a_status_name);
            if (!cardAuthorisedStatusCode) {
                paymentOutput = {};
                paymentOutput.error = `Status for Authorised not set.`;
                paymentOutput.success = false;
                throw new Error(paymentOutput.error);
            }
            //get status id from status table for Card Debit status
            cardDStatusCode = await paymentsDAO.findStatusName(c_c_de_transaction_type);
            if (!cardDStatusCode) {
                paymentOutput = {};
                paymentOutput.error = `Status for Card Debit not set.`;
                paymentOutput.success = false;
                throw new Error(paymentOutput.error);
            }
            //Card Sale
            const telr_payment_method = `${payment_type}-${c_s_order_payment_type}`;
            payment_method = await paymentsDAO.getPaymentTypeMethodByName(true, false, telr_payment_method);

            if (!payment_method) {
                paymentOutput = {};
                paymentOutput.error = `Payment Method ${telr_payment_method} is not defined.`;
                paymentOutput.success = false;
                throw new Error(paymentOutput.error);
            }
            //check if customer payment verification is completed - Card-Verify

            customerRec = await paymentsDAO.findPaymentByUserAndTransaction(customer_id, card_slug_id);

            if (!customerRec) {
                paymentOutput = {};
                paymentOutput.error = `Customer Card Reference is invalid.`;
                paymentOutput.success = false;
                throw new Error(paymentOutput.error);
            }
            if (cardAuthorisedStatusCode) {
                if (customerRec.status_id !== cardAuthorisedStatusCode.id) {
                    paymentOutput = {};
                    paymentOutput.error = `Customer Payment Verification is not completed.`;
                    paymentOutput.success = false;
                    throw new Error(paymentOutput.error);
                }
            }
            //get status id from status table for Wallet Credit status
            cardWalletAStatusCode = await paymentsDAO.findStatusName(cr_w_a_transaction_type);
            if (!cardWalletAStatusCode) {
                paymentOutput = {};
                paymentOutput.error = `Status for Card Wallet Adjustment not set.`;
                paymentOutput.success = false;
                throw new Error(paymentOutput.error);
            }
        }

        if (payment_type.toLowerCase() === 'applepay') {
            //get status id from status table for Wallet Credit status
            walletDStatusCode = await paymentsDAO.findStatusName(c_w_d_transaction_type);
            if (!walletDStatusCode) {
                paymentOutput = {};
                paymentOutput.error = `Status for Wallet Payment not set.`;
                paymentOutput.success = false;
                throw new Error(paymentOutput.error);
            }

            cardAuthorisedStatusCode = await paymentsDAO.findStatusName(c_r_a_status_name);
            if (!cardAuthorisedStatusCode) {
                paymentOutput = {};
                paymentOutput.error = `Status for Authorised not set.`;
                paymentOutput.success = false;
                throw new Error(paymentOutput.error);
            }
        }

        // Check for existing trip for customer
        const { PK, SK } = await getRideKeyInfo(customer_id, ride_id);
        const rideItem = await ridesDAO.getRide(PK, SK);

        if (!rideItem) {
            paymentOutput = {};
            paymentOutput.error = `Ride not found.`;
            paymentOutput.success = false;
            throw new Error(paymentOutput.error);
        }

        // If the ride already has completed status
        if (rideItem.status.toLowerCase() === c_r_c_status_name.toLowerCase()) {
            paymentOutput = {};
            paymentOutput.is_paid = false;
            paymentOutput.paymentMethod = payment_type;
            paymentOutput.error = `The Ride - ${ride_id} is already in ${c_r_c_status_name} status.`;
            paymentOutput.success = false;
            throw new Error(paymentOutput.error);
        }

        // If the ride is not in payable status
        if (rideItem.status.toLowerCase() !== c_r_p_status_name.toLowerCase()) {
            paymentOutput = {};
            paymentOutput.is_paid = false;
            paymentOutput.paymentMethod = payment_type;
            paymentOutput.error = `The Ride - ${ride_id} is not yet applicable for Payment Process.`;
            paymentOutput.success = false;
            throw new Error(paymentOutput.error);
        }

        if (customer && customer.device_id === null) {
            paymentOutput.error = `The customer Device Id is not configured.`;
            paymentOutput.success = false;
            throw new Error(paymentOutput.error);
        }

        let existingPaymentRec;
        if (payment_type.toLowerCase() === 'wallet') {
            existingPaymentRec = await paymentsDAO.findRideWalletPaymentStatus(customer_id, ride_id);
        } else {
            existingPaymentRec = await paymentsDAO.findRidePaymentStatus(customer_id, ride_id);
        }

        if (existingPaymentRec) {
            paymentOutput = {};
            paymentOutput.is_paid = false;
            paymentOutput.paymentMethod = payment_type;
            paymentOutput.error = `Payment is already completed for this Ride ${ride_id}`;
            paymentOutput.success = false;
            throw new Error(paymentOutput.error);
        }
        if (payment_type.toLowerCase() === 'wallet') {
            const telr_payment_method = `${payment_type}-${c_w_p_status_name}`;
            const payment_method = await paymentsDAO.getPaymentTypeMethodByName(true, false, telr_payment_method);
            if (!payment_method) {
                paymentOutput = {};
                paymentOutput.error = `Payment Method is not defined.`;
                paymentOutput.success = false;
                throw new Error(paymentOutput.error);
            }

            paymentOutput = {};
            paymentOutput.rideItem = rideItem;

            paymentOutput.payment_type_method = payment_type_method;
            paymentOutput.customer = customer;
            paymentOutput.payment_method = payment_method;
            paymentOutput.walletDStatusCode = walletDStatusCode;
            paymentOutput.walletCStatusCode = walletCStatusCode;
            paymentOutput.paymentCStatusCode = paymentCompletedStatus;
            paymentOutput.success = true;
            return paymentOutput;
        } else if (payment_type.toLowerCase() === 'cash') {
            paymentOutput = {};
            paymentOutput.rideItem = rideItem;
            paymentOutput.payment_type_method = payment_type_method;
            paymentOutput.customer = customer;
            paymentOutput.cashDStatusCode = cashDStatusCode;
            paymentOutput.cashPStatusCode = cashPStatusCode;
            paymentOutput.cashWalletAStatusCode = cashWalletAStatusCode;
            paymentOutput.paymentCStatusCode = paymentCompletedStatus;
            paymentOutput.cashCreditStatusCode = cashCreditStatusCode;
            paymentOutput.success = true;
            return paymentOutput;
        } else if (payment_type.toLowerCase() === 'card') {
            paymentOutput = {};
            paymentOutput.rideItem = rideItem;
            paymentOutput.payment_type_method = payment_type_method;
            paymentOutput.customer = customer;
            paymentOutput.cardDStatusCode = cardDStatusCode;
            paymentOutput.success = true;
            paymentOutput.customerRec = customerRec;
            paymentOutput.payment_method = payment_method;
            paymentOutput.cardAuthorisedStatusCode = cardAuthorisedStatusCode;
            paymentOutput.cardWalletAStatusCode = cardWalletAStatusCode;
            paymentOutput.paymentCStatusCode = paymentCompletedStatus;
            return paymentOutput;
        } else if (payment_type.toLowerCase() === 'applepay') {
            paymentOutput = {};
            paymentOutput.rideItem = rideItem;
            paymentOutput.payment_type_method = payment_type_method;
            paymentOutput.customer = customer;
            paymentOutput.walletDStatusCode = walletDStatusCode;
            paymentOutput.success = true;
            paymentOutput.paymentCStatusCode = paymentCompletedStatus;
            paymentOutput.cardAuthorisedStatusCode = cardAuthorisedStatusCode;
            paymentOutput.paymentPStatusCode = paymentAPPStatus;
            return paymentOutput;
        }
    } catch (error) {
        console.log('validate input data error -', error.message);
        await addServerLog({
            log_level: "ERROR",
            service_name: "validateInputData",
            error_message: `validate input data error - ${error.message}.`
        });

        paymentOutput = {};
        paymentOutput.error = error.message;
        paymentOutput.success = false;
        return paymentOutput;
    }
}

const getUsersWalletBalance = async (start_date, end_date, userId, page, limit, search_string) => {
    try {

        if (isValidDate(start_date) && isValidDate(end_date)) {
            if (start_date > end_date) {
                return {
                    success: false,
                    message: "Start Date cannot be greater than End date.",
                    data: {}
                }
            }
        }
        const result = await paymentsDAO.findUsersWalletBalance(start_date, end_date, limit, page, userId, search_string);
        const data = {
            wallets: []
        };

        return {
            success: true,
            message: "Wallet details fetched successfully",
            data: result
        }
    } catch (error) {
        console.log('get user wallet balance error -', error);
        await addServerLog({
            log_level: "ERROR",
            error_message: `get user wallet balance error - ${error.message}.`
        });
        return {
            success: false,
            message: "Error while fetching Wallet details.",
            data: {}
        }
    }
}

const getCorporatePaymentDetails = async (inputData) => {
    try {
        const validatedData = PaymentsValidator.corporateRideDataValidator(inputData);
        if (validatedData) {

            //de-structure payment data input
            const {
                customer_id
            } = inputData;
            //console.log('custom ', customer_id);
            const result = await paymentsDAO.findCorporateUserWallet(customer_id);

            const data = {
                wallets: [],
            };
            await Promise.all(result.customerWalletLogRec.map(async (walletData) => {
                const payment_status_name = await paymentsDAO.findStatusById(walletData.payment_status_id);
                walletData.PaymentStatusName = payment_status_name ? payment_status_name.name : null;
                data.wallets.push(walletData);
            }));

            return {
                success: true,
                message: "Corporate Payment details fetched successfully",
                data
            }
        }
    } catch (error) {
        //console.log('get corporate payment details error -', error.message);
        await addServerLog({
            log_level: "ERROR",
            error_message: `get corporate payment details error - ${error.message}.`
        });
        return {
            success: false,
            message: "Error while fetching Corporate Payment details.",
            data: {}
        }
    }
}

const getChauffeurWalletDetails = async (start_date, end_date, page, limit) => {
    try {

        if (isValidDate(start_date) && isValidDate(end_date)) {
            if (start_date > end_date) {
                return {
                    success: false,
                    message: "Start Date cannot be greater than End date.",
                    data: {}
                }
            }
        }

        const result = await paymentsDAO.findChauffeurUserWallets(start_date, end_date, limit, page);

        console.log(result);
        const data = {
            wallets: []
        };

        return {
            success: true,
            message: "Wallet details fetched successfully",
            data: result
        }
        //        }
    } catch (error) {
        //console.log('get chauffeur wallet details error -', error.message);
        await addServerLog({
            log_level: "ERROR",
            error_message: `get chauffeur wallet details error - ${error.message}.`
        });
        return {
            success: false,
            message: "Error while fetching Wallet details.",
            data: {}
        }
    }
}

const isValidDate = (date) => {
    return date && !isNaN(new Date(date).getTime());
}

const getPDPgnWalletDetails = async (start_date, end_date, userId, page, limit) => {
    try {

        if (isValidDate(start_date) && isValidDate(end_date)) {
            if (start_date > end_date) {
                return {
                    success: false,
                    message: "Start Date cannot be greater than End date.",
                    data: {}
                }
            }
        }

        const result = await paymentsDAO.findPDWallets(start_date, end_date, limit, page, userId);

        return {
            success: true,
            message: "PD Cash Handling details fetched successfully",
            data: result
        }
    } catch (error) {

        await addServerLog({
            log_level: "ERROR",
            error_message: `get pd wallet details error - ${error.message}.`
        });
        return {
            success: false,
            message: "Error while fetching Wallet details.",
            data: {}
        }
    }
}

const getChauffeurPgnWalletDetails = async (start_date, end_date, userId, page, limit) => {
    try {

        if (isValidDate(start_date) && isValidDate(end_date)) {
            if (start_date > end_date) {
                return {
                    success: false,
                    message: "Start Date cannot be greater than End date.",
                    data: {}
                }
            }
        }
        const output = await paymentsDAO.findChauffeurWallets(start_date, end_date, limit, page, userId);

        return {
            success: true,
            message: "Chauffeur Cash Handling details fetched successfully",
            data: output
        }
    } catch (error) {
        console.log(error);
        await addServerLog({
            log_level: "ERROR",
            service_name: "getChauffeurPgnWalletDetails",
            error_message: `get chauffeur wallet details error - ${error.message}.`
        });
        return {
            success: false,
            message: "Error while fetching Wallet details.",
            data: {}
        }
    }
}

const orgPaymentByRidesUpdate = async (inputData) => {
    try {

        const validatedData = PaymentsValidator.corporatePendingPaymentValidator(inputData);
        if (validatedData) {
            //de-structure payment data input
            const { customer_id, ride_ids, hand_over_amount } = inputData;
            const logInput = `${customer_id}, ${ride_ids}, ${hand_over_amount}`;

            let paymentOutput = {};

            const admin_id = customer_id;
            const completedStatus = await paymentsDAO.findStatusName(c_p_c_status_name);
            let completed_status_id;
            if (completedStatus) {
                completed_status_id = completedStatus.id;
            } else {
                paymentOutput.message = `Status for Payment Completed not set`;
                paymentOutput.success = false;
                return paymentOutput;
            }


            const response = await paymentsDAO.updateCorporatePayment(admin_id, ride_ids, hand_over_amount, completed_status_id);

            if (response.cashOutput.success) {
                paymentOutput.error = '';
                paymentOutput.success = true;
                paymentOutput.message = response.cashOutput.message;
                paymentOutput.wallet_balance = response.cashOutput.wallet_balance;

            } else {
                paymentOutput.error = response.cashOutput.message;
                paymentOutput.message = response.error;
                paymentOutput.success = false;
            }
            return paymentOutput;
        }
    } catch (error) {

        await addServerLog({
            log_level: "ERROR",
            error_message: `Org Payment By Rides Updates Error ${error.message}`
        });
        return {
            message: 'Failed to process Org Payment By Rides Updates.',
            success: false,
            data: {},
            error: error.message,
            error_status_code: 500
        }
    }
}

const getPDWalletDetails = async (start_date, end_date, page, limit) => {
    try {
        if (isValidDate(start_date) && isValidDate(end_date)) {
            if (start_date > end_date) {
                return {
                    success: false,
                    message: "Start Date cannot be greater than End date.",
                    data: {}
                }
            }
        }

        const result = await paymentsDAO.findPDUserWallets(start_date, end_date, limit, page);

        return {
            success: true,
            message: "Wallet details fetched successfully",
            data: result
        }
        //        }
    } catch (error) {
        console.log('get pd wallet details error -', error.message);
        await addServerLog({
            log_level: "ERROR",
            error_message: `get pd wallet details error - ${error.message}.`
        });
        return {
            success: false,
            message: "Error while fetching Wallet details.",
            data: {}
        }
    }
}


const getAdminWalletDetails = async (start_date, end_date, page, limit) => {
    try {
        if (isValidDate(start_date) && isValidDate(end_date)) {
            if (start_date > end_date) {
                return {
                    success: false,
                    message: "Start Date cannot be greater than End date.",
                    data: {}
                }
            }
        }

        const result = await paymentsDAO.findAdminUserWallets(start_date, end_date, limit, page);

        return {
            success: true,
            message: "Wallet details fetched successfully",
            data: result
        }
    } catch (error) {
        console.log('get admin wallet details error -', error.message);
        await addServerLog({
            log_level: "ERROR",
            error_message: `get admin wallet details error - ${error.message}.`
        });
        return {
            success: false,
            message: "Error while fetching Wallet details.",
            data: {}
        }
    }
}

const createAdminCashPayment = async (inputData, admin_id) => {
    try {

        const validatedData = PaymentsValidator.adminCashPaymentValidator(inputData);
        if (validatedData) {
            let {
                customer_id,
                ride_id, payment_type, coupon_ids, chauffeur_id } = inputData;

            const logInput = `${customer_id}, ${ride_id}, ${payment_type}, ${coupon_ids}, ${chauffeur_id}, ${admin_id}`;

            let paymentOutput = await validateInputData(inputData);
            let start_time, end_time;
            if (paymentOutput && paymentOutput.success) {
                if (paymentOutput.rideItem) {
                    let userInfo = {
                        user_id: customer_id
                    };
                    const checkZeroNegBal = await paymentsDAO.findCustomerBalance(userInfo);
                    let wallet_balance_amount = 0;

                    wallet_balance_amount = checkZeroNegBal && parseFloat(checkZeroNegBal.wallet_balance);
                    if (!checkZeroNegBal) {
                        paymentOutput = {};
                        paymentOutput.error = `Customer Wallet Balance is not yet created.`;
                        paymentOutput.success = false;
                        return paymentOutput;
                    }

                    const final_result = paymentOutput.rideItem?.final_price_calculation;

                    if (final_result && final_result.final_total_amount > 0) {
                        await Promise.all(paymentOutput.rideItem.status_log.map(async (item) => {

                            if (item.status.toLowerCase() === c_r_s_status_name) {
                                start_time = item.datetime;
                            }
                            if (item.status.toLowerCase() === c_r_e_status_name) {
                                end_time = item.datetime;
                            }
                        }));
                        const date1 = moment(start_time);
                        const date2 = moment(end_time);
                        estimated_time_in_minutes = parseFloat(date2.diff(date1, 'minutes', true)).toFixed(2);

                        const base_fare = final_result ? final_result.base_fare : 0.0;
                        const rate_type = paymentOutput.rideItem.rate_type;
                        const { [rate_type]: rates } = final_result.rates;

                        const mandatory_charges = final_result.mandatory_charges.total;
                        const other_charges = final_result.other_charges.total;
                        const vat = final_result.vat;
                        let is_coupon_applied = final_result.isCouponApplied;
                        const total_after_discount = final_result ? final_result.total_after_discount : 0.0
                        let discount_amount = final_result ? final_result.coupon_discount : 0;
                        let total_amount_to_be_paid = final_result
                            ? final_result.final_total_amount : 0;

                        const estimated_total_amount = final_result ? final_result.estimated_total_amount : 0.0;
                        const is_invoice_created = false;

                        let coupon_ids = final_result?.appliedCoupons.map(x => x.coupon_id);

                        let notificationData;
                        if (paymentOutput.customer) {
                            notificationData = {
                                title: "Payment Completion Status",
                                data: {
                                    ride_id: paymentOutput.rideItem.ride_id.toString(),
                                    requested_pickup_point: paymentOutput.rideItem.requested_pickup_point.toString(),
                                    requested_pickup_lat: paymentOutput.rideItem.requested_pickup.lat.toString(),
                                    reqested_pickup_long: paymentOutput.rideItem.requested_pickup.long.toString(),
                                    customer_id: paymentOutput.rideItem.customer_id.toString(),
                                    estimated_amount: total_amount_to_be_paid,
                                    requested_drop_point: paymentOutput.rideItem.requested_drop_point.toString(),
                                    requested_drop_lat: paymentOutput.rideItem.requested_drop.lat.toString(),
                                    reqested_drop_long: paymentOutput.rideItem.requested_drop.long.toString(),
                                    notification_type: "payment_completion_status",
                                    recipient_type: "customer",
                                    recipient_id: paymentOutput.rideItem.customer_id.toString(),
                                    order_date: paymentOutput.rideItem.order_date.toString(),
                                },
                                notification_type: "payment_completion_status",
                                recipient_type: "customer",
                                recipient_id: paymentOutput.rideItem.customer_id.toString(),
                            };
                            //create payment record
                            let paymentInfo = {};
                            paymentInfo = {
                                payment_type_id: paymentOutput.payment_type_method.id,
                                paymentMethod: payment_type,
                                method: '',
                                currency: process.env.CURRENCY_CODE,
                                amount: estimated_total_amount,
                                custRef: '',
                                cartidRef: 0,
                                description: 'Cash Payment',
                                order_ref: '',
                                is_paid: true,
                                user_id: customer_id,
                                order_url: '',
                                fore_names: paymentOutput.customer.first_name,
                                sur_name: paymentOutput.customer.last_name,
                                country: paymentOutput.customer.country_code,
                                phone: paymentOutput.customer.mobile_number,
                                transaction_ref: '',
                                ride_id,
                                status_log_details: paymentOutput.rideItem.status_log,
                                device_id: paymentOutput.customer.device_id,
                                notificationData,
                                discount_amount,
                                total_amount_to_be_paid,
                                chauffeur_id: paymentOutput.rideItem.chauffeur_id || chauffeur_id,
                                status_id: paymentOutput.cashPStatusCode.id,
                                payment_details: paymentOutput.rideItem.paymentDetails,
                                c_r_c_status_name,
                                c_r_p_status_name,
                                wallet_balance_amount,
                                c_w_a_transaction_type_id: paymentOutput.cashWalletAStatusCode.id,
                                payment_completed_status_id: paymentOutput.paymentCStatusCode.id,
                                coupon_ids: is_coupon_applied ? coupon_ids : null,
                                is_coupon_applied,
                                base_fare,
                                rates,
                                rate_type,
                                mandatory_charges,
                                other_charges,
                                vat,
                                is_invoice_created,
                                estimated_time_in_minutes: parseInt(estimated_time_in_minutes),
                                c_c_transaction_type_id: paymentOutput.cashCreditStatusCode.id,
                                total_after_discount,
                                admin_id
                            };

                            const cashPaymentResponse = await paymentsDAO.createAdminCashPaymentRecord(paymentInfo);

                            if (cashPaymentResponse.cashOutput.success) {

                                if (cashPaymentResponse.cashOutput.payment_status === c_r_c_status_name) {
                                    paymentInfo.notificationData.body = `Payment is successfully ${cashPaymentResponse.cashOutput.payment_status} for the ride ${paymentInfo.ride_id}.`;
                                    await queuePushNotification(paymentInfo.device_id, paymentInfo.notificationData);
                                    paymentOutput = {};
                                    paymentOutput.is_paid = true;
                                    paymentOutput.paymentMethod = payment_type;
                                    paymentOutput.amount = paymentInfo.amount.toFixed(2);
                                    paymentOutput.currency = paymentInfo.currency;
                                    paymentOutput.error = '';
                                    paymentOutput.success = cashPaymentResponse.cashOutput.success;
                                    paymentOutput.payment_status = cashPaymentResponse.cashOutput.payment_status;
                                    paymentOutput.chauffeur_id = paymentInfo.chauffeur_id;
                                    paymentOutput.is_coupon_applied = is_coupon_applied;
                                    paymentOutput.base_fare = base_fare;
                                    paymentOutput.rates = rates;
                                    paymentOutput.rate_type = rate_type;
                                    paymentOutput.mandatory_charges = mandatory_charges;
                                    paymentOutput.other_charges = other_charges;
                                    paymentOutput.vat = vat;
                                    paymentOutput.is_invoice_created = is_invoice_created;
                                    paymentOutput.total_amount_to_be_paid = total_amount_to_be_paid;
                                    paymentOutput.discount_amount = discount_amount;

                                    return paymentOutput;
                                } else {
                                    paymentOutput = {};
                                    paymentOutput.is_paid = false;
                                    paymentOutput.paymentMethod = payment_type;
                                    paymentOutput.error = `Failed to complete cash payment of the Ride ${ride_id}`;
                                    paymentOutput.success = false;
                                    return paymentOutput;
                                }
                            } else {
                                paymentOutput = {};
                                paymentOutput.is_paid = false;
                                paymentOutput.paymentMethod = payment_type;
                                paymentOutput.error = `Failed to complete cash payment of the Ride ${ride_id}`;
                                paymentOutput.success = cashPaymentResponse.cashOutput.success;
                                return paymentOutput;
                            }
                        }
                    } else {
                        paymentOutput = {};
                        paymentOutput.is_paid = false;
                        paymentOutput.paymentMethod = payment_type;
                        paymentOutput.error = `Failed to fetch Estimated Amount data for the ride ${ride_id}`;
                        paymentOutput.success = false;
                        return paymentOutput;
                    }
                }
            } else {
                return paymentOutput;
            }
        }
    } catch (error) {
        console.log('create cash payment error -', error.message);
        await addServerLog({
            log_level: "ERROR",
            error_message: `create admin cash payment error - ${error.message}.`
        });
        paymentOutput = {};
        paymentOutput.is_paid = false;
        paymentOutput.error = error.message;
        paymentOutput.success = false;
        return paymentOutput;
    }

}

const getChauffeurWalletByRides = async (chauffeur_id, start_date, end_date) => {
    try {

        if (isValidDate(start_date) && isValidDate(end_date)) {
            if (start_date > end_date) {
                return {
                    success: false,
                    message: "Start Date cannot be greater than End date.",
                    data: {}
                }
            }
        }

        const cash_payment_type = await paymentsDAO.getPaymentTypeMethodByName(true, true, 'cash');

        const rides = await paymentsDAO.getChauffeurBasedRideDetails(chauffeur_id, cash_payment_type.id, start_date, end_date);
        return rides;
    } catch (error) {
        await addServerLog({
            log_level: "ERROR",
            error_message: `getChauffeurWalletByRides error - ${error.message}.`
        });
        throw error;
    }

}

const createAdminWalletPayment = async (inputData, admin_id) => {
    try {
        const validatedData = PaymentsValidator.adminWalletPaymentValidator(inputData);
        if (validatedData) {
            const {
                customer_id,
                ride_id, payment_type, coupon_ids, chauffeur_id } = inputData;

            const logInput = `${customer_id}, ${ride_id}, ${payment_type}, ${coupon_ids}, ${chauffeur_id}, ${admin_id}`;

            let paymentOutput = await validateInputData(inputData);
            if (paymentOutput && paymentOutput.success) {

                console.log('customer ride Item', paymentOutput.rideItem);
                const final_result = paymentOutput.rideItem?.final_price_calculation;

                //get estimated amount based on pricing configuration.
                //const estimatedAmount = await getEstimatedAmount(paymentOutput.rideItem, 0, coupon_ids);

                if (final_result && final_result.final_total_amount > 0) {

                    const base_fare = final_result ? final_result.base_fare : 0.0;
                    const rate_type = paymentOutput.rideItem.rate_type;
                    const { [rate_type]: rates } = final_result.rates;

                    const mandatory_charges = final_result.mandatory_charges.total;
                    const other_charges = final_result.other_charges.total;
                    const vat = final_result.vat;
                    const is_coupon_applied = final_result.isCouponApplied;
                    const total_after_discount = final_result ? final_result.total_after_discount : 0.0
                    let discount_amount = final_result ? final_result.coupon_discount : 0;
                    let total_amount_to_be_paid = final_result
                        ? final_result.final_total_amount : 0;

                    const estimated_total_amount = final_result ? final_result.estimated_total_amount : 0.0;
                    let coupon_ids = final_result?.appliedCoupons.map(x => x.coupon_id);

                    const is_invoice_created = false;
                    await Promise.all(paymentOutput.rideItem.status_log.map(async (item) => {
                        if (item.status.toLowerCase() === c_r_s_status_name) {
                            start_time = item.datetime;
                        }
                        if (item.status.toLowerCase() === c_r_e_status_name) {
                            end_time = item.datetime;
                        }
                    }));
                    const date1 = moment(start_time);
                    const date2 = moment(end_time);
                    estimated_time_in_minutes = parseFloat(date2.diff(date1, 'minutes', true)).toFixed(2);

                    let notificationData;
                    notificationData = {
                        title: "Wallet Payment Completion Status",
                        data: {
                            ride_id: paymentOutput.rideItem.ride_id.toString(),
                            requested_pickup_point: paymentOutput.rideItem.requested_pickup_point.toString(),
                            requested_pickup_lat: paymentOutput.rideItem.requested_pickup.lat.toString(),
                            requested_pickup_long: paymentOutput.rideItem.requested_pickup.long.toString(),
                            customer_id: paymentOutput.rideItem.customer_id.toString(),
                            estimated_amount: total_amount_to_be_paid,
                            requested_drop_point: paymentOutput.rideItem.requested_drop_point.toString(),
                            requested_drop_lat: paymentOutput.rideItem.requested_drop.lat.toString(),
                            requested_drop_long: paymentOutput.rideItem.requested_drop.long.toString(),
                            notification_type: "payment_completion_status",
                            recipient_type: "customer",
                            recipient_id: paymentOutput.rideItem.customer_id.toString(),
                            order_date: paymentOutput.rideItem.order_date.toString(),
                        },
                        notification_type: "payment_completion_status",
                        recipient_type: "customer",
                        recipient_id: paymentOutput.rideItem.customer_id.toString(),
                    };
                    const paymentInfo = {
                        payment_type_id: paymentOutput.payment_method.id,
                        method: '',
                        currency: process.env.CURRENCY_CODE,
                        amount: estimated_total_amount,
                        custRef: '',
                        cartidRef: 0,
                        description: 'Wallet Payment',
                        order_ref: '',
                        is_paid: true,
                        user_id: customer_id,
                        order_url: '',
                        transaction_ref: '',
                        ride_id,
                        status_log_details: paymentOutput.rideItem.status_log,
                        payment_type,
                        notificationData,
                        discount_amount,
                        total_amount_to_be_paid,
                        chauffeur_id: paymentOutput.rideItem.chauffeur_id,
                        payment_details: paymentOutput.rideItem.paymentDetails,
                        c_r_c_status_name,
                        c_r_p_status_name,
                        w_d_transaction_type_id: paymentOutput.walletDStatusCode.id,
                        w_c_transaction_type_id: paymentOutput.walletCStatusCode.id,
                        payment_completed_status_id: paymentOutput.paymentCStatusCode.id,
                        coupon_ids: is_coupon_applied ? coupon_ids : null,
                        is_coupon_applied,
                        base_fare,
                        rates,
                        rate_type,
                        mandatory_charges,
                        other_charges,
                        vat,
                        is_invoice_created,
                        estimated_time_in_minutes: parseInt(estimated_time_in_minutes),
                        total_after_discount,
                        admin_id
                    };

                    const response = await paymentsDAO.createAdminWalletPaymentRecord(paymentInfo);
                    if (response.walletOutput.success) {
                        if (response.walletOutput.payment_status === c_r_c_status_name) {
                            paymentInfo.notificationData.body = `Wallet Payment is successfully Completed for the ride ${paymentInfo.ride_id}.`;
                            const notification_results = await queuePushNotification(paymentInfo.device_id, paymentInfo.notificationData);
                            if (notification_results && notification_results.notification_id !== '') {
                                paymentOutput.response = response;
                                paymentOutput.is_paid = true;
                                paymentOutput.paymentMethod = payment_type;
                                paymentOutput.error = '';
                                paymentOutput.success = true;
                                paymentOutput.payment_status = response.walletOutput.payment_status;
                                paymentOutput.wallet_payment_id = response.walletOutput.wallet_payment_id;
                                paymentOutput.wallet_balance = response.walletOutput.balance;
                                paymentOutput.currency = process.env.CURRENCY_CODE;
                                paymentOutput.chauffeur_id = paymentInfo.chauffeur_id;
                                paymentOutput.ride_amount = response.walletOutput.ride_amount;
                                paymentOutput.outstanding_balance = response.walletOutput.wallet_balance;
                                paymentOutput.adjusted_amount = response.walletOutput.adjusted_amount;
                                paymentOutput.amount_to_be_paid = response.walletOutput.total_amount_to_be_paid;

                                paymentOutput.previous_balance = response.walletOutput.prev_wallet_balance;
                                paymentOutput.is_coupon_applied = is_coupon_applied;
                                paymentOutput.base_fare = base_fare;
                                paymentOutput.rates = rates;
                                paymentOutput.rate_type = rate_type;
                                paymentOutput.mandatory_charges = mandatory_charges;
                                paymentOutput.other_charges = other_charges;
                                paymentOutput.vat = vat;
                                paymentOutput.is_invoice_created = is_invoice_created;
                                paymentOutput.total_amount_to_be_paid = total_amount_to_be_paid;
                                paymentOutput.discount_amount = discount_amount;

                            }
                            else {
                                paymentOutput.is_paid = false;
                                paymentOutput.paymentMethod = payment_type;
                                paymentOutput.error = "Payment Status Notification is not sent to Customer.";
                                paymentOutput.success = false;
                                paymentOutput.wallet_balance = response.walletOutput.balance;
                                paymentOutput.currency = process.env.CURRENCY_CODE;
                            }
                        } else {
                            paymentOutput.is_paid = false;
                            paymentOutput.paymentMethod = payment_type;
                            paymentOutput.error = response.walletOutput.error;
                            paymentOutput.success = false;
                            paymentOutput.wallet_balance = response.walletOutput.balance;
                            paymentOutput.currency = process.env.CURRENCY_CODE;
                        }
                    } else {
                        paymentOutput.is_paid = false;
                        paymentOutput.paymentMethod = payment_type;
                        paymentOutput.error = response.walletOutput.error;
                        paymentOutput.success = false;
                        paymentOutput.wallet_balance = response.walletOutput.balance;
                        paymentOutput.currency = process.env.CURRENCY_CODE;
                        paymentOutput.ride_amount = response.walletOutput.ride_amount;
                        paymentOutput.is_balance_insufficient = response.walletOutput.is_balance_insufficient;
                    }
                } else {
                    paymentOutput.is_paid = false;
                    paymentOutput.paymentMethod = payment_type;
                    paymentOutput.error = "Calculated Ride Amount is incorrect";
                    paymentOutput.success = false;
                }

            }
            return paymentOutput;
        }
    } catch (error) {
        console.log('create wallet payment error -', error.message);
        await addServerLog({
            log_level: "ERROR",
            error_message: `create admin wallet payment error - ${error.message}.`
        });
        return {
            message: 'Failed to process Admin Wallet Payment.',
            success: false,
            data: {},
            error: error.message,
            error_status_code: 500
        }
    }
}

const quickPaymentLinkProcess = async (paymentData, user_id) => {

    try {
        //input validations
        const validatedData = PaymentsValidator.quickLinkPaymentValidator(paymentData);

        //de-structure payment data input
        if (validatedData) {
            const {
                customer_id,
                ride_id, payment_type, coupon_ids } = paymentData;
            const logInput = `${customer_id}, ${ride_id},${payment_type}, ${coupon_ids}, ${user_id}`;
            // await addServerLog({
            //     log_level: "INFO",                         // required
            //     error_message: `quickPaymentLinkProcess input - ${logInput}`   // required
            // });
            let start_time, end_time;
            //let payment_type = "wallet"; //corporate credit
            let paymentOutput = await validateInputData(paymentData);
            //console.log('cc', paymentOutput.rideItem);
            if (paymentOutput && paymentOutput.success) {
                //get estimated amount based on pricing configuration.

                //get pricing information
                console.log('customer ride Item', paymentOutput.rideItem);
                const final_result = paymentOutput.rideItem?.final_price_calculation;

                if (final_result && final_result.final_total_amount > 0) {

                    const base_fare = final_result ? final_result.base_fare : 0.0;
                    const rate_type = paymentOutput.rideItem.rate_type;
                    const { [rate_type]: rates } = final_result.rates;

                    const mandatory_charges = final_result.mandatory_charges.total;
                    const other_charges = final_result.other_charges.total;
                    const vat = final_result.vat;
                    const is_coupon_applied = final_result.isCouponApplied;
                    const total_after_discount = final_result ? final_result.total_after_discount : 0.0
                    let discount_amount = final_result ? final_result.coupon_discount : 0;
                    let total_amount_to_be_paid = final_result
                        ? final_result.final_total_amount : 0;

                    const estimated_total_amount = final_result ? final_result.estimated_total_amount : 0.0;
                    let coupon_ids = final_result?.appliedCoupons.map(x => x.coupon_id);

                    const is_invoice_created = false;
                    await Promise.all(paymentOutput.rideItem.status_log.map(async (item) => {
                        if (item.status.toLowerCase() === c_r_s_status_name) {
                            start_time = item.datetime;
                        }
                        if (item.status.toLowerCase() === c_r_e_status_name) {
                            end_time = item.datetime;
                        }
                    }));
                    const date1 = moment(start_time);
                    const date2 = moment(end_time);
                    estimated_time_in_minutes = parseFloat(date2.diff(date1, 'minutes', true)).toFixed(2);

                    const countryName = await getCountryNameByCode(paymentOutput.customer.country_code);

                    const cartid = await generateRandomAlphaNumericText(13);
                    console.log('cart id', cartid);
                    const fullName = `${paymentOutput.customer.first_name} ${paymentOutput.customer.last_name}`;
                    const today = new Date();

                    const payload = {
                        QuickLinkRequest: {
                            StoreID: process.env.TELR_MERCHANT_ID,
                            AuthKey: process.env.TELR_SECRET_KEY,
                            Details: {
                                Desc: "Avalift Ride Payment",
                                Cart: `Avalift_QLink_${cartid}`,
                                Currency: process.env.CURRENCY_CODE,
                                Amount: 1,
                                MinQuantity: 1,
                                MaxQuantity: 1,
                                FullName: fullName,
                                Addr1: "",
                                City: "",
                                Country: countryName,
                                Email: "",
                                Phone: paymentOutput.customer.mobile_number
                            },
                            VariableValueMode: {
                                Status: "",
                                SectionTitle: ""
                            },
                            RepeatBilling: {
                                Status: "",
                                Amount: "",
                                Period: "",
                                Interval: "",
                                Start: "",
                                Term: "",
                                Final: ""
                            },
                            Availability: {
                                NotValidBefore: {
                                    Day: String(today.getDate()).padStart(2, '0'),
                                    Month: String(today.getMonth() + 1).padStart(2, '0'),
                                    Year: today.getFullYear()
                                },
                                NotValidAfter: {
                                    Day: String(today.getDate()).padStart(2, '0'),
                                    Month: String(today.getMonth() + 1).padStart(2, '0'),
                                    Year: today.getFullYear()
                                },
                                StockControl: "1",
                                StockCount: "1"
                            }
                        }
                    };

                    // Call Telr API to Verify payment request
                    const result = await axios.post(process.env.TELR_QLINK_API_URL, payload);

                    if (result.data.QuickLinkResponse.Status === "Success") {

                        // //send payment link
                        // const ph_number = `${paymentOutput.customer.country_code}${paymentOutput.customer.mobile_number}`;
                        // console.log(ph_number);
                        // paymentOutput = {};
                        //paymentOutput.url = result.data.QuickLinkResponse.URL;
                        // paymentOutput.is_paid = false;
                        // paymentOutput.success = true;

                        // const smsInfo = {
                        //     Text: `Your payment link is ${result.data.QuickLinkResponse.URL}`,
                        //     phoneNumber: ph_number.replace(/\+/g, "")
                        // };

                        // const outputResponse = await sendSms(smsInfo, config.defaultSmsProvider);
                        // if (outputResponse.status === "True") {
                        //     console.log("SMS sent successfully");
                        // }


                        let notificationData;
                        notificationData = {
                            title: "Wallet Payment Completion Status",
                            data: {
                                ride_id: paymentOutput.rideItem.ride_id.toString(),
                                requested_pickup_point: paymentOutput.rideItem.requested_pickup_point.toString(),
                                requested_pickup_lat: paymentOutput.rideItem.requested_pickup.lat.toString(),
                                requested_pickup_long: paymentOutput.rideItem.requested_pickup.long.toString(),
                                customer_id: paymentOutput.rideItem.customer_id.toString(),
                                estimated_amount: total_amount_to_be_paid,
                                requested_drop_point: paymentOutput.rideItem.requested_drop_point.toString(),
                                requested_drop_lat: paymentOutput.rideItem.requested_drop.lat.toString(),
                                requested_drop_long: paymentOutput.rideItem.requested_drop.long.toString(),
                                notification_type: "payment_completion_status",
                                recipient_type: "customer",
                                recipient_id: paymentOutput.rideItem.customer_id.toString(),
                                order_date: paymentOutput.rideItem.order_date.toString(),
                            },
                            notification_type: "payment_completion_status",
                            recipient_type: "customer",
                            recipient_id: paymentOutput.rideItem.customer_id.toString(),
                        };
                        const paymentInfo = {
                            payment_type_id: paymentOutput.payment_type_method.id,
                            //payment_type_id: paymentOutput.payment_method.id,
                            //paymentMethod: payment_method.name,
                            method: '',
                            currency: process.env.CURRENCY_CODE,
                            //amount: rideItem.dmoRideOutput.item.estimated_amount, //taken from external service
                            //amount: ride_amount,
                            amount: estimated_total_amount,
                            custRef: '',
                            cartidRef: 0,
                            description: 'Quick Link Payment',
                            order_ref: '',
                            is_paid: true,
                            user_id: customer_id,
                            order_url: '',
                            // fore_names: customer.first_name,
                            // sur_name: customer.last_name,
                            // country: customer.country_code,
                            // phone: customer.mobile_number,
                            transaction_ref: '',
                            ride_id,
                            status_log_details: paymentOutput.rideItem.status_log,
                            payment_type,
                            notificationData,
                            discount_amount,
                            total_amount_to_be_paid,
                            chauffeur_id: paymentOutput.rideItem.chauffeur_id,
                            payment_details: paymentOutput.rideItem.paymentDetails,
                            c_a_p_status_name,
                            c_r_p_status_name,
                            w_d_transaction_type_id: paymentOutput.walletDStatusCode.id,
                            payment_pending_status_id: paymentOutput.paymentPStatusCode.id,
                            coupon_ids: is_coupon_applied ? coupon_ids : null,
                            is_coupon_applied,
                            base_fare,
                            rates,
                            rate_type,
                            mandatory_charges,
                            other_charges,
                            vat,
                            is_invoice_created,
                            estimated_time_in_minutes: parseInt(estimated_time_in_minutes),
                            total_after_discount
                        };
                        // paymentInfo.c_r_c_status_name = c_r_c_status_name;
                        // paymentInfo.c_r_p_status_name = c_r_p_status_name;
                        // paymentInfo.w_d_transaction_type_id = paymentOutput.walletDStatusCode.id;
                        // paymentInfo.w_c_transaction_type_id = paymentOutput.walletCStatusCode.id;
                        const response = await paymentsDAO.createCustomerApplePayPaymentRecord(paymentInfo);
                        if (response.walletOutput.success) {
                            if (response.walletOutput.payment_status === c_p_p_status_name) {
                                paymentInfo.notificationData.body = `Quick Link Payment is successfully Initiated for the ride ${paymentInfo.ride_id}.`;
                                const notification_results = await queuePushNotification(paymentInfo.device_id, paymentInfo.notificationData);
                                if (notification_results && notification_results.notification_id !== '') {
                                    paymentOutput = {};
                                    //paymentOutput.response = response;
                                    paymentOutput.Url = result.data.QuickLinkResponse.URL;
                                    paymentOutput.is_paid = false;
                                    paymentOutput.paymentMethod = payment_type;
                                    paymentOutput.error = '';
                                    paymentOutput.success = true;
                                    paymentOutput.payment_status = response.walletOutput.payment_status;
                                    //paymentOutput.wallet_payment_id = response.walletOutput.wallet_payment_id;
                                    //paymentOutput.wallet_balance = response.walletOutput.balance;
                                    //paymentOutput.currency = process.env.CURRENCY_CODE;
                                    paymentOutput.chauffeur_id = paymentInfo.chauffeur_id;
                                    //paymentOutput.outstanding_balance = response.walletOutput.outstanding_balance;
                                    //paymentOutput.ride_amount = response.walletOutput.ride_amount;
                                    //paymentOutput.outstanding_balance = response.walletOutput.wallet_balance;
                                    //paymentOutput.adjusted_amount = response.walletOutput.adjusted_amount;
                                    //paymentOutput.amount_to_be_paid = response.walletOutput.total_amount_to_be_paid;

                                    //paymentOutput.previous_balance = response.walletOutput.prev_wallet_balance;
                                    //paymentOutput.is_coupon_applied = is_coupon_applied;
                                    //paymentOutput.base_fare = base_fare;
                                    //paymentOutput.rates = rates;
                                    //paymentOutput.rate_type = rate_type;
                                    //paymentOutput.mandatory_charges = mandatory_charges;
                                    //paymentOutput.other_charges = other_charges;
                                    //paymentOutput.vat = vat;
                                    //paymentOutput.is_invoice_created = is_invoice_created;
                                    //paymentOutput.total_amount_to_be_paid = total_amount_to_be_paid;
                                    //paymentOutput.discount_amount = discount_amount;

                                }
                                else {
                                    paymentOutput.is_paid = false;
                                    paymentOutput.paymentMethod = payment_type;
                                    paymentOutput.error = "Payment Status Notification is not sent to Customer.";
                                    paymentOutput.success = false;
                                    //paymentOutput.wallet_balance = response.walletOutput.balance;
                                    paymentOutput.currency = process.env.CURRENCY_CODE;
                                }
                            } else {
                                paymentOutput.is_paid = false;
                                paymentOutput.paymentMethod = payment_type;
                                paymentOutput.error = response.walletOutput.error;
                                paymentOutput.success = false;
                                //paymentOutput.wallet_balance = response.walletOutput.balance;
                                paymentOutput.currency = process.env.CURRENCY_CODE;
                            }
                        } else {
                            paymentOutput.is_paid = false;
                            paymentOutput.paymentMethod = payment_type;
                            paymentOutput.error = response.walletOutput.error;
                            paymentOutput.success = false;
                            //paymentOutput.wallet_balance = response.walletOutput.balance;
                            paymentOutput.currency = process.env.CURRENCY_CODE;
                            paymentOutput.ride_amount = response.walletOutput.ride_amount;
                            //paymentOutput.is_balance_insufficient = response.walletOutput.is_balance_insufficient;
                        }


                    }

                } else {
                    paymentOutput.is_paid = false;
                    paymentOutput.paymentMethod = payment_type;
                    paymentOutput.error = "Calculated Ride Amount is incorrect";
                    paymentOutput.success = false;
                }


                //                 if (final_result && final_result.final_total_amount > 0) {

                //                     const base_fare = final_result ? final_result.base_fare : 0.0;
                //                     const rate_type = paymentOutput.rideItem.rate_type;
                //                     const { [rate_type]: rates } = final_result.rates;

                //                     const mandatory_charges = final_result.mandatory_charges.total;
                //                     const other_charges = final_result.other_charges.total;
                //                     const vat = final_result.vat;
                //                     const is_coupon_applied = final_result.isCouponApplied;
                //                     const total_after_discount = final_result ? final_result.total_after_discount : 0.0
                //                     let discount_amount = final_result ? final_result.coupon_discount : 0;
                //                     let total_amount_to_be_paid = final_result
                //                         ? final_result.final_total_amount : 0;
                //                     const estimated_total_amount = final_result ? final_result.estimated_total_amount : 0.0;

                //                     let coupon_ids = final_result?.appliedCoupons.map(x => x.coupon_id);

                //                     const is_invoice_created = false;
                //                     await Promise.all(paymentOutput.rideItem.status_log.map(async (item) => {
                //                         if (item.status.toLowerCase() === c_r_s_status_name) {
                //                             start_time = item.datetime;
                //                         }
                //                         if (item.status.toLowerCase() === c_r_e_status_name) {
                //                             end_time = item.datetime;
                //                         }
                //                     }));
                //                     const date1 = moment(start_time);
                //                     const date2 = moment(end_time);
                //                     estimated_time_in_minutes = parseFloat(date2.diff(date1, 'minutes', true)).toFixed(2);
                //                     //console.log('estimated_time_in_min', parseInt(estimated_time_in_minutes));


                //                     const countryName = await getCountryNameByCode(paymentOutput.customer.country_code);

                //                     const cartid = await generateRandomAlphaNumericText(13);
                //                     console.log('cart id', cartid);
                //                     const fullName = `${paymentOutput.customer.first_name} ${paymentOutput.customer.last_name}`;
                //                     const today = new Date();

                //                     const payload = {
                //                         QuickLinkRequest: {
                //                             StoreID: process.env.TELR_MERCHANT_ID,
                //                             AuthKey: process.env.TELR_SECRET_KEY,
                //                             Details: {
                //                                 Desc: "Zeizzu Ride Payment",
                //                                 Cart: `Zeizzu_QLink_${cartid}`,
                //                                 Currency: process.env.CURRENCY_CODE,
                //                                 Amount: 1,
                //                                 MinQuantity: 1,
                //                                 MaxQuantity: 1,
                //                                 FullName: fullName,
                //                                 Addr1: "",
                //                                 City: "",
                //                                 Country: countryName,
                //                                 Email: "",
                //                                 Phone: paymentOutput.customer.mobile_number
                //                             },
                //                             VariableValueMode: {
                //                                 Status: "",
                //                                 SectionTitle: ""
                //                             },
                //                             RepeatBilling: {
                //                                 Status: "",
                //                                 Amount: "",
                //                                 Period: "",
                //                                 Interval: "",
                //                                 Start: "",
                //                                 Term: "",
                //                                 Final: ""
                //                             },
                //                             Availability: {
                //                                 NotValidBefore: {
                //                                     Day: String(today.getDate()).padStart(2, '0'),
                //                                     Month: String(today.getMonth() + 1).padStart(2, '0'),
                //                                     Year: today.getFullYear()
                //                                 },
                //                                 NotValidAfter: {
                //                                     Day: String(today.getDate()).padStart(2, '0'),
                //                                     Month: String(today.getMonth() + 1).padStart(2, '0'),
                //                                     Year: today.getFullYear()
                //                                 },
                //                                 StockControl: "1",
                //                                 StockCount: "1"
                //                             }
                //                         }
                //                     };

                //                     // Call Telr API to Verify payment request
                //                     //const result = await axios.post(process.env.TELR_QLINK_API_URL, payload);

                //                     //if (result.data.QuickLinkResponse.Status === "Success") {

                //                     // //send payment link
                //                     // const ph_number = `${paymentOutput.customer.country_code}${paymentOutput.customer.mobile_number}`;
                //                     // console.log(ph_number);
                //                     // paymentOutput = {};
                //                     // paymentOutput.url = result.data.QuickLinkResponse.URL;
                //                     // paymentOutput.is_paid = false;
                //                     // paymentOutput.success = true;

                //                     // const smsInfo = {
                //                     //     Text: `Your payment link is ${result.data.QuickLinkResponse.URL}`,
                //                     //     phoneNumber: ph_number.replace(/\+/g, "")
                //                     // };

                //                     // const outputResponse = await sendSms(smsInfo, config.defaultSmsProvider);
                //                     // if (outputResponse.status === "True") {
                //                     //     console.log("SMS sent successfully");
                //                     // }



                //                     let notificationData;
                //                     notificationData = {
                //                         title: "Wallet Payment Status",
                //                         data: {
                //                             ride_id: paymentOutput.rideItem.ride_id.toString(),
                //                             requested_pickup_point: paymentOutput.rideItem.requested_pickup_point.toString(),
                //                             requested_pickup_lat: paymentOutput.rideItem.requested_pickup.lat.toString(),
                //                             requested_pickup_long: paymentOutput.rideItem.requested_pickup.long.toString(),
                //                             customer_id: paymentOutput.rideItem.customer_id.toString(),
                //                             estimated_amount: total_amount_to_be_paid,
                //                             requested_drop_point: paymentOutput.rideItem.requested_drop_point.toString(),
                //                             requested_drop_lat: paymentOutput.rideItem.requested_drop.lat.toString(),
                //                             requested_drop_long: paymentOutput.rideItem.requested_drop.long.toString(),
                //                             notification_type: "payment_initiation_status",
                //                             recipient_type: "customer",
                //                             recipient_id: paymentOutput.rideItem.customer_id.toString(),
                //                             order_date: paymentOutput.rideItem.order_date.toString(),
                //                         },
                //                         notification_type: "payment_initiation_status",
                //                         recipient_type: "customer",
                //                         recipient_id: paymentOutput.rideItem.customer_id.toString(),
                //                     };
                //                     const paymentInfo = {
                //                         payment_type_id: paymentOutput.payment_method.id,
                //                         method: '',
                //                         currency: process.env.CURRENCY_CODE,
                //                         amount: estimated_total_amount,
                //                         custRef: '',
                //                         cartidRef: 0,
                //                         description: 'Quick Link Payment',
                //                         order_ref: '',
                //                         is_paid: true,
                //                         user_id: customer_id,
                //                         order_url: '',
                //                         transaction_ref: '',
                //                         ride_id,
                //                         status_log_details: paymentOutput.rideItem.status_log,
                //                         payment_type,
                //                         notificationData,
                //                         discount_amount,
                //                         total_amount_to_be_paid,
                //                         //chauffeur_id: paymentOutput.rideItem.chauffeur_id,
                //                         chauffeur_id: user_id,
                //                         payment_details: paymentOutput.rideItem.paymentDetails,
                //                         //c_r_c_status_name,
                //                         c_p_p_status_name,
                //                         c_r_p_status_name,
                //                         w_d_transaction_type_id: paymentOutput.walletDStatusCode.id,
                //                         w_c_transaction_type_id: paymentOutput.walletCStatusCode.id,
                //                         payment_pending_status_id: paymentOutput.paymentPStatusCode.id,
                //                         is_org: false,
                //                         coupon_ids: is_coupon_applied ? coupon_ids : null,
                //                         is_coupon_applied,
                //                         base_fare,
                //                         rates,
                //                         rate_type,
                //                         mandatory_charges,
                //                         other_charges,
                //                         vat,
                //                         is_invoice_created,
                //                         estimated_time_in_minutes: parseInt(estimated_time_in_minutes),
                //                         total_after_discount
                //                     };

                //                     const response = await paymentsDAO.createQuickLinkPaymentRecord(paymentInfo);
                //                     console.log('response', response);


                //                     paymentOutput = {};
                //                     paymentOutput.is_paid = false;
                //                     paymentOutput.success = true;


                //                     // if (response.walletOutput.success) {
                //                     //     if (response.walletOutput.payment_status === c_p_p_status_name) {
                //                     //         paymentInfo.notificationData.body = `Quick Link Payment sent to customer successfully for the ride ${paymentInfo.ride_id}.`;
                //                     //         const notification_results = await queuePushNotification(paymentInfo.device_id, paymentInfo.notificationData);
                //                     //         if (notification_results && notification_results.notification_id !== '') {
                //                     //             paymentOutput.response = response;
                //                     //             paymentOutput.is_paid = true;
                //                     //             paymentOutput.paymentMethod = payment_type;
                //                     //             paymentOutput.error = '';
                //                     //             paymentOutput.success = true;
                //                     //             paymentOutput.payment_status = response.walletOutput.payment_status;
                //                     //             paymentOutput.wallet_payment_id = response.walletOutput.wallet_payment_id;
                //                     //             paymentOutput.wallet_balance = response.walletOutput.balance;
                //                     //             paymentOutput.currency = process.env.CURRENCY_CODE;
                //                     //             paymentOutput.chauffeur_id = paymentInfo.chauffeur_id;
                //                     //             paymentOutput.ride_amount = response.walletOutput.ride_amount;
                //                     //             paymentOutput.outstanding_balance = response.walletOutput.wallet_balance;
                //                     //             paymentOutput.adjusted_amount = response.walletOutput.adjusted_amount;
                //                     //             //paymentOutput.amount_to_be_paid = response.walletOutput.total_amount_to_be_paid;

                //                     //             paymentOutput.previous_balance = response.walletOutput.prev_wallet_balance;
                //                     //             paymentOutput.is_coupon_applied = is_coupon_applied;
                //                     //             //paymentOutput.base_fare = base_fare;
                //                     //             paymentOutput.rates = rates;
                //                     //             paymentOutput.rate_type = rate_type;
                //                     //             paymentOutput.mandatory_charges = mandatory_charges;
                //                     //             paymentOutput.other_charges = other_charges;
                //                     //             paymentOutput.vat = vat;
                //                     //             paymentOutput.is_invoice_created = is_invoice_created;
                //                     //             paymentOutput.total_amount_to_be_paid = total_amount_to_be_paid;
                //                     //             paymentOutput.discount_amount = discount_amount;
                //                     //             await addServerLog({
                //                     //                 log_level: "INFO",
                //                     //                 error_message: `quickPaymentLinkProcess success ${total_amount_to_be_paid}`
                //                     //             });
                //                     //         }
                //                     //         else {
                //                     //             paymentOutput.is_paid = false;
                //                     //             paymentOutput.paymentMethod = payment_type;
                //                     //             paymentOutput.error = "Payment Status Notification is not sent to Customer.";
                //                     //             paymentOutput.success = false;
                //                     //             paymentOutput.wallet_balance = response.walletOutput.balance;
                //                     //             paymentOutput.currency = process.env.CURRENCY_CODE;
                //                     //         }
                //                     //     } else {
                //                     //         paymentOutput.is_paid = false;
                //                     //         paymentOutput.paymentMethod = payment_type;
                //                     //         paymentOutput.error = response.walletOutput.error;
                //                     //         paymentOutput.success = false;
                //                     //         paymentOutput.wallet_balance = response.walletOutput.balance;
                //                     //         paymentOutput.currency = process.env.CURRENCY_CODE;
                //                     //     }
                //                     // } else {
                //                     //     paymentOutput.is_paid = false;
                //                     //     paymentOutput.paymentMethod = payment_type;
                //                     //     paymentOutput.error = response.walletOutput.error;
                //                     //     paymentOutput.success = false;
                //                     //     paymentOutput.wallet_balance = response.walletOutput.balance;
                //                     //     paymentOutput.currency = process.env.CURRENCY_CODE;
                //                     //     paymentOutput.ride_amount = response.walletOutput.ride_amount;
                //                     //     paymentOutput.is_balance_insufficient = response.walletOutput.is_balance_insufficient;
                //                     // }

                //                     //}

                //                     /*success: response.data.QuickLinkResponse.Status === "Success" ? true : false,
                //                             data: {
                //                                 Url: response.data.QuickLinkResponse.URL
                //                             }
                // */



                //                 }
                //                 else {
                //                     paymentOutput = {};
                //                     paymentOutput.is_paid = false;
                //                     paymentOutput.paymentMethod = payment_type;
                //                     paymentOutput.error = "Calculated Ride Amount is incorrect";
                //                     paymentOutput.success = false;
                //                 }

            }
            return paymentOutput;
        }


    } catch (error) {
        //console.log('verify payment process error -', error.message);
        await addServerLog({
            log_level: "ERROR",
            error_message: `quick payment Link process error - ${error.message}.`
        });
        throw error;
    }
};

const getPDWalletByTransactions = async (pd_id, start_date, end_date) => {
    try {

        if (isValidDate(start_date) && isValidDate(end_date)) {
            if (start_date > end_date) {
                return {
                    success: false,
                    message: "Start Date cannot be greater than End date.",
                    data: {}
                }
            }
        }

        //const cash_payment_type = await paymentsDAO.getPaymentTypeMethodByName(true, true, 'cash');

        const transItems = await paymentsDAO.getPDBasedTransDetails(pd_id, start_date, end_date);
        return transItems;
    } catch (error) {
        await addServerLog({
            log_level: "ERROR",
            error_message: `getPDWalletByTransactions error - ${error.message}.`
        });
        throw error;
    }

}


const getChauffeurRevenueByRides = async (chauffeur_id, start_date, end_date) => {
    try {

        if (isValidDate(start_date) && isValidDate(end_date)) {
            if (start_date > end_date) {
                return {
                    success: false,
                    message: "Start Date cannot be greater than End date.",
                    data: {}
                }
            }
        }

        //const cash_payment_type = await paymentsDAO.getPaymentTypeMethodByName(true, true, 'cash');

        const rides = await paymentsDAO.getChauffeurAPTRideDetails(chauffeur_id, 0, start_date, end_date);
        return rides;
    } catch (error) {
        await addServerLog({
            log_level: "ERROR",
            error_message: `getChauffeurRevenueByRides error - ${error.message}.`
        });
        throw error;
    }

}

const getUserCardsById = async (user_id) => {
    try {
        const cards = await paymentsDAO.getUserCardsById(user_id);
        return cards;
    } catch (error) {
        await addServerLog({
            log_level: "ERROR",
            error_message: `getUserCardsById error - ${error.message}.`
        });
        throw error;
    }
};


module.exports = {
    getWalletDetails,   //
    getUsersWalletBalance,  //
    getCorporatePaymentDetails, //
    getChauffeurWalletDetails,  //
    getPDPgnWalletDetails,  //
    getChauffeurPgnWalletDetails,   //
    orgPaymentByRidesUpdate,    //
    getPDWalletDetails, //
    getAdminWalletDetails,  //
    createAdminCashPayment, //
    getChauffeurWalletByRides, //
    createAdminWalletPayment, //
    quickPaymentLinkProcess, //
    getPDWalletByTransactions, //
    getChauffeurRevenueByRides,
    getUserCardsById

}
