const Order = require('../models/Order');
const OrderItem = require('../models/OrderItem');
const MenuItem = require('../models/MenuItem');
const Payment = require('../models/Payment');
const Restaurant = require('../models/Restaurant');
const logger = require('../utils/logger');
const { ORDER_STATUS } = require('../utils/constants');
const mongoose = require('mongoose');

class OrderService {
  async syncOrderStatusFromItems(orderId) {
    const items = await OrderItem.find({ orderId });
    if (!items || items.length === 0) return Order.findById(orderId);

    const activeItems = items.filter((item) => item.status !== 'CANCELLED');
    if (!activeItems || activeItems.length === 0) {
      return Order.findById(orderId);
    }

    const statuses = activeItems.map((item) => item.status);
    let status = ORDER_STATUS.PENDING;
    let servedAt = null;

    if (statuses.length > 0 && statuses.every((itemStatus) => itemStatus === 'DELIVERED')) {
      status = ORDER_STATUS.SERVED;
      const currentOrder = await Order.findById(orderId).select('servedAt');
      servedAt = currentOrder?.servedAt || new Date();
    } else if (statuses.every((itemStatus) => itemStatus === 'READY' || itemStatus === 'DELIVERED')) {
      // ALL active items are ready (or delivered)! Waiter can pick up full order.
      status = ORDER_STATUS.READY;
    } else if (statuses.some((itemStatus) => itemStatus === 'READY' || itemStatus === 'PREPARING')) {
      // Partially ready or currently being cooked
      status = ORDER_STATUS.PREPARING;
    } else {
      status = ORDER_STATUS.PENDING;
    }

    const update = { status, servedAt };

    return Order.findByIdAndUpdate(orderId, update, { new: true });
  }

  async updateItemsForStatus(orderId, batchFilter, requiredCurrentStatus, nextItemStatus) {
    const result = await OrderItem.updateMany(
      { orderId, ...batchFilter, status: requiredCurrentStatus },
      { status: nextItemStatus }
    );

    if (result.matchedCount === 0) {
      throw new Error(
        `Item must be ${requiredCurrentStatus.toLowerCase()} before it can be ${nextItemStatus.toLowerCase()}`
      );
    }
  }

  async attachItemsToOrders(orders) {
    if (!orders || orders.length === 0) return [];

    const orderIds = orders.map((order) => order._id || order.id);
    const items = await OrderItem.find({ orderId: { $in: orderIds } });

    // Get all unique menuItemIds
    const menuItemIds = [...new Set(items.map(item => item.menuItemId).filter(Boolean))];
    const menuItems = await MenuItem.find({ _id: { $in: menuItemIds } });
    const menuItemMap = menuItems.reduce((map, item) => {
      map[item._id.toString()] = item;
      return map;
    }, {});

    const grouped = items.reduce((map, item) => {
      const id = item.orderId?.toString();
      if (!id) return map;
      if (!map[id]) map[id] = [];
      const menuItemIdStr = item.menuItemId ? item.menuItemId.toString() : null;
      const menuItem = menuItemIdStr ? menuItemMap[menuItemIdStr] : null;
      if (!menuItem) {
        logger.warn(`Skipping order item with missing menu item: ${item._id}`);
        return map;
      }

      map[id].push({
        id: item._id.toString(),
        name: menuItem.name,
        qty: item.quantity,
        price: item.price,
        note: item.specialInstructions || '',
        status: item.status,
        kitchenBatch: item.kitchenBatch || item._id.toString(),
        createdAt: item.createdAt,
        category: menuItem.category,
        fulfillmentOwner: menuItem.fulfillmentOwner || 'KITCHEN',
      });
      return map;
    }, {});

    return orders.map((order) => {
      const plainOrder = order.toObject ? order.toObject() : { ...order };
      return {
        ...plainOrder,
        items: grouped[plainOrder._id?.toString() || plainOrder.id?.toString()] || [],
      };
    });
  }

