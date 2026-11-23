const NodeCache = require('node-cache');
const logger = require('../utils/logger');

// Cache instance for tracking request counts
const rateCache = new NodeCache({ stdTTL: 300, checkperiod: 60 });

/**
 * Creates an in-memory Rate Limiter middleware
 * @param {Object} options
 * @param {number} options.windowMs Window in milliseconds (e.g. 5 mins = 300000)
 * @param {number} options.max Maximum allowed requests in window
 * @param {string} options.message Error message returned on 429
 * @param {Function} [options.keyGenerator] Function to compute client key (defaults to IP)
 */
function createRateLimiter({ windowMs = 300000, max = 15, message = 'Too many requests. Please try again later.', keyGenerator }) {
  const windowSec = Math.ceil(windowMs / 1000);

  return function rateLimiterMiddleware(req, res, next) {
    const rawIp = req.headers['x-forwarded-for'] || req.ip || req.connection?.remoteAddress || 'unknown';
    const clientIp = typeof rawIp === 'string' ? rawIp.split(',')[0].trim() : String(rawIp);
    const key = keyGenerator ? keyGenerator(req, clientIp) : `rate_${clientIp}_${req.baseUrl || req.path}`;

    const record = rateCache.get(key);
    const now = Date.now();

    if (!record) {
      // First hit in this window
      rateCache.set(key, { count: 1, resetAt: now + windowMs }, windowSec);
      res.setHeader('X-RateLimit-Limit', max);
      res.setHeader('X-RateLimit-Remaining', max - 1);
      res.setHeader('X-RateLimit-Reset', Math.ceil((now + windowMs) / 1000));
      return next();
    }

    if (record.count >= max) {
      const retryAfterSec = Math.max(1, Math.ceil((record.resetAt - now) / 1000));
      res.setHeader('Retry-After', retryAfterSec);
      res.setHeader('X-RateLimit-Limit', max);
      res.setHeader('X-RateLimit-Remaining', 0);
      res.setHeader('X-RateLimit-Reset', Math.ceil(record.resetAt / 1000));

      logger.warn(`Rate limit exceeded for key: ${key}. Hits: ${record.count}/${max}`);
      return res.status(429).json({
        success: false,
        message: `${message} (Retry after ${retryAfterSec}s)`,
        retryAfter: retryAfterSec,
      });
    }

    // Increment count
    record.count += 1;
    const remainingTtl = Math.max(1, Math.ceil((record.resetAt - now) / 1000));
    rateCache.set(key, record, remainingTtl);

    res.setHeader('X-RateLimit-Limit', max);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, max - record.count));
    res.setHeader('X-RateLimit-Reset', Math.ceil(record.resetAt / 1000));
    next();
  };
}

// 1. Authentication Limiter: Max 15 attempts per 5 minutes per IP
const authLimiter = createRateLimiter({
  windowMs: 5 * 60 * 1000,
  max: 15,
  message: 'Too many authentication attempts from this IP address. Access temporarily throttled for security.',
  keyGenerator: (req, ip) => `auth_ip_${ip}`,
});

// 2. OTP Request Limiter: Max 5 OTP requests per 10 minutes per IP/email
const otpSendLimiter = createRateLimiter({
  windowMs: 10 * 60 * 1000,
  max: 5,
  message: 'Too many OTP generation requests. Please wait a few minutes before requesting another code.',
  keyGenerator: (req, ip) => {
    const email = (req.body?.email || '').toLowerCase().trim();
    return `otp_send_${ip}_${email}`;
  },
});

// 3. OTP Verification Limiter: Max 10 attempts per 5 minutes per IP
const otpVerifyLimiter = createRateLimiter({
  windowMs: 5 * 60 * 1000,
  max: 10,
  message: 'Too many OTP verification attempts. Access is locked to prevent brute-force attacks.',
  keyGenerator: (req, ip) => `otp_verify_ip_${ip}`,
});

module.exports = {
  createRateLimiter,
  authLimiter,
  otpSendLimiter,
  otpVerifyLimiter,
};
