# X-Posts Bot - Technical Documentation

**Author: Nihed BenAbdennour**  
**Website: [nihedbenabdennour.me](https://nihedbenabdennour.me)**

![X-Posts Bot](https://img.shields.io/badge/X--Posts%20Bot-v1.0.0-blue)
![License](https://img.shields.io/badge/License-MIT-green)

## Table of Contents

1. [Project Overview](#project-overview)
2. [System Architecture](#system-architecture)
3. [Setup and Configuration](#setup-and-configuration)
4. [API Documentation](#api-documentation)
5. [Implementation Details](#implementation-details)
6. [Proxy Integration](#proxy-integration)
7. [Error Handling and Recovery](#error-handling-and-recovery)
8. [Docker Deployment](#docker-deployment)
9. [Logging and Monitoring](#logging-and-monitoring)
10. [Developer Bonuses](#developer-bonuses)
11. [Support and Maintenance](#support-and-maintenance)

## Project Overview

X-Posts Bot is a Node.js backend service designed to automate posting on X (formerly Twitter) through both browser-based and direct API approaches. The system can:

- Post new content to X timeline
- Reply to existing X posts
- Route all traffic through a proxy server
- Handle authentication securely
- Auto-recover from common errors
- Provide detailed error logs and screenshots
- Maintain session persistence

The service offers two distinct implementation strategies:
- **Puppeteer-Based Automation**: Simulates user interactions through a headless browser
- **Direct API Integration**: Makes direct HTTP requests to X's GraphQL API (Developer Bonus)

## System Architecture

The project follows a modular architecture with clear separation of concerns:

```
X-Posts-Bot
│
├── index.js                   # Main application entry point
├── routes/                    # API route handlers
│   ├── apiRoutes.js          # Puppeteer-based posting routes
│   ├── directRoutes.js       # Direct API posting routes
│   └── xRoutes.js            # X-specific utility routes
│
├── middleware/                # Express middleware
│   └── authMiddleware.js     # Bearer token authentication
│
├── utils/                     # Utility functions
│   ├── goStyleDirectApiFix.js # Final Go-style direct API implementation
│   ├── goCt0Manager.js        # CT0 cookie management (Go-style)
│   ├── cookieManager.js       # Cookie handling for browser sessions
│   ├── buttonClicker.js       # Puppeteer UI interaction helpers
│   ├── xpffGenerator.js       # X-specific forwarding header generator
│   ├── logger.js              # Logging utilities
│   └── [other utility modules]
│
├── services/                  # Business logic services
│   └── xService.js           # X posting service (Puppeteer implementation)
│
├── data/                      # Persistent data storage
│   ├── auth_token.txt        # X authentication token
│   └── cookies.json          # Stored browser cookies
│
├── logs/                      # Application logs
│
└── screenshots/               # Error screenshots for debugging
```

## Setup and Configuration

### Prerequisites

- Node.js (v14 or higher)
- Docker and Docker Compose (for containerized deployment)
- X account with authentication credentials
- Proxy server (details to be provided)

### Environment Configuration

Create a `.env` file in the root directory with the following variables:

```
# Server Configuration
PORT=3000
NODE_ENV=development  # Set to 'production' in production

# API Authentication
API_TOKEN=your_secure_api_token

# X Account Credentials
X_USERNAME=your_x_username
X_PASSWORD=your_x_password

# Proxy Configuration
PROXY_HOST=your_proxy_host
PROXY_PORT=your_proxy_port
PROXY_USERNAME=your_proxy_username
PROXY_PASSWORD=your_proxy_password  # If required
```

### Authentication Setup

1. **API Bearer Token**: Set the `API_TOKEN` in your .env file to secure the API endpoints.

2. **X Authentication**: The system supports two authentication methods:
   - Username/password (stored in .env)
   - Auth token file (stored in `data/auth_token.txt`)
   
   For optimal performance, provide an auth token file to avoid frequent logins.

### Installation

```bash
# Clone the repository
git clone <repository-url>

# Install dependencies
npm install

# Start the service
npm start

# Alternative: Run with Docker
docker-compose up -d
```

## API Documentation

### Authentication

All API endpoints require a bearer token in the request header:

```
Authorization: Bearer your_api_token
```

### Core Endpoints

#### Posting and Reply Endpoints

1. **Create Post (Browser Automation)**
   - **URL**: `POST /api/post` or `POST /api/v1/post`
   - **Headers**: 
     ```
     Authorization: Bearer your_api_token
     Content-Type: application/json
     ```
   - **Body**:
     ```json
     {
       "content": "Your post content here #hashtag",
       "media": ["url_to_image_1", "url_to_image_2"]  // Optional
     }
     ```
   - **Response**:
     ```json
     {
       "request_id": "uuid-1234-5678-9101",
       "status": "success",
       "message": "Post published successfully",
       "data": {
         "screenshot": "path/to/screenshot.png"  // Optional
       }
     }
     ```

2. **Reply to Post (Browser Automation)**
   - **URL**: `POST /api/reply` or `POST /api/v1/reply`
   - **Headers**:
     ```
     Authorization: Bearer your_api_token
     Content-Type: application/json
     ```
   - **Body**:
     ```json
     {
       "content": "Your reply content here #hashtag",
       "url": "https://x.com/username/status/1234567890123456789",
       "media": ["url_to_image_1"]  // Optional
     }
     ```
   - **Response**:
     ```json
     {
       "request_id": "uuid-1234-5678-9102",
       "status": "success",
       "message": "Reply published successfully",
       "data": {
         "screenshot": "path/to/screenshot.png"  // Optional
       }
     }
     ```

#### System and Monitoring Endpoints

1. **System Health Check**
   - **URL**: `GET /api/status` or `GET /api/v1/status`
   - **Headers**: `Authorization: Bearer your_api_token`
   - **Response**:
     ```json
     {
       "status": "success",
       "message": "System is healthy",
       "data": {
         "uptime": "2d 3h 45m",
         "memory_usage": "120MB",
         "session_status": {
           "logged_in": true,
           "username": "your_x_username"
         },
         "proxy_status": "connected"
       }
     }
     ```

2. **Retrieve Logs**
   - **URL**: `GET /api/logs` or `GET /api/v1/logs`
   - **Headers**: `Authorization: Bearer your_api_token`
   - **Query Parameters**: `?date=2023-07-30&level=error`
   - **Response**:
     ```json
     {
       "status": "success",
       "data": {
         "logs": [
           {
             "timestamp": "2023-07-30T14:22:33Z",
             "level": "error",
             "message": "Failed to post content",
             "details": "Element not found: tweet-button"
           },
           // Additional log entries...
         ]
       }
     }
     ```

3. **Retrieve Error Screenshots**
   - **URL**: `GET /api/screenshots` or `GET /api/v1/screenshots`
   - **Headers**: `Authorization: Bearer your_api_token`
   - **Query Parameters**: `?date=2023-07-30`
   - **Response**:
     ```json
     {
       "status": "success",
       "data": {
         "screenshots": [
           {
             "timestamp": "2023-07-30T14:22:33Z",
             "path": "/screenshots/error_20230730142233.png",
             "related_error": "Failed to post content"
           },
           // Additional screenshot entries...
         ]
       }
     }
     ```

#### Authentication & Utility Endpoints

1. **Get Auth Token**
   - **URL**: `GET /api/auth/token`
   - **Headers**: `Authorization: Bearer your_api_token`
   - **Description**: Launches a browser window for manual X login and extracts the auth_token cookie after successful login.
   - **Response**:
     ```json
     {
       "status": "success",
       "message": "Auth token retrieved successfully",
       "data": {
         "token": "your_auth_token_here"
       }
     }
     ```

2. **Get Session Status**
   - **URL**: `GET /api/session/status`
   - **Headers**: `Authorization: Bearer your_api_token`
   - **Description**: Checks the current session status with X platform, including login state and cookie validity.
   - **Response**:
     ```json
     {
       "status": "success",
       "data": {
         "loggedIn": true,
         "username": "your_x_username",
         "cookiesValid": true,
         "lastLogin": "2023-07-30T14:22:33Z"
       }
     }
     ```

3. **Force Re-login**
   - **URL**: `POST /api/session/login`
   - **Headers**: `Authorization: Bearer your_api_token`
   - **Description**: Forces a new login session regardless of current session status.
   - **Response**:
     ```json
     {
       "status": "success",
       "message": "Login successful",
       "data": {
         "username": "your_x_username"
       }
     }
     ```

### Direct API Endpoints (Developer Bonus)

1. **Direct Post (GraphQL API)**
   - **URL**: `POST /api/direct/post`
   - **Headers**:
     ```
     Authorization: Bearer your_api_token
     Content-Type: application/json
     ```
   - **Body**:
     ```json
     {
       "content": "Your post content here #hashtag",
       "guestId": "v1%3A175379720523324276" // Optional guest ID for XPFF header
     }
     ```
   - **Response**:
     ```json
     {
       "status": "success",
       "message": "Post published successfully",
       "data": {
         "tweetId": "1234567890123456789"
       }
     }
     ```

2. **Direct Reply (GraphQL API)**
   - **URL**: `POST /api/direct/reply`
   - **Headers**:
     ```
     Authorization: Bearer your_api_token
     Content-Type: application/json
     ```
   - **Body**:
     ```json
     {
       "content": "Your reply content here #hashtag",
       "postUrl": "https://x.com/username/status/1234567890123456789",
       "guestId": "v1%3A175379720523324276" // Optional guest ID for XPFF header
     }
     ```
   - **Response**:
     ```json
     {
       "status": "success",
       "message": "Reply published successfully",
       "data": {
         "replyTweetId": "1234567890123456790",
         "originalTweetId": "1234567890123456789"
       }
     }
     ```

### Example Usage with curl

```bash
# Create a new post using browser automation
curl -X POST http://localhost:3000/api/post \
  -H "Authorization: Bearer your_api_token" \
  -H "Content-Type: application/json" \
  -d '{"content": "Testing the X-Posts Bot API! #automation #testing"}'

# Reply to a post using browser automation
curl -X POST http://localhost:3000/api/reply \
  -H "Authorization: Bearer your_api_token" \
  -H "Content-Type: application/json" \
  -d '{"content": "Testing the X-Posts Bot Reply API!", "url": "https://x.com/username/status/1234567890123456789"}'

# Check system health
curl -X GET http://localhost:3000/api/status \
  -H "Authorization: Bearer your_api_token"

# Retrieve error logs
curl -X GET "http://localhost:3000/api/logs?level=error" \
  -H "Authorization: Bearer your_api_token"
```

## Implementation Details

### Puppeteer-Based Implementation

The Puppeteer implementation simulates human-like interactions with X's web interface:

1. **Session Management**:
   - Stores and reuses browser cookies to maintain login state
   - Automatically re-authenticates when session expires
   - Handles Cloudflare and other anti-bot protections

2. **Posting Flow**:
   - Opens browser to X homepage
   - Waits for page to fully load (including dynamic content)
   - Clicks the post button
   - Types content with natural timing
   - Uploads media if provided
   - Submits the post
   - Confirms successful posting

3. **Reply Flow**:
   - Opens the specified post URL
   - Waits for the reply button to appear
   - Clicks the reply button
   - Types reply content
   - Uploads media if provided
   - Submits the reply
   - Confirms successful reply

4. **Anti-Detection Measures**:
   - Uses puppeteer-extra-plugin-stealth to avoid detection
   - Implements randomized typing speed
   - Adds natural delays between actions
   - Uses realistic viewport sizes and user agents
   - Handles common detection patterns

### Direct API Implementation (Developer Bonus)

The Direct API implementation makes HTTP requests directly to X's GraphQL API endpoints:

1. **Authentication**:
   - Extracts auth_token from the file or browser cookies
   - Retrieves CT0 CSRF token using a specialized browser session
   - Constructs authentication headers matching X's web client

2. **Posting Flow**:
   - Constructs GraphQL request payload with tweet content
   - Sets all required headers (including anti-bot headers)
   - Makes direct POST request to X's GraphQL API
   - Parses response to confirm success

3. **Reply Flow**:
   - Extracts tweet ID from post URL
   - Constructs reply GraphQL payload with in_reply_to_tweet_id
   - Sets authentication and anti-bot headers
   - Makes direct POST request to X's GraphQL API
   - Validates response to confirm successful reply

## Proxy Integration

All network traffic is routed through a proxy server as required:

### Puppeteer Proxy Configuration

```javascript
// Proxy configuration for Puppeteer
const browser = await puppeteer.launch({
  args: [
    `--proxy-server=${process.env.PROXY_HOST}:${process.env.PROXY_PORT}`,
    '--no-sandbox',
    '--disable-setuid-sandbox'
  ],
  // Other options...
});

// Authenticate with proxy if credentials are provided
if (process.env.PROXY_USERNAME && process.env.PROXY_PASSWORD) {
  await page.authenticate({
    username: process.env.PROXY_USERNAME,
    password: process.env.PROXY_PASSWORD
  });
}
```

### Direct API Proxy Configuration

```javascript
// Proxy configuration for direct API calls
const httpsAgent = new HttpsProxyAgent({
  host: process.env.PROXY_HOST,
  port: process.env.PROXY_PORT,
  auth: process.env.PROXY_USERNAME && process.env.PROXY_PASSWORD 
    ? `${process.env.PROXY_USERNAME}:${process.env.PROXY_PASSWORD}` 
    : undefined
});

// Use the agent in axios requests
const response = await axios({
  method: 'POST',
  url: 'https://x.com/i/api/graphql/...',
  headers: headers,
  data: requestBody,
  httpsAgent: httpsAgent
});
```

### Proxy Error Handling

The system implements robust proxy error handling:

1. **Connection Failures**:
   - Detects proxy connection issues
   - Attempts reconnection with exponential backoff
   - Reports detailed proxy errors in logs

2. **Authentication Issues**:
   - Validates proxy credentials before operation
   - Provides clear error messages for auth failures
   - Logs detailed proxy authentication errors

3. **Performance Monitoring**:
   - Tracks proxy response times
   - Logs slow proxy performance
   - Reports proxy availability in health checks

## Error Handling and Recovery

The system implements comprehensive error handling and recovery strategies:

### Error Types and Recovery Strategies

| Error Type | Detection | Recovery Strategy |
|------------|-----------|-------------------|
| Session Expired | 401/403 status or login redirect | Auto re-login and retry request |
| Rate Limiting | 429 status or rate limit message | Wait with exponential backoff |
| Network Issues | Connection timeouts | Retry with backoff (max 3 attempts) |
| Element Not Found | DOM element missing | Extended wait (up to 30 seconds) |
| Anti-Bot Detection | CAPTCHA or verification prompts | Screenshot, log, report to admin |
| Proxy Failure | Proxy connection errors | Try alternate proxy or direct connection |

### Error Logging

For each error, the system records:

1. **Detailed Error Context**:
   - Error type and message
   - Stack trace
   - Request details
   - Current page URL
   - HTTP status codes

2. **Visual Evidence**:
   - Screenshot of the error state
   - HTML source of problematic page
   - Console logs from browser

3. **Recovery Actions**:
   - Attempted recovery steps
   - Success/failure of recovery
   - Number of retries performed

## Docker Deployment

The project includes Docker configuration for easy deployment:

```yaml
# docker-compose.yml
version: '3'
services:
  x-posts-bot:
    build: .
    ports:
      - "3000:3000"
    volumes:
      - ./data:/app/data
      - ./logs:/app/logs
      - ./screenshots:/app/screenshots
    environment:
      - PORT=3000
      - NODE_ENV=production
      - API_TOKEN=${API_TOKEN}
      - X_USERNAME=${X_USERNAME}
      - X_PASSWORD=${X_PASSWORD}
      - PROXY_HOST=${PROXY_HOST}
      - PROXY_PORT=${PROXY_PORT}
      - PROXY_USERNAME=${PROXY_USERNAME}
      - PROXY_PASSWORD=${PROXY_PASSWORD}
```

```dockerfile
# Dockerfile
FROM node:16-slim

# Install dependencies for Puppeteer
RUN apt-get update && apt-get install -y \
    chromium \
    fonts-ipafont-gothic fonts-wqy-zenhei fonts-thai-tlwg fonts-kacst \
    --no-install-recommends

# Set up work directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Create directories for data persistence
RUN mkdir -p data logs screenshots && chmod 777 data logs screenshots

# Expose port
EXPOSE 3000

# Start the application
CMD ["node", "index.js"]
```

### Docker Deployment Instructions

1. **Build and Start the Container**:
   ```bash
   docker-compose up -d
   ```

2. **View Logs**:
   ```bash
   docker-compose logs -f
   ```

3. **Update the Service**:
   ```bash
   docker-compose pull
   docker-compose up -d
   ```

4. **Stop the Service**:
   ```bash
   docker-compose down
   ```

## Logging and Monitoring

### Logging System

The application uses a structured logging system with the following features:

1. **Log Levels**:
   - `error`: Critical errors requiring immediate attention
   - `warn`: Potential issues that don't stop execution
   - `info`: Standard operational information
   - `debug`: Detailed debugging information
   - `trace`: Very verbose logging for development

2. **Log Storage**:
   - Daily rotating log files
   - 30-day retention period
   - Separate files for errors and general logs

3. **Log Format**:
   ```json
   {
     "timestamp": "2023-07-30T14:22:33.456Z",
     "level": "info",
     "message": "Post successfully published",
     "context": {
       "requestId": "uuid-1234-5678-9101",
       "url": "https://x.com/home"
     }
   }
   ```

### Screenshot Capture

The system automatically captures screenshots in various scenarios:

1. **Error Scenarios**:
   - Element not found errors
   - Authentication failures
   - Anti-bot detection
   - Unexpected page state

2. **Success Verification**:
   - Post confirmation screen (optional)
   - Reply confirmation screen (optional)

3. **Screenshot Naming Convention**:
   ```
   screenshots/[error|success]_[timestamp]_[requestId].png
   ```

### Monitoring Endpoints

1. **Health Check**:
   - `GET /api/status` provides system health information
   - Checks session status, proxy connection, and resource usage
   - Returns HTTP 200 for healthy system, 500 for unhealthy

2. **Logs API**:
   - `GET /api/logs` retrieves logs with filtering options
   - Can filter by date, level, and request ID
   - Paginated results for large log files

## Developer Bonuses

Beyond the required functionality, several bonus features were implemented:

1. **Direct API Integration**:
   - Bypasses the need for browser automation for faster posting
   - Reduces resource usage and improves reliability
   - Provides detailed response data for debugging

2. **Go-Style Implementation**:
   - Created a Node.js implementation that perfectly replicates a proven Go solution
   - Resolved 403 Forbidden errors through exact header and request matching
   - Improved authentication reliability with specialized CT0 retrieval

3. **Enhanced Logging and Debugging**:
   - Implemented detailed request and response logging
   - Added response validation to catch silent failures
   - Created specialized error handling for different API error codes

## Support and Maintenance

### Support Duration

- **Period**: 2 months from deployment date
- **Scope**: X platform changes only
- **Response Times**: 48 hours for critical issues, 5 days for minor issues

### Maintenance Operations

1. **Regular Updates**:
   - Monitor X platform for interface changes
   - Update selectors and interaction patterns as needed
   - Adjust anti-bot measures to match new security patterns

2. **Error Monitoring**:
   - Monitor logs for recurring errors
   - Update error handling strategies based on patterns
   - Implement new recovery strategies as needed

3. **Performance Optimization**:
   - Monitor response times and resource usage
   - Optimize browser automation for speed and reliability
   - Reduce memory footprint and CPU usage

### Support Contact

For support issues, contact:
- Email: support@nihedbenabdennour.me
- Include system logs and screenshots when reporting issues

---

© 2023 Nihed BenAbdennour. All rights reserved.
