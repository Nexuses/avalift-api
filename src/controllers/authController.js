const authService = require("../services/authService");
const { addServerLog } = require("../services/serverLogsService");
const { OAuth2Client } = require("google-auth-library");
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

module.exports = {
  // Admin Login (Password-based)
  adminLogin: async (req, res) => {
    try {
      const { token, access } = await authService.adminLogin(req.body);
      res.status(200).json({
        success: true,
        status: 200,
        message: "Login successful",
        data: {
          token: token,
          access,
        },
      });
    } catch (error) {
      console.error("Error in adminLogin controller:", error.message);
      await addServerLog({
        log_level: "ERROR",
        service_name: "adminLogin",
        error_message: `adminLogin Controller error - ${error.message}.`,
      });
      res.status(401).json({
        success: false,
        status: 401,
        error: error.message,
      });
    }
  },

  // Request OTP for Other Users (Customer, Chauffeur, PD)
  requestOtp: async (req, res) => {
    try {
      const otp = await authService.requestOtp(req.body);
      res.status(200).json({
        success: true,
        otp: otp,
        status: 200,
        message: "OTP sent successfully",
      });
    } catch (error) {
      console.error("Error in requestOtp controller:", error.message);
      await addServerLog({
        log_level: "ERROR",
        service_name: "requestOtp",
        error_message: `requestOtp Controller error - ${error.message}.`,
      });
      res.status(400).json({
        success: false,
        status: 400,
        error: error.message,
      });
    }
  },

  requestOtpChauffeurPd: async (req, res) => {
    try {
      const otp = await authService.requestOtpChauffeurPd(req.body);
      res.status(200).json({
        success: true,
        otp: otp,
        status: 200,
        message: "OTP sent successfully",
      });
    } catch (error) {
      console.error("Error in requestOtpChauffeurPd controller:", error.message);
      await addServerLog({
        log_level: "ERROR",
        service_name: "requestOtpChauffeurPd",
        error_message: `requestOtpChauffeurPd Controller error - ${error.message}.`,
      });
      res.status(400).json({
        success: false,
        status: 400,
        error: error.message,
      });
    }
  },


  // googleCallbackHandler :async (req, res) => {
  //   try {
  //     const user = req.user;

  //     const payload = {
  //       id: user.id,
  //       email_id: user.email_id,
  //       role: user.role_id,
  //       role_id: user.role_id,
  //       permissions: [], // fetch and include if needed
  //       organization_id: null, // set if available
  //     };

  //     const token = jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });

  //     // Save token in Redis
  //     const sessionKey = `${SESSION_PREFIX}${user.id}`;
  //     await redisClient.set(sessionKey, token);

  //     // Respond with token (or redirect with token)
  //     res.status(200).json({
  //       success: true,
  //       status: 200,
  //       message: "Logged in successfully via Google",
  //       token,
  //     });
  //   } catch (err) {
  //     console.error("Google callback error:", err);
  //     res.status(500).json({
  //       success: false,
  //       status: 500,
  //       message: "Internal server error",
  //     });
  //   }
  // },

  googleCallbackHandler: async (req, res) => {
    try {
      const token = await authService.googleLoginSSO(req.user);
      res.status(200).json({
        success: true,
        status: 200,
        message: "Logged in successfully via Google",
        token,
        user: req.user,
      });
    } catch (err) {
      console.error("Google SSO error:", err);
      res.status(500).json({
        success: false,
        status: 500,
        message: "Internal server error",
      });
    }
  },


  googleSSOAppHandler: async (req, res) => {
    try {
      const { id_token } = req.body;
      if (!id_token) {
        return res.status(400).json({ status: 400, success: false, message: "ID token is required" });
      }

      console.log("Received", id_token);

      // Verify the token
      const ticket = await client.verifyIdToken({
        idToken: id_token,
        audience: process.env.GOOGLE_CLIENT_ID,
      });

      const payload = ticket.getPayload();
      console.log(payload);

      const { email, name } = payload;

      const user = await authService.googleLoginSSO(payload); // Use same service
      res.status(200).json({
        success: true,
        status: 200,
        message: "Logged in via Google",
        token: user.token,
        user: user.data,
      });
    } catch (err) {
      console.error("Google login error:", err);
      res.status(500).json({ status: 500, success: false, message: "Google login failed" });
    }
  },


  // Verify OTP and Authenticate Other Users
  verifyOtp: async (req, res) => {
    try {
      // Verify OTP
      const result = await authService.verifyOtp(req.body);

      if (result.token && result.access) {
        // Existing user: Authenticate
        res.status(200).json({
          message: "User authenticated successfully.",
          status: 200,
          success: true,
          new_user: false,
          token: result.token,
          access: result.access,
          device_id: req.body.device_id, // Add device_id in the response
        });
      } else if (result.tempToken) {
        res.status(200).json({
          success: true,
          status: 200,
          new_user: true,
          message: "OTP verified. Please complete registration.",
          temp_token: result.tempToken,
        });
      } else {
        throw new Error("Invalid verification result.");
      }
    } catch (error) {
      console.error("Error in verifyOtp controller:", error.message);
      await addServerLog({
        log_level: "ERROR",
        service_name: "verifyOtp",
        error_message: `verifyOtp Controller error - ${error.message}.`,
      });
      res.status(400).json({
        success: false,
        status: 400,
        error: error.message,
      });
    }
  },

  verifyOtpChauffeurPd: async (req, res) => {
    try {
      // Verify OTP
      const result = await authService.verifyOtpChauffeurPd(req.body);
      res.status(200).json({
        message: "User authenticated successfully.",
        status: 200,
        success: true,
        data: {
          token: result.token,
          access: result.access,
          device_id: req.body.device_id,
          ...(result.is_salaried !== undefined && { is_salaried: result.is_salaried })
        },
      });
    } catch (error) {
      console.error("Error in verifyOtpChauffeurPd controller:", error.message);
      await addServerLog({
        log_level: "ERROR",
        service_name: "verifyOtpChauffeurPd",
        error_message: `verifyOtpChauffeurPd Controller error - ${error.message}.`,
      });
      res.status(400).json({
        success: false,
        status: 400,
        error: error.message,
      });
    }
  },

  // Complete Registration for Customers
  completeRegistration: async (req, res) => {
    try {
      const { temp_token, first_name, last_name, password, type, device_id, referral_code, input_email_id } = req.body;

      const result = await authService.completeRegistration({
        temp_token,
        first_name,
        last_name,
        type,
        device_id,
        referral_code,
        input_email_id,
      });

      res.status(201).json({
        success: true,
        status: 201,
        message: "User registered and authenticated successfully.",
        token: result.token,
        access: result.access,
      });

    } catch (error) {
      const statusCode = error.status || 400; // Default to 400 if no custom status
      console.error("Error in completeRegistration controller:", error.message);

      await addServerLog({
        log_level: "ERROR",
        service_name: "completeRegistration",
        error_message: `completeRegistration Controller error - ${error.message}.`,
      });

      res.status(statusCode).json({
        success: false,
        status: statusCode,
        error: error.message,
      });
    }
  },


  createSuperAdmin: async (req, res) => {
    try {
      const user = await authService.createSuperAdmin(req.body);
      res.status(201).json({
        success: true,
        status: 201,
        message: "Super Admin Created Successfully",
        data: {
          id: user.id,
          email_id: user.email_id,
          first_name: user.first_name,
          last_name: user.last_name,
        },
      });
    } catch (error) {
      console.error("Error in createSuperAdmin controller:", error.message);
      await addServerLog({
        log_level: "ERROR",
        service_name: "createSuperAdmin",
        error_message: `createSuperAdmin Controller error - ${error.message}.`,
      });
      if (error.name === "ValidationError") {
        return res.status(400).json({
          success: false,
          status: 400,
          error: error.message,
        });
      }
      if (error.message.includes("already in use")) {
        return res.status(409).json({
          success: false,
          status: 409,
          error: error.message,
        });
      }
      res.status(500).json({
        success: false,
        status: 500,
        error: "Internal Server Error",
      });
    }
  },

  changePassword: async (req, res) => {
    try {
      const user_id = req.user.id
      console.log("USER ID: ", user_id);
      const { old_password, new_password } = req.body;
      const response = await authService.changePassword(user_id, new_password, old_password);
      res.status(200).json({ status: 200, success: true, message: response, data: {} });
    } catch (error) {
      console.error("Error in changePassword controller:", error.message);
      await addServerLog({
        log_level: "ERROR",
        service_name: "changePassword",
        error_message: `changePassword Controller error - ${error.message}.`,
      });
      res.status(error.statusCode || 500).json({
        error: error.message,
        status: error.statusCode || 500,
        success: false
      });
    }
  },

  forgotPassword: async (req, res) => {
    try {
      const { email_id } = req.body;
      const response = await authService.forgotPassword(email_id);
      res.status(200).json(response);
    } catch (error) {
      console.error("Error in forgotPassword controller:", error.message);
      await addServerLog({
        log_level: "ERROR",
        service_name: "forgotPassword",
        error_message: `forgotPassword Controller error - ${error.message}.`,
      });
      res.status(error.statusCode || 500).json({
        error: error.message,
      });
    }
  },

  // Controller to handle user logout.
  logout: async (req, res) => {
    try {
      const user_id = req.user.id;
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(400).json({ message: "Authorization token missing." });
      }
      const token = authHeader.split(" ")[1];
      await authService.logout(token, user_id);
      res.status(200).json({
        success: true,
        status: 200,
        message: "Successfully logged out.",
      });
    } catch (error) {
      console.error("Error in logout controller:", error.message);
      await addServerLog({
        log_level: "ERROR",
        service_name: "logout",
        error_message: `logout Controller error - ${error.message}.`,
      });
      res.status(500).json({
        success: false,
        status: 500,
        error: "Couldn't logout the user.",
      });
    }
  },
  adminForgotPassword: async (req, res) => {
    try {
      const { email } = req.body;
      const response = await authService.forgotPassword(email);
      res.status(200).json({ success: true, status: 200, message: response.message });
    } catch (error) {
      console.error("Error in adminForgotPassword:", error.message);
      await addServerLog({
        log_level: "ERROR",
        service_name: "adminForgotPassword",
        error_message: `adminForgotPassword Controller error - ${error.message}.`
      });
      return res.status(error.statusCode || 500).json({
        success: false,
        status: error.statusCode || 500,
        message: error.message,
      });
    }
  },

  adminVerifyOtp: async (req, res) => {
    try {
      // const { otp_code, email_id, os_type, device_id, device_model } = req.body;
      const response = await authService.adminVerifyOtp(req.body);
      res.status(200).json({ success: true, status: 200, message: 'OTP verified successfully', data: response });
    } catch (error) {
      console.error("Error in adminVerifyOtp:", error.message);
      await addServerLog({
        log_level: "ERROR",
        service_name: "adminVerifyOtp",
        error_message: `adminVerifyOtp Controller error - ${error.message}.`
      });
      return res.status(error.statusCode || 500).json({
        success: false,
        status: error.statusCode || 500,
        message: error.message,
      });
    }
  },
  getAppVersion: async (req, res) => {
    try {
      const appVersionsInfo = await authService.getAppVersions();

      res
        .status(200)
        .json({
          data: { appVersionsInfo },
          success: true,
          message: `App Versions returned successfully`,
        });
    } catch (error) {
      res
        .status(500)
        .json({ success: false, error: "Failed to get App Version values" });
    }
  }
};