  // Create order
  async createOrder(orderData) {
    try {
      const { items, ...orderFields } = orderData;
      const restaurant = await Restaurant.findById(orderFields.restaurantId).select('maxTables gstPercentage');
      if (!restaurant) {
        throw new Error('Restaurant not found');
      }
      const isParcel = orderFields.orderType === 'PARCEL';

      if (!isParcel) {
        if (!orderFields.tableNumber || Number(orderFields.tableNumber) < 1) {
          throw new Error('Table number is required for dine-in orders');
        }
        if (Number(orderFields.tableNumber) > restaurant.maxTables) {
          throw new Error(`Table number cannot exceed ${restaurant.maxTables}`);
        }
      } else {
        orderFields.tableNumber = 0;
        orderFields.orderType = 'PARCEL';
      }

      let order = null;
      if (!isParcel) {
        order = await Order.findOne({
          restaurantId: orderFields.restaurantId,
          tableNumber: orderFields.tableNumber,
          orderType: { $ne: 'PARCEL' },
          status: { $nin: ['COMPLETED', 'CANCELLED'] }
        });
      }

      if (!order) {
        order = new Order(orderFields);
        await order.save();
        logger.info(`Order created: ${order._id} (Type: ${order.orderType || 'DINE_IN'})`);
      } else {
        logger.info(`Reusing active order: ${order._id} for table ${orderFields.tableNumber}`);
      }

      if (items && items.length > 0) {
        // Get all menu items to find their prices
        const menuItemIds = items.map(item => item.menuItemId);
        const menuItems = await MenuItem.find({ _id: { $in: menuItemIds } });
        const menuItemsMap = menuItems.reduce((map, item) => {
          map[item._id.toString()] = item;
          return map;
        }, {});

        const kitchenBatchId = new mongoose.Types.ObjectId().toString();

        const orderItemsToCreate = items.map(item => {
          if (!item.menuItemId) {
            throw new Error('Menu item ID is required for all order items');
          }
          const menuItem = menuItemsMap[item.menuItemId.toString()];
          if (!menuItem) {
            throw new Error('Menu item not found');
          }

          if (menuItem.restaurantId.toString() !== order.restaurantId.toString()) {
            throw new Error('Menu item does not belong to this restaurant');
          }

          if (!menuItem.isAvailable) {
            throw new Error(`${menuItem.name} is currently unavailable`);
          }

          return {
            orderId: order._id,
            menuItemId: item.menuItemId,
            quantity: item.quantity || 1,
            price: menuItem.price,
            specialInstructions: item.specialInstructions || '',
            kitchenBatch: kitchenBatchId,
            status: menuItem.fulfillmentOwner === 'WAITER' ? 'DELIVERED' : 'PENDING',
          };
        });

        if (orderItemsToCreate.length > 0) {
          await OrderItem.insertMany(orderItemsToCreate);
          logger.info(`Created ${orderItemsToCreate.length} items for order: ${order._id}`);
          
          await this.updateOrderTotal(order._id);
          await this.syncOrderStatusFromItems(order._id);
        }
      }

      return this.getOrderById(order._id);
    } catch (error) {
      logger.error(`Create order error: ${error.message}`);
      throw error;
    }
  }

  async getOrdersByRestaurant(restaurantId, page = 1, limit = 20, status = null) {
    try {
      const skip = (page - 1) * limit;
      const query = {};
      if (restaurantId && restaurantId !== 'all') {
        query.restaurantId = restaurantId;
      }

      if (status) {
        query.status = status;
      }

      const orders = await Order.find(query)
        .populate('restaurantId', 'name location city')
        .populate('createdBy', 'name email role')
        .sort({ createdAt: -1 })
        .limit(limit)
        .skip(skip);

      const total = await Order.countDocuments(query);
      const ordersWithItems = await this.attachItemsToOrders(orders);

      return { orders: ordersWithItems, total, page, limit };
    } catch (error) {
      logger.error(`Get orders error: ${error.message}`);
      throw error;
    }
  }

