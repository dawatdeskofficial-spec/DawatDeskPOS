const mongoose = require('mongoose');
const HotelRoom = require('../models/HotelRoom');
const HotelRoomType = require('../models/HotelRoomType');
const HotelBooking = require('../models/HotelBooking');
const HotelPayment = require('../models/HotelPayment');
const HotelInvoice = require('../models/HotelInvoice');
const Restaurant = require('../models/Restaurant');
const SystemSettings = require('../models/SystemSettings');
const logger = require('../utils/logger');

const roundMoney = (num) => Math.round((Number(num) || 0) * 100) / 100;

class HotelBookingService {
  /**
   * Generates a unique sequential booking reference: HB-YYYYMMDD-COUNT-RANDOM
   */
  async generateBookingReference(restaurantId) {
    const now = new Date();
    const stamp = now.toISOString().slice(0, 10).replace(/-/g, '');
    const count = await HotelBooking.countDocuments({ restaurantId });
    const suffix = Math.floor(1000 + Math.random() * 9000);
    return `HB-${stamp}-${String(count + 1).padStart(4, '0')}-${suffix}`;
  }

  /**
   * Generates a unique sequential receipt number: HR-YYYYMMDD-COUNT-RANDOM
   */
  async generateReceiptNumber(restaurantId) {
    const now = new Date();
    const stamp = now.toISOString().slice(0, 10).replace(/-/g, '');
    const count = await HotelPayment.countDocuments({ restaurantId });
    const suffix = Math.floor(1000 + Math.random() * 9000);
    return `HR-${stamp}-${String(count + 1).padStart(4, '0')}-${suffix}`;
  }

  /**
   * Generates a unique sequential invoice number: INV-HTL-YYYYMMDD-COUNT-RANDOM
   */
  async generateInvoiceNumber(restaurantId) {
    const now = new Date();
    const stamp = now.toISOString().slice(0, 10).replace(/-/g, '');
    const count = await HotelInvoice.countDocuments({ restaurantId });
    const suffix = Math.floor(1000 + Math.random() * 9000);
    return `INV-HTL-${stamp}-${String(count + 1).padStart(4, '0')}-${suffix}`;
  }

  /**
   * Calculate billable nights between check-in and checkout
   */
  calculateNights(checkInDate, checkOutDate) {
    const inDate = new Date(checkInDate);
    const outDate = new Date(checkOutDate);
    const diffTime = outDate.getTime() - inDate.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return Math.max(1, diffDays);
  }

  /**
   * Check whether a room is available for the given date range.
   * A booking overlaps if: existing.checkInDate < requestedCheckOutDate && existing.checkOutDate > requestedCheckInDate
   */
  async checkRoomAvailability({ restaurantId, roomId, checkInDate, checkOutDate, excludeBookingId = null }) {
    const room = await HotelRoom.findOne({ _id: roomId, restaurantId });
    if (!room) {
      return { isAvailable: false, reason: 'Room not found' };
    }
    if (!room.isActive) {
      return { isAvailable: false, reason: 'Room is inactive/decommissioned' };
    }
    if (room.status === 'MAINTENANCE') {
      return { isAvailable: false, reason: `Room is under maintenance (${room.maintenanceReason || 'Repairs'})` };
    }

    const start = new Date(checkInDate);
    const end = new Date(checkOutDate);

    if (end <= start) {
      return { isAvailable: false, reason: 'Checkout date must be after check-in date' };
    }

    const overlapQuery = {
      restaurantId,
      roomId,
      status: { $in: ['RESERVED', 'CHECKED_IN'] },
      checkInDate: { $lt: end },
      checkOutDate: { $gt: start },
    };

    if (excludeBookingId) {
      overlapQuery._id = { $ne: excludeBookingId };
    }

    const conflictingBooking = await HotelBooking.findOne(overlapQuery).lean();
    if (conflictingBooking) {
      return {
        isAvailable: false,
        reason: `Room is already reserved by ${conflictingBooking.guest.name} from ${new Date(conflictingBooking.checkInDate).toLocaleDateString()} to ${new Date(conflictingBooking.checkOutDate).toLocaleDateString()}`,
        conflictingBooking,
      };
    }

    return { isAvailable: true };
  }

