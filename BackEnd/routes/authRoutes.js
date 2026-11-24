const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { validateLogin, validateSignup, handleValidationErrors } = require('../validators/index');
const authenticate = require('../middlewares/authenticate');
const { authLimiter, otpSendLimiter, otpVerifyLimiter } = require('../middlewares/rateLimiter');

// Login route with brute-force rate limiter
router.post('/login', authLimiter, validateLogin, handleValidationErrors, (req, res) => {
  authController.login(req, res);
});

// Signup route
router.post('/signup', authLimiter, validateSignup, handleValidationErrors, (req, res) => {
  authController.signup(req, res);
});

// Get current user (protected route)
router.get('/me', authenticate, (req, res) => {
  authController.getCurrentUser(req, res);
});

// OTP routes with rate limiters
router.post('/send-otp', otpSendLimiter, (req, res) => {
  authController.sendOtp(req, res);
});

router.post('/verify-otp', otpVerifyLimiter, (req, res) => {
  authController.verifyOtp(req, res);
});

router.post('/login-otp', otpVerifyLimiter, (req, res) => {
  authController.loginWithOtp(req, res);
});

// Forgot password route: generates one-time temporary password valid for 10 minutes
router.post('/forgot-password', authLimiter, (req, res) => {
  authController.forgotPassword(req, res);
});

// Reset password route: user logs in with temporary password, then submits new permanent password
router.post('/reset-password-temp', authLimiter, (req, res) => {
  authController.resetPassword(req, res);
});

module.exports = router;
