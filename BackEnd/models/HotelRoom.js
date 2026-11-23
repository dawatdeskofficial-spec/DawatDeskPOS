const mongoose = require('mongoose');

const hotelRoomSchema = new mongoose.Schema(
  {
    restaurantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Restaurant',
      required: [true, 'Restaurant ID is required'],
      index: true,
    },
    roomNumber: {
      type: String,
      required: [true, 'Room number is required'],
      trim: true,
      maxlength: [20, 'Room number cannot exceed 20 characters'],
    },
    roomTypeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'HotelRoomType',
      required: [true, 'Room type is required'],
      index: true,
    },
    floor: {
      type: String,
      trim: true,
      default: '1',
    },
    capacity: {
      type: Number,
      default: 2,
      min: [1, 'Capacity must be at least 1 person'],
    },
    baseTariff: {
      type: Number,
      required: [true, 'Base tariff is required'],
      min: [0, 'Tariff cannot be negative'],
    },
    extraPersonCharge: {
      type: Number,
      default: 0,
      min: [0, 'Extra person charge cannot be negative'],
    },
    description: {
      type: String,
      trim: true,
      default: '',
    },
    status: {
      type: String,
      enum: ['AVAILABLE', 'RESERVED', 'OCCUPIED', 'CLEANING', 'MAINTENANCE'],
      default: 'AVAILABLE',
      index: true,
    },
    maintenanceReason: {
      type: String,
      trim: true,
      default: '',
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// Unique room number per restaurant
hotelRoomSchema.index({ restaurantId: 1, roomNumber: 1 }, { unique: true });
hotelRoomSchema.index({ restaurantId: 1, status: 1 });

module.exports = mongoose.model('HotelRoom', hotelRoomSchema);
