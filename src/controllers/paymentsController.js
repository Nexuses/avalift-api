const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');
//const PaymentsService = require('../services/paymentsService');
const redirectVerifyPaymentUrl = '/api/payments/verify-payment-success';
const PaymentsService = require('../services/paymentsService');
const config = require('../config/provider');
const winston = require('winston');
const { addServerLog } = require('../services/serverLogsService');
const adminPaymentsService = require('../services/adminPaymentsService');

exports.verifyPayment = async (req, res, next) => {
    try {
        //process verify payment
        const user_id = req.user.id;
        if (!user_id) {
            return res.status(400).json({
                success: false,
                status: 400,
                message: "Customer ID not found.",
            });
        }
        const result = await PaymentsService.verifyPaymentProcess(req.body, user_id);
        return res.status(200).json({ result });

    } catch (error) {
        await addServerLog({
            log_level: "ERROR",
            service_name: "verifyPayment",
            error_message: `verifyPayment error - ${error.message}.`
        });

        next(error);
    }
};

exports.verifyQuickLinkPaymentProcess = async (req, res, next) => {
    try {
        // const orgURL = req.originalUrl;
        // console.log('orgURL', orgURL);

        const logDir = path.join(__dirname, 'logs', 'telr');
        if (!fs.existsSync(logDir)) {
            fs.mkdirSync(logDir, { recursive: true });
        }
        const logger = winston.createLogger({
            level: 'info',
            format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.json()
            ),
            transports: [
                new winston.transports.Console(),
                new winston.transports.File({
                    filename: path.join(logDir, 'quicklink.log'),
                    handleExceptions: true
                }),

            ],
            exitOnError: false,
        });

        const tranInfo = {
            orderRef: req.query.OrderRef,
            ACCEPTANCE: req.query.ACCEPTANCE,
            amount: req.query.amount,
            BRAND: req.query.BRAND,
            CN: req.query.CN,
            currency: req.query.currency,
            NCERROR: req.query.NCERROR,
            PAYID: req.query.PAYID,
            PM: req.query.PM,
            STATUS: req.query.STATUS,
            orderPaymentType: 'applepay'
        };

        logger.info('verifyQuickLinkPaymentStatus req-' + tranInfo);
        //logger.info('verifyQuickLinkPaymentStatus res-' + res);

        console.log('verifyQuickLinkPaymentStatus req', tranInfo);
        //console.log('verifyQuickLinkPaymentStatus res', res);

        if (req.query.STATUS.toString() === '9') {
            logger.info('verifyQuickLinkPaymentStatus payment staust-Authorised');
        } else if (req.query.STATUS.toString() === '2') {
            logger.info('verifyQuickLinkPaymentStatus payment staust-Declined');
        } else if (req.query.STATUS.toString() === '1') {
            logger.info('verifyQuickLinkPaymentStatus payment staust-Cancelled');
        } else if (req.query.STATUS.toString() === '5') {
            logger.info('verifyQuickLinkPaymentStatus payment staust-On Hold');
        }

        console.log('verifyQuickLinkPaymentStatus req.body');
        res.status(200).json({
            success: true,
            message: "Quick Link Payment Status fetched successfully.",
            data: {
                //url: req.originalUrl,
                //status: req.query.STATUS,
                tranInfo
            }
        });
    } catch (error) {
        console.log('verifyQuickLinkPaymentStatus error', error);
        await addServerLog({
            log_level: "ERROR",
            service_name: "verifyQuickLinkPaymentStatus",
            error_message: `verifyQuickLinkPaymentStatus error - ${error.message}.`
        });
        res.status(500).json({
            success: false,
            message: "Failed to process Quick Link Payment.",
            error: "Failed to process Quick Link Payment."
        });
    }
}

exports.verifyPaymentProcess = async (req, res, next) => {
    try {
        const tranInfo = {
            orderRef: req.query.OrderRef,
            ACCEPTANCE: req.query.ACCEPTANCE,
            amount: req.query.amount,
            BRAND: req.query.BRAND,
            CN: req.query.CN,
            currency: req.query.currency,
            NCERROR: req.query.NCERROR,
            PAYID: req.query.PAYID,
            PM: req.query.PM,
            STATUS: req.query.STATUS,
            orderPaymentType: 'verify'
        };

        const orgURL = req.originalUrl
        //store transaction information
        const cardInfo = await PaymentsService.executeVerifyPaymentSuccess(tranInfo.orderRef);
        if (!cardInfo.success) {
            throw cardInfo;
        } else {
            return res.redirect(redirectVerifyPaymentUrl);
        }
    } catch (error) {
        await addServerLog({
            log_level: "ERROR",
            service_name: "verifyPaymentProcess",
            error_message: `verifyPaymentProcess error - ${error.message}.`
        });

        next(error);
    }
}

exports.verifyPaymentSuccess = async (req, res, next) => {
    try {
        res.status(200).json({ success: true, message: 'Verify Payment Transaction Process is successful' });
    } catch (error) {
        await addServerLog({
            log_level: "ERROR",
            service_name: "verifyPaymentSuccess",
            error_message: `verifyPaymentSuccess error - ${error.message}.`
        });

        res.status(500).json({
            success: false,
            message: "Failed to process Verify Payment.",
            error: "Failed to process Verify Payment."
        });
    }

}
exports.verifyPaymentDeclined = async (req, res, next) => {
    try {
        res.status(500).json({
            success: false, message: 'Verify Payment Declined', error: {
                response: req.query
            }
        });
    } catch (error) {
        await addServerLog({
            log_level: "ERROR",
            service_name: "verifyPaymentDeclined",
            error_message: `verifyPaymentDeclined error - ${error.message}.`
        });

        res.status(500).json({
            success: false,
            message: "Verify Payment Declined.",
            error: "Verify Payment Declined."
        });
    }
}

exports.verifyPaymentCancelled = async (req, res, next) => {
    try {
        res.status(500).json({
            success: false, message: 'Verify Payment Canceled', error: {
                response: req.query
            }
        });
    } catch (error) {
        await addServerLog({
            log_level: "ERROR",
            service_name: "verifyPaymentCancelled",
            error_message: `verifyPaymentCancelled error - ${error.message}.`
        });

        res.status(500).json({
            success: false,
            message: "Verify Payment Canceled.",
            error: "Verify Payment Canceled."
        });
    }
}

