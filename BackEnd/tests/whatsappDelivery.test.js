const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

const { formatAndValidatePhone } = require('../utils/phoneFormatter');
const { encrypt, decrypt, maskSecret } = require('../utils/cryptoUtils');
const whatsappService = require('../services/whatsappService');
const whatsappDeliveryService = require('../services/whatsappDeliveryService');
const whatsappWebhookController = require('../controllers/whatsappWebhookController');
const WhatsAppDelivery = require('../models/WhatsAppDelivery');
const WhatsAppConfig = require('../models/WhatsAppConfig');
const Payment = require('../models/Payment');
const Order = require('../models/Order');
const OrderItem = require('../models/OrderItem');
const Restaurant = require('../models/Restaurant');
const validateRestaurantOwnership = require('../middlewares/validateRestaurantOwnership');

// ── PHONE FORMATTER TESTS ────────────────────────────────────────────────────
test('phoneFormatter: Indian 10-digit number normalizes to 91XXXXXXXXXX', () => {
  const res = formatAndValidatePhone('9825012345');
  assert.equal(res.isValid, true);
  assert.equal(res.normalizedNumber, '919825012345');
  assert.equal(res.formattedDisplay, '+91 98250 12345');
});

test('phoneFormatter: Indian number with +91 and formatting normalizes correctly', () => {
  const res = formatAndValidatePhone('+91-98250-12345');
  assert.equal(res.isValid, true);
  assert.equal(res.normalizedNumber, '919825012345');
});

test('phoneFormatter: Indian number with leading 0 normalizes correctly', () => {
  const res = formatAndValidatePhone('09825012345');
  assert.equal(res.isValid, true);
  assert.equal(res.normalizedNumber, '919825012345');
});

test('phoneFormatter: Valid international E.164 number is preserved as digits', () => {
  const res = formatAndValidatePhone('+1 415 555 2671');
  assert.equal(res.isValid, true);
  assert.equal(res.normalizedNumber, '14155552671');
});

test('phoneFormatter: Rejects dummy repetitive numbers (0000000000)', () => {
  const res = formatAndValidatePhone('0000000000');
  assert.equal(res.isValid, false);
  assert.match(res.error, /dummy/i);
});

test('phoneFormatter: Rejects 10-digit Indian numbers starting with invalid digit (5)', () => {
  const res = formatAndValidatePhone('5123456789');
  assert.equal(res.isValid, false);
  assert.match(res.error, /must start with 6, 7, 8, or 9/i);
});

test('phoneFormatter: Rejects empty or too-short numbers', () => {
  const res1 = formatAndValidatePhone('');
  assert.equal(res1.isValid, false);

  const res2 = formatAndValidatePhone('12345');
  assert.equal(res2.isValid, false);
});

// ── CRYPTO UTILS TESTS ───────────────────────────────────────────────────────
test('cryptoUtils: AES-256-GCM encrypts, decrypts, and masks secret correctly', () => {
  const token = 'EAABtesting_token_secret_meta_12345';
  const cipher = encrypt(token);
  assert.notEqual(cipher, token);
  assert.ok(cipher.includes(':'));

  const decrypted = decrypt(cipher);
  assert.equal(decrypted, token);

  const masked = maskSecret(token);
  assert.equal(masked.startsWith('EAAB'), true);
  assert.equal(masked.endsWith('345'), true);
  assert.ok(masked.includes('••••••••'));
});

// ── WHATSAPP SERVICE TESTS ───────────────────────────────────────────────────
test('whatsappService: generateWaMeLink generates correct URL and pre-filled message', () => {
  const res = whatsappService.generateWaMeLink({
    toPhone: '9825012345',
    customerName: 'Rahul',
    restaurantName: 'Hariom Restaurant',
    receiptNumber: 'BILL-1001',
    orderRef: 'ORD-1234',
    totalAmount: 450,
    paymentMethod: 'CASH',
    pdfUrl: 'http://localhost:5001/api/whatsapp/invoices/BILL-1001/pdf',
  });

  assert.equal(res.normalizedPhone, '919825012345');
  assert.ok(res.waMeUrl.startsWith('https://wa.me/919825012345?text='));
  assert.ok(res.messageText.includes('BILL-1001'));
  assert.ok(res.messageText.includes('450.00'));
});

test('whatsappService: Test Mode simulation succeeds with wamid.MOCK', async () => {
  const res = await whatsappService.sendInvoice({
    restaurantId: null,
    toPhone: '9825012345',
    customerName: 'Guest',
    restaurantName: 'Test Cafe',
    receiptNumber: 'BILL-MOCK-1',
    orderRef: '12345678',
    totalAmount: 250,
    paymentMethod: 'UPI',
  });

  assert.equal(res.success, true);
  assert.equal(res.status, 'ACCEPTED');
  assert.equal(res.isMock, true);
  assert.ok(res.messageId.startsWith('wamid.MOCK'));
});

