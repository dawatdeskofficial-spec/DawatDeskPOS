const mongoose = require('mongoose');

const systemSettingsSchema = new mongoose.Schema(
  {
    gstPercentage: {
      type: Number,
      default: 5,
      min: [0, 'GST percentage cannot be negative'],
      max: [100, 'GST percentage cannot exceed 100'],
    },
    serviceChargePercentage: {
      type: Number,
      default: 0,
      min: [0, 'Service charge cannot be negative'],
      max: [100, 'Service charge cannot exceed 100'],
    },
    currency: {
      type: String,
      default: 'INR',
    },
    notificationsEnabled: {
      type: Boolean,
      default: true,
    },
    emailNotifications: {
      type: Boolean,
      default: true,
    },
    smsNotifications: {
      type: Boolean,
      default: false,
    },
    maintenanceMode: {
      type: Boolean,
      default: false,
    },
    maxOrdersPerTable: {
      type: Number,
      default: 5,
    },
    defaultPreparationTime: {
      type: Number,
      default: 15, // in minutes
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('SystemSettings', systemSettingsSchema);
