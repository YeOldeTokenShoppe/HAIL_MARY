import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const apiKey = process.env.NEXT_PUBLIC_COINMARKETCAP;
    
    if (!apiKey) {
      return NextResponse.json({ error: 'API key not configured' }, { status: 500 });
    }

    // CoinMarketCap Bitcoin, Ethereum, and PEPE price endpoint
    const response = await fetch('https://pro-api.coinmarketcap.com/v1/cryptocurrency/quotes/latest?symbol=BTC,ETH,PEPE', {
      method: 'GET',
      headers: {
        'X-CMC_PRO_API_KEY': apiKey,
        'Accept': 'application/json',
      }
    });

    if (!response.ok) {
      console.error('CMC API error:', response.status, response.statusText);
      return NextResponse.json({ error: 'Failed to fetch from CoinMarketCap' }, { status: response.status });
    }

    const data = await response.json();
    
    // Extract BTC, ETH, and PEPE prices
    const btcData = data.data.BTC;
    const ethData = data.data.ETH;
    const pepeData = data.data.PEPE;
    
    const btcPrice = btcData.quote.USD.price;
    const ethPrice = ethData.quote.USD.price;
    const pepePrice = pepeData.quote.USD.price;
    
    const formattedBtcPrice = `$${Math.round(btcPrice).toLocaleString()}`;
    const formattedEthPrice = `$${Math.round(ethPrice).toLocaleString()}`;
    const formattedPepePrice = `$${pepePrice.toFixed(8)}`; // PEPE price is very small, so show more decimals
    
    return NextResponse.json({ 
      btc: formattedBtcPrice,
      eth: formattedEthPrice,
      pepe: formattedPepePrice
    });
  } catch (error) {
    console.error('Error fetching BTC price:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}