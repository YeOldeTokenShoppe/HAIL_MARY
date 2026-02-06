import { getContract, prepareContractCall, readContract } from "thirdweb";
import { client, chain } from "./contract";

// Staking contract addresses on Base Sepolia
const STAKING_CONTRACT_ADDRESS = "0x224b5ca6fcd4c2f681eb021ce35406ede992357b";
const REWARDS_SPLITTER_ADDRESS = "0x8dbe7c20ba5f49703c69308e730028d209abeb87";

const STAKING_ABI =[{"inputs":[{"internalType":"address","name":"_rl80Token","type":"address"}],"stateMutability":"nonpayable","type":"constructor"},{"inputs":[],"name":"EnforcedPause","type":"error"},{"inputs":[],"name":"ExpectedPause","type":"error"},{"inputs":[{"internalType":"address","name":"owner","type":"address"}],"name":"OwnableInvalidOwner","type":"error"},{"inputs":[{"internalType":"address","name":"account","type":"address"}],"name":"OwnableUnauthorizedAccount","type":"error"},{"inputs":[],"name":"ReentrancyGuardReentrantCall","type":"error"},{"inputs":[{"internalType":"address","name":"token","type":"address"}],"name":"SafeERC20FailedOperation","type":"error"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"previousOwner","type":"address"},{"indexed":true,"internalType":"address","name":"newOwner","type":"address"}],"name":"OwnershipTransferred","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"address","name":"account","type":"address"}],"name":"Paused","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"user","type":"address"},{"indexed":false,"internalType":"uint256","name":"amount","type":"uint256"}],"name":"RewardsClaimed","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"distributor","type":"address"},{"indexed":false,"internalType":"uint256","name":"amount","type":"uint256"}],"name":"RewardsDistributed","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"user","type":"address"},{"indexed":false,"internalType":"uint256","name":"amount","type":"uint256"},{"indexed":false,"internalType":"uint256","name":"unlockAt","type":"uint256"}],"name":"Staked","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"address","name":"account","type":"address"}],"name":"Unpaused","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"user","type":"address"},{"indexed":false,"internalType":"uint256","name":"amount","type":"uint256"}],"name":"Withdrawn","type":"event"},{"inputs":[{"internalType":"address","name":"","type":"address"}],"name":"balances","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"claimRewards","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"uint256","name":"amount","type":"uint256"}],"name":"distributeRewards","outputs":[],"stateMutability":"payable","type":"function"},{"inputs":[{"internalType":"address","name":"account","type":"address"}],"name":"earned","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"emergencyWithdraw","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"exit","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"account","type":"address"}],"name":"getUnlockStatus","outputs":[{"internalType":"uint256","name":"timeLeft","type":"uint256"},{"internalType":"string","name":"readable","type":"string"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"lockDuration","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"owner","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"pause","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"paused","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"renounceOwnership","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"to","type":"address"},{"internalType":"uint256","name":"amount","type":"uint256"}],"name":"rescueETH","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"token","type":"address"},{"internalType":"address","name":"to","type":"address"},{"internalType":"uint256","name":"amount","type":"uint256"}],"name":"rescueTokens","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"rewardPerTokenStored","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"","type":"address"}],"name":"rewards","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"rl80Token","outputs":[{"internalType":"contract IERC20","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"_lockDuration","type":"uint256"}],"name":"setLockDuration","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"uint256","name":"_seconds","type":"uint256"}],"name":"setTestnetLockDuration","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"tester","type":"address"}],"name":"skipLockForTester","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"uint256","name":"amount","type":"uint256"}],"name":"stake","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"account","type":"address"}],"name":"stakedOf","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"totalStaked","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"newOwner","type":"address"}],"name":"transferOwnership","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"","type":"address"}],"name":"unlockTime","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"unpause","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"","type":"address"}],"name":"userRewardPerTokenPaid","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"amount","type":"uint256"}],"name":"withdraw","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"withdrawAll","outputs":[],"stateMutability":"nonpayable","type":"function"},{"stateMutability":"payable","type":"receive"}]
// Staking contract instance with explicit ABI
export const stakingContract = getContract({
  client,
  chain,
  address: STAKING_CONTRACT_ADDRESS,
  abi: STAKING_ABI, // Explicitly provide the ABI
});

