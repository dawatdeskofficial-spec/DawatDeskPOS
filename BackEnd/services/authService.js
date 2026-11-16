const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const NodeCache = require('node-cache');
const User = require('../models/User');
const Restaurant = require('../models/Restaurant');
const Otp = require('../models/Otp');
const emailService = require('./emailService');
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
        { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
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

  // Request OTP for Login or Registration Verification
  async requestOtp(email, purpose = 'login') {
    try {
      const cleanEmail = (email || '').toLowerCase().trim();
      if (!cleanEmail) {
        throw new Error('Email address is required');
      }

      let userName = '';
      const user = await User.findOne({ email: cleanEmail }).select('name isActive isEmailVerified').lean();

      if (purpose === 'login') {
        if (!user) {
          throw new Error('No account found with this email address.');
        }
        if (user.isActive === false && user.isEmailVerified !== false) {
          throw new Error('This user account is currently deactivated by administrator.');
        }
        userName = user.name || '';
      } else if (purpose === 'registration' || purpose === 'verification') {
        if (user && user.isEmailVerified === true) {
          throw new Error('An account with this email address is already verified and active.');
        }
        if (user) {
          userName = user.name || '';
        }
      }

      const otp = emailService.generateOtp();

      // Clear previous unverified OTPs for this email
      await Otp.deleteMany({ email: cleanEmail });

      // Save new OTP with 10-minute validity
      const otpDoc = new Otp({
        email: cleanEmail,
        otp,
        purpose,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      });
      await otpDoc.save();

      // Dispatch email via Gmail
      const emailResult = await emailService.sendOtpEmail(cleanEmail, otp, purpose, userName);

      return {
        success: true,
        message: `OTP sent to ${cleanEmail}`,
        email: cleanEmail,
        purpose,
        warning: emailResult.warning || null,
        // For development/testing: provide otp in response if delivery had warning
        ...(emailResult.warning ? { testOtp: otp } : {}),
      };
    } catch (error) {
      logger.error(`Request OTP error: ${error.message}`);
      throw error;
    }
  }

  // Verify OTP
  async verifyOtp(email, otp, purpose = null, consume = false) {
    try {
      const cleanEmail = (email || '').toLowerCase().trim();
      const cleanOtp = (otp || '').toString().trim();

      if (!cleanEmail || !cleanOtp) {
        throw new Error('Email and OTP code are required.');
      }

      const query = {
        email: cleanEmail,
        otp: cleanOtp,
        expiresAt: { $gt: new Date() },
      };
      if (purpose) {
        query.purpose = purpose;
      }

      const otpDoc = await Otp.findOne(query);

      if (!otpDoc) {
        throw new Error('Invalid or expired OTP. Please request a new one.');
      }

      if (consume) {
        await Otp.deleteOne({ _id: otpDoc._id });
      } else {
        otpDoc.verified = true;
        await otpDoc.save();
      }

      return true;
    } catch (error) {
      logger.error(`Verify OTP error: ${error.message}`);
      throw error;
    }
  }

  // Login user via OTP (also activates newly registered accounts on first OTP login)
  async loginWithOtp(email, otp) {
    try {
      const cleanEmail = (email || '').toLowerCase().trim();
      // Verify OTP (accepts either 'login', 'registration', or 'verification')
      await this.verifyOtp(cleanEmail, otp, null, true);

      // Check user and activate if pending verification
      const rawUser = await User.findOne({ email: cleanEmail });
      if (!rawUser) {
        throw new Error('User not found');
      }

      if (rawUser.isEmailVerified === false) {
        rawUser.isEmailVerified = true;
        rawUser.isActive = true;
        await rawUser.save();
        logger.info(`User email successfully verified via OTP login: ${rawUser.email}`);
      }

      if (!rawUser.isActive) {
        throw new Error('User account is inactive');
      }

      const user = await User.findOne({ email: cleanEmail })
        .populate('restaurantId', 'name location city status isActive maxTables gstPercentage')
        .lean();

      const restObj = user.restaurantId || null;
      if (restObj && restObj._id) {
        restObj.id = restObj._id.toString();
      }

      const token = this.generateToken(
        user._id,
        user.role,
        restObj,
        user.name,
        user.email
      );

      logger.info(`User logged in via OTP: ${user.email}`);

      const userClient = {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        role: formatRoleForClient(user.role),
        restaurantId: restObj,
        isEmailVerified: true,
      };

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
      logger.error(`Login with OTP error: ${error.message}`);
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
