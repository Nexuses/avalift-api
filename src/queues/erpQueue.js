const Bull = require('bull');
require('dotenv').config();

const redisOptions = {
    host: process.env.REDIS_HOST,
    port: process.env.REDIS_PORT,
    password: process.env.REDIS_PASSWORD,
    // tls: {
    //     rejectUnauthorized: false,
    // }
};

const erpQueue = new Bull(
    process.env.ERP_QUEUE_NAME || 'erpQueue',
    {
        redis: redisOptions,
        defaultJobOptions: {
            attempts: 5,
            backoff: 60000,
            removeOnComplete: true,
            removeOnFail: false
        }
    }
);

module.exports = erpQueue;
