const mongoose = require('mongoose');
const User = require('../models/User');
const Order = require('../models/Order');
const Payment = require('../models/Payment');
const MenuItem = require('../models/MenuItem');
const Category = require('../models/Category');
const WaitingQueue = require('../models/WaitingQueue');
const { sendError } = require('../utils/responseHandler');
const { normalizeRole } = require('../utils/constants');
const logger = require('../utils/logger');

const getId = (value) => {
  if (!value) return null;
  if (typeof value === 'string') return value;
  if (value._id) return value._id.toString();
  if (value.id) return value.id.toString();
  return value.toString ? value.toString() : null;
};

const getUserRestaurantId = (user) => getId(user?.restaurantId);

const findResourceRestaurantId = async (req, resourceType) => {
  const explicitRestaurantId =
    req.params?.restaurantId || req.body?.restaurantId || req.query?.restaurantId;
  if (explicitRestaurantId) return explicitRestaurantId;

  if (resourceType === 'restaurant') {
    return req.params?.id;
  }

  if (resourceType === 'order') {
    const orderId = req.params?.orderId || req.params?.id || req.body?.orderId;
    if (!orderId || !mongoose.Types.ObjectId.isValid(orderId)) return null;
    const order = await Order.findById(orderId).select('restaurantId');
    return getId(order?.restaurantId);
  }

  if (resourceType === 'payment') {
    const paymentId = req.params?.paymentId || req.params?.id;
    if (paymentId && mongoose.Types.ObjectId.isValid(paymentId)) {
      const payment = await Payment.findById(paymentId).select('restaurantId');
      return getId(payment?.restaurantId);
    }

    const orderId = req.body?.orderId;
    if (orderId && mongoose.Types.ObjectId.isValid(orderId)) {
      const order = await Order.findById(orderId).select('restaurantId');
      return getId(order?.restaurantId);
    }
  }

  if (resourceType === 'menu') {
    const menuItemId = req.params?.menuItemId || req.params?.id || req.body?.menuItemId;
    if (menuItemId && mongoose.Types.ObjectId.isValid(menuItemId)) {
      const menuItem = await MenuItem.findById(menuItemId).select('restaurantId');
      return getId(menuItem?.restaurantId);
    }
  }

  if (resourceType === 'category') {
    const categoryId = req.params?.categoryId || req.params?.id || req.body?.categoryId;
    if (categoryId && mongoose.Types.ObjectId.isValid(categoryId)) {
      const category = await Category.findById(categoryId).select('restaurantId');
      return getId(category?.restaurantId);
    }
  }

  if (resourceType === 'waitingQueue') {
    const queueId = req.params?.id || req.body?.queueId;
    if (queueId && mongoose.Types.ObjectId.isValid(queueId)) {
      const queueEntry = await WaitingQueue.findById(queueId).select('restaurantId');
      return getId(queueEntry?.restaurantId);
    }
  }

  if (resourceType === 'user') {
    const userId = req.params?.userId || req.params?.id;
    if (userId && mongoose.Types.ObjectId.isValid(userId)) {
      const targetUser = await User.findById(userId).select('restaurantId role');
      if (normalizeRole(targetUser?.role) === 'MAIN_ADMIN') return null;
      return getId(targetUser?.restaurantId);
    }
  }

  return null;
};

const validateRestaurantOwnership = (resourceType = null) => async (req, res, next) => {
  try {
    const userId = req.user?.userId || req.user?._id || req.user?.id;
    const userRole = normalizeRole(req.user?.role);

    if (!userId || !userRole) {
      return sendError(res, 'Authentication required', 401);
    }

    if (userRole === 'MAIN_ADMIN') {
      return next();
    }

    const userRestaurantId = getUserRestaurantId(req.user);
    const targetRestaurantId = await findResourceRestaurantId(req, resourceType) || userRestaurantId;

    if (!targetRestaurantId) {
      logger.warn(`Restaurant ownership target missing for user: ${userId}`);
      return sendError(res, 'Restaurant-scoped resource not found', 404);
    }

    if (!userRestaurantId || userRestaurantId !== targetRestaurantId.toString()) {
      logger.warn(`Unauthorized restaurant access attempt by user: ${userId}`);
      return sendError(res, 'You do not have access to this restaurant', 403);
    }

    return next();
  } catch (error) {
    logger.error(`Restaurant validation error: ${error.message}`);
    return sendError(res, 'Restaurant validation failed', 403);
  }
};

module.exports = validateRestaurantOwnership;
