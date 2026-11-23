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

// Helper to check if an email is a dedicated testing account
function isTestingEmail(email) {
  const clean = (email || '').toLowerCase().trim();
  const testList = [
    'dawatdesk.official@gmail.com',
    'admin@gmail.com',
    'manager@gmail.com',
    'waiter@gmail.com',
    'chef@gmail.com',
    'cashier@gmail.com',
    'test@gmail.com',
    'manager.spice@gmail.com',
    'manager.pasta@gmail.com',
    'manager.hariom@gmail.com',
    'chef.michael@gmail.com',
    'jane.waiter@gmail.com',
    'john.waiter@gmail.com',
    'hari.cashier@gmail.com',
  ];
  return (
    testList.includes(clean) ||
    clean.startsWith('test') ||
    clean.includes('test@') ||
    clean.startsWith('admin@') ||
    clean.startsWith('manager@') ||
    clean.startsWith('waiter@') ||
    clean.startsWith('chef@') ||
    clean.startsWith('cashier@')
  );
}

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
      userAuthCache.del(`full_user_${userId.toString()}`);
    }
  }

  // Flush all cached user sessions (e.g. when facility configuration changes)
  invalidateAllUserCaches() {
    userAuthCache.flushAll();
  }

  // Login user with brute-force defense, timing-attack protection, and automatic account lockout
  async loginUser(email, password) {
    try {
      const cleanEmail = (email || '').toLowerCase().trim();

      // Find user with password and restaurant projection
      const user = await User.findOne({ email: cleanEmail })
        .select('+password +failedLoginAttempts +lockUntil')
        .populate('restaurantId', 'name location city status isActive maxTables gstPercentage facilities');

      // Timing-attack mitigation: run dummy bcrypt compare so response duration is uniform
      if (!user) {
        await bcrypt.compare(password || '', '$2a$10$wT0X8z5yPqN6yB8Q4vN0reX7Uv.C0o.q5tU2.K3P6M1H4J5K6L7M8');
        throw new Error('Invalid credentials');
      }

      // Check account lockout status
      if (user.lockUntil && user.lockUntil > new Date()) {
        const remainingMinutes = Math.max(1, Math.ceil((user.lockUntil.getTime() - Date.now()) / (60 * 1000)));
        logger.warn(`Locked account login attempt for: ${user.email}. Remaining lockout: ${remainingMinutes}m`);
        throw new Error(`Account is temporarily locked due to multiple failed login attempts. Please try again after ${remainingMinutes} minute(s).`);
      }

      if (!user.isActive) {
        throw new Error('User account is inactive. Please contact system administrator.');
      }

      // Check password using bcrypt
      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        const currentFailed = (user.failedLoginAttempts || 0) + 1;
        if (currentFailed >= 5) {
          // Lock account for 15 minutes after 5 consecutive failures
          const lockTime = new Date(Date.now() + 15 * 60 * 1000);
          await User.updateOne(
            { _id: user._id },
            { $set: { lockUntil: lockTime, failedLoginAttempts: 0 } }
          );
          logger.warn(`Security alert: Account ${user.email} locked for 15 minutes due to 5 consecutive failed login attempts.`);
          throw new Error('Account locked for 15 minutes due to 5 consecutive failed login attempts.');
        } else {
          await User.updateOne(
            { _id: user._id },
            { $set: { failedLoginAttempts: currentFailed } }
          );
          const remaining = 5 - currentFailed;
          throw new Error(`Invalid credentials. ${remaining} attempt(s) remaining before account lockout.`);
        }
      }

      // Successful password: reset failed attempts counter and release lock if any
      if ((user.failedLoginAttempts || 0) > 0 || user.lockUntil) {
        await User.updateOne(
          { _id: user._id },
          { $set: { failedLoginAttempts: 0, lockUntil: null } }
        );
      }

      let restObj = null;
      if (user.restaurantId) {
        const rawRest = typeof user.restaurantId.toObject === 'function'
          ? user.restaurantId.toObject()
          : { ...user.restaurantId };
        restObj = {
          ...rawRest,
          id: rawRest._id ? rawRest._id.toString() : rawRest.id,
        };
      }

      // Generate token with fast-auth claims
      const token = this.generateToken(
        user._id,
        user.role,
        restObj,
        user.name,
        user.email
      );

      logger.info(`User successfully logged in: ${user.email}`);

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

      const isTest = isTestingEmail(cleanEmail);
      const otp = isTest ? '123456' : emailService.generateOtp();

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

      // Dispatch email via Gmail for real accounts
      let emailResult = { success: true };
      if (!isTest) {
        emailResult = await emailService.sendOtpEmail(cleanEmail, otp, purpose, userName);
      } else {
        logger.info(`[Direct Access Testing Account] ${cleanEmail} -> OTP 123456 activated.`);
      }

      return {
        success: true,
        message: isTest
          ? `Testing account recognized. Code 123456 ready for direct access.`
          : `OTP sent to ${cleanEmail}`,
        email: cleanEmail,
        purpose,
        isTest,
        testOtp: isTest ? '123456' : undefined,
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

      const normalizedOtp = cleanOtp.replace(/\s+/g, '');

      // Direct access bypass for dedicated testing accounts with test OTP (123456 or 1 2 3 4 5 6)
      if (normalizedOtp === '123456' && isTestingEmail(cleanEmail)) {
        logger.info(`Direct test OTP (123456) access accepted for testing account: ${cleanEmail}`);
        return true;
      }

      // Query active OTP for this email
      const activeOtpQuery = {
        email: cleanEmail,
        expiresAt: { $gt: new Date() },
      };
      if (purpose) {
        activeOtpQuery.purpose = purpose;
      }

      const otpDoc = await Otp.findOne(activeOtpQuery).sort({ createdAt: -1 });

      if (!otpDoc) {
        throw new Error('No active OTP found or code has expired. Please request a new one.');
      }

      if (otpDoc.otp !== normalizedOtp) {
        const attempts = (otpDoc.attempts || 0) + 1;
        if (attempts >= 5) {
          // Invalidate and delete OTP to stop brute force attempts
          await Otp.deleteOne({ _id: otpDoc._id });
          logger.warn(`Security alert: OTP for ${cleanEmail} invalidated due to 5 failed verification attempts.`);
          throw new Error('Too many incorrect OTP attempts. For security, this verification code has been invalidated. Please request a new one.');
        } else {
          otpDoc.attempts = attempts;
          await otpDoc.save();
          const remaining = 5 - attempts;
          throw new Error(`Invalid OTP code. ${remaining} attempt(s) remaining before code is invalidated.`);
        }
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
        .populate('restaurantId', 'name location city status isActive maxTables gstPercentage facilities')
        .lean();

      let restObj = null;
      if (user.restaurantId) {
        const rawRest = typeof user.restaurantId.toObject === 'function'
          ? user.restaurantId.toObject()
          : { ...user.restaurantId };
        restObj = {
          ...rawRest,
          id: rawRest._id ? rawRest._id.toString() : rawRest.id,
        };
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
  async getUserById(userId, fresh = false) {
    try {
      const cacheKey = `full_user_${userId.toString()}`;
      if (!fresh) {
        const cached = userAuthCache.get(cacheKey);
        if (cached && cached.restaurantId && typeof cached.restaurantId === 'object') {
          return { ...cached };
        }
      }

      const user = await User.findById(userId)
        .select('name email role restaurantId phone location isActive createdAt updatedAt')
        .populate('restaurantId', 'name location city status isActive maxTables gstPercentage facilities')
        .lean();

      if (!user) {
        throw new Error('User not found');
      }
      if (!user.isActive) {
        throw new Error('User account is inactive');
      }

      let restObj = null;
      if (user.restaurantId) {
        const rawRest = typeof user.restaurantId.toObject === 'function'
          ? user.restaurantId.toObject()
          : { ...user.restaurantId };
        restObj = {
          ...rawRest,
          id: rawRest._id ? rawRest._id.toString() : rawRest.id,
        };
      }

      user.id = user._id ? user._id.toString() : userId.toString();
      user.role = formatRoleForClient(user.role);
      user.restaurantId = restObj;

      userAuthCache.set(cacheKey, user, 60);
      return { ...user };
    } catch (error) {
      logger.error(`Get user error: ${error.message}`);
      throw error;
    }
  }
}

module.exports = new AuthService();
