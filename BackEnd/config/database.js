require('dotenv').config();

const mongoose = require('mongoose');
const logger = require('../utils/logger');

const connectDB = async () => {
  try {
    if (!process.env.MONGODB_URI) {
      throw new Error('MONGODB_URI is not defined in environment variables');
    }

    if (mongoose.connection.readyState >= 1) {
      console.log('✅ Using existing MongoDB connection');
      return;
    }

    console.log('MongoDB URI configured: true');

    await mongoose.connect(process.env.MONGODB_URI, {
      family: 4,
      serverSelectionTimeoutMS: 15000,
    });

    const host = mongoose.connection.host || 'unknown-host';
    const message = `✅ MongoDB Atlas connected successfully: ${host}`;
    console.log(message);
    logger.info(message);
  } catch (error) {
    const message = error && error.message ? error.message : String(error);
    const errorMessage = `❌ MongoDB Atlas Connection Error: ${message}`;
    console.error(errorMessage);
    logger.error(errorMessage);
    throw error;
  }
};

module.exports = connectDB;
