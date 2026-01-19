import { NextResponse } from 'next/server';

// Cache for whale data (15 minute TTL)
let cache = {
  data: null,
  timestamp: 0,
  TTL: 15 * 60 * 1000 // 15 minutes
};

export async function GET() {
  try {
    // Return cached data if still valid
    const now = Date.now();
    if (cache.data && (now - cache.timestamp) < cache.TTL) {
      return NextResponse.json({ ...cache.data, cached: true });
    }

    // Fetch whale activity data in parallel
    const [whaleAlertData, exchangeFlowData] = await Promise.allSettled([
      fetchWhaleAlertData(),
      fetchExchangeFlowData()
    ]);

    const whaleTransactions = whaleAlertData.status === 'fulfilled' ? whaleAlertData.value : null;
    const exchangeFlow = exchangeFlowData.status === 'fulfilled' ? exchangeFlowData.value : null;

    // Determine whale activity based on exchange flows
    let activity = 'Unknown';
    let confidence = 0;

    if (exchangeFlow) {
      const { netFlow, inflow, outflow } = exchangeFlow;

      if (netFlow < -1000) {
        // Large outflow = accumulation (moving to cold storage)
        activity = 'Accumulating';
        confidence = Math.min(100, Math.abs(netFlow) / 50);
      } else if (netFlow > 1000) {
        // Large inflow = distribution (moving to exchanges to sell)
        activity = 'Distributing';
        confidence = Math.min(100, netFlow / 50);
      } else {
        activity = 'Normal';
        confidence = 50;
      }
    }

    const responseData = {
      activity,
      confidence: Math.round(confidence),
      exchangeFlow,
      recentTransactions: whaleTransactions?.slice(0, 5) || [],
      source: exchangeFlow ? 'exchange_flow' : (whaleTransactions ? 'whale_alert' : 'unavailable'),
      timestamp: now
    };

    // Update cache
    cache.data = responseData;
    cache.timestamp = now;

    return NextResponse.json(responseData);

  } catch (error) {
    console.error('[Whale API] Error:', error);

    if (cache.data) {
      return NextResponse.json({ ...cache.data, cached: true, stale: true });
    }

    return NextResponse.json({
      activity: 'Unknown',
      confidence: 0,
      source: 'error',
      error: 'Failed to fetch whale data'
    }, { status: 500 });
  }
}

// Fetch data from Whale Alert API (requires API key)
async function fetchWhaleAlertData() {
  const apiKey = process.env.WHALE_ALERT_API_KEY;

  if (!apiKey) {
    console.log('[Whale API] No Whale Alert API key configured');
    return null;
  }

  try {
    // Get transactions from last hour
    const since = Math.floor((Date.now() - 3600000) / 1000);
    const response = await fetch(
      `https://api.whale-alert.io/v1/transactions?api_key=${apiKey}&min_value=1000000&start=${since}&currency=btc,eth`,
      { next: { revalidate: 900 } }
    );

    if (!response.ok) {
      throw new Error(`Whale Alert API error: ${response.status}`);
    }

    const data = await response.json();

    if (data.transactions && data.transactions.length > 0) {
      return data.transactions.map(tx => ({
        hash: tx.hash,
        amount: tx.amount,
        amountUsd: tx.amount_usd,
        from: tx.from?.owner_type || 'unknown',
        to: tx.to?.owner_type || 'unknown',
        symbol: tx.symbol,
        timestamp: tx.timestamp
      }));
    }

    return [];
  } catch (error) {
    console.error('[Whale API] Whale Alert fetch failed:', error.message);
    return null;
  }
}

// Fetch exchange flow data from CryptoQuant or similar
async function fetchExchangeFlowData() {
  // Try multiple sources for exchange flow data

  // Option 1: Try Glassnode (requires API key)
  const glassnodeKey = process.env.GLASSNODE_API_KEY;
  if (glassnodeKey) {
    try {
      const response = await fetch(
        `https://api.glassnode.com/v1/metrics/transactions/transfers_volume_exchanges_net?a=BTC&api_key=${glassnodeKey}`,
        { next: { revalidate: 900 } }
      );

      if (response.ok) {
        const data = await response.json();
        const latest = data[data.length - 1];

        return {
          netFlow: latest.v, // Positive = inflow to exchanges, Negative = outflow
          inflow: latest.v > 0 ? latest.v : 0,
          outflow: latest.v < 0 ? Math.abs(latest.v) : 0,
          source: 'glassnode'
        };
      }
    } catch (error) {
      console.log('[Whale API] Glassnode fetch failed:', error.message);
    }
  }

  // Option 2: Try CoinGlass exchange flow (public API)
  try {
    const response = await fetch(
      'https://open-api.coinglass.com/public/v2/indicator/exchange_netflow?symbol=BTC&interval=h1',
      {
        headers: {
          'accept': 'application/json'
        }
      }
    );

    if (response.ok) {
      const data = await response.json();

      if (data.data && data.data.length > 0) {
        // Get last 24 hours of data to calculate net flow
        const recentData = data.data.slice(-24);
        const totalNetFlow = recentData.reduce((sum, item) => sum + (item.netflow || 0), 0);

        return {
          netFlow: totalNetFlow,
          inflow: recentData.reduce((sum, item) => sum + Math.max(0, item.netflow || 0), 0),
          outflow: Math.abs(recentData.reduce((sum, item) => sum + Math.min(0, item.netflow || 0), 0)),
          source: 'coinglass'
        };
      }
    }
  } catch (error) {
    console.log('[Whale API] CoinGlass fetch failed:', error.message);
  }

  // Option 3: Try to estimate from Binance large trades
  try {
    const response = await fetch(
      'https://fapi.binance.com/fapi/v1/aggTrades?symbol=BTCUSDT&limit=100'
    );

    if (response.ok) {
      const trades = await response.json();

      // Analyze large trades (> $100k)
      let buyVolume = 0;
      let sellVolume = 0;

      trades.forEach(trade => {
        const value = parseFloat(trade.p) * parseFloat(trade.q);
        if (value > 100000) {
          if (trade.m) { // Maker is buyer = sell order
            sellVolume += value;
          } else {
            buyVolume += value;
          }
        }
      });

      const netFlow = (sellVolume - buyVolume) / 1000000; // Convert to millions

      return {
        netFlow: netFlow,
        inflow: sellVolume / 1000000,
        outflow: buyVolume / 1000000,
        source: 'binance_trades'
      };
    }
  } catch (error) {
    console.log('[Whale API] Binance trades fetch failed:', error.message);
  }

  return null;
}
