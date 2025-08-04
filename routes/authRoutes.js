/**
 * Authentication Routes - Clean API for X login and token extraction
 * Developed By NihedBenAbdennour (website: nihedbenabdennour.me)
 */
const express = require('express');
const { v4: uuidv4 } = require('uuid');
const router = express.Router();
const authManager = require('../utils/authManager');
const logger = require('../utils/logger');

/**
 * POST /api/auth/login
 * Complete authentication - extracts auth_token, guest_id, and CT0
 * Uses X_USERNAME and X_PASSWORD from .env for automated login
 * Falls back to manual login if credentials not provided
 */
router.post('/auth/login', async (req, res) => {
  const requestId = uuidv4();
  
  try {
    logger.info(`Starting complete authentication process`, { requestId });
    
    // Try automated login first if credentials are available
    let result = await authManager.automatedLogin();
    
    // If automated login fails, fall back to manual login
    if (!result.success) {
      logger.info('Automated login failed, falling back to manual login', { requestId });
      result = await authManager.manualLogin();
    }
    
    if (!result.success) {
      return res.status(400).json({
        request_id: requestId,
        status: 'error',
        message: result.message,
        data: {
          authToken: result.authToken,
          guestId: result.guestId,
          ct0: result.ct0
        }
      });
    }
    
    // Success response
    res.status(200).json({
      request_id: requestId,
      status: 'success',
      message: result.message,
      data: {
        authToken: result.authToken,
        guestId: result.guestId,
        ct0: result.ct0,
        loginMethod: result.message.includes('Automated') ? 'automated' : 'manual'
      }
    });
    
  } catch (error) {
    logger.logError(error, req);
    res.status(500).json({
      request_id: requestId,
      status: 'error',
      message: 'Authentication process failed',
      error: error.message
    });
  }
});

/**
 * GET /api/auth/manual
 * Manual authentication - opens browser for manual login
 * Extracts auth_token, guest_id, and CT0 after manual login
 */
router.get('/auth/manual', async (req, res) => {
  const requestId = uuidv4();
  
  try {
    logger.info(`Starting manual authentication process`, { requestId });
    
    const result = await authManager.manualLogin();
    
    if (!result.success) {
      return res.status(400).json({
        request_id: requestId,
        status: 'error',
        message: result.message,
        data: {
          authToken: result.authToken,
          guestId: result.guestId,
          ct0: result.ct0
        }
      });
    }
    
    res.status(200).json({
      request_id: requestId,
      status: 'success',
      message: result.message,
      data: {
        authToken: result.authToken,
        guestId: result.guestId,
        ct0: result.ct0
      }
    });
    
  } catch (error) {
    logger.logError(error, req);
    res.status(500).json({
      request_id: requestId,
      status: 'error',
      message: 'Manual authentication failed',
      error: error.message
    });
  }
});

/**
 * GET /api/auth/status
 * Check authentication status and available tokens
 */
router.get('/auth/status', async (req, res) => {
  const requestId = uuidv4();
  
  try {
    const authToken = await authManager.getStoredAuthToken();
    const guestId = await authManager.getStoredGuestId();
    const ct0 = await authManager.getStoredCT0();
    
    const status = {
      authenticated: !!(authToken && guestId),
      hasAuthToken: !!authToken,
      hasGuestId: !!guestId,
      hasCT0: !!ct0,
      authTokenPreview: authToken ? `${authToken.substring(0, 10)}...` : null,
      guestIdPreview: guestId ? `${guestId.substring(0, 15)}...` : null,
      ct0Preview: ct0 ? `${ct0.substring(0, 10)}...` : null
    };
    
    res.status(200).json({
      request_id: requestId,
      status: 'success',
      message: 'Authentication status retrieved',
      data: status
    });
    
  } catch (error) {
    logger.logError(error, req);
    res.status(500).json({
      request_id: requestId,
      status: 'error',
      message: 'Failed to check authentication status',
      error: error.message
    });
  }
});

/**
 * POST /api/auth/ct0
 * Get/refresh CT0 token using existing auth token
 */
router.post('/auth/ct0', async (req, res) => {
  const requestId = uuidv4();
  
  try {
    logger.info(`Refreshing CT0 token`, { requestId });
    
    const ct0 = await authManager.getCT0Token();
    
    res.status(200).json({
      request_id: requestId,
      status: 'success',
      message: 'CT0 token refreshed successfully',
      data: {
        ct0: ct0,
        ct0Preview: `${ct0.substring(0, 10)}...`
      }
    });
    
  } catch (error) {
    logger.logError(error, req);
    res.status(500).json({
      request_id: requestId,
      status: 'error',
      message: 'Failed to refresh CT0 token',
      error: error.message
    });
  }
});

module.exports = router;
