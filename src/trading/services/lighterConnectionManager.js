// Server-side Lighter DEX Connection Manager
// This singleton manages a single connection to Lighter DEX for all users

class LighterConnectionManager {
  constructor() {
    this.connection = null;
    this.isConnecting = false;
    this.lastUpdate = null;
    this.cache = new Map();
    this.cacheTimeout = 5000; // 5 seconds cache
    this.updateInterval = null;
    this.marketData = {};
    this.orderBook = {};
    this.positions = {};
  }

  async connect() {
    if (this.connection || this.isConnecting) {
      return this.connection;
    }

    this.isConnecting = true;
    try {
      // Initialize Lighter DEX connection here
      // This would be your actual Lighter SDK initialization
      console.log('[LighterConnectionManager] Establishing connection to Lighter DEX...');
      
      // Simulate connection (replace with actual Lighter SDK)
      this.connection = {
        connected: true,
        endpoint: process.env.LIGHTER_RPC_ENDPOINT || 'https://testnet.lighter.xyz',
        timestamp: Date.now()
      };

      // Start polling for updates
      this.startPolling();
      
      console.log('[LighterConnectionManager] Connected to Lighter DEX');
      return this.connection;
    } catch (error) {
      console.error('[LighterConnectionManager] Connection failed:', error);
      this.isConnecting = false;
      throw error;
    }
  }

  startPolling() {
    // Update data every 10 seconds
    this.updateInterval = setInterval(async () => {
      await this.fetchMarketData();
    }, 10000);

    // Initial fetch
    this.fetchMarketData();
  }

  async fetchMarketData() {
    try {
      // Fetch from Lighter DEX
      // This would be replaced with actual Lighter SDK calls
      console.log('[LighterConnectionManager] Fetching market data...');
      
      const markets = ['SOL-USD', 'ETH-USD', 'BTC-USD'];
      
      for (const market of markets) {
        // Simulate fetching (replace with actual SDK calls)
        this.marketData[market] = {
          ticker: {
            lastPrice: 0,
            volume24h: 0,
            change24h: 0,
            high24h: 0,
            low24h: 0
          },
          orderBook: {
            bids: [],
            asks: []
          },
          timestamp: Date.now()
        };
      }

      this.lastUpdate = Date.now();
      
      // Clear old cache entries
      this.clearExpiredCache();
      
    } catch (error) {
      console.error('[LighterConnectionManager] Failed to fetch market data:', error);
    }
  }

  async getMarketData(market) {
    const cacheKey = `market_${market}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    if (!this.connection) {
      await this.connect();
    }

    const data = this.marketData[market] || null;
    this.setCache(cacheKey, data);
    return data;
  }

  async getOrderBook(market) {
    const cacheKey = `orderbook_${market}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    if (!this.connection) {
      await this.connect();
    }

    const data = this.orderBook[market] || { bids: [], asks: [] };
    this.setCache(cacheKey, data);
    return data;
  }

  async getPositions(address) {
    // In production, this would only work for server-controlled addresses
    // Individual users would need authentication
    const cacheKey = `positions_${address}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    if (!this.connection) {
      await this.connect();
    }

    const data = this.positions[address] || [];
    this.setCache(cacheKey, data);
    return data;
  }

  getFromCache(key) {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.data;
    }
    return null;
  }

  setCache(key, data) {
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });
  }

  clearExpiredCache() {
    const now = Date.now();
    for (const [key, value] of this.cache.entries()) {
      if (now - value.timestamp > this.cacheTimeout) {
        this.cache.delete(key);
      }
    }
  }

  getStatus() {
    return {
      connected: !!this.connection,
      lastUpdate: this.lastUpdate,
      markets: Object.keys(this.marketData),
      cacheSize: this.cache.size
    };
  }

  disconnect() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
    this.connection = null;
    this.cache.clear();
    console.log('[LighterConnectionManager] Disconnected from Lighter DEX');
  }
}

// Export singleton instance
let instance = null;

export function getLighterConnection() {
  if (!instance) {
    instance = new LighterConnectionManager();
  }
  return instance;
}

export default getLighterConnection;