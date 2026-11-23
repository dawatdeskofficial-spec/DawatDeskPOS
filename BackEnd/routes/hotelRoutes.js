const express = require('express');
const router = express.Router();
const hotelController = require('../controllers/hotelController');
const authenticate = require('../middlewares/authenticate');
const { authorize } = require('../middlewares/authorize');
const validateHotelModule = require('../middlewares/validateHotelModule');
const validateRestaurantOwnership = require('../middlewares/validateRestaurantOwnership');

// ── MAIN ADMIN FACILITY TOGGLE ───────────────────────────────────────────────
router.patch(
  '/facility/:restaurantId',
  authenticate,
  authorize('MAIN_ADMIN'),
  (req, res) => hotelController.toggleHotelFacility(req, res)
);

// Check hotel facility status (MAIN_ADMIN, RESTAURANT_ADMIN, CASHIER)
router.get(
  '/facility-status',
  authenticate,
  authorize('MAIN_ADMIN', 'RESTAURANT_ADMIN', 'CASHIER'),
  (req, res) => hotelController.getHotelFacilityStatus(req, res)
);

router.get(
  '/facility-status/:restaurantId',
  authenticate,
  authorize('MAIN_ADMIN', 'RESTAURANT_ADMIN', 'CASHIER'),
  validateRestaurantOwnership('restaurant'),
  (req, res) => hotelController.getHotelFacilityStatus(req, res)
);

// ── ROOM TYPES ───────────────────────────────────────────────────────────────
router.get(
  '/room-types',
  authenticate,
  authorize('MAIN_ADMIN', 'RESTAURANT_ADMIN', 'CASHIER'),
  validateHotelModule,
  (req, res) => hotelController.getRoomTypes(req, res)
);

router.post(
  '/room-types',
  authenticate,
  authorize('MAIN_ADMIN', 'RESTAURANT_ADMIN'),
  validateHotelModule,
  (req, res) => hotelController.createRoomType(req, res)
);

router.put(
  '/room-types/:id',
  authenticate,
  authorize('MAIN_ADMIN', 'RESTAURANT_ADMIN'),
  validateRestaurantOwnership('hotelRoomType'),
  validateHotelModule,
  (req, res) => hotelController.updateRoomType(req, res)
);

router.patch(
  '/room-types/:id/toggle',
  authenticate,
  authorize('MAIN_ADMIN', 'RESTAURANT_ADMIN'),
  validateRestaurantOwnership('hotelRoomType'),
  validateHotelModule,
  (req, res) => hotelController.toggleRoomTypeStatus(req, res)
);

// ── ROOMS ────────────────────────────────────────────────────────────────────
router.get(
  '/rooms',
  authenticate,
  authorize('MAIN_ADMIN', 'RESTAURANT_ADMIN', 'CASHIER'),
  validateHotelModule,
  (req, res) => hotelController.getRooms(req, res)
);

router.get(
  '/rooms/:id',
  authenticate,
  authorize('MAIN_ADMIN', 'RESTAURANT_ADMIN', 'CASHIER'),
  validateRestaurantOwnership('hotelRoom'),
  validateHotelModule,
  (req, res) => hotelController.getRoomById(req, res)
);

router.post(
  '/rooms',
  authenticate,
  authorize('MAIN_ADMIN', 'RESTAURANT_ADMIN'),
  validateHotelModule,
  (req, res) => hotelController.createRoom(req, res)
);

router.put(
  '/rooms/:id',
  authenticate,
  authorize('MAIN_ADMIN', 'RESTAURANT_ADMIN'),
  validateRestaurantOwnership('hotelRoom'),
  validateHotelModule,
  (req, res) => hotelController.updateRoom(req, res)
);

router.patch(
  '/rooms/:id/toggle',
  authenticate,
  authorize('MAIN_ADMIN', 'RESTAURANT_ADMIN'),
  validateRestaurantOwnership('hotelRoom'),
  validateHotelModule,
  (req, res) => hotelController.toggleRoomStatus(req, res)
);

router.delete(
  '/rooms/:id',
  authenticate,
  authorize('MAIN_ADMIN', 'RESTAURANT_ADMIN'),
  validateRestaurantOwnership('hotelRoom'),
  validateHotelModule,
  (req, res) => hotelController.deleteRoom(req, res)
);

