/**
 * Button clicking utility for X platform
 * Handles various strategies to ensure buttons get clicked
 */
const logger = require('./logger');
const path = require('path');
const fs = require('fs').promises;

/**
 * Takes a screenshot and saves it
 * @param {Object} page - Puppeteer page object
 * @param {string} name - Name for the screenshot
 * @returns {Promise<string>} Path to the screenshot
 */
async function takeScreenshot(page, name = 'button_click_debug') {
  try {
    const timestamp = new Date().toISOString().replace(/:/g, '-').replace(/\..+/, '');
    const filename = `${name}_${timestamp}.png`;
    const dir = path.join(process.cwd(), 'screenshots');
    
    await fs.mkdir(dir, { recursive: true });
    const filepath = path.join(dir, filename);
    await page.screenshot({ path: filepath, fullPage: true });
    
    return filepath;
  } catch (error) {
    logger.error(`Error taking screenshot: ${error.message}`);
    return null;
  }
}

/**
 * Multi-strategy button clicker for X platform
 * @param {Object} page - Puppeteer page object
 * @param {string} buttonType - Type of button ('post' or 'reply')
 * @returns {Promise<boolean>} True if button was clicked
 */
async function clickButton(page, buttonType = 'post') {
  const actionName = buttonType === 'reply' ? 'replying' : 'posting';
  logger.info(`Attempting to click ${buttonType} button with multiple strategies`);
  
  try {
    // Take before screenshot for debugging
    const beforeScreenshot = await takeScreenshot(page, `before_${buttonType}_click`);
    logger.info(`Pre-click state screenshot at: ${beforeScreenshot}`);
    
    // Wait longer for button to be fully rendered and interactable
    await page.waitForTimeout(3000);
    
    // STRATEGY 1: Using data-testid directly (most reliable when elements have data-testid)
    const testIdSuccess = await clickByTestId(page, buttonType);
    if (testIdSuccess) {
      logger.info(`Successfully clicked ${buttonType} button using data-testid`);
      await verifyDialogClosed(page, buttonType);
      return true;
    }
    
    // STRATEGY 2: Using coordinate-based precise mouse clicking
    const coordsSuccess = await clickByCoordinates(page, buttonType);
    if (coordsSuccess) {
      logger.info(`Successfully clicked ${buttonType} button using coordinates`);
      await verifyDialogClosed(page, buttonType);
      return true;
    }
    
    // STRATEGY 3: Using complex CSS selectors
    const selectorSuccess = await clickBySelector(page, buttonType);
    if (selectorSuccess) {
      logger.info(`Successfully clicked ${buttonType} button using CSS selectors`);
      await verifyDialogClosed(page, buttonType);
      return true;
    }
    
    // STRATEGY 4: DOM traversal and text content
    const textSuccess = await clickByTextContent(page, buttonType);
    if (textSuccess) {
      logger.info(`Successfully clicked ${buttonType} button using text content`);
      await verifyDialogClosed(page, buttonType);
      return true;
    }
    
    // STRATEGY 5: Visual identification (blue button)
    const visualSuccess = await clickByVisualProperties(page, buttonType);
    if (visualSuccess) {
      logger.info(`Successfully clicked ${buttonType} button using visual properties`);
      await verifyDialogClosed(page, buttonType);
      return true;
    }
    
    // STRATEGY 6: Keyboard shortcuts as last resort
    const keyboardSuccess = await tryKeyboardShortcuts(page, buttonType);
    if (keyboardSuccess) {
      logger.info(`Successfully submitted ${buttonType} using keyboard shortcuts`);
      return true;
    }
    
    // If all strategies failed, take a failure screenshot
    const failScreenshot = await takeScreenshot(page, `${buttonType}_click_failure_all_strategies`);
    logger.error(`Failed to click ${buttonType} button after all strategies. See: ${failScreenshot}`);
    return false;
    
  } catch (error) {
    const errorScreenshot = await takeScreenshot(page, `${buttonType}_click_error`);
    logger.error(`Error trying to click ${buttonType} button: ${error.message}. See: ${errorScreenshot}`);
    return false;
  }
}

/**
 * Verify if dialog was closed after clicking
 */