  // Get orders by table (with pagination)
  async getOrdersByTable(restaurantId, tableNumber, page = 1, limit = 20) {
    try {
      const skip = (page - 1) * limit;
      const query = { restaurantId, tableNumber: parseInt(tableNumber, 10) };

      const orders = await Order.find(query)
        .populate('createdBy', 'name email role')
        .sort({ createdAt: -1 })
        .limit(limit)
        .skip(skip);

      const total = await Order.countDocuments(query);
      const ordersWithItems = await this.attachItemsToOrders(orders);

      return { orders: ordersWithItems, total, page, limit };
    } catch (error) {
      logger.error(`Get orders by table error: ${error.message}`);
      throw error;
    }
  }

  // Get order by ID with items
  async getOrderById(orderId) {
    try {
      const order = await Order.findById(orderId).populate('createdBy');

      if (!order) {
        throw new Error('Order not found');
      }

      const ordersWithItems = await this.attachItemsToOrders([order]);
      return ordersWithItems[0];
    } catch (error) {
      logger.error(`Get order error: ${error.message}`);
      throw error;
    }
  }

  // Add item to order
  async addItemToOrder(orderId, menuItemId, quantity, specialInstructions = '') {
    try {
      const order = await Order.findById(orderId);
      if (!order) {
        throw new Error('Order not found');
      }

      if (order.status === ORDER_STATUS.COMPLETED) {
        throw new Error('Completed orders cannot be changed');
      }

      // Check if menu item exists and get price
      const menuItem = await MenuItem.findById(menuItemId);
      if (!menuItem) {
        throw new Error('Menu item not found');
      }

      if (menuItem.restaurantId.toString() !== order.restaurantId.toString()) {
        throw new Error('Menu item does not belong to this restaurant');
      }

      if (!menuItem.isAvailable) {
        throw new Error(`${menuItem.name} is currently unavailable`);
      }

      const existingOrderItems = await OrderItem.find({ orderId });
      const canMergeExistingItem = existingOrderItems.every(
        (item) => item.status === 'PENDING'
      );

      // Once kitchen work has started, extra customer requests must be new lines
      // so the already-started item is not changed underneath the chef.
      let orderItem = null;
      if (canMergeExistingItem) {
        orderItem = await OrderItem.findOne({ orderId, menuItemId, status: 'PENDING' });
      }

      if (orderItem) {
        orderItem.quantity += quantity;
      } else {
        const kitchenBatch =
          canMergeExistingItem
            ? order._id.toString()
            : new mongoose.Types.ObjectId().toString();

        orderItem = new OrderItem({
          orderId,
          menuItemId,
          quantity,
          price: menuItem.price,
          specialInstructions,
          kitchenBatch,
          status: menuItem.fulfillmentOwner === 'WAITER' ? 'DELIVERED' : 'PENDING',
        });
      }

      await orderItem.save();
      logger.info(`Item added to order: ${orderId}`);

      // Update order total
      await this.updateOrderTotal(orderId);
      await this.syncOrderStatusFromItems(orderId);

      return orderItem;
    } catch (error) {
      logger.error(`Add item to order error: ${error.message}`);
      throw error;
    }
  }

