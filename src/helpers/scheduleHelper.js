// scheduleHelper.js
const redisClient = require('../config/redis');

const SCHEDULED_RIDES_SET_KEY = 'scheduled_rides';

// Hourly end warning keys
const HOURLY_WARN_ZSET = "cron:hourly_end_warn:due";
const HOURLY_WARN_SENT_KEY = (rideId, plannedEndMs) =>
  `cron:hourly_end_warn:sent:${rideId}:${plannedEndMs}`;

/**
 * Save or Update a scheduled ride in Redis.
 */
async function saveOrUpdateScheduledRide(rideId, scheduledPickup) {
  const rideKey = `ride_${rideId}`;

  const existingPickup = await redisClient.hget(rideKey, 'scheduledPickup');
  const existingCount = await redisClient.hget(rideKey, 'rescheduleCount');

  let rescheduleCount = existingCount ? parseInt(existingCount, 10) : 0;

  if (existingPickup) {
    if (rescheduleCount >= 3) {
      throw new Error(`Ride ${rideId} has exceeded the max of 3 reschedules.`);
    }
    rescheduleCount += 1;
  }

  const pickupString = scheduledPickup instanceof Date
    ? scheduledPickup.toISOString()
    : scheduledPickup;

  await redisClient.hset(rideKey, {
    scheduledPickup: pickupString,
    rescheduleCount: rescheduleCount.toString(),
  });

  await redisClient.sadd(SCHEDULED_RIDES_SET_KEY, rideId.toString());
}

async function removeScheduledRide(rideId) {
  const rideKey = `ride_${rideId}`;

  await redisClient.srem(SCHEDULED_RIDES_SET_KEY, rideId.toString());
  await redisClient.del(rideKey);
  console.log(`Removing ${rideKey} from redis`);
}

async function getAllScheduledRides() {
  const rideIds = await redisClient.smembers(SCHEDULED_RIDES_SET_KEY);
  const results = [];

  for (const id of rideIds) {
    const rideKey = `ride_${id}`;
    const fields = await redisClient.hgetall(rideKey);

    if (Object.keys(fields).length > 0) {
      const { scheduledPickup, rescheduleCount } = fields;
      results.push({
        rideId: id,
        scheduledPickup,
        rescheduleCount: parseInt(rescheduleCount, 10) || 0,
      });
    } else {
      await redisClient.srem(SCHEDULED_RIDES_SET_KEY, id);
    }
  }

  return results;
}

// ✅ schedule/reschedule hourly end warning (call on Started + Extend)
async function scheduleHourlyEndWarn(ride) {
  if (!ride) return;
  if (ride.rate_type !== "per_hour") return;
  if (!ride.planned_end_time) return;

  const WARN_MINUTES = Number(process.env.HOURLY_END_WARN_MINUTES || 10);

  const plannedEndMs = new Date(ride.planned_end_time).getTime();
  if (Number.isNaN(plannedEndMs)) return;

  const warnAtMs = plannedEndMs - (WARN_MINUTES * 60 * 1000);
  if (warnAtMs <= Date.now()) return;

  // ZSET overwrite (no conflict)
  await redisClient.zadd(HOURLY_WARN_ZSET, warnAtMs, String(ride.ride_id));
}


// ✅ cancel hourly end warning (call on Completed/Cancelled)
async function cancelHourlyEndWarn(rideId) {
  if (!rideId) return;
  await redisClient.zrem(HOURLY_WARN_ZSET, rideId.toString());
}

// (optional) if you ever want to clear the "sent" marker manually:
async function clearHourlyEndWarnSent(rideId) {
  if (!rideId) return;
  await redisClient.del(HOURLY_WARN_SENT_KEY(rideId));
}

module.exports = {
  saveOrUpdateScheduledRide,
  removeScheduledRide,
  getAllScheduledRides,
  scheduleHourlyEndWarn,
  cancelHourlyEndWarn,
  clearHourlyEndWarnSent,
  HOURLY_WARN_ZSET,
  HOURLY_WARN_SENT_KEY,
};
