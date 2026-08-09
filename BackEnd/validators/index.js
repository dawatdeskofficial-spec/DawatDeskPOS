const { body, validationResult } = require('express-validator');

const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation errors',
      errors: errors.array(),
    });
  }
  next();
};

const validateLogin = [
  body('email')
    .isEmail()
    .withMessage('Please provide a valid email address'),
  body('password')
    .notEmpty()
    .withMessage('Password is required'),
];

const validateSignup = [
  body('name')
    .notEmpty()
    .withMessage('Name is required')
    .isLength({ min: 3 })
    .withMessage('Name must be at least 3 characters'),
  body('email')
    .isEmail()
    .withMessage('Please provide a valid email address'),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters'),
  body('role')
    .notEmpty()
    .withMessage('Role is required')
    .customSanitizer((value) => (typeof value === 'string' ? value.trim().toUpperCase() : value))
    .isIn(['MAIN_ADMIN', 'RESTAURANT_ADMIN', 'WAITER', 'CHEF', 'CASHIER'])
    .withMessage('Invalid role provided'),
];

const validateRestaurant = [
  body('name')
    .notEmpty()
    .withMessage('Restaurant name is required')
    .isLength({ min: 3 })
    .withMessage('Name must be at least 3 characters'),
  body('location')
    .notEmpty()
    .withMessage('Location is required'),
  body('phone')
    .notEmpty()
    .withMessage('Phone number is required')
    .isMobilePhone()
    .withMessage('Please provide a valid phone number'),
];

const validateMenuItem = [
  body('name')
    .notEmpty()
    .withMessage('Menu item name is required')
    .isLength({ min: 2 })
    .withMessage('Name must be at least 2 characters'),
  body('price')
    .notEmpty()
    .withMessage('Price is required')
    .isFloat({ min: 0 })
    .withMessage('Price must be a positive number'),
  body('category')
    .notEmpty()
    .withMessage('Category is required')
    .isIn(['APPETIZER', 'MAIN_COURSE', 'DESSERT', 'BEVERAGE', 'SIDES'])
    .withMessage('Invalid category'),
  body('fulfillmentOwner')
    .optional()
    .isIn(['KITCHEN', 'WAITER'])
    .withMessage('Invalid fulfillment owner'),
];

const validateOrder = [
  body('tableNumber')
    .notEmpty()
    .withMessage('Table number is required')
    .isInt({ min: 1 })
    .withMessage('Table number must be a positive number'),
];

const validateOrderItem = [
  body('menuItemId')
    .notEmpty()
    .withMessage('Menu item ID is required')
    .isMongoId()
    .withMessage('Invalid menu item ID'),
  body('quantity')
    .notEmpty()
    .withMessage('Quantity is required')
    .isInt({ min: 1 })
    .withMessage('Quantity must be at least 1'),
];

const validatePayment = [
  body('orderId')
    .notEmpty()
    .withMessage('Order ID is required')
    .isMongoId()
    .withMessage('Invalid order ID'),
  body('paymentMethod')
    .notEmpty()
    .withMessage('Payment method is required')
    .isIn(['CASH', 'CARD', 'DIGITAL_WALLET', 'CHEQUE'])
    .withMessage('Invalid payment method'),
];

module.exports = {
  handleValidationErrors,
  validateLogin,
  validateSignup,
  validateRestaurant,
  validateMenuItem,
  validateOrder,
  validateOrderItem,
  validatePayment,
};
