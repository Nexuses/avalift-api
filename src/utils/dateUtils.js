// src/utils/dateUtils.js
const moment = require('moment');

const formatDate = (date, format = 'YYYY-MM-DD') => {
  return moment(date).format(format);
};

const parseDate = (dateString, format = 'YYYY-MM-DD') => {
  return moment(dateString, format).toDate();
};

const getDateNumber = (timestamp) => {
  const date = new Date(timestamp);
  // "2025-03-17"
  const str = date.toISOString().slice(0, 10); 
  // Convert to "20250317" => parseInt('20250317') => 20250317
  return parseInt(str.replaceAll('-', ''), 10);
};


// Utility function: convert entire milliseconds to hours (floating or integer).
// If you want minutes, you can just change the divisor or store the ms directly.
function msToHours(ms) {
  return ms / (1000 * 60 * 60);
};


module.exports = { formatDate, parseDate, getDateNumber, msToHours };
