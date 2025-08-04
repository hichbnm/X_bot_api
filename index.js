/**
 * X-Posts Bot - Main Server Entry Point
 * Developed By NihedBenAbdennour (website: nihedbenabdennour.me)
 */
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { authMiddleware } = require('./middleware/auth');
const authRoutes = require('./routes/authRoutes');
const postingRoutes = require('./routes/postingRoutes');
const monitoringRoutes = require('./routes/monitoringRoutes');
const logger = require('./utils/logger');

// Create Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Apply security middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per window
  standardHeaders: true,
  message: 'Too many requests from this IP, please try again later',
});
app.use(limiter);

// Routes
app.get('/', (req, res) => {
  res.json({ 
    status: 'online', 
    service: 'X Posts Bot API',
    developer: 'Nihed Ben Abdennour',
    website: 'nihedbenabdennour.me'
  });
});

// Protected routes with auth middleware
app.use('/api', authMiddleware, authRoutes);        // Authentication endpoints
app.use('/api', authMiddleware, postingRoutes);     // Posting and reply endpoints
app.use('/api', authMiddleware, monitoringRoutes);  // System monitoring endpoints

// Error handling
app.use((err, req, res, next) => {
  logger.error(`Error: ${err.message}`);
  logger.error(err.stack);
  res.status(err.statusCode || 500).json({
    status: 'error',
    message: err.message || 'Internal server error'
  });
});

// Start server
app.listen(PORT, () => {
  logger.info(`✅ Server running on port ${PORT}`);
  logger.info(`🔐 API Authentication: Bearer Token`);
  logger.info(`🔑 Expected API Token: ${process.env.API_TOKEN}`);
  logger.info(`🤖 X Posts Bot service is ready`);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  logger.error('UNHANDLED REJECTION! 💥 Shutting down...');
  logger.error(err.name, err.message);
  process.exit(1);
});

// Handle SIGTERM
process.on('SIGTERM', () => {
  logger.info('👋 SIGTERM RECEIVED. Shutting down gracefully');
  process.exit(0);
});