  // Update order status
  async updateOrderStatus(orderId, newStatus, kitchenBatch = null, itemIds = []) {
    try {
      const validStatuses = Object.values(ORDER_STATUS);
      if (!validStatuses.includes(newStatus)) {
        throw new Error('Invalid order status');
      }

      const order = await Order.findById(orderId);
      if (!order) {
        throw new Error('Order not found');
      }

      if (newStatus === ORDER_STATUS.COMPLETED) {
        const payment = await Payment.findOne({ orderId, status: 'COMPLETED' });
        if (!payment) {
          throw new Error('Order can only be completed after payment succeeds');
        }
      }

      let updatedOrder;
      const batchFilter = {};
      const validItemIds = Array.isArray(itemIds)
        ? itemIds.filter((itemId) => mongoose.Types.ObjectId.isValid(itemId))
        : [];

      if (validItemIds.length > 0) {
        batchFilter._id = { $in: validItemIds };
      } else if (kitchenBatch) {
        batchFilter.$or = [{ kitchenBatch }];
        if (mongoose.Types.ObjectId.isValid(kitchenBatch)) {
          batchFilter.$or.push({ _id: kitchenBatch });
        }
      }

      if (newStatus === ORDER_STATUS.PREPARING) {
        const filter = validItemIds.length > 0 ? { _id: { $in: validItemIds } } : {};
        await OrderItem.updateMany(
          { orderId, ...filter, status: { $in: ['PENDING', 'READY'] } },
          { status: 'PREPARING' }
        );
        updatedOrder = await this.syncOrderStatusFromItems(orderId);
      } else if (newStatus === ORDER_STATUS.READY) {
        const filter = validItemIds.length > 0 ? { _id: { $in: validItemIds } } : {};
        // Can mark ready from PENDING or PREPARING
        await OrderItem.updateMany(
          { orderId, ...filter, status: { $in: ['PENDING', 'PREPARING'] } },
          { status: 'READY' }
        );
        updatedOrder = await this.syncOrderStatusFromItems(orderId);
      } else if (newStatus === ORDER_STATUS.SERVED) {
        // Waiter/chef serves the order — mark all active items as DELIVERED
        const serveFilter = validItemIds.length > 0 ? { _id: { $in: validItemIds } } : {};
        await OrderItem.updateMany(
          { orderId, ...serveFilter, status: { $in: ['PENDING', 'PREPARING', 'READY'] } },
          { status: 'DELIVERED' }
        );
        updatedOrder = await this.syncOrderStatusFromItems(orderId);
        await Order.findByIdAndUpdate(orderId, {
          status: ORDER_STATUS.SERVED,
          servedAt: order.servedAt || new Date()
        });
      } else {
        updatedOrder = await Order.findByIdAndUpdate(
          orderId,
          {
            status: newStatus,
            completedAt: new Date(),
            paymentStatus: 'COMPLETED',
          },
          { new: true }
        );
      }

      logger.info(`Order status updated: ${orderId} -> ${newStatus}`);
      return this.getOrderById(orderId);
    } catch (error) {
      logger.error(`Update order status error: ${error.message}`);
      throw error;
    }
  }

  // Update order total
  async updateOrderTotal(orderId) {
    try {
      const orderItems = await OrderItem.find({ orderId, status: { $ne: 'CANCELLED' } });
      const subtotal = orderItems.reduce(
        (sum, item) => sum + (Number(item.price) || 0) * (Number(item.quantity) || 1),
        0
      );

      const order = await Order.findById(orderId);
      const restaurant = order ? await Restaurant.findById(order.restaurantId).select('gstPercentage') : null;
      const gstPercentage = restaurant?.gstPercentage ?? 5;
      const gst = (subtotal * gstPercentage) / 100;

      await Order.findByIdAndUpdate(orderId, {
        totalAmount: subtotal + gst,
        gst,
      });

      logger.info(`Order total updated: ${orderId}`);
    } catch (error) {
      logger.error(`Update order total error: ${error.message}`);
      throw error;
    }
  }

  // Update item quantity in order
  async updateOrderItemQuantity(orderId, orderItemId, quantity, userRole = null, specialInstructions = undefined) {
    try {
      const order = await Order.findById(orderId);
      if (!order) {
        throw new Error('Order not found');
      }

      if (['COMPLETED', 'CANCELLED'].includes(order.status)) {
        throw new Error('Cannot edit a completed or cancelled order');
      }

      if (userRole === 'WAITER' && order.status !== ORDER_STATUS.PENDING) {
        throw new Error('Cannot update order: Chef has already started cooking this order');
      }

      const orderItem = await OrderItem.findById(orderItemId);
      if (!orderItem) {
        throw new Error('Order item not found');
      }

      if (userRole === 'WAITER' && orderItem.status !== 'PENDING') {
        throw new Error('Cannot update order item: Chef has already started cooking this item');
      }

      const parsedQty = parseInt(quantity, 10);
      if (isNaN(parsedQty) || parsedQty <= 0) {
        return this.removeItemFromOrder(orderId, orderItemId, userRole);
      }

      const updateData = { quantity: parsedQty };
      if (specialInstructions !== undefined) {
        updateData.specialInstructions = specialInstructions;
      }

      const updatedOrderItem = await OrderItem.findByIdAndUpdate(
        orderItemId,
        updateData,
        { new: true }
      );

      // Update order total
      await this.updateOrderTotal(orderId);

      logger.info(`Item quantity updated: ${orderId} / ${orderItemId} -> ${parsedQty}`);
      return updatedOrderItem;
    } catch (error) {
      logger.error(`Update item quantity error: ${error.message}`);
      throw error;
    }
  }

