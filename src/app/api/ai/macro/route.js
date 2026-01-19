import { NextResponse } from 'next/server';

// Cache for macro data (30 minute TTL)
let cache = {
  data: null,
  timestamp: 0,
  TTL: 30 * 60 * 1000 // 30 minutes
};

export async function GET() {
  try {
    // Return cached data if still valid
    const now = Date.now();
    if (cache.data && (now - cache.timestamp) < cache.TTL) {
      return NextResponse.json({ ...cache.data, cached: true });
    }

    const finnhubKey = process.env.NEXT_PUBLIC_FINNHUB;
    const alphaVantageKey = process.env.NEXT_PUBLIC_ALPHA_VANTAGE_API_KEY;
    const lighterBaseUrl = process.env.NEXT_PUBLIC_LIGHTER_BASE_URL;

    // Fetch all data in parallel (4 logical requests, batched where possible)
    const [finnhubData, treasuryData, fundingData, oiData] = await Promise.allSettled([
      // Batch all Finnhub quotes (VIXY, SPY, UUP) - 3 API calls but grouped
      fetchFinnhubBatch(finnhubKey),
      // 10Y Treasury from Alpha Vantage
      fetchTreasuryYield(alphaVantageKey),
      // Funding rates from Lighter DEX
      fetchLighterFundingRates(lighterBaseUrl),
      // Open Interest from Lighter DEX
      fetchLighterOpenInterest(lighterBaseUrl)
    ]);

    const finnhub = extractResult(finnhubData, {
      vix: { value: 18.5, change: 0, changePercent: 0 },
      spx: { value: 585, change: 0, changePercent: 0 },
      dxy: { value: 28.5, change: 0, changePercent: 0 }
    });

    const macroData = {
      vix: finnhub.vix,
      spx: finnhub.spx,
      dxy: finnhub.dxy,
      treasury10y: extractResult(treasuryData, { value: 4.5, change: 0 }),
      funding: extractResult(fundingData, { btc: 0, eth: 0 }),
      openInterest: extractResult(oiData, { btc: 0, eth: 0, total: 0 }),
      timestamp: now,
      source: 'finnhub/alphavantage/lighter'
    };

    // Update cache
    cache.data = macroData;
    cache.timestamp = now;

    return NextResponse.json(macroData);
  } catch (error) {
    console.error('[Macro API] Error:', error);

    // Return cached data if available, even if stale
    if (cache.data) {
      return NextResponse.json({ ...cache.data, cached: true, stale: true });
    }

    return NextResponse.json({ error: 'Failed to fetch macro data' }, { status: 500 });
  }
}

// Fetch real VIX index from Yahoo Finance
async function fetchRealVIX() {
  try {
    const response = await fetch(
      'https://query1.finance.yahoo.com/v8/finance/chart/%5EVIX?interval=1d&range=1d',
      {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        next: { revalidate: 300 } // Cache for 5 min
      }
    );

    if (response.ok) {
      const data = await response.json();
      const quote = data.chart?.result?.[0]?.meta;
      if (quote) {
        const currentPrice = quote.regularMarketPrice || 0;
        const previousClose = quote.previousClose || currentPrice;
        const change = currentPrice - previousClose;
        const changePercent = previousClose ? (change / previousClose) * 100 : 0;

        return {
          value: parseFloat(currentPrice.toFixed(2)),
          change: parseFloat(change.toFixed(2)),
          changePercent: parseFloat(changePercent.toFixed(2))
        };
      }
    }
  } catch (err) {
    console.error('[Macro API] Yahoo VIX error:', err.message);
  }
  return null;
}

// Batch fetch Finnhub quotes (SPY, UUP) + Yahoo for VIX
async function fetchFinnhubBatch(apiKey) {
  const results = { vix: null, spx: null, dxy: null };

  // Fetch real VIX from Yahoo Finance (free, actual index value)
  results.vix = await fetchRealVIX();

  if (!apiKey) {
    console.warn('Finnhub API key not configured, using VIX only');
    return {
      vix: results.vix || { value: 18.5, change: 0, changePercent: 0 },
      spx: { value: 585, change: 0, changePercent: 0 },
      dxy: { value: 103, change: 0, changePercent: 0 }
    };
  }

  // Fetch SPY and UUP from Finnhub
  const symbols = ['SPY', 'UUP'];

  for (const symbol of symbols) {
    try {
      const response = await fetch(
        `https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${apiKey}`,
        { next: { revalidate: 1800 } } // Cache for 30 min
      );

      if (response.ok) {
        const data = await response.json();
        const quote = {
          value: data.c || 0,
          change: data.d || 0,
          changePercent: data.dp || 0
        };

        if (symbol === 'SPY') results.spx = quote;
        else if (symbol === 'UUP') results.dxy = quote;
      }
    } catch (err) {
      console.error(`[Macro API] Finnhub ${symbol} error:`, err.message);
    }
  }

  // Use fallbacks for any failed fetches
  return {
    vix: results.vix || { value: 18.5, change: 0, changePercent: 0 },
    spx: results.spx || { value: 585, change: 0, changePercent: 0 },
    dxy: results.dxy || { value: 103, change: 0, changePercent: 0 }
  };
}

