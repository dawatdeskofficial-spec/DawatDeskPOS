require('dotenv').config();
const mongoose = require('mongoose');

const Restaurant = require('./models/Restaurant');
const MenuItem = require('./models/MenuItem');

const coldDrinkCan = {
  name: 'Small Cold Drink Can',
  description: 'Single-serve chilled soft drink can maintained by waiter',
  price: 35,
  category: 'BEVERAGE',
  isAvailable: true,
  preparationTime: 0,
  fulfillmentOwner: 'WAITER',
};

const run = async () => {
  if (!process.env.MONGO_URI) {
    throw new Error('MONGO_URI is not defined in environment variables');
  }

  await mongoose.connect(process.env.MONGO_URI);

  const restaurants = await Restaurant.find({}, '_id name');
  if (restaurants.length === 0) {
    throw new Error('No restaurants found. Create a restaurant before adding menu items.');
  }

  for (const restaurant of restaurants) {
    await MenuItem.findOneAndUpdate(
      { restaurantId: restaurant._id, name: coldDrinkCan.name },
      {
        $set: {
          ...coldDrinkCan,
          restaurantId: restaurant._id,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  }

  console.log(`Upserted ${coldDrinkCan.name} for ${restaurants.length} restaurants.`);
};

run()
  .catch((error) => {
    console.error('Cold drink can upsert failed:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