  /**
   * Query all available rooms in a date range, with optional room type filter
   */
  async getAvailableRooms({ restaurantId, checkInDate, checkOutDate, roomTypeId = null }) {
    const start = new Date(checkInDate);
    const end = new Date(checkOutDate);

    const roomQuery = {
      restaurantId,
      isActive: true,
      status: { $ne: 'MAINTENANCE' },
    };
    if (roomTypeId) {
      roomQuery.roomTypeId = roomTypeId;
    }

    const allRooms = await HotelRoom.find(roomQuery).populate('roomTypeId').sort({ roomNumber: 1 }).lean();

    // Find all bookings overlapping with this range
    const overlappingBookings = await HotelBooking.find({
      restaurantId,
      status: { $in: ['RESERVED', 'CHECKED_IN'] },
      checkInDate: { $lt: end },
      checkOutDate: { $gt: start },
    }).select('roomId').lean();

    const bookedRoomIds = new Set(overlappingBookings.map((b) => b.roomId.toString()));

    return allRooms.filter((room) => !bookedRoomIds.has(room._id.toString()));
  }

  /**
   * Create a reservation or walk-in booking
   */
  async createBooking(restaurantId, bookingData, user) {
    const {
      roomId,
      guest,
      checkInDate,
      checkOutDate,
      adults = 1,
      children = 0,
      extraGuests = 0,
      agreedTariff,
      advancePayment = 0,
      paymentMethod = 'CASH',
      bookingNotes = '',
      specialRequests = '',
      isWalkIn = false,
    } = bookingData;

    if (!roomId) throw new Error('Room ID is required');
    if (!guest?.name?.trim() || !guest?.phone?.trim()) {
      throw new Error('Guest name and phone number are required');
    }
    if (!checkInDate || !checkOutDate) {
      throw new Error('Check-in and expected check-out dates are required');
    }

    const start = new Date(checkInDate);
    const end = new Date(checkOutDate);

    if (end <= start) {
      throw new Error('Expected check-out date must be after check-in date');
    }

    const availability = await this.checkRoomAvailability({
      restaurantId,
      roomId,
      checkInDate: start,
      checkOutDate: end,
    });

    if (!availability.isAvailable) {
      throw new Error(`Room unavailable: ${availability.reason}`);
    }

    const room = await HotelRoom.findOne({ _id: roomId, restaurantId }).populate('roomTypeId');
    if (!room) throw new Error('Room not found');

    const totalNights = this.calculateNights(start, end);
    const roomTariffPerNight = agreedTariff !== undefined ? Number(agreedTariff) : Number(room.baseTariff);
    const extraChargesTotal = Number(extraGuests) * (Number(room.extraPersonCharge) || 0) * totalNights;
    const roomChargesTotal = roomTariffPerNight * totalNights + extraChargesTotal;

    // Fetch tax percentage from restaurant or system settings
    const restaurant = await Restaurant.findById(restaurantId).select('gstPercentage name location phone email').lean();
    const settings = await SystemSettings.findOne().lean();
    const taxPercentage = restaurant?.gstPercentage ?? settings?.gstPercentage ?? 5;
    const taxAmount = roundMoney((roomChargesTotal * taxPercentage) / 100);
    const subtotal = roundMoney(roomChargesTotal);
    const discountAmount = roundMoney(bookingData.discount || 0);
    const totalAmount = Math.max(0, roundMoney(subtotal + taxAmount - discountAmount));

    const advance = roundMoney(advancePayment);
    if (advance > totalAmount) {
      throw new Error('Advance payment cannot exceed the total booking amount');
    }

    const paidAmount = advance;
    const outstandingBalance = roundMoney(totalAmount - paidAmount);

    const bookingReference = await this.generateBookingReference(restaurantId);

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    const isStartingToday = start <= todayEnd && end > todayStart;
    const canCheckInNow = Boolean(isWalkIn) && isStartingToday;
    const initialStatus = canCheckInNow ? 'CHECKED_IN' : 'RESERVED';

    const booking = new HotelBooking({
      restaurantId,
      bookingReference,
      roomId: room._id,
      roomNumber: room.roomNumber,
      roomTypeName: room.roomTypeId?.name || 'Standard',
      guest: {
        name: guest.name.trim(),
        phone: guest.phone.trim(),
        email: guest.email ? guest.email.trim() : '',
        address: guest.address ? guest.address.trim() : '',
        idType: guest.idType ? guest.idType.trim() : '',
        idNumber: guest.idNumber ? guest.idNumber.trim() : '',
      },
      checkInDate: start,
      checkOutDate: end,
      actualCheckInTime: canCheckInNow ? new Date() : null,
      adults: Number(adults),
      children: Number(children),
      extraGuests: Number(extraGuests),
      roomTariffPerNight,
      totalNights,
      subtotal,
      discount: discountAmount,
      taxPercentage,
      taxAmount,
      totalAmount,
      advancePayment: advance,
      paidAmount,
      outstandingBalance,
      status: initialStatus,
      bookingNotes,
      specialRequests,
      createdBy: user?._id || user?.id,
      checkedInBy: canCheckInNow ? user?._id || user?.id : null,
    });

    await booking.save();

    // If advance payment was made, record payment
    if (advance > 0) {
      const receiptNumber = await this.generateReceiptNumber(restaurantId);
      const payment = new HotelPayment({
        restaurantId,
        bookingId: booking._id,
        receiptNumber,
        paymentType: 'ADVANCE',
        amount: advance,
        paymentMethod,
        notes: `Advance payment for booking ${bookingReference}`,
        processedBy: user?._id || user?.id,
        paidAt: new Date(),
        status: 'COMPLETED',
      });
      await payment.save();
    }

    // Update room status ONLY if the booking starts today!
    if (canCheckInNow) {
      room.status = 'OCCUPIED';
      await room.save();
    } else if (isStartingToday) {
      room.status = 'RESERVED';
      await room.save();
    }
    // Future reservations do NOT set room status to OCCUPIED or RESERVED today; the room remains AVAILABLE for today!

    logger.info(`Booking created: ${booking.bookingReference} (Status: ${booking.status}) for Room ${room.roomNumber}`);
    return booking;
  }

