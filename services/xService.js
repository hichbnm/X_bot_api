/**
 * X Posting Service - Core functionality for automating X interactions
 * @author NihedBenAbdennour (website: nihedbenabdennour.me)
 */

require('dotenv').config();
// Enhanced Puppeteer with stealth plugins to evade detection
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

// Apply stealth plugins to make automation less detectable
puppeteer.use(StealthPlugin());

const fs = require('fs');
const path = require('path');
const winston = require('winston');
const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');
const sessionManager = require('./sessionManager');

// Additional stealth configurations
// Leave these as comments to document our anti-detection strategy
// 1. Browser fingerprint consistency
// 2. Mouse movement naturalization 
// 3. Keyboard timing randomization
// 4. Headers and timezone normalization

// Create screenshots directory if it doesn't exist
const screenshotsDir = path.join(__dirname, '../screenshots');
if (!fs.existsSync(screenshotsDir)) {
  fs.mkdirSync(screenshotsDir, { recursive: true });
}

/**
 * Take a screenshot of the current page state
 * @param {Object} page - Puppeteer page object
 * @param {String} action - The action being performed (for filename)
 * @param {String} status - Success or error (for filename)
 * @returns {String} Path to the screenshot file
 */
const takeScreenshot = async (page, action, status) => {
  const timestamp = new Date().toISOString().replace(/:/g, '-');
  const filename = `${action}_${status}_${timestamp}_${uuidv4().substring(0, 8)}.png`;
  const screenshotPath = path.join(screenshotsDir, filename);
  
  try {
    await page.screenshot({ path: screenshotPath, fullPage: true });
    logger.info(`Screenshot captured: ${filename}`);
    return screenshotPath;
  } catch (error) {
    logger.error(`Failed to capture screenshot: ${error.message}`);
    return null;
  }
};

/**
 * Save browser cookies for future session restoration with anti-detection enhancements
 * @param {Object} page - Puppeteer page object
 * @returns {Boolean} Whether cookies were successfully saved
 */
const saveEnhancedSession = async (page) => {
  try {
    logger.info('Saving enhanced session cookies');
    
    // Get all cookies from current browser context
    const cookies = await page.cookies();
    if (!cookies || cookies.length === 0) {
      logger.warn('No cookies found to save');
      return false;
    }
    
    // Add metadata to cookies to track rotation and validity
    const enhancedCookies = {
      cookies: cookies,
      savedAt: new Date().toISOString(),
      userAgent: await page.evaluate(() => navigator.userAgent),
      rotationKey: Math.random().toString(36).substring(2, 15),
      cookieSignature: cookies.map(c => `${c.name}:${c.domain}`).join('|')
    };
    
    // Save enhanced cookies to session manager
    await sessionManager.saveSession(enhancedCookies);
    
    // Log count but not actual cookie data for security
    logger.info(`Saved ${cookies.length} cookies with rotation key ${enhancedCookies.rotationKey}`); 
    return true;
  } catch (error) {
    logger.error(`Failed to save session: ${error.message}`);
    return false;
  }
};

/**
 * Restore browser session with anti-detection enhancements
 * @param {Object} page - Puppeteer page object
 * @returns {Boolean} Whether session was successfully restored
 */
const restoreEnhancedSession = async (page) => {
  try {
    logger.info('Attempting to restore enhanced session');
    
    // Get saved session data
    const sessionData = await sessionManager.getSession();
    if (!sessionData || !sessionData.cookies || sessionData.cookies.length === 0) {
      logger.warn('No saved session available');
      return false;
    }
    
    // Check session age - reject if too old (24 hours)
    const savedAt = new Date(sessionData.savedAt);
    const ageHours = (new Date() - savedAt) / (1000 * 60 * 60);
    if (ageHours > 24) {
      logger.warn(`Session expired (${Math.round(ageHours)} hours old)`); 
      return false;
    }
    
    // Apply the saved cookies
    await page.setCookie(...sessionData.cookies);
    
    // Also set the same user agent if available for consistency
    if (sessionData.userAgent) {
      await page.setUserAgent(sessionData.userAgent);
    }
    
    logger.info(`Restored ${sessionData.cookies.length} cookies from saved session`);
    return true;
  } catch (error) {
    logger.error(`Failed to restore session: ${error.message}`);
    return false;
  }
};

/**
 * Configure and launch puppeteer browser with proxy
 * @param {Object} proxyConfig - Proxy configuration details
 * @returns {Object} Browser instance
 */
