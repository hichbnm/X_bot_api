/**
 * X Platform API Routes
 * Developed By NihedBenAbdennour (website: nihedbenabdennour.me)
 */
const express = require('express');
const { body, validationResult } = require('express-validator');
const router = express.Router();
const xService = require('../services/xService');
const directApi = require('../utils/Test/directApi');
const logger = require('../utils/logger');

/**
 * GET /api/auth/token
 * Opens X login page and retrieves auth token after manual login
 * No request body needed
 */
router.get('/auth/token', async (req, res, next) => {
  try {
    logger.info('Starting auth token retrieval process');
    
    // Launch interactive browser window for login
    const result = await xService.getAuthToken();
    
    if (!result.success) {
      return res.status(400).json({
        status: 'error',
        message: result.message,
        error: result.error,
        data: {
          screenshot: result.screenshot,
          timestamp: new Date().toISOString()
        }
      });
    }
    
    res.status(200).json({
      status: 'success',
      message: result.message,
      data: {
        authToken: result.authToken, // Include the actual token in response
        tokenSaved: result.tokenSaved,
        tokenPath: result.tokenPath,
        screenshot: result.screenshot,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    logger.error(`Auth token retrieval failed: ${error.message}`, { stack: error.stack });
    next(error);
  }
});

/**
 * Route validation middleware
 */
const validateRequest = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    logger.warn(`Validation error in request: ${JSON.stringify(errors.array())}`);
    return res.status(400).json({
      status: 'error',
      errors: errors.array()
    });
  }
  next();
};

/**
 * @route   POST /api/post
 * @desc    Create a new post on X
 * @access  Private (requires bearer token)
 */
router.post('/post', [
  body('content')
    .trim()
    .notEmpty().withMessage('Post content is required')
    .isLength({ max: 280 }).withMessage('Post content cannot exceed 280 characters'),
], validateRequest, async (req, res) => {
  try {
    const { content } = req.body;
    
    logger.info(`Received post request: "${content.substring(0, 30)}..."`);
    
    const result = await xService.createPost(content);
    
    return res.status(200).json({
      status: 'success',
      message: 'Post created successfully',
      data: result
    });
  } catch (error) {
    logger.error(`Error creating post: ${error.message}`);
    
    // Check if error has screenshot information
    const errorResponse = {
      status: 'error',
      message: error.message
    };
    
    if (error.screenshot) {
      errorResponse.screenshot = error.screenshot;
    }
    
    return res.status(500).json(errorResponse);
  }
});

/**
 * @route   POST /api/reply
 * @desc    Reply to an existing post on X
 * @access  Private (requires bearer token)
 */
router.post('/reply', [
  body('content')
    .trim()
    .notEmpty().withMessage('Reply content is required')
    .isLength({ max: 280 }).withMessage('Reply content cannot exceed 280 characters'),
  body('postUrl')
    .trim()
    .notEmpty().withMessage('Post URL is required')
    .matches(/https?:\/\/(www\.)?(twitter|x)\.com\/[a-zA-Z0-9_]+\/status\/\d+/)
    .withMessage('Invalid Twitter/X post URL format')
], validateRequest, async (req, res) => {
  try {
    const { content, postUrl } = req.body;
    
    logger.info(`Received reply request to ${postUrl}: "${content.substring(0, 30)}..."`);
    
    const result = await xService.replyToPost(content, postUrl);
    
    return res.status(200).json({
      status: 'success',
      message: 'Reply posted successfully',
      data: result
    });
  } catch (error) {
    logger.error(`Error posting reply: ${error.message}`);
    
    // Check if error has screenshot information
    const errorResponse = {
      status: 'error',
      message: error.message
    };
    
    if (error.screenshot) {
      errorResponse.screenshot = error.screenshot;
    }
    
    return res.status(500).json(errorResponse);
  }
});

/**
 * @route   GET /api/session/status
 * @desc    Check current X session status
 * @access  Private (requires bearer token)
 */
router.get('/session/status', async (req, res) => {
  try {
    const status = await xService.checkSessionStatus();
    
    return res.status(200).json({
      status: 'success',
      data: status
    });
  } catch (error) {
    logger.error(`Error checking session status: ${error.message}`);
    
    return res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

module.exports = router;
