const HotelRoomType = require('../models/HotelRoomType');
const HotelRoom = require('../models/HotelRoom');
const HotelBooking = require('../models/HotelBooking');
const logger = require('../utils/logger');

class HotelRoomService {
  /**
   * Seed default room types if a restaurant has none configured yet
   */
  async ensureDefaultRoomTypes(restaurantId) {
    const existing = await HotelRoomType.countDocuments({ restaurantId });
    if (existing > 0) return;

    const defaults = [
      {
        restaurantId,
        name: 'Standard Room',
        description: 'Cozy and comfortable room suitable for solo travelers or couples.',
        baseTariff: 1200,
        capacity: 2,
        maxExtraGuests: 1,
        extraPersonCharge: 300,
        amenities: ['Air Conditioning', 'Free Wi-Fi', 'TV', 'En-suite Bathroom'],
      },
      {
        restaurantId,
        name: 'Deluxe Room',
        description: 'Spacious room with modern amenities, work desk, and balcony view.',
        baseTariff: 2000,
        capacity: 2,
        maxExtraGuests: 1,
        extraPersonCharge: 500,
        amenities: ['Air Conditioning', 'Free Wi-Fi', 'Smart TV', 'Balcony', 'Mini Fridge', 'Tea/Coffee Maker'],
      },
      {
        restaurantId,
        name: 'Executive Suite',
        description: 'Luxury suite with dedicated living area, king bed, and premium room service.',
        baseTariff: 3500,
        capacity: 3,
        maxExtraGuests: 2,
        extraPersonCharge: 700,
        amenities: ['King Bed', 'Living Area', 'Smart TV', 'High-speed Wi-Fi', 'Bathtub', 'Complimentary Breakfast'],
      },
    ];

    await HotelRoomType.insertMany(defaults);
    logger.info(`Default hotel room types seeded for restaurant ${restaurantId}`);
  }

  // ── ROOM TYPES ─────────────────────────────────────────────────────────────

  async getRoomTypes(restaurantId, activeOnly = false) {
    await this.ensureDefaultRoomTypes(restaurantId);
    const query = { restaurantId };
    if (activeOnly) {
      query.isActive = true;
    }
    return HotelRoomType.find(query).sort({ baseTariff: 1 }).lean();
  }

  async getRoomTypeById(restaurantId, typeId) {
    const roomType = await HotelRoomType.findOne({ _id: typeId, restaurantId }).lean();
    if (!roomType) {
      throw new Error('Room type not found');
    }
    return roomType;
  }

  async createRoomType(restaurantId, data) {
    const existing = await HotelRoomType.findOne({
      restaurantId,
      name: { $regex: new RegExp(`^${data.name.trim()}$`, 'i') },
    });
    if (existing) {
      throw new Error(`A room type named "${data.name}" already exists`);
    }

    const roomType = new HotelRoomType({
      ...data,
      restaurantId,
    });
    await roomType.save();
    logger.info(`Room type created: ${roomType._id} (${roomType.name})`);
    return roomType;
  }

  async updateRoomType(restaurantId, typeId, updateData) {
    if (updateData.name) {
      const existing = await HotelRoomType.findOne({
        restaurantId,
        _id: { $ne: typeId },
        name: { $regex: new RegExp(`^${updateData.name.trim()}$`, 'i') },
      });
      if (existing) {
        throw new Error(`A room type named "${updateData.name}" already exists`);
      }
    }

    const roomType = await HotelRoomType.findOneAndUpdate(
      { _id: typeId, restaurantId },
      updateData,
      { new: true, runValidators: true }
    );
    if (!roomType) {
      throw new Error('Room type not found');
    }
    return roomType;
  }

  async toggleRoomTypeStatus(restaurantId, typeId) {
    const roomType = await HotelRoomType.findOne({ _id: typeId, restaurantId });
    if (!roomType) {
      throw new Error('Room type not found');
    }
    roomType.isActive = !roomType.isActive;
    await roomType.save();
    return roomType;
  }

  // ── ROOMS ──────────────────────────────────────────────────────────────────

