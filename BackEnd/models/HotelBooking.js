const mongoose = require('mongoose');

const hotelBookingSchema = new mongoose.Schema(
  {
    restaurantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Restaurant',
      required: [true, 'Restaurant ID is required'],
      index: true,
    },
    bookingReference: {
      type: String,
      required: [true, 'Booking reference is required'],
      unique: true,
      index: true,
      trim: true,
    },
    roomId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'HotelRoom',
      required: [true, 'Room ID is required'],
      index: true,
    },
    roomNumber: {
      type: String,
      required: [true, 'Room number snapshot is required'],
      trim: true,
    },
    roomTypeName: {
      type: String,
      required: [true, 'Room type name snapshot is required'],
      trim: true,
    },
    guest: {
      name: {
        type: String,
        required: [true, 'Guest name is required'],
        trim: true,
      },
      phone: {
        type: String,
        required: [true, 'Guest phone number is required'],
        trim: true,
        index: true,
      },
      email: {
        type: String,
        trim: true,
        lowercase: true,
        default: '',
      },
      address: {
        type: String,
        trim: true,
        default: '',
      },
      idType: {
        type: String,
        trim: true,
        default: '', // Aadhaar, Passport, Driving License, Voter ID, Other
      },
      idNumber: {
        type: String,
        trim: true,
        default: '',
      },
    },
    checkInDate: {
      type: Date,
      required: [true, 'Check-in date is required'],
      index: true,
    },
    checkOutDate: {
      type: Date,
      required: [true, 'Expected checkout date is required'],
      index: true,
    },
    actualCheckInTime: {
      type: Date,
    },
    actualCheckOutTime: {
      type: Date,
    },
    adults: {
      type: Number,
      default: 1,
      min: [1, 'At least 1 adult is required'],
    },
    children: {
      type: Number,
      default: 0,
      min: [0, 'Children count cannot be negative'],
    },
    extraGuests: {
      type: Number,
      default: 0,
      min: [0, 'Extra guests count cannot be negative'],
    },
    roomTariffPerNight: {
      type: Number,
      required: [true, 'Room tariff per night snapshot is required'],
      min: [0, 'Tariff cannot be negative'],
    },
    totalNights: {
      type: Number,
      required: [true, 'Total nights is required'],
      min: [1, 'Stay must be at least 1 night'],
    },
    additionalCharges: [
      {
        title: {
          type: String,
          required: true,
          trim: true,
        },
        amount: {
          type: Number,
          required: true,
          min: 0,
        },
        date: {
          type: Date,
          default: Date.now,
        },
        addedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
        },
      },
    ],
    discount: {
      type: Number,
      default: 0,
      min: 0,
    },
    taxPercentage: {
      type: Number,
      default: 0,
      min: 0,
    },
    taxAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    subtotal: {
      type: Number,
      required: true,
      default: 0,
    },
    totalAmount: {
      type: Number,
      required: true,
      default: 0,
    },
    advancePayment: {
      type: Number,
      default: 0,
      min: 0,
    },
    paidAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    outstandingBalance: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: ['RESERVED', 'CHECKED_IN', 'CHECKED_OUT', 'CANCELLED', 'NO_SHOW'],
      default: 'RESERVED',
      index: true,
    },
    cancellationReason: {
      type: String,
      trim: true,
      default: '',
    },
    cancelledAt: {
      type: Date,
    },
    bookingNotes: {
      type: String,
      trim: true,
      default: '',
    },
    specialRequests: {
      type: String,
      trim: true,
      default: '',
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    checkedInBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    checkedOutBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    invoiceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'HotelInvoice',
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for query performance and date overlap checks
hotelBookingSchema.index({ restaurantId: 1, roomId: 1, status: 1 });
hotelBookingSchema.index({ roomId: 1, checkInDate: 1, checkOutDate: 1 });
hotelBookingSchema.index({ restaurantId: 1, status: 1, checkInDate: 1 });

module.exports = mongoose.model('HotelBooking', hotelBookingSchema);
