const Joi = require('joi');

const verifyPaymentSchema = Joi.object({
    country_code: Joi.string().pattern(/^\+\d{1,4}$/).required(),
    mobile_number: Joi.string().pattern(/^[0-9]{7,15}$/),
    fore_names: Joi.string().min(2).max(50).required(),
    sur_name: Joi.string().min(2).max(50).required(),
    payment_type: Joi.string().required(),
});

const salePaymentSchema = Joi.object({
    ride_id: Joi.string().required(),
    payment_type: Joi.string().required(),
    slug_id: Joi.string().required(),
    customer_id: Joi.string().required(),
    coupon_ids: Joi.array()
        .items(Joi.number().integer())
        .default([])
});

const rideDataSchema = Joi.object({
    ride_id: Joi.string().required(),
    status: Joi.string().required(),
});

const paymentTypeSchema = Joi.object({
    is_active: Joi.boolean().required()
});

const walletPaymentSchema = Joi.object({
    customer_id: Joi.string().required(),
    ride_id: Joi.string().required(),
    payment_type: Joi.string().required(), //wallet-payment
    coupon_ids: Joi.array()
        .items(Joi.number().integer())
        .default([])
});

const cashPaymentSchema = Joi.object({
    ride_id: Joi.string().required(),
    payment_type: Joi.string().required(),
    customer_id: Joi.string().required(),
    coupon_ids: Joi.array()
        .items(Joi.number().integer())
        .default([])
});

const chauffeurRideDataSchema = Joi.object({
    ride_id: Joi.string().required(),
    customer_id: Joi.string().required(),
    is_active: Joi.boolean().required()
});

const ridePaymentStatusDataSchema = Joi.object({
    ride_id: Joi.string().required(),
});

const walletTopupSchema = Joi.object({
    customer_id: Joi.string().required(),
    payment_type: Joi.string().required(), //wallet-payment
    topup_amount: Joi.string().regex(/^\d+(\.\d{1,2})?$/).required(),
    slug_id: Joi.string().required(),
});
const corporateWalletPaymentSchema = Joi.object({
    customer_id: Joi.string().required(),
    ride_id: Joi.string().required(),
    payment_type: Joi.string().required(), //wallet-payment
    coupon_code: Joi.string().optional(),
    is_org: Joi.boolean().required(),
    coupon_ids: Joi.array()
        .items(Joi.number().integer())
        .default([])
});

const paymentTypesSchema = Joi.object({
    name: Joi.string().min(4).max(100).required(),
    for_display: Joi.boolean().required(),
    is_active: Joi.boolean().required()
});

const corporateRideDataSchema = Joi.object({
    customer_id: Joi.string().required(),
});


const paymentChauffeurCashSchema = Joi.object({
    pd_user_id: Joi.string().required(),
    //hand_over_amount: Joi.string().regex(/^\d+(\.\d{1,2})?$/).required(),
    hand_over_amount: Joi.number().precision(2).positive().required()
});

const paymentPDCashSchema = Joi.object({
    hand_over_user_id: Joi.string().required(),
    //hand_over_amount: Joi.string().regex(/^\d+(\.\d{1,2})?$/).required(),
    hand_over_amount: Joi.number().precision(2).positive().required()
});
const roleNameSchema = Joi.object({
    role_name: Joi.string().required(),
});

const corporatePendingPaymentSchema = Joi.object({
    customer_id: Joi.string().required(),
    ride_ids: Joi.array()
        .items(Joi.string().length(7)).required(),
    hand_over_amount: Joi.string().regex(/^\d+(\.\d{1,2})?$/).required(),
});

const adminCashPaymentSchema = Joi.object({
    ride_id: Joi.string().required(),
    payment_type: Joi.string().required(),
    customer_id: Joi.string().required(),
    coupon_ids: Joi.array()
        .items(Joi.number().integer())
        .default([]),
    chauffeur_id: Joi.string().required()
});

