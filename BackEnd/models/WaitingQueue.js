const mongoose = require('mongoose');

const waitingQueueSchema = new mongoose.Schema(
  {
    restaurantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Restaurant',
      required: [true, 'Restaurant ID is required'],
    },
    queueNumber: {
      type: Number,
      default: 1,
    },
    customerName: {
      type: String,
      required: [true, 'Customer name is required'],
      trim: true,
    },
    customerPhone: {
      type: String,
      default: '',
      trim: true,
    },
    partySize: {
      type: Number,
      min: [1, 'Party size must be at least 1'],
      default: 2,
    },
    notes: {
      type: String,
      default: '',
      trim: true,
    },
    status: {
      type: String,
      enum: ['WAITING', 'CALLED', 'SEATED', 'COMPLETED', 'CANCELLED'],
      default: 'WAITING',
    },
    assignedTable: {
      type: Number,
      default: null,
    },
    priority: {
      type: String,
      enum: ['NORMAL', 'VIP', 'HIGH'],
      default: 'NORMAL',
    },
    estimatedWaitMinutes: {
      type: Number,
      default: 15,
    },
    calledAt: {
      type: Date,
      default: null,
    },
    seatedAt: {
      type: Date,
      default: null,
    },
    cancelledAt: {
      type: Date,
      default: null,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

waitingQueueSchema.index({ restaurantId: 1, status: 1 });
waitingQueueSchema.index({ restaurantId: 1, createdAt: 1 });

module.exports = mongoose.model('WaitingQueue', waitingQueueSchema);
