import { initializeApp, getApps } from "firebase/app";
import { 
  getFirestore, 
  collection, 
  getDocs, 
  deleteDoc,
  addDoc, 
  doc, 
  serverTimestamp, 
  writeBatch,
  query,
  where,
  orderBy,
  limit,
  getDoc,
  setDoc 
} from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID
};

// Initialize Firebase for server-side usage
let app;
let db;

try {
  // Check if Firebase is already initialized
  if (getApps().length === 0) {
    app = initializeApp(firebaseConfig);
    // console.log("Firebase initialized successfully for server");
  } else {
    app = getApps()[0];
    // console.log("Using existing Firebase app for server");
  }
  
  db = getFirestore(app);
  // console.log("Firestore initialized successfully for server");
  
} catch (error) {
  console.error("Error initializing Firebase for server:", error);
  
  // Create dummy implementations for development
  // console.log("Creating dummy Firebase implementations");
  db = null;
}

export { 
  db, 
  app, 
  collection, 
  getDocs, 
  deleteDoc,
  addDoc, 
  doc, 
  serverTimestamp, 
  writeBatch,
  query,
  where,
  orderBy,
  limit,
  getDoc,
  setDoc 
};