// Fetch 10Y Treasury yield from Alpha Vantage
async function fetchTreasuryYield(apiKey) {
  if (!apiKey) {
    throw new Error('Alpha Vantage API key not configured');
  }

  const response = await fetch(
    `https://www.alphavantage.co/query?function=TREASURY_YIELD&interval=daily&maturity=10year&apikey=${apiKey}`,
    { next: { revalidate: 900 } }
  );

  if (!response.ok) {
    throw new Error(`Alpha Vantage error: ${response.status}`);
  }

  const data = await response.json();

  // Alpha Vantage returns data array with date and value
  if (data.data && data.data.length >= 2) {
    const latest = parseFloat(data.data[0].value);
    const previous = parseFloat(data.data[1].value);
    return {
      value: latest,
      change: (latest - previous).toFixed(2),
      previousValue: previous
    };
  }

  throw new Error('Invalid Treasury data format');
}

// Fetch funding rates from Lighter DEX
async function fetchLighterFundingRates(baseUrl) {
  if (!baseUrl) {
    throw new Error('Lighter base URL not configured');
  }

  const response = await fetch(
    `${baseUrl}/api/v1/funding-rates`,
    {
      headers: {
        'Accept': 'application/json'
      },
      next: { revalidate: 900 }
    }
  );

  if (!response.ok) {
    throw new Error(`Lighter API error: ${response.status}`);
  }

  const data = await response.json();

  // Lighter API returns: { code: 200, funding_rates: [{exchange, symbol, rate, market_id}, ...] }
  // Filter for exchange: "lighter" to get the DEX's own rates
  const rates = { btc: 0, eth: 0 };

  if (data && data.funding_rates && Array.isArray(data.funding_rates)) {
    data.funding_rates
      .filter(item => item.exchange === 'lighter')
      .forEach(item => {
        const symbol = (item.symbol || '').toUpperCase();
        const rate = parseFloat(item.rate || 0);

        if (symbol === 'BTC') {
          rates.btc = rate;
        } else if (symbol === 'ETH') {
          rates.eth = rate;
        }
      });
  }

  return {
    btc: rates.btc,
    eth: rates.eth
  };
}

// Fetch Open Interest from Lighter DEX orderBookDetails
async function fetchLighterOpenInterest(baseUrl) {
  if (!baseUrl) {
    throw new Error('Lighter base URL not configured');
  }

  // Fetch BTC market details (includes ETH as well in response)
  const response = await fetch(
    `${baseUrl}/api/v1/orderBookDetails?market=BTC`,
    {
      headers: {
        'Accept': 'application/json'
      },
      next: { revalidate: 900 }
    }
  );

  if (!response.ok) {
    throw new Error(`Lighter orderBookDetails API error: ${response.status}`);
  }

  const data = await response.json();

  // Parse Open Interest from order book details
  // Response: { order_book_details: [{symbol, open_interest, last_trade_price, ...}] }
  const oi = { btc: 0, eth: 0, total: 0 };

  if (data && data.order_book_details && Array.isArray(data.order_book_details)) {
    data.order_book_details.forEach(market => {
      const symbol = (market.symbol || '').toUpperCase();
      const openInterestNative = parseFloat(market.open_interest || 0);
      const price = parseFloat(market.last_trade_price || 0);
      const openInterestUSD = openInterestNative * price;

      if (symbol === 'BTC') {
        oi.btc = openInterestUSD;
      } else if (symbol === 'ETH') {
        oi.eth = openInterestUSD;
      }
    });

    oi.total = oi.btc + oi.eth;
  }

  return oi;
}

// Helper to extract result from Promise.allSettled
function extractResult(settledResult, fallback) {
  if (settledResult.status === 'fulfilled') {
    return settledResult.value;
  }
  console.error('[Macro API] Fetch failed:', settledResult.reason);
  return fallback;
}
