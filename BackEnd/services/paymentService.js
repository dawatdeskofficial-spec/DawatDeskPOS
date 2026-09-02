const Payment = require('../models/Payment');
const Order = require('../models/Order');
const OrderItem = require('../models/OrderItem');
const WaitingQueue = require('../models/WaitingQueue');
const SystemSettings = require('../models/SystemSettings');
const Restaurant = require('../models/Restaurant');
const logger = require('../utils/logger');
const { ORDER_STATUS } = require('../utils/constants');

const roundMoney = (value) => Math.round((Number(value) || 0) * 100) / 100;

class PaymentService {
  async buildReceiptNumber(restaurantId) {
    const now = new Date();
    const stamp = now.toISOString().slice(0, 10).replace(/-/g, '');
    const count = await Payment.countDocuments({ restaurantId });
    const suffix = Math.floor(1000 + Math.random() * 9000);
    return `BILL-${stamp}-${String(count + 1).padStart(4, '0')}-${suffix}`;
  }

  // Create payment
  async createPayment(paymentData) {
    try {
      const existingPayment = await Payment.findOne({
        orderId: paymentData.orderId,
        status: 'COMPLETED',
      });
      if (existingPayment) {
        throw new Error('Payment has already been completed for this order');
      }

      const order = await Order.findById(paymentData.orderId);
      if (!order) {
        throw new Error('Order not found');
      }

      if (order.status === ORDER_STATUS.COMPLETED && order.paymentStatus === 'COMPLETED') {
        throw new Error('Payment has already been completed for this order');
      }

      if (order.status === ORDER_STATUS.CANCELLED) {
        throw new Error('Cannot collect payment for a cancelled order');
      }

      const [settings, restaurant] = await Promise.all([
        SystemSettings.findOne(),
        Restaurant.findById(order.restaurantId).select('gstPercentage'),
      ]);
      const gstPercentage = restaurant?.gstPercentage ?? settings?.gstPercentage ?? 5;

      const orderItems = await OrderItem.find({
        orderId: paymentData.orderId,
        status: { $ne: 'CANCELLED' },
      });
      const computedSubtotal = orderItems.reduce(
        (sum, item) => sum + (Number(item.price) || 0) * (Number(item.quantity) || 1),
        0
      );
      const subtotal = roundMoney(paymentData.subtotal !== undefined ? paymentData.subtotal : computedSubtotal);
      const discount = roundMoney(paymentData.discount);
      const gstAmount = roundMoney((subtotal * gstPercentage) / 100);
      const totalAmount = Math.max(0, roundMoney(subtotal + gstAmount - discount));
      const paidAt = paymentData.paidAt ? new Date(paymentData.paidAt) : new Date();

      const receiptNumber = await this.buildReceiptNumber(order.restaurantId);

      const payment = new Payment({
        ...paymentData,
        orderId: order._id,
        restaurantId: order.restaurantId,
        receiptNumber,
        subtotal,
        discount,
        gstPercentage,
        gstAmount,
        totalAmount,
        status: 'COMPLETED',
        paidAt,
      });

      await payment.save();

      // Mark all non-cancelled items as DELIVERED
      await OrderItem.updateMany(
        { orderId: order._id, status: { $ne: 'CANCELLED' } },
        { status: 'DELIVERED' }
      );

      await Order.findByIdAndUpdate(paymentData.orderId, {
        status: ORDER_STATUS.COMPLETED,
        paymentStatus: 'COMPLETED',
        subtotal,
        gst: gstAmount,
        discount,
        totalAmount,
        servedAt: order.servedAt || new Date(),
        completedAt: paidAt,
      });

      // Clear seated waiting queue for this table so table becomes vacant for queue
      if (order.tableNumber) {
        await WaitingQueue.updateMany(
          {
            restaurantId: order.restaurantId,
            assignedTable: Number(order.tableNumber),
            status: 'SEATED',
          },
          { status: 'COMPLETED' }
        );
      }

      logger.info(`Payment created: ${payment._id} (${receiptNumber}) for Order: ${order._id}`);
      return payment;
    } catch (error) {
      logger.error(`Create payment error: ${error.message}`);
      throw error;
    }
  }

