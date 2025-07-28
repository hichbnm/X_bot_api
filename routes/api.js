/**
 * API Routes for X-Poster Service
 * @author NihedBenAbdennour (website: nihedbenabdennour.me)
 */

const express = require('express');
const { body, validationResult } = require('express-validator');
const router = express.Router();
const { postToX, replyToX } = require('../services/xService');
const logger = require('../utils/logger');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');

// Create logs directory if it doesn't exist
const logsDir = path.join(__dirname, '../logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Validation middleware
const validateRequest = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    logger.warn(`Request validation failed: ${JSON.stringify(errors.array())}`);
    return res.status(400).json({
      request_id: uuidv4(),
      status: 'error',
      message: 'Validation failed',
      data: { errors: errors.array() }
    });
  }
  next();
};

/**
 * @route POST /api/v1/post
 * @desc Post a new tweet to X
 * @access Private (requires bearer token)
 */
router.post('/v1/post', [
  body('content')
    .isString()
    .notEmpty()
    .withMessage('Content is required')
    .isLength({ max: 280 })
    .withMessage('Content must be 280 characters or less'),
  body('mediaUrls')
    .optional()
    .isArray()
    .withMessage('mediaUrls must be an array of strings'),
  body('mediaUrls.*')
    .optional()
    .isURL()
    .withMessage('Each media URL must be a valid URL'),
  validateRequest
], async (req, res) => {
  try {
    const requestId = uuidv4();
    const { content, media = [] } = req.body;
    
    // Build proxy configuration with validation
    let proxyConfig = null;
    
    if (process.env.PROXY_HOST && process.env.PROXY_PORT) {
      proxyConfig = {
        host: process.env.PROXY_HOST,
        port: process.env.PROXY_PORT
      };
      
      if (process.env.PROXY_USERNAME && process.env.PROXY_PASSWORD) {
        proxyConfig.username = process.env.PROXY_USERNAME;
        proxyConfig.password = process.env.PROXY_PASSWORD;
      }
      
      logger.info(`[${requestId}] Using proxy at ${process.env.PROXY_HOST}:${process.env.PROXY_PORT}`);
    } else {
      logger.warn(`[${requestId}] No proxy configuration found, will attempt direct connection`);
    }

    logger.info(`[${requestId}] New post request received: ${content.substring(0, 30)}...`);
    
    const result = await postToX(content, media, proxyConfig);
    
    if (result.success) {
      logger.info(`[${requestId}] Post successfully created: ${result.postId || 'ID unknown'}`);
      return res.status(200).json({
        request_id: requestId,
        status: 'success',
        message: 'Post successfully created',
        data: {
          post_id: result.postId,
          timestamp: result.timestamp
        }
      });
    } else {
      logger.error(`[${requestId}] Post creation failed: ${result.error}`);
      return res.status(500).json({
        request_id: requestId,
        status: 'error',
        message: result.error,
        data: {
          screenshot: result.screenshot
        }
      });
    }
  } catch (error) {
    const requestId = uuidv4();
    logger.error(`[${requestId}] Error in post endpoint: ${error.message}`);
    res.status(500).json({
      request_id: requestId,
      status: 'error',
      message: 'Internal server error',
      data: {}
    });
  }
});

/**
 * @route POST /api/v1/reply
 * @desc Reply to an existing tweet on X
 * @access Private (requires bearer token)
 */
router.post('/v1/reply', [
  body('url')
    .isString()
    .notEmpty()
    .withMessage('URL is required')
    .matches(/^https?:\/\/(twitter|x)\.com\/\w+\/status\/\d+/)
    .withMessage('URL must be a valid X/Twitter post URL'),
  body('content')
    .isString()
    .notEmpty()
    .withMessage('Content is required')
    .isLength({ max: 280 })
    .withMessage('Content must be 280 characters or less'),
  body('mediaUrls')
    .optional()
    .isArray()
    .withMessage('mediaUrls must be an array of strings'),
  body('mediaUrls.*')
    .optional()
    .isURL()
    .withMessage('Each media URL must be a valid URL'),
  validateRequest
], async (req, res) => {
  try {
    const requestId = uuidv4();
    const { url, content, media = [] } = req.body;
    
    // Build proxy configuration with validation
    let proxyConfig = null;
    
    if (process.env.PROXY_HOST && process.env.PROXY_PORT) {
      proxyConfig = {
        host: process.env.PROXY_HOST,
        port: process.env.PROXY_PORT
      };
      
      if (process.env.PROXY_USERNAME && process.env.PROXY_PASSWORD) {
        proxyConfig.username = process.env.PROXY_USERNAME;
        proxyConfig.password = process.env.PROXY_PASSWORD;
      }
      
      logger.info(`[${requestId}] Using proxy at ${process.env.PROXY_HOST}:${process.env.PROXY_PORT}`);
    } else {
      logger.warn(`[${requestId}] No proxy configuration found, will attempt direct connection`);
    }

    logger.info(`[${requestId}] New reply request received for: ${url}`);
    
    const result = await replyToX(url, content, media, proxyConfig);
    
    if (result.success) {
      logger.info(`[${requestId}] Reply successfully posted: ${result.replyId || 'ID unknown'}`);
      return res.status(200).json({
        request_id: requestId,
        status: 'success',
        message: 'Reply successfully posted',
        data: {
          reply_id: result.replyId,
          original_post_url: url,
          timestamp: result.timestamp
        }
      });
    } else {
      logger.error(`[${requestId}] Reply posting failed: ${result.error}`);
      return res.status(500).json({
        request_id: requestId,
        status: 'error',
        message: result.error,
        data: {
          screenshot: result.screenshot
        }
      });
    }
  } catch (error) {
    const requestId = uuidv4();
    logger.error(`[${requestId}] Error in reply endpoint: ${error.message}`);
    res.status(500).json({
      request_id: requestId,
      status: 'error',
      message: 'Internal server error',
      data: {}
    });
  }
});

