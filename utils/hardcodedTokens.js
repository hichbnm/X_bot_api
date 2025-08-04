/**
 * Hardcoded Tokens Utility
 * Provides fallback token values when dynamic extraction fails
 * Developed By NihedBenAbdennour (website: nihedbenabdennour.me)
 */
const logger = require('./logger');

/**
 * Returns a hardcoded bearer token for X API calls
 * This is a reliable fallback when dynamic extraction fails
 * @returns {string} A valid bearer token for X API
 */
function getHardcodedBearerToken() {
  logger.info('Using hardcoded bearer token');
  return "AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA";
}

/**
 * Returns a dummy CT0 value when cookie extraction fails
 * Note: This is a fallback only - real CT0 should be used when possible
 * @returns {string} A placeholder CT0 value
 */
function getHardcodedCT0() {
  logger.info('Using hardcoded CT0 (warning: may not work for all operations)');
  return "dummy-ct0-value-for-fallback-only";
}

module.exports = {
  getHardcodedBearerToken,
  getHardcodedCT0
};
