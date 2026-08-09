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
  authorize('WAITER', 'MAIN_ADMIN', 'RESTAURANT_ADMIN'),
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

// Add item to order (WAITER only)
router.post(
  '/:orderId/items',
  authenticate,
  authorize('WAITER', 'MAIN_ADMIN', 'RESTAURANT_ADMIN'),
  validateRestaurantOwnership('order'),
  validateOrderItem,
  handleValidationErrors,
  (req, res) => {
    orderController.addItemToOrder(req, res);
  }
);

// Update order status by role.
router.put('/:id/status', authenticate, validateRestaurantOwnership('order'), (req, res) => {
  const userRole = normalizeRole(req.user.role);
  const { status } = req.body;

  // CHEF can only prepare kitchen tickets and mark them ready.
  if (
    userRole === 'CHEF' &&
    !['PREPARING', 'READY'].includes(status)
  ) {
    return res.status(403).json({
      success: false,
      message: 'Chef can only update to PREPARING or READY status',
    });
  }

  // WAITER serves ready kitchen tickets to the customer.
  if (
    userRole === 'WAITER' &&
    status !== 'SERVED'
  ) {
    return res.status(403).json({
      success: false,
      message: 'Waiter can only update ready items to SERVED status',
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
  authorize('WAITER', 'MAIN_ADMIN', 'RESTAURANT_ADMIN'),
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
