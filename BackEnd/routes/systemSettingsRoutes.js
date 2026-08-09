const express = require('express');
const router = express.Router();
const systemSettingsController = require('../controllers/systemSettingsController');
const authenticate = require('../middlewares/authenticate');
const { authorize } = require('../middlewares/authorize');

// Get current system settings (MAIN_ADMIN only)
router.get(
  '/',
  authenticate,
  authorize('MAIN_ADMIN'),
  (req, res) => {
    systemSettingsController.getSettings(req, res);
  }
);

// Update system settings (MAIN_ADMIN only)
router.put(
  '/',
  authenticate,
  authorize('MAIN_ADMIN'),
  (req, res) => {
    systemSettingsController.updateSettings(req, res);
  }
);

// Get system logs (MAIN_ADMIN only)
router.get(
  '/logs',
  authenticate,
  authorize('MAIN_ADMIN'),
  (req, res) => {
    systemSettingsController.getLogs(req, res);
  }
);

module.exports = router;
