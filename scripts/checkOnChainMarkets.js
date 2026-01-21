/**
 * Script to check what markets exist on the prediction market contract
 *
 * Usage: node scripts/checkOnChainMarkets.js
 */

import 'dotenv/config';
import { createThirdwebClient, getContract, readContract } from "thirdweb";
import { defineChain } from "thirdweb/chains";

// Configuration
const PREDICTION_MARKET_ADDRESS = "0x3e34244D9F9c6CD1Ad970Cf02247d74e5451818c";
const THIRDWEB_CLIENT_ID = process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID || "cbae42251fe95b7e26a19a326b96ce5c";

async function checkMarkets() {
  console.log("🔍 Checking on-chain prediction markets...\n");
  console.log(`Contract: ${PREDICTION_MARKET_ADDRESS}\n`);

  const client = createThirdwebClient({ clientId: THIRDWEB_CLIENT_ID });
  const chain = defineChain(84532); // Base Sepolia

  const contract = getContract({
    client,
    chain,
    address: PREDICTION_MARKET_ADDRESS,
  });

  try {
    // Get market count
    const marketCount = await readContract({
      contract,
      method: "function marketCount() view returns (uint256)",
      params: [],
    });

    console.log(`📊 Total markets on contract: ${marketCount}\n`);

    if (Number(marketCount) === 0) {
      console.log("No markets exist on this contract yet.");
      console.log("Run 'npm run create-market' to create the first market.");
      return;
    }

    // Check each market
    for (let i = 0; i < Number(marketCount); i++) {
      console.log(`\n--- Market ID: ${i} ---`);

      // Get market info
      const marketInfo = await readContract({
        contract,
        method: "function getMarketInfo(uint256 _marketId) view returns (string question, uint256 endTime, uint8 winningOption, uint8 optionCount, bool resolved)",
        params: [BigInt(i)],
      });

      // Get all options
      const options = await readContract({
        contract,
        method: "function getAllOptions(uint256 _marketId) view returns (string[] options)",
        params: [BigInt(i)],
      });

      const [question, endTime, winningOption, optionCount, resolved] = marketInfo;
      const endDate = new Date(Number(endTime) * 1000);

      console.log(`Question: ${question}`);
      console.log(`Options: ${options.join(", ")}`);
      console.log(`End Time: ${endDate.toLocaleString()}`);
      console.log(`Resolved: ${resolved}`);
      if (resolved) {
        console.log(`Winning Option: ${winningOption}`);
      }
    }

    console.log("\n\n💡 To fix the mismatch:");
    console.log("   Update your Firebase 'predictionMarkets' document to use the correct onChainMarketId");
    console.log("   that matches the EMO/TEKNO/MACRO market shown above.");

  } catch (error) {
    console.error("❌ Error:", error.message);
  }
}

checkMarkets();
