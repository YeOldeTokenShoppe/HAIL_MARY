import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const apiKey = process.env.NEXT_PUBLIC_COINMARKETCAP;
    
    if (!apiKey) {
      return NextResponse.json({ error: 'API key not configured' }, { status: 500 });
    }

    // CoinMarketCap Fear & Greed endpoint - get latest value
    const response = await fetch('https://pro-api.coinmarketcap.com/v3/fear-and-greed/latest', {
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
    
    // Log the response structure to understand the format
    console.log('CMC Fear & Greed response:', JSON.stringify(data, null, 2));
    
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching Fear & Greed:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}