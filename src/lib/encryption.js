// Client-side encryption utilities using Web Crypto API
// Uses AES-GCM with PBKDF2 key derivation

/**
 * Derives an encryption key from a password using PBKDF2
 * @param {string} password - The password to derive from
 * @param {Uint8Array} salt - Salt for key derivation
 * @returns {Promise<CryptoKey>} The derived key
 */
async function deriveKey(password, salt) {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits', 'deriveKey']
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: 100000, // OWASP recommended minimum
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypts a message with a password
 * @param {string} message - The plaintext message to encrypt
 * @param {string} password - The password for encryption
 * @returns {Promise<{encrypted: string, salt: string, iv: string}>} Encrypted data with metadata
 */
export async function encryptMessage(message, password) {
  try {
    const encoder = new TextEncoder();
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    
    const key = await deriveKey(password, salt);
    
    const encrypted = await crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv: iv
      },
      key,
      encoder.encode(message)
    );

    // Convert to base64 for storage
    return {
      encrypted: btoa(String.fromCharCode(...new Uint8Array(encrypted))),
      salt: btoa(String.fromCharCode(...salt)),
      iv: btoa(String.fromCharCode(...iv))
    };
  } catch (error) {
    console.error('Encryption failed:', error);
    throw new Error('Failed to encrypt message');
  }
}

/**
 * Decrypts a message with a password
 * @param {string} encryptedData - Base64 encoded encrypted data
 * @param {string} salt - Base64 encoded salt
 * @param {string} iv - Base64 encoded initialization vector
 * @param {string} password - The password for decryption
 * @returns {Promise<{success: boolean, message?: string, error?: string}>} The decryption result
 */
export async function decryptMessage(encryptedData, salt, iv, password) {
  try {
    // Convert from base64
    const encryptedBytes = Uint8Array.from(atob(encryptedData), c => c.charCodeAt(0));
    const saltBytes = Uint8Array.from(atob(salt), c => c.charCodeAt(0));
    const ivBytes = Uint8Array.from(atob(iv), c => c.charCodeAt(0));
    
    const key = await deriveKey(password, saltBytes);
    
    const decrypted = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: ivBytes
      },
      key,
      encryptedBytes
    );

    const decoder = new TextDecoder();
    return {
      success: true,
      message: decoder.decode(decrypted)
    };
  } catch (error) {
    // Return error object instead of throwing
    return {
      success: false,
      error: 'Invalid encrypted text or wrong key'
    };
  }
}

/**
 * Generates a visual scramble effect for display purposes
 * @param {number} length - Length of scrambled text to generate
 * @param {number} seed - Optional seed for consistent scrambling based on key
 * @returns {string} Random scrambled characters
 */
export function generateScrambledDisplay(length, seed = 0) {
  const chars = '@#$%&*!?^~◊†‡§¶∞≈Ω∆∑π';
  
  // Simple seeded random if seed is provided
  if (seed) {
    let random = seed;
    return Array.from({ length }, () => {
      random = (random * 9301 + 49297) % 233280;
      const index = Math.floor((random / 233280) * chars.length);
      return chars[index];
    }).join('');
  }
  
  // Default random for animation
  return Array.from({ length }, () => 
    chars[Math.floor(Math.random() * chars.length)]
  ).join('');
}

/**
 * Checks if a message object contains encrypted data
 * @param {object} messageData - The message data object
 * @returns {boolean} True if the message is encrypted
 */
export function isMessageEncrypted(messageData) {
  return !!(messageData.encrypted && messageData.salt && messageData.iv);
}