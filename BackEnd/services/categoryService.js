const Category = require('../models/Category');
const MenuItem = require('../models/MenuItem');
const logger = require('../utils/logger');

const normalizeCategoryName = (name) => String(name || '').trim().replace(/\s+/g, ' ');

class CategoryService {
  async getCategoriesByRestaurant(restaurantId, options = {}) {
    const { activeOnly = false, withItemCounts = true, onlyWithAvailableItems = false } = options;
    const query = { restaurantId };
    if (activeOnly) query.isActive = true;

    const categories = await Category.find(query).sort({ displayOrder: 1, name: 1 }).lean();
    if (!withItemCounts || categories.length === 0) return categories;

    const categoryIds = categories.map((category) => category._id);
    const [itemCounts, availableItemCounts] = await Promise.all([
      MenuItem.aggregate([
        { $match: { restaurantId: categories[0].restaurantId, categoryId: { $in: categoryIds } } },
        { $group: { _id: '$categoryId', count: { $sum: 1 } } },
      ]),
      MenuItem.aggregate([
        { $match: { restaurantId: categories[0].restaurantId, categoryId: { $in: categoryIds }, isAvailable: true } },
        { $group: { _id: '$categoryId', count: { $sum: 1 } } },
      ]),
    ]);

    const countMap = itemCounts.reduce((map, item) => {
      map[item._id.toString()] = item.count;
      return map;
    }, {});
    const availableCountMap = availableItemCounts.reduce((map, item) => {
      map[item._id.toString()] = item.count;
      return map;
    }, {});

    const enriched = categories.map((category) => ({
      ...category,
      itemCount: countMap[category._id.toString()] || 0,
      availableItemCount: availableCountMap[category._id.toString()] || 0,
    }));

    return onlyWithAvailableItems
      ? enriched.filter((category) => category.availableItemCount > 0)
      : enriched;
  }

  async getCategoryById(categoryId, restaurantId = null) {
    const query = restaurantId ? { _id: categoryId, restaurantId } : { _id: categoryId };
    const category = await Category.findOne(query).lean();
    if (!category) {
      throw new Error('Category not found');
    }
    return category;
  }

  async createCategory(data) {
    const name = normalizeCategoryName(data.name);
    if (!name) {
      throw new Error('Category name is required');
    }
    if (!data.restaurantId) {
      throw new Error('Restaurant ID is required');
    }

    const existing = await Category.findOne({
      restaurantId: data.restaurantId,
      normalizedName: name.toLowerCase(),
    });

    if (existing) {
      throw new Error('A category with this name already exists for this restaurant');
    }

    const lastCategory = await Category.findOne({ restaurantId: data.restaurantId }).sort({ displayOrder: -1 });
    const category = await Category.create({
      restaurantId: data.restaurantId,
      name,
      normalizedName: name.toLowerCase(),
      description: data.description || '',
      icon: data.icon || '',
      displayOrder: data.displayOrder ?? (lastCategory ? lastCategory.displayOrder + 1 : 0),
      isActive: data.isActive !== false,
    });

    logger.info(`Category created: ${category._id}`);
    return category;
  }

  async findOrCreateCategory(restaurantId, name, defaults = {}) {
    const normalizedName = normalizeCategoryName(name);
    if (!normalizedName) {
      throw new Error('Category name is required');
    }

    const existing = await Category.findOne({
      restaurantId,
      normalizedName: normalizedName.toLowerCase(),
    });

    if (existing) return existing;

    return this.createCategory({
      restaurantId,
      name: normalizedName,
      ...defaults,
    });
  }

  async updateCategory(categoryId, restaurantId, updateData) {
    const existing = await this.getCategoryById(categoryId, restaurantId);
    const nextData = { ...updateData };
    delete nextData.restaurantId;

    if (nextData.name !== undefined) {
      const name = normalizeCategoryName(nextData.name);
      if (!name) throw new Error('Category name is required');

      const duplicate = await Category.findOne({
        _id: { $ne: categoryId },
        restaurantId: existing.restaurantId,
        normalizedName: name.toLowerCase(),
      });
      if (duplicate) {
        throw new Error('A category with this name already exists for this restaurant');
      }

      nextData.name = name;
      nextData.normalizedName = name.toLowerCase();
    }

    const category = await Category.findOneAndUpdate(
      { _id: categoryId, restaurantId: existing.restaurantId },
      nextData,
      { new: true, runValidators: true }
    );
    if (!category) {
      throw new Error('Category not found');
    }
    return category;
  }

  async deleteCategory(categoryId, restaurantId) {
    const category = await this.getCategoryById(categoryId, restaurantId);

    // Delete all menu items belonging to this category
    const deleteResult = await MenuItem.deleteMany({
      restaurantId: category.restaurantId,
      $or: [
        { categoryId: category._id },
        { categoryId: null, category: category.name },
      ],
    });
    logger.info(`Deleted ${deleteResult.deletedCount} menu items for category: ${category._id}`);

    const deleted = await Category.findOneAndDelete({ _id: category._id, restaurantId: category.restaurantId });
    if (!deleted) {
      throw new Error('Category not found');
    }

    return deleted;
  }

  async reorderCategories(restaurantId, categoryIds) {
    if (!Array.isArray(categoryIds) || categoryIds.length === 0) {
      throw new Error('Category order is required');
    }

    const categories = await Category.find({ restaurantId, _id: { $in: categoryIds } }).select('_id');
    if (categories.length !== categoryIds.length) {
      throw new Error('All categories in the order must belong to this restaurant');
    }

    await Category.bulkWrite(
      categoryIds.map((categoryId, index) => ({
        updateOne: {
          filter: { _id: categoryId, restaurantId },
          update: { $set: { displayOrder: index } },
        },
      }))
    );

    logger.info(`Categories reordered for restaurant: ${restaurantId}`);
    return this.getCategoriesByRestaurant(restaurantId);
  }
}

module.exports = new CategoryService();
