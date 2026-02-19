import { db } from '@/lib/firebaseServer'
import { doc, getDoc } from 'firebase/firestore'

export async function GET() {
  try {
    const docSnap = await getDoc(doc(db, 'market', 'rl80-price'))

    if (!docSnap.exists()) {
      return Response.json(
        { price: null, priceChange24h: 0, ohlcv: [], candles: [], error: 'No price data yet' },
        { status: 404 }
      )
    }

    const data = docSnap.data()

    if (data.success === false) {
      return Response.json(
        { price: null, priceChange24h: 0, ohlcv: [], candles: [], error: 'Price data temporarily unavailable' },
        { status: 503 }
      )
    }

    return Response.json({
      price: data.price,
      priceChange24h: data.priceChange24h,
      fdv: data.fdv,
      liquidity: data.liquidity,
      ohlcv: data.ohlcv || [],
      candles: data.candles || [],
      timeframe: data.timeframe,
      timestamp: data.updatedAt,
    })
  } catch (err) {
    console.error('RL80 price read error:', err)
    return Response.json(
      { price: null, priceChange24h: 0, ohlcv: [], candles: [], error: 'fetch failed' },
      { status: 502 }
    )
  }
}
