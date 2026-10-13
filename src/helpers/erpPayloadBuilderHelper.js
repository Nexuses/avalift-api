// helpers/erpPayloadBuilder.js
const dayjs = require('dayjs');
const getSkuForRide = require('../dao/erpDAO').getSkuForRide;
const getChauffeurCodeById = require('../dao/erpDAO').getChauffeurCodeById;
const utc = require("dayjs/plugin/utc");
const timezone = require("dayjs/plugin/timezone");

dayjs.extend(utc);
dayjs.extend(timezone);

// const sku = await getSkuForRide(ride.rate_type);

// const chauffeurCode = await getChauffeurCodeById(ride.chauffeur_id);

async function buildInvoiceItems({ ride, sku }) {
  const {
    total_after_discount,
    previous_balance,
    tip_added,
    tip_amount,
    vat,
    vat_percentage,
    final_total_amount,
    final_total_amount_before_tip
  } = ride.final_price_calculation;

  // let baseAmount = 0;
  // let price = 0;

  // if(tip_added && Number(tip_amount) > 0){
  //   baseAmount = Number(total_after_discount) + Number(previous_balance || 0);
  //   price = Number(final_total_amount_before_tip);
  // } else{
  //   baseAmount =
  //     Number(total_after_discount) + Number(previous_balance || 0);
  //   price = Number(final_total_amount);
  // }

  const prevBal = Number(previous_balance || 0);
  const tipAmt = tip_added && Number(tip_amount) > 0 ? Number(tip_amount) : 0;

  // This is the ride amount ONLY (exclude previous balance and exclude tip)
  const rideSubTotal = Number(total_after_discount || 0);

  // ERP "Price/TotalAmount" for the ride line should also exclude prev balance and tip
  // (because prev balance & tip are separate items)
  const grossWithoutTip = Number(
    tipAmt > 0 ? final_total_amount_before_tip : final_total_amount
  );

  const rideLinePrice = Math.max(0, grossWithoutTip - prevBal);







  const items = [
    {
      UniqueId: sku.unique_code,
      ProductTitle: sku.product_title,
      SKU: sku.sku_code,
      ProductDesc2: `${ride.ride_id}`,
      Quantity: 1.0,
      Price: rideLinePrice,
      SubTotal: rideSubTotal,
      TaxableAmount: rideSubTotal,
      TotalTax: Number(vat || 0),
      TaxesIncluded: 'Y',
      TAX: [
        {
          UniqueId: 'VAT01',
          TaxCode: 'VAT05',
          Percentage: vat_percentage,
          Value: vat
        }
      ],
      Discount: 0,
      DiscountPercentage: 0,
      TotalAmount: rideLinePrice
    }
  ];

   if (prevBal > 0) {
    const prevBal_sku = await getSkuForRide("cancelation_fee"); // using cancellation fee sku for previous balance
    items.push({
      UniqueId: prevBal_sku.unique_code,
      ProductTitle: prevBal_sku.product_title,
      ProductDesc2: `${ride.ride_id}`,
      SKU: prevBal_sku.sku_code,
      Quantity: 1.0,
      Price: prevBal,
      SubTotal: prevBal,
      TaxableAmount: prevBal,
      TotalTax: 0,
      TaxesIncluded: 'Y',
      TAX: [],
      Discount: 0,
      DiscountPercentage: 0,
      TotalAmount: prevBal
    });
  }

  if (tip_added && Number(tip_amount) > 0) {
    const tip_sku = await getSkuForRide("tip");
    items.push({
      UniqueId: tip_sku.unique_code,
      ProductTitle: tip_sku.product_title,
      SKU: tip_sku.sku_code,
      ProductDesc2: `${ride.ride_id}`,
      Quantity: 1.0,
      Price: Number(tip_amount),
      SubTotal: Number(tip_amount),
      TaxableAmount: Number(tip_amount),
      TotalTax: 0,
      TaxesIncluded: 'Y',
      TAX: [],
      Discount: 0,
      DiscountPercentage: 0,
      TotalAmount: Number(tip_amount)
    });
  }

  return items;
}


async function buildErpInvoicePayload(ride) {

  //console.log('rate_type:', ride.rate_type);
  //console.log('chauffeur_id:', ride.chauffeur_id);
  //console.log(ride);
  const sku = await getSkuForRide(ride.rate_type);
  const chauffeurCode = await getChauffeurCodeById(ride.chauffeur_id);
  const onlinePaymentMethods = ['Card', 'Apple Pay', 'Wallet'];

  const items = await buildInvoiceItems({ ride, sku });

  console.log('Invoice Items:', items);

  const payload =  {
    redirecturl: process.env.ERP_REDIRECT_URL,

    Data: {
      UniqueId: ride.ride_id,
      TransactionType: 'Invoice',
      TransactionCode: process.env.ERP_TRANSACTION_CODE,
      LocationCode: process.env.ERP_LOCATION_CODE,
      ReferenceId: "",
      CurrencyCode: process.env.ERP_CURRENCY_CODE,
      Note: '',
      Number: ride.ride_id,
      Date: dayjs(ride.end_time).tz("Asia/Dubai").format('DD-MM-YYYY'),

      ItemTotal: Number(ride.final_price_calculation.final_total_amount),
      Discount: 0,
      DiscountPercentage: 0,
      TaxesIncluded: 'Y',

      TAX: [],

      SubTotal: Number(ride.final_price_calculation.tip_added? ride.final_price_calculation.total_after_discount + ride.final_price_calculation.tip_amount + ride.final_price_calculation.previous_balance : ride.final_price_calculation.total_after_discount + ride.final_price_calculation.previous_balance),
      TotalTax: Number(ride.final_price_calculation.vat || 0),
      TotalAmount: Number(ride.final_price_calculation.final_total_amount), // check this one

      Items: items,

      Customer: {
        UniqueId: String(ride.customer_id),
        Name: ride.customer_details.name,
        Phone: ride.customer_details.mobile_number,
        Email: ride.customer_details.email || '',
        Address: {
          Address1: '',
          Address2: '',
          City: '',
          Country: '',
          Area: ''
        },
        UseSameDeliveryAddress: 'Y',
        DeliveryAddress: {
          Address1: '',
          Address2: '',
          City: '',
          Country: '',
          Area: ''
        }
      },

      Salesman: {
        UniqueId: chauffeurCode.chauffeur_code, // need to take from table 
        Name: chauffeurCode.chauffeur_name // need to take from table
      },

      Payment: [
        {
          UniqueId: ride.paymentDetails.payment_method? onlinePaymentMethods.includes(ride.paymentDetails.payment_method) ? chauffeurCode.ac_code_online : chauffeurCode.ac_code_cash : ride.ride_id,
          Type: ride.paymentDetails.payment_method? onlinePaymentMethods.includes(ride.paymentDetails.payment_method) ? chauffeurCode.ac_name_online : chauffeurCode.ac_name_cash : 'Cash',
          Amount: Number(ride.final_price_calculation.final_total_amount),
          Tender: 0.0,
          Change: 0.0,
          Reference: ''
        }
      ]
    }
  };
  console.log('ERP Invoice Payload from helper:', payload);
  console.log(JSON.stringify(payload, null, 2));
  console.log("Actual ride end time:", ride.end_time);
  console.log("Formatted ride end time for ERP:", dayjs(ride.end_time).tz("Asia/Dubai").format('DD-MM-YYYY HH:mm'));
  return payload;
}

module.exports = { buildErpInvoicePayload };

