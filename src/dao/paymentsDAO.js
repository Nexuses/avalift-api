require('dotenv').config();
const { User, SavedCards, Status, PaymentType, Payments, CustomerWalletLog, CustomerWallet, ChauffeurWallet, ChauffeurWalletLog, CouponUsage, Role, PDWallet, PDWalletLog, AdminWallet, AdminWalletLog, TelrPaymentLogs, CouponMaster, Sequelize, sequelize, ChauffeurTipWallet, ChauffeurTipWalletLog } = require('../dto');
const { Op, fn, col, where, cast, literal } = require('sequelize');
const ddbDocClient = require('./ddbClient');
const { PutCommand, UpdateCommand, QueryCommand, GetCommand } = require("@aws-sdk/lib-dynamodb");
const { addServerLog } = require('../services/serverLogsService');
const PDWalletLogs = require('../dto/PDWalletLogs');
const { raw, meta, or, id } = require('../validators/invoiceValidator');
const { end } = require('pdfkit');

module.exports = {

    findUserById: async (user_id) => {
        try {
            console.log('findUserById input', user_id);
            return await User.findOne({
                where: { id: user_id },
            });
        } catch (error) {
            await addServerLog({
                log_level: "ERROR",
                service_name: "findUserById",
                error_message: `findUserById DAO error - ${error.message}.`
            });
        }

    },
    findPaymentByUserAndTransaction: async (user_id, slug_id) => {
        try {
            console.log('findPaymentByUserAndTransaction input', user_id, slug_id);
            return await SavedCards.findOne({
                where: { user_id, slug_id },
            });
        } catch (error) {
            await addServerLog({
                log_level: "ERROR",
                service_name: "findPaymentByUserAndTransaction",
                error_message: `findPaymentByUserAndTransaction DAO error - ${error.message}.`
            });
            throw error;
        }

    },
    findPaymentByUserAndRide: async (user_id, ride_id) => {
        try {
            // console.log('findPaymentByUserAndRide input', user_id, ride_id);
            return await Payments.findOne({
                where: { user_id, ride_id },
                include: [{
                    model: PaymentType,
                    attributes: ['name']
                },
                {
                    model: Status,
                    attributes: ['name']
                }],
            });
        } catch (error) {
            await addServerLog({
                log_level: "ERROR",
                service_name: "findPaymentByUserAndRide",
                error_message: `findPaymentByUserAndRide DAO error - ${error.message}.`
            });
        }

    },

    createPayment: async (orderInfo) => {
        try {
            console.log('createPayment', orderInfo);

            const newPayment = await Payments.create({
                payment_type_id: orderInfo.payment_type_id,
                method: orderInfo.method,
                currency: orderInfo.currency,
                amount: orderInfo.amount,
                cust_ref: orderInfo.custRef,
                cart_id_ref: orderInfo.cartidRef,
                description: orderInfo.description,
                order_ref: orderInfo.order_ref,
                order_url: orderInfo.order_url,
                is_paid: orderInfo.is_paid,
                outstanding_amt: 0,
                meta_data: orderInfo.metadata,
                status_id: orderInfo.status_id,
                user_id: orderInfo.user_id,
                transaction_ref: '',
                ride_id: orderInfo.ride_id,
                coupon_id: null,
                discount_amount: 0,
                amount_to_be_paid: 0,
                tip_amount: 0,
                chauffeur_id: orderInfo.chauffeur_id,
                payment_status_id: orderInfo.wallet_credit_status_id,
                base_fare: 0,
                rate_type: '',
                rates: 0,
                mandatory_charges: 0,
                other_charges: 0,
                is_coupon_applied: false,
                vat: 0,
                is_invoice_created: false,
                ride_minutes: 0,
                total_after_discount: 0,
                is_paid: false,
            });
            return newPayment.id;
        } catch (error) {
            console.log(error);
            await addServerLog({
                log_level: "ERROR",
                service_name: "createPayment",
                error_message: `createPayment DAO error - ${error.message}.`
            });
        }


    },
    createSavedCards: async (cardInfo) => {
        try {
            console.log('createSavedCards', cardInfo);
            return await SavedCards.create({
                user_id: cardInfo.user_id,
                name: cardInfo.name,
                logo: cardInfo.logo,
                slug_id: cardInfo.slug_id,
                is_active: cardInfo.is_active,
                status_id: cardInfo.status_id,
                is_default: cardInfo.is_default,
                meta_data: cardInfo.metadata,
                email: cardInfo.email,
                card_bin: cardInfo.card_bin,
                card_end: cardInfo.card_end,
                pay_method: cardInfo.pay_method,
            });
        } catch (error) {
            console.log('createsavedcards dao', error);
            await addServerLog({
                log_level: "ERROR",
                service_name: "createSavedCards",
                error_message: `createSavedCards DAO error - ${error.message}.`
            });
        }

    },
    findOrderByUserAndRef: async (user_id, orderRef) => {
        try {
            console.log('findOrderByUserAndRef input', user_id, orderRef);
            return await Payments.findOne({
                where: { order_ref: orderRef, user_id },
                attributes: ['id']
            });
        } catch (error) {
            await addServerLog({
                log_level: "ERROR",
                service_name: "findOrderByUserAndRef",
                error_message: `findOrderByUserAndRef DAO error - ${error.message}.`
            });
        }

    },
    updatePaymentTransactionDetail: async (transactionRef, orderRef, status_id, card_verified_status_id) => {
        try {
            console.log('updatePaymentTransactionDetail input', transactionRef, orderRef, status_id, card_verified_status_id);
            return await Payments.update(
                {
                    transaction_ref: transactionRef,
                    status_id: status_id,
                    payment_status_id: card_verified_status_id,
                },
                { where: { order_ref: orderRef } });
        } catch (error) {
            await addServerLog({
                log_level: "ERROR",
                service_name: "updatePaymentTransactionDetail",
                error_message: `updatePaymentTransactionDetail DAO error - ${error.message}.`
            });
        }

    },

    findStatusName: async (name) => {
        try {
            // console.log('findStatusName input', name);
            const statusName = name.toLowerCase();
            return await Status.findOne({
                where: Sequelize.where(
                    Sequelize.fn('LOWER', Sequelize.col('name')),
                    statusName
                ),
                attributes: ['id']
            });
        } catch (error) {
            await addServerLog({
                log_level: "ERROR",
                service_name: "findStatusName",
                error_message: `findStatusName DAO error - ${error.message}.`
            });
        }

    },
    findUserByOrderRef: async (order_ref) => {
        try {
            console.log('findUserByOrderRef input', order_ref);
            return await Payments.findOne({
                where: { order_ref },
                attributes: ['user_id']
            });
        } catch (error) {
            await addServerLog({
                log_level: "ERROR",
                service_name: "findUserByOrderRef",
                error_message: `findUserByOrderRef DAO error - ${error.message}.`
            });
        }

    },

    findCardDetailsByUser: async (customer_id) => {
        try {
            //console.log('findCardDetailsByUser input', customer_id);
            return await SavedCards.findAll({
                where: { 
                    user_id: customer_id,
                    is_active: true
                 },
                attributes: ['slug_id', 'name', 'logo', 'card_bin', 'card_end', 'pay_method'],
            });
        } catch (error) {
            await addServerLog({
                log_level: "ERROR",
                service_name: "findCardDetailsByUser",
                error_message: `findCardDetailsByUser DAO error - ${error.message}.`
            });
        }

    },

    findPaymentMethodByFirstLast: async (user_id, card_bin, card_end) => {
        try {
            return await SavedCards.findOne({
                where: { user_id, card_bin, card_end },
                attributes: ['id'],
            });
        } catch (error) {
            await addServerLog({
                log_level: "ERROR",
                service_name: "findPaymentMethodByFirstLast",
                error_message: `findPaymentMethodByFirstLast DAO error - ${error.message}.`
            });
        }

    },
    getRideByCustomer: async (PK, SK) => {

        console.log('getRideByCustomer input', SK, PK);
        const params = {
            TableName: 'Rides',
            Key: {
                PK,
                SK,
            },
        };
        let dmoResult = {};
        try {
            const command = new GetCommand(params);
            const response = await ddbDocClient.send(command);
            dmoResult.success = true;
            dmoResult.error = '';
            dmoResult.item = response.Item;
            return {
                dmoRideOutput: dmoResult,
            }
        } catch (error) {
            await addServerLog({
                log_level: "ERROR",
                service_name: "getRideByCustomer",
                error_message: `getRideByCustomer DAO error - ${error.message}.`
            });
            let error_description = '';
            if (error.name === "ConditionalCheckFailedException") {
                error_description = "Condition failed: The item does not meet the required condition.";
            } else if (error.name === "ResourceNotFoundException") {
                error_description = "Table or item not found.";
            } else if (error.name === "ProvisionedThroughputExceededException") {
                error_description = "Throughput limit exceeded. Consider increasing capacity.";
            } else if (error.name === "ValidationException") {
                error_description = "Validation error. Check your update expression.";
            } else {
                error_description = error;
            }

            dmoResult.success = false;
            dmoResult.error_code = 500;
            dmoResult.error = error_description;
            return {
                dmoRideOutput: dmoResult,
            }
        }
    },
    getPaymentTypeMethods: async (is_active, for_display) => {
        try {
            console.log('getPaymentTypeMethod input', is_active, for_display);
            return await PaymentType.findAll({
                where: { is_active, for_display: for_display },
                attributes: ['id', 'name', 'is_active'],
                order: [['name', 'ASC']]
            });
        } catch (error) {
            await addServerLog({
                log_level: "ERROR",
                service_name: "getPaymentTypeMethod",
                error_message: `getPaymentTypeMethod DAO error - ${error.message}.`
            });
        }

    },
    getPaymentTypeMethodByName: async (is_active, for_display, name) => {
        try {
            //console.log('getPaymentTypeMethodByName input', is_active, for_display, name);
            const paymentTypeMethodName = name.toLowerCase();
            const paymentType = await PaymentType.findOne({
                where:
                {
                    is_active,
                    for_display,
                    name: {
                        [Op.iLike]: `%${paymentTypeMethodName}%`
                    }
                },
                attributes: ['id', 'name', 'is_active']
            });
            console.log('getPaymentTypeMethodByName output', paymentType);
            return paymentType;
        } catch (error) {
            await addServerLog({
                log_level: "ERROR",
                service_name: "getPaymentTypeMethodByName",
                error_message: `getPaymentTypeMethodByName DAO error - ${error.message}.`
            });
            throw error;
        }

    },

    getChauffeurRideDetails: async (chauffeur_id) => {
        try {
            const params = {
                TableName: "Rides",
                IndexName: "chauffeur_id-index", // Use the GSI
                KeyConditionExpression: "chauffeur_id = :user_id",
                FilterExpression: "#status IN (:completed)",
                ExpressionAttributeNames: {
                    "#status": "status",
                    //"#order_date": "order_date"
                },
                ExpressionAttributeValues: {
                    ":user_id": chauffeur_id,
                    ":completed": "Completed",
                    //":todayDate": todayDate
                },
            };
            const command = new QueryCommand(params);
            const response = await ddbDocClient.send(command);

            return response;
        } catch (error) {
            await addServerLog({
                log_level: "ERROR",
                service_name: "getChauffeurRideDetails",
                error_message: `getChauffeurRideDetails DAO error - ${error.message}.`
            });
            throw new Error("Error fetching chauffeur ride details.");
        }
    },
    findPaymentByUser: async (user_id) => {
        try {
            //console.log('findPaymentByUser input', user_id);
            return await Payments.findAll({
                where: { user_id },
                include: [{
                    model: PaymentType,
                    attributes: ['name']
                },
                {
                    model: Status,
                    attributes: ['name']
                }],
                attributes: { exclude: ['createdAt', 'updatedAt', 'id', 'coupon_id', 'method', 'order_ref', 'order_url', 'description', 'meta_data'] },
            });
        } catch (error) {
            await addServerLog({
                log_level: "ERROR",
                service_name: "findPaymentByUser",
                error_message: `findPaymentByUser DAO error - ${error.message}.`
            });
        }

    },

    findPaymentsDetailsByRideIds: async (rideIds, payment_type_method_id) => {
        try {

            //get only cash transaction type 
            let total_earnings = 0.0;
            let total_rides = 0;
            for (const rideId of rideIds) {
                const paymentOutput = await Payments.findOne({
                    where: {
                        ride_id: rideId,
                        payment_type_id: payment_type_method_id
                    },
                    attributes: ['amount_to_be_paid', 'payment_type_id']
                });

                if (paymentOutput && paymentOutput.payment_type_id === payment_type_method_id) {
                    total_rides += 1;
                    total_earnings += parseFloat(paymentOutput.amount_to_be_paid);
                }

                const walletOutput = await CustomerWalletLog.findOne({
                    where: {
                        ride_id: rideId,
                        payment_type_id: payment_type_method_id
                    },
                    attributes: ['amount_to_be_paid', 'adjusted_ride_amount', 'payment_type_id']
                });
                //console.log('w', walletOutput && walletOutput.amount_to_be_paid);
                if (walletOutput && walletOutput.payment_type_id === payment_type_method_id) {
                    total_rides += 1;
                    total_earnings += parseFloat(walletOutput.amount_to_be_paid);
                }
            }

            return {
                total_earnings: total_earnings.toFixed(2),
                total_rides
            };
        } catch (error) {
            await addServerLog({
                log_level: "ERROR",
                service_name: "findPaymentsDetailsByRideIds",
                error_message: `findPaymentsDetailsByRideIds DAO error - ${error.message}.`
            });
        }

    },

    createWalletRecord: async (orderInfo, walletInfo) => {

        // console.log('cretaeWalletRecord input', orderInfo, walletInfo);
        const wallett = await sequelize.transaction();
        //const todayDate = new Date().toISOString().split('T')[0];
        try {
            const userPaymentRec = await CustomerWallet.findOne({
                where: {
                    user_id: walletInfo.user_id,
                    //transaction_date: todayDate //not needed
                },
            });

            let existing_wallet_balance = 0.0;
            if (userPaymentRec) {
                existing_wallet_balance = parseFloat(userPaymentRec.wallet_balance) + parseFloat(walletInfo.top_up_amount);
                await CustomerWallet.update(
                    { wallet_balance: parseFloat(userPaymentRec.wallet_balance) + parseFloat(walletInfo.top_up_amount), },
                    {
                        where: {
                            user_id: walletInfo.user_id,
                        }
                    }, { wallett });
            } else {
                existing_wallet_balance = parseFloat(walletInfo.top_up_amount);
                await CustomerWallet.create({
                    user_id: walletInfo.user_id,
                    wallet_balance: parseFloat(walletInfo.top_up_amount)
                }, { wallett });
            }

            const newWalletRec = await CustomerWalletLog.create({
                payment_type_id: walletInfo.payment_type_id, //
                top_up_amount: parseFloat(walletInfo.top_up_amount),
                transaction_type_id: walletInfo.transaction_type_id,
                wallet_balance: parseFloat(existing_wallet_balance),
                transaction_reference: walletInfo.transaction_reference,
                transaction_date: new Date().toISOString(),
                user_id: walletInfo.user_id,
                ride_id: '',
                is_paid: null,
                payment_status_id: orderInfo.wallet_credit_status_id,
                coupon_id: null,
                is_coupon_applied: false,
                base_fare: 0,
                rates: 0,
                rate_type: '',
                mandatory_charges: 0,
                other_charges: 0,
                vat: 0,
                is_invoice_created: false,
                discount_amount: 0,
                ride_minutes: 0,
                meta_data: orderInfo.metadata
            }, { wallett });

            const newWalletBalanceRec = await CustomerWallet.findOne({
                where: {
                    user_id: walletInfo.user_id,
                    //transaction_date: todayDate //not needed
                },
            });

            await wallett.commit();
            return {
                success: true,
                wallet_balance: newWalletBalanceRec.wallet_balance,
            }
        } catch (error) {
            //console.log('wallet topup dao error -', error.message);
            await addServerLog({
                log_level: "ERROR",
                service_name: "createWalletRecord",
                error_message: `createWalletRecord DAO error - ${error.message}.`
            });
            if (wallett.finished !== "commit") {
                await wallett.rollback();
            }
            throw error;
        }
    },

    findRidePaymentStatus: async (user_id, ride_id) => {
        try {
            console.log('findRidePaymentStatus input', user_id, ride_id);
            return await Payments.findOne({
                where: {
                    user_id,
                    ride_id,
                    is_paid: true
                },
            });
        } catch (error) {
            await addServerLog({
                log_level: "ERROR",
                service_name: "findRidePaymentStatus",
                error_message: `findRidePaymentStatus DAO error - ${error.message}.`
            });
        }

    },

    findUserWallet: async (user_id, is_active) => {
        try {
            console.log('findUserWallet input', user_id, is_active);
            return await CustomerWallet.findOne({
                where: {
                    user_id,
                    //is_active
                },
            });
        } catch (error) {
            await addServerLog({
                log_level: "ERROR",
                service_name: "findUserWallet",
                error_message: `findUserWallet DAO error - ${error.message}.`
            });
        }

    },

    createWalletPaymentRecord: async (orderInfo) => {

        console.log('createWalletPaymentRecord input', orderInfo);
        const transaction = await sequelize.transaction();
        let dmoResult = {};
        try {
            const userPaymentRec = await CustomerWallet.findOne({
                where: {
                    user_id: orderInfo.user_id,
                },
            });

            if (!userPaymentRec) {
                dmoResult.success = false;
                dmoResult.error = 'Please Top up Customer Wallet Balance';
                return {
                    walletOutput: dmoResult
                }
            }

            //status log update
            orderInfo.status_log_details.push({
                datetime: new Date().toISOString(),
                status: `${orderInfo.c_r_c_status_name}`,
            });

            let payment_details = {
                card: null,
                payment_method: "Wallet"
            };
            orderInfo.payment_details = payment_details;

            let adjusted_amount = 0.0;
            let total_amount_to_be_paid = 0.0;
            let prev_wallet_balance = userPaymentRec.wallet_balance;

            //if (userPaymentRec.wallet_balance >= orderInfo.amount) {
            if (userPaymentRec.wallet_balance > 0) {
                existing_wallet_balance = userPaymentRec.wallet_balance - orderInfo.total_amount_to_be_paid;
                total_amount_to_be_paid = orderInfo.total_amount_to_be_paid;

                //await CustomerWallet.update(
                await userPaymentRec.update(
                    { wallet_balance: existing_wallet_balance, },
                    {
                        where: {
                            user_id: orderInfo.user_id,
                        }
                    }, { transaction });


                const newWalletRec = await CustomerWalletLog.create({
                    transaction_type_id: orderInfo.w_d_transaction_type_id,
                    payment_type_id: orderInfo.payment_type_id,
                    wallet_balance: existing_wallet_balance,
                    ride_amount: orderInfo.amount,
                    transaction_date: new Date().toISOString(),
                    user_id: orderInfo.user_id,
                    ride_id: orderInfo.ride_id,
                    adjusted_ride_amount: adjusted_amount,
                    amount_to_be_paid: total_amount_to_be_paid,
                    is_paid: true,
                    chauffeur_id: orderInfo.chauffeur_id,
                    payment_status_id: orderInfo.payment_completed_status_id,
                    customer_wallet_id: userPaymentRec.id,
                    coupon_id: orderInfo.coupon_ids,
                    discount_amount: orderInfo.discount_amount,
                    is_coupon_applied: orderInfo.is_coupon_applied,
                    base_fare: orderInfo.base_fare,
                    rates: orderInfo.rates,
                    rate_type: orderInfo.rate_type,
                    mandatory_charges: orderInfo.mandatory_charges,
                    other_charges: orderInfo.other_charges,
                    vat: orderInfo.vat,
                    is_invoice_created: orderInfo.is_invoice_created,
                    ride_minutes: orderInfo.estimated_time_in_minutes,
                    total_after_discount: orderInfo.total_after_discount,
                    final_price_calculation: orderInfo.final_result
                }, { transaction });

                //coupon usage 
                if (orderInfo.is_coupon_applied && orderInfo.coupon_ids !== null) {
                    console.log('coupon is not null');
                    const newCouponUsageRec = await CouponUsage.create({
                        coupon_id: orderInfo.coupon_ids,
                        customer_id: orderInfo.user_id
                    }, { transaction });
                } else {
                    console.log('coupon is null');
                }

                // tip wallet update
                if (orderInfo.tip_added && orderInfo.tip_amount > 0) {
                    console.log('adding tip to chauffeur wallet');
                    const chauffeurId = orderInfo.chauffeur_id;
                    const amount = parseFloat(orderInfo.tip_amount);

                    // 1. Fetch existing tip wallet or create new
                    let tipWallet = await ChauffeurTipWallet.findOne({
                        where: { chauffeur_id: chauffeurId },
                        transaction
                    });

                    // If not exists, create new
                    if (!tipWallet) {
                        tipWallet = await ChauffeurTipWallet.create(
                            {
                                chauffeur_id: chauffeurId,
                                balance: 0.0
                            },
                            { transaction }
                        );
                    }

                    // 2. Update wallet balance
                    tipWallet.balance = parseFloat(tipWallet.balance) + amount;
                    await tipWallet.save({ transaction });

                    console.log('tipWallet after update/create', tipWallet);

                    // 3. Insert Tip Wallet Log
                    await ChauffeurTipWalletLog.create(
                        {
                            chauffeur_tip_wallet_id: tipWallet.id,
                            chauffeur_id: chauffeurId,
                            amount: amount,
                            previous_balance: parseFloat(tipWallet.balance) - amount,
                            current_balance: parseFloat(tipWallet.balance),
                            transaction_type: "CREDIT",
                            status: "SUCCESS",
                            ride_id: orderInfo.ride_id ?? null,
                            description: `Tip added for ride ${orderInfo.ride_id}`
                        },
                        { transaction }
                    );
                    console.log('tip added to chauffeur wallet');

                }

                const PK = `${orderInfo.user_id}`;
                const SK = `#${orderInfo.ride_id}`;
                const params = {
                    TableName: "Rides",
                    Key: { PK, SK }, // identify key based row
                    UpdateExpression: `SET #attrName = :statusVal,
                status_log = :statusLogVal,
                paymentDetails = :paymentDetailsVal`,
                    ConditionExpression: '#attrName = :expectedStatusVal',
                    ExpressionAttributeNames: {
                        "#attrName": "status"
                    },
                    ExpressionAttributeValues: {
                        ":statusVal": orderInfo.c_r_c_status_name,
                        ":expectedStatusVal": orderInfo.c_r_p_status_name,
                        ":statusLogVal": orderInfo.status_log_details,
                        ":paymentDetailsVal": orderInfo.payment_details
                    },
                    ReturnValues: "UPDATED_NEW"
                };
                const command = new UpdateCommand(params);
                const response = await ddbDocClient.send(command);
                if (response.$metadata.httpStatusCode === 200) {
                    dmoResult.success = true;
                    dmoResult.payment_status = response.Attributes?.status;
                    dmoResult.balance = newWalletRec.wallet_balance;
                    dmoResult.outstanding_balance = (newWalletRec.outstanding_balance ?? 0).toFixed(2);
                    dmoResult.ride_amount = newWalletRec.ride_amount;
                    dmoResult.adjusted_amount = adjusted_amount;
                    dmoResult.total_amount_to_be_paid = total_amount_to_be_paid.toFixed(2);
                    dmoResult.prev_wallet_balance = prev_wallet_balance;

                    await transaction.commit();
                } else {
                    if (transaction && transaction.finished !== "commit") {
                        await transaction.rollback();
                    }

                    dmoResult.success = false;
                    dmoResult.payment_status = response.Attributes?.status;
                    dmoResult.error_code = response.$metadata.httpStatusCode;
                    dmoResult.error = response.$metadata;
                }

                return {
                    walletOutput: dmoResult
                }
            } else {

                if (transaction && transaction.finished !== "commit") {
                    await transaction.rollback();
                }
                dmoResult.success = false;
                dmoResult.balance = userPaymentRec.wallet_balance;
                dmoResult.error = "Please top up the Wallet as the Balance is less than or equal to 0";
                return {
                    walletOutput: dmoResult
                }
            }
        } catch (error) {
            //console.log('wallet payment record dao error -', error.message);
            if (transaction && transaction.finished !== "commit" && transaction.finished !== "rollback") {
                await transaction.rollback();
            }
            await addServerLog({
                log_level: "ERROR",
                service_name: "createWalletPaymentRecord",
                error_message: `createWalletPaymentRecord DAO error - ${error.message}.`
            });

            let error_description = '';
            if (error.name === "ConditionalCheckFailedException") {
                error_description = "Condition failed: The item does not meet the required condition.";
            } else if (error.name === "ResourceNotFoundException") {
                error_description = "Table or item not found.";
            } else if (error.name === "ProvisionedThroughputExceededException") {
                error_description = "Throughput limit exceeded. Consider increasing capacity.";
            } else if (error.name === "ValidationException") {
                error_description = "Validation error. Check your update expression.";
            } else {
                error_description = error.message;
            }
            dmoResult.success = false;
            dmoResult.error_code = 500;
            dmoResult.error = error_description;
            return {
                walletOutput: dmoResult,
            }
        }
    },
    createSalePaymentRecord: async (orderInfo) => {
        //console.log('createSalePaymentRecord input', orderInfo);
        const transaction = await sequelize.transaction();
        let dmoResult = {};
        try {

            const userWalletRec = await CustomerWallet.findOne({
                where: { user_id: orderInfo.user_id }
            });

            orderInfo.status_log_details.push({
                datetime: new Date().toISOString(),
                status: `${orderInfo.c_r_c_status_name}`,
            });
            console.log('dao sale 1');
            let newPayment;
            if (orderInfo.wallet_balance_amount < 0) {
                await userWalletRec.update({ wallet_balance: 0.0 }, { transaction });
                console.log('dao sale 2');
                newPayment = await CustomerWalletLog.create({
                    transaction_type_id: orderInfo.cr_w_a_transaction_type_id,//
                    payment_type_id: orderInfo.payment_type_id,
                    wallet_balance: 0.0,
                    ride_amount: orderInfo.amount,
                    transaction_date: new Date().toISOString(),
                    user_id: orderInfo.user_id,
                    ride_id: orderInfo.ride_id,
                    adjusted_ride_amount: orderInfo.wallet_balance_amount,
                    amount_to_be_paid: orderInfo.total_amount_to_be_paid,
                    is_paid: true,
                    chauffeur_id: orderInfo.chauffeur_id,
                    payment_status_id: orderInfo.payment_completed_status_id,
                    coupon_id: orderInfo.coupon_ids,
                    is_coupon_applied: orderInfo.is_coupon_applied,
                    base_fare: orderInfo.base_fare,
                    rates: orderInfo.rates,
                    rate_type: orderInfo.rate_type,
                    mandatory_charges: orderInfo.mandatory_charges,
                    other_charges: orderInfo.other_charges,
                    vat: orderInfo.vat,
                    is_invoice_created: orderInfo.is_invoice_created,
                    discount_amount: orderInfo.discount_amount,
                    ride_minutes: orderInfo.estimated_time_in_minutes,
                    customer_wallet_id: userWalletRec.id,
                    total_after_discount: orderInfo.total_after_discount,
                    final_price_calculation: orderInfo.final_result,
                    meta_data: orderInfo.metadata
                }, { transaction });
            } else {
                console.log('dao sale 3');
                newPayment = await Payments.create({
                    payment_type_id: orderInfo.payment_type_id,
                    method: orderInfo.method,
                    currency: orderInfo.currency,
                    amount: orderInfo.amount,
                    cust_ref: orderInfo.custRef,
                    cart_id_ref: orderInfo.cartidRef,
                    description: orderInfo.description,
                    is_paid: true,
                    user_id: orderInfo.user_id,
                    meta_data: orderInfo.metadata,
                    ride_id: orderInfo.ride_id,
                    transaction_ref: orderInfo.transaction_ref,
                    status_id: orderInfo.status_code_id,
                    chauffeur_id: orderInfo.chauffeur_id,
                    amount_to_be_paid: orderInfo.total_amount_to_be_paid,
                    payment_status_id: orderInfo.payment_completed_status_id,
                    discount_amount: orderInfo.discount_amount,
                    coupon_id: orderInfo.coupon_ids,
                    is_coupon_applied: orderInfo.is_coupon_applied,
                    base_fare: orderInfo.base_fare,
                    rates: orderInfo.rates,
                    rate_type: orderInfo.rate_type,
                    mandatory_charges: orderInfo.mandatory_charges,
                    other_charges: orderInfo.other_charges,
                    vat: orderInfo.vat,
                    is_invoice_created: orderInfo.is_invoice_created,
                    ride_minutes: orderInfo.estimated_time_in_minutes,
                    total_after_discount: orderInfo.total_after_discount,
                    final_price_calculation: orderInfo.final_result,
                    tip_amount: orderInfo.tip_amount,
                }, { transaction });
            }

            dmoResult.cash_payment_id = newPayment.id;
            //coupon usage 
            if (orderInfo.is_coupon_applied && orderInfo.coupon_ids !== null) {
                console.log('coupon is not null');
                const newCouponUsageRec = await CouponUsage.create({
                    coupon_id: orderInfo.coupon_ids,
                    customer_id: orderInfo.user_id
                }, { transaction });
            } else {
                console.log('coupon is null');
            }
            // tip wallet update
            if (orderInfo.tip_added && orderInfo.tip_amount > 0) {
                console.log('adding tip to chauffeur wallet');
                const chauffeurId = orderInfo.chauffeur_id;
                const amount = parseFloat(orderInfo.tip_amount);

                // 1. Fetch existing tip wallet or create new
                let tipWallet = await ChauffeurTipWallet.findOne({
                    where: { chauffeur_id: chauffeurId },
                    transaction
                });

                // If not exists, create new
                if (!tipWallet) {
                    tipWallet = await ChauffeurTipWallet.create(
                        {
                            chauffeur_id: chauffeurId,
                            balance: 0.0
                        },
                        { transaction }
                    );
                }

                // 2. Update wallet balance
                tipWallet.balance = parseFloat(tipWallet.balance) + amount;
                await tipWallet.save({ transaction });

                console.log('tipWallet after update/create', tipWallet);

                // 3. Insert Tip Wallet Log
                await ChauffeurTipWalletLog.create(
                    {
                        chauffeur_tip_wallet_id: tipWallet.id,
                        chauffeur_id: chauffeurId,
                        amount: amount,
                        previous_balance: parseFloat(tipWallet.balance) - amount,
                        current_balance: parseFloat(tipWallet.balance),
                        transaction_type: "CREDIT",
                        status: "SUCCESS",
                        ride_id: orderInfo.ride_id ?? null,
                        description: `Tip added for ride ${orderInfo.ride_id}`
                    },
                    { transaction }
                );
                console.log('tip added to chauffeur wallet');

            }

            console.log('dao sale 4');
            const PK = `${orderInfo.user_id}`;
            const SK = `#${orderInfo.ride_id}`;

            let payment_details = {
                card: orderInfo.firstref,
                payment_method: "Card"

            };
            orderInfo.payment_details = payment_details;
            const params = {
                TableName: "Rides",
                Key: { PK, SK },
                UpdateExpression: `SET #attrName = :statusVal,
                status_log = :statusLogVal,
                paymentDetails = :paymentDetailsVal`,
                ConditionExpression: '#attrName = :expectedStatusVal',
                ExpressionAttributeNames: {
                    "#attrName": "status"
                },
                ExpressionAttributeValues: {
                    ":statusVal": orderInfo.c_r_c_status_name,
                    ":expectedStatusVal": orderInfo.c_r_p_status_name,
                    ":statusLogVal": orderInfo.status_log_details,
                    ":paymentDetailsVal": orderInfo.payment_details
                },
                ReturnValues: "UPDATED_NEW"
            };

            const command = new UpdateCommand(params);
            const response = await ddbDocClient.send(command);
            if (response.$metadata.httpStatusCode === 200) {
                console.log('dao sale 5');
                dmoResult.success = true;
                dmoResult.payment_status = response.Attributes?.status;

            } else {
                console.log('dao sale 6');
                dmoResult.success = false;
                dmoResult.payment_status = response.Attributes?.status;
                dmoResult.error_code = response.$metadata.httpStatusCode;
            }
            await transaction.commit();
            console.log('dao sale 7');
            return {
                salePaymentOutput: dmoResult
            }
        } catch (error) {
            console.log('sale payment record dao error -', error.message);
            if (transaction.finished !== "commit") {
                await transaction.rollback();
            }

            await addServerLog({
                log_level: "ERROR",
                service_name: "createSalePaymentRecord",
                error_message: `createSalePaymentRecord DAO error - ${error.message}.`
            });

            let error_description = '';
            if (error.name === "SequelizeUniqueConstraintError") {
                error_description = `${error.errors[0].message} for user id ${orderInfo.user_id} `;
            }
            if (error.name === "ConditionalCheckFailedException") {
                error_description = "Condition failed: The item does not meet the required condition.";
            } else if (error.name === "ResourceNotFoundException") {
                error_description = "Table or item not found.";
            } else if (error.name === "ProvisionedThroughputExceededException") {
                error_description = "Throughput limit exceeded. Consider increasing capacity.";
            } else if (error.name === "ValidationException") {
                error_description = "Validation error. Check your update expression.";
            } else {
                error_description = error.message;
            }
            dmoResult.success = false;
            dmoResult.error_code = 500;
            dmoResult.error = error_description;
            return {
                salePaymentOutput: dmoResult,
            }
        }
    },
    createCashPaymentRecord: async (orderInfo) => {
        console.log('createCashPaymentRecord input', orderInfo);
        const transaction = await sequelize.transaction();
        let transaction_dt = new Date().toISOString();
        let dmoResult = {};
        try {
            orderInfo.status_log_details.push({
                datetime: new Date().toISOString(),
                status: `${orderInfo.c_r_c_status_name} `,
            });
            let payment_details = {
                card: null,
                payment_method: "Cash"
            };
            orderInfo.payment_details = payment_details;
            let chauffeur_wa_id = 0;
            const todayDate = new Date().toISOString().split('T')[0];
            const chauffeurPaymentRec = await ChauffeurWallet.findOne({
                where: {
                    user_id: orderInfo.chauffeur_id,
                },
            });

            //add the cash ride amount to chauffer wallet account.
            let existing_wallet_balance = 0.0;

            if (chauffeurPaymentRec) {
                //chauffeur_wa_id = chauffeurPaymentRec.id;
                existing_wallet_balance = chauffeurPaymentRec.wallet_balance;
                await ChauffeurWallet.update(
                    {
                        wallet_balance: parseFloat(existing_wallet_balance) + parseFloat(orderInfo.total_amount_to_be_paid),
                        transaction_date: transaction_dt
                    },
                    {
                        where: {
                            user_id: orderInfo.chauffeur_id,
                        }
                    }, { transaction });

            } else {
                const cw = await ChauffeurWallet.create({
                    user_id: orderInfo.chauffeur_id,
                    wallet_balance: parseFloat(orderInfo.total_amount_to_be_paid),
                    transaction_date: transaction_dt
                }, { transaction });
            }

            const userWalletRec = await CustomerWallet.findOne({
                where: { user_id: orderInfo.user_id }
            });

            let newPayment;
            //update wallet-balance if negative balance is adjusted
            if (orderInfo.wallet_balance_amount < 0) {
                if (userWalletRec) {
                    userWalletRec.update({ wallet_balance: 0.0 }, { transaction });
                } else {
                    await CustomerWallet.create({
                        user_id: orderInfo.user_id,
                        wallet_balance: existing_wallet_balance
                    }, { transaction });

                }
                newPayment = await CustomerWalletLog.create({
                    transaction_type_id: orderInfo.c_w_a_transaction_type_id,//
                    payment_type_id: orderInfo.payment_type_id,
                    wallet_balance: 0.0,
                    ride_amount: orderInfo.amount,
                    transaction_date: new Date().toISOString(),
                    user_id: orderInfo.user_id,
                    ride_id: orderInfo.ride_id,
                    adjusted_ride_amount: orderInfo.wallet_balance_amount,
                    amount_to_be_paid: orderInfo.total_amount_to_be_paid,
                    is_paid: true,
                    chauffeur_id: orderInfo.chauffeur_id,
                    payment_status_id: orderInfo.payment_completed_status_id,
                    coupon_id: orderInfo.coupon_ids,
                    is_coupon_applied: orderInfo.is_coupon_applied,
                    base_fare: orderInfo.base_fare,
                    rates: orderInfo.rates,
                    rate_type: orderInfo.rate_type,
                    mandatory_charges: orderInfo.mandatory_charges,
                    other_charges: orderInfo.other_charges,
                    vat: orderInfo.vat,
                    is_invoice_created: orderInfo.is_invoice_created,
                    discount_amount: orderInfo.discount_amount,
                    ride_minutes: orderInfo.estimated_time_in_minutes,
                    customer_wallet_id: userWalletRec.id,
                    total_after_discount: orderInfo.total_after_discount,
                    final_price_calculation: orderInfo.final_result,
                }, { transaction });

            } else {
                newPayment = await Payments.create({
                    payment_type_id: orderInfo.payment_type_id,
                    method: orderInfo.method,
                    currency: orderInfo.currency,
                    amount: orderInfo.amount,
                    cust_ref: orderInfo.custRef,
                    cart_id_ref: orderInfo.cartidRef,
                    description: orderInfo.description,
                    order_ref: orderInfo.order_ref,
                    is_paid: orderInfo.is_paid,
                    user_id: orderInfo.user_id,
                    meta_data: orderInfo.metadata,
                    order_url: orderInfo.order_url,
                    ride_id: orderInfo.ride_id,
                    chauffeur_id: orderInfo.chauffeur_id,
                    discount_amount: orderInfo.discount_amount,
                    amount_to_be_paid: orderInfo.total_amount_to_be_paid,
                    payment_status_id: orderInfo.payment_completed_status_id,
                    coupon_id: orderInfo.coupon_ids,
                    is_coupon_applied: orderInfo.is_coupon_applied,
                    base_fare: orderInfo.base_fare,
                    rates: orderInfo.rates,
                    rate_type: orderInfo.rate_type,
                    mandatory_charges: orderInfo.mandatory_charges,
                    other_charges: orderInfo.other_charges,
                    vat: orderInfo.vat,
                    is_invoice_created: orderInfo.is_invoice_created,
                    ride_minutes: orderInfo.estimated_time_in_minutes,
                    total_after_discount: orderInfo.total_after_discount,
                    final_price_calculation: orderInfo.final_result,
                    tip_amount: orderInfo.tip_amount,
                }, { transaction });
            }
            dmoResult.cash_payment_id = newPayment.id;

            //coupon usage 
            if (orderInfo.is_coupon_applied && orderInfo.coupon_ids !== null) {
                // console.log('coupon is not null');
                const newCouponUsageRec = await CouponUsage.create({
                    coupon_id: orderInfo.coupon_ids,
                    customer_id: orderInfo.user_id
                }, { transaction });
            } else {
                console.log('coupon is null');
            }
            console.log('before tip wallet update');
            // tip wallet update
            if (orderInfo.tip_added && orderInfo.tip_amount > 0) {
                console.log('adding tip to chauffeur wallet');
                    const amount = parseFloat(orderInfo.tip_amount);
                    const chauffeurId = orderInfo.chauffeur_id;
                    const transaction_dt = new Date();

                    // 1. Find wallet
                    let tipWallet = await ChauffeurTipWallet.findOne({
                        where: { chauffeur_id: chauffeurId },
                        transaction
                    });
                    console.log('tipWallet', tipWallet);

                    // 2. Update or create wallet
                    if (tipWallet) {  
                        await ChauffeurTipWallet.update(
                            {
                                balance: parseFloat(tipWallet.balance) + amount,
                                //transaction_date: transaction_dt
                            },
                            { 
                                where: { chauffeur_id: chauffeurId },
                                transaction 
                            }
                        );
                    } else {
                        tipWallet = await ChauffeurTipWallet.create(
                            {
                                chauffeur_id: chauffeurId,
                                balance: amount,
                                //transaction_date: transaction_dt
                            },
                            { transaction }
                        );
                    }

                    console.log('tipWallet after update/create', tipWallet);

                    // 3. Insert Tip Wallet Log
                    await ChauffeurTipWalletLog.create(
                        {
                            chauffeur_tip_wallet_id: tipWallet.id,
                            chauffeur_id: chauffeurId,
                            amount: amount,
                            previous_balance: parseFloat(tipWallet.balance),
                            current_balance: parseFloat(tipWallet.balance) + amount,
                            transaction_type: "CREDIT",
                            status: "SUCCESS",
                            ride_id: orderInfo.ride_id ?? null,
                            description: `Tip added for ride ${orderInfo.ride_id}`
                        },
                        { transaction }
                    );
                    console.log('tip added to chauffeur wallet');

                }


            const PK = `${orderInfo.user_id}`;
            const SK = `#${orderInfo.ride_id}`;
            const params = {
                TableName: "Rides",
                Key: { PK, SK },
                UpdateExpression: `SET #attrName = :statusVal,
                status_log = :statusLogVal,
                    paymentDetails = :paymentDetailsVal`,
                ConditionExpression: '#attrName = :expectedStatusVal',
                ExpressionAttributeNames: {
                    "#attrName": "status"
                },
                ExpressionAttributeValues: {
                    ":statusVal": orderInfo.c_r_c_status_name,
                    ":expectedStatusVal": orderInfo.c_r_p_status_name,
                    ":statusLogVal": orderInfo.status_log_details,
                    ":paymentDetailsVal": orderInfo.payment_details
                },
                ReturnValues: "UPDATED_NEW"
            };
            const command = new UpdateCommand(params);
            const response = await ddbDocClient.send(command);

            if (response.$metadata.httpStatusCode === 200) {
                dmoResult.success = true;
                dmoResult.payment_status = response.Attributes?.status;
                dmoResult.error = "";
                await transaction.commit();
            } else {
                if (transaction.finished !== "commit") {
                    await transaction.rollback();
                }
                dmoResult.success = false;
                dmoResult.payment_status = response.Attributes?.status;
                dmoResult.error_code = response.$metadata.httpStatusCode;
                dmoResult.error = "failed to update ride status";
            }

            return {
                cashOutput: dmoResult
            }
        } catch (error) {
            // console.log('cash payment record dao error -', error.message);
            await transaction.rollback();
            await addServerLog({
                log_level: "ERROR",
                service_name: "createCashPaymentRecord",
                error_message: `createCashPaymentRecord DAO error - ${error.message}.`
            });

            let error_description = '';
            if (error.name === "SequelizeUniqueConstraintError") {
                error_description = `${error.errors[0].message} for user id ${orderInfo.user_id} `;
            } else {
                error_description = error.message;
            }

            //error_description = error_description;
            dmoResult.success = false;
            dmoResult.error_code = 500;
            dmoResult.error = error_description;
            return {
                cashOutput: dmoResult,
            }
        }
    },

    findCustomerBalance: async (userInfo) => {
        try {
            //console.log('findCustomerBalance input', userInfo);
            const existingCustomerWalletRec = await CustomerWallet.findOne({
                where: {
                    user_id: userInfo.user_id,
                }
            });

            if (!existingCustomerWalletRec) {
                const newCustomerWallet = await CustomerWallet.create({
                    user_id: userInfo.user_id,
                    wallet_balance: 0
                });

                return newCustomerWallet;
            } else {
                return existingCustomerWalletRec;
            }
        } catch (error) {
            await addServerLog({
                log_level: "ERROR",
                service_name: "findCustomerBalance",
                error_message: `findCustomerBalance DAO error - ${error.message}.`
            });
        }

    },
    updateSavedCards: async (cardInfo) => {
        try {
            console.log('updateSavedCards input', cardInfo);
            return await SavedCards.update(
                { slug_id: cardInfo.slug_id,
                  meta_data: cardInfo.meta_data,
                  is_active: cardInfo.is_active,
                  logo: cardInfo.logo,
                },
                {
                    where: {
                        user_id: cardInfo.user_id,
                        card_bin: cardInfo.card_bin,
                        card_end: cardInfo.card_end,
                        //is_active: true
                    }
                });
        } catch (error) {
            await addServerLog({
                log_level: "ERROR",
                service_name: "updateSavedCards",
                error_message: `updateSavedCards DAO error - ${error.message}.`
            });
        }

    },

    findUserWallet: async (start_date, end_date, page = 1, limit = 10, search_string) => {
        try {
            // Wallet date filter
            const whereWallet = {};
            if (start_date && end_date) {
            whereWallet.createdAt = { [Op.between]: [start_date, end_date] };
            }

            // Search filter
            const hasSearch = !!(search_string && search_string.trim());
            const q = hasSearch ? search_string.trim() : null;

            const whereUser = hasSearch
            ? {
                [Op.or]: [
                    { first_name: { [Op.iLike]: `%${q}%` } },
                    { last_name: { [Op.iLike]: `%${q}%` } },
                    where(cast(col("User.id"), "text"), { [Op.iLike]: `%${q}%` }),
                ],
                }
            : undefined;

            const offset = (page - 1) * limit;

            const { rows, count } = await CustomerWallet.findAndCountAll({
            where: whereWallet,
            include: [
                {
                model: User,
                attributes: ["id", "first_name", "last_name"],
                where: whereUser,     
                required: hasSearch,   
                },
            ],
            attributes: ["user_id", "wallet_balance", "is_org", "createdAt"],
            order: [["createdAt", "DESC"]],
            limit,
            offset,
            distinct: true,
            });

            return {
            customerWalletRec: {
                totalRecords: count,
                totalPages: Math.ceil(count / limit),
                currentPage: page,
                perPage: limit,
                data: rows,
            },
            };
        } catch (error) {
            console.log(`findUserWallet dao error - ${error.message} `);
            await addServerLog({
            log_level: "ERROR",
            service_name: "findUserWallet",
            error_message: `findUserWallet DAO error - ${error.message}.`,
            });
        }
        },


    findUserWalletById: async (user_id) => {
        try {
            //console.log('findUserWalletById input', user_id);
            //get max createdAt per user
            const customerWalletLogRec = await CustomerWalletLog.findAll({
                where: {
                    user_id
                },
                include: [{
                    model: User,
                    attributes: ['first_name', 'last_name']
                },
                {
                    model: PaymentType,
                    attributes: ['name']
                },
                {
                    model: Status,
                    attributes: ['name']
                }
                ],
                attributes: { exclude: ['createdAt', 'updatedAt', 'id', 'coupon_id', 'payment_type_id', 'transaction_type_id'] },
                raw: true,
                order: [['transaction_date', 'DESC']]
            });

            const customerWalletRec = await CustomerWallet.findOne({
                where: {
                    user_id
                },
            });
            return {

                customerWalletLogRec,
                customerWalletRec
            };
        } catch (error) {
            await addServerLog({
                log_level: "ERROR",
                service_name: "findUserWalletById",
                error_message: `findUserWalletById DAO error - ${error.message}.`
            });
        }
    },
    createCanelRideUpdateWalletRecord: async (orderInfo) => {

        //console.log('createCancelRideUpdateWalletRecord input', orderInfo);
        const transaction = await sequelize.transaction();
        let dmoResult = {};
        try {
            //const userPaymentRec = await CustomerWalletLog.findOne({
            const userWalletRec = await CustomerWallet.findOne({
                where: {
                    user_id: orderInfo.user_id,
                },
            });
            let existing_wallet_balance = 0.0;
            let adjusted_amount = 0.0;
            let total_amount_to_be_paid = 0.0;
            let prev_wallet_balance = 0.0;
            if (userWalletRec) {
                prev_wallet_balance = userWalletRec.wallet_balance;
                existing_wallet_balance = userWalletRec.wallet_balance - orderInfo.cancelation_amount;
                //await CustomerWallet.update(
                await userWalletRec.update(
                    { wallet_balance: existing_wallet_balance, },
                    {
                        where: {
                            user_id: orderInfo.user_id,
                        }
                    }, { transaction });
            }
            else {
                existing_wallet_balance = 0 - orderInfo.cancelation_amount;
                await CustomerWallet.create({
                    user_id: orderInfo.user_id,
                    wallet_balance: existing_wallet_balance
                }, { transaction });
            }

            //total_amount_to_be_paid = existing_wallet_balance;
            total_amount_to_be_paid = orderInfo.cancelation_amount;
            const newWalletRec = await CustomerWalletLog.create({
                transaction_type_id: orderInfo.w_d_transaction_type_id,
                payment_type_id: orderInfo.payment_type_method_id,
                wallet_balance: existing_wallet_balance,
                ride_amount: orderInfo.amount,
                transaction_date: new Date().toISOString(),
                user_id: orderInfo.user_id,//
                ride_id: orderInfo.ride_id,
                adjusted_ride_amount: adjusted_amount,
                amount_to_be_paid: total_amount_to_be_paid,
                is_paid: false,
                chauffeur_id: orderInfo.chauffeur_id,
                coupon_id: null,
                is_coupon_applied: false,
                base_fare: 0,
                rates: 0,
                rate_type: '',
                mandatory_charges: 0,
                other_charges: 0,
                vat: 0,
                is_invoice_created: false,
                discount_amount: 0,
                ride_minutes: 0,
                cancelation_charges: 0 - parseFloat(orderInfo.cancelation_amount)
            }, { transaction });

            dmoResult.success = true;
            dmoResult.balance = newWalletRec.wallet_balance;
            dmoResult.ride_amount = newWalletRec.ride_amount;
            dmoResult.adjusted_amount = adjusted_amount;
            dmoResult.total_amount_to_be_paid = total_amount_to_be_paid.toFixed(2);
            dmoResult.prev_wallet_balance = prev_wallet_balance;

            await transaction.commit();

            return {
                walletOutput: dmoResult
            }
        } catch (error) {
            //console.log(error);
            if (transaction && transaction.finished !== "commit" && transaction.finished !== "rollback") {
                await transaction.rollback();
            }
            await addServerLog({
                log_level: "ERROR",
                service_name: "createCanelRideUpdateWalletRecord",
                error_message: `createCanelRideUpdateWalletRecord DAO error - ${error.message}.`
            });

            let error_description = '';
            error_description = error.name;

            dmoResult.success = false;
            dmoResult.error_code = 500;
            dmoResult.error = error_description;
            return {
                walletOutput: dmoResult,
            }
        }
    },
    createZeroCustomerWallet: async (user_id) => {
        console.log('createZeroCustomerWallet input', user_id);
        let response = {};
        try {
            const existingCustomerWalletRec = await CustomerWallet.findOne({
                where: {
                    user_id
                }
            });

            if (!existingCustomerWalletRec) {
                const newCustomerWallet = await CustomerWallet.create({
                    user_id,
                    wallet_balance: 0
                });
                response.success = true;
                response.newCustomerWallet = newCustomerWallet;
                response.message = "Customer Wallet with Zero Balance created.";
                return response;
            } else {
                response.success = true;
                response.newCustomerWallet = existingCustomerWalletRec;
                response.message = "Customer Wallet Balance fetched successfully.";
                return response;
            }

        } catch (error) {
            await addServerLog({
                log_level: "ERROR",
                service_name: "createZeroCustomerWallet",
                error_message: `createZeroCustomerWallet DAO error - ${error.message}.`
            });
            response.success = false;
            response.error = error.message;
            return response;
        }
    },
    createZeroCorporateCustomerWallet: async (user_id) => {
        //console.log('createZeroCorporateCustomerWallet input', user_id);
        let response = {};
        try {
            const existingCustomerWalletRec = await CustomerWallet.findOne({
                where: {
                    user_id,
                    is_org: true
                }
            });

            if (!existingCustomerWalletRec) {
                const newCustomerWallet = await CustomerWallet.create({
                    user_id,
                    wallet_balance: 0,
                    is_org: true
                });
                response.success = true;
                response.newCustomerWallet = newCustomerWallet;
                response.message = "Corporate Customer Wallet with Zero Balance created.";
                return response;
            } else {
                response.success = true;
                response.newCustomerWallet = existingCustomerWalletRec;
                response.message = "Corporate Customer Wallet Balance fetched successfully.";
                return response;
            }

        } catch (error) {
            await addServerLog({
                log_level: "ERROR",
                service_name: "createZeroCorporateCustomerWallet",
                error_message: `createZeroCorporateCustomerWallet DAO error - ${error.message}.`
            });
            response.success = false;
            response.error = error.message;
            return response;
        }
    },
    findCorporateCustomerBalance: async (userInfo) => {
        try {
            // console.log('findCorporateCustomerBalance input', userInfo);
            return await CustomerWallet.findOne({
                where: {
                    user_id: userInfo.user_id,
                    is_org: true
                },
            });
        } catch (error) {
            await addServerLog({
                log_level: "ERROR",
                service_name: "findCorporateCustomerBalance",
                error_message: `findCorporateCustomerBalance DAO error - ${error.message}.`
            });
        }

    },
    createCorporateWalletPaymentRecord: async (orderInfo) => {
        //console.log('createCorporateWalletPaymentRecord input', orderInfo);
        const transaction = await sequelize.transaction();
        let dmoResult = {};
        try {
            let corporateWalletRec;
            const userPaymentRec = await CustomerWallet.findOne({
                where: {
                    user_id: orderInfo.user_id,
                    is_org: true
                },
            });
            corporateWalletRec = userPaymentRec;
            if (!userPaymentRec) {
                corporateWalletRec = await CustomerWallet.create({
                    user_id: orderInfo.user_id,
                    wallet_balance: 0,
                    is_org: true
                });
            }
            console.log('org wallet payment method 3');

            //status log update
            //c_r_c_status_name
            orderInfo.status_log_details.push({
                datetime: new Date().toISOString(),
                status: `${orderInfo.c_p_p_status_name} `,
            });

            let payment_details = {
                card: null,
                payment_method: "Wallet"
            };
            orderInfo.payment_details = payment_details;
            console.log('org wallet payment method 4');
            let adjusted_amount = 0.0;
            let total_amount_to_be_paid = 0.0;
            let prev_wallet_balance = corporateWalletRec.wallet_balance;

            existing_wallet_balance = parseFloat(corporateWalletRec.wallet_balance) + parseFloat(orderInfo.total_amount_to_be_paid);

            await CustomerWallet.update(
                { wallet_balance: existing_wallet_balance, },
                {
                    where: {
                        user_id: orderInfo.user_id,
                        is_org: orderInfo.is_org
                    }
                }, { transaction });
            //console.log('org wallet payment method 5');
            const newWalletRec = await CustomerWalletLog.create({
                transaction_type_id: orderInfo.w_c_transaction_type_id,
                payment_type_id: orderInfo.payment_type_id,
                wallet_balance: existing_wallet_balance,
                ride_amount: orderInfo.amount,
                transaction_date: new Date().toISOString(),
                user_id: orderInfo.user_id,
                ride_id: orderInfo.ride_id,
                adjusted_ride_amount: adjusted_amount,
                amount_to_be_paid: orderInfo.total_amount_to_be_paid,
                is_paid: false,
                chauffeur_id: orderInfo.chauffeur_id,
                payment_status_id: orderInfo.payment_pending_status_id,
                customer_wallet_id: corporateWalletRec.id,
                discount_amount: orderInfo.discount_amount,
                coupon_id: orderInfo.coupon_ids,
                is_coupon_applied: orderInfo.is_coupon_applied,
                base_fare: orderInfo.base_fare,
                rates: orderInfo.rates,
                rate_type: orderInfo.rate_type,
                mandatory_charges: orderInfo.mandatory_charges,
                other_charges: orderInfo.other_charges,
                vat: orderInfo.vat,
                is_invoice_created: orderInfo.is_invoice_created,
                ride_minutes: orderInfo.estimated_time_in_minutes,
                total_after_discount: orderInfo.total_after_discount,
                is_zeizzu_org: orderInfo.is_arg,
                final_price_calculation: orderInfo.final_result
            }, { transaction });
            //console.log('org wallet payment method 6');
            if (orderInfo.is_coupon_applied && orderInfo.coupon_ids !== null) {
                console.log('coupon is not null');
                const newCouponUsageRec = await CouponUsage.create({
                    coupon_id: orderInfo.coupon_ids,
                    customer_id: orderInfo.user_id
                }, { transaction });
            } else {
                console.log('coupon is null');
            }
            //console.log('org wallet payment method 7');
            const PK = `${orderInfo.user_id}`;
            const SK = `#${orderInfo.ride_id}`;
            const params = {
                TableName: "Rides",
                Key: { PK, SK }, // identify key based row
                UpdateExpression: `SET #attrName = :statusVal,
    status_log = :statusLogVal,
        paymentDetails = :paymentDetailsVal`,
                ConditionExpression: '#attrName = :expectedStatusVal',
                ExpressionAttributeNames: {
                    "#attrName": "status"
                },
                ExpressionAttributeValues: {
                    ":statusVal": orderInfo.c_p_p_status_name, //orderInfo.c_r_c_status_name,
                    ":expectedStatusVal": orderInfo.c_r_p_status_name,
                    ":statusLogVal": orderInfo.status_log_details,
                    ":paymentDetailsVal": orderInfo.payment_details
                },
                ReturnValues: "UPDATED_NEW"
            };
            const command = new UpdateCommand(params);
            const response = await ddbDocClient.send(command);
            //console.log('org wallet payment method 8');
            if (response.$metadata.httpStatusCode === 200) {
                console.log('org wallet payment method 9');
                dmoResult.success = true;
                dmoResult.payment_status = response.Attributes?.status;
                dmoResult.balance = newWalletRec.wallet_balance;
                dmoResult.ride_amount = newWalletRec.ride_amount;
                dmoResult.adjusted_amount = adjusted_amount;
                dmoResult.total_amount_to_be_paid = total_amount_to_be_paid.toFixed(2);
                dmoResult.prev_wallet_balance = prev_wallet_balance;

                await transaction.commit();
            } else {
                //console.log('org wallet payment method 10');
                await addServerLog({
                    log_level: "ERROR",
                    service_name: "createCorporateWalletPaymentRecord",
                    error_message: `createCorporateWalletPaymentRecord update error.`
                });

                if (transaction && transaction.finished !== "commit") {
                    await transaction.rollback();
                }

                dmoResult.success = false;
                dmoResult.payment_status = response.Attributes?.status;
                dmoResult.error_code = response.$metadata.httpStatusCode;
                dmoResult.error = response.$metadata;
            }
            console.log('org wallet payment method 11', dmoResult);
            return {
                walletOutput: dmoResult
            }

        } catch (error) {
            let error_description = '';
            console.log('org wallet payment method 12', error);
            if (error.name === "SequelizeUniqueConstraintError") {
                error_description = `${error.errors[0].message} for user id ${orderInfo.user_id} `;
            }
            await addServerLog({
                log_level: "ERROR",
                service_name: "createCorporateWalletPaymentRecord",
                error_message: `createCorporateWalletPaymentRecord DAO error - ${error.message}.`
            });
            if (transaction && transaction.finished !== "commit" && transaction.finished !== "rollback") {
                await transaction.rollback();
            }

            if (error.name === "ConditionalCheckFailedException") {
                error_description = "Condition failed: The item does not meet the required condition.";
            } else if (error.name === "ResourceNotFoundException") {
                error_description = "Table or item not found.";
            } else if (error.name === "ProvisionedThroughputExceededException") {
                error_description = "Throughput limit exceeded. Consider increasing capacity.";
            } else if (error.name === "ValidationException") {
                error_description = "Validation error. Check your update expression.";
            }
            dmoResult.success = false;
            dmoResult.error_code = 500;
            dmoResult.error = error_description;
            //console.log('org wallet payment method 14', dmoResult);
            return {
                walletOutput: dmoResult,
            }
        }
    },
    createPaymentTypes: async (name, for_display, is_active) => {
        console.log('createPaymentTypes input', name, for_display, is_active);
        let response = {};
        try {
            const paymentTypeName = name.toLowerCase();
            const existingPaymentTypeRec = await PaymentType.findOne({
                where:
                {
                    [Op.and]: [
                        Sequelize.where(
                            fn('LOWER', col('name')),
                            'ilike',
                            paymentTypeName)
                    ]
                },
                attributes: ['id', 'name']
            });


            if (!existingPaymentTypeRec) {
                const newPaymentType = await PaymentType.create({
                    name,
                    for_display,
                    is_active
                });
                response.success = true;
                response.newPaymentType = newPaymentType;
                response.message = "Payment Type is created.";
                return response;
            } else {
                response.success = true;
                response.newPaymentType = existingPaymentTypeRec;
                response.message = "Payment Type already exists.";
                return response;
            }

        } catch (error) {
            await addServerLog({
                log_level: "ERROR",
                service_name: "createPaymentTypes",
                error_message: `createPaymentTypes DAO error - ${error.message}.`
            });
            response.success = false;
            response.error = error.message;
            return response;
        }
    },
    findUsersWalletBalance: async (start_date, end_date, limit, page, userId, search_string) => {
        try {
            console.log('findUsersWalletBalance input', start_date, end_date, limit, page, userId);

            const whereDateClause = {};
            if (start_date && end_date) {
                whereDateClause.createdAt = {
                    [Op.between]: [start_date, end_date]
                };
            }

            const searchList = search_string ? {
                [Op.or]: [
                    where(col('User.first_name'), { [Op.iLike]: `% ${search_string}% ` }),
                    where(col('User.last_name'), { [Op.iLike]: `% ${search_string}% ` }),
                    where(literal(`CAST('User.id' AS TEXT)`), { [Op.iLike]: ` % ${search_string}% ` }),
                    where(col('PaymentType.name'), { [Op.iLike]: `% ${search_string}% ` }),
                    where(col('Status.name'), { [Op.iLike]: `% ${search_string}% ` }),
                    where(col('CustomerWalletLog.ride_id'), { [Op.iLike]: `% ${search_string}% ` })
                ]
            } : {};


            const offset = (page - 1) * limit;

            const whereClause = {
                ...searchList,
                ...whereDateClause
            }


            const customerWalletRec = await CustomerWalletLog.findAll({
                where: whereClause,
                include: [
                    {
                        model: PaymentType,
                        attributes: ['name'],
                    },
                    {
                        model: Status,
                        attributes: ['name'],
                    },
                    {
                        model: User,
                        attributes: ['first_name', 'last_name'],
                    },
                ],
                attributes: ['user_id', 'payment_type_id', 'top_up_amount', 'ride_id', 'adjusted_ride_amount', 'transaction_date', 'amount_to_be_paid', 'is_paid', 'payment_status_id', 'rate_type', 'is_invoice_created', 'wallet_balance'],
                limit,
                offset,
                order: [['transaction_date', 'DESC']]
            });

            const count = await CustomerWalletLog.count({
                where: whereClause,
                include: [
                    {
                        model: PaymentType,
                        attributes: ['name'],
                    },
                    {
                        model: Status,
                        attributes: ['name'],
                    },
                    {
                        model: User,
                        attributes: ['first_name', 'last_name'],
                    },
                ],
                col: 'user_id',
                order: [['transaction_date', 'DESC']]
            });

            let customerRec = {
                totalRecords: count,
                totalPages: Math.ceil(count / limit),
                currentPage: page,
                perPage: limit,
                data: customerWalletRec
            }

            return {
                customerRec,
            };

        } catch (error) {
            console.log(`findUsersWalletBalance - ${error.message} `);
            await addServerLog({
                log_level: "ERROR",
                service_name: "findUsersWalletBalance",
                error_message: `findUsersWalletBalance DAO error - ${error.message}.`
            });
        }

    },

    getAmountByRideId: async (rideId) => {
        console.log('getAmountByRideId input', rideId);
        try {
            const payment = await Payments.findOne({
                where: { ride_id: rideId },
                attributes: ['amount_to_be_paid'],
            });

            return payment;
        } catch (error) {
            await addServerLog({
                log_level: "ERROR",
                service_name: "getAmountByRideId",
                error_message: `getAmountByRideId DAO error - ${error.message}.`
            });
            //console.error(`Error fetching amount from Payments for ride_id: ${ rideId } `, error);
            throw new Error("Error fetching amount from Payments");
        }
    },

    getWalletAmountByRideId: async (rideId) => {
        console.log('getWalletAmountByRideId input', rideId);
        try {
            const walletRecord = await CustomerWalletLog.findOne({
                where: { ride_id: rideId },
                attributes: ['amount_to_be_paid'],
            });

            return walletRecord;
        } catch (error) {
            await addServerLog({
                log_level: "ERROR",
                service_name: "getWalletAmountByRideId",
                error_message: `getWalletAmountByRideId DAO error - ${error.message}.`
            });
            //console.error(`Error fetching amount from CustomerWalletLogs for ride_id: ${ rideId } `, error);
            throw new Error("Error fetching amount from CustomerWalletLogs");
        }
    },
    findCorporateUserWallet: async (customer_id) => {
        try {
            console.log('findCorporateUserWallet input', customer_id);
            const customerWalletLogRec = await CustomerWalletLog.findAll({
                where: { user_id: customer_id },
                include: [{
                    model: CustomerWallet,
                    where: { is_org: true },
                    attributes: { exclude: ['wallet_balance', 'createdAt', 'updatedAt', 'id', 'user_id'] }
                },
                {
                    model: User,
                    attributes: ['first_name', 'last_name']
                },
                {
                    model: PaymentType,
                    attributes: ['name']
                },
                {
                    model: Status,
                    attributes: ['name']
                }
                ],
                attributes: { exclude: ['createdAt', 'updatedAt', 'id', 'coupon_id', 'payment_type_id', 'transaction_type_id', 'user_id', 'top_up_amount', 'wallet_balance', 'adjusted_ride_amount', 'transaction_reference', 'amount_to_be_paid', 'discount_amount', 'tip_amount', 'customer_wallet_id'] },
                raw: true,
            });

            const customerWalletRec = await CustomerWallet.findAll({

            });
            return {

                customerWalletLogRec,
                customerWalletRec
            };
        } catch (error) {
            await addServerLog({
                log_level: "ERROR",
                service_name: "findCorporateUserWallet",
                error_message: `findCorporateUserWallet DAO error - ${error.message}.`
            });
        }

    },
    findStatusById: async (id) => {
        try {
            //const statusName = name.toLowerCase();
            //console.log('findStatusById input', id);
            return await Status.findOne({
                where: { id },
                attributes: ['name']
            });
        } catch (error) {
            await addServerLog({
                log_level: "ERROR",
                service_name: "findStatusById",
                error_message: `findStatusById DAO error - ${error.message}.`
            });
        }

    },
    findRideWalletPaymentStatus: async (user_id, ride_id) => {
        try {
            //console.log('findRideWalletPaymentStatus input', user_id, ride_id);
            return await CustomerWalletLog.findOne({
                where: {
                    user_id,
                    ride_id,
                    is_paid: true
                },
            });
        } catch (error) {
            await addServerLog({
                log_level: "ERROR",
                service_name: "findRideWalletPaymentStatus",
                error_message: `findRideWalletPaymentStatus DAO error - ${error.message}.`
            });
        }

    },
    findCorpRideWalletPaymentStatus: async (user_id, ride_id) => {
        try {
            //console.log('findCorpRideWalletPaymentStatus input', user_id, ride_id);
            return await CustomerWalletLog.findOne({
                where: {
                    user_id,
                    ride_id,
                    is_paid: false
                },
            });
        } catch (error) {
            await addServerLog({
                log_level: "ERROR",
                service_name: "findCorpRideWalletPaymentStatus",
                error_message: `findCorpRideWalletPaymentStatus DAO error - ${error.message}.`
            });
        }

    },
    findChauffeurUserWalletById: async (user_id) => {
        try {
            // console.log('findChauffeurUserWalletById input', user_id);
            const todayDate = new Date().toISOString().split('T')[0];
            const chauffeurWalletRec = await ChauffeurWallet.findOne({
                where: {
                    user_id,
                    transaction_date: todayDate
                },
                include: [{
                    model: User,
                    attributes: ['first_name', 'last_name', 'role_id']
                },
                ],
                attributes: { exclude: ['createdAt', 'updatedAt', 'id'] },
            });

            return chauffeurWalletRec;
        } catch (error) {
            await addServerLog({
                log_level: "ERROR",
                service_name: "findChauffeurUserWalletById",
                error_message: `findChauffeurUserWalletById DAO error - ${error.message}.`
            });
        }

    },
    findRoleNameById: async (role_id) => {
        try {
            console.log('findRoleNameById input', role_id);
            return await Role.findOne({
                where: { id: role_id },
                attributes: ['name']
            });
        } catch (error) {
            await addServerLog({
                log_level: "ERROR",
                service_name: "findRoleNameById",
                error_message: `findRoleNameById DAO error - ${error.message}.`
            });
        }

    },
    findChauffeurUserWallets: async (start_date, end_date, limit, page) => {
        try {
            console.log('findChauffeurUserWallets input', start_date, end_date, limit, page);

            const whereClause = {};
            if (start_date && end_date) {
                whereClause.createdAt = {
                    [Op.between]: [start_date, end_date]
                };
            }

            const offset = (page - 1) * limit;

            const rows = await ChauffeurWallet.findAll({
                where: whereClause,
                include: [
                    {
                        model: User,
                        as: 'User',
                        attributes: ['first_name', 'last_name', 'id'],
                    },
                    {
                        model: User,
                        as: 'Hand-Over-User',
                        attributes: ['first_name', 'last_name'],
                    },
                ],
                attributes: ['wallet_balance'],
                limit,
                offset,
                distinct: true,
                order: [['transaction_date', 'DESC']]
            });

            const count = await ChauffeurWallet.count({
                where: whereClause,
                distinct: true,
                order: [['transaction_date', 'DESC']]
            });

            let chauffeurRec = {
                totalRecords: count,
                totalPages: Math.ceil(count / limit),
                currentPage: page,
                perPage: limit,
                data: rows
            }

            return chauffeurRec;
        } catch (error) {
            console.log(error);
            await addServerLog({
                log_level: "ERROR",
                service_name: "findChauffeurUserWallets",
                error_message: `findChauffeurUserWallets DAO error - ${error.message}.`
            });
        }

    },
    createZeroChauffeurWallet: async (user_id) => {
        // console.log('createZeroChauffeurWallet input', user_id);
        const todayDate = new Date().toISOString().split('T')[0];
        let response = {};
        try {
            const existingChauffeurWalletRec = await ChauffeurWallet.findOne({
                where: {
                    user_id,
                    transaction_date: todayDate
                }
            });

            if (!existingChauffeurWalletRec) {
                //let transaction_dt = new Date().toISOString();

                const newChauffeurWalet = await ChauffeurWallet.create({
                    user_id,
                    wallet_balance: 0,
                    transaction_date: todayDate
                });
                response.success = true;
                response.newChauffeurWalet = newChauffeurWalet;
                response.message = "Chauffeur Wallet with Zero Balance created.";
                return response;
            } else {
                response.success = true;
                response.newChauffeurWalet = existingChauffeurWalletRec;
                response.message = "Chauffeur Wallet Balance fetched successfully.";
                return response;
            }

        } catch (error) {
            await addServerLog({
                log_level: "ERROR",
                service_name: "createZeroChauffeurWallet",
                error_message: `createZeroChauffeurWallet DAO error - ${error.message}.`
            });
            response.success = false;
            response.error = error.message;
            return response;
        }
    },
    findCashWalletByChauffeurId: async (user_id, transaction_type_id) => {
        try {
            console.log('findCashWalletByChauffeurId input', user_id, transaction_type_id);
            const todayDate = new Date().toISOString().split('T')[0];

            const chauffeurWalletRec = await ChauffeurWallet.findOne({
                where: {
                    user_id,
                },
            });
            return {
                chauffeurWalletRec
            };
        } catch (error) {
            await addServerLog({
                log_level: "ERROR",
                service_name: "findCashWalletByChauffeurId",
                error_message: `findCashWalletByChauffeurId DAO error - ${error.message}.`
            });
        }

    },
    findChauffeurWalletById: async (user_id) => {
        try {
            console.log('findChauffeurWalletById input', user_id);
            const todayDate = new Date().toISOString().split('T')[0];
            const existingChauffeurWalletRec = await ChauffeurWallet.findOne({
                where: {
                    user_id,
                    //transaction_date: todayDate
                }
            });

            if (!existingChauffeurWalletRec) {
                //let transaction_dt = new Date().toISOString();

                const newChauffeurWalet = await ChauffeurWallet.create({
                    user_id,
                    wallet_balance: 0,
                    transaction_date: todayDate
                });
                return newChauffeurWalet;
            } else {
                return existingChauffeurWalletRec;
            }
        } catch (error) {
            await addServerLog({
                log_level: "ERROR",
                service_name: "findChauffeurWalletById",
                error_message: `findChauffeurWalletById DAO error - ${error.message}.`
            });
        }

    },

    updateChauffeurCashHandOver: async (chauffeur_id, pd_user_id, completed_status_id, hand_over_amount) => {

        const transaction = await sequelize.transaction();
        let dmoResult = {};
        try {
            const transaction_dt = new Date().toISOString();
            const todayDate = new Date().toISOString();
            let chauffeur_wa_id = 0;

            //chauffeur adjust
            const chauffeurPaymentRec = await ChauffeurWallet.findOne({
                where: {
                    user_id: chauffeur_id,
                },
            });

            let hand_over_existing_wallet_balance = 0.0;
            let c_existing_wallet_balance = 0.0;
            let updated_hand_over_amount = 0.0;
            if (chauffeurPaymentRec) {
                c_existing_wallet_balance = parseFloat(chauffeurPaymentRec.wallet_balance);
                updated_hand_over_amount = parseFloat(chauffeurPaymentRec.hand_over_amount) + parseFloat(hand_over_amount);
                console.log('new hand over for pd', updated_hand_over_amount);
                //if wallet balance is greater than hand over amount, allow the transaction
                //else return success false
                if (c_existing_wallet_balance - parseFloat(hand_over_amount) >= 0) {
                    c_existing_wallet_balance = c_existing_wallet_balance - parseFloat(hand_over_amount);
                    await ChauffeurWallet.update(
                        {
                            wallet_balance: c_existing_wallet_balance,
                            hand_over_transaction_date: transaction_dt,
                            hand_over_amount: updated_hand_over_amount,
                            hand_over_user_id: pd_user_id
                        },
                        {
                            where: {
                                user_id: chauffeur_id,
                            }
                        }, { transaction });
                } else {
                    if (transaction && transaction.finished !== "commit") {
                        await transaction.rollback();
                    }
                    dmoResult.success = false;
                    dmoResult.message = "Hand over amount is greater than Wallet Balance.";
                    return {
                        cashOutput: dmoResult
                    }
                }

            } else {

                let existing_wallet_balance = parseFloat(hand_over_amount);
                c_existing_wallet_balance = existing_wallet_balance;
                await ChauffeurWallet.create({
                    user_id: chauffeur_id,
                    wallet_balance: existing_wallet_balance,
                    transaction_date: transaction_dt,
                    hand_over_amount,
                    hand_over_user_id: pd_user_id,
                    hand_over_transaction_date: transaction_dt
                }, { transaction });
            }

            //pd create
            const pdPaymentRec = await PDWallet.findOne({
                where: {
                    user_id: pd_user_id,
                },
            });

            let existing_wallet_balance = 0.0;
            let outstanding_balance = 0.0;
            if (pdPaymentRec) {
                //if wallet balance is greater than hand over amount, allow the transaction
                //else return success false

                existing_wallet_balance = parseFloat(pdPaymentRec.wallet_balance) + parseFloat(hand_over_amount);

                await PDWallet.update(
                    {
                        wallet_balance: existing_wallet_balance,
                        transaction_date: transaction_dt
                    },
                    {
                        where: {
                            user_id: pd_user_id,
                        }
                    }, { transaction });
                hand_over_existing_wallet_balance = existing_wallet_balance;

                //console.log('pd upd');
            } else {
                existing_wallet_balance = parseFloat(hand_over_amount);
                await PDWallet.create({
                    user_id: pd_user_id,
                    wallet_balance: existing_wallet_balance,
                    transaction_date: transaction_dt
                }, { transaction });
                hand_over_existing_wallet_balance = existing_wallet_balance;
                //console.log('pd ins');
            }

            //add chauffer wallet log
            await ChauffeurWalletLog.create({
                user_id: chauffeur_id,
                pd_user_id: pd_user_id,
                pd_transaction_date: todayDate,
                hand_over_amount: hand_over_amount,
                has_handed_over: true
            }, { transaction });

            await transaction.commit();
            dmoResult.success = true;
            dmoResult.message = "Chauffeur PD cash handling process completed successfully";
            dmoResult.wallet_balance = c_existing_wallet_balance;
            dmoResult.hand_over_wallet_balance = hand_over_existing_wallet_balance;
            return {
                cashOutput: dmoResult
            }

        } catch (error) {
            console.log('chaufferCashHandOverProcess-8', error);
            //console.log('driver hand over-error', error);
            await addServerLog({
                log_level: "ERROR",
                service_name: "updateChauffeurCashHandOver",
                error_message: `updateChauffeurCashHandOver DAO error - ${error.message}.`
            });
            await transaction.rollback();
            let error_description = '';

            error_description = error.name;
            dmoResult.success = false;
            dmoResult.error_code = 500;
            dmoResult.error = error.message;
            return {
                cashOutput: dmoResult,
            }
        }
    },

    updatePDCashHandOver: async (pd_user_id, hand_over_user_id, completed_status_id, hand_over_amount) => {

        console.log('updatePDCashHandOver input', pd_user_id, hand_over_user_id, completed_status_id, hand_over_amount);
        const transaction = await sequelize.transaction();
        let dmoResult = {};
        try {

            const transaction_dt = new Date().toISOString();
            const todayDate = new Date().toISOString();
            let chauffeur_wa_id = 0;

            //chauffeur adjust
            const pdPaymentRec = await PDWallet.findOne({
                where: {
                    user_id: pd_user_id,
                },
            });

            let hand_over_existing_wallet_balance = 0.0;
            let pd_existing_wallet_balance = 0.0;
            let c_existing_wallet_balance = 0.0;
            if (pdPaymentRec) {
                c_existing_wallet_balance = parseFloat(pdPaymentRec.wallet_balance);
                //if wallet balance is greater than hand over amount, allow the transaction
                //else return success false
                if (c_existing_wallet_balance - parseFloat(hand_over_amount) >= 0) {
                    c_existing_wallet_balance = c_existing_wallet_balance - parseFloat(hand_over_amount);
                    // outstanding_balance = parseFloat(c_existing_wallet_balance) - parseFloat(hand_over_amount);
                    await PDWallet.update(
                        {
                            wallet_balance: c_existing_wallet_balance, //wallet balance - amount 
                            hand_over_transaction_date: transaction_dt,
                            hand_over_amount: parseFloat(hand_over_amount) + parseFloat(pdPaymentRec.hand_over_amount),
                            hand_over_user_id: hand_over_user_id
                        },
                        {
                            where: {
                                user_id: pd_user_id,
                                //hand_over_user_id
                            }
                        }, { transaction });
                    //console.log('upd');
                } else {
                    if (transaction && transaction.finished !== "commit") {
                        await transaction.rollback();
                    }
                    dmoResult.success = false;
                    dmoResult.error = "Hand over amount is greater than Wallet Balance.";
                    //dmoResult.message = "Hand over amount is greater than Wallet Balance.";
                    return {
                        cashOutput: dmoResult
                    }
                }

            } else {
                pd_existing_wallet_balance = parseFloat(hand_over_amount);
                await PDWallet.create({
                    user_id: pd_user_id,
                    wallet_balance: pd_existing_wallet_balance,
                    transaction_date: transaction_dt,
                    hand_over_amount,
                    hand_over_user_id: hand_over_user_id,
                    hand_over_transaction_date: transaction_dt
                }, { transaction });
                c_existing_wallet_balance = pd_existing_wallet_balance;
                //console.log('ins');
            }

            //pd create
            const adminPaymentRec = await AdminWallet.findOne({
                where: {
                    user_id: hand_over_user_id,
                    // transaction_date: {
                    //     [Op.eq]: todayDate
                    // }
                },
            });
            //console.log('admin', adminPaymentRec);

            let existing_wallet_balance = 0.0;
            let outstanding_balance = 0.0;
            if (adminPaymentRec) {
                //if wallet balance is greater than hand over amount, allow the transaction
                //else return success false

                existing_wallet_balance = parseFloat(adminPaymentRec.wallet_balance) + parseFloat(hand_over_amount);

                await AdminWallet.update(
                    {
                        wallet_balance: existing_wallet_balance,
                        transaction_date: transaction_dt
                    },
                    {
                        where: {
                            user_id: hand_over_user_id,
                        }
                    }, { transaction });
                hand_over_existing_wallet_balance = existing_wallet_balance;
                // console.log('admin upd');
            } else {
                existing_wallet_balance = parseFloat(hand_over_amount);
                await AdminWallet.create({
                    user_id: hand_over_user_id,
                    wallet_balance: existing_wallet_balance,
                    transaction_date: transaction_dt
                }, { transaction });
                hand_over_existing_wallet_balance = existing_wallet_balance;
                //console.log('admin ins');
            }
            //console.log('pd u', pd_user_id, 'h u', hand_over_user_id);
            //add pd wallet log
            await PDWalletLog.create({
                user_id: pd_user_id,
                hand_over_user_id,
                hand_over_transaction_date: todayDate,
                hand_over_amount: hand_over_amount,
                has_handed_over: true
            }, { transaction });

            await transaction.commit();
            dmoResult.success = true;
            dmoResult.message = "PD Admin cash handling process completed successfully";
            dmoResult.wallet_balance = c_existing_wallet_balance;
            dmoResult.hand_over_wallet_balance = hand_over_existing_wallet_balance;
            return {
                cashOutput: dmoResult
            }
        } catch (error) {
            console.log('PD Cash Hand Over-error', error);
            await addServerLog({
                log_level: "ERROR",
                service_name: "updatePDCashHandOver",
                error_message: `updatePDCashHandOver DAO error - ${error.message}.`
            });
            await transaction.rollback();
            let error_description = '';

            error_description = error.name;
            dmoResult.success = false;
            dmoResult.error_code = 500;
            dmoResult.error = error.message;
            return {
                cashOutput: dmoResult,
            }
        }
    },
    findUsersByRole: async (role_name) => {
        console.log('findUsersByRole input', role_name);
        try {
            return await User.findAll({
                where: { is_active: true },
                include: [{
                    model: Role,
                    where: Sequelize.where(
                        Sequelize.fn('LOWER', Sequelize.col('name')),
                        role_name
                    ),
                    as: 'role',
                    attributes: ['name']
                },
                ],
                attributes: ['id', 'first_name', 'last_name']
            });

        } catch (error) {
            await addServerLog({
                log_level: "ERROR",
                service_name: "findUsersByRole",
                error_message: `findUsersByRole DAO error - ${error.message}.`
            });
            console.log('find pd users error -', error.message);
        }
    },

    findPDWalletById: async (user_id) => {
        try {
            console.log('findPDWalletById input', user_id);

            const todayDate = new Date().toISOString().split('T')[0];
            const existingPDWalletRec = await PDWallet.findOne({
                where: {
                    user_id,
                    //transaction_date: todayDate
                }
            });

            if (!existingPDWalletRec) {
                const newPDWalet = await PDWallet.create({
                    user_id,
                    wallet_balance: 0,
                    transaction_date: todayDate
                });
                return newPDWalet;
            } else {
                return existingPDWalletRec;
            }
        } catch (error) {
            await addServerLog({
                log_level: "ERROR",
                service_name: "findPDWalletById",
                error_message: `findPDWalletById DAO error - ${error.message}.`
            });
        }

    },

    findCashWalletByPDId: async (user_id, transaction_type_id) => {
        try {
            console.log('findCashWalletByPDId input', user_id, transaction_type_id);
            const todayDate = new Date().toISOString().split('T')[0];

            const pdWalletRec = await PDWallet.findOne({
                where: {
                    user_id,
                },
            });
            return {
                pdWalletRec
            };
        } catch (error) {
            await addServerLog({
                log_level: "ERROR",
                service_name: "findCashWalletByPDId",
                error_message: `findCashWalletByPDId DAO error - ${error.message}.`
            });
        }

    },
    getPDRideDetails: async (pd_id) => {
        // console.log('getPDRideDetails input', pd_id);


        const todayDate = new Date().toISOString().split('T')[0];
        //console.log(todayDate);
        const params = {
            TableName: "ChauffeurRides",
            IndexName: "pd_id-index",  // Ensure this GSI exists in your DynamoDB table
            KeyConditionExpression: "pd_id = :pd_id",
            ProjectionExpression:
                "#status, PK, SK, chauffeur_id, order_date, organisation_id, pd_id, ride_id",
            ExpressionAttributeNames: {
                "#status": "status",
            },
            ExpressionAttributeValues: {
                ":pd_id": pd_id,
            },
        };
        //console.log('dmo chauffeur rides query', params);
        try {
            const command = new QueryCommand(params);
            const response = await ddbDocClient.send(command);
            console.log('chauffeur pd ride details', response);
            return response;
        } catch (error) {
            await addServerLog({
                log_level: "ERROR",
                service_name: "getPDRideDetails",
                error_message: `getPDRideDetails DAO error - ${error.message}.`
            });
            throw new Error("Error fetching pd ride details.");
        }
    },
    findChauffeurWallets: async (start_date, end_date, limit, page, userId) => {
        try {
            console.log('findChauffeurWallets input', start_date, end_date, limit, page, userId);

            const whereClause = {};
            if (start_date && end_date) {
                whereClause.createdAt = {
                    [Op.between]: [start_date, end_date]
                };
            }


            if (userId > 0) {
                whereClause.user_id = userId;
            }

            const offset = (page - 1) * limit;

            const chauffeurWalletRec = await ChauffeurWalletLog.findAll({
                where: whereClause,
                include: [
                    {
                        model: User,
                        as: 'User',
                        attributes: ['first_name', 'last_name', 'id']
                    },
                    {
                        model: User,
                        as: 'PD-User',
                        attributes: ['first_name', 'last_name', 'id']
                    },
                ],
                attributes: ['pd_transaction_date', 'hand_over_amount', 'has_handed_over'],
                limit,
                offset,
                order: [['pd_transaction_date', 'DESC']]
            });

            const count = await ChauffeurWalletLog.count({
                where: whereClause,
                limit,
                offset,
                col: 'user_id',
            });

            let chauffeurRec = {
                totalRecords: count,
                totalPages: Math.ceil(count / limit),
                currentPage: page,
                perPage: limit,
                data: chauffeurWalletRec
            }

            return {
                chauffeurRec,
            };
        } catch (error) {
            console.log(error);
            await addServerLog({
                log_level: "ERROR",
                service_name: "findChauffeurWallets",
                error_message: `findChauffeurWallets DAO error - ${error.message}.`
            });
        }

    },

    findPDWallets: async (start_date, end_date, limit, page, userId) => {
        try {
            console.log('findPDWallets input', start_date, end_date, limit, page, userId)

            const whereClause = {};
            if (start_date && end_date) {
                whereClause.hand_over_transaction_date = {
                    [Op.between]: [start_date, end_date]
                };
            }

            if (userId > 0) {
                whereClause.user_id = userId;
            }

            const offset = (page - 1) * limit;

            const pdWalletLogRec = await PDWalletLog.findAll({
                where: whereClause,
                include: [
                    {
                        model: User,
                        as: 'User',
                        attributes: ['first_name', 'last_name', 'id']
                    },
                    {
                        model: User,
                        as: 'Hand-Over-User',
                        attributes: ['first_name', 'last_name', 'id']
                    },
                ],
                attributes: ['hand_over_transaction_date', 'hand_over_amount', 'has_handed_over'],
                limit,
                offset,
                order: [['hand_over_transaction_date', 'DESC']]
            });


            const count = await PDWalletLog.count({
                where: whereClause,
                limit,
                offset,
                col: 'user_id',
            });

            const pdRec = {
                totalRecords: count,
                totalPages: Math.ceil(count / limit),
                currentPage: page,
                perPage: limit,
                data: pdWalletLogRec
            }

            return {
                pdRec
            };
        } catch (error) {
            console.log(error);
            await addServerLog({
                log_level: "ERROR",
                service_name: "findPDWallets",
                error_message: `findPDWallets DAO error - ${error.message}.`
            });
        }

    },
    updateCorporatePayment: async (admin_id, ride_ids, hand_over_amount, completed_status_id) => {

        console.log('updateCorporatePayment input', admin_id, ride_ids, hand_over_amount, completed_status_id);

        const transaction = await sequelize.transaction();
        let dmoResult = {};
        try {
            // const transaction_dt = new Date().toISOString();
            const todayDate = new Date().toISOString();
            //corporate admin payment adjust
            const adminPaymentRec = await CustomerWallet.findOne({
                where: {
                    user_id: admin_id,
                    is_org: true
                },
                attributes: ['wallet_balance']
            });
            //get payment pending status id
            const statusName = 'payment-pending';
            const paymentPendingStatus = await Status.findOne({
                where: Sequelize.where(
                    Sequelize.fn('LOWER', Sequelize.col('name')),
                    statusName
                ),
                attributes: ['id']
            });
            let paymentPendingStatusId;
            if (paymentPendingStatus) {
                paymentPendingStatusId = paymentPendingStatus.id;
            }
            //get payment pending customer wallet log records
            const adminLogPaymentRec = await CustomerWalletLog.findAll({
                where: {
                    user_id: admin_id,
                    payment_status_id: paymentPendingStatusId
                }
            })
            if (adminLogPaymentRec) {
                await CustomerWalletLog.update(
                    {
                        payment_status_id: completed_status_id,
                        updatedAt: todayDate
                    },
                    {
                        where: { ride_id: ride_ids }
                    }, { transaction }
                );


                if (adminPaymentRec) {
                    c_existing_wallet_balance = parseFloat(adminPaymentRec.wallet_balance);

                    c_existing_wallet_balance = c_existing_wallet_balance - parseFloat(hand_over_amount);

                    await CustomerWallet.update(
                        {
                            wallet_balance: c_existing_wallet_balance, //wallet balance - amount 
                            updatedAt: todayDate,
                        },
                        {
                            where: {
                                user_id: admin_id,
                            }
                        }, { transaction });

                }

                await transaction.commit();
                dmoResult.success = true;
                dmoResult.message = `Corporate payment for Rides ${ride_ids} completed successfully`;
                dmoResult.wallet_balance = c_existing_wallet_balance;
                return {
                    cashOutput: dmoResult
                }
            }

        } catch (error) {
            console.log('corporate payment process-error', error);
            await addServerLog({
                log_level: "ERROR",
                service_name: "updateCorporatePayment",
                error_message: `updateCorporatePayment DAO error - ${error.message}.`
            });
            await transaction.rollback();
            let error_description = '';

            error_description = error.name;
            dmoResult.success = false;
            dmoResult.error_code = 500;
            dmoResult.error = error.message;
            return {
                cashOutput: dmoResult,
            }
        }
    },

    chauffeurPaymentsSummary: async (rideIds, startDate, endDate, user_id) => {
        try {
            if (!rideIds || rideIds.length === 0) {
                throw new Error("No rides found.");
            }

            const whereCondition = {
                is_paid: true,
                chauffeur_id: String(user_id),
                ride_id: { [Op.in]: rideIds },
            };

            const walletWhereCondition = {
                chauffeur_id: String(user_id),
                ride_id: { [Op.in]: rideIds },
            }

            // Add date filter if provided
            if (startDate && endDate) {
                whereCondition.createdAt = { [Op.between]: [startDate, endDate] };
                walletWhereCondition.createdAt = { [Op.between]: [startDate, endDate] };
            }

            // Fetch payment amounts from Payments table
            const paymentResults = await Payments.findAll({
                attributes: [[fn("SUM", col("amount_to_be_paid")), "total_revenue"],
                [fn("SUM", col("discount_amount")), "total_discount"]],
                where: whereCondition,
                raw: true,
            });

            // Fetch wallet payments from CustomerWalletLog table
            const walletResults = await CustomerWalletLog.findAll({
                attributes: [[fn("SUM", col("amount_to_be_paid")), "total_wallet_revenue"],
                [fn("SUM", col("discount_amount")), "total_wallet_discount"],
                [fn("SUM", col("adjusted_ride_amount")), "total_adjusted_ride_amount"]],
                where: walletWhereCondition,
                raw: true,
            });

            // Extract values safely
            const totalRevenue = parseFloat(paymentResults[0]?.total_revenue || 0);
            const totalPaymentDiscount = parseFloat(paymentResults[0]?.total_discount || 0);
            const totalWalletRevenue = parseFloat(walletResults[0]?.total_wallet_revenue || 0);
            const totalWalletDiscount = parseFloat(walletResults[0]?.total_wallet_discount || 0);
            const totalAdjustedRideAmount = parseFloat(walletResults[0]?.total_adjusted_ride_amount || 0);
            // Calculate the total revenue
            const total = totalRevenue + totalWalletRevenue - totalAdjustedRideAmount;
            const totalDiscount = totalPaymentDiscount + totalWalletDiscount;
            console.log(total, totalDiscount);
            // Create maps for ride payments
            // const paymentMap = {};
            // paymentResults.forEach(({ ride_id, total_revenue }) => {
            //     paymentMap[ride_id] = parseFloat(total_revenue) || 0;
            // });

            // const walletMap = {};
            // walletResults.forEach(({ ride_id, wallet_revenue }) => {
            //     walletMap[ride_id] = parseFloat(wallet_revenue) || 0;
            // });

            // // Calculate total amount paid across all rides
            // let totalAmountPaid = total;
            // let rideAmountMap = {};

            // rideIds.forEach((ride_id) => {
            //     const totalRideAmount = (paymentMap[ride_id] || 0) + (walletMap[ride_id] || 0);
            //     rideAmountMap[ride_id] = totalRideAmount;
            //     totalAmountPaid += totalRideAmount;
            // });

            return { total, totalWalletDiscount };


        } catch (error) {
            console.error("Error in fetching chauffeur summary:", error.message);
            await addServerLog({
                log_level: "ERROR",
                service_name: "chauffeurPaymentsSummary",
                error_message: `chauffeurPaymentsSummary DAO error - ${error.message}.`
            })
            throw new Error(`Error in fetching chauffeur summary: ${error.message} `);
        }
    },

    findPDUserWallets: async (start_date, end_date, limit, page) => {
        try {
            console.log('findPDUserWallets input', start_date, end_date, limit, page);

            const whereClause = {};
            if (start_date && end_date) {
                whereClause.transaction_date = {
                    [Op.between]: [start_date, end_date]
                };
            }

            const offset = (page - 1) * limit;

            const rows = await PDWallet.findAll({
                where: whereClause,
                include: [
                    {
                        model: User,
                        as: 'User',
                        attributes: ['first_name', 'last_name', 'id']
                    },
                    {
                        model: User,
                        as: 'Hand-Over-User',
                        attributes: ['first_name', 'last_name']
                    },
                ],
                attributes: ['wallet_balance'],
                limit,
                offset,
                distinct: true,
                order: [['transaction_date', 'DESC']]
            });
            const count = await PDWallet.count({
                where: whereClause,
                distinct: true,
                order: [['transaction_date', 'DESC']]
            });


            let pdRec = {
                totalRecords: count,
                totalPages: Math.ceil(count / limit),
                currentPage: page,
                perPage: limit,
                data: rows
            }

            return pdRec;
        } catch (error) {
            console.log(error);
            await addServerLog({
                log_level: "ERROR",
                service_name: "findPDUserWallets",
                error_message: `findPDUserWallets DAO error - ${error.message}.`
            });
        }

    },
    findAdminUserWallets: async (start_date, end_date, limit, page) => {
        try {
            console.log('findAdminUserWallets input', start_date, end_date, limit, page);
            const offset = (page - 1) * limit;

            const whereClause = {};
            if (start_date && end_date) {
                whereClause.transaction_date = {
                    [Op.between]: [start_date, end_date]
                };
            }

            const rows = await AdminWallet.findAll({
                where: whereClause,
                include: [
                    {
                        model: User,
                        as: 'User',
                        attributes: ['first_name', 'last_name', 'id']
                    },
                ],
                attributes: ['wallet_balance'],
                limit,
                offset,
                distinct: true,
                order: [['transaction_date', 'DESC']]
            });
            const count = await AdminWallet.count({
                where: whereClause,
                distinct: true,
                order: [['transaction_date', 'DESC']]
            });


            let adminRec = {
                totalRecords: count,
                totalPages: Math.ceil(count / limit),
                currentPage: page,
                perPage: limit,
                data: rows
            }

            return adminRec;
        } catch (error) {
            console.log(error);
            await addServerLog({
                log_level: "ERROR",
                service_name: "findAdminUserWallets",
                error_message: `findAdminUserWallets DAO error - ${error.message}.`
            });
        }

    },
    createAdminCashPaymentRecord: async (orderInfo) => {
        console.log('createAdminCashPaymentRecord input', orderInfo);
        const transaction = await sequelize.transaction();
        let transaction_dt = new Date().toISOString();
        let dmoResult = {};
        try {
            orderInfo.status_log_details.push({
                datetime: new Date().toISOString(),
                status: `${orderInfo.c_r_c_status_name} `,
            });
            let payment_details = {
                card: null,
                payment_method: "Cash"
            };
            orderInfo.payment_details = payment_details;
            let chauffeur_wa_id = 0;
            const todayDate = new Date().toISOString().split('T')[0];
            const chauffeurPaymentRec = await ChauffeurWallet.findOne({
                where: {
                    user_id: orderInfo.chauffeur_id,
                },
            });

            //add the cash ride amount to chauffer wallet account.
            let existing_wallet_balance = 0.0;

            if (chauffeurPaymentRec) {
                //chauffeur_wa_id = chauffeurPaymentRec.id;
                existing_wallet_balance = chauffeurPaymentRec.wallet_balance;
                await ChauffeurWallet.update(
                    {
                        wallet_balance: parseFloat(existing_wallet_balance) + parseFloat(orderInfo.total_amount_to_be_paid),
                        transaction_date: transaction_dt
                    },
                    {
                        where: {
                            user_id: orderInfo.chauffeur_id,
                        }
                    }, { transaction });

            } else {
                const cw = await ChauffeurWallet.create({
                    user_id: orderInfo.chauffeur_id,
                    wallet_balance: parseFloat(orderInfo.total_amount_to_be_paid),
                    transaction_date: transaction_dt
                }, { transaction });
            }

            const userWalletRec = await CustomerWallet.findOne({
                where: { user_id: orderInfo.user_id }
            });

            let newPayment;
            //update wallet-balance if negative balance is adjusted
            if (orderInfo.wallet_balance_amount < 0) {
                if (userWalletRec) {
                    userWalletRec.update({ wallet_balance: 0.0 }, { transaction });
                } else {
                    await CustomerWallet.create({
                        user_id: orderInfo.user_id,
                        wallet_balance: existing_wallet_balance
                    }, { transaction });

                }
                newPayment = await CustomerWalletLog.create({
                    transaction_type_id: orderInfo.c_w_a_transaction_type_id,//
                    payment_type_id: orderInfo.payment_type_id,
                    wallet_balance: 0.0,
                    ride_amount: orderInfo.amount,
                    transaction_date: new Date().toISOString(),
                    user_id: orderInfo.user_id,
                    ride_id: orderInfo.ride_id,
                    adjusted_ride_amount: orderInfo.wallet_balance_amount,
                    amount_to_be_paid: orderInfo.total_amount_to_be_paid,
                    is_paid: true,
                    chauffeur_id: orderInfo.chauffeur_id,
                    payment_status_id: orderInfo.payment_completed_status_id,
                    coupon_id: orderInfo.coupon_ids,
                    is_coupon_applied: orderInfo.is_coupon_applied,
                    base_fare: orderInfo.base_fare,
                    rates: orderInfo.rates,
                    rate_type: orderInfo.rate_type,
                    mandatory_charges: orderInfo.mandatory_charges,
                    other_charges: orderInfo.other_charges,
                    vat: orderInfo.vat,
                    is_invoice_created: orderInfo.is_invoice_created,
                    discount_amount: orderInfo.discount_amount,
                    ride_minutes: orderInfo.estimated_time_in_minutes,
                    customer_wallet_id: userWalletRec.id,
                    total_after_discount: orderInfo.total_after_discount,
                    admin_id: orderInfo.admin_id,
                    final_price_calculation: orderInfo.final_result
                }, { transaction });

            } else {
                newPayment = await Payments.create({
                    payment_type_id: orderInfo.payment_type_id,
                    method: orderInfo.method,
                    currency: orderInfo.currency,
                    amount: orderInfo.amount,
                    cust_ref: orderInfo.custRef,
                    cart_id_ref: orderInfo.cartidRef,
                    description: orderInfo.description,
                    order_ref: orderInfo.order_ref,
                    is_paid: orderInfo.is_paid,
                    user_id: orderInfo.user_id,
                    meta_data: orderInfo.metadata,
                    order_url: orderInfo.order_url,
                    ride_id: orderInfo.ride_id,
                    chauffeur_id: orderInfo.chauffeur_id,
                    discount_amount: orderInfo.discount_amount,
                    amount_to_be_paid: orderInfo.total_amount_to_be_paid,
                    payment_status_id: orderInfo.payment_completed_status_id,
                    coupon_id: orderInfo.coupon_ids,
                    is_coupon_applied: orderInfo.is_coupon_applied,
                    base_fare: orderInfo.base_fare,
                    rates: orderInfo.rates,
                    rate_type: orderInfo.rate_type,
                    mandatory_charges: orderInfo.mandatory_charges,
                    other_charges: orderInfo.other_charges,
                    vat: orderInfo.vat,
                    is_invoice_created: orderInfo.is_invoice_created,
                    ride_minutes: orderInfo.estimated_time_in_minutes,
                    total_after_discount: orderInfo.total_after_discount,
                    admin_id: orderInfo.admin_id,
                    final_price_calculation: orderInfo.final_result
                }, { transaction });
            }
            dmoResult.cash_payment_id = newPayment.id;

            //coupon usage 
            if (orderInfo.is_coupon_applied && orderInfo.coupon_ids !== null) {
                // console.log('coupon is not null');
                const newCouponUsageRec = await CouponUsage.create({
                    coupon_id: orderInfo.coupon_ids,
                    customer_id: orderInfo.user_id
                }, { transaction });
            } else {
                console.log('coupon is null');
            }


            const PK = `${orderInfo.user_id}`;
            const SK = `#${orderInfo.ride_id}`;
            const params = {
                TableName: "Rides",
                Key: { PK, SK },
                UpdateExpression: `SET #attrName = :statusVal,
    status_log = :statusLogVal,
    apple_pay_paid = :applePayPaidVal,
        paymentDetails = :paymentDetailsVal`,
                ConditionExpression: '#attrName = :expectedStatusVal',
                ExpressionAttributeNames: {
                    "#attrName": "status"
                },
                ExpressionAttributeValues: {
                    ":statusVal": orderInfo.c_r_c_status_name,
                    ":expectedStatusVal": orderInfo.c_r_p_status_name,
                    ":statusLogVal": orderInfo.status_log_details,
                    ":paymentDetailsVal": orderInfo.payment_details,
                    ":applePayPaidVal": true
                },
                ReturnValues: "UPDATED_NEW"
            };
            const command = new UpdateCommand(params);
            const response = await ddbDocClient.send(command);

            if (response.$metadata.httpStatusCode === 200) {
                dmoResult.success = true;
                dmoResult.payment_status = response.Attributes?.status;
                dmoResult.error = "";
                await transaction.commit();
            } else {
                if (transaction.finished !== "commit") {
                    await transaction.rollback();
                }
                dmoResult.success = false;
                dmoResult.payment_status = response.Attributes?.status;
                dmoResult.error_code = response.$metadata.httpStatusCode;
                dmoResult.error = "failed to update ride status";
            }
            await addServerLog({
                log_level: "ERROR",                         // required
                error_message: `create admin cash payment record ${dmoResult.success}, error - ${dmoResult.error} `   // required
                // Optional fields like service_name, endpoint, status_code, metadata can be omitted.
            });
            return {
                cashOutput: dmoResult
            }
        } catch (error) {
            // console.log('cash payment record dao error -', error.message);
            await transaction.rollback();
            await addServerLog({
                log_level: "ERROR",
                service_name: "createAdminCashPaymentRecord",
                error_message: `createAdminCashPaymentRecord DAO error - ${error.message}.`
            });


            let error_description = '';
            if (error.name === "SequelizeUniqueConstraintError") {
                error_description = `${error.errors[0].message} for user id ${orderInfo.user_id} `;
            } else {
                error_description = error.message;
            }

            //error_description = error_description;
            dmoResult.success = false;
            dmoResult.error_code = 500;
            dmoResult.error = error_description;
            return {
                cashOutput: dmoResult,
            }
        }
    },

    getChauffeurWalletLogs: async (start_date, end_date) => {
        try {

            const chauffeurWalletLogs = await ChauffeurWalletLog.findAll({
                where: {
                    createdAt: { [Op.between]: [start_date, end_date] }
                },
                order: [
                    ['createdAt', 'DESC']
                ],
                raw: true
            });
            const uniqueUserIds = [
                ...new Set([
                    ...chauffeurWalletLogs.map(log => log.user_id),
                    ...chauffeurWalletLogs.map(log => log.hand_over_user_id)
                ])
            ];

            const users = await User.findAll({
                where: { id: uniqueUserIds },
                attributes: ['id', 'first_name', 'last_name'],
                raw: true
            });
            const userMap = {};
            users.forEach(user => {
                userMap[user.id] = user.first_name + ' ' + user.last_name;
            });

            const enrichedLogs = chauffeurWalletLogs.map(log => ({
                id: log.id,
                user_id: log.user_id,
                user_name: userMap[log.user_id] || null,
                pd_user_id: log.pd_user_id,
                pd_user_name: userMap[log.pd_user_id] || null,
                pd_transaction_date: log.pd_transaction_date,
                hand_over_amount: log.hand_over_amount,
                has_handed_over: log.has_handed_over,
                chauffeur_wallet_id: log.chauffeur_wallet_id,
                createdAt: log.createdAt,
                updatedAt: log.updatedAt,
            }));

            return enrichedLogs;
        } catch (error) {
            await addServerLog({
                log_level: "ERROR",
                service_name: "getChauffeurWalletLogs",
                error_message: `getChauffeurWalletLogs DAO error - ${error.message}.`
            });
            console.error(`Error in getting chauffeur wallet logs ${error.message} `);
            throw new Error(`Error in getting chauffeur wallet logs ${error.message} `);
        }
    },

    getPDWalletLogs: async (start_date, end_date) => {
        try {
            const pdWalletLogs = await PDWalletLog.findAll({
                where: {
                    createdAt: { [Op.between]: [start_date, end_date] }
                },
                order: [
                    ['createdAt', 'DESC']
                ],
                raw: true
            });

            const uniqueUserIds = [
                ...new Set([
                    ...pdWalletLogs.map(log => log.user_id),
                    ...pdWalletLogs.map(log => log.hand_over_user_id)
                ])
            ];

            const users = await User.findAll({
                where: { id: uniqueUserIds },
                attributes: ['id', 'first_name', 'last_name'],
                raw: true
            });
            const userMap = {};
            users.forEach(user => {
                userMap[user.id] = user.first_name + ' ' + user.last_name;
            });

            const enrichedLogs = pdWalletLogs.map(log => ({
                id: log.id,
                user_id: log.user_id,
                user_name: userMap[log.user_id] || null,
                hand_over_user_id: log.hand_over_user_id,
                hand_over_user_name: userMap[log.hand_over_user_id] || null,
                hand_over_transaction_date: log.hand_over_transaction_date,
                hand_over_amount: log.hand_over_amount,
                has_handed_over: log.has_handed_over,
                createdAt: log.createdAt,
                updatedAt: log.updatedAt,
            }));

            return enrichedLogs;

        } catch (error) {
            await addServerLog({
                log_level: "ERROR",
                service_name: "getPDWalletLogs",
                error_message: `getPDWalletLogs DAO error - ${error.message}.`
            });
            console.error(`Error in getting pd wallet logs ${error.message} `);
            throw new Error(`Error in getting pd wallet logs ${error.message} `);
        }
    },

    getAdminWalletLogs: async (start_date, end_date) => {
        try {
            const adminWalletLogs = await AdminWallet.findAll({
                where: {
                    createdAt: { [Op.between]: [start_date, end_date] }
                },
                order: [
                    ['createdAt', 'DESC']
                ],
                raw: true
            });
            const uniqueUserIds = [
                ...new Set([
                    ...adminWalletLogs.map(log => log.user_id),
                    ...adminWalletLogs.map(log => log.hand_over_user_id)
                ])
            ];

            const users = await User.findAll({
                where: { id: uniqueUserIds },
                attributes: ['id', 'first_name', 'last_name'],
                raw: true
            });
            const userMap = {};
            users.forEach(user => {
                userMap[user.id] = user.first_name + ' ' + user.last_name;
            });

            const enrichedLogs = adminWalletLogs.map(log => ({
                id: log.id,
                user_id: log.user_id,
                user_name: userMap[log.user_id] || null,
                wallet_balance: log.wallet_balance,
                transaction_date: log.transaction_date,
                hand_over_user_id: log.hand_over_user_id,
                hand_over_user_name: userMap[log.hand_over_user_id] || null,
                hand_over_transaction_date: log.hand_over_transaction_date,
                hand_over_amount: log.hand_over_amount,
                createdAt: log.createdAt,
                updatedAt: log.updatedAt,
            }));

            return enrichedLogs;
        } catch (error) {
            await addServerLog({
                log_level: "ERROR",
                service_name: "getAdminWalletLogs",
                error_message: `getAdminWalletLogs DAO error - ${error.message}.`
            });
            console.error(`Error in getting admin wallet logs ${error.message} `);
            throw new Error(`Error in getting admin wallet logs ${error.message} `);
        }
    },
    getChauffeurBasedRideDetails: async (chauffeur_id, cash_payment_type_id, start_date, end_date) => {
        try {
            const whereClause = {};
            if (start_date && end_date) {
                whereClause.createdAt = {
                    [Op.between]: [start_date, end_date]
                };
            }

            if (chauffeur_id > 0) {
                whereClause.chauffeur_id = chauffeur_id;
            }

            if (cash_payment_type_id > 0) {
                whereClause.payment_type_id = cash_payment_type_id;
            }

            const paymentsRec = await Payments.findAll({
                where: whereClause,
                attributes: ['ride_id', 'amount_to_be_paid', 'chauffeur_id', [literal('0'), 'adjusted_ride_amount']],
                order: [['createdAt', 'DESC']]
            });

            const customerWalletRec = await CustomerWalletLog.findAll({
                where: whereClause,
                attributes: ['ride_id', 'amount_to_be_paid', 'chauffeur_id', 'adjusted_ride_amount'],
                order: [['createdAt', 'DESC']]
            });

            let ridesRec = {
                paymentsRec,
                customerWalletRec
            }

            return ridesRec;
        } catch (error) {
            console.log(error);
            await addServerLog({
                log_level: "ERROR",
                service_name: "getChauffeurBasedRideDetails",
                error_message: `getChauffeurBasedRideDetails DAO error - ${error.message}.`
            });
            throw new Error(error.message);
        }
    },
    createAdminWalletPaymentRecord: async (orderInfo) => {
        console.log('createAdminWalletPaymentRecord input', orderInfo);
        const transaction = await sequelize.transaction();
        let dmoResult = {};
        try {
            const userPaymentRec = await CustomerWallet.findOne({
                where: {
                    user_id: orderInfo.user_id,
                },
            });

            if (!userPaymentRec) {
                dmoResult.success = false;
                dmoResult.error = 'Please Top up Customer Wallet Balance';
                return {
                    walletOutput: dmoResult
                }
            }

            //status log update
            orderInfo.status_log_details.push({
                datetime: new Date().toISOString(),
                status: `${orderInfo.c_r_c_status_name} `,
            });

            let payment_details = {
                card: null,
                payment_method: "Wallet"
            };
            orderInfo.payment_details = payment_details;

            let adjusted_amount = 0.0;
            let total_amount_to_be_paid = 0.0;
            let prev_wallet_balance = userPaymentRec.wallet_balance;

            //if (userPaymentRec.wallet_balance >= orderInfo.amount) {
            if (userPaymentRec.wallet_balance > 0) {
                existing_wallet_balance = userPaymentRec.wallet_balance - orderInfo.total_amount_to_be_paid;
                total_amount_to_be_paid = orderInfo.total_amount_to_be_paid;

                //await CustomerWallet.update(
                await userPaymentRec.update(
                    { wallet_balance: existing_wallet_balance, },
                    {
                        where: {
                            user_id: orderInfo.user_id,
                        }
                    }, { transaction });


                const newWalletRec = await CustomerWalletLog.create({
                    transaction_type_id: orderInfo.w_d_transaction_type_id,
                    payment_type_id: orderInfo.payment_type_id,
                    wallet_balance: existing_wallet_balance,
                    ride_amount: orderInfo.amount,
                    transaction_date: new Date().toISOString(),
                    user_id: orderInfo.user_id,
                    ride_id: orderInfo.ride_id,
                    adjusted_ride_amount: adjusted_amount,
                    amount_to_be_paid: total_amount_to_be_paid,
                    is_paid: true,
                    chauffeur_id: orderInfo.chauffeur_id,
                    payment_status_id: orderInfo.payment_completed_status_id,
                    customer_wallet_id: userPaymentRec.id,
                    coupon_id: orderInfo.coupon_ids,
                    discount_amount: orderInfo.discount_amount,
                    is_coupon_applied: orderInfo.is_coupon_applied,
                    base_fare: orderInfo.base_fare,
                    rates: orderInfo.rates,
                    rate_type: orderInfo.rate_type,
                    mandatory_charges: orderInfo.mandatory_charges,
                    other_charges: orderInfo.other_charges,
                    vat: orderInfo.vat,
                    is_invoice_created: orderInfo.is_invoice_created,
                    ride_minutes: orderInfo.estimated_time_in_minutes,
                    total_after_discount: orderInfo.total_after_discount,
                    admin_id: orderInfo.admin_id,
                    final_price_calculation: orderInfo.final_result
                }, { transaction });

                //coupon usage 
                if (orderInfo.is_coupon_applied && orderInfo.coupon_ids !== null) {
                    console.log('coupon is not null');
                    const newCouponUsageRec = await CouponUsage.create({
                        coupon_id: orderInfo.coupon_ids,
                        customer_id: orderInfo.user_id
                    }, { transaction });
                } else {
                    console.log('coupon is null');
                }

                const PK = `${orderInfo.user_id}`;
                const SK = `#${orderInfo.ride_id}`;
                const params = {
                    TableName: "Rides",
                    Key: { PK, SK }, // identify key based row
                    UpdateExpression: `SET #attrName = :statusVal,
    status_log = :statusLogVal,
        paymentDetails = :paymentDetailsVal`,
                    ConditionExpression: '#attrName = :expectedStatusVal',
                    ExpressionAttributeNames: {
                        "#attrName": "status"
                    },
                    ExpressionAttributeValues: {
                        ":statusVal": orderInfo.c_r_c_status_name,
                        ":expectedStatusVal": orderInfo.c_r_p_status_name,
                        ":statusLogVal": orderInfo.status_log_details,
                        ":paymentDetailsVal": orderInfo.payment_details
                    },
                    ReturnValues: "UPDATED_NEW"
                };
                const command = new UpdateCommand(params);
                const response = await ddbDocClient.send(command);
                if (response.$metadata.httpStatusCode === 200) {
                    dmoResult.success = true;
                    dmoResult.payment_status = response.Attributes?.status;
                    dmoResult.balance = newWalletRec.wallet_balance;
                    dmoResult.outstanding_balance = (newWalletRec.outstanding_balance ?? 0).toFixed(2);
                    dmoResult.ride_amount = newWalletRec.ride_amount;
                    dmoResult.adjusted_amount = adjusted_amount;
                    dmoResult.total_amount_to_be_paid = total_amount_to_be_paid.toFixed(2);
                    dmoResult.prev_wallet_balance = prev_wallet_balance;

                    await transaction.commit();
                } else {
                    if (transaction && transaction.finished !== "commit") {
                        await transaction.rollback();
                    }

                    dmoResult.success = false;
                    dmoResult.payment_status = response.Attributes?.status;
                    dmoResult.error_code = response.$metadata.httpStatusCode;
                    dmoResult.error = response.$metadata;
                }

                return {
                    walletOutput: dmoResult
                }
            } else {

                if (transaction && transaction.finished !== "commit") {
                    await transaction.rollback();
                }
                dmoResult.success = false;
                dmoResult.balance = userPaymentRec.wallet_balance;
                dmoResult.error = "Please top up the Wallet as the Balance is less than or equal to 0";
                return {
                    walletOutput: dmoResult
                }
            }
        } catch (error) {
            console.log('admin wallet payment record dao error -', error.message);
            if (transaction && transaction.finished !== "commit" && transaction.finished !== "rollback") {
                await transaction.rollback();
            }
            await addServerLog({
                log_level: "ERROR",
                service_name: "createAdminWalletPaymentRecord",
                error_message: `createAdminWalletPaymentRecord DAO error - ${error.message}.`
            });

            let error_description = '';
            if (error.name === "SequelizeUniqueConstraintError") {
                error_description = `${error.errors[0].message} for user id ${orderInfo.user_id} `;
            }
            if (error.name === "ConditionalCheckFailedException") {
                error_description = "Condition failed: The item does not meet the required condition.";
            } else if (error.name === "ResourceNotFoundException") {
                error_description = "Table or item not found.";
            } else if (error.name === "ProvisionedThroughputExceededException") {
                error_description = "Throughput limit exceeded. Consider increasing capacity.";
            } else if (error.name === "ValidationException") {
                error_description = "Validation error. Check your update expression.";
            } else {
                error_description = error.message;
            }
            dmoResult.success = false;
            dmoResult.error_code = 500;
            dmoResult.error = error_description;
            throw new Error(error_description);
            // return {
            //     walletOutput: dmoResult,
            // }
        }
    },
    createQuickLinkPaymentRecord: async (orderInfo) => {
        //console.log('createQuickLinkPaymentRecord input', orderInfo);
        const transaction = await sequelize.transaction();
        let dmoResult = {};
        try {

            orderInfo.status_log_details.push({
                datetime: new Date().toISOString(),
                status: `${orderInfo.c_p_p_status_name} `,
            });

            let payment_details = {
                card: null,
                payment_method: "QLink"
            };
            orderInfo.payment_details = payment_details;

            let adjusted_amount = 0.0;
            let total_amount_to_be_paid = 0.0;

            const newWalletRec = await CustomerWalletLog.create({
                transaction_type_id: orderInfo.w_c_transaction_type_id,
                payment_type_id: orderInfo.payment_type_id,
                wallet_balance: existing_wallet_balance,
                ride_amount: orderInfo.amount,
                transaction_date: new Date().toISOString(),
                user_id: orderInfo.user_id,
                ride_id: orderInfo.ride_id,
                adjusted_ride_amount: adjusted_amount,
                amount_to_be_paid: orderInfo.total_amount_to_be_paid,
                is_paid: false,
                chauffeur_id: orderInfo.chauffeur_id,
                payment_status_id: orderInfo.payment_pending_status_id,
                customer_wallet_id: corporateWalletRec.id,
                discount_amount: orderInfo.discount_amount,
                coupon_id: orderInfo.coupon_ids,
                is_coupon_applied: orderInfo.is_coupon_applied,
                base_fare: orderInfo.base_fare,
                rates: orderInfo.rates,
                rate_type: orderInfo.rate_type,
                mandatory_charges: orderInfo.mandatory_charges,
                other_charges: orderInfo.other_charges,
                vat: orderInfo.vat,
                is_invoice_created: orderInfo.is_invoice_created,
                ride_minutes: orderInfo.estimated_time_in_minutes,
                total_after_discount: orderInfo.total_after_discount,
                is_zeizzu_org: orderInfo.is_arg
            }, { transaction });

            if (orderInfo.is_coupon_applied && orderInfo.coupon_ids !== null) {
                console.log('coupon is not null');
                const newCouponUsageRec = await CouponUsage.create({
                    coupon_id: orderInfo.coupon_ids,
                    customer_id: orderInfo.user_id
                }, { transaction });
            } else {
                console.log('coupon is null');
            }

            const PK = `${orderInfo.user_id}`;
            const SK = `#${orderInfo.ride_id}`;
            const params = {
                TableName: "Rides",
                Key: { PK, SK }, // identify key based row
                UpdateExpression: `SET #attrName = :statusVal,
    status_log = :statusLogVal,
        paymentDetails = :paymentDetailsVal`,
                ConditionExpression: '#attrName = :expectedStatusVal',
                ExpressionAttributeNames: {
                    "#attrName": "status"
                },
                ExpressionAttributeValues: {
                    ":statusVal": orderInfo.c_p_p_status_name, //orderInfo.c_r_c_status_name,
                    ":expectedStatusVal": orderInfo.c_r_p_status_name,
                    ":statusLogVal": orderInfo.status_log_details,
                    ":paymentDetailsVal": orderInfo.payment_details
                },
                ReturnValues: "UPDATED_NEW"
            };
            const command = new UpdateCommand(params);
            const response = await ddbDocClient.send(command);
            if (response.$metadata.httpStatusCode === 200) {
                dmoResult.success = true;
                dmoResult.payment_status = response.Attributes?.status;
                dmoResult.balance = newWalletRec.wallet_balance;
                dmoResult.ride_amount = newWalletRec.ride_amount;
                dmoResult.adjusted_amount = adjusted_amount;
                dmoResult.total_amount_to_be_paid = total_amount_to_be_paid.toFixed(2);
                dmoResult.prev_wallet_balance = prev_wallet_balance;

                await transaction.commit();
            } else {
                if (transaction && transaction.finished !== "commit") {
                    await transaction.rollback();
                }

                dmoResult.success = false;
                dmoResult.payment_status = response.Attributes?.status;
                dmoResult.error_code = response.$metadata.httpStatusCode;
                dmoResult.error = response.$metadata;
            }

            return {
                walletOutput: dmoResult
            }

        } catch (error) {

            if (transaction && transaction.finished !== "commit" && transaction.finished !== "rollback") {
                await transaction.rollback();
            }
            await addServerLog({
                log_level: "ERROR",
                service_name: "createQuickLinkPaymentRecord",
                error_message: `createQuickLinkPaymentRecord DAO error - ${error.message}.`
            });
            let error_description = '';
            if (error.name === "ConditionalCheckFailedException") {
                error_description = "Condition failed: The item does not meet the required condition.";
            } else if (error.name === "ResourceNotFoundException") {
                error_description = "Table or item not found.";
            } else if (error.name === "ProvisionedThroughputExceededException") {
                error_description = "Throughput limit exceeded. Consider increasing capacity.";
            } else if (error.name === "ValidationException") {
                error_description = "Validation error. Check your update expression.";
            } else {
                error_description = error.message;
            }
            dmoResult.success = false;
            dmoResult.error_code = 500;
            dmoResult.error = error_description;
            throw new Error(error_description);
            // return {
            //     walletOutput: dmoResult,
            // }
        }
    },
    createCustomerApplePayPaymentRecord: async (orderInfo) => {

        //console.log('createCustomerApplePayPaymentRecord input', orderInfo);
        const transaction = await sequelize.transaction();
        let dmoResult = {};
        try {

            const userWalletRec = await CustomerWallet.findOne({
                where: { user_id: orderInfo.user_id }
            });
            //status log update
            orderInfo.status_log_details.push({
                datetime: new Date().toISOString(),
                status: `${orderInfo.c_a_c_status_name} `,
            });

            let payment_details = {
                card: null,
                payment_method: "Apple-Pay"
            };
            orderInfo.payment_details = payment_details;

            let adjusted_amount = 0.0;
            let total_amount_to_be_paid = 0.0;
            
            let newWalletRec;


            if (orderInfo.wallet_balance_amount < 0) {
                await userWalletRec.update({ wallet_balance: 0.0 }, { transaction });
                console.log('dao sale 2');
                newWalletRec = await CustomerWalletLog.create({
                    transaction_type_id: orderInfo.w_d_transaction_type_id,
                    payment_type_id: orderInfo.payment_type_id,
                    wallet_balance: 0.0, //
                    ride_amount: orderInfo.amount,
                    transaction_date: new Date().toISOString(),
                    user_id: orderInfo.user_id,
                    ride_id: orderInfo.ride_id,
                    adjusted_ride_amount: orderInfo.wallet_balance_amount,
                    amount_to_be_paid: orderInfo.total_amount_to_be_paid,
                    is_paid: orderInfo.is_paid,
                    chauffeur_id: orderInfo.chauffeur_id,
                    //payment_status_id: orderInfo.payment_completed_status_id,
                    coupon_id: orderInfo.coupon_ids,
                    is_coupon_applied: orderInfo.is_coupon_applied,
                    base_fare: orderInfo.base_fare,
                    rates: orderInfo.rates,
                    rate_type: orderInfo.rate_type,
                    mandatory_charges: orderInfo.mandatory_charges,
                    other_charges: orderInfo.other_charges,
                    vat: orderInfo.vat,
                    is_invoice_created: orderInfo.is_invoice_created,
                    discount_amount: orderInfo.discount_amount, //
                    ride_minutes: orderInfo.estimated_time_in_minutes,
                    customer_wallet_id: userWalletRec.id,
                    total_after_discount: orderInfo.total_after_discount,
                    final_price_calculation: orderInfo.final_result,
                    meta_data: orderInfo.metadata
                }, { transaction });
            } else {
            newWalletRec = await Payments.create({
                transaction_type_id: orderInfo.w_d_transaction_type_id,
                payment_type_id: orderInfo.payment_type_id,
                ride_amount: orderInfo.amount,
                transaction_date: new Date().toISOString(),
                user_id: orderInfo.user_id,
                ride_id: orderInfo.ride_id,
                adjusted_ride_amount: adjusted_amount,
                amount_to_be_paid: orderInfo.total_amount_to_be_paid,
                is_paid: orderInfo.is_paid,
                chauffeur_id: orderInfo.chauffeur_id,
                //payment_status_id: orderInfo.payment_completed_status_id,
                coupon_id: orderInfo.coupon_ids,
                discount_amount: orderInfo.discount_amount, //
                is_coupon_applied: orderInfo.is_coupon_applied,
                base_fare: orderInfo.base_fare,
                rates: orderInfo.rates,
                rate_type: orderInfo.rate_type,
                mandatory_charges: orderInfo.mandatory_charges,
                other_charges: orderInfo.other_charges,
                vat: orderInfo.vat,
                is_invoice_created: orderInfo.is_invoice_created,
                ride_minutes: orderInfo.estimated_time_in_minutes,
                total_after_discount: orderInfo.total_after_discount,
                cust_ref: orderInfo.custRef,
                cart_id_ref: orderInfo.cartidRef,
                currency: orderInfo.currency,
                amount: orderInfo.amount,
                final_price_calculation: orderInfo.final_result,
                meta_data: orderInfo.metadata,
                transaction_ref: orderInfo.transaction_ref,
                tip_amount: orderInfo.tip_amount
            }, { transaction });
        }

            //coupon usage 
            if (orderInfo.is_coupon_applied && orderInfo.coupon_ids !== null) {
                console.log('coupon is not null');
                const newCouponUsageRec = await CouponUsage.create({
                    coupon_id: orderInfo.coupon_ids,
                    customer_id: orderInfo.user_id
                }, { transaction });
            } else {
                console.log('coupon is null');
            }

            // tip update to chauffeur tip wallet
            if (orderInfo.tip_added && orderInfo.tip_amount > 0) {
                //console.log('adding tip to chauffeur wallet');
                    const amount = parseFloat(orderInfo.tip_amount);
                    const chauffeurId = orderInfo.chauffeur_id;
                    const transaction_dt = new Date();

                    // 1. Find wallet
                    let tipWallet = await ChauffeurTipWallet.findOne({
                        where: { chauffeur_id: chauffeurId },
                        transaction
                    });
                    //console.log('tipWallet', tipWallet);

                    // 2. Update or create wallet
                    if (tipWallet) {  
                        await ChauffeurTipWallet.update(
                            {
                                balance: parseFloat(tipWallet.balance) + amount,
                                //transaction_date: transaction_dt
                            },
                            { 
                                where: { chauffeur_id: chauffeurId },
                                transaction 
                            }
                        );
                    } else {
                        tipWallet = await ChauffeurTipWallet.create(
                            {
                                chauffeur_id: chauffeurId,
                                balance: amount,
                                //transaction_date: transaction_dt
                            },
                            { transaction }
                        );
                    }

                    //console.log('tipWallet after update/create', tipWallet);

                    // 3. Insert Tip Wallet Log
                    await ChauffeurTipWalletLog.create(
                        {
                            chauffeur_tip_wallet_id: tipWallet.id,
                            chauffeur_id: chauffeurId,
                            amount: amount,
                            previous_balance: parseFloat(tipWallet.balance),
                            current_balance: parseFloat(tipWallet.balance) + amount,
                            transaction_type: "CREDIT",
                            status: "SUCCESS",
                            ride_id: orderInfo.ride_id ?? null,
                            description: `Tip added for ride ${orderInfo.ride_id}`
                        },
                        { transaction }
                    );
                    //console.log('tip added to chauffeur wallet');
            }


            const PK = `${orderInfo.user_id}`;
            const SK = `#${orderInfo.ride_id}`;
            const params = {
                TableName: "Rides",
                Key: { PK, SK }, // identify key based row
                UpdateExpression: `SET #attrName = :statusVal,
                status_log = :statusLogVal,
                paymentDetails = :paymentDetailsVal,
                apple_pay_paid = :applePayPaidVal`,
                ConditionExpression: '#attrName = :expectedStatusVal',
                ExpressionAttributeNames: {
                    "#attrName": "status"
                },
                ExpressionAttributeValues: {
                    ":statusVal": orderInfo.c_a_c_status_name,
                    ":expectedStatusVal": orderInfo.c_r_p_status_name,
                    ":statusLogVal": orderInfo.status_log_details,
                    ":paymentDetailsVal": orderInfo.payment_details,
                    ":applePayPaidVal": true
                },
                ReturnValues: "UPDATED_NEW"
            };
            console.log('params', params);
            const command = new UpdateCommand(params);
            const response = await ddbDocClient.send(command);
            if (response.$metadata.httpStatusCode === 200) {
                dmoResult.success = true;
                dmoResult.payment_status = response.Attributes?.status;

                dmoResult.ride_amount = newWalletRec.ride_amount;
                dmoResult.adjusted_amount = adjusted_amount;
                dmoResult.total_amount_to_be_paid = total_amount_to_be_paid.toFixed(2);

                await transaction.commit();
            } else {
                if (transaction && transaction.finished !== "commit") {
                    await transaction.rollback();
                }

                dmoResult.success = false;
                dmoResult.payment_status = response.Attributes?.status;
                dmoResult.error_code = response.$metadata.httpStatusCode;
                dmoResult.error = response.$metadata;
            }

            return {
                walletOutput: dmoResult
            }
        } catch (error) {
            console.log('create customer apple pay payment record dao error -', error);
            if (transaction && transaction.finished !== "commit" && transaction.finished !== "rollback") {
                await transaction.rollback();
            }
            await addServerLog({
                log_level: "ERROR",
                service_name: "createCustomerApplePayPaymentRecord",
                error_message: `createCustomerApplePayPaymentRecord DAO error - ${error.message}.`
            });

            let error_description = '';
            if (error.name === "ConditionalCheckFailedException") {
                error_description = "Condition failed: The item does not meet the required condition.";
            } else if (error.name === "ResourceNotFoundException") {
                error_description = "Table or item not found.";
            } else if (error.name === "ProvisionedThroughputExceededException") {
                error_description = "Throughput limit exceeded. Consider increasing capacity.";
            } else if (error.name === "ValidationException") {
                error_description = "Validation error. Check your update expression.";
            } else {
                error_description = error.message;
            }
            dmoResult.success = false;
            dmoResult.error_code = 500;
            dmoResult.error = error_description;
            throw new Error(error_description);
            // return {
            //     walletOutput: dmoResult,
            // }
        }
    },

    getPDBasedTransDetails: async (pd_id, start_date, end_date) => {
        try {
            const whereClause = {};
            if (start_date && end_date) {
                whereClause.pd_transaction_date = {
                    [Op.between]: [start_date, end_date]
                };
            }

            if (pd_id > 0) {
                whereClause.pd_user_id = pd_id;
            }

            const pdWalletRec = await ChauffeurWalletLog.findAll({
                where: whereClause,
                include: [
                    {
                        model: User,
                        as: 'User',
                        attributes: ['first_name', 'last_name', 'id']
                    },
                    {
                        model: User,
                        as: 'PD-User',
                        attributes: ['first_name', 'last_name', 'id']
                    },

                ],
                attributes: ['user_id', 'pd_user_id', 'hand_over_amount', 'pd_transaction_date'],
                order: [['pd_transaction_date', 'DESC']]
            });

            let transRec = {
                pdWalletRec
            }

            return transRec;
        } catch (error) {
            console.log(error);
            await addServerLog({
                log_level: "ERROR",
                service_name: "getPDBasedTransDetails",
                error_message: `getPDBasedTransDetails DAO error - ${error.message}.`
            });
            throw new Error(error.message);
        }
    },

    creditReferralRewardToWallet: async (userId, amount) => {
        const transaction = await sequelize.transaction();
        try {
            let existingWallet = await CustomerWallet.findOne({ where: { user_id: userId } });

            const paymentStatuses = await Status.findAll({
                where: {
                    name: {
                        [Op.or]: ['Referral-Payment', 'Payment-Completed']
                    }
                }
            });

            // Extract the IDs
            const statusIds = paymentStatuses.map(status => ({
                name: status.name,
                id: status.id
            }));

            const referralStatus = statusIds.find(s => s.name === 'Referral-Payment')?.id;
            const completedStatus = statusIds.find(s => s.name === 'Payment-Completed')?.id;


            let newBalance = parseFloat(amount);
            if (existingWallet) {
                newBalance = parseFloat(existingWallet.wallet_balance) + newBalance;
                await CustomerWallet.update(
                    { wallet_balance: newBalance },
                    { where: { user_id: userId }, transaction }
                );
            } else {
                await CustomerWallet.create(
                    {
                        user_id: userId,
                        wallet_balance: newBalance,
                    },
                    { transaction }
                );
            }

            await CustomerWalletLog.create(
                {
                    user_id: userId,
                    top_up_amount: parseFloat(amount),
                    wallet_balance: newBalance,
                    transaction_type_id: referralStatus,
                    payment_type_id: null, // Optional: no payment method for referral
                    transaction_reference: `referral-${Date.now()}`,
                    transaction_date: new Date(),
                    ride_id: null,
                    is_paid: true,
                    payment_status_id: completedStatus,
                    base_fare: 0,
                    rates: 0,
                    rate_type: 'referral_reward',
                    mandatory_charges: 0,
                    other_charges: 0,
                    vat: 0,
                    is_invoice_created: false,
                    discount_amount: 0,
                    ride_minutes: 0,
                    is_coupon_applied: false,
                    coupon_id: null,
                },
                { transaction }
            );

            await transaction.commit();
            return { success: true, wallet_balance: newBalance };
        } catch (error) {
            await addServerLog({
                log_level: 'ERROR',
                service_name: 'creditReferralRewardToWallet',
                error_message: `Referral wallet update failed - ${error.message}`,
            });
            if (transaction.finished !== 'commit') {
                await transaction.rollback();
            }
            throw error;
        }
    },


    //get chauffeur ride details for all payment types for app
    getChauffeurAPTRideDetails: async (chauffeur_id, cash_payment_type_id, start_date, end_date) => {
        try {
            const whereClause = {};
            if (start_date && end_date) {
                whereClause.createdAt = {
                    [Op.between]: [start_date, end_date]
                };
            }

            if (chauffeur_id > 0) {
                whereClause.chauffeur_id = chauffeur_id;
            }

            if (cash_payment_type_id > 0) {
                whereClause.payment_type_id = cash_payment_type_id;
            }

            const paymentsRec = await Payments.findAll({
                where: whereClause,
                include: [
                    {
                        model: User,
                        as: 'User',
                        attributes: ['first_name', 'last_name', 'id']
                    },
                    {
                        model: PaymentType,
                        attributes: ['name', 'id'],
                    },
                    {
                        model: Status,
                        attributes: ['name', 'id'],
                    },
                ],
                attributes: ['ride_id', 'amount_to_be_paid', 'chauffeur_id', [literal('0'), 'adjusted_ride_amount'], 'payment_type_id', 'payment_status_id', 'coupon_id', 'discount_amount', 'base_fare', 'rates', 'rate_type', 'mandatory_charges', 'other_charges', 'vat', 'is_invoice_created', 'ride_minutes', 'total_after_discount'],
                order: [['createdAt', 'DESC']]
            });

            const customerWalletRec = await CustomerWalletLog.findAll({
                where: whereClause,
                include: [
                    {
                        model: User,
                        as: 'User',
                        attributes: ['first_name', 'last_name', 'id']
                    },
                    {
                        model: PaymentType,
                        attributes: ['name', 'id'],
                    },
                    {
                        model: Status,
                        attributes: ['name', 'id'],
                    },
                ],
                attributes: ['ride_id', 'amount_to_be_paid', 'chauffeur_id', 'adjusted_ride_amount', 'payment_type_id', 'transaction_type_id', 'top_up_amount', 'wallet_balance', 'adjusted_ride_amount', 'transaction_reference', 'amount_to_be_paid', 'discount_amount', 'coupon_id', 'base_fare', 'rates', 'rate_type', 'mandatory_charges', 'other_charges', 'vat', 'is_invoice_created', 'ride_minutes', 'total_after_discount'],
                order: [['createdAt', 'DESC']]
            });

            let ridesRec = {
                paymentsRec,
                customerWalletRec
            }

            return ridesRec;
        } catch (error) {
            console.log(error);
            await addServerLog({
                log_level: "ERROR",
                service_name: "getChauffeurAPTRideDetails",
                error_message: `getChauffeurAPTRideDetails DAO error - ${error.message}.`
            });
            throw new Error(error.message);
        }
    },
    getChauffeurHandOverDetailsById: async (userId, start_date, end_date) => {
        try {
            console.log('getChauffeurHandOverDetailsById input', userId, start_date, end_date);

            const whereClause = {};
            if (start_date && end_date) {
                whereClause.createdAt = {
                    [Op.between]: [new Date(start_date), new Date(end_date)]
                };
            }

            if (userId > 0) {
                whereClause.user_id = userId;
            }

            return await ChauffeurWalletLog.findAll({
                where: whereClause,
                include: [
                    {
                        model: User,
                        as: 'User',
                        attributes: ['first_name', 'last_name', 'id']
                    },
                    {
                        model: User,
                        as: 'PD-User',
                        attributes: ['first_name', 'last_name', 'id', 'role_id']
                    },
                ],
                attributes: ['pd_transaction_date', 'hand_over_amount', 'has_handed_over'],
                order: [['pd_transaction_date', 'DESC']]
            });
        } catch (error) {
            //console.log(error);
            await addServerLog({
                log_level: "ERROR",
                service_name: "getChauffeurHandOverDetailsById",
                error_message: `getChauffeurHandOverDetailsById DAO error - ${error.message}.`
            });
            throw new Error(error.message);
        }

    },

    findTopupTransRefByUser: async (customer_id, transaction_type_id) => {
        try {
            //console.log('findCardDetailsByUser input', customer_id);
            return await CustomerWalletLog.findAll({
                where: {
                    user_id: customer_id,
                    transaction_type_id
                },
                attributes: ['transaction_reference', 'user_id', 'transaction_date'],
            });
        } catch (error) {
            await addServerLog({
                log_level: "ERROR",
                service_name: "findTopupTransRefByUser",
                error_message: `findTopupTransRefByUser DAO error - ${error.message}.`
            });
            throw new Error(error.message);
        }

    },
    getPaymentTypeMethodWalletTopup: async () => {
        try {
            const paymentType = await PaymentType.findOne({
                where:
                {
                    [Op.and]: [
                        { name: 'Wallet-Topup' }
                    ]
                },
                attributes: ['id', 'name', 'is_active']
            });
            console.log('getPaymentTypeMethodWalletTopup output', paymentType);
            return paymentType;
        } catch (error) {
            await addServerLog({
                log_level: "ERROR",
                service_name: "getPaymentTypeMethodWalletTopup",
                error_message: `getPaymentTypeMethodWalletTopup DAO error - ${error.message}.`
            });
            throw error;
        }

    },
    createTelrResponseRecord: async (telrInfo) => {
        try {
            return await TelrPaymentLogs.create({
                request_meta_data: telrInfo.request_meta_data,
                response_meta_data: telrInfo.response_meta_data,
                user_id: telrInfo.user_id,
                payment_type: telrInfo.payment_type,
                transaction_type: telrInfo.transaction_type,
                ride_id: telrInfo.ride_id
            });

        } catch (error) {
            await addServerLog({
                log_level: "ERROR",
                service_name: "createTelrResponseRecord",
                error_message: `createTelrResponseRecord DAO error - ${error.message}.`
            });
            throw error;
        }
    },

    getCouponUsageDetails: async (start_date, end_date, page, limit) => {
        try {
            const offset = (page - 1) * limit;

            const start_date_utc = start_date ? new Date(start_date).toISOString() : null;
            //const end_date_utc = end_date ? new Date(end_date).toISOString() : null;
            const end_date_utc = new Date(end_date + 'T' + new Date().toTimeString().split(' ')[0]);
            //console.log('start_date_utc', start_date_utc);
            //console.log('end_date_utc', end_date_utc);
            const whereClause = {};
            if (start_date && end_date) {
                whereClause.createdAt = {
                    [Op.between]: [start_date_utc, end_date_utc]
                };
            }

            const rows = await CouponMaster.findAll({
                include: [
                    {
                        model: CouponUsage,
                        as: 'couponUsages',
                        where: whereClause,
                        include: [
                            {
                                model: User,
                                attributes: ['first_name', 'last_name', 'id']
                            },
                        ],
                        attributes: ['coupon_id', 'customer_id'],
                        //group: ['customer_id']
                    },

                ],
                attributes: ['id',
                    'coupon_title',
                    'coupon_code',
                    'valid_from',
                    'valid_to',
                    'usage_limit',
                    'is_active',],
                //roup: ["CouponMaster.id"],
                limit,
                offset,
                distinct: true,
                order: [['id', 'DESC']]
            });
            const count = await CouponUsage.count({
                where: whereClause,
                distinct: true,
            });
            //console.log('coupon usage count', rows[0].couponUsages.length);

            let couponUsageRec = {
                totalRecords: count,
                totalPages: Math.ceil(count / limit),
                currentPage: page,
                perPage: limit,
                data: rows
            }
            return couponUsageRec;
        } catch (error) {
            console.log(error);
            await addServerLog({
                log_level: "ERROR",
                service_name: "getCouponUsageDetails",
                error_message: `getCouponUsageDetails DAO error - ${error.message}.`
            });
            throw new Error(error.message);
        }
    },
    getCouponWiseUsageDetails: async (start_date, end_date, page, limit, coupon_id) => {
        try {
            const offset = (page - 1) * limit;

            const start_date_utc = start_date ? new Date(start_date).toISOString() : null;
            //const end_date_utc = end_date ? new Date(end_date).toISOString() : null;
            const end_date_utc = new Date(end_date + 'T' + new Date().toTimeString().split(' ')[0]);
            //console.log('start_date_utc', start_date_utc);
            //console.log('end_date_utc', end_date_utc);
            const whereClause = {};
            if (start_date && end_date) {
                whereClause.createdAt = {
                    [Op.between]: [start_date_utc, end_date_utc]
                };
            }

            if (coupon_id) {
                whereClause.coupon_id = coupon_id;
            }

            const rows = await CouponUsage.findAll({
                where: whereClause,
                include: [
                    {
                        model: User,
                        attributes: ['first_name', 'last_name']
                    },
                ],
                attributes: ['customer_id', [fn('COUNT', col('customer_id')), 'usageCount']],
                group: ['customer_id', 'first_name', 'last_name', 'User.id'],
                limit,
                offset,
                distinct: true,
            });
            const count = await CouponUsage.count({
                where: whereClause,
                distinct: true,
            });
            //console.log('coupon usage count', rows);

            let couponUsageRec = {
                totalRecords: count,
                totalPages: Math.ceil(count / limit),
                currentPage: page,
                perPage: limit,
                data: rows
            }
            return couponUsageRec;
        } catch (error) {
            //console.log(error);
            await addServerLog({
                log_level: "ERROR",
                service_name: "getCouponWiseUsageDetails",
                error_message: `getCouponWiseUsageDetails DAO error - ${error.message}.`
            });
            throw new Error(error.message);
        }
    },
    //added 20-Jun-2025
    getChaufferWalletLogRec: async (user_id) => {
        try {
            return await ChauffeurWallet.findOne({
                where: {
                    user_id
                },
                attributes: ['wallet_balance']
            });
        } catch (error) {
            await addServerLog({
                log_level: "ERROR",
                service_name: "getChaufferWalletLogRec",
                error_message: `getChaufferWalletLogRec DAO error - ${error.message}.`
            });
            throw error;
        }
    },
    //added 20-Jun-2025
    getPDHandOverDetailsById: async (userId, start_date, end_date) => {
        try {
            console.log('getPDHandOverDetailsById input', userId, start_date, end_date);
            const start_date_obj = new Date(start_date).toISOString().split('T')[0];
            const end_date_obj = new Date(end_date).toISOString().split('T')[0];

            const whereClause = {};
            if (start_date && end_date) {
                whereClause[Op.and] = [
                    literal(`DATE("hand_over_transaction_date") between '${start_date_obj}' AND '${end_date_obj}'`),
                ]
            }

            if (userId > 0) {
                whereClause.user_id = userId;
            }

            return await PDWalletLog.findAll({
                where: whereClause,
                include: [
                    {
                        model: User,
                        as: 'User',
                        attributes: ['first_name', 'last_name', 'id']
                    },
                    {
                        model: User,
                        as: 'Hand-Over-User',
                        attributes: ['first_name', 'last_name', 'id', 'role_id']
                    },
                ],
                attributes: ['hand_over_transaction_date', 'hand_over_amount', 'has_handed_over'],
                order: [['hand_over_transaction_date', 'DESC']]
            });
        } catch (error) {
            console.log(error);
            await addServerLog({
                log_level: "ERROR",
                service_name: "getPDHandOverDetailsById",
                error_message: `getPDHandOverDetailsById DAO error - ${error.message}.`
            });
            throw new Error(error.message);
        }

    },
    //added 20-Jun-2025
    getPDWalletLogRec: async (user_id) => {
        try {
            return await PDWallet.findOne({
                where: {
                    user_id
                },
                attributes: ['wallet_balance']
            });
        } catch (error) {
            await addServerLog({
                log_level: "ERROR",
                service_name: "getPDWalletLogRec",
                error_message: `getPDWalletLogRec DAO error - ${error.message}.`
            });
            throw error;
        }
    },

    getUserCardsById: async (userId) => {
        try {
            console.log('getUserCardsById input', userId);

            return await SavedCards.findAll({
                where: {
                    user_id: userId,
                    is_active: true
                },
                attributes: ['slug_id', 'name', 'logo', 'card_bin', 'card_end', 'pay_method'],
                order: [['createdAt', 'DESC']]
            });
        } catch (error) {
            console.log(error);
            await addServerLog({
                log_level: "ERROR",
                service_name: "getUserCardsById",
                error_message: `getUserCardsById DAO error - ${error.message}.`
            });
            throw new Error(error.message);
        }
    },

    deleteUserCardById: async (userId, slug_id) => {
        try {
            console.log('deleteUserCardById input', userId, slug_id);

            return await SavedCards.update(
                { is_active: false },
                {
                    where: {
                        user_id: userId,
                        slug_id: slug_id,
                        is_active: true
                    }
                }
            );
        } catch (error) {
            console.log(error);
            await addServerLog({
                log_level: "ERROR",
                service_name: "deleteUserCardById",
                error_message: `deleteUserCardById DAO error - ${error.message}.`
            });
            throw new Error(error.message);
        }
    },
};

