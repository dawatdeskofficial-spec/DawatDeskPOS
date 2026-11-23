const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const TAG_LENGTH = 16;

/**
 * Derives a 32-byte encryption key from environment secrets.
 */
const getEncryptionKey = () => {
  const secret =
    process.env.WHATSAPP_ENCRYPTION_KEY ||
    process.env.JWT_SECRET ||
    'dawatdesk_default_whatsapp_encryption_key_2026_spec';
  return crypto.createHash('sha256').update(String(secret)).digest();
};

/**
 * Encrypts a sensitive string (e.g. WhatsApp Access Token)
 * @param {string} text
 * @returns {string} iv:authTag:encryptedHex
 */
const encrypt = (text) => {
  if (!text) return '';
  try {
    const key = getEncryptionKey();
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const tag = cipher.getAuthTag();
    return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted}`;
  } catch (err) {
    throw new Error(`Encryption failed: ${err.message}`);
  }
};

/**
 * Decrypts an encrypted token string
 * @param {string} cipherText
 * @returns {string} original text
 */
const decrypt = (cipherText) => {
  if (!cipherText) return '';
  // Check if string is not encrypted (e.g. legacy plain text)
  if (!cipherText.includes(':')) {
    return cipherText;
  }
  try {
    const [ivHex, tagHex, encryptedData] = cipherText.split(':');
    if (!ivHex || !tagHex || !encryptedData) {
      return cipherText;
    }
    const key = getEncryptionKey();
    const iv = Buffer.from(ivHex, 'hex');
    const tag = Buffer.from(tagHex, 'hex');
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);
    let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (err) {
    // If decryption fails, return empty to prevent using corrupt keys
    return '';
  }
};

/**
 * Safely masks a token for client-side API responses
 * @param {string} token
 * @returns {string} e.g. "EAAB...wxyz"
 */
const maskSecret = (token) => {
  if (!token) return '';
  const str = String(token);
  if (str.length <= 8) return '****';
  return `${str.slice(0, 4)}••••••••${str.slice(-4)}`;
};

module.exports = {
  encrypt,
  decrypt,
  maskSecret,
};
