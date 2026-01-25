#!/usr/bin/env node

/**
 * Reset Paper Trading Account
 * Clears all simulated positions and resets account to $10,000
 */

const admin = require('firebase-admin');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

const INITIAL_BALANCE = 10000;

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
      console.log('✅ Firebase initialized with service account');
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
    console.log('✅ Firebase initialized with individual credentials');
    return admin.firestore();
  }

  throw new Error('No valid Firebase credentials found');
}

async function resetPaperTrading() {
  console.log('🔄 Resetting Paper Trading Account');
  console.log('==================================');

  const db = await initializeFirebase();

  // 1. Delete all simulated positions
  console.log('\n📊 Clearing simulated positions...');
  const positionsSnapshot = await db.collection('simulatedPositions').get();
  const positionBatch = db.batch();
  let positionCount = 0;

  positionsSnapshot.forEach(doc => {
    positionBatch.delete(doc.ref);
    positionCount++;
  });

  if (positionCount > 0) {
    await positionBatch.commit();
    console.log(`   Deleted ${positionCount} positions`);
  } else {
    console.log('   No positions to delete');
  }

  // 2. Delete all trade history
  console.log('\n📜 Clearing trade history...');
  const tradesSnapshot = await db.collection('simulatedTradeHistory').get();
  const tradeBatch = db.batch();
  let tradeCount = 0;

  tradesSnapshot.forEach(doc => {
    tradeBatch.delete(doc.ref);
    tradeCount++;
  });

  if (tradeCount > 0) {
    await tradeBatch.commit();
    console.log(`   Deleted ${tradeCount} trades`);
  } else {
    console.log('   No trades to delete');
  }

  // 3. Reset account balance
  console.log('\n💰 Resetting account balance...');
  const accountRef = db.collection('simulatedAccount').doc('balance');

  const newAccount = {
    initial: INITIAL_BALANCE,
    current: INITIAL_BALANCE,
    totalRealizedPnL: 0,
    totalUnrealizedPnL: 0,
    totalTrades: 0,
    wins: 0,
    losses: 0,
    winRate: 0,
    maxDrawdown: 0,
    peakBalance: INITIAL_BALANCE,
    lastUpdated: new Date(),
    resetAt: new Date()
  };

  await accountRef.set(newAccount);
  console.log(`   Account reset to $${INITIAL_BALANCE.toLocaleString()}`);

  // 4. Summary
  console.log('\n✅ Paper Trading Reset Complete!');
  console.log('================================');
  console.log(`   Initial Balance: $${INITIAL_BALANCE.toLocaleString()}`);
  console.log(`   Positions Cleared: ${positionCount}`);
  console.log(`   Trades Cleared: ${tradeCount}`);
  console.log(`   Win Rate: 0%`);
  console.log(`   Max Drawdown: 0%`);
  console.log('\n🚀 Ready for paper trading!');

  process.exit(0);
}

resetPaperTrading().catch(error => {
  console.error('❌ Reset failed:', error.message);
  process.exit(1);
});