exports.salePayment = async (req, res) => {
    try {
        const user_id = req.user.id;
        if (!user_id) {
            return res.status(401).json({
                success: false,
                status: 401,
                message: "Customer ID not found.",
            });
        }
        //invoked by the driver so no need to pass req.user customer id 
        const output = await PaymentsService.salePaymentProcess(req.body);

        if (output.success) {
            res.status(200).json({
                success: output.success,
                message: "Sale Payment completed successfully.",
                data: {
                    payment_method: output.paymentMethod,
                    amount: output.amount,
                    currency: output.currency,
                    payment_status: output.payment_status,
                    tranaction_reference: output.tranref,
                    chauffeur_id: output.chauffeur_id,
                    is_coupon_applied: output.is_coupon_applied,
                    //base_fare: output.base_fare,
                    rates: output.rates,
                    rate_type: output.rate_type,
                    manatory_charges: output.mandatory_charges,
                    other_charges: output.other_charges,
                    vat: output.vat,
                    is_invoice_created: output.is_invoice_created,
                    total_amount_to_be_paid: output.total_amount_to_be_paid,
                    discount_amount: output.discount_amount
                }
            });
        } else {
            await addServerLog({
                log_level: "ERROR",
                service_name: "salePayment",
                error_message: `salePayment error - ${output.error}.`
            });
            res.status(400).json({
                success: output.success,
                message: output.error
            });
        }
    } catch (error) {
        //next(error);
        await addServerLog({
            log_level: "ERROR",
            service_name: "salePayment",
            error_message: `salePayment error - ${error.message}.`
        });

        res.status(500).json({
            success: false,
            message: "Failed to process Sale Payment.",
            error: "Failed to process Sale Payment."
        });
    }
}

exports.getUserCards = async (req, res, next) => {
    try {
        //const { user_id } = req.params;
        const user_id = req.user.id;
        if (!user_id) {
            return res.status(400).json({
                success: false,
                status: 400,
                message: "Customer ID not found.",
            });
        }
        const cardDetails = await PaymentsService.getUserCardDetails(user_id);

        if (cardDetails.length === 0) {
            return res.status(404).json({ message: "No cards found for the user." });
        }

        // Send the list of customer cards as the response
        res.status(200).json({
            success: true,
            message: "Cards fetched successfully",
            data: {
                cards: cardDetails,
                totalCards: cardDetails.length,
            }
        });
    } catch (error) {
        await addServerLog({
            log_level: "ERROR",
            service_name: "getUserCards",
            error_message: `getUserCards error - ${error.message}.`
        });

        next(error);
    }
}


exports.getRidesForPayment = async (req, res, next) => {
    try {
        const user_id = req.user.id;
        if (!user_id) {
            return res.status(400).json({
                success: false,
                status: 400,
                message: "Customer ID not found.",
            });
        }
        //get waiting for payment status records
        const rideDetails = await PaymentsService.getRidesForPayment(req.body, user_id);
        res.status(200).json({ data: { rideDetails } });
    } catch (error) {
        await addServerLog({
            log_level: "ERROR",
            service_name: "getRidesForPayment",
            error_message: `getRidesForPayment error - ${error.message}.`
        });
        next(error);
    }

}

exports.selectPaymentMethod = async (req, res, next) => {
    try {
        const paymentMethods = await PaymentsService.getPaymentTypes(req.body);
        res.status(200).json({
            success: true,
            message: "Payment Methods fetched successfully",
            data: { paymentMethods }
        });
    } catch (error) {
        await addServerLog({
            log_level: "ERROR",
            service_name: "selectPaymentMethod",
            error_message: `selectPaymentMethod error - ${error.message}.`
        });
        next(error);
    }
}

exports.cashRidePayment = async (req, res) => {
    try {
        const user_id = req.user.id;
        if (!user_id) {
            return res.status(400).json({
                success: false,
                status: 400,
                message: "Customer ID not found.",
            });
        }
        //the driver initiates the payment so pass customer id instead of req user id
        const output = await PaymentsService.createCashPayment(req.body, user_id);
        if (output) {
            if (output.success) {
                res.status(200).json({
                    success: output.success,
                    message: "Cash Payment completed successfully.",
                    data: {
                        payment_method: output.paymentMethod,
                        amount: output.amount,
                        currency: output.currency,
                        payment_status: output.payment_status,
                        chauffeur_id: output.chauffeur_id,
                        is_coupon_applied: output.is_coupon_applied,
                        //base_fare: output.base_fare,
                        rates: output.rates,
                        rate_type: output.rate_type,
                        manatory_charges: output.mandatory_charges,
                        other_charges: output.other_charges,
                        vat: output.vat,
                        is_invoice_created: output.is_invoice_created,
                        total_amount_to_be_paid: output.total_amount_to_be_paid,
                        discount_amount: output.discount_amount
                    }
                });
            } else {
                await addServerLog({
                    log_level: "ERROR",
                    service_name: "cashRidePayment",
                    error_message: `cashRidePayment error - ${output.error}.`
                });
                res.status(400).json({
                    success: output.success,
                    message: output.error
                });
            }
        } else {
            await addServerLog({
                log_level: "ERROR",
                service_name: "cashRidePayment",
                error_message: `cashRidePayment error - ${output.error}.`
            });

            res.status(404).json({
                success: false,
                message: "Cash Payment process failed.",
                error: output.error,
                error_code: 404
            });
        }


    } catch (error) {
        await addServerLog({
            log_level: "ERROR",
            service_name: "cashRidePayment",
            error_message: `cashRidePayment error - ${error.message}.`
        });
        res.status(500).json({
            success: false,
            message: "Failed to process Cash Payment.",
            error: "Failed to process Cash Payment."
        });
        //next(error);
        //throw error;
    }
}


exports.getRidesForChauffeur = async (req, res, next) => {
    try {
        //get waiting for payment status records
        const rideDetails = await PaymentsService.getRidesByChauffeurForPayment(req.body);
        res.status(200).json({ data: { rideDetails } });
    } catch (error) {
        await addServerLog({
            log_level: "ERROR",
            service_name: "getRidesForChauffeur",
            error_message: `getRidesForChauffeur error - ${error.message}.`
        });
        next(error);
    }

}

exports.getPaymentStatus = async (req, res, next) => {
    try {
        const user_id = req.user.id;
        if (!user_id) {
            return res.status(400).json({
                success: false,
                status: 400,
                message: "Customer ID not found.",
            });
        }
        //get waiting for payment status records
        const ridePaymentStatus = await PaymentsService.getRidePaymentStatus(req.body, user_id);

        res.status(200).json({ data: { ridePaymentStatus } });
    } catch (error) {
        await addServerLog({
            log_level: "ERROR",
            service_name: "getPaymentStatus",
            error_message: `getPaymentStatus error - ${error.message}.`
        });
        next(error);
    }
}

exports.getExpenseDetails = async (req, res, next) => {
    try {
        const user_id = req.user.id;
        if (!user_id) {
            return res.status(400).json({
                success: false,
                status: 400,
                message: "Customer ID not found.",
            });
        }
        //get waiting for payment status records
        const userPaymentDetails = await PaymentsService.getExpenseDetailsByUser(user_id);
        res.status(200).json({ userPaymentDetails });
    } catch (error) {
        await addServerLog({
            log_level: "ERROR",
            service_name: "getExpenseDetails",
            error_message: `getExpenseDetails error - ${error.message}.`
        });
        next(error);
    }
}

