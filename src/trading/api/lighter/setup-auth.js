// API route to properly set up Lighter authentication
// Based on the Python SDK setup process

import { Wallet } from 'ethers';
import fs from 'fs';
import path from 'path';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Configuration from environment
    const config = {
      baseUrl: process.env.NEXT_PUBLIC_LIGHTER_BASE_URL || 'https://testnet.zklighter.elliot.ai',
      ethPrivateKey: process.env.LIGHTER_ETH_PRIVATE_KEY,
      apiKeyPrivateKey: process.env.LIGHTER_API_KEY_PRIVATE_KEY,
      apiKeyPublicKey: process.env.LIGHTER_API_KEY_PUBLIC_KEY,
      accountIndex: parseInt(process.env.LIGHTER_ACCOUNT_INDEX || '0'),
      apiKeyIndex: parseInt(process.env.LIGHTER_API_KEY_INDEX || '3')
    };

    console.log('Setting up Lighter auth with config:', {
      baseUrl: config.baseUrl,
      hasEthKey: !!config.ethPrivateKey,
      hasApiKey: !!config.apiKeyPrivateKey,
      accountIndex: config.accountIndex,
      apiKeyIndex: config.apiKeyIndex
    });

    // Step 1: Create wallet from ETH private key
    const ethWallet = new Wallet(config.ethPrivateKey);
    const ethAddress = ethWallet.address;
    console.log('ETH Address:', ethAddress);

    // Step 2: First, let's check if the account exists
    const accountCheckResponse = await fetch(
      `${config.baseUrl}/api/v1/accountsByL1Address?l1Address=${ethAddress}`
    );
    
    if (!accountCheckResponse.ok) {
      throw new Error('Failed to check account existence');
    }
    
    const accountData = await accountCheckResponse.json();
    console.log('Account check response:', JSON.stringify(accountData, null, 2));

    // Step 3: Get the correct account index
    let correctAccountIndex = config.accountIndex;
    if (accountData.sub_accounts && accountData.sub_accounts.length > 0) {
      correctAccountIndex = accountData.sub_accounts[0].index;
      console.log('Using account index from API:', correctAccountIndex);
    }

    // Step 4: Save the configuration
    const apiKeyConfig = {
      baseUrl: config.baseUrl,
      accountIndex: correctAccountIndex,
      apiKeyIndex: config.apiKeyIndex,
      apiKeyPrivateKey: config.apiKeyPrivateKey,
      apiKeyPublicKey: config.apiKeyPublicKey,
      ethAddress: ethAddress,
      timestamp: new Date().toISOString()
    };

    // Save to a config file (similar to Python SDK's api_key_config.json)
    const configPath = path.join(process.cwd(), 'api_key_config.json');
    fs.writeFileSync(configPath, JSON.stringify(apiKeyConfig, null, 2));
    console.log('Config saved to:', configPath);

    // Step 5: Test authentication by fetching account with proper auth
    const testAuthResponse = await testAuthentication(config, correctAccountIndex);

    return res.status(200).json({
      success: true,
      message: 'Lighter authentication setup complete',
      ethAddress,
      accountIndex: correctAccountIndex,
      apiKeyIndex: config.apiKeyIndex,
      testAuth: testAuthResponse
    });

  } catch (error) {
    console.error('Setup error:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

// Test authentication with the API
async function testAuthentication(config, accountIndex) {
  try {
    // Create auth headers using the API key
    const apiKeyWallet = new Wallet(
      config.apiKeyPrivateKey.startsWith('0x') 
        ? config.apiKeyPrivateKey 
        : `0x${config.apiKeyPrivateKey}`
    );
    
    // Create a simple auth token
    const timestamp = Math.floor(Date.now() / 1000);
    const message = `${timestamp}`;
    const signature = await apiKeyWallet.signMessage(message);
    
    // Try to fetch account with auth
    const response = await fetch(
      `${config.baseUrl}/api/v1/account?by=index&value=${accountIndex}`,
      {
        headers: {
          'X-Timestamp': timestamp.toString(),
          'X-Signature': signature,
          'X-API-Key': config.apiKeyPublicKey
        }
      }
    );
    
    if (response.ok) {
      const data = await response.json();
      console.log('Authenticated account data:', JSON.stringify(data, null, 2));
      return { success: true, data };
    } else {
      console.log('Auth test failed:', response.status);
      return { success: false, status: response.status };
    }
  } catch (error) {
    console.error('Auth test error:', error);
    return { success: false, error: error.message };
  }
}