const setupBrowser = async (proxyConfig) => {
  try {
    // Configure stealth plugin with maximum protection against detection
    const stealthPlugin = StealthPlugin();
    
    // Configure puppeteer to mimic a regular Chrome browser
    const launchOptions = {
      headless: process.env.NODE_ENV === 'production',
      ignoreHTTPSErrors: true, // Handle SSL issues more gracefully
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu',
        // Human-like screen resolution and color depth
        '--window-size=1280,1024',
        '--color-scheme=light',
        // Cookie and authentication improvements
        '--disable-features=IsolateOrigins,site-per-process',
        '--disable-web-security',
        // Reduce fingerprinting vectors
        '--disable-features=AudioServiceOutOfProcess',
        '--disable-breakpad',
        '--disable-sync',
        '--hide-scrollbars',
        '--mute-audio',
        // Timezone matching to prevent timezone fingerprinting
        '--timezone=Europe/London',
        // Disable automation flags that reveal it's automated
        '--disable-blink-features=AutomationControlled'
      ],
      // Don't use default viewport - let the browser decide naturally
      defaultViewport: null,
      // Randomize user agent slightly but stay within common versions
      // Format: Major.Minor.Build.Patch where only Build and Patch vary slightly
      userAgent: `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${Math.floor(110 + Math.random() * 10)}.0.${5000 + Math.floor(Math.random() * 1000)}.${Math.floor(Math.random() * 100)} Safari/537.36`
    };

    // Check if proxy is configured
    if (!proxyConfig || !proxyConfig.host || !proxyConfig.port) {
      logger.warn('No proxy configuration provided, attempting direct connection');
      return await puppeteer.launch(launchOptions);
    }
    
    // Format proxy URL correctly - this is the working approach from test-proxy.js
    const proxyUrl = `http://${proxyConfig.username}:${proxyConfig.password}@${proxyConfig.host}:${proxyConfig.port}`;
    logger.info(`Setting up browser with proxy: ${proxyConfig.host}:${proxyConfig.port} (auth: ${!!proxyConfig.username})`);
    
    // Add proxy server to launch arguments
    launchOptions.args.push(`--proxy-server=${proxyConfig.host}:${proxyConfig.port}`);
    
    // Launch the browser
    const browser = await puppeteer.launch(launchOptions);
    
    // Handle proxy authentication
    if (proxyConfig.username && proxyConfig.password) {
      try {
        // Create a new page and authenticate it
        const page = await browser.newPage();
        
        // Apply authentication to this page
        await page.authenticate({
          username: proxyConfig.username,
          password: proxyConfig.password
        });
        
        // Test the connection
        logger.debug('Testing proxy authentication');
        await page.goto('https://httpbin.org/ip', {
          waitUntil: 'networkidle2',
          timeout: 15000
        });
        
        // Extract the response to verify proxy is working
        const ipData = await page.evaluate(() => {
          try {
            return document.body.textContent;
          } catch (e) {
            return null;
          }
        });
        
        if (ipData && ipData.includes('origin')) {
          const ipMatch = ipData.match(/"origin":\s*"([^"]+)"/);
          const proxyIp = ipMatch ? ipMatch[1] : 'unknown';
          logger.info(`Proxy authentication successful! IP: ${proxyIp}`);
        } else {
          logger.warn('Proxy test returned unexpected response');
          logger.debug(`Raw response: ${ipData?.substring(0, 100)}...`);
        }
        
        // Close the test page
        await page.close();
        
        // Set up authentication for any future pages
        browser.on('targetcreated', async (target) => {
          if (target.type() === 'page') {
            const newPage = await target.page();
            if (newPage) {
              try {
                await newPage.authenticate({
                  username: proxyConfig.username,
                  password: proxyConfig.password
                });
                logger.debug('Applied proxy authentication to new page');
              } catch (e) {
                logger.warn(`Failed to authenticate new page: ${e.message}`);
              }
            }
          }
        });
        
        logger.info('Proxy authentication configured for all future pages');
      } catch (authError) {
        logger.error(`Proxy authentication setup failed: ${authError.message}`);
        // Take a screenshot if possible to help debug
        try {
          const pages = await browser.pages();
          if (pages.length > 0) {
            await takeScreenshot(pages[0], 'proxy_setup', 'error');
          }
        } catch (e) {
          // Ignore screenshot errors
        }
        
        // Close and throw - can't continue without working proxy
        await browser.close();
        throw new Error(`Proxy authentication failed: ${authError.message}`);
      }
    }
    
    return browser;
  } catch (error) {
    logger.error(`Browser setup failed: ${error.message}`);
    throw new Error(`Browser setup failed: ${error.message}`);
  }
}

/**
 * Login to X account
 * @param {Object} page - Puppeteer page object
 * @returns {Boolean} Success or failure
 */
