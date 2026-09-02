const Restaurant = require('../models/Restaurant');
const logger = require('../utils/logger');

class RestaurantService {
  // Create restaurant
  async createRestaurant(restaurantData) {
    try {
      const restaurant = new Restaurant(restaurantData);
      await restaurant.save();
      logger.info(`Restaurant created: ${restaurant._id}`);
      return restaurant;
    } catch (error) {
      logger.error(`Create restaurant error: ${error.message}`);
      throw error;
    }
  }

  // Get all restaurants (with pagination)
  async getAllRestaurants(page = 1, limit = 10, filters = {}) {
    try {
      const skip = (page - 1) * limit;
      const query = { ...filters };

      const restaurants = await Restaurant.find(query)
        .limit(limit)
        .skip(skip)
        .lean();

      const total = await Restaurant.countDocuments(query);

      return { restaurants, total, page, limit };
    } catch (error) {
      logger.error(`Get all restaurants error: ${error.message}`);
      throw error;
    }
  }

  // Get restaurant by ID
  async getRestaurantById(restaurantId) {
    try {
      const restaurant = await Restaurant.findById(restaurantId);
      if (!restaurant) {
        throw new Error('Restaurant not found');
      }
      return restaurant;
    } catch (error) {
      logger.error(`Get restaurant error: ${error.message}`);
      throw error;
    }
  }

  // Update restaurant
  async updateRestaurant(restaurantId, updateData) {
    try {
      const restaurant = await Restaurant.findByIdAndUpdate(
        restaurantId,
        updateData,
        { new: true, runValidators: true }
      );

      if (!restaurant) {
        throw new Error('Restaurant not found');
      }

      logger.info(`Restaurant updated: ${restaurantId}`);
      return restaurant;
    } catch (error) {
      logger.error(`Update restaurant error: ${error.message}`);
      throw error;
    }
  }

  // Delete restaurant
  async deleteRestaurant(restaurantId) {
    try {
      const restaurant = await Restaurant.findByIdAndDelete(restaurantId);
      if (!restaurant) {
        throw new Error('Restaurant not found');
      }

      // Cascading deletes
      const User = require('../models/User');
      const MenuItem = require('../models/MenuItem');
      const Order = require('../models/Order');
      const OrderItem = require('../models/OrderItem');
      const Payment = require('../models/Payment');

      // Delete associated users
      await User.deleteMany({ restaurantId });

      // Delete associated menu items
      await MenuItem.deleteMany({ restaurantId });

      // Find associated orders to delete order items
      const orders = await Order.find({ restaurantId }).select('_id');
      const orderIds = orders.map(order => order._id);
      
      if (orderIds.length > 0) {
        await OrderItem.deleteMany({ orderId: { $in: orderIds } });
      }

      // Delete associated orders
      await Order.deleteMany({ restaurantId });

      // Delete associated payments
      await Payment.deleteMany({ restaurantId });

      logger.info(`Restaurant deleted: ${restaurantId} along with all associated users and records.`);
      return restaurant;
    } catch (error) {
      logger.error(`Delete restaurant error: ${error.message}`);
      throw error;
    }
  }
}

module.exports = new RestaurantService();
