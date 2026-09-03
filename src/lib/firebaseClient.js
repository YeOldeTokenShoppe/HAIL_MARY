import { initializeApp, getApps } from "firebase/app";
import {
  getFirestore,
  setLogLevel,
  collection,
  query,
  where,
  getDocs,
  deleteDoc,
  doc,
  addDoc,
  updateDoc,
  orderBy,
  limit as limitFn,
  writeBatch,
  serverTimestamp,
  onSnapshot,
  getDoc,
  setDoc,
  runTransaction,
  increment,
  arrayUnion
} from "firebase/firestore";
import { getAuth, initializeAuth, browserLocalPersistence, browserPopupRedirectResolver, signInWithCustomToken } from "firebase/auth";
import { getStorage, ref, getDownloadURL, uploadBytes } from "firebase/storage";
import { getDatabase, ref as dbRef, set, onValue, push, onDisconnect, serverTimestamp as rtdbServerTimestamp } from "firebase/database";



// TEMPORARY: Skip Firebase auth for testing MoonRoom
const SKIP_FIREBASE_AUTH = true;

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

// Initialize Firebase safely
let app;
let db;
let auth;
let storage;
let rtdb;

// Check if we're running in a browser environment
const isBrowser = typeof window !== 'undefined';

// Function to check if we have all required environment variables
const hasRequiredEnvironmentVariables = () => {
  const requiredKeys = ['apiKey', 'authDomain', 'projectId', 'storageBucket', 'messagingSenderId', 'appId'];
  return requiredKeys.every(key => firebaseConfig[key] && String(firebaseConfig[key]).trim() !== '');
};

try {
  // Only initialize Firebase in the browser environment
  if (!isBrowser) {
    // Don't throw - let services be null and let consuming code handle it
    app = null;
    db = null;
    auth = null;
    storage = null;
    rtdb = null;
  } else {
  
  // First check if we have the required environment variables
  if (!hasRequiredEnvironmentVariables()) {
    throw new Error('Missing required Firebase environment variables');
  }
  
  // Check if any of the essential config values are missing
  const requiredKeys = ['apiKey', 'authDomain', 'projectId', 'storageBucket', 'messagingSenderId', 'appId'];
  const missingKeys = requiredKeys.filter(key => !firebaseConfig[key]);
  
  if (missingKeys.length > 0) {
    throw new Error(`Missing required Firebase config: ${missingKeys.join(', ')}`);
  }
  
  // Initialize Firebase app
  app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
  
  // Connect to Firebase services
  db = getFirestore(app);
  setLogLevel("error"); // Suppress BloomFilter warnings
  // NOT getAuth(app). getAuth defaults to IndexedDB persistence, and on iPadOS
  // Safari that hung forever when a second tab of the site sat suspended in
  // the background holding the same IndexedDB store: onAuthStateChanged never
  // fired, and because Firestore waits for Auth's first token check before
  // its first request, the oilGame/settings listener never started and
  // /hailmary sat on the coin loader indefinitely (measured on Michelle's iPad
  // Pro, 2026-09-02: IndexedDB persistence never reported in 50 s; in-memory
  // reported in 48 ms; localStorage in 0.7 s with Firestore following at 1.2 s).
  // localStorage persistence is synchronous, has no cross-tab lock, and still
  // keeps a custom-token session across reloads. The resolver is what getAuth
  // would have registered, so popup/redirect sign-in is unchanged.
  //
  // initializeAuth may only run once per app. Under Fast Refresh this module
  // re-evaluates against the app that getApps() already holds, whose Auth is
  // already initialized, and initializeAuth throws auth/already-initialized —
  // which the catch below would turn into db = null and a dead page. Reuse
  // the existing instance in that case; a cold load never takes this branch.
  try {
    auth = initializeAuth(app, {
      persistence: browserLocalPersistence,
      popupRedirectResolver: browserPopupRedirectResolver,
    });
  } catch (e) {
    if (e && e.code === "auth/already-initialized") auth = getAuth(app);
    else throw e;
  }
  storage = getStorage(app);
  rtdb = getDatabase(app);
  
  // Verify Firestore is working by attempting to create a collection reference
  const testCollection = collection(db, 'test');
  

  } // Close the else block for isBrowser check

} catch (error) {
  console.error("❌ Firebase initialization details:", {
    error: error.message,
    stack: error.stack?.substring(0, 500),
    hasEnvVars: hasRequiredEnvironmentVariables(),
    isBrowser,
    configProjectId: firebaseConfig.projectId
  });

  // Set services to null when initialization fails
  // Components should check for null/undefined before using Firebase
  app = null;
  db = null;
  auth = null;
  storage = null;
  rtdb = null;
}

// Export the initialized Firebase services
export { db, auth, storage, app, rtdb };

// Export Firebase functions to avoid import errors in components
// This allows components to import these functions directly from firebaseClient.js
// TEMPORARY: Wrapper for signInWithCustomToken to skip auth when testing
const signInWithCustomTokenWrapper = async (authInstance, token) => {
  if (SKIP_FIREBASE_AUTH) {
    // console.log("Skipping Firebase authentication (TEMPORARY for MoonRoom testing)");
    return { user: { uid: 'test-user', email: 'test@example.com' } };
  }
  return signInWithCustomToken(authInstance, token);
};

export {
  collection,
  query,
  where,
  getDocs,
  deleteDoc,
  doc,
  addDoc,
  updateDoc,
  orderBy,
  // Rename limitFn to limit to avoid naming conflicts
  limitFn as limit,
  writeBatch,
  serverTimestamp,
  onSnapshot,
  getDoc,
  setDoc,
  increment,
  ref,
  getDownloadURL,
  uploadBytes,
  signInWithCustomTokenWrapper as signInWithCustomToken,
  runTransaction,
  arrayUnion,
  // Realtime Database exports
  dbRef,
  set,
  onValue,
  push,
  onDisconnect,
  rtdbServerTimestamp
};
