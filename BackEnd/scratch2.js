const mongoose = require('mongoose');
require('dotenv').config();
const Order = require('./models/Order');

async function test() {
  await mongoose.connect(process.env.MONGO_URI);
  const order = await Order.findOne().sort({ createdAt: -1 }).lean();
  console.log(JSON.stringify(order, null, 2));
  process.exit(0);
}
test();