  /**
   * Check in a reserved guest
   */
  async checkInGuest(restaurantId, bookingId, checkInData, user) {
    const booking = await HotelBooking.findOne({ _id: bookingId, restaurantId });
    if (!booking) throw new Error('Booking not found');

    if (booking.status !== 'RESERVED') {
      throw new Error(`Cannot check in. Current booking status is ${booking.status}`);
    }

    const room = await HotelRoom.findOne({ _id: booking.roomId, restaurantId });
    if (!room) throw new Error('Assigned room not found');

    if (room.status === 'OCCUPIED') {
      throw new Error(`Room ${room.roomNumber} is currently occupied by another guest`);
    }
    if (room.status === 'MAINTENANCE') {
      throw new Error(`Room ${room.roomNumber} is currently under maintenance`);
    }

    // Process optional additional advance at check-in
    const additionalAdvance = roundMoney(checkInData?.additionalAdvance || 0);
    if (additionalAdvance > 0) {
      const newPaid = roundMoney(booking.paidAmount + additionalAdvance);
      if (newPaid > booking.totalAmount) {
        throw new Error('Payment cannot exceed total booking amount');
      }
      booking.paidAmount = newPaid;
      booking.outstandingBalance = roundMoney(booking.totalAmount - newPaid);

      const receiptNumber = await this.generateReceiptNumber(restaurantId);
      const payment = new HotelPayment({
        restaurantId,
        bookingId: booking._id,
        receiptNumber,
        paymentType: 'ADVANCE',
        amount: additionalAdvance,
        paymentMethod: checkInData?.paymentMethod || 'CASH',
        notes: `Check-in advance payment for ${booking.bookingReference}`,
        processedBy: user?._id || user?.id,
        paidAt: new Date(),
        status: 'COMPLETED',
      });
      await payment.save();
    }

    booking.status = 'CHECKED_IN';
    booking.actualCheckInTime = new Date();
    booking.checkedInBy = user?._id || user?.id;

    if (checkInData?.idType) booking.guest.idType = checkInData.idType;
    if (checkInData?.idNumber) booking.guest.idNumber = checkInData.idNumber;

    await booking.save();

    room.status = 'OCCUPIED';
    await room.save();

    logger.info(`Guest checked in: ${booking.bookingReference} into Room ${room.roomNumber}`);
    return booking;
  }

