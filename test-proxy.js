require('dotenv').config();
const https = require('https');
const { HttpsProxyAgent } = require('https-proxy-agent');

// Log utility
const log = (msg, error = false) => {
  if (error) {
    console.error('\x1b[31m%s\x1b[0m', `[ERROR] ${msg}`);
  } else {
    console.log('\x1b[32m%s\x1b[0m', `[INFO] ${msg}`);
  }
};

// Load and validate env
const proxyHost = process.env.PROXY_HOST;
const proxyPort = process.env.PROXY_PORT;
const proxyUser = process.env.PROXY_USERNAME;
const proxyPass = process.env.PROXY_PASSWORD;

if (!proxyHost || !proxyPort || !proxyUser || !proxyPass) {
  log('Missing or invalid proxy environment variables.', true);
  process.exit(1);
}

const proxyUrl = `http://${proxyUser}:${proxyPass}@${proxyHost}:${proxyPort}`;
log(`Using proxy: ${proxyUrl}`);

// Use the agent
const agent = new HttpsProxyAgent(proxyUrl);

https.get('https://httpbin.org/ip', { agent }, (res) => {
  let data = '';

  log(`Status Code: ${res.statusCode}`);

  res.on('data', (chunk) => data += chunk);
  res.on('end', () => {
    try {
      const json = JSON.parse(data);
      log('✅ Proxy test successful!');
      log(`🧭 IP through proxy: ${json.origin}`);
    } catch (err) {
      log('❌ Failed to parse JSON response.', true);
      console.error(data);
    }
  });
}).on('error', (err) => {
  log(`❌ Proxy request failed: ${err.message}`, true);
});
