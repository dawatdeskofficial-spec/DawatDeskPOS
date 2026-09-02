const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const authenticate = require('../middlewares/authenticate');
const { authorize } = require('../middlewares/authorize');
const validateRestaurantOwnership = require('../middlewares/validateRestaurantOwnership');
const { validatePayment, handleValidationErrors } = require('../validators/index');

// Create payment (CASHIER, RESTAURANT_ADMIN, MAIN_ADMIN, WAITER)
router.post(
  '/',
  authenticate,
  authorize('CASHIER', 'RESTAURANT_ADMIN', 'MAIN_ADMIN', 'WAITER'),
  validateRestaurantOwnership('payment'),
  validatePayment,
  handleValidationErrors,
  (req, res) => {
    paymentController.createPayment(req, res);
  }
);

// Get payments by restaurant
router.get('/restaurant/:restaurantId', authenticate, validateRestaurantOwnership(), (req, res) => {
  paymentController.getPaymentsByRestaurant(req, res);
});

// Get payment by ID
router.get('/:id', authenticate, validateRestaurantOwnership('payment'), (req, res) => {
  paymentController.getPaymentById(req, res);
});

// Update payment status (CASHIER, RESTAURANT_ADMIN, MAIN_ADMIN)
router.put(
  '/:id/status',
  authenticate,
  authorize('CASHIER', 'RESTAURANT_ADMIN', 'MAIN_ADMIN'),
  validateRestaurantOwnership('payment'),
  (req, res) => {
    paymentController.updatePaymentStatus(req, res);
  }
);

// Refund payment
router.post(
  '/:id/refund',
  authenticate,
  authorize('CASHIER', 'RESTAURANT_ADMIN', 'MAIN_ADMIN'),
  validateRestaurantOwnership('payment'),
  (req, res) => {
    paymentController.refundPayment(req, res);
  }
);

// Get daily sales report
router.get(
  '/restaurant/:restaurantId/daily-report',
  authenticate,
  authorize('MAIN_ADMIN', 'RESTAURANT_ADMIN', 'CASHIER'),
  validateRestaurantOwnership(),
  (req, res) => {
    paymentController.getDailySalesReport(req, res);
  }
);

module.exports = router;
