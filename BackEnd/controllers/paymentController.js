const paymentService = require('../services/paymentService');
const { sendSuccess, sendError, sendPaginatedResponse } = require('../utils/responseHandler');
const logger = require('../utils/logger');

class PaymentController {
  // Create payment
  async createPayment(req, res) {
    try {
      const paymentData = req.body;

      if (!paymentData.orderId || !paymentData.paymentMethod) {
        return sendError(
          res,
          'Order ID and payment method are required',
          400
        );
      }

      // Attach cashier ID from authenticated request
      if (req.user && req.user.id) {
        paymentData.createdBy = req.user.id;
      }

      const payment = await paymentService.createPayment(paymentData);

      return sendSuccess(
        res,
        'Payment created successfully',
        payment,
        201
      );
    } catch (error) {
      logger.error(`Create payment error: ${error.message}`);
      return sendError(res, error.message, 400);
    }
  }

  // Get payments by restaurant
  async getPaymentsByRestaurant(req, res) {
    try {
      const { restaurantId } = req.params;
      const { page = 1, limit = 20, status } = req.query;

      const { payments, total } = await paymentService.getPaymentsByRestaurant(
        restaurantId,
        page,
        limit,
        status
      );

      return sendPaginatedResponse(res, payments, page, limit, total);
    } catch (error) {
      logger.error(`Get payments error: ${error.message}`);
      return sendError(res, error.message, 400);
    }
  }

  // Get payment by ID
  async getPaymentById(req, res) {
    try {
      const { id } = req.params;
      const payment = await paymentService.getPaymentById(id);

      return sendSuccess(res, 'Payment fetched successfully', payment);
    } catch (error) {
      logger.error(`Get payment error: ${error.message}`);
      return sendError(res, error.message, 400);
    }
  }

  // Update payment status
  async updatePaymentStatus(req, res) {
    try {
      const { id } = req.params;
      const { status } = req.body;

      if (!status) {
        return sendError(res, 'Status is required', 400);
      }

      const payment = await paymentService.updatePaymentStatus(id, status, req.user?.id);

      return sendSuccess(
        res,
        'Payment status updated successfully',
        payment
      );
    } catch (error) {
      logger.error(`Update payment status error: ${error.message}`);
      return sendError(res, error.message, 400);
    }
  }

  // Refund payment
  async refundPayment(req, res) {
    try {
      const { id } = req.params;
      const { reason } = req.body;

      const payment = await paymentService.refundPayment(id, reason);

      return sendSuccess(
        res,
        'Payment refunded successfully',
        payment
      );
    } catch (error) {
      logger.error(`Refund payment error: ${error.message}`);
      return sendError(res, error.message, 400);
    }
  }

  // Get daily sales report
  async getDailySalesReport(req, res) {
    try {
      const { restaurantId } = req.params;
      const { date } = req.query;

      if (!date) {
        return sendError(res, 'Date is required', 400);
      }

      const report = await paymentService.getDailySalesReport(
        restaurantId,
        date
      );

      return sendSuccess(res, 'Sales report fetched successfully', report);
    } catch (error) {
      logger.error(`Get daily sales report error: ${error.message}`);
      return sendError(res, error.message, 400);
    }
  }
}

module.exports = new PaymentController();