exports.walletTopup = async (req, res, next) => {
    try {
        const output = await PaymentsService.walletTopupProcess(req.body);
        // console.log('outpu', output);
        if (output.success) {
            res.status(200).json({
                status: output.status,
                transaction_reference: output.tranref,
                success: output.success,
                message: "Wallet Top-up is successfully completed.",
                data: output.wallet_response,
                wallet_balance: output.account_balance
            });
        } else {
            await addServerLog({
                log_level: "ERROR",
                service_name: "walletTopup",
                error_message: `walletTopup error - ${output.error}.`
            });
            res.status(404).json({
                success: output.success,
                message: "Error while processing Wallet Top up.",
                error: output.error,
            });
        }
    } catch (error) {
        await addServerLog({
            log_level: "ERROR",
            service_name: "walletTopup",
            error_message: `walletTopup error - ${error.message}.`
        });

        //console.log(error);
        res.status(500).json({
            success: false,
            error: "Failed to process Wallet Top up."
        })
    }
}

exports.rideWalletPayment = async (req, res) => {
    try {
        //the driver initiates the payment so pass customer id instead of req user id
        const output = await PaymentsService.createWalletPayment(req.body);

        if (output.success) {
            res.status(200).json({
                success: output.success,
                message: "Wallet Payment completed successfully.",
                data: {
                    currency: output.currency,
                    wallet_balance: output.wallet_balance,
                    chauffeur_id: output.chauffeur_id,
                    outstanding_balance: output.outstanding_balance,
                    ride_amount: output.ride_amount,
                    is_paid: true,
                    is_balance_sufficient: true,
                    adjusted_amount: output.adjusted_amount,
                    total_amount_to_be_paid: output.amount_to_be_paid,
                    previous_wallet_balance: output.previous_balance,
                    is_coupon_applied: output.is_coupon_applied,
                    //base_fare: output.base_fare,
                    rates: output.rates,
                    rate_type: output.rate_type,
                    manatory_charges: output.mandatory_charges,
                    other_charges: output.other_charges,
                    vat: output.vat,
                    is_invoice_created: output.is_invoice_created,
                    total_amount_to_be_paid: output.total_amount_to_be_paid,
                    discount_amount: output.discount_amount
                }
            });
        } else {
            await addServerLog({
                log_level: "ERROR",
                service_name: "rideWalletPayment",
                error_message: `rideWalletPayment error - ${output.error}.`
            });

            res.status(404).json({
                success: output.success,
                message: "Error while processing Wallet Payment.",
                error: output.error,
                currency: output.currency,
                wallet_balance: output.wallet_balance,
                ride_amount: output.ride_amount,
                is_paid: false,
                is_balance_insufficient: output.is_balance_insufficient
            });
        }

    } catch (error) {
        await addServerLog({
            log_level: "ERROR",
            service_name: "rideWalletPayment",
            error_message: `rideWalletPayment error - ${error.message}.`
        });

        res.status(500).json({
            success: false,
            message: "Failed to process Wallet Payment.",
            error: "Failed to process Wallet Payment."
        })
    }
}

exports.userWalletDetails = async (req, res) => {
    try {

        const { start_date, end_date, page, limit, search_string } = req.body;

        //get wallets details of users
        const results = await adminPaymentsService.getWalletDetails(start_date, end_date, page, limit, search_string);
        res.status(200).json({ results });
    } catch (error) {

        await addServerLog({
            log_level: "ERROR",
            service_name: "userWalletDetails",
            error_message: `userWalletDetails error - ${error.message}.`
        });
        res.status(500).json({
            success: false,
            error: "Failed to fetch Wallet Balance of Users."
        })
    }
}

exports.userWalletDetailsById = async (req, res) => {
    try {
        const user_id = req.user.id;
        if (!user_id) {
            return res.status(400).json({
                success: false,
                status: 400,
                message: "Customer ID not found.",
            });
        }
        //get wallets details of a user
        const userWalletsDetail = await PaymentsService.getWalletDetailsByUser(user_id);

        res.status(200).json({
            userWalletsDetail
        });
    } catch (error) {
        await addServerLog({
            log_level: "ERROR",
            service_name: "userWalletDetailsById",
            error_message: `userWalletDetailsById error - ${error.message}.`
        });
        res.status(500).json({
            success: false,
            error: "Failed to fetch Wallet Balance of a User."
        })
    }
}


exports.getCustomerWalletHistory = async (req, res) => {
    try {
        const user_id = req.user.id;
        if (!user_id) {
            return res.status(400).json({
                success: false,
                status: 400,
                message: "Customer ID not found.",
            });
        }
        //get wallets details of a user
        const userWalletsDetail = await PaymentsService.getWalletDetailsByUser(user_id);

        res.status(200).json({
            userWalletsDetail
        });
    } catch (error) {
        await addServerLog({
            log_level: "ERROR",
            service_name: "getCustomerWalletHistory",
            error_message: `getCustomerWalletHistory error - ${error.message}.`
        });

        res.status(500).json({
            success: false,
            error: "Failed to fetch Wallet Balance of a User."
        })
    }
}

exports.cancelRideProcessPayment = async (req, res) => {
    try {
        //the driver initiates the payment so pass customer id instead of req user id
        const output = await PaymentsService.cancelRideWalletUpdate(req.body);
        if (output.success) {
            res.status(200).json({
                success: output.success,
                message: "Cancel Ride Penality Processed successfully.",
                data: {
                    currency: output.currency,
                    wallet_balance: output.wallet_balance,
                    chauffeur_id: output.chauffeur_id,
                    outstanding_balance: output.outstanding_balance,
                    ride_amount: output.ride_amount,
                    is_deducted: true,
                    adjusted_amount: output.adjusted_amount,
                    total_amount_to_be_paid: output.amount_to_be_paid,
                    previous_wallet_balance: output.previous_balance
                }
            });
        } else {
            await addServerLog({
                log_level: "ERROR",
                service_name: "cancelRideProcessPayment",
                error_message: `cancelRideProcessPayment error - ${output.error}.`
            });

            res.status(404).json({
                success: output.success,
                message: "Error while processing Cancel Ride Penality",
                error: output.error,
                currency: output.currency,
                wallet_balance: output.wallet_balance,
                ride_amount: output.ride_amount,
                is_deducted: false,
            });
        }

    } catch (error) {
        await addServerLog({
            log_level: "ERROR",
            service_name: "cancelRideProcessPayment",
            error_message: `cancelRideProcessPayment error - ${error.message}.`
        });

        res.status(500).json({
            success: false,
            error: "Failed to process Cancel Ride Penality."
        })
    }
}

