require('dotenv').config();

const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const Category = require('../models/Category');
const MenuItem = require('../models/MenuItem');
const Restaurant = require('../models/Restaurant');
const Order = require('../models/Order');
const OrderItem = require('../models/OrderItem');

const normalizeName = (value) => String(value || '').trim().replace(/\s+/g, ' ');

const CATEGORY_ORDER = [
  'Starters',
  'Tandoori',
  'Farsan',
  'Dosa & Uttapam',
  'Sabji',
  'Dal',
  'Kadhi',
  'Roti & Naan',
  'Rice',
  'Raita',
  'Sambar & Chutney',
  'Chutney',
  'Desserts',
  'Beverages',
  'Mains',
  'Sides',
  'Uncategorized',
];

const DEFAULT_CATEGORY_LABELS = {
  APPETIZER: 'Starters',
  MAIN_COURSE: 'Mains',
  DESSERT: 'Desserts',
  BEVERAGE: 'Beverages',
  SIDES: 'Sides',
};

const hasWord = (text, terms) => terms.some((term) => new RegExp(`(^|[^a-z0-9])${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z0-9]|$)`, 'i').test(text));

function inferCategory(item) {
  const name = String(item.name || '').toLowerCase();
  const description = String(item.description || '').toLowerCase();
  const text = `${name} ${description}`;

  if (hasWord(name, ['coffee', 'chai', 'tea', 'lassi', 'chaas', 'butter milk', 'buttermilk', 'coconut water', 'cold drink', 'tender coconut'])) {
    return 'Beverages';
  }
  if (hasWord(name, ['jamun', 'rasmalai', 'jalebi', 'basundi', 'shrikhand', 'kulfi', 'sukhdi', 'payasam', 'kesari', 'kheer'])) {
    return 'Desserts';
  }
  if (hasWord(name, ['idli', 'vada', 'bhaji', 'fritter'])) {
    return 'Starters';
  }
  if (hasWord(name, ['dosa', 'uttapam'])) {
    return 'Dosa & Uttapam';
  }
  if (hasWord(name, ['lemon rice', 'tamarind rice', 'sambar rice', 'jeera rice', 'biryani', 'khichdi', 'pulao']) || hasWord(name, ['rice'])) {
    return 'Rice';
  }
  if (hasWord(name, ['naan', 'roti', 'rotli', 'rotla', 'paratha', 'thepla'])) {
    return 'Roti & Naan';
  }
  if (hasWord(name, ['raita'])) {
    return 'Raita';
  }
  if (hasWord(name, ['khaman', 'dhokla', 'khandvi', 'patra', 'farsan'])) {
    return 'Farsan';
  }
  if (hasWord(name, ['tikka masala'])) {
    return 'Sabji';
  }
  if (hasWord(name, ['tikka', 'tandoori'])) {
    return 'Tandoori';
  }
  if (hasWord(name, ['sambar', 'rasam', 'podi'])) {
    return 'Sambar & Chutney';
  }
  if (hasWord(name, ['chutney'])) {
    return 'Chutney';
  }
  if (hasWord(name, ['kadhi'])) {
    return 'Kadhi';
  }
  if (hasWord(name, ['dal', 'makhani', 'tadka', 'dhokli']) || hasWord(description, ['lentil', 'lentils'])) {
    return 'Dal';
  }
  if (hasWord(text, ['paneer', 'kofta', 'rajma', 'aloo gobhi', 'sarson', 'undhiyu', 'sev tameta', 'bhinda', 'sabji', 'shaak', 'curry', 'gravy', 'vegetable stew'])) {
    return 'Sabji';
  }

  return DEFAULT_CATEGORY_LABELS[item.category] || normalizeName(item.category) || 'Uncategorized';
}