  /**
   * Extend guest stay
   */
  async extendStay(restaurantId, bookingId, extensionData, user) {
    const { newCheckOutDate } = extensionData;
    if (!newCheckOutDate) throw new Error('New checkout date is required');

    const booking = await HotelBooking.findOne({ _id: bookingId, restaurantId });
    if (!booking) throw new Error('Booking not found');

    if (!['CHECKED_IN', 'RESERVED'].includes(booking.status)) {
      throw new Error(`Cannot extend stay. Booking status is ${booking.status}`);
    }

    const currentOut = new Date(booking.checkOutDate);
    const newOut = new Date(newCheckOutDate);

    if (newOut <= currentOut) {
      throw new Error('New check-out date must be strictly after the current check-out date');
    }

    // Check availability for the extension window
    const availability = await this.checkRoomAvailability({
      restaurantId,
      roomId: booking.roomId,
      checkInDate: currentOut,
      checkOutDate: newOut,
      excludeBookingId: booking._id,
    });

    if (!availability.isAvailable) {
      throw new Error(`Cannot extend stay: ${availability.reason}`);
    }

    const effectiveIn = booking.actualCheckInTime || booking.checkInDate;
    const newTotalNights = this.calculateNights(effectiveIn, newOut);
    const additionalNights = newTotalNights - booking.totalNights;
    const addedRoomCharges = booking.roomTariffPerNight * additionalNights;

    booking.checkOutDate = newOut;
    booking.totalNights = newTotalNights;
    booking.subtotal = roundMoney(booking.subtotal + addedRoomCharges);
    booking.taxAmount = roundMoney((booking.subtotal * booking.taxPercentage) / 100);
    booking.totalAmount = roundMoney(booking.subtotal + booking.taxAmount - booking.discount);
    booking.outstandingBalance = roundMoney(booking.totalAmount - booking.paidAmount);

    await booking.save();
    logger.info(`Stay extended for ${booking.bookingReference} to ${newOut.toISOString()}`);
    return booking;
  }

  /**
   * Add permitted additional charge to an active booking
   */
  async addAdditionalCharge(restaurantId, bookingId, chargeData, user) {
    const { title, amount } = chargeData;
    if (!title?.trim() || !amount || Number(amount) <= 0) {
      throw new Error('Valid charge title and positive amount are required');
    }

    const booking = await HotelBooking.findOne({ _id: bookingId, restaurantId });
    if (!booking) throw new Error('Booking not found');

    if (booking.status !== 'CHECKED_IN') {
      throw new Error('Additional charges can only be added to currently active (CHECKED_IN) stays');
    }

    const chargeAmount = roundMoney(amount);
    booking.additionalCharges.push({
      title: title.trim(),
      amount: chargeAmount,
      date: new Date(),
      addedBy: user?._id || user?.id,
    });

    booking.subtotal = roundMoney(booking.subtotal + chargeAmount);
    booking.taxAmount = roundMoney((booking.subtotal * booking.taxPercentage) / 100);
    booking.totalAmount = roundMoney(booking.subtotal + booking.taxAmount - booking.discount);
    booking.outstandingBalance = roundMoney(booking.totalAmount - booking.paidAmount);

    await booking.save();
    logger.info(`Additional charge added to ${booking.bookingReference}: ${title} (₹${chargeAmount})`);
    return booking;
  }

