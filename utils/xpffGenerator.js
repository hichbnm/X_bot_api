/**
 * X-Xp-Forwarded-For Header Generator Utility
 * Based on the Twitter anti-bot header system
 * Developed By NihedBenAbdennour (website: nihedbenabdennour.me)
 */
const crypto = require('crypto');
const logger = require('./logger');

/**
 * Generates an encrypted X-Xp-Forwarded-For header for X (Twitter) requests
 * This mimics the browser WASM implementation described in README.md
 * 
 * @param {string} guestId - The guest_id cookie value (URL encoded)
 * @returns {string} - The encrypted XPFF header value
 */
function generateXPFF(guestId) {
  try {
    // Base key hardcoded in the WASM module
    const baseKey = "0e6be1f1e21ffc33590b888fd4dc81b19713e570e805d4e5df80a493c9571a05";
    
    // Generate SHA-256 of baseKey + guestId to derive the AES key
    const combined = baseKey + guestId;
    const derivedKey = crypto.createHash('sha256').update(combined).digest();
    
    // Create payload (similar to browser implementation)
    const payload = JSON.stringify({
      navigator_properties: {
        hasBeenActive: "true",
        userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        webdriver: "false"
      },
      created_at: Date.now() // Current timestamp in milliseconds
    });
    
    // Generate random 12-byte nonce for AES-GCM
    const nonce = crypto.randomBytes(12);
    
    // Encrypt the payload using AES-GCM
    const cipher = crypto.createCipheriv('aes-256-gcm', derivedKey, nonce);
    let encrypted = cipher.update(payload, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    // Get auth tag and append to result
    const authTag = cipher.getAuthTag().toString('hex');
    
    // Combine nonce + encrypted data + auth tag, then hex encode
    const result = Buffer.concat([
      nonce,
      Buffer.from(encrypted, 'hex'),
      Buffer.from(authTag, 'hex')
    ]).toString('hex');
    
    logger.debug('Generated XPFF header successfully');
    return result;
  } catch (error) {
    logger.error(`Failed to generate XPFF header: ${error.message}`);
    // Return a fallback value in case of error
    return "";
  }
}

/**
 * Decodes an encrypted XPFF header (for debugging purposes)
 * 
 * @param {string} xpffHex - The encrypted XPFF header (hex encoded)
 * @param {string} guestId - The guest_id cookie value (URL encoded)
 * @returns {string} - The decrypted payload
 */
function decodeXPFF(xpffHex, guestId) {
  try {
    // Base key hardcoded in the WASM module
    const baseKey = "0e6be1f1e21ffc33590b888fd4dc81b19713e570e805d4e5df80a493c9571a05";
    
    // Generate SHA-256 of baseKey + guestId to derive the AES key
    const combined = baseKey + guestId;
    const derivedKey = crypto.createHash('sha256').update(combined).digest();
    
    // Decode hex string
    const buffer = Buffer.from(xpffHex, 'hex');
    
    // Extract nonce (first 12 bytes)
    const nonce = buffer.subarray(0, 12);
    
    // The last 16 bytes are the auth tag
    const authTag = buffer.subarray(buffer.length - 16);
    
    // Everything in the middle is the ciphertext
    const ciphertext = buffer.subarray(12, buffer.length - 16);
    
    // Decrypt using AES-GCM
    const decipher = crypto.createDecipheriv('aes-256-gcm', derivedKey, nonce);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(ciphertext);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    
    return decrypted.toString('utf8');
  } catch (error) {
    logger.error(`Failed to decode XPFF header: ${error.message}`);
    return null;
  }
}

module.exports = {
  generateXPFF,
  decodeXPFF
};
