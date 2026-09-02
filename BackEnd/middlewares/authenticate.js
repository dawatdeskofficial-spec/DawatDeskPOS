const authService = require('../services/authService');
const { sendError } = require('../utils/responseHandler');
const logger = require('../utils/logger');

// Authentication middleware - Verify JWT token
const authenticate = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      return sendError(res, 'Authorization token is missing', 401);
    }

    const decoded = authService.verifyToken(token);

    const fullUser = await authService.getUserById(decoded.userId);
    fullUser._id = fullUser.id || fullUser._id;
    fullUser.userId = fullUser._id;
    req.user = fullUser;

    next();
  } catch (error) {
    logger.error(`Authentication error: ${error.message}`);
    return sendError(res, 'Invalid or expired token', 401);
  }
};

module.exports = authenticate;