async function verifyDialogClosed(page, buttonType) {
  // Wait briefly to let the UI respond
  await page.waitForTimeout(2000);
  
  try {
    // Check if dialog is still visible
    const dialogVisible = await page.evaluate(() => {
      const dialog = document.querySelector('[role="dialog"]');
      return !!dialog;
    });
    
    if (!dialogVisible) {
      logger.info(`Dialog closed after ${buttonType} button click, indicating success`);
      return true;
    } else {
      logger.info(`Dialog still visible after ${buttonType} button click, may need additional action`);
      // Take screenshot of the current state for debugging
      await takeScreenshot(page, `dialog_still_visible_${buttonType}`);
      return false;
    }
  } catch (error) {
    logger.error(`Error checking dialog visibility: ${error.message}`);
    return false;
  }
}

/**
 * Click button by data-testid
 */
async function clickByTestId(page, buttonType) {
  try {
    logger.info(`Trying data-testid approach for ${buttonType} button`);
    
    // Try inline button first (modern X UI)
    const inlineSelector = '[data-testid="tweetButtonInline"]';
    const inlineExists = await page.$(inlineSelector) !== null;
    
    if (inlineExists) {
      logger.info(`Found tweetButtonInline, clicking...`);
      await page.click(inlineSelector);
      return true;
    }
    
    // Try standard tweet button
    const standardSelector = '[data-testid="tweetButton"]';
    const standardExists = await page.$(standardSelector) !== null;
    
    if (standardExists) {
      logger.info(`Found standard tweetButton, clicking...`);
      await page.click(standardSelector);
      return true;
    }
    
    logger.info('No buttons found by data-testid');
    return false;
  } catch (error) {
    logger.error(`Error in clickByTestId: ${error.message}`);
    return false;
  }
}

/**
 * Click button by complex CSS selector
 */
async function clickBySelector(page, buttonType) {
  try {
    logger.info(`Trying complex CSS selector for ${buttonType} button`);
    
    // Long exact selector from the user
    const exactSelector = '#react-root > div > div > div.css-175oi2r.r-1f2l425.r-13qz1uu.r-417010.r-18u37iz > main > div > div > div > div.css-175oi2r.r-14lw9ot.r-jxzhtn.r-1ua6aaf.r-th6na.r-1phboty.r-16y2uox.r-184en5c.r-1abdc3e.r-1lg4w6u.r-f8sm7e.r-13qz1uu.r-1ye8kvj > div > div.css-175oi2r.r-14lw9ot.r-184en5c > div > div.css-175oi2r.r-1h8ys4a > div:nth-child(1) > div > div > div > div.css-175oi2r.r-1iusvr4.r-16y2uox.r-1777fci.r-1h8ys4a.r-1bylmt5.r-13tjlyg.r-7qyjyx.r-1ftll1t > div.css-175oi2r.r-14lw9ot.r-jumn1c.r-xd6kpl.r-gtdqiz.r-ipm5af.r-184en5c > div:nth-child(2) > div > div > div > button';
    
    // Check if the exact selector exists
    const buttonExists = await page.evaluate((selector) => {
      const button = document.querySelector(selector);
      return !!button;
    }, exactSelector);
    
    if (buttonExists) {
      logger.info('Found button with exact CSS selector, clicking via evaluate...');
      // Use evaluate to click to bypass any potential iframe issues
      await page.evaluate((selector) => {
        const button = document.querySelector(selector);
        if (button) button.click();
      }, exactSelector);
      return true;
    }
    
    // Try alternative shorter CSS selectors
    const altSelectors = [
      'div[role="dialog"] button[data-testid="tweetButtonInline"]',
      'div[role="dialog"] button[role="button"][style*="background-color: rgb(15, 20, 25)"]',
      'div[role="dialog"] div[data-testid="toolBar"] button',
      'div[role="dialog"] button[style*="background-color"]'
    ];
    
    for (const selector of altSelectors) {
      const exists = await page.$(selector) !== null;
      if (exists) {
        logger.info(`Found button with alternative selector: ${selector}`);
        await page.click(selector);
        return true;
      }
    }
    
    logger.info('No buttons found by CSS selectors');
    return false;
  } catch (error) {
    logger.error(`Error in clickBySelector: ${error.message}`);
    return false;
  }
}