test('whatsappService: Invalid phone returns failed without making API call', async () => {
  const res = await whatsappService.sendInvoice({
    restaurantId: null,
    toPhone: '0000000000',
    customerName: 'Guest',
    restaurantName: 'Test Cafe',
    receiptNumber: 'BILL-FAIL-1',
    orderRef: '12345678',
    totalAmount: 100,
    paymentMethod: 'CASH',
  });

  assert.equal(res.success, false);
  assert.equal(res.status, 'FAILED');
  assert.equal(res.errorCode, 'INVALID_PHONE_NUMBER');
});

// ── DELIVERY SERVICE TESTS (MOCKED MONGOOSE) ─────────────────────────────────
test('whatsappDeliveryService: Successful payment triggers delivery & records status', async () => {
  const mockPaymentId = new mongoose.Types.ObjectId();
  const mockOrderId = new mongoose.Types.ObjectId();
  const mockRestId = new mongoose.Types.ObjectId();

  const origPaymentFind = Payment.findById;
  const origOrderFind = Order.findById;
  const origOrderItemFind = OrderItem.find;
  const origRestFind = Restaurant.findById;
  const origDeliveryFind = WhatsAppDelivery.findOne;
  const origDeliverySave = WhatsAppDelivery.prototype.save;
  const origConfigFind = WhatsAppConfig.findOne;

  try {
    WhatsAppConfig.findOne = async () => null;
    Payment.findById = async () => ({
      _id: mockPaymentId,
      orderId: mockOrderId,
      restaurantId: mockRestId,
      receiptNumber: 'BILL-TEST-99',
      totalAmount: 500,
      paymentMethod: 'CASH',
      createdBy: null,
    });

    OrderItem.find = async () => [
      { name: 'Special Thali', quantity: 1, price: 500, status: 'DELIVERED' }
    ];

    Order.findById = async () => ({
      _id: mockOrderId,
      customerName: 'Aarav Patel',
      customerPhone: '9825012345',
      restaurantId: mockRestId,
      orderType: 'DINE_IN',
      tableNumber: 2,
    });

    Restaurant.findById = async () => ({
      _id: mockRestId,
      name: 'Test Dining',
      phone: '9825011111',
      gstPercentage: 5,
    });

    WhatsAppDelivery.findOne = async () => null; // No previous delivery
    WhatsAppDelivery.prototype.save = async function () {
      return this;
    };

    const result = await whatsappDeliveryService.triggerBillDelivery({
      paymentId: mockPaymentId,
      customerPhone: '9825012345',
      customerName: 'Aarav Patel',
    });

    assert.ok(result.delivery);
    assert.equal(result.delivery.deliveryStatus, 'ACCEPTED');
    assert.equal(result.delivery.receiptNumber, 'BILL-TEST-99');
    assert.equal(result.delivery.recipientPhone, '919825012345');
    assert.ok(result.waMeFallback);
  } finally {
    Payment.findById = origPaymentFind;
    Order.findById = origOrderFind;
    OrderItem.find = origOrderItemFind;
    Restaurant.findById = origRestFind;
    WhatsAppDelivery.findOne = origDeliveryFind;
    WhatsAppDelivery.prototype.save = origDeliverySave;
    WhatsAppConfig.findOne = origConfigFind;
  }
});

test('whatsappDeliveryService: Prevents duplicate delivery if already DELIVERED', async () => {
  const mockPaymentId = new mongoose.Types.ObjectId();
  const origPaymentFind = Payment.findById;
  const origOrderFind = Order.findById;
  const origRestFind = Restaurant.findById;
  const origDeliveryFind = WhatsAppDelivery.findOne;

  try {
    Payment.findById = async () => ({
      _id: mockPaymentId,
      orderId: new mongoose.Types.ObjectId(),
      restaurantId: new mongoose.Types.ObjectId(),
      receiptNumber: 'BILL-ALREADY-SENT',
      totalAmount: 300,
      paymentMethod: 'CASH',
    });

    Order.findById = async () => ({
      _id: new mongoose.Types.ObjectId(),
      customerName: 'Existing Guest',
      customerPhone: '9825012345',
    });

    Restaurant.findById = async () => ({
      name: 'Dawat Cafe',
    });

    // Existing completed delivery
    WhatsAppDelivery.findOne = async () => ({
      paymentId: mockPaymentId,
      deliveryStatus: 'DELIVERED',
      receiptNumber: 'BILL-ALREADY-SENT',
      recipientPhone: '919825012345',
      customerName: 'Existing Guest',
    });

    const result = await whatsappDeliveryService.triggerBillDelivery({
      paymentId: mockPaymentId,
      forceRetry: false,
    });

    assert.equal(result.delivery.deliveryStatus, 'DELIVERED');
    assert.ok(result.waMeFallback);
  } finally {
    Payment.findById = origPaymentFind;
    Order.findById = origOrderFind;
    Restaurant.findById = origRestFind;
    WhatsAppDelivery.findOne = origDeliveryFind;
  }
});

