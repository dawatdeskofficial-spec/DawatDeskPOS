const hotelRoomService = require('../services/hotelRoomService');
const hotelBookingService = require('../services/hotelBookingService');
const hotelPdfService = require('../services/hotelPdfService');
const authService = require('../services/authService');
const HotelInvoice = require('../models/HotelInvoice');
const HotelBooking = require('../models/HotelBooking');
const Restaurant = require('../models/Restaurant');
const { sendSuccess, sendError, sendPaginatedResponse } = require('../utils/responseHandler');
const logger = require('../utils/logger');

const getEffectiveRestaurantId = (req) => {
  return (
    req.params?.restaurantId ||
    req.query?.restaurantId ||
    req.body?.restaurantId ||
    req.targetRestaurantId ||
    (req.user?.restaurantId ? (req.user.restaurantId._id || req.user.restaurantId.id || req.user.restaurantId).toString() : null)
  );
};

class HotelController {
  // ── ROOM TYPES ─────────────────────────────────────────────────────────────

  async getRoomTypes(req, res) {
    try {
      const restaurantId = getEffectiveRestaurantId(req);
      const activeOnly = req.query.activeOnly === 'true';
      const types = await hotelRoomService.getRoomTypes(restaurantId, activeOnly);
      return sendSuccess(res, 'Room types retrieved successfully', types);
    } catch (error) {
      logger.error(`Get room types error: ${error.message}`);
      return sendError(res, error.message, 400);
    }
  }

  async createRoomType(req, res) {
    try {
      const restaurantId = getEffectiveRestaurantId(req);
      const type = await hotelRoomService.createRoomType(restaurantId, req.body);
      return sendSuccess(res, 'Room type created successfully', type, 201);
    } catch (error) {
      logger.error(`Create room type error: ${error.message}`);
      return sendError(res, error.message, 400);
    }
  }

  async updateRoomType(req, res) {
    try {
      const restaurantId = getEffectiveRestaurantId(req);
      const { id } = req.params;
      const type = await hotelRoomService.updateRoomType(restaurantId, id, req.body);
      return sendSuccess(res, 'Room type updated successfully', type);
    } catch (error) {
      logger.error(`Update room type error: ${error.message}`);
      return sendError(res, error.message, 400);
    }
  }

  async toggleRoomTypeStatus(req, res) {
    try {
      const restaurantId = getEffectiveRestaurantId(req);
      const { id } = req.params;
      const type = await hotelRoomService.toggleRoomTypeStatus(restaurantId, id);
      return sendSuccess(res, `Room type ${type.isActive ? 'activated' : 'deactivated'} successfully`, type);
    } catch (error) {
      logger.error(`Toggle room type status error: ${error.message}`);
      return sendError(res, error.message, 400);
    }
  }

  // ── ROOMS ──────────────────────────────────────────────────────────────────

  async getRooms(req, res) {
    try {
      const restaurantId = getEffectiveRestaurantId(req);
      const rooms = await hotelRoomService.getRooms(restaurantId, req.query);
      return sendSuccess(res, 'Rooms retrieved successfully', rooms);
    } catch (error) {
      logger.error(`Get rooms error: ${error.message}`);
      return sendError(res, error.message, 400);
    }
  }

  async getRoomById(req, res) {
    try {
      const restaurantId = getEffectiveRestaurantId(req);
      const { id } = req.params;
      const room = await hotelRoomService.getRoomById(restaurantId, id);
      return sendSuccess(res, 'Room details retrieved successfully', room);
    } catch (error) {
      logger.error(`Get room by ID error: ${error.message}`);
      return sendError(res, error.message, 404);
    }
  }

  async createRoom(req, res) {
    try {
      const restaurantId = getEffectiveRestaurantId(req);
      const room = await hotelRoomService.createRoom(restaurantId, req.body);
      return sendSuccess(res, 'Room created successfully', room, 201);
    } catch (error) {
      logger.error(`Create room error: ${error.message}`);
      return sendError(res, error.message, 400);
    }
  }

