const mongoose = require('mongoose');

const hotelInvoiceSchema = new mongoose.Schema(
  {
    restaurantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Restaurant',
      required: [true, 'Restaurant ID is required'],
      index: true,
    },
    bookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'HotelBooking',
      required: [true, 'Booking ID is required'],
      index: true,
    },
    invoiceNumber: {
      type: String,
      required: [true, 'Invoice number is required'],
      unique: true,
      index: true,
      trim: true,
    },
    guestName: {
      type: String,
      required: true,
      trim: true,
    },
    guestPhone: {
      type: String,
      required: true,
      trim: true,
    },
    guestEmail: {
      type: String,
      trim: true,
      default: '',
    },
    guestAddress: {
      type: String,
      trim: true,
      default: '',
    },
    roomNumber: {
      type: String,
      required: true,
    },
    roomTypeName: {
      type: String,
      required: true,
    },
    checkInDate: {
      type: Date,
      required: true,
    },
    checkOutDate: {
      type: Date,
      required: true,
    },
    actualCheckInTime: {
      type: Date,
    },
    actualCheckOutTime: {
      type: Date,
    },
    billableNights: {
      type: Number,
      required: true,
      min: 1,
    },
    roomTariffPerNight: {
      type: Number,
      required: true,
    },
    roomChargesTotal: {
      type: Number,
      required: true,
    },
    additionalChargesTotal: {
      type: Number,
      default: 0,
    },
    additionalCharges: [
      {
        title: String,
        amount: Number,
        date: Date,
      },
    ],
    discount: {
      type: Number,
      default: 0,
    },
    taxPercentage: {
      type: Number,
      default: 0,
    },
    taxAmount: {
      type: Number,
      default: 0,
    },
    subtotal: {
      type: Number,
      required: true,
    },
    totalAmount: {
      type: Number,
      required: true,
    },
    advancePayment: {
      type: Number,
      default: 0,
    },
    totalPaid: {
      type: Number,
      required: true,
    },
    balanceAmount: {
      type: Number,
      default: 0,
    },
    paymentMethod: {
      type: String,
      default: 'CASH',
    },
    paymentStatus: {
      type: String,
      enum: ['PAID', 'PARTIALLY_PAID', 'UNPAID'],
      default: 'PAID',
    },
    issuedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    issuedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

hotelInvoiceSchema.index({ restaurantId: 1, invoiceNumber: 1 });
hotelInvoiceSchema.index({ restaurantId: 1, issuedAt: -1 });

module.exports = mongoose.model('HotelInvoice', hotelInvoiceSchema);
