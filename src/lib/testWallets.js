// Test wallets for non-crypto native users
// These wallets should be pre-funded with RL80 tokens on Base Sepolia

// IMPORTANT: Update these email addresses with your actual testers
export const AUTHORIZED_TEST_EMAILS = [
  'mpaulsonx@gmail.com', // YOUR TEST EMAIL - Replace this first!
  '503crj@gmail.com', // Replace with actual tester email
  'tester3@example.com', // Replace with actual tester email
  'tester4@example.com', // Replace with actual tester email
  'tester5@example.com', // Replace with actual tester email
  'tester6@example.com', // Replace with actual tester email
];

export const TEST_WALLETS = [
  // Commented out old wallet - using the new pregenerated one instead
  {
    id: 'tester1',
    assignedEmail: AUTHORIZED_TEST_EMAILS[0],
    name: 'Test User 1',
    address: '0x7E49a282E315F20964f3A6b79CA840161BBa3F77', // Replace with actual address
    privateKey: process.env.NEXT_PUBLIC_TEST_WALLET_1, // Store in .env.local
    prefundedAmount: 1000
  },
  {
    id: 'tester1',
    assignedEmail: AUTHORIZED_TEST_EMAILS[1], // 503crj@gmail.com
    name: 'Test User 1',
    address: '0xf4bb7642F20615d097a61710E479544fEA8BdA4D', // Your new pregenerated wallet
    privateKey: process.env.NEXT_PUBLIC_TEST_WALLET_2, // Store in .env.local
    prefundedAmount: 1000
  },
  // {
  //   id: 'tester3',
  //   assignedEmail: AUTHORIZED_TEST_EMAILS[2],
  //   name: 'Test User 3',
  //   address: '0xc1089C2FE7A0B399562eC55655BBD13C3FD1F35f', // Replace with actual address
  //   privateKey: process.env.NEXT_PUBLIC_TEST_WALLET_3, // Store in .env.local
  //   prefundedAmount: 1000
  // },
  // {
  //   id: 'tester4',
  //   assignedEmail: AUTHORIZED_TEST_EMAILS[3],
  //   name: 'Test User 4',
  //   address: '0x71c4FCf5fdC7987Afc851D3d713Cf4B6Fe0b02Be', // Replace with actual address
  //   privateKey: process.env.NEXT_PUBLIC_TEST_WALLET_4, // Store in .env.local
  //   prefundedAmount: 1000
  // },
  // {
  //   id: 'tester5',
  //   assignedEmail: AUTHORIZED_TEST_EMAILS[4],
  //   name: 'Test User 5',
  //   address: '0xA79957279fAC216B87B120C719E9f90454B050B5', // Replace with actual address
  //   privateKey: process.env.NEXT_PUBLIC_TEST_WALLET_5, // Store in .env.local
  //   prefundedAmount: 1000
  // },
  // {
  //   id: 'tester6',
  //   assignedEmail: AUTHORIZED_TEST_EMAILS[5],
  //   name: 'Test User 6',
  //   address: '0xc07A03Fb19f6912E0aE16b1d286F527e0819dcB3', // Replace with actual address
  //   privateKey: process.env.NEXT_PUBLIC_TEST_WALLET_6, // Store in .env.local
  //   prefundedAmount: 1000
  // }
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