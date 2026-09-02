const jwt = require('jsonwebtoken');
const User = require('../models/User');
const logger = require('../utils/logger');
const { normalizeRole, formatRoleForClient } = require('../utils/constants');

class AuthService {
  // Generate JWT token
  generateToken(userId, role) {
    try {
      const token = jwt.sign(
        { userId, role },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
      );
      return token;
    } catch (error) {
      logger.error(`Token generation error: ${error.message}`);
      throw error;
    }
  }

  // Login user
  async loginUser(email, password) {
    try {
      // Find user by email
      const user = await User.findOne({ email }).select('+password').populate('restaurantId');
      if (!user) {
        throw new Error('Invalid credentials');
      }

      if (!user.isActive) {
        throw new Error('User account is inactive');
      }

      // Check password
      const isPasswordValid = await user.matchPassword(password);
      if (!isPasswordValid) {
        throw new Error('Invalid credentials');
      }

      // Generate token
      const token = this.generateToken(user._id, user.role);

      logger.info(`User logged in: ${user.email}`);

      return {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: formatRoleForClient(user.role),
          restaurantId: user.restaurantId,
        },
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

  // Get user by ID
  async getUserById(userId) {
    try {
      const user = await User.findById(userId).populate('restaurantId');
      if (!user) {
        throw new Error('User not found');
      }
      if (!user.isActive) {
        throw new Error('User account is inactive');
      }
      const result = user.toObject();
      result.role = formatRoleForClient(result.role);
      return result;
    } catch (error) {
      logger.error(`Get user error: ${error.message}`);
      throw error;
    }
  }
}

module.exports = new AuthService();