exports.createCustomerWallet = async (req, res) => {
    try {
        const user_id = req.user.id;
        const output = await PaymentsService.createCustomerWallet(user_id);
        if (output.success) {
            res.status(201).json({
                success: output.success,
                message: output.message,
                wallet_balance: `${output.currency} ${output.wallet_balance}`,
            });
        } else {
            await addServerLog({
                log_level: "ERROR",
                service_name: "createCustomerWallet",
                error_message: `createCustomerWallet error - ${output.error}.`
            });

            res.status(404).json({
                success: output.success,
                message: "Error while creating zero wallet balance for Customer",
                error: output.error,
            });
        }
    } catch (error) {
        await addServerLog({
            log_level: "ERROR",
            service_name: "createCustomerWallet",
            error_message: `createCustomerWallet error - ${error.message}.`
        });
        res.status(500).json({
            success: false,
            error: "Failed to Create Customer Wallet."
        });
    }
}

exports.sendSmsCountrySMS = async (req, res) => {
    try {
        const { Text, phoneNumber } = req.body;
        const smsInfo = {
            Text,
            phoneNumber
        };

        const outputResponse = await PaymentsService.sendSms(smsInfo, config.defaultSmsProvider);
        res.status(200).json({
            outputResponse
        });
    } catch (error) {
        await addServerLog({
            log_level: "ERROR",
            service_name: "sendSmsCountrySMS",
            error_message: `sendSmsCountrySMS error - ${error.message}.`
        });

        res.status(500).json({
            success: false,
            error: "Failed to send Sms Country SMS."
        });
    }
}


exports.corporateRideWalletPayment = async (req, res) => {
    try {
        //the driver initiates the payment so pass corporate user id instead of req user id
        const output = await PaymentsService.createCorporateWalletPayment(req.body);
        console.log('output', output);
        if (output.success) {
            res.status(200).json({
                success: output.success,
                message: "Corporate Wallet Payment completed successfully.",
                data: {
                    currency: output.currency,
                    wallet_balance: output.wallet_balance,
                    chauffeur_id: output.chauffeur_id,
                    outstanding_balance: output.outstanding_balance,
                    ride_amount: output.ride_amount,
                    is_paid: true,
                    is_balance_sufficient: true,
                    adjusted_amount: output.adjusted_amount,
                    total_amount_to_be_paid: output.total_amount_to_be_paid,
                    previous_wallet_balance: output.previous_balance,
                    is_coupon_applied: output.is_coupon_applied,
                    //base_fare: output.base_fare,
                    rates: output.rates,
                    rate_type: output.rate_type,
                    manatory_charges: output.mandatory_charges,
                    other_charges: output.other_charges,
                    vat: output.vat,
                    is_invoice_created: output.is_invoice_created,
                    //total_amount_to_be_paid: output.total_amount_to_be_paid,
                    discount_amount: output.discount_amount
                }
            });
        } else {
            await addServerLog({
                log_level: "ERROR",
                service_name: "corporateRideWalletPayment",
                error_message: `corporateRideWalletPayment error - ${output.error}.`
            });
            res.status(404).json({
                success: output.success,
                message: "Error while processing Wallet Payment.",
                error: output.error,
                currency: output.currency,
                wallet_balance: output.wallet_balance,
                ride_amount: output.ride_amount,
                is_paid: false,
                is_balance_insufficient: output.is_balance_insufficient
            });


        }

    } catch (error) {
        await addServerLog({
            log_level: "ERROR",
            service_name: "corporateRideWalletPayment",
            error_message: `corporateRideWalletPayment error - ${error.message}.`
        });

        res.status(500).json({
            success: false,
            message: "Failed to process Wallet Payment.",
            error: "Failed to process Wallet Payment."
        })
    }
}

exports.corporateCustomerWallet = async (req, res) => {
    try {
        //const user_id = req.user.id;
        const output = await PaymentsService.createCorporateCustomerWallet(req.body);
        if (output.success) {
            res.status(201).json({
                success: output.success,
                message: output.message,
                wallet_balance: `${output.currency} ${output.wallet_balance}`,
            });
        } else {
            await addServerLog({
                log_level: "ERROR",
                service_name: "corporateCustomerWallet",
                error_message: `corporateCustomerWallet error - ${output.error}.`
            });
            res.status(404).json({
                success: output.success,
                message: "Error while creating zero wallet balance for Corporate Customer",
                error: output.error,
            });
        }
    } catch (error) {
        await addServerLog({
            log_level: "ERROR",
            service_name: "corporateCustomerWallet",
            error_message: `corporateCustomerWallet error - ${error.message}.`
        });
        res.status(500).json({
            success: false,
            error: "Failed to Create Corporate Customer Wallet."
        });
    }
}

exports.createPaymentType = async (req, res) => {
    try {
        const output = await PaymentsService.createPaymentTypes(req.body);
        if (output.success) {
            res.status(201).json({
                success: output.success,
                message: output.message,
            });
        } else {
            await addServerLog({
                log_level: "ERROR",
                service_name: "createPaymentType",
                error_message: `createPaymentType error - ${output.error}.`
            });
            res.status(404).json({
                success: output.success,
                message: "Error while creating or updating payment type",
                error: output.error,
            });
        }
    } catch (error) {
        await addServerLog({
            log_level: "ERROR",
            service_name: "createPaymentType",
            error_message: `createPaymentType error - ${error.message}.`
        });

        res.status(500).json({
            success: false,
            error: "Failed to Create or Update Payment Type."
        });
    }
}

exports.usersWalletBalance = async (req, res) => {
    try {

        const { start_date, end_date, customer_id, page, limit, search_string } = req.body;

        //get wallets balance of users
        const results = await adminPaymentsService.getUsersWalletBalance(start_date, end_date, customer_id, page, limit, search_string);
        res.status(200).json({ results });
    } catch (error) {
        await addServerLog({
            log_level: "ERROR",
            service_name: "usersWalletBalance",
            error_message: `usersWalletBalance error - ${error.message}.`
        });

        res.status(500).json({
            success: false,
            error: "Failed to fetch Wallet Balance of Users."
        })
    }
}

exports.getCorporatePayments = async (req, res) => {
    try {
        //get corporate outstanding payment details
        const results = await adminPaymentsService.getCorporatePaymentDetails(req.body);
        res.status(200).json({ results });
    } catch (error) {
        await addServerLog({
            log_level: "ERROR",
            service_name: "getCorporatePayments",
            error_message: `getCorporatePayments error - ${error.message}.`
        });

        res.status(500).json({
            success: false,
            error: "Failed to fetch Corporate Payment Details."
        })
    }
}