router.patch(
  '/rooms/:id/housekeeping',
  authenticate,
  authorize('MAIN_ADMIN', 'RESTAURANT_ADMIN', 'CASHIER'),
  validateRestaurantOwnership('hotelRoom'),
  validateHotelModule,
  (req, res) => hotelController.updateHousekeeping(req, res)
);

// ── AVAILABILITY ─────────────────────────────────────────────────────────────
router.get(
  '/availability',
  authenticate,
  authorize('MAIN_ADMIN', 'RESTAURANT_ADMIN', 'CASHIER'),
  validateHotelModule,
  (req, res) => hotelController.checkAvailability(req, res)
);

// ── BOOKINGS ─────────────────────────────────────────────────────────────────
router.get(
  '/bookings',
  authenticate,
  authorize('MAIN_ADMIN', 'RESTAURANT_ADMIN', 'CASHIER'),
  validateHotelModule,
  (req, res) => hotelController.getBookings(req, res)
);

router.get(
  '/bookings/:id',
  authenticate,
  authorize('MAIN_ADMIN', 'RESTAURANT_ADMIN', 'CASHIER'),
  validateRestaurantOwnership('hotelBooking'),
  validateHotelModule,
  (req, res) => hotelController.getBookingById(req, res)
);

router.post(
  '/bookings',
  authenticate,
  authorize('MAIN_ADMIN', 'RESTAURANT_ADMIN', 'CASHIER'),
  validateHotelModule,
  (req, res) => hotelController.createBooking(req, res)
);

router.post(
  '/bookings/:id/checkin',
  authenticate,
  authorize('MAIN_ADMIN', 'RESTAURANT_ADMIN', 'CASHIER'),
  validateRestaurantOwnership('hotelBooking'),
  validateHotelModule,
  (req, res) => hotelController.checkInGuest(req, res)
);

router.post(
  '/bookings/:id/extend',
  authenticate,
  authorize('MAIN_ADMIN', 'RESTAURANT_ADMIN', 'CASHIER'),
  validateRestaurantOwnership('hotelBooking'),
  validateHotelModule,
  (req, res) => hotelController.extendStay(req, res)
);

router.post(
  '/bookings/:id/charges',
  authenticate,
  authorize('MAIN_ADMIN', 'RESTAURANT_ADMIN', 'CASHIER'),
  validateRestaurantOwnership('hotelBooking'),
  validateHotelModule,
  (req, res) => hotelController.addAdditionalCharge(req, res)
);

router.post(
  '/bookings/:id/checkout',
  authenticate,
  authorize('MAIN_ADMIN', 'RESTAURANT_ADMIN', 'CASHIER'),
  validateRestaurantOwnership('hotelBooking'),
  validateHotelModule,
  (req, res) => hotelController.checkoutGuest(req, res)
);

router.post(
  '/bookings/:id/cancel',
  authenticate,
  authorize('MAIN_ADMIN', 'RESTAURANT_ADMIN', 'CASHIER'),
  validateRestaurantOwnership('hotelBooking'),
  validateHotelModule,
  (req, res) => hotelController.cancelBooking(req, res)
);

// ── INVOICES & PDF ───────────────────────────────────────────────────────────
router.get(
  '/invoices',
  authenticate,
  authorize('MAIN_ADMIN', 'RESTAURANT_ADMIN', 'CASHIER'),
  validateHotelModule,
  (req, res) => hotelController.getInvoices(req, res)
);

router.get(
  '/invoices/:id',
  authenticate,
  authorize('MAIN_ADMIN', 'RESTAURANT_ADMIN', 'CASHIER'),
  validateRestaurantOwnership('hotelInvoice'),
  validateHotelModule,
  (req, res) => hotelController.getInvoiceById(req, res)
);

router.get(
  '/invoices/:id/pdf',
  authenticate,
  authorize('MAIN_ADMIN', 'RESTAURANT_ADMIN', 'CASHIER'),
  validateRestaurantOwnership('hotelInvoice'),
  validateHotelModule,
  (req, res) => hotelController.downloadInvoicePdf(req, res)
);

// ── DASHBOARD & REPORTS ──────────────────────────────────────────────────────
router.get(
  '/dashboard',
  authenticate,
  authorize('MAIN_ADMIN', 'RESTAURANT_ADMIN'),
  validateHotelModule,
  (req, res) => hotelController.getDashboardStats(req, res)
);

router.get(
  '/reports',
  authenticate,
  authorize('MAIN_ADMIN', 'RESTAURANT_ADMIN'),
  validateHotelModule,
  (req, res) => hotelController.getReports(req, res)
);

module.exports = router;
