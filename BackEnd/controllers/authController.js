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
      const rawUser = req.user || await authService.getUserById(req.user?.userId);
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
}

module.exports = new AuthController();
