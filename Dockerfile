# X-Poster Service Dockerfile
# @author NihedBenAbdennour (website: nihedbenabdennour.me)

# Use Node.js slim image as base
FROM node:18-slim

# Set working directory
WORKDIR /app

# Install dependencies for Puppeteer
RUN apt-get update && apt-get install -y \
    wget \
    gnupg \
    ca-certificates \
    procps \
    libxss1 \
    libxtst6 \
    libgbm1 \
    libnss3 \
    libatk-bridge2.0-0 \
    libgtk-3-0 \
    libx11-xcb1 \
    libxcb-dri3-0 \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# Install Chrome for Puppeteer
RUN wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | apt-key add - \
    && sh -c 'echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google.list' \
    && apt-get update \
    && apt-get install -y google-chrome-stable --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy app source
COPY . .

# Create necessary directories
RUN mkdir -p logs screenshots data

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000

# Expose API port
EXPOSE 3000

# Start the application
CMD ["node", "index.js"]
