/**
 * Monitoring Routes
 * Provides system health check, logs access, and screenshots retrieval
 * Developed By NihedBenAbdennour (website: nihedbenabdennour.me)
 */
const express = require('express');
const router = express.Router();
const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');
const { getStoredCookies } = require('../utils/cookieManager');

// Constants
const LOGS_DIR = path.join(process.cwd(), 'logs');
const SCREENSHOTS_DIR = path.join(process.cwd(), 'screenshots');

/**
 * GET /api/status or /api/v1/status
 * System health check - Returns system status and health information
 */
router.get(['/status', '/v1/status'], async (req, res) => {
  try {
    // Get system uptime
    const uptimeSeconds = process.uptime();
    const days = Math.floor(uptimeSeconds / (24 * 60 * 60));
    const hours = Math.floor((uptimeSeconds % (24 * 60 * 60)) / (60 * 60));
    const minutes = Math.floor((uptimeSeconds % (60 * 60)) / 60);
    const uptime = `${days}d ${hours}h ${minutes}m`;

    // Check session status
    let sessionStatus = {
      loggedIn: false,
      username: null
    };

    try {
      const cookies = await getStoredCookies();
      if (cookies) {
        const authTokenCookie = cookies.find(cookie => cookie.name === 'auth_token');
        if (authTokenCookie) {
          sessionStatus.loggedIn = true;
          // We don't store username in cookies, so we'll just indicate login state
          sessionStatus.username = process.env.X_USERNAME || 'User';
        }
      }
    } catch (error) {
      logger.warn(`Error checking session status: ${error.message}`);
    }

    // Get memory usage
    const memoryUsage = process.memoryUsage();
    const memoryUsageMB = Math.round(memoryUsage.rss / 1024 / 1024);

    // Check proxy status
    let proxyStatus = "not configured";
    if (process.env.PROXY_HOST && process.env.PROXY_PORT) {
      proxyStatus = "configured";
      // Note: A real check would try to connect through the proxy
      // but for simplicity we're just checking if it's configured
    }

    // Prepare the response
    const response = {
      status: "success",
      message: "System is healthy",
      data: {
        uptime: uptime,
        memory_usage: `${memoryUsageMB}MB`,
        session_status: sessionStatus,
        proxy_status: proxyStatus,
        system_info: {
          node_version: process.version,
          platform: process.platform,
          cpus: os.cpus().length
        }
      }
    };

    return res.status(200).json(response);
  } catch (error) {
    logger.error(`Error in status endpoint: ${error.message}`, { stack: error.stack });
    return res.status(500).json({
      status: "error",
      message: "Failed to retrieve system status",
      error: error.message
    });
  }
});

/**
 * GET /api/logs or /api/v1/logs
 * Retrieve system logs with filtering options
 */
router.get(['/logs', '/v1/logs'], async (req, res) => {
  try {
    // Extract query parameters
    const { date, level, limit = 100 } = req.query;
    const limitNum = parseInt(limit, 10);

    // Ensure logs directory exists
    await fs.mkdir(LOGS_DIR, { recursive: true });

    // Determine which log file to read based on date
    let logFile;
    if (date) {
      // Format should be YYYY-MM-DD
      logFile = path.join(LOGS_DIR, `app-${date}.log`);
    } else {
      // Use current date if not specified
      const today = new Date().toISOString().split('T')[0];
      logFile = path.join(LOGS_DIR, `app-${today}.log`);
    }

    // Read log file if it exists
    let logs = [];
    try {
      const logContent = await fs.readFile(logFile, 'utf8');
      
      // Parse logs - assuming each line is a JSON entry
      logs = logContent.split('\n')
        .filter(line => line.trim())
        .map(line => {
          try {
            return JSON.parse(line);
          } catch {
            return { timestamp: new Date().toISOString(), level: 'error', message: `Failed to parse log line: ${line}` };
          }
        });

      // Filter by level if specified
      if (level) {
        logs = logs.filter(log => log.level === level);
      }

      // Apply limit
      logs = logs.slice(-limitNum);

    } catch (error) {
      if (error.code === 'ENOENT') {
        logs = [];
      } else {
        throw error;
      }
    }

    // Prepare the response
    return res.status(200).json({
      status: "success",
      request_id: uuidv4(),
      data: {
        date: date || new Date().toISOString().split('T')[0],
        level: level || 'all',
        count: logs.length,
        logs: logs
      }
    });
  } catch (error) {
    logger.error(`Error in logs endpoint: ${error.message}`, { stack: error.stack });
    return res.status(500).json({
      status: "error",
      request_id: uuidv4(),
      message: "Failed to retrieve logs",
      error: error.message
    });
  }
});

/**
 * GET /api/screenshots or /api/v1/screenshots
 * Retrieve error screenshots with filtering options
 */
router.get(['/screenshots', '/v1/screenshots'], async (req, res) => {
  try {
    // Extract query parameters
    const { date, type } = req.query;

    // Ensure screenshots directory exists
    await fs.mkdir(SCREENSHOTS_DIR, { recursive: true });

    // List all screenshot files
    let files = await fs.readdir(SCREENSHOTS_DIR);
    
    // Filter files based on query parameters
    if (date) {
      // Format should be YYYY-MM-DD
      files = files.filter(file => file.includes(date));
    }
    
    if (type) {
      // Types could be error, success, etc.
      files = files.filter(file => file.includes(type));
    }

    // Sort files by modification time (newest first)
    const filesWithStats = await Promise.all(
      files.map(async (file) => {
        const filePath = path.join(SCREENSHOTS_DIR, file);
        const stats = await fs.stat(filePath);
        return {
          filename: file,
          path: `/screenshots/${file}`, // URL path, not filesystem path
          timestamp: stats.mtime,
          size: stats.size
        };
      })
    );

    // Sort by timestamp, newest first
    filesWithStats.sort((a, b) => b.timestamp - a.timestamp);

    // Prepare the response
    return res.status(200).json({
      status: "success",
      request_id: uuidv4(),
      data: {
        count: filesWithStats.length,
        screenshots: filesWithStats
      }
    });
  } catch (error) {
    logger.error(`Error in screenshots endpoint: ${error.message}`, { stack: error.stack });
    return res.status(500).json({
      status: "error",
      request_id: uuidv4(),
      message: "Failed to retrieve screenshots",
      error: error.message
    });
  }
});

// Endpoint to view a specific screenshot
router.get('/screenshots/:filename', async (req, res) => {
  try {
    const { filename } = req.params;
    const screenshotPath = path.join(SCREENSHOTS_DIR, filename);
    
    // Check if file exists
    try {
      await fs.access(screenshotPath);
    } catch (error) {
      return res.status(404).json({ 
        status: "error",
        message: "Screenshot not found" 
      });
    }
    
    // Send the file
    res.sendFile(screenshotPath);
  } catch (error) {
    logger.error(`Error serving screenshot: ${error.message}`, { stack: error.stack });
    return res.status(500).json({
      status: "error",
      message: "Failed to retrieve screenshot",
      error: error.message
    });
  }
});

module.exports = router;
