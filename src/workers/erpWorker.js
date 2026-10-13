const erpQueue = require('../queues/erpQueue');
const { syncRideToErp } = require('../services/erpService');
const { getRideById } = require('../dao/ridesDAO');

console.log('🚀 ERP WORKER STARTED AND LISTENING...');

erpQueue.process(async (job) => {
  console.log(`\n[ERP_WORKER] Job received | jobId=${job.id}`);
  console.log(`[ERP_WORKER] Job data:`, job.data);

  const { rideId } = job.data;

  try {
    console.log(`[ERP_WORKER] Fetching ride ${rideId}`);
    const ride = await getRideById(rideId);

    if (!ride) {
      console.error(`[ERP_WORKER] Ride not found: ${rideId}`);
      throw new Error('Ride not found');
    }

    console.log(`[ERP_WORKER] Ride status: ${ride.status}`);

    if (ride.status !== 'Completed') {
      console.log(`[ERP_WORKER] Ride not completed, skipping ERP`);
      return;
    }

    console.log(`[ERP_WORKER] Calling ERP for ride ${rideId}`);
    await syncRideToErp(ride);

    console.log(`[ERP_WORKER] ✅ ERP sync completed for ${rideId}`);
    return true;

  } catch (err) {
    console.error(`[ERP_WORKER] ❌ Error processing ERP job`, err);
    throw err; 
  }
});
