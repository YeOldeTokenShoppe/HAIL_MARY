# Quick Test Setup - Test It Yourself First!

## Step 1: Update Your Test Email
Edit `src/lib/testWallets.js` and replace the first email with your alternate email:
```javascript
export const AUTHORIZED_TEST_EMAILS = [
  'your-actual-alt@gmail.com', // <-- PUT YOUR ALTERNATE EMAIL HERE
  ...
];
```

## Step 2: Generate Test Wallets
Run this command to generate wallet keys:
```bash
node -e "
const { privateKeyAccount, generatePrivateKey } = require('viem/accounts');

console.log('Copy these to your .env.local file:');
console.log('=====================================\\n');

const wallets = [];
for (let i = 1; i <= 6; i++) {
  const privateKey = generatePrivateKey();
  const account = privateKeyAccount(privateKey);
  
  console.log(\`NEXT_PUBLIC_TEST_WALLET_\${i}=\${privateKey}\`);
  wallets.push({ num: i, address: account.address });
}

console.log('\\n=====================================');
console.log('\\nUpdate testWallets.js addresses:\\n');
wallets.forEach(w => {
  console.log(\`Wallet \${w.num}: address: '\${w.address}',\`);
});
"
```

If that doesn't work, create this simple script as `generateWallets.mjs`:
```javascript
import { ethers } from 'ethers';

for (let i = 1; i <= 6; i++) {
  const wallet = ethers.Wallet.createRandom();
  console.log(`NEXT_PUBLIC_TEST_WALLET_${i}=${wallet.privateKey}`);
  console.log(`// Address ${i}: ${wallet.address}\n`);
}
```
Then run: `node generateWallets.mjs`

## Step 3: Update Your Files

### In `.env.local`:
```
NEXT_PUBLIC_TEST_WALLET_1=0x... (from generator)
NEXT_PUBLIC_TEST_WALLET_2=0x... (from generator)
# ... etc
```

### In `src/lib/testWallets.js`:
Update the addresses with the generated ones:
```javascript
{
  id: 'tester1',
  address: '0x...', // <-- Use generated address 1
  ...
}
```

## Step 4: Fund Your Test Wallet
Only need to fund the FIRST wallet for your test:

1. **Get Base Sepolia ETH**: 
   - Go to: https://www.alchemy.com/faucets/base-sepolia
   - Enter the first wallet's address
   - Get ~0.01 ETH

2. **Send RL80 Tokens**:
   - Use your main wallet that has RL80 tokens
   - Send 1000 RL80 to the first test wallet address

## Step 5: Test It!

1. Sign out of your main account
2. Sign in with your alternate email address
3. You should automatically get the test wallet with 1000 RL80
4. Try lighting a candle!

## Troubleshooting

- **No wallet appearing?** 
  - Check console for "User ... is not authorized for test wallets"
  - Make sure email matches exactly (case-insensitive though)
  
- **Wallet has no balance?**
  - Did you fund it with RL80 tokens?
  - Check the contract address is correct
  
- **Can't sign transactions?**
  - Make sure the private key is in .env.local
  - Restart your dev server after adding env variables

## What Success Looks Like

✅ Sign in with alternate email
✅ See "Test wallet assigned to..." in console
✅ Balance shows 1000 RL80
✅ Can light a candle without any wallet popups
✅ Transaction goes through automatically

Once this works for you, you can add your other testers' emails!