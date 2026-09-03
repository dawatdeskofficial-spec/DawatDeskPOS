const categoryService = require('../services/categoryService');
const { sendSuccess, sendError } = require('../utils/responseHandler');
const logger = require('../utils/logger');
const { normalizeRole } = require('../utils/constants');
const cacheService = require('../utils/cache');

const getId = (value) => {
  if (!value) return null;
  if (typeof value === 'string') return value;
  if (value._id) return value._id.toString();
  if (value.id) return value.id.toString();
  return value.toString ? value.toString() : null;
};

class CategoryController {
  async getCategoriesByRestaurant(req, res) {
    try {
      const { restaurantId } = req.params;
      const categories = await categoryService.getCategoriesByRestaurant(restaurantId, {
        activeOnly: req.isPublicCategoryRequest === true,
        onlyWithAvailableItems: req.isPublicCategoryRequest === true,
      });
      return sendSuccess(res, 'Categories fetched successfully', categories);
    } catch (error) {
      logger.error(`Get categories error: ${error.message}`);
      return sendError(res, error.message, 400);
    }
  }

  async createCategory(req, res) {
    try {
      const role = normalizeRole(req.user?.role);
      const restaurantId = role === 'MAIN_ADMIN'
        ? req.body.restaurantId
        : getId(req.user?.restaurantId);

      const category = await categoryService.createCategory({
        ...req.body,
        restaurantId,
      });
      cacheService.deleteByPrefix(`category:restaurant:${restaurantId}`);
      cacheService.deleteByPrefix(`menu:restaurant:${restaurantId}`);
      return sendSuccess(res, 'Category created successfully', category, 201);
    } catch (error) {
      logger.error(`Create category error: ${error.message}`);
      return sendError(res, error.message, 400);
    }
  }

  async updateCategory(req, res) {
    try {
      const { id } = req.params;
      const role = normalizeRole(req.user?.role);
      const restaurantId = role === 'MAIN_ADMIN' ? null : getId(req.user?.restaurantId);
      const category = await categoryService.updateCategory(id, restaurantId, req.body);
      
      const restId = category.restaurantId || restaurantId;
      if (restId) {
        cacheService.deleteByPrefix(`category:restaurant:${restId}`);
        cacheService.deleteByPrefix(`menu:restaurant:${restId}`);
      }
      
      return sendSuccess(res, 'Category updated successfully', category);
    } catch (error) {
      logger.error(`Update category error: ${error.message}`);
      return sendError(res, error.message, 400);
    }
  }

  async deleteCategory(req, res) {
    try {
      const { id } = req.params;
      const role = normalizeRole(req.user?.role);
      const restaurantId = role === 'MAIN_ADMIN' ? null : getId(req.user?.restaurantId);
      await categoryService.deleteCategory(id, restaurantId);
      
      // Note: we can't easily get the restaurantId from the deleted category here without hitting the DB first,
      // but if the logged in user has restaurantId, we use it. 
      if (restaurantId) {
        cacheService.deleteByPrefix(`category:restaurant:${restaurantId}`);
        cacheService.deleteByPrefix(`menu:restaurant:${restaurantId}`);
      } else {
        cacheService.flush(); // Fallback if MAIN_ADMIN deletes it without restaurantId in context
      }

      return sendSuccess(res, 'Category deleted successfully');
    } catch (error) {
      logger.error(`Delete category error: ${error.message}`);
      return sendError(res, error.message, 400);
    }
  }

  async reorderCategories(req, res) {
    try {
      const { restaurantId } = req.params;
      const categoryIds = req.body.categoryIds || req.body.categories;
      const categories = await categoryService.reorderCategories(restaurantId, categoryIds);
      
      cacheService.deleteByPrefix(`category:restaurant:${restaurantId}`);
      cacheService.deleteByPrefix(`menu:restaurant:${restaurantId}`);
      
      return sendSuccess(res, 'Categories reordered successfully', categories);
    } catch (error) {
      logger.error(`Reorder categories error: ${error.message}`);
      return sendError(res, error.message, 400);
    }
  }
}

module.exports = new CategoryController();
