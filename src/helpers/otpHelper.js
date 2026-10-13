// src/helpers/otpHelper.js

const sendSms = require('./sendSms');
const sendEmail = require('./sendEmail');

const sendOtp = async (user, otpCode) => {
  if (user.email_id) {
    await sendEmail(user.email_id, 'Your OTP Code', `Your OTP code is: ${otpCode}`);
  }
  if (user.mobile_number) {
    await sendSms(user.mobile_number, `Your OTP code is: ${otpCode}`);
  }
  if (!user.email_id && !user.mobile_number) {
    throw new Error('No contact information available to send OTP.');
  }
};

module.exports = {
  sendOtp,
};
