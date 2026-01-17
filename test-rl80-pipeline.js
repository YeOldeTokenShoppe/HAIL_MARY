#!/usr/bin/env node

/**
 * RL80 Trading Pipeline Test
 * 
 * Tests the complete flow from RL80 decision → Firebase → Background Service → Trade Execution
 */

const { initializeApp } = require('firebase/app');
const { getFirestore, doc, setDoc } = require('firebase/firestore');

// Test configuration
const testConfig = {
  firebase: {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
  }
};

async function testRL80Pipeline() {
  console.log('🧪 Testing RL80 Trading Pipeline...\n');

  try {
    // Initialize Firebase
    console.log('1. Initializing Firebase...');
    const app = initializeApp(testConfig.firebase);
    const db = getFirestore(app);
    console.log('✅ Firebase initialized\n');

    // Test Decision 1: BUY with high confidence
    console.log('2. Posting BUY decision...');
    const buyDecision = {
      action: 'BUY',
      symbol: 'ETH',
      confidence: 0.85,
      reasoning: 'Strong bullish consensus from team agents',
      timestamp: Date.now(),
      agent_version: 'JS_RL80_v1',
      market_context: {
        btcPrice: 95000,
        fearGreed: 30,
        teamConsensus: 'bullish'
      }
    };

    await setDoc(doc(db, 'agentDecisions', 'RL80'), buyDecision);
    console.log('✅ BUY decision posted to Firebase');
    console.log('📊 Decision details:', {
      action: buyDecision.action,
      symbol: buyDecision.symbol,
      confidence: buyDecision.confidence,
      reasoning: buyDecision.reasoning.substring(0, 50) + '...'
    });
    
    // Wait for background service to process
    console.log('⏳ Waiting 5 seconds for background service to process...\n');
    await sleep(5000);

    // Test Decision 2: HOLD with medium confidence
    console.log('3. Posting HOLD decision...');
    const holdDecision = {
      action: 'HOLD',
      symbol: 'ETH',
      confidence: 0.65,
      reasoning: 'Mixed signals from team, waiting for clarity',
      timestamp: Date.now(),
      agent_version: 'JS_RL80_v1',
      market_context: {
        btcPrice: 95100,
        fearGreed: 45,
        teamConsensus: 'neutral'
      }
    };

    await setDoc(doc(db, 'agentDecisions', 'RL80'), holdDecision);
    console.log('✅ HOLD decision posted to Firebase');
    console.log('📊 Decision details:', {
      action: holdDecision.action,
      symbol: holdDecision.symbol,
      confidence: holdDecision.confidence
    });

    console.log('⏳ Waiting 5 seconds for background service to process...\n');
    await sleep(5000);

    // Test Decision 3: Low confidence (should be rejected)
    console.log('4. Testing safety checks with low confidence decision...');
    const lowConfidenceDecision = {
      action: 'BUY',
      symbol: 'ETH',
      confidence: 0.45, // Below 0.6 threshold
      reasoning: 'Low confidence test - should be rejected',
      timestamp: Date.now(),
      agent_version: 'JS_RL80_v1'
    };

    await setDoc(doc(db, 'agentDecisions', 'RL80'), lowConfidenceDecision);
    console.log('✅ Low confidence decision posted (should be rejected by safety checks)');
    
    console.log('⏳ Waiting 3 seconds for background service to process...\n');
    await sleep(3000);

    // Test Decision 4: SELL decision
    console.log('5. Posting SELL decision...');
    const sellDecision = {
      action: 'SELL',
      symbol: 'ETH',
      confidence: 0.75,
      reasoning: 'Risk-off signals detected, reducing exposure',
      timestamp: Date.now(),
      agent_version: 'JS_RL80_v1',
      market_context: {
        btcPrice: 94500,
        fearGreed: 15,
        teamConsensus: 'bearish'
      }
    };

    await setDoc(doc(db, 'agentDecisions', 'RL80'), sellDecision);
    console.log('✅ SELL decision posted to Firebase');
    console.log('📊 Decision details:', {
      action: sellDecision.action,
      symbol: sellDecision.symbol,
      confidence: sellDecision.confidence
    });

    console.log('⏳ Waiting 5 seconds for final processing...\n');
    await sleep(5000);

    console.log('🎉 RL80 Trading Pipeline Test Complete!');
    console.log('\n📋 Test Summary:');
    console.log('• BUY decision with high confidence (0.85) - should execute');
    console.log('• HOLD decision with medium confidence (0.65) - should execute');
    console.log('• Low confidence BUY decision (0.45) - should be rejected');
    console.log('• SELL decision with good confidence (0.75) - should execute');
    console.log('\n🔍 Check Railway logs to see background service processing these decisions');
    console.log('🔍 Check Firebase lighterData/trades/rl80_executions for logged results');

  } catch (error) {
    console.error('❌ Pipeline test failed:', error);
    process.exit(1);
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Run test if called directly
if (require.main === module) {
  require('dotenv').config();
  testRL80Pipeline().catch(console.error);
}

module.exports = { testRL80Pipeline };