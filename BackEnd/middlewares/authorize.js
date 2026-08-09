const { sendError } = require('../utils/responseHandler');
const { PERMISSIONS, normalizeRole } = require('../utils/constants');
const logger = require('../utils/logger');

// Role-based authorization middleware
const authorize = (...allowedRoles) => {
  return (req, res, next) => {
    try {
      const userRole = normalizeRole(req.user?.role);

      if (!userRole) {
        return sendError(res, 'User role not found in token', 401);
      }

      const normalizedAllowedRoles = allowedRoles.map(normalizeRole);
      if (!normalizedAllowedRoles.includes(userRole)) {
        logger.warn(
          `Unauthorized access attempt by user with role: ${req.user?.role}`
        );
        return sendError(res, 'You do not have permission to perform this action', 403);
      }

      next();
    } catch (error) {
      logger.error(`Authorization error: ${error.message}`);
      return sendError(res, 'Authorization failed', 403);
    }
  };
};

// Permission-based middleware
const hasPermission = (requiredPermission) => {
  return (req, res, next) => {
    try {
      const userRole = normalizeRole(req.user?.role);

      if (!userRole) {
        return sendError(res, 'User role not found in token', 401);
      }

      const userPermissions = PERMISSIONS[userRole] || [];

      if (!userPermissions.includes(requiredPermission)) {
        logger.warn(
          `Permission denied for user ${req.user.userId}: ${requiredPermission}`
        );
        return sendError(res, 'You do not have the required permission', 403);
      }

      next();
    } catch (error) {
      logger.error(`Permission check error: ${error.message}`);
      return sendError(res, 'Permission check failed', 403);
    }
  };
};

module.exports = {
  authorize,
  hasPermission,
};
