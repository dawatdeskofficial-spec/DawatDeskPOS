const MenuItem = require('../models/MenuItem');
const Category = require('../models/Category');
const categoryService = require('./categoryService');
const logger = require('../utils/logger');
const mongoose = require('mongoose');

class MenuService {
  async validateMenuCategory(restaurantId, categoryId, categoryName) {
    if (categoryId) {
      const category = await Category.findOne({ _id: categoryId, restaurantId }).lean();
      if (!category) {
        throw new Error('Selected category does not belong to this restaurant');
      }
      return {
        categoryId: category._id,
        category: category.name,
      };
    }

    if (categoryName) {
      const normalized = String(categoryName).trim();
      if (!normalized) {
        throw new Error('Category is required');
      }
      const category = await categoryService.findOrCreateCategory(restaurantId, normalized);
      return {
        categoryId: category._id,
        category: category.name,
      };
    }

    throw new Error('Category is required');
  }

  // Create menu item
  async createMenuItem(menuItemData) {
    try {
      const restaurantId = menuItemData.restaurantId;
      const { categoryId, category } = await this.validateMenuCategory(
        restaurantId,
        menuItemData.categoryId,
        menuItemData.category
      );

      const menuItem = new MenuItem({
        ...menuItemData,
        categoryId,
        category,
      });
      await menuItem.save();
      logger.info(`Menu item created: ${menuItem._id}`);
      return menuItem;
    } catch (error) {
      logger.error(`Create menu item error: ${error.message}`);
      throw error;
    }
  }

  // Get menu items by restaurant (with filtering)
  async getMenuItems(restaurantId, page = 1, limit = 20, category = null, options = {}) {
    try {
      const skip = (page - 1) * limit;
      const query = { restaurantId };

      if (options.availableOnly) {
        query.isAvailable = true;
      }

      if (options.activeCategoryOnly) {
        const activeCategories = await Category.find({ restaurantId, isActive: true }).select('_id');
        query.categoryId = { $in: activeCategories.map((item) => item._id) };
      }

      if (category) {
        const categoryQuery = [{ category }];
        if (mongoose.Types.ObjectId.isValid(category)) {
          categoryQuery.push({ categoryId: category });
        }
        query.$or = categoryQuery;
      }

      const menuItems = await MenuItem.find(query)
        .populate('categoryId', 'name description icon displayOrder isActive')
        .sort({ createdAt: -1 })
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
      const menuItem = await MenuItem.findById(menuItemId);
      if (!menuItem) {
        throw new Error('Menu item not found');
      }

      if (updateData.categoryId || updateData.category) {
        const categoryInfo = await this.validateMenuCategory(
          menuItem.restaurantId,
          updateData.categoryId || menuItem.categoryId,
          updateData.category || menuItem.category
        );
        updateData.categoryId = categoryInfo.categoryId;
        updateData.category = categoryInfo.category;
      }

      const updated = await MenuItem.findByIdAndUpdate(
        menuItemId,
        updateData,
        { new: true, runValidators: true }
      ).populate('categoryId', 'name description icon displayOrder isActive');

      if (!updated) {
        throw new Error('Menu item not found');
      }

      logger.info(`Menu item updated: ${menuItemId}`);
      return updated;
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
        $or: [
          { category },
          { categoryId: category },
        ],
        isAvailable: true,
      }).populate('categoryId', 'name description icon displayOrder isActive');

      return menuItems;
    } catch (error) {
      logger.error(`Get menu by category error: ${error.message}`);
      throw error;
    }
  }
}

module.exports = new MenuService();
