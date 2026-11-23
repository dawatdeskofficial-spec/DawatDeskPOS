const Restaurant = require('../models/Restaurant');
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

/**
 * Middleware to check if Hotel Room Management is activated for the target restaurant.
 * Rejects with 403 Forbidden if not activated.
 */
const validateHotelModule = async (req, res, next) => {
  try {
    const userRole = normalizeRole(req.user?.role);
    if (!userRole) {
      return sendError(res, 'Authentication required', 401);
    }

    // Determine target restaurant ID
    let targetRestaurantId =
      req.params?.restaurantId ||
      req.query?.restaurantId ||
      req.body?.restaurantId ||
      getId(req.user?.restaurantId);

    // If main admin makes a request without specific restaurant ID (e.g. cross-restaurant listings or stats)
    if (userRole === 'MAIN_ADMIN' && !targetRestaurantId) {
      return next();
    }

    if (!targetRestaurantId) {
      return sendError(res, 'Restaurant identifier is required for hotel operations', 400);
    }

    const restaurant = await Restaurant.findById(targetRestaurantId).select('name facilities status isActive').lean();
    if (!restaurant) {
      return sendError(res, 'Restaurant not found', 404);
    }

    const isHotelEnabled = Boolean(restaurant.facilities && restaurant.facilities.hotelRoomManagement);
    if (!isHotelEnabled) {
      logger.warn(
        `Hotel module access rejected: facility not enabled for restaurant ${targetRestaurantId} (${restaurant.name})`
      );
      return sendError(
        res,
        'Hotel Room Management module is not enabled for this restaurant. Contact Main Admin to activate this facility.',
        403
      );
    }

    req.hotelRestaurant = restaurant;
    req.targetRestaurantId = targetRestaurantId.toString();
    return next();
  } catch (error) {
    logger.error(`Hotel module validation error: ${error.message}`);
    return sendError(res, 'Failed to validate hotel module activation', 500);
  }
};

module.exports = validateHotelModule;
