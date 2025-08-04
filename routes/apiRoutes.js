/**
 * API Routes for X GraphQL Direct Access
 * Implements HTTP-based posting and replying using X's GraphQL API
 * Developed By NihedBenAbdennour (website: nihedbenabdennour.me)
 */
const express = require('express');
const { body, validationResult } = require('express-validator');
const axios = require('axios');
const https = require('https');
const router = express.Router();
const logger = require('../utils/logger');
const { generateXPFF } = require('../utils/xpffGenerator');
const { getBearerToken } = require('../utils/tokenExtractor');
const { getCT0Cookie, getStoredAuthToken } = require('../utils/goCt0Manager');

/**
 * POST /api/direct/post
 * Creates a new post on X directly via GraphQL API
 * Uses the same approach as the Go implementation
 */
router.post('/direct/post', [
  body('content').notEmpty().withMessage('Content is required'),
  body('guestId').optional().isString().withMessage('Guest ID must be a string')
], async (req, res, next) => {
  try {
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        status: 'error',
        errors: errors.array()
      });
    }

    const { content, guestId = '' } = req.body;
    
    logger.info(`Starting direct post request for content: "${content.substring(0, 30)}..."`);
    
    // Get auth token
    const authToken = await getStoredAuthToken();
    if (!authToken) {
      return res.status(400).json({
        status: 'error',
        message: 'No auth token available. Please run /api/auth/token endpoint first.'
      });
    }
    
    // Get bearer token
    const bearerToken = await getBearerToken();
    
    // Get CT0 cookie
    const ct0 = await getCT0Cookie(authToken);
    
    // Generate XPFF header
    const xpff = generateXPFF(guestId);
    
    // Create headers
    const headers = {
      'Host': 'x.com',
      'Cookie': `auth_token=${authToken}; ct0=${ct0}`,
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${bearerToken}`,
      'X-Csrf-Token': ct0,
      'X-Twitter-Auth-Type': 'OAuth2Session',
      'X-Twitter-Active-User': 'yes',
      'X-Twitter-Client-Language': 'en',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'X-Xp-Forwarded-For': xpff,
      'Origin': 'https://x.com',
      'Referer': 'https://x.com/home'
    };
    
    // Create request body for CreateTweet GraphQL mutation
    const requestBody = {
      variables: {
        tweet_text: content,
        dark_request: false,
        media: {
          media_entities: [],
          possibly_sensitive: false
        },
        semantic_annotation_ids: []
      },
      features: {
        premium_content_api_read_enabled: false,
        communities_web_enable_tweet_community_results_fetch: true,
        c9s_tweet_anatomy_moderator_badge_enabled: true,
        responsive_web_grok_analyze_button_fetch_trends_enabled: false,
        responsive_web_jetfuel_frame: true,
        responsive_web_edit_tweet_api_enabled: true,
        graphql_is_translatable_rweb_tweet_is_translatable_enabled: true,
        view_counts_everywhere_api_enabled: true,
        longform_notetweets_consumption_enabled: true,
        responsive_web_twitter_article_tweet_consumption_enabled: true,
        tweet_awards_web_tipping_enabled: false
      },
      queryId: 'F7hteriqzdRzvMfXM6Ul4w'
    };
    
    // Make request to X GraphQL API
    const response = await axios({
      method: 'post',
      url: 'https://x.com/i/api/graphql/F7hteriqzdRzvMfXM6Ul4w/CreateTweet',
      headers: headers,
      data: requestBody,
      httpsAgent: new https.Agent({
        rejectUnauthorized: false
      })
    });
    
    logger.info('Direct post request successful');
    
    res.status(200).json({
      status: 'success',
      message: 'Post created successfully via direct API',
      data: {
        success: true,
        response: response.data,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    logger.error(`Direct post request failed: ${error.message}`, { stack: error.stack });
    next(error);
  }
});

/**
 * POST /api/direct/reply
 * Replies to a post on X directly via GraphQL API
 * Uses the same approach as the Go implementation
 */
router.post('/direct/reply', [
  body('content').notEmpty().withMessage('Content is required'),
  body('postUrl').notEmpty().withMessage('Post URL is required'),
  body('guestId').optional().isString().withMessage('Guest ID must be a string')
], async (req, res, next) => {
  try {
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        status: 'error',
        errors: errors.array()
      });
    }

    const { content, postUrl, guestId = '' } = req.body;
    
    logger.info(`Starting direct reply request for post URL: ${postUrl}`);
    
    // Extract tweet ID from URL
    const tweetIdMatch = postUrl.match(/status\/(\d+)/);
    if (!tweetIdMatch || !tweetIdMatch[1]) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid post URL. Could not extract tweet ID.'
      });
    }
    const tweetId = tweetIdMatch[1];
    
    // Get auth token
    const authToken = await getStoredAuthToken();
    if (!authToken) {
      return res.status(400).json({
        status: 'error',
        message: 'No auth token available. Please run /api/auth/token endpoint first.'
      });
    }
    
    // Get bearer token
    const bearerToken = await getBearerToken();
    
    // Get CT0 cookie
    const ct0 = await getCT0Cookie(authToken);
    
    // Generate XPFF header
    const xpff = generateXPFF(guestId);
    
    // Create headers
    const headers = {
      'Host': 'x.com',
      'Cookie': `auth_token=${authToken}; ct0=${ct0}`,
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${bearerToken}`,
      'X-Csrf-Token': ct0,
      'X-Twitter-Auth-Type': 'OAuth2Session',
      'X-Twitter-Active-User': 'yes',
      'X-Twitter-Client-Language': 'en',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'X-Xp-Forwarded-For': xpff,
      'Origin': 'https://x.com',
      'Referer': 'https://x.com/home'
    };
    
    // Create request body for CreateTweet GraphQL mutation with reply params
    const requestBody = {
      variables: {
        tweet_text: content,
        reply: {
          in_reply_to_tweet_id: tweetId,
          exclude_reply_user_ids: []
        },
        dark_request: false,
        media: {
          media_entities: [],
          possibly_sensitive: false
        },
        semantic_annotation_ids: []
      },
      features: {
        premium_content_api_read_enabled: false,
        communities_web_enable_tweet_community_results_fetch: true,
        c9s_tweet_anatomy_moderator_badge_enabled: true,
        responsive_web_grok_analyze_button_fetch_trends_enabled: false,
        responsive_web_jetfuel_frame: true,
        responsive_web_edit_tweet_api_enabled: true,
        graphql_is_translatable_rweb_tweet_is_translatable_enabled: true,
        view_counts_everywhere_api_enabled: true,
        longform_notetweets_consumption_enabled: true,
        responsive_web_twitter_article_tweet_consumption_enabled: true,
        tweet_awards_web_tipping_enabled: false
      },
      queryId: 'F7hteriqzdRzvMfXM6Ul4w'
    };
    
    // Make request to X GraphQL API
    const response = await axios({
      method: 'post',
      url: 'https://x.com/i/api/graphql/F7hteriqzdRzvMfXM6Ul4w/CreateTweet',
      headers: headers,
      data: requestBody,
      httpsAgent: new https.Agent({
        rejectUnauthorized: false
      })
    });
    
    logger.info('Direct reply request successful');
    
    res.status(200).json({
      status: 'success',
      message: 'Reply posted successfully via direct API',
      data: {
        success: true,
        tweetId: tweetId,
        response: response.data,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    logger.error(`Direct reply request failed: ${error.message}`, { stack: error.stack });
    next(error);
  }
});

