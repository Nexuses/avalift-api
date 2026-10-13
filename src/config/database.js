// src/config/database.js
require('dotenv').config();

module.exports = {
  development: {
    username: process.env.DB_USER || 'psqlzeizzust',
    password: process.env.DB_PASSWORD || 'Zei$sta$5%8#',
    database: process.env.DB_NAME || 'zeizzudbst_new',
    host: process.env.DB_HOST || 'staging-zeizzu-database.ch6uc2k8ayt4.ap-southeast-1.rds.amazonaws.com',
    port: process.env.DB_PORT || '5432',
    dialect: 'postgres',
    logging: false,
    dialectOptions: process.env.DB_SSL === 'true'
      ? {
        ssl: {
          require: true,
          rejectUnauthorized: false,
        },
      }
      : {},
  },
  test: {
    username: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    dialect: 'postgres',
    logging: false,
    dialectOptions: process.env.DB_SSL === 'true'
      ? {
        ssl: {
          require: true,
          rejectUnauthorized: false,
        },
      }
      : {},
  },
  production: {
    username: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    dialect: 'postgres',
    logging: false
  },
};