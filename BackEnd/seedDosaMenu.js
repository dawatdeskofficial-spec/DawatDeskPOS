require('dotenv').config();
const mongoose = require('mongoose');

const Restaurant = require('./models/Restaurant');
const MenuItem = require('./models/MenuItem');

const dosaMenu = [
  {
    name: 'Plain Dosa',
    description: 'Classic crispy rice and lentil dosa served with sambar and chutneys',
    price: 90,
    category: 'MAIN_COURSE',
    preparationTime: 10,
  },
  {
    name: 'Masala Dosa',
    description: 'Crispy dosa filled with spiced potato masala',
    price: 120,
    category: 'MAIN_COURSE',
    preparationTime: 12,
  },
  {
    name: 'Mysore Masala Dosa',
    description: 'Dosa spread with red chutney and potato masala',
    price: 150,
    category: 'MAIN_COURSE',
    preparationTime: 14,
  },
  {
    name: 'Ghee Roast Dosa',
    description: 'Paper-thin dosa roasted with ghee',
    price: 140,
    category: 'MAIN_COURSE',
    preparationTime: 12,
  },
  {
    name: 'Cheese Dosa',
    description: 'Crispy dosa topped with melted cheese',
    price: 160,
    category: 'MAIN_COURSE',
    preparationTime: 13,
  },
  {
    name: 'Onion Uttapam',
    description: 'Thick dosa topped with onion, chilli, and coriander',
    price: 130,
    category: 'MAIN_COURSE',
    preparationTime: 12,
  },
  {
    name: 'Idli Vada Combo',
    description: 'Steamed idlis with medu vada, sambar, and chutney',
    price: 90,
    category: 'APPETIZER',
    preparationTime: 8,
  },
  {
    name: 'Medu Vada',
    description: 'Crispy lentil doughnuts with sambar and chutney',
    price: 80,
    category: 'APPETIZER',
    preparationTime: 8,
  },
  {
    name: 'Podi Idli',
    description: 'Mini idlis tossed with ghee and gunpowder podi',
    price: 95,
    category: 'APPETIZER',
    preparationTime: 7,
  },
  {
    name: 'Extra Sambar',
    description: 'Hot lentil sambar served on the side',
    price: 30,
    category: 'SIDES',
    preparationTime: 2,
  },
  {
    name: 'Coconut Chutney Bowl',
    description: 'Fresh coconut chutney for sharing',
    price: 25,
    category: 'SIDES',
    preparationTime: 2,
  },
  {
    name: 'Tomato Chutney',
    description: 'Tangy tomato chutney side portion',
    price: 25,
    category: 'SIDES',
    preparationTime: 2,
  },
  {
    name: 'Rava Kesari',
    description: 'Classic semolina sweet with ghee and cashews',
    price: 70,
    category: 'DESSERT',
    preparationTime: 5,
  },
  {
    name: 'Sweet Pongal',
    description: 'Rice and jaggery sweet with ghee and cashews',
    price: 85,
    category: 'DESSERT',
    preparationTime: 5,
  },
  {
    name: 'Filter Coffee',
    description: 'Traditional South Indian filter coffee',
    price: 50,
    category: 'BEVERAGE',
    preparationTime: 4,
  },
  {
    name: 'Masala Chai',
    description: 'Spiced milk tea',
    price: 40,
    category: 'BEVERAGE',
    preparationTime: 4,
  },
  {
    name: 'Buttermilk',
    description: 'Chilled spiced buttermilk',
    price: 45,
    category: 'BEVERAGE',
    preparationTime: 3,
  },
  {
    name: 'Small Cold Drink Can',
    description: 'Single-serve chilled soft drink can maintained by waiter',
    price: 35,
    category: 'BEVERAGE',
    preparationTime: 0,
    fulfillmentOwner: 'WAITER',
  },
];

const run = async () => {
  if (!process.env.MONGO_URI) {
    throw new Error('MONGO_URI is not defined in environment variables');
  }

  await mongoose.connect(process.env.MONGO_URI);

  const restaurants = await Restaurant.find({}, '_id name');
  if (restaurants.length === 0) {
    throw new Error('No restaurants found. Create a restaurant before seeding menu items.');
  }

  const restaurantIds = restaurants.map((restaurant) => restaurant._id);
  const deleteResult = await MenuItem.deleteMany({ restaurantId: { $in: restaurantIds } });

  const items = restaurants.flatMap((restaurant) =>
    dosaMenu.map((item) => ({
      ...item,
      restaurantId: restaurant._id,
      isAvailable: true,
    })),
  );

  await MenuItem.insertMany(items);

  console.log(`Deleted ${deleteResult.deletedCount} old menu items.`);
  console.log(`Inserted ${items.length} dosa menu items for ${restaurants.length} restaurants.`);
  restaurants.forEach((restaurant) => {
    console.log(`- ${restaurant.name}: ${dosaMenu.length} items`);
  });
};

run()
  .catch((error) => {
    console.error('Dosa menu seed failed:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
