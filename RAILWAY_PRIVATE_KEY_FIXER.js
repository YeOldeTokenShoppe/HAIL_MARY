#!/usr/bin/env node

/**
 * Railway Private Key Format Fixer
 * 
 * This script shows you the EXACT format to paste into Railway
 * for the FIREBASE_PRIVATE_KEY environment variable
 */

const fs = require('fs');
const path = require('path');

console.log('🔧 Railway Private Key Format Fixer');
console.log('=====================================\n');

try {
  // Read the service account key
  const serviceAccountPath = path.join(__dirname, 'serviceAccountKey.json');
  
  if (!fs.existsSync(serviceAccountPath)) {
    console.error('❌ serviceAccountKey.json not found!');
    console.log('Make sure serviceAccountKey.json is in the same directory as this script.');
    process.exit(1);
  }
  
  const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
  
  console.log('📋 Current private key analysis:');
  console.log('  Length:', serviceAccount.private_key.length);
  console.log('  Has proper headers:', serviceAccount.private_key.includes('-----BEGIN PRIVATE KEY-----'));
  console.log('  Newlines:', (serviceAccount.private_key.match(/\n/g) || []).length);
  
  console.log('\n🚀 COPY THIS EXACT VALUE TO RAILWAY:');
  console.log('=====================================');
  console.log('Variable Name: FIREBASE_PRIVATE_KEY');
  console.log('Variable Value:');
  console.log('```');
  console.log(serviceAccount.private_key);
  console.log('```');
  
  console.log('\n💡 IMPORTANT INSTRUCTIONS:');
  console.log('1. In Railway, go to Variables tab');
  console.log('2. Find FIREBASE_PRIVATE_KEY variable');
  console.log('3. Click Edit');
  console.log('4. DELETE the current value completely');
  console.log('5. Copy the value between the ``` marks above');
  console.log('6. Paste it into Railway (keep all newlines!)');
  console.log('7. Click Save');
  console.log('8. Redeploy');
  
  console.log('\n✅ The value should start with: -----BEGIN PRIVATE KEY-----');
  console.log('✅ The value should end with: -----END PRIVATE KEY-----');
  console.log('✅ It should have multiple lines (not all on one line)');
  
  // Also create a version with explicit \n for Railway
  const railwayFormat = serviceAccount.private_key.replace(/\n/g, '\\n');
  
  console.log('\n🔄 ALTERNATIVE FORMAT (if the above doesn\'t work):');
  console.log('===============================================');
  console.log('Try this version with explicit \\n sequences:');
  console.log('```');
  console.log(railwayFormat);
  console.log('```');
  
} catch (error) {
  console.error('❌ Error reading service account key:', error.message);
  process.exit(1);
}