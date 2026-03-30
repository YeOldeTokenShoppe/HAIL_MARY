import React, { useState, useEffect, useRef, useCallback } from 'react'
import './TickerCard.css'

const PRICE_API = '/api/rl80-price'

function formatPrice(n) {
  if (n == null) return '—'
  if (n < 0.000000001) return '$' + n.toFixed(12)
  if (n < 0.0000001) return '$' + n.toFixed(10)
  if (n < 0.0001) return '$' + n.toFixed(9)
  if (n < 0.01) return '$' + n.toFixed(6)
  if (n < 1) return '$' + n.toFixed(4)
  return '$' + n.toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatCompact(n) {
  if (n == null) return '—'
  if (n >= 1e12) return '$' + (n / 1e12).toFixed(2) + 'T'
  if (n >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B'
  if (n >= 1e6) return '$' + (n / 1e6).toFixed(2) + 'M'
  if (n >= 1e3) return '$' + (n / 1e3).toFixed(1) + 'K'
  return '$' + n.toFixed(0)
}

// Generate a seeded price path for chart visualization
function seededRng(seed) {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff
    return (s >>> 0) / 0xffffffff
  }
}

function genPath(price, change, seed = 42) {
  const rng = seededRng(seed)
  const n = 60
  const pts = []
  let v = price * (1 - 0.04 - rng() * 0.04)
  const drift = (change / 100) / n
  for (let i = 0; i < n; i++) {
    v += v * drift + v * (rng() - 0.5) * 0.02
    pts.push(v)
  }
  pts.push(price)
  return pts
}

function ptsToCoords(pts, W, H, pad = 8) {
  const mn = Math.min(...pts)
  const mx = Math.max(...pts)
  const range = mx - mn || 1
  return pts.map((p, i) => {
    const x = (i / (pts.length - 1)) * W
    const y = pad + (1 - (p - mn) / range) * (H - pad * 2)
    return [x, y]
  })
}

export default function TickerCard() {
  const [data, setData] = useState(null)
  const [error, setError] = useState(false)
  const svgRef = useRef(null)
  const wrapRef = useRef(null)

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(PRICE_API)
      const json = await res.json()

      if (json.price != null) {
        const price = parseFloat(json.price)
        const change24h = parseFloat(json.priceChange24h || 0)
        const candles = json.candles || json.ohlcv || []

        // Extract high/low from candle data if available
        let high24h = price
        let low24h = price
        if (candles.length > 0) {
          high24h = Math.max(...candles.map(c => parseFloat(c.high || c[2] || price)))
          low24h = Math.min(...candles.map(c => parseFloat(c.low || c[3] || price)))
        }

        setData({
          price,
          change24h,
          volume: 0,
          tvl: parseFloat(json.liquidity || 0),
          high24h,
          low24h,
          fdv: parseFloat(json.fdv || 0),
          name: 'Our Lady of Perpetual Profit',
          symbol: 'RL80',
          candles,
        })
        setError(false)
        return
      }
    } catch {
      // API unavailable
    }

    // Fallback with last known price
    setData({
      price: 0.0000000321,
      change24h: 0.08,
      volume: 0,
      tvl: 0,
      high24h: 0.0000000328,
      low24h: 0.0000000316,
      name: 'Our Lady of Perpetual Profit',
      symbol: 'RL80',
      isFallback: true,
    })
    setError(false)
  }, [])

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 30000) // refresh every 30s
    return () => clearInterval(interval)
  }, [fetchData])

  // Draw chart
  const chartW = 240
  const chartH = 120

  let chartSvg = null
  if (data) {
    const pts = genPath(data.price, data.change24h)
    const coords = ptsToCoords(pts, chartW, chartH)
    const isUp = data.change24h >= 0
    const color = isUp ? '#caff00' : '#ff2d78'
    const gradId = 'rl80grad'

    const d = coords.map((c, i) => (i === 0 ? `M${c[0]},${c[1]}` : `L${c[0]},${c[1]}`)).join(' ')
    const last = coords[coords.length - 1]

    chartSvg = (
      <svg ref={svgRef} viewBox={`0 0 ${chartW} ${chartH}`} preserveAspectRatio="none" className="ticker-card__svg">
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.22" />
            <stop offset="75%" stopColor={color} stopOpacity="0.04" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
          <filter id="chartGlow">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>
        {/* grid lines */}
        {[0.25, 0.5, 0.75].map(y => (
          <line key={y} x1="0" y1={y * chartH} x2={chartW} y2={y * chartH} stroke="rgba(255,255,255,0.04)" strokeWidth="1" />
        ))}
        {/* fill */}
        <path d={`${d} L${last[0]},${chartH} L0,${chartH} Z`} fill={`url(#${gradId})`} />
        {/* line */}
        <path d={d} fill="none" stroke={color} strokeWidth="2" opacity="0.9" filter="url(#chartGlow)" />
        {/* live dot */}
        <circle cx={last[0]} cy={last[1]} r="3" fill={color} opacity="0.95" />
        <circle cx={last[0]} cy={last[1]} r="7" fill="none" stroke={color} strokeWidth="1" opacity="0.3">
          <animate attributeName="r" values="4;9;4" dur="2s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.4;0;0.4" dur="2s" repeatCount="indefinite" />
        </circle>
      </svg>
    )
  }

  const isUp = data?.change24h >= 0

  return (
    <div className="ticker-card">
      {/* Header */}
      <div className="ticker-card__hdr">
        <div className="ticker-card__left">
          <div className="ticker-card__icon">RL</div>
          <div>
            <div className="ticker-card__sym">{data?.symbol || 'RL80'}</div>
            <div className="ticker-card__name">
              <span className="ticker-card__live-dot" />
              Live
            </div>
          </div>
        </div>
        <div className="ticker-card__right">
          <div className="ticker-card__price" style={{ color: isUp ? '#caff00' : '#ff2d78' }}>
            {data ? formatPrice(data.price) : '—'}
          </div>
          {data && (
            <div className={`ticker-card__delta ${isUp ? 'up' : 'down'}`}>
              {isUp ? '▲' : '▼'} {isUp ? '+' : ''}{data.change24h.toFixed(2)}%
            </div>
          )}
        </div>
      </div>

      {/* Chart */}
      <div className="ticker-card__chart" ref={wrapRef}>
        {chartSvg}
        {!data && !error && <div className="ticker-card__loading">Loading...</div>}
        {error && <div className="ticker-card__loading">Reconnecting...</div>}
      </div>

      {/* Stats */}
      <div className="ticker-card__stats">
        <div>
          <div className="ticker-card__stat-label">24h High</div>
          <div className="ticker-card__stat-val up">{data ? formatPrice(data.high24h) : '—'}</div>
        </div>
        <div>
          <div className="ticker-card__stat-label">24h Low</div>
          <div className="ticker-card__stat-val down">{data ? formatPrice(data.low24h) : '—'}</div>
        </div>
        <div>
          <div className="ticker-card__stat-label">Volume</div>
          <div className="ticker-card__stat-val">{data ? formatCompact(data.volume) : '—'}</div>
        </div>
        <div>
          <div className="ticker-card__stat-label">TVL</div>
          <div className="ticker-card__stat-val">{data ? formatCompact(data.tvl) : '—'}</div>
        </div>
      </div>
    </div>
  )
}
