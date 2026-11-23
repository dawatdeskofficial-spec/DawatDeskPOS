const mongoose = require('mongoose');

const statusHistorySchema = new mongoose.Schema(
  {
    status: {
      type: String,
      required: true,
      enum: ['PENDING', 'PROCESSING', 'ACCEPTED', 'SENT', 'DELIVERED', 'READ', 'FAILED'],
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
    details: {
      type: String,
      default: '',
    },
  },
  { _id: false }
);

const whatsAppDeliverySchema = new mongoose.Schema(
  {
    restaurantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Restaurant',
      required: [true, 'Restaurant ID is required'],
      index: true,
    },
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      required: [true, 'Order ID is required'],
      index: true,
    },
    paymentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Payment',
      required: [true, 'Payment ID is required'],
      index: true,
    },
    receiptNumber: {
      type: String,
      required: [true, 'Receipt Number is required'],
      index: true,
    },
    customerName: {
      type: String,
      default: '',
      trim: true,
    },
    recipientPhone: {
      type: String,
      required: [true, 'Recipient Phone is required'],
      trim: true,
    },
    formattedPhone: {
      type: String,
      default: '',
      trim: true,
    },
    deliveryMethod: {
      type: String,
      enum: ['AUTOMATIC', 'MANUAL_WAME'],
      default: 'AUTOMATIC',
    },
    deliveryStatus: {
      type: String,
      enum: ['PENDING', 'PROCESSING', 'ACCEPTED', 'SENT', 'DELIVERED', 'READ', 'FAILED'],
      default: 'PENDING',
      index: true,
    },
    providerMessageId: {
      type: String,
      default: null,
      sparse: true,
      index: true,
    },
    errorCode: {
      type: String,
      default: null,
    },
    errorMessage: {
      type: String,
      default: null,
    },
    retryCount: {
      type: Number,
      default: 0,
    },
    pdfUrl: {
      type: String,
      default: '',
    },
    pdfPath: {
      type: String,
      default: '',
    },
    sentAt: {
      type: Date,
      default: null,
    },
    deliveredAt: {
      type: Date,
      default: null,
    },
    readAt: {
      type: Date,
      default: null,
    },
    failedAt: {
      type: Date,
      default: null,
    },
    manualConfirmedAt: {
      type: Date,
      default: null,
    },
    statusHistory: [statusHistorySchema],
    offlinePending: {
      type: Boolean,
      default: false,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes for fast lookups
whatsAppDeliverySchema.index({ restaurantId: 1, paymentId: 1 });
whatsAppDeliverySchema.index({ restaurantId: 1, orderId: 1 });
whatsAppDeliverySchema.index({ restaurantId: 1, createdAt: -1 });

module.exports = mongoose.model('WhatsAppDelivery', whatsAppDeliverySchema);
