#!/usr/bin/env node

/**
 * Firebase Connection Test
 * 
 * Run this in Railway to verify Firebase environment variables 
 * and connection are working properly
 */

const { initializeApp } = require('firebase/app');
const { getFirestore, doc, setDoc, serverTimestamp } = require('firebase/firestore');

// Load environment variables
require('dotenv').config();

// Firebase configuration
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

async function testFirebaseConnection() {
  console.log('🧪 Firebase Connection Test Started');
  console.log('=====================================\n');

  // Check environment variables
  console.log('1. Checking Environment Variables:');
  const requiredVars = [
    'NEXT_PUBLIC_FIREBASE_API_KEY',
    'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN', 
    'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
    'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET',
    'NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
    'NEXT_PUBLIC_FIREBASE_APP_ID'
  ];

  let missingVars = [];
  requiredVars.forEach(varName => {
    const value = process.env[varName];
    if (value) {
      console.log(`   ✅ ${varName}: ${value.substring(0, 20)}...`);
    } else {
      console.log(`   ❌ ${varName}: MISSING`);
      missingVars.push(varName);
    }
  });

  if (missingVars.length > 0) {
    console.log(`\n❌ Missing required environment variables: ${missingVars.join(', ')}`);
    process.exit(1);
  }

  console.log('\n2. Initializing Firebase:');
  try {
    const app = initializeApp(firebaseConfig);
    console.log('   ✅ Firebase app initialized successfully');
    
    const db = getFirestore(app);
    console.log('   ✅ Firestore database connected');

    console.log('\n3. Testing Firebase Write Operation:');
    const testDoc = {
      testMessage: 'Hello from Railway!',
      timestamp: serverTimestamp(),
      railwayTest: true,
      createdAt: new Date().toISOString()
    };

    await setDoc(doc(db, 'connectionTest', 'railway'), testDoc);
    console.log('   ✅ Successfully wrote test document to Firebase');

    console.log('\n🎉 Firebase connection test PASSED!');
    console.log('Your Railway deployment should be able to connect to Firebase.');

  } catch (error) {
    console.log('   ❌ Firebase connection test FAILED');
    console.error('Error details:', error.message);
    
    if (error.code) {
      console.error('Error code:', error.code);
    }
    
    process.exit(1);
  }
}

// Run the test
testFirebaseConnection().catch(error => {
  console.error('Unexpected error:', error);
  process.exit(1);
});