// services/notificationService.js
require('dotenv').config();
const notificationQueue = require('../queues/notificationQueue');
const logger = require('../helpers/logger');
const { addNotificationWithAutoIncrement } = require('../dao/counterDAO');
const fcmAdmin = require('firebase-admin');



//const admin = require('firebase-admin');

// Initialize Firebase only once
if (!fcmAdmin.apps.length) {
  const serviceAccountPath = process.env.FIREBASE_CONFIG_FILE;
  if (!serviceAccountPath) {
    throw new Error('FIREBASE_CONFIG_FILE environment variable is not set.');
  }

  let serviceAccount;
  try {
    serviceAccount = require(serviceAccountPath);
  } catch (error) {
    throw new Error(`Failed to load Firebase service account from ${serviceAccountPath}: ${error.message}`);
  }

  fcmAdmin.initializeApp({
    credential: fcmAdmin.credential.cert(serviceAccount)
  });
}


// Function to enqueue a push notification
const queuePushNotification = async (deviceId, messageData) => {

    const generatedMeaageData = {
        PK: `${messageData.recipient_type.toUpperCase()}#${messageData.recipient_id}`,
        SK: null,
        ...messageData
    }
    console.log("here",generatedMeaageData);
    
    const notification_id = await addNotificationWithAutoIncrement("Notifications", generatedMeaageData, "notification_id", "N");

    const jobData = {
        notification_id,
        deviceId,
        messageData,
        timestamp: new Date().toISOString(),
    };


    try {
        // Add job to the queue with Bull options
        await notificationQueue.add(jobData, {
            attempts: 3, // Retry up to 3 times on failure
            backoff: {
                type: 'exponential',
                delay: 1000, // Initial delay of 1 second
            },
            removeOnComplete: true, // Remove job from queue on success
            removeOnFail: false, // Keep failed jobs for inspection
            // Optional: Set priority or delay
            // priority: 1,
            // delay: 5000, // Delay job by 5 seconds
        });

        logger.info(`Queued notification ${notification_id} for device ${deviceId}`);
        return { status: 'queued', notification_id };
    } catch (error) {
        logger.error(`Failed to queue notification ${notification_id}: ${error.message}`);
        return { status: 'failed', notification_id, error: error.message };
    }
};


async function backgroundQueuePushNotification(deviceToken, messageData) {
    if (!deviceToken) {
      throw new Error('Device token is required for silent push.');
    }
  
    const message = {
      token: deviceToken,
      apns: messageData.apns, // includes content-available
      data: messageData.data || {}
    };
  
    try {
      const response = await fcmAdmin.messaging().send(message);
      console.log(`✅ Silent push sent via FCM. Message ID: ${response}`);
      return response;
    } catch (error) {
      console.error(`❌ Failed to send silent push via FCM:`, error.message);
      throw error;
    }
  }

module.exports = {
    queuePushNotification,
    backgroundQueuePushNotification
};
