# X-Posts Bot Dockerfile
# Developed By NihedBenAbdennour (website: nihedbenabdennour.me)

# Use Node.js with Chrome pre-installed (latest Puppeteer image)
FROM ghcr.io/puppeteer/puppeteer:latest

# Set working directory
WORKDIR /app
USER root

# Copy package files and install dependencies
# Ensure Puppeteer cache directory exists and install Chrome
COPY package*.json ./
RUN npm ci
RUN mkdir -p /root/.cache/puppeteer
RUN npx puppeteer browsers install chrome
# Copy the rest of the code
COPY . .



# Create directories for data persistence
RUN mkdir -p /app/data /app/logs /app/screenshots

# Remove problematic Google Chrome repos to avoid GPG error
RUN rm -f /etc/apt/sources.list.d/google-chrome.list /etc/apt/sources.list.d/google.list

# Install recommended dependencies for Puppeteer/Chrome
RUN apt-get update && apt-get install -y \
    ca-certificates \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libgbm1 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libx11-xcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    libxss1 \
    libxtst6 \
    lsb-release \
    wget \
    xdg-utils \
    libgconf-2-4 \
    --no-install-recommends && rm -rf /var/lib/apt/lists/*
## Run as root for Chrome permissions

# Set environment variables
ENV NODE_ENV=production
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true 

# Expose the port
EXPOSE 3000

# Set the entry command
CMD ["node", "index.js"]
