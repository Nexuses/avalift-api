// src/dto/index.js
const fs = require('fs');
const path = require('path');
const Sequelize = require('sequelize');
const env = process.env.NODE_ENV || 'development';
// Load the config (which already has `.env` loaded)
const config = require('../config/database.js')[env];

let sequelize;

// Singleton pattern to prevent multiple Sequelize instances in production
if (process.env.NODE_ENV === 'production') {
  if (!global.sequelize) {
    sequelize = new Sequelize(config.database, config.username, config.password, config);
    global.sequelize = sequelize;
  } else {
    sequelize = global.sequelize;
  }
} else {
  // In development/test, create a fresh instance
  sequelize = new Sequelize(config.database, config.username, config.password, config);
}

const db = {};

// Dynamically import all model files in the dto directory
fs.readdirSync(__dirname)
  .filter((file) => file !== 'index.js' && file.endsWith('.js'))
  .forEach((file) => {
    console.log('Loading model file:', file); // Debugging line
    const model = require(path.join(__dirname, file))(sequelize);
    if (!model || !model.name) {
      console.error('Model missing name property:', file);
      return;
    }
    db[model.name] = model;
  });

// Setup model associations
Object.keys(db).forEach((modelName) => {
  if (db[modelName].associate) {
    db[modelName].associate(db);
  }
});

db.sequelize = sequelize;
db.Sequelize = Sequelize;

console.log('Loaded models:', Object.keys(db)); // Debugging line

module.exports = db;
