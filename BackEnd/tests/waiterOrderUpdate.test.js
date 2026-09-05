const test = require('node:test');
const assert = require('node:assert/strict');
const orderService = require('../services/orderService');
const Order = require('../models/Order');
const OrderItem = require('../models/OrderItem');

test('Waiter cannot update item quantity if order is already PREPARING (chef cooking)', async () => {
  const originalFindById = Order.findById;
  const originalItemFindById = OrderItem.findById;

  try {
    // Mock order in PREPARING status
    Order.findById = async () => ({
      _id: 'order-123',
      status: 'PREPARING',
    });

    OrderItem.findById = async () => ({
      _id: 'item-456',
      status: 'PREPARING',
      quantity: 1,
    });

    await assert.rejects(
      async () => {
        await orderService.updateOrderItemQuantity('order-123', 'item-456', 2, 'WAITER');
      },
      {
        message: /Chef has already started cooking/,
      }
    );
  } finally {
    Order.findById = originalFindById;
    OrderItem.findById = originalItemFindById;
  }
});

test('Waiter cannot remove item if order is already PREPARING (chef cooking)', async () => {
  const originalFindById = Order.findById;
  const originalItemFindById = OrderItem.findById;

  try {
    Order.findById = async () => ({
      _id: 'order-123',
      status: 'PREPARING',
    });

    OrderItem.findById = async () => ({
      _id: 'item-456',
      status: 'PREPARING',
    });

    await assert.rejects(
      async () => {
        await orderService.removeItemFromOrder('order-123', 'item-456', 'WAITER');
      },
      {
        message: /Chef has already started cooking/,
      }
    );
  } finally {
    Order.findById = originalFindById;
    OrderItem.findById = originalItemFindById;
  }
});

test('Waiter cannot batch update order if order is already PREPARING (chef cooking)', async () => {
  const originalFindById = Order.findById;

  try {
    Order.findById = async () => ({
      _id: 'order-123',
      status: 'PREPARING',
    });

    await assert.rejects(
      async () => {
        await orderService.batchUpdateOrderItems('order-123', { itemsToUpdate: [{ id: 'item-1', qty: 3 }] }, 'WAITER');
      },
      {
        message: /Chef has already started cooking/,
      }
    );
  } finally {
    Order.findById = originalFindById;
  }
});

test('Waiter cannot cancel order if order is already PREPARING (chef cooking)', async () => {
  const originalFindById = Order.findById;

  try {
    Order.findById = async () => ({
      _id: 'order-123',
      status: 'PREPARING',
    });

    await assert.rejects(
      async () => {
        await orderService.cancelOrder('order-123', 'Customer changed mind', 'WAITER');
      },
      {
        message: /Chef has already started cooking/,
      }
    );
  } finally {
    Order.findById = originalFindById;
  }
});
