export const predictionMarketAbi = [
  // Read functions
  {
    inputs: [{ name: '_marketId', type: 'uint256' }],
    name: 'getMarketInfo',
    outputs: [
      { name: 'question', type: 'string' },
      { name: 'endTime', type: 'uint256' },
      { name: 'winningOption', type: 'uint8' },
      { name: 'optionCount', type: 'uint8' },
      { name: 'resolved', type: 'bool' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: '_marketId', type: 'uint256' }],
    name: 'getAllOptions',
    outputs: [{ name: 'options', type: 'string[]' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: '_marketId', type: 'uint256' }],
    name: 'getAllOptionShares',
    outputs: [{ name: 'shares', type: 'uint256[]' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { name: '_marketId', type: 'uint256' },
      { name: '_user', type: 'address' },
      { name: '_optionId', type: 'uint8' },
    ],
    name: 'getUserShares',
    outputs: [{ name: 'userShares', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { name: '_marketId', type: 'uint256' },
      { name: '_user', type: 'address' },
    ],
    name: 'getAllUserShares',
    outputs: [{ name: 'shares', type: 'uint256[]' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { name: '_marketId', type: 'uint256' },
      { name: '_user', type: 'address' },
    ],
    name: 'hasUserClaimed',
    outputs: [{ name: 'claimed', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { name: '_marketId', type: 'uint256' },
      { name: '_user', type: 'address' },
      { name: '_assumedWinner', type: 'uint8' },
    ],
    name: 'calculatePotentialWinnings',
    outputs: [{ name: 'potentialWinnings', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'marketCount',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'minimumBet',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  // Write functions
  {
    inputs: [
      { name: '_marketId', type: 'uint256' },
      { name: '_optionId', type: 'uint8' },
      { name: '_amount', type: 'uint256' },
    ],
    name: 'buyShares',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ name: '_marketId', type: 'uint256' }],
    name: 'claimWinnings',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ name: '_marketId', type: 'uint256' }],
    name: 'claimRefund',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  // Admin functions
  {
    inputs: [
      { name: '_question', type: 'string' },
      { name: '_options', type: 'string[]' },
      { name: '_duration', type: 'uint256' },
    ],
    name: 'createMarket',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { name: '_marketId', type: 'uint256' },
      { name: '_winningOption', type: 'uint8' },
    ],
    name: 'resolveMarket',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ name: '_marketId', type: 'uint256' }],
    name: 'cancelMarket',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
];
