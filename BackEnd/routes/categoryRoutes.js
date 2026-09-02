const express = require('express');
const router = express.Router();
const categoryController = require('../controllers/categoryController');
const authenticate = require('../middlewares/authenticate');
const { authorize } = require('../middlewares/authorize');
const validateRestaurantOwnership = require('../middlewares/validateRestaurantOwnership');
const { validateCategory, handleValidationErrors } = require('../validators/index');

// Public routes for customers/self-ordering
router.get('/public/restaurant/:restaurantId', (req, res) => {
  req.isPublicCategoryRequest = true;
  categoryController.getCategoriesByRestaurant(req, res);
});

// Authenticated restaurant-scoped routes
router.get('/restaurant/:restaurantId', authenticate, validateRestaurantOwnership('restaurant'), (req, res) => {
  categoryController.getCategoriesByRestaurant(req, res);
});

router.post(
  '/',
  authenticate,
  authorize('MAIN_ADMIN', 'RESTAURANT_ADMIN'),
  validateRestaurantOwnership(),
  validateCategory,
  handleValidationErrors,
  (req, res) => {
    categoryController.createCategory(req, res);
  }
);

router.put(
  '/restaurant/:restaurantId/reorder',
  authenticate,
  authorize('MAIN_ADMIN', 'RESTAURANT_ADMIN'),
  validateRestaurantOwnership(),
  (req, res) => {
    categoryController.reorderCategories(req, res);
  }
);

router.put(
  '/:id',
  authenticate,
  authorize('MAIN_ADMIN', 'RESTAURANT_ADMIN'),
  validateRestaurantOwnership('category'),
  (req, res) => {
    categoryController.updateCategory(req, res);
  }
);

router.delete(
  '/:id',
  authenticate,
  authorize('MAIN_ADMIN', 'RESTAURANT_ADMIN'),
  validateRestaurantOwnership('category'),
  (req, res) => {
    categoryController.deleteCategory(req, res);
  }
);

module.exports = router;
