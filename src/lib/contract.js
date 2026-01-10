import { createThirdwebClient, getContract } from "thirdweb";
import { defineChain } from "thirdweb/chains";
import { balanceOf, transfer, approve, allowance, totalSupply, decimals } from "thirdweb/extensions/erc20";
import { name, symbol } from "thirdweb/extensions/common";

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
  address: "0x71e90d43a3f00b02d140D5c714422E8Eb78459FA",
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
  
  // Write functions (returns transaction object)
  transfer: async (to, amount) => {
    return transfer({ contract: erc20Contract, to, amount });
  },
  
  approve: (spender, amount) => {
    return approve({ contract: erc20Contract, spender, amount });
  },
  
  // Prepare approve transaction (for TransactionButton)
  prepareApprove: (spender, amount) => {
    return approve({ contract: erc20Contract, spender, amount });
  },
};

export { client, chain };