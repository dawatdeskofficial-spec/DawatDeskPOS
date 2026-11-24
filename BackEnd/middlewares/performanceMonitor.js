/**
 * Lightweight API Performance Monitoring Middleware
 * Measures execution duration, sanitized route, HTTP status code, and timestamp.
 * Strictly avoids logging secrets, tokens, or PII.
 */
const logger = require('../utils/logger');

function performanceMonitor(req, res, next) {
  // Only monitor API routes to reduce log noise
  if (!req.path.startsWith('/api') && req.path !== '/health') {
    return next();
  }

  const startTime = Date.now();
  const timestamp = new Date().toISOString();

  // Hook into response completion
  res.on('finish', () => {
    const totalExecutionMs = Date.now() - startTime;
    const statusCode = res.statusCode;
    const method = req.method;
    
    // Sanitize path: strip query parameters or sensitive tokens
    const rawPath = req.originalUrl || req.path || '';
    const cleanPath = rawPath.split('?')[0];

    // Append server timing header
    try {
      if (!res.headersSent) {
        res.setHeader('X-Response-Time', `${totalExecutionMs}ms`);
      }
    } catch {
      // Ignore if headers already dispatched
    }

    // Structured performance log
    logger.info(
      `[PERF] ${method} ${cleanPath} | Status: ${statusCode} | Execution: ${totalExecutionMs}ms | Time: ${timestamp}`
    );
  });

  next();
}

module.exports = performanceMonitor;
