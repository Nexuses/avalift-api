// queues/notificationQueue.js
const Bull = require('bull');
const Redis = require('ioredis');
const logger = require('../helpers/logger');
require('dotenv').config();

// Redis connection options
const redisOptions = {
    host: process.env.REDIS_HOST || 'zeizzu-redis-st.zjnzec.ng.0001.apse1.cache.amazonaws.com',
    port: process.env.REDIS_PORT || 6379,
    password: process.env.REDIS_PASSWORD || undefined,
    // tls: {
    //     rejectUnauthorized: false,
    // },
    // Optional: add other Redis options as needed
};

// Initialize Bull queue
const notificationQueue = new Bull(process.env.NOTIFICATION_QUEUE_NAME || 'notificationQueue', {
    redis: redisOptions,
    // Optional: Add more Bull configurations here
});

// Event listeners for queue monitoring
notificationQueue.on('error', (error) => {
    logger.error(`Notification Queue Error: ${error.message}`);
});

notificationQueue.on('waiting', (jobId) => {
    logger.info(`Job ${jobId} is waiting to be processed.`);
});

notificationQueue.on('active', (job, jobPromise) => {
    logger.info(`Job ${job.id} is now active; previous status was ${job.previousStatus}`);
});

notificationQueue.on('completed', (job, result) => {
    logger.info(`Job ${job.id} completed successfully with result: ${JSON.stringify(result)}`);
});

notificationQueue.on('failed', (job, err) => {
    logger.error(`Job ${job.id} failed with error: ${err.message}`);
});

module.exports = notificationQueue;
