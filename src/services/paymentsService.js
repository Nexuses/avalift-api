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

const { addServerLog } = require('../services/serverLogsService');

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

const verifyPaymentProcess = async (paymentData, user_id) => {

    try {
        //input validations
        const validatedData = PaymentsValidator.verifyPaymentValidator(paymentData);

        //de-structure payment data input
        if (validatedData) {
            const {
                //user_id, 
                mobile_number, country_code, fore_names, sur_name, payment_type } = paymentData;

            //country name
            const country = await getCountryNameByCode(country_code);
            const logInput = `${mobile_number}, ${country_code}, ${payment_type}, ${fore_names}, ${sur_name} --- ${country}`;

            //get customer information
            const customer = await paymentsDAO.findUserById(user_id);
            if (!customer) {
                throw new Error("Customer not found.");
            }

            const payment_type_method = await paymentsDAO.getPaymentTypeMethodByName(true, true, payment_type);

            if (!payment_type_method) {
                throw new Error("Payment Type Method not found.");
            }
            //console.log('1');

            //Card Verify
            const telr_payment_method = `${payment_type}-${c_v_order_payment_type}`;
            const payment_method = await paymentsDAO.getPaymentTypeMethodByName(true, false, telr_payment_method);

            if (!payment_method) {
                throw new Error("Payment Method not found");
            }

            // Construct customer info object
            //const randomCartId = Math.floor(100000 + Math.random() * 900000);
            const randomCartId = Math.floor(Math.random() * 100000 + Math.random() * 99999999 + Math.random() * 9);
            const customerInfo = {
                cartidRef: randomCartId,
                custRef: `${mobile_number}-${user_id}`,
                customerId: user_id,
                currency: process.env.CURRENCY_CODE,
                amount: c_verify_amount,
                forenames: fore_names,
                surname: sur_name,
                country,
                phone: mobile_number,
                orderpaymenttype: c_v_order_payment_type,
                description: 'Verify Payment Initiation',
                paymentTypeId: payment_type_method.id,
                paymentMethod: payment_method.name,
            };

            const authorisedUrl = `${process.env.API_URL}/api/payments/verify-payment-process`;
            const successUrl = `${process.env.API_URL}/api/payments/verify-payment-success`;
            const declinedUrl = `${process.env.API_URL}/api/payments/verify-payment-failure`;
            const cancelledUrl = `${process.env.API_URL}/api/payments/verify-payment-cancelled`;

            // Prepare the payload for Verify Payment
            const payload = await verifyPaymentRequestPayload(customerInfo);
            //console.log('payload', payload);
            // Call Telr API to Verify payment request
            const response = await axios.post(process.env.TELR_API_URL, payload);

            let telrInfo = {
                request_meta_data: JSON.stringify(payload),
                response_meta_data: JSON.stringify(response.data),
                user_id,
                ride_id: '',
                payment_type: payment_type,
                transaction_type: "Verify Payment",
            }

            //console.log(telrInfo);
            await paymentsDAO.createTelrResponseRecord(telrInfo);
            //console.log('response', response && response.data);
            if (response.data && response.data.order && response.data.order.url) {

                const orderInfo = {
                    payment_type_id: customerInfo.paymentTypeId,
                    paymentMethod: customerInfo.paymentMethod,
                    method: 'create',
                    currency: customerInfo.currency,
                    amount: customerInfo.amount,
                    forenames: customerInfo.forenames,
                    surname: customerInfo.surname,
                    country: customerInfo.country,
                    phone: customerInfo.phone,
                    custRef: customerInfo.custRef,
                    cartidRef: customerInfo.cartidRef,
                    description: customerInfo.description,
                    order_ref: response.data.order.ref,
                    is_paid: false,
                    user_id: user_id,
                    metadata: response.data,
                    order_url: response.data.order.url,
                    ride_id: ''
                };

                const newPayment = await paymentsDAO.createPayment(orderInfo);

                return {
                    message: 'Payment Verification is completed successfully',
                    success: true,
                    data: {
                        url: response.data.order.url,
                        ref: response.data.order.ref,
                        authorisedUrl: successUrl,
                        declinedUrl,
                        cancelledUrl
                    },
                };
            } else if (response && response.data && response.data.error) {
                await addServerLog({
                    log_level: "ERROR",
                    service_name: "verifyPaymentProcess",
                    error_message: `verify Payment Process error - ${response.data.error.note}.`
                });
                return {
                    message: 'Failed to Verify Payment',
                    success: false,
                    data: {},
                    error: response.data.error.note
                }
            }
        }


    } catch (error) {
        //console.log('verify payment process error -', error);
        await addServerLog({
            log_level: "ERROR",
            service_name: "verifyPaymentProcess",
            error_message: `verify payment process error - ${error.message}.`
        });
        throw error;
    }
};

async function executeVerifyPaymentSuccess(orderRef) {

    try {
        console.log('executeVerifyPaymentSuccess input', orderRef);
        const cardInfo = {};
        //const ridePaymentInfo = {};
        const checkStatusPayload = await checkPaymentStatusRequestPayload(orderRef);
        //get user id based on order ref
        const paymentOrder = await paymentsDAO.findUserByOrderRef(orderRef);
        if (!paymentOrder) {
            //throw new Error('User with the order reference not found');
            //cardInfo.error = `Status for Card Verify not set`;
            cardInfo.message = `User with the order reference not found`;
            cardInfo.success = false;
            return cardInfo;
        }
        const cardVerifiedStatus = await paymentsDAO.findStatusName(c_c_v_status_name);
        let card_verified_status_id;
        if (cardVerifiedStatus) {
            card_verified_status_id = cardVerifiedStatus.id;
        } else {
            cardInfo.message = `Status for Card Verify not set`;
            cardInfo.success = false;
            return cardInfo;
        }
        const response = await axios.post(process.env.TELR_API_URL, checkStatusPayload);

        if (response.data && response.data.order && response.data.order.status) {
            if (response.data.order.status.text === 'Authorised' || response.data.order.status.text === 'Paid') {
                if (paymentOrder) {
                    cardInfo.user_id = paymentOrder.user_id;
                    cardInfo.name = `${response.data.order.card.type}-${response.data.order.card.last4}`;

                    cardInfo.logo = await getCardLogoUrl(response.data.order.card.type);
                    cardInfo.slug_id = response.data.order.transaction.ref;
                    cardInfo.is_active = true;
                    //get status id from status table for Authorised status
                    const statusCode = await paymentsDAO.findStatusName(response.data.order.status.text);

                    if (!statusCode) {
                        //throw new Error('Authorised status code not set in Status table');
                        cardInfo.message = `Status for Authorised not set`;
                        cardInfo.success = false;
                        return cardInfo;
                    }

                    cardInfo.status_id = statusCode.id;
                    cardInfo.is_default = true;
                    cardInfo.metadata = response.data.order;
                    cardInfo.email = response.data.order.customer.email;
                    cardInfo.card_bin = response.data.order.card.first6;
                    cardInfo.card_end = response.data.order.card.last4;
                    cardInfo.pay_method = response.data.order.paymethod;

                    const existingCard = await paymentsDAO.findPaymentMethodByFirstLast(cardInfo.user_id, cardInfo.card_bin, cardInfo.card_end);
                    //console.log('existingCard', existingCard);
                    let saveCardRecord, updateSaveCard;
                    if (!existingCard) {
                        saveCardRecord = await paymentsDAO.createSavedCards(cardInfo);

                    } else {
                        updateSaveCard = await paymentsDAO.updateSavedCards(cardInfo);

                    }

                    const orderRec = await paymentsDAO.findOrderByUserAndRef(paymentOrder.user_id, orderRef);

                    if (!orderRec) {
                        cardInfo.message = `Order Reference not found for User`;
                        cardInfo.success = false;
                        return cardInfo;
                    }
                    const [updPaymentRec] = await paymentsDAO.updatePaymentTransactionDetail(response.data.order.transaction.ref, orderRef, cardInfo.status_id, card_verified_status_id);
                    if (updPaymentRec === 0) {
                        cardInfo.message = `Card Verification failed`;
                        cardInfo.success = false;
                    } else {
                        cardInfo.message = `Card Verified successfully`;
                        cardInfo.success = true;
                    }

                }
            }
            let telrInfo = {
                request_meta_data: JSON.stringify(checkStatusPayload),
                response_meta_data: JSON.stringify(response.data),
                user_id: paymentOrder?.user_id,
                ride_id: '',
                payment_type: 'card',
                transaction_type: "Verify Payment Process",
            }

            //console.log(telrInfo);
            await paymentsDAO.createTelrResponseRecord(telrInfo);
        } else if (response && response.data && response.data.error) {
            let telrInfo = {
                request_meta_data: JSON.stringify(checkStatusPayload),
                response_meta_data: JSON.stringify(response.data),
                user_id: paymentOrder?.user_id,
                ride_id: '',
                payment_type: 'verify',
                transaction_type: "Verify Payment Process",
            }

            //console.log(telrInfo);
            await paymentsDAO.createTelrResponseRecord(telrInfo);
            await addServerLog({
                log_level: "ERROR",
                service_name: "executeVerifyPaymentSuccess",
                error_message: `execute verify payment success error - ${response.data.error.note}.`
            });
            return {
                message: 'Failed to process Verify Payment Success',
                success: false,
                data: {},
                error: response.data.error.note
            }
        }
        return cardInfo;

    } catch (error) {
        //console.log('execute verify payment success error -', error.message);
        await addServerLog({
            log_level: "ERROR",
            service_name: "executeVerifyPaymentSuccess",
            error_message: `execute verify payment success error - ${error.message}.`
        });
        throw error;
    }
};


async function verifyPaymentRequestPayload(customerInfo) {
    try {
        const authorisedUrl = `${process.env.API_URL}/api/payments/verify-payment-process`;
        const declinedUrl = `${process.env.API_URL}/api/payments/verify-payment-failure`;
        const cancelledUrl = `${process.env.API_URL}/api/payments/verify-payment-cancelled`;

        // Prepare the payload for Verify Payment
        const payload = {
            method: 'create',
            store: process.env.TELR_MERCHANT_ID,
            authkey: process.env.TELR_SECRET_KEY,
            framed: 0,
            order: {
                cartid: customerInfo.cartidRef,
                ref: customerInfo.customerId,
                amount: customerInfo.amount,
                currency: customerInfo.currency,
                description: customerInfo.description,
                test: process.env.TEST_MODE,
                trantype: customerInfo.orderpaymenttype
            },
            return: {
                authorised: authorisedUrl,
                declined: declinedUrl,
                cancelled: cancelledUrl
            },
            customer: {
                ref: customerInfo.custRef,
                name: {
                    title: customerInfo.forenames,
                    forenames: "",
                    surname: customerInfo.surname
                },
                address: {
                    line1: "xxx",
                    line2: "xxx",
                    line3: "xxx",
                    city: "xxx",
                    state: "xxx",
                    country: customerInfo.country,
                    areacode: "xxx"
                },
                phone: customerInfo.phone
            }
        };
        return payload;
    } catch (error) {
        //console.log('verify payment request payload error -', error.message);
        await addServerLog({
            log_level: "ERROR",
            service_name: "verifyPaymentRequestPayload",
            error_message: `verify payment request payload error - ${error.message}.`
        });
        throw new Error("Verify Payment payload creation error.");
    }
}

async function checkPaymentStatusRequestPayload(orderRef) {
    const checkStatusPayload = {
        method: 'check',
        store: process.env.TELR_MERCHANT_ID,
        authkey: process.env.TELR_SECRET_KEY,
        order: {
            ref: orderRef
        }
    };
    return checkStatusPayload;
}

async function salePaymentRequestPayload(customerInfo) {
    try {
        // Prepare the payload for Telr
        const payload = xmlbuilder.create('remote', { version: '1.0', encoding: 'UTF-8' })
            .ele('store', process.env.TELR_MERCHANT_ID)
            .up()
            .ele('key', process.env.TELR_SECRET_XML_KEY)
            .up()
            .ele('tran')
            .ele('type', customerInfo.orderpaymenttype).up()
            .ele('class', 'cont').up()
            .ele('cartid', customerInfo.cartidRef).up()
            .ele('description', customerInfo.description).up()
            .ele('test', process.env.TEST_MODE).up()
            .ele('currency', customerInfo.currency).up()
            .ele('amount', customerInfo.amount).up()
            .ele('ref', customerInfo.firstref).up() //unique for a card of a user
            .up()
            .end({ pretty: true });

        return payload;
    } catch (error) {
        //console.log('sale payment request payload error -', error.message);
        await addServerLog({
            log_level: "ERROR",
            service_name: "salePaymentRequestPayload",
            error_message: `sale payment request payload error - ${error.message}.`
        });
        throw new Error("Sale Payment payload creation error.");
    }
}

async function salePaymentRequestPayloadXmlConfig() {
    return {
        headers: {
            'Content-Type': 'application/xml',
            'Accept': 'application/xml',
        },
    };
}

