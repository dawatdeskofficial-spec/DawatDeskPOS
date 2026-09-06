const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const NodeCache = require('node-cache');
const User = require('../models/User');
const Restaurant = require('../models/Restaurant');
const logger = require('../utils/logger');
const { normalizeRole, formatRoleForClient } = require('../utils/constants');

// Fast in-memory cache for authenticated user sessions (30s TTL)
const userAuthCache = new NodeCache({ stdTTL: 30, checkperiod: 60 });

class AuthService {
  // Generate JWT token with embedded fast-auth metadata
  generateToken(userId, role, restaurantId = null, name = '', email = '') {
    try {
      const restId = restaurantId
        ? (restaurantId._id || restaurantId.id || restaurantId).toString()
        : null;
      const token = jwt.sign(
        { userId, role, restaurantId: restId, name, email },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
      );
      return token;
    } catch (error) {
      logger.error(`Token generation error: ${error.message}`);
      throw error;
    }
  }

  // Fast cache accessors
  getCachedUser(userId) {
    if (!userId) return null;
    return userAuthCache.get(userId.toString()) || null;
  }

  setCachedUser(userId, user) {
    if (userId && user) {
      userAuthCache.set(userId.toString(), user);
    }
  }

  // Invalidate cached user on updates/logout
  invalidateUserCache(userId) {
    if (userId) {
      userAuthCache.del(userId.toString());
    }
  }

  // Login user
  async loginUser(email, password) {
    try {
      // Find user by email with targeted restaurant projection using lean
      const user = await User.findOne({ email: (email || '').toLowerCase().trim() })
        .select('+password')
        .populate('restaurantId', 'name location city status isActive maxTables gstPercentage')
        .lean();
      if (!user) {
        throw new Error('Invalid credentials');
      }

      if (!user.isActive) {
        throw new Error('User account is inactive');
      }

      // Check password using bcrypt directly
      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        throw new Error('Invalid credentials');
      }

      const restObj = user.restaurantId || null;
      if (restObj && restObj._id) {
        restObj.id = restObj._id.toString();
      }

      // Generate token with fast-auth claims
      const token = this.generateToken(
        user._id,
        user.role,
        restObj,
        user.name,
        user.email
      );

      logger.info(`User logged in: ${user.email}`);

      const userClient = {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        role: formatRoleForClient(user.role),
        restaurantId: restObj,
      };

      // Prime the user auth cache so subsequent init/me calls are instantaneous
      userAuthCache.set(user._id.toString(), {
        ...userClient,
        _id: user._id,
        isActive: user.isActive,
        phone: user.phone || '',
        location: user.location || '',
      });

      return {
        user: userClient,
        token,
      };
    } catch (error) {
      logger.error(`Login error: ${error.message}`);
      throw error;
    }
  }

  // Register user
  async registerUser(name, email, password, role, restaurantId = null) {
    try {
      void name;
      void password;
      void restaurantId;

      const existingUser = await User.findOne({ email });
      if (existingUser) {
        throw new Error('Email already registered');
      }

      const normalizedRole = normalizeRole(role);
      if (!normalizedRole) {
        throw new Error('Invalid role provided');
      }

      throw new Error('Public signup is disabled. Ask an administrator to create your staff account.');
    } catch (error) {
      logger.error(`Registration error: ${error.message}`);
      throw error;
    }
  }

  // Verify token
  verifyToken(token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      return decoded;
    } catch (error) {
      logger.error(`Token verification error: ${error.message}`);
      throw error;
    }
  }

  // Get user by ID with lean projection and in-memory caching
  async getUserById(userId) {
    try {
      const cacheKey = userId.toString();
      const cached = userAuthCache.get(cacheKey);
      if (cached) {
        return { ...cached };
      }

      const user = await User.findById(userId)
        .select('name email role restaurantId phone location isActive createdAt updatedAt')
        .populate('restaurantId', 'name location city status isActive maxTables gstPercentage')
        .lean();

      if (!user) {
        throw new Error('User not found');
      }
      if (!user.isActive) {
        throw new Error('User account is inactive');
      }

      user.id = user._id ? user._id.toString() : userId.toString();
      user.role = formatRoleForClient(user.role);

      userAuthCache.set(cacheKey, user);
      return { ...user };
    } catch (error) {
      logger.error(`Get user error: ${error.message}`);
      throw error;
    }
  }
}

module.exports = new AuthService();
