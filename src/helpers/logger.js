// src/helpers/logger.js
const { createLogger, format, transports } = require('winston');

const logger = createLogger({
  level: 'info',
  format: format.combine(
    format.timestamp(),
    format.printf(({ timestamp, level, message, meta }) => {
      return `${timestamp} [${level.toUpperCase()}]: ${message} ${meta ? JSON.stringify(meta) : ''}`;
    })
  ),
  transports: [
    new transports.Console(),
    
  ],
});

module.exports = logger;
