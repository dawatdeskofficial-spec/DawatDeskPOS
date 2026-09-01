const express = require('express');
const router = express.Router();
const menuController = require('../controllers/menuController');
const authenticate = require('../middlewares/authenticate');
const { authorize } = require('../middlewares/authorize');
const validateRestaurantOwnership = require('../middlewares/validateRestaurantOwnership');
const { validateMenuItem, handleValidationErrors } = require('../validators/index');

// Create menu item (RESTAURANT_ADMIN only)
router.post(
  '/',
  authenticate,
  authorize('MAIN_ADMIN', 'RESTAURANT_ADMIN'),
  validateRestaurantOwnership(),
  validateMenuItem,
  handleValidationErrors,
  (req, res) => {
    menuController.createMenuItem(req, res);
  }
);

// Public menu for customer ordering
router.get('/public/restaurant/:restaurantId', (req, res) => {
  req.isPublicMenuRequest = true;
  menuController.getMenuItems(req, res);
});

// Get menu items by restaurant
router.get('/restaurant/:restaurantId', authenticate, validateRestaurantOwnership(), (req, res) => {
  menuController.getMenuItems(req, res);
});

// Get menu by category
router.get('/restaurant/:restaurantId/category/:category', authenticate, validateRestaurantOwnership(), (req, res) => {
  menuController.getMenuByCategory(req, res);
});

// Get menu item by ID
router.get('/:id', authenticate, validateRestaurantOwnership('menu'), (req, res) => {
  menuController.getMenuItemById(req, res);
});

// Update menu item (MAIN_ADMIN, RESTAURANT_ADMIN, and CHEF for 86'ing / availability)
router.put(
  '/:id',
  authenticate,
  authorize('MAIN_ADMIN', 'RESTAURANT_ADMIN', 'CHEF'),
  validateRestaurantOwnership('menu'),
  (req, res) => {
    menuController.updateMenuItem(req, res);
  }
);

// Delete menu item
router.delete(
  '/:id',
  authenticate,
  authorize('MAIN_ADMIN', 'RESTAURANT_ADMIN'),
  validateRestaurantOwnership('menu'),
  (req, res) => {
    menuController.deleteMenuItem(req, res);
  }
);

module.exports = router;
