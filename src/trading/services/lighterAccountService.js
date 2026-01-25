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

  // Check if we're on a trading page - if not, return mock data instead of making API calls
  shouldAllowApiCalls() {
    if (typeof window !== 'undefined') {
      const pathname = window.location.pathname;
      return pathname.includes('/trade') || pathname.includes('/trading');
    }
    return true; // Allow on server side
  }

  async fetchAccountData() {
    if (!this.shouldAllowApiCalls()) {
      console.log('Lighter API calls disabled on non-trading pages');
      return {
        account: { freeCollateral: 0, totalValue: 0, availableToWithdraw: 0 },
        overview: { totalPnl: 0, freeCollateral: 0, totalValue: 0 }
      };
    }

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
    if (!this.shouldAllowApiCalls()) {
      return { positions: [], totalPositions: 0, totalValue: 0 };
    }

    const cacheKey = 'positions';
    const cached = this.cache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.data;
    }

    // Positions are included in the account response
    // This avoids redundant API calls
    try {
      const accountData = await this.fetchAccountData();
      const positions = accountData.positions || [];

      const result = {
        positions,
        positionCount: positions.length,
        totalValue: positions.reduce((sum, pos) => sum + (pos.positionValue || 0), 0),
        totalUnrealizedPnl: accountData.unrealizedPnl || 0,
        totalRealizedPnl: accountData.realizedPnl || 0,
        noDataYet: positions.length === 0
      };

      // Cache the result
      this.cache.set(cacheKey, {
        data: result,
        timestamp: Date.now()
      });

      return result;
    } catch (error) {
      console.log('Failed to fetch Lighter positions (using fallback):', error.message);
      return {
        positions: [],
        positionCount: 0,
        totalValue: 0,
        noDataYet: true
      };
    }
  }

  async fetchOrders() {
    if (!this.shouldAllowApiCalls()) {
      return { orders: [], totalOrders: 0, totalVolume: 0 };
    }

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
    if (!this.shouldAllowApiCalls()) {
      return {
        activeOrders: [],
        activeOrderCount: 0,
        totalOrderValue: 0
      };
    }

    const cacheKey = 'active_orders';
    const cached = this.cache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.data;
    }

    try {
      // Use l1_address like other endpoints - accountActiveOrders may not be supported
      const response = await fetch(`${LIGHTER_API_BASE}/orders?by=l1_address&value=${ACCOUNT_ADDRESS}`);

      // Handle 404 - endpoint may not exist
      if (response.status === 404) {
        console.log('No active orders endpoint available (404 - normal)');
        return {
          activeOrders: [],
          activeOrderCount: 0,
          totalOrderValue: 0,
          noDataYet: true
        };
      }

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      // Filter for active/open orders only
      const activeData = {
        orders: (data.orders || []).filter(order =>
          order.status === 'open' || order.status === 'active' || order.status === 'pending'
        )
      };
      const transformedData = this.transformActiveOrdersData(activeData);

      // Cache the result
      this.cache.set(cacheKey, {
        data: transformedData,
        timestamp: Date.now()
      });

      return transformedData;
    } catch (error) {
      console.log('Failed to fetch Lighter active orders (using fallback):', error.message);
      // Return empty active orders data if fetch fails
      return {
        activeOrders: [],
        activeOrderCount: 0,
        totalOrderValue: 0
      };
    }
  }

  async fetchTradeHistory() {
    if (!this.shouldAllowApiCalls()) {
      return { trades: [], totalTrades: 0, totalVolume: 0 };
    }

    const cacheKey = 'trade_history';
    const cached = this.cache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.data;
    }

    // Note: The Lighter API /accountTxs endpoint requires authentication
    // For now, we derive trade info from the account positions
    // The positions show realized_pnl which indicates closed trades
    try {
      const accountData = await this.fetchAccountData();
      const positions = accountData.positions || [];

      // Calculate realized P&L from positions (indicates past trades)
      const realizedPnl = positions.reduce((sum, pos) => sum + (pos.realizedPnl || 0), 0);

      const result = {
        trades: [], // No individual trade data without auth
        tradeCount: positions.length > 0 ? 1 : 0, // At least 1 trade if we have positions
        totalVolume: positions.reduce((sum, pos) => sum + (pos.positionValue || 0), 0),
        realizedPnl,
        noDataYet: positions.length === 0,
        note: 'Trade history requires API authentication - showing position summary'
      };

      // Cache the result
      this.cache.set(cacheKey, {
        data: result,
        timestamp: Date.now()
      });

      return result;
    } catch (error) {
      console.log('Failed to fetch Lighter trade history (using fallback):', error.message);
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
    if (!this.shouldAllowApiCalls()) {
      return { pnlData: [], totalPnl: 0, dailyPnl: 0 };
    }

    const cacheKey = `pnl_${accountIndex}_${resolution}_${startTs}_${endTs}`;
    const cached = this.cache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.data;
    }

    // On testnet, the /pnl endpoint often returns errors (account not found, time range issues)
    // Fall back to getting P&L from account data which already includes position P&L
    try {
      const accountData = await this.fetchAccountData();

      // P&L is calculated from positions in the account response
      const result = {
        data: [],
        pnlHistory: [{
          timestamp: Date.now(),
          totalPnl: accountData.totalPnl || 0,
          unrealizedPnl: accountData.unrealizedPnl || 0,
          realizedPnl: accountData.realizedPnl || 0,
          date: new Date().toISOString()
        }],
        totalPnl: accountData.totalPnl || 0,
        unrealizedPnl: accountData.unrealizedPnl || 0,
        realizedPnl: accountData.realizedPnl || 0,
        isEmpty: false,
        hasNoHistory: false,
        // Additional context
        positions: accountData.positions || [],
        totalAssetValue: accountData.totalAssetValue || 0,
        collateral: accountData.collateral || 0,
        availableBalance: accountData.availableBalance || 0
      };

      // Cache the result
      this.cache.set(cacheKey, {
        data: result,
        timestamp: Date.now()
      });

      return result;
    } catch (error) {
      console.error('Failed to fetch Lighter P&L from account data:', error);
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
        positions: [],
        unrealizedPnl: 0,
        realizedPnl: 0,
        totalPnl: 0,
        totalAssetValue: 0,
        lastUpdate: Date.now()
      };
    }

    const account = apiData.accounts[0];

    // Extract P&L from positions (embedded in account response)
    const positions = account.positions || [];
    let unrealizedPnl = 0;
    let realizedPnl = 0;

    positions.forEach(pos => {
      unrealizedPnl += parseFloat(pos.unrealized_pnl) || 0;
      realizedPnl += parseFloat(pos.realized_pnl) || 0;
    });

    const totalPnl = unrealizedPnl + realizedPnl;

    return {
      balance: parseFloat(account.available_balance) || 0,
      accountIndex: account.index || 'N/A',
      l1Address: account.l1_address,
      accountType: account.account_type,
      collateral: parseFloat(account.collateral) || 0,
      availableBalance: parseFloat(account.available_balance) || 0,
      totalAssetValue: parseFloat(account.total_asset_value) || 0,
      crossAssetValue: parseFloat(account.cross_asset_value) || 0,
      assets: account.assets || [],
      positions: positions.map(pos => ({
        marketId: pos.market_id,
        symbol: pos.symbol,
        sign: pos.sign, // 1 for Long, -1 for Short
        position: parseFloat(pos.position) || 0,
        avgEntryPrice: parseFloat(pos.avg_entry_price) || 0,
        positionValue: parseFloat(pos.position_value) || 0,
        unrealizedPnl: parseFloat(pos.unrealized_pnl) || 0,
        realizedPnl: parseFloat(pos.realized_pnl) || 0,
        liquidationPrice: parseFloat(pos.liquidation_price) || 0,
        marginMode: pos.margin_mode
      })),
      // P&L calculated from positions
      unrealizedPnl,
      realizedPnl,
      totalPnl,
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
      // Fetch account data first (contains positions and P&L)
      const accountData = await this.fetchAccountData();

      // Then fetch orders in parallel
      const [ordersData, activeOrdersData] = await Promise.all([
        this.fetchOrders(),
        this.fetchActiveOrders()
      ]);

      // Trade history and P&L are derived from account data
      const tradeHistoryData = await this.fetchTradeHistory();

      // P&L is now extracted from account positions
      const pnlData = {
        totalPnl: accountData.totalPnl || 0,
        unrealizedPnl: accountData.unrealizedPnl || 0,
        realizedPnl: accountData.realizedPnl || 0,
        positions: accountData.positions || [],
        pnlHistory: [{
          timestamp: Date.now(),
          totalPnl: accountData.totalPnl || 0,
          unrealizedPnl: accountData.unrealizedPnl || 0,
          realizedPnl: accountData.realizedPnl || 0,
          date: new Date().toISOString()
        }],
        isEmpty: accountData.positions?.length === 0,
        hasNoHistory: false
      };

      // Positions from account data (already transformed)
      const positionsData = {
        positions: accountData.positions || [],
        positionCount: accountData.positions?.length || 0,
        totalValue: accountData.positions?.reduce((sum, pos) => sum + (pos.positionValue || 0), 0) || 0
      };

      return {
        account: accountData,
        positions: positionsData,
        orders: ordersData,
        activeOrders: activeOrdersData,
        tradeHistory: tradeHistoryData,
        pnl: pnlData,
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
          // P&L from account positions
          pnlTotalPnl: pnlData.totalPnl,
          pnlUnrealizedPnl: pnlData.unrealizedPnl,
          pnlRealizedPnl: pnlData.realizedPnl,
          pnlHistory: pnlData.pnlHistory,
          hasNoHistory: pnlData.isEmpty,
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