const adminWalletPaymentSchema = Joi.object({
    customer_id: Joi.string().required(),
    ride_id: Joi.string().required(),
    payment_type: Joi.string().required(), //wallet-payment
    coupon_ids: Joi.array()
        .items(Joi.number().integer())
        .default([]),
    chauffeur_id: Joi.string().required()
});

const quickLinkPaymentSchema = Joi.object({
    customer_id: Joi.string().required(),
    ride_id: Joi.string().required(),
    payment_type: Joi.string().required(), //wallet-payment
    coupon_ids: Joi.array()
        .items(Joi.number().integer())
        .default([]),
});

const customerApplePayPaymentSchema = Joi.object({
    ride_id: Joi.string().required(),
    payment_type: Joi.string().required(),
    customer_id: Joi.string().required(),
    coupon_ids: Joi.array()
        .items(Joi.number().integer())
        .default([]),
    transactionId: Joi.string().required(),
    ephemeralPublicKey: Joi.string().required(),
    publicKeyHash: Joi.string().required(),
    data: Joi.string().required(),
    signature: Joi.string().required(),
    version: Joi.string().required(),
    network: Joi.string().required(),
    type: Joi.string().required(),
    displayName: Joi.string().required(),
    transactionIdentifier: Joi.string().required(),
});


const refundPaymentSchema = Joi.object({
    slug_id: Joi.string().required(),
    customer_id: Joi.string().required(),
    refund_amount: Joi.number().precision(2).positive().required()
});

const customerDataSchema = Joi.object({
    customer_id: Joi.string().required(),
});

module.exports = {
    verifyPaymentValidator: (data) => {
        return verifyPaymentSchema.validateAsync(data);
    },
    salePaymentValidator: (data) => {
        return salePaymentSchema.validateAsync(data);
    },
    rideDataValidator: (data) => {
        return rideDataSchema.validateAsync(data);
    },
    paymentTypeActiveValidator: (data) => {
        return paymentTypeSchema.validateAsync(data);
    },
    walletPaymentValidator: (data) => {
        return walletPaymentSchema.validateAsync(data);
    },
    cashPaymentValidator: (data) => {
        return cashPaymentSchema.validateAsync(data);
    },
    chauffeurRideDataValidator: (data) => {
        return chauffeurRideDataSchema.validateAsync(data);
    },
    ridePaymentStatusDataValidator: (data) => {
        return ridePaymentStatusDataSchema.validateAsync(data);
    },
    walletTopupValidator: (data) => {
        return walletTopupSchema.validateAsync(data);
    },
    corporateWalletPaymentValidator: (data) => {
        return corporateWalletPaymentSchema.validateAsync(data);
    },
    paymentTypesValidator: (data) => {
        return paymentTypesSchema.validateAsync(data);
    },
    corporateRideDataValidator: (data) => {
        return corporateRideDataSchema.validateAsync(data);
    },
    paymentChauffeurCashValidator: (data) => {
        return paymentChauffeurCashSchema.validateAsync(data);
    },
    paymentPDCashValidator: (data) => {
        return paymentPDCashSchema.validateAsync(data);
    },
    roleNameValidator: (data) => {
        return roleNameSchema.validateAsync(data);
    },
    corporatePendingPaymentValidator: (data) => {
        return corporatePendingPaymentSchema.validateAsync(data);
    },
    adminCashPaymentValidator: (data) => {
        return adminCashPaymentSchema.validateAsync(data);
    },
    adminWalletPaymentValidator: (data) => {
        return adminWalletPaymentSchema.validateAsync(data);
    },
    quickLinkPaymentValidator: (data) => {
        return quickLinkPaymentSchema.validateAsync(data);
    },
    customerApplePayPaymentValidator: (data) => {
        return customerApplePayPaymentSchema.validateAsync(data);
    },
    refundPaymentValidator: (data) => {
        return refundPaymentSchema.validateAsync(data);
    },
    customerDataValidator: (data) => {
        return customerDataSchema.validateAsync(data);
    },
}
