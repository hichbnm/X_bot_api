/**
 * 403 Error Fix for X (Twitter) Direct API
 * Based on exact Go implementation and additional adjustments to fix 403 errors
 */
const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');
const { generateXPFF } = require('../xpffGenerator');
const logger = require('../logger');
const { getCT0Cookie } = require('./cookieManager');

/**
 * Hardcoded bearer token exactly matching Go implementation
 */
const BEARER_TOKEN = "AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA";

/**
 * Read auth token from file, checking both possible locations
 * @returns {Promise<string>} The auth token
 */
async function getAuthToken() {
  try {
    // Try data directory first (where it's actually saved according to user feedback)
    try {
      const token = await fs.readFile(path.join(process.cwd(), 'data', 'auth_token.txt'), 'utf8');
      return token.trim();
    } catch (firstError) {
      // Try root directory as fallback
      const token = await fs.readFile(path.join(process.cwd(), 'auth_token.txt'), 'utf8');
      return token.trim();
    }
  } catch (error) {
    throw new Error('Failed to read auth_token.txt');
  }
}

/**
 * Get CT0 cookie with detailed logging
 * @param {string} authToken - The auth token to use for CT0 retrieval
 * @returns {Promise<string>} The CT0 cookie value
 */
async function getReliableCT0(authToken) {
  try {
    // Get CT0 from cookieManager
    logger.info('Attempting to get CT0 cookie from cookieManager');
    const ct0 = await getCT0Cookie(authToken);
    
    if (!ct0) {
      throw new Error('CT0 cookie came back null or empty');
    }
    
    logger.info(`Successfully obtained CT0 cookie: ${ct0}`);
    return ct0;
  } catch (error) {
    logger.error(`Error getting CT0: ${error.message}`);
    // This is critical - we can't proceed without CT0
    throw new Error(`Failed to get CT0 cookie: ${error.message}`);
  }
}

/**
 * Generate headers for X API request with special focus on auth headers
 * @param {string} authToken - The auth token
 * @param {string} ct0 - The CT0 token 
 * @param {string} guestID - The guest ID for XPFF generation
 * @returns {Promise<Object>} Headers object
 */
async function generateRobustHeaders(authToken, ct0, guestID) {
  const xpff = await generateXPFF(guestID);
  
  // CRITICAL: Added double quotes around the auth_token and ct0 in Cookie header
  // This fixes many 403 errors in Go vs JS implementations
  const cookieHeader = `auth_token="${authToken}"; ct0="${ct0}"`;
  
  return {
    'Host': 'x.com',
    'Cookie': cookieHeader,
    'Sec-Ch-Ua-Platform': '"Linux"',
    'Authorization': `Bearer ${BEARER_TOKEN}`,
    'X-Csrf-Token': ct0,
    'Accept-Language': 'en-US,en;q=0.9',
    'Sec-Ch-Ua': '"Not)A;Brand";v="8", "Chromium";v="138"',
    'X-Twitter-Client-Language': 'en',
    'Sec-Ch-Ua-Mobile': '?0',
    'X-Twitter-Active-User': 'yes',
    'X-Client-Transaction-Id': 'PAtpENtMwY12l+8Tw4bvAj6EKHv6EWdZ9GJXlitAHYrL1dhK7KzWEAc93fI8N+iEE0tDBTiVuRJJov+NSnpm5MopwP3UPw',
    'X-Twitter-Auth-Type': 'OAuth2Session',
    'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36',
    'Content-Type': 'application/json',
    'X-Xp-Forwarded-For': xpff,
    'Accept': '*/*',
    'Origin': 'https://x.com',
    'Sec-Fetch-Site': 'same-origin',
    'Sec-Fetch-Mode': 'cors',
    'Sec-Fetch-Dest': 'empty',
    'Referer': 'https://x.com/home',
    'Priority': 'u=1, i',
  };
}

/**
 * Post a tweet directly using X API with special attention to fixing 403 errors
 * @param {string} content - The tweet content
 * @param {string} guestID - Guest ID for request
 * @returns {Promise<Object>} API response
 */