  async getRooms(restaurantId, filters = {}) {
    const query = { restaurantId };
    if (filters.status) {
      query.status = filters.status;
    }
    if (filters.roomTypeId) {
      query.roomTypeId = filters.roomTypeId;
    }
    if (filters.floor) {
      query.floor = filters.floor;
    }
    if (filters.isActive !== undefined) {
      query.isActive = filters.isActive === 'true' || filters.isActive === true;
    }
    if (filters.search) {
      query.roomNumber = { $regex: filters.search, $options: 'i' };
    }

    const rooms = await HotelRoom.find(query)
      .populate('roomTypeId')
      .sort({ roomNumber: 1 })
      .lean();

    // Attach active booking info for occupied/reserved rooms and upcoming reservations
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    const roomIds = rooms.map((r) => r._id);
    const bookings = await HotelBooking.find({
      restaurantId,
      roomId: { $in: roomIds },
      status: { $in: ['RESERVED', 'CHECKED_IN'] },
    })
      .select('bookingReference guest checkInDate checkOutDate status roomId roomNumber roomTypeName totalNights adults children extraGuests roomTariffPerNight subtotal taxAmount totalAmount advancePayment paidAmount outstandingBalance paymentMethod bookingNotes specialRequests createdAt')
      .sort({ checkInDate: 1 })
      .lean();

    const roomBookingsMap = {};
    for (const b of bookings) {
      const rId = b.roomId.toString();
      if (!roomBookingsMap[rId]) {
        roomBookingsMap[rId] = [];
      }
      roomBookingsMap[rId].push(b);
    }

    return rooms.map((room) => {
      const rId = room._id.toString();
      const rBookings = roomBookingsMap[rId] || [];

      // Current active stay today:
      const checkedInStay = rBookings.find((b) => b.status === 'CHECKED_IN');
      const todayReservation = rBookings.find((b) => {
        if (b.status !== 'RESERVED') return false;
        const inDate = new Date(b.checkInDate);
        const outDate = new Date(b.checkOutDate);
        return inDate <= todayEnd && outDate > todayStart;
      });

      const activeBooking = checkedInStay || todayReservation || null;

      // Earliest upcoming future reservation (checkInDate > todayEnd)
      const upcomingReservation = rBookings.find((b) => {
        return b.status === 'RESERVED' && new Date(b.checkInDate) > todayEnd;
      }) || null;

      // Real effective status for today:
      let effectiveStatus = room.status;
      if (room.status !== 'MAINTENANCE' && room.status !== 'CLEANING') {
        if (checkedInStay) {
          effectiveStatus = 'OCCUPIED';
        } else if (todayReservation) {
          effectiveStatus = 'RESERVED';
        } else {
          effectiveStatus = 'AVAILABLE';
        }
      }

      const bookedRanges = rBookings.map((b) => ({
        bookingId: b._id.toString(),
        bookingReference: b.bookingReference,
        checkInDate: b.checkInDate,
        checkOutDate: b.checkOutDate,
        guestName: b.guest?.name,
        guestPhone: b.guest?.phone,
        status: b.status,
      }));

      return {
        ...room,
        id: rId,
        status: effectiveStatus,
        activeBooking,
        upcomingReservation,
        bookedRanges,
      };
    });
  }

  async getRoomById(restaurantId, roomId) {
    const room = await HotelRoom.findOne({ _id: roomId, restaurantId })
      .populate('roomTypeId')
      .lean();
    if (!room) {
      throw new Error('Room not found');
    }

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    const rBookings = await HotelBooking.find({
      restaurantId,
      roomId,
      status: { $in: ['RESERVED', 'CHECKED_IN'] },
    })
      .sort({ checkInDate: 1 })
      .lean();

    const checkedInStay = rBookings.find((b) => b.status === 'CHECKED_IN');
    const todayReservation = rBookings.find((b) => {
      if (b.status !== 'RESERVED') return false;
      const inDate = new Date(b.checkInDate);
      const outDate = new Date(b.checkOutDate);
      return inDate <= todayEnd && outDate > todayStart;
    });

    const activeBooking = checkedInStay || todayReservation || null;
    const upcomingReservation = rBookings.find((b) => {
      return b.status === 'RESERVED' && new Date(b.checkInDate) > todayEnd;
    }) || null;

    let effectiveStatus = room.status;
    if (room.status !== 'MAINTENANCE' && room.status !== 'CLEANING') {
      if (checkedInStay) {
        effectiveStatus = 'OCCUPIED';
      } else if (todayReservation) {
        effectiveStatus = 'RESERVED';
      } else {
        effectiveStatus = 'AVAILABLE';
      }
    }

    return {
      ...room,
      id: room._id.toString(),
      status: effectiveStatus,
      activeBooking,
      upcomingReservation,
      bookedRanges: rBookings.map((b) => ({
        bookingId: b._id.toString(),
        bookingReference: b.bookingReference,
        checkInDate: b.checkInDate,
        checkOutDate: b.checkOutDate,
        guestName: b.guest?.name,
        guestPhone: b.guest?.phone,
        status: b.status,
      })),
    };
  }

