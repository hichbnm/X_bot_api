/**
 * Authentication middleware for X-Poster Service
 * @author NihedBenAbdennour (website: nihedbenabdennour.me)
 */

const logger = require('../utils/logger');

/**
 * Middleware to validate bearer token
 */
const authMiddleware = (req, res, next) => {
  try {
    // Get authorization header
    const authHeader = req.headers.authorization;
    
    // Check if auth header exists and has the right format
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      logger.warn('Authentication failed: Invalid or missing token format');
      return res.status(401).json({ error: 'Unauthorized: Invalid or missing token' });
    }
    
    // Extract token
    const token = authHeader.split(' ')[1];
    
    // Validate token (simple comparison for now, could be JWT or more complex)
    const validToken = process.env.API_TOKEN || 'default_secure_token';
    
    if (token !== validToken) {
      logger.warn('Authentication failed: Invalid token provided');
      return res.status(401).json({ error: 'Unauthorized: Invalid token' });
    }
    
    // Auth successful, proceed
    next();
  } catch (error) {
    logger.error(`Authentication error: ${error.message}`);
    res.status(500).json({ error: 'Internal server error during authentication' });
  }
};

module.exports = {
  authMiddleware
};
