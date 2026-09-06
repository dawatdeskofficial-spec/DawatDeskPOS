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

    // Fast-path 1: In-memory cache on this node
    let fullUser = authService.getCachedUser(decoded.userId);
    if (!fullUser) {
      // Fast-path 2: Self-contained cryptographically verified token (0ms roundtrip)
      if (decoded.role && decoded.restaurantId !== undefined) {
        const idStr = decoded.userId.toString();
        fullUser = {
          id: idStr,
          userId: idStr,
          _id: idStr,
          role: decoded.role,
          restaurantId: decoded.restaurantId,
          name: decoded.name || '',
          email: decoded.email || '',
          isActive: true,
        };
        authService.setCachedUser(idStr, fullUser);
      } else {
        // Fallback for legacy tokens without embedded restaurantId
        fullUser = await authService.getUserById(decoded.userId);
      }
    }

    const idStr = fullUser.id ? fullUser.id.toString() : (fullUser._id ? fullUser._id.toString() : decoded.userId.toString());
    fullUser.id = idStr;
    fullUser.userId = idStr;
    fullUser._id = fullUser._id || idStr;
    req.user = fullUser;

    next();
  } catch (error) {
    logger.error(`Authentication error: ${error.message}`);
    return sendError(res, 'Invalid or expired token', 401);
  }
};

module.exports = authenticate;
