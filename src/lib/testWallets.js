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
  {
    id: 'tester1',
    assignedEmail: AUTHORIZED_TEST_EMAILS[0],
    name: 'Test User 1',
    address: '0x1156EF864262543A4AC1A95D1EB37AC4199a2DbC', // Replace with actual address
    privateKey: process.env.NEXT_PUBLIC_TEST_WALLET_1, // Store in .env.local
    prefundedAmount: 1000
  },
  {
    id: 'tester2',
    assignedEmail: AUTHORIZED_TEST_EMAILS[1],
    name: 'Test User 2',
    address: '0xF8a047db6D5315c3C36cd6FaBC129e28b4C2eDF4', // Replace with actual address
    privateKey: process.env.NEXT_PUBLIC_TEST_WALLET_2, // Store in .env.local
    prefundedAmount: 1000
  },
  // {
  //   id: 'tester3',
  //   assignedEmail: AUTHORIZED_TEST_EMAILS[2],
  //   name: 'Test User 3',
  //   address: '0xEf52603090De93a4E8B22b06641E2B9C7a4240b4', // Replace with actual address
  //   privateKey: process.env.NEXT_PUBLIC_TEST_WALLET_3, // Store in .env.local
  //   prefundedAmount: 1000
  // },
  // {
  //   id: 'tester4',
  //   assignedEmail: AUTHORIZED_TEST_EMAILS[3],
  //   name: 'Test User 4',
  //   address: '0x326C6209fF1df4C42f1EF5B37751cf34bc4208b9', // Replace with actual address
  //   privateKey: process.env.NEXT_PUBLIC_TEST_WALLET_4, // Store in .env.local
  //   prefundedAmount: 1000
  // },
  // {
  //   id: 'tester5',
  //   assignedEmail: AUTHORIZED_TEST_EMAILS[4],
  //   name: 'Test User 5',
  //   address: '0x6a5014974D9d80e589c5F700e4c5FFcf18F45986', // Replace with actual address
  //   privateKey: process.env.NEXT_PUBLIC_TEST_WALLET_5, // Store in .env.local
  //   prefundedAmount: 1000
  // },
  // {
  //   id: 'tester6',
  //   assignedEmail: AUTHORIZED_TEST_EMAILS[5],
  //   name: 'Test User 6',
  //   address: '0x92289816f2c1147E46465892e5122393CeBC0eac', // Replace with actual address
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
  
  return wallet || null;
};

// Function to release a wallet (for cleanup/testing)
export const releaseTestWallet = (userId) => {
  const assignments = JSON.parse(localStorage.getItem('walletAssignments') || '{}');
  delete assignments[userId];
  localStorage.setItem('walletAssignments', JSON.stringify(assignments));
};