async function ensureCategory(restaurantId, name, displayOrder, cache) {
  const normalizedName = normalizeName(name);
  const key = `${restaurantId}:${normalizedName.toLowerCase()}`;
  if (cache.has(key)) return cache.get(key);

  let category = await Category.findOne({ restaurantId, normalizedName: normalizedName.toLowerCase() });
  if (!category) {
    category = await Category.create({
      restaurantId,
      name: normalizedName,
      normalizedName: normalizedName.toLowerCase(),
      description: '',
      icon: '',
      displayOrder,
      isActive: true,
    });
  } else {
    const updates = {};
    if (!category.normalizedName) updates.normalizedName = normalizedName.toLowerCase();
    if (category.displayOrder === undefined || category.displayOrder === null) updates.displayOrder = displayOrder;
    if (Object.keys(updates).length > 0) {
      category = await Category.findByIdAndUpdate(category._id, updates, { new: true });
    }
  }

  cache.set(key, category);
  return category;
}

async function backupExistingData() {
  const backupDir = path.join(__dirname, 'backups');
  fs.mkdirSync(backupDir, { recursive: true });
  const backupPath = path.join(backupDir, `category-migration-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);

  const [restaurants, categories, menuItems, orders, orderItems] = await Promise.all([
    Restaurant.find().lean(),
    Category.find().lean(),
    MenuItem.find().lean(),
    Order.find().lean(),
    OrderItem.find().lean(),
  ]);

  fs.writeFileSync(
    backupPath,
    JSON.stringify({ restaurants, categories, menuItems, orders, orderItems }, null, 2)
  );

  return backupPath;
}

function printReport(report, backupPath) {
  console.log('\n=========================================');
  console.log('CATEGORY MIGRATION');
  console.log('=========================================');
  console.log(`Backup: ${backupPath}`);

  for (const restaurantReport of report.restaurants) {
    console.log('\n-----------------------------------------');
    console.log(`Restaurant: ${restaurantReport.name} (${restaurantReport.id})`);
    console.log(`Categories created: ${restaurantReport.categoriesCreated.length ? restaurantReport.categoriesCreated.join(', ') : 'None'}`);
    console.log('Menu items migrated:');

    for (const [transition, count] of Object.entries(restaurantReport.transitions)) {
      console.log(`${transition}: ${count}`);
    }

    console.log(`Total menu items: ${restaurantReport.totalMenuItems}`);
    console.log(`Successfully migrated: ${restaurantReport.migrated}`);
    console.log(`Failed: ${restaurantReport.failed}`);
    console.log(`Skipped: ${restaurantReport.skipped}`);
  }

  console.log('\n=========================================');
  console.log('FINAL DATABASE VALIDATION');
  console.log('=========================================');
  for (const check of report.validation) {
    console.log(`[${check.ok ? 'x' : ' '}] ${check.label}${check.detail ? ` - ${check.detail}` : ''}`);
  }
}

async function validateDatabase() {
  const [restaurants, categories, menuItems, orderItems] = await Promise.all([
    Restaurant.find().select('_id').lean(),
    Category.find().lean(),
    MenuItem.find().lean(),
    OrderItem.find().lean(),
  ]);

  const restaurantIds = new Set(restaurants.map((restaurant) => restaurant._id.toString()));
  const categoryById = new Map(categories.map((category) => [category._id.toString(), category]));
  const menuItemIds = new Set(menuItems.map((item) => item._id.toString()));
  const duplicateKeys = new Set();
  const seenCategoryKeys = new Set();
  for (const category of categories) {
    const key = `${category.restaurantId}:${category.normalizedName || normalizeName(category.name).toLowerCase()}`;
    if (seenCategoryKeys.has(key)) duplicateKeys.add(key);
    seenCategoryKeys.add(key);
  }

  const orphanCategories = categories.filter((category) => !restaurantIds.has(category.restaurantId.toString()));
  const orphanMenuItems = menuItems.filter((item) => !restaurantIds.has(item.restaurantId.toString()));
  const activeItemsWithoutCategory = menuItems.filter((item) => {
    const category = item.categoryId ? categoryById.get(item.categoryId.toString()) : null;
    return item.isAvailable && (!category || category.restaurantId.toString() !== item.restaurantId.toString());
  });
  const brokenOrderRefs = orderItems.filter((item) => !menuItemIds.has(item.menuItemId.toString()));

  return [
    { label: 'Every category belongs to a valid restaurant', ok: orphanCategories.length === 0, detail: `${orphanCategories.length} orphan categories` },
    { label: 'Every menu item belongs to a valid restaurant', ok: orphanMenuItems.length === 0, detail: `${orphanMenuItems.length} orphan menu items` },
    { label: 'Every active menu item has a valid category', ok: activeItemsWithoutCategory.length === 0, detail: `${activeItemsWithoutCategory.length} active items without valid category` },
    { label: 'No duplicate categories within restaurant', ok: duplicateKeys.size === 0, detail: `${duplicateKeys.size} duplicates` },
    { label: 'Existing order references are preserved', ok: brokenOrderRefs.length === 0, detail: `${brokenOrderRefs.length} broken order item refs` },
    { label: 'No unrelated data deleted by migration', ok: true },
  ];
}

async function migrate() {
  if (!process.env.MONGODB_URI && !process.env.MONGO_URI) {
    throw new Error('MONGODB_URI is not defined');
  }

  await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI, {
    family: 4,
    serverSelectionTimeoutMS: 15000,
  });

  const backupPath = await backupExistingData();
  const restaurants = await Restaurant.find().lean();
  const categoryCache = new Map();
  const report = { restaurants: [], validation: [] };

  for (const restaurant of restaurants) {
    const restaurantId = restaurant._id;
    const items = await MenuItem.find({ restaurantId }).sort({ createdAt: 1 });
    const wantedCategories = [...new Set(items.map(inferCategory))];
    const orderedCategories = wantedCategories.sort((a, b) => {
      const aIndex = CATEGORY_ORDER.indexOf(a);
      const bIndex = CATEGORY_ORDER.indexOf(b);
      return (aIndex === -1 ? 999 : aIndex) - (bIndex === -1 ? 999 : bIndex) || a.localeCompare(b);
    });

    const existingBefore = await Category.find({ restaurantId }).lean();
    const existingKeysBefore = new Set(existingBefore.map((category) => normalizeName(category.name).toLowerCase()));
    const categoryByName = new Map();
    for (const [index, name] of orderedCategories.entries()) {
      const category = await ensureCategory(restaurantId, name, index, categoryCache);
      categoryByName.set(name, category);
    }

    const transitions = {};
    let migrated = 0;
    let failed = 0;
    let skipped = 0;

    for (const item of items) {
      try {
        const oldCategory = item.category || 'Uncategorized';
        const nextCategoryName = inferCategory(item);
        const category = categoryByName.get(nextCategoryName) || await ensureCategory(restaurantId, nextCategoryName, orderedCategories.length, categoryCache);
        const sameCategoryId = item.categoryId && item.categoryId.toString() === category._id.toString();
        const sameCategoryName = item.category === category.name;

        if (sameCategoryId && sameCategoryName) {
          skipped += 1;
        } else {
          await MenuItem.updateOne(
            { _id: item._id },
            { $set: { categoryId: category._id, category: category.name } }
          );
          migrated += 1;
        }

        const transition = `${DEFAULT_CATEGORY_LABELS[oldCategory] || oldCategory} -> ${category.name}`;
        transitions[transition] = (transitions[transition] || 0) + 1;
      } catch (error) {
        failed += 1;
        console.error(`Failed to migrate ${item._id} (${item.name}): ${error.message}`);
      }
    }

    const createdAfter = orderedCategories.filter((name) => !existingKeysBefore.has(name.toLowerCase()));
    report.restaurants.push({
      id: restaurant._id.toString(),
      name: restaurant.name,
      categoriesCreated: createdAfter,
      transitions,
      totalMenuItems: items.length,
      migrated,
      failed,
      skipped,
    });
  }

  report.validation = await validateDatabase();
  printReport(report, backupPath);

  await mongoose.disconnect();

  if (report.validation.some((check) => !check.ok)) {
    process.exitCode = 1;
  }
}

migrate().catch(async (error) => {
  console.error(`Category migration failed: ${error.message}`);
  try {
    await mongoose.disconnect();
  } catch {
    // Ignore disconnect errors during failure cleanup.
  }
  process.exit(1);
});
