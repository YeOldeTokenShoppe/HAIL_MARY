// Script to set up Lighter API key
// Based on the Lighter documentation example

import { Wallet } from 'ethers';
import crypto from 'crypto';

// Function to create API key pair
export function createApiKey(seed) {
  try {
    // If seed is provided, use it for deterministic key generation
    // Otherwise generate random entropy
    const entropy = seed 
      ? crypto.createHash('sha256').update(seed).digest()
      : crypto.randomBytes(32);
    
    // Create wallet from entropy
    const wallet = new Wallet(entropy.toString('hex'));
    
    return {
      privateKey: wallet.privateKey,
      publicKey: wallet.address,
      error: null
    };
  } catch (error) {
    return {
      privateKey: null,
      publicKey: null,
      error: error.message
    };
  }
}

// Function to change API key on Lighter
export async function changeApiKey(lighterClient, ethPrivateKey, newPublicKey) {
  try {
    // Create signer from ETH private key
    const ethWallet = new Wallet(ethPrivateKey);
    
    // Prepare the change API key transaction
    const timestamp = Date.now();
    const message = {
      action: 'change_api_key',
      new_pubkey: newPublicKey,
      account_index: lighterClient.accountIndex,
      api_key_index: lighterClient.apiKeyIndex,
      timestamp,
      nonce: await lighterClient.getNextNonce()
    };
    
    // Sign with ETH private key
    const signature = await ethWallet.signMessage(JSON.stringify(message));
    
    // Send transaction to Lighter
    const response = await fetch(`${lighterClient.baseUrl}/api/v1/account/change_api_key`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...message,
        signature,
        eth_address: ethWallet.address
      })
    });
    
    // Get response text first to debug
    const responseText = await response.text();
    console.log('Change API key response status:', response.status);
    console.log('Change API key response:', responseText);
    
    if (!response.ok) {
      let error;
      try {
        error = JSON.parse(responseText);
      } catch (e) {
        error = { message: responseText || 'Failed to change API key' };
      }
      throw new Error(error.message || 'Failed to change API key');
    }
    
    try {
      return JSON.parse(responseText);
    } catch (e) {
      // If response is empty or not JSON, return success indicator
      return { success: true, message: responseText };
    }
  } catch (error) {
    console.error('Error changing API key:', error);
    throw error;
  }
}

// Function to verify account exists
export async function verifyAccount(baseUrl, ethAddress) {
  try {
    const response = await fetch(`${baseUrl}/api/v1/account/by_address/${ethAddress}`);
    
    // Get response text first to debug
    const responseText = await response.text();
    console.log('Response status:', response.status);
    console.log('Response text:', responseText);
    
    if (!response.ok) {
      // Try to parse as JSON, but handle if it's not
      let error;
      try {
        error = JSON.parse(responseText);
      } catch (e) {
        console.error('Failed to parse error response:', responseText);
        error = { message: responseText || 'Failed to verify account' };
      }
      
      if (error.message === 'account not found' || responseText.includes('not found')) {
        return {
          exists: false,
          accounts: []
        };
      }
      throw new Error(error.message || 'Failed to verify account');
    }
    
    // Try to parse successful response
    let data;
    try {
      data = JSON.parse(responseText);
    } catch (e) {
      console.error('Failed to parse success response:', responseText);
      throw new Error('Invalid response format from Lighter API');
    }
    
    return {
      exists: true,
      accounts: data.sub_accounts || []
    };
  } catch (error) {
    console.error('Error verifying account:', error);
    throw error;
  }
}

// Main setup function
export async function setupLighterApiKey(config) {
  const {
    baseUrl = 'https://testnet.zklighter.elliot.ai',
    ethPrivateKey,
    apiKeyIndex = 3,
    seed = null
  } = config;
  
  if (!ethPrivateKey) {
    throw new Error('ETH private key is required');
  }
  
  try {
    // 1. Verify account exists
    const ethWallet = new Wallet(ethPrivateKey);
    const ethAddress = ethWallet.address;
    
    console.log(`Verifying account for address: ${ethAddress}`);
    const accountData = await verifyAccount(baseUrl, ethAddress);
    
    if (!accountData.exists) {
      throw new Error(`Account not found for address ${ethAddress}. Please create an account on Lighter first.`);
    }
    
    console.log(`Found ${accountData.accounts.length} account(s)`);
    const accountIndex = accountData.accounts[0].index;
    
    // 2. Create new API key pair
    console.log('Creating new API key pair...');
    const { privateKey, publicKey, error } = createApiKey(seed);
    
    if (error) {
      throw new Error(`Failed to create API key: ${error}`);
    }
    
    console.log(`New API key public address: ${publicKey}`);
    
    // 3. Initialize client with temporary config
    const tempClient = {
      baseUrl,
      accountIndex,
      apiKeyIndex,
      getNextNonce: async () => 0 // For initial setup
    };
    
    // 4. Change API key on Lighter
    console.log('Updating API key on Lighter...');
    const result = await changeApiKey(tempClient, ethPrivateKey, publicKey);
    
    console.log('API key successfully updated!');
    
    // 5. Return configuration
    return {
      success: true,
      config: {
        LIGHTER_BASE_URL: baseUrl,
        LIGHTER_API_KEY_PRIVATE_KEY: privateKey,
        LIGHTER_ETH_PRIVATE_KEY: ethPrivateKey,
        LIGHTER_ACCOUNT_INDEX: accountIndex,
        LIGHTER_API_KEY_INDEX: apiKeyIndex
      },
      message: 'API key setup complete. Save the configuration to your .env.local file.'
    };
    
  } catch (error) {
    return {
      success: false,
      error: error.message,
      message: 'Failed to setup API key'
    };
  }
}

// Helper function to save config to file (for Node.js environments)
export function saveApiKeyConfig(config) {
  const envContent = `
# Lighter.xyz API Configuration
# Generated on ${new Date().toISOString()}

NEXT_PUBLIC_LIGHTER_BASE_URL=${config.LIGHTER_BASE_URL}
LIGHTER_API_KEY_PRIVATE_KEY=${config.LIGHTER_API_KEY_PRIVATE_KEY}
LIGHTER_ETH_PRIVATE_KEY=${config.LIGHTER_ETH_PRIVATE_KEY}
LIGHTER_ACCOUNT_INDEX=${config.LIGHTER_ACCOUNT_INDEX}
LIGHTER_API_KEY_INDEX=${config.LIGHTER_API_KEY_INDEX}
`;
  
  console.log('\n=== Configuration to save in .env.local ===');
  console.log(envContent);
  console.log('===========================================\n');
  
  return envContent;
}