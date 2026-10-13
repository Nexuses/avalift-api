// cronMinute.js
require('dotenv').config();
const cron = require('node-cron');
const { getAllScheduledRides, removeScheduledRide } = require('../helpers/scheduleHelper');
const ridesDAO = require('../dao/ridesDAO'); 
const userDAO = require('../dao/userDAO'); 
const currentLocationDOA = require('../dao/currentLocationsDAO');
const adminPanelDAO = require('../dao/adminPanelDAO');
const notificationService = require("../adaptors/notificationService");
const { 
  buildScheduleRideRequestNotificationData, 
  buildOrganisationScheduledRideReminderNotificationData
} = require('../services/customerNotificationDataBuilder');

const schedule = process.env.CRON_SCHEDULE || '* * * * *';
const autoNotificationTime = process.env.AUTO_NOTIFICATION_TIME || 40;

// This runs every minute
cron.schedule(schedule, async () => {
    try {
        console.log('⌛ [Cron] Checking scheduled rides in Redis...');
    
        // Fetch all rides currently scheduled in Redis
        const scheduledRides = await getAllScheduledRides();
        console.log(`🔍 Found ${scheduledRides.length} rides in Redis to evaluate...`);
    
        if (!scheduledRides.length) {
          console.log('✅ No rides found in Redis. Skipping this cron cycle.');
          return;
        }
    
        // Current time
        const now = new Date();
        console.log(`🕒 Current Time: ${now.toISOString()}`);
    
        for (const ride of scheduledRides) {
          console.log(`📌 Processing Ride ID: ${ride.rideId}`);
    
          // Parse the scheduledPickup date
          if (!ride.scheduledPickup) {
            console.log(`⚠️ Ride ${ride.rideId} has no scheduled pickup time. Removing from Redis.`);
            await removeScheduledRide(ride.rideId);
            continue;
          }
    
          const scheduledTime = new Date(ride.scheduledPickup);
          console.log(`🕑 Ride ${ride.rideId} is scheduled for: ${scheduledTime.toISOString()}`);
    
          // Check if it's today
          const isSameDay = now.toDateString() === scheduledTime.toDateString();
          if (!isSameDay) {
            console.log(`🚫 Ride ${ride.rideId} is not scheduled for today. Skipping.`);
            continue;
          }
    
          // Calculate minutes difference
          const diffMs = scheduledTime - now;
          const diffMinutes = Math.floor(diffMs / 1000 / 60);
          console.log(`⏳ Ride ${ride.rideId} is ${diffMinutes} minutes away from scheduled time.`);
    
          // If it's within the auto-notification window
          if (diffMinutes <= autoNotificationTime && diffMinutes >= 0) {
            console.log(`✅ Ride ${ride.rideId} is within ${autoNotificationTime} minutes of scheduled pickup.`);
    
            // Fetch ride details from DB
            const rideData = await ridesDAO.getRideById(ride.rideId);
            console.log(`📦 Ride Data from DB:`, rideData);
    
            if (!rideData) {
              console.log(`❌ Ride ${ride.rideId} not found in DB. Removing from Redis.`);
              await removeScheduledRide(ride.rideId);
              continue;
            }
    
            if (rideData.status !== 'Requested') {
              console.log(`🚫 Ride ${ride.rideId} is in status "${rideData.status}". Removing from Redis.`);
              await removeScheduledRide(ride.rideId);
              continue;
            }
    
            // Check if this is an organization ride
            if (rideData.organisation_ride) {
              console.log(`ℹ️ Ride ${ride.rideId} is an organization ride. Notifying admins...`);
              const adminUsers = await adminPanelDAO.fetchDeviceIds();
    
              if (!adminUsers || adminUsers.length === 0) {
                console.log(`⚠️ No admin users found for organization ${rideData.organisation_id}. Removing ride from Redis.`);
                await removeScheduledRide(ride.rideId);
                continue;
              }
    
              await Promise.all(
                adminUsers.map(async (admin) => {
                  if (admin.device_id) {
                    const messageData = buildOrganisationScheduledRideReminderNotificationData(rideData, admin);
                    await notificationService.queuePushNotification(admin.device_id, messageData);
                    console.log(`📨 Notification sent to admin ${admin.id} for ride ${ride.rideId}.`);
                  }
                })
              );
            } else {
              // For regular rides, notify nearby chauffeurs
              const nearbyChauffeurs = await currentLocationDOA.findNearbyUsers(
                rideData.requested_pickup.lat,
                rideData.requested_pickup.long,
                process.env.NOTIFICATION_RADIUS,
                "chauffeur"
              );
              console.log(`🚖 Found ${nearbyChauffeurs.length} nearby chauffeurs.`);
              const uniqueChauffeurs = [
                ...new Map(nearbyChauffeurs.map(c => [String(c.user_id), c])).values()
              ];

              console.log(`🚖 Found ${nearbyChauffeurs.length} nearby chauffeurs, unique ${uniqueChauffeurs.length}.`);
    
              if (!uniqueChauffeurs.length) {
                console.log(`⚠️ No chauffeurs available for ride ${ride.rideId}. Removing from Redis.`);
                await removeScheduledRide(ride.rideId);
                continue;
              }
    
              for (const chauffeur of uniqueChauffeurs) {
                try {
                  // Check if chauffeur is free
                  const activeRide = await ridesDAO.getActiveRideForChauffeur(chauffeur.user_id);
                  if (activeRide.length > 0) {
                    console.log(`🔴 Skipping chauffeur ${chauffeur.user_id}, currently on ride ${activeRide.id}.`);
                    continue;
                  }
    
                  const deviceId = await userDAO.findDeviceIdByUserId(chauffeur.user_id);
                  const messageData = buildScheduleRideRequestNotificationData(rideData, chauffeur.user_id);
                  await notificationService.queuePushNotification(deviceId, messageData);
                  console.log(`📨 Notification sent to chauffeur ${chauffeur.user_id} for ride ${ride.rideId}.`);
                } catch (err) {
                  console.error(`⚠️ Failed to notify chauffeur ${chauffeur.user_id} for ride ${ride.rideId}:`, err);
                }
              }
            }
    
            // Remove ride from Redis after processing to avoid duplicates
            await removeScheduledRide(ride.rideId);
            console.log(`🗑️ Ride ${ride.rideId} removed from Redis after successful notification.`);
          } else {
            console.log(`⏭️ Ride ${ride.rideId} is not yet within the ${autoNotificationTime}-minute notification window.`);
          }
        }
      } catch (error) {
        console.error('[❌ Cron Error]:', error);
      }
});
    
console.log('🚀 [Cron] Minutes-based notification job is running...');