const loginToX = async (page) => {
  try {
    const username = process.env.X_USERNAME;
    const password = process.env.X_PASSWORD;
    
    if (!username || !password) {
      throw new Error('X credentials not configured');
    }
    
    logger.info('Attempting to log in to X account');

    try {
      // Navigate to login page with retry logic
      let retries = 0;
      const maxRetries = 3;
      let success = false;
      
      while (!success && retries < maxRetries) {
        try {
          logger.debug(`Navigation attempt ${retries + 1} to Twitter login page`);
          await page.goto('https://twitter.com/login', { 
            waitUntil: 'networkidle2', 
            timeout: 60000 
          });
          success = true;
        } catch (navError) {
          retries++;
          if (retries >= maxRetries) throw navError;
          logger.warn(`Navigation attempt ${retries} failed: ${navError.message}. Retrying...`);
          await new Promise(r => setTimeout(r, 2000 * retries)); // Exponential backoff
        }
      }
      
      logger.debug('On login page, waiting for username field');
      
      // Check if we're already logged in
      const isLoggedIn = await page.evaluate(() => {
        return document.querySelector('a[aria-label="Post"]') || document.querySelector('div[aria-label="Post"]');
      });
      
      if (isLoggedIn) {
        logger.info('Already logged in to X');
        const cookies = await page.cookies();
        await sessionManager.saveSession(cookies);
        return true;
      }
      
      // Function to add human-like randomized delays with natural distribution
      const humanDelay = async (min = 500, max = 2000) => {
        // Use triangular distribution for more natural timing (cluster around the middle)
        const getTriangularRandom = (min, max) => {
          const r1 = Math.random();
          const r2 = Math.random();
          return min + (max - min) * (r1 + r2) / 2;
        };
        const delay = Math.floor(getTriangularRandom(min, max));
        await new Promise(r => setTimeout(r, delay));
      };
      
      // Function for highly realistic human-like typing
      const humanTypeText = async (selector, text) => {
        await page.focus(selector);
        logger.debug(`Typing text into ${selector} with human-like patterns`);
        
        // Common typing patterns based on keyboard layout and typing behavior
        const fastKeys = 'aeiounstrl'; // Common keys typed faster
        const slowKeys = 'qzxvbkjpyfgwh'; // Keys typically typed slower
        
        // Occasionally add a pause in the middle of typing (as if thinking)
        const insertPauseAt = text.length > 8 ? 
          Math.floor(Math.random() * (text.length - 4)) + 2 : null;
          
        // Type each character with variable delay based on the key
        for (let i = 0; i < text.length; i++) {
          const char = text[i];
          
          // Determine base delay based on character
          let baseDelay;
          if (fastKeys.includes(char.toLowerCase())) {
            baseDelay = 30 + Math.random() * 80; // Fast keys: 30-110ms
          } else if (slowKeys.includes(char.toLowerCase())) {
            baseDelay = 70 + Math.random() * 130; // Slow keys: 70-200ms
          } else {
            baseDelay = 50 + Math.random() * 100; // Medium keys: 50-150ms
          }
          
          // Add occasional deliberate mistake and correction (backspace) with very low probability
          if (i > 3 && Math.random() < 0.03) {
            // Type wrong character
            const wrongChar = 'abcdefghijklmnopqrstuvwxyz'[Math.floor(Math.random() * 26)];
            await page.keyboard.type(wrongChar, { delay: baseDelay });
            await humanDelay(200, 350); // Slight delay before noticing "mistake"
            await page.keyboard.press('Backspace', { delay: 30 + Math.random() * 50 });
            await humanDelay(100, 200); // Small pause after correction
          }
          
          // Add longer thinking pause if at designated position
          if (i === insertPauseAt) {
            await humanDelay(800, 2000);
          }
          
          // Type the actual character
          await page.keyboard.type(char, { delay: baseDelay });
          
          // Occasional slight pause between characters (as if thinking about next key)
          if (Math.random() < 0.1) {
            await humanDelay(100, 300);
          }
        }
        
        // Natural pause after completing typing
        await humanDelay(300, 800);
      };
      
      // Random mouse movements to appear more human-like
      await page.mouse.move(
        100 + Math.random() * 200,
        100 + Math.random() * 100,
        { steps: 10 }
      );
      
      // Wait for username field with visual confirmation
      await page.waitForSelector('input[autocomplete="username"]', { visible: true, timeout: 30000 });
      await humanDelay(800, 2000); // Random delay before interacting
      await takeScreenshot(page, 'login_username', 'progress');
      
      // Type username with human-like typing
      logger.debug('Entering username with human-like timing');
      await humanTypeText('input[autocomplete="username"]', username);
      await humanDelay(1000, 2500); // Random delay after typing
      logger.debug('Username entered, preparing to click Next button');
      
      // Take a screenshot to see current state
      await takeScreenshot(page, 'before_next_button', 'progress');
      
      // Function for advanced human-like button clicking with bezier curve mouse movement
      const humanClick = async (selector, buttonText, errorMsg) => {
        try {
          // Generate a natural mouse path using bezier curves
          // This creates a curved mouse movement instead of straight line
          const bezierCurve = (t, p0, p1, p2, p3) => {
            const cX = 3 * (p1.x - p0.x);
            const bX = 3 * (p2.x - p1.x) - cX;
            const aX = p3.x - p0.x - cX - bX;
            
            const cY = 3 * (p1.y - p0.y);
            const bY = 3 * (p2.y - p1.y) - cY;
            const aY = p3.y - p0.y - cY - bY;
            
            const x = (aX * Math.pow(t, 3)) + (bX * Math.pow(t, 2)) + (cX * t) + p0.x;
            const y = (aY * Math.pow(t, 3)) + (bY * Math.pow(t, 2)) + (cY * t) + p0.y;
            return {x, y};
          };
          
          // Start from current mouse position or a random point
          const viewportSize = await page.viewport();
          const currentPosition = {
            x: viewportSize.width * (0.3 + Math.random() * 0.4),
            y: viewportSize.height * (0.3 + Math.random() * 0.4)
          };
          
          // Random intermediate points for the bezier curve
          await page.mouse.move(currentPosition.x, currentPosition.y);
          await humanDelay(100, 300);
          
          // Find the button details using visual information and accessibility data
          const buttonInfo = await page.evaluate((selector, text) => {
            const buttons = Array.from(document.querySelectorAll(selector));
            
            // Try to find button by text content
            let targetButton = buttons.find(btn => {
              return (btn.textContent && btn.textContent.includes(text)) || 
                     (btn.innerText && btn.innerText.includes(text)) ||
                     (btn.ariaLabel && btn.ariaLabel.includes(text)) ||
                     (btn.title && btn.title.includes(text)) ||
                     (btn.getAttribute('role') === 'button' && 
                      (btn.textContent?.includes(text) || btn.innerText?.includes(text)));
            });
            
            // If not found, try getting any button-like element
            if (!targetButton && buttons.length > 0) {
              targetButton = buttons[0];
            }
              
            if (targetButton) {
              // Get detailed position for natural clicking
              const rect = targetButton.getBoundingClientRect();
              return {
                found: true,
                x: rect.left + rect.width / 2,
                y: rect.top + rect.height / 2,
                width: rect.width,
                height: rect.height,
                isDisabled: targetButton.disabled || 
                            targetButton.getAttribute('aria-disabled') === 'true'
              };
            }
            return { found: false };
          }, selector, buttonText);
          
          if (buttonInfo.found) {
            // Check if button is disabled
            if (buttonInfo.isDisabled) {
              logger.warn(`Button ${buttonText} appears to be disabled`);
              return false;
            }
            
            // Add human-like randomness to click position (not exactly center)
            const offsetX = (Math.random() * 0.6 - 0.3) * buttonInfo.width/2;
            const offsetY = (Math.random() * 0.6 - 0.3) * buttonInfo.height/2;
            const targetX = buttonInfo.x + offsetX;
            const targetY = buttonInfo.y + offsetY;
            
            // Create control points for bezier curve (natural mouse movement)
            const control1 = {
              x: currentPosition.x + (targetX - currentPosition.x) * (0.2 + Math.random() * 0.3),
              y: currentPosition.y + (Math.random() * 80 - 40) // Add some randomness in the path
            };
            const control2 = {
              x: currentPosition.x + (targetX - currentPosition.x) * (0.7 + Math.random() * 0.2),
              y: targetY + (Math.random() * 80 - 40)
            };
            
            // Number of steps - more steps = smoother movement
            const steps = 10 + Math.floor(Math.random() * 15);
            
            // Execute the mouse movement along the bezier curve
            for (let i = 0; i <= steps; i++) {
              const t = i / steps;
              const point = bezierCurve(
                t, 
                currentPosition, 
                control1, 
                control2, 
                {x: targetX, y: targetY}
              );
              
              await page.mouse.move(point.x, point.y);
              
              // Vary the speed of movement (slower as approaching target)
              const movementDelay = Math.floor(10 + (30 * Math.abs(Math.sin(t * Math.PI))));
              await new Promise(r => setTimeout(r, movementDelay));
            }
            
            // Hover briefly before clicking (human decision time)
            await humanDelay(200, 600);
            
            // Add subtle movement before clicking (hand tremor simulation)
            await page.mouse.move(
              targetX + (Math.random() * 6 - 3),
              targetY + (Math.random() * 6 - 3),
              { steps: 2 }
            );
            
            // Click with realistic press duration
            await page.mouse.down();
            await humanDelay(50, 150); // Hold duration
            await page.mouse.up();
            
            logger.debug(`Clicked ${buttonText} button with natural bezier curve movement`);
            return true;
          }
          
          return false;
        } catch (e) {
          logger.warn(`${errorMsg}: ${e.message}`);
          return false;
        }
      };

      // Try various button selectors with human-like interactions
      logger.debug('Looking for Next button with human-like movements');
      await humanDelay(800, 1500);
      
      let nextButtonClicked = false;
      
      // Try multiple approaches to find and click the Next button
      nextButtonClicked = await humanClick('button[role="button"]', 'Next', 'Button role selector failed') ||
                          await humanClick('div[role="button"]', 'Next', 'Div role selector failed');
      
      // If button wasn't found with specific selectors, try a broader approach
      if (!nextButtonClicked) {
        logger.warn('Standard button selectors failed, trying alternative approaches');
        
        // Look for any clickable element with "Next"
        const altButtonInfo = await page.evaluate(() => {
          const allElements = document.querySelectorAll('*');
          for (const element of allElements) {
            if ((element.innerText && 
                (element.innerText.includes('Next') || 
                 element.innerText.includes('Continue'))) &&
                element.getBoundingClientRect().width > 0 && 
                element.getBoundingClientRect().height > 0) {
              const rect = element.getBoundingClientRect();
              return {
                found: true,
                x: rect.left + rect.width / 2,
                y: rect.top + rect.height / 2,
                width: rect.width,
                height: rect.height
              };
            }
          }
          return { found: false };
        });
        
        if (altButtonInfo.found) {
          // Add randomness to click
          const offsetX = (Math.random() * 0.4 - 0.2) * altButtonInfo.width/2;
          const offsetY = (Math.random() * 0.4 - 0.2) * altButtonInfo.height/2;
          
          // Natural movement to button
          await page.mouse.move(
            altButtonInfo.x + offsetX,
            altButtonInfo.y + offsetY,
            { steps: 8 + Math.floor(Math.random() * 10) }
          );
          
          await humanDelay(300, 700);
          await page.mouse.click(altButtonInfo.x + offsetX, altButtonInfo.y + offsetY);
          logger.debug('Clicked Next button using element search');
          nextButtonClicked = true;
        }
      }
      
      if (!nextButtonClicked) {
        logger.warn('Could not find Next button with any method');
        return false;
      } else {
        logger.info('Next button clicked, waiting for navigation to password screen...');
        
        // Take screenshot immediately after clicking Next
        await takeScreenshot(page, 'after_next_button_click', 'progress');
        
        // Wait for navigation to complete with exponential backoff
        let waitTime = 1000;
        const maxWaitTime = 10000;
        const maxAttempts = 5;
        let attempts = 0;
        let passwordFieldFound = false;
        
        while (attempts < maxAttempts && !passwordFieldFound) {
          try {
            // Wait for network to become idle
            await page.waitForNavigation({ 
              waitUntil: 'networkidle2',
              timeout: waitTime
            }).catch(() => {
              // Ignore timeout - we'll check for password field anyway
              logger.debug('Navigation timeout, checking for password field');
            });
            
            // Check if password field is visible
            passwordFieldFound = await page.evaluate(() => {
              const passwordField = document.querySelector('input[name="password"]');
              return passwordField && passwordField.offsetParent !== null;
            });
            
            if (passwordFieldFound) {
              logger.info('Password field found after navigation');
              break;
            }
            
            // If we've reached the login verification page, wait for it to load
            const onVerificationPage = await page.evaluate(() => {
              const pageContent = document.body.innerText.toLowerCase();
              return pageContent.includes('verify your identity') || 
                     pageContent.includes('confirm your identity') ||
                     pageContent.includes('verification');
            });
            
            if (onVerificationPage) {
              logger.warn('Encountered verification page during login');
              await takeScreenshot(page, 'verification_page', 'error');
              return false;
            }
            
            // Double the wait time for next attempt (exponential backoff)
            waitTime = Math.min(waitTime * 2, maxWaitTime);
            attempts++;
            logger.debug(`Password field not found yet, retrying (attempt ${attempts}/${maxAttempts})`);
            await humanDelay(waitTime/2, waitTime);
          } catch (err) {
            logger.warn(`Error waiting for password field: ${err.message}`);
            attempts++;
            await humanDelay(waitTime/2, waitTime);
          }
        }
        
        // Take screenshot after navigation
        await takeScreenshot(page, 'after_next_button_navigation', 'progress');
        
        if (!passwordFieldFound) {
          logger.error('Failed to find password field after multiple attempts');
          return false;
        }
      }
      
      // Explicitly wait for password field to be ready for interaction
      try {
        await page.waitForSelector('input[name="password"]', { visible: true, timeout: 10000 });
        await takeScreenshot(page, 'login_password', 'progress');
      } catch (passwordError) {
        logger.error(`Failed to wait for password field: ${passwordError.message}`);
        await takeScreenshot(page, 'password_field_error', 'error');
        return false;
      }
      
      // Move mouse around naturally before focusing on password field
      const viewportSize = await page.viewport();
      await page.mouse.move(
        viewportSize.width * 0.4 + (Math.random() * viewportSize.width * 0.2),
        viewportSize.height * 0.4 + (Math.random() * viewportSize.height * 0.2),
        { steps: 5 + Math.floor(Math.random() * 8) }
      );
      
      // Type password with human-like variable speed
      logger.debug('Entering password with human-like timing');
      await humanDelay(800, 1800); // Pause before starting to type password
      await humanTypeText('input[name="password"]', password);
      
      // Pause after typing password (like a human would before clicking login)
      await humanDelay(1200, 2800);
      logger.debug('Password entered, preparing to click login button');
      
      // Take screenshot before clicking login
      await takeScreenshot(page, 'before_login_button', 'progress');
      
      // Use human-like interaction for login button
      logger.debug('Looking for login button with human-like interactions');
      await humanDelay(500, 1200); // Pause before looking for button
      
      // Try multiple approaches with our human-like click function
      let loginButtonClicked = false;
      
      // First try with data-testid (most reliable)
      try {
        // Wait for button to be visible
        await page.waitForSelector('button[data-testid="LoginForm_Login_Button"]', 
          { visible: true, timeout: 5000 });
          
        // Use human-like clicking on the button
        const buttonRect = await page.evaluate(() => {
          const button = document.querySelector('button[data-testid="LoginForm_Login_Button"]');
          if (button) {
            const rect = button.getBoundingClientRect();
            return {
              found: true,
              x: rect.left + rect.width / 2,
              y: rect.top + rect.height / 2,
              width: rect.width,
              height: rect.height
            };
          }
          return { found: false };
        });
        
        if (buttonRect.found) {
          // Add slight randomness to click position
          const offsetX = (Math.random() * 0.6 - 0.3) * buttonRect.width/2;
          const offsetY = (Math.random() * 0.6 - 0.3) * buttonRect.height/2;
          
          // Move to button with natural movement
          await page.mouse.move(
            buttonRect.x + offsetX,
            buttonRect.y + offsetY,
            { steps: 10 + Math.floor(Math.random() * 10) }
          );
          
          // Pause briefly before clicking (decision time)
          await humanDelay(300, 800);
          
          // Click with mouse down/up for realism
          await page.mouse.down();
          await humanDelay(50, 150);
          await page.mouse.up();
          
          logger.debug('Clicked login button using data-testid selector with human-like movement');
          loginButtonClicked = true;
        }
      } catch (loginButtonError) {
        logger.warn(`Could not find login button by data-testid: ${loginButtonError.message}`);
      }
      
      // If first method failed, try alternatives
      if (!loginButtonClicked) {
        // Try with button text content
        loginButtonClicked = await humanClick('button[role="button"]', 'Log in', 'Button role selector failed') ||
                            await humanClick('div[role="button"]', 'Log in', 'Div role selector failed') ||
                            await humanClick('button', 'Sign in', 'Button sign-in selector failed');
      }
      
      // If standard methods failed, try broader approach
      if (!loginButtonClicked) {
        logger.warn('Standard login button selectors failed, trying alternative approaches');
        
        // Look for any clickable element with login text
        const altButtonInfo = await page.evaluate(() => {
          const allElements = document.querySelectorAll('*');
          for (const element of allElements) {
            if ((element.innerText && 
                (element.innerText.includes('Log in') || 
                 element.innerText.includes('Sign in'))) &&
                element.getBoundingClientRect().width > 0 && 
                element.getBoundingClientRect().height > 0) {
              const rect = element.getBoundingClientRect();
              return {
                found: true,
                x: rect.left + rect.width / 2,
                y: rect.top + rect.height / 2,
                width: rect.width,
                height: rect.height
              };
            }
          }
          return { found: false };
        });
        
        if (altButtonInfo.found) {
          // Add randomness to click position
          const offsetX = (Math.random() * 0.4 - 0.2) * altButtonInfo.width/2;
          const offsetY = (Math.random() * 0.4 - 0.2) * altButtonInfo.height/2;
          
          // Natural movement to button
          await page.mouse.move(
            altButtonInfo.x + offsetX, 
            altButtonInfo.y + offsetY,
            { steps: 8 + Math.floor(Math.random() * 10) }
          );
          
          await humanDelay(300, 700);
          await page.mouse.click(altButtonInfo.x + offsetX, altButtonInfo.y + offsetY);
          logger.debug('Clicked login button using element search');
          loginButtonClicked = true;
        }
      }
      
      // After clicking the login button, wait for navigation
      if (loginButtonClicked) {
        logger.info('Login button clicked, waiting for navigation');
        await humanDelay(1500, 3000); // Natural wait after clicking login
      } else {
        logger.warn('Could not find login button with any method');
      }
      
      // Take screenshot after login attempt
      await takeScreenshot(page, 'after_login_button', 'progress');
      
      // Wait for either home page or error message with exponential backoff
      let navigationSuccess = false;
      let navigationAttempts = 0;
      const maxNavigationAttempts = 3;
      
      while (!navigationSuccess && navigationAttempts < maxNavigationAttempts) {
        navigationAttempts++;
        try {
          logger.info(`Waiting for post-login navigation (attempt ${navigationAttempts})`);
          
          // Wait for navigation completion with a reasonable timeout
          await Promise.race([
            page.waitForNavigation({ timeout: 15000 * navigationAttempts }),
            page.waitForSelector('a[aria-label="Post"]', { timeout: 15000 * navigationAttempts }),
            page.waitForSelector('div[aria-label="Post"]', { timeout: 15000 * navigationAttempts })
          ]);
          
          navigationSuccess = true;
          logger.info('Navigation after login completed successfully');
        } catch (navigationError) {
          const waitTime = 2000 * navigationAttempts;
          logger.warn(`Navigation attempt ${navigationAttempts} failed: ${navigationError.message}`);
          
          if (navigationAttempts < maxNavigationAttempts) {
            logger.info(`Waiting ${waitTime}ms before retrying navigation...`);
            await humanDelay(waitTime, waitTime + 1000);
          }
        }
      }
      
      // Try to determine if login was successful by checking for post button
      // Multiple selectors for post button to handle different UI versions
      const postSelectors = [
        'a[aria-label="Post"]',
        'div[aria-label="Post"]',
        'div[data-testid="tweetButtonInline"]',
        'a[data-testid="SideNav_NewTweet_Button"]'
      ];
      
      // Try each selector
      let loginSuccessful = false;
      for (const selector of postSelectors) {
        try {
          await page.waitForSelector(selector, { visible: true, timeout: 10000 });
          loginSuccessful = true;
          break;
        } catch (e) {
          // Continue to next selector
        }
      }
      
      if (!loginSuccessful) {
        throw new Error('Could not detect successful login - post button not found');
      }
      
      logger.info('Successfully logged in to X');
      await takeScreenshot(page, 'login_success', 'progress');
      
      const loginSuccess = true;
      if (loginSuccess) {
        logger.info('Login successful');
        
        // Save cookies using enhanced session management
        const sessionSaved = await saveEnhancedSession(page);
        if (sessionSaved) {
          logger.info('Enhanced session saved successfully');
        } else {
          logger.warn('Enhanced session save failed, but login was successful');
        }
        
        return true;
      } else {
        logger.warn('Login process completed but unable to verify success');
        return false;
      }
    } catch (loginError) {
      logger.error(`Login process error: ${loginError.message}`);
      await takeScreenshot(page, 'login_process_error', 'error');
      throw loginError;
    }
  } catch (error) {
    logger.error(`Login failed: ${error.message}`);
    await takeScreenshot(page, 'login', 'error');
    return false;
  }
};

