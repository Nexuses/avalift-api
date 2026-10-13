// src/middleware/authenticate.js

const jwt = require("jsonwebtoken");
const redisClient = require("../config/redis"); // Import Redis client

const JWT_SECRET = process.env.JWT_SECRET;
const SESSION_PREFIX = "session:"; // Ensure it matches the prefix in authService.js

const authenticate = async (req, res, next) => {
  const authHeader = req.header("Authorization");
  const token = authHeader?.replace("Bearer ", "");

  if (!token) {
    return res
      .status(401)
      .json({
        success: false,
        status: 401,
        message: "No token provided. Authorization denied.",
      });
  }

  try {
    // Verify JWT token
    const decoded = jwt.verify(token, JWT_SECRET);

    // Extract user ID from decoded token
    const userId = decoded.id; // Adjust according to your token payload

    if (!userId) {
      return res
        .status(401)
        .json({
          success: false,
          status: 401,
          message: "Invalid token payload.",
        });
    }

    // Retrieve the current active token from Redis
    const sessionKey = `${SESSION_PREFIX}${userId}`;
    const storedToken = await redisClient.get(sessionKey);

    if (!storedToken) {
      return res
        .status(401)
        .json({
          success: false,
          status: 401,
          message: "Session expired. Please log in again.",
        });
    }

    // Compare the provided token with the stored token
    if (storedToken.trim() !== token.trim()) {
      return res
        .status(401)
        .json({
          success: false,
          status: 401,
          message: "A new login has been detected. Your session has expired.",
        });
    }

    // Attach user information to the request object
    req.user = {
      id: decoded.id,
      email_id: decoded.email_id,
      role: decoded.role,
      role_id: decoded.role_id,
      permissions: decoded.permissions,
      organization_id: decoded.organization_id,
    };

    next();
  } catch (err) {
    console.error("Authentication error:", err);
    res
      .status(401)
      .json({ success: false, status: 401, message: "Token is not valid." });
  }
};

module.exports = authenticate;
