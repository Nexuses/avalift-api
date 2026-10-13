require('dotenv').config();
const Redis = require('ioredis');

const redisClient = new Redis({
  host: process.env.REDIS_HOST,
  port: process.env.REDIS_PORT || 6379,
  // tls: {
  //   rejectUnauthorized: false,
  // },
});

redisClient.on('connect', () => {
  console.log(`✅ Redis (TLS) connected to ${redisClient.options.host}:${redisClient.options.port}`);
});
redisClient.on('error', (err) => {
  console.error('❌ Redis connection error:', err);
});

module.exports = redisClient;
