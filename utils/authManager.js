/**
 * Authentication Manager - Handles X login and token extraction
 * Extracts auth_token, guest_id, and CT0 cookies for X API access
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
const GUEST_ID_PATH = path.join(DATA_DIR, 'guest_id.txt');
const CT0_PATH = path.join(DATA_DIR, 'ct0.txt');
const COOKIES_PATH = path.join(DATA_DIR, 'cookies.json');

/**
 * Ensures required directories exist
 */
async function ensureDirectories() {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    logger.info('Ensured data directory exists');
  } catch (error) {
    logger.error(`Error creating directories: ${error.message}`);
    throw error;
  }
}

/**
 * Get stored auth token
 */
async function getStoredAuthToken() {
  try {
    const token = await fs.readFile(AUTH_TOKEN_PATH, 'utf8');
    return token.trim();
  } catch (error) {
    return null;
  }
}

/**
 * Get stored guest ID
 */
async function getStoredGuestId() {
  try {
    const guestId = await fs.readFile(GUEST_ID_PATH, 'utf8');
    return guestId.trim();
  } catch (error) {
    return null;
  }
}

/**
 * Get stored CT0 token
 */
async function getStoredCT0() {
  try {
    const ct0 = await fs.readFile(CT0_PATH, 'utf8');
    return ct0.trim();
  } catch (error) {
    return null;
  }
}

/**
 * Save authentication tokens to files
 */
async function saveTokens(authToken, guestId, ct0) {
  await ensureDirectories();
  
  if (authToken) {
    await fs.writeFile(AUTH_TOKEN_PATH, authToken);
    logger.info('Auth token saved');
  }
  
  if (guestId) {
    await fs.writeFile(GUEST_ID_PATH, guestId);
    logger.info('Guest ID saved');
  }
  
  if (ct0) {
    await fs.writeFile(CT0_PATH, ct0);
    logger.info('CT0 token saved');
  }
}

/**
 * Manual Login API - Opens browser for manual login and extracts all tokens
 * @returns {Promise<Object>} Result with all extracted tokens
 */
async function manualLogin() {
  logger.info('Starting manual login process');
  
  try {
    // Launch browser in non-headless mode for manual interaction
    const browser = await puppeteer.launch({
      headless: false,
      ignoreHTTPSErrors: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu',
        '--window-size=1280,720',
      ]
    });
    
    const page = await browser.newPage();
    
    // Set realistic user agent
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36');
    await page.setViewport({ width: 1280, height: 720 });
    
    // Navigate to X login page
    logger.info('Opening X login page for manual authentication');
    await page.goto('https://x.com/login', { waitUntil: 'networkidle2' });
    
    // Wait for manual login completion
    logger.info('⏳ Waiting for manual login completion...');
    let authToken, guestId, ct0;
    let maxAttempts = 120; // 10 minutes timeout
    
    while (maxAttempts > 0 && (!authToken || !guestId)) {
      await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
      
      // Get all cookies
      const cookies = await page.cookies();
      
      // Extract tokens from cookies
      for (const cookie of cookies) {
        if (cookie.name === 'auth_token' && !authToken) {
          authToken = cookie.value;
          logger.info('✅ Auth token extracted');
        }
        if (cookie.name === 'guest_id' && !guestId) {
          guestId = cookie.value;
          logger.info('✅ Guest ID extracted');
        }
        if (cookie.name === 'ct0' && !ct0) {
          ct0 = cookie.value;
          logger.info('✅ CT0 token extracted');
        }
      }
      
      // If we have auth_token and guest_id, we can proceed
      if (authToken && guestId) {
        break;
      }
      
      maxAttempts--;
      if (maxAttempts % 12 === 0) {
        logger.info(`Still waiting for login... ${Math.floor(maxAttempts/12)} minutes remaining`);
      }
    }
    
    // Save all cookies for future use
    const allCookies = await page.cookies();
    await fs.writeFile(COOKIES_PATH, JSON.stringify(allCookies, null, 2));
    
    // Close browser
    await browser.close();
    
    if (!authToken || !guestId) {
      return {
        success: false,
        message: 'Login timeout or incomplete - missing required tokens',
        authToken: authToken || null,
        guestId: guestId || null,
        ct0: ct0 || null
      };
    }
    
    // Save all tokens
    await saveTokens(authToken, guestId, ct0);
    
    return {
      success: true,
      message: 'All authentication tokens extracted successfully',
      authToken,
      guestId,
      ct0: ct0 || 'Not found (may be set after first API call)'
    };
    
  } catch (error) {
    logger.error(`Manual login error: ${error.message}`, { stack: error.stack });
    return {
      success: false,
      message: `Login error: ${error.message}`,
      error: error.stack
    };
  }
}

