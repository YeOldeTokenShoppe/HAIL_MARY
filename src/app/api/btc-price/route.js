import { NextResponse } from 'next/server';

// All tradeable assets to fetch in a single batched call
const TRADEABLE_SYMBOLS = 'BTC,ETH,SOL,XRP';

export async function GET() {
  try {
    const apiKey = process.env.COINMARKETCAP_API_KEY;

    if (!apiKey) {
      return NextResponse.json({ error: 'API key not configured' }, { status: 500 });
    }

    // CoinMarketCap - fetch all tradeable assets in a single batched call.
    // Cache the upstream response for 60s so bursts of visitors reuse one
    // CMC call instead of burning a credit each — prices are fine at 1-min granularity.
    const response = await fetch(`https://pro-api.coinmarketcap.com/v1/cryptocurrency/quotes/latest?symbol=${TRADEABLE_SYMBOLS}`, {
      method: 'GET',
      headers: {
        'X-CMC_PRO_API_KEY': apiKey,
        'Accept': 'application/json',
      },
      next: { revalidate: 60 },
    });

    if (!response.ok) {
      console.error('CMC API error:', response.status, response.statusText);
      return NextResponse.json({ error: 'Failed to fetch from CoinMarketCap' }, { status: response.status });
    }

    const data = await response.json();

    // Extract all asset data from batched response
    const btcData = data.data.BTC;
    const ethData = data.data.ETH;
    const solData = data.data.SOL;
    const xrpData = data.data.XRP;

    // Build response with all assets
    const result = {
      btc: formatPrice(btcData?.quote?.USD?.price, 0),
      eth: formatPrice(ethData?.quote?.USD?.price, 0),
      sol: formatPrice(solData?.quote?.USD?.price, 2),
      xrp: formatPrice(xrpData?.quote?.USD?.price, 4),
      // Raw prices for agents
      prices: {
        BTC: btcData?.quote?.USD?.price || 0,
        ETH: ethData?.quote?.USD?.price || 0,
        SOL: solData?.quote?.USD?.price || 0,
        XRP: xrpData?.quote?.USD?.price || 0
      },
      // 24h changes
      changes: {
        BTC: btcData?.quote?.USD?.percent_change_24h || 0,
        ETH: ethData?.quote?.USD?.percent_change_24h || 0,
        SOL: solData?.quote?.USD?.percent_change_24h || 0,
        XRP: xrpData?.quote?.USD?.percent_change_24h || 0
      }
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error fetching prices:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

function formatPrice(price, decimals) {
  if (!price) return '$0';
  if (decimals === 0) {
    return `$${Math.round(price).toLocaleString()}`;
  }
  return `$${price.toFixed(decimals)}`;
}