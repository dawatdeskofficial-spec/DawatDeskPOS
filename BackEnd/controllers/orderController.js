const orderService = require('../services/orderService');
const { sendSuccess, sendError, sendPaginatedResponse } = require('../utils/responseHandler');
const logger = require('../utils/logger');

class OrderController {
  // Create order
  async createOrder(req, res) {
    try {
      const orderData = { ...(req.body || {}) };

      // Ensure createdBy is set from authenticated user
      if (!orderData.createdBy && req.user) {
        orderData.createdBy = req.user._id || req.user.id || req.user;
      }

      // If restaurantId not provided, try to derive from user's restaurantId
      if (!orderData.restaurantId && req.user) {
        const r = req.user.restaurantId;
        orderData.restaurantId = typeof r === 'string' ? r : (r && (r._id || r.id));
      }

      const order = await orderService.createOrder(orderData);

      return sendSuccess(res, 'Order created successfully', order, 201);
    } catch (error) {
      logger.error(`Create order error: ${error.message}`);
      return sendError(res, error.message, 400);
    }
  }

  // Get orders by restaurant
  async getOrdersByRestaurant(req, res) {
    try {
      const { restaurantId } = req.params;
      const { page = 1, limit = 20, status } = req.query;

      const { orders, total } = await orderService.getOrdersByRestaurant(
        restaurantId,
        page,
        limit,
        status
      );

      return sendPaginatedResponse(res, orders, page, limit, total);
    } catch (error) {
      logger.error(`Get orders error: ${error.message}`);
      return sendError(res, error.message, 400);
    }
  }

  // Get orders by table
  async getOrdersByTable(req, res) {
    try {
      const { restaurantId, tableNumber } = req.params;
      const { page = 1, limit = 20 } = req.query;

      const { orders, total } = await orderService.getOrdersByTable(
        restaurantId,
        tableNumber,
        page,
        limit
      );

      return sendPaginatedResponse(res, orders, page, limit, total);
    } catch (error) {
      logger.error(`Get orders by table error: ${error.message}`);
      return sendError(res, error.message, 400);
    }
  }

  // Get order by ID with items
  async getOrderById(req, res) {
    try {
      const { id } = req.params;
      const order = await orderService.getOrderById(id);

      return sendSuccess(res, 'Order fetched successfully', order);
    } catch (error) {
      logger.error(`Get order error: ${error.message}`);
      return sendError(res, error.message, 400);
    }
  }

  // Add item to order
  async addItemToOrder(req, res) {
    try {
      const { orderId } = req.params;
      const { menuItemId, quantity, specialInstructions } = req.body;

      if (!menuItemId || !quantity) {
        return sendError(res, 'Menu item ID and quantity are required', 400);
      }

      const orderItem = await orderService.addItemToOrder(
        orderId,
        menuItemId,
        quantity,
        specialInstructions
      );

      return sendSuccess(
        res,
        'Item added to order successfully',
        orderItem,
        201
      );
    } catch (error) {
      logger.error(`Add item to order error: ${error.message}`);
      return sendError(res, error.message, 400);
    }
  }

  // Update order status
  async updateOrderStatus(req, res) {
    try {
      const { id } = req.params;
      const { status, kitchenBatch, itemIds } = req.body;

      if (!status) {
        return sendError(res, 'Status is required', 400);
      }

      const order = await orderService.updateOrderStatus(id, status, kitchenBatch, itemIds);

      return sendSuccess(
        res,
        'Order status updated successfully',
        order
      );
    } catch (error) {
      logger.error(`Update order status error: ${error.message}`);
      return sendError(res, error.message, 400);
    }
  }

  // Update item quantity in order
  async updateOrderItemQuantity(req, res) {
    try {
      const { orderId, itemId } = req.params;
      const { quantity } = req.body;

      if (quantity === undefined || quantity === null) {
        return sendError(res, 'Quantity is required', 400);
      }

      const orderItem = await orderService.updateOrderItemQuantity(orderId, itemId, quantity);

      return sendSuccess(res, 'Item quantity updated successfully', orderItem);
    } catch (error) {
      logger.error(`Update item quantity error: ${error.message}`);
      return sendError(res, error.message, 400);
    }
  }

  // Remove item from order
  async removeItemFromOrder(req, res) {
    try {
      const { orderId, itemId } = req.params;

      await orderService.removeItemFromOrder(orderId, itemId);

      return sendSuccess(res, 'Item removed from order successfully');
    } catch (error) {
      logger.error(`Remove item from order error: ${error.message}`);
      return sendError(res, error.message, 400);
    }
  }

  // Complete order
  async completeOrder(req, res) {
    try {
      const { id } = req.params;
      const order = await orderService.completeOrder(id);

      return sendSuccess(
        res,
        'Order completed successfully',
        order
      );
    } catch (error) {
      logger.error(`Complete order error: ${error.message}`);
      return sendError(res, error.message, 400);
    }
  }

  async cancelOrder(req, res) {
    try {
      const { id } = req.params;
      const { reason } = req.body;

      const order = await orderService.cancelOrder(id, reason);

      return sendSuccess(
        res,
        'Order cancelled successfully',
        order
      );
    } catch (error) {
      logger.error(`Cancel order error: ${error.message}`);
      return sendError(res, error.message, 400);
    }
  }
}

module.exports = new OrderController();
