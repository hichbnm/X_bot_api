/**
 * Session Manager for X-Poster Service
 * Handles saving and loading session cookies
 * @author NihedBenAbdennour (website: nihedbenabdennour.me)
 */

const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');

// Path to store sessions
const SESSION_FILE_PATH = path.join(__dirname, '../data/session.json');

// Create data directory if it doesn't exist
const dataDir = path.dirname(SESSION_FILE_PATH);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

/**
 * Save session cookies to file
 * @param {Array} cookies - Array of cookie objects from Puppeteer
 * @returns {Promise<boolean>} Success status
 */
const saveSession = async (cookies) => {
  try {
    // Create a session object with cookies and timestamp
    const session = {
      cookies,
      timestamp: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24 hour expiration
    };
    
    // Write to file
    fs.writeFileSync(SESSION_FILE_PATH, JSON.stringify(session, null, 2));
    logger.info('Session saved successfully');
    return true;
  } catch (error) {
    logger.error(`Failed to save session: ${error.message}`);
    return false;
  }
};

/**
 * Get session cookies if they exist and are not expired
 * @returns {Promise<Array|null>} Array of cookie objects or null if no valid session
 */
const getSession = async () => {
  try {
    // Check if session file exists
    if (!fs.existsSync(SESSION_FILE_PATH)) {
      logger.info('No session file found');
      return null;
    }
    
    // Read and parse session file
    const sessionData = JSON.parse(fs.readFileSync(SESSION_FILE_PATH, 'utf8'));
    
    // Check if session is expired
    const expiresAt = new Date(sessionData.expiresAt);
    if (expiresAt < new Date()) {
      logger.info('Session is expired');
      return null;
    }
    
    logger.info(`Session loaded successfully, created at ${sessionData.timestamp}`);
    return sessionData.cookies;
  } catch (error) {
    logger.error(`Failed to load session: ${error.message}`);
    return null;
  }
};

/**
 * Delete the current session
 * @returns {Promise<boolean>} Success status
 */
const clearSession = async () => {
  try {
    if (fs.existsSync(SESSION_FILE_PATH)) {
      fs.unlinkSync(SESSION_FILE_PATH);
      logger.info('Session cleared successfully');
    } else {
      logger.info('No session file to clear');
    }
    return true;
  } catch (error) {
    logger.error(`Failed to clear session: ${error.message}`);
    return false;
  }
};

module.exports = {
  saveSession,
  getSession,
  clearSession
};
