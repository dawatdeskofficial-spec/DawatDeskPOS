require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');

const connectDB = require('./config/database');
const errorHandler = require('./middlewares/errorHandler');
const logger = require('./utils/logger');

// Import routes
const authRoutes = require('./routes/authRoutes');
const restaurantRoutes = require('./routes/restaurantRoutes');
const menuRoutes = require('./routes/menuRoutes');
const categoryRoutes = require('./routes/categoryRoutes');
const orderRoutes = require('./routes/orderRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const userRoutes = require('./routes/userRoutes');
const systemSettingsRoutes = require('./routes/systemSettingsRoutes');
const waitingQueueRoutes = require('./routes/waitingQueueRoutes');

// Initialize Express app
const app = express();

// Middleware
const corsOptions = {
  origin: function (origin, callback) {
    // Allow any origin, or requests with no origin (like mobile apps or curl requests)
    callback(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'Accept',
    'Origin',
    'x-client-op-id',
    'x-idempotency-key',
    'X-Client-Op-Id',
    'X-Idempotency-Key',
    'clientOperationId',
    'clientoperationid',
  ],
  exposedHeaders: ['X-Idempotent-Replay'],
};

app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Logging middleware
app.use(
  morgan(process.env.VERCEL ? 'tiny' : 'combined', {
    stream: {
      write: (message) => logger.info(message.trim()),
    },
  })
);

const idempotencyMiddleware = require('./middlewares/idempotency');

// Health check routes
const handleHealthCheck = (req, res) => {
  res.json({
    success: true,
    status: 'ok',
    message: 'Server is running',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
  });
};

app.get('/health', handleHealthCheck);
app.get('/api/health', handleHealthCheck);

// Serverless DB Connection Middleware
app.use(async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (error) {
    logger.error(`Database connection failed before routing: ${error.message}`);
    res.status(500).json({ success: false, message: 'Database connection failed' });
  }
});

// Prevent stale caching on API routes in serverless / edge environments
app.use('/api', (req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  next();
});

// Idempotency middleware for mutating requests
app.use('/api', idempotencyMiddleware);

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/restaurants', restaurantRoutes);
app.use('/api/menu', menuRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/users', userRoutes);
app.use('/api/settings', systemSettingsRoutes);
app.use('/api/waiting-queue', waitingQueueRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
  });
});

// Global error handler
app.use(errorHandler);

// Connect to database and start server
const PORT = process.env.PORT || 5001;

const startServer = async () => {
  try {
    await connectDB();

    // Only start explicit listener if not running on Vercel serverless
    if (!process.env.VERCEL) {
      app.listen(PORT, () => {
        logger.info(`Server started successfully on port ${PORT}`);
        console.log(`\n🚀 Server is running on http://localhost:${PORT}`);
        console.log(`📝 API Base URL: http://localhost:${PORT}/api`);
        console.log(`✅ Health Check: http://localhost:${PORT}/health`);
      });
    } else {
       console.log(`\n🚀 Vercel Serverless API initialized`);
    }
  } catch (error) {
    const message = error && error.message ? error.message : String(error);
    console.error(`Server startup failed (DB connection?): ${message}`);
    logger.error(`Server startup failed: ${message}`);
    // Do not process.exit(1) on serverless environments to prevent "Function Crashed" errors
    if (!process.env.VERCEL) {
      process.exit(1);
    }
  }
};

startServer();

// Global crash prevention handlers
process.on('uncaughtException', (err) => {
  logger.error(`Uncaught Exception: ${err.message}`, { stack: err.stack });
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', { promise, reason });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received. Shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received. Shutting down gracefully...');
  process.exit(0);
});

module.exports = app;
