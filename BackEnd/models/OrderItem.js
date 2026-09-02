const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema(
  {
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      required: [true, 'Order ID is required'],
    },
    menuItemId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'MenuItem',
      required: [true, 'MenuItem ID is required'],
    },
    quantity: {
      type: Number,
      required: [true, 'Quantity is required'],
      min: [1, 'Quantity must be at least 1'],
    },
    price: {
      type: Number,
      required: [true, 'Price is required'],
      min: [0, 'Price cannot be negative'],
    },
    specialInstructions: {
      type: String,
      default: '',
    },
    kitchenBatch: {
      type: String,
      default: '',
    },
    status: {
      type: String,
      enum: ['PENDING', 'PREPARING', 'READY', 'DELIVERED', 'CANCELLED'],
      default: 'PENDING',
    },
  },
  {
    timestamps: true,
  }
);

// Index for faster queries
orderItemSchema.index({ orderId: 1 });
orderItemSchema.index({ menuItemId: 1 });

module.exports = mongoose.model('OrderItem', orderItemSchema);
