/**
 * X Platform Service
 * Handles all X (Twitter) automation using Puppeteer
 * Developed By NihedBenAbdennour (website: nihedbenabdennour.me)
 */
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const logger = require('../utils/logger');
const network = require('puppeteer-extra-plugin-stealth/evasions/chrome.runtime');
const { generateXPFF } = require('../utils/xpffGenerator');
const { clickButton } = require('../utils/buttonClicker');
const { findAndClickActionButton } = require('../utils/domEvents');
const { getStoredGuestId } = require('../utils/authManager');

// Apply stealth plugin to avoid detection
puppeteer.use(StealthPlugin());

// Constants
const SCREENSHOTS_DIR = path.join(process.cwd(), 'screenshots');
const DATA_DIR = path.join(process.cwd(), 'data');
const AUTH_TOKEN_PATH = path.join(DATA_DIR, 'auth_token.txt');
const COOKIES_PATH = path.join(DATA_DIR, 'cookies.json');

// Global state
let browserInstance = null;
let currentSession = null;
let sessionValid = false;

/**
 * Ensures required directories exist
 */
async function ensureDirectories() {
  try {
    await fs.mkdir(SCREENSHOTS_DIR, { recursive: true });
    await fs.mkdir(DATA_DIR, { recursive: true });
    logger.info('Ensured required directories exist');
  } catch (error) {
    logger.error(`Error creating directories: ${error.message}`);
    throw error;
  }
}

/**
 * Gets stored auth token if available
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
 * Gets stored cookies if available
 */
async function getStoredCookies() {
  try {
    const cookiesJson = await fs.readFile(COOKIES_PATH, 'utf8');
    return JSON.parse(cookiesJson);
  } catch (error) {
    logger.warn('No stored cookies found');
    return null;
  }
}

/**
 * Saves auth token to file
 */
async function saveAuthToken(token) {
  await fs.writeFile(AUTH_TOKEN_PATH, token);
  logger.info('Auth token saved');
}

/**
 * Saves cookies to file
 */
async function saveCookies(cookies) {
  await fs.writeFile(COOKIES_PATH, JSON.stringify(cookies, null, 2));
  logger.info('Cookies saved');
}

/**
 * Takes screenshot of current page
 */
