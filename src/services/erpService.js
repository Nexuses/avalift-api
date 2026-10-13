// services/erp/erpService.js
const { buildErpInvoicePayload } = require('../helpers/erpPayloadBuilderHelper');
const { createErpInvoice } = require('../utils/erpClient');
const erpDAO = require('../dao/erpDAO');

async function syncRideToErp(ride) {
  // 1️⃣ Idempotency check (skip only SUCCESS)
  const existing = await erpDAO.findExistingErpSync(ride.ride_id);

  if (existing && existing.status === 'SUCCESS') {
    return {
      skipped: true,
      reason: 'ALREADY_SYNCED'
    };
  }

  // 2️⃣ Build ERP payload
  const payload = await buildErpInvoicePayload(ride);
  console.log('📤 ERP Payload:', payload);

  try {
    // 3️⃣ Call ERP
    const erpResponse = await createErpInvoice(payload);
    console.log('📥 ERP Response:', erpResponse);

    // 4️⃣ Validate ERP response
    if (!erpResponse?.IsSuccess) {
      const errorMsg =
        erpResponse?.Errors?.[0]?.Message ||
        'Unknown ERP error';

      // 🔴 Save FAILED attempt
      await erpDAO.createErpSync({
        ride_id: ride.ride_id,
        invoice_id: null,
        status: 'FAILED',
        error_message: errorMsg
      });

      throw new Error(errorMsg);
    }

    // 5️⃣ Extract invoice details SAFELY
    const erpData = Array.isArray(erpResponse.Data)
      ? erpResponse.Data[0]
      : null;

    const invoiceId = erpData?.UniqueId || null;
    const documentNo = erpData?.DocNo || null;

    // 6️⃣ Save SUCCESS record
    const createdSync = await erpDAO.createErpSync({
      ride_id: ride.ride_id,
      invoice_id: invoiceId,
      document_no: documentNo,
      status: 'SUCCESS',
      error_message: null
    });

    return {
      success: true,
      invoice_id: createdSync.invoice_id,
      document_no: documentNo
    };

  } catch (error) {
    // 7️⃣ Catch network / timeout / unexpected errors
    console.error('❌ ERP sync failed:', error.message);

    await erpDAO.createErpSync({
      ride_id: ride.ride_id,
      invoice_id: null,
      status: 'FAILED',
      error_message: error.message
    });

    throw error; // IMPORTANT → Bull retry
  }
}


module.exports = { syncRideToErp };
