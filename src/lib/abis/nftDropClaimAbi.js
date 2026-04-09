export const nftDropClaimAbi = [
  {
    inputs: [
      { name: '_receiver', type: 'address' },
      { name: '_quantity', type: 'uint256' },
      { name: '_currency', type: 'address' },
      { name: '_pricePerToken', type: 'uint256' },
      {
        name: '_allowlistProof',
        type: 'tuple',
        components: [
          { name: 'proof', type: 'bytes32[]' },
          { name: 'quantityLimitPerWallet', type: 'uint256' },
          { name: 'pricePerToken', type: 'uint256' },
          { name: 'currency', type: 'address' },
        ],
      },
      { name: '_data', type: 'bytes' },
    ],
    name: 'claim',
    outputs: [],
    stateMutability: 'payable',
    type: 'function',
  },
];
