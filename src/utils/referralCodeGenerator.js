const crypto = require('crypto');

function generateReferralCode(user_first_name) {
  const namePart =user_first_name.toUpperCase().slice(0, 4);
  const randomPart = crypto.randomBytes(3).toString('hex').toUpperCase(); // 6 char hex
  return `${namePart}-${randomPart}`;
}

module.exports = {
    generateReferralCode
};