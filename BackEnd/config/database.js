require('dotenv').config();

const mongoose = require('mongoose');
const logger = require('../utils/logger');

// Global connection cache across serverless function invocations
let cached = global.mongoose;
if (!cached) {
  cached = global.mongoose = { conn: null, promise: null };
}

const connectDB = async () => {
  try {
    const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
    if (!uri) {
      throw new Error('MONGODB_URI is not defined in environment variables');
    }

    if (cached.conn && mongoose.connection.readyState === 1) {
      return cached.conn;
    }

    if (!cached.promise) {
      const opts = {
        family: 4,
        maxPoolSize: 10,
        minPoolSize: 1,
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 20000,
        connectTimeoutMS: 10000,
      };

      cached.promise = mongoose.connect(uri, opts).then((mongooseInstance) => {
        const host = mongooseInstance.connection.host || 'unknown-host';
        const message = `✅ MongoDB Atlas connected successfully: ${host}`;
        logger.info(message);
        return mongooseInstance;
      });
    }

    cached.conn = await cached.promise;
    return cached.conn;
  } catch (error) {
    cached.promise = null;
    cached.conn = null;
    const message = error && error.message ? error.message : String(error);
    const errorMessage = `❌ MongoDB Atlas Connection Error: ${message}`;
    console.error(errorMessage);
    logger.error(errorMessage);
    throw error;
  }
};

module.exports = connectDB;