  /**
   * Checkout guest, settle bill, generate invoice
   */
  async checkoutGuest(restaurantId, bookingId, checkoutData, user) {
    const { paymentMethod = 'CASH', discount = 0, notes = '' } = checkoutData;

    const booking = await HotelBooking.findOne({ _id: bookingId, restaurantId });
    if (!booking) throw new Error('Booking not found');

    if (booking.status !== 'CHECKED_IN') {
      throw new Error(`Cannot checkout. Booking status is ${booking.status}`);
    }

    const room = await HotelRoom.findOne({ _id: booking.roomId, restaurantId });
    if (!room) throw new Error('Room not found');

    const actualCheckOutTime = new Date();
    const actualCheckInTime = booking.actualCheckInTime || booking.checkInDate;
    const billableNights = Math.max(1, this.calculateNights(actualCheckInTime, actualCheckOutTime));

    // Calculate room charges
    const roomChargesTotal = roundMoney(booking.roomTariffPerNight * billableNights);
    const additionalChargesTotal = roundMoney(
      booking.additionalCharges.reduce((sum, c) => sum + Number(c.amount || 0), 0)
    );

    const discountAmount = roundMoney(
      discount !== undefined && discount !== null && Number(discount) > 0
        ? discount
        : (booking.discount || 0)
    );
    const subtotal = roundMoney(roomChargesTotal + additionalChargesTotal);
    const taxPercentage = booking.taxPercentage || 5;
    const taxAmount = roundMoney((subtotal * taxPercentage) / 100);
    const totalAmount = Math.max(0, roundMoney(subtotal + taxAmount - discountAmount));

    const remainingBalance = Math.max(0, roundMoney(totalAmount - booking.paidAmount));

    // Record settlement payment if there is an unpaid balance
    let payment = null;
    if (remainingBalance > 0) {
      const receiptNumber = await this.generateReceiptNumber(restaurantId);
      payment = new HotelPayment({
        restaurantId,
        bookingId: booking._id,
        receiptNumber,
        paymentType: 'SETTLEMENT',
        amount: remainingBalance,
        paymentMethod,
        notes: notes || `Final checkout settlement for ${booking.bookingReference}`,
        processedBy: user?._id || user?.id,
        paidAt: new Date(),
        status: 'COMPLETED',
      });
      await payment.save();
    }

    const finalPaidAmount = roundMoney(booking.paidAmount + remainingBalance);

    // Create immutable HotelInvoice
    const invoiceNumber = await this.generateInvoiceNumber(restaurantId);
    const invoice = new HotelInvoice({
      restaurantId,
      bookingId: booking._id,
      invoiceNumber,
      guestName: booking.guest.name,
      guestPhone: booking.guest.phone,
      guestEmail: booking.guest.email || '',
      guestAddress: booking.guest.address || '',
      roomNumber: booking.roomNumber,
      roomTypeName: booking.roomTypeName,
      checkInDate: booking.checkInDate,
      checkOutDate: booking.checkOutDate,
      actualCheckInTime,
      actualCheckOutTime,
      billableNights,
      roomTariffPerNight: booking.roomTariffPerNight,
      roomChargesTotal,
      additionalChargesTotal,
      additionalCharges: booking.additionalCharges.map((c) => ({
        title: c.title,
        amount: c.amount,
        date: c.date,
      })),
      discount: discountAmount,
      taxPercentage,
      taxAmount,
      subtotal,
      totalAmount,
      advancePayment: booking.advancePayment || 0,
      totalPaid: finalPaidAmount,
      balanceAmount: 0,
      paymentMethod,
      paymentStatus: 'PAID',
      issuedBy: user?._id || user?.id,
      issuedAt: new Date(),
    });
    await invoice.save();

    // Update booking
    booking.status = 'CHECKED_OUT';
    booking.actualCheckOutTime = actualCheckOutTime;
    booking.totalNights = billableNights;
    booking.discount = discountAmount;
    booking.subtotal = subtotal;
    booking.taxAmount = taxAmount;
    booking.totalAmount = totalAmount;
    booking.paidAmount = finalPaidAmount;
    booking.outstandingBalance = 0;
    booking.checkedOutBy = user?._id || user?.id;
    booking.invoiceId = invoice._id;
    await booking.save();

    // Update room status to CLEANING
    room.status = 'CLEANING';
    await room.save();

    logger.info(`Guest checked out: ${booking.bookingReference}. Invoice generated: ${invoice.invoiceNumber}. Room moved to CLEANING.`);
    return { booking, invoice, payment };
  }

