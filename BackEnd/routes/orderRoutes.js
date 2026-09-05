const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');
const authenticate = require('../middlewares/authenticate');
const { authorize } = require('../middlewares/authorize');
const validateRestaurantOwnership = require('../middlewares/validateRestaurantOwnership');
const { validateOrder, validateOrderItem, handleValidationErrors } = require('../validators/index');
const { normalizeRole } = require('../utils/constants');

// Create order (WAITER only)
router.post(
  '/',
  authenticate,
  authorize('WAITER', 'CASHIER', 'MAIN_ADMIN', 'RESTAURANT_ADMIN'),
  validateRestaurantOwnership(),
  validateOrder,
  handleValidationErrors,
  (req, res) => {
    orderController.createOrder(req, res);
  }
);

// Get orders by restaurant
router.get('/restaurant/:restaurantId', authenticate, validateRestaurantOwnership(), (req, res) => {
  orderController.getOrdersByRestaurant(req, res);
});

// Get orders by table
router.get('/restaurant/:restaurantId/table/:tableNumber', authenticate, validateRestaurantOwnership(), (req, res) => {
  orderController.getOrdersByTable(req, res);
});

// Get order by ID
router.get('/:id', authenticate, validateRestaurantOwnership('order'), (req, res) => {
  orderController.getOrderById(req, res);
});

// Add item to order (WAITER, CASHIER, ADMIN)
router.post(
  '/:orderId/items',
  authenticate,
  authorize('WAITER', 'CASHIER', 'MAIN_ADMIN', 'RESTAURANT_ADMIN'),
  validateRestaurantOwnership('order'),
  validateOrderItem,
  handleValidationErrors,
  (req, res) => {
    orderController.addItemToOrder(req, res);
  }
);

// Update item quantity in order
router.put(
  '/:orderId/items/:itemId',
  authenticate,
  authorize('WAITER', 'CASHIER', 'MAIN_ADMIN', 'RESTAURANT_ADMIN'),
  validateRestaurantOwnership('order'),
  (req, res) => {
    orderController.updateOrderItemQuantity(req, res);
  }
);

// Batch update order items (WAITER, CASHIER, ADMIN)
router.put(
  '/:orderId/batch-items',
  authenticate,
  authorize('WAITER', 'CASHIER', 'MAIN_ADMIN', 'RESTAURANT_ADMIN'),
  validateRestaurantOwnership('order'),
  (req, res) => {
    orderController.batchUpdateOrderItems(req, res);
  }
);

// Update order status by role.
router.put('/:id/status', authenticate, validateRestaurantOwnership('order'), (req, res) => {
  const userRole = normalizeRole(req.user.role);
  const { status } = req.body;

  // CHEF can prepare kitchen tickets, mark them ready, or mark as served directly
  if (
    userRole === 'CHEF' &&
    !['PREPARING', 'READY', 'SERVED'].includes(status)
  ) {
    return res.status(403).json({
      success: false,
      message: 'Chef can only update to PREPARING, READY, or SERVED status',
    });
  }

  // WAITER serves ready tickets or updates ticket statuses
  if (
    userRole === 'WAITER' &&
    !['PREPARING', 'READY', 'SERVED'].includes(status)
  ) {
    return res.status(403).json({
      success: false,
      message: 'Waiter can only update to PREPARING, READY, or SERVED status',
    });
  }

  // CASHIER can only settle bills.
  if (
    userRole === 'CASHIER' &&
    status !== 'COMPLETED'
  ) {
    return res.status(403).json({
      success: false,
      message: 'Cashier can only update to COMPLETED status',
    });
  }

  orderController.updateOrderStatus(req, res);
});

// Remove item from order
router.delete(
  '/:orderId/items/:itemId',
  authenticate,
  authorize('WAITER', 'CASHIER', 'MAIN_ADMIN', 'RESTAURANT_ADMIN'),
  validateRestaurantOwnership('order'),
  (req, res) => {
    orderController.removeItemFromOrder(req, res);
  }
);

// Complete order
router.put(
  '/:id/complete',
  authenticate,
  authorize('CASHIER', 'MAIN_ADMIN'),
  validateRestaurantOwnership('order'),
  (req, res) => {
    orderController.completeOrder(req, res);
  }
);

// Cancel/void pending order
router.post(
  '/:id/cancel',
  authenticate,
  authorize('WAITER', 'RESTAURANT_ADMIN', 'MAIN_ADMIN'),
  validateRestaurantOwnership('order'),
  (req, res) => {
    orderController.cancelOrder(req, res);
  }
);

module.exports = router;
