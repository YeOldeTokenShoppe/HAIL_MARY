// API endpoint for Lighter DEX data
// This endpoint uses the server-side connection manager

import { getLighterConnection } from '../services/lighterConnectionManager';

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const lighter = getLighterConnection();
    const { type, market, address } = req.query;

    // Ensure connection is established
    await lighter.connect();

    let data;

    switch (type) {
      case 'markets':
        // Get all market data
        const markets = ['SOL-USD', 'ETH-USD', 'BTC-USD'];
        data = {};
        for (const m of markets) {
          data[m] = await lighter.getMarketData(m);
        }
        break;

      case 'market':
        // Get specific market data
        if (!market) {
          return res.status(400).json({ 
            success: false, 
            error: 'Market parameter required' 
          });
        }
        data = await lighter.getMarketData(market);
        break;

      case 'orderbook':
        // Get order book for a market
        if (!market) {
          return res.status(400).json({ 
            success: false, 
            error: 'Market parameter required' 
          });
        }
        data = await lighter.getOrderBook(market);
        break;

      case 'positions':
        // Get positions (would require authentication in production)
        if (!address) {
          return res.status(400).json({ 
            success: false, 
            error: 'Address parameter required' 
          });
        }
        data = await lighter.getPositions(address);
        break;

      case 'status':
        // Get connection status
        data = lighter.getStatus();
        break;

      default:
        // Default to all markets
        const allMarkets = ['SOL-USD', 'ETH-USD', 'BTC-USD'];
        data = {};
        for (const m of allMarkets) {
          data[m] = await lighter.getMarketData(m);
        }
    }

    return res.status(200).json({
      success: true,
      data,
      timestamp: Date.now()
    });

  } catch (error) {
    console.error('Lighter API error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch Lighter data'
    });
  }
}