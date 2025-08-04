# X-Posts Bot

A Node.js + Puppeteer-based backend service that automates posting to X (formerly Twitter).

Developed By [Nihed Ben Abdennour](https://nihedbenabdennour.me)

## 🔍 Overview

X-Posts Bot is a robust API service that enables automated posting and replying to X (Twitter) through browser automation. The service handles session management, error recovery, and proxy support while maintaining a clean REST API interface.

## 🎯 Features

- **REST API** for X interaction with Bearer token authentication
- **Post & Reply** capabilities using Puppeteer automation
- **Session Management** with automatic session recovery
- **Proxy Support** for all requests
- **Error Handling** with screenshots and detailed logs
- **Docker Ready** for easy deployment
- **Security Features** including rate limiting and token authentication
- **Logging System** for troubleshooting and monitoring

## 📋 Requirements

- Node.js 16+ 
- NPM or Yarn
- Chrome/Chromium (installed automatically with Puppeteer)
- Docker (optional for containerized deployment)

## 🚀 Getting Started

### Local Setup

1. Clone the repository:

```bash
git clone https://github.com/yourusername/x-posts-bot.git
cd x-posts-bot
```

2. Install dependencies:

```bash
npm install
```

3. Configure the environment:

```bash
cp .env.example .env
# Edit .env file with your configuration
```

4. Start the service:

```bash
npm start
```

### Docker Setup

1. Build the Docker image:

```bash
docker build -t x-posts-bot .
```

2. Run the container:

```bash
docker run -p 3000:3000 --env-file .env x-posts-bot
```

## ⚙️ Configuration

Create a `.env` file with the following configuration options:

```
PORT=3000
NODE_ENV=development  # Change to 'production' in production
API_TOKEN=your_secure_api_token_here
PROXY_SERVER=http://username:password@host:port  # Optional proxy
```

## 📚 API Documentation

### Authentication

All API endpoints are secured with Bearer token authentication:

```
Authorization: Bearer your_api_token_here
```

### Endpoints

#### Create a new post

```
POST /api/post
```

Request body:
```json
{
  "content": "Hello world from X-Posts Bot! #automation"
}
```

Response:
```json
{
  "status": "success",
  "message": "Post created successfully",
  "data": {
    "success": true,
    "timestamp": "2023-07-30T12:34:56.789Z",
    "screenshot": "post_success_2023-07-30T12-34-56-789Z.png"
  }
}
```

#### Reply to a post

```
POST /api/reply
```

Request body:
```json
{
  "content": "This is my automated reply!",
  "postUrl": "https://x.com/username/status/1234567890123456789"
}
```

Response:
```json
{
  "status": "success",
  "message": "Reply posted successfully",
  "data": {
    "success": true,
    "tweetId": "1234567890123456789",
    "timestamp": "2023-07-30T12:34:56.789Z",
    "screenshot": "reply_success_2023-07-30T12-34-56-789Z.png"
  }
}
```

#### Check session status

```
GET /api/session/status
```

Response:
```json
{
  "status": "success",
  "data": {
    "isLoggedIn": true,
    "lastChecked": "2023-07-30T12:34:56.789Z",
    "username": "YourUsername",
    "tokenAvailable": true,
    "proxyEnabled": true,
    "screenshot": "session_status_2023-07-30T12-34-56-789Z.png"
  }
}
```

## 📁 Project Structure

```
.
├── index.js              # Main entry point
├── middleware/           # Middleware components
│   └── auth.js           # Authentication middleware
├── routes/               # API routes
│   └── xRoutes.js        # X-specific routes
├── services/             # Business logic
│   └── xService.js       # X automation service
├── utils/                # Utility functions
│   ├── logger.js         # Logging utility
│   └── xpffGenerator.js  # X-Xp-Forwarded-For generator
├── data/                 # Data storage (cookies, tokens)
├── logs/                 # Application logs
├── screenshots/          # Captured screenshots
├── Dockerfile            # Docker configuration
├── .env                  # Environment configuration
└── README.md             # Project documentation
```

## 🔒 Security Considerations

- The service uses Bearer token authentication for API security
- Rate limiting prevents abuse
- Sessions are stored securely
- Proxy support adds an additional layer of anonymity

## 📝 Logging and Debugging

- Logs are stored in the `logs/` directory
- Screenshots are saved in the `screenshots/` directory for debugging
- Each error includes a screenshot for easy troubleshooting

## 📄 License

MIT

---

Created with ❤️ by [Nihed Ben Abdennour](https://nihedbenabdennour.me)
