// workers/notificationProcessor.js
require('dotenv').config();
const fcmAdmin = require('firebase-admin');
const notificationQueue = require('../queues/notificationQueue');
const { saveNotification } = require('../dao/notificationDOA');
const logger = require('../helpers/logger');

// Initialize Firebase Admin SDK
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
        credential: fcmAdmin.credential.cert(serviceAccount),
    });
}

// Define the job processor
notificationQueue.process(async (job) => {
    const { notification_id, deviceId, messageData } = job.data;

    try {
        const message = {
            token: deviceId,
            notification: {
                title: messageData.title,
                body: messageData.body,
            },
            android: {
                notification: {
                    sound: 'default',
                    priority: 'high',
                },
            },
            apns: {
                payload: {
                    aps: {
                        sound: 'default.wav',
                    },
                },
            },
            data: messageData.data || {},
        };

        // Send the message via FCM
        const response = await fcmAdmin.messaging().send(message);

        // Save the delivered notification in DynamoDB
        await saveNotification({
            notification_id,
            recipient_type: messageData.recipient_type,
            recipient_id: messageData.recipient_id,
            title: messageData.title,
            body: messageData.body,
            data: messageData.data || {},
            notification_type: messageData.notification_type,
            status: 'delivered',
            delivery_time: new Date().toISOString(),
            messageId: response,
        });

        logger.info(`Successfully sent notification ${notification_id} with message ID: ${response}`);

        return { status: 'delivered', messageId: response };
    } catch (error) {
        logger.error(`Error sending notification ${notification_id}: ${error.message}`);

        // Save the failed notification in DynamoDB
        await saveNotification({
            notification_id,
            recipient_type: messageData.recipient_type,
            recipient_id: messageData.recipient_id,
            title: messageData.title,
            body: messageData.body,
            data: messageData.data || {},
            notification_type: messageData.notification_type,
            status: 'failed',
            errorMessage: error.message,
            delivery_time: new Date().toISOString(),
        });

        // Throw error to let Bull handle retries
        throw error;
    }
});

// Optional: Handle failed jobs after all retries
notificationQueue.on('failed', (job, err) => {
    logger.error(`Job ${job.id} failed after ${job.attemptsMade} attempts: ${err.message}`);
    // Optionally, implement additional logic like alerting or moving to a dead-letter queue
});

// Start the worker
logger.info('Notification processor started and listening for jobs.');