async function createDirectPost(content, guestID) {
  try {
    logger.info(`Creating direct post with content length: ${content.length} and guest ID: ${guestID}`);
    
    // Get auth token with detailed logging
    const authToken = await getAuthToken();
    logger.info(`Auth token retrieved, length: ${authToken.length}`);
    
    // Get CT0 with reliability improvements
    const ct0 = await getReliableCT0(authToken);
    
    // Prepare request body
    const requestBody = {
      variables: {
        tweet_text: `${content}\n`,
        dark_request: false,
        media: {
          media_entities: [],
          possibly_sensitive: false
        },
        semantic_annotation_ids: [],
        disallowed_reply_options: null
      },
      features: {
        premium_content_api_read_enabled: false,
        communities_web_enable_tweet_community_results_fetch: true,
        c9s_tweet_anatomy_moderator_badge_enabled: true,
        responsive_web_grok_analyze_button_fetch_trends_enabled: false,
        responsive_web_grok_analyze_post_followups_enabled: true,
        responsive_web_jetfuel_frame: true,
        responsive_web_grok_share_attachment_enabled: true,
        responsive_web_edit_tweet_api_enabled: true,
        graphql_is_translatable_rweb_tweet_is_translatable_enabled: true,
        view_counts_everywhere_api_enabled: true,
        longform_notetweets_consumption_enabled: true,
        responsive_web_twitter_article_tweet_consumption_enabled: true,
        tweet_awards_web_tipping_enabled: false,
        responsive_web_grok_show_grok_translated_post: false,
        responsive_web_grok_analysis_button_from_backend: true,
        creator_subscriptions_quote_tweet_preview_enabled: false,
        longform_notetweets_rich_text_read_enabled: true,
        longform_notetweets_inline_media_enabled: true,
        payments_enabled: false,
        profile_label_improvements_pcf_label_in_post_enabled: true,
        rweb_tipjar_consumption_enabled: true,
        verified_phone_label_enabled: false,
        articles_preview_enabled: true,
        responsive_web_grok_community_note_auto_translation_is_enabled: false,
        responsive_web_graphql_skip_user_profile_image_extensions_enabled: false,
        freedom_of_speech_not_reach_fetch_enabled: true,
        standardized_nudges_misinfo: true,
        tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled: true,
        responsive_web_grok_image_annotation_enabled: true,
        responsive_web_graphql_timeline_navigation_enabled: true,
        responsive_web_enhance_cards_enabled: false
      },
      queryId: "F7hteriqzdRzvMfXM6Ul4w"
    };
    
    const bodyString = JSON.stringify(requestBody);
    
    // Get headers with improved formatting for auth
    const headers = await generateRobustHeaders(authToken, ct0, guestID);
    
    // Add content-length after body is created - critical for matching Go implementation
    headers['Content-Length'] = Buffer.byteLength(bodyString).toString();
    
    // Log complete debug information
    logger.info('=== DIRECT POST REQUEST DETAILS ===');
    logger.info(`Auth Token: ${authToken.substring(0, 5)}...${authToken.substring(authToken.length - 5)}`);
    logger.info(`CT0 Token: ${ct0}`);
    logger.info(`Cookie Header: ${headers.Cookie}`);
    logger.info(`X-Csrf-Token: ${headers['X-Csrf-Token']}`);
    logger.info('===================================');
    
    // Make the API call with extensive error handling
    const response = await axios({
      method: 'POST',
      url: 'https://x.com/i/api/graphql/F7hteriqzdRzvMfXM6Ul4w/CreateTweet',
      headers: headers,
      data: bodyString,
      validateStatus: () => true, // Accept any status code
      timeout: 15000, // 15 second timeout
    });
    
    logger.info(`Direct post API response status: ${response.status}`);
    
    if (response.status === 403) {
      // Log special debug info for 403 errors
      logger.error('403 ERROR RECEIVED - DEBUGGING INFO:');
      logger.error(`Response headers: ${JSON.stringify(response.headers)}`);
      logger.error(`Response data: ${JSON.stringify(response.data)}`);
      
      throw new Error(`Direct post failed with 403 Forbidden - Auth error: ${JSON.stringify(response.data)}`);
    }
    
    // Check if the post was successful
    if (response.status === 200) {
      logger.info('Direct post successful');
      return {
        success: true,
        message: 'Post published successfully via direct API',
        timestamp: new Date().toISOString(),
        response: response.data
      };
    } else {
      logger.error(`Direct post failed with status ${response.status}: ${JSON.stringify(response.data)}`);
      throw new Error(`Direct post failed with status ${response.status}`);
    }
  } catch (error) {
    logger.error(`Error in direct post: ${error.message}`);
    throw error;
  }
}

/**
 * Reply to a tweet directly using X API with 403 error fixes
 * @param {string} content - The reply content 
 * @param {string} postUrl - URL of the post to reply to
 * @param {string} guestID - Guest ID for request
 * @returns {Promise<Object>} API response
 */
