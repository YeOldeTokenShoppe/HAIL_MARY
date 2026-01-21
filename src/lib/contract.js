import { createThirdwebClient, getContract, prepareContractCall, readContract } from "thirdweb";
import { defineChain } from "thirdweb/chains";
import { balanceOf, transfer, approve, allowance, totalSupply, decimals } from "thirdweb/extensions/erc20";
import { name, symbol } from "thirdweb/extensions/common";

// Charity wallet addresses for fountain donations
export const CHARITY_WALLETS = {
  ST_JUDES: {
    address: "0xbAC39697250cDF6A808Bd39D2D1828388DF87967",
    name: "St. Jude Children's Research Hospital",
    shortName: "St. Jude's",
    givingBlockUrl: "https://thegivingblock.com/donate/st-judes-childrens-research-hospital/",
    description: "Finding cures. Saving children.",
    icon: "🏥"
  },
  ASPCA: {
    address: "0xF9EAdD659e730BbC05f4BFfe618A98fB0b910fDD",
    name: "American Society for the Prevention of Cruelty to Animals",
    shortName: "ASPCA",
    givingBlockUrl: "https://thegivingblock.com/donate/the-american-society-for-the-prevention-of-cruelty-to-animals/",
    description: "We are their voice.",
    icon: "🐾"
  }
};

// Initialize Thirdweb client
const client = createThirdwebClient({
  clientId: process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID || "cbae42251fe95b7e26a19a326b96ce5c",
});

// Define Base Sepolia chain (chainId: 84532)
const chain = defineChain(84532);

// ERC-20 contract instance
export const erc20Contract = getContract({
  client,
  chain,
  address: "0x3841c83409714e0ba0ea33444a0d4354da19a084",
});

// Export commonly used functions
export const tokenFunctions = {
  // Read functions
  getBalance: async (address) => {
    const result = await balanceOf({ contract: erc20Contract, address });
    return result;
  },
  
  getTotalSupply: async () => {
    const result = await totalSupply({ contract: erc20Contract });
    return result;
  },
  
  getDecimals: async () => {
    const result = await decimals({ contract: erc20Contract });
    return result;
  },
  
  getName: async () => {
    const result = await name({ contract: erc20Contract });
    return result;
  },
  
  getSymbol: async () => {
    const result = await symbol({ contract: erc20Contract });
    return result;
  },
  
  getAllowance: async (owner, spender) => {
    const result = await allowance({ contract: erc20Contract, owner, spender });
    return result;
  },
  
  // Write functions (returns prepared transaction object)
  // Use amountWei to pass raw wei amount (already multiplied by decimals)
  transfer: (to, amountWei) => {
    return transfer({ contract: erc20Contract, to, amountWei });
  },
  
  approve: (spender, amount) => {
    return approve({ contract: erc20Contract, spender, amount });
  },
  
  // Prepare approve transaction (for TransactionButton)
  prepareApprove: (spender, amount) => {
    return approve({ contract: erc20Contract, spender, amount });
  },
  
  // Burn tokens by sending to dead address
  burnTokens: (amount) => {
    // Send to the burn address (0x000...dead)
    const BURN_ADDRESS = "0x000000000000000000000000000000000000dEaD";
    return transfer({ contract: erc20Contract, to: BURN_ADDRESS, amount });
  },
};

// ============================================================================
// PREDICTION MARKET CONTRACT
// ============================================================================

export const PREDICTION_MARKET_ADDRESS = "0x3e34244D9F9c6CD1Ad970Cf02247d74e5451818c";

// Prediction Market contract instance
export const predictionMarketContract = getContract({
  client,
  chain,
  address: PREDICTION_MARKET_ADDRESS,
});

