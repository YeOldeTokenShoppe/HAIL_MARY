import { NextResponse } from 'next/server'
import { db } from '@/lib/firebaseServer'
import { doc, setDoc } from 'firebase/firestore'

const POOL_ADDRESS = '0x40d827aCDBEfd8Ef46953e2b1AC87b8697b82203'
const GECKO_BASE = 'https://api.geckoterminal.com/api/v2/networks/base/pools'

export async function GET(request) {
  try {
    // Verify this is coming from Vercel Cron
    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('Cron job: Fetching RL80 price from GeckoTerminal...')

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

    // Check for rate limiting
    if (poolRes.status === 429) {
      console.log('GeckoTerminal rate limited, will retry next cron run')
      return NextResponse.json({ error: 'Rate limited' }, { status: 429 })
    }

    const poolJson = await poolRes.json()
    const dailyJson = await dailyRes.json()
    const hourlyJson = await hourlyRes.json()
    const minuteJson = await minuteRes.json()

    const pool = poolJson?.data?.attributes || {}
    const dailyList = dailyJson?.data?.attributes?.ohlcv_list || []
    const hourlyList = hourlyJson?.data?.attributes?.ohlcv_list || []
    const minuteList = minuteJson?.data?.attributes?.ohlcv_list || []

    const ohlcvList = dailyList.length >= 10 ? dailyList :
                      hourlyList.length >= 10 ? hourlyList :
                      minuteList.length > 0 ? minuteList : hourlyList

    const price = parseFloat(pool.base_token_price_usd) || null
    const priceChange24h = parseFloat(pool.price_change_percentage?.h24) || 0
    const fdv = parseFloat(pool.fdv_usd) || null
    const liquidity = parseFloat(pool.reserve_in_usd) || null

    const ohlcv = ohlcvList.map(([ts, , , , close]) => ({
      time: Math.floor(ts),
      value: close,
    })).sort((a, b) => a.time - b.time)

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
      updatedAt: new Date().toISOString(),
      success: true,
    }

    // Store in Firestore
    await setDoc(doc(db, 'market', 'rl80-price'), result)

    console.log(`RL80 price updated: $${price}`)

    return NextResponse.json({
      success: true,
      price,
      timestamp: result.updatedAt,
    })
  } catch (error) {
    console.error('Cron job error (rl80-price):', error)

    try {
      await setDoc(doc(db, 'market', 'rl80-price'), {
        error: error.message,
        updatedAt: new Date().toISOString(),
        success: false,
      }, { merge: true })
    } catch (fsErr) {
      console.error('Failed to save error to Firestore:', fsErr)
    }

    return NextResponse.json({
      error: 'Cron job failed',
      message: error.message,
    }, { status: 500 })
  }
}
