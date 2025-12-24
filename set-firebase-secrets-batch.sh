#!/bin/bash

# Read .env file and create secrets
source .env

# Array of Firebase variables to set
firebase_vars=(
  "NEXT_PUBLIC_FIREBASE_API_KEY"
  "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN"
  "NEXT_PUBLIC_FIREBASE_PROJECT_ID"
  "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET"
  "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID"
  "NEXT_PUBLIC_FIREBASE_APP_ID"
  "NEXT_PUBLIC_FIREBASE_DATABASE_URL"
  "NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID"
)

for var in "${firebase_vars[@]}"; do
  value="${!var}"
  # Remove quotes if present
  value="${value%\"}"
  value="${value#\"}"
  
  echo "Setting secret: $var"
  echo "$value" | firebase apphosting:secrets:set "$var" --data-file=- --force --non-interactive
done

echo "Done setting secrets"