exports.getChauffeurWalletHistory = async (req, res) => {
    try {
        const { start_date, end_date, page, limit } = req.body;

        //get wallets details of a user
        //const userWalletsDetail = await PaymentsService.getChauffeurWalletDetailsByUser(user_id);
        const userWalletDetail = await adminPaymentsService.getChauffeurWalletDetails(start_date, end_date, page, limit);
        res.status(200).json({
            userWalletDetail
        });
    } catch (error) {
        await addServerLog({
            log_level: "ERROR",
            service_name: "getChauffeurWalletHistory",
            error_message: `getChauffeurWalletHistory error - ${error.message}.`
        });

        res.status(500).json({
            success: false,
            error: "Failed to fetch Wallet Balance of a Chauffeur."
        })
    }
}

exports.getChauffeurWallets = async (req, res) => {
    try {
        const { start_date, end_date, chauffeur_id, page, limit } = req.body;
        //get wallets details of a user
        const userWalletsDetail = await adminPaymentsService.getChauffeurPgnWalletDetails(start_date, end_date, chauffeur_id, page, limit);

        res.status(200).json({
            userWalletsDetail
        });
    } catch (error) {
        await addServerLog({
            log_level: "ERROR",
            service_name: "getChauffeurWallets",
            error_message: `getChauffeurWallets error - ${error.message}.`
        });

        res.status(500).json({
            success: false,
            error: "Failed to fetch Wallet Balance of a Chauffeur."
        })
    }
}


exports.createChauffeurWallet = async (req, res) => {
    try {
        const user_id = req.user.id;
        console.log('user_id', user_id);
        const output = await PaymentsService.createChauffeurWallet(user_id);
        if (output.success) {
            res.status(201).json({
                success: output.success,
                message: output.message,
                wallet_balance: `${output.currency} ${output.wallet_balance}`,
            });
        } else {
            await addServerLog({
                log_level: "ERROR",
                service_name: "createChauffeurWallet",
                error_message: `createChauffeurWallet error - ${output.error}.`
            });
            res.status(404).json({
                success: output.success,
                message: "Error while creating zero wallet balance for Chauffeur",
                error: output.error,
            });
        }
    } catch (error) {
        await addServerLog({
            log_level: "ERROR",
            service_name: "createChauffeurWallet",
            error_message: `createChauffeurWallet error - ${error.message}.`
        });

        res.status(500).json({
            success: false,
            error: "Failed to Create Chauffeur Wallet."
        });
    }
}

exports.getChauffeurCashDetails = async (req, res) => {
    try {
        const user_id = req.user.id;
        //console.log('us1', user_id);
        if (!user_id) {
            return res.status(400).json({
                success: false,
                status: 400,
                message: "User ID not found.",
            });
        }
        //get wallets details of a user
        const chauffeurCashWalletsDetail = await PaymentsService.getCashWalletDetailsByChauffer(user_id);

        res.status(200).json({
            chauffeurCashWalletsDetail
        });
    } catch (error) {
        await addServerLog({
            log_level: "ERROR",
            service_name: "getChauffeurCashDetails",
            error_message: `getChauffeurCashDetails error - ${error.message}.`
        });

        res.status(500).json({
            success: false,
            error: "Failed to fetch Chauffeur Cash Details."
        })
    }
}


exports.chaufferCashHandOverProcess = async (req, res) => {
    try {
        const user_id = req.user.id;
        console.log('chaufferCashHandOverProcess-1', user_id);
        if (!user_id) {
            return res.status(400).json({
                success: false,
                status: 400,
                message: "User ID not found.",
            });
        }
        const output = await PaymentsService.chaufferCashHandOverUpdate(req.body, user_id);
        if (output.success) {
            res.status(201).json({
                success: output.success,
                message: output.message,
                wallet_balance: output.wallet_balance,
                hand_over_wallet_balance: output.hand_over_wallet_balance
            });
        } else {
            await addServerLog({
                log_level: "ERROR",
                service_name: "chaufferCashHandOverProcess",
                error_message: `chaufferCashHandOverProcess error - ${output.error}.`
            });
            res.status(404).json({
                success: output.success,
                message: "Error while handing over Cash from Chauffeur to PD",
                error: output.error,
            });
        }
    } catch (error) {

        await addServerLog({
            log_level: "ERROR",
            service_name: "chaufferCashHandOverProcess",
            error_message: `chaufferCashHandOverProcess error - ${error.message}.`
        });

        res.status(500).json({
            success: false,
            error: "Failed to Process Chauffeur to PD Cash Hand-Over."
        });
    }
}


exports.pdCashHandOverProcess = async (req, res) => {
    try {
        const user_id = req.user.id;
        //console.log('us1', user_id);
        if (!user_id) {
            return res.status(400).json({
                success: false,
                status: 400,
                message: "User ID not found.",
            });
        }
        const output = await PaymentsService.pdCashHandOverUpdate(req.body, user_id);
        if (output.success) {
            res.status(201).json({
                success: output.success,
                message: output.message,
                wallet_balance: output.wallet_balance,
                hand_over_wallet_balance: output.hand_over_wallet_balance
            });
        } else {
            await addServerLog({
                log_level: "ERROR",
                service_name: "pdCashHandOverProcess",
                error_message: `pdCashHandOverProcess error - ${output.error}.`
            });

            res.status(404).json({
                success: output.success,
                message: "Error while handing over Cash from PD to Admin",
                error: output.error,
            });
        }
    } catch (error) {
        await addServerLog({
            log_level: "ERROR",
            service_name: "pdCashHandOverProcess",
            error_message: `pdCashHandOverProcess error - ${error.message}.`
        });

        res.status(500).json({
            success: false,
            error: "Failed to Process PD to Admin Cash Hand-Over."
        });
    }
}



exports.getPDUsersList = async (req, res) => {
    try {
        const pdUsersList = await PaymentsService.getPDUsersList(req.body);
        res.status(200).json({
            pdUsersList
        });
    } catch (error) {
        await addServerLog({
            log_level: "ERROR",
            service_name: "getPDUsersList",
            error_message: `getPDUsersList error - ${error.message}.`
        });


        res.status(500).json({
            success: false,
            error: "Failed to fetch PD Users List."
        })
    }
}

exports.getPDCashDetails = async (req, res) => {
    try {
        const user_id = req.user.id;
        //console.log('us1', user_id);
        if (!user_id) {
            return res.status(400).json({
                success: false,
                status: 400,
                message: "User ID not found.",
            });
        }
        //get wallets details of a user
        const pdCashWalletsDetail = await PaymentsService.getCashWalletDetailsByPD(user_id);

        res.status(200).json({
            pdCashWalletsDetail
        });
    } catch (error) {
        await addServerLog({
            log_level: "ERROR",
            service_name: "getPDCashDetails",
            error_message: `getPDCashDetails error - ${error.message}.`
        });

        res.status(500).json({
            success: false,
            error: "Failed to fetch PD Cash Details."
        })
    }
}


