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

const tipQueue = new Bull(
    process.env.TIP_QUEUE_NAME || 'tipQueue',
{
    redis: redisOptions,
    defaultJobOptions: {
    removeOnComplete: true,
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 2000,
    },
  },
});

module.exports = {tipQueue}