async function replyDirectToPost(content, postUrl, guestID) {
  try {
    logger.info(`Creating direct reply to ${postUrl} with content length: ${content.length}`);
    
    // Extract tweet ID from URL
    const tweetIdMatch = postUrl.match(/\/status\/(\d+)/);
    if (!tweetIdMatch) {
      throw new Error('Invalid post URL format');
    }
    const tweetId = tweetIdMatch[1];
    
    // Get auth token with detailed logging
    const authToken = await getAuthToken();
    logger.info(`Auth token retrieved, length: ${authToken.length}`);
    
    // Get CT0 with reliability improvements
    const ct0 = await getReliableCT0(authToken);
    
    // Prepare request body
    const requestBody = {
      variables: {
        tweet_text: `${content}\n`,
        reply: {
          in_reply_to_tweet_id: tweetId,
          exclude_reply_user_ids: []
        },
        dark_request: false,
        media: {
          media_entities: [],
          possibly_sensitive: false
        },
        semantic_annotation_ids: [],
        disallowed_reply_options: null
      },
      features: {
        premium_content_api_read_enabled: false,
        communities_web_enable_tweet_community_results_fetch: true,
        c9s_tweet_anatomy_moderator_badge_enabled: true,
        responsive_web_grok_analyze_button_fetch_trends_enabled: false,
        responsive_web_grok_analyze_post_followups_enabled: true,
        responsive_web_jetfuel_frame: true,
        responsive_web_grok_share_attachment_enabled: true,
        responsive_web_edit_tweet_api_enabled: true,
        graphql_is_translatable_rweb_tweet_is_translatable_enabled: true,
        view_counts_everywhere_api_enabled: true,
        longform_notetweets_consumption_enabled: true,
        responsive_web_twitter_article_tweet_consumption_enabled: true,
        tweet_awards_web_tipping_enabled: false,
        responsive_web_grok_show_grok_translated_post: false,
        responsive_web_grok_analysis_button_from_backend: true,
        creator_subscriptions_quote_tweet_preview_enabled: false,
        longform_notetweets_rich_text_read_enabled: true,
        longform_notetweets_inline_media_enabled: true,
        payments_enabled: false,
        profile_label_improvements_pcf_label_in_post_enabled: true,
        rweb_tipjar_consumption_enabled: true,
        verified_phone_label_enabled: false,
        articles_preview_enabled: true,
        responsive_web_grok_community_note_auto_translation_is_enabled: false,
        responsive_web_graphql_skip_user_profile_image_extensions_enabled: false,
        freedom_of_speech_not_reach_fetch_enabled: true,
        standardized_nudges_misinfo: true,
        tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled: true,
        responsive_web_grok_image_annotation_enabled: true,
        responsive_web_graphql_timeline_navigation_enabled: true,
        responsive_web_enhance_cards_enabled: false
      },
      queryId: "F7hteriqzdRzvMfXM6Ul4w"
    };
    
    const bodyString = JSON.stringify(requestBody);
    
    // Get headers with improved formatting for auth
    const headers = await generateRobustHeaders(authToken, ct0, guestID);
    
    // Add content-length after body is created - critical for matching Go implementation
    headers['Content-Length'] = Buffer.byteLength(bodyString).toString();
    
    // Log complete debug information
    logger.info('=== DIRECT REPLY REQUEST DETAILS ===');
    logger.info(`Auth Token: ${authToken.substring(0, 5)}...${authToken.substring(authToken.length - 5)}`);
    logger.info(`CT0 Token: ${ct0}`);
    logger.info(`Tweet ID: ${tweetId}`);
    logger.info(`Cookie Header: ${headers.Cookie}`);
    logger.info(`X-Csrf-Token: ${headers['X-Csrf-Token']}`);
    logger.info('=====================================');
    
    // Make the API call with extensive error handling
    const response = await axios({
      method: 'POST',
      url: 'https://x.com/i/api/graphql/F7hteriqzdRzvMfXM6Ul4w/CreateTweet',
      headers: headers,
      data: bodyString,
      validateStatus: () => true, // Accept any status code
      timeout: 15000, // 15 second timeout
    });
    
    logger.info(`Direct reply API response status: ${response.status}`);
    
    if (response.status === 403) {
      // Log special debug info for 403 errors
      logger.error('403 ERROR RECEIVED - DEBUGGING INFO:');
      logger.error(`Response headers: ${JSON.stringify(response.headers)}`);
      logger.error(`Response data: ${JSON.stringify(response.data)}`);
      
      throw new Error(`Direct reply failed with 403 Forbidden - Auth error: ${JSON.stringify(response.data)}`);
    }
    
    // Check if the reply was successful
    if (response.status === 200) {
      logger.info('Direct reply successful');
      return {
        success: true,
        message: 'Reply published successfully via direct API',
        timestamp: new Date().toISOString(),
        response: response.data
      };
    } else {
      logger.error(`Direct reply failed with status ${response.status}: ${JSON.stringify(response.data)}`);
      throw new Error(`Direct reply failed with status ${response.status}`);
    }
  } catch (error) {
    logger.error(`Error in direct reply: ${error.message}`);
    throw error;
  }
}

module.exports = {
  createDirectPost,
  replyDirectToPost
};
