const mongoose = require('mongoose');
require('dotenv').config();
const OrderItem = require('./models/OrderItem');
const MenuItem = require('./models/MenuItem'); // Ensure registered

async function test() {
  await mongoose.connect(process.env.MONGO_URI);
  const items = await OrderItem.find().populate('menuItemId');
  console.log(items[0]);
  process.exit(0);
}
test();
