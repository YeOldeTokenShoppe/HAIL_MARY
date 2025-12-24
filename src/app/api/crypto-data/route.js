import { NextResponse } from 'next/server';

// Cache crypto data in memory with timestamp
let cachedCryptoData = null;
let cryptoCacheTime = null;
const CRYPTO_CACHE_DURATION = 60000; // 1 minute cache

export async function GET() {
  try {
    // Return cached data if it's still fresh
    if (cachedCryptoData && cryptoCacheTime && (Date.now() - cryptoCacheTime < CRYPTO_CACHE_DURATION)) {
      return NextResponse.json(cachedCryptoData);
    }

    // Fetch fresh data from CoinGecko
    const response = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,solana&vs_currencies=usd&include_24hr_change=true"
    );
    const data = await response.json();

    const cryptoMarketData = [];
    
    if (data.bitcoin) {
      cryptoMarketData.push({
        name: "Bitcoin",
        symbol: "BTC",
        price: data.bitcoin.usd,
        changePercent: data.bitcoin.usd_24h_change,
      });
    }
    
    if (data.ethereum) {
      cryptoMarketData.push({
        name: "Ethereum",
        symbol: "ETH",
        price: data.ethereum.usd,
        changePercent: data.ethereum.usd_24h_change,
      });
    }
    
    if (data.solana) {
      cryptoMarketData.push({
        name: "Solana",
        symbol: "SOL",
        price: data.solana.usd,
        changePercent: data.solana.usd_24h_change,
      });
    }

    // Cache the fresh data
    cachedCryptoData = cryptoMarketData;
    cryptoCacheTime = Date.now();
    
    return NextResponse.json(cryptoMarketData);
  } catch (error) {
    console.error('Error fetching crypto data:', error);
    // Return cached data if available, even if stale
    if (cachedCryptoData) {
      return NextResponse.json(cachedCryptoData);
    }
    // Return fallback data instead of error to prevent JSON parse errors
    const fallbackData = [
      { name: "Bitcoin", symbol: "BTC", price: 60000, changePercent: 2.5 },
      { name: "Ethereum", symbol: "ETH", price: 3000, changePercent: 3.1 },
      { name: "Solana", symbol: "SOL", price: 100, changePercent: 5.2 }
    ];
    return NextResponse.json(fallbackData);
  }
}