/**
 * Automated Login using username/password from environment
 * @returns {Promise<Object>} Result with all extracted tokens
 */
async function automatedLogin() {
  const username = process.env.X_USERNAME;
  const password = process.env.X_PASSWORD;
  
  if (!username || !password) {
    return {
      success: false,
      message: 'X_USERNAME and X_PASSWORD must be set in environment variables'
    };
  }
  
  logger.info('Starting automated login process');
  
  try {
    // Launch browser in headless mode for automated login
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
    
    const page = await browser.newPage();
    
    // Set realistic user agent
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36');
    await page.setViewport({ width: 1280, height: 720 });
    
    // Navigate to X login page
    await page.goto('https://x.com/login', { waitUntil: 'networkidle2' });
    
    // Wait for page to fully load
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Wait for and fill username using the exact selector provided
    logger.info('Waiting for username field...');
    await page.waitForSelector('input[name="text"]', { timeout: 30000 });
    
    // Human-like delay before typing
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    logger.info('Filling username...');
    await page.type('input[name="text"]', username, { delay: 150 }); // Slower typing like human
    
    // Human-like delay before clicking
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Click Next button using a more specific selector
    logger.info('Clicking Next button...');
    try {
      // Wait for the Next button to be visible and clickable
      await page.waitForSelector('button[role="button"]', { timeout: 10000 });
      
      // Find and click the Next button by looking for the text content
      await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button[role="button"]'));
        const nextButton = buttons.find(button => 
          button.textContent.includes('Next') || 
          button.querySelector('span')?.textContent.includes('Next')
        );
        if (nextButton) {
          nextButton.click();
        } else {
          throw new Error('Next button not found');
        }
      });
    } catch (error) {
      logger.error('Failed to click Next button, trying alternative approach');
      // Fallback: press Enter key
      await page.keyboard.press('Enter');
    }
    
    // Wait for password field to appear
    logger.info('Waiting for password field...');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Wait for password field using different possible selectors
    try {
      await page.waitForSelector('input[name="password"]', { timeout: 15000 });
    } catch (error) {
      // Alternative selector for password field
      await page.waitForSelector('input[type="password"]', { timeout: 15000 });
    }
    
    // Human-like delay before typing password
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    logger.info('Filling password...');
    try {
      await page.type('input[name="password"]', password, { delay: 150 });
    } catch (error) {
      // Try alternative selector
      await page.type('input[type="password"]', password, { delay: 150 });
    }
    
    // Human-like delay before clicking login
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Click Log in button using the exact selector provided
    logger.info('Clicking Log in button...');
    try {
      await page.waitForSelector('button[data-testid="LoginForm_Login_Button"]', { timeout: 10000 });
      await page.click('button[data-testid="LoginForm_Login_Button"]');
    } catch (error) {
      logger.error('Failed to click Login button with testid, trying alternative');
      // Fallback: look for Login button by text
      await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button[role="button"]'));
        const loginButton = buttons.find(button => 
          button.textContent.includes('Log in') || 
          button.querySelector('span')?.textContent.includes('Log in')
        );
        if (loginButton) {
          loginButton.click();
        } else {
          throw new Error('Login button not found');
        }
      });
    }
    
    // Wait for successful login - check for URL change or home page elements
    logger.info('Waiting for login completion...');
    try {
      // Wait for either URL change to home or specific elements that indicate successful login
      await Promise.race([
        page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }),
        page.waitForSelector('[data-testid="primaryColumn"]', { timeout: 30000 }), // Home timeline
        page.waitForFunction(() => window.location.pathname === '/home', { timeout: 30000 })
      ]);
    } catch (error) {
      logger.warn('Navigation timeout, but continuing to check for cookies...');
      // Continue anyway as cookies might still be set
    }
    
    // Additional wait to ensure all cookies are set
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Extract tokens from cookies after successful login
    const cookies = await page.cookies();
    let authToken, guestId, ct0;
    
    logger.info(`Total cookies found: ${cookies.length}`);
    
    // Log all cookie names for debugging
    const cookieNames = cookies.map(c => c.name);
    logger.info(`Cookie names: ${cookieNames.join(', ')}`);
    
    for (const cookie of cookies) {
      if (cookie.name === 'auth_token') {
        authToken = cookie.value;
        logger.info(`✅ Auth token extracted: ${authToken.substring(0, 10)}...`);
      }
      if (cookie.name === 'guest_id') {
        guestId = cookie.value;
        logger.info(`✅ Guest ID extracted: ${guestId}`);
      }
      if (cookie.name === 'ct0') {
        ct0 = cookie.value;
        logger.info(`✅ CT0 token extracted: ${ct0.substring(0, 10)}...`);
      }
    }
    
    // Check if we got the essential tokens
    if (!authToken) {
      logger.warn('⚠️ Auth token not found in cookies');
    }
    if (!guestId) {
      logger.warn('⚠️ Guest ID not found in cookies');
    }
    if (!ct0) {
      logger.warn('⚠️ CT0 token not found in cookies');
    }
    
    // Save all cookies for future use
    await fs.writeFile(COOKIES_PATH, JSON.stringify(cookies, null, 2));
    
    // Close browser
    await browser.close();
    
    if (!authToken || !guestId) {
      return {
        success: false,
        message: 'Login completed but failed to extract required tokens',
        authToken: authToken || null,
        guestId: guestId || null,
        ct0: ct0 || null
      };
    }
    
    // Save all tokens
    await saveTokens(authToken, guestId, ct0);
    
    return {
      success: true,
      message: 'Automated login successful - all tokens extracted',
      authToken,
      guestId,
      ct0: ct0 || 'Not found (may be set after first API call)'
    };
    
  } catch (error) {
    logger.error(`Automated login error: ${error.message}`, { stack: error.stack });
    return {
      success: false,
      message: `Automated login error: ${error.message}`,
      error: error.stack
    };
  }
}