test('whatsappDeliveryService: Manual wa.me fallback confirmation updates status to SENT', async () => {
  const mockPaymentId = new mongoose.Types.ObjectId();
  const origDeliveryFind = WhatsAppDelivery.findOne;

  try {
    const mockRecord = {
      paymentId: mockPaymentId,
      deliveryStatus: 'FAILED',
      deliveryMethod: 'AUTOMATIC',
      statusHistory: [],
      save: async function () {
        return this;
      },
    };

    WhatsAppDelivery.findOne = async () => mockRecord;

    const updated = await whatsappDeliveryService.confirmManualSend(
      mockPaymentId,
      'Cashier sent manually via wa.me'
    );

    assert.equal(updated.deliveryStatus, 'SENT');
    assert.equal(updated.deliveryMethod, 'MANUAL_WAME');
    assert.ok(updated.manualConfirmedAt);
  } finally {
    WhatsAppDelivery.findOne = origDeliveryFind;
  }
});

// ── WEBHOOK CONTROLLER TESTS ─────────────────────────────────────────────────
test('whatsappWebhookController: Valid verification token returns challenge', () => {
  let status = null;
  let sentBody = null;
  const req = {
    query: {
      'hub.mode': 'subscribe',
      'hub.verify_token': 'dawatdesk_webhook_token',
      'hub.challenge': 'challenge_12345',
    },
  };
  const res = {
    status: (s) => {
      status = s;
      return {
        send: (b) => {
          sentBody = b;
        },
      };
    },
  };

  whatsappWebhookController.verifyWebhook(req, res);
  assert.equal(status, 200);
  assert.equal(sentBody, 'challenge_12345');
});

test('whatsappWebhookController: Invalid verification token returns 403', () => {
  let status = null;
  const req = {
    query: {
      'hub.mode': 'subscribe',
      'hub.verify_token': 'wrong_token',
      'hub.challenge': 'challenge_12345',
    },
  };
  const res = {
    status: (s) => {
      status = s;
      return {
        send: () => {},
      };
    },
  };

  whatsappWebhookController.verifyWebhook(req, res);
  assert.equal(status, 403);
});

test('whatsappWebhookController: Updates delivery status from webhook payload idempotently', async () => {
  const origDeliveryFind = WhatsAppDelivery.findOne;

  try {
    let savedStatus = null;
    const mockRecord = {
      providerMessageId: 'wamid.HBgL12345',
      deliveryStatus: 'ACCEPTED',
      statusHistory: [],
      save: async function () {
        savedStatus = this.deliveryStatus;
        return this;
      },
    };

    WhatsAppDelivery.findOne = async () => mockRecord;

    await whatsappWebhookController.processStatusUpdate({
      id: 'wamid.HBgL12345',
      status: 'delivered',
      timestamp: String(Math.floor(Date.now() / 1000)),
    });

    assert.equal(savedStatus, 'DELIVERED');
    assert.equal(mockRecord.deliveryStatus, 'DELIVERED');

    // Test that higher status READ is not regressed if duplicate 'sent' webhook arrives later
    mockRecord.deliveryStatus = 'READ';
    await whatsappWebhookController.processStatusUpdate({
      id: 'wamid.HBgL12345',
      status: 'sent',
      timestamp: String(Math.floor(Date.now() / 1000)),
    });

    // Remains READ
    assert.equal(mockRecord.deliveryStatus, 'READ');
  } finally {
    WhatsAppDelivery.findOne = origDeliveryFind;
  }
});

// ── MULTI-TENANT ISOLATION TESTS ─────────────────────────────────────────────
test('validateRestaurantOwnership: Cashier from Restaurant A cannot access Restaurant B', async () => {
  const restA = new mongoose.Types.ObjectId().toString();
  const restB = new mongoose.Types.ObjectId().toString();

  const req = {
    user: {
      userId: 'user-cashier-1',
      role: 'CASHIER',
      restaurantId: restA,
    },
    params: {
      restaurantId: restB,
    },
  };

  let errorSent = null;
  let nextCalled = false;
  const res = {
    status: (s) => ({
      json: (data) => {
        errorSent = { status: s, data };
      },
    }),
  };
  const next = () => {
    nextCalled = true;
  };

  const middleware = validateRestaurantOwnership('restaurant');
  await middleware(req, res, next);

  assert.equal(nextCalled, false);
  assert.equal(errorSent.status, 403);
  assert.match(errorSent.data.message, /do not have access/i);
});