/**
 * Click button by examining text content
 */
async function clickByTextContent(page, buttonType) {
  try {
    logger.info(`Trying text content approach for ${buttonType} button`);
    
    // Use evaluate to search for buttons by text content
    const clicked = await page.evaluate((type) => {
      // Terms to look for in button text
      const terms = type === 'reply' ? 
        ['reply', 'respond', 'post', 'tweet'] : 
        ['post', 'tweet', 'send'];
      
      // Find all buttons
      const buttons = Array.from(document.querySelectorAll('button'));
      
      // First look for exact match
      for (const term of terms) {
        const exactButton = buttons.find(btn => {
          if (!btn.textContent) return false;
          return btn.textContent.toLowerCase().trim() === term;
        });
        
        if (exactButton) {
          console.log(`Found button with exact text: ${term}`);
          exactButton.click();
          return true;
        }
      }
      
      // Then look for partial match
      for (const term of terms) {
        const partialButton = buttons.find(btn => {
          if (!btn.textContent) return false;
          return btn.textContent.toLowerCase().includes(term);
        });
        
        if (partialButton) {
          console.log(`Found button containing text: ${term}`);
          partialButton.click();
          return true;
        }
      }
      
      return false;
    }, buttonType);
    
    if (clicked) {
      logger.info(`Successfully clicked ${buttonType} button by text content`);
      return true;
    }
    
    logger.info('No buttons found by text content');
    return false;
  } catch (error) {
    logger.error(`Error in clickByTextContent: ${error.message}`);
    return false;
  }
}

/**
 * Click button by visual properties (blue button)
 */
async function clickByVisualProperties(page, buttonType) {
  try {
    logger.info(`Trying visual properties approach for ${buttonType} button`);
    
    // Look for blue buttons (X's primary action color)
    const clicked = await page.evaluate(() => {
      // Target X's blue colors
      const targetColors = [
        'rgb(15, 20, 25)',     // Almost black blue 
        'rgb(29, 155, 240)',   // Twitter blue
        'rgba(15, 20, 25',     // With any alpha
        'rgba(29, 155, 240'    // With any alpha
      ];
      
      const buttons = Array.from(document.querySelectorAll('button'));
      
      // First look at the bottom of the dialog for a blue button
      const dialogButtons = buttons.filter(btn => {
        const rect = btn.getBoundingClientRect();
        const style = window.getComputedStyle(btn);
        const bgColor = style.backgroundColor;
        
        // Button in the bottom half of the dialog
        const isInBottomHalf = rect.top > (window.innerHeight / 2);
        
        // Has one of our target colors
        const hasTargetColor = targetColors.some(color => bgColor.includes(color));
        
        return isInBottomHalf && hasTargetColor;
      });
      
      if (dialogButtons.length > 0) {
        console.log('Found blue button in dialog bottom half');
        dialogButtons[0].click();
        return true;
      }
      
      // Fall back to any blue button
      const blueButtons = buttons.filter(btn => {
        const style = window.getComputedStyle(btn);
        const bgColor = style.backgroundColor;
        return targetColors.some(color => bgColor.includes(color));
      });
      
      if (blueButtons.length > 0) {
        console.log('Found blue button');
        blueButtons[0].click();
        return true;
      }
      
      return false;
    });
    
    if (clicked) {
      logger.info(`Successfully clicked a blue button for ${buttonType} action`);
      return true;
    }
    
    logger.info('No buttons found by visual properties');
    return false;
  } catch (error) {
    logger.error(`Error in clickByVisualProperties: ${error.message}`);
    return false;
  }
}

/**
 * Use raw mouse clicks at element coordinates
 */
