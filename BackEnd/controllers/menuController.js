const menuService = require('../services/menuService');
const { sendSuccess, sendError, sendPaginatedResponse } = require('../utils/responseHandler');
const logger = require('../utils/logger');
const cacheService = require('../utils/cache');

class MenuController {
  // Create menu item
  async createMenuItem(req, res) {
    try {
      const menuItemData = { ...req.body };
      if (!menuItemData.restaurantId && req.user) {
        const r = req.user.restaurantId;
        menuItemData.restaurantId = typeof r === 'string' ? r : (r && (r._id || r.id));
      }

      const menuItem = await menuService.createMenuItem(menuItemData);
      
      const restId = menuItemData.restaurantId;
      cacheService.deleteByPrefix(`menu:restaurant:${restId}`);
      cacheService.deleteByPrefix(`category:restaurant:${restId}`);

      return sendSuccess(
        res,
        'Menu item created successfully',
        menuItem,
        201
      );
    } catch (error) {
      logger.error(`Create menu item error: ${error.message}`);
      return sendError(res, error.message, 400);
    }
  }

  // Get menu items by restaurant
  async getMenuItems(req, res) {
    try {
      const { restaurantId } = req.params;
      const { page = 1, limit = 20, category } = req.query;

      const { menuItems, total } = await menuService.getMenuItems(
        restaurantId,
        page,
        limit,
        category,
        {
          availableOnly: req.isPublicMenuRequest === true,
          activeCategoryOnly: req.isPublicMenuRequest === true,
        }
      );

      return sendPaginatedResponse(res, menuItems, page, limit, total);
    } catch (error) {
      logger.error(`Get menu items error: ${error.message}`);
      return sendError(res, error.message, 400);
    }
  }

  // Get menu item by ID
  async getMenuItemById(req, res) {
    try {
      const { id } = req.params;
      const menuItem = await menuService.getMenuItemById(id);

      return sendSuccess(
        res,
        'Menu item fetched successfully',
        menuItem
      );
    } catch (error) {
      logger.error(`Get menu item error: ${error.message}`);
      return sendError(res, error.message, 400);
    }
  }

  // Update menu item
  async updateMenuItem(req, res) {
    try {
      const { id } = req.params;
      const updateData = req.body;

      const menuItem = await menuService.updateMenuItem(id, updateData);

      const restId = typeof menuItem.restaurantId === 'string' ? menuItem.restaurantId : (menuItem.restaurantId?._id || menuItem.restaurantId?.id);
      if (restId) {
        cacheService.deleteByPrefix(`menu:restaurant:${restId}`);
        cacheService.deleteByPrefix(`category:restaurant:${restId}`);
      }

      return sendSuccess(
        res,
        'Menu item updated successfully',
        menuItem
      );
    } catch (error) {
      logger.error(`Update menu item error: ${error.message}`);
      return sendError(res, error.message, 400);
    }
  }

  // Delete menu item
  async deleteMenuItem(req, res) {
    try {
      const { id } = req.params;
      const menuItem = await menuService.getMenuItemById(id); // Needed to find restaurantId before delete
      const restId = menuItem ? (typeof menuItem.restaurantId === 'string' ? menuItem.restaurantId : (menuItem.restaurantId?._id || menuItem.restaurantId?.id)) : null;

      await menuService.deleteMenuItem(id);

      if (restId) {
        cacheService.deleteByPrefix(`menu:restaurant:${restId}`);
        cacheService.deleteByPrefix(`category:restaurant:${restId}`);
      }

      return sendSuccess(res, 'Menu item deleted successfully');
    } catch (error) {
      logger.error(`Delete menu item error: ${error.message}`);
      return sendError(res, error.message, 400);
    }
  }

  // Get menu by category
  async getMenuByCategory(req, res) {
    try {
      const { restaurantId, category } = req.params;

      const menuItems = await menuService.getMenuByCategory(
        restaurantId,
        category
      );

      return sendSuccess(
        res,
        'Menu items fetched successfully',
        menuItems
      );
    } catch (error) {
      logger.error(`Get menu by category error: ${error.message}`);
      return sendError(res, error.message, 400);
    }
  }
}

module.exports = new MenuController();