  // Get payments by restaurant (with pagination)
  async getPaymentsByRestaurant(restaurantId, page = 1, limit = 20, status = null) {
    try {
      const skip = (page - 1) * limit;
      const query = {};
      if (restaurantId && restaurantId !== 'all') {
        query.restaurantId = restaurantId;
      }

      if (status) {
        query.status = status;
      }

      const payments = await Payment.find(query)
        .populate('restaurantId', 'name location city')
        .populate({
          path: 'orderId',
          populate: { path: 'createdBy', select: 'name email role' },
        })
        .populate('createdBy', 'name email role')
        .sort({ createdAt: -1 })
        .limit(limit)
        .skip(skip);

      const total = await Payment.countDocuments(query);

      // Attach items to populated orders
      const orders = payments.map(p => p.orderId).filter(Boolean);
      if (orders.length > 0) {
        const orderService = require('./orderService');
        const ordersWithItems = await orderService.attachItemsToOrders(orders);
        
        // Create a map from order ID string to order with items
        const orderMap = ordersWithItems.reduce((map, order) => {
          const idStr = (order._id || order.id || '').toString();
          if (idStr) {
            map[idStr] = order;
          }
          return map;
        }, {});

        // Replace the populated orderId in payments with the one containing items
        for (let i = 0; i < payments.length; i++) {
          if (payments[i].orderId) {
            const orderIdStr = (payments[i].orderId._id || payments[i].orderId.id || payments[i].orderId).toString();
            if (orderMap[orderIdStr]) {
              const plainPayment = payments[i].toObject ? payments[i].toObject() : payments[i];
              plainPayment.orderId = orderMap[orderIdStr];
              payments[i] = plainPayment;
            }
          }
        }
      }

      return { payments, total, page, limit };
    } catch (error) {
      logger.error(`Get payments error: ${error.message}`);
      throw error;
    }
  }

  // Get payment by ID
  async getPaymentById(paymentId) {
    try {
      const payment = await Payment.findById(paymentId)
        .populate({
          path: 'orderId',
          populate: { path: 'createdBy', select: 'name email role' },
        })
        .populate('createdBy', 'name email role');

      if (!payment) {
        throw new Error('Payment not found');
      }

      if (payment.orderId) {
        const orderService = require('./orderService');
        const ordersWithItems = await orderService.attachItemsToOrders([payment.orderId]);
        if (ordersWithItems.length > 0) {
          const plainPayment = payment.toObject ? payment.toObject() : payment;
          plainPayment.orderId = ordersWithItems[0];
          return plainPayment;
        }
      }

      return payment;
    } catch (error) {
      logger.error(`Get payment error: ${error.message}`);
      throw error;
    }
  }

  // Get payment by order ID
  async getPaymentByOrderId(orderId) {
    try {
      const payment = await Payment.findOne({ orderId });

      if (!payment) {
        throw new Error('Payment not found for this order');
      }

      return payment;
    } catch (error) {
      logger.error(`Get payment by order error: ${error.message}`);
      throw error;
    }
  }

  // Update payment status
  async updatePaymentStatus(paymentId, status, userId = null) {
    try {
      const updateData = {
        status,
        paidAt: status === 'COMPLETED' ? new Date() : null,
      };
      if (status === 'COMPLETED' && userId) {
        updateData.createdBy = userId;
      }

      const payment = await Payment.findByIdAndUpdate(
        paymentId,
        updateData,
        { new: true }
      );

      if (!payment) {
        throw new Error('Payment not found');
      }

      logger.info(`Payment status updated: ${paymentId} -> ${status}`);
      return payment;
    } catch (error) {
      logger.error(`Update payment status error: ${error.message}`);
      throw error;
    }
  }

  // Refund payment
  async refundPayment(paymentId, reason = '') {
    try {
      if (!reason || !reason.trim()) {
        throw new Error('Refund reason is required');
      }

      const payment = await Payment.findByIdAndUpdate(
        paymentId,
        {
          status: 'REFUNDED',
          refundReason: reason.trim(),
          notes: reason.trim(),
        },
        { new: true }
      );

      if (!payment) {
        throw new Error('Payment not found');
      }

      await Order.findByIdAndUpdate(payment.orderId, {
        paymentStatus: 'CANCELLED',
      });

      logger.info(`Payment refunded: ${paymentId}`);
      return payment;
    } catch (error) {
      logger.error(`Refund payment error: ${error.message}`);
      throw error;
    }
  }

  // Get daily sales report
  async getDailySalesReport(restaurantId, date) {
    try {
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);

      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);

      const payments = await Payment.find({
        restaurantId,
        paidAt: { $gte: startOfDay, $lte: endOfDay },
        status: 'COMPLETED',
      });

      const totalSales = payments.reduce((sum, p) => sum + p.totalAmount, 0);
      const totalGST = payments.reduce((sum, p) => sum + p.gstAmount, 0);
      const totalTransactions = payments.length;

      return {
        date,
        totalSales,
        totalGST,
        totalTransactions,
        payments,
      };
    } catch (error) {
      logger.error(`Get daily sales report error: ${error.message}`);
      throw error;
    }
  }
}

module.exports = new PaymentService();
