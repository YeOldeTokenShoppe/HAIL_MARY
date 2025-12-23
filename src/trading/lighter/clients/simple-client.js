// Simplified Lighter API Client based on their documentation
// This client makes direct HTTP calls to Lighter API endpoints

class SimpleLighterClient {
  constructor(config = {}) {
    this.baseUrl = config.baseUrl || process.env.NEXT_PUBLIC_LIGHTER_BASE_URL || 'https://testnet.zklighter.elliot.ai';
    this.accountIndex = config.accountIndex || parseInt(process.env.LIGHTER_ACCOUNT_INDEX || '0');
  }

  // Get account info by index or address
  async getAccount(indexOrAddress = null) {
    try {
      // If it looks like an address (starts with 0x), fetch by address
      if (typeof indexOrAddress === 'string' && indexOrAddress.startsWith('0x')) {
        const response = await fetch(`${this.baseUrl}/api/v1/accountsByL1Address?l1Address=${indexOrAddress}`);
        if (!response.ok) {
          throw new Error(`Failed to get account by address: ${response.status}`);
        }
        return await response.json();
      } else {
        // Otherwise fetch by index
        const accountIndex = indexOrAddress || this.accountIndex;
        const response = await fetch(`${this.baseUrl}/api/v1/account?by=index&value=${accountIndex}`);
        if (!response.ok) {
          throw new Error(`Failed to get account by index: ${response.status}`);
        }
        return await response.json();
      }
    } catch (error) {
      console.error('Error fetching account:', error);
      throw error;
    }
  }

  // Get orderbook for a specific market
  async getOrderBook(market = 'BTC-PERP') {
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

  // Get all orderbooks
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

  // Get recent trades for a market
  async getRecentTrades(market = 'BTC-PERP', limit = 20) {
    try {
      const response = await fetch(`${this.baseUrl}/api/v1/recentTrades?market=${market}&limit=${limit}`);
      if (!response.ok) {
        throw new Error(`Failed to get recent trades: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Error fetching recent trades:', error);
      throw error;
    }
  }

  // Get exchange stats
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

  // Get trades for an account
  async getAccountTrades(accountIndex = null, limit = 100) {
    const index = accountIndex || this.accountIndex;
    try {
      const response = await fetch(`${this.baseUrl}/api/v1/trades?accountIndex=${index}&limit=${limit}`);
      if (!response.ok) {
        throw new Error(`Failed to get account trades: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Error fetching account trades:', error);
      throw error;
    }
  }

  // Get PnL for an account
  async getAccountPnL(accountIndex = null) {
    const index = accountIndex || this.accountIndex;
    try {
      const response = await fetch(`${this.baseUrl}/api/v1/pnl?accountIndex=${index}`);
      if (!response.ok) {
        throw new Error(`Failed to get PnL: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Error fetching PnL:', error);
      throw error;
    }
  }

  // Get server info
  async getInfo() {
    try {
      const response = await fetch(`${this.baseUrl}/info`);
      if (!response.ok) {
        throw new Error(`Failed to get info: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Error fetching info:', error);
      throw error;
    }
  }

  // Get server status
  async getStatus() {
    try {
      const response = await fetch(`${this.baseUrl}/`);
      if (!response.ok) {
        throw new Error(`Failed to get status: ${response.status}`);
      }
      const text = await response.text();
      return { status: 'ok', message: text };
    } catch (error) {
      console.error('Error fetching status:', error);
      throw error;
    }
  }
}

// Export singleton instance
let clientInstance = null;

export const getSimpleLighterClient = (config) => {
  if (!clientInstance) {
    clientInstance = new SimpleLighterClient(config);
  }
  return clientInstance;
};

export default SimpleLighterClient;