  async updateRoom(req, res) {
    try {
      const restaurantId = getEffectiveRestaurantId(req);
      const { id } = req.params;
      const room = await hotelRoomService.updateRoom(restaurantId, id, req.body);
      return sendSuccess(res, 'Room updated successfully', room);
    } catch (error) {
      logger.error(`Update room error: ${error.message}`);
      return sendError(res, error.message, 400);
    }
  }

  async toggleRoomStatus(req, res) {
    try {
      const restaurantId = getEffectiveRestaurantId(req);
      const { id } = req.params;
      const room = await hotelRoomService.toggleRoomStatus(restaurantId, id);
      return sendSuccess(res, `Room ${room.isActive ? 'activated' : 'deactivated'} successfully`, room);
    } catch (error) {
      logger.error(`Toggle room status error: ${error.message}`);
      return sendError(res, error.message, 400);
    }
  }

  async deleteRoom(req, res) {
    try {
      const restaurantId = getEffectiveRestaurantId(req);
      const { id } = req.params;
      const result = await hotelRoomService.deleteRoom(restaurantId, id);
      return sendSuccess(res, result.message, result);
    } catch (error) {
      logger.error(`Delete room error: ${error.message}`);
      return sendError(res, error.message, 400);
    }
  }

  async updateHousekeeping(req, res) {
    try {
      const restaurantId = getEffectiveRestaurantId(req);
      const { id } = req.params;
      const { status, maintenanceReason } = req.body;
      const room = await hotelRoomService.updateHousekeepingStatus(restaurantId, id, status, maintenanceReason);
      return sendSuccess(res, `Room status changed to ${status}`, room);
    } catch (error) {
      logger.error(`Update housekeeping error: ${error.message}`);
      return sendError(res, error.message, 400);
    }
  }

  // ── AVAILABILITY & BOOKINGS ────────────────────────────────────────────────

  async checkAvailability(req, res) {
    try {
      const restaurantId = getEffectiveRestaurantId(req);
      const { checkInDate, checkOutDate, roomTypeId } = req.query;

      if (!checkInDate || !checkOutDate) {
        return sendError(res, 'checkInDate and checkOutDate query parameters are required', 400);
      }

      if (req.query.roomId) {
        const result = await hotelBookingService.checkRoomAvailability({
          restaurantId,
          roomId: req.query.roomId,
          checkInDate,
          checkOutDate,
        });
        return sendSuccess(res, 'Room availability checked', result);
      }

      const availableRooms = await hotelBookingService.getAvailableRooms({
        restaurantId,
        checkInDate,
        checkOutDate,
        roomTypeId,
      });

      return sendSuccess(res, 'Available rooms retrieved', availableRooms);
    } catch (error) {
      logger.error(`Check availability error: ${error.message}`);
      return sendError(res, error.message, 400);
    }
  }

  async createBooking(req, res) {
    try {
      const restaurantId = getEffectiveRestaurantId(req);
      const booking = await hotelBookingService.createBooking(restaurantId, req.body, req.user);
      return sendSuccess(res, 'Booking created successfully', booking, 201);
    } catch (error) {
      logger.error(`Create booking error: ${error.message}`);
      return sendError(res, error.message, 400);
    }
  }

  async getBookings(req, res) {
    try {
      const restaurantId = getEffectiveRestaurantId(req);
      const result = await hotelBookingService.getBookings(restaurantId, req.query);
      return sendPaginatedResponse(res, result.bookings, result.page, result.limit, result.total);
    } catch (error) {
      logger.error(`Get bookings error: ${error.message}`);
      return sendError(res, error.message, 400);
    }
  }

  async getBookingById(req, res) {
    try {
      const restaurantId = getEffectiveRestaurantId(req);
      const { id } = req.params;
      const booking = await hotelBookingService.getBookingById(restaurantId, id);
      return sendSuccess(res, 'Booking retrieved successfully', booking);
    } catch (error) {
      logger.error(`Get booking by ID error: ${error.message}`);
      return sendError(res, error.message, 404);
    }
  }

  async checkInGuest(req, res) {
    try {
      const restaurantId = getEffectiveRestaurantId(req);
      const { id } = req.params;
      const booking = await hotelBookingService.checkInGuest(restaurantId, id, req.body, req.user);
      return sendSuccess(res, 'Guest checked in successfully', booking);
    } catch (error) {
      logger.error(`Check-in guest error: ${error.message}`);
      return sendError(res, error.message, 400);
    }
  }

