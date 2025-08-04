/**
 * X Platform Direct API Routes
 * Implements direct GraphQL API calls to X platform
 * Developed By NihedBenAbdennour (website: nihedbenabdennour.me)
 */
const express = require('express');
const { body, validationResult } = require('express-validator');
const router = express.Router();
// Using 100% Go-style implementation with enhanced reply validation
const { createDirectPost, replyDirectToPost } = require('../utils/goStyleDirectApiFix');
const logger = require('../utils/logger');

/**
 * Validation middleware
 */
const validateRequest = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    logger.error(`Validation errors: ${JSON.stringify(errors.array())}`);
    return res.status(400).json({
      status: 'error',
      errors: errors.array()
    });
  }
  next();
};

/**
 * @route   POST /api/direct/post
 * @desc    Create a new post on X using direct API
 * @access  Private (requires auth token)
 */
router.post('/post', [
  body('content')
    .trim()
    .notEmpty().withMessage('Post content is required')
    .isLength({ max: 280 }).withMessage('Post content cannot exceed 280 characters'),
  body('guest_id')
    .trim()
    .notEmpty().withMessage('Guest ID is required')
], validateRequest, async (req, res) => {
  try {
    const { content, guest_id } = req.body;
    
    logger.info(`Received direct post request: "${content.substring(0, 30)}..."`);
    
    const result = await createDirectPost(content, guest_id);
    
    return res.status(200).json({
      status: 'success',
      message: 'Post created successfully via direct API',
      data: result
    });
  } catch (error) {
    logger.error(`Error creating direct post: ${error.message}`);
    
    return res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

/**
 * @route   POST /api/direct/reply
 * @desc    Reply to an existing post on X using direct API
 * @access  Private (requires auth token)
 */
router.post('/reply', [
  body('content')
    .trim()
    .notEmpty().withMessage('Reply content is required')
    .isLength({ max: 280 }).withMessage('Reply content cannot exceed 280 characters'),
  body('post_url')
    .trim()
    .notEmpty().withMessage('Post URL is required')
    .matches(/https?:\/\/(www\.)?(twitter|x)\.com\/[a-zA-Z0-9_]+\/status\/\d+/)
    .withMessage('Invalid post URL format'),
  body('guest_id')
    .trim()
    .notEmpty().withMessage('Guest ID is required')
], validateRequest, async (req, res) => {
  try {
    const { content, post_url, guest_id } = req.body;
    
    logger.info(`Received direct reply request: "${content.substring(0, 30)}..." to post ${post_url}`);
    
    const result = await replyDirectToPost(content, post_url, guest_id);
    
    return res.status(200).json({
      status: 'success',
      message: 'Reply created successfully via direct API',
      data: result
    });
  } catch (error) {
    logger.error(`Error creating direct reply: ${error.message}`);
    
    return res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

module.exports = router;
