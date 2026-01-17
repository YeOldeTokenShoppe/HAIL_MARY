#!/usr/bin/env node

/**
 * Test script to populate Firebase with mock trading data
 * to verify Mainnet Readiness Stats are working correctly
 */

const { initializeApp } = require('firebase/app');
const { getFirestore, collection, addDoc, serverTimestamp } = require('firebase/firestore');

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

async function populateTestTradingData() {
  console.log('🧪 Populating test trading data for Mainnet Readiness Stats...\n');

  try {
    // Initialize Firebase
    const app = initializeApp(testConfig.firebase);
    const db = getFirestore(app);

    // Create sample trades with realistic P&L patterns
    const sampleTrades = [];
    let cumulativePnL = 0;
    
    // Generate 25 sample trades over the last week
    const oneWeek = 7 * 24 * 60 * 60 * 1000;
    const now = Date.now();
    
    for (let i = 0; i < 25; i++) {
      const timestamp = now - (oneWeek * (25 - i) / 25);
      
      // 60% win rate simulation
      const isWin = Math.random() < 0.6;
      const pnl = isWin ? 
        (Math.random() * 150 + 50) :   // Wins: $50-200
        -(Math.random() * 80 + 20);    // Losses: $20-100
      
      cumulativePnL += pnl;
      
      const trade = {
        id: `test_trade_${i}`,
        symbol: i % 3 === 0 ? 'BTC' : i % 3 === 1 ? 'ETH' : 'SOL',
        side: Math.random() > 0.5 ? 'buy' : 'sell',
        timestamp: timestamp,
        result: {
          pnl: pnl,
          success: isWin,
          price: 95000 + (Math.random() - 0.5) * 2000, // BTC-ish price
          size: Math.random() * 0.1 + 0.01, // 0.01-0.11
          fees: Math.random() * 5 + 1 // $1-6 fees
        },
        execution: {
          strategy: 'RL80_AUTO',
          confidence: Math.random() * 0.4 + 0.6, // 0.6-1.0
          reasoning: isWin ? 'Strong technical signals' : 'Market reversal'
        },
        createdAt: new Date(timestamp).toISOString()
      };
      
      sampleTrades.push(trade);
    }

    console.log(`📊 Generated ${sampleTrades.length} sample trades`);
    console.log(`💰 Total P&L: $${cumulativePnL.toFixed(2)}`);
    console.log(`📈 Win Rate: ${(sampleTrades.filter(t => t.result.success).length / sampleTrades.length * 100).toFixed(1)}%\n`);

    // Add trades to Firebase
    console.log('💾 Adding trades to Firebase...');
    
    for (let i = 0; i < sampleTrades.length; i++) {
      const trade = sampleTrades[i];
      
      try {
        await addDoc(collection(db, 'trades'), trade);
        console.log(`✅ Added trade ${i + 1}/${sampleTrades.length}: ${trade.result.success ? 'WIN' : 'LOSS'} $${trade.result.pnl.toFixed(2)}`);
        
        // Small delay to avoid rate limits
        await sleep(100);
        
      } catch (error) {
        console.error(`❌ Failed to add trade ${i + 1}:`, error.message);
      }
    }

    console.log('\n🎉 Test trading data population complete!');
    console.log('\n📋 Summary:');
    console.log(`• Total Trades: ${sampleTrades.length}`);
    console.log(`• Winning Trades: ${sampleTrades.filter(t => t.result.success).length}`);
    console.log(`• Win Rate: ${(sampleTrades.filter(t => t.result.success).length / sampleTrades.length * 100).toFixed(1)}%`);
    console.log(`• Total P&L: $${cumulativePnL.toFixed(2)}`);
    
    // Calculate max drawdown
    let peak = 0;
    let maxDrawdown = 0;
    let runningPnL = 0;
    
    for (const trade of sampleTrades) {
      runningPnL += trade.result.pnl;
      if (runningPnL > peak) peak = runningPnL;
      const drawdown = peak > 0 ? ((peak - runningPnL) / peak) * 100 : 0;
      if (drawdown > maxDrawdown) maxDrawdown = drawdown;
    }
    
    console.log(`• Max Drawdown: ${maxDrawdown.toFixed(1)}%`);
    console.log('\n🔍 Check the /trade page to see updated Mainnet Readiness Stats!');

  } catch (error) {
    console.error('❌ Test data population failed:', error);
    process.exit(1);
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Run test if called directly
if (require.main === module) {
  require('dotenv').config();
  populateTestTradingData().catch(console.error);
}

module.exports = { populateTestTradingData };