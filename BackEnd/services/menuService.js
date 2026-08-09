const MenuItem = require('../models/MenuItem');
const logger = require('../utils/logger');

class MenuService {
  // Create menu item
  async createMenuItem(menuItemData) {
    try {
      const menuItem = new MenuItem(menuItemData);
      await menuItem.save();
      logger.info(`Menu item created: ${menuItem._id}`);
      return menuItem;
    } catch (error) {
      logger.error(`Create menu item error: ${error.message}`);
      throw error;
    }
  }

  // Get menu items by restaurant (with filtering)
  async getMenuItems(restaurantId, page = 1, limit = 20, category = null) {
    try {
      const skip = (page - 1) * limit;
      const query = { restaurantId };

      if (category) {
        query.category = category;
      }

      const menuItems = await MenuItem.find(query)
        .limit(limit)
        .skip(skip)
        .lean();

      const total = await MenuItem.countDocuments(query);

      return { menuItems, total, page, limit };
    } catch (error) {
      logger.error(`Get menu items error: ${error.message}`);
      throw error;
    }
  }

  // Get menu item by ID
  async getMenuItemById(menuItemId) {
    try {
      const menuItem = await MenuItem.findById(menuItemId);
      if (!menuItem) {
        throw new Error('Menu item not found');
      }
      return menuItem;
    } catch (error) {
      logger.error(`Get menu item error: ${error.message}`);
      throw error;
    }
  }

  // Update menu item
  async updateMenuItem(menuItemId, updateData) {
    try {
      const menuItem = await MenuItem.findByIdAndUpdate(
        menuItemId,
        updateData,
        { new: true, runValidators: true }
      );

      if (!menuItem) {
        throw new Error('Menu item not found');
      }

      logger.info(`Menu item updated: ${menuItemId}`);
      return menuItem;
    } catch (error) {
      logger.error(`Update menu item error: ${error.message}`);
      throw error;
    }
  }

  // Delete menu item
  async deleteMenuItem(menuItemId) {
    try {
      const menuItem = await MenuItem.findByIdAndDelete(menuItemId);
      if (!menuItem) {
        throw new Error('Menu item not found');
      }

      logger.info(`Menu item deleted: ${menuItemId}`);
      return menuItem;
    } catch (error) {
      logger.error(`Delete menu item error: ${error.message}`);
      throw error;
    }
  }

  // Get menu by category
  async getMenuByCategory(restaurantId, category) {
    try {
      const menuItems = await MenuItem.find({
        restaurantId,
        category,
        isAvailable: true,
      });

      return menuItems;
    } catch (error) {
      logger.error(`Get menu by category error: ${error.message}`);
      throw error;
    }
  }
}

module.exports = new MenuService();