/**
 * GET /api/direct/ct0
 * Gets a new CT0 cookie using the stored auth token
 */
router.get('/direct/ct0', async (req, res, next) => {
  try {
    logger.info('Starting CT0 cookie retrieval');
    
    // Get stored auth token
    const authToken = await getStoredAuthToken();
    if (!authToken) {
      return res.status(400).json({
        status: 'error',
        message: 'No auth token available. Please run /api/auth/token endpoint first.'
      });
    }
    
    // Get CT0 cookie
    const ct0 = await getCT0Cookie(authToken);
    
    res.status(200).json({
      status: 'success',
      message: 'CT0 cookie retrieved successfully',
      data: {
        ct0: ct0,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    logger.error(`CT0 cookie retrieval failed: ${error.message}`, { stack: error.stack });
    next(error);
  }
});

/**
 * GET /api/direct/bearer
 * Gets the bearer token from the main.js file
 */
router.get('/direct/bearer', async (req, res, next) => {
  try {
    logger.info('Starting bearer token retrieval');
    
    // Get bearer token
    const bearerToken = await getBearerToken();
    
    res.status(200).json({
      status: 'success',
      message: 'Bearer token retrieved successfully',
      data: {
        bearerToken: bearerToken,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    logger.error(`Bearer token retrieval failed: ${error.message}`, { stack: error.stack });
    next(error);
  }
});

module.exports = router;
