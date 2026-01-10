import { createThirdwebClient, getContract, prepareContractCall, readContract } from "thirdweb";
import { defineChain } from "thirdweb/chains";

// Initialize Thirdweb client
const client = createThirdwebClient({
  clientId: process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID || "cbae42251fe95b7e26a19a326b96ce5c",
});

// Define Base Sepolia chain (chainId: 84532)
const chain = defineChain(84532);

// TODO: Replace with your actual staking contract address
const STAKING_CONTRACT_ADDRESS = "0x5cBceA7A9Eb4a5EeF23b3033651fB69545611Ba2"; // Replace this
const REWARDS_SPLITTER_ADDRESS = "0xfEe402E3c7be6b179967C2B5551c2bcFb402B7e3"; // Replace this

// Staking contract instance
export const stakingContract = getContract({
  client,
  chain,
  address: STAKING_CONTRACT_ADDRESS,
});

// Rewards splitter contract instance
export const rewardsSplitterContract = getContract({
  client,
  chain,
  address: REWARDS_SPLITTER_ADDRESS,
});

// Staking contract ABI
const STAKING_ABI = [{"inputs":[{"internalType":"address","name":"_rl80Token","type":"address"},{"internalType":"address","name":"_distributor","type":"address"}],"stateMutability":"nonpayable","type":"constructor"},{"inputs":[],"name":"EnforcedPause","type":"error"},{"inputs":[],"name":"ExpectedPause","type":"error"},{"inputs":[{"internalType":"address","name":"owner","type":"address"}],"name":"OwnableInvalidOwner","type":"error"},{"inputs":[{"internalType":"address","name":"account","type":"address"}],"name":"OwnableUnauthorizedAccount","type":"error"},{"inputs":[],"name":"ReentrancyGuardReentrantCall","type":"error"},{"inputs":[{"internalType":"address","name":"token","type":"address"}],"name":"SafeERC20FailedOperation","type":"error"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"from","type":"address"},{"indexed":false,"internalType":"uint256","name":"amount","type":"uint256"}],"name":"DirectETHReceived","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"distributor","type":"address"},{"indexed":false,"internalType":"bool","name":"restrictDeposits","type":"bool"}],"name":"DistributorUpdated","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"user","type":"address"},{"indexed":false,"internalType":"uint256","name":"amount","type":"uint256"}],"name":"ETHClaimed","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"uint256","name":"newDuration","type":"uint256"}],"name":"LockDurationUpdated","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"uint256","name":"newMin","type":"uint256"}],"name":"MinClaimUpdated","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"uint256","name":"newMinTVL","type":"uint256"}],"name":"MinTVLUpdated","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"previousOwner","type":"address"},{"indexed":true,"internalType":"address","name":"newOwner","type":"address"}],"name":"OwnershipTransferStarted","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"previousOwner","type":"address"},{"indexed":true,"internalType":"address","name":"newOwner","type":"address"}],"name":"OwnershipTransferred","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"address","name":"account","type":"address"}],"name":"Paused","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"uint256","name":"amountDistributed","type":"uint256"}],"name":"QueuedFlushed","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"uint256","name":"newETH","type":"uint256"},{"indexed":false,"internalType":"uint256","name":"distributed","type":"uint256"},{"indexed":false,"internalType":"uint256","name":"queuedAfter","type":"uint256"}],"name":"RewardAdded","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"user","type":"address"},{"indexed":false,"internalType":"uint256","name":"amount","type":"uint256"},{"indexed":false,"internalType":"uint256","name":"unlockAt","type":"uint256"}],"name":"Staked","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"token","type":"address"},{"indexed":true,"internalType":"address","name":"to","type":"address"},{"indexed":false,"internalType":"uint256","name":"amount","type":"uint256"}],"name":"TokensRescued","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"address","name":"account","type":"address"}],"name":"Unpaused","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"user","type":"address"},{"indexed":false,"internalType":"uint256","name":"amount","type":"uint256"}],"name":"Unstaked","type":"event"},{"inputs":[],"name":"PRECISION","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"acceptOwnership","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"","type":"address"}],"name":"accruedETH","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"account","type":"address"}],"name":"canUnstake","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"claim","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"user","type":"address"}],"name":"claimableRewards","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"distributor","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"account","type":"address"}],"name":"earned","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"emergencyUnstakeAll","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"ethPerTokenStored","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"flushQueued","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"user","type":"address"}],"name":"getStakedBalance","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"lockDuration","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"minClaimAmount","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"minTvlToDistribute","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"notifyRewardETH","outputs":[],"stateMutability":"payable","type":"function"},{"inputs":[],"name":"owner","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"pause","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"paused","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"account","type":"address"}],"name":"pendingETH","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"pendingOwner","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"queuedETH","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"renounceOwnership","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"token","type":"address"},{"internalType":"address","name":"to","type":"address"},{"internalType":"uint256","name":"amount","type":"uint256"}],"name":"rescueTokens","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"restrictDeposits","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"rl80Token","outputs":[{"internalType":"contract IERC20","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"_distributor","type":"address"},{"internalType":"bool","name":"_restrictDeposits","type":"bool"}],"name":"setDistributor","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"uint256","name":"_seconds","type":"uint256"}],"name":"setLockDuration","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"uint256","name":"_min","type":"uint256"}],"name":"setMinClaimAmount","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"uint256","name":"_minTVL","type":"uint256"}],"name":"setMinTvlToDistribute","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"uint256","name":"amount","type":"uint256"}],"name":"stake","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"","type":"address"}],"name":"stakedBalance","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"account","type":"address"}],"name":"timeToUnlock","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"totalStaked","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"newOwner","type":"address"}],"name":"transferOwnership","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"","type":"address"}],"name":"unlockTime","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"user","type":"address"}],"name":"unlockTimeRemaining","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"unpause","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"uint256","name":"amount","type":"uint256"}],"name":"unstake","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"unstakeAll","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"","type":"address"}],"name":"userEthPerTokenPaid","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"stateMutability":"payable","type":"receive"}];

