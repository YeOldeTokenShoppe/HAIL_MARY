const POOL_ADDRESS = '0x40d827aCDBEfd8Ef46953e2b1AC87b8697b82203'
const GECKO_BASE = 'https://api.geckoterminal.com/api/v2/networks/base/pools'

let cache = { data: null, ts: 0 }
const CACHE_TTL = 60_000 // 1 minute

export async function GET() {
  const now = Date.now()
  if (cache.data && now - cache.ts < CACHE_TTL) {
    return Response.json(cache.data)
  }

  try {
    // Fetch pool data and OHLCV at multiple timeframes
    const [poolRes, dailyRes, hourlyRes, minuteRes] = await Promise.all([
      fetch(`${GECKO_BASE}/${POOL_ADDRESS}`, {
        headers: { Accept: 'application/json' },
      }),
      fetch(`${GECKO_BASE}/${POOL_ADDRESS}/ohlcv/day?aggregate=1&limit=90`, {
        headers: { Accept: 'application/json' },
      }),
      fetch(`${GECKO_BASE}/${POOL_ADDRESS}/ohlcv/hour?aggregate=1&limit=168`, {
        headers: { Accept: 'application/json' },
      }),
      fetch(`${GECKO_BASE}/${POOL_ADDRESS}/ohlcv/minute?aggregate=15&limit=96`, {
        headers: { Accept: 'application/json' },
      }),
    ])

    const poolJson = await poolRes.json()
    const dailyJson = await dailyRes.json()
    const hourlyJson = await hourlyRes.json()
    const minuteJson = await minuteRes.json()

    const pool = poolJson?.data?.attributes || {}
    const dailyList = dailyJson?.data?.attributes?.ohlcv_list || []
    const hourlyList = hourlyJson?.data?.attributes?.ohlcv_list || []
    const minuteList = minuteJson?.data?.attributes?.ohlcv_list || []

    // Pick the best timeframe: daily if 10+, hourly if 10+, else 15-min candles
    const ohlcvList = dailyList.length >= 10 ? dailyList :
                      hourlyList.length >= 10 ? hourlyList :
                      minuteList.length > 0 ? minuteList : hourlyList

    const price = parseFloat(pool.base_token_price_usd) || null
    const priceChange24h = parseFloat(pool.price_change_percentage?.h24) || 0
    const fdv = parseFloat(pool.fdv_usd) || null
    const liquidity = parseFloat(pool.reserve_in_usd) || null

    // Convert OHLCV from [timestamp, o, h, l, c, v] to {time, value} for area chart
    const ohlcv = ohlcvList.map(([ts, , , , close]) => ({
      time: Math.floor(ts),
      value: close,
    })).sort((a, b) => a.time - b.time)

    // Full candle data for candlestick charts
    const candles = ohlcvList.map(([ts, open, high, low, close, volume]) => ({
      time: Math.floor(ts / 1000),
      open,
      high,
      low,
      close,
      volume: volume || 0,
    })).sort((a, b) => a.time - b.time)

    const result = {
      price,
      priceChange24h,
      fdv,
      liquidity,
      ohlcv,
      candles,
      timeframe: dailyList.length >= 10 ? 'daily' :
                 hourlyList.length >= 10 ? 'hourly' :
                 minuteList.length > 0 ? '15m' : 'hourly',
      timestamp: new Date().toISOString(),
    }

    cache = { data: result, ts: now }
    return Response.json(result)
  } catch (err) {
    console.error('RL80 price fetch error:', err)
    if (cache.data) return Response.json(cache.data)
    return Response.json(
      { price: null, priceChange24h: 0, ohlcv: [], error: 'fetch failed' },
      { status: 502 }
    )
  }
}
