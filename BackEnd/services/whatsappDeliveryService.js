const WhatsAppDelivery = require('../models/WhatsAppDelivery');
const Payment = require('../models/Payment');
const Order = require('../models/Order');
const OrderItem = require('../models/OrderItem');
const Restaurant = require('../models/Restaurant');
const User = require('../models/User');
const whatsappService = require('./whatsappService');
const pdfInvoiceService = require('./pdfInvoiceService');
const { formatAndValidatePhone } = require('../utils/phoneFormatter');
const logger = require('../utils/logger');

class WhatsAppDeliveryService {
  /**
   * Triggers automatic WhatsApp delivery for a completed payment.
   * Safe, non-blocking to payment, idempotent.
   *
   * @param {Object} params
   * @param {string} params.paymentId
   * @param {string} [params.customerPhone] - Optional override from cashier
   * @param {string} [params.customerName] - Optional override from cashier
   * @param {boolean} [params.forceRetry=false]
   * @param {boolean} [params.isOfflineSync=false]
   * @returns {Promise<{
   *   delivery: Object,
   *   waMeFallback: Object
   * }>}
   */
  async triggerBillDelivery({
    paymentId,
    customerPhone = null,
    customerName = null,
    forceRetry = false,
    isOfflineSync = false,
    clientBaseUrl = null,
  }) {
    try {
      const payment = await Payment.findById(paymentId);
      if (!payment) {
        throw new Error(`Payment not found for ID: ${paymentId}`);
      }

      const [order, restaurant] = await Promise.all([
        Order.findById(payment.orderId),
        Restaurant.findById(payment.restaurantId),
      ]);

      if (!order) {
        throw new Error(`Order not found for Payment: ${paymentId}`);
      }

      // 1. Idempotency Check
      let delivery = await WhatsAppDelivery.findOne({ paymentId });

      if (delivery && !forceRetry) {
        // If already delivered, read, or accepted, do not duplicate
        if (['DELIVERED', 'READ', 'ACCEPTED'].includes(delivery.deliveryStatus)) {
          logger.info(`WhatsApp delivery already successful for Payment: ${paymentId}`);
          const waMeFallback = whatsappService.generateWaMeLink({
            toPhone: delivery.recipientPhone,
            customerName: delivery.customerName,
            restaurantName: restaurant?.name,
            receiptNumber: payment.receiptNumber,
            orderRef: String(order._id).slice(-8),
            totalAmount: payment.totalAmount,
            paymentMethod: payment.paymentMethod,
            pdfUrl: delivery.pdfUrl,
            date: payment.createdAt,
          });
          return { delivery, waMeFallback };
        }

        // If currently processing, prevent concurrent spam
        if (delivery.deliveryStatus === 'PROCESSING') {
          logger.info(`WhatsApp delivery currently processing for Payment: ${paymentId}`);
          const waMeFallback = whatsappService.generateWaMeLink({
            toPhone: delivery.recipientPhone,
            customerName: delivery.customerName,
            restaurantName: restaurant?.name,
            receiptNumber: payment.receiptNumber,
            orderRef: String(order._id).slice(-8),
            totalAmount: payment.totalAmount,
            paymentMethod: payment.paymentMethod,
            pdfUrl: delivery.pdfUrl,
            date: payment.createdAt,
          });
          return { delivery, waMeFallback };
        }
      }

      // Determine final recipient phone and customer name
      const rawPhone = customerPhone || order.customerPhone || '';
      const finalCustomerName = customerName || order.customerName || 'Valued Guest';

      // Update Order if cashier updated phone or name during billing
      if (customerPhone && customerPhone !== order.customerPhone) {
        await Order.findByIdAndUpdate(order._id, {
          customerPhone: customerPhone.trim(),
          ...(customerName ? { customerName: customerName.trim() } : {}),
        });
      }

      // 2. Validate Phone
      const phoneValidation = formatAndValidatePhone(rawPhone);

      // Resolve base URL: Priority 1: process.env.APP_URL, Priority 2: VERCEL_URL, Priority 3: clientBaseUrl, Priority 4: localhost
      const vercelHost = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null;
      const clientHost = clientBaseUrl && !clientBaseUrl.includes('localhost') && !clientBaseUrl.includes('127.0.0.1') ? clientBaseUrl : null;
      const baseUrl = process.env.APP_URL || vercelHost || clientHost || (process.env.API_BASE_URL && !process.env.API_BASE_URL.includes('localhost') ? process.env.API_BASE_URL : 'https://dawatdesk-backend.vercel.app');
      const pdfUrl = `${baseUrl.replace(/\/$/, '')}/api/whatsapp/invoices/${encodeURIComponent(payment.receiptNumber)}/pdf`;

      if (!delivery) {
        delivery = new WhatsAppDelivery({
          restaurantId: payment.restaurantId,
          orderId: order._id,
          paymentId: payment._id,
          receiptNumber: payment.receiptNumber,
          customerName: finalCustomerName,
          recipientPhone: phoneValidation.isValid ? phoneValidation.normalizedNumber : rawPhone,
          formattedPhone: phoneValidation.isValid ? phoneValidation.formattedDisplay : rawPhone,
          deliveryStatus: 'PROCESSING',
          deliveryMethod: 'AUTOMATIC',
          pdfUrl,
          offlinePending: isOfflineSync,
          statusHistory: [
            {
              status: 'PROCESSING',
              timestamp: new Date(),
              details: isOfflineSync ? 'Delivery initiated after offline sync' : 'Delivery job started',
            },
          ],
        });
        await delivery.save();
      } else {
        delivery.deliveryStatus = 'PROCESSING';
        delivery.customerName = finalCustomerName;
        delivery.recipientPhone = phoneValidation.isValid ? phoneValidation.normalizedNumber : rawPhone;
        delivery.formattedPhone = phoneValidation.isValid ? phoneValidation.formattedDisplay : rawPhone;
        delivery.pdfUrl = pdfUrl;
        delivery.retryCount += 1;
        delivery.statusHistory.push({
          status: 'PROCESSING',
          timestamp: new Date(),
          details: `Retry #${delivery.retryCount} initiated`,
        });
        await delivery.save();
      }

      // Generate wa.me fallback object right away
      const waMeFallback = whatsappService.generateWaMeLink({
        toPhone: rawPhone,
        customerName: finalCustomerName,
        restaurantName: restaurant?.name,
        receiptNumber: payment.receiptNumber,
        orderRef: String(order._id).slice(-8),
        totalAmount: payment.totalAmount,
        paymentMethod: payment.paymentMethod,
        pdfUrl,
      });

      if (!phoneValidation.isValid) {
        delivery.deliveryStatus = 'FAILED';
        delivery.errorCode = 'INVALID_PHONE_NUMBER';
        delivery.errorMessage = phoneValidation.error || 'Invalid phone number';
        delivery.failedAt = new Date();
        delivery.statusHistory.push({
          status: 'FAILED',
          timestamp: new Date(),
          details: `Phone validation failed: ${phoneValidation.error}`,
        });
        await delivery.save();
        return { delivery, waMeFallback };
      }

      // 3. Generate PDF Invoice
      const orderItems = await OrderItem.find({
        orderId: order._id,
        status: { $ne: 'CANCELLED' },
      });

      let pdfBuffer = null;
      let fileName = `Invoice_${payment.receiptNumber}.pdf`;

      try {
        const cashier = payment.createdBy ? await User.findById(payment.createdBy).select('name') : null;
        const pdfResult = await pdfInvoiceService.generateInvoicePdf({
          payment,
          order,
          orderItems,
          restaurant,
          cashier,
        });
        pdfBuffer = pdfResult.buffer;
        fileName = pdfResult.fileName;
        delivery.pdfPath = pdfResult.filePath;
      } catch (pdfErr) {
        logger.error(`PDF invoice generation failed: ${pdfErr.message}`);
        // Continue even if local PDF generation failed, wa.me fallback link will still exist
      }

      // 4. Send via WhatsApp Cloud API
      const sendResult = await whatsappService.sendInvoice({
        restaurantId: payment.restaurantId,
        toPhone: phoneValidation.normalizedNumber,
        customerName: finalCustomerName,
        restaurantName: restaurant?.name,
        receiptNumber: payment.receiptNumber,
        orderRef: String(order._id).slice(-8),
        totalAmount: payment.totalAmount,
        paymentMethod: payment.paymentMethod,
        pdfBuffer,
        pdfUrl,
        fileName,
      });

      if (sendResult.success) {
        delivery.deliveryStatus = 'ACCEPTED';
        delivery.providerMessageId = sendResult.messageId;
        delivery.sentAt = new Date();
        delivery.errorCode = null;
        delivery.errorMessage = null;
        delivery.statusHistory.push({
          status: 'ACCEPTED',
          timestamp: new Date(),
          details: sendResult.isMock
            ? 'Test Mode: Simulated WhatsApp message acceptance'
            : 'Meta WhatsApp Cloud API accepted message',
        });
      } else {
        delivery.deliveryStatus = 'FAILED';
        delivery.errorCode = sendResult.errorCode || 'DELIVERY_ERROR';
        delivery.errorMessage = sendResult.error || 'Failed to send WhatsApp message';
        delivery.failedAt = new Date();
        delivery.statusHistory.push({
          status: 'FAILED',
          timestamp: new Date(),
          details: sendResult.error,
        });
      }

      await delivery.save();
      return { delivery, waMeFallback };
    } catch (err) {
      logger.error(`Error in triggerBillDelivery for Payment ${paymentId}: ${err.message}`);
      // Return safe error structure
      const fallbackDelivery = await WhatsAppDelivery.findOne({ paymentId });
      if (fallbackDelivery) {
        fallbackDelivery.deliveryStatus = 'FAILED';
        fallbackDelivery.errorMessage = err.message;
        fallbackDelivery.failedAt = new Date();
        await fallbackDelivery.save();
      }
      return {
        delivery: fallbackDelivery,
        error: err.message,
      };
    }
  }

