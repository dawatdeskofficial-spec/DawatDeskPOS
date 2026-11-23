const authService = require('../services/authService');
const { sendSuccess, sendError } = require('../utils/responseHandler');
const { formatRoleForClient } = require('../utils/constants');
const logger = require('../utils/logger');

class AuthController {
  // Login controller
  async login(req, res) {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return sendError(res, 'Email and password are required', 400);
      }

      const result = await authService.loginUser(email, password);

      return sendSuccess(res, 'Login successful', result, 200);
    } catch (error) {
      logger.error(`Login controller error: ${error.message}`);
      return sendError(res, error.message, 401);
    }
  }

  // Register/Signup controller
  async signup(req, res) {
    try {
      let { name, email, password, role, restaurantId } = req.body;

      if (!name || !email || !password || !role) {
        return sendError(res, 'All fields are required', 400);
      }

      // Automatically assign to the first available restaurant if not provided
      if (!restaurantId && role.toUpperCase() !== 'MAIN_ADMIN') {
        const Restaurant = require('../models/Restaurant');
        const defaultRestaurant = await Restaurant.findOne();
        if (defaultRestaurant) {
          restaurantId = defaultRestaurant._id;
        }
      }

      const result = await authService.registerUser(
        name,
        email,
        password,
        role,
        restaurantId
      );

      return sendSuccess(res, 'User registered successfully', result, 201);
    } catch (error) {
      logger.error(`Signup controller error: ${error.message}`);
      return sendError(res, error.message, 400);
    }
  }

  // Get current user
  async getCurrentUser(req, res) {
    try {
      const userId = req.user?.id || req.user?.userId || req.user?._id;
      if (!userId) {
        return sendError(res, 'User ID missing in token', 401);
      }
      // Retrieve the latest user profile with populated restaurant and facilities
      const rawUser = await authService.getUserById(userId, true);
      if (!rawUser) {
        return sendError(res, 'User not found', 404);
      }

      const userObj = rawUser.toObject ? rawUser.toObject() : { ...rawUser };
      const formattedUser = {
        ...userObj,
        id: userObj.id || userObj._id?.toString(),
        role: formatRoleForClient(userObj.role) || (typeof userObj.role === 'string' ? userObj.role.toLowerCase() : 'restaurant_admin'),
      };

      return sendSuccess(res, 'User fetched successfully', formattedUser, 200);
    } catch (error) {
      logger.error(`Get current user error: ${error.message}`);
      return sendError(res, error.message, 400);
    }
  }

  // Send OTP
  async sendOtp(req, res) {
    try {
      const { email, purpose = 'login' } = req.body;
      if (!email) {
        return sendError(res, 'Email is required', 400);
      }

      const result = await authService.requestOtp(email, purpose);
      return sendSuccess(res, result.message, result, 200);
    } catch (error) {
      logger.error(`Send OTP error: ${error.message}`);
      return sendError(res, error.message, 400);
    }
  }

  // Verify OTP
  async verifyOtp(req, res) {
    try {
      const { email, otp, purpose = 'login' } = req.body;
      if (!email || !otp) {
        return sendError(res, 'Email and OTP are required', 400);
      }

      await authService.verifyOtp(email, otp, purpose, false);
      return sendSuccess(res, 'OTP verified successfully', { verified: true }, 200);
    } catch (error) {
      logger.error(`Verify OTP error: ${error.message}`);
      return sendError(res, error.message, 400);
    }
  }

  // Login with OTP
  async loginWithOtp(req, res) {
    try {
      const { email, otp } = req.body;
      if (!email || !otp) {
        return sendError(res, 'Email and OTP code are required', 400);
      }

      const result = await authService.loginWithOtp(email, otp);
      return sendSuccess(res, 'Login successful via OTP', result, 200);
    } catch (error) {
      logger.error(`Login with OTP controller error: ${error.message}`);
      return sendError(res, error.message, 401);
    }
  }
}

module.exports = new AuthController();
