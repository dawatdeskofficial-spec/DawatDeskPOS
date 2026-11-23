const express = require('express');
const router = express.Router();
const whatsappController = require('../controllers/whatsappController');
const whatsappWebhookController = require('../controllers/whatsappWebhookController');
const authenticate = require('../middlewares/authenticate');
const { authorize } = require('../middlewares/authorize');
const validateRestaurantOwnership = require('../middlewares/validateRestaurantOwnership');

// ── Webhook Endpoints (Called by Meta) ──────────────────────────────────────
router.get('/webhook', (req, res) => whatsappWebhookController.verifyWebhook(req, res));
router.post('/webhook', (req, res) => whatsappWebhookController.handleWebhook(req, res));

// ── Public PDF Invoice Download Endpoint ────────────────────────────────────
router.get('/invoices/:receiptNumber/pdf', (req, res) => whatsappController.serveInvoicePdf(req, res));

// ── Cashier & Delivery Actions ──────────────────────────────────────────────
router.post(
  '/send-bill',
  authenticate,
  authorize('CASHIER', 'RESTAURANT_ADMIN', 'MAIN_ADMIN', 'WAITER'),
  validateRestaurantOwnership('payment'),
  (req, res) => whatsappController.sendBill(req, res)
);

router.get(
  '/delivery-status/:paymentId',
  authenticate,
  authorize('CASHIER', 'RESTAURANT_ADMIN', 'MAIN_ADMIN', 'WAITER'),
  validateRestaurantOwnership('payment'),
  (req, res) => whatsappController.getDeliveryStatus(req, res)
);

router.post(
  '/confirm-manual',
  authenticate,
  authorize('CASHIER', 'RESTAURANT_ADMIN', 'MAIN_ADMIN', 'WAITER'),
  validateRestaurantOwnership('payment'),
  (req, res) => whatsappController.confirmManualSend(req, res)
);

// ── Restaurant WhatsApp Configuration ───────────────────────────────────────
router.get(
  '/config/:restaurantId',
  authenticate,
  authorize('RESTAURANT_ADMIN', 'MAIN_ADMIN'),
  validateRestaurantOwnership('restaurant'),
  (req, res) => whatsappController.getRestaurantConfig(req, res)
);

router.put(
  '/config/:restaurantId',
  authenticate,
  authorize('RESTAURANT_ADMIN', 'MAIN_ADMIN'),
  validateRestaurantOwnership('restaurant'),
  (req, res) => whatsappController.updateRestaurantConfig(req, res)
);

router.post(
  '/config/:restaurantId/test',
  authenticate,
  authorize('RESTAURANT_ADMIN', 'MAIN_ADMIN'),
  validateRestaurantOwnership('restaurant'),
  (req, res) => whatsappController.testConnection(req, res)
);

module.exports = router;