exports.getAdminUsersList = async (req, res) => {
    try {
        const adminUsersList = await PaymentsService.getAdminUsersList(req.body);
        res.status(200).json({
            adminUsersList
        });
    } catch (error) {
        await addServerLog({
            log_level: "ERROR",
            service_name: "getAdminUsersList",
            error_message: `getAdminUsersList error - ${error.message}.`
        });

        res.status(500).json({
            success: false,
            error: "Failed to fetch Admin Users List."
        })
    }
}

exports.getPDWallets = async (req, res) => {
    try {

        const { start_date, end_date, pd_id, page, limit } = req.body;
        //get wallets details of a user
        const userWalletsDetail = await adminPaymentsService.getPDPgnWalletDetails(start_date, end_date, pd_id, page, limit);

        res.status(200).json({
            userWalletsDetail
        });
    } catch (error) {
        await addServerLog({
            log_level: "ERROR",
            service_name: "getPDWallets",
            error_message: `getPDWallets error - ${error.message}.`
        });

        res.status(500).json({
            success: false,
            error: "Failed to fetch Wallet Balance of a Chauffeur."
        })
    }
}


exports.orgSettlePaymentProcess = async (req, res) => {
    try {

        const output = await PaymentsService.orgPaymentByRidesUpdate(req.body);
        if (output.success) {
            res.status(201).json({
                success: output.success,
                message: output.message,
                wallet_balance: output.wallet_balance,
            });
        } else {
            await addServerLog({
                log_level: "ERROR",
                service_name: "orgSettlePaymentProcess",
                error_message: `orgSettlePaymentProcess error - ${output.error}.`
            });

            res.status(404).json({
                success: output.success,
                message: "Error occurred on organisation Payment Settle process",
                error: output.error,
            });
        }
    } catch (error) {
        await addServerLog({
            log_level: "ERROR",
            service_name: "orgSettlePaymentProcess",
            error_message: `orgSettlePaymentProcess error - ${error.message}.`
        });

        res.status(500).json({
            success: false,
            error: "Failed to Process Organisation Payment Settlement."
        });
    }
}

exports.getPDWalletHistory = async (req, res) => {
    try {
        const { start_date, end_date, page, limit } = req.body;

        //get wallets details of a user
        const userWalletDetail = await adminPaymentsService.getPDWalletDetails(start_date, end_date, page, limit);
        res.status(200).json({
            userWalletDetail
        });
    } catch (error) {
        await addServerLog({
            log_level: "ERROR",
            service_name: "getPDWalletHistory",
            error_message: `getPDWalletHistory error - ${error.message}.`
        });

        res.status(500).json({
            success: false,
            error: "Failed to fetch Wallet Balance of a PD."
        })
    }
}


exports.getAdminWalletHistory = async (req, res) => {
    try {
        const { start_date, end_date, page, limit } = req.body;

        //get wallets details of a user
        const userWalletDetail = await adminPaymentsService.getAdminWalletDetails(start_date, end_date, page, limit);
        res.status(200).json({
            userWalletDetail
        });
    } catch (error) {
        await addServerLog({
            log_level: "ERROR",
            service_name: "getAdminWalletHistory",
            error_message: `getAdminWalletHistory error - ${error.message}.`
        });

        res.status(500).json({
            success: false,
            error: "Failed to fetch Wallet Balance of an Admin."
        })
    }
}

exports.adminCashRidePayment = async (req, res) => {
    try {
        const user_id = req.user.id;
        if (!user_id) {
            return res.status(400).json({
                success: false,
                status: 400,
                message: "Customer ID not found.",
            });
        }
        //the driver initiates the payment so pass customer id instead of req user id
        const output = await adminPaymentsService.createAdminCashPayment(req.body, user_id);
        if (output) {
            if (output.success) {
                res.status(200).json({
                    success: output.success,
                    message: "Cash Payment completed successfully.",
                    data: {
                        payment_method: output.paymentMethod,
                        amount: output.amount,
                        currency: output.currency,
                        payment_status: output.payment_status,
                        chauffeur_id: output.chauffeur_id,
                        is_coupon_applied: output.is_coupon_applied,
                        //base_fare: output.base_fare,
                        rates: output.rates,
                        rate_type: output.rate_type,
                        manatory_charges: output.mandatory_charges,
                        other_charges: output.other_charges,
                        vat: output.vat,
                        is_invoice_created: output.is_invoice_created,
                        total_amount_to_be_paid: output.total_amount_to_be_paid,
                        discount_amount: output.discount_amount
                    }
                });
            } else {
                await addServerLog({
                    log_level: "ERROR",
                    service_name: "adminCashRidePayment",
                    error_message: `adminCashRidePayment error - ${output.error}.`
                });
                res.status(400).json({
                    success: output.success,
                    message: output.error
                });
            }
        } else {
            await addServerLog({
                log_level: "ERROR",
                service_name: "adminCashRidePayment",
                error_message: `adminCashRidePayment error - ${output.error}.`
            });

            res.status(404).json({
                success: false,
                message: "Cash Payment process failed.",
                error: output.error,
                error_code: 404
            });
        }


    } catch (error) {
        throw error;
    }
}
exports.getChauffeurWalletById = async (req, res) => {
    const { chauffeur_id, start_date, end_date } = req.body;
    try {
        if (!chauffeur_id) {
            return res.status(400).json({ error: "chauffeur_id is required." });
        }
        console.log('chau', chauffeur_id, start_date, end_date);
        const rides = await adminPaymentsService.getChauffeurWalletByRides(chauffeur_id, start_date, end_date);

        res.status(200).json({
            success: true,
            message: "Chauffeur Cash Payment Rides fetched successfully.",
            data: {
                rides
            }
        });
    } catch (error) {
        //console.error("Error in getChauffeurWalletById:", error);
        await addServerLog({
            log_level: "ERROR",
            service_name: "getChauffeurWalletById",
            error_message: `getChauffeurWalletById error - ${error.message}.`
        });
        res.status(500).json({
            success: false,
            error: "Failed to fetch Chauffeur Wallet associated Ride details."
        })
    }
}

