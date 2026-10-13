// cronHourlyEndWarn.js
require("dotenv").config();
const cron = require("node-cron");

const redisClient = require("../config/redis");
const ridesDAO = require("../dao/ridesDAO"); // DynamoDB fetch
const userDAO = require("../dao/userDAO");
const notificationService = require("../adaptors/notificationService");

const {
  HOURLY_WARN_ZSET,
  HOURLY_WARN_SENT_KEY,
} = require("../helpers/scheduleHelper");

// ---- Config ----
const CRON_SCHEDULE = process.env.HOURLY_END_WARN_CRON_SCHEDULE || "* * * * *";
const WARN_MINUTES = Number(process.env.HOURLY_END_WARN_MINUTES || 10);
const BATCH_LIMIT = Number(process.env.HOURLY_END_WARN_BATCH || 200);

// Consider ride as "active" only in these statuses.
// You can add more if your system uses other in-progress statuses.
const ACTIVE_STATUSES = new Set(
  (process.env.HOURLY_END_WARN_ACTIVE_STATUSES || "Started")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
);

// Global lock to avoid multi-scheduler duplication
const GLOBAL_LOCK_KEY = "lock:cron:hourly_end_warn";
const GLOBAL_LOCK_TTL_SEC = 55;

// Per-ride lock to avoid two ticks processing same ride simultaneously
const RIDE_LOCK_TTL_SEC = 120;

// Sent marker TTL
const SENT_TTL_SEC = 24 * 60 * 60; // 24 hours

// Safe lock release (only delete if token matches)
async function releaseLockIfOwned(lockKey, token) {
  const lua = `
    if redis.call("get", KEYS[1]) == ARGV[1] then
      return redis.call("del", KEYS[1])
    else
      return 0
    end
  `;
  try {
    await redisClient.eval(lua, 1, lockKey, token);
  } catch (e) {
    // Don't crash cron on unlock issues
    console.error(`[HourlyEndWarn] Failed to release lock ${lockKey}:`, e);
  }
}

async function acquireLock(lockKey, token, ttlSec) {
  // ioredis and node-redis support this signature
  // If your redis lib differs, adjust accordingly.
  const res = await redisClient.set(lockKey, token, "NX", "EX", ttlSec);
  return res === "OK";
}

function buildHourlyEndWarnMessage(ride, remainingMinutes) {
  // Customize as needed
  return {
    title: "Ride ending soon",
    body: `Your hourly ride will end in ${remainingMinutes} minutes. If you’d like to continue, you can extend the ride`,
    data: {
      rideId: ride.ride_id,
      notification_type: "hourly_end_warn",
      remainingMinutes: String(remainingMinutes),
      requested_pickup_point: ride.requested_pickup_point.toString(),
      requested_pickup_lat: ride.requested_pickup.lat.toString(),
      requested_pickup_long: ride.requested_pickup.long.toString(),
      requested_drop_point: ride.requested_drop_point.toString() || "",
      requested_drop_lat: ride.requested_drop.lat.toString() || "",
      requested_drop_long: ride.requested_drop.long.toString() || "",
    },
    recipient_type: "CUSTOMER",
    recipient_id: ride.customer_id,
    notification_type: "hourly_end_warn",
  };
}

async function processOneRide(rideId, nowMs, runToken) {
  const rideLockKey = `lock:cron:hourly_end_warn:ride:${rideId}`;

  // 1) Per-ride lock
  const gotRideLock = await acquireLock(rideLockKey, runToken, RIDE_LOCK_TTL_SEC);
  if (!gotRideLock) return;

  const retryAtMs = nowMs + 30_000; // 30s retry

  try {
    // 2) Claim from ZSET (single-consumer guarantee)
    const claimed = await redisClient.zrem(HOURLY_WARN_ZSET, rideId);
    if (claimed !== 1) return;

    // 3) Fetch ride
    const ride = await ridesDAO.getRideById(rideId);
    if (!ride) return;

    // 4) Validate eligibility
    if (ride.rate_type !== "per_hour") return;
    if (!ACTIVE_STATUSES.has(ride.status)) return;
    if (!ride.planned_end_time) return;

    const plannedEndMs = new Date(ride.planned_end_time).getTime();
    if (Number.isNaN(plannedEndMs)) return;

    const warnAtMs = plannedEndMs - WARN_MINUTES * 60 * 1000;

    // 5) If end time moved forward, reschedule
    if (warnAtMs > nowMs + 30_000) {
      await redisClient.zadd(HOURLY_WARN_ZSET, warnAtMs, rideId);
      return;
    }

    const remainingMinutes = Math.floor((plannedEndMs - nowMs) / 60000);
    if (remainingMinutes < 0) return;

    // 🔑 FIX: idempotency is now per (rideId + plannedEndMs)
    const sentKey = HOURLY_WARN_SENT_KEY(`${rideId}:${plannedEndMs}`);

    const reserved = await redisClient.set(
      sentKey,
      "1",
      "NX",
      "EX",
      SENT_TTL_SEC
    );

    // Already sent for this planned_end_time
    if (reserved !== "OK") return;

    // 6) Send notification
    const deviceId = await userDAO.findDeviceIdByUserId(ride.customer_id);
    if (!deviceId) return;

    const messageData = buildHourlyEndWarnMessage(
      ride,
      Math.min(remainingMinutes, WARN_MINUTES)
    );

    await notificationService.queuePushNotification(deviceId, messageData);

    console.log(
      `[HourlyEndWarn] ✅ Sent warning for ride ${rideId} (end=${plannedEndMs}, remaining=${remainingMinutes}m)`
    );
  } catch (err) {
    console.error(`[HourlyEndWarn] ❌ Failed processing ride ${rideId}:`, err);

    // Rollback: allow retry
    await redisClient.zadd(HOURLY_WARN_ZSET, retryAtMs, rideId);
  } finally {
    await releaseLockIfOwned(rideLockKey, runToken);
  }
}



async function runHourlyEndWarnCron() {
  const nowMs = Date.now();
  const runToken = `${process.pid}:${nowMs}`;

  // Global lock
  const gotGlobalLock = await acquireLock(GLOBAL_LOCK_KEY, runToken, GLOBAL_LOCK_TTL_SEC);
  if (!gotGlobalLock) return;

  try {
    // Get due rides (warnAt score <= now)
    const dueRideIds = await redisClient.zrangebyscore(
      HOURLY_WARN_ZSET,
      0,
      nowMs,
      "LIMIT",
      0,
      BATCH_LIMIT
    );

    if (!dueRideIds || dueRideIds.length === 0) {
      return;
    }

    console.log(`[HourlyEndWarn] 🔎 Found ${dueRideIds.length} due rides`);

    for (const rideId of dueRideIds) {
      await processOneRide(rideId, nowMs, runToken);
    }
  } catch (err) {
    console.error("[HourlyEndWarn] ❌ Cron tick failed:", err);
  } finally {
    await releaseLockIfOwned(GLOBAL_LOCK_KEY, runToken);
  }
}

// Run every minute
cron.schedule(CRON_SCHEDULE, runHourlyEndWarnCron);

console.log(`🚀 [HourlyEndWarn] Cron running: ${CRON_SCHEDULE} | warn=${WARN_MINUTES}m | batch=${BATCH_LIMIT}`);
