/**
 * X-Poster Service - Automated X posting service using Puppeteer
 * @author NihedBenAbdennour (website: nihedbenabdennour.me)
 */

require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const { authMiddleware } = require('./middleware/auth');
const logger = require('./utils/logger');
const apiRoutes = require('./routes/api');

// Initialize express app
const app = express();
const PORT = process.env.PORT || 3000;

// Security and utility middleware
app.use(helmet());
app.use(express.json());
app.use(morgan('combined', { stream: { write: message => logger.info(message.trim()) } }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  standardHeaders: true,
  message: 'Too many requests from this IP, please try again later.'
});
app.use('/api', limiter);

// Auth middleware for all API routes
app.use('/api', authMiddleware);

// API routes
app.use('/api', apiRoutes);

// Base route
app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'X-Poster service is running' });
});

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error(`Error: ${err.message}`);
  logger.error(err.stack);
  res.status(err.status || 500).json({
    error: {
      message: err.message || 'Internal Server Error',
      status: err.status || 500
    }
  });
});

// Start server
app.listen(PORT, () => {
  logger.info(`X-Poster service started on port ${PORT}`);
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  // Graceful shutdown
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // Continue running
});