  /**
   * Cancel booking
   */
  async cancelBooking(restaurantId, bookingId, reason, user) {
    const booking = await HotelBooking.findOne({ _id: bookingId, restaurantId });
    if (!booking) throw new Error('Booking not found');

    if (booking.status !== 'RESERVED') {
      throw new Error(`Cannot cancel booking with status "${booking.status}". Only RESERVED bookings can be cancelled.`);
    }

    booking.status = 'CANCELLED';
    booking.cancellationReason = reason || 'Cancelled by guest request';
    booking.cancelledAt = new Date();
    await booking.save();

    // If room status is RESERVED for this booking, release room to AVAILABLE
    const room = await HotelRoom.findOne({ _id: booking.roomId, restaurantId });
    if (room && room.status === 'RESERVED') {
      room.status = 'AVAILABLE';
      await room.save();
    }

    logger.info(`Booking cancelled: ${booking.bookingReference} (Reason: ${booking.cancellationReason})`);
    return booking;
  }

  /**
   * Get all bookings with filtering & pagination
   */
  async getBookings(restaurantId, query = {}) {
    const { page = 1, limit = 20, status, search, roomId, fromDate, toDate } = query;
    const filter = { restaurantId };

    if (status && status !== 'ALL') {
      filter.status = status;
    }
    if (roomId) {
      filter.roomId = roomId;
    }
    if (fromDate || toDate) {
      filter.checkInDate = {};
      if (fromDate) filter.checkInDate.$gte = new Date(fromDate);
      if (toDate) filter.checkInDate.$lte = new Date(toDate);
    }
    if (search && search.trim()) {
      const q = search.trim();
      filter.$or = [
        { bookingReference: { $regex: q, $options: 'i' } },
        { 'guest.name': { $regex: q, $options: 'i' } },
        { 'guest.phone': { $regex: q, $options: 'i' } },
        { roomNumber: { $regex: q, $options: 'i' } },
      ];
    }

    const skip = (Number(page) - 1) * Number(limit);
    const [bookings, total] = await Promise.all([
      HotelBooking.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .populate('roomId')
        .populate('invoiceId')
        .populate('createdBy', 'name email role')
        .lean(),
      HotelBooking.countDocuments(filter),
    ]);

    return {
      bookings: bookings.map((b) => ({ ...b, id: b._id.toString() })),
      total,
      page: Number(page),
      limit: Number(limit),
      pages: Math.ceil(total / Number(limit)),
    };
  }

  /**
   * Get booking details by ID
   */
  async getBookingById(restaurantId, bookingId) {
    const booking = await HotelBooking.findOne({ _id: bookingId, restaurantId })
      .populate('roomId')
      .populate('createdBy', 'name email role')
      .populate('checkedInBy', 'name')
      .populate('checkedOutBy', 'name')
      .lean();

    if (!booking) throw new Error('Booking not found');

    const payments = await HotelPayment.find({ bookingId, restaurantId }).sort({ paidAt: -1 }).lean();
    const invoice = await HotelInvoice.findOne({ bookingId, restaurantId }).lean();

    return {
      ...booking,
      id: booking._id.toString(),
      payments,
      invoice: invoice || null,
    };
  }