  // Remove item from order
  async removeItemFromOrder(orderId, orderItemId, userRole = null) {
    try {
      const order = await Order.findById(orderId);
      if (!order) {
        throw new Error('Order not found');
      }

      if (['COMPLETED', 'CANCELLED'].includes(order.status)) {
        throw new Error('Cannot edit a completed or cancelled order');
      }

      const orderItem = await OrderItem.findById(orderItemId);
      if (!orderItem) {
        throw new Error('Order item not found');
      }

      if (userRole === 'WAITER' && (order.status !== ORDER_STATUS.PENDING || orderItem.status !== 'PENDING')) {
        throw new Error('Cannot remove item: Chef has already started cooking this order');
      }

      await OrderItem.findByIdAndDelete(orderItemId);

      // Update order total and sync status
      await this.updateOrderTotal(orderId);
      await this.syncOrderStatusFromItems(orderId);

      logger.info(`Item removed from order: ${orderId}`);
      return orderItem;
    } catch (error) {
      logger.error(`Remove item from order error: ${error.message}`);
      throw error;
    }
  }

  // Batch update order items (atomic update for waiter/cashier/admin)
  async batchUpdateOrderItems(orderId, batchData = {}, userRole = null) {
    try {
      const order = await Order.findById(orderId);
      if (!order) {
        throw new Error('Order not found');
      }

      if (['COMPLETED', 'CANCELLED'].includes(order.status)) {
        throw new Error('Cannot edit a completed or cancelled order');
      }

      // If user is WAITER: MUST be in PENDING status (before chef starts cooking)
      if (userRole === 'WAITER') {
        if (order.status !== ORDER_STATUS.PENDING) {
          throw new Error('Cannot update order: Chef has already started cooking this order');
        }

        // Also ensure all existing items are PENDING
        const currentItems = await OrderItem.find({ orderId });
        const hasStartedItems = currentItems.some(it => it.status !== 'PENDING');
        if (hasStartedItems) {
          throw new Error('Cannot update order: Chef has already started cooking one or more items');
        }
      }

      const { itemsToUpdate = [], itemsToAdd = [], itemIdsToDelete = [], notes } = batchData;

      // 1. Delete items
      if (itemIdsToDelete && itemIdsToDelete.length > 0) {
        const validDeleteIds = itemIdsToDelete.filter(id => mongoose.Types.ObjectId.isValid(id));
        if (validDeleteIds.length > 0) {
          await OrderItem.deleteMany({ orderId, _id: { $in: validDeleteIds } });
        }
      }

      // 2. Add new items
      if (itemsToAdd && itemsToAdd.length > 0) {
        const menuItemIds = itemsToAdd.map(it => it.menuItemId).filter(id => mongoose.Types.ObjectId.isValid(id));
        const menuItems = await MenuItem.find({ _id: { $in: menuItemIds } });
        const menuMap = menuItems.reduce((acc, m) => {
          acc[m._id.toString()] = m;
          return acc;
        }, {});

        const itemsToInsert = [];
        const kitchenBatchId = new mongoose.Types.ObjectId().toString();

        for (const item of itemsToAdd) {
          const menuItem = menuMap[item.menuItemId?.toString()];
          if (menuItem) {
            itemsToInsert.push({
              orderId: order._id,
              menuItemId: menuItem._id,
              quantity: Math.max(1, parseInt(item.qty || item.quantity, 10) || 1),
              price: menuItem.price,
              specialInstructions: item.specialInstructions || '',
              kitchenBatch: kitchenBatchId,
              status: menuItem.fulfillmentOwner === 'WAITER' ? 'DELIVERED' : 'PENDING',
            });
          }
        }

        if (itemsToInsert.length > 0) {
          await OrderItem.insertMany(itemsToInsert);
        }
      }

      // 3. Update existing items
      for (const item of itemsToUpdate) {
        const itemId = item.id || item._id || item.orderItemId;
        if (!itemId || !mongoose.Types.ObjectId.isValid(itemId)) continue;

        const newQty = parseInt(item.qty || item.quantity, 10);
        if (newQty <= 0) {
          await OrderItem.findByIdAndDelete(itemId);
        } else {
          const updateFields = { quantity: newQty };
          if (item.specialInstructions !== undefined) {
            updateFields.specialInstructions = item.specialInstructions;
          }
          await OrderItem.findByIdAndUpdate(itemId, updateFields);
        }
      }

      // 4. Update order notes if provided
      if (notes !== undefined) {
        await Order.findByIdAndUpdate(orderId, { notes: String(notes).trim() });
      }

      // 5. Recalculate order total and sync status
      await this.updateOrderTotal(orderId);
      await this.syncOrderStatusFromItems(orderId);

      logger.info(`Batch updated order items for order: ${orderId}`);
      return this.getOrderById(orderId);
    } catch (error) {
      logger.error(`Batch update order items error: ${error.message}`);
      throw error;
    }
  }

