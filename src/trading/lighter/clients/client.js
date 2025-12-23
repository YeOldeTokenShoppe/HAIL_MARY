// Lighter.xyz API Client for Next.js
import { Wallet } from 'ethers';

class LighterClient {
  constructor(config = {}) {
    this.baseUrl = config.baseUrl || process.env.NEXT_PUBLIC_LIGHTER_BASE_URL || 'https://testnet.zklighter.elliot.ai';
    this.apiKeyPrivateKey = config.apiKeyPrivateKey || process.env.LIGHTER_API_KEY_PRIVATE_KEY;
    this.accountIndex = config.accountIndex || parseInt(process.env.LIGHTER_ACCOUNT_INDEX || '0');
    this.apiKeyIndex = config.apiKeyIndex || parseInt(process.env.LIGHTER_API_KEY_INDEX || '3');
    this.authToken = null;
    this.nextNonce = null;
  }

  // Initialize the signer
  async initializeSigner() {
    if (!this.apiKeyPrivateKey) {
      throw new Error('API key private key not configured');
    }
    
    // Ensure the private key has 0x prefix
    const privateKey = this.apiKeyPrivateKey.startsWith('0x') 
      ? this.apiKeyPrivateKey 
      : `0x${this.apiKeyPrivateKey}`;
    
    this.signer = new Wallet(privateKey);
    await this.createAuthToken();
  }

  // Create auth token for API requests
  async createAuthToken(expiryMs = 3600000) { // 1 hour default
    const timestamp = Date.now();
    const expiry = timestamp + expiryMs;
    
    const message = `Lighter Authentication\nTimestamp: ${timestamp}\nExpiry: ${expiry}`;
    const signature = await this.signer.signMessage(message);
    
    this.authToken = {
      timestamp,
      expiry,
      signature,
      publicKey: this.signer.address
    };
    
    return this.authToken;
  }

  // Get headers for authenticated requests
  getHeaders() {
    if (!this.authToken || this.authToken.expiry < Date.now()) {
      throw new Error('Auth token expired or not created');
    }
    
    return {
      'Content-Type': 'application/json',
      'X-Auth-Token': JSON.stringify(this.authToken),
      'X-API-Key-Index': this.apiKeyIndex.toString(),
      'X-Account-Index': this.accountIndex.toString()
    };
  }

  // Get next nonce for transactions
  async getNextNonce() {
    try {
      const response = await fetch(`${this.baseUrl}/api/v1/transaction/next_nonce`, {
        headers: this.getHeaders()
      });
      
      if (!response.ok) throw new Error('Failed to get nonce');
      
      const data = await response.json();
      this.nextNonce = data.nonce;
      return this.nextNonce;
    } catch (error) {
      console.error('Error getting nonce:', error);
      throw error;
    }
  }

  // Sign create order transaction
  async signCreateOrder(params) {
    const {
      market,
      side, // 'buy' or 'sell'
      orderType = 'limit', // 'limit', 'market', 'stop_loss', etc.
      baseAmount,
      price,
      clientOrderIndex,
      timeInForce = 'good_till_time'
    } = params;

    if (!this.nextNonce) {
      await this.getNextNonce();
    }

    const orderData = {
      market,
      side,
      order_type: this.getOrderTypeConstant(orderType),
      base_amount: Math.floor(baseAmount),
      price: Math.floor(price * 1000000), // Convert to integer representation
      client_order_index: clientOrderIndex || Date.now(),
      time_in_force: this.getTimeInForceConstant(timeInForce),
      nonce: this.nextNonce++,
      account_index: this.accountIndex,
      api_key_index: this.apiKeyIndex
    };

    // Sign the order data
    const message = JSON.stringify(orderData);
    const signature = await this.signer.signMessage(message);
    
    return {
      ...orderData,
      signature
    };
  }

  // Send transaction to Lighter
  async sendTransaction(signedTx) {
    try {
      const response = await fetch(`${this.baseUrl}/api/v1/transaction/send_tx`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(signedTx)
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Transaction failed');
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error sending transaction:', error);
      throw error;
    }
  }

  // Create and send order in one call
  async createOrder(params) {
    await this.initializeSigner();
    const signedOrder = await this.signCreateOrder(params);
    return await this.sendTransaction(signedOrder);
  }

  // Cancel order
  async cancelOrder(clientOrderIndex) {
    await this.initializeSigner();
    
    if (!this.nextNonce) {
      await this.getNextNonce();
    }

    const cancelData = {
      order_index: clientOrderIndex,
      nonce: this.nextNonce++,
      account_index: this.accountIndex,
      api_key_index: this.apiKeyIndex
    };

    const message = JSON.stringify(cancelData);
    const signature = await this.signer.signMessage(message);
    
    const signedCancel = {
      ...cancelData,
      signature
    };

    return await this.sendTransaction(signedCancel);
  }

  // Get account data
  async getAccountData() {
    try {
      const response = await fetch(`${this.baseUrl}/api/v1/account/${this.accountIndex}`, {
        headers: this.getHeaders()
      });
      
      if (!response.ok) throw new Error('Failed to get account data');
      
      return await response.json();
    } catch (error) {
      console.error('Error getting account data:', error);
      throw error;
    }
  }

  // Get orderbook data
  async getOrderbook(market) {
    try {
      const response = await fetch(`${this.baseUrl}/api/v1/orderbook/${market}`, {
        headers: this.getHeaders()
      });
      
      if (!response.ok) throw new Error('Failed to get orderbook');
      
      return await response.json();
    } catch (error) {
      console.error('Error getting orderbook:', error);
      throw error;
    }
  }

  // Get all orderbooks
  async getAllOrderbooks() {
    try {
      const response = await fetch(`${this.baseUrl}/api/v1/orderbooks`, {
        headers: this.getHeaders()
      });
      
      if (!response.ok) throw new Error('Failed to get orderbooks');
      
      return await response.json();
    } catch (error) {
      console.error('Error getting orderbooks:', error);
      throw error;
    }
  }

  // Helper to convert order type strings to constants
  getOrderTypeConstant(orderType) {
    const types = {
      'limit': 'ORDER_TYPE_LIMIT',
      'market': 'ORDER_TYPE_MARKET',
      'stop_loss': 'ORDER_TYPE_STOP_LOSS',
      'stop_loss_limit': 'ORDER_TYPE_STOP_LOSS_LIMIT',
      'take_profit': 'ORDER_TYPE_TAKE_PROFIT',
      'take_profit_limit': 'ORDER_TYPE_TAKE_PROFIT_LIMIT',
      'twap': 'ORDER_TYPE_TWAP'
    };
    return types[orderType] || 'ORDER_TYPE_LIMIT';
  }

  // Helper to convert time in force strings to constants
  getTimeInForceConstant(timeInForce) {
    const types = {
      'immediate_or_cancel': 'ORDER_TIME_IN_FORCE_IMMEDIATE_OR_CANCEL',
      'good_till_time': 'ORDER_TIME_IN_FORCE_GOOD_TILL_TIME',
      'post_only': 'ORDER_TIME_IN_FORCE_POST_ONLY'
    };
    return types[timeInForce] || 'ORDER_TIME_IN_FORCE_GOOD_TILL_TIME';
  }
}

// Export singleton instance
let clientInstance = null;

export const getLighterClient = (config) => {
  if (!clientInstance) {
    clientInstance = new LighterClient(config);
  }
  return clientInstance;
};

export default LighterClient;