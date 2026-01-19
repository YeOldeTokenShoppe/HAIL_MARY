# RL80 Trading Agent (Python)

Autonomous trading agent that executes trades on Lighter DEX based on decisions from the scoring workflow.

## Architecture

```
Firebase Scheduled Function (hourly)
    ↓
Scoring Workflow (Next.js API)
    ↓
Firestore: agentDecisions/RL80
    ↓
Python Agent (this service) ← reads decisions
    ↓
Lighter DEX (executes trades)
```

## Railway Deployment

1. Create a new Railway service pointing to the `agent/` directory
2. Set environment variables in Railway:

```
LIGHTER_API_KEY=your_lighter_api_key
LIGHTER_ACCOUNT_INDEX=227
FIREBASE_PROJECT_ID=your_project_id
FIREBASE_PRIVATE_KEY_BASE64=base64_encoded_private_key
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com
```

3. Deploy - Railway will auto-detect Python and install dependencies

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `LIGHTER_API_KEY` | Yes | Lighter DEX API private key |
| `LIGHTER_ACCOUNT_INDEX` | No | Account index (default: 227) |
| `FIREBASE_PROJECT_ID` | Yes | Firebase project ID |
| `FIREBASE_PRIVATE_KEY_BASE64` | Yes | Base64-encoded Firebase private key |
| `FIREBASE_CLIENT_EMAIL` | Yes | Firebase service account email |

### Getting Firebase Credentials

1. Go to Firebase Console → Project Settings → Service Accounts
2. Click "Generate New Private Key"
3. Base64 encode the private key:
   ```bash
   cat your-service-account.json | base64
   ```
4. Use the values from the JSON file for the env vars

## Local Testing

```bash
cd agent
pip install -r requirements.txt
export LIGHTER_API_KEY="your_key"
export GOOGLE_APPLICATION_CREDENTIALS="/path/to/service-account.json"
python agent.py
```

## How It Works

1. Agent polls Firestore every 60 seconds for `agentDecisions/RL80`
2. If a decision exists and is recent (<2 hours old):
   - BUY/SELL with confidence ≥0.5 → execute trade
3. If no decision or stale → use fallback (HOLD)
4. Trades are logged to Firestore `trades` collection
5. Agent status updated in Firestore `agentStatus/RL80`
