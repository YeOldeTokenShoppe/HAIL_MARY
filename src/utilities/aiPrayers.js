// AI Prayer Generation Utilities with Cost Control
// API key is now handled server-side for security

// Cache to store generated prayers (reduces API costs)
const prayerCache = new Map();
const CACHE_DURATION = 1000 * 60 * 60 * 24; // 24 hours

// Rate limiting per user/session
const rateLimits = new Map();
const RATE_LIMIT = 10; // prayers per day per user
const RATE_WINDOW = 1000 * 60 * 60 * 24; // 24 hours

// Language names for the AI
const LANGUAGE_NAMES = {
  en: 'English',
  es: 'Spanish',
  pt: 'Portuguese',
  fr: 'French',
  it: 'Italian',
  zh: 'Chinese',
  hi: 'Hindi'
};

// Get or create user session ID (stored in localStorage)
function getUserSessionId() {
  if (typeof window === 'undefined') return 'server';
  
  let sessionId = localStorage.getItem('prayerSessionId');
  if (!sessionId) {
    sessionId = 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    localStorage.setItem('prayerSessionId', sessionId);
  }
  return sessionId;
}

// Check rate limit for user
function checkRateLimit() {
  const userId = getUserSessionId();
  const now = Date.now();
  
  const userLimit = rateLimits.get(userId) || { count: 0, resetTime: now + RATE_WINDOW };
  
  // Reset if window has passed
  if (now > userLimit.resetTime) {
    userLimit.count = 0;
    userLimit.resetTime = now + RATE_WINDOW;
  }
  
  if (userLimit.count >= RATE_LIMIT) {
    const hoursLeft = Math.ceil((userLimit.resetTime - now) / (1000 * 60 * 60));
    throw new Error(`Daily limit reached. Try again in ${hoursLeft} hours.`);
  }
  
  userLimit.count++;
  rateLimits.set(userId, userLimit);
  
  return RATE_LIMIT - userLimit.count; // Return remaining prayers
}

// Check cache for existing prayer
function checkCache(prompt, language) {
  const cacheKey = `${prompt}-${language}`;
  const cached = prayerCache.get(cacheKey);
  
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.prayer;
  }
  
  return null;
}

// Save to cache
function saveToCache(prompt, language, prayer) {
  const cacheKey = `${prompt}-${language}`;
  prayerCache.set(cacheKey, {
    prayer,
    timestamp: Date.now()
  });
  
  // Clean old cache entries
  for (const [key, value] of prayerCache.entries()) {
    if (Date.now() - value.timestamp > CACHE_DURATION) {
      prayerCache.delete(key);
    }
  }
}

// Generate a prayer using our API route
export async function generatePrayer(prompt, language = 'en') {
  try {
    // Check cache first
    const cached = checkCache(prompt, language);
    if (cached) {
      return { 
        prayer: cached, 
        fromCache: true,
        remaining: RATE_LIMIT - (rateLimits.get(getUserSessionId())?.count || 0)
      };
    }
    
    // Check rate limit
    const remaining = checkRateLimit();
    
    // Call our API route instead of OpenAI directly
    const response = await fetch('/api/generate-prayer', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt: prompt || 'Write a prayer for successful crypto trading',
        language,
        mode: 'generate'
      })
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to generate prayer');
    }
    
    const data = await response.json();
    const prayer = data.prayer;
    
    // Save to cache
    saveToCache(prompt, language, prayer);
    
    return { 
      prayer, 
      fromCache: false,
      remaining 
    };
  } catch (error) {
    console.error('Prayer generation failed:', error);
    throw error;
  }
}

// Translate existing prayer to another language
export async function translatePrayer(text, targetLanguage) {
  try {
    // Check cache
    const cached = checkCache('translate:' + text.substring(0, 50), targetLanguage);
    if (cached) {
      return { 
        prayer: cached, 
        fromCache: true,
        remaining: RATE_LIMIT - (rateLimits.get(getUserSessionId())?.count || 0)
      };
    }
    
    // Check rate limit
    const remaining = checkRateLimit();
    
    // Call our API route for translation
    const response = await fetch('/api/generate-prayer', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt: text,
        language: targetLanguage,
        mode: 'translate'
      })
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Translation failed');
    }
    
    const data = await response.json();
    const translatedPrayer = data.prayer;
    
    // Save to cache
    saveToCache('translate:' + text.substring(0, 50), targetLanguage, translatedPrayer);
    
    return { 
      prayer: translatedPrayer, 
      fromCache: false,
      remaining 
    };
  } catch (error) {
    console.error('Translation failed:', error);
    throw error;
  }
}

// Get remaining prayers for user
export function getRemainingPrayers() {
  const userId = getUserSessionId();
  const userLimit = rateLimits.get(userId);
  
  if (!userLimit) return RATE_LIMIT;
  
  const now = Date.now();
  if (now > userLimit.resetTime) {
    return RATE_LIMIT;
  }
  
  return Math.max(0, RATE_LIMIT - userLimit.count);
}

// Quick prayer prompts for different scenarios
export const PRAYER_PROMPTS = {
  diamondHands: "Write a prayer for maintaining diamond hands during a market crash",
  findGems: "Write a prayer for finding the next 100x altcoin gem",
  avoidLiquidation: "Write a prayer for avoiding liquidation on leveraged positions",
  bullRun: "Write a prayer for the start of a new bull run",
  bearMarket: "Write a prayer for surviving a brutal bear market",
  gasWars: "Write a prayer for winning gas wars and getting into hot NFT mints",
  rugpull: "Write a prayer for protection from rugpulls and scams",
  degen: "Write a prayer for a degenerate trader chasing pumps",
  staking: "Write a prayer for high staking yields and passive income",
  whales: "Write a prayer for following smart money and whale wallets"
};