/**
 * Check if current session is valid
 * @param {Object} page - Puppeteer page object
 * @returns {Boolean} Is session valid
 */
const isSessionValid = async (page) => {
  try {
    logger.info('Checking if session is valid with enhanced detection...');
    
    // Take screenshot before validation attempt for debugging
    await takeScreenshot(page, 'before_session_check', 'progress');
    
    // First try a lightweight check on current page to avoid unnecessary navigation
    if (page.url().includes('twitter.com') || page.url().includes('x.com')) {
      logger.debug('Already on X platform, checking current page for session indicators');
      const quickCheckResult = await performSessionCheck(page);
      if (quickCheckResult !== null) {
        return quickCheckResult;
      }
    }
    
    // If quick check was inconclusive or we're not on X, navigate to home
    // Use a random navigation pattern to avoid detection
    const navigationTargets = [
      'https://twitter.com/home',
      'https://x.com/home',
      'https://twitter.com/explore',
      'https://twitter.com/notifications'
    ];
    
    const targetUrl = navigationTargets[Math.floor(Math.random() * 2)]; // Prefer home pages
    
    logger.info(`Navigating to ${targetUrl} to verify session...`);
    await page.goto(targetUrl, {
      waitUntil: 'networkidle2',
      timeout: 30000
    });
    
    // Take screenshot after navigation for debugging
    await takeScreenshot(page, 'session_check', 'progress');
    
    // Perform the actual session check
    return await performSessionCheck(page);
  } catch (error) {
    logger.error(`Error checking session validity: ${error.message}`);
    await takeScreenshot(page, 'session_check_error', 'error');
    return false;
  }
};

