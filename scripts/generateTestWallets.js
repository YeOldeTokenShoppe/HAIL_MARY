// Script to generate test wallets
// Run with: node scripts/generateTestWallets.js

import { privateKeyToAccount } from 'thirdweb/wallets';
import { createThirdwebClient } from 'thirdweb';
import { randomBytes } from 'crypto';

// Create a client (we don't need a real clientId for just generating wallets)
const client = createThirdwebClient({ clientId: 'test' });

console.log('Generating 6 test wallets for Base...\n');
console.log('Add these to your .env.local file:\n');
console.log('=====================================\n');

const wallets = [];

for (let i = 1; i <= 6; i++) {
  // Generate a random private key
  const privateKey = '0x' + randomBytes(32).toString('hex');
  const account = privateKeyToAccount({ client, privateKey });
  
  wallets.push({
    id: i,
    privateKey,
    address: account.address
  });
  
  console.log(`# Test Wallet ${i}`);
  console.log(`NEXT_PUBLIC_TEST_WALLET_${i}=${privateKey}`);
  console.log(`# Address: ${account.address}\n`);
}

console.log('=====================================\n');
console.log('Update testWallets.js with these addresses:\n');

wallets.forEach((wallet, index) => {
  console.log(`Wallet ${index + 1}: address: '${wallet.address}',`);
});

console.log('\n=====================================');
console.log('\nNEXT STEPS:');
console.log('1. Copy the environment variables above to your .env.local file');
console.log('2. Update the addresses in src/lib/testWallets.js');
console.log('3. Fund each wallet with RL80 tokens on Base');
console.log('4. Fund each wallet with a small amount of ETH for gas (~0.01 ETH)');