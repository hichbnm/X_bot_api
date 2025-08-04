/**
 * Advanced Logger Utility with daily rotation and JSON formatting
 * Developed By NihedBenAbdennour (website: nihedbenabdennour.me)
 */
const winston = require('winston');
const path = require('path');
const fs = require('fs');

// Ensure logs directory exists
const logDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

// Ensure screenshots directory exists
const screenshotsDir = path.join(process.cwd(), 'screenshots');
if (!fs.existsSync(screenshotsDir)) {
  fs.mkdirSync(screenshotsDir, { recursive: true });
}

// Create dynamic filename based on the current date
const getLogFileName = () => {
  const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
  return path.join(logDir, `app-${date}.log`);
};

// Create Winston logger
const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: winston.format.combine(
    winston.format.timestamp({
      format: 'YYYY-MM-DD HH:mm:ss.SSS'
    }),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    winston.format.json()
  ),
  defaultMeta: { service: 'x-posts-bot' },
  transports: [
    // Write all logs with level 'error' and below to error-{date}.log
    new winston.transports.File({ 
      filename: path.join(logDir, `error-${new Date().toISOString().split('T')[0]}.log`),
      level: 'error' 
    }),
    // Write all logs to app-{date}.log
    new winston.transports.File({ 
      filename: getLogFileName()
    })
  ]
});

// Add console transport in development mode
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.timestamp({
        format: 'YYYY-MM-DD HH:mm:ss'
      }),
      winston.format.printf(({ timestamp, level, message, stack, ...metadata }) => {
        let requestId = metadata.requestId ? `[${metadata.requestId}] ` : '';
        let metadataStr = '';
        
        if (Object.keys(metadata).length > 0) {
          // Filter out large objects for console display
          const displayMeta = { ...metadata };
          delete displayMeta.service; // Don't need to show service name in every log
          
          if (Object.keys(displayMeta).length > 0) {
            metadataStr = `\n${JSON.stringify(displayMeta, null, 2)}`;
          }
        }
        
        if (stack) {
          return `[${timestamp}] ${level}: ${requestId}${message}\n${stack}${metadataStr}`;
        }
        return `[${timestamp}] ${level}: ${requestId}${message}${metadataStr}`;
      })
    )
  }));
}

// Helper function to capture screenshots on errors
logger.captureErrorScreenshot = async (page, errorMessage) => {
  if (!page) return null;
  
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const screenshotPath = path.join(screenshotsDir, `error_${timestamp}.png`);
    await page.screenshot({ path: screenshotPath, fullPage: true });
    logger.info(`Error screenshot saved: ${screenshotPath}`, { errorMessage });
    return screenshotPath;
  } catch (screenshotError) {
    logger.error(`Failed to capture error screenshot: ${screenshotError.message}`);
    return null;
  }
};

// Add request logging helper
logger.logRequest = (req, message) => {
  const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
  logger.info(message, {
    requestId: req.id || 'unknown',
    ip,
    method: req.method,
    path: req.originalUrl || req.url,
    userAgent: req.headers['user-agent']
  });
};

// Add error logging helper
logger.logError = (error, req = null) => {
  const metadata = { stack: error.stack };
  
  if (req) {
    metadata.requestId = req.id || 'unknown';
    metadata.ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    metadata.method = req.method;
    metadata.path = req.originalUrl || req.url;
  }
  
  logger.error(error.message, metadata);
};

module.exports = logger;
