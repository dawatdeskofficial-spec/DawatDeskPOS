const fs = require('fs');
const path = require('path');
const whatsappDeliveryService = require('../services/whatsappDeliveryService');
const whatsappService = require('../services/whatsappService');
const pdfInvoiceService = require('../services/pdfInvoiceService');
const WhatsAppConfig = require('../models/WhatsAppConfig');
const Payment = require('../models/Payment');
const Order = require('../models/Order');
const OrderItem = require('../models/OrderItem');
const Restaurant = require('../models/Restaurant');
const User = require('../models/User');
const { maskSecret } = require('../utils/cryptoUtils');
const { sendSuccess, sendError } = require('../utils/responseHandler');
const logger = require('../utils/logger');

const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.LAMBDA_TASK_ROOT);
const INVOICE_DIR = isServerless ? path.join('/tmp', 'invoices') : path.join(__dirname, '../public/invoices');

class WhatsAppController {
  /**
   * Cashier trigger or retry sending a bill.
   */
  async sendBill(req, res) {
    try {
      const { paymentId, customerPhone, customerName, forceRetry, clientBaseUrl } = req.body;

      if (!paymentId) {
        return sendError(res, 'Payment ID is required', 400);
      }

      const detectedBaseUrl = clientBaseUrl || req.get('origin') || (req.get('host') ? `${req.protocol}://${req.get('host')}` : null);

      const result = await whatsappDeliveryService.triggerBillDelivery({
        paymentId,
        customerPhone,
        customerName,
        forceRetry: Boolean(forceRetry),
        clientBaseUrl: detectedBaseUrl,
      });

      return sendSuccess(res, 'WhatsApp delivery processed', result);
    } catch (err) {
      logger.error(`sendBill error: ${err.message}`);
      return sendError(res, err.message, 400);
    }
  }

  /**
   * Get delivery status for a payment.
   */
  async getDeliveryStatus(req, res) {
    try {
      const { paymentId } = req.params;
      if (!paymentId) {
        return sendError(res, 'Payment ID is required', 400);
      }

      const result = await whatsappDeliveryService.getDeliveryStatus(paymentId);
      return sendSuccess(res, 'Delivery status fetched', result);
    } catch (err) {
      logger.error(`getDeliveryStatus error: ${err.message}`);
      return sendError(res, err.message, 400);
    }
  }

  /**
   * Cashier confirms manual send via wa.me fallback.
   */
  async confirmManualSend(req, res) {
    try {
      const { paymentId, notes } = req.body;
      if (!paymentId) {
        return sendError(res, 'Payment ID is required', 400);
      }

      const delivery = await whatsappDeliveryService.confirmManualSend(paymentId, notes);
      return sendSuccess(res, 'Manual WhatsApp delivery confirmed', delivery);
    } catch (err) {
      logger.error(`confirmManualSend error: ${err.message}`);
      return sendError(res, err.message, 400);
    }
  }

  /**
   * Get restaurant WhatsApp configuration.
   */
  async getRestaurantConfig(req, res) {
    try {
      const { restaurantId } = req.params;
      let config = await WhatsAppConfig.findOne({ restaurantId });

      if (!config) {
        // Return default structure
        return sendSuccess(res, 'WhatsApp configuration fetched', {
          restaurantId,
          isEnabled: true,
          phoneNumberId: '',
          businessAccountId: '',
          accessToken: '',
          isAccessTokenConfigured: false,
          templateName: 'dawatdesk_invoice_v1',
          templateLanguage: 'en',
          autoSendDefault: true,
          status: 'ACTIVE',
        });
      }

      const plain = config.toObject();
      const hasToken = Boolean(plain.accessToken && plain.accessToken.trim());
      plain.isAccessTokenConfigured = hasToken;
      plain.accessToken = hasToken ? maskSecret(plain.accessToken) : '';

      return sendSuccess(res, 'WhatsApp configuration fetched', plain);
    } catch (err) {
      logger.error(`getRestaurantConfig error: ${err.message}`);
      return sendError(res, err.message, 400);
    }
  }

