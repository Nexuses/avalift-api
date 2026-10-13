// src/helpers/authHelper.js

const jwt = require("jsonwebtoken");
const { getPermissionsForRoles } = require("../services/roleService");

const JWT_SECRET = process.env.JWT_SECRET || "your_jwt_secret";
const TEMP_TOKEN_SECRET =
  process.env.TEMP_TOKEN_SECRET || "your_temp_token_secret";

module.exports = {
  generateToken: async (user) => {
    // Retrieve permissions based on user's role ID
    const userAccessData = await getPermissionsForRoles(user.role_id);
    const payload = {
      id: user.id,
      email_id: user.email_id || null,
      role_id: user.role_id,
      role: userAccessData.roles,
      permissions: userAccessData.permissions,
      organization_id: userAccessData.allowedOrganization,
    };
    return jwt.sign(payload, JWT_SECRET, { expiresIn: "365d" });
  },

  // Generate Temporary Token for new users
  generateTempToken: (data) => {
    const payload = {
      email_id: data.email_id,
      mobile_number: data.mobile_number,
      country_code: data.country_code,
      device_id:data.device_id,
      os_type: data.os_type,
      device_model: data.device_model
    };
    const tempToken = jwt.sign(payload, TEMP_TOKEN_SECRET, {
      expiresIn: "10m",
    });
    return tempToken;
  },

  // Decode Temporary Token
  decodeTempToken: (temp_token) => {
    try {
      const decoded = jwt.verify(temp_token, TEMP_TOKEN_SECRET);
      return {
        email_id: decoded.email_id,
        mobile_number: decoded.mobile_number,
        country_code: decoded.country_code,
        device_id:decoded.device_id,
        os_type: decoded.os_type,
        device_model: decoded.device_model
      };
    } catch (error) {
      throw new Error("Invalid or expired temporary token.");
    }
  },
    // Helper function to generate OTP
    generateOtp: () => {
      return Math.floor(1000 + Math.random() * 9000).toString();
    },
};
