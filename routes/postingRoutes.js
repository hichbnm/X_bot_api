/**
 * Clean Posting Routes - Simple API for creating posts and replies
 * Automatically uses stored auth tokens and guest_id
 * Developed By NihedBenAbdennour (website: nihedbenabdennour.me)
 */
const express = require('express');
const { body, validationResult } = require('express-validator');
const { v4: uuidv4 } = require('uuid');
const router = express.Router();
const xService = require('../services/xService');
const { createDirectPost, replyDirectToPost } = require('../utils/goStyleDirectApiFix');
const logger = require('../utils/logger');

// Validation middleware
const validatePost = [
  body('content').notEmpty().withMessage('Content is required')
    .isLength({ max: 280 }).withMessage('Content must be 280 characters or less')
];

const validateReply = [
  body('content').notEmpty().withMessage('Content is required')
    .isLength({ max: 280 }).withMessage('Content must be 280 characters or less'),
  body('url').notEmpty().withMessage('Post URL is required')
    .isURL().withMessage('Invalid URL format')
];

/**
 * POST /api/v1/post - Create new post (Puppeteer)
 * Creates a new post on X using browser automation
 */
router.post('/v1/post', validatePost, async (req, res) => {
  const requestId = uuidv4();
  
  try {
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        request_id: requestId,
        status: 'error',
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { content } = req.body;
    logger.info(`Creating new post via Puppeteer`, { requestId, content });

    // Create post using Puppeteer service
    const result = await xService.createPost(content);

    if (!result.success) {
      return res.status(400).json({
        request_id: requestId,
        status: 'error',
        message: result.message,
        data: {
          screenshot: result.screenshot
        }
      });
    }

    res.status(200).json({
      request_id: requestId,
      status: 'success',
      message: result.message,
      data: {
        screenshot: result.screenshot
      }
    });

  } catch (error) {
    logger.logError(error, req);
    res.status(500).json({
      request_id: requestId,
      status: 'error',
      message: 'Failed to create post',
      error: error.message
    });
  }
});

/**
 * POST /api/v1/reply - Reply to post (Puppeteer)
 * Replies to an existing post using browser automation
 */
router.post('/v1/reply', validateReply, async (req, res) => {
  const requestId = uuidv4();
  
  try {
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        request_id: requestId,
        status: 'error',
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { content, url } = req.body;
    logger.info(`Creating reply via Puppeteer`, { requestId, content, url });

    // Create reply using Puppeteer service
    const result = await xService.replyToPost(content, url);

    if (!result.success) {
      return res.status(400).json({
        request_id: requestId,
        status: 'error',
        message: result.message,
        data: {
          screenshot: result.screenshot
        }
      });
    }

    res.status(200).json({
      request_id: requestId,
      status: 'success',
      message: result.message,
      data: {
        screenshot: result.screenshot
      }
    });

  } catch (error) {
    logger.logError(error, req);
    res.status(500).json({
      request_id: requestId,
      status: 'error',
      message: 'Failed to create reply',
      error: error.message
    });
  }
});

/**
 * POST /api/direct/post - Create post (Direct API)
 * Creates a post using direct GraphQL API calls
 */
router.post('/direct/post', validatePost, async (req, res) => {
  const requestId = uuidv4();
  
  try {
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        request_id: requestId,
        status: 'error',
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { content } = req.body;
    logger.info(`Creating post via Direct API`, { requestId, content });

    // Create post using direct API (guest_id automatically retrieved)
    const result = await createDirectPost(content);

    if (!result.success) {
      return res.status(400).json({
        request_id: requestId,
        status: 'error',
        message: result.message,
        data: result.data || {}
      });
    }

    res.status(200).json({
      request_id: requestId,
      status: 'success',
      message: result.message,
      data: {
        tweetId: result.tweetId,
        apiResponse: result.data
      }
    });

  } catch (error) {
    logger.logError(error, req);
    res.status(500).json({
      request_id: requestId,
      status: 'error',
      message: 'Failed to create post via direct API',
      error: error.message
    });
  }
});

/**
 * POST /api/direct/reply - Reply to post (Direct API)
 * Replies to a post using direct GraphQL API calls
 */
router.post('/direct/reply', validateReply, async (req, res) => {
  const requestId = uuidv4();
  
  try {
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        request_id: requestId,
        status: 'error',
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { content, url } = req.body;
    logger.info(`Creating reply via Direct API`, { requestId, content, url });

    // Create reply using direct API (guest_id automatically retrieved)
    const result = await replyDirectToPost(content, url);

    if (!result.success) {
      return res.status(400).json({
        request_id: requestId,
        status: 'error',
        message: result.message,
        data: result.data || {}
      });
    }

    res.status(200).json({
      request_id: requestId,
      status: 'success',
      message: result.message,
      data: {
        replyTweetId: result.replyTweetId,
        originalTweetId: result.originalTweetId,
        apiResponse: result.data
      }
    });

  } catch (error) {
    logger.logError(error, req);
    res.status(500).json({
      request_id: requestId,
      status: 'error',
      message: 'Failed to create reply via direct API',
      error: error.message
    });
  }
});

module.exports = router;
