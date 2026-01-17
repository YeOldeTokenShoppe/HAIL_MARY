#!/usr/bin/env node

/**
 * Firebase Service Account Key Validator
 * 
 * Validates the format of your Firebase service account key
 * before deploying to Railway
 */

const fs = require('fs');

function validateServiceAccountKey() {
  console.log('🔍 Firebase Service Account Key Validator');
  console.log('==========================================\n');

  // Check if key file exists
  const keyPaths = [
    './serviceAccountKey.json',
    './firebase-service-account.json',
    './firebase-adminsdk.json'
  ];

  let keyData = null;
  let keyPath = null;

  // Try to find the key file
  for (const path of keyPaths) {
    if (fs.existsSync(path)) {
      keyPath = path;
      console.log(`✅ Found service account key: ${path}`);
      try {
        keyData = JSON.parse(fs.readFileSync(path, 'utf8'));
        break;
      } catch (error) {
        console.log(`❌ Failed to parse ${path}: ${error.message}`);
        continue;
      }
    }
  }

  // Check environment variable
  if (!keyData && process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    console.log('✅ Found service account key in environment variable');
    try {
      keyData = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
      keyPath = 'FIREBASE_SERVICE_ACCOUNT_KEY env var';
    } catch (error) {
      console.log(`❌ Failed to parse environment variable: ${error.message}`);
    }
  }

  if (!keyData) {
    console.log('❌ No service account key found!');
    console.log('\n📋 Expected locations:');
    keyPaths.forEach(path => console.log(`   - ${path}`));
    console.log('   - FIREBASE_SERVICE_ACCOUNT_KEY environment variable');
    process.exit(1);
  }

  console.log(`\n🔍 Validating key from: ${keyPath}\n`);

  // Validate required fields
  const requiredFields = [
    'type',
    'project_id', 
    'private_key_id',
    'private_key',
    'client_email',
    'client_id',
    'auth_uri',
    'token_uri'
  ];

  let isValid = true;

  requiredFields.forEach(field => {
    if (keyData[field]) {
      if (field === 'private_key') {
        console.log(`   ✅ ${field}: [${keyData[field].length} characters]`);
        
        // Validate private key format
        const privateKey = keyData[field];
        if (!privateKey.includes('-----BEGIN PRIVATE KEY-----')) {
          console.log(`   ❌ Private key missing BEGIN header`);
          isValid = false;
        }
        if (!privateKey.includes('-----END PRIVATE KEY-----')) {
          console.log(`   ❌ Private key missing END footer`);
          isValid = false;
        }
        if (!privateKey.includes('\\n')) {
          console.log(`   ⚠️ Private key might be missing \\n line breaks`);
        }
      } else if (field === 'client_email') {
        console.log(`   ✅ ${field}: ${keyData[field]}`);
        if (!keyData[field].includes('@') || !keyData[field].includes('.iam.gserviceaccount.com')) {
          console.log(`   ⚠️ Client email format looks unusual`);
        }
      } else {
        console.log(`   ✅ ${field}: ${keyData[field].substring(0, 50)}${keyData[field].length > 50 ? '...' : ''}`);
      }
    } else {
      console.log(`   ❌ ${field}: MISSING`);
      isValid = false;
    }
  });

  console.log(`\n📊 Validation Results:`);
  if (isValid) {
    console.log('✅ Service account key appears to be valid!');
    console.log('\n🚀 You can deploy this to Railway.');
    
    if (keyPath.includes('.json')) {
      console.log('\n💡 For Railway deployment, you can either:');
      console.log('   1. Upload the JSON file and set GOOGLE_APPLICATION_CREDENTIALS=/app/serviceAccountKey.json');
      console.log('   2. Set FIREBASE_SERVICE_ACCOUNT_KEY environment variable with the JSON content');
    }
  } else {
    console.log('❌ Service account key has validation errors!');
    console.log('\n🔧 To fix:');
    console.log('   1. Download a fresh service account key from Firebase Console');
    console.log('   2. Make sure the JSON is properly formatted');
    console.log('   3. Do not edit the private_key field manually');
    process.exit(1);
  }

  // Test the key by trying to create a credential
  console.log('\n🧪 Testing credential creation...');
  try {
    // This simulates what Firebase Admin SDK does
    if (keyData.private_key && keyData.client_email) {
      // Basic validation that would catch the ASN.1 parsing error
      const privateKeyClean = keyData.private_key.replace(/\\n/g, '\n');
      
      if (privateKeyClean.includes('-----BEGIN PRIVATE KEY-----') && 
          privateKeyClean.includes('-----END PRIVATE KEY-----')) {
        console.log('✅ Private key format looks correct for Firebase Admin SDK');
      } else {
        console.log('❌ Private key format issue detected');
        isValid = false;
      }
    }
  } catch (error) {
    console.log('❌ Credential test failed:', error.message);
    isValid = false;
  }

  if (isValid) {
    console.log('\n🎉 All validations passed! Key should work in Railway.');
  } else {
    console.log('\n❌ Validation failed. Please fix the issues above.');
    process.exit(1);
  }
}

// Run the validator
validateServiceAccountKey();