// Staking read functions
export const stakingFunctions = {
  // Get user's staked balance
  getStakedBalance: async (address) => {
    try {
      const result = await readContract({
        contract: stakingContract,
        method: "function getStakedBalance(address user) view returns (uint256)",
        params: [address],
      });
      return result;
    } catch (error) {
      console.error("Error getting staked balance:", error);
      return "0";
    }
  },

  // Get user's earned rewards
  getEarnedRewards: async (address) => {
    try {
      const result = await readContract({
        contract: stakingContract,
        method: "function earned(address account) view returns (uint256)",
        params: [address],
      });
      return result;
    } catch (error) {
      console.error("Error getting earned rewards:", error);
      return "0";
    }
  },

  // Get ETH per token stored (for APR calculation)
  getEthPerTokenStored: async () => {
    try {
      const result = await readContract({
        contract: stakingContract,
        method: "function ethPerTokenStored() view returns (uint256)",
        params: [],
      });
      return result;
    } catch (error) {
      console.error("Error getting ETH per token:", error);
      return "0";
    }
  },

  // Get total staked in contract
  getTotalStaked: async () => {
    try {
      const result = await readContract({
        contract: stakingContract,
        method: "function totalStaked() view returns (uint256)",
        params: [],
      });
      return result;
    } catch (error) {
      console.error("Error getting total staked:", error);
      return "0";
    }
  },

  // Get minimum claim amount
  getMinClaimAmount: async () => {
    try {
      const result = await readContract({
        contract: stakingContract,
        method: "function minClaimAmount() view returns (uint256)",
        params: [],
      });
      return result;
    } catch (error) {
      console.error("Error getting minimum claim amount:", error);
      return "0";
    }
  },
  
  // Get RL80 token address
  getRl80TokenAddress: async () => {
    try {
      const result = await readContract({
        contract: stakingContract,
        method: "function rl80Token() view returns (address)",
        params: [],
      });
      return result;
    } catch (error) {
      console.error("Error getting RL80 token address:", error);
      return null;
    }
  },
};

// Staking write functions (prepare transactions)
export const stakingTransactions = {
  // Prepare stake transaction
  prepareStake: (amount) => {
    return prepareContractCall({
      contract: stakingContract,
      method: "function stake(uint256 amount)",
      params: [amount],
    });
  },

  // Prepare unstake transaction
  prepareUnstake: (amount) => {
    return prepareContractCall({
      contract: stakingContract,
      method: "function unstake(uint256 amount)",
      params: [amount],
    });
  },

  // Prepare unstakeAll transaction
  prepareUnstakeAll: () => {
    return prepareContractCall({
      contract: stakingContract,
      method: "function unstakeAll()",
      params: [],
    });
  },

  // Prepare claim rewards transaction
  prepareClaim: () => {
    return prepareContractCall({
      contract: stakingContract,
      method: "function claim()",
      params: [],
    });
  },
};

// Helper function to format staking data
export const formatStakingData = async (userAddress) => {
  try {
    const [stakedBalance, earnedRewards, ethPerToken, totalStaked, minClaimAmount] = await Promise.all([
      stakingFunctions.getStakedBalance(userAddress),
      stakingFunctions.getEarnedRewards(userAddress),
      stakingFunctions.getEthPerTokenStored(),
      stakingFunctions.getTotalStaked(),
      stakingFunctions.getMinClaimAmount(),
    ]);

    // Calculate APR (simplified - you may need to adjust based on actual reward distribution)
    // This assumes ethPerToken accumulates over time
    const apr = ethPerToken && totalStaked ? 
      (Number(ethPerToken) * 365 * 100) / 1e18 : 0;

    return {
      stakedBalance: stakedBalance.toString(),
      earnedRewards: earnedRewards.toString(),
      apr: apr.toFixed(2),
      totalStaked: totalStaked.toString(),
      minClaimAmount: minClaimAmount.toString(),
    };
  } catch (error) {
    console.error("Error formatting staking data:", error);
    return {
      stakedBalance: "0",
      earnedRewards: "0",
      apr: "0",
      totalStaked: "0",
      minClaimAmount: "0",
    };
  }
};

export { client, chain };