exports.adminRideWalletPayment = async (req, res) => {
    try {
        const user_id = req.user.id;
        if (!user_id) {
            return res.status(400).json({
                success: false,
                status: 400,
                message: "User ID not found.",
            });
        }
        //the driver initiates the payment so pass customer id instead of req user id
        const output = await adminPaymentsService.createAdminWalletPayment(req.body, user_id);

        if (output.success) {
            res.status(200).json({
                success: output.success,
                message: "Admin Wallet Payment completed successfully.",
                data: {
                    currency: output.currency,
                    wallet_balance: output.wallet_balance,
                    chauffeur_id: output.chauffeur_id,
                    outstanding_balance: output.outstanding_balance,
                    ride_amount: output.ride_amount,
                    is_paid: true,
                    is_balance_sufficient: true,
                    adjusted_amount: output.adjusted_amount,
                    total_amount_to_be_paid: output.amount_to_be_paid,
                    previous_wallet_balance: output.previous_balance,
                    is_coupon_applied: output.is_coupon_applied,
                    //base_fare: output.base_fare,
                    rates: output.rates,
                    rate_type: output.rate_type,
                    manatory_charges: output.mandatory_charges,
                    other_charges: output.other_charges,
                    vat: output.vat,
                    is_invoice_created: output.is_invoice_created,
                    total_amount_to_be_paid: output.total_amount_to_be_paid,
                    discount_amount: output.discount_amount
                }
            });
        } else {
            await addServerLog({
                log_level: "ERROR",
                service_name: "adminRideWalletPayment",
                error_message: `adminRideWalletPayment error - ${output.error}.`
            });

            res.status(404).json({
                success: output.success,
                message: "Error while processing Admin Wallet Payment.",
                error: output.error,
                currency: output.currency,
                wallet_balance: output.wallet_balance,
                ride_amount: output.ride_amount,
                is_paid: false,
                is_balance_insufficient: output.is_balance_insufficient
            });
        }

    } catch (error) {
        await addServerLog({
            log_level: "ERROR",
            service_name: "adminRideWalletPayment",
            error_message: `adminRideWalletPayment error - ${error.message}.`
        });

        res.status(500).json({
            success: false,
            message: "Failed to process Admin Wallet Payment.",
            error: "Failed to process Admin Wallet Payment."
        })
    }
}

exports.createQuickLinkPayment = async (req, res) => {
    try {
        //get admin user id
        const user_id = req.user.id;
        if (!user_id) {
            return res.status(400).json({
                success: false,
                status: 400,
                message: "User ID not found.",
            });
        }
        const result = await adminPaymentsService.quickPaymentLinkProcess(req.body, user_id);
        return res.status(200).json({ result });

    } catch (error) {
        await addServerLog({
            log_level: "ERROR",
            service_name: "createQuickLinkPayment",
            error_message: `createQuickLinkPayment error - ${error.message}.`
        });
        res.status(500).json({
            success: false,
            message: "Failed to process Quick Link Payment.",
            error: "Failed to process Quick Link Payment."
        });
    }
}

exports.customerApplePayInvoke = async (req, res) => {
    try {
        const user_id = req.user.id;
        if (!user_id) {
            return res.status(400).json({
                success: false,
                status: 400,
                message: "User ID not found.",
            });
        }
        const result = await PaymentsService.customerApplePayProcess(req.body);
        return res.status(200).json({ result });

    } catch (error) {
        await addServerLog({
            log_level: "ERROR",
            service_name: "customerApplePayInvoke",
            error_message: `customerApplePayInvoke error - ${error.message}.`
        });

        res.status(500).json({
            success: false,
            message: "Failed to process Customer Apple Pay Invoke.",
            error: "Failed to process Customer Apple Pay Invoke."
        });
    }
}

exports.verifyQuickLinkPaymentSuccess = async (req, res, next) => {
    try {
        res.status(200).json({ success: true, message: 'Quick Link Payment Transaction Process is successful' });
    } catch (error) {

        await addServerLog({
            log_level: "ERROR",
            service_name: "verifyQuickLinkPaymentSuccess",
            error_message: `verifyQuickLinkPaymentSuccess error - ${error.message}.`
        });

        res.status(500).json({
            success: false,
            message: "Failed to process Quick Link Payment.",
            error: "Failed to process Quick Link Payment."
        });
    }

}
exports.verifyQuickLinkPaymentDeclined = async (req, res, next) => {
    try {
        res.status(500).json({
            success: false, message: 'Quick Link Payment Declined', error: {
                response: req.query
            }
        });
    } catch (error) {
        await addServerLog({
            log_level: "ERROR",
            service_name: "verifyQuickLinkPaymentDeclined",
            error_message: `verifyQuickLinkPaymentCancelled error - ${error.message}.`
        });

        res.status(500).json({
            success: false,
            message: "Quick Link Payment Declined.",
            error: "Quick Link Payment Declined."
        });
    }
}

exports.verifyQuickLinkPaymentCancelled = async (req, res, next) => {
    try {
        res.status(500).json({
            success: false, message: 'Quick Link Payment Canceled', error: {
                response: req.query
            }
        });
    } catch (error) {
        await addServerLog({
            log_level: "ERROR",
            service_name: "verifyQuickLinkPaymentCancelled",
            error_message: `verifyQuickLinkPaymentCancelled error - ${error.message}.`
        });

        res.status(500).json({
            success: false,
            message: "Quick Link Payment Canceled.",
            error: "Quick Link Payment Canceled."
        });
    }
}

exports.getPDWalletById = async (req, res) => {
    const { pd_id, start_date, end_date } = req.body;
    try {
        if (!pd_id) {
            return res.status(400).json({ error: "pd_id is required." });
        }
        //console.log('', pd_id, start_date, end_date);
        const transItems = await adminPaymentsService.getPDWalletByTransactions(pd_id, start_date, end_date);

        res.status(200).json({
            success: true,
            message: "PD Hand over Transactions fetched successfully.",
            data: {
                transItems
            }
        });
    } catch (error) {
        console.error("Error in getPDWalletById:", error);
        await addServerLog({
            log_level: "ERROR",
            service_name: "getPDWalletById",
            error_message: `getPDWalletById error - ${error.message}.`
        });
        res.status(500).json({
            success: false,
            error: "Failed to fetch Chauffeur Wallet associated Ride details."
        })
    }
}
exports.createQuickLinkPaymentResponse = async (req, res) => {
    try {

        const logDir = path.join(__dirname, 'logs', 'telr');
        if (!fs.existsSync(logDir)) {
            fs.mkdirSync(logDir, { recursive: true });
        }
        const logger = winston.createLogger({
            level: 'info',
            format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.json()
            ),
            transports: [
                new winston.transports.Console(),
                new winston.transports.File({
                    filename: path.join(logDir, 'quicklinkresponse.log'),
                    handleExceptions: true
                }),
            ],
            exitOnError: false,
        });

        logger.info('createQuickLinkPaymentResponse output-' + req.body);

        return res.status(200).json({ success: true, message: 'Quick Link Payment Transaction Process is successful' });

    } catch (error) {
        await addServerLog({
            log_level: "ERROR",
            service_name: "createQuickLinkPaymentResponse",
            error_message: `createQuickLinkPaymentResponse error - ${error.message}.`
        });
        res.status(500).json({
            success: false,
            message: "Failed to process Quick Link Payment Response.",
            error: "Failed to process Quick Link Payment Response."
        });
    }
}
exports.refundPayment = async (req, res) => {
    try {
        const user_id = req.user.id;
        if (!user_id) {
            return res.status(401).json({
                success: false,
                status: 401,
                message: "Customer ID not found.",
            });
        }
        //invoked by the driver so no need to pass req.user customer id 
        const output = await PaymentsService.refundPaymentProcess(req.body);
        console.log('refundPayment', output);
        // if (output.success) {
        //     res.status(200).json({
        //         success: output.success,
        //         message: "Refund Process is completed successfully.",
        //         data: {
        //             tranaction_reference: output.tranref,
        //         }
        //     });
        // } else {
        //     await addServerLog({
        //         log_level: "ERROR",
        //         service_name: "refundPayment",
        //         error_message: `refundPayment success failure - ${output.error}.`
        //     });
        //     res.status(400).json({
        //         success: output.success,
        //         message: output.error
        //     });
        // }
    } catch (error) {
        //next(error);

        await addServerLog({
            log_level: "ERROR",
            service_name: "refundPayment",
            error_message: `refundPayment error - ${error.message}.`
        });
        res.status(500).json({
            success: false,
            message: "Failed to process Refund Payment.",
            error: error.message
        });
    }
}

