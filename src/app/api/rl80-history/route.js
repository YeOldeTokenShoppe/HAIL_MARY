const POOL_ADDRESS = '0x40d827aCDBEfd8Ef46953e2b1AC87b8697b82203'
const GECKO_POOL = `https://api.geckoterminal.com/api/v2/networks/base/pools/${POOL_ADDRESS}`
const CG_ETH_OHLC = 'https://api.coingecko.com/api/v3/coins/ethereum/ohlc'

// CoinGecko OHLC granularity by `days` param:
//   days=1     → 30-minute candles (~48)
//   days=7/14  → 4-hour candles
//   days=30+   → 4-day candles
const ALLOWED_DAYS = new Set([1, 7, 14, 30, 90, 180, 365])

const REVALIDATE_BY_DAYS = {
  1: 60,     // 1min stale OK for 30m candles
  7: 300,
  14: 600,
  30: 1800,
  90: 3600,
  180: 3600,
  365: 3600,
}

export async function GET(request) {
  try {
    const url = new URL(request.url)
    const daysRaw = parseInt(url.searchParams.get('days') || '1', 10) || 1
    const days = ALLOWED_DAYS.has(daysRaw) ? daysRaw : 1
    const revalidate = REVALIDATE_BY_DAYS[days] ?? 300

    const [poolRes, ohlcRes] = await Promise.all([
      fetch(GECKO_POOL, {
        headers: { Accept: 'application/json' },
        next: { revalidate },
      }),
      fetch(`${CG_ETH_OHLC}?vs_currency=usd&days=${days}`, {
        headers: { Accept: 'application/json' },
        next: { revalidate },
      }),
    ])

    if (poolRes.status === 429 || ohlcRes.status === 429) {
      return Response.json(
        { candles: [], error: 'Rate limited' },
        { status: 429 },
      )
    }

    const poolJson = await poolRes.json().catch(() => ({}))
    const ohlcJson = await ohlcRes.json().catch(() => [])

    const pool = poolJson?.data?.attributes || {}
    const priceUsd = parseFloat(pool.base_token_price_usd) || null
    const priceChange24h = parseFloat(pool.price_change_percentage?.h24) || 0
    const ratio = parseFloat(pool.base_token_price_native_currency) || null

    const ethCandles = Array.isArray(ohlcJson) ? ohlcJson : []

    // scale ETH/USD candle → RL80/USD candle via RL80-per-ETH ratio
    const candles = ratio
      ? ethCandles
          .map(([tsMs, open, high, low, close]) => ({
            time: Math.floor(tsMs / 1000),
            open: open * ratio,
            high: high * ratio,
            low: low * ratio,
            close: close * ratio,
            volume: 0,
          }))
          .filter((c) =>
            [c.open, c.high, c.low, c.close].every(
              (v) => Number.isFinite(v) && v > 0,
            ),
          )
          .sort((a, b) => a.time - b.time)
      : []

    // fall back to candle-derived 24h change when pool reports 0 (illiquid)
    let change24h = priceChange24h
    if (!change24h && candles.length >= 2) {
      const first = candles[0].open
      const last = candles[candles.length - 1].close
      if (first > 0) change24h = ((last - first) / first) * 100
    }

    return Response.json({
      price: priceUsd,
      priceChange24h: change24h,
      fdv: parseFloat(pool.fdv_usd) || null,
      liquidity: parseFloat(pool.reserve_in_usd) || null,
      candles,
      timeframe: days === 1 ? '30m' : days <= 14 ? '4h' : '4d',
      days,
      source: 'eth-scaled',
      timestamp: new Date().toISOString(),
    })
  } catch (err) {
    console.error('rl80-history error:', err)
    return Response.json(
      { candles: [], error: err.message || 'fetch failed' },
      { status: 502 },
    )
  }
}
