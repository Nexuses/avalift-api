const { Sequelize } = require('sequelize');
const dotenv = require('dotenv');
const { Status } = require('../src/dto');
dotenv.config();

const database = process.env.DB_NAME || 'zzizzu';
const username = process.env.DB_USER || 'postgres';
const password = process.env.DB_PASSWORD;
const host = process.env.DB_HOST || 'localhost';
const dialect = process.env.DB_DIALECT || 'postgres';
// Initialize Sequelize
const sequelize = new Sequelize(database, username, password, {
  host: host,
  dialect: dialect,
  logging: false,
});
(async () => {
  try {
    //data for Payment Types used for display on UI and for backend process
    const rowsToInsert = [
      { name: 'Authorised', createdAt: new Date(), updatedAt: new Date() },
      { name: 'Paid', createdAt: new Date(), updatedAt: new Date() },
      { name: 'Completed', createdAt: new Date(), updatedAt: new Date() },
      { name: 'Started', createdAt: new Date(), updatedAt: new Date() },
      { name: 'Initiated', createdAt: new Date(), updatedAt: new Date() }
    ];
    // Check if data exists and add if not
    const statusRow = await Status.bulkCreate(rowsToInsert, { ignoreDuplicates: true });
    console.log('Inserted Statuses :', statusRow.map(data => data.toJSON()));
  } catch (error) {
    console.error('Error occurred while adding Statuses', error);
  } finally {
    await sequelize.close();
  }
})();
