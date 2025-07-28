/**
 * Logger utility for X-Poster Service
 * @author NihedBenAbdennour (website: nihedbenabdennour.me)
 */

const winston = require('winston');
const path = require('path');
const fs = require('fs');

// Ensure logs directory exists
const logDir = path.join(__dirname, '../logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

// Define log file name with date rotation
const getLogFileName = () => {
  const date = new Date();
  return `x-poster_${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}.log`;
};

// Configure winston logger
const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: winston.format.combine(
    winston.format.timestamp({
      format: 'YYYY-MM-DD HH:mm:ss'
    }),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'x-poster-service' },
  transports: [
    // Console transport with colorization
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(info => {
          return `${info.level}: ${info.message} ${JSON.stringify(info.timestamp ? { service: info.service, timestamp: info.timestamp } : {})}`;
        })
      ),
      handleExceptions: true
    }),
    
    // Daily rotating file transport
    new winston.transports.File({
      filename: path.join(logDir, getLogFileName()),
      maxsize: 10485760, // 10MB
      maxFiles: 30,
      tailable: true,
      handleExceptions: true,
      format: winston.format.combine(
        winston.format.printf(info => {
          return `${info.level}: ${info.message} ${JSON.stringify(info.timestamp ? { service: info.service, timestamp: info.timestamp } : {})}`;
        })
      )
    })
  ],
  exitOnError: false
});

// Add stream functionality for use with morgan
logger.stream = {
  write: function(message) {
    logger.info(message.trim());
  }
};

module.exports = logger;
