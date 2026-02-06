// Test wallets for non-crypto native users
// These wallets should be pre-funded with RL80 tokens on Base

// IMPORTANT: Update these email addresses with your actual testers
export const AUTHORIZED_TEST_EMAILS = [
  'mpaulsonx@gmail.com', // YOUR TEST EMAIL - Replace this first!
  '503crj@gmail.com', // Replace with actual tester email
  'jfast1979@gmail.com', // Replace with actual tester email
  'sherriekvamme@gmail.com', // Replace with actual tester email
  'randyorear@yahoo.com', // Replace with actual tester email
  'twylasnow@gmail.com', // Replace with actual tester email
];

export const TEST_WALLETS = [
  // Single wallet that can be used by multiple test users
  {
    id: 'shared_test_wallet',
    assignedEmail: AUTHORIZED_TEST_EMAILS[0], // mpaulsonx@gmail.com for local testing
    name: 'Test User',
    address: '0xf4bb7642F20615d097a61710E479544fEA8BdA4D', // Your new pregenerated wallet
    privateKey: process.env.NEXT_PUBLIC_TEST_WALLET_2 || '0x75ca73727f2c7c04f321b3e80f76b59f8faa11147798263bcff8f2a60494a953', // Hardcoded fallback
    prefundedAmount: 1000
  },
  {
    id: 'shared_test_wallet_2', 
    assignedEmail: AUTHORIZED_TEST_EMAILS[1], // 503crj@gmail.com for production
    name: 'Test User 2',
    address: '0xf4bb7642F20615d097a61710E479544fEA8BdA4D', // Same wallet for testing
    privateKey: process.env.NEXT_PUBLIC_TEST_WALLET_2 || '0x75ca73727f2c7c04f321b3e80f76b59f8faa11147798263bcff8f2a60494a953', // Hardcoded fallback for production
    prefundedAmount: 1000
  },
  {
    id: 'tester3',
    assignedEmail: AUTHORIZED_TEST_EMAILS[2],
    name: 'Test User 3',
    address: '0xe83e258a0D8233f5239B6c8ed46CEA2B6426F6f6',
    privateKey: process.env.NEXT_PUBLIC_TEST_WALLET_3,
    prefundedAmount: 1000
  },
  {
    id: 'tester4',
    assignedEmail: AUTHORIZED_TEST_EMAILS[3],
    name: 'Test User 4',
    address: '0x7111b72D9CFecB79d6aeb31F31b513976d28FA49',
    privateKey: process.env.NEXT_PUBLIC_TEST_WALLET_4,
    prefundedAmount: 1000
  },
  {
    id: 'tester5',
    assignedEmail: AUTHORIZED_TEST_EMAILS[4],
    name: 'Test User 5',
    address: '0x8BA55a5AF715bF25dE6f444D8c4a4d22EDb9121A',
    privateKey: process.env.NEXT_PUBLIC_TEST_WALLET_5,
    prefundedAmount: 1000
  },
  {
    id: 'tester6',
    assignedEmail: AUTHORIZED_TEST_EMAILS[5],
    name: 'Test User 6',
    address: '0x4265484008cb46687C6Fdf2A6c62Cab8BEa5af0B',
    privateKey: process.env.NEXT_PUBLIC_TEST_WALLET_6,
    prefundedAmount: 1000
  }
];

// Function to check if an email is authorized for test wallets
export const isAuthorizedTestUser = (email) => {
  if (!email) return false;
  return AUTHORIZED_TEST_EMAILS.includes(email.toLowerCase());
};

// Function to get the test wallet assigned to a specific email
export const getTestWalletForEmail = (email) => {
  if (!email || !isAuthorizedTestUser(email)) {
    return null;
  }
  
  const wallet = TEST_WALLETS.find(w => 
    w.assignedEmail.toLowerCase() === email.toLowerCase()
  );
  
  // Debug logging
  if (wallet) {
    console.log('[testWallets] Found wallet for', email, ':', {
      ...wallet,
      privateKey: wallet.privateKey ? 'EXISTS' : 'MISSING'
    });
    console.log('[testWallets] Env var NEXT_PUBLIC_TEST_WALLET_2:', process.env.NEXT_PUBLIC_TEST_WALLET_2 ? 'EXISTS' : 'MISSING');
  }
  
  return wallet || null;
};

// Function to release a wallet (for cleanup/testing)
export const releaseTestWallet = (userId) => {
  const assignments = JSON.parse(localStorage.getItem('walletAssignments') || '{}');
  delete assignments[userId];
  localStorage.setItem('walletAssignments', JSON.stringify(assignments));
};