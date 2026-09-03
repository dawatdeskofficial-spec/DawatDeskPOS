const cacheService = require('../utils/cache');
const logger = require('../utils/logger');

/**
 * Middleware to cache API responses
 * @param {string} prefix - Custom prefix for the cache key, e.g. 'menu' or 'categories'
 * @param {number} ttl - Time to live in seconds
 * @returns 
 */
const cacheMiddleware = (prefix, ttl = 300) => {
  return (req, res, next) => {
    // Only cache GET requests
    if (req.method !== 'GET') {
      return next();
    }

    try {
      // Create a unique key based on the URL and query parameters
      // e.g. category-restaurant-1234:page:1:limit:20
      const queryStr = Object.keys(req.query)
        .sort()
        .map(k => `${k}=${req.query[k]}`)
        .join('&');
      
      const userId = req.user && req.user.id ? req.user.id : 'anon';
      const role = req.user && req.user.role ? req.user.role : 'public';
      
      // Determine base identifier (usually restaurantId from params or user)
      const restaurantId = req.params.restaurantId || (req.user ? req.user.restaurantId : 'all');
      
      const cacheKey = `${prefix}:restaurant:${restaurantId}:query:${queryStr}:role:${role}`;
      
      const cachedData = cacheService.get(cacheKey);
      
      if (cachedData) {
        // Return cached response
        return res.json(cachedData);
      }

      // Intercept the res.json method to store the response before sending it
      const originalJson = res.json.bind(res);
      
      res.json = (body) => {
        // Only cache successful responses
        if (res.statusCode >= 200 && res.statusCode < 300 && body && body.success !== false) {
          cacheService.set(cacheKey, body, ttl);
        }
        
        return originalJson(body);
      };

      // Ensure req object has info about cache generation for debugging (optional)
      req._cacheKey = cacheKey;
      
      next();
    } catch (error) {
      logger.error(`Cache Middleware Error: ${error.message}`);
      next(); // Continue even if cache fails
    }
  };
};

module.exports = cacheMiddleware;