const salePaymentSuccess = async (salePaymentInfo, rideInfo) => {
    try {
        let result = salePaymentInfo.resultPaymentInfo;
        if (result && result.remote && result.remote.auth && result.remote.payment && result.remote.auth.status === 'A') {
            const statusCode = await paymentsDAO.findStatusName(result.remote.auth.message);
            let status_code_id;
            if (statusCode && statusCode.id > 0) {
                status_code_id = statusCode.id;
                rideInfo.status_code_id = status_code_id;
            }
            rideInfo.metadata = result.remote;
            rideInfo.transaction_ref = result.remote.auth.tranref;
            rideInfo.c_r_c_status_name = c_r_c_status_name;
            rideInfo.c_r_p_status_name = c_r_p_status_name;

            const exitingPaymentRec = await paymentsDAO.findRidePaymentStatus(rideInfo.user_id, rideInfo.ride_id);
            if (!exitingPaymentRec) {
                const sale_payment = await paymentsDAO.createSalePaymentRecord(rideInfo);
                //console.log('dao sale 8', sale_payment);
                if (sale_payment.salePaymentOutput.success) {
                    if (sale_payment.salePaymentOutput.payment_status === c_r_c_status_name) {
                        rideInfo.notificationData.body = `Payment is successfully ${sale_payment.salePaymentOutput.payment_status} for the ride ${rideInfo.ride_id}.`;
                        await queuePushNotification(rideInfo.device_id, rideInfo.notificationData);
                        paymentOutput = {};
                        paymentOutput.is_paid = true;
                        paymentOutput.paymentMethod = rideInfo.payment_type;
                        paymentOutput.amount = rideInfo.amount.toFixed(2);
                        paymentOutput.currency = rideInfo.currency;
                        paymentOutput.error = '';
                        paymentOutput.success = sale_payment.salePaymentOutput.success;
                        paymentOutput.payment_status = sale_payment.salePaymentOutput.payment_status;
                        return paymentOutput;
                    } else {
                        paymentOutput = {};
                        paymentOutput.is_paid = false;
                        paymentOutput.paymentMethod = rideInfo.payment_type;
                        paymentOutput.error = `Failed to complete sale payment of the Ride ${rideInfo.ride_id}`;
                        paymentOutput.success = false;
                        return paymentOutput;
                    }

                } else {
                    paymentOutput = {};
                    paymentOutput.is_paid = false;
                    paymentOutput.paymentMethod = rideInfo.payment_type;
                    paymentOutput.error = `Failed to complete sale payment of the Ride ${rideInfo.ride_id}`;
                    paymentOutput.success = sale_payment.salePaymentOutput.success;
                    return paymentOutput;
                }

            } else {
                paymentOutput = {};
                paymentOutput.is_paid = false;
                paymentOutput.error = `Payment is already completed for this Ride ${rideInfo.ride_id}`;
                paymentOutput.success = false;
                return paymentOutput;
            }
        }
        else {
            return {
                success: false, data:
                    { result }
            };
        }
    } catch (error) {
        //console.log('sale payment success error -', error.message);
        await addServerLog({
            log_level: "ERROR",
            service_name: "salePaymentSuccess",
            error_message: `sale payment success error - ${error.message}.`
        });
        if (error.name === 'SequelizeUniqueConstraintError') {
            throw new Error(`Sale Payment Error - ${error.errors[0].message}`);
        } else {
            //throw error;
            paymentOutput = {};
            paymentOutput.is_paid = false;
            paymentOutput.error = `Payment is not completed for this Ride ${rideInfo.ride_id}`;

            paymentOutput.success = false;
            return paymentOutput;
        }
    }

}

const salePaymentProcess = async (paymentData) => {
    try {
        //input validations
        const validatedData = PaymentsValidator.salePaymentValidator(paymentData);
        if (validatedData) {
            //de-structure payment data input
            const {
                customer_id,
                ride_id,
                payment_type, slug_id, coupon_ids } = paymentData;
            const logInput = `${customer_id}, ${ride_id}, ${payment_type}, ${slug_id}, ${coupon_ids}`;
            // await addServerLog({
            //     log_level: "INFO",                         // required
            //     error_message: `salePaymentProcess input - ${logInput}`   // required
            // });
            let paymentOutput = await validateInputData(paymentData);
            if (paymentOutput && paymentOutput.success) {
                const cardRec = await paymentsDAO.findPaymentByUserAndTransaction(customer_id, slug_id);
                //console.log('customerRec', customerRec);
                if (!cardRec) {
                    paymentOutput = {};
                    paymentOutput.error = `Customer Card Reference is invalid.`;
                    paymentOutput.success = false;
                    return paymentOutput;
                }
                let userInfo = {
                    user_id: customer_id
                };
                const checkZeroNegBal = await paymentsDAO.findCustomerBalance(userInfo);
                let wallet_balance_amount = 0;
                wallet_balance_amount = checkZeroNegBal && parseFloat(checkZeroNegBal.wallet_balance);


                //get pricing information
                //console.log('customer ride Item', paymentOutput.rideItem);
                const final_result = paymentOutput.rideItem?.final_price_calculation;

                let start_time, end_time;
                // await addServerLog({
                //     log_level: "INFO",                         // required
                //     error_message: `salePaymentProcess final result output - ${final_result.final_total_amount} `   // required
                // });
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
                    const tip_amount = final_result ? final_result.tip_amount : 0.0;
                    const tip_added = final_result ? final_result.tip_added : false;

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
                        title: "Payment Completion Status",
                        data: {
                            ride_id: paymentOutput.rideItem.ride_id.toString(),
                            requested_pickup_point: paymentOutput.rideItem.requested_pickup_point.toString(),
                            requested_pickup_lat: paymentOutput.rideItem.requested_pickup.lat.toString(),
                            requested_pickup_long: paymentOutput.rideItem.requested_pickup.long.toString(),
                            customer_id: paymentOutput.rideItem.customer_id.toString(),
                            estimated_amount: total_amount_to_be_paid.toString(),
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

                    //if customer payment verification is completed the sale payment process can happen
                    const randomCartId = Math.floor(Math.random() * 100000 + Math.random() * 99999999 + Math.random() * 9);
                    const customerInfo = {
                        cartidRef: `${randomCartId}`,
                        currency: process.env.CURRENCY_CODE,
                        amount: total_amount_to_be_paid,
                        orderpaymenttype: c_s_order_payment_type,
                        firstref: slug_id,
                        description: 'Sale Payment Initiation',
                    };
                    const countryName = await getCountryNameByCode(paymentOutput.customer.country_code);
                    const rideInfo = {
                        payment_type_id: paymentOutput.payment_type_method.id,
                        paymentMethod: paymentOutput.payment_method.name,
                        method: 'create',
                        currency: customerInfo.currency,
                        amount: customerInfo.amount,
                        country_code: '+91',
                        forenames: paymentOutput.customer.first_name,
                        surname: paymentOutput.customer.last_name,
                        country: countryName,
                        phone: paymentOutput.customer.mobile_number,
                        custRef: `${paymentOutput.customer.mobile_number}-${customer_id}`,
                        cartidRef: customerInfo.cartidRef,
                        description: customerInfo.description,
                        firstref: customerInfo.firstref,
                        user_id: customer_id,
                        ride_id: ride_id,
                        ride_type: paymentOutput.rideItem.ride_type,
                        rate_type: paymentOutput.rideItem.rate_type,
                        final_amount: 0,
                        estimated_amount: paymentOutput.rideItem.estimated_amount,
                        status_log_details: paymentOutput.rideItem.status_log,
                        payment_type,
                        device_id: paymentOutput.customer.device_id,
                        notificationData,
                        card_debit_status_id: paymentOutput.cardDStatusCode.id,
                        chauffeur_id: paymentOutput.rideItem.chauffeur_id,
                        //base_fare,
                        discount_amount,
                        total_amount_to_be_paid,
                        payment_details: paymentOutput.rideItem.paymentDetails,
                        card_authorised_status_code: paymentOutput.cardAuthorisedStatusCode.id,
                        wallet_balance_amount,
                        cr_w_a_transaction_type_id: paymentOutput.cardWalletAStatusCode.id,
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
                        final_result,
                        tip_amount,
                        tip_added,
                    };
                    const payload = await salePaymentRequestPayload(customerInfo);
                    const config = await salePaymentRequestPayloadXmlConfig();
                    const response = await axios.post(process.env.TELR_API_XML_URL, payload, config);
                    const parsedResponse = new xml2js.Parser({ explicitArray: false });
                    let resultPaymentInfo = {};
                    let telrInfo = {};
                    parsedResponse.parseString(response.data, async (err, result) => {
                        if (err) {
                            paymentOutput.is_paid = false;
                            paymentOutput.status = result.remote.auth.status;
                            paymentOutput.error = err;

                            await addServerLog({
                                log_level: "ERROR",
                                service_name: "salePaymentProcess",
                                error_message: `salePaymentProcess error - cart id is ${customerInfo.cartidRef} - status is ${result.remote.auth.status} - error is ${result.remote.auth.message}`
                            });
                            //console.log('here1');
                            throw new Error(`salePaymentProcess error - cart id is ${customerInfo.cartidRef} - status is ${result.remote.auth.status} - error is ${result.remote.auth.message}`);
                        }

                        //console.log('here2');
                        // if (result.remote.auth.status === 'E') {
                        //     paymentOutput.is_paid = false;
                        //     paymentOutput.status = result.remote.auth.status;
                        //     paymentOutput.error = result.remote.auth.message;
                        //     return paymentOutput;
                        // } else {
                        resultPaymentInfo = result;
                        const saleResponse = `${result.remote.auth.status}, ${result.remote.auth.message}`;
                        await addServerLog({
                            log_level: "INFO",
                            service_name: "salePaymentProcess",                  // required
                            error_message: `salePaymentProcess response gateway - ${saleResponse}`   // required
                        });
                        //console.log('resultPaymentInfo', resultPaymentInfo);
                        paymentOutput.status = result.remote.auth.status;
                        paymentOutput.tranref = result.remote.auth.tranref;
                        paymentOutput.is_paid = true;
                        rideInfo.status = result.remote.auth.message;
                        rideInfo.tranref = result.remote.auth.tranref;
                        rideInfo.is_paid = true;
                    });
                    let salePaymentInfo = {
                        resultPaymentInfo,
                    };
                    //console.log('here');

                    telrInfo = {
                        request_meta_data: JSON.stringify(payload),
                        response_meta_data: JSON.stringify(resultPaymentInfo),
                        user_id: customer_id,
                        ride_id: ride_id,
                        payment_type: payment_type,
                        transaction_type: "Sale Payment",
                    }

                    //console.log(telrInfo);
                    await paymentsDAO.createTelrResponseRecord(telrInfo);
                    const output = await salePaymentSuccess(salePaymentInfo, rideInfo);
                    //console.log('completed status id', completed_status_id);

                    if (output.success) {
                        paymentOutput.payment_status = output.payment_status;
                        paymentOutput.paymentMethod = rideInfo.payment_type;
                        paymentOutput.amount = rideInfo.amount.toFixed(2);
                        paymentOutput.currency = rideInfo.currency;
                        paymentOutput.success = true;
                        paymentOutput.chauffeur_id = paymentOutput.rideItem.chauffeur_id;
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
                        // await addServerLog({
                        //     log_level: "INFO",
                        //     error_message: `salePaymentProcess success ${ total_amount_to_be_paid }`
                        // });
                        return paymentOutput;
                    } else {

                        paymentOutput = {};
                        paymentOutput.error = output.error;
                        paymentOutput.success = false;
                        return paymentOutput;
                    }
                    //}



                } else {
                    paymentOutput = {};
                    paymentOutput.error = "Calculated Ride Amount is incorrect";
                    paymentOutput.success = false;
                    return paymentOutput;
                }

            }
            return paymentOutput;
        }
    } catch (error) {
        //console.log('sale payment process error -', error.message);
        await addServerLog({
            log_level: "ERROR",
            service_name: "salePaymentProcess",
            error_message: `sale payment process error - ${error.message}.`
        });

        let paymentOutput = {};
        paymentOutput.error = error.message;
        paymentOutput.success = false;
        return paymentOutput;

        //throw error;
    }
}

const getUserCardDetails = async (user_id) => {
    try {
        // get card details of a user
        return await paymentsDAO.findCardDetailsByUser(user_id);
    } catch (error) {
        //console.log('get user card details error -', error.message);
        await addServerLog({
            log_level: "ERROR",
            service_name: "getUserCardDetails",
            error_message: `get user card details error - ${error.message}.`
        });
        throw error;
    }
}

const getPaymentTypes = async (inputData) => {
    const validatedData = PaymentsValidator.paymentTypeActiveValidator(inputData);
    if (validatedData) {
        const { is_active } = inputData;
        // get active/inactive payment type methods of for_display true category
        return await paymentsDAO.getPaymentTypeMethods(is_active, true);
    }
}

const createCashPayment = async (inputData, chauffeur_id) => {
    try {
        //console.log('sdfj');
        //console.log('sdfj');
        const validatedData = PaymentsValidator.cashPaymentValidator(inputData);
        if (validatedData) {
            let {
                customer_id,
                ride_id, payment_type, coupon_ids } = inputData;

            const logInput = `${customer_id}, ${ride_id}, ${payment_type}, ${coupon_ids}`;
            // await addServerLog({
            //     log_level: "INFO",                         // required
            //     error_message: `createCashPayment input - ${ logInput }`   // required
            // });

            let paymentOutput = await validateInputData(inputData);
            //console.log('paymentOutput', paymentOutput);
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
                    //console.log('customer ride Item', paymentOutput.rideItem);
                    const final_result = paymentOutput.rideItem?.final_price_calculation;
                    //get estimated amount based on pricing configuration.
                    //if negative wallet balance exists, will be adjusted on cash payment
                    //const estimatedAmount = await getEstimatedAmount(paymentOutput.rideItem, wallet_balance_amount, coupon_ids);
                    //console.log('estimated Am', estimatedAmount);
                    //console.log('ride data', paymentOutput.rideItem);

                    if (final_result && final_result.final_total_amount > 0) {
                        await Promise.all(paymentOutput.rideItem.status_log.map(async (item) => {
                            //console.log('rideItem', item);
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
                        //final_result.is_coupon_applied = true;
                        //final_result.appliedCoupons = [{ coupon_id: 1, discount: 2, coupon_code: 'SR-123' }];
                        //let coupon_ids = is_coupon_applied ? final_result?.appliedCoupons.map(x => x.coupon_id) : null;

                        // coupon_ids = final_result?.is_coupon_applied ? final_result.appliedCoupons?.map(x => x?.coupon_id).filter(Boolean) || [] : [];

                        let coupon_ids = final_result?.appliedCoupons.map(x => x.coupon_id);
                        const tip_amount = final_result ? final_result.tip_amount : 0.0;
                        const tip_added = final_result ? final_result.tip_added : false;

                        //console.log('coupon_ids', coupon_ids);
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
                                    estimated_amount: total_amount_to_be_paid.toString(),
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
                                //base_fare,
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
                                final_result,
                                tip_amount,
                                tip_added
                            };
                            //console.log('cash payment info', paymentInfo);
                            const cashPaymentResponse = await paymentsDAO.createCashPaymentRecord(paymentInfo);
                            //console.log('cashPaymentResponse output', cashPaymentResponse.cashOutput.success);

                            // await addServerLog({
                            //     log_level: "INFO",                         // required
                            //     error_message: `cashPaymentResponse ${ cashPaymentResponse.cashOutput.success }, error - ${ cashPaymentResponse.cashOutput?.error } ` 
                            // });

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
                                    // await addServerLog({
                                    //     log_level: "INFO",
                                    //     error_message: `createCashPayment success ${ total_amount_to_be_paid } `
                                    // });

                                    return paymentOutput;
                                } else {
                                    paymentOutput = {};
                                    paymentOutput.is_paid = false;
                                    paymentOutput.paymentMethod = payment_type;
                                    paymentOutput.error = `Failed to complete cash payment of the Ride ${ride_id} `;
                                    paymentOutput.success = false;
                                    return paymentOutput;
                                }
                            } else {
                                paymentOutput = {};
                                paymentOutput.is_paid = false;
                                paymentOutput.paymentMethod = payment_type;
                                paymentOutput.error = `Failed to complete cash payment of the Ride ${ride_id} `;
                                paymentOutput.success = cashPaymentResponse.cashOutput.success;
                                return paymentOutput;
                            }
                        }
                    } else {
                        paymentOutput = {};
                        paymentOutput.is_paid = false;
                        paymentOutput.paymentMethod = payment_type;
                        paymentOutput.error = `Failed to fetch Estimated Amount data for the ride ${ride_id} `;
                        paymentOutput.success = false;
                        return paymentOutput;
                    }
                }
            } else {
                return paymentOutput;
            }
        }
    } catch (error) {
        //console.log('create cash payment error -', error.message);
        await addServerLog({
            log_level: "ERROR",
            service_name: "createCashPayment",
            error_message: `create cash payment error - ${error.message}.`
        });
        paymentOutput = {};
        paymentOutput.is_paid = false;
        paymentOutput.error = error.message;
        paymentOutput.success = false;
        return paymentOutput;
    }

}

