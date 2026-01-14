import { privateKeyToAccount, randomPrivateKey } from "thirdweb/wallets";

async function main() {
  // Generate a new private key
  const privateKey = randomPrivateKey();
  
  // Get the account/address from the private key
  const account = privateKeyToAccount({ 
    privateKey,
    client: {} // Client not needed for just getting address
  });
  
  console.log("New Wallet Generated:");
  console.log("====================");
  console.log("Address:", account.address);
  console.log("Private Key:", privateKey);
  console.log("\n⚠️  IMPORTANT: Save this private key securely!");
  console.log("Add it to your .env.local file as NEXT_PUBLIC_TEST_WALLET_X");
}

main().catch(console.error);
