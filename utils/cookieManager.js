/**
 * Cookie Manager Utility
 * Handles cookie retrieval and management for X (Twitter)
 * Developed By NihedBenAbdennour (website: nihedbenabdennour.me)
 */
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs').promises;
const path = require('path');
const logger = require('./logger');

// Apply stealth plugin to avoid detection
puppeteer.use(StealthPlugin());

// Constants
const DATA_DIR = path.join(process.cwd(), 'data');
const AUTH_TOKEN_PATH = path.join(DATA_DIR, 'auth_token.txt');
const COOKIES_PATH = path.join(DATA_DIR, 'cookies.json');

/**
 * Retrieves the CT0 cookie by injecting auth_token
 * @param {string} authToken - The auth_token value
 * @returns {Promise<string>} The CT0 cookie value
 */
async function getCT0Cookie(authToken) {
  try {
    // Ensure auth token exists
    if (!authToken) {
      const storedToken = await getStoredAuthToken();
      if (!storedToken) {
        throw new Error('No auth_token available. Please run /api/auth/token endpoint first.');
      }
      authToken = storedToken;
    }

    logger.info('Starting CT0 cookie retrieval process');
    
    // Check if we have a stored CT0 cookie first
    try {
      const cookies = await getStoredCookies();
      const ct0Cookie = cookies.find(cookie => cookie.name === 'ct0');
      if (ct0Cookie) {
        // Validate if stored CT0 cookie is still valid
        logger.info('Found stored CT0 cookie, checking validity');
        return ct0Cookie.value;
      }
    } catch (err) {
      // If error reading stored cookies, proceed with browser method
      logger.info('No stored CT0 cookie found or error reading cookies, will retrieve new one');
    }
    
    // Launch browser (headless)
    const browser = await puppeteer.launch({
      headless: true,
      ignoreHTTPSErrors: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu',
      ]
    });
    
    // Open new page
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36');
    
    // Set auth_token cookie before navigating
    await page.setCookie({
      name: 'auth_token',
      value: authToken,
      domain: '.x.com',
      path: '/',
      httpOnly: true,
      secure: true
    });
    
    // Navigate to home page to trigger ct0 cookie generation
    await page.goto('https://x.com/home', { waitUntil: 'networkidle2' });
    
    // Wait for cookies to be set
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Get all cookies
    const cookies = await page.cookies();
    
    // Find ct0 cookie
    const ct0Cookie = cookies.find(cookie => cookie.name === 'ct0');
    
    // Take screenshot for debugging
    const screenshotDir = path.join(process.cwd(), 'screenshots');
    await fs.mkdir(screenshotDir, { recursive: true });
    const screenshotPath = path.join(screenshotDir, `ct0_cookie_${Date.now()}.png`);
    await page.screenshot({ path: screenshotPath, fullPage: true });
    logger.info(`CT0 cookie retrieval screenshot saved: ${screenshotPath}`);
    
    // Close browser
    await browser.close();
    
    if (!ct0Cookie) {
      throw new Error('Failed to retrieve ct0 cookie, auth_token may be invalid');
    }
    
    logger.info(`Successfully retrieved CT0 cookie: ${ct0Cookie.value.substring(0, 10)}...`);
    
    // Save all cookies for future use
    await saveCookies(cookies);
    
    return ct0Cookie.value;
  } catch (error) {
    logger.error(`Error retrieving CT0 cookie: ${error.message}`, { stack: error.stack });
    throw error;
  }
}

/**
 * Gets stored auth token if available
 * @returns {Promise<string|null>} The stored auth token or null
 */
async function getStoredAuthToken() {
  try {
    const token = await fs.readFile(AUTH_TOKEN_PATH, 'utf8');
    return token.trim();
  } catch (error) {
    logger.warn('No stored auth token found');
    return null;
  }
}

/**
 * Saves cookies to file for future use
 * @param {Array<Object>} cookies - The cookies to save
 */
async function saveCookies(cookies) {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(COOKIES_PATH, JSON.stringify(cookies, null, 2));
    logger.info('Cookies saved successfully');
  } catch (error) {
    logger.error(`Error saving cookies: ${error.message}`);
  }
}

/**
 * Gets stored cookies if available
 * @returns {Promise<Array<Object>|null>} The stored cookies or null
 */
async function getStoredCookies() {
  try {
    const cookiesJson = await fs.readFile(COOKIES_PATH, 'utf8');
    return JSON.parse(cookiesJson);
  } catch (error) {
    logger.debug('No stored cookies found');
    return null;
  }
}

module.exports = {
  getCT0Cookie,
  getStoredAuthToken,
  getStoredCookies,
  saveCookies
};
