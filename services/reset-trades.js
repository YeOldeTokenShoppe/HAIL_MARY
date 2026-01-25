#!/usr/bin/env node

/**
 * Reset Trades Collection
 * Clears all trades from Firebase to reset dashboard metrics
 */

const admin = require('firebase-admin');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

async function initializeFirebase() {
  if (admin.apps.length > 0) {
    return admin.firestore();
  }

  // Try JSON service account first
  if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    try {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
      });
      console.log('Firebase initialized with service account');
      return admin.firestore();
    } catch (e) {
      console.error('Failed to parse FIREBASE_SERVICE_ACCOUNT_KEY:', e.message);
    }
  }

  // Try individual credentials
  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  let privateKey = process.env.FIREBASE_PRIVATE_KEY;

  if (!privateKey && process.env.FIREBASE_PRIVATE_KEY_BASE64) {
    privateKey = Buffer.from(process.env.FIREBASE_PRIVATE_KEY_BASE64, 'base64').toString('utf8');
  }

  if (privateKey) {
    privateKey = privateKey.replace(/\\n/g, '\n');
  }

  if (projectId && clientEmail && privateKey) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId,
        clientEmail,
        privateKey
      })
    });
    console.log('Firebase initialized with individual credentials');
    return admin.firestore();
  }

  throw new Error('No valid Firebase credentials found');
}

async function resetTrades() {
  console.log('Resetting Trades Collection...');
  console.log('==============================');

  const db = await initializeFirebase();

  // Delete all trades
  console.log('\nClearing trades collection...');
  const tradesSnapshot = await db.collection('trades').get();
  const batch = db.batch();
  let count = 0;

  tradesSnapshot.forEach(doc => {
    batch.delete(doc.ref);
    count++;
  });

  if (count > 0) {
    await batch.commit();
    console.log(`Deleted ${count} trades`);
  } else {
    console.log('No trades to delete');
  }

  // Also clear decisions if needed
  console.log('\nClearing decisions collection...');
  const decisionsSnapshot = await db.collection('decisions').get();
  const decisionBatch = db.batch();
  let decisionCount = 0;

  decisionsSnapshot.forEach(doc => {
    decisionBatch.delete(doc.ref);
    decisionCount++;
  });

  if (decisionCount > 0) {
    await decisionBatch.commit();
    console.log(`Deleted ${decisionCount} decisions`);
  } else {
    console.log('No decisions to delete');
  }

  console.log('\nTrades reset complete!');
  console.log('Dashboard metrics will now show 0 trades.');

  process.exit(0);
}

resetTrades().catch(error => {
  console.error('Reset failed:', error.message);
  process.exit(1);
});