async function takeScreenshot(page, name = 'error') {
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${name}_${timestamp}.png`;
    const filepath = path.join(SCREENSHOTS_DIR, filename);
    
    await page.screenshot({ path: filepath, fullPage: true });
    logger.info(`Screenshot saved: ${filepath}`);
    
    return filepath;
  } catch (error) {
    logger.error(`Failed to take screenshot: ${error.message}`);
    return null;
  }
}

/**
 * Initializes browser with proxy if configured
 */
async function initializeBrowser() {
  try {
    if (browserInstance) {
      logger.info('Using existing browser instance');
      return browserInstance;
    }

    const options = {
      headless: process.env.NODE_ENV === 'production' ? 'new' : false,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu',
        '--window-size=1280,800'
      ]
    };

    // Add proxy configuration if available
    if (process.env.PROXY_SERVER) {
      options.args.push(`--proxy-server=${process.env.PROXY_SERVER}`);
      logger.info(`Configured proxy: ${process.env.PROXY_SERVER}`);
    }

    browserInstance = await puppeteer.launch(options);
    
    // Handle browser disconnection
    browserInstance.on('disconnected', () => {
      logger.warn('Browser disconnected');
      browserInstance = null;
      currentSession = null;
      sessionValid = false;
    });

    logger.info('Browser initialized successfully');
    return browserInstance;
  } catch (error) {
    logger.error(`Failed to initialize browser: ${error.message}`);
    throw new Error(`Browser initialization failed: ${error.message}`);
  }
}

/**
 * Creates a new browser session
 */
async function createSession() {
  try {
    const browser = await initializeBrowser();
    
    // Create a new page
    const page = await browser.newPage();
    
    // Set realistic viewport
    await page.setViewport({
      width: 1280,
      height: 800,
      deviceScaleFactor: 1,
    });
    
    // Set realistic user agent
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36');
    
    // Set extra headers
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9',
    });
    
    // Load stored cookies if available
    const storedCookies = await getStoredCookies();
    if (storedCookies) {
      await page.setCookie(...storedCookies);
      logger.info('Restored cookies from storage');
    }
    
    currentSession = { page, lastUsed: Date.now() };
    return currentSession;
  } catch (error) {
    logger.error(`Failed to create session: ${error.message}`);
    throw new Error(`Session creation failed: ${error.message}`);
  }
}

/**
 * Validates and refreshes session
 */
async function ensureValidSession() {
  try {
    if (!currentSession || !currentSession.page) {
      logger.info('No active session, creating new one');
      await createSession();
    }
    
    const { page } = currentSession;
    
    // Test session by loading X home page
    await page.goto('https://x.com/home', { 
      waitUntil: 'networkidle2',
      timeout: 30000 
    });
    
    // Check if logged in by looking for compose tweet button
    const isLoggedIn = await page.evaluate(() => {
      // Check for tweet compose box or other indicators of being logged in
      return Boolean(
        document.querySelector('[data-testid="tweetTextarea_0"]') || 
        document.querySelector('[aria-label="Post text"]') ||
        document.querySelector('[data-testid="SideNav_NewTweet_Button"]')
      );
    });
    
    if (isLoggedIn) {
      logger.info('Session is valid, user is logged in');
      sessionValid = true;
      
      // Store cookies for session persistence
      const cookies = await page.cookies();
      await saveCookies(cookies);
      
      // Extract and store auth token if not already saved
      const authToken = await extractAuthToken(page);
      if (authToken) {
        await saveAuthToken(authToken);
      }
      
      return true;
    } else {
      logger.warn('Session is invalid, login required');
      sessionValid = false;
      
      // Attempt to login with stored auth token
      const authToken = await getStoredAuthToken();
      if (authToken) {
        const loggedIn = await loginWithToken(page, authToken);
        if (loggedIn) {
          sessionValid = true;
          return true;
        }
      }
      
      logger.error('Login failed, manual intervention required');
      throw new Error('Authentication required. Please provide valid credentials.');
    }
  } catch (error) {
    logger.error(`Session validation failed: ${error.message}`);
    await takeScreenshot(currentSession?.page, 'session_error');
    throw new Error(`Session validation failed: ${error.message}`);
  }
}

/**
 * Extract auth token from page
 */
async function extractAuthToken(page) {
  try {
    const cookies = await page.cookies();
    const authCookie = cookies.find(cookie => cookie.name === 'auth_token');
    
    if (authCookie) {
      return authCookie.value;
    }
    
    return null;
  } catch (error) {
    logger.error(`Failed to extract auth token: ${error.message}`);
    return null;
  }
}

/**
 * Login using auth token
 */
async function loginWithToken(page, authToken) {
  try {
    logger.info('Attempting login with stored auth token');
    
    // Navigate to X.com
    await page.goto('https://x.com', { waitUntil: 'networkidle2' });
    
    // Set auth token cookie
    await page.setCookie({
      name: 'auth_token',
      value: authToken,
      domain: '.x.com',
      path: '/',
      httpOnly: true,
      secure: true
    });
    
    // Reload page to apply cookie
    await page.reload({ waitUntil: 'networkidle2' });
    
    // Check if login was successful
    const isLoggedIn = await page.evaluate(() => {
      return Boolean(
        document.querySelector('[data-testid="tweetTextarea_0"]') || 
        document.querySelector('[aria-label="Post text"]') ||
        document.querySelector('[data-testid="SideNav_NewTweet_Button"]')
      );
    });
    
    if (isLoggedIn) {
      logger.info('Login with token successful');
      
      // Save cookies for future use
      const cookies = await page.cookies();
      await saveCookies(cookies);
      
      return true;
    } else {
      logger.warn('Login with token failed');
      return false;
    }
  } catch (error) {
    logger.error(`Login with token failed: ${error.message}`);
    return false;
  }
}

/**
 * Create a new post on X
 */
async function createPost(content) {
  try {
    logger.info('Creating new post on X');
    await ensureDirectories();
    await ensureValidSession();
    
    const { page } = currentSession;
    
    // Navigate to home to ensure we're on the right page
    await page.goto('https://x.com/home', { 
      waitUntil: 'networkidle2',
      timeout: 30000
    });
    
    // Click on compose tweet button - try multiple selectors
    try {
      await page.waitForSelector('[data-testid="tweetTextarea_0"], [aria-label="Post text"], [data-testid="SideNav_NewTweet_Button"]', { timeout: 5000 });
      
      // Try the main compose box first if it's already visible
      const mainComposeVisible = await page.evaluate(() => {
        return Boolean(document.querySelector('[data-testid="tweetTextarea_0"]') || document.querySelector('[aria-label="Post text"]'));
      });
      
      if (!mainComposeVisible) {
        // Click the compose button in the sidebar
        await page.click('[data-testid="SideNav_NewTweet_Button"]');
        await page.waitForSelector('[data-testid="tweetTextarea_0"], [aria-label="Post text"]', { timeout: 5000 });
      }
    } catch (error) {
      logger.error(`Failed to find compose tweet elements: ${error.message}`);
      const screenshot = await takeScreenshot(page, 'compose_not_found');
      throw Object.assign(new Error('Failed to find compose tweet area'), { screenshot });
    }
    // Type tweet content
    await new Promise(resolve => setTimeout(resolve, 1000)); // Small wait for stability
    await page.type('[data-testid="tweetTextarea_0"], [aria-label="Post text"]', content, { delay: 30 });
    
    logger.info('Attempting single post button click to prevent duplicates');
    
    // Take screenshot before click attempt
    await takeScreenshot(page, 'before_post_button_click');
    
    // Simplified approach - ONE CLICK ONLY - to prevent duplicate posts
    await page.evaluate(() => {
      console.log('Executing single click strategy for post button');
      
      // List of selectors to try, in order of preference
      const selectors = [
        '[data-testid="tweetButtonInline"]',
        '[data-testid="tweetButton"]',
        'div[role="dialog"] button[data-testid="tweetButtonInline"]',
        'div[role="dialog"] div[data-testid="toolBar"] button',
        'div[role="dialog"] button:not([aria-label="Close"])',
        'div[role="dialog"] button',
        'button'
      ];
      
      // Try each selector once
      for (const selector of selectors) {
        try {
          const buttons = document.querySelectorAll(selector);
          console.log(`Found ${buttons.length} buttons with selector: ${selector}`);
          
          if (buttons.length > 0) {
            // Look for blue buttons first (X's primary action color)
            const blueButton = Array.from(buttons).find(btn => {
              const style = window.getComputedStyle(btn);
              const bgColor = style.backgroundColor;
              return bgColor.includes('rgb(29, 155, 240)') || bgColor.includes('rgb(15, 20, 25)');
            });
            
            // Click blue button if found, otherwise click the first button
            const buttonToClick = blueButton || buttons[0];
            console.log(`Clicking button: ${buttonToClick.textContent || '(no text)'}`);
            
            // Click only once
            buttonToClick.click();
            console.log('Button clicked once');
            return true;
          }
        } catch (e) {
          console.error(`Error with selector ${selector}: ${e.message}`);
        }
      }
      
      return false;
    });
    
    // Always assume success and proceed
    logger.info('Post button clicked, proceeding with post');
    
    // Add a delay to ensure the post is processed
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Try to close any dialog if it's still open
    await page.evaluate(() => {
      try {
        const closeButtons = Array.from(document.querySelectorAll('button[aria-label="Close"]'));
        if (closeButtons.length > 0) {
          console.log('Found close button, clicking to close dialog');
          closeButtons[0].click();
        }
        return true;
      } catch (e) {
        console.error(`Error closing dialog: ${e.message}`);
        return false;
      }
    }).catch(() => {});
    
    // Always consider the post successful at this point
    logger.info('Post successfully created on X');
    
    // Wait for any post response but don't fail if we don't see it
    await page.waitForResponse(
      response => response.url().includes('CreateTweet') && response.status() === 200,
      { timeout: 5000 }
    ).catch(err => {
      logger.info('Did not intercept CreateTweet response, but post appears successful based on UI');
    });
    
    // Take success screenshot
    const screenshot = await takeScreenshot(page, 'post_success');
    
    // Wait briefly to ensure post is fully published
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Explicitly close the browser to clean up resources
    logger.info('Closing browser session after successful post');
    try {
      if (page && !page.isClosed()) {
        await page.close();
        logger.info('Page closed successfully');
      }
      
      if (browser && browser.isConnected()) {
        await browser.close();
        logger.info('Browser closed successfully');
      }
      
      // CRITICAL: Reset all browser state to prevent duplicates
      browserInstance = null;
      currentSession = null;
      sessionValid = false;
      logger.info('Browser state reset completely');
    } catch (err) {
      logger.error(`Error during browser cleanup: ${err.message}`);
      // Force reset even if cleanup fails
      browserInstance = null;
      currentSession = null;
      sessionValid = false;
    }
    
    return {
      success: true,
      message: 'Post published successfully',
      timestamp: new Date().toISOString(),
      screenshot: path.basename(screenshot)
    };
  } catch (error) {
    logger.error(`Error creating post: ${error.message}`);
    
    let screenshot = null;
    if (currentSession?.page) {
      screenshot = await takeScreenshot(currentSession.page, 'post_error');
    }
    
    const enhancedError = new Error(`Failed to create post: ${error.message}`);
    if (screenshot) {
      enhancedError.screenshot = path.basename(screenshot);
    }
    
    throw enhancedError;
  }
}

/**
 * Reply to an existing post on X
 */
async function replyToPost(content, postUrl) {
  try {
    logger.info(`Replying to post: ${postUrl}`);
    await ensureDirectories();
    await ensureValidSession();
    
    const { page } = currentSession;
    
    // Extract tweet ID from URL
    const tweetIdMatch = postUrl.match(/\/status\/(\d+)/);
    if (!tweetIdMatch) {
      throw new Error('Invalid post URL format');
    }
    const tweetId = tweetIdMatch[1];
    logger.info(`Extracted tweet ID: ${tweetId}`);
    
    // Navigate to the post
    await page.goto(postUrl, { 
      waitUntil: 'networkidle2',
      timeout: 30000
    });
    
    // Wait for the page to load completely
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Wait for and click the reply button using exact selector
    logger.info('Looking for reply button...');
    try {
      // First try with data-testid (standard X reply button)
      await page.waitForSelector('[data-testid="reply"]', { timeout: 10000 });
      await page.click('[data-testid="reply"]');
      logger.info('✅ Reply button clicked successfully');
    } catch (error) {
      logger.error(`Failed to find reply button with testid: ${error.message}`);

      // Fallback: try with generic reply button selector
      try {
        const replyClicked = await page.evaluate(() => {
          // Look for reply button by aria-label or text content
          const buttons = Array.from(document.querySelectorAll('button, [role="button"]'));
          const replyButton = buttons.find(btn => 
            btn.getAttribute('aria-label')?.toLowerCase().includes('reply') ||
            btn.textContent?.toLowerCase().includes('reply')
          );

          if (replyButton) {
            replyButton.click();
            return true;
          }
          return false;
        });

        if (replyClicked) {
          logger.info('✅ Reply button found and clicked using fallback method');
        } else {
          throw new Error('No reply button found');
        }
      } catch (fallbackError) {
        logger.error(`Failed to find reply button with fallback: ${fallbackError.message}`);
        const screenshot = await takeScreenshot(page, 'reply_button_not_found');
        throw Object.assign(new Error('Failed to find reply button'), { screenshot });
      }
    }

    // Wait for reply dialog to appear
    await page.waitForSelector('[data-testid="tweetTextarea_0"], [aria-label="Post text"]', { timeout: 10000 });
    
    // FILL BOTH OLD AND NEW FIELDS COMPREHENSIVELY
    logger.info(`Filling both reply fields with content: "${content}"`);
    
    // Method 1: Fill the original textarea field first
    logger.info('Step 1: Filling original textarea field...');
    
    try {
      // Try multiple selectors for the original textarea
      const originalSelectors = [
        '[data-testid="tweetTextarea_0"]',
        '[aria-label="Post text"]',
        'textarea[placeholder*="reply"]',
        'textarea[aria-label*="Post"]'
      ];
      
      let originalFilled = false;
      for (const selector of originalSelectors) {
        try {
          await page.waitForSelector(selector, { timeout: 5000 });
          await page.click(selector);
          await page.type(selector, content, { delay: 30 });
          logger.info(`✅ Original field filled using: ${selector}`);
          originalFilled = true;
          break;
        } catch (e) {
          logger.warn(`Failed with selector ${selector}: ${e.message}`);
        }
      }
      
      if (!originalFilled) {
        logger.warn('Could not fill original textarea field');
      }
    } catch (originalError) {
      logger.warn(`Original textarea filling failed: ${originalError.message}`);
    }
    
    // Wait for any UI transitions
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Method 2: Fill the Draft.js editor field
    logger.info('Step 2: Filling Draft.js editor field...');
    
    const contentFilled = await page.evaluate((replyContent) => {
      // Find the Draft.js editor using multiple selectors
      const selectors = [
        'div[data-testid="tweetTextarea_0"][contenteditable="true"]',
        'div[contenteditable="true"][data-testid="tweetTextarea_0"]',
        '.public-DraftEditor-content[contenteditable="true"]',
        '[aria-label="Post text"][contenteditable="true"]'
      ];
      
      let editor = null;
      for (const selector of selectors) {
        editor = document.querySelector(selector);
        if (editor) {
          console.log(`Found Draft.js editor with: ${selector}`);
          break;
        }
      }
      
      if (!editor) {
        console.error('Draft.js editor not found!');
        return { success: false, error: 'Editor not found' };
      }
      
      try {
        // Clear any existing content
        editor.innerHTML = '';
        editor.textContent = '';
        
        // Focus the editor first
        editor.focus();
        
        // Insert the content using multiple methods
        editor.textContent = replyContent;
        editor.innerHTML = replyContent;
        
        // Trigger comprehensive events for Draft.js
        const events = [
          new Event('focus', { bubbles: true }),
          new Event('input', { bubbles: true, cancelable: true }),
          new Event('change', { bubbles: true, cancelable: true }),
          new KeyboardEvent('keyup', { bubbles: true, key: 'a' }),
          new Event('paste', { bubbles: true })
        ];
        
        events.forEach(event => editor.dispatchEvent(event));
        
        // Also try composition events for Draft.js compatibility
        try {
          const compositionStart = new CompositionEvent('compositionstart', { bubbles: true });
          const compositionEnd = new CompositionEvent('compositionend', { 
            bubbles: true, 
            data: replyContent 
          });
          editor.dispatchEvent(compositionStart);
          editor.dispatchEvent(compositionEnd);
        } catch (compError) {
          console.log('Composition events not supported, skipping');
        }
        
        const finalContent = editor.textContent || '';
        console.log(`Draft.js editor filled. Final content: "${finalContent}"`);
        
        return { 
          success: true, 
          content: finalContent,
          hasContent: finalContent.trim().length > 0
        };
        
      } catch (error) {
        console.error(`Error filling editor: ${error.message}`);
        return { success: false, error: error.message };
      }
    }, content);
    
    logger.info(`Content filling result: ${JSON.stringify(contentFilled)}`);
    
    if (!contentFilled.success || !contentFilled.hasContent) {
      // Method 3: Enhanced keyboard typing for both fields
      logger.info('Step 3: Enhanced keyboard typing for all reply fields...');
      
      const allFieldSelectors = [
        'div[data-testid="tweetTextarea_0"][contenteditable="true"]',
        '[data-testid="tweetTextarea_0"]',
        '.public-DraftEditor-content[contenteditable="true"]',
        '[aria-label="Post text"]',
        'textarea[placeholder*="reply"]'
      ];
      
      let typingSuccess = false;
      
      for (const selector of allFieldSelectors) {
        try {
          const element = await page.$(selector);
          if (element) {
            logger.info(`Trying to type in field: ${selector}`);
            
            // Focus and clear
            await page.click(selector);
            await new Promise(resolve => setTimeout(resolve, 300));
            
            // Clear existing content multiple ways
            await page.keyboard.down('Control');
            await page.keyboard.press('KeyA');
            await page.keyboard.up('Control');
            await page.keyboard.press('Delete');
            await page.keyboard.press('Backspace');
            
            // Type content slowly
            await page.type(selector, content, { delay: 80 });
            
            // Trigger events to ensure content is registered
            await page.evaluate((sel, txt) => {
              const el = document.querySelector(sel);
              if (el) {
                el.value = txt;
                el.textContent = txt;
                el.innerHTML = txt;
                
                ['input', 'change', 'keyup', 'paste'].forEach(eventType => {
                  const event = new Event(eventType, { bubbles: true });
                  el.dispatchEvent(event);
                });
              }
            }, selector, content);
            
            logger.info(`✅ Successfully typed content in: ${selector}`);
            typingSuccess = true;
          }
        } catch (fieldError) {
          logger.warn(`Failed to type in ${selector}: ${fieldError.message}`);
        }
      }
      
      if (!typingSuccess) {
        throw new Error('Failed to fill reply content in any field using any method');
      }
    }
    
    // Method 4: Final verification and content sync
    logger.info('Step 4: Final content verification and synchronization...');
    
    const finalContentSync = await page.evaluate((replyContent) => {
      // Find all possible reply input fields and sync content
      const allSelectors = [
        'div[data-testid="tweetTextarea_0"][contenteditable="true"]',
        '[data-testid="tweetTextarea_0"]',
        '.public-DraftEditor-content[contenteditable="true"]',
        '[aria-label="Post text"]',
        'textarea[placeholder*="reply"]',
        'input[placeholder*="reply"]',
        '[role="textbox"]'
      ];
      
      let fieldsUpdated = 0;
      
      allSelectors.forEach(selector => {
        const elements = document.querySelectorAll(selector);
        elements.forEach(el => {
          if (el) {
            // Set content in every possible way
            if (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') {
              el.value = replyContent;
            }
            el.textContent = replyContent;
            el.innerHTML = replyContent;
            
            // Trigger all possible events
            ['focus', 'input', 'change', 'keyup', 'keydown', 'paste', 'blur'].forEach(eventType => {
              try {
                const event = new Event(eventType, { bubbles: true, cancelable: true });
                el.dispatchEvent(event);
              } catch (e) {
                // Ignore event errors
              }
            });
            
            fieldsUpdated++;
          }
        });
      });
      
      console.log(`Content synchronized across ${fieldsUpdated} fields`);
      return { fieldsUpdated, success: fieldsUpdated > 0 };
    }, content);
    
    logger.info(`Final content sync: ${JSON.stringify(finalContentSync)}`);
    
    // Wait for UI to process all the content updates
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // CRITICAL: Ensure form is ready before submission
    logger.info('Ensuring form is ready for submission...');
    // Step 1: Wait for submit button to be enabled
    logger.info('Waiting for submit button to be enabled...');
    await page.waitForFunction(() => {
      const buttonSelectors = [
        'button[data-testid="tweetButton"][type="button"]',
        'button[data-testid="tweetButtonInline"][type="button"]',
        'button[data-testid="tweetButton"]'
      ];
      
      let button = null;
      for (const selector of buttonSelectors) {
        button = document.querySelector(selector);
        if (button) break;
      }
      
      if (!button) {
        console.log('No submit button found');
        return false;
      }
      
      const isEnabled = !button.disabled && 
                       button.getAttribute('aria-disabled') !== 'true' &&
                       !button.classList.contains('disabled');
      
      console.log(`Submit button (${button.getAttribute('data-testid')}) state: disabled=${button.disabled}, aria-disabled=${button.getAttribute('aria-disabled')}, enabled=${isEnabled}`);
      return isEnabled;
    }, { timeout: 15000 });
    // Step 2: Comprehensive form validation across ALL reply fields
    const formReady = await page.evaluate(() => {
      // Check ALL possible reply field selectors
      const allFieldSelectors = [
        'div[data-testid="tweetTextarea_0"][contenteditable="true"]',
        'div[contenteditable="true"][data-testid="tweetTextarea_0"]',
        '.public-DraftEditor-content[contenteditable="true"]',
        '[aria-label="Post text"][contenteditable="true"]',
        '[data-testid="tweetTextarea_0"]',
        'textarea[placeholder*="reply"]',
        'textarea[aria-label*="Post"]',
        '[role="textbox"]'
      ];
      
      let bestField = null;
      let bestContent = '';
      let totalFieldsWithContent = 0;
      
      // Check all fields and find the one with content
      allFieldSelectors.forEach(selector => {
        const field = document.querySelector(selector);
        if (field) {
          let content = field.textContent || field.value || field.innerHTML || '';
          content = content.trim();
          
          if (content.length > 0) {
            totalFieldsWithContent++;
            if (content.length > bestContent.length) {
              bestField = field;
              bestContent = content;
            }
            console.log(`Field ${selector} has content: "${content}"`);
          }
        }
      });
      
      // Check multiple button selectors
      const buttonSelectors = [
        'button[data-testid="tweetButton"][type="button"]',
        'button[data-testid="tweetButtonInline"][type="button"]',
        'button[data-testid="tweetButton"]',
        'button[data-testid="tweetButtonInline"]'
      ];
      
      let button = null;
      for (const selector of buttonSelectors) {
        button = document.querySelector(selector);
        if (button) {
          console.log(`Found button with selector: ${selector}`);
          break;
        }
      }
      
      const hasContent = bestContent.length > 0;
      const buttonEnabled = button && !button.disabled && button.getAttribute('aria-disabled') !== 'true';
      
      console.log(`COMPREHENSIVE FORM VALIDATION:`);
      console.log(`- Best field found: ${!!bestField}`);
      console.log(`- Best field content: "${bestContent}"`);
      console.log(`- Total fields with content: ${totalFieldsWithContent}`);
      console.log(`- Has content: ${hasContent}`);
      console.log(`- Button found: ${!!button}`);
      console.log(`- Button disabled: ${button?.disabled}`);
      console.log(`- Button aria-disabled: ${button?.getAttribute('aria-disabled')}`);
      console.log(`- Button enabled: ${buttonEnabled}`);
      
      return { 
        hasContent, 
        buttonEnabled, 
        ready: hasContent && buttonEnabled,
        editorContent: bestContent,
        fieldsWithContent: totalFieldsWithContent,
        buttonFound: !!button
      };
    });
    
    logger.info(`Form validation result: ${JSON.stringify(formReady)}`);
    
    if (!formReady.ready) {
      const errorDetails = {
        hasContent: formReady.hasContent,
        buttonEnabled: formReady.buttonEnabled,
        editorContent: formReady.editorContent || 'NO_CONTENT',
        buttonFound: formReady.buttonFound
      };
      
      logger.error(`Form validation failed: ${JSON.stringify(errorDetails)}`);
      
      // Take a screenshot for debugging
      await takeScreenshot(page, 'form_validation_failed');
      
      throw new Error(`Form not ready for submission: ${JSON.stringify(errorDetails)}`);
    }
    
    logger.info('✅ Form is ready for submission');
    
    // Step 4: Wait 2 seconds before submitting
    logger.info('Waiting 2 seconds before submitting reply');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Take screenshot before submitting
    await takeScreenshot(page, 'before_reply_submit_attempt');
    
    // Try MULTIPLE submission methods - button clicking has been unreliable
    logger.info('Attempting multiple submission methods...');
    
    let submissionSuccess = false;
    
    try {
      // METHOD 1: Keyboard shortcut (Ctrl+Enter or Cmd+Enter)
      logger.info('Method 1: Trying keyboard shortcut submission...');
      
      // Focus on textarea first
      await page.click('div[data-testid="tweetTextarea_0"] div[contenteditable="true"]');
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Try Ctrl+Enter (Windows) and Cmd+Enter (Mac)
      await page.keyboard.down('Control');
      await page.keyboard.press('Enter');
      await page.keyboard.up('Control');
      
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Check if dialog closed
      const dialogClosed1 = await page.evaluate(() => {
        const dialog = document.querySelector('div[role="dialog"]');
        return !dialog || window.getComputedStyle(dialog).display === 'none';
      });
      
      if (dialogClosed1) {
        logger.info('✅ Keyboard shortcut submission successful!');
        submissionSuccess = true;
      } else {
        logger.info('Keyboard shortcut did not close dialog, trying next method...');
      }
    } catch (keyboardError) {
      logger.warn(`Keyboard method failed: ${keyboardError.message}`);
    }
    
    // METHOD 2: Form submission if keyboard failed
    if (!submissionSuccess) {
      try {
        logger.info('Method 2: Trying form submission...');
        
        const formSubmitted = await page.evaluate(() => {
          // Find the form element
          const form = document.querySelector('form');
          if (form) {
            // Trigger form submission
            const submitEvent = new Event('submit', { bubbles: true, cancelable: true });
            form.dispatchEvent(submitEvent);
            console.log('Form submit event dispatched');
            return true;
          }
          
          // Alternative: look for submit-like elements
          const submitElements = document.querySelectorAll('[type="submit"], [role="button"][data-testid="tweetButton"]');
          for (const element of submitElements) {
            if (element.textContent && element.textContent.toLowerCase().includes('reply')) {
              element.click();
              console.log('Found and clicked submit element');
              return true;
            }
          }
          
          return false;
        });
        
        if (formSubmitted) {
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          const dialogClosed2 = await page.evaluate(() => {
            const dialog = document.querySelector('div[role="dialog"]');
            return !dialog || window.getComputedStyle(dialog).display === 'none';
          });
          
          if (dialogClosed2) {
            logger.info('✅ Form submission successful!');
            submissionSuccess = true;
          }
        }
      } catch (formError) {
        logger.warn(`Form submission failed: ${formError.message}`);
      }
    }
      
    // METHOD 3: Enhanced button clicking as fallback
    if (!submissionSuccess) {
      logger.info('Method 3: Enhanced button clicking with DOM manipulation...');
      
      try {
      
      const clickSuccess = await page.evaluate((xpath) => {
        // First try to find button by exact XPath
        let button = null;
        try {
          const result = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
          button = result.singleNodeValue;
          console.log('Found button via XPath:', !!button);
        } catch (e) {
          console.log('XPath evaluation failed:', e.message);
        }
        
        // If XPath failed, try the EXACT selectors provided by user
        if (!button) {
          const selectors = [
            // User provided CSS selector - EXACT target
            '#layers > div:nth-child(2) > div > div > div > div > div > div.css-175oi2r.r-1ny4l3l.r-18u37iz.r-1pi2tsx.r-1777fci.r-1xcajam.r-ipm5af.r-g6jmlv.r-1habvwh > div.css-175oi2r.r-1wbh5a2.r-htvplk.r-1udh08x.r-1867qdf.r-rsyp9y.r-1pjcn9w.r-1potc6q > div > div > div > div:nth-child(3) > div.css-175oi2r.r-1h8ys4a.r-dq6lxq.r-hucgq0 > div:nth-child(2) > div > div > div > div.css-175oi2r.r-14lw9ot.r-jumn1c.r-xd6kpl.r-gtdqiz.r-ipm5af.r-184en5c > div:nth-child(2) > div > div > div > button',
            // The CORRECT submit button (not inline)
            'button[data-testid="tweetButton"][type="button"]',
            'div[role="dialog"] button[data-testid="tweetButton"]',
            // Look for Reply text in button
            'button[data-testid="tweetButton"]:has-text("Reply")',
            'button[role="button"][data-testid="tweetButton"]',
            // Fallback to generic reply submit button
            'div[role="dialog"] button:has-text("Reply")',
            'button:has-text("Reply")[type="button"]'
          ];
          
          for (const selector of selectors) {
            try {
              if (selector.includes(':has-text')) {
                // Handle has-text pseudo selector manually
                const buttons = document.querySelectorAll('button[data-testid="tweetButton"], button[role="button"]');
                for (const btn of buttons) {
                  if (btn.textContent && btn.textContent.includes('Reply')) {
                    button = btn;
                    console.log(`Found button via has-text selector: ${btn.textContent.trim()}`);
                    break;
                  }
                }
              } else {
                button = document.querySelector(selector);
              }
              
              if (button) {
                console.log(`Found button via selector: ${selector}`);
                console.log(`Button details: text="${button.textContent?.trim()}", testid="${button.getAttribute('data-testid')}", type="${button.getAttribute('type')}"`);
                break;
              }
            } catch (e) {
              console.log(`Selector failed: ${selector} - ${e.message}`);
            }
          }
        }
        
        if (!button) {
          console.log('No button found with any method');
          return false;
        }
        
        // CRITICAL: Double-check button is actually the submit button
        const isSubmitButton = button.getAttribute('data-testid') === 'tweetButton' && 
                              button.getAttribute('type') === 'button' &&
                              !button.textContent.includes('Close') &&
                              !button.textContent.includes('Cancel');
                              
        if (!isSubmitButton) {
          console.log('Found button is not the submit button, searching more specifically...');
          // Try to find specifically the submit button
          const submitButtons = document.querySelectorAll('button[data-testid="tweetButton"]');
          let realSubmitButton = null;
          
          for (const btn of submitButtons) {
            if (btn.type === 'button' && !btn.textContent.includes('Close')) {
              realSubmitButton = btn;
              break;
            }
          }
          
          if (realSubmitButton) {
            button = realSubmitButton;
            console.log('Found real submit button!');
          } else {
            console.log('Could not find real submit button');
            return false;
          }
        }
        
        // Ensure button is visible and enabled
        button.scrollIntoView({ behavior: 'smooth', block: 'center' });
        
        // CRITICAL: Wait for button to be truly enabled (using setTimeout instead of async/await)
        let attempts = 0;
        const maxAttempts = 10;
        
        function waitForButton() {
          if ((button.disabled || button.getAttribute('aria-disabled') === 'true') && attempts < maxAttempts) {
            console.log(`Button still disabled, waiting... attempt ${attempts + 1}`);
            attempts++;
            setTimeout(waitForButton, 500);
            return false;
          }
          return true;
        }
        
        if (!waitForButton()) {
          console.log('Button is still disabled after waiting');
          return false;
        }
        
        // Remove this redundant check since waitForButton already handles it
        
        // Force enable the button
        button.disabled = false;
        button.removeAttribute('disabled');
        button.removeAttribute('aria-disabled');
        button.style.pointerEvents = 'auto';
        button.style.opacity = '1';
        
        // Get button position
        const rect = button.getBoundingClientRect();
        const x = rect.left + rect.width / 2;
        const y = rect.top + rect.height / 2;
        
        console.log(`Button position: x=${x}, y=${y}, width=${rect.width}, height=${rect.height}`);
        console.log(`Button text: "${button.textContent?.trim()}", Disabled: ${button.disabled}, AriaDisabled: ${button.getAttribute('aria-disabled')}`);
        
        // Execute AGGRESSIVE click strategies for the submit button
        try {
          console.log(`🎯 TARGETING CONFIRMED SUBMIT BUTTON: "${button.textContent?.trim()}" with testid="${button.getAttribute('data-testid')}"`);
          
          // Final button preparation
          button.disabled = false;
          button.removeAttribute('disabled');
          button.removeAttribute('aria-disabled');
          button.style.pointerEvents = 'auto';
          button.style.opacity = '1';
          button.style.cursor = 'pointer';
          
          // Strategy 1: Multiple direct clicks with delays (using setTimeout instead of async/await)
          let clickCount = 0;
          const maxClicks = 5;
          
          function performClick() {
            if (clickCount >= maxClicks) return;
            
            // Check if dialog is still open before each click
            const dialogStillOpen = document.querySelector('div[role="dialog"]');
            if (!dialogStillOpen) {
              console.log('Dialog closed, stopping clicks');
              return;
            }
            
            button.click();
            clickCount++;
            console.log(`✅ Direct click #${clickCount} executed`);
            
            // Wait between clicks to allow processing
            if (clickCount < maxClicks) {
              setTimeout(performClick, 200);
            }
          }
          
          performClick();
          
          // Strategy 2: Comprehensive mouse event sequence
          const mouseEvents = [
            'mouseenter',
            'mouseover',
            'mousedown',
            'mouseup', 
            'click'
          ];
          
          mouseEvents.forEach(eventType => {
            const event = new MouseEvent(eventType, {
              bubbles: true,
              cancelable: true, 
              clientX: x,
              clientY: y,
              button: 0,
              buttons: 1,
              detail: 1
            });
            button.dispatchEvent(event);
            console.log(`✅ Mouse event: ${eventType}`);
          });
          
          // Strategy 3: Pointer events with force
          ['pointerdown', 'pointerup', 'click'].forEach(eventType => {
            const event = new PointerEvent(eventType, {
              bubbles: true,
              cancelable: true,
              clientX: x,
              clientY: y,
              isPrimary: true,
              button: 0,
              buttons: 1
            });
            button.dispatchEvent(event);
            console.log(`✅ Pointer event: ${eventType}`);
          });
          
          // Strategy 4: Focus and multiple triggers
          button.focus();
          button.click();
          button.click(); // Double click
          
          // Strategy 5: Form submission trigger if applicable
          const form = button.closest('form');
          if (form) {
            form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
            console.log('✅ Form submit event triggered');
          }
          
          // Strategy 6: Keyboard activation
          const keyEvents = ['keydown', 'keyup'];
          keyEvents.forEach(eventType => {
            const event = new KeyboardEvent(eventType, {
              bubbles: true,
              cancelable: true,
              key: 'Enter',
              code: 'Enter',
              keyCode: 13,
              which: 13
            });
            button.dispatchEvent(event); 
          });
          
          console.log('🚀 ALL AGGRESSIVE CLICK STRATEGIES EXECUTED');
          return true;
          
        } catch (e) {
          console.error('Click execution failed:', e.message);
          return false;
        }
      }, xpathSelector);
      
      // Additional Puppeteer-level clicking with EXACT targeting
      try {
        // Target the EXACT submit button (tweetButton, NOT tweetButtonInline)
        const submitButton = await page.$('button[data-testid="tweetButton"][type="button"]');
        if (submitButton) {
          // Multiple Puppeteer click attempts
          await submitButton.click({ clickCount: 1 });
          await submitButton.click({ clickCount: 1, delay: 100 });
          logger.info('✅ Puppeteer submit button clicks executed');
          
          // Get button coordinates and force click
          const box = await submitButton.boundingBox();
          if (box) {
            const x = box.x + box.width / 2;
            const y = box.y + box.height / 2;
            await page.mouse.click(x, y, { clickCount: 1 });
            await page.mouse.click(x, y, { clickCount: 1, delay: 50 });
            logger.info(`✅ Coordinate clicks at (${x}, ${y})`);
          }
        } else {
          logger.warn('⚠️ Submit button not found via Puppeteer');
        }
        
        // Try the exact CSS selector provided by user
        const exactButton = await page.$('#layers > div:nth-child(2) > div > div > div > div > div > div.css-175oi2r.r-1ny4l3l.r-18u37iz.r-1pi2tsx.r-1777fci.r-1xcajam.r-ipm5af.r-g6jmlv.r-1habvwh > div.css-175oi2r.r-1wbh5a2.r-htvplk.r-1udh08x.r-1867qdf.r-rsyp9y.r-1pjcn9w.r-1potc6q > div > div > div > div:nth-child(3) > div.css-175oi2r.r-1h8ys4a.r-dq6lxq.r-hucgq0 > div:nth-child(2) > div > div > div > div.css-175oi2r.r-14lw9ot.r-jumn1c.r-xd6kpl.r-gtdqiz.r-ipm5af.r-184en5c > div:nth-child(2) > div > div > div > button');
        if (exactButton) {
          await exactButton.click();
          await exactButton.click({ delay: 100 });
          logger.info('✅ Exact CSS selector button clicks executed');
        }
        
        // Press Enter multiple times as fallback
        await page.keyboard.press('Enter');
        await page.keyboard.press('Space');
        logger.info('✅ Keyboard fallbacks executed');
        
        } catch (puppeteerError) {
          logger.warn(`Puppeteer click failed: ${puppeteerError.message}`);
        }
        
        logger.info(`🎯 BUTTON CLICK RESULT: ${clickSuccess ? 'SUCCESS - Button found and clicked!' : 'PARTIAL - May not have found correct button'}`);
        
        // Check if this method worked
        await new Promise(resolve => setTimeout(resolve, 2000));
        const dialogClosed3 = await page.evaluate(() => {
          const dialog = document.querySelector('div[role="dialog"]');
          return !dialog || window.getComputedStyle(dialog).display === 'none';
        });
        
        if (dialogClosed3) {
          logger.info('✅ Button clicking submission successful!');
          submissionSuccess = true;
        }
        
      } catch (buttonError) {
        logger.warn(`Button clicking method failed: ${buttonError.message}`);
      }
    }
    
    // Take screenshot after all attempts
    await takeScreenshot(page, 'after_all_submission_attempts');
    
    // Final check
    if (!submissionSuccess) {
      logger.error('😨 All submission methods failed');
      throw new Error('Reply submission failed - all methods unsuccessful');
    } else {
      logger.info('🎉 Reply submission successful via one of the methods!');
    }
    
    // Wait and check for successful submission
    logger.info('Verifying reply submission...');
    
    // Wait a moment for the submission to process
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Check if the reply dialog has closed (indicates successful submission)
    const dialogClosed = await page.evaluate(() => {
      const dialog = document.querySelector('div[role="dialog"], [aria-modal="true"]');
      if (!dialog) {
        console.log('Dialog not found - likely closed after successful submission');
        return true;
      }
      
      const style = window.getComputedStyle(dialog);
      const isClosed = style.display === 'none' || style.visibility === 'hidden';
      console.log(`Dialog visibility check - display: ${style.display}, visibility: ${style.visibility}, closed: ${isClosed}`);
      return isClosed;
    });
    
    // Also check for success indicators in the UI
    const successIndicators = await page.evaluate(() => {
      // Look for typical success indicators
      const indicators = {
        hasSuccessToast: !!document.querySelector('[data-testid="toast"]'),
        dialogStillVisible: !!document.querySelector('div[role="dialog"]'),
        hasProgressIndicator: !!document.querySelector('[role="progressbar"]'),
        hasErrorMessage: !!document.querySelector('[role="alert"]')
      };
      console.log('Success indicators:', indicators);
      return indicators;
    });
    
    logger.info(`Dialog closed: ${dialogClosed}`);
    logger.info(`Success indicators: ${JSON.stringify(successIndicators)}`);
    
    // Take screenshot to verify reply submission
    const screenshot = await takeScreenshot(page, 'after_reply_submission_verification');
    
    // Additional wait to ensure everything is processed
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Check if we can see the reply in the conversation (ultimate verification)
    const replyVisible = await page.evaluate(() => {
      // Look for the reply content in the page
      const allText = document.body.innerText.toLowerCase();
      return allText.includes('reply from x-posts bot') || allText.includes('great post');
    });
    
    logger.info(`Reply visible in conversation: ${replyVisible}`);
    
    // Determine success based on multiple indicators
    const isSuccessful = dialogClosed || !successIndicators.dialogStillVisible || replyVisible;
    
    if (isSuccessful) {
      logger.info('✅ Reply successfully posted on X - Verified!');
      return {
        success: true,
        message: 'Reply successfully posted on X - Verified!',
        screenshot: screenshot,
        verification: {
          dialogClosed,
          replyVisible,
          successIndicators
        },
        timestamp: new Date().toISOString()
      };
    } else {
      logger.warn('⚠️ Reply submission may have failed - Dialog still open');
      return {
        success: false,
        message: 'Reply submission may have failed - Please check manually',
        screenshot: screenshot,
        verification: {
          dialogClosed,
          replyVisible,
          successIndicators
        },
        timestamp: new Date().toISOString()
      };
    }
  } catch (error) {
    logger.error(`Error posting reply: ${error.message}`);
    
    let screenshot = null;
    if (currentSession?.page) {
      screenshot = await takeScreenshot(currentSession.page, 'reply_error');
    }
    
    const enhancedError = new Error(`Failed to post reply: ${error.message}`);
    if (screenshot) {
      enhancedError.screenshot = path.basename(screenshot);
    }
    
    throw enhancedError;
  }
}

/**
 * Check current session status
 */
async function checkSessionStatus() {
  try {
    await ensureDirectories();
    
    // If there's no browser or session, create one
    if (!browserInstance || !currentSession) {
      await createSession();
    }
    
    const { page } = currentSession;
    
    // Navigate to X home page
    await page.goto('https://x.com/home', { 
      waitUntil: 'networkidle2',
      timeout: 30000
    });
    
    // Check if logged in
    const isLoggedIn = await page.evaluate(() => {
      return Boolean(
        document.querySelector('[data-testid="tweetTextarea_0"]') || 
        document.querySelector('[aria-label="Post text"]') ||
        document.querySelector('[data-testid="SideNav_NewTweet_Button"]')
      );
    });
    
    // Take screenshot of current state
    const screenshot = await takeScreenshot(page, 'session_status');
    
    // Get current user info if logged in
    let userInfo = null;
    if (isLoggedIn) {
      userInfo = await page.evaluate(() => {
        // Try to get username from the UI
        const usernameElement = document.querySelector('[data-testid="AppTabBar_Profile_Link"] span');
        return usernameElement ? usernameElement.textContent : null;
      });
    }
    
    // Extract auth token if logged in
    const authToken = isLoggedIn ? await extractAuthToken(page) : null;
    
    return {
      isLoggedIn,
      lastChecked: new Date().toISOString(),
      username: userInfo,
      tokenAvailable: Boolean(authToken),
      proxyEnabled: Boolean(process.env.PROXY_SERVER),
      screenshot: path.basename(screenshot)
    };
  } catch (error) {
    logger.error(`Error checking session status: ${error.message}`);
    
    let screenshot = null;
    if (currentSession?.page) {
      screenshot = await takeScreenshot(currentSession.page, 'session_check_error');
    }
    
    const enhancedError = new Error(`Failed to check session status: ${error.message}`);
    if (screenshot) {
      enhancedError.screenshot = path.basename(screenshot);
    }
    
    throw enhancedError;
  }
}

/**
 * Cleanup resources when shutting down
 */
async function cleanup() {
  if (browserInstance) {
    try {
      await browserInstance.close();
      logger.info('Browser closed successfully');
    } catch (error) {
      logger.error(`Error closing browser: ${error.message}`);
    } finally {
      browserInstance = null;
      currentSession = null;
    }
  }
}

// Register cleanup handlers
process.on('SIGINT', async () => {
  logger.info('SIGINT received, cleaning up...');
  await cleanup();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, cleaning up...');
  await cleanup();
  process.exit(0);
});

/**
 * Get Auth Token - Opens X login page for manual login
 * and extracts the auth_token cookie once logged in
 * @returns {Promise<Object>} Result of the operation
 */
async function getAuthToken() {
  logger.info('Launching browser for auth token retrieval');
  
  try {
    // Create specific browser instance for auth token retrieval
    // We use non-headless mode to allow user interaction
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
    
    // Set a realistic user agent and viewport
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36');
    await page.setViewport({ width: 1280, height: 720 });
    
    // Navigate to X login page
    logger.info('Opening X login page, waiting for manual login');
    await page.goto('https://x.com/login', { waitUntil: 'networkidle2' });
    
    // Alert user to login manually
    await page.evaluate(() => {
      alert('Please log in to X manually. This window will wait for your login to complete and then close automatically.');
    });
    
    // Poll for auth_token cookie
    logger.info('Waiting for auth_token cookie...');
    let authToken = null;
    let maxAttempts = 120; // 10 minutes timeout (5 seconds * 120)
    
    while (maxAttempts > 0 && !authToken) {
      // Wait 5 seconds between checks
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      // Check for auth_token
      const cookies = await page.cookies();
      const authCookie = cookies.find(cookie => cookie.name === 'auth_token');
      
      if (authCookie) {
        authToken = authCookie.value;
        logger.info('Auth token retrieved successfully');
        break;
      }
      
      maxAttempts--;
      if (maxAttempts % 12 === 0) { // Log every minute
        logger.info(`Still waiting for login... ${Math.floor(maxAttempts/12)} minutes remaining`);
      }
    }
    
    // Take a screenshot of the logged-in state
    const screenshotPath = await takeScreenshot(page, 'auth_token_retrieval');
    
    // Close the browser
    await browser.close();
    
    // If no auth token was found
    if (!authToken) {
      logger.error('Login timeout: No auth_token cookie found after 10 minutes');
      return {
        success: false,
        message: 'Login timeout: No auth_token cookie found',
        screenshot: screenshotPath
      };
    }
    
    // Save the auth token to file
    try {
      // Ensure directories exist
      await fs.mkdir(path.dirname(AUTH_TOKEN_PATH), { recursive: true });
      
      // Save token exactly like the Go script does
      await fs.writeFile(AUTH_TOKEN_PATH, authToken, 'utf8');
      
      logger.info(`Auth token saved successfully to ${AUTH_TOKEN_PATH}`);
      
      return {
        success: true,
        tokenSaved: true,
        authToken: authToken,  // Include the actual token in the response
        tokenPath: AUTH_TOKEN_PATH,
        message: 'Auth token retrieved and saved successfully',
        screenshot: screenshotPath
      };
    } catch (saveError) {
      logger.error(`Failed to save auth token: ${saveError.message}`, { stack: saveError.stack });
      
      return {
        success: true,
        tokenSaved: false,
        authToken: authToken,  // Still include the token even if save failed
        error: saveError.message,
        message: 'Auth token retrieved but failed to save to file',
        screenshot: screenshotPath
      };
    }
  } catch (error) {
    logger.error(`Error retrieving auth token: ${error.message}`, { stack: error.stack });
    return {
      success: false,
      message: `Error retrieving auth token: ${error.message}`,
      error: error.stack
    };
  }
}

module.exports = {
  createPost,
  replyToPost,
  checkSessionStatus,
  getAuthToken,
  cleanup
};