// Prediction Market functions
export const predictionMarketFunctions = {
  // ===== READ FUNCTIONS =====

  getMarketInfo: async (marketId) => {
    return readContract({
      contract: predictionMarketContract,
      method: "function getMarketInfo(uint256 _marketId) view returns (string question, uint256 endTime, uint8 winningOption, uint8 optionCount, bool resolved)",
      params: [BigInt(marketId)],
    });
  },

  getAllOptions: async (marketId) => {
    return readContract({
      contract: predictionMarketContract,
      method: "function getAllOptions(uint256 _marketId) view returns (string[] options)",
      params: [BigInt(marketId)],
    });
  },

  getAllOptionShares: async (marketId) => {
    return readContract({
      contract: predictionMarketContract,
      method: "function getAllOptionShares(uint256 _marketId) view returns (uint256[] shares)",
      params: [BigInt(marketId)],
    });
  },

  getUserShares: async (marketId, userAddress, optionId) => {
    return readContract({
      contract: predictionMarketContract,
      method: "function getUserShares(uint256 _marketId, address _user, uint8 _optionId) view returns (uint256 userShares)",
      params: [BigInt(marketId), userAddress, optionId],
    });
  },

  getAllUserShares: async (marketId, userAddress) => {
    return readContract({
      contract: predictionMarketContract,
      method: "function getAllUserShares(uint256 _marketId, address _user) view returns (uint256[] shares)",
      params: [BigInt(marketId), userAddress],
    });
  },

  hasUserClaimed: async (marketId, userAddress) => {
    return readContract({
      contract: predictionMarketContract,
      method: "function hasUserClaimed(uint256 _marketId, address _user) view returns (bool claimed)",
      params: [BigInt(marketId), userAddress],
    });
  },

  calculatePotentialWinnings: async (marketId, userAddress, assumedWinner) => {
    return readContract({
      contract: predictionMarketContract,
      method: "function calculatePotentialWinnings(uint256 _marketId, address _user, uint8 _assumedWinner) view returns (uint256 potentialWinnings)",
      params: [BigInt(marketId), userAddress, assumedWinner],
    });
  },

  getMarketCount: async () => {
    return readContract({
      contract: predictionMarketContract,
      method: "function marketCount() view returns (uint256)",
      params: [],
    });
  },

  getMinimumBet: async () => {
    return readContract({
      contract: predictionMarketContract,
      method: "function minimumBet() view returns (uint256)",
      params: [],
    });
  },

  // ===== WRITE FUNCTIONS (return prepared transaction) =====

  buyShares: (marketId, optionId, amount) => {
    return prepareContractCall({
      contract: predictionMarketContract,
      method: "function buyShares(uint256 _marketId, uint8 _optionId, uint256 _amount)",
      params: [BigInt(marketId), optionId, BigInt(amount)],
    });
  },

  claimWinnings: (marketId) => {
    return prepareContractCall({
      contract: predictionMarketContract,
      method: "function claimWinnings(uint256 _marketId)",
      params: [BigInt(marketId)],
    });
  },

  claimRefund: (marketId) => {
    return prepareContractCall({
      contract: predictionMarketContract,
      method: "function claimRefund(uint256 _marketId)",
      params: [BigInt(marketId)],
    });
  },

  // ===== ADMIN FUNCTIONS (onlyOwner) =====

  createMarket: (question, options, durationSeconds) => {
    return prepareContractCall({
      contract: predictionMarketContract,
      method: "function createMarket(string _question, string[] _options, uint256 _duration) returns (uint256)",
      params: [question, options, BigInt(durationSeconds)],
    });
  },

  resolveMarket: (marketId, winningOption) => {
    return prepareContractCall({
      contract: predictionMarketContract,
      method: "function resolveMarket(uint256 _marketId, uint8 _winningOption)",
      params: [BigInt(marketId), winningOption],
    });
  },

  cancelMarket: (marketId) => {
    return prepareContractCall({
      contract: predictionMarketContract,
      method: "function cancelMarket(uint256 _marketId)",
      params: [BigInt(marketId)],
    });
  },
};

// Helper: Approve RL80 tokens for prediction market betting
export const approveForPredictionMarket = (amount) => {
  return approve({
    contract: erc20Contract,
    spender: PREDICTION_MARKET_ADDRESS,
    amount: BigInt(amount),
  });
};

// Helper: Check RL80 allowance for prediction market
export const getPredictionMarketAllowance = async (ownerAddress) => {
  return allowance({
    contract: erc20Contract,
    owner: ownerAddress,
    spender: PREDICTION_MARKET_ADDRESS,
  });
};

export { client, chain };