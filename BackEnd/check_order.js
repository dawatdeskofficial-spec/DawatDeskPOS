require('dotenv').config();
const Order = require('./models/Order');
const OrderItem = require('./models/OrderItem');
const MenuItem = require('./models/MenuItem');
const orderService = require('./services/orderService');
const connectDB = require('./config/database');

async function test() {
  await connectDB();
  const orders = await Order.find().sort({ createdAt: -1 }).limit(5).lean();
  for (const order of orders) {
    console.log(`Order: ${order._id}, table: ${order.tableNumber}, status: ${order.status}, type: ${order.orderType}`);
    const items = await OrderItem.find({ orderId: order._id }).lean();
    for (const it of items) {
      const menu = await MenuItem.findById(it.menuItemId).select('name fulfillmentOwner').lean();
      console.log(`  Item: ${menu?.name} (${it._id}) status: ${it.status}, fulfillmentOwner: ${menu?.fulfillmentOwner}`);
    }
  }
  process.exit(0);
}
test();
