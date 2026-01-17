#!/usr/bin/env node

/**
 * Railway Base64 Private Key Encoder
 * 
 * Railway corrupts multi-line private keys. This creates a base64-encoded version
 * that Railway can't corrupt, which we then decode in the service.
 */

const fs = require('fs');
const path = require('path');

console.log('🔧 Railway Base64 Private Key Encoder');
console.log('====================================\n');

try {
  // Read the service account key
  const serviceAccountPath = path.join(__dirname, 'serviceAccountKey.json');
  
  if (!fs.existsSync(serviceAccountPath)) {
    console.error('❌ serviceAccountKey.json not found!');
    process.exit(1);
  }
  
  const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
  
  // Base64 encode the private key
  const privateKeyBase64 = Buffer.from(serviceAccount.private_key).toString('base64');
  
  console.log('📋 Original private key:');
  console.log('  Length:', serviceAccount.private_key.length);
  console.log('  Newlines:', (serviceAccount.private_key.match(/\n/g) || []).length);
  
  console.log('\n🔐 Base64 encoded private key:');
  console.log('  Length:', privateKeyBase64.length);
  console.log('  First 50 chars:', privateKeyBase64.substring(0, 50));
  
  console.log('\n🚀 SET THIS IN RAILWAY:');
  console.log('========================');
  console.log('Variable Name: FIREBASE_PRIVATE_KEY_BASE64');
  console.log('Variable Value:');
  console.log(privateKeyBase64);
  
  console.log('\n💡 INSTRUCTIONS:');
  console.log('1. In Railway, ADD A NEW variable called: FIREBASE_PRIVATE_KEY_BASE64');
  console.log('2. Set the value to the base64 string above');
  console.log('3. KEEP the original FIREBASE_PRIVATE_KEY as a backup');
  console.log('4. Redeploy');
  console.log('5. The service will try base64 first, then fallback to the original');
  
  console.log('\n✅ This approach prevents Railway from corrupting the private key!');
  
} catch (error) {
  console.error('❌ Error:', error.message);
  process.exit(1);
}