// Authenticated Lighter API Client
import { Wallet } from 'ethers';

class AuthenticatedLighterClient {
  constructor(config = {}) {
    this.baseUrl = config.baseUrl || process.env.NEXT_PUBLIC_LIGHTER_BASE_URL || 'https://testnet.zklighter.elliot.ai';
    this.apiKeyPrivateKey = config.apiKeyPrivateKey || process.env.LIGHTER_API_KEY_PRIVATE_KEY;
    this.accountIndex = config.accountIndex || parseInt(process.env.LIGHTER_ACCOUNT_INDEX || '0');
    this.apiKeyIndex = config.apiKeyIndex || parseInt(process.env.LIGHTER_API_KEY_INDEX || '3');
    this.authToken = null;
  }

  // Create auth token for API requests
  async createAuthToken() {
    if (!this.apiKeyPrivateKey) {
      throw new Error('API key private key not configured');
    }

    // Ensure private key has 0x prefix
    const privateKey = this.apiKeyPrivateKey.startsWith('0x') 
      ? this.apiKeyPrivateKey 
      : `0x${this.apiKeyPrivateKey}`;
    
    const wallet = new Wallet(privateKey);
    
    // Create auth message according to Lighter docs
    const timestamp = Math.floor(Date.now() / 1000);
    const expiry = timestamp + 3600; // 1 hour expiry
    
    // The message format Lighter expects
    const message = {
      timestamp,
      expiry,
      account_index: this.accountIndex,
      api_key_index: this.apiKeyIndex
    };
    
    // Sign the message
    const messageString = JSON.stringify(message);
    const signature = await wallet.signMessage(messageString);
    
    this.authToken = {
      message: messageString,
      signature,
      public_key: wallet.address
    };
    
    return this.authToken;
  }

  // Get headers with authentication
  async getAuthHeaders() {
    if (!this.authToken) {
      await this.createAuthToken();
    }
    
    return {
      'Content-Type': 'application/json',
      'X-Auth-Token': this.authToken.signature,
      'X-Auth-Message': this.authToken.message,
      'X-API-Key-Index': this.apiKeyIndex.toString(),
      'X-Account-Index': this.accountIndex.toString()
    };
  }

  // Get authenticated account data
  async getAuthenticatedAccount() {
    try {
      const headers = await this.getAuthHeaders();
      
      // Fetch account with authentication
      const response = await fetch(`${this.baseUrl}/api/v1/account?by=index&value=${this.accountIndex}`, {
        headers
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Auth failed:', errorText);
        throw new Error(`Failed to get authenticated account: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error fetching authenticated account:', error);
      // Fall back to public endpoint
      return this.getPublicAccount();
    }
  }

  // Get public account data (no auth needed)
  async getPublicAccount() {
    try {
      const response = await fetch(`${this.baseUrl}/api/v1/account?by=index&value=${this.accountIndex}`);
      
      if (!response.ok) {
        throw new Error(`Failed to get public account: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error fetching public account:', error);
      throw error;
    }
  }

  // Get orderbook (public endpoint)
  async getOrderBook(market = 'ETH') {
    try {
      const response = await fetch(`${this.baseUrl}/api/v1/orderBookDetails?market=${market}`);
      if (!response.ok) {
        throw new Error(`Failed to get orderbook: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Error fetching orderbook:', error);
      throw error;
    }
  }

  // Get all orderbooks (public endpoint)
  async getAllOrderBooks() {
    try {
      const response = await fetch(`${this.baseUrl}/api/v1/orderBooks`);
      if (!response.ok) {
        throw new Error(`Failed to get orderbooks: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Error fetching orderbooks:', error);
      throw error;
    }
  }

  // Get exchange stats (public endpoint)
  async getExchangeStats() {
    try {
      const response = await fetch(`${this.baseUrl}/api/v1/exchangeStats`);
      if (!response.ok) {
        throw new Error(`Failed to get exchange stats: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Error fetching exchange stats:', error);
      throw error;
    }
  }
}

export default AuthenticatedLighterClient;