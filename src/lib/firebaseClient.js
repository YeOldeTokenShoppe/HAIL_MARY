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
  orderBy,
  limit as limitFn,
  writeBatch,
  serverTimestamp,
  onSnapshot,
  getDoc,
  setDoc,
  runTransaction
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
  // Skip Firebase initialization on the server
  if (!isBrowser) {
    // console.log("Skipping Firebase initialization on server");
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
    console.warn('See .env.example for the full list');
    throw new Error('Missing required Firebase environment variables');
  }
  
  // Check if any of the essential config values are missing
  const requiredKeys = ['apiKey', 'authDomain', 'projectId', 'storageBucket', 'messagingSenderId', 'appId'];
  const missingKeys = requiredKeys.filter(key => !firebaseConfig[key]);
  
  if (missingKeys.length > 0) {
    console.error("Missing required Firebase config keys:", missingKeys);
    throw new Error(`Missing required Firebase config: ${missingKeys.join(', ')}`);
  }
  
  app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
  
  // Connect to Firestore, Auth, Storage, and Realtime Database
  db = getFirestore(app);
  auth = getAuth(app);
  storage = getStorage(app);
  rtdb = getDatabase(app);
  
  // console.log("Firebase initialized successfully", {
  //   appInitialized: !!app,
  //   dbInitialized: !!db,
  //   authInitialized: !!auth,
  //   storageInitialized: !!storage,
  //   rtdbInitialized: !!rtdb
  // });
} catch (error) {
  console.error("Error initializing Firebase:", error);
  console.error("Firebase initialization details:", {
    error: error.message,
    stack: error.stack,
    config: JSON.stringify(firebaseConfig).replace(/[^{}:,[\]"]/g, '*') // Mask actual values for security
  });
  
  // Set services to null when initialization fails
  app = null;
  db = null;
  auth = null;
  storage = null;
  rtdb = null;
}

// Create dummy implementations for when Firebase is unavailable
// This helps prevent errors when Firebase fails to initialize
if (!db) {
  console.warn("Creating dummy Firebase implementations");
  
  // Create a more comprehensive dummy implementation
  const dummySnapshot = {
    empty: true,
    size: 0,
    docs: [],
    forEach: (callback) => {},
    map: () => [],
    exists: () => false,
    data: () => ({}),
    id: 'dummy-id'
  };
  
  // Dummy promise resolution functions for Firestore
  const dummyPromiseReturns = {
    get: () => Promise.resolve(dummySnapshot),
    set: () => Promise.resolve(),
    update: () => Promise.resolve(),
    delete: () => Promise.resolve(),
    add: () => Promise.resolve({ id: 'dummy-id' }),
    where: () => dummyPromiseReturns,
    orderBy: () => dummyPromiseReturns,
    limit: () => dummyPromiseReturns,
    doc: () => dummyPromiseReturns,
    collection: () => dummyPromiseReturns,
    getDocs: () => Promise.resolve(dummySnapshot),
    getDoc: () => Promise.resolve(dummySnapshot),
    addDoc: () => Promise.resolve({ id: 'dummy-id' }),
    setDoc: () => Promise.resolve(),
    deleteDoc: () => Promise.resolve(),
    updateDoc: () => Promise.resolve(),
    writeBatch: () => ({
      set: () => {},
      update: () => {},
      delete: () => {},
      commit: () => Promise.resolve()
    }),
    onSnapshot: () => {
      // Return a function that can be called to unsubscribe
      return () => {};
    },
    withConverter: () => dummyPromiseReturns
  };
  
  // Create comprehensive dummy implementations
  db = {
    collection: () => dummyPromiseReturns,
    doc: () => dummyPromiseReturns,
    batch: () => ({
      set: () => {},
      update: () => {},
      delete: () => {},
      commit: () => Promise.resolve()
    }),
    runTransaction: () => Promise.resolve()
  };
  
  // Extend the global Firebase namespace to include these functions
  if (typeof window !== 'undefined') {
    window.firebase = {
      firestore: {
        serverTimestamp: () => new Date()
      }
    };
  }
  
  auth = {
    onAuthStateChanged: (callback) => {
      callback(null);
      return () => {};
    },
    signInWithCustomToken: () => Promise.resolve({ user: null }),
    currentUser: null
  };
  
  storage = {
    ref: () => ({
      put: () => Promise.resolve({}),
      getDownloadURL: () => Promise.resolve("")
    })
  };
  
  rtdb = {
    ref: () => ({
      set: () => Promise.resolve(),
      on: () => {},
      once: () => Promise.resolve({}),
      push: () => Promise.resolve({ key: 'dummy-key' }),
      onDisconnect: () => ({ remove: () => Promise.resolve() })
    })
  };
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
  orderBy, 
  // Rename limitFn to limit to avoid naming conflicts
  limitFn as limit, 
  writeBatch, 
  serverTimestamp, 
  onSnapshot, 
  getDoc, 
  setDoc, 
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
