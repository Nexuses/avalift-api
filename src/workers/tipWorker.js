require("dotenv").config();

const { tipQueue } = require("../queues/tipQueue");
const { expireTipIfPending } = require("../services/tipService");

tipQueue.process(async (job) => {
  const { rideId, customerId } = job.data;

  const result = await expireTipIfPending({ rideId, customerId });
  return result;
});

tipQueue.on("completed", (job, result) => {
  console.log(`[TIP WORKER] completed job=${job.id}`, result);
});

tipQueue.on("failed", (job, err) => {
  console.error(`[TIP WORKER] failed job=${job?.id}`, err.message);
});

console.log("[TIP WORKER] Tip expiry worker started...");
