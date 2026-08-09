const User = require('../models/User');
const logger = require('../utils/logger');
const { normalizeRole } = require('../utils/constants');

class UserService {
  // Create user
  async createUser(userData) {
    try {
      if (userData.role) {
        const normalizedRole = normalizeRole(userData.role);
        if (!normalizedRole) {
          throw new Error('Invalid role provided');
        }
        userData.role = normalizedRole;
      }

      const user = new User(userData);
      await user.save();
      logger.info(`User created: ${user._id}`);
      return user;
    } catch (error) {
      logger.error(`Create user error: ${error.message}`);
      throw error;
    }
  }

  // Get all users (with pagination)
  async getAllUsers(page = 1, limit = 20, filters = {}) {
    try {
      const skip = (page - 1) * limit;
      const query = { ...filters };

      const users = await User.find(query)
        .populate('restaurantId')
        .limit(limit)
        .skip(skip);

      const total = await User.countDocuments(query);

      return { users, total, page, limit };
    } catch (error) {
      logger.error(`Get all users error: ${error.message}`);
      throw error;
    }
  }

  // Get users by restaurant
  async getUsersByRestaurant(restaurantId, page = 1, limit = 20) {
    try {
      const skip = (page - 1) * limit;
      const users = await User.find({ restaurantId })
        .limit(limit)
        .skip(skip);

      const total = await User.countDocuments({ restaurantId });

      return { users, total, page, limit };
    } catch (error) {
      logger.error(`Get users by restaurant error: ${error.message}`);
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

      return user;
    } catch (error) {
      logger.error(`Get user error: ${error.message}`);
      throw error;
    }
  }

  // Update user
  async updateUser(userId, updateData) {
    try {
      // Hash new password if provided
      if (updateData.password) {
        const salt = await require('bcryptjs').genSalt(10);
        updateData.password = await require('bcryptjs').hash(updateData.password, salt);
      } else {
        delete updateData.password;
      }

      if (updateData.role) {
        const normalizedRole = normalizeRole(updateData.role);
        if (!normalizedRole) {
          throw new Error('Invalid role provided');
        }
        updateData.role = normalizedRole;
      }

      const user = await User.findByIdAndUpdate(userId, updateData, {
        new: true,
        runValidators: true,
      });

      if (!user) {
        throw new Error('User not found');
      }

      logger.info(`User updated: ${userId}`);
      return user;
    } catch (error) {
      logger.error(`Update user error: ${error.message}`);
      throw error;
    }
  }

  // Deactivate user
  async deactivateUser(userId) {
    try {
      const user = await User.findByIdAndUpdate(
        userId,
        { isActive: false },
        { new: true }
      );

      if (!user) {
        throw new Error('User not found');
      }

      logger.info(`User deactivated: ${userId}`);
      return user;
    } catch (error) {
      logger.error(`Deactivate user error: ${error.message}`);
      throw error;
    }
  }

  // Activate user
  async activateUser(userId) {
    try {
      const user = await User.findByIdAndUpdate(
        userId,
        { isActive: true },
        { new: true }
      );

      if (!user) {
        throw new Error('User not found');
      }

      logger.info(`User activated: ${userId}`);
      return user;
    } catch (error) {
      logger.error(`Activate user error: ${error.message}`);
      throw error;
    }
  }

  // Delete user
  async deleteUser(userId) {
    try {
      const user = await User.findByIdAndDelete(userId);

      if (!user) {
        throw new Error('User not found');
      }

      logger.info(`User deleted: ${userId}`);
      return user;
    } catch (error) {
      logger.error(`Delete user error: ${error.message}`);
      throw error;
    }
  }
}

module.exports = new UserService();
