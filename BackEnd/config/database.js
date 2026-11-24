require('dotenv').config();

const dns = require('dns');
try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch (e) {
  // Ignore fallback if custom dns fails
}

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

    if (mongoose.connection.readyState === 1) {
      cached.conn = mongoose;
      return mongoose;
    }

    if (mongoose.connection.readyState === 0 || mongoose.connection.readyState === 3) {
      cached.promise = null;
      cached.conn = null;
    }

    if (!cached.promise) {
      const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.LAMBDA_TASK_ROOT);
      
      const opts = {
        family: 4,
        maxPoolSize: 10,
        minPoolSize: isServerless ? 0 : 1,
        autoIndex: process.env.NODE_ENV !== 'production' && !isServerless,
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