/**
 * Helper function to perform the actual session validation
 * @param {Object} page - Puppeteer page object
 * @returns {Boolean|null} Session validity or null if inconclusive
 */
const performSessionCheck = async (page) => {
  // Multiple positive indicators that session is valid (in priority order)
  const validSessionIndicators = [
    'a[aria-label="Post"]',
    'a[data-testid="SideNav_NewTweet_Button"]',
    'div[data-testid="tweetButtonInline"]',
    'div[aria-label="Post"]',
    'div[data-testid="primaryColumn"]', // Timeline column
    'div[data-testid="sidebarColumn"]', // Trending column
    'header[role="banner"] nav' // Main navigation
  ];
  
  // Multiple negative indicators suggesting we're logged out
  const invalidSessionIndicators = [
    'a[href="/login"]',
    'a[data-testid="login"]',
    'a[href="/i/flow/signup"]',
    'div[data-testid="loginButton"]',
    'div[data-testid="SignupButton"]'
  ];
  
  // Check using DOM content to avoid detection
  const sessionState = await page.evaluate((validSelectors, invalidSelectors) => {
    // Helper to check if element is visible
    const isVisible = (el) => {
      if (!el) return false;
      const style = window.getComputedStyle(el);
      return style.display !== 'none' && 
             style.visibility !== 'hidden' && 
             style.opacity !== '0' &&
             el.offsetWidth > 0 &&
             el.offsetHeight > 0;
    };
    
    // Check for valid session indicators
    for (const selector of validSelectors) {
      const element = document.querySelector(selector);
      if (element && isVisible(element)) {
        return { valid: true, indicator: selector };
      }
    }
    
    // Check for invalid session indicators
    for (const selector of invalidSelectors) {
      const element = document.querySelector(selector);
      if (element && isVisible(element)) {
        return { valid: false, indicator: selector };
      }
    }
    
    // Check for text content that suggests login state
    const bodyText = document.body.innerText.toLowerCase();
    if (bodyText.includes('log in to continue') || 
        bodyText.includes('sign up') || 
        bodyText.includes('create account')) {
      return { valid: false, indicator: 'login text found' };
    }
    
    // No strong indicators found
    return null;
  }, validSessionIndicators, invalidSessionIndicators);
  
  if (sessionState) {
    logger.info(`Session ${sessionState.valid ? 'valid' : 'invalid'} - detected via: ${sessionState.indicator}`);
    return sessionState.valid;
  }
  
  logger.warn('Session status inconclusive, checking for login redirects...');
  
  // As a last resort, check if we were redirected to login page
  const currentUrl = page.url();
  if (currentUrl.includes('/login') || currentUrl.includes('/i/flow/login')) {
    logger.info('Session invalid - redirected to login page');
    return false;
  }
  
  logger.warn('Could not conclusively determine session status, assuming invalid');
  return false;
};

