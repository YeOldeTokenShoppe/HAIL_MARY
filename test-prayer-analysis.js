// Test script to check if prayer analysis is working
// Run with: node test-prayer-analysis.js

async function testPrayerAnalysis() {
  try {
    console.log('Testing prayer analysis API...');
    
    // Test the API endpoint
    const response = await fetch('http://localhost:3000/api/analyze-prayers');
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('API Error:', response.status, errorText);
      return;
    }
    
    const data = await response.json();
    
    console.log('\n=== Prayer Analysis Results ===');
    console.log('Overall Sentiment:', data.overall);
    console.log('Label:', data.label);
    console.log('Total Analyzed:', data.totalAnalyzed || 0);
    console.log('Prayers per Hour:', data.prayersPerHour);
    console.log('\nTop Emotions:');
    if (data.emotions) {
      data.emotions.forEach(emotion => {
        console.log(`  ${emotion.name}: ${emotion.value}%`);
      });
    }
    console.log('\nKeywords:', data.keywords ? data.keywords.join(', ') : 'None');
    console.log('From Cache:', data.fromCache || false);
    console.log('Last Update:', data.lastUpdate);
    
    if (data.error) {
      console.log('\nNote: Using fallback data due to:', data.error);
    }
    
  } catch (error) {
    console.error('Failed to test prayer analysis:', error);
  }
}

// Note: This won't work with Node.js directly due to fetch
// Run this in the browser console instead or use the app directly
console.log(`
To test the prayer analysis:

1. Open your browser console
2. Run this code:

fetch('/api/analyze-prayers')
  .then(res => res.json())
  .then(data => console.log('Prayer Analysis:', data))
  .catch(err => console.error('Error:', err));

Or just open the MOOD tab in your app!
`);