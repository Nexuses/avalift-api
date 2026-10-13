const padNumber = (num) => {
  return num.toString().padStart(7, "0");
};

// Helper function to generate OTP
const generateOtp = () => {
  return Math.floor(1000 + Math.random() * 9000).toString();
};

module.exports = {
  padNumber,
  generateOtp
};
