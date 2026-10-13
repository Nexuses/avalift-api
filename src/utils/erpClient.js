// services/erp/erpClient.js
const axios = require('axios');

async function createErpInvoice(payload) {
  const response = await axios.post(
    process.env.ERP_INVOICE_API,
    payload,
    {
      headers: {
        'Content-Type': 'application/json',
        'SecretKey': process.env.ERP_SECRET_KEY,
        'ClientId': process.env.ERP_CLIENT_ID
      },
      timeout: 10000
    }
  );

  return response.data;
}

module.exports = { createErpInvoice };