const getRidesByChauffeurForPayment = async (rideData) => {
    try {
        const validatedData =
            PaymentsValidator.chauffeurRideDataValidator(rideData);
        if (validatedData) {
            // De-structure payment data input
            const { ride_id, customer_id, is_active } = rideData;

            // Get PK and SK using the utility function
            const { PK, SK } = await getRideKeyInfo(customer_id, ride_id);
            const item = await ridesDAO.getRide(PK, SK);
            if (!item) {
                throw new Error("Ride not found.");
            }

            // Payment types
            const payment_types = await paymentsDAO.getPaymentTypeMethods(
                is_active,
                true
            );
            let payment_type_modified = [];
            await Promise.all(
                payment_types.map(async (payment_type) => {
                    let payment_type_info = {
                        id: payment_type.id,
                        name: payment_type.name,
                        is_active: payment_type.is_active,
                        selected:
                            item.paymentDetails.payment_method === payment_type.name
                                ? true
                                : false,
                    };
                    payment_type_modified.push(payment_type_info);
                })
            );

            // Card details by user
            const user_cards = await paymentsDAO.findCardDetailsByUser(customer_id);
            let user_card_modified = [];

            await Promise.all(
                user_cards.map(async (card) => {
                    let cardInfo = {
                        slug_id: card.slug_id,
                        name: card.name,
                        logo: card.logo,
                        card_bin: card.card_bin,
                        card_end: card.card_end,
                        pay_method: card.pay_method,
                        selected:
                            item.paymentDetails.payment_method.toLowerCase() === "card" &&
                                item.paymentDetails.card === card.slug_id
                                ? true
                                : false,
                    };
                    user_card_modified.push(cardInfo);
                })
            );

            let userInfo = {
                user_id: customer_id,
            };

            const checkZeroNegBal = await paymentsDAO.findCustomerBalance(userInfo);
            let wallet_balance_amount = 0;

            wallet_balance_amount =
                checkZeroNegBal &&
                parseFloat(checkZeroNegBal.wallet_balance).toFixed(2);

            return {
                success: true,
                message: "Chauffeur Ride Details fetched successfully",
                wallet_balance: wallet_balance_amount,
                data: {
                    ride_data: {
                        ride_id: item.ride_id,
                        status: item.status,
                        is_customer_available: item.is_customer_available,
                        customer_id: item.customer_id,
                        rate_type: item.rate_type,
                        estimated_amount: item.final_price_calculation?.final_total_amount ?? 0,
                        estimated_time_in_minutes: "0",
                        requested_drop: item.requested_drop,
                        requested_pickup: item.requested_pickup,
                        customer_extra_details: item.customer_extra_details,
                        ride_type: item.ride_type,
                        organisation_id: item.organisation_id ? parseInt(item.organisation_id) : null,
                        chauffeur_id: item.chauffeur_id,
                        hours_booked: item.hours_booked,
                        payment_details: item.paymentDetails,
                        tip_amount: item.final_price_calculation?.tip_amount ?? 0.0,
                        tip_added: item.final_price_calculation?.tip_added ?? false,
                        final_total_amount_before_tip: item.final_price_calculation?.final_total_amount_before_tip ?? 0.0,
                    },
                    payment_types_data: {
                        payment_type_modified,
                    },
                    user_card_data: {
                        user_card_modified,
                    },
                },
            };
        }
    } catch (error) {
        //console.log('get rides by chauffeur for payment error -', error.message);
        await addServerLog({
            log_level: "ERROR",
            service_name: "getRidesByChauffeurForPayment",
            error_message: `getRidesByChauffeurForPayment error - ${error.message}.`
        });
        throw error;
    }
};


const getRidePaymentStatus = async (rideData, user_id) => {
    let paymentOutput = {};
    try {
        const validatedData = PaymentsValidator.ridePaymentStatusDataValidator(rideData);
        if (validatedData) {

            //de-structure payment data input
            const {
                ride_id } = rideData;

            // const PK = `CUSTOMER`;
            // const SK = `${ user_id } #${ ride_id } `;
            const { PK, SK } = await getRideKeyInfo(user_id, ride_id);
            const rideitem = await paymentsDAO.getRideByCustomer(PK, SK);
            if (!rideitem.dmoRideOutput.item) {
                paymentOutput = {};
                paymentOutput.error = "Ride not found";
                paymentOutput.success = false;
                return paymentOutput;
                //throw new Error("Ride not found.");
            }
            const item = rideitem.dmoRideOutput.item;
            const paymentRideDetails = await paymentsDAO.findPaymentByUserAndRide(user_id, ride_id);
            return {
                success: true,
                message: "Payment Ride Details fetched successfully",
                data: {
                    ride_data: {
                        ride_id: item.ride_id,
                        status: item.status,
                        is_customer_available: item.is_customer_available,
                        customer_id: item.customer_id,
                        rate_type: item.rate_type,
                        estimated_amount: item.estimated_amount,
                        estimated_time_in_minutes: item.estimated_time_in_minutes,
                        requested_drop: item.requested_drop,
                        requested_pickup: item.requested_pickup,
                        customer_extra_details: item.customer_extra_details,
                        ride_type: item.ride_type,
                        organisation_id: item.organisation_id,
                        chauffeur_id: item.chauffeur_id,
                        hours_booked: item.hours_booked
                    },
                    payment_data: {
                        is_paid: paymentRideDetails ? paymentRideDetails.is_paid : null,
                        payment_method: paymentRideDetails ? paymentRideDetails.payment_method : null,
                        currency: paymentRideDetails ? paymentRideDetails.currency : null,
                        amount: paymentRideDetails ? paymentRideDetails.amount_to_be_paid : null,
                        transaction_ref: paymentRideDetails ? paymentRideDetails.transaction_ref : null,
                        payment_status: paymentRideDetails ? paymentRideDetails.is_paid : null,

                    }
                }
            }
        }
    } catch (error) {
        //console.log('get ride payment status error -', error.message);
        await addServerLog({
            log_level: "ERROR",
            service_name: "getRidePaymentStatus",
            error_message: `get ride payment status error - ${error.message}.`
        });
        throw error;
    }
}
const getExpenseDetailsByUser = async (user_id) => {
    try {
        const paymentRideDetails = await paymentsDAO.findPaymentByUser(user_id);
        const data = {
            payments: [],
            wallets: []
        };

        await Promise.all(paymentRideDetails.map(async (paymentDetail) => {
            data.payments.push(paymentDetail);
        }));

        const result = await paymentsDAO.findUserWalletById(user_id);

        await Promise.all(result.customerWalletLogRec.map(async (userPayment) => {

            data.wallets.push(userPayment);
        }));

        return {
            success: true,
            message: "Payment Ride Details fetched successfully",
            data
        }
    } catch (error) {
        //console.log('get expense details by user error -', error.message);
        await addServerLog({
            log_level: "ERROR",
            service_name: "getExpenseDetailsByUser",
            error_message: `get expense details by user error - ${error.message}.`
        });
        throw error;
    }
}

