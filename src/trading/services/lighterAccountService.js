// Lighter Account Service
// Fetches account data from the Lighter testnet API

const LIGHTER_API_BASE = 'https://testnet.zklighter.elliot.ai/api/v1';
const ACCOUNT_ADDRESS = '0x5Ad34D42bAF12ABBFA65B7649C58235C0Db75D6C';
const LIGHTER_ACCOUNT_INDEX = 227;

class LighterAccountService {
  constructor() {
    this.cache = new Map();
    this.cacheTimeout = 30000; // 30 seconds
  }

  async fetchAccountData() {
    const cacheKey = 'account_overview';
    const cached = this.cache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.data;
    }

    try {
      const response = await fetch(`${LIGHTER_API_BASE}/account?by=l1_address&value=${ACCOUNT_ADDRESS}`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      // Transform the API response to match our expected format
      const transformedData = this.transformAccountData(data);
      
      // Cache the result
      this.cache.set(cacheKey, {
        data: transformedData,
        timestamp: Date.now()
      });

      return transformedData;
    } catch (error) {
      console.error('Failed to fetch Lighter account data:', error);
      throw error;
    }
  }

  async fetchPositions() {
    const cacheKey = 'positions';
    const cached = this.cache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.data;
    }

    try {
      const response = await fetch(`${LIGHTER_API_BASE}/positions?by=l1_address&value=${ACCOUNT_ADDRESS}`);
      
      // Handle 404 - likely no positions data yet
      if (response.status === 404) {
        console.log('No positions data available yet (404 - normal for new accounts)');
        return {
          positions: [],
          positionCount: 0,
          totalValue: 0,
          noDataYet: true
        };
      }
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      const transformedData = this.transformPositionsData(data);
      
      // Cache the result
      this.cache.set(cacheKey, {
        data: transformedData,
        timestamp: Date.now()
      });

      return transformedData;
    } catch (error) {
      console.log('Failed to fetch Lighter positions (using fallback):', error.message);
      // Return empty positions data if fetch fails
      return {
        positions: [],
        positionCount: 0,
        totalValue: 0,
        noDataYet: true
      };
    }
  }

  async fetchOrders() {
    const cacheKey = 'orders';
    const cached = this.cache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.data;
    }

    try {
      const response = await fetch(`${LIGHTER_API_BASE}/orders?by=l1_address&value=${ACCOUNT_ADDRESS}`);
      
      // Handle 404 - likely no orders data yet
      if (response.status === 404) {
        console.log('No orders data available yet (404 - normal for new accounts)');
        return {
          orders: [],
          orderCount: 0,
          noDataYet: true
        };
      }
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      const transformedData = this.transformOrdersData(data);
      
      // Cache the result
      this.cache.set(cacheKey, {
        data: transformedData,
        timestamp: Date.now()
      });

      return transformedData;
    } catch (error) {
      console.log('Failed to fetch Lighter orders (using fallback):', error.message);
      // Return empty orders data if fetch fails
      return {
        orders: [],
        orderCount: 0,
        noDataYet: true
      };
    }
  }

  async fetchActiveOrders() {
    const cacheKey = 'active_orders';
    const cached = this.cache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.data;
    }

    try {
      const response = await fetch(`${LIGHTER_API_BASE}/accountActiveOrders?by=l1_address&value=${ACCOUNT_ADDRESS}`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      const transformedData = this.transformActiveOrdersData(data);
      
      // Cache the result
      this.cache.set(cacheKey, {
        data: transformedData,
        timestamp: Date.now()
      });

      return transformedData;
    } catch (error) {
      console.error('Failed to fetch Lighter active orders:', error);
      // Return empty active orders data if fetch fails
      return {
        activeOrders: [],
        activeOrderCount: 0,
        totalOrderValue: 0
      };
    }
  }

  async fetchTradeHistory() {
    const cacheKey = 'trade_history';
    const cached = this.cache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.data;
    }

    try {
      const response = await fetch(`${LIGHTER_API_BASE}/trades?by=l1_address&value=${ACCOUNT_ADDRESS}`);
      
      // Handle 404 - likely no trade history data yet
      if (response.status === 404) {
        console.log('No trade history data available yet (404 - normal for new accounts)');
        return {
          trades: [],
          tradeCount: 0,
          totalVolume: 0,
          realizedPnl: 0,
          noDataYet: true
        };
      }
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      const transformedData = this.transformTradeHistoryData(data);
      
      // Cache the result
      this.cache.set(cacheKey, {
        data: transformedData,
        timestamp: Date.now()
      });

      return transformedData;
    } catch (error) {
      console.log('Failed to fetch Lighter trade history (using fallback):', error.message);
      // Return empty trade history data if fetch fails
      return {
        trades: [],
        tradeCount: 0,
        totalVolume: 0,
        realizedPnl: 0,
        noDataYet: true
      };
    }
  }

  async fetchPnL(accountIndex, resolution = '1d', startTs = null, endTs = null) {
    const cacheKey = `pnl_${accountIndex}_${resolution}_${startTs}_${endTs}`;
    const cached = this.cache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.data;
    }

    try {
      // Default to last 30 days if no timestamps provided
      if (!endTs) endTs = Math.floor(Date.now() / 1000);
      if (!startTs) startTs = endTs - (30 * 24 * 60 * 60); // 30 days ago

      const response = await fetch(
        `${LIGHTER_API_BASE}/pnl?by=index&value=${accountIndex}&resolution=${resolution}&start_timestamp=${startTs}&end_timestamp=${endTs}&count_back=100`
      );
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      // No trading history yet
      if (data.code === 21100) {
        const emptyResult = { data: [], isEmpty: true, hasNoHistory: true };
        this.cache.set(cacheKey, {
          data: emptyResult,
          timestamp: Date.now()
        });
        return emptyResult;
      }
      
      if (data.code !== 200) {
        throw new Error(data.message || 'Failed to fetch P&L data');
      }
      
      const transformedData = this.transformPnLData(data.pnl);
      const result = { ...transformedData, isEmpty: false, hasNoHistory: false };
      
      // Cache the result
      this.cache.set(cacheKey, {
        data: result,
        timestamp: Date.now()
      });

      return result;
    } catch (error) {
      console.error('Failed to fetch Lighter P&L:', error);
      // Return empty P&L data if fetch fails
      return {
        data: [],
        isEmpty: true,
        hasNoHistory: true,
        totalPnl: 0,
        unrealizedPnl: 0,
        realizedPnl: 0
      };
    }
  }

  transformAccountData(apiData) {
    if (!apiData || !apiData.accounts || apiData.accounts.length === 0) {
      return {
        balance: 0,
        accountIndex: 'N/A',
        collateral: 0,
        availableBalance: 0,
        assets: [],
        lastUpdate: Date.now()
      };
    }

    const account = apiData.accounts[0];
    
    return {
      balance: parseFloat(account.available_balance) || 0,
      accountIndex: account.index || 'N/A',
      l1Address: account.l1_address,
      accountType: account.account_type,
      collateral: parseFloat(account.collateral) || 0,
      availableBalance: parseFloat(account.available_balance) || 0,
      assets: account.assets || [],
      status: account.status,
      lastUpdate: Date.now()
    };
  }

  transformPositionsData(apiData) {
    if (!apiData || !apiData.positions) {
      return {
        positions: [],
        positionCount: 0,
        totalValue: 0
      };
    }

    const positions = apiData.positions.map(pos => ({
      symbol: pos.symbol,
      side: pos.side,
      size: parseFloat(pos.size),
      entryPrice: parseFloat(pos.entry_price),
      markPrice: parseFloat(pos.mark_price),
      pnl: parseFloat(pos.unrealized_pnl),
      value: parseFloat(pos.notional_value)
    }));

    return {
      positions,
      positionCount: positions.length,
      totalValue: positions.reduce((sum, pos) => sum + pos.value, 0)
    };
  }

  transformOrdersData(apiData) {
    if (!apiData || !apiData.orders) {
      return {
        orders: [],
        orderCount: 0
      };
    }

    const orders = apiData.orders.map(order => ({
      id: order.id,
      symbol: order.symbol,
      side: order.side,
      size: parseFloat(order.size),
      price: parseFloat(order.price),
      status: order.status,
      type: order.type,
      createdAt: order.created_at
    }));

    return {
      orders,
      orderCount: orders.length
    };
  }

  transformActiveOrdersData(apiData) {
    if (!apiData || !apiData.orders) {
      return {
        activeOrders: [],
        activeOrderCount: 0,
        totalOrderValue: 0
      };
    }

    const activeOrders = apiData.orders.map(order => ({
      id: order.id,
      symbol: order.symbol,
      side: order.side,
      size: parseFloat(order.size),
      price: parseFloat(order.price),
      status: order.status,
      type: order.type,
      value: parseFloat(order.size) * parseFloat(order.price),
      createdAt: order.created_at,
      expiryTime: order.expiry_time
    }));

    return {
      activeOrders,
      activeOrderCount: activeOrders.length,
      totalOrderValue: activeOrders.reduce((sum, order) => sum + order.value, 0)
    };
  }

  transformTradeHistoryData(apiData) {
    if (!apiData || !apiData.trades) {
      return {
        trades: [],
        tradeCount: 0,
        totalVolume: 0,
        realizedPnl: 0
      };
    }

    const trades = apiData.trades.map(trade => ({
      id: trade.id,
      symbol: trade.symbol,
      side: trade.side,
      size: parseFloat(trade.size),
      price: parseFloat(trade.price),
      value: parseFloat(trade.size) * parseFloat(trade.price),
      fee: parseFloat(trade.fee),
      pnl: parseFloat(trade.realized_pnl || 0),
      executedAt: trade.executed_at,
      timestamp: new Date(trade.executed_at).getTime()
    }));

    return {
      trades,
      tradeCount: trades.length,
      totalVolume: trades.reduce((sum, trade) => sum + trade.value, 0),
      realizedPnl: trades.reduce((sum, trade) => sum + trade.pnl, 0)
    };
  }

  transformPnLData(pnlArray) {
    if (!pnlArray || !Array.isArray(pnlArray) || pnlArray.length === 0) {
      return {
        data: [],
        totalPnl: 0,
        unrealizedPnl: 0,
        realizedPnl: 0,
        pnlHistory: []
      };
    }

    const pnlHistory = pnlArray.map(entry => ({
      timestamp: entry.timestamp * 1000, // Convert to milliseconds
      totalPnl: parseFloat(entry.total_pnl || 0),
      unrealizedPnl: parseFloat(entry.unrealized_pnl || 0),
      realizedPnl: parseFloat(entry.realized_pnl || 0),
      date: new Date(entry.timestamp * 1000).toISOString()
    }));

    // Get the latest P&L values
    const latest = pnlHistory[pnlHistory.length - 1] || {
      totalPnl: 0,
      unrealizedPnl: 0,
      realizedPnl: 0
    };

    return {
      data: pnlArray,
      pnlHistory,
      totalPnl: latest.totalPnl,
      unrealizedPnl: latest.unrealizedPnl,
      realizedPnl: latest.realizedPnl
    };
  }

  // Clear cache manually if needed
  clearCache() {
    this.cache.clear();
  }

  // Get all data at once
  async fetchAllData() {
    try {
      // Fetch all data in parallel, using the known account index for P&L
      const [accountData, positionsData, ordersData, activeOrdersData, tradeHistoryData, pnlData] = await Promise.all([
        this.fetchAccountData(),
        this.fetchPositions(),
        this.fetchOrders(),
        this.fetchActiveOrders(),
        this.fetchTradeHistory(),
        this.fetchPnL(LIGHTER_ACCOUNT_INDEX)
      ]);

      return {
        account: accountData,
        positions: positionsData,
        orders: ordersData,
        activeOrders: activeOrdersData,
        tradeHistory: tradeHistoryData,
        pnl: pnlData || { isEmpty: true, hasNoHistory: true, totalPnl: 0, unrealizedPnl: 0, realizedPnl: 0 },
        combined: {
          ...accountData,
          positionCount: positionsData.positionCount,
          positions: positionsData.positions,
          orderCount: ordersData.orderCount,
          orders: ordersData.orders,
          activeOrderCount: activeOrdersData.activeOrderCount,
          activeOrders: activeOrdersData.activeOrders,
          totalOrderValue: activeOrdersData.totalOrderValue,
          tradeCount: tradeHistoryData.tradeCount,
          trades: tradeHistoryData.trades,
          totalVolume: tradeHistoryData.totalVolume,
          realizedPnl: tradeHistoryData.realizedPnl,
          // P&L data
          pnlTotalPnl: pnlData?.totalPnl || 0,
          pnlUnrealizedPnl: pnlData?.unrealizedPnl || 0,
          pnlRealizedPnl: pnlData?.realizedPnl || 0,
          pnlHistory: pnlData?.pnlHistory || [],
          hasNoHistory: pnlData?.hasNoHistory || false,
          lastUpdate: Date.now()
        }
      };
    } catch (error) {
      console.error('Failed to fetch all Lighter data:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const lighterAccountService = new LighterAccountService();
export default lighterAccountService;