/**
 * Post a new tweet to X
 * @param {String} content - The tweet content
 * @param {Array} mediaUrls - Optional array of media URLs to attach
 * @param {Object} proxyConfig - Proxy configuration details
 * @returns {Object} Result object with success status and details
 */
const postToX = async (content, mediaUrls = [], proxyConfig) => {
  let browser = null;
  let page = null;
  
  try {
    logger.info('Setting up browser for new post');
    browser = await setupBrowser(proxyConfig);
    page = await browser.newPage();
    
    // Set user agent to appear more like a real browser
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    // Set viewport to realistic desktop size
    await page.setViewport({ width: 1280, height: 1024 });

    // Try to restore session with enhanced management
    logger.info('Attempting to restore enhanced session');
    const sessionRestored = await restoreEnhancedSession(page);
    
    // Verify if session is valid regardless of restoration success
    if (sessionRestored && await isSessionValid(page)) {
      logger.info('Enhanced session restored successfully');
    } else {
      // Session is either not restored or invalid
      logger.info(sessionRestored ? 'Session restored but invalid' : 'No valid session found, logging in again');
      // Take screenshot for diagnostics
      await takeScreenshot(page, 'before_login_attempt', 'progress');
      
      // Try to login
      if (!(await loginToX(page))) {
        logger.error('Failed to login to X');
        return { 
          success: false, 
          error: 'Failed to login to X',
          screenshot: await takeScreenshot(page, 'login_failure', 'error') 
        };
      } else {
        logger.info('Login successful after session restoration failed');
      }
    }

    // Navigate to home page if not already there
    await page.goto('https://twitter.com/home', { waitUntil: 'networkidle2', timeout: 30000 });
    
    // Click on post button to open compose dialog
    logger.info('Opening compose tweet dialog');
    await page.waitForSelector('a[aria-label="Post"]', { visible: true, timeout: 10000 })
      .then(button => button.click())
      .catch(async () => {
        // Try alternative selector
        const postButton = await page.$('div[aria-label="Post"]');
        if (postButton) {
          await postButton.click();
        } else {
          throw new Error('Could not find post button');
        }
      });
    
    // Wait for tweet compose area
    await page.waitForSelector('div[role="textbox"][aria-label="Post text"]', { visible: true, timeout: 10000 });
    
    // Type tweet content with realistic typing speed
    logger.info('Typing tweet content');
    await page.type('div[role="textbox"][aria-label="Post text"]', content, { delay: 30 });
    
    // Handle media uploads if any
    if (mediaUrls && mediaUrls.length > 0) {
      logger.info(`Uploading ${mediaUrls.length} media item(s)`);
      
      // Click media upload button
      const fileInput = await page.$('input[type="file"][accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/quicktime"]');
      if (!fileInput) {
        throw new Error('Could not find media upload input');
      }
      
      // For each media URL, we'd need to download it first
      // This is just placeholder logic - in a real implementation you'd download each file first
      // For simplicity, we're not implementing the full media upload flow
      logger.info('Media upload is a placeholder - implement actual download and upload');
    }
    
    // Click post button
    logger.info('Clicking post button');
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('div[role="button"]'));
      const postButton = buttons.find(button => 
        button.textContent.includes('Post') && 
        !button.parentElement.parentElement.getAttribute('aria-label')?.includes('Add'));
      if (postButton) postButton.click();
    });
    
    // Wait for post to be submitted - look for the appearance of a success element or the disappearance of the compose dialog
    await page.waitForFunction(() => {
      return !document.querySelector('div[role="textbox"][aria-label="Post text"]');
    }, { timeout: 30000 });
    
    // Take success screenshot
    const screenshotPath = await takeScreenshot(page, 'post', 'success');
    
    // Try to get the post ID (this is approximative and may not always work)
    let postId = null;
    try {
      // Wait for the timeline to update with our post
      await page.waitForTimeout(3000);
      
      // Look for the most recent post in the timeline
      postId = await page.evaluate(() => {
        const articles = document.querySelectorAll('article');
        if (articles.length > 0) {
          const firstArticle = articles[0];
          const timeElement = firstArticle.querySelector('time');
          if (timeElement) {
            const link = timeElement.closest('a');
            if (link && link.href) {
              // Extract status ID from URL
              const match = link.href.match(/status\/(\d+)/);
              return match ? match[1] : null;
            }
          }
        }
        return null;
      });
    } catch (error) {
      logger.warn(`Could not extract post ID: ${error.message}`);
    }
    
    logger.info('Post created successfully');
    return {
      success: true,
      postId,
      timestamp: new Date().toISOString(),
      screenshot: screenshotPath
    };
    
  } catch (error) {
    logger.error(`Error posting to X: ${error.message}`);
    
    // Take error screenshot if page is available
    let screenshotPath = null;
    if (page) {
      screenshotPath = await takeScreenshot(page, 'post', 'error');
    }
    
    return {
      success: false,
      error: error.message,
      screenshot: screenshotPath
    };
    
  } finally {
    // Close the browser
    if (browser) {
      await browser.close();
    }
  }
};

