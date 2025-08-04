/**
 * Direct DOM event dispatching utilities to bypass Puppeteer limitations
 * These functions help when standard page.click() and similar methods fail
 */
const logger = require('./logger');

/**
 * Dispatch direct DOM events at specific coordinates
 * @param {Object} page - Puppeteer page object
 * @param {number} x - X coordinate
 * @param {number} y - Y coordinate
 * @returns {Promise<boolean>} Success status
 */
async function dispatchEventsAtCoordinates(page, x, y) {
  try {
    return await page.evaluate(({ x, y }) => {
      // Find the element at the given coordinates
      const element = document.elementFromPoint(x, y);
      if (!element) {
        console.error(`No element found at coordinates (${x}, ${y})`);
        return false;
      }

      console.log(`Found element at (${x}, ${y}): ${element.tagName}${element.id ? '#' + element.id : ''}${element.className ? '.' + element.className.replace(/\s+/g, '.') : ''}`);
      
      // Apply focus first
      element.focus();
      
      // Dispatch a series of events to simulate a real click
      const eventNames = [
        'mousedown', 'mouseup', 'click',
        'pointerdown', 'pointerup'
      ];
      
      // Dispatch each event in sequence
      eventNames.forEach(eventName => {
        const eventOptions = {
          bubbles: true,
          cancelable: true,
          view: window,
          clientX: x,
          clientY: y,
          screenX: x,
          screenY: y
        };
        
        let event;
        if (eventName.startsWith('mouse')) {
          event = new MouseEvent(eventName, eventOptions);
        } else if (eventName.startsWith('pointer')) {
          event = new PointerEvent(eventName, {
            ...eventOptions,
            pointerId: Date.now(),
            pointerType: 'mouse'
          });
        }
        
        if (event) {
          console.log(`Dispatching ${eventName} event to element`);
          element.dispatchEvent(event);
        }
      });
      
      // Also try direct click method
      element.click();
      
      return true;
    }, { x, y });
  } catch (error) {
    logger.error(`Error dispatching events at coordinates: ${error.message}`);
    return false;
  }
}

/**
 * Find and click the post/reply button using advanced DOM techniques
 * @param {Object} page - Puppeteer page object
 * @param {string} buttonType - Type of button ('post' or 'reply')
 * @returns {Promise<boolean>} Success status
 */
async function findAndClickActionButton(page, buttonType = 'post') {
  try {
    logger.info(`Attempting to find and click ${buttonType} button with advanced DOM techniques`);
    
    // Take screenshot before
    await page.screenshot({ path: `screenshots/${buttonType}_before_advanced_dom.png` });
    
    // Get all buttons in the DOM with their properties
    const buttons = await page.evaluate((type) => {
      // Relevant terms to look for based on button type
      const terms = type === 'post' ? ['post', 'tweet', 'submit'] : ['reply', 'respond', 'send'];
      
      // Collect all buttons with their properties
      return Array.from(document.querySelectorAll('button')).map(btn => {
        const rect = btn.getBoundingClientRect();
        const style = window.getComputedStyle(btn);
        const text = btn.textContent?.trim() || '';
        const dataTestId = btn.getAttribute('data-testid') || '';
        
        // Calculate match score
        let score = 0;
        
        // Check for matching text
        if (terms.some(term => text.toLowerCase().includes(term))) {
          score += 10;
        }
        
        // Check for relevant data-testid
        if (dataTestId === 'tweetButtonInline' || dataTestId === 'tweetButton') {
          score += 15;
        }
        
        // Check if button is blue (X's action color)
        const bgColor = style.backgroundColor;
        if (bgColor.includes('rgb(29, 155, 240)') || bgColor.includes('rgb(15, 20, 25)')) {
          score += 5;
        }
        
        // Check if button is in dialog
        const inDialog = !!btn.closest('[role="dialog"]');
        if (inDialog) {
          score += 3;
        }
        
        // Check if button is in bottom half of viewport
        if (rect.top > window.innerHeight / 2) {
          score += 2;
        }
        
        // Check if button is enabled
        if (!btn.disabled) {
          score += 1;
        }
        
        // Return button with properties
        return {
          x: rect.left + rect.width / 2,
          y: rect.top + rect.height / 2,
          width: rect.width,
          height: rect.height,
          text: text,
          testId: dataTestId,
          isBlue: (bgColor.includes('rgb(29, 155, 240)') || bgColor.includes('rgb(15, 20, 25)')),
          isEnabled: !btn.disabled,
          inViewport: (
            rect.width > 0 && rect.height > 0 &&
            rect.top < window.innerHeight && rect.bottom > 0 &&
            rect.left < window.innerWidth && rect.right > 0
          ),
          score: score
        };
      }).filter(btn => btn.inViewport && btn.isEnabled && btn.score > 0)
       .sort((a, b) => b.score - a.score); // Sort by score, highest first
    }, buttonType);
    
    logger.info(`Found ${buttons.length} potential ${buttonType} buttons`);
    
    // No buttons found
    if (!buttons || buttons.length === 0) {
      logger.error(`No potential ${buttonType} buttons found`);
      return false;
    }
    
    // Log the top candidates
    buttons.slice(0, 3).forEach((btn, i) => {
      logger.info(`Button candidate #${i+1}: "${btn.text}" (score: ${btn.score}, testId: ${btn.testId || 'none'})`);
    });
    
    // Try clicking the top 3 candidates with direct events
    for (let i = 0; i < Math.min(3, buttons.length); i++) {
      const btn = buttons[i];
      logger.info(`Attempting to click button "${btn.text}" at coordinates (${btn.x}, ${btn.y})`);
      
      // First try clicking with dispatchEventsAtCoordinates
      const dispatched = await dispatchEventsAtCoordinates(page, btn.x, btn.y);
      if (dispatched) {
        logger.info(`Successfully dispatched events to button "${btn.text}"`);
        
        // Wait a moment to see if the dialog closes
        await page.waitForTimeout(2000);
        
        // Check if dialog closed
        const dialogClosed = await page.evaluate(() => {
          const dialog = document.querySelector('[role="dialog"]');
          return !dialog;
        });
        
        if (dialogClosed) {
          logger.info(`Dialog closed after clicking button "${btn.text}"`);
          return true;
        } else {
          logger.info(`Dialog still open after clicking button "${btn.text}", trying next candidate`);
        }
      }
    }
    
    // If we get here, none of the buttons worked
    logger.error(`Failed to click any ${buttonType} button candidates`);
    return false;
  } catch (error) {
    logger.error(`Error in findAndClickActionButton: ${error.message}`);
    return false;
  }
}

module.exports = {
  dispatchEventsAtCoordinates,
  findAndClickActionButton
};
