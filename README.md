# X-Poster Service

An automated X (Twitter) posting service using Puppeteer and Node.js.

**Developed by:** NihedBenAbdennour (website: nihedbenabdennour.me)

## 🚀 Features

- **Tweet Posting:** Post new content to your X timeline
- **Reply to Tweets:** Reply to existing posts via URL
- **Proxy Support:** All browser sessions route through a specified proxy
- **Session Management:** Automatic login and session persistence
- **Error Handling:** Captures screenshots on failure for debugging
- **Docker Ready:** Run as a containerized service
- **Secure API:** REST API with bearer token authentication

## 📋 Technical Stack

- Node.js and Express.js
- Puppeteer with Stealth Plugin
- Winston for logging
- Docker for containerization

## 🛠️ Installation

### Local Development

1. Clone the repository
2. Install dependencies:
```bash
npm install
```
3. Create a `.env` file based on `.env.example`:
```bash
cp .env.example .env
```
4. Configure your environment variables in `.env`
5. Start the service:
```bash
npm start
```

### Docker Deployment

1. Configure your environment variables in `.env`
2. Build and start the Docker container:
```bash
docker-compose up -d
```

## 🔧 Configuration

All configuration is done through environment variables:

| Variable | Description |
|----------|-------------|
| PORT | Port for the API server (default: 3000) |
| API_TOKEN | Bearer token for API authentication |
| X_USERNAME | X (Twitter) account username |
| X_PASSWORD | X (Twitter) account password |
| PROXY_HOST | Proxy server host |
| PROXY_PORT | Proxy server port |
| PROXY_USERNAME | Proxy authentication username (if required) |
| PROXY_PASSWORD | Proxy authentication password (if required) |

## 📡 API Endpoints

### Authentication

All API requests require bearer token authentication:

```
Authorization: Bearer your_api_token_here
```

### Post New Tweet

**Endpoint:** `POST /api/post`

**Request Body:**
```json
{
  "content": "Your tweet text here",
  "mediaUrls": ["https://example.com/image.jpg"] // Optional
}
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Post successfully created",
  "data": {
    "postId": "1234567890",
    "timestamp": "2023-12-15T12:34:56.789Z"
  }
}
```

### Reply to Tweet

**Endpoint:** `POST /api/reply`

**Request Body:**
```json
{
  "url": "https://twitter.com/username/status/1234567890",
  "content": "Your reply text here",
  "mediaUrls": ["https://example.com/image.jpg"] // Optional
}
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Reply successfully posted",
  "data": {
    "replyId": "9876543210",
    "originalPostUrl": "https://twitter.com/username/status/1234567890",
    "timestamp": "2023-12-15T12:34:56.789Z"
  }
}
```

### Health Check

**Endpoint:** `GET /api/health`

**Success Response (200):**
```json
{
  "status": "ok",
  "timestamp": "2023-12-15T12:34:56.789Z",
  "uptime": 3600
}
```

## 📁 Project Structure

```
.
├── index.js                  # Main application file
├── Dockerfile                # Docker configuration
├── docker-compose.yml        # Docker Compose configuration
├── package.json              # Dependencies and scripts
├── .env.example              # Example environment variables
├── middleware/
│   └── auth.js               # Authentication middleware
├── routes/
│   └── api.js                # API routes
├── services/
│   ├── xService.js           # X posting functionality
│   └── sessionManager.js     # Session management
├── utils/
│   └── logger.js             # Logging functionality
├── logs/                     # Log files (generated)
├── screenshots/              # Error screenshots (generated)
└── data/                     # Persistent data storage
```

## ⚠️ Error Handling

- On failure, the service captures screenshots of the browser state
- All errors are logged with timestamps and stack traces
- API returns error responses with details of what went wrong

## 🔒 Security Notes

- Keep your `.env` file secure and never commit it to version control
- Regularly rotate your API token
- Use a secure proxy server to avoid IP blocking

## 📝 Maintenance

The service is designed to be resilient to X platform changes, but may require occasional updates.
Checking the error screenshots and logs can help diagnose and fix issues as they arise.

## 📄 License

MIT License
