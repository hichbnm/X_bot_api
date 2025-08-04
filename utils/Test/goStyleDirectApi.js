/**
 * Go-Style Direct API
 * Exact 1:1 implementation matching the Go testPost.go approach
 */
const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');
const { generateXPFF } = require('../xpffGenerator');
const logger = require('../logger');
const { getCT0Cookie, getAuthToken } = require('../goCt0Manager');

// Constant bearer token - exactly the same as in Go
const BEARER_TOKEN = "AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA";

/**
 * Create a direct post exactly matching Go implementation
 * @param {string} content - Tweet content
 * @param {string} guestID - Guest ID for XPFF
 * @returns {Promise<Object>} Response object
 */
async function createDirectPost(content, guestID) {
  try {
    logger.info(`Creating direct post with content: ${content}`);
    
    // Get auth token
    const authToken = await getAuthToken();
    logger.info(`Auth token retrieved, length: ${authToken.length}`);
    
    // Get CT0 cookie using Go-style implementation
    const ct0 = await getCT0Cookie(authToken);
    logger.info(`CT0 cookie retrieved: ${ct0}`);
    
    // Generate XPFF header
    const xpff = await generateXPFF(guestID);
    logger.info(`XPFF header generated for guestID: ${guestID}`);
    
    // Create exact same body as Go
    const bodyObj = {
      variables: {
        tweet_text: `${content}\n`, // Notice the newline at the end (like Go)
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
    
    // Convert to string *before* setting Content-Length
    const bodyString = JSON.stringify(bodyObj);
    
    // Create headers in exact same order as Go
    const headers = {
      'Host': 'x.com',
      'Cookie': 'auth_token=' + authToken + '; ct0=' + ct0, // Exact Go format
      'Content-Length': Buffer.byteLength(bodyString).toString(),
      'Sec-Ch-Ua-Platform': '"Linux"',
      'Authorization': 'Bearer ' + BEARER_TOKEN,
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
    
    // Log important request details
    logger.info('=== GO-STYLE REQUEST DETAILS ===');
    logger.info(`Cookie: ${headers.Cookie}`);
    logger.info(`X-Csrf-Token: ${headers['X-Csrf-Token']}`);
    logger.info(`Content-Length: ${headers['Content-Length']}`);
    logger.info(`X-Xp-Forwarded-For: ${headers['X-Xp-Forwarded-For']}`);
    logger.info('=================================');
    
    // Make the API call with TLSClientConfig settings like Go
    // In Node.js, we use the rejectUnauthorized: false option
    const response = await axios({
      method: 'POST',
      url: 'https://x.com/i/api/graphql/F7hteriqzdRzvMfXM6Ul4w/CreateTweet',
      headers: headers,
      data: bodyString,
      httpsAgent: new (require('https').Agent)({ 
        rejectUnauthorized: false // Equivalent to InsecureSkipVerify: true in Go
      }),
      validateStatus: () => true, // Accept any status code like Go does
    });
    
    logger.info(`Response Status: ${response.status}`);
    
    // Handle response like Go
    if (response.status === 200) {
      logger.info('Post successful with status 200');
      
      // Log detailed response data
      logger.info('Response data:');
      logger.info(JSON.stringify(response.data, null, 2));
      
      // Check if response contains error details despite 200 status
      const hasErrors = response.data && 
                        (response.data.errors || 
                         (response.data.data && response.data.data.create_tweet && 
                          response.data.data.create_tweet.tweet_results && 
                          response.data.data.create_tweet.tweet_results.result && 
                          response.data.data.create_tweet.tweet_results.result.rest_id ? false : true));
      
      if (hasErrors) {
        logger.error('API returned 200 but contains errors or missing tweet ID');
        return {
          success: false, 
          message: 'Post attempt returned 200 but contains errors',
          data: response.data
        };
      }
      
      // Extract the tweet ID if available
      let tweetId = null;
      try {
        if (response.data && response.data.data && 
            response.data.data.create_tweet && 
            response.data.data.create_tweet.tweet_results && 
            response.data.data.create_tweet.tweet_results.result) {
          tweetId = response.data.data.create_tweet.tweet_results.result.rest_id;
        }
      } catch (e) {
        logger.warn('Could not extract tweet ID from response');
      }
      
      return {
        success: true, 
        message: 'Post published successfully via Go-style direct API',
        tweetId: tweetId,
        data: response.data
      };
    } else {
      logger.error(`Error in Go-style direct post. Status: ${response.status}`);
      logger.error(`Response: ${JSON.stringify(response.data)}`);
      return {
        success: false,
        message: `Failed to post: ${response.status}`,
        error: response.data
      };
    }
  } catch (error) {
    logger.error(`Exception in Go-style direct post: ${error.message}`);
    throw error;
  }
}

/**
 * Reply to a post using direct API - Go-style implementation
 * @param {string} content - Reply content
 * @param {string} postUrl - URL of the post to reply to
 * @param {string} guestID - Guest ID for XPFF
 * @returns {Promise<Object>} Response object
 */
async function replyDirectToPost(content, postUrl, guestID) {
  try {
    logger.info(`Creating direct reply to ${postUrl} with content: ${content}`);
    
    // Extract tweet ID from URL
    const tweetIdMatch = postUrl.match(/\/status\/(\d+)/);
    if (!tweetIdMatch) {
      throw new Error('Invalid post URL format');
    }
    const tweetId = tweetIdMatch[1];
    logger.info(`Extracted tweet ID: ${tweetId}`);
    
    // Get auth token
    const authToken = await getAuthToken();
    logger.info(`Auth token retrieved, length: ${authToken.length}`);
    
    // Get CT0 cookie using Go-style implementation
    const ct0 = await getCT0Cookie(authToken);
    logger.info(`CT0 cookie retrieved: ${ct0}`);
    
    // Generate XPFF header
    const xpff = await generateXPFF(guestID);
    logger.info(`XPFF header generated for guestID: ${guestID}`);
    
    // Create exact same body as Go, but ensure tweet ID is exactly as X expects it
    // X API requires the tweet ID to be a string, not a number
    const tweetIdString = tweetId.toString();
    
    logger.info(`Using tweet ID as string: ${tweetIdString}`);
    
    const bodyObj = {
      variables: {
        tweet_text: `${content}\n`, // Notice the newline at the end (like Go)
        reply: {
          in_reply_to_tweet_id: tweetIdString,
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
    
    // Convert to string *before* setting Content-Length
    const bodyString = JSON.stringify(bodyObj);
    
    // Create headers in exact same order as Go
    const headers = {
      'Host': 'x.com',
      'Cookie': 'auth_token=' + authToken + '; ct0=' + ct0, // Exact Go format
      'Content-Length': Buffer.byteLength(bodyString).toString(),
      'Sec-Ch-Ua-Platform': '"Linux"',
      'Authorization': 'Bearer ' + BEARER_TOKEN,
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
    
    // Log important request details
    logger.info('=== GO-STYLE REPLY REQUEST DETAILS ===');
    logger.info(`Cookie: ${headers.Cookie}`);
    logger.info(`X-Csrf-Token: ${headers['X-Csrf-Token']}`);
    logger.info(`Content-Length: ${headers['Content-Length']}`);
    logger.info(`X-Xp-Forwarded-For: ${headers['X-Xp-Forwarded-For']}`);
    logger.info(`Tweet ID: ${tweetId}`);
    logger.info('========================================');
    
    // Make the API call with TLSClientConfig settings like Go
    const response = await axios({
      method: 'POST',
      url: 'https://x.com/i/api/graphql/F7hteriqzdRzvMfXM6Ul4w/CreateTweet',
      headers: headers,
      data: bodyString,
      httpsAgent: new (require('https').Agent)({ 
        rejectUnauthorized: false // Equivalent to InsecureSkipVerify: true in Go
      }),
      validateStatus: () => true, // Accept any status code like Go does
    });
    
    logger.info(`Response Status: ${response.status}`);
    
    // Handle response like Go
    if (response.status === 200) {
      logger.info('Reply successful with status 200');
      
      // Log detailed response data
      logger.info('Response data:');
      logger.info(JSON.stringify(response.data, null, 2));
      
      // Check if response contains error details despite 200 status
      const hasErrors = response.data && 
                        (response.data.errors || 
                         (response.data.data && response.data.data.create_tweet && 
                          response.data.data.create_tweet.tweet_results && 
                          response.data.data.create_tweet.tweet_results.result && 
                          response.data.data.create_tweet.tweet_results.result.rest_id ? false : true));
      
      if (hasErrors) {
        logger.error('API returned 200 but contains errors or missing tweet ID');
        return {
          success: false, 
          message: 'Reply attempt returned 200 but contains errors',
          data: response.data
        };
      }
      
      return {
        success: true, 
        message: 'Reply published successfully via Go-style direct API',
        data: response.data
      };
    } else {
      logger.error(`Error in Go-style direct reply. Status: ${response.status}`);
      logger.error(`Response: ${JSON.stringify(response.data)}`);
      return {
        success: false,
        message: `Failed to reply: ${response.status}`,
        error: response.data
      };
    }
  } catch (error) {
    logger.error(`Exception in Go-style direct reply: ${error.message}`);
    throw error;
  }
}

module.exports = {
  createDirectPost,
  replyDirectToPost
};
