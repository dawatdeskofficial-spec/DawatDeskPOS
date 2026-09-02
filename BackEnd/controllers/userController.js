const userService = require('../services/userService');
const { sendSuccess, sendError, sendPaginatedResponse } = require('../utils/responseHandler');
const logger = require('../utils/logger');
const { normalizeRole } = require('../utils/constants');

const getId = (value) => {
  if (!value) return null;
  if (typeof value === 'string') return value;
  if (value._id) return value._id.toString();
  if (value.id) return value.id.toString();
  return value.toString ? value.toString() : null;
};

const STAFF_ROLES = ['WAITER', 'CHEF', 'CASHIER'];

class UserController {
  // Create user
  async createUser(req, res) {
    try {
      const userData = { ...req.body };
      const actorRole = normalizeRole(req.user?.role);
      const requestedRole = normalizeRole(userData.role);

      if (!requestedRole) {
        return sendError(res, 'Invalid role provided', 400);
      }

      if (actorRole === 'RESTAURANT_ADMIN') {
        if (!STAFF_ROLES.includes(requestedRole)) {
          return sendError(res, 'Restaurant admins can only create staff accounts', 403);
        }
        userData.role = requestedRole;
        userData.restaurantId = getId(req.user.restaurantId);
      }

      const user = await userService.createUser(userData);
      
      // Exclude password from response
      const userResponse = user.toObject();
      delete userResponse.password;

      return sendSuccess(res, 'User created successfully', userResponse, 201);
    } catch (error) {
      logger.error(`Create user error: ${error.message}`);
      return sendError(res, error.message, 400);
    }
  }

  // Get all users
  async getAllUsers(req, res) {
    try {
      const { page = 1, limit = 20, role, isActive } = req.query;
      const filters = {};

      if (role) {
        filters.role = role;
      }

      if (isActive !== undefined) {
        filters.isActive = isActive === 'true';
      }

      const { users, total } = await userService.getAllUsers(
        page,
        limit,
        filters
      );

      return sendPaginatedResponse(res, users, page, limit, total);
    } catch (error) {
      logger.error(`Get all users error: ${error.message}`);
      return sendError(res, error.message, 400);
    }
  }

  // Get users by restaurant
  async getUsersByRestaurant(req, res) {
    try {
      const { restaurantId } = req.params;
      const { page = 1, limit = 20 } = req.query;

      const { users, total } = await userService.getUsersByRestaurant(
        restaurantId,
        page,
        limit
      );

      return sendPaginatedResponse(res, users, page, limit, total);
    } catch (error) {
      logger.error(`Get users by restaurant error: ${error.message}`);
      return sendError(res, error.message, 400);
    }
  }

  // Get user by ID
  async getUserById(req, res) {
    try {
      const { id } = req.params;
      const user = await userService.getUserById(id);

      return sendSuccess(res, 'User fetched successfully', user);
    } catch (error) {
      logger.error(`Get user error: ${error.message}`);
      return sendError(res, error.message, 400);
    }
  }

  // Update user
  async updateUser(req, res) {
    try {
      const { id } = req.params;
      const updateData = { ...req.body };
      const actorRole = normalizeRole(req.user?.role);

      if (actorRole !== 'MAIN_ADMIN') {
        delete updateData.restaurantId;
      }

      if (actorRole === 'RESTAURANT_ADMIN' && updateData.role) {
        const requestedRole = normalizeRole(updateData.role);
        if (!STAFF_ROLES.includes(requestedRole)) {
          return sendError(res, 'Restaurant admins can only assign staff roles', 403);
        }
      }

      if (!['MAIN_ADMIN', 'RESTAURANT_ADMIN'].includes(actorRole)) {
        delete updateData.role;
        delete updateData.isActive;
      }

      const user = await userService.updateUser(id, updateData);

      return sendSuccess(res, 'User updated successfully', user);
    } catch (error) {
      logger.error(`Update user error: ${error.message}`);
      return sendError(res, error.message, 400);
    }
  }

  // Deactivate user
  async deactivateUser(req, res) {
    try {
      const { id } = req.params;
      
      const currentUserId = req.user._id?.toString() || req.user.id?.toString() || req.user.userId?.toString();
      if (id === currentUserId) {
        return sendError(res, 'You cannot deactivate your own account', 403);
      }

      const user = await userService.deactivateUser(id);

      return sendSuccess(res, 'User deactivated successfully', user);
    } catch (error) {
      logger.error(`Deactivate user error: ${error.message}`);
      return sendError(res, error.message, 400);
    }
  }

  // Activate user
  async activateUser(req, res) {
    try {
      const { id } = req.params;
      const user = await userService.activateUser(id);

      return sendSuccess(res, 'User activated successfully', user);
    } catch (error) {
      logger.error(`Activate user error: ${error.message}`);
      return sendError(res, error.message, 400);
    }
  }

  // Delete user
  async deleteUser(req, res) {
    try {
      const { id } = req.params;

      const currentUserId = req.user._id?.toString() || req.user.id?.toString() || req.user.userId?.toString();
      if (id === currentUserId) {
        return sendError(res, 'You cannot delete your own account', 403);
      }

      if (req.user && req.user.role === 'RESTAURANT_ADMIN') {
        const targetUser = await userService.getUserById(id);
        
        // Ensure target user belongs to the same restaurant
        const adminRestaurantId = req.user.restaurantId?._id?.toString() || req.user.restaurantId?.toString();
        const targetUserRestaurantId = targetUser.restaurantId?._id?.toString() || targetUser.restaurantId?.toString();

        if (!adminRestaurantId || !targetUserRestaurantId || adminRestaurantId !== targetUserRestaurantId) {
          return sendError(res, 'You can only delete staff from your own restaurant', 403);
        }

        // Prevent deleting a MAIN_ADMIN
        if (targetUser.role === 'MAIN_ADMIN') {
          return sendError(res, 'You cannot delete a main admin', 403);
        }

        // Prevent deleting themselves
        if (id === req.user._id?.toString() || id === req.user.id?.toString() || id === req.user.userId?.toString()) {
          return sendError(res, 'You cannot delete yourself', 403);
        }
      }

      await userService.deleteUser(id);

      return sendSuccess(res, 'User deleted successfully');
    } catch (error) {
      logger.error(`Delete user error: ${error.message}`);
      return sendError(res, error.message, 400);
    }
  }
}

module.exports = new UserController();