const walletTopupProcess = async (paymentData) => {
    let paymentOutput = {};
    try {
        //input validations
        const validatedData = PaymentsValidator.walletTopupValidator(paymentData);
        if (validatedData) {
            //de-structure payment data input
            const {
                payment_type, slug_id, topup_amount, customer_id } = paymentData;

            const logInput = `${payment_type}, ${slug_id},${topup_amount},${customer_id} `;
            await addServerLog({
                log_level: "INFO",                         // required
                error_message: `walletTopupProcess input - ${logInput} `   // required
            });

            //get status id from status table for Authorised status
            const statusCode = await paymentsDAO.findStatusName(c_r_a_status_name);
            if (!statusCode) {
                paymentOutput = {};
                paymentOutput.error = `Status code ${c_r_a_status_name} not set.`;
                paymentOutput.success = false;
                return paymentOutput;
            }

            //get status id from status table for Wallet Credit status
            const walletCStatusCode = await paymentsDAO.findStatusName(c_w_c_transaction_type);
            if (!walletCStatusCode) {
                paymentOutput = {};
                paymentOutput.error = `Status code ${c_w_c_transaction_type} not set.`;
                paymentOutput.success = false;
                return paymentOutput;
            }

            //check if customer payment verification is completed - Card-Verify
            const customerRec = await paymentsDAO.findPaymentByUserAndTransaction(customer_id, slug_id);
            //console.log('customerRec', customerRec);
            if (customerRec && statusCode) {
                const payment_type_method = await paymentsDAO.getPaymentTypeMethodByName(true, true, payment_type);

                if (!payment_type_method) {
                    paymentOutput = {};
                    paymentOutput.error = `Payment Type Method ${payment_type} is not defined.`;
                    paymentOutput.success = false;
                    return paymentOutput;
                }
                //Wallet-Topup
                const telr_payment_method = `${payment_type}-${c_w_t_status_name} `;
                const payment_method = await paymentsDAO.getPaymentTypeMethodWalletTopup();
                // console.log('payment_method 23', payment_method);
                if (!payment_method) {
                    paymentOutput = {};
                    paymentOutput.error = `Payment Method ${telr_payment_method} is not defined.`;
                    paymentOutput.success = false;
                    return paymentOutput;
                }

                //if customer payment verification is completed the sale payment process can happen
                //get random number for cart id reference for payment method input
                //const randomCartId = Math.floor(100000 + Math.random() * 900000);
                const randomCartId = Math.floor(Math.random() * 100000 + Math.random() * 99999999 + Math.random() * 9);

                const customerInfo = {
                    cartidRef: `${randomCartId} `,
                    currency: process.env.CURRENCY_CODE,
                    amount: topup_amount,
                    orderpaymenttype: c_s_order_payment_type,
                    firstref: slug_id,
                    description: 'Wallet Topup Initiation',
                };

                const rideInfo = {
                    payment_type_id: payment_type_method.id,
                    paymentMethod: payment_method.name,
                    method: 'create',
                    currency: customerInfo.currency,
                    amount: customerInfo.amount,
                    forenames: customerRec.fore_names,
                    surname: customerRec.sur_name,
                    country: customerRec.country,
                    phone: customerRec.phone,
                    custRef: customerRec.cust_ref,
                    cartidRef: customerInfo.cartidRef,
                    description: customerInfo.description,
                    firstref: customerInfo.firstref,
                    user_id: customer_id,
                    wallet_credit_status_id: walletCStatusCode.id
                };

                const payload = await salePaymentRequestPayload(customerInfo);
                const config = await salePaymentRequestPayloadXmlConfig();
                const response = await axios.post(process.env.TELR_API_XML_URL, payload, config);
                const parsedResponse = new xml2js.Parser({ explicitArray: false });

                let paymentOutput = {};
                let resultPaymentInfo = {};
                parsedResponse.parseString(response.data, async (err, result) => {
                    if (err) {
                        paymentOutput.is_paid = false;
                        paymentOutput.status = result.remote.auth.status;
                        paymentOutput.error = err;

                        await addServerLog({
                            log_level: "ERROR",
                            service_name: "walletTopupProcess",
                            error_message: `walletTopupProcess error - cart id is ${customerInfo.cartidRef} - status is ${result.remote.auth.status} - error is ${result.remote.auth.message}`
                        });
                        throw new Error(`walletTopupProcess error - cart id is ${customerInfo.cartidRef} - status is ${result.remote.auth.status} - error is ${result.remote.auth.message}`);
                    }
                    resultPaymentInfo = result;
                    //console.log('payment gateway result', result);
                    // await addServerLog({
                    //     log_level: "INFO",                         // required
                    //     error_message: `walletTopupProcess output - ${slug_id} - ${result.remote.auth.message} `   // required
                    // });
                    paymentOutput.status = result.remote.auth.status;
                    paymentOutput.tranref = result.remote.auth.tranref;
                    rideInfo.status = result.remote.auth.message;
                    rideInfo.tranref = result.remote.auth.tranref;
                    rideInfo.is_paid = false;
                });

                let salePaymentInfo = {
                    resultPaymentInfo,
                };

                let telrInfo = {
                    request_meta_data: JSON.stringify(payload),
                    response_meta_data: JSON.stringify(resultPaymentInfo),
                    user_id: customer_id,
                    ride_id: '',
                    payment_type: payment_type,
                    transaction_type: "Wallet Topup Process",
                }

                //console.log(telrInfo);
                await paymentsDAO.createTelrResponseRecord(telrInfo);

                const topupResult = await walletTopupSuccess(salePaymentInfo, rideInfo);
                //console.log('wallet topup success', topupResult);
                if (topupResult.success) {
                    paymentOutput.success = topupResult.success;
                    paymentOutput.wallet_payment_id = topupResult.data.wallet_payment_id;
                    paymentOutput.account_balance = topupResult.data.walletOutput.response;
                    paymentOutput.wallet_response = `Customer Wallet is added with ${process.env.CURRENCY_CODE} ${paymentOutput.account_balance} `;
                    return paymentOutput;
                } else {
                    paymentOutput.success = topupResult.success;
                    paymentOutput.error = `No amount is added on Customer Wallet`;
                    return paymentOutput;
                }

            } else {
                paymentOutput = {};
                paymentOutput.error = `Customer Payment Verification is not completed.`;
                paymentOutput.success = false;
                return paymentOutput;
            }
        }
    } catch (error) {
        await addServerLog({
            log_level: "ERROR",
            service_name: "walletTopupProcess",
            error_message: `wallet top up process error - ${error.message}.`
        });
        paymentOutput = {};
        paymentOutput.message = `Failed to process Wallet Top up`;
        paymentOutput.error = error.message;
        paymentOutput.success = false;
        paymentOutput.error_status_code = 500;
        return paymentOutput;
    }
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
            //console.log('Wallet Rec', newWalletRec);
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
                await addServerLog({
                    log_level: "ERROR",
                    service_name: "walletTopupProcess",
                    error_message: `wallet top up create wallet record error - ${newWalletRec.success}.`
                });
                return {
                    success: false,
                    data: {
                        walletInfo
                    }
                };
            }
        } else {
            await addServerLog({
                log_level: "ERROR",
                service_name: "walletTopupProcess",
                error_message: `wallet top up process error - ${result.remote.auth.status} - ${result.remote.auth.message}.`
            });
            return {
                success: false, data:
                    { result }
            };
        }
    } catch (error) {
        //console.log('wallet topup success error -', error.message);
        await addServerLog({
            log_level: "ERROR",
            service_name: "walletTopupSuccess",
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

const createWalletPayment = async (inputData) => {
    try {
        const validatedData = PaymentsValidator.walletPaymentValidator(inputData);
        if (validatedData) {
            const {
                customer_id,
                ride_id, payment_type, coupon_ids } = inputData;

            const logInput = `${customer_id}, ${ride_id}, ${payment_type}, ${coupon_ids} `;
            // await addServerLog({
            //     log_level: "INFO",                         // required
            //     error_message: `createWalletPayment input - ${ logInput } `   // required
            // });

            let paymentOutput = await validateInputData(inputData);
            if (paymentOutput && paymentOutput.success) {

                //console.log('customer ride Item', paymentOutput.rideItem);
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
                    //console.log('estimated_time_in_min', parseInt(estimated_time_in_minutes));
                    const tip_amount = final_result ? final_result.tip_amount : 0.0;
                    const tip_added = final_result ? final_result.tip_added : false;

                    let notificationData;
                    notificationData = {
                        title: "Wallet Payment Completion Status",
                        data: {
                            ride_id: paymentOutput.rideItem.ride_id.toString(),
                            requested_pickup_point: paymentOutput.rideItem.requested_pickup_point.toString(),
                            requested_pickup_lat: paymentOutput.rideItem.requested_pickup.lat.toString(),
                            requested_pickup_long: paymentOutput.rideItem.requested_pickup.long.toString(),
                            customer_id: paymentOutput.rideItem.customer_id.toString(),
                            estimated_amount: total_amount_to_be_paid.toString(),
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
                        //payment_type_id: paymentOutput.payment_type_method.id,
                        payment_type_id: paymentOutput.payment_method.id,
                        //paymentMethod: payment_method.name,
                        method: '',
                        currency: process.env.CURRENCY_CODE,
                        //amount: rideItem.dmoRideOutput.item.estimated_amount, //taken from external service
                        //amount: ride_amount,
                        amount: estimated_total_amount,
                        custRef: '',
                        cartidRef: 0,
                        description: 'Wallet Payment',
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
                        //device_id: customer.device_id,
                        notificationData,
                        //base_fare,
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
                        final_result,
                        tip_amount,
                        tip_added
                    };
                    // paymentInfo.c_r_c_status_name = c_r_c_status_name;
                    // paymentInfo.c_r_p_status_name = c_r_p_status_name;
                    // paymentInfo.w_d_transaction_type_id = paymentOutput.walletDStatusCode.id;
                    // paymentInfo.w_c_transaction_type_id = paymentOutput.walletCStatusCode.id;
                    const response = await paymentsDAO.createWalletPaymentRecord(paymentInfo);
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
                                //paymentOutput.outstanding_balance = response.walletOutput.outstanding_balance;
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
                                // await addServerLog({
                                //     log_level: "INFO",
                                //     error_message: `createWalletPayment success ${ total_amount_to_be_paid } `
                                // });
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
        //console.log('create wallet payment error -', error.message);
        await addServerLog({
            log_level: "ERROR",
            service_name: "createWalletPayment",
            error_message: `create wallet payment error - ${error.message}.`
        });
        return {
            message: 'Failed to process Wallet Payment.',
            success: false,
            data: {},
            error: error.message,
            error_status_code: 500
        }
    }
}

// const searchData = async (result, search_string) => {
//     try {
//         if (!search_string || typeof search_string !== 'string') {
//             return result;
//         }

//         const sanitizedSearchString = search_string.trim().toLowerCase();

//         //console.log(result.customerWalletRec.data);
//         await Promise.all(result.customerWalletRec.data.map(async (userPayment) => {
//             //console.log('1');
//             //console.log(userPayment.user_id);
//             //console.log('1.1');
//             return (
//                 userPayment.user_id?.toString().toLowerCase().includes(sanitizedSearchString) ||
//                 userPayment.User.first_name?.toLowerCase().includes(sanitizedSearchString) ||
//                 userPayment.User.last_name?.toLowerCase().includes(sanitizedSearchString)
//             );
//         }));
//         //console.log('2');



//         return result.customerWalletRec.data.filter(user => {
//             return (
//                 user.user_id?.toString().toLowerCase().includes(sanitizedSearchString) ||
//                 user.User.first_name?.toLowerCase().includes(sanitizedSearchString) ||
//                 user.User.last_name?.toLowerCase().includes(sanitizedSearchString)
//             );
//         });
//     } catch (error) {
//         console.log('search data error -', error.message);
//         await addServerLog({
//             log_level: "ERROR",
//             error_message: `search data error - ${ error.message }.`
//         });
//     }

// }

const getWalletDetails = async (start_date, end_date, page = 1, limit = 5, search_string = "") => {
    try {
        //console.log('getWalletDetails input', start_date, end_date, page, limit, search_string);
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
        //console.log('get wallet details error -', error.message);
        await addServerLog({
            log_level: "ERROR",
            service_name: "getWalletDetails",
            error_message: `get wallet details error - ${error.message}.`
        });
        return {
            success: false,
            message: "Error while fetching Wallet details.",
            data: {}
        }
    }
}


const getWalletDetailsByUser = async (user_id) => {
    try {
        const result = await paymentsDAO.findUserWalletById(user_id);
        const data = {
            wallets: []
        };

        await Promise.all(result.customerWalletLogRec.map(async (userPayment) => {
            data.wallets.push(userPayment);
        }));

        return {
            success: true,
            wallet_balance: result.customerWalletRec ? result.customerWalletRec.wallet_balance : "0",
            message: "Wallet details fetched successfully",
            data
        }
    } catch (error) {
        //console.log('get wallet details by user error -', error.message);
        await addServerLog({
            log_level: "ERROR",
            service_name: "getWalletDetailsByUser",
            error_message: `get wallet details user error - ${error.message}.`
        });
        return {
            success: false,
            message: "Error while fetching Wallet details.",
            data: {}
        }
    }
}

// const getEstimatedAmount = async (rideItem, wallet_balance_amount, coupon_ids) => {
//     const orgId = rideItem.organisation_id;
//     const rate_type = rideItem.rate_type;
//     const user_id = rideItem.customer_id;
//     //const estimated_time_in_minutes = rideItem.estimated_time_in_minutes;
//     const status_log = rideItem.status_log;
//     let start_time, end_time, estimated_time_in_minutes, estimatedAmount;
//     if (status_log != null) {
//         await Promise.all(status_log.map(async (item) => {
//             if (item.status.toLowerCase() === c_r_s_status_name) {
//                 start_time = item.datetime;
//             }
//             if (item.status.toLowerCase() === c_r_e_status_name) {
//                 end_time = item.datetime;
//             }
//         }));
//         const date1 = moment(start_time);
//         const date2 = moment(end_time);
//         estimated_time_in_minutes = parseFloat(date2.diff(date1, 'minutes', true)).toFixed(2);
//         //console.log('estimated_time_in_min', estimated_time_in_minutes);
//         try {
//             if (orgId > 0) {
//                 const pricing = await getPricingForOrg(orgId, "AED");
//                 let customerDetails = { organization_id: orgId, customer_id: user_id };
//                 //console.log('customer details', customerDetails);
//                 if (pricing && pricing[0]) {
//                     if (wallet_balance_amount < 0) {
//                         //console.log('less');
//                         estimatedAmount = calculateEstimatedAmount(
//                             rate_type,
//                             estimated_time_in_minutes,
//                             pricing[0],
//                             [],
//                             wallet_balance_amount,
//                             coupon_ids,
//                             customerDetails
//                         );
//                     } else {
//                         //console.log('not less');
//                         estimatedAmount = calculateEstimatedAmount(
//                             rate_type,
//                             estimated_time_in_minutes,
//                             pricing[0],
//                             [],
//                             0,
//                             coupon_ids,
//                             customerDetails
//                         );
//                         // estimatedAmount = calculateEstimatedAmount(
//                         //     rate_type,
//                         //     estimated_time_in_minutes,
//                         //     pricing[0]
//                         // );
//                     }
//                 }
//             } else {
//                 estimatedAmount = null;
//             }
//             //console.log('estimatedAmount', estimatedAmount);
//             return estimatedAmount;
//         } catch (error) {
//             return {};
//         }
//     }
// }


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
        //console.log('1');
        let paymentOutput = {};
        //get customer information
        const customer = await paymentsDAO.findUserById(customer_id);
        if (customer === null) {
            paymentOutput = {};
            paymentOutput.error = `The Customer ${customer_id} is not found.`;
            paymentOutput.success = false;
            throw new Error(paymentOutput.error);
            //return paymentOutput;
        }
        //console.log('2');
        //get particular payment type record
        let payment_type_method;
        let paymentAPPStatus;
        if (payment_type.toLowerCase() === 'applepay' || payment_type.toLowerCase() === 'apple pay') {
            payment_type_method = await paymentsDAO.getPaymentTypeMethodByName(true, true, payment_type);
            //console.log('3');

            paymentAPPStatus = await paymentsDAO.findStatusName(c_p_p_status_name);
            if (!paymentAPPStatus) {
                paymentOutput = {};
                paymentOutput.error = `Status for ${c_p_p_status_name} not set.`;
                paymentOutput.success = false;
                throw new Error(paymentOutput.error);
                //return paymentOutput;
            }
        } else {
            //console.log('4');
            payment_type_method = await paymentsDAO.getPaymentTypeMethodByName(true, true, payment_type);
        }

        if (!payment_type_method) {
            //console.log('5');
            paymentOutput = {};
            paymentOutput.error = `Payment Type Method ${payment_type} is not found.`;
            paymentOutput.success = false;
            throw new Error(paymentOutput.error);
            //return paymentOutput;
        }
        let paymentCompletedStatus;

        paymentCompletedStatus = await paymentsDAO.findStatusName(c_p_c_status_name);
        if (!paymentCompletedStatus) {
            paymentOutput = {};
            paymentOutput.error = `Status for ${c_p_c_status_name} not set.`;
            paymentOutput.success = false;
            throw new Error(paymentOutput.error);
            //return paymentOutput;
        }
        //console.log('6');
        let cashDStatusCode, cashPStatusCode, cashWalletAStatusCode, cashCreditStatusCode;
        if (payment_type.toLowerCase() === 'cash') {
            //get status id from status table for Cash Debit status
            cashDStatusCode = await paymentsDAO.findStatusName(c_c_d_transaction_type);
            if (!cashDStatusCode) {
                paymentOutput = {};
                paymentOutput.error = `Status for Cash Debit not set.`;
                paymentOutput.success = false;
                throw new Error(paymentOutput.error);
                //return paymentOutput;
            }
            //Pening status record
            //get status id from status table for Cash Debit status
            cashPStatusCode = await paymentsDAO.findStatusName(c_c_p_status_name);
            if (!cashPStatusCode) {
                paymentOutput = {};
                paymentOutput.error = `Status code ${c_c_p_status_name} not set.`;
                paymentOutput.success = false;
                throw new Error(paymentOutput.error);
                //return paymentOutput;
            }

            //get status id from status table for Wallet Credit status
            cashWalletAStatusCode = await paymentsDAO.findStatusName(c_w_a_transaction_type);
            if (!cashWalletAStatusCode) {
                paymentOutput = {};
                paymentOutput.error = `Status for Cash Wallet Adjustment not set.`;
                paymentOutput.success = false;
                throw new Error(paymentOutput.error);
                //return paymentOutput;
            }

            cashCreditStatusCode = await paymentsDAO.findStatusName(c_c_c_transaction_type);
            if (!cashCreditStatusCode) {
                paymentOutput = {};
                paymentOutput.error = `Status for Cash Credit not set.`;
                paymentOutput.success = false;
                throw new Error(paymentOutput.error);
                //return paymentOutput;
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
                //return paymentOutput;
            }
            //get status id from status table for Wallet Credit status
            walletCStatusCode = await paymentsDAO.findStatusName(c_w_c_transaction_type);
            if (!walletCStatusCode) {
                paymentOutput = {};
                paymentOutput.error = `Status for Wallet Top up not set.`;
                paymentOutput.success = false;
                throw new Error(paymentOutput.error);
                //return paymentOutput;
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
                //return paymentOutput;
            }
            if (!checkZeroNegBal) {
                paymentOutput = {};
                paymentOutput.error = `Wallet is not yet created for the user.`;
                paymentOutput.success = false;
                paymentOutput.wallet_balance = `${process.env.CURRENCY_CODE}`
                //return paymentOutput;
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
                //return paymentOutput;
            }
            //get status id from status table for Card Debit status
            cardDStatusCode = await paymentsDAO.findStatusName(c_c_de_transaction_type);
            if (!cardDStatusCode) {
                paymentOutput = {};
                paymentOutput.error = `Status for Card Debit not set.`;
                paymentOutput.success = false;
                throw new Error(paymentOutput.error);
                //return paymentOutput;
            }
            //Card Sale
            const telr_payment_method = `${payment_type}-${c_s_order_payment_type}`;
            payment_method = await paymentsDAO.getPaymentTypeMethodByName(true, false, telr_payment_method);

            if (!payment_method) {
                paymentOutput = {};
                paymentOutput.error = `Payment Method ${telr_payment_method} is not defined.`;
                paymentOutput.success = false;
                throw new Error(paymentOutput.error);
                //return paymentOutput;
            }
            //check if customer payment verification is completed - Card-Verify
            //console.log('slug_id', card_slug_id);
            customerRec = await paymentsDAO.findPaymentByUserAndTransaction(customer_id, card_slug_id);
            //console.log('customerRec', customerRec);
            if (!customerRec) {
                paymentOutput = {};
                paymentOutput.error = `Customer Card Reference is invalid.`;
                paymentOutput.success = false;
                throw new Error(paymentOutput.error);
                //return paymentOutput;
            }
            if (cardAuthorisedStatusCode) {
                if (customerRec.status_id !== cardAuthorisedStatusCode.id) {
                    paymentOutput = {};
                    paymentOutput.error = `Customer Payment Verification is not completed.`;
                    paymentOutput.success = false;
                    throw new Error(paymentOutput.error);
                    //return paymentOutput;
                }
            }
            //get status id from status table for Wallet Credit status
            cardWalletAStatusCode = await paymentsDAO.findStatusName(cr_w_a_transaction_type);
            if (!cardWalletAStatusCode) {
                paymentOutput = {};
                paymentOutput.error = `Status for Card Wallet Adjustment not set.`;
                paymentOutput.success = false;
                throw new Error(paymentOutput.error);
                //return paymentOutput;
            }
        }

        if (payment_type.toLowerCase() === 'applepay' || payment_type.toLowerCase() === 'apple pay') {
            //console.log('8');
            //get status id from status table for Wallet Credit status
            walletDStatusCode = await paymentsDAO.findStatusName(c_w_d_transaction_type);
            if (!walletDStatusCode) {
                paymentOutput = {};
                paymentOutput.error = `Status for Wallet Payment not set.`;
                paymentOutput.success = false;
                throw new Error(paymentOutput.error);
                //return paymentOutput;
            }

            cardAuthorisedStatusCode = await paymentsDAO.findStatusName(c_r_a_status_name);
            if (!cardAuthorisedStatusCode) {
                paymentOutput = {};
                paymentOutput.error = `Status for Authorised not set.`;
                paymentOutput.success = false;
                throw new Error(paymentOutput.error);
                //return paymentOutput;
            }
        }

        // Check for existing trip for customer
        const { PK, SK } = await getRideKeyInfo(customer_id, ride_id);
        //console.log('PK', PK, 'SK', SK);
        //paymentsDAO.getRideByCustomer()
        const rideItem = await ridesDAO.getRide(PK, SK);
        //console.log('ride item', rideItem);

        if (!rideItem) {
            paymentOutput = {};
            paymentOutput.error = `Ride not found.`;
            paymentOutput.success = false;
            throw new Error(paymentOutput.error);
            //return paymentOutput;
        }

        // If the ride already has completed status
        if (rideItem.status.toLowerCase() === c_r_c_status_name.toLowerCase()) {
            paymentOutput = {};
            paymentOutput.is_paid = false;
            paymentOutput.paymentMethod = payment_type;
            paymentOutput.error = `The Ride - ${ride_id} is already in ${c_r_c_status_name} status.`;
            paymentOutput.success = false;
            throw new Error(paymentOutput.error);
            //return paymentOutput;
        }
        //console.log('9');
        // If the ride is not in payable status
        if (rideItem.status.toLowerCase() !== c_r_p_status_name.toLowerCase()) {
            paymentOutput = {};
            paymentOutput.is_paid = false;
            paymentOutput.paymentMethod = payment_type;
            paymentOutput.error = `The Ride - ${ride_id} is not yet applicable for Payment Process.`;
            paymentOutput.success = false;
            throw new Error(paymentOutput.error);
            //return paymentOutput;
        }
        //.log('19');
        if (customer && customer.device_id === null) {
            paymentOutput.error = `The customer Device Id is not configured.`;
            paymentOutput.success = false;
            throw new Error(paymentOutput.error);
            //return paymentOutput;
        }
        //console.log('10');
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
            //return paymentOutput;
        }
        if (payment_type.toLowerCase() === 'wallet') {
            const telr_payment_method = `${payment_type}-${c_w_p_status_name}`;
            const payment_method = await paymentsDAO.getPaymentTypeMethodByName(true, false, telr_payment_method);
            if (!payment_method) {
                paymentOutput = {};
                paymentOutput.error = `Payment Method is not defined.`;
                paymentOutput.success = false;
                throw new Error(paymentOutput.error);
                //return paymentOutput;
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
            //paymentOutput.statusCode = statusCode;
            paymentOutput.cardDStatusCode = cardDStatusCode;
            paymentOutput.success = true;
            paymentOutput.customerRec = customerRec;
            paymentOutput.payment_method = payment_method;
            paymentOutput.cardAuthorisedStatusCode = cardAuthorisedStatusCode;
            paymentOutput.cardWalletAStatusCode = cardWalletAStatusCode;
            paymentOutput.paymentCStatusCode = paymentCompletedStatus;
            return paymentOutput;
        } else if (payment_type.toLowerCase() === 'applepay' || payment_type.toLowerCase() === 'apple pay') {
            paymentOutput = {};
            paymentOutput.rideItem = rideItem;
            paymentOutput.payment_type_method = payment_type_method;
            paymentOutput.customer = customer;
            paymentOutput.walletDStatusCode = walletDStatusCode;
            paymentOutput.success = true;
            paymentOutput.paymentCStatusCode = paymentCompletedStatus;
            //paymentOutput.payment_method = payment_method;
            paymentOutput.cardAuthorisedStatusCode = cardAuthorisedStatusCode;
            paymentOutput.paymentPStatusCode = paymentAPPStatus;
            return paymentOutput;
        }
    } catch (error) {
        //console.log('validate input data error -', error.message);
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

const validateCorporateInputData = async (inputData) => {
    try {
        let paymentOutput = {};
        const { payment_type, is_org, customer_id, ride_id } = inputData;

        if (is_org && payment_type.toLowerCase() !== 'wallet') {
            paymentOutput = {};
            paymentOutput.error = `The Payment Type should be wallet for enabling corporate customer payment`;
            paymentOutput.success = false;
            throw new Error(paymentOutput.error);
            //return paymentOutput;
        }
        //const { is_org } = inputData;
        if (payment_type.toLowerCase() === 'wallet') {
            //console.log('org wallet payment 1');

            //get particular payment type record
            const payment_type_method = await paymentsDAO.getPaymentTypeMethodByName(true, true, payment_type);
            //console.log('org wallet payment payment_type_method', payment_type_method);
            if (!payment_type_method) {
                paymentOutput = {};
                paymentOutput.error = `Payment Type Method ${payment_type} is not found.`;
                paymentOutput.success = false;
                throw new Error(paymentOutput.error);
                //return paymentOutput;
            }

            //get customer information
            const customer = await paymentsDAO.findUserById(customer_id);
            if (customer === null) {
                paymentOutput = {};
                paymentOutput.error = `The Customer ${customer_id} is not found.`;
                paymentOutput.success = false;
                throw new Error(paymentOutput.error);
                //return paymentOutput;
            }
            let paymentCompletedStatus;
            if (is_org) {
                //console.log('org wallet payment 2');
                //c_w_c_transaction_type,c_p_p_status_name
                paymentPendingStatus = await paymentsDAO.findStatusName(c_p_p_status_name);
                if (!paymentPendingStatus) {
                    paymentOutput = {};
                    paymentOutput.error = `Status for ${c_p_p_status_name} not set.`;
                    paymentOutput.success = false;
                    throw new Error(paymentOutput.error);
                    //return paymentOutput;
                }
            }

            let cashDStatusCode, cashPStatusCode, cashWalletAStatusCode;

            let walletDStatusCode, walletCStatusCode;
            if (payment_type.toLowerCase() === 'wallet') {
                //console.log('org wallet payment 3');
                //get status id from status table for Wallet Credit status
                walletDStatusCode = await paymentsDAO.findStatusName(c_w_d_transaction_type);
                if (!walletDStatusCode) {
                    paymentOutput = {};
                    paymentOutput.error = `Status for Wallet Payment not set.`;
                    //console.log('org wallet payment 4');
                    paymentOutput.success = false;
                    throw new Error(paymentOutput.error);
                    //return paymentOutput;
                }
                //get status id from status table for Wallet Credit status
                walletCStatusCode = await paymentsDAO.findStatusName(c_w_c_transaction_type);
                if (!walletCStatusCode) {
                    paymentOutput = {};
                    paymentOutput.error = `Status for Wallet Top up not set.`;
                    //console.log('org wallet payment 5');
                    paymentOutput.success = false;
                    throw new Error(paymentOutput.error);
                    //return paymentOutput;
                }
            }

            const { PK, SK } = await getRideKeyInfo(customer_id, ride_id);
            //const rideItem = await paymentsDAO.getRideByCustomer(PK, SK);
            const rideItem = await ridesDAO.getRide(PK, SK);
            //console.log('rid', rideItem);
            //console.log('org wallet payment 6');
            //if (rideItem) {
            if (!rideItem) {
                paymentOutput = {};
                paymentOutput.error = `Ride not found.`;
                //console.log('org wallet payment 7');
                paymentOutput.success = false;
                throw new Error(paymentOutput.error);
                //return paymentOutput;
            }
            if (rideItem.status.toLowerCase() === c_p_p_status_name.toLowerCase()) {
                paymentOutput = {};
                paymentOutput.is_paid = false;
                paymentOutput.paymentMethod = payment_type;
                paymentOutput.error = `The Ride - ${ride_id} is already in ${c_p_p_status_name} status.`;
                //console.log('org wallet payment 8');
                paymentOutput.success = false;
                throw new Error(paymentOutput.error);
                //return paymentOutput;
            }
            if (rideItem.status.toLowerCase() !== c_r_p_status_name.toLowerCase()) {
                paymentOutput = {};
                paymentOutput.is_paid = false;
                paymentOutput.paymentMethod = payment_type;
                paymentOutput.error = `The Ride - ${ride_id} is not yet applicable for Payment Process.`;
                //console.log('org wallet payment 9');
                paymentOutput.success = false;
                throw new Error(paymentOutput.error);
                //return paymentOutput;
            }

            if (customer && customer.device_id === null) {
                paymentOutput.error = `The customer Device Id is not configured.`;
                //console.log('org wallet payment 10');
                paymentOutput.success = false;
                throw new Error(paymentOutput.error);
                //return paymentOutput;
            }
            const exitingPaymentRec = await paymentsDAO.findCorpRideWalletPaymentStatus(customer_id, ride_id);
            if (exitingPaymentRec) {
                //console.log('org wallet payment 11');
                paymentOutput = {};
                paymentOutput.is_paid = false;
                paymentOutput.paymentMethod = payment_type;
                paymentOutput.error = `Payment is already completed for this Ride ${ride_id}`;
                paymentOutput.success = false;
                throw new Error(paymentOutput.error);
                //return paymentOutput;
            }

            if (payment_type.toLowerCase() === 'wallet' && is_org) {
                const corp_payment_method = `${payment_type}-${c_w_c_p_status_name}`;
                const payment_method = await paymentsDAO.getPaymentTypeMethodByName(true, false, corp_payment_method);
                //console.log('1', corp_payment_method);
                //console.log('payment_type_method', payment_method);
                if (!payment_method) {
                    //console.log('org wallet payment 12');
                    paymentOutput = {};
                    paymentOutput.error = `Payment Method is not defined.`;
                    paymentOutput.success = false;
                    throw new Error(paymentOutput.error);
                    //return paymentOutput;
                }

                paymentOutput = {};
                paymentOutput.rideItem = rideItem;
                paymentOutput.payment_type_method = payment_type_method;
                paymentOutput.customer = customer;
                paymentOutput.payment_method = payment_method;
                paymentOutput.walletDStatusCode = walletDStatusCode;
                paymentOutput.walletCStatusCode = walletCStatusCode;
                paymentOutput.paymentPStatusCode = paymentPendingStatus;
                paymentOutput.success = true;
                //console.log('org wallet payment 13', paymentOutput);
                return paymentOutput;
            }
        }
    } catch (error) {
        //console.log('validate corporate input data error -', error.message);
        await addServerLog({
            log_level: "ERROR",
            service_name: "validateCorporateInputData",
            error_message: `validate corporate input data error - ${error.message}.`
        });
        paymentOutput = {};
        paymentOutput.error = error.message;
        paymentOutput.success = false;
        return paymentOutput;
    }
}
const cancelRideWalletUpdate = async (inputData) => {
    try {
        const {
            customer_id,
            ride_id, cancelation_amount, payment_type } = inputData;

        let paymentOutput = {};
        //get customer information
        const customer = await paymentsDAO.findUserById(customer_id);
        if (!customer) {
            paymentOutput = {};
            paymentOutput.error = `The Customer ${customer_id} is not found.`;
            paymentOutput.success = false;
            return paymentOutput;
        }
        //get particular payment type record
        const payment_type_method = await paymentsDAO.getPaymentTypeMethodByName(true, true, payment_type);

        if (!payment_type_method) {
            paymentOutput = {};
            paymentOutput.error = `Payment Type Method ${payment_type} is not found.`;
            paymentOutput.success = false;
            return paymentOutput;
        }

        // //get status id from status table for Wallet Credit status
        const walletDStatusCode = await paymentsDAO.findStatusName(c_w_d_transaction_type);
        if (!walletDStatusCode) {
            paymentOutput = {};
            paymentOutput.error = `Status code ${c_w_d_transaction_type} not set.`;
            paymentOutput.success = false;
            return paymentOutput;
        }

        //get status id from status table for Cancelation Ride Penalty
        const walletCRStatusCode = await paymentsDAO.findStatusName(c_c_r_p_transaction_type);
        if (!walletCRStatusCode) {
            paymentOutput = {};
            paymentOutput.error = `Status code ${c_c_r_p_transaction_type} not set.`;
            paymentOutput.success = false;
            return paymentOutput;
        }

        // Check for existing trip for customer
        const { PK, SK } = await getRideKeyInfo(customer_id, ride_id);
        const rideItem = await paymentsDAO.getRideByCustomer(PK, SK);

        if (!rideItem.dmoRideOutput?.item || !rideItem.dmoRideOutput.success) {
            paymentOutput = {};
            paymentOutput.error = `Ride not found.`;
            paymentOutput.success = false;
            return paymentOutput;
        }

        //add user payment record for deducting cancelation ride penalty.
        let userInfo = {
            user_id: customer_id,
            w_d_transaction_type_id: walletCRStatusCode.id,
            payment_type_method_id: payment_type_method.id,
            cancelation_amount,
            ride_id,
            amount: rideItem.dmoRideOutput.item.estimated_amount,
            chauffeur_id: rideItem.dmoRideOutput.item.chauffeur_id
        };

        const response = await paymentsDAO.createCanelRideUpdateWalletRecord(userInfo);
        if (response.walletOutput.success) {
            paymentOutput.error = '';
            paymentOutput.success = true;
            paymentOutput.wallet_balance = response.walletOutput.balance;
            paymentOutput.currency = process.env.CURRENCY_CODE;
            paymentOutput.chauffeur_id = rideItem.dmoRideOutput.item.chauffeur_id;
            paymentOutput.ride_amount = response.walletOutput.ride_amount;
            paymentOutput.adjusted_amount = response.walletOutput.adjusted_amount;
            paymentOutput.amount_to_be_paid = response.walletOutput.total_amount_to_be_paid;
            paymentOutput.previous_balance = response.walletOutput.prev_wallet_balance;
        } else {
            paymentOutput.is_paid = false;
            paymentOutput.error = response.walletOutput.error;
            paymentOutput.success = false;
            paymentOutput.wallet_balance = response.walletOutput.balance;
            paymentOutput.currency = process.env.CURRENCY_CODE;
            paymentOutput.ride_amount = response.walletOutput.ride_amount;
        }
        return paymentOutput;

    } catch (error) {
        //console.log('cancel ride wallet update error -', error.message);\
        await addServerLog({
            log_level: "ERROR",
            service_name: "cancelRideWalletUpdate",
            error_message: `get wallet details user error - ${error.message}.`
        });
        return {
            message: 'Failed to process cancel ride Penality.',
            success: false,
            data: {},
            error: error.message,
            error_status_code: 500
        }
    }
}

const createCustomerWallet = async (user_id) => {
    try {
        let paymentOutput = {};
        const response = await paymentsDAO.createZeroCustomerWallet(user_id);
        if (response && response.success) {
            paymentOutput.error = '';
            paymentOutput.success = true;
            paymentOutput.wallet_balance = response.newCustomerWallet.wallet_balance;
            paymentOutput.currency = process.env.CURRENCY_CODE;
            paymentOutput.message = response.message;
        } else {
            paymentOutput.error = response.error;
            paymentOutput.success = false;
        }
        return paymentOutput;

    } catch (error) {
        //console.log('create customer wallet error -', error.message);
        await addServerLog({
            log_level: "ERROR",
            service_name: "createCustomerWallet",
            error_message: `create customer wallet error - ${error.message}.`
        });
        return {
            message: 'Failed to create Zero Customer Wallet.',
            success: false,
            data: {},
            error: error.message,
            error_status_code: 500
        }
    }
}

async function sendSms(smsInfo, provider = config.defaultSmsProvider) {
    if (provider === "smscountry") {
        const key = "I4aluMBievwerKRVfs25";
        const token = "6Q1BYfNrGAJrVFd6QHeFX2mXQU7y1gCQK3T7AZfj";
        const sendSMSUrl = `https://restapi.smscountry.com/v0.1/Accounts/${key}/SMSes`;
        const senderId = "AVALIFT";
        try {
            const payload = {
                Text: smsInfo.Text,
                Number: smsInfo.phoneNumber.replace(/\+/g, ""),
                SenderId: senderId,
                DRNotifyHttpMethod: "POST",
                Tool: "API",
            };
            let responseMessage;
            const combinedKey = `${key}:${token}`;
            await axios
                .post(sendSMSUrl, payload, {
                    headers: {
                        Authorization: `Basic ${Buffer.from(combinedKey).toString(
                            "base64"
                        )}`,
                        "Content-Type": "application/json",
                    },
                })
                .then(async (response) => {
                    responseMessage = {
                        errorMessage: "",
                        statusCode: response.status,
                        messageUUID: response.data.MessageUUID,
                        phoneNumber: smsInfo.phoneNumber,
                        messageStatus: response.data.Message,
                        status: response.data.Success,
                    };
                })
                .catch(async (error) => {
                    if (error.response) {
                        responseMessage = {
                            errorMessage: error.response.data.Message,
                            statusCode: error.response.status,
                            messageUUID: error.response.data.MessageUUID,
                            phoneNumber: smsInfo.phoneNumber,
                            messageStatus: "",
                            status: error.response.data.Success,
                        };
                    }
                });
            await addServerLog({
                log_level: "INFO",
                service_name: "sendSmsCountry",
                error_message: `send SMS country status for mobile ${smsInfo && smsInfo.phoneNumber
                    } is ${responseMessage && responseMessage.status} - ${responseMessage && responseMessage.messageUUID
                    }`,
            });
            return responseMessage;
        } catch (error) {
            await addServerLog({
                log_level: "ERROR",
                service_name: "sendSms",
                error_message: `send SMS country failed for mobile ${smsInfo && smsInfo.phoneNumber
                    } and error ${error.message}`,
            });
            throw error;
        }
    } else {
        await addServerLog({
            log_level: "ERROR",
            service_name: "sendSms",
            error_message: `SMS provider "${provider}" is not supported.`,
        });
        throw new Error(`SMS provider "${provider}" is not supported.`);
    }
};


const createCorporateCustomerWallet = async (inputData) => {
    try {
        //const validatedData = PaymentsValidator.walletPaymentValidator(inputData);
        //if (validatedData) {
        const {
            customer_id,
        } = inputData;

        let paymentOutput = {};
        const response = await paymentsDAO.createZeroCorporateCustomerWallet(customer_id);
        if (response && response.success) {
            paymentOutput.error = '';
            paymentOutput.success = true;
            paymentOutput.wallet_balance = response.newCustomerWallet.wallet_balance;
            paymentOutput.currency = process.env.CURRENCY_CODE;
            paymentOutput.message = response.message;
        } else {
            paymentOutput.error = response.error;
            paymentOutput.success = false;
        }
        return paymentOutput;
        //}

    } catch (error) {
        //console.log('creae corporate customer wallet error -', error.message);
        await addServerLog({
            log_level: "ERROR",
            service_name: "createCorporateCustomerWallet",
            error_message: `create corporate customer wallet error - ${error.message}.`
        });
        return {
            message: 'Failed to create Zero Corporate Customer Wallet.',
            success: false,
            data: {},
            error: error.message,
            error_status_code: 500
        }
    }
}

const createCorporateWalletPayment = async (inputData) => {
    try {
        const validatedData = PaymentsValidator.corporateWalletPaymentValidator(inputData);
        if (validatedData) {
            const {
                customer_id,
                ride_id, payment_type, is_org, coupon_ids } = inputData;
            const logInput = `${customer_id}, ${ride_id},${payment_type},${is_org}, ${coupon_ids}`;
            // await addServerLog({
            //     log_level: "INFO",                         // required
            //     error_message: `createCorporateWalletPayment input - ${logInput}`   // required
            // });
            let start_time, end_time;
            //let payment_type = "wallet"; //corporate credit
            let paymentOutput = await validateCorporateInputData(inputData);
            //console.log('cc', paymentOutput.rideItem);
            if (paymentOutput && paymentOutput.success) {
                //get estimated amount based on pricing configuration.

                //get pricing information
                //console.log('customer ride Item', paymentOutput.rideItem);
                const final_result = paymentOutput.rideItem?.final_price_calculation;

                if (final_result && final_result.final_total_amount > 0) {
                    //console.log('org wallet payment method 1');
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
                    //console.log('estimated_time_in_min', parseInt(estimated_time_in_minutes));


                    let notificationData;
                    notificationData = {
                        title: "Wallet Payment Completion Status",
                        data: {
                            ride_id: paymentOutput.rideItem.ride_id.toString(),
                            requested_pickup_point: paymentOutput.rideItem.requested_pickup_point.toString(),
                            requested_pickup_lat: paymentOutput.rideItem.requested_pickup.lat.toString(),
                            requested_pickup_long: paymentOutput.rideItem.requested_pickup.long.toString(),
                            customer_id: paymentOutput.rideItem.customer_id.toString(),
                            estimated_amount: total_amount_to_be_paid.toString(),
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
                        description: 'Corporate Wallet Payment',
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
                        //c_r_c_status_name,
                        c_p_p_status_name,
                        c_r_p_status_name,
                        w_d_transaction_type_id: paymentOutput.walletDStatusCode.id,
                        w_c_transaction_type_id: paymentOutput.walletCStatusCode.id,
                        payment_pending_status_id: paymentOutput.paymentPStatusCode.id,
                        is_org,
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
                        final_result
                    };
                    //console.log('org wallet payment method 2');
                    const response = await paymentsDAO.createCorporateWalletPaymentRecord(paymentInfo);
                    //console.log('corp wallet payment response', response);
                    if (response.walletOutput.success) {
                        if (response.walletOutput.payment_status === c_p_p_status_name) {
                            paymentInfo.notificationData.body = `Corporate Wallet Payment is successfully Completed for the ride ${paymentInfo.ride_id}.`;
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
                                //paymentOutput.amount_to_be_paid = response.walletOutput.total_amount_to_be_paid;

                                paymentOutput.previous_balance = response.walletOutput.prev_wallet_balance;
                                paymentOutput.is_coupon_applied = is_coupon_applied;
                                //paymentOutput.base_fare = base_fare;
                                paymentOutput.rates = rates;
                                paymentOutput.rate_type = rate_type;
                                paymentOutput.mandatory_charges = mandatory_charges;
                                paymentOutput.other_charges = other_charges;
                                paymentOutput.vat = vat;
                                paymentOutput.is_invoice_created = is_invoice_created;
                                paymentOutput.total_amount_to_be_paid = total_amount_to_be_paid;
                                paymentOutput.discount_amount = discount_amount;
                                // await addServerLog({
                                //     log_level: "INFO",
                                //     error_message: `createCorporateWalletPayment success ${total_amount_to_be_paid}`
                                // });
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
                    paymentOutput.error = "Calculated Ride Amount is incorrect"
                    paymentOutput.success = false;
                }

            }
            return paymentOutput;
        }
    } catch (error) {
        //console.log('create corporate wallet payment error -', error.message);
        await addServerLog({
            log_level: "ERROR",
            service_name: "createCorporateWalletPayment",
            error_message: `create corporate wallet payment error - ${error.message}.`
        });
        return {
            message: 'Failed to process Corporate Customer Wallet Payment.',
            success: false,
            data: {},
            error: error.message,
            error_status_code: 500
        }
    }
}

const createPaymentTypes = async (paymentTypeData) => {
    try {
        const validatedData = PaymentsValidator.paymentTypesValidator(paymentTypeData);
        if (validatedData) {
            //de-structure payment data input
            const { name, for_display, is_active } = paymentTypeData;
            let paymentOutput = {};
            const response = await paymentsDAO.createPaymentTypes(name, for_display, is_active);
            if (response && response.success) {
                paymentOutput.error = '';
                paymentOutput.success = true;
                paymentOutput.message = response.message;
            } else {
                paymentOutput.error = response.error;
                paymentOutput.success = false;
            }
            return paymentOutput;
        }
    } catch (error) {
        //console.log('create payment types error -', error.message);
        await addServerLog({
            log_level: "ERROR",
            service_name: "createPaymentTypes",
            error_message: `create payment types error - ${error.message}.`
        });
        return {
            message: 'Failed to create or update Payment Type.',
            success: false,
            data: {},
            error: error.message,
            error_status_code: 500
        }
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
        //console.log('get user wallet balance error -', error);
        await addServerLog({
            log_level: "ERROR",
            service_name: "getUsersWalletBalance",
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
            service_name: "getCorporatePaymentDetails",
            error_message: `get corporate payment details error - ${error.message}.`
        });
        return {
            success: false,
            message: "Error while fetching Corporate Payment details.",
            data: {}
        }
    }
}

const getChauffeurWalletDetailsByUser = async (user_id) => {
    try {
        const result = await paymentsDAO.findChauffeurUserWalletById(user_id);
        const data = {
            wallets: []
        };
        if (result) {
            let items = {};
            const role = await paymentsDAO.findRoleNameById(result.User.role_id);
            items.user_id = result.user_id;
            items.wallet_balance = result.wallet_balance;
            items.first_name = result.User.first_name;
            items.last_name = result.User.last_name;
            items.role_name = role.name;
            data.wallets.push(items);
        }

        return {
            success: true,
            message: "Wallet details fetched successfully",
            data
        }
    } catch (error) {
        //console.log('get chauffeur wallet details by user id error -', error.message);
        await addServerLog({
            log_level: "ERROR",
            service_name: "getChauffeurWalletDetailsByUser",
            error_message: `get chauffeur wallet details by user id error - ${error.message}.`
        });
        return {
            success: false,
            message: "Error while fetching Wallet details.",
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

        //console.log(result);
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
            service_name: "getChauffeurWalletDetails",
            error_message: `get chauffeur wallet details error - ${error.message}.`
        });
        return {
            success: false,
            message: "Error while fetching Wallet details.",
            data: {}
        }
    }
}

const createChauffeurWallet = async (user_id) => {
    try {
        let paymentOutput = {};
        const response = await paymentsDAO.createZeroChauffeurWallet(user_id);
        if (response && response.success) {
            paymentOutput.error = '';
            paymentOutput.success = true;
            paymentOutput.wallet_balance = response.newChauffeurWalet.wallet_balance;
            paymentOutput.currency = process.env.CURRENCY_CODE;
            paymentOutput.message = response.message;
        } else {
            paymentOutput.error = response.error;
            paymentOutput.success = false;
        }
        return paymentOutput;

    } catch (error) {
        //console.log('create chauffeur wallet error -', error.message);
        await addServerLog({
            log_level: "ERROR",
            service_name: "createChauffeurWallet",
            error_message: `create chauffeur wallet error - ${error.message}.`
        });
        return {
            message: 'Failed to create Zero Chauffeur Wallet.',
            success: false,
            data: {},
            error: error.message,
            error_status_code: 500
        }
    }
}

const getCashWalletDetailsByChauffer = async (user_id) => {
    //console.log('us2', user_id);
    let paymentOutput;
    try {
        //Cash-Credit 
        const cashCreditStatusCode = await paymentsDAO.findStatusName(c_c_c_transaction_type);
        //console.log('status code', cashCreditStatusCode);
        if (!cashCreditStatusCode) {
            paymentOutput = {};
            paymentOutput.error = `Status for Cash Credit not set.`;
            paymentOutput.success = false;
            return paymentOutput;
        }

        const checkChauffeurWalletLogExists = await paymentsDAO.findChauffeurWalletById(user_id);

        if (!checkChauffeurWalletLogExists) {
            paymentOutput = {};
            paymentOutput.error = `Chauffeur Wallet is yet to be added with Cash balance.`;
            paymentOutput.success = false;
            return paymentOutput;
        }

        const payment_type_method = await paymentsDAO.getPaymentTypeMethodByName(true, true, 'Cash');
        //console.log('status code', cashCreditStatusCode);
        if (!payment_type_method) {
            paymentOutput = {};
            paymentOutput.error = `Payment Type for Cash not set.`;
            paymentOutput.success = false;
            return paymentOutput;
        }

        const result = await paymentsDAO.findCashWalletByChauffeurId(user_id, cashCreditStatusCode.id);
        //console.log('wa result', result);
        const data = {
            wallets: []
        };


        let total_rides = 0;
        let paymentDetails;
        const chaufferRide = await paymentsDAO.getChauffeurRideDetails(user_id);
        if (chaufferRide.$metadata.httpStatusCode === 200) {
            total_rides = chaufferRide.Count;

            const rideIds = chaufferRide && chaufferRide.Items?.map(x => x.ride_id);

            paymentDetails = await paymentsDAO.findPaymentsDetailsByRideIds(rideIds, payment_type_method.id);
            //console.log(paymentDetails);
            total_rides = paymentDetails && paymentDetails.total_rides;
            paymentDetails = {
                total_earnings: paymentDetails.total_earnings
            };
        }


        return {
            success: true,
            wallet_balance: result.chauffeurWalletRec ? result.chauffeurWalletRec.wallet_balance : 0,
            total_rides,
            message: "Chauffeur Cash Wallet details fetched successfully",
            data: paymentDetails
        }
    } catch (error) {
        //console.log('get cash wallet details by chauffeur error -', error.message);
        await addServerLog({
            log_level: "ERROR",
            service_name: "getCashWalletDetailsByChauffer",
            error_message: `get cash wallet details by chauffeur error - ${error.message}.`
        });
        return {
            success: false,
            message: "Error while fetching Chauffeur Cash Wallet details.",
            data: {}
        }
    }
}

const chaufferCashHandOverUpdate = async (inputData, user_id) => {
    try {
        //console.log('chaufferCashHandOverProcess-2', user_id);
        const validatedData = PaymentsValidator.paymentChauffeurCashValidator(inputData);
        if (validatedData) {
            //de-structure payment data input
            const { pd_user_id, hand_over_amount } = inputData;

            const logInput = `${user_id}, ${pd_user_id}, ${hand_over_amount}`;
            //console.log('chaufferCashHandOverProcess-3', logInput);
            // await addServerLog({
            //     log_level: "INFO",                         // required
            //     error_message: `chaufferCashHandOverUpdate input - ${logInput}`   // required
            // });

            let paymentOutput = {};

            const chauffeur_id = user_id;
            const completedStatus = await paymentsDAO.findStatusName(c_c_h_status_name);
            let completed_status_id;
            if (completedStatus) {
                completed_status_id = completedStatus.id;
            } else {
                paymentOutput.message = `Status for Completed not set`;
                paymentOutput.success = false;
                return paymentOutput;
            }
            //console.log('chaufferCashHandOverProcess-4', completed_status_id);
            const response = await paymentsDAO.updateChauffeurCashHandOver(chauffeur_id, pd_user_id, completed_status_id, hand_over_amount);
            //console.log('chaufferCashHandOverProcess--after-1', response);
            //if (response && response.success) {
            if (response.cashOutput.success) {
                paymentOutput.error = '';
                paymentOutput.success = true;
                paymentOutput.message = response.cashOutput.message;
                paymentOutput.wallet_balance = response.cashOutput.wallet_balance;
                paymentOutput.hand_over_wallet_balance = response.cashOutput.hand_over_wallet_balance;
            } else {
                paymentOutput.error = response.cashOutput.message;
                paymentOutput.message = response.error;
                paymentOutput.success = false;
            }
            return paymentOutput;
        }
    } catch (error) {
        //console.log('chaufferCashHandOverProcess-error-service -', error);
        await addServerLog({
            log_level: "ERROR",
            service_name: "chaufferCashHandOverUpdate",
            error_message: `chauffeur cash hand over update error - ${error.message}.`
        });
        return {
            message: 'Failed to process Chauffeur Cash Hand over changes.',
            success: false,
            data: {},
            error: error.message,
            error_status_code: 500
        }
    }
}


const pdCashHandOverUpdate = async (inputData, user_id) => {
    try {
        // console.log('user', user_id);
        const validatedData = PaymentsValidator.paymentPDCashValidator(inputData);
        if (validatedData) {
            //de-structure payment data input
            const { hand_over_user_id, hand_over_amount } = inputData;
            const logInput = `${user_id}, ${hand_over_user_id}, ${hand_over_amount}`;
            // await addServerLog({
            //     log_level: "INFO",                         // required
            //     error_message: `pdCashHandOverUpdate input - ${logInput}`   // required
            // });
            let paymentOutput = {};

            const pd_user_id = user_id;
            const completedStatus = await paymentsDAO.findStatusName(c_c_h_status_name);
            let completed_status_id;
            if (completedStatus) {
                completed_status_id = completedStatus.id;
            } else {
                paymentOutput.message = `Status for Completed not set`;
                paymentOutput.success = false;
                return paymentOutput;
            }
            //console.log('co', hand_over_user_id, hand_over_amount, user_id);
            const response = await paymentsDAO.updatePDCashHandOver(pd_user_id, hand_over_user_id, completed_status_id, hand_over_amount);
            //console.log('rs pd', response);
            //if (response && response.success) {
            if (response.cashOutput.success) {
                paymentOutput.error = '';
                paymentOutput.success = true;
                paymentOutput.message = response.cashOutput.message;
                paymentOutput.wallet_balance = response.cashOutput.wallet_balance;
                paymentOutput.hand_over_wallet_balance = response.cashOutput.hand_over_wallet_balance;
            } else {
                paymentOutput.error = response.cashOutput.error;
                paymentOutput.success = false;
            }
            return paymentOutput;
        }
    } catch (error) {
        //console.log('pd cash hand over update error -', error.message);
        await addServerLog({
            log_level: "ERROR",
            service_name: "pdCashHandOverUpdate",
            error_message: `pd cash hand over update error - ${error.message}.`
        });
        return {
            message: 'Failed to process PD Cash Hand over changes.',
            success: false,
            data: {},
            error: error.message,
            error_status_code: 500
        }
    }
}


const getPDUsersList = async (inputData) => {
    try {
        const validatedData = PaymentsValidator.roleNameValidator(inputData);
        if (validatedData) {
            const { role_name } = inputData;
            const pdUsers = await paymentsDAO.findUsersByRole(role_name);

            return pdUsers;
        }
    } catch (error) {
        //console.log('get pd user list', error.message);
        await addServerLog({
            log_level: "ERROR",
            service_name: "getPDUsersList",
            error_message: `get pd user list error - ${error.message}.`
        });
        throw error.message;
    }
}

const getCashWalletDetailsByPD = async (user_id) => {
    //console.log('us2', user_id);
    let paymentOutput, paymentDetails;
    try {
        //Cash-Credit 
        const cashCreditStatusCode = await paymentsDAO.findStatusName(c_c_c_transaction_type);
        //console.log('status code', cashCreditStatusCode);
        if (!cashCreditStatusCode) {
            paymentOutput = {};
            paymentOutput.error = `Status for Cash Credit not set.`;
            paymentOutput.success = false;
            return paymentOutput;
        }

        const checkPDWalletLogExists = await paymentsDAO.findPDWalletById(user_id);

        if (!checkPDWalletLogExists) {
            paymentOutput = {};
            paymentOutput.error = `PD Wallet is yet to be added with Cash balance.`;
            paymentOutput.success = false;
            return paymentOutput;
        }

        const result = await paymentsDAO.findCashWalletByPDId(user_id, cashCreditStatusCode.id);
        // //console.log('wa result', result);
        const data = {
            wallets: []
        };
        //console.log('rsult', result);

        // await Promise.all(result.chauffeurWalletLogRec.map(async (cashItem) => {
        //     data.wallets.push(cashItem);
        // }));

        let total_rides = 0;
        const pdRide = await paymentsDAO.getPDRideDetails(user_id);
        if (pdRide.$metadata.httpStatusCode === 200) {
            const rideStatuses = pdRide && pdRide.Items?.map(x => x.status);
            const cnt = rideStatuses.map(status_item => (status_item.includes("Completed") ? 1 : 0)).reduce((sum, count) => sum + count, 0);
            total_rides = cnt;
        }

        return {
            success: true,
            wallet_balance: result.pdWalletRec ? result.pdWalletRec.wallet_balance : 0,
            total_rides,
            message: "PD Cash Wallet details fetched successfully",
            data: paymentDetails
        }
    } catch (error) {
        //console.log('get cash wallet details by pd error -', error.message);
        await addServerLog({
            log_level: "ERROR",
            service_name: "getCashWalletDetailsByPD",
            error_message: `get cash wallet details by pd error - ${error.message}.`
        });
        return {
            success: false,
            message: "Error while fetching PD Cash Wallet details.",
            data: {}
        }
    }
}


const getAdminUsersList = async (inputData) => {
    try {
        const validatedData = PaymentsValidator.roleNameValidator(inputData);
        if (validatedData) {
            const { role_name } = inputData;
            const adminUsers = await paymentsDAO.findUsersByRole(role_name);

            return adminUsers;
        }
    } catch (error) {
        await addServerLog({
            log_level: "ERROR",
            service_name: "getAdminUsersList",
            error_message: `get admin user list error - ${error.message}.`
        });
        throw error.message;
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
        //console.log('get pd wallet details error -', error.message);
        await addServerLog({
            log_level: "ERROR",
            service_name: "getPDPgnWalletDetails",
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
        //console.log(error);
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
            service_name: "orgPaymentByRidesUpdate",
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
        //console.log('get pd wallet details error -', error.message);
        await addServerLog({
            log_level: "ERROR",
            service_name: "getPDWalletDetails",
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
        //        }
    } catch (error) {
        //console.log('get admin wallet details error -', error.message);
        await addServerLog({
            log_level: "ERROR",
            service_name: "getAdminWalletDetails",
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
                                    estimated_amount: total_amount_to_be_paid.toString(),
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
                                //base_fare,
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
                                admin_id,
                                final_result
                            };
                            //console.log('cash payment info', paymentInfo);
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
        //console.log('create cash payment error -', error.message);
        await addServerLog({
            log_level: "ERROR",
            service_name: "createAdminCashPayment",
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
            service_name: "getChauffeurWalletByRides",
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

                //console.log('customer ride Item', paymentOutput.rideItem);
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

                    let notificationData;
                    notificationData = {
                        title: "Wallet Payment Completion Status",
                        data: {
                            ride_id: paymentOutput.rideItem.ride_id.toString(),
                            requested_pickup_point: paymentOutput.rideItem.requested_pickup_point.toString(),
                            requested_pickup_lat: paymentOutput.rideItem.requested_pickup.lat.toString(),
                            requested_pickup_long: paymentOutput.rideItem.requested_pickup.long.toString(),
                            customer_id: paymentOutput.rideItem.customer_id.toString(),
                            estimated_amount: total_amount_to_be_paid.toString(),
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
                        description: 'Admin Wallet Payment',
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
                        admin_id,
                        final_result
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
        await addServerLog({
            log_level: "ERROR",
            service_name: "createAdminWalletPayment",
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

            let start_time, end_time;

            let paymentOutput = await validateInputData(paymentData);

            if (paymentOutput && paymentOutput.success) {
                //get estimated amount based on pricing configuration.

                //get pricing information
                //console.log('customer ride Item', paymentOutput.rideItem);
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
                    //console.log('cart id', cartid);
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
                    //console.log('result', result)
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
                                estimated_amount: total_amount_to_be_paid.toString(),
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
                            method: '',
                            currency: process.env.CURRENCY_CODE,
                            amount: estimated_total_amount,
                            custRef: '',
                            cartidRef: 0,
                            description: 'Quick Link Payment',
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
                            total_after_discount,
                            c_p_p_status_name
                        };

                        const response = await paymentsDAO.quickLinkPaymentRecord(paymentInfo);
                        if (response.walletOutput.success) {
                            //console.log('11', response.walletOutput.payment_status);
                            if (response.walletOutput.payment_status === c_a_p_status_name) {
                                //console.log('12');
                                paymentInfo.notificationData.body = `Quick Link Payment is successfully Initiated for the ride ${paymentInfo.ride_id}.`;
                                const notification_results = await queuePushNotification(paymentInfo.device_id, paymentInfo.notificationData);
                                if (notification_results && notification_results.notification_id !== '') {
                                    //console.log('13');
                                    paymentOutput = {};
                                    paymentOutput.Url = result.data.QuickLinkResponse.URL;
                                    paymentOutput.is_paid = false;
                                    paymentOutput.paymentMethod = payment_type;
                                    paymentOutput.error = '';
                                    paymentOutput.success = true;
                                    paymentOutput.payment_status = response.walletOutput.payment_status;
                                    paymentOutput.chauffeur_id = paymentInfo.chauffeur_id;

                                }
                                else {
                                    paymentOutput.is_paid = false;
                                    paymentOutput.paymentMethod = payment_type;
                                    paymentOutput.error = "Payment Status Notification is not sent to Customer.";
                                    paymentOutput.success = false;
                                    paymentOutput.currency = process.env.CURRENCY_CODE;
                                }
                            } else {
                                paymentOutput.is_paid = false;
                                paymentOutput.paymentMethod = payment_type;
                                paymentOutput.error = response.walletOutput.error;
                                paymentOutput.success = false;
                                paymentOutput.currency = process.env.CURRENCY_CODE;
                            }
                        } else {
                            paymentOutput.is_paid = false;
                            paymentOutput.paymentMethod = payment_type;
                            paymentOutput.error = response.walletOutput.error;
                            paymentOutput.success = false;
                            paymentOutput.currency = process.env.CURRENCY_CODE;
                            paymentOutput.ride_amount = response.walletOutput.ride_amount;
                        }


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
        //console.log('verify payment process error -', error.message);
        await addServerLog({
            log_level: "ERROR",
            service_name: "quickPaymentLinkProcess",
            error_message: `quick payment Link process error - ${error.message}.`
        });
        throw error;
    }
};

const customerApplePayProcess = async (paymentData) => {
    try {
        //input validations
        const validatedData = PaymentsValidator.customerApplePayPaymentValidator(paymentData);

        //de-structure payment data input
        if (validatedData) {
            const {
                customer_id,
                ride_id,
                payment_type,
                coupon_ids,
                transactionId,
                ephemeralPublicKey,
                publicKeyHash,
                data,
                signature,
                version,
                network,
                type,
                displayName,
                transactionIdentifier } = paymentData;
            const logInput = `${customer_id}, ${ride_id},${payment_type}, ${coupon_ids}, ${transactionId}, ${ephemeralPublicKey}, ${publicKeyHash}, ${data}, ${signature}, ${version}, ${network}, ${type}, ${displayName}`;
            //console.log('logInput customerapplepayprocess', logInput);
            let start_time, end_time;
            //let payment_type = "wallet"; //corporate credit
            let paymentOutput = await validateInputData(paymentData);
            if (paymentOutput && paymentOutput.success) {
                //get estimated amount based on pricing configuration.

                // to update wallet balance if zero or negative
                let userInfo = {
                    user_id: customer_id
                };
                const checkZeroNegBal = await paymentsDAO.findCustomerBalance(userInfo);
                let wallet_balance_amount = 0;
                wallet_balance_amount = checkZeroNegBal && parseFloat(checkZeroNegBal.wallet_balance);

                //get pricing information
                //console.log('customer ride Item', paymentOutput.rideItem);
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
                    const tip_amount = final_result ? final_result.tip_amount : 0.0;
                    const tip_added = final_result ? final_result.tip_added : false;
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
                    //console.log('estimated_time_in_min', parseInt(estimated_time_in_minutes));


                    const countryName = await getCountryNameByCode(paymentOutput.customer.country_code);

                    const cartid = await generateRandomAlphaNumericText(13);
                    //console.log('cart id', cartid);
                    const fullName = `${paymentOutput.customer.first_name} ${paymentOutput.customer.last_name}`;
                    const today = new Date();
                    const randomCartId = Math.floor(Math.random() * 100000 + Math.random() * 99999999 + Math.random() * 9);
                    const customerInfo = {
                        cartidRef: `${randomCartId}`,
                        currency: process.env.CURRENCY_CODE,
                        amount: total_amount_to_be_paid,
                        description: 'Apple Pay Payment Initiation',
                        forenames: paymentOutput.customer.first_name,
                        surname: paymentOutput.customer.last_name,
                        email: paymentOutput.customer?.email_id,
                        country: countryName,
                        phone: paymentOutput.customer.mobile_number
                    };


                    const payload = {

                        store: process.env.TELR_MERCHANT_ID,
                        authkey: process.env.APPLE_PAY_SECRET_KEY,
                        tran: {
                            id: customerInfo.cartidRef,
                            class: 'ecom',
                            type: 'sale',
                            description: customerInfo.description,
                            amount: customerInfo.amount,
                            test: 0,
                            currency: customerInfo.currency,
                            method: 'applepay'
                        },
                        applepay: {
                            token: {
                                paymentData: {
                                    header: {
                                        transactionId: transactionId,
                                        ephemeralPublicKey: ephemeralPublicKey,
                                        publicKeyHash: publicKeyHash,
                                    },
                                    data: data,
                                    signature: signature,
                                    version: version
                                },
                                transactionIdentifier: transactionIdentifier,
                                paymentMethod: {
                                    network: network,
                                    type: type,
                                    displayName: displayName,
                                }
                            }
                        },
                        customer: {
                            name: {
                                forenames: customerInfo.forenames,
                                surname: customerInfo.surname
                            },
                            email: customerInfo.email || 'test@avalift.com',
                            address: {
                                line1: "xxx",
                                country: customerInfo.country,
                                city: "xxx"
                            },
                            phone: customerInfo.phone
                        }
                    };

                    if (isValidUrl(process.env.TELR_JSON_URL)) {
                        // Call Telr API to Verify payment request
                        const result = await axios.post(process.env.TELR_JSON_URL, payload);

                        //console.log('payload', payload);

                        //console.log('result', result.data);

                        let telrInfo = {
                            request_meta_data: JSON.stringify(payload),
                            response_meta_data: JSON.stringify(result.data),
                            user_id: customer_id,
                            ride_id: ride_id,
                            payment_type: payment_type,
                            transaction_type: "Apple Pay Payment",
                        };

                    //console.log('telr info', telrInfo);

                        await paymentsDAO.createTelrResponseRecord(telrInfo);

                        //console.log('response status', result.data?.transaction?.status);
                        //console.log('response status error', result.data?.error?.message);

                        if (result.data?.transaction?.status === 'A') {
                            let notificationData;
                            notificationData = {
                                title: "Apple Pay Payment Status",
                                data: {
                                    ride_id: paymentOutput.rideItem.ride_id.toString(),
                                    requested_pickup_point: paymentOutput.rideItem.requested_pickup_point.toString(),
                                    requested_pickup_lat: paymentOutput.rideItem.requested_pickup.lat.toString(),
                                    requested_pickup_long: paymentOutput.rideItem.requested_pickup.long.toString(),
                                    customer_id: paymentOutput.rideItem.customer_id.toString(),
                                    estimated_amount: total_amount_to_be_paid.toString(),
                                    requested_drop_point: paymentOutput.rideItem.requested_drop_point.toString(),
                                    requested_drop_lat: paymentOutput.rideItem.requested_drop.lat.toString(),
                                    requested_drop_long: paymentOutput.rideItem.requested_drop.long.toString(),
                                    notification_type: "payment_initiation_status",
                                    recipient_type: "customer",
                                    recipient_id: paymentOutput.rideItem.customer_id.toString(),
                                    order_date: paymentOutput.rideItem.order_date.toString(),
                                },
                                notification_type: "payment_initiation_status",
                                recipient_type: "customer",
                                recipient_id: paymentOutput.rideItem.customer_id.toString(),
                            };

                            //insert into payment table

                            let paymentInfo = {};
                            paymentInfo = {
                                payment_type_id: paymentOutput.payment_type_method.id,
                                paymentMethod: payment_type,
                                method: '',
                                currency: process.env.CURRENCY_CODE,
                                amount: estimated_total_amount,
                                custRef: '',
                                cartidRef: customerInfo.cartidRef,
                                description: 'Apple Pay Payment',
                                order_ref: '',
                                is_paid: true,
                                user_id: customer_id,
                                order_url: '',
                                fore_names: paymentOutput.customer.first_name,
                                sur_name: paymentOutput.customer.last_name,
                                country: paymentOutput.customer.country_code,
                                phone: paymentOutput.customer.mobile_number,
                                transaction_ref: result.data?.transaction?.ref,
                                ride_id,
                                status_log_details: paymentOutput.rideItem.status_log,
                                device_id: paymentOutput.customer.device_id,
                                notificationData,
                                //base_fare,
                                discount_amount,
                                total_amount_to_be_paid,
                                chauffeur_id: paymentOutput.rideItem.chauffeur_id || chauffeur_id,
                                //status_id: paymentOutput.cashPStatusCode.id,
                                payment_details: paymentOutput.rideItem.paymentDetails,
                                c_r_c_status_name, //Review-Pending
                                c_r_p_status_name, //Payment Initiated
                                wallet_balance_amount,
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
                                authorisedStatusCode: paymentOutput.cardAuthorisedStatusCode.id,
                                metadata: result?.remote,
                                c_a_c_status_name,
                                final_result,
                                tip_amount,
                                tip_added
                            };
                            //console.log('cash payment info', paymentInfo);
                            const customerApplePayPaymentResponse = await paymentsDAO.createCustomerApplePayPaymentRecord(paymentInfo);
                            //paymentOutput = {};
                            if (customerApplePayPaymentResponse && customerApplePayPaymentResponse.walletOutput && customerApplePayPaymentResponse.walletOutput.success) {
                                paymentOutput = {};
                                paymentOutput.is_paid = true;
                                paymentOutput.paymentMethod = payment_type;
                                paymentOutput.error = '';
                                paymentOutput.success = true;
                            } else {
                                paymentOutput = {};
                                paymentOutput.is_paid = false;
                                paymentOutput.paymentMethod = payment_type;
                                paymentOutput.success = false;
                            }
                        } else {
                            paymentOutput = {};
                            paymentOutput.is_paid = false;
                            paymentOutput.paymentMethod = payment_type;
                            paymentOutput.success = false;
                            paymentOutput.error = result.data?.error?.message;
                        }
                    } else {
                        paymentOutput = {};
                        paymentOutput.is_paid = false;
                        paymentOutput.paymentMethod = payment_type;
                        paymentOutput.error = "Invalid URL for Telr API.";
                        paymentOutput.success = false;
                        return paymentOutput;
                    }

                }
                else {
                    paymentOutput = {};
                    paymentOutput.is_paid = false;
                    paymentOutput.paymentMethod = payment_type;
                    paymentOutput.error = "Calculated Ride Amount is incorrect";
                    paymentOutput.success = false;
                }
                return paymentOutput;
            } else {
                paymentOutput = {};
                paymentOutput.is_paid = false;
                paymentOutput.paymentMethod = payment_type;
                paymentOutput.error = paymentOutput.error;
                paymentOutput.success = false;
                return paymentOutput;
            }
        }


    } catch (error) {
        //console.log('customer apple pay payment process error -', error);
        await addServerLog({
            log_level: "ERROR",
            service_name: "customerApplePayProcess",
            error_message: `customerApplePayProcess error - ${error.message}.`
        });
        throw error;
    }
};

const getChauffeurHandOverData = async (userId, start_date, end_date) => {
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

        const output = await paymentsDAO.getChauffeurHandOverDetailsById(userId, start_date, end_date);

        let trans_info = [];

        await Promise.all(
            output.map(async (trans) => {

                const roleId = trans['PD-User'].role_id;
                const roleName = await paymentsDAO.findRoleNameById(roleId);
                let tranInfo = {
                    pd_transaction_date: trans.pd_transaction_date,
                    hand_over_amount: trans.hand_over_amount,
                    user: trans['User'],
                    pd_user: trans['PD-User'],
                    pd_role_id: trans['PD-User'].role_id,
                    role_name: roleName.name
                };
                trans_info.push(tranInfo);
            })
        );
        //console.log('tt', trans_info);
        const chaufferWallet = await paymentsDAO.getChaufferWalletLogRec(userId);

        return {
            success: true,
            message: "Chauffeur Hand Over details fetched successfully",
            data:
            {
                trans_info,
                chaufferWallet
            }
        }
    } catch (error) {
        //console.log(error);
        await addServerLog({
            log_level: "ERROR",
            service_name: "getChauffeurHandOverData",
            error_message: `getChauffeurHandOverData error - ${error.message}.`
        });
        return {
            success: false,
            message: "Error while fetching Wallet details.",
            error: "Error while fetching Wallet details.",
        }
    }
}

const getPDHandOverData = async (userId, start_date, end_date) => {
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

        const output = await paymentsDAO.getPDHandOverDetailsById(userId, start_date, end_date);

        let trans_info = [];

        await Promise.all(
            output.map(async (trans) => {

                const roleId = trans['Hand-Over-User'].role_id;
                const roleName = await paymentsDAO.findRoleNameById(roleId);
                let tranInfo = {
                    hand_over_transaction_date: trans.pd_transaction_date,
                    hand_over_amount: trans.hand_over_amount,
                    user: trans['User'],
                    hand_over_user: trans['Hand-Over-User'],
                    hand_over_user_role_id: trans['Hand-Over-User'].role_id,
                    role_name: roleName.name
                };
                trans_info.push(tranInfo);
            })
        );
        //console.log('tt', trans_info);
        const pdWallet = await paymentsDAO.getPDWalletLogRec(userId);

        return {
            success: true,
            message: "PD Hand Over details fetched successfully",
            data:
            {
                trans_info,
                pdWallet
            }
        }
    } catch (error) {
        //console.log(error);
        await addServerLog({
            log_level: "ERROR",
            service_name: "getPDHandOverData",
            error_message: `getPDHandOverData error - ${error.message}.`
        });
        return {
            success: false,
            message: "Error while fetching Wallet details.",
            error: "Error while fetching Wallet details."
        }
    }
}


function isValidUrl(urlString) {
    try {
        new URL(urlString);
        return true;
    } catch (error) {
        return false;
    }

}

const getCouponUsageSummary = async (start_date, end_date, page, limit) => {
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

        const results = await paymentsDAO.getCouponUsageDetails(start_date, end_date, page, limit);

        if (!results || results.length === 0) {
            return {
                success: false,
                message: "No coupon usage details found for the given date range.",
                data: []
            }
        }

        return {
            success: true,
            message: "Coupon Usage details fetched successfully",
            data: results
        }

    } catch (error) {
        await addServerLog({
            log_level: "ERROR",
            service_name: "getCouponUsageSummary",
            error_message: `getCouponUsageSummary error - ${error.message}.`
        });
        throw error;
    }
}

const getCouponWiseUsageDetails = async (start_date, end_date, page, limit, coupon_id) => {
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

        const results = await paymentsDAO.getCouponWiseUsageDetails(start_date, end_date, page, limit, coupon_id);

        if (!results || results.length === 0) {
            return {
                success: false,
                message: "No coupon wise usage details found for the given date range.",
                data: []
            }
        }

        return {
            success: true,
            message: "Coupon Wise Usage details fetched successfully",
            data: results
        }

    } catch (error) {
        await addServerLog({
            log_level: "ERROR",
            service_name: "getCouponWiseUsageDetails",
            error_message: `getCouponWiseUsageDetails error - ${error.message}.`
        });
        throw error;
    }
}

const removeUserCardById = async (user_id, slug_id) => {
    try {
        const [affectedRows] = await paymentsDAO.deleteUserCardById(
            user_id,
            slug_id
        );

        if (affectedRows === 0) {
            throw new Error('Card not found or already inactive');
        }

        return await paymentsDAO.findCardDetailsByUser(user_id);
    } catch (error) {
        await addServerLog({
            log_level: "ERROR",
            service_name: "removeUserCardById",
            error_message: `removeUserCardById error - ${error.message}.`
        });
        throw error;
    }
};



module.exports = {
    verifyPaymentProcess,
    executeVerifyPaymentSuccess,
    getUserCardDetails,
    salePaymentProcess,
    getPaymentTypes,
    createCashPayment,
    getRidesByChauffeurForPayment,
    getRidePaymentStatus,
    getExpenseDetailsByUser,
    walletTopupProcess,
    createWalletPayment,
    getWalletDetailsByUser,
    cancelRideWalletUpdate,
    createCustomerWallet,
    sendSms,
    createCorporateWalletPayment,
    createCorporateCustomerWallet,
    createPaymentTypes,
    getChauffeurWalletDetailsByUser,
    createChauffeurWallet,
    getCashWalletDetailsByChauffer,
    chaufferCashHandOverUpdate,
    pdCashHandOverUpdate,
    getPDUsersList,
    getCashWalletDetailsByPD,
    getAdminUsersList,
    customerApplePayProcess,
    getChauffeurHandOverData,
    getPDHandOverData,
    getCouponUsageSummary,
    getCouponWiseUsageDetails,
    orgPaymentByRidesUpdate,
    removeUserCardById
}
