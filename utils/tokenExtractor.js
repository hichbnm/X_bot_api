/**
 * Bearer Token Extractor Utility
 * Extracts the bearer token from X (Twitter) main.js file
 * Developed By NihedBenAbdennour (website: nihedbenabdennour.me)
 */
const axios = require('axios');
const logger = require('./logger');

/**
 * Extracts the bearer token from X (Twitter) main.js file
 * @returns {Promise<string>} The bearer token
 */
async function getBearerToken() {
  try {
    // First, get the HTML page to find the main.js file URL
    const response = await axios.get('https://x.com', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
      }
    });

    // Extract main.js URL using regex with multiple patterns to be more robust
    const htmlContent = response.data;
    
    // Try multiple regex patterns to find the main.js URL
    const regexPatterns = [
      /<script defer="defer" src="(https:\/\/abs\.twimg\.com\/responsive-web\/client-web\/main\.[a-z0-9]+\.js)"/,
      /src="(https:\/\/abs\.twimg\.com\/responsive-web\/client-web\/main\.[a-z0-9]+\.js)"/,
      /"(https:\/\/abs\.twimg\.com\/responsive-web\/client-web\/main\.[a-z0-9]+\.js)"/,
      /(https:\/\/abs\.twimg\.com\/responsive-web\/client-web\/main\.[a-z0-9]+\.js)/
    ];
    
    let mainJsMatch = null;
    for (const pattern of regexPatterns) {
      mainJsMatch = htmlContent.match(pattern);
      if (mainJsMatch && mainJsMatch.length >= 2) {
        logger.info(`Found main.js URL using pattern: ${pattern}`);
        break;
      }
    }
    
    if (!mainJsMatch || mainJsMatch.length < 2) {
      logger.error('Failed to extract main.js URL from X homepage');
      throw new Error('Failed to extract main.js URL from X homepage');
    }
    
    const mainJsUrl = mainJsMatch[1];
    logger.info(`Found main.js URL: ${mainJsUrl}`);
    
    // Get the main.js file content
    const mainJsResponse = await axios.get(mainJsUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
      }
    });
    
    const jsContent = mainJsResponse.data;
    
    // Extract bearer token using regex
    // Try multiple patterns to find the bearer token
    logger.info('Searching for bearer token in main.js');
    
    // Save a sample of the JS content for debugging (first 1000 chars)
    logger.debug(`JS content sample: ${jsContent.substring(0, 1000)}...`);
    
    const bearerTokenPatterns = [
      /"([a-zA-Z0-9%]{100,})"/,  // Original pattern
      /AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D[a-zA-Z0-9%]+/,  // Exact token prefix
      /bearer_token:"([a-zA-Z0-9%]{100,})"/,  // Look for bearer_token property
      /"bearer_token":"([a-zA-Z0-9%]{100,})"/  // JSON format
    ];
    
    let bearerTokenMatch = null;
    for (const pattern of bearerTokenPatterns) {
      bearerTokenMatch = jsContent.match(pattern);
      if (bearerTokenMatch && bearerTokenMatch.length >= 1) {
        logger.info(`Found bearer token using pattern: ${pattern}`);
        break;
      }
    }
    
    // If the first match is the exact token (no capturing group), use it directly
    if (!bearerTokenMatch || bearerTokenMatch.length < 1) {
      logger.error('Failed to extract bearer token from main.js');
      
      // Fallback to hardcoded token if absolutely necessary
      logger.info('Using fallback bearer token');
      const fallbackToken = "AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA";
      logger.info('Bearer token (fallback) extracted successfully');
      return fallbackToken;
    }
    
    // Extract the token from the match and validate it
    let bearerToken;
    
    if (bearerTokenMatch[0].startsWith('AAAAAAAAAAAAAAAAAAAANR')) {
      // Direct match with the token itself (no capturing group)
      bearerToken = bearerTokenMatch[0];
      logger.info('Using direct bearer token match');
    } else if (bearerTokenMatch[1]) {
      // Match from a capturing group
      bearerToken = bearerTokenMatch[1];
      logger.info('Using capturing group bearer token match');
    } else {
      // This shouldn't happen based on our earlier check, but just in case
      logger.error('Unexpected bearer token format');
      throw new Error('Failed to extract bearer token from main.js');
    }
    
    logger.info('Bearer token extracted successfully');
    return bearerToken;
  } catch (error) {
    logger.error(`Error extracting bearer token: ${error.message}`, { stack: error.stack });
    throw error;
  }
}

module.exports = {
  getBearerToken
};
