import { createThirdwebClient, getContract } from "thirdweb";
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

export { client, chain };