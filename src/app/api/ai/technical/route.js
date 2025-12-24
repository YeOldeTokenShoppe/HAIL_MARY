// Technical analysis data API endpoint (simulated/fallback)
import { NextResponse } from 'next/server';

function generateSimulatedData() {
  const baseData = {
    BTC: {
      price: 43250 + (Math.random() - 0.5) * 1000,
      change24h: (Math.random() - 0.5) * 5,
      volume: 28000000000 + Math.random() * 5000000000,
      marketCap: 850000000000,
      high24h: 44100,
      low24h: 42800,
      rsi: 45 + Math.random() * 20,
      macd: {
        value: (Math.random() - 0.5) * 100,
        signal: (Math.random() - 0.5) * 80,
        histogram: (Math.random() - 0.5) * 20
      },
      bollinger: {
        upper: 44500,
        middle: 43250,
        lower: 42000
      },
      support: 42000,
      resistance: 44500,
      trend: Math.random() > 0.5 ? 'bullish' : 'bearish'
    },
    ETH: {
      price: 2280 + (Math.random() - 0.5) * 50,
      change24h: (Math.random() - 0.5) * 6,
      volume: 15000000000 + Math.random() * 3000000000,
      marketCap: 275000000000,
      high24h: 2350,
      low24h: 2220,
      rsi: 50 + Math.random() * 15,
      macd: {
        value: (Math.random() - 0.5) * 50,
        signal: (Math.random() - 0.5) * 40,
        histogram: (Math.random() - 0.5) * 10
      },
      bollinger: {
        upper: 2380,
        middle: 2280,
        lower: 2180
      },
      support: 2200,
      resistance: 2400,
      trend: Math.random() > 0.5 ? 'bullish' : 'bearish'
    },
    SOL: {
      price: 98 + (Math.random() - 0.5) * 5,
      change24h: (Math.random() - 0.5) * 8,
      volume: 2500000000 + Math.random() * 500000000,
      marketCap: 42000000000,
      high24h: 102,
      low24h: 95,
      rsi: 55 + Math.random() * 10,
      macd: {
        value: (Math.random() - 0.5) * 5,
        signal: (Math.random() - 0.5) * 4,
        histogram: (Math.random() - 0.5) * 1
      },
      bollinger: {
        upper: 105,
        middle: 98,
        lower: 91
      },
      support: 92,
      resistance: 105,
      trend: Math.random() > 0.5 ? 'bullish' : 'bearish'
    },
    source: 'simulated',
    cacheAge: 0,
    timestamp: new Date().toISOString()
  };

  return baseData;
}

export async function GET() {
  try {
    const data = generateSimulatedData();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Technical API error:', error);
    return NextResponse.json({
      error: 'Failed to generate technical data',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}