  /**
   * Update restaurant WhatsApp configuration.
   */
  async updateRestaurantConfig(req, res) {
    try {
      const { restaurantId } = req.params;
      const {
        isEnabled,
        phoneNumberId,
        businessAccountId,
        accessToken,
        templateName,
        templateLanguage,
        autoSendDefault,
        status,
      } = req.body;

      let config = await WhatsAppConfig.findOne({ restaurantId });
      if (!config) {
        config = new WhatsAppConfig({ restaurantId });
      }

      if (isEnabled !== undefined) config.isEnabled = isEnabled;
      if (phoneNumberId !== undefined) config.phoneNumberId = phoneNumberId.trim();
      if (businessAccountId !== undefined) config.businessAccountId = businessAccountId.trim();
      if (templateName !== undefined) config.templateName = templateName.trim();
      if (templateLanguage !== undefined) config.templateLanguage = templateLanguage.trim();
      if (autoSendDefault !== undefined) config.autoSendDefault = autoSendDefault;
      if (status !== undefined) config.status = status;

      // Only update token if a new, non-masked string was supplied
      if (accessToken && !accessToken.includes('••••••••')) {
        config.accessToken = accessToken.trim();
      }

      config.updatedBy = req.user?.id || req.user?._id;
      await config.save();

      const plain = config.toObject();
      plain.isAccessTokenConfigured = Boolean(config.accessToken);
      plain.accessToken = config.accessToken ? maskSecret(config.accessToken) : '';

      return sendSuccess(res, 'WhatsApp configuration updated successfully', plain);
    } catch (err) {
      logger.error(`updateRestaurantConfig error: ${err.message}`);
      return sendError(res, err.message, 400);
    }
  }

  /**
   * Test WhatsApp configuration connection.
   */
  async testConnection(req, res) {
    try {
      const { restaurantId } = req.params;
      const creds = await whatsappService.resolveCredentials(restaurantId);

      return sendSuccess(res, 'WhatsApp connection test result', {
        isConfigured: creds.isConfigured,
        isTestMode: creds.isTestMode,
        phoneNumberId: creds.phoneNumberId,
        templateName: creds.templateName,
        source: creds.source,
        message: creds.isConfigured
          ? 'Configuration is valid and active'
          : 'WhatsApp API credentials not fully configured. Test mode is active.',
      });
    } catch (err) {
      logger.error(`testConnection error: ${err.message}`);
      return sendError(res, err.message, 400);
    }
  }

  /**
   * Securely serves or streams the PDF invoice.
   */
  async serveInvoicePdf(req, res) {
    try {
      const { receiptNumber } = req.params;
      if (!receiptNumber) {
        return sendError(res, 'Receipt number is required', 400);
      }

      const payment = await Payment.findOne({ receiptNumber });
      if (!payment) {
        return sendError(res, 'Invoice not found', 404);
      }

      const filePath = path.join(INVOICE_DIR, `${receiptNumber}.pdf`);

      if (fs.existsSync(filePath)) {
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="Invoice_${receiptNumber}.pdf"`);
        return fs.createReadStream(filePath).pipe(res);
      }

      // Generate on the fly if file not cached
      const [order, restaurant] = await Promise.all([
        Order.findById(payment.orderId),
        Restaurant.findById(payment.restaurantId),
      ]);

      const orderItems = await OrderItem.find({
        orderId: payment.orderId,
        status: { $ne: 'CANCELLED' },
      });

      const cashier = payment.createdBy ? await User.findById(payment.createdBy).select('name') : null;

      const pdfResult = await pdfInvoiceService.generateInvoicePdf({
        payment,
        order,
        orderItems,
        restaurant,
        cashier,
      });

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="${pdfResult.fileName}"`);
      return res.send(pdfResult.buffer);
    } catch (err) {
      logger.error(`serveInvoicePdf error: ${err.message}`);
      return sendError(res, err.message, 500);
    }
  }
}

module.exports = new WhatsAppController();
