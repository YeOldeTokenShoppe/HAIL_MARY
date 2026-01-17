// Test Firebase client initialization in a browser-like environment
// This simulates what happens when the component loads

// Simulate browser environment
global.window = {};
global.document = {};
global.navigator = {};

try {
  const { db, collection, addDoc, serverTimestamp } = require('./src/lib/firebaseClient.js');
  
  console.log('🔍 Testing Firebase client imports:');
  console.log('db:', !!db);
  console.log('collection:', typeof collection);
  console.log('addDoc:', typeof addDoc);
  console.log('serverTimestamp:', typeof serverTimestamp);
  
  if (db) {
    console.log('✅ Firebase initialized successfully');
    
    // Test creating a collection reference
    try {
      const testCol = collection(db, 'test');
      console.log('✅ Collection creation test passed:', !!testCol);
    } catch (e) {
      console.log('❌ Collection creation failed:', e.message);
    }
  } else {
    console.log('❌ Firebase db is null - using dummy implementation');
  }
  
} catch (error) {
  console.error('❌ Import error:', error.message);
}