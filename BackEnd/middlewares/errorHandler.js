const { sendError } = require('../utils/responseHandler');
const logger = require('../utils/logger');

// Global error handling middleware
const errorHandler = (err, req, res, next) => {
  logger.error(`Error: ${err.message}`);

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map((error) => error.message);
    return sendError(res, 'Validation error', 400, { errors: messages });
  }

  // Mongoose duplicate key error
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    return sendError(res, `${field} already exists`, 400);
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    return sendError(res, 'Invalid token', 401);
  }

  if (err.name === 'TokenExpiredError') {
    return sendError(res, 'Token has expired', 401);
  }

  // Mongoose cast error
  if (err.name === 'CastError') {
    return sendError(res, 'Invalid ID format', 400);
  }

  // Default error
  return sendError(
    res,
    err.message || 'Internal Server Error',
    err.statusCode || 500
  );
};

module.exports = errorHandler;