/**
 * Reply to an existing tweet on X
 * @param {String} url - URL of the tweet to reply to
 * @param {String} content - The reply content
 * @param {Array} mediaUrls - Optional array of media URLs to attach
 * @param {Object} proxyConfig - Proxy configuration details
 * @returns {Object} Result object with success status and details
 */
const replyToX = async (url, content, mediaUrls = [], proxyConfig) => {
  let browser = null;
  let page = null;
  
  try {
    logger.info(`Setting up browser for reply to: ${url}`);
    browser = await setupBrowser(proxyConfig);
    page = await browser.newPage();
    
    // Set user agent to appear more like a real browser
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    // Set viewport to realistic desktop size
    await page.setViewport({ width: 1280, height: 1024 });

    // Try to restore session first
    logger.info('Attempting to restore session');
    const cookies = await sessionManager.getSession();
    if (cookies && cookies.length > 0) {
      await page.setCookie(...cookies);
      
      // Verify if session is valid
      if (await isSessionValid(page)) {
        logger.info('Session restored successfully');
      } else {
        logger.info('Restored session is invalid, logging in again');
        if (!(await loginToX(page))) {
          return { 
            success: false, 
            error: 'Failed to login to X', 
            screenshot: await takeScreenshot(page, 'login_failure', 'error') 
          };
        }
      }
    } else {
      // No saved session, login from scratch
      logger.info('No saved session found, logging in from scratch');
      if (!(await loginToX(page))) {
        return { 
          success: false, 
          error: 'Failed to login to X', 
          screenshot: await takeScreenshot(page, 'login_failure', 'error') 
        };
      }
    }

    // Navigate to the tweet URL
    logger.info(`Navigating to tweet: ${url}`);
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 45000 });
    
    // Wait for the tweet to load
    await page.waitForSelector('article[data-testid="tweet"]', { visible: true, timeout: 30000 });
    
    // Click on the reply button
    logger.info('Clicking reply button');
    await page.waitForSelector('div[aria-label="Reply"]', { visible: true, timeout: 10000 });
    await page.click('div[aria-label="Reply"]');
    
    // Wait for reply compose area
    await page.waitForSelector('div[role="textbox"][aria-label="Post text"]', { visible: true, timeout: 10000 });
    
    // Type reply content with realistic typing speed
    logger.info('Typing reply content');
    await page.type('div[role="textbox"][aria-label="Post text"]', content, { delay: 30 });
    
    // Handle media uploads if any (same as in postToX)
    if (mediaUrls && mediaUrls.length > 0) {
      logger.info(`Uploading ${mediaUrls.length} media item(s)`);
      logger.info('Media upload is a placeholder - implement actual download and upload');
    }
    
    // Click reply button
    logger.info('Clicking reply button');
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('div[role="button"]'));
      const replyButton = buttons.find(button => 
        button.textContent.includes('Reply'));
      if (replyButton) replyButton.click();
    });
    
    // Wait for reply to be submitted
    await page.waitForFunction(() => {
      return !document.querySelector('div[role="textbox"][aria-label="Post text"]');
    }, { timeout: 30000 });
    
    // Take success screenshot
    const screenshotPath = await takeScreenshot(page, 'reply', 'success');
    
    // Try to get the reply ID
    let replyId = null;
    try {
      // Wait for the page to update with our reply
      await page.waitForTimeout(3000);
      
      // Attempt to find the reply ID
      replyId = await page.evaluate(() => {
        const articles = document.querySelectorAll('article');
        // Usually the first article is the original tweet, and the newest reply is right after
        if (articles.length > 1) {
          const replyArticle = articles[1]; // This could be our reply
          const timeElement = replyArticle.querySelector('time');
          if (timeElement) {
            const link = timeElement.closest('a');
            if (link && link.href) {
              // Extract status ID from URL
              const match = link.href.match(/status\/(\d+)/);
              return match ? match[1] : null;
            }
          }
        }
        return null;
      });
    } catch (error) {
      logger.warn(`Could not extract reply ID: ${error.message}`);
    }
    
    logger.info('Reply posted successfully');
    return {
      success: true,
      replyId,
      timestamp: new Date().toISOString(),
      screenshot: screenshotPath
    };
    
  } catch (error) {
    logger.error(`Error replying to X post: ${error.message}`);
    
    // Take error screenshot if page is available
    let screenshotPath = null;
    if (page) {
      screenshotPath = await takeScreenshot(page, 'reply', 'error');
    }
    
    return {
      success: false,
      error: error.message,
      screenshot: screenshotPath
    };
    
  } finally {
    // Close the browser
    if (browser) {
      await browser.close();
    }
  }
};

module.exports = {
  postToX,
  replyToX
};
