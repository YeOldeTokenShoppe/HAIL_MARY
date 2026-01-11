# Test Wallet Setup Instructions

This app uses pre-generated wallets for **authorized test users only** to simplify the experience for non-crypto native users.

## Important: Email Authorization

Only users with pre-approved email addresses will get test wallets. Update the `AUTHORIZED_TEST_EMAILS` array in `src/lib/testWallets.js` with your testers' email addresses:

```javascript
export const AUTHORIZED_TEST_EMAILS = [
  'alice@example.com',
  'bob@example.com',
  'charlie@example.com',
  // ... up to 6 emails
];
```

**Non-authorized users will need to connect their own wallets normally.**

## Setup Steps

### 1. Generate Test Wallets

Run the wallet generation script:
```bash
node scripts/generateTestWallets.js
```

This will output:
- 6 private keys to add to your `.env.local` file
- 6 wallet addresses to update in `src/lib/testWallets.js`

### 2. Update Environment Variables

Add the generated private keys to your `.env.local` file:
```
NEXT_PUBLIC_TEST_WALLET_1=0x...
NEXT_PUBLIC_TEST_WALLET_2=0x...
NEXT_PUBLIC_TEST_WALLET_3=0x...
NEXT_PUBLIC_TEST_WALLET_4=0x...
NEXT_PUBLIC_TEST_WALLET_5=0x...
NEXT_PUBLIC_TEST_WALLET_6=0x...
```

### 3. Update Wallet Addresses

Update the addresses in `src/lib/testWallets.js` with the generated addresses.

### 4. Fund the Wallets

For each wallet address:

1. **Add Base Sepolia ETH for gas fees**:
   - Go to a Base Sepolia faucet
   - Send ~0.01 ETH to each wallet address

2. **Add RL80 Test Tokens**:
   - Use your admin wallet to transfer 1000 RL80 tokens to each test wallet
   - Or use a contract function to mint tokens to each address

### 5. Test the System

1. Sign in with a test user account
2. The system will automatically assign an available test wallet
3. The wallet balance should show the pre-funded tokens
4. Users can now light candles without dealing with crypto complexity

## How It Works

- When a user signs in, they're automatically assigned one of the 6 test wallets
- The assignment is stored in localStorage to ensure consistency
- Each user keeps the same wallet for their session
- The wallet's private key is used to sign transactions automatically
- Users never see or need to manage the wallet directly

## Switching to Production

To disable test mode and use real wallets:

1. Edit `src/components/WalletAuthProvider.jsx`
2. Change `const TEST_MODE = true;` to `const TEST_MODE = false;`
3. Remove the test wallet environment variables from production

## Security Note

⚠️ **IMPORTANT**: These test wallets contain real (test) tokens on Base Sepolia. 
- Only use for testing with trusted users
- Don't put significant value in these wallets
- Don't use this approach in production with real money
- Consider the private keys compromised if exposed in client code