exports.getChauffeurRevenueById = async (req, res) => {
    const { chauffeur_id, start_date, end_date } = req.body;
    try {
        if (!chauffeur_id) {
            return res.status(400).json({ error: "chauffeur_id is required." });
        }
        //console.log('chau', chauffeur_id, start_date, end_date);
        const rides = await adminPaymentsService.getChauffeurRevenueByRides(chauffeur_id, start_date, end_date);

        res.status(200).json({
            success: true,
            message: "Chauffeur Ride Revenue details fetched successfully.",
            data: {
                rides
            }
        });
    } catch (error) {
        console.error("Error in getChauffeurRevenueById:", error);

        await addServerLog({
            log_level: "ERROR",
            service_name: "getChauffeurRevenueById",
            error_message: `getChauffeurRevenueById error - ${error.message}.`
        });

        res.status(500).json({
            success: false,
            error: "Failed to fetch Chauffeur Wallet associated Ride details."
        })
    }
}

exports.getChauffeurHandOverDetails = async (req, res) => {
    try {
        const { chauffeur_id, start_date, end_date } = req.body;
        //get wallets details of a user
        const userWalletsDetail = await PaymentsService.getChauffeurHandOverData(chauffeur_id, start_date, end_date);

        res.status(200).json({
            userWalletsDetail
        });
    } catch (error) {
        await addServerLog({
            log_level: "ERROR",
            service_name: "getChauffeurHandOverDetails",
            error_message: `getChauffeurHandOverDetails error - ${error.message}.`
        });

        res.status(500).json({
            success: false,
            error: "Failed to fetch Chauffeur Hand Over Details."
        })
    }
}

exports.getTopupTransRefByUserId = async (req, res, next) => {
    try {
        //get waiting for payment status records
        const transDetails = await PaymentsService.getTopupTransRef(req.body);
        res.status(200).json({ data: { transDetails } });
    } catch (error) {
        await addServerLog({
            log_level: "ERROR",
            service_name: "getTopupTransRefByUserId",
            error_message: `getTopupTransRefByUserId error - ${error.message}.`
        });
        res.status(500).json({
            success: false,
            error: "Failed to fetch Topup Transaction Reference."
        });
    }

}

exports.getPDHandOverDetails = async (req, res) => {
    try {
        const { pd_id, start_date, end_date } = req.body;
        //get wallets details of a user
        const userWalletsDetail = await PaymentsService.getPDHandOverData(pd_id, start_date, end_date);

        res.status(200).json({
            userWalletsDetail
        });
    } catch (error) {
        await addServerLog({
            log_level: "ERROR",
            service_name: "getPDHandOverDetails",
            error_message: `getPDHandOverDetails error - ${error.message}.`
        });

        res.status(500).json({
            success: false,
            error: "Failed to fetch PD Hand Over Details."
        })
    }
}

exports.getCouponUsageSummary = async (req, res) => {
    try {
        const { start_date, end_date, page, limit } = req.body;
        //get coupon usage summary
        const results = await PaymentsService.getCouponUsageSummary(start_date, end_date, page, limit);

        res.status(200).json({ results });
    } catch (error) {
        await addServerLog({
            log_level: "ERROR",
            service_name: "getCouponUsageSummary",
            error_message: `getCouponUsageSummary error - ${error.message}.`
        });

        res.status(500).json({
            success: false,
            error: "Failed to fetch Coupon Usage Summary."
        })
    }
}
exports.getCouponWiseUsageDetails = async (req, res) => {
    try {
        //console.log('request', req.body);
        const { start_date, end_date, page, limit, coupon_id } = req.body;
        //console.log('coupon', coupon_id);
        //get coupon usage summary
        const results = await PaymentsService.getCouponWiseUsageDetails(start_date, end_date, page, limit, coupon_id);

        res.status(200).json({ results });
    } catch (error) {
        await addServerLog({
            log_level: "ERROR",
            service_name: "getCouponWiseUsageDetails",
            error_message: `getCouponWiseUsageDetails error - ${error.message}.`
        });

        res.status(500).json({
            success: false,
            error: "Failed to fetch Coupon Usage Details."
        })
    }
}

exports.getUserCardsById = async (req, res) => {
    try {
        const { user_id } = req.body;
        //get user cards by id
        const userCards = await adminPaymentsService.getUserCardsById(user_id);

        res.status(200).json({
            success: true,
            message: "User Cards fetched successfully",
            data: userCards 
        });
    } catch (error) {
        await addServerLog({
            log_level: "ERROR",
            service_name: "getUserCardsById",
            error_message: `getUserCardsById error - ${error.message}.`
        });

        res.status(statusCode || 500).json({
            success: false,
            error: "Failed to fetch User Cards by ID."
        })
    }
}

exports.removeUserCardById = async (req, res) => {
    try {
        const { slug_id } = req.body;
        const user_id = req.user.id;
        //get user cards by id
        const userCards = await PaymentsService.removeUserCardById(user_id, slug_id);

        res.status(200).json({
            success: true,
            message: "User Card removed successfully",
            data: userCards 
        });
    } catch (error) {
        await addServerLog({
            log_level: "ERROR",
            service_name: "removeUserCardById",
            error_message: `removeUserCardById error - ${error.message}.`
        });

        res.status(statusCode || 500).json({
            success: false,
            error: "Failed to remove User Card by ID."
        })
    }
}
