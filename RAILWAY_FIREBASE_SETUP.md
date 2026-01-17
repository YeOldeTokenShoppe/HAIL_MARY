# Railway Firebase Environment Variables Setup

## Problem
Railway corrupts large JSON environment variables by inserting extra spaces, causing Firebase service account authentication to fail with errors like:
```
❌ Failed to parse FIREBASE_SERVICE_ACCOUNT_KEY JSON: Unexpected token   in JSON at position 637
```

## Solution
Break down the Firebase service account into individual environment variables instead of using a single JSON string.

## Step 1: Remove the Corrupted Variable

In your Railway dashboard:
1. Go to your project > Variables
2. **DELETE** the `FIREBASE_SERVICE_ACCOUNT_KEY` variable (it's corrupted)
3. **DELETE** the `GOOGLE_APPLICATION_CREDENTIALS` variable if present

## Step 2: Add Individual Firebase Service Account Variables

From your `serviceAccountKey.json` file, extract each field and add these variables to Railway:

### Required Variables:
```bash
FIREBASE_TYPE=service_account
FIREBASE_PROJECT_ID=hailmary-3ff6c
FIREBASE_PRIVATE_KEY_ID=a82f5e6dddd68348075943b5452660b87969b99c
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC7...\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-abc123@hailmary-3ff6c.iam.gserviceaccount.com
FIREBASE_CLIENT_ID=123456789012345678901
FIREBASE_AUTH_URI=https://accounts.google.com/o/oauth2/auth
FIREBASE_TOKEN_URI=https://oauth2.googleapis.com/token
FIREBASE_AUTH_PROVIDER_X509_CERT_URL=https://www.googleapis.com/oauth2/v1/certs
FIREBASE_CLIENT_X509_CERT_URL=https://www.googleapis.com/oauth2/v1/certs/firebase-adminsdk-abc123%40hailmary-3ff6c.iam.gserviceaccount.com
FIREBASE_UNIVERSE_DOMAIN=googleapis.com
```

### Critical Notes:

1. **Private Key Format**: Keep the `\n` characters in the private key - they're important!
2. **Quotes**: Use double quotes around the private key value in Railway
3. **No Spaces**: Make sure there are no extra spaces in any values

## Step 3: Add Standard Firebase Client Variables

These are for the frontend (if not already present):

```bash
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key_here
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=hailmary-3ff6c.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=hailmary-3ff6c
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=hailmary-3ff6c.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789012
NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789012:web:abc123def456ghi789
```

## Step 4: Verify Setup

After adding all variables, redeploy your Railway service and check the logs for:

✅ **Success indicators:**
```
✅ Service account created from individual env vars
✅ Firebase Admin SDK initialized successfully
Project ID: hailmary-3ff6c
```

❌ **Failure indicators:**
```
❌ Missing required Firebase environment variables (project_id, private_key, client_email)
⚠️ Individual env vars failed, trying JSON fallback
```

## How the Fix Works

The updated code tries to use individual environment variables first:

1. **firebase-env-fix.js** - Creates service account object from individual vars
2. **services/lighter-background-service.js** - Uses Firebase Admin SDK with individual vars
3. **src/lib/firebaseClient.js** - Frontend already uses individual vars

## Testing

Run the validation script to verify your setup:
```bash
node validate-firebase-key.js
```

## Fallback

If individual variables fail, the system will still try to parse the JSON as a fallback, so both approaches can coexist.

## Files Modified

- `firebase-env-fix.js` - Service account creation from env vars
- `services/lighter-background-service.js` - Updated to use Admin SDK with individual vars
- `src/lib/firebaseClient.js` - Already supports individual vars (no changes needed)

## Railway Variable List Summary

Copy and paste this checklist into your Railway variables:

```
✓ FIREBASE_TYPE
✓ FIREBASE_PROJECT_ID
✓ FIREBASE_PRIVATE_KEY_ID
✓ FIREBASE_PRIVATE_KEY (with quotes and \n preserved)
✓ FIREBASE_CLIENT_EMAIL
✓ FIREBASE_CLIENT_ID
✓ FIREBASE_AUTH_URI
✓ FIREBASE_TOKEN_URI
✓ FIREBASE_AUTH_PROVIDER_X509_CERT_URL
✓ FIREBASE_CLIENT_X509_CERT_URL
✓ FIREBASE_UNIVERSE_DOMAIN
✓ NEXT_PUBLIC_FIREBASE_API_KEY
✓ NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
✓ NEXT_PUBLIC_FIREBASE_PROJECT_ID
✓ NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
✓ NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
✓ NEXT_PUBLIC_FIREBASE_APP_ID
```

After setting all variables, redeploy and your Firebase connection should work perfectly! 🚀