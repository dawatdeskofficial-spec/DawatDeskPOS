const NodeCache = require('node-cache');
const logger = require('./logger');

// Global cache instance with standard 5-minute TTL
const appCache = new NodeCache({ stdTTL: 300, checkperiod: 120 });

class CacheService {
  /**
   * Get an item from the cache
   */
  get(key) {
    try {
      return appCache.get(key);
    } catch (error) {
      logger.error(`Cache Get Error for ${key}: ${error.message}`);
      return undefined;
    }
  }

  /**
   * Set an item in the cache
   */
  set(key, value, ttl = 300) {
    try {
      appCache.set(key, value, ttl);
    } catch (error) {
      logger.error(`Cache Set Error for ${key}: ${error.message}`);
    }
  }

  /**
   * Delete an item from the cache
   */
  del(key) {
    try {
      appCache.del(key);
    } catch (error) {
      logger.error(`Cache Del Error for ${key}: ${error.message}`);
    }
  }

  /**
   * Invalidate cache keys matching a prefix/pattern
   */
  deleteByPrefix(prefix) {
    try {
      const keys = appCache.keys();
      const keysToDelete = keys.filter(key => key.startsWith(prefix));
      if (keysToDelete.length > 0) {
        appCache.del(keysToDelete);
        logger.info(`Cache invalidated for pattern: ${prefix}`);
      }
    } catch (error) {
      logger.error(`Cache deleteByPrefix Error for ${prefix}: ${error.message}`);
    }
  }

  /**
   * Clear entire cache
   */
  flush() {
    try {
      appCache.flushAll();
    } catch (error) {
      logger.error(`Cache flush Error: ${error.message}`);
    }
  }
}

module.exports = new CacheService();
