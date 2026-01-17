// Security utilities for input validation and sanitization
'use client';

// Rate limiting store (in-memory for client-side)
const rateLimitStore = new Map();

// Input validation utilities
export const validateAmount = (value, balance = 0, min = 1, max = null) => {
  // Convert to number safely
  const num = Number(value);
  
  // Check if it's a valid number
  if (isNaN(num) || !isFinite(num)) {
    return { isValid: false, error: 'Please enter a valid number' };
  }
  
  // Check if it's positive
  if (num <= 0) {
    return { isValid: false, error: 'Amount must be greater than 0' };
  }
  
  // Check minimum
  if (num < min) {
    return { isValid: false, error: `Minimum amount is ${min}` };
  }
  
  // Check maximum if provided
  if (max !== null && num > max) {
    return { isValid: false, error: `Maximum amount is ${max}` };
  }
  
  // Check against balance
  if (balance > 0 && num > balance) {
    return { isValid: false, error: `Insufficient balance. You have ${balance.toLocaleString()} tokens` };
  }
  
  // Check for decimal places (assuming we want whole numbers for tokens)
  if (num % 1 !== 0) {
    return { isValid: false, error: 'Please enter a whole number' };
  }
  
  return { isValid: true, value: Math.floor(num) };
};

// Text sanitization (basic XSS prevention)
export const sanitizeText = (text) => {
  if (!text || typeof text !== 'string') return '';
  
  return text
    .trim()
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;')
    .slice(0, 300); // Limit length
};

// Name validation
export const validateName = (name) => {
  if (!name || typeof name !== 'string') {
    return { isValid: false, error: 'Name is required' };
  }
  
  const sanitizedName = sanitizeText(name);
  
  if (sanitizedName.length < 1) {
    return { isValid: false, error: 'Name cannot be empty' };
  }
  
  if (sanitizedName.length > 50) {
    return { isValid: false, error: 'Name must be 50 characters or less' };
  }
  
  // Check for valid characters (letters, numbers, spaces, basic punctuation)
  if (!/^[a-zA-Z0-9\s\-_.]+$/.test(sanitizedName)) {
    return { isValid: false, error: 'Name contains invalid characters' };
  }
  
  return { isValid: true, value: sanitizedName };
};

// Message validation
export const validateMessage = (message) => {
  if (!message) return { isValid: true, value: '' }; // Optional field
  
  if (typeof message !== 'string') {
    return { isValid: false, error: 'Invalid message format' };
  }
  
  const sanitizedMessage = sanitizeText(message);
  
  if (sanitizedMessage.length > 300) {
    return { isValid: false, error: 'Message must be 300 characters or less' };
  }
  
  return { isValid: true, value: sanitizedMessage };
};

// Rate limiting
export const checkRateLimit = (identifier, maxRequests = 3, windowMs = 60000) => {
  const now = Date.now();
  const windowStart = now - windowMs;
  
  if (!rateLimitStore.has(identifier)) {
    rateLimitStore.set(identifier, []);
  }
  
  const requests = rateLimitStore.get(identifier);
  
  // Remove old requests outside the window
  const recentRequests = requests.filter(timestamp => timestamp > windowStart);
  
  if (recentRequests.length >= maxRequests) {
    const oldestRequest = Math.min(...recentRequests);
    const resetTime = oldestRequest + windowMs;
    const waitTime = Math.ceil((resetTime - now) / 1000);
    
    return {
      allowed: false,
      error: `Too many attempts. Please wait ${waitTime} seconds before trying again.`,
      resetTime
    };
  }
  
  // Add current request
  recentRequests.push(now);
  rateLimitStore.set(identifier, recentRequests);
  
  return { allowed: true };
};

// Safe error message formatter
export const formatSafeErrorMessage = (error) => {
  if (!error) return 'An unknown error occurred';
  
  // Common user-friendly error mappings
  const errorMappings = {
    'insufficient': 'Insufficient funds or gas',
    'rejected': 'Transaction was cancelled',
    'denied': 'Transaction was cancelled',
    'network': 'Network error - please try again',
    'timeout': 'Transaction timed out - please try again',
    'gas': 'Gas estimation failed - please try again'
  };
  
  const errorMessage = error.message || error.toString() || 'Unknown error';
  const lowerError = errorMessage.toLowerCase();
  
  // Check for mapped errors
  for (const [key, message] of Object.entries(errorMappings)) {
    if (lowerError.includes(key)) {
      return message;
    }
  }
  
  // Return generic message for unmapped errors
  return 'Transaction failed. Please try again.';
};

// Transaction validation
export const validateTransaction = (amount, balance, walletAddress) => {
  if (!walletAddress) {
    return { isValid: false, error: 'Please connect your wallet first' };
  }
  
  const amountValidation = validateAmount(amount, balance);
  if (!amountValidation.isValid) {
    return amountValidation;
  }
  
  return { isValid: true, value: amountValidation.value };
};

// Cleanup rate limit store periodically
setInterval(() => {
  const now = Date.now();
  const oneHour = 60 * 60 * 1000;
  
  for (const [identifier, requests] of rateLimitStore.entries()) {
    const recentRequests = requests.filter(timestamp => timestamp > now - oneHour);
    if (recentRequests.length === 0) {
      rateLimitStore.delete(identifier);
    } else {
      rateLimitStore.set(identifier, recentRequests);
    }
  }
}, 10 * 60 * 1000); // Clean up every 10 minutes