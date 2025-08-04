/**
 * Go-Style CT0 Cookie Manager
 * Exact implementation matching the testPost.go approach
 */
const puppeteer = require('puppeteer');
// puppeteer-extra and StealthPlugin removed for Docker compatibility test
const fs = require('fs').promises;
// StealthPlugin temporarily removed for Docker compatibility test
const path = require('path');
const logger = require('./logger');

// Apply stealth plugin to avoid detection
// puppeteer.use(StealthPlugin());

/**
 * Get CT0 Cookie using exact Go implementation approach
 * @param {string} authToken - The auth token to inject
 * @returns {Promise<string>} The CT0 cookie value
 */
async function getCT0Cookie(authToken) {
  logger.info('Starting Go-style CT0 cookie retrieval process');
  logger.info('Launching browser in headless mode...');
  let browser;
  try {
    browser = await Promise.race([
      puppeteer.launch({
        headless: 'new',
        args: [
          '--no-sandbox',
        ],
      }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Browser launch timeout (60s)')), 60000))
    ]);
    browser.on('disconnected', () => {
      logger.error('Browser disconnected unexpectedly. This usually means Chrome crashed or exited early.');
    });
    logger.info('Browser launched successfully.');
  } catch (err) {
    logger.error('Error launching browser: ' + err.message);
    throw err;
  }

  let page;
  try {
    logger.info('Creating new page...');
    page = await Promise.race([
      browser.newPage(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('newPage timeout (10s)')), 10000))
    ]);
    logger.info('New page created successfully.');
  } catch (err) {
    logger.error('Error creating new page: ' + err.message);
    await browser.close();
    throw err;
  }

  try {
    logger.info('Step 1: Navigating to https://x.com');
    const gotoResponse = await page.goto('https://x.com', { waitUntil: 'networkidle2' });
    logger.info(`Step 1: page.goto response: ${gotoResponse ? gotoResponse.status() : 'no response object'}`);
    await new Promise(r => setTimeout(r, 3000)); // 3 seconds wait, like Go

    logger.info('Step 2: Injecting auth_token cookie');
    await page.setCookie({
      name: 'auth_token',
      value: authToken,
      domain: '.x.com',
      path: '/',
      httpOnly: true,
      secure: true,
    });
    logger.info('Step 2: Cookie injected');

    logger.info('Step 3: Reloading page to apply cookie');
    const reloadResponse = await page.reload({ waitUntil: 'networkidle2' });
    logger.info(`Step 3: page.reload response: ${reloadResponse ? reloadResponse.status() : 'no response object'}`);
    await new Promise(r => setTimeout(r, 5000)); // 5 seconds wait, like Go

    logger.info('Step 4: Retrieving all cookies');
    const cookies = await page.cookies();
    logger.info(`Step 4: Cookies retrieved: ${JSON.stringify(cookies.map(c => c.name))}`);

    logger.info('Step 5: Looking for ct0 cookie');
    const ct0Cookie = cookies.find(c => c.name === 'ct0');

    if (!ct0Cookie) {
      logger.error('ct0 cookie not found');
      throw new Error('ct0 cookie not found');
    }

    logger.info(`Step 5: Successfully retrieved ct0 cookie: ${ct0Cookie.value}`);
    return ct0Cookie.value;

  } catch (error) {
    logger.error(`Error getting CT0: ${error.message}`);
    throw error;
  } finally {
    logger.info('Closing browser...');
    await browser.close();
    logger.info('Browser closed.');
  }
}

/**
 * Read auth token from file, checking both possible locations
 * @returns {Promise<string>} The auth token
 */
async function getAuthToken() {
  try {
    // Try data directory first
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

module.exports = {
  getCT0Cookie,
  getAuthToken
};
