#!/bin/bash

# Read Firebase variables from .env file and set them as secrets
echo "Setting Firebase secrets..."

# Source the .env file
if [ -f .env ]; then
    export $(cat .env | grep FIREBASE | xargs)
    
    # Set each Firebase secret
    firebase apphosting:secrets:set NEXT_PUBLIC_FIREBASE_API_KEY "$NEXT_PUBLIC_FIREBASE_API_KEY" --force
    firebase apphosting:secrets:set NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN "$NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN" --force
    firebase apphosting:secrets:set NEXT_PUBLIC_FIREBASE_PROJECT_ID "$NEXT_PUBLIC_FIREBASE_PROJECT_ID" --force
    firebase apphosting:secrets:set NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET "$NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET" --force
    firebase apphosting:secrets:set NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID "$NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID" --force
    firebase apphosting:secrets:set NEXT_PUBLIC_FIREBASE_APP_ID "$NEXT_PUBLIC_FIREBASE_APP_ID" --force
    firebase apphosting:secrets:set NEXT_PUBLIC_FIREBASE_DATABASE_URL "$NEXT_PUBLIC_FIREBASE_DATABASE_URL" --force
    firebase apphosting:secrets:set NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID "$NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID" --force
    
    echo "Firebase secrets have been set!"
else
    echo "Error: .env file not found"
    exit 1
fi
