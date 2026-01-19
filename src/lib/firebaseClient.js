import { initializeApp, getApps } from "firebase/app";
import {
  getFirestore,
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
  increment
} from "firebase/firestore";
import { getAuth, signInWithCustomToken } from "firebase/auth";
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
    console.log("🌍 Skipping Firebase initialization on server side");
    throw new Error('Firebase initialization skipped on server');
  }
  
  // First check if we have the required environment variables
  if (!hasRequiredEnvironmentVariables()) {
    console.warn('⚠️ Firebase environment variables are missing!');
    console.warn('Please add the following to your .env file:');
    console.warn('NEXT_PUBLIC_FIREBASE_API_KEY=...');
    console.warn('NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...');
    console.warn('NEXT_PUBLIC_FIREBASE_PROJECT_ID=...');
    console.warn('NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...');
    console.warn('NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...');
    console.warn('NEXT_PUBLIC_FIREBASE_APP_ID=...');
    throw new Error('Missing required Firebase environment variables');
  }
  
  // Check if any of the essential config values are missing
  const requiredKeys = ['apiKey', 'authDomain', 'projectId', 'storageBucket', 'messagingSenderId', 'appId'];
  const missingKeys = requiredKeys.filter(key => !firebaseConfig[key]);
  
  if (missingKeys.length > 0) {
    console.error("❌ Missing required Firebase config keys:", missingKeys);
    throw new Error(`Missing required Firebase config: ${missingKeys.join(', ')}`);
  }
  
  // Initialize Firebase app
  app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
  
  // Connect to Firebase services
  db = getFirestore(app);
  auth = getAuth(app);
  storage = getStorage(app);
  rtdb = getDatabase(app);
  
  // Verify Firestore is working by attempting to create a collection reference
  const testCollection = collection(db, 'test');
  
  console.log("✅ Firebase services initialized successfully:", {
    app: !!app,
    db: !!db,
    auth: !!auth,
    storage: !!storage,
    rtdb: !!rtdb,
    testCollection: !!testCollection,
    projectId: app.options.projectId
  });
  
} catch (error) {
  console.error("❌ CRITICAL: Error initializing Firebase:", error);
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
  // Realtime Database exports
  dbRef,
  set,
  onValue,
  push,
  onDisconnect,
  rtdbServerTimestamp
};
