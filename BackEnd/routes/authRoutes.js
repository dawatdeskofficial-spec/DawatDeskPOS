const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { validateLogin, validateSignup, handleValidationErrors } = require('../validators/index');
const authenticate = require('../middlewares/authenticate');

// Login route
router.post('/login', validateLogin, handleValidationErrors, (req, res) => {
  authController.login(req, res);
});

// Signup route
router.post('/signup', validateSignup, handleValidationErrors, (req, res) => {
  authController.signup(req, res);
});

// Get current user (protected route)
router.get('/me', authenticate, (req, res) => {
  authController.getCurrentUser(req, res);
});

module.exports = router;
