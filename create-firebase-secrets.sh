#!/bin/bash

# Read the .env file and create Firebase secrets
echo "Creating Firebase secrets..."

# Source the .env file to get the values
if [ -f .env ]; then
    # Read each Firebase variable and create a secret
    while IFS='=' read -r key value; do
        if [[ $key == NEXT_PUBLIC_FIREBASE_* ]]; then
            # Remove quotes if present
            value="${value%\"}"
            value="${value#\"}"
            value="${value%\'}"
            value="${value#\'}"
            
            echo "Creating secret: $key"
            echo "$value" | firebase apphosting:secrets:set "$key" --data-file=- --force
            
            # Grant access to the backend
            echo "Granting access for: $key"
            firebase apphosting:secrets:grantaccess "$key" --backend=pumpkin
        fi
    done < .env
    
    echo "Firebase secrets created and access granted!"
else
    echo "Error: .env file not found"
    exit 1
fi
