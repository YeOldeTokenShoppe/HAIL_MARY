// Test wallets for non-crypto native users
// These wallets should be pre-funded with RL80 tokens on Base Sepolia

// IMPORTANT: Update these email addresses with your actual testers
export const AUTHORIZED_TEST_EMAILS = [
  'your-alternate@example.com', // YOUR TEST EMAIL - Replace this first!
  'tester2@example.com', // Replace with actual tester email
  'tester3@example.com', // Replace with actual tester email
  'tester4@example.com', // Replace with actual tester email
  'tester5@example.com', // Replace with actual tester email
  'tester6@example.com', // Replace with actual tester email
];

export const TEST_WALLETS = [
  {
    id: 'tester1',
    assignedEmail: AUTHORIZED_TEST_EMAILS[0],
    name: 'Test User 1',
    address: '0x1234567890123456789012345678901234567891', // Replace with actual address
    privateKey: process.env.NEXT_PUBLIC_TEST_WALLET_1, // Store in .env.local
    prefundedAmount: 1000
  },
  {
    id: 'tester2',
    assignedEmail: AUTHORIZED_TEST_EMAILS[1],
    name: 'Test User 2',
    address: '0x1234567890123456789012345678901234567892', // Replace with actual address
    privateKey: process.env.NEXT_PUBLIC_TEST_WALLET_2, // Store in .env.local
    prefundedAmount: 1000
  },
  {
    id: 'tester3',
    assignedEmail: AUTHORIZED_TEST_EMAILS[2],
    name: 'Test User 3',
    address: '0x1234567890123456789012345678901234567893', // Replace with actual address
    privateKey: process.env.NEXT_PUBLIC_TEST_WALLET_3, // Store in .env.local
    prefundedAmount: 1000
  },
  {
    id: 'tester4',
    assignedEmail: AUTHORIZED_TEST_EMAILS[3],
    name: 'Test User 4',
    address: '0x1234567890123456789012345678901234567894', // Replace with actual address
    privateKey: process.env.NEXT_PUBLIC_TEST_WALLET_4, // Store in .env.local
    prefundedAmount: 1000
  },
  {
    id: 'tester5',
    assignedEmail: AUTHORIZED_TEST_EMAILS[4],
    name: 'Test User 5',
    address: '0x1234567890123456789012345678901234567895', // Replace with actual address
    privateKey: process.env.NEXT_PUBLIC_TEST_WALLET_5, // Store in .env.local
    prefundedAmount: 1000
  },
  {
    id: 'tester6',
    assignedEmail: AUTHORIZED_TEST_EMAILS[5],
    name: 'Test User 6',
    address: '0x1234567890123456789012345678901234567896', // Replace with actual address
    privateKey: process.env.NEXT_PUBLIC_TEST_WALLET_6, // Store in .env.local
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
  
  return wallet || null;
};

// Function to release a wallet (for cleanup/testing)
export const releaseTestWallet = (userId) => {
  const assignments = JSON.parse(localStorage.getItem('walletAssignments') || '{}');
  delete assignments[userId];
  localStorage.setItem('walletAssignments', JSON.stringify(assignments));
};