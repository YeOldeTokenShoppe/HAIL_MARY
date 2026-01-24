#!/bin/bash
# Encode Firebase private key for Railway deployment
# Usage: ./scripts/encode-firebase-key.sh path/to/service-account.json

if [ -z "$1" ]; then
    echo "Usage: ./scripts/encode-firebase-key.sh path/to/service-account.json"
    echo ""
    echo "This script extracts and base64 encodes the private key from a Firebase"
    echo "service account JSON file for use in Railway environment variables."
    exit 1
fi

if [ ! -f "$1" ]; then
    echo "Error: File not found: $1"
    exit 1
fi

# Check if jq is installed
if ! command -v jq &> /dev/null; then
    echo "Error: jq is required. Install with: brew install jq"
    exit 1
fi

# Extract and encode the private key
ENCODED=$(cat "$1" | jq -r '.private_key' | base64)

echo ""
echo "==========================================="
echo "FIREBASE_PRIVATE_KEY_BASE64 for Railway:"
echo "==========================================="
echo ""
echo "$ENCODED"
echo ""
echo "==========================================="
echo "Copy the above value to Railway's environment variables"
echo "==========================================="
