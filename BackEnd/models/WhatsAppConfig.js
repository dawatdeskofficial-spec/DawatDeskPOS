const mongoose = require('mongoose');
const { encrypt, decrypt } = require('../utils/cryptoUtils');

const whatsAppConfigSchema = new mongoose.Schema(
  {
    restaurantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Restaurant',
      required: [true, 'Restaurant ID is required'],
      unique: true,
      index: true,
    },
    isEnabled: {
      type: Boolean,
      default: true,
    },
    phoneNumberId: {
      type: String,
      default: '',
      trim: true,
    },
    businessAccountId: {
      type: String,
      default: '',
      trim: true,
    },
    accessToken: {
      type: String,
      default: '',
      set: (val) => (val ? encrypt(val) : ''),
      get: (val) => (val ? decrypt(val) : ''),
    },
    templateName: {
      type: String,
      default: 'dawatdesk_invoice_v1',
      trim: true,
    },
    templateLanguage: {
      type: String,
      default: 'en',
      trim: true,
    },
    autoSendDefault: {
      type: Boolean,
      default: true,
    },
    fallbackToSystem: {
      type: Boolean,
      default: true,
    },
    status: {
      type: String,
      enum: ['ACTIVE', 'INACTIVE', 'TEST_MODE'],
      default: 'ACTIVE',
    },
    lastTestedAt: {
      type: Date,
      default: null,
    },
    lastTestStatus: {
      type: String,
      default: null,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON: { getters: true },
    toObject: { getters: true },
  }
);

module.exports = mongoose.model('WhatsAppConfig', whatsAppConfigSchema);