/**
 * Get CT0 token using existing auth_token
 * @param {string} authToken - The auth token to use
 * @returns {Promise<string>} CT0 token
 */
async function getCT0Token(authToken = null) {
  if (!authToken) {
    authToken = await getStoredAuthToken();
  }
  
  if (!authToken) {
    throw new Error('No auth token available for CT0 extraction');
  }
  
  logger.info('Extracting CT0 token using auth token');
  
  const browser = await puppeteer.launch({
    headless: true,
    ignoreHTTPSErrors: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();
  
  // Set auth_token cookie
  await page.setCookie({
    name: 'auth_token',
    value: authToken,
    domain: '.x.com',
    path: '/',
    httpOnly: true,
    secure: true
  });
  
  // Navigate to trigger CT0 generation
  await page.goto('https://x.com/home', { waitUntil: 'networkidle2' });
  
  // Wait a moment for cookies to be set
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  // Extract CT0 cookie
  const cookies = await page.cookies();
  const ct0Cookie = cookies.find(cookie => cookie.name === 'ct0');
  
  await browser.close();
  
  if (!ct0Cookie) {
    throw new Error('Failed to extract CT0 token');
  }
  
  // Save CT0 token
  await fs.writeFile(CT0_PATH, ct0Cookie.value);
  logger.info('CT0 token extracted and saved');
  
  return ct0Cookie.value;
}

module.exports = {
  manualLogin,
  automatedLogin,
  getCT0Token,
  getStoredAuthToken,
  getStoredGuestId,
  getStoredCT0,
  saveTokens
};
