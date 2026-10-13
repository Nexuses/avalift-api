const { ErpSku, ErpMappingCode, ErpSync  } = require('../dto');

async function getSkuForRide(rate_type) {
  const sku = await ErpSku.findOne({
    where: {
      service_type: rate_type,
      is_active: true
    }
  });

  if (!sku) {
    throw new Error(`ERP SKU not found for fare type: ${rate_type}`);
  }

  return sku;
}

async function getChauffeurCodeById(chauffeur_id) {
  const chauffeurCode = await ErpMappingCode.findOne({
    where: {
      chauffeur_id: chauffeur_id,
      is_active: true
    }
  });

  if (!chauffeurCode) {
    throw new Error(`ERP Chauffeur Code not found for chauffeur ID: ${chauffeur_id}`);
  }

  return chauffeurCode;
}

async function findExistingErpSync(ride_id) {
  const existing = await ErpSync.findOne({
    where: { ride_id: ride_id }
  });

  return existing;
}

async function createErpSync(data) {
    const [row] = await ErpSync.upsert(
    data,
    {
      conflictFields: ["ride_id"],  // force conflict target
      returning: true,             // so you get the updated row in Postgres
    }
  );
  return row;
}

async function createErpMappingCode(data) {
  const createdChauffeurCode = await ErpMappingCode.create(data);
  return createdChauffeurCode;
}

async function updateErpMappingCode(chauffeur_id, updateData) {
  const result = await ErpMappingCode.update(updateData, {
    where: { chauffeur_id: chauffeur_id }
  });
  return result;
}

async function getErpMappingCode(chauffeur_id) {
  const chauffeurCode = await ErpMappingCode.findOne({
    where: {
      chauffeur_id: chauffeur_id,
      is_active: true
    }
  });

  return chauffeurCode;
}


async function upsertErpMappingCode(data) {
  // chauffeur_id MUST be UNIQUE in DB
  const [record, created] = await ErpMappingCode.upsert(data, {
    returning: true
  });

  return { record, created };
}


module.exports = {
  getSkuForRide,
  getChauffeurCodeById,
  findExistingErpSync,
  createErpSync,
  createErpMappingCode,
  updateErpMappingCode,
  getErpMappingCode,
  upsertErpMappingCode
};