  async createRoom(restaurantId, data) {
    const existing = await HotelRoom.findOne({
      restaurantId,
      roomNumber: data.roomNumber.trim(),
    });
    if (existing) {
      throw new Error(`Room number "${data.roomNumber}" already exists in this property`);
    }

    let roomType = null;
    if (data.roomTypeId) {
      roomType = await HotelRoomType.findOne({
        _id: data.roomTypeId,
        restaurantId,
      });
    }
    if (!roomType) {
      roomType = await HotelRoomType.findOne({ restaurantId });
    }
    if (!roomType) {
      const defaultTypes = await this.seedDefaultRoomTypes(restaurantId);
      roomType = defaultTypes[0];
    }

    const room = new HotelRoom({
      ...data,
      restaurantId,
      roomTypeId: roomType?._id,
      roomNumber: data.roomNumber.trim(),
      baseTariff: data.baseTariff !== undefined ? Number(data.baseTariff) : (roomType?.baseTariff || 1500),
      extraPersonCharge: data.extraPersonCharge !== undefined ? Number(data.extraPersonCharge) : (roomType?.extraPersonCharge || 0),
      capacity: data.capacity !== undefined ? Number(data.capacity) : (roomType?.capacity || 2),
    });

    await room.save();
    logger.info(`Room created: ${room.roomNumber} (${roomType.name}) for restaurant ${restaurantId}`);
    return room;
  }

  async updateRoom(restaurantId, roomId, updateData) {
    if (updateData.roomNumber) {
      const existing = await HotelRoom.findOne({
        restaurantId,
        _id: { $ne: roomId },
        roomNumber: updateData.roomNumber.trim(),
      });
      if (existing) {
        throw new Error(`Room number "${updateData.roomNumber}" already exists`);
      }
      updateData.roomNumber = updateData.roomNumber.trim();
    }

    if (updateData.roomTypeId) {
      const roomType = await HotelRoomType.findOne({
        _id: updateData.roomTypeId,
        restaurantId,
      });
      if (!roomType) {
        throw new Error('Selected room type does not exist');
      }
    }

    const room = await HotelRoom.findOneAndUpdate(
      { _id: roomId, restaurantId },
      updateData,
      { new: true, runValidators: true }
    ).populate('roomTypeId');

    if (!room) {
      throw new Error('Room not found');
    }
    return room;
  }

  async toggleRoomStatus(restaurantId, roomId) {
    const room = await HotelRoom.findOne({ _id: roomId, restaurantId });
    if (!room) {
      throw new Error('Room not found');
    }
    room.isActive = !room.isActive;
    await room.save();
    return room;
  }

  async deleteRoom(restaurantId, roomId) {
    const room = await HotelRoom.findOne({ _id: roomId, restaurantId });
    if (!room) {
      throw new Error('Room not found');
    }

    // Check if room has active bookings (OCCUPIED, RESERVED, or CHECKED_IN)
    const activeBooking = await HotelBooking.findOne({
      restaurantId,
      roomId,
      status: { $in: ['RESERVED', 'CHECKED_IN'] },
    });
    if (activeBooking) {
      const isOccupied = activeBooking.status === 'CHECKED_IN';
      const guestName = activeBooking.guest?.name || 'guest';
      throw new Error(
        `Cannot remove Room ${room.roomNumber}: it is currently ${isOccupied ? 'occupied by ' + guestName : 'reserved'}. Please complete checkout or cancel active bookings first.`
      );
    }

    // Check if room has historical bookings
    const historicalBookingsCount = await HotelBooking.countDocuments({
      restaurantId,
      roomId,
    });

    if (historicalBookingsCount > 0) {
      // Deactivate room to protect historical billing records & invoices
      room.isActive = false;
      await room.save();
      logger.info(
        `Room ${room.roomNumber} has ${historicalBookingsCount} historical bookings. Deactivated & archived.`
      );
      return {
        room,
        action: 'DEACTIVATED',
        historicalCount: historicalBookingsCount,
        message: `Room ${room.roomNumber} has ${historicalBookingsCount} past booking and invoice record(s). It has been deactivated and removed from active booking inventory to preserve financial records.`,
      };
    }

    // If zero historical bookings, permanently remove the room
    await HotelRoom.deleteOne({ _id: roomId, restaurantId });
    logger.info(`Room ${room.roomNumber} permanently deleted for restaurant ${restaurantId}`);
    return {
      room,
      action: 'DELETED',
      historicalCount: 0,
      message: `Room ${room.roomNumber} has been removed successfully.`,
    };
  }

  async updateHousekeepingStatus(restaurantId, roomId, status, maintenanceReason = '') {
    const validStatuses = ['AVAILABLE', 'CLEANING', 'MAINTENANCE'];
    if (!validStatuses.includes(status)) {
      throw new Error(`Invalid status. Must be one of: ${validStatuses.join(', ')}`);
    }

    const room = await HotelRoom.findOne({ _id: roomId, restaurantId });
    if (!room) {
      throw new Error('Room not found');
    }

    if (room.status === 'OCCUPIED' && status === 'MAINTENANCE') {
      throw new Error('Cannot put an occupied room under maintenance. Guest must be checked out first.');
    }

    room.status = status;
    room.maintenanceReason = status === 'MAINTENANCE' ? maintenanceReason : '';
    await room.save();

    logger.info(`Room ${room.roomNumber} status updated to ${status}`);
    return room;
  }
}

module.exports = new HotelRoomService();