  async extendStay(req, res) {
    try {
      const restaurantId = getEffectiveRestaurantId(req);
      const { id } = req.params;
      const booking = await hotelBookingService.extendStay(restaurantId, id, req.body, req.user);
      return sendSuccess(res, 'Stay extended successfully', booking);
    } catch (error) {
      logger.error(`Extend stay error: ${error.message}`);
      return sendError(res, error.message, 400);
    }
  }

  async addAdditionalCharge(req, res) {
    try {
      const restaurantId = getEffectiveRestaurantId(req);
      const { id } = req.params;
      const booking = await hotelBookingService.addAdditionalCharge(restaurantId, id, req.body, req.user);
      return sendSuccess(res, 'Additional charge added successfully', booking);
    } catch (error) {
      logger.error(`Add charge error: ${error.message}`);
      return sendError(res, error.message, 400);
    }
  }

  async checkoutGuest(req, res) {
    try {
      const restaurantId = getEffectiveRestaurantId(req);
      const { id } = req.params;
      const result = await hotelBookingService.checkoutGuest(restaurantId, id, req.body, req.user);
      return sendSuccess(res, 'Guest checked out successfully and invoice generated', result);
    } catch (error) {
      logger.error(`Checkout error: ${error.message}`);
      return sendError(res, error.message, 400);
    }
  }

  async cancelBooking(req, res) {
    try {
      const restaurantId = getEffectiveRestaurantId(req);
      const { id } = req.params;
      const { reason } = req.body;
      const booking = await hotelBookingService.cancelBooking(restaurantId, id, reason, req.user);
      return sendSuccess(res, 'Booking cancelled successfully', booking);
    } catch (error) {
      logger.error(`Cancel booking error: ${error.message}`);
      return sendError(res, error.message, 400);
    }
  }

  // ── INVOICES & PDF ─────────────────────────────────────────────────────────

  async getInvoices(req, res) {
    try {
      const restaurantId = getEffectiveRestaurantId(req);
      const { page = 1, limit = 20, search } = req.query;
      const filter = { restaurantId };
      if (search) {
        filter.$or = [
          { invoiceNumber: { $regex: search, $options: 'i' } },
          { guestName: { $regex: search, $options: 'i' } },
          { guestPhone: { $regex: search, $options: 'i' } },
          { roomNumber: { $regex: search, $options: 'i' } },
        ];
      }

      const skip = (Number(page) - 1) * Number(limit);
      const [invoices, total] = await Promise.all([
        HotelInvoice.find(filter)
          .sort({ issuedAt: -1 })
          .skip(skip)
          .limit(Number(limit))
          .populate('issuedBy', 'name')
          .lean(),
        HotelInvoice.countDocuments(filter),
      ]);

      return sendPaginatedResponse(
        res,
        invoices.map((inv) => ({ ...inv, id: inv._id.toString() })),
        page,
        limit,
        total
      );
    } catch (error) {
      logger.error(`Get invoices error: ${error.message}`);
      return sendError(res, error.message, 400);
    }
  }

  async getInvoiceById(req, res) {
    try {
      const restaurantId = getEffectiveRestaurantId(req);
      const { id } = req.params;
      const invoice = await HotelInvoice.findOne({ _id: id, restaurantId })
        .populate('issuedBy', 'name email role')
        .lean();
      if (!invoice) throw new Error('Invoice not found');

      return sendSuccess(res, 'Invoice retrieved successfully', invoice);
    } catch (error) {
      logger.error(`Get invoice by ID error: ${error.message}`);
      return sendError(res, error.message, 404);
    }
  }

