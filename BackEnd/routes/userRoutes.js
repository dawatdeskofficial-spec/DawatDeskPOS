const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const authenticate = require('../middlewares/authenticate');
const { authorize } = require('../middlewares/authorize');
const validateRestaurantOwnership = require('../middlewares/validateRestaurantOwnership');
const { validateSignup, handleValidationErrors } = require('../validators/index');

// Create user (MAIN_ADMIN and RESTAURANT_ADMIN)
router.post(
  '/',
  authenticate,
  authorize('MAIN_ADMIN', 'RESTAURANT_ADMIN'),
  validateRestaurantOwnership(),
  validateSignup,
  handleValidationErrors,
  (req, res) => {
    userController.createUser(req, res);
  }
);

// Get all users (MAIN_ADMIN only)
router.get('/', authenticate, authorize('MAIN_ADMIN'), (req, res) => {
  userController.getAllUsers(req, res);
});

// Get users by restaurant
router.get(
  '/restaurant/:restaurantId',
  authenticate,
  authorize('MAIN_ADMIN', 'RESTAURANT_ADMIN'),
  validateRestaurantOwnership(),
  (req, res) => {
    userController.getUsersByRestaurant(req, res);
  }
);

// Get user by ID
router.get('/:id', authenticate, validateRestaurantOwnership('user'), (req, res) => {
  userController.getUserById(req, res);
});

// Update user
router.put('/:id', authenticate, validateRestaurantOwnership('user'), (req, res) => {
  const { id } = req.params;
  const userRole = req.user?.role?.toUpperCase();

  if (req.user.userId !== id && !['MAIN_ADMIN', 'RESTAURANT_ADMIN'].includes(userRole)) {
    return res.status(403).json({
      success: false,
      message: 'You do not have permission to update this user',
    });
  }

  userController.updateUser(req, res);
});

// Deactivate user (MAIN_ADMIN and RESTAURANT_ADMIN)
router.put(
  '/:id/deactivate',
  authenticate,
  authorize('MAIN_ADMIN', 'RESTAURANT_ADMIN'),
  validateRestaurantOwnership('user'),
  (req, res) => {
    userController.deactivateUser(req, res);
  }
);

// Activate user (MAIN_ADMIN and RESTAURANT_ADMIN)
router.put(
  '/:id/activate',
  authenticate,
  authorize('MAIN_ADMIN', 'RESTAURANT_ADMIN'),
  validateRestaurantOwnership('user'),
  (req, res) => {
    userController.activateUser(req, res);
  }
);

// Delete user (MAIN_ADMIN and RESTAURANT_ADMIN)
router.delete(
  '/:id',
  authenticate,
  authorize('MAIN_ADMIN', 'RESTAURANT_ADMIN'),
  validateRestaurantOwnership('user'),
  (req, res) => {
    userController.deleteUser(req, res);
  }
);

module.exports = router;