/**
 * @route GET /api/v1/status
 * @desc Health check endpoint
 * @access Private (requires bearer token)
 */
router.get('/v1/status', (req, res) => {
  const requestId = uuidv4();
  res.status(200).json({
    request_id: requestId,
    status: 'success',
    message: 'System operational',
    data: {
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      version: require('../package.json').version
    }
  });
});

/**
 * @route GET /api/v1/logs
 * @desc Retrieve logs
 * @access Private (requires bearer token)
 */
router.get('/v1/logs', (req, res) => {
  const requestId = uuidv4();
  try {
    const logFiles = fs.readdirSync(logsDir)
      .filter(file => file.endsWith('.log'))
      .map(file => {
        const filePath = path.join(logsDir, file);
        const stats = fs.statSync(filePath);
        return {
          name: file,
          path: filePath,
          size: stats.size,
          modified: stats.mtime
        };
      });

    // Get the most recent log file or the one specified in query params
    const logFileName = req.query.file || 
      (logFiles.length > 0 ? 
        logFiles.sort((a, b) => b.modified - a.modified)[0].name : 
        null);

    if (!logFileName) {
      return res.status(404).json({
        request_id: requestId,
        status: 'error',
        message: 'No log files found',
        data: {}
      });
    }

    const logFilePath = path.join(logsDir, logFileName);
    
    // Check if file exists and is within logs directory (security check)
    if (!fs.existsSync(logFilePath) || !logFilePath.startsWith(logsDir)) {
      return res.status(404).json({
        request_id: requestId,
        status: 'error',
        message: 'Log file not found',
        data: {}
      });
    }
    
    // Read last N lines or with offset
    const lines = req.query.lines ? parseInt(req.query.lines) : 100;
    let content;
    
    if (lines > 0) {
      // This is a simplified implementation - in production you would use
      // a proper tail implementation to handle very large files efficiently
      const data = fs.readFileSync(logFilePath, 'utf8');
      const allLines = data.split('\n');
      content = allLines.slice(Math.max(0, allLines.length - lines)).join('\n');
    } else {
      content = fs.readFileSync(logFilePath, 'utf8');
    }
    
    return res.status(200).json({
      request_id: requestId,
      status: 'success',
      message: 'Log retrieved successfully',
      data: {
        filename: logFileName,
        content: content,
        available_logs: logFiles.map(f => f.name)
      }
    });
  } catch (error) {
    logger.error(`[${requestId}] Error retrieving logs: ${error.message}`);
    return res.status(500).json({
      request_id: requestId,
      status: 'error',
      message: 'Failed to retrieve logs',
      data: {}
    });
  }
});

/**
 * @route GET /api/v1/screenshots
 * @desc List available error screenshots
 * @access Private (requires bearer token)
 */
router.get('/v1/screenshots', (req, res) => {
  const requestId = uuidv4();
  try {
    const screenshotsDir = path.join(__dirname, '../screenshots');
    
    if (!fs.existsSync(screenshotsDir)) {
      return res.status(200).json({
        request_id: requestId,
        status: 'success',
        message: 'No screenshots found',
        data: { screenshots: [] }
      });
    }
    
    const screenshots = fs.readdirSync(screenshotsDir)
      .filter(file => file.endsWith('.png'))
      .map(file => {
        const filePath = path.join(screenshotsDir, file);
        const stats = fs.statSync(filePath);
        return {
          name: file,
          path: `/api/v1/screenshots/${file}`,
          size: stats.size,
          created: stats.birthtime
        };
      })
      .sort((a, b) => b.created - a.created);
    
    return res.status(200).json({
      request_id: requestId,
      status: 'success',
      message: 'Screenshots retrieved successfully',
      data: { screenshots }
    });
  } catch (error) {
    logger.error(`[${requestId}] Error retrieving screenshots: ${error.message}`);
    return res.status(500).json({
      request_id: requestId,
      status: 'error',
      message: 'Failed to retrieve screenshots',
      data: {}
    });
  }
});

/**
 * @route GET /api/v1/screenshots/:filename
 * @desc Get a specific screenshot
 * @access Private (requires bearer token)
 */
router.get('/v1/screenshots/:filename', (req, res) => {
  const requestId = uuidv4();
  try {
    const filename = req.params.filename;
    const screenshotPath = path.join(__dirname, '../screenshots', filename);
    
    // Security check to prevent directory traversal
    if (!screenshotPath.startsWith(path.join(__dirname, '../screenshots')) ||
        !fs.existsSync(screenshotPath) ||
        !filename.endsWith('.png')) {
      return res.status(404).json({
        request_id: requestId,
        status: 'error',
        message: 'Screenshot not found',
        data: {}
      });
    }
    
    res.sendFile(screenshotPath);
  } catch (error) {
    logger.error(`[${requestId}] Error serving screenshot: ${error.message}`);
    return res.status(500).json({
      request_id: requestId,
      status: 'error',
      message: 'Failed to serve screenshot',
      data: {}
    });
  }
});

module.exports = router;