  /**
   * Manually confirm that a bill was sent via wa.me fallback.
   * @param {string} paymentId
   * @param {string} [notes='']
   * @returns {Promise<Object>}
   */
  async confirmManualSend(paymentId, notes = '') {
    const delivery = await WhatsAppDelivery.findOne({ paymentId });
    if (!delivery) {
      throw new Error('Delivery record not found');
    }

    delivery.deliveryMethod = 'MANUAL_WAME';
    delivery.deliveryStatus = 'SENT';
    delivery.manualConfirmedAt = new Date();
    delivery.statusHistory.push({
      status: 'SENT',
      timestamp: new Date(),
      details: notes || 'Cashier manually confirmed message delivery via WhatsApp Web/App (wa.me)',
    });

    await delivery.save();
    return delivery;
  }

  /**
   * Retrieves delivery record and wa.me fallback link for a payment.
   * @param {string} paymentId
   * @returns {Promise<{ delivery: Object, waMeFallback: Object }>}
   */
  async getDeliveryStatus(paymentId) {
    const delivery = await WhatsAppDelivery.findOne({ paymentId });
    if (!delivery) {
      return { delivery: null, waMeFallback: null };
    }

    const [payment, restaurant] = await Promise.all([
      Payment.findById(paymentId),
      Restaurant.findById(delivery.restaurantId),
    ]);

    const waMeFallback = whatsappService.generateWaMeLink({
      toPhone: delivery.recipientPhone,
      customerName: delivery.customerName,
      restaurantName: restaurant?.name,
      receiptNumber: delivery.receiptNumber,
      orderRef: String(delivery.orderId).slice(-8),
      totalAmount: payment?.totalAmount || 0,
      paymentMethod: payment?.paymentMethod || 'CASH',
      pdfUrl: delivery.pdfUrl,
    });

    return { delivery, waMeFallback };
  }
}

module.exports = new WhatsAppDeliveryService();
