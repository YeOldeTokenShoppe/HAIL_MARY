// Firebase Debug Test Script
// Run this with: node firebase-debug.js

const dotenv = require('dotenv');
dotenv.config();

console.log('🔍 Firebase Environment Variables Check:');
console.log('NEXT_PUBLIC_FIREBASE_API_KEY:', process.env.NEXT_PUBLIC_FIREBASE_API_KEY ? '✅ Set' : '❌ Missing');
console.log('NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN:', process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ? '✅ Set' : '❌ Missing');
console.log('NEXT_PUBLIC_FIREBASE_PROJECT_ID:', process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ? '✅ Set' : '❌ Missing');
console.log('NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET:', process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ? '✅ Set' : '❌ Missing');
console.log('NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID:', process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ? '✅ Set' : '❌ Missing');
console.log('NEXT_PUBLIC_FIREBASE_APP_ID:', process.env.NEXT_PUBLIC_FIREBASE_APP_ID ? '✅ Set' : '❌ Missing');

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

console.log('\n🔥 Firebase Config:');
Object.entries(firebaseConfig).forEach(([key, value]) => {
  if (value) {
    console.log(`${key}: ${value.substring(0, 20)}...`);
  } else {
    console.log(`${key}: ❌ UNDEFINED`);
  }
});

// Check for common issues
console.log('\n🔍 Common Issues Check:');
console.log('- Auth domain format:', firebaseConfig.authDomain?.includes('.firebaseapp.com') ? '✅ Correct' : '❌ Should end with .firebaseapp.com');
console.log('- Project ID format:', firebaseConfig.projectId?.length > 0 ? '✅ Present' : '❌ Missing');
console.log('- Storage bucket format:', firebaseConfig.storageBucket?.includes('.appspot.com') || firebaseConfig.storageBucket?.includes('.firebasestorage.app') ? '✅ Correct' : '❌ Should end with .appspot.com or .firebasestorage.app');