async function clickByCoordinates(page, buttonType) {
  try {
    logger.info(`Trying coordinate-based approach for ${buttonType} button`);
    
    // First take a screenshot to debug current state
    await takeScreenshot(page, `before_coordinates_${buttonType}`);
    
    // Find interactive elements that could be our button
    const coords = await page.evaluate((type) => {
      const searchTerms = type === 'reply' ? 
        ['reply', 'respond'] : 
        ['post', 'tweet', 'send'];
      
      // Look for elements with specific roles and text content
      const possibleElements = [];
      
      // All buttons
      const buttons = Array.from(document.querySelectorAll('button'));
      for (const btn of buttons) {
        // Skip disabled buttons
        if (btn.disabled) continue;
        
        // Check if button text matches our search terms
        const text = btn.textContent?.toLowerCase() || '';
        const hasMatchingText = searchTerms.some(term => text.includes(term));
        
        // Check if button is in visible viewport
        const rect = btn.getBoundingClientRect();
        const isVisible = rect.width > 0 && rect.height > 0 && 
          rect.top < window.innerHeight && rect.bottom > 0 && 
          rect.left < window.innerWidth && rect.right > 0;
          
        // Get computed style to check colors
        const style = window.getComputedStyle(btn);
        const bgColor = style.backgroundColor;
        const isBlue = bgColor.includes('rgb(29, 155, 240)') || 
                      bgColor.includes('rgb(15, 20, 25)');
                      
        // Calculate priority - higher is better
        let priority = 0;
        if (hasMatchingText) priority += 5;
        if (isBlue) priority += 3;
        if (btn.dataset.testid === 'tweetButtonInline') priority += 10;
        if (btn.dataset.testid === 'tweetButton') priority += 8;
        
        if (isVisible && priority > 0) {
          possibleElements.push({
            x: rect.left + rect.width / 2,
            y: rect.top + rect.height / 2,
            priority,
            text: btn.textContent?.trim() || '(no text)'
          });
        }
      }
      
      // Sort by priority (highest first)
      possibleElements.sort((a, b) => b.priority - a.priority);
      
      // Return the best candidate or null
      return possibleElements.length > 0 ? possibleElements[0] : null;
    }, buttonType);
    
    if (coords) {
      logger.info(`Found clickable element with text "${coords.text}" at x:${coords.x}, y:${coords.y} with priority ${coords.priority}`);
      
      // Force a mouse click at exact coordinates
      await page.mouse.move(coords.x, coords.y);
      await page.mouse.down();
      await page.waitForTimeout(100); // Brief pause
      await page.mouse.up();
      
      // Also try normal click for backup
      await page.mouse.click(coords.x, coords.y);
      
      await takeScreenshot(page, `after_coordinates_${buttonType}`);
      return true;
    }
    
    logger.info('No suitable elements found for coordinate clicking');
    return false;
  } catch (error) {
    logger.error(`Error in clickByCoordinates: ${error.message}`);
    return false;
  }
}

/**
 * Try pressing keyboard shortcuts that might submit the form
 */
async function tryKeyboardShortcuts(page, buttonType) {
  try {
    logger.info(`Trying keyboard shortcuts for ${buttonType} action`);
    
    // Take screenshot before
    await takeScreenshot(page, `before_shortcuts_${buttonType}`);
    
    // Common shortcuts that might submit forms
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1000);
    
    // Check if dialog is still visible
    const dialogStillVisible = await page.evaluate(() => {
      const dialog = document.querySelector('[role="dialog"]');
      return !!dialog;
    });
    
    if (!dialogStillVisible) {
      logger.info('Dialog closed after Enter key, assuming successful submission');
      return true;
    }
    
    // Try Ctrl+Enter
    await page.keyboard.down('Control');
    await page.keyboard.press('Enter');
    await page.keyboard.up('Control');
    await page.waitForTimeout(1000);
    
    // Check again if dialog is still visible
    const dialogVisible = await page.evaluate(() => {
      const dialog = document.querySelector('[role="dialog"]');
      return !!dialog;
    });
    
    if (!dialogVisible) {
      logger.info('Dialog closed after Ctrl+Enter, assuming successful submission');
      return true;
    }
    
    logger.info('Keyboard shortcuts did not work');
    return false;
  } catch (error) {
    logger.error(`Error in tryKeyboardShortcuts: ${error.message}`);
    return false;
  }
}

module.exports = {
  clickButton,
  takeScreenshot, // Export this so xService.js can use it directly if needed
  verifyDialogClosed
};