  /**
   * Hotel Dashboard Statistics
   */
  async getDashboardStats(restaurantId) {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const [
      totalRooms,
      availableRooms,
      occupiedRooms,
      reservedRooms,
      cleaningRooms,
      maintenanceRooms,
      todayCheckIns,
      todayCheckOuts,
      activeStays,
      futureReservations,
      totalRevenueData,
      todayRevenueData,
    ] = await Promise.all([
      HotelRoom.countDocuments({ restaurantId, isActive: true }),
      HotelRoom.countDocuments({ restaurantId, isActive: true, status: 'AVAILABLE' }),
      HotelRoom.countDocuments({ restaurantId, isActive: true, status: 'OCCUPIED' }),
      HotelBooking.distinct('roomId', { restaurantId, status: 'RESERVED' }).then((ids) => ids.length),
      HotelRoom.countDocuments({ restaurantId, isActive: true, status: 'CLEANING' }),
      HotelRoom.countDocuments({ restaurantId, isActive: true, status: 'MAINTENANCE' }),
      HotelBooking.countDocuments({
        restaurantId,
        status: { $in: ['RESERVED', 'CHECKED_IN'] },
        checkInDate: { $gte: todayStart, $lte: todayEnd },
      }),
      HotelBooking.countDocuments({
        restaurantId,
        status: { $in: ['CHECKED_IN', 'CHECKED_OUT'] },
        checkOutDate: { $gte: todayStart, $lte: todayEnd },
      }),
      HotelBooking.countDocuments({ restaurantId, status: 'CHECKED_IN' }),
      HotelBooking.countDocuments({
        restaurantId,
        status: 'RESERVED',
        checkInDate: { $gt: todayEnd },
      }),
      HotelPayment.aggregate([
        { $match: { restaurantId: new mongoose.Types.ObjectId(restaurantId), status: 'COMPLETED' } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
      HotelPayment.aggregate([
        {
          $match: {
            restaurantId: new mongoose.Types.ObjectId(restaurantId),
            status: 'COMPLETED',
            paidAt: { $gte: todayStart, $lte: todayEnd },
          },
        },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
    ]);

    const occupancyRate = totalRooms > 0 ? Math.round((occupiedRooms / totalRooms) * 100) : 0;
    const totalRevenue = totalRevenueData[0]?.total || 0;
    const todayRevenue = todayRevenueData[0]?.total || 0;

    return {
      totalRooms,
      availableRooms,
      occupiedRooms,
      reservedRooms,
      futureReservations,
      cleaningRooms,
      maintenanceRooms,
      todayCheckIns,
      todayCheckOuts,
      activeStays,
      occupancyRate,
      totalRevenue: roundMoney(totalRevenue),
      todayRevenue: roundMoney(todayRevenue),
    };
  }

  /**
   * Hotel Reports & Analytics
   */
  async getHotelReports(restaurantId, fromDate, toDate) {
    const start = fromDate ? new Date(fromDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = toDate ? new Date(toDate) : new Date();

    const [revenueDaily, totalBookings, cancelledBookings, totalPayments, totalInvoices] = await Promise.all([
      HotelPayment.aggregate([
        {
          $match: {
            restaurantId: new mongoose.Types.ObjectId(restaurantId),
            status: 'COMPLETED',
            paidAt: { $gte: start, $lte: end },
          },
        },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$paidAt' } },
            revenue: { $sum: '$amount' },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      HotelBooking.countDocuments({
        restaurantId,
        createdAt: { $gte: start, $lte: end },
      }),
      HotelBooking.countDocuments({
        restaurantId,
        status: 'CANCELLED',
        createdAt: { $gte: start, $lte: end },
      }),
      HotelPayment.aggregate([
        {
          $match: {
            restaurantId: new mongoose.Types.ObjectId(restaurantId),
            status: 'COMPLETED',
            paidAt: { $gte: start, $lte: end },
          },
        },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
      HotelInvoice.countDocuments({
        restaurantId,
        issuedAt: { $gte: start, $lte: end },
      }),
    ]);

    return {
      revenueDaily,
      totalBookings,
      cancelledBookings,
      totalRevenue: roundMoney(totalPayments[0]?.total || 0),
      totalInvoices,
      period: { start, end },
    };
  }
}

module.exports = new HotelBookingService();
