/**
 * Script to fix prediction market options in Firebase
 *
 * Usage: node scripts/fixMarketOptions.js
 */

import 'dotenv/config';
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, updateDoc, getDoc } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

// Correct oracle options
const ORACLE_OPTIONS = [
  { id: 'EMO', name: 'EMO', color: '#ff8800', pool: 0, betCount: 0 },
  { id: 'TEKNO', name: 'TEKNO', color: '#aa44ff', pool: 0, betCount: 0 },
  { id: 'MACRO', name: 'MACRO', color: '#00c8ff', pool: 0, betCount: 0 }
];

async function fixMarketOptions() {
  console.log('🔧 Fixing prediction market options...\n');

  const app = initializeApp(firebaseConfig);
  const db = getFirestore(app);

  // Market ID to fix - update this if needed
  const marketId = 'oracle-accuracy-2026-W04';

  try {
    const marketRef = doc(db, 'predictionMarkets', marketId);
    const marketSnap = await getDoc(marketRef);

    if (!marketSnap.exists()) {
      console.error(`❌ Market not found: ${marketId}`);
      console.log('\nAvailable market IDs in your Firebase:');
      console.log('  - Check Firebase Console → Firestore → predictionMarkets');
      process.exit(1);
    }

    const currentData = marketSnap.data();
    console.log(`📋 Current market: ${currentData.question}`);
    console.log(`   Current options:`, currentData.options?.map(o => o.name || o.id).join(', '));

    // Update with correct options AND correct on-chain market ID
    // Market ID 1 is the EMO/TEKNO/MACRO market (ID 0 was a Bitcoin market)
    await updateDoc(marketRef, {
      options: ORACLE_OPTIONS,
      type: 'oracle_accuracy',
      onChainMarketId: 1  // Correct on-chain ID for EMO/TEKNO/MACRO market
    });

    console.log(`\n✅ Updated options to: ${ORACLE_OPTIONS.map(o => o.id).join(', ')}`);
    console.log('\nRefresh your page to see the changes.');

  } catch (error) {
    console.error('❌ Error:', error.message);
  }

  process.exit(0);
}

fixMarketOptions();
