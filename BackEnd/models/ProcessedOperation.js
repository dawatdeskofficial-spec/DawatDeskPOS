const mongoose = require('mongoose');

const processedOperationSchema = new mongoose.Schema(
  {
    clientOperationId: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },
    endpoint: {
      type: String,
      required: true,
    },
    method: {
      type: String,
      required: true,
    },
    statusCode: {
      type: Number,
      required: true,
    },
    responseBody: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Expire idempotency records automatically after 7 days (604800 seconds)
processedOperationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 604800 });

module.exports = mongoose.model('ProcessedOperation', processedOperationSchema);
