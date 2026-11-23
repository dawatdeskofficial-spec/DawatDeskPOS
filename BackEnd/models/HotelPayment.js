const mongoose = require('mongoose');

const hotelPaymentSchema = new mongoose.Schema(
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
    receiptNumber: {
      type: String,
      required: [true, 'Receipt number is required'],
      unique: true,
      index: true,
      trim: true,
    },
    paymentType: {
      type: String,
      enum: ['ADVANCE', 'INTERIM', 'SETTLEMENT', 'REFUND'],
      default: 'SETTLEMENT',
    },
    amount: {
      type: Number,
      required: [true, 'Amount is required'],
      min: [0, 'Amount cannot be negative'],
    },
    paymentMethod: {
      type: String,
      enum: ['CASH', 'CARD', 'DIGITAL_WALLET', 'CHEQUE', 'UPI', 'BANK_TRANSFER'],
      default: 'CASH',
    },
    status: {
      type: String,
      enum: ['COMPLETED', 'REFUNDED', 'FAILED'],
      default: 'COMPLETED',
    },
    notes: {
      type: String,
      trim: true,
      default: '',
    },
    processedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    paidAt: {
      type: Date,
      default: Date.now,
    },
    isRefunded: {
      type: Boolean,
      default: false,
    },
    refundReason: {
      type: String,
      trim: true,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

hotelPaymentSchema.index({ restaurantId: 1, bookingId: 1 });
hotelPaymentSchema.index({ restaurantId: 1, paidAt: -1 });

module.exports = mongoose.model('HotelPayment', hotelPaymentSchema);
