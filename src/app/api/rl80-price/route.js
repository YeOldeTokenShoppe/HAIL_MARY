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
    const [poolRes, ohlcvRes] = await Promise.all([
      fetch(`${GECKO_BASE}/${POOL_ADDRESS}`, {
        headers: { Accept: 'application/json' },
      }),
      fetch(`${GECKO_BASE}/${POOL_ADDRESS}/ohlcv/day?aggregate=1&limit=30`, {
        headers: { Accept: 'application/json' },
      }),
    ])

    const poolJson = await poolRes.json()
    const ohlcvJson = await ohlcvRes.json()

    const pool = poolJson?.data?.attributes || {}
    const ohlcvList = ohlcvJson?.data?.attributes?.ohlcv_list || []

    const price = parseFloat(pool.base_token_price_usd) || null
    const priceChange24h = parseFloat(pool.price_change_percentage?.h24) || 0
    const fdv = parseFloat(pool.fdv_usd) || null
    const liquidity = parseFloat(pool.reserve_in_usd) || null

    // Convert OHLCV from [timestamp, o, h, l, c, v] to {time, value} for area chart
    const ohlcv = ohlcvList.map(([ts, , , , close]) => ({
      time: Math.floor(ts),
      value: close,
    })).sort((a, b) => a.time - b.time)

    const result = {
      price,
      priceChange24h,
      fdv,
      liquidity,
      ohlcv,
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
