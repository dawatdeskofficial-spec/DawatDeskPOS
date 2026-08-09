const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Order = require('./models/Order');
const OrderItem = require('./models/OrderItem');
const MenuItem = require('./models/MenuItem');
const OrderService = require('./services/orderService');

dotenv.config({ path: './.env' });

async function fix() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to DB');

  // Find all items that are not cancelled or delivered
  const items = await OrderItem.find({ status: { $nin: ['CANCELLED', 'DELIVERED'] } });
  let count = 0;
  for (const item of items) {
    const menu = await MenuItem.findById(item.menuItemId);
    if (menu && menu.fulfillmentOwner === 'WAITER') {
      item.status = 'DELIVERED';
      await item.save();
      count++;
    }
  }
  console.log(`Updated ${count} waiter items to DELIVERED`);

  // Also fix sync bug for any CANCELLED items by forcing resync on all active orders
  const activeOrders = await Order.find({ status: { $nin: ['COMPLETED', 'CANCELLED', 'SERVED'] } });
  
  const svc = require('./services/orderService');
  
  let syncCount = 0;
  for (const order of activeOrders) {
     const updated = await svc.syncOrderStatusFromItems(order._id);
     if (updated && updated.status === 'SERVED') {
       syncCount++;
     }
  }
  
  console.log(`Resynced ${activeOrders.length} active orders. ${syncCount} became SERVED!`);

  process.exit(0);
}
fix();
