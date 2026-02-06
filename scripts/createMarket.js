/**
 * Script to create a prediction market on-chain
 *
 * Usage:
 *   1. Add OWNER_PRIVATE_KEY to your .env file
 *   2. Run: npm run create-market
 */

import 'dotenv/config';
import { createThirdwebClient, getContract, prepareContractCall, sendTransaction } from "thirdweb";
import { privateKeyToAccount } from "thirdweb/wallets";
import { defineChain } from "thirdweb/chains";

// Configuration
const PREDICTION_MARKET_ADDRESS = "0x3e34244D9F9c6CD1Ad970Cf02247d74e5451818c";
const THIRDWEB_CLIENT_ID = process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID || "cbae42251fe95b7e26a19a326b96ce5c";

// Market configuration
const MARKET_CONFIG = {
  options: ["EMO", "TEKNO", "MACRO"],
  // Duration: ends Sunday 23:59:59 of current week
  getEndDate: () => {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const daysUntilSunday = dayOfWeek === 0 ? 0 : 7 - dayOfWeek;
    const sunday = new Date(now);
    sunday.setDate(now.getDate() + daysUntilSunday);
    sunday.setHours(23, 59, 59, 999);
    return sunday;
  },
  getQuestion: (endDate) => {
    const endDateStr = endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    return `Most accurate oracle for week ending ${endDateStr}?`;
  }
};

async function createMarket() {
  // Check for private key
  const privateKey = process.env.OWNER_PRIVATE_KEY;
  if (!privateKey) {
    console.error("❌ Missing OWNER_PRIVATE_KEY in environment variables");
    console.log("\nSet it with:");
    console.log("  export OWNER_PRIVATE_KEY=your_private_key_here");
    process.exit(1);
  }

  console.log("🚀 Creating prediction market...\n");

  // Initialize client
  const client = createThirdwebClient({ clientId: THIRDWEB_CLIENT_ID });
  const chain = defineChain(8453); // Base

  // Get account from private key
  const account = privateKeyToAccount({ client, privateKey });
  console.log(`📍 Using wallet: ${account.address}`);

  // Get contract
  const contract = getContract({
    client,
    chain,
    address: PREDICTION_MARKET_ADDRESS,
  });

  // Calculate end date and duration
  const endDate = MARKET_CONFIG.getEndDate();
  const question = MARKET_CONFIG.getQuestion(endDate);
  const durationSeconds = Math.floor((endDate - new Date()) / 1000);

  console.log(`\n📋 Market Details:`);
  console.log(`   Question: ${question}`);
  console.log(`   Options: ${MARKET_CONFIG.options.join(", ")}`);
  console.log(`   Ends: ${endDate.toLocaleString()}`);
  console.log(`   Duration: ${Math.round(durationSeconds / 3600)} hours (${durationSeconds} seconds)`);

  try {
    // Prepare the transaction
    const tx = prepareContractCall({
      contract,
      method: "function createMarket(string _question, string[] _options, uint256 _duration) returns (uint256)",
      params: [
        question,
        MARKET_CONFIG.options,
        BigInt(durationSeconds)
      ],
    });

    console.log("\n⏳ Sending transaction...");

    // Send the transaction
    const result = await sendTransaction({
      transaction: tx,
      account,
    });

    console.log(`\n✅ Market created successfully!`);
    console.log(`   Transaction hash: ${result.transactionHash}`);
    console.log(`\n📌 The market ID is 0 (first market)`);
    console.log(`   Add onChainId: 0 to your Firebase market document`);

  } catch (error) {
    console.error("\n❌ Error creating market:", error.message);

    if (error.message.includes("caller is not the owner")) {
      console.log("\n⚠️  Your wallet is not the contract owner.");
      console.log("   Make sure you're using the same wallet that deployed the contract.");
    }
  }
}

createMarket();
