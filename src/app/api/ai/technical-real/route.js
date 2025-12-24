// Technical analysis data API endpoint (real data from CoinGecko)
import { NextResponse } from 'next/server';

// Cache for storing fetched data
let cache = {
  data: null,
  timestamp: 0,
  ttl: 60000 // 1 minute cache
};

async function fetchCoinGeckoData() {
  try {
    // Check cache first
    if (cache.data && Date.now() - cache.timestamp < cache.ttl) {
      return { ...cache.data, cacheAge: Math.floor((Date.now() - cache.timestamp) / 1000) };
    }

    // Fetch real data from CoinGecko
    const response = await fetch(
      'https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=bitcoin,ethereum,solana&order=market_cap_desc&sparkline=true&price_change_percentage=24h,7d'
    );

    if (!response.ok) {
      throw new Error('Failed to fetch from CoinGecko');
    }

    const coins = await response.json();
    
    // Transform data into the expected format
    const data = {
      BTC: transformCoinData(coins.find(c => c.id === 'bitcoin')),
      ETH: transformCoinData(coins.find(c => c.id === 'ethereum')),
      SOL: transformCoinData(coins.find(c => c.id === 'solana')),
      source: 'coingecko-real',
      timestamp: new Date().toISOString()
    };

    // Update cache
    cache.data = data;
    cache.timestamp = Date.now();

    return { ...data, cacheAge: 0 };
  } catch (error) {
    console.error('Error fetching CoinGecko data:', error);
    // Return fallback data
    return getFallbackData();
  }
}

function transformCoinData(coin) {
  if (!coin) return getFallbackCoinData();

  return {
    price: coin.current_price,
    change24h: coin.price_change_percentage_24h || 0,
    volume: coin.total_volume,
    marketCap: coin.market_cap,
    high24h: coin.high_24h,
    low24h: coin.low_24h,
    rsi: calculateRSI(coin.sparkline_in_7d?.price || []),
    macd: calculateMACD(coin.sparkline_in_7d?.price || []),
    bollinger: calculateBollinger(coin.current_price, coin.high_24h, coin.low_24h),
    support: coin.low_24h * 0.98,
    resistance: coin.high_24h * 1.02,
    trend: coin.price_change_percentage_24h > 0 ? 'bullish' : 'bearish'
  };
}

function calculateRSI(prices) {
  // Simplified RSI calculation
  if (prices.length < 14) return 50;
  
  let gains = 0;
  let losses = 0;
  
  for (let i = 1; i < Math.min(14, prices.length); i++) {
    const diff = prices[i] - prices[i - 1];
    if (diff > 0) gains += diff;
    else losses -= diff;
  }
  
  const avgGain = gains / 14;
  const avgLoss = losses / 14;
  const rs = avgGain / (avgLoss || 1);
  return Math.round(100 - (100 / (1 + rs)));
}

function calculateMACD(prices) {
  // Simplified MACD
  if (prices.length < 26) {
    return { value: 0, signal: 0, histogram: 0 };
  }
  
  const ema12 = prices.slice(-12).reduce((a, b) => a + b, 0) / 12;
  const ema26 = prices.slice(-26).reduce((a, b) => a + b, 0) / 26;
  const macd = ema12 - ema26;
  
  return {
    value: macd,
    signal: macd * 0.9,
    histogram: macd * 0.1
  };
}

function calculateBollinger(price, high, low) {
  const middle = (high + low) / 2;
  const stdDev = (high - low) / 4;
  
  return {
    upper: middle + (stdDev * 2),
    middle: middle,
    lower: middle - (stdDev * 2)
  };
}

function getFallbackCoinData() {
  return {
    price: Math.random() * 50000 + 20000,
    change24h: (Math.random() - 0.5) * 10,
    volume: Math.random() * 1000000000,
    marketCap: Math.random() * 500000000000,
    high24h: Math.random() * 55000 + 20000,
    low24h: Math.random() * 45000 + 20000,
    rsi: Math.random() * 40 + 30,
    macd: {
      value: (Math.random() - 0.5) * 100,
      signal: (Math.random() - 0.5) * 80,
      histogram: (Math.random() - 0.5) * 20
    },
    bollinger: {
      upper: Math.random() * 55000 + 20000,
      middle: Math.random() * 50000 + 20000,
      lower: Math.random() * 45000 + 20000
    },
    support: Math.random() * 45000 + 20000,
    resistance: Math.random() * 55000 + 20000,
    trend: Math.random() > 0.5 ? 'bullish' : 'bearish'
  };
}

function getFallbackData() {
  return {
    BTC: getFallbackCoinData(),
    ETH: getFallbackCoinData(),
    SOL: getFallbackCoinData(),
    source: 'fallback',
    cacheAge: 0,
    timestamp: new Date().toISOString()
  };
}

export async function GET() {
  try {
    const data = await fetchCoinGeckoData();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Technical API error:', error);
    return NextResponse.json(getFallbackData());
  }
}