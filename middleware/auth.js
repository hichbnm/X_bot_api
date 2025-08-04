/**
 * Authentication Middleware
 * Developed By NihedBenAbdennour (website: nihedbenabdennour.me)
 */
const logger = require('../utils/logger');

/**
 * Middleware to authenticate API requests using Bearer token
 */
exports.authMiddleware = (req, res, next) => {
  try {
    // Get auth header
    const authHeader = req.headers.authorization;
    
    // Check if auth header exists and has correct format
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      logger.warn(`Authentication failed: No Bearer token provided - IP: ${req.ip}`);
      return res.status(401).json({
        status: 'error',
        message: 'Authentication required. Please provide a valid Bearer token.'
      });
    }
    
    // Extract token
    const token = authHeader.split(' ')[1];
    
    // Debug logging to help identify the issue
    logger.debug(`Received token: ${token}`);
    logger.debug(`Expected token: ${process.env.API_TOKEN}`);
    logger.debug(`Token match: ${token === process.env.API_TOKEN}`);
    
    // Validate token against the one stored in environment variables
    if (token !== process.env.API_TOKEN) {
      logger.warn(`Authentication failed: Invalid token provided - IP: ${req.ip}`);
      logger.warn(`Received: '${token}', Expected: '${process.env.API_TOKEN}'`);
      return res.status(403).json({
        status: 'error',
        message: 'Invalid authentication token.'
      });
    }
    
    // Authentication successful, proceed to next middleware
    logger.info(`Authentication successful - IP: ${req.ip}`);
    next();
  } catch (error) {
    logger.error(`Authentication error: ${error.message}`);
    return res.status(500).json({
      status: 'error',
      message: 'Authentication error occurred.'
    });
  }
};
