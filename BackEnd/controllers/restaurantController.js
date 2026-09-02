const restaurantService = require('../services/restaurantService');
const { sendSuccess, sendError, sendPaginatedResponse } = require('../utils/responseHandler');
const logger = require('../utils/logger');

class RestaurantController {
  // Create restaurant
  async createRestaurant(req, res) {
    try {
      const restaurantData = req.body;
      const restaurant = await restaurantService.createRestaurant(restaurantData);

      return sendSuccess(
        res,
        'Restaurant created successfully',
        restaurant,
        201
      );
    } catch (error) {
      logger.error(`Create restaurant error: ${error.message}`);
      return sendError(res, error.message, 400);
    }
  }

  // Get all restaurants
  async getAllRestaurants(req, res) {
    try {
      const { page = 1, limit = 10, status } = req.query;
      const filters = {};

      if (status) {
        filters.status = status;
      }

      const { restaurants, total } = await restaurantService.getAllRestaurants(
        page,
        limit,
        filters
      );

      return sendPaginatedResponse(res, restaurants, page, limit, total);
    } catch (error) {
      logger.error(`Get all restaurants error: ${error.message}`);
      return sendError(res, error.message, 400);
    }
  }

  // Get restaurant by ID
  async getRestaurantById(req, res) {
    try {
      const { id } = req.params;
      const restaurant = await restaurantService.getRestaurantById(id);

      return sendSuccess(
        res,
        'Restaurant fetched successfully',
        restaurant
      );
    } catch (error) {
      logger.error(`Get restaurant error: ${error.message}`);
      return sendError(res, error.message, 400);
    }
  }

  // Update restaurant
  async updateRestaurant(req, res) {
    try {
      const { id } = req.params;
      const updateData = req.body;

      const restaurant = await restaurantService.updateRestaurant(
        id,
        updateData
      );

      return sendSuccess(
        res,
        'Restaurant updated successfully',
        restaurant
      );
    } catch (error) {
      logger.error(`Update restaurant error: ${error.message}`);
      return sendError(res, error.message, 400);
    }
  }

  // Delete restaurant
  async deleteRestaurant(req, res) {
    try {
      const { id } = req.params;
      await restaurantService.deleteRestaurant(id);

      return sendSuccess(res, 'Restaurant deleted successfully');
    } catch (error) {
      logger.error(`Delete restaurant error: ${error.message}`);
      return sendError(res, error.message, 400);
    }
  }
}

module.exports = new RestaurantController();