  // Complete order
  async completeOrder(orderId) {
    try {
      const order = await Order.findById(orderId);
      if (!order) {
        throw new Error('Order not found');
      }

      const payment = await Payment.findOne({ orderId, status: 'COMPLETED' });
      if (!payment) {
        throw new Error('Order can only be completed after payment succeeds');
      }

      const updatedOrder = await Order.findByIdAndUpdate(
        orderId,
        {
          status: ORDER_STATUS.COMPLETED,
          completedAt: new Date(),
          paymentStatus: 'COMPLETED',
        },
        { new: true }
      );

      logger.info(`Order completed: ${orderId}`);
      return updatedOrder;
    } catch (error) {
      logger.error(`Complete order error: ${error.message}`);
      throw error;
    }
  }

  async cancelOrder(orderId, reason = '', userRole = null) {
    try {
      if (!reason || !reason.trim()) {
        throw new Error('Cancel reason is required');
      }

      const order = await Order.findById(orderId);
      if (!order) {
        throw new Error('Order not found');
      }

      if (userRole === 'WAITER' && order.status !== ORDER_STATUS.PENDING) {
        throw new Error('Cannot cancel order: Chef has already started cooking this order');
      }

      if (order.status === ORDER_STATUS.COMPLETED) {
        throw new Error('Completed paid orders cannot be cancelled. Use refund instead.');
      }

      if (![ORDER_STATUS.PENDING, ORDER_STATUS.PREPARING, ORDER_STATUS.READY].includes(order.status)) {
        throw new Error('Only pending kitchen orders can be cancelled before payment');
      }

      const payment = await Payment.findOne({ orderId });
      if (payment) {
        throw new Error('Paid orders cannot be cancelled. Use refund instead.');
      }

      await OrderItem.updateMany({ orderId }, { status: 'CANCELLED' });
      const updatedOrder = await Order.findByIdAndUpdate(
        orderId,
        {
          status: ORDER_STATUS.CANCELLED,
          paymentStatus: 'CANCELLED',
          cancelReason: reason.trim(),
          cancelledAt: new Date(),
        },
        { new: true }
      );

      logger.info(`Order cancelled: ${orderId}`);
      return this.getOrderById(orderId);
    } catch (error) {
      logger.error(`Cancel order error: ${error.message}`);
      throw error;
    }
  }
}

module.exports = new OrderService();
