// services/auditService.js
const Joi = require('joi');
const multiparty = require('multiparty');
const axios = require('axios');
const auditDao = require('../dao/auditDAO');
const { addServerLog } = require('../services/serverLogsService');
const adminRideServices = require('./adminRideServices');
require('dotenv').config();

const {
  S3Client,
  PutObjectCommand,
  ListBucketsCommand,
} = require('@aws-sdk/client-s3');
const {
  STSClient,
  GetCallerIdentityCommand,
} = require('@aws-sdk/client-sts');

// ─── CONFIG ─────────────────────────────────────────────────────────────────
const S3_BUCKET = process.env.S3_BUCKET;
const AWS_REGION = process.env.AWS_REGION;

const s3Client = new S3Client({
  region: AWS_REGION,
  // credentials will be picked from env (AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY)
});

const stsClient = new STSClient({
  region: AWS_REGION,
});

// ─── SANITY CHECK ────────────────────────────────────────────────────────────
(async () => {
  try {
    const buckets = await s3Client.send(new ListBucketsCommand({}));
    console.log('✅ AWS Buckets:', buckets.Buckets);
  } catch (err) {
    console.error('❌ AWS S3 Error:', err);
  }

  try {
    const identity = await stsClient.send(new GetCallerIdentityCommand({}));
    console.log('✅ AWS Caller Identity:', identity);
  } catch (err) {
    console.error('❌ AWS STS Error:', err);
  }
})();

// ─── VALIDATION SCHEMA ────────────────────────────────────────────────────────
const auditSchema = Joi.object({
  ride_id: Joi.string().required(),
  chassis_no: Joi.string().required(),
  rta_due_date: Joi.date().required(),
  odometer_reading: Joi.number().required(),
  vehicle_color: Joi.string().required(),
  vehicle_brand: Joi.string().required(),
  vehicle_model: Joi.string().required(),
  wiper: Joi.boolean().required(),
  horn: Joi.boolean().required(),
  antenna: Joi.boolean().required(),
  fire_extinguisher: Joi.boolean().required(),
  jack: Joi.boolean().required(),
  toolkit: Joi.boolean().required(),
  spare_tire: Joi.boolean().required(),
  registration_card: Joi.boolean().required(),
  wheel_cap: Joi.boolean().required(),
  remarks: Joi.string().optional().allow(''),
  signature: Joi.string().required(),
  vehicle_markings: Joi.string().required(),
});

// ─── IMAGE UPLOAD ────────────────────────────────────────────────────────────
async function uploadImage(imageBase64, folder) {
  const imageKey = `${folder}/${Date.now()}-${Math.random()
    .toString(36)
    .substring(2, 15)}.png`;
  const buffer = Buffer.from(imageBase64, 'base64');

  const cmd = new PutObjectCommand({
    Bucket: S3_BUCKET,
    Key: imageKey,
    Body: buffer,
    ContentEncoding: 'base64',
    ContentType: 'image/png',
  });

  await s3Client.send(cmd);
  // Construct public URL
  return `https://${S3_BUCKET}.s3.${AWS_REGION}.amazonaws.com/${imageKey}`;
}

// ─── CORE LOGIC ───────────────────────────────────────────────────────────────
async function processAudit(data) {
  const { error, value } = auditSchema.validate(data, {
    abortEarly: false,
  });
  if (error) {
    const msg = error.details.map(d => d.message).join(', ');
    throw new Error(`Validation error: ${msg}`);
  }

  const {
    ride_id,
    chassis_no,
    rta_due_date,
    odometer_reading,
    vehicle_color,
    vehicle_brand,
    vehicle_model,
    wiper,
    horn,
    antenna,
    fire_extinguisher,
    jack,
    toolkit,
    spare_tire,
    registration_card,
    wheel_cap,
    remarks,
    signature,
    vehicle_markings,
  } = value;

  // Upload images
  const signatureImageUrl = await uploadImage(signature, 'signatures');
  const vehicleMarkingImageUrl = await uploadImage(
    vehicle_markings,
    'vehicle-markings'
  );

  const auditRecord = {
    ride_id,
    timestamp: new Date().toISOString(),
    chassis_no,
    rta_due_date: new Date(rta_due_date).toISOString(),
    odometer_reading,
    vehicle_color,
    vehicle_brand,
    vehicle_model,
    wiper,
    horn,
    antenna,
    fire_extinguisher,
    jack,
    toolkit,
    spare_tire,
    registration_card,
    wheel_cap,
    remarks,
    signatureImageUrl,
    vehicleMarkingImageUrl,
  };

  await auditDao.saveAudit(auditRecord);
  await adminRideServices.getVehicleAudit(ride_id);
  return { ride_id };
}

// ─── HTTP HANDLER ────────────────────────────────────────────────────────────
function processAuditRequest(req) {
  return new Promise((resolve, reject) => {
    const form = new multiparty.Form();
    form.parse(req, async (err, fields) => {
      if (err) return reject(err);

      const processed = {};
      for (const key in fields) {
        processed[key] = fields[key][0];
      }

      try {
        const result = await processAudit(processed);
        resolve(result);
      } catch (procErr) {
        console.error(procErr);
        await addServerLog({
          log_level: 'ERROR',
          service_name: 'auditService',
          error_message: `Error processing audit: ${procErr.message}`,
        });
        reject(procErr);
      }
    });
  });
}

module.exports = {
  processAuditRequest,
  processAudit,
};