// Rewards splitter contract instance
export const rewardsSplitterContract = getContract({
  client,
  chain,
  address: REWARDS_SPLITTER_ADDRESS,
});

// Staking contract ABI
// Staking read functions
export const stakingFunctions = {
  // Get user's staked balance - using 'balances' from the ABI
  getStakedBalance: async (address) => {
    try {
      const result = await readContract({
        contract: stakingContract,
        method: "function balances(address) view returns (uint256)",
        params: [address],
      });
      return result;
    } catch (error) {
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

  // Get reward per token stored (for APR calculation) - using 'rewardPerTokenStored' from ABI
  getRewardPerTokenStored: async () => {
    try {
      const result = await readContract({
        contract: stakingContract,
        method: "function rewardPerTokenStored() view returns (uint256)",
        params: [],
      });
      return result;
    } catch (error) {
      console.error("Error getting reward per token:", error);
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

  // Get lock duration
  getLockDuration: async () => {
    try {
      const result = await readContract({
        contract: stakingContract,
        method: "function lockDuration() view returns (uint256)",
        params: [],
      });
      return result;
    } catch (error) {
      console.error("Error getting lock duration:", error);
      return "604800"; // Default to 7 days
    }
  },
  
  // Get unlock time for user
  getUnlockTime: async (address) => {
    try {
      const result = await readContract({
        contract: stakingContract,
        method: "function unlockTime(address) view returns (uint256)",
        params: [address],
      });
      return result;
    } catch (error) {
      console.error("Error getting unlock time:", error);
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

  // Prepare withdraw transaction (testnet uses 'withdraw' not 'unstake')
  prepareWithdraw: (amount) => {
    return prepareContractCall({
      contract: stakingContract,
      method: "function withdraw(uint256 amount)",
      params: [amount],
    });
  },

  // Prepare withdrawAll transaction
  prepareWithdrawAll: () => {
    return prepareContractCall({
      contract: stakingContract,
      method: "function withdrawAll()",
      params: [],
    });
  },

  // Prepare claim rewards transaction
  prepareClaimRewards: () => {
    return prepareContractCall({
      contract: stakingContract,
      method: "function claimRewards()",
      params: [],
    });
  },
};

// Helper function to format staking data
export const formatStakingData = async (userAddress) => {
  try {
    
    const [stakedBalance, earnedRewards, rewardPerToken, totalStaked, lockDuration, unlockTime] = await Promise.all([
      stakingFunctions.getStakedBalance(userAddress),
      stakingFunctions.getEarnedRewards(userAddress),
      stakingFunctions.getRewardPerTokenStored(),
      stakingFunctions.getTotalStaked(),
      stakingFunctions.getLockDuration(),
      stakingFunctions.getUnlockTime(userAddress),
    ]);


    // Calculate if user can withdraw
    const canWithdraw = Number(unlockTime) <= Math.floor(Date.now() / 1000);
    const timeUntilUnlock = canWithdraw ? 0 : Number(unlockTime) - Math.floor(Date.now() / 1000);

    const formattedData = {
      stakedBalance: stakedBalance.toString(),
      earnedRewards: earnedRewards.toString(),
      rewardPerToken: rewardPerToken.toString(),
      totalStaked: totalStaked.toString(),
      lockDuration: lockDuration.toString(),
      unlockTime: unlockTime.toString(),
      canWithdraw,
      timeUntilUnlock,
    };
    
    return formattedData;
  } catch (error) {
    console.error("Error formatting staking data:", error);
    return {
      stakedBalance: "0",
      earnedRewards: "0",
      rewardPerToken: "0",
      totalStaked: "0",
      lockDuration: "604800",
      unlockTime: "0",
      canWithdraw: false,
      timeUntilUnlock: 0,
    };
  }
};

export { client, chain };