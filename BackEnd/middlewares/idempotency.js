const ProcessedOperation = require('../models/ProcessedOperation');
const logger = require('../utils/logger');

/**
 * Middleware to enforce idempotency on mutating endpoints (POST, PUT, PATCH, DELETE).
 * If request contains 'x-client-op-id' header or body 'clientOperationId',
 * this middleware checks if it has already been processed.
 * - If yes: replay the stored response immediately.
 * - If no: proceed with the request, then record the successful response for future deduplication.
 */
const idempotencyMiddleware = async (req, res, next) => {
  // Only apply to mutating requests
  const mutatingMethods = ['POST', 'PUT', 'PATCH', 'DELETE'];
  if (!mutatingMethods.includes(req.method.toUpperCase())) {
    return next();
  }

  const clientOpId = req.headers['x-client-op-id'] || req.headers['x-idempotency-key'] || req.body?.clientOperationId;

  if (!clientOpId || typeof clientOpId !== 'string') {
    return next();
  }

  try {
    // Check if operation was already processed
    const existing = await ProcessedOperation.findOne({ clientOperationId: clientOpId.trim() }).lean();

    if (existing) {
      logger.info(`[Idempotency] Replaying cached response for operation: ${clientOpId}`);
      res.set('X-Idempotent-Replay', 'true');
      return res.status(existing.statusCode || 200).json(existing.responseBody);
    }

    // Intercept res.json to capture response body on success
    const originalJson = res.json.bind(res);
    res.json = function (body) {
      // Only cache successful or acceptable business responses (e.g. 200, 201)
      const statusCode = res.statusCode || 200;
      if (statusCode >= 200 && statusCode < 300) {
        ProcessedOperation.create({
          clientOperationId: clientOpId.trim(),
          endpoint: req.originalUrl || req.url,
          method: req.method,
          statusCode,
          responseBody: body,
          userId: req.user?._id || req.user?.id || null,
        }).catch((err) => {
          logger.error(`[Idempotency] Failed to record processed operation ${clientOpId}: ${err.message}`);
        });
      }

      return originalJson(body);
    };

    next();
  } catch (error) {
    logger.error(`[Idempotency] Error checking operation ${clientOpId}: ${error.message}`);
    // Non-blocking: proceed with request if idempotency check errors
    next();
  }
};

module.exports = idempotencyMiddleware;
