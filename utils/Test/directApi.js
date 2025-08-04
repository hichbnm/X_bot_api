/**
 * Direct API utilities for X (Twitter)
 * Implementation based on the Go version
 */
const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');
const { generateXPFF } = require('../xpffGenerator');
const { getBearerToken } = require('../tokenExtractor');
const { getCT0Cookie } = require('../cookieManager');
const { getHardcodedBearerToken } = require('../hardcodedTokens');
const logger = require('../logger');

/**
 * Generate headers needed for X API requests
 */
async function generateHeaders(authToken, ct0, bearerToken, guestID) {
  try {
    const xpff = await generateXPFF(guestID);
    
    return {
      'Host': 'x.com',
      'Cookie': `auth_token=${authToken}; ct0=${ct0}`,
      'Authorization': `Bearer ${bearerToken}`,
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
  } catch (error) {
    logger.error(`Error generating headers: ${error.message}`);
    throw error;
  }
}

/**
 * Post a tweet directly using X API
 */
async function createDirectPost(content, guestID) {
  try {
    logger.info(`Creating direct post with content length: ${content.length}`);
    
    // Get necessary tokens
    const bearerToken = await getBearerToken();
    const authToken = await fs.readFile(path.join(process.cwd(), 'auth_token.txt'), 'utf8');
    const ct0 = await getCT0Cookie(authToken.trim());
    
    // Prepare API call
    const headers = await generateHeaders(authToken.trim(), ct0, bearerToken, guestID);
    
    // Prepare request body - exactly matching the Go implementation
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
    
    // Make the API call
    const response = await axios({
      method: 'POST',
      url: 'https://x.com/i/api/graphql/F7hteriqzdRzvMfXM6Ul4w/CreateTweet',
      headers: headers,
      data: requestBody,
      validateStatus: () => true, // Accept any status code
    });
    
    logger.info(`Direct post API response status: ${response.status}`);
    
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
 * Reply to a tweet directly using X API
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
    
    // Get necessary tokens
    const bearerToken = await getBearerToken();
    const authToken = await fs.readFile(path.join(process.cwd(), 'auth_token.txt'), 'utf8');
    const ct0 = await getCT0Cookie(authToken.trim());
    
    // Prepare API call
    const headers = await generateHeaders(authToken.trim(), ct0, bearerToken, guestID);
    
    // Prepare request body - exactly matching the Go implementation
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
    
    // Make the API call
    const response = await axios({
      method: 'POST',
      url: 'https://x.com/i/api/graphql/F7hteriqzdRzvMfXM6Ul4w/CreateTweet',
      headers: headers,
      data: requestBody,
      validateStatus: () => true, // Accept any status code
    });
    
    logger.info(`Direct reply API response status: ${response.status}`);
    
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
