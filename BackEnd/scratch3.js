const mongoose = require('mongoose');
require('dotenv').config();
const orderService = require('./services/orderService');

async function test() {
  await mongoose.connect(process.env.MONGO_URI);
  const restaurant = await mongoose.model('Restaurant').findOne();
  if(!restaurant) return console.log('no restaurant');
  const res = await orderService.getOrdersByRestaurant(restaurant._id);
  console.log(JSON.stringify(res.orders.map(o => o.items), null, 2));
  process.exit(0);
}
test();
