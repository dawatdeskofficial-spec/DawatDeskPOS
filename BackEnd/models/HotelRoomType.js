const mongoose = require('mongoose');

const hotelRoomTypeSchema = new mongoose.Schema(
  {
    restaurantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Restaurant',
      required: [true, 'Restaurant ID is required'],
      index: true,
    },
    name: {
      type: String,
      required: [true, 'Room type name is required'],
      trim: true,
      maxlength: [100, 'Name cannot exceed 100 characters'],
    },
    description: {
      type: String,
      trim: true,
      default: '',
    },
    baseTariff: {
      type: Number,
      required: [true, 'Base tariff per night is required'],
      min: [0, 'Base tariff cannot be negative'],
    },
    capacity: {
      type: Number,
      default: 2,
      min: [1, 'Capacity must be at least 1 person'],
    },
    maxExtraGuests: {
      type: Number,
      default: 1,
      min: [0, 'Max extra guests cannot be negative'],
    },
    extraPersonCharge: {
      type: Number,
      default: 0,
      min: [0, 'Extra person charge cannot be negative'],
    },
    amenities: {
      type: [String],
      default: ['Air Conditioning', 'Free Wi-Fi', 'TV', 'En-suite Bathroom'],
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

// Compound index to ensure room type name is unique per restaurant
hotelRoomTypeSchema.index({ restaurantId: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('HotelRoomType', hotelRoomTypeSchema);
