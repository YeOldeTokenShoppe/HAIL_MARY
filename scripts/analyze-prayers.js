#!/usr/bin/env node

// Manual script to trigger prayer analysis
// Run with: node scripts/analyze-prayers.js

const SITE_URL = process.env.SITE_URL || 'http://localhost:3000';

async function analyzePrayers() {
  console.log('🙏 Triggering prayer analysis...');
  console.log(`URL: ${SITE_URL}/api/cron/analyze-prayers`);
  
  try {
    const response = await fetch(`${SITE_URL}/api/cron/analyze-prayers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Add auth header if CRON_SECRET is set
        ...(process.env.CRON_SECRET && {
          'Authorization': `Bearer ${process.env.CRON_SECRET}`
        })
      }
    });
    
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`HTTP ${response.status}: ${error}`);
    }
    
    const result = await response.json();
    
    console.log('\n✅ Analysis Complete!');
    console.log('=====================================');
    console.log(`📊 Sentiment: ${result.label} (${(result.overall * 100).toFixed(0)}%)`);
    console.log(`📈 Total Analyzed: ${result.totalAnalyzed}`);
    console.log(`⏰ Prayers/Hour: ${result.prayersPerHour}`);
    
    if (result.emotions && result.emotions.length > 0) {
      console.log('\n🎭 Top Emotions:');
      result.emotions.forEach(emotion => {
        console.log(`   ${emotion.name}: ${emotion.value}%`);
      });
    }
    
    if (result.keywords && result.keywords.length > 0) {
      console.log(`\n🔤 Keywords: ${result.keywords.join(', ')}`);
    }
    
    console.log('\n📝 Data saved to Firebase: sentiment_analysis/latest');
    console.log('🔄 Real-time updates will appear in the MOOD tab');
    
  } catch (error) {
    console.error('❌ Analysis failed:', error.message);
    console.error('\nMake sure:');
    console.error('1. Your dev server is running (npm run dev)');
    console.error('2. Firebase is configured correctly');
    console.error('3. OpenAI API key is set in .env');
  }
}

// Check if running in Node.js
if (typeof window === 'undefined') {
  // Polyfill fetch for Node.js
  if (!global.fetch) {
    console.log('Installing node-fetch...');
    import('node-fetch').then(module => {
      global.fetch = module.default;
      analyzePrayers();
    }).catch(() => {
      console.error('Please install node-fetch: npm install node-fetch');
    });
  } else {
    analyzePrayers();
  }
} else {
  console.error('This script should be run with Node.js');
}