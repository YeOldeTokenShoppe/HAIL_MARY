// Firebase configuration for server-side usage (API routes)
import { initializeApp, getApps } from "firebase/app";
import {
  getFirestore,
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  getDoc,
  doc,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  deleteField,
  serverTimestamp,
  writeBatch,
  increment,
  Timestamp,
  runTransaction,
  arrayUnion
} from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

let app;
let db;

try {
  // Check if we have the required config
  if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
    console.warn('[Firebase Server] Missing required Firebase configuration');
    throw new Error('Missing Firebase configuration');
  }

  // Initialize Firebase for server use
  app = getApps().length === 0 ? initializeApp(firebaseConfig, 'server') : getApps().find(a => a.name === 'server');
  
  if (!app) {
    app = initializeApp(firebaseConfig, 'server');
  }
  
  db = getFirestore(app);
  console.log('[Firebase Server] Firebase initialized successfully for server');
} catch (error) {
  console.error('[Firebase Server] Error initializing Firebase:', error.message);
  db = null;
}

export {
  db,
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  getDoc,
  doc,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  deleteField,
  serverTimestamp,
  writeBatch,
  increment,
  Timestamp,
  runTransaction,
  arrayUnion
};