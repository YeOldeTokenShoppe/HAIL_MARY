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
const PREDICTION_MARKET_ADDRESS = "0x31Cb381461b7A531FAB4aD03848b31A199f4B921";
const THIRDWEB_CLIENT_ID = process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID || "cbae42251fe95b7e26a19a326b96ce5c";

// Market configuration - EDIT THESE
const MARKET_CONFIG = {
  question: "Most accurate oracle this week?",
  options: ["EMO", "TEKNO", "MACRO"],
  durationDays: 7  // Market runs for 7 days
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
  const chain = defineChain(84532); // Base Sepolia

  // Get account from private key
  const account = privateKeyToAccount({ client, privateKey });
  console.log(`📍 Using wallet: ${account.address}`);

  // Get contract
  const contract = getContract({
    client,
    chain,
    address: PREDICTION_MARKET_ADDRESS,
  });

  // Calculate duration in seconds
  const durationSeconds = MARKET_CONFIG.durationDays * 24 * 60 * 60;

  console.log(`\n📋 Market Details:`);
  console.log(`   Question: ${MARKET_CONFIG.question}`);
  console.log(`   Options: ${MARKET_CONFIG.options.join(", ")}`);
  console.log(`   Duration: ${MARKET_CONFIG.durationDays} days (${durationSeconds} seconds)`);

  try {
    // Prepare the transaction
    const tx = prepareContractCall({
      contract,
      method: "function createMarket(string _question, string[] _options, uint256 _duration) returns (uint256)",
      params: [
        MARKET_CONFIG.question,
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
