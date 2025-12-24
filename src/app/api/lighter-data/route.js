// API endpoint for Lighter DEX data
// This endpoint uses the server-side connection manager

import { NextResponse } from 'next/server';
import { getLighterConnection } from './lighterConnectionManager';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');
    const market = searchParams.get('market');
    const address = searchParams.get('address');
    
    const lighter = getLighterConnection();

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
          return NextResponse.json({ 
            success: false, 
            error: 'Market parameter required' 
          }, { status: 400 });
        }
        data = await lighter.getMarketData(market);
        break;

      case 'orderbook':
        // Get order book for a market
        if (!market) {
          return NextResponse.json({ 
            success: false, 
            error: 'Market parameter required' 
          }, { status: 400 });
        }
        data = await lighter.getOrderBook(market);
        break;

      case 'positions':
        // Get positions (would require authentication in production)
        if (!address) {
          return NextResponse.json({ 
            success: false, 
            error: 'Address parameter required' 
          }, { status: 400 });
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

    return NextResponse.json({
      success: true,
      data,
      timestamp: Date.now()
    });

  } catch (error) {
    console.error('Lighter API error:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to fetch Lighter data'
    }, { status: 500 });
  }
}

// Handle OPTIONS for CORS
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}