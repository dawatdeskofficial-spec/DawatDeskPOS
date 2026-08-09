const express = require('express');
const router = express.Router();
const restaurantController = require('../controllers/restaurantController');
const authenticate = require('../middlewares/authenticate');
const { authorize } = require('../middlewares/authorize');
const validateRestaurantOwnership = require('../middlewares/validateRestaurantOwnership');
const { validateRestaurant, handleValidationErrors } = require('../validators/index');

// Create restaurant (MAIN_ADMIN only)
router.post(
  '/',
  authenticate,
  authorize('MAIN_ADMIN'),
  validateRestaurant,
  handleValidationErrors,
  (req, res) => {
    restaurantController.createRestaurant(req, res);
  }
);

// Get all restaurants (MAIN_ADMIN only)
router.get('/', authenticate, authorize('MAIN_ADMIN'), (req, res) => {
  restaurantController.getAllRestaurants(req, res);
});

// Get restaurant by ID
router.get('/:id', authenticate, validateRestaurantOwnership('restaurant'), (req, res) => {
  restaurantController.getRestaurantById(req, res);
});

// Update restaurant (MAIN_ADMIN and RESTAURANT_ADMIN)
router.put(
  '/:id',
  authenticate,
  authorize('MAIN_ADMIN', 'RESTAURANT_ADMIN'),
  validateRestaurantOwnership('restaurant'),
  (req, res) => {
    restaurantController.updateRestaurant(req, res);
  }
);

// Delete restaurant (MAIN_ADMIN only)
router.delete(
  '/:id',
  authenticate,
  authorize('MAIN_ADMIN'),
  (req, res) => {
    restaurantController.deleteRestaurant(req, res);
  }
);

module.exports = router;
