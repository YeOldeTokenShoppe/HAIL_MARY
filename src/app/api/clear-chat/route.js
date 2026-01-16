// API Route to clear agent chat for testing
import { NextResponse } from 'next/server';
import { initializeApp, getApps } from 'firebase/app';
import { getFirestore, collection, getDocs, deleteDoc } from 'firebase/firestore';

// Firebase config
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

// Initialize Firebase
let db;
try {
  const app = !getApps().length ? initializeApp(firebaseConfig) : getApps()[0];
  db = getFirestore(app);
} catch (error) {
  console.error('Firebase initialization failed:', error);
}

export async function POST(request) {
  try {
    if (!db) {
      throw new Error('Firebase not initialized');
    }

    const { confirm } = await request.json();
    
    if (confirm !== 'yes') {
      return NextResponse.json({
        success: false,
        error: 'Confirmation required. Send { "confirm": "yes" }'
      }, { status: 400 });
    }

    // Get all documents in agentChat collection
    const querySnapshot = await getDocs(collection(db, 'agentChat'));
    
    const deletePromises = [];
    querySnapshot.forEach((doc) => {
      deletePromises.push(deleteDoc(doc.ref));
    });

    await Promise.all(deletePromises);

    return NextResponse.json({
      success: true,
      message: `Cleared ${deletePromises.length} chat messages`,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Clear chat error:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}

export async function GET(request) {
  return NextResponse.json({
    success: true,
    message: 'Send POST request with { "confirm": "yes" } to clear chat',
    warning: 'This will delete all agent chat messages'
  });
}