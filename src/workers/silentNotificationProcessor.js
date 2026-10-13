require('dotenv').config();
const cron = require('node-cron');
const userDAO = require('../dao/userDAO');
const ridesDAO = require('../dao/ridesDAO');
const notificationService = require('../adaptors/notificationService');

const schedule = process.env.CRON_SILENT_NOTIFICATION || '*/20 * * * * *'; // every 20 sec

cron.schedule(schedule, async () => {
  const runStartTime = new Date();
  console.log(`\n🔁 [Silent Cron Triggered] ${runStartTime.toISOString()}`);

  try {
    console.log('🔍 Fetching eligible users for silent push...');

    const users = await userDAO.getUsersForSilentPush();

    if (!users || users.length === 0) {
      console.log('✅ No eligible users found for silent push at this moment.');
      return;
    }

    console.log(`📦 Found ${users.length} users to notify.`);

    for (const user of users) {
      console.log(`\n👤 Processing User ID: ${user.id}`);

      if (!user.device_id) {
        console.log(`⚠️ Skipping user ${user.id} — missing device_id.`);
        continue;
      }

      // Check if chauffeur has an active ride
      const activeRide = await ridesDAO.getActiveRideForChauffeur(user.id);

      if (!Array.isArray(activeRide) || activeRide.length === 0) {
        console.log(`🔴 Skipping chauffeur ${user.id}, currently has no active ride.`);
        continue;
      }

      console.log(`✅ Chauffeur ${user.id} is on active ride ${activeRide[0].id}.`);

      if (!user.device_id) {
        console.log(`⚠️ Skipping user ${user.id} — missing device_id.`);
        continue;
      }

      const messageData = {
        apns: {
          headers: {
            'apns-priority': '10'
          },
          payload: {
            aps: {
              'content-available': 1
            }
          }
        },
        data: {
          type: 'background_sync',
          //rideId: activeRide[0].id // optional: include ride ID
        }
      };

      try {
        console.log(`📨 Sending silent push to device_id: ${user.device_id}...`);
        await notificationService.backgroundQueuePushNotification(user.device_id, messageData);
        console.log(`✅ Silent push successfully sent to User ID: ${user.id}`);
      } catch (err) {
        console.error(`❌ Failed to send silent push to User ID: ${user.id}:`, err.message);
      }
    }

    console.log(`🎉 Silent push cycle complete at ${new Date().toISOString()}`);

  } catch (error) {
    console.error('[❌ Silent Cron Error]:', error.message);
  }
});

console.log('🚀 [Cron] Silent notification job is running every 20 seconds...');
