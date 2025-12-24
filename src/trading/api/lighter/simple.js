// Simplified API route for Lighter - now with proper authentication
import { getSimpleLighterClient } from '../../lighter/clients/simple-client';
import AuthenticatedLighterClient from '../../lighter/clients/authenticated-client';

export default async function handler(req, res) {
  // Use authenticated client for account data
  const authClient = new AuthenticatedLighterClient();
  const publicClient = getSimpleLighterClient();
  
  try {
    console.log('Lighter API called with authentication');
    
    // Get authenticated account data
    let accountData = null;
    try {
      // Try authenticated request first
      accountData = await authClient.getAuthenticatedAccount();
      console.log('Authenticated account data received');
    } catch (err) {
      console.log('Auth failed, using public endpoint:', err.message);
      // Fall back to public endpoint
      accountData = await publicClient.getAccount(parseInt(process.env.LIGHTER_ACCOUNT_INDEX || '0'));
    }
    
    // Get orderbooks
    let orderbooks = null;
    try {
      orderbooks = await publicClient.getAllOrderBooks();
      console.log('Orderbooks fetched:', orderbooks?.length || 0);
    } catch (err) {
      console.log('Could not fetch orderbooks:', err.message);
    }
    
    // Get exchange stats
    let stats = null;
    try {
      stats = await publicClient.getExchangeStats();
      console.log('Exchange stats:', stats);
    } catch (err) {
      console.log('Could not fetch stats:', err.message);
    }
    
    // Calculate actual balance from account data
    // Extract assets from the Lighter response
    let perpetualsEquity = 0;
    let spotEquity = 0;
    
    if (accountData?.accounts?.[0]) {
      const account = accountData.accounts[0];
      const assets = account.assets || [];
      
      // Calculate spot equity from assets
      // Get prices from stats - no fallback values, use 0 if unavailable
      const ethUsdcPrice = stats?.order_book_stats?.find(s => s.symbol === 'ETH/USDC')?.last_trade_price || 0;
      const provePrice = stats?.order_book_stats?.find(s => s.symbol === 'PROVE/USDC')?.last_trade_price || 0;
      const zkPrice = stats?.order_book_stats?.find(s => s.symbol === 'ZK/USDC')?.last_trade_price || 0;
      
      assets.forEach(asset => {
        let assetValue = 0;
        const balance = parseFloat(asset.balance || 0);
        
        switch(asset.symbol) {
          case 'ETH':
            assetValue = balance * ethUsdcPrice;
            break;
          case 'USDC':
            assetValue = balance;
            break;
          case 'PROVE':
            assetValue = balance * provePrice;
            break;
          case 'ZK':
            assetValue = balance * zkPrice;
            break;
        }
        spotEquity += assetValue;
      });
      
      // Collateral is used for perpetuals
      perpetualsEquity = parseFloat(account.collateral || 0);
      
      // Check if there's available balance that might be for perpetuals
      const availableBalance = parseFloat(account.available_balance || 0);
      if (perpetualsEquity === 0 && availableBalance > 0) {
        perpetualsEquity = availableBalance;
      }
    }
    
    const totalBalance = perpetualsEquity + spotEquity;
    
    console.log('Balance calculation:', {
      perpetualsEquity,
      spotEquity,
      totalBalance,
      rawAccountData: accountData
    });
    
    // Format response
    const response = {
      success: true,
      connected: true,
      data: {
        account: accountData,
        orderbooks: orderbooks,
        stats: stats,
        positions: accountData?.positions || [],
        orders: accountData?.orders || [],
        accountBalance: totalBalance,
        availableMargin: accountData?.availableMargin || perpetualsEquity,
        perpetualsEquity: perpetualsEquity,
        spotEquity: spotEquity,
        performance: {
          winRate: 0,
          totalPnl: 0,
          winningTrades: 0,
          losingTrades: 0,
          totalTrades: 0,
          openPositions: accountData?.positions?.length || 0,
          activeOrders: accountData?.orders?.length || 0
        }
      }
    };
    
    return res.status(200).json(response);
    
  } catch (error) {
    console.error('Simple Lighter API error:', error);
    return res.status(500).json({
      success: false,
      error: error.message,
      connected: false
    });
  }
}