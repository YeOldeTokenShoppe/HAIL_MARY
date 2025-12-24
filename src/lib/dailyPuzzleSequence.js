import { 
  db, 
  collection, 
  doc, 
  getDoc, 
  setDoc,
  deleteDoc, 
  serverTimestamp,
  runTransaction 
} from './firebaseClient';

// Symbol pool with wheel section mappings
// Mapped to actual wheel visuals:
// wheel_section: rose, wheel_section001: lock, wheel_section002: hourglass,
// wheel_section003: owl, wheel_section004: burning heart, wheel_section005: infinity,
// wheel_section006: illuminati eye, wheel_section007: sacred geometry/trinity,
// wheel_section008: lucky cat, wheel_section009: virgo symbol, wheel_section010: 8-ball,
// wheel_section011: rosary beads, wheel_section012: rocket, wheel_section013: spiderweb,
// wheel_section014: bull, wheel_section015: candle
const SYMBOL_POOL = [
  { symbol: '🌹', section: 'wheel_section', name: 'Rose', id: 0 },
  { symbol: '🔒', section: 'wheel_section001', name: 'Lock', id: 1 },
  { symbol: '⏳', section: 'wheel_section002', name: 'Hourglass', id: 2 },
  { symbol: '🦉', section: 'wheel_section003', name: 'Owl', id: 3 },
  { symbol: '❤️‍🔥', section: 'wheel_section004', name: 'Burning Heart', id: 4 },
  { symbol: '♾️', section: 'wheel_section005', name: 'Infinity', id: 5 },
  { symbol: '👁️', section: 'wheel_section006', name: 'Illuminati Eye', id: 6 },
  { symbol: '🔺', section: 'wheel_section007', name: 'Sacred Geometry', id: 7 },
  { symbol: '🐱', section: 'wheel_section008', name: 'Lucky Cat', id: 8 },
  { symbol: '♍', section: 'wheel_section009', name: 'Virgo', id: 9 },
  { symbol: '🎱', section: 'wheel_section010', name: '8-Ball', id: 10 },
  { symbol: '📿', section: 'wheel_section011', name: 'Rosary Beads', id: 11 },
  { symbol: '🚀', section: 'wheel_section012', name: 'Rocket', id: 12 },
  { symbol: '🕸️', section: 'wheel_section013', name: 'Spiderweb', id: 13 },
  { symbol: '🐂', section: 'wheel_section014', name: 'Bull', id: 14 },
  { symbol: '🕯️', section: 'wheel_section015', name: 'Candle', id: 15 }
];

// Get date string in UTC for consistency
const getDateString = () => {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  const day = String(now.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Simple hash function for browser compatibility
const simpleHash = (str) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
};

// Generate a deterministic but unpredictable sequence for a user on a given day
const generateUserSequence = (userId, dateString) => {
  // In dev mode, add timestamp to make each reset unique
  const devSuffix = DEV_MODE ? `-${Date.now()}` : '';
  
  // Create a unique seed from userId and date
  const seed = `${userId}-${dateString}-RL80-SECRET-SALT-2024${devSuffix}`;
  
  // Use simple hash for browser compatibility
  const hashValue = simpleHash(seed);
  
  // Use the hash to select 3 unique symbols
  const selectedSymbols = [];
  const availableIndices = [...Array(SYMBOL_POOL.length).keys()];
  
  // Create pseudo-random sequence based on hash
  let currentHash = hashValue;
  for (let i = 0; i < 3; i++) {
    // Generate next pseudo-random number
    currentHash = (currentHash * 1103515245 + 12345) & 0x7fffffff;
    
    const index = currentHash % availableIndices.length;
    const symbolIndex = availableIndices[index];
    
    selectedSymbols.push(SYMBOL_POOL[symbolIndex]);
    availableIndices.splice(index, 1); // Remove to ensure uniqueness
  }
  
  return selectedSymbols;
};

// DEV MODE TOGGLE - Set this to true to enable dev features
export const DEV_MODE = true; // Toggle this for development

// Reset puzzle for development - DELETE approach
export const resetPuzzleForDev = async (userId) => {
  if (!DEV_MODE) {
    console.warn('Dev mode is disabled');
    return false;
  }
  
  if (!userId || !db) {
    console.warn('resetPuzzleForDev: Missing userId or database connection');
    return false;
  }
  
  try {
    const userPuzzleRef = doc(db, 'userPuzzles', userId);
    
    console.log('Deleting puzzle document for user:', userId);
    
    // First, delete the existing document completely
    await deleteDoc(userPuzzleRef);
    console.log('Document deleted successfully');
    
    // The next getUserDailySequence call will create a fresh puzzle
    
    return true;
  } catch (error) {
    console.error('Error resetting puzzle:', error);
    return false;
  }
};

// Get or create daily puzzle sequence for a user
export const getUserDailySequence = async (userId) => {
  if (!userId || !db) {
    console.warn('getUserDailySequence: Missing userId or database connection');
    return null;
  }
  
  const dateString = getDateString();
  console.log('getUserDailySequence called for:', userId, 'on date:', dateString);
  
  try {
    // Use a transaction to ensure atomicity
    const sequence = await runTransaction(db, async (transaction) => {
      const userPuzzleRef = doc(db, 'userPuzzles', userId);
      const userPuzzleDoc = await transaction.get(userPuzzleRef);
      
      const puzzleData = userPuzzleDoc.exists() ? userPuzzleDoc.data() : null;
      const currentDate = getDateString();
      
      console.log('Fetched puzzle data:', puzzleData);
      console.log('Checking date:', currentDate);
      
      // Check if we have a valid sequence for today
      if (puzzleData && puzzleData.date === currentDate && puzzleData.sequence) {
        console.log('Returning existing puzzle, completedToday:', puzzleData.completedToday);
        return {
          sequence: puzzleData.sequence,
          completedToday: puzzleData.completedToday || false,
          attempts: puzzleData.attempts || 0,
          lastAttempt: puzzleData.lastAttempt
        };
      }
      
      // Generate new sequence for today
      console.log('Generating new sequence for user');
      const newSequence = generateUserSequence(userId, currentDate);
      console.log('Generated sequence:', newSequence);
      
      // Save the new sequence
      const newPuzzleData = {
        userId,
        date: currentDate,
        sequence: newSequence,
        completedToday: false,
        attempts: 0,
        createdAt: serverTimestamp(),
        lastAttempt: null,
        completedAt: null
      };
      
      console.log('Saving new puzzle data:', newPuzzleData);
      transaction.set(userPuzzleRef, newPuzzleData, { merge: true });
      
      return {
        sequence: newSequence,
        completedToday: false,
        attempts: 0,
        lastAttempt: null
      };
    });
    
    return sequence;
  } catch (error) {
    console.error('Error getting user daily sequence:', error);
    
    // Fallback: generate sequence client-side without saving
    const fallbackSequence = generateUserSequence(userId, dateString);
    return {
      sequence: fallbackSequence,
      completedToday: false,
      attempts: 0,
      lastAttempt: null,
      isOffline: true // Flag to indicate this is a local-only sequence
    };
  }
};

// Record a puzzle attempt
export const recordPuzzleAttempt = async (userId, success = false) => {
  if (!userId || !db) {
    console.warn('recordPuzzleAttempt: Missing userId or database connection');
    return false;
  }
  
  try {
    const userPuzzleRef = doc(db, 'userPuzzles', userId);
    const dateString = getDateString();
    
    await runTransaction(db, async (transaction) => {
      const puzzleDoc = await transaction.get(userPuzzleRef);
      const currentData = puzzleDoc.exists() ? puzzleDoc.data() : {};
      
      // Only update if it's the same day
      if (currentData.date !== dateString) {
        console.warn('Attempt to update puzzle from different day');
        return;
      }
      
      const updates = {
        attempts: (currentData.attempts || 0) + 1,
        lastAttempt: serverTimestamp(),
        ...(success && { 
          completedToday: true,
          completedAt: serverTimestamp()
        })
      };
      
      transaction.update(userPuzzleRef, updates);
    });
    
    return true;
  } catch (error) {
    console.error('Error recording puzzle attempt:', error);
    return false;
  }
};

// Validate if a sequence matches the user's daily sequence
export const validateUserSequence = async (userId, attemptedSequence) => {
  if (!userId || !attemptedSequence || attemptedSequence.length !== 3) {
    return false;
  }
  
  const dailyData = await getUserDailySequence(userId);
  if (!dailyData || !dailyData.sequence) {
    return false;
  }
  
  // Check if already completed today
  if (dailyData.completedToday) {
    console.log('Puzzle already completed today');
    return {
      valid: false,
      reason: 'already_completed',
      message: 'You have already completed today\'s puzzle!'
    };
  }
  
  // Compare the sequences
  const isValid = attemptedSequence.every((section, index) => 
    section === dailyData.sequence[index].section
  );
  
  // Record the attempt
  await recordPuzzleAttempt(userId, isValid);
  
  return {
    valid: isValid,
    attempts: dailyData.attempts + 1,
    reason: isValid ? 'success' : 'incorrect_sequence'
  };
};

// Get puzzle statistics for a user
export const getUserPuzzleStats = async (userId) => {
  if (!userId || !db) {
    return null;
  }
  
  try {
    // Get current puzzle
    const currentPuzzle = await getUserDailySequence(userId);
    
    // You could also query historical data here if needed
    // const historyQuery = query(
    //   collection(db, 'userPuzzleHistory'),
    //   where('userId', '==', userId),
    //   orderBy('completedAt', 'desc'),
    //   limit(30)
    // );
    
    return {
      todayCompleted: currentPuzzle?.completedToday || false,
      todayAttempts: currentPuzzle?.attempts || 0,
      currentStreak: 0, // Implement streak tracking if needed
      totalCompleted: 0 // Implement total tracking if needed
    };
  } catch (error) {
    console.error('Error getting puzzle stats:', error);
    return null;
  }
};