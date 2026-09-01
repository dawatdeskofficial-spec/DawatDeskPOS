const express = require('express');
const router = express.Router();
const waitingQueueController = require('../controllers/waitingQueueController');
const authenticate = require('../middlewares/authenticate');
const { authorize } = require('../middlewares/authorize');
const validateRestaurantOwnership = require('../middlewares/validateRestaurantOwnership');
const { validateWaitingQueue, handleValidationErrors } = require('../validators/index');

// Add customer to waiting queue (CASHIER, WAITER, RESTAURANT_ADMIN, MAIN_ADMIN)
router.post(
  '/',
  authenticate,
  authorize('CASHIER', 'WAITER', 'RESTAURANT_ADMIN', 'MAIN_ADMIN'),
  validateRestaurantOwnership(),
  validateWaitingQueue,
  handleValidationErrors,
  (req, res) => {
    waitingQueueController.addToQueue(req, res);
  }
);

// Get waiting queue by restaurant
router.get(
  '/restaurant/:restaurantId',
  authenticate,
  validateRestaurantOwnership(),
  (req, res) => {
    waitingQueueController.getQueueByRestaurant(req, res);
  }
);

// Update queue entry (status, notes, etc.)
router.put(
  '/:id',
  authenticate,
  authorize('CASHIER', 'WAITER', 'RESTAURANT_ADMIN', 'MAIN_ADMIN'),
  validateRestaurantOwnership('waitingQueue'),
  (req, res) => {
    waitingQueueController.updateQueueEntry(req, res);
  }
);

// Seat customer at a specific table
router.put(
  '/:id/seat',
  authenticate,
  authorize('CASHIER', 'WAITER', 'RESTAURANT_ADMIN', 'MAIN_ADMIN'),
  validateRestaurantOwnership('waitingQueue'),
  (req, res) => {
    waitingQueueController.seatCustomer(req, res);
  }
);

// Delete queue entry
router.delete(
  '/:id',
  authenticate,
  authorize('CASHIER', 'WAITER', 'RESTAURANT_ADMIN', 'MAIN_ADMIN'),
  validateRestaurantOwnership('waitingQueue'),
  (req, res) => {
    waitingQueueController.deleteQueueEntry(req, res);
  }
);

module.exports = router;