  async downloadInvoicePdf(req, res) {
    try {
      const restaurantId = getEffectiveRestaurantId(req);
      const { id } = req.params;

      let invoice = await HotelInvoice.findOne({ _id: id, restaurantId });
      if (!invoice) {
        invoice = await HotelInvoice.findOne({ bookingId: id, restaurantId });
      }
      if (!invoice) throw new Error('Invoice not found');

      const [booking, restaurant] = await Promise.all([
        HotelBooking.findById(invoice.bookingId),
        Restaurant.findById(restaurantId),
      ]);

      const { buffer, fileName } = await hotelPdfService.generateHotelInvoicePdf({
        invoice,
        booking,
        restaurant,
        cashier: req.user,
      });

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="${fileName}"`);
      res.setHeader('Content-Length', buffer.length);
      return res.end(buffer);
    } catch (error) {
      logger.error(`Generate invoice PDF error: ${error.message}`);
      return sendError(res, error.message, 400);
    }
  }

  // ── DASHBOARD & REPORTS ────────────────────────────────────────────────────

  async getDashboardStats(req, res) {
    try {
      const restaurantId = getEffectiveRestaurantId(req);
      const stats = await hotelBookingService.getDashboardStats(restaurantId);
      return sendSuccess(res, 'Hotel dashboard stats retrieved successfully', stats);
    } catch (error) {
      logger.error(`Get dashboard stats error: ${error.message}`);
      return sendError(res, error.message, 400);
    }
  }

  async getReports(req, res) {
    try {
      const restaurantId = getEffectiveRestaurantId(req);
      const { fromDate, toDate } = req.query;
      const reports = await hotelBookingService.getHotelReports(restaurantId, fromDate, toDate);
      return sendSuccess(res, 'Hotel reports retrieved successfully', reports);
    } catch (error) {
      logger.error(`Get hotel reports error: ${error.message}`);
      return sendError(res, error.message, 400);
    }
  }

  // ── MAIN ADMIN FACILITY TOGGLE ─────────────────────────────────────────────

  async toggleHotelFacility(req, res) {
    try {
      const { restaurantId } = req.params;
      const { isEnabled } = req.body;

      const restaurant = await Restaurant.findById(restaurantId);
      if (!restaurant) throw new Error('Restaurant not found');

      if (!restaurant.facilities) {
        restaurant.facilities = {};
      }
      restaurant.facilities.hotelRoomManagement = Boolean(isEnabled);
      await restaurant.save();

      // Invalidate all user auth caches so all staff immediately pick up the updated facilities
      authService.invalidateAllUserCaches();

      // Seed default room types upon enabling for convenience
      if (restaurant.facilities.hotelRoomManagement) {
        await hotelRoomService.ensureDefaultRoomTypes(restaurant._id);
      }

      logger.info(
        `Hotel Room Management facility ${restaurant.facilities.hotelRoomManagement ? 'ENABLED' : 'DISABLED'} for restaurant ${restaurant.name} (${restaurant._id}) by user ${req.user.name}`
      );

      return sendSuccess(
        res,
        `Hotel Room Management facility has been ${restaurant.facilities.hotelRoomManagement ? 'enabled' : 'disabled'} for ${restaurant.name}`,
        {
          restaurantId: restaurant._id,
          name: restaurant.name,
          hotelRoomManagement: restaurant.facilities.hotelRoomManagement,
        }
      );
    } catch (error) {
      logger.error(`Toggle hotel facility error: ${error.message}`);
      return sendError(res, error.message, 400);
    }
  }

  // ── GET FACILITY STATUS (For Cashier, Restaurant Admin, Main Admin) ──────────
  async getHotelFacilityStatus(req, res) {
    try {
      const restaurantId = getEffectiveRestaurantId(req);
      if (!restaurantId) {
        return sendError(res, 'Restaurant ID is required', 400);
      }

      const restaurant = await Restaurant.findById(restaurantId)
        .select('name status isActive facilities')
        .lean();

      if (!restaurant) {
        return sendError(res, 'Restaurant not found', 404);
      }

      const isEnabled = Boolean(restaurant.facilities?.hotelRoomManagement);

      return sendSuccess(res, 'Hotel facility status fetched successfully', {
        restaurantId: restaurant._id.toString(),
        name: restaurant.name,
        hotelRoomManagement: isEnabled,
        facilities: restaurant.facilities || { hotelRoomManagement: false },
      });
    } catch (error) {
      logger.error(`Get hotel facility status error: ${error.message}`);
      return sendError(res, error.message, 400);
    }
  }
}

module.exports = new HotelController();
