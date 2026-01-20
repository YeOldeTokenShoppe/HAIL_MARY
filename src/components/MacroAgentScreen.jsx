import { useEffect, useState } from 'react'
import { db, doc, onSnapshot } from '@/lib/firebaseClient'

// Macro data hook - reads from Firestore (populated by Railway background service)
const useMacroData = () => {
  const [data, setData] = useState({
    vix: null,  // No fake defaults - show N/A until real data arrives
    spx: null,
    dxy: null,
    treasury10y: null,
    funding: { btc: null, eth: null },
    openInterest: { btc: null, eth: null, total: null },
    isLive: false,
    lastUpdate: null
  })

  useEffect(() => {
    if (!db) {
      console.warn('[MacroAgentScreen] Firebase not initialized')
      return
    }

    // Subscribe to macroData/latest for real-time updates
    const macroRef = doc(db, 'macroData', 'latest')
    const unsubscribe = onSnapshot(macroRef, (docSnapshot) => {
      if (docSnapshot.exists()) {
        const macroData = docSnapshot.data()
        setData({
          vix: macroData.vix || null,  // Keep null if no data - display will show N/A
          spx: macroData.spx || null,
          dxy: macroData.dxy || null,
          treasury10y: macroData.treasury10y || null,
          funding: macroData.funding || { btc: null, eth: null },
          openInterest: macroData.openInterest || { btc: null, eth: null, total: null },
          isLive: true,
          lastUpdate: macroData.lastUpdate || null
        })
      }
    }, (error) => {
      console.error('[MacroAgentScreen] Firestore subscription error:', error)
    })

    return () => unsubscribe()
  }, [])

  return data
}

// The screen component
const MacroAgentScreen = () => {
  const data = useMacroData()

  useEffect(() => {
    const draw = () => {
      // Use the global canvas set up by VideoScreens
      const canvas = window.__screen2Canvas
      const texture = window.__screen2Texture

      if (!canvas || !texture) return

      const ctx = canvas.getContext('2d')

      // Background - clean black
      ctx.fillStyle = '#000000'
      ctx.fillRect(0, 0, 512, 320)

      // Header
      ctx.fillStyle = '#00ff66'
      ctx.font = 'bold 18px monospace'
      ctx.fillText('◆ MACRO INDICATORS', 16, 28)

      // Live indicator
      ctx.fillStyle = data.isLive ? '#44ff44' : '#ffff44'
      ctx.font = '9px monospace'
      ctx.fillText(data.isLive ? 'LIVE' : 'SYNC', 480, 28)

      // Divider line
      ctx.strokeStyle = '#00ff66'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(16, 40)
      ctx.lineTo(496, 40)
      ctx.stroke()

      // Row 1: DXY and VIX (handle null data with optional chaining)
      drawIndicatorBoxCompact(ctx, 'DXY', data.dxy?.value, data.dxy?.changePercent, 20, 50, 'USD (UUP)', false)
      drawIndicatorBoxCompact(ctx, 'VIX', data.vix?.value, data.vix?.changePercent, 265, 50, 'Vol (VIXY)', true)

      // Row 2: 10Y Treasury and S&P 500
      drawIndicatorBoxCompact(ctx, '10Y', data.treasury10y?.value, data.treasury10y?.change, 20, 100, 'Treasury', true, true)
      drawIndicatorBoxCompact(ctx, 'SPX', data.spx?.value, data.spx?.changePercent, 265, 100, 'S&P 500', false)

      // Divider before Funding Rates
      ctx.strokeStyle = 'rgba(0, 255, 100, 0.3)'
      ctx.beginPath()
      ctx.moveTo(16, 150)
      ctx.lineTo(496, 150)
      ctx.stroke()

      // Funding Rates Section
      drawFundingRates(ctx, data.funding, 160)

      // Divider before Open Interest
      ctx.strokeStyle = 'rgba(0, 255, 100, 0.3)'
      ctx.beginPath()
      ctx.moveTo(16, 235)
      ctx.lineTo(496, 235)
      ctx.stroke()

      // Open Interest Section
      drawOpenInterest(ctx, data.openInterest, 245)

      // Simple border
      ctx.strokeStyle = 'rgba(0, 255, 100, 0.8)'
      ctx.lineWidth = 1
      ctx.strokeRect(2, 2, 508, 316)

      if (texture) {
        texture.needsUpdate = true
      }
    }

    const intervalId = setInterval(draw, 100)
    return () => clearInterval(intervalId)
  }, [data])

  return null
}

// Draw a compact indicator box
const drawIndicatorBoxCompact = (ctx, symbol, value, change, x, y, subtitle, invertColors = false, isPercent = false) => {
  const hasData = value != null && !isNaN(value)
  const hasChange = change != null && !isNaN(change)
  const isPositive = hasChange ? change >= 0 : true
  const showGreen = invertColors ? !isPositive : isPositive

  // Box background
  ctx.fillStyle = 'rgba(0, 255, 100, 0.05)'
  ctx.fillRect(x, y, 225, 42)
  ctx.strokeStyle = 'rgba(0, 255, 100, 0.3)'
  ctx.strokeRect(x, y, 225, 42)

  // Symbol (left side)
  ctx.fillStyle = '#00ff66'
  ctx.font = 'bold 14px monospace'
  ctx.fillText(symbol, x + 10, y + 16)

  // Subtitle (under symbol)
  ctx.fillStyle = 'rgba(255, 255, 255, 0.4)'
  ctx.font = '8px monospace'
  ctx.fillText(subtitle, x + 10, y + 28)

  // Value (center-right) - show N/A if no data
  ctx.fillStyle = hasData ? '#ffffff' : '#666666'
  ctx.font = 'bold 18px monospace'
  const displayValue = hasData
    ? (isPercent ? `${value.toFixed(2)}%` : value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }))
    : 'N/A'
  ctx.fillText(displayValue, x + 70, y + 26)

  // Change (far right) - show --- if no data
  ctx.fillStyle = hasChange ? (showGreen ? '#00ff66' : '#ff4444') : '#666666'
  ctx.font = 'bold 10px monospace'
  const changeDisplay = hasChange
    ? `${isPositive ? '▲' : '▼'}${Math.abs(change).toFixed(2)}${isPercent ? '' : '%'}`
    : '---'
  ctx.fillText(changeDisplay, x + 175, y + 26)
}

// Draw Funding Rates section
const drawFundingRates = (ctx, funding, y) => {
  // Title
  ctx.fillStyle = '#00ff66'
  ctx.font = 'bold 12px monospace'
  ctx.fillText('PERP FUNDING RATES (LIGHTER)', 20, y + 15)

  // BTC Funding - pass null through to display N/A
  const btcRate = funding?.btc
  drawFundingBar(ctx, 'BTC', btcRate, 20, y + 30)

  // ETH Funding
  const ethRate = funding?.eth
  drawFundingBar(ctx, 'ETH', ethRate, 260, y + 30)
}

// Draw individual funding rate bar
const drawFundingBar = (ctx, symbol, rate, x, y) => {
  const hasData = rate != null && !isNaN(rate)
  const isPositive = hasData ? rate >= 0 : true

  // Background box
  ctx.fillStyle = 'rgba(0, 255, 100, 0.05)'
  ctx.fillRect(x, y, 220, 35)
  ctx.strokeStyle = 'rgba(0, 255, 100, 0.3)'
  ctx.strokeRect(x, y, 220, 35)

  // Symbol
  ctx.fillStyle = '#00ff66'
  ctx.font = 'bold 12px monospace'
  ctx.fillText(symbol, x + 10, y + 15)

  // Rate value - format as percentage with 4 decimals, or N/A
  if (hasData) {
    const ratePercent = (rate * 100).toFixed(4)
    const sign = isPositive ? '+' : ''
    ctx.fillStyle = isPositive ? '#00ff66' : '#ff4444'
    ctx.font = 'bold 16px monospace'
    ctx.fillText(`${sign}${ratePercent}%`, x + 50, y + 16)

    // Label
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)'
    ctx.font = '9px monospace'
    const label = isPositive ? 'LONGS PAY SHORTS' : 'SHORTS PAY LONGS'
    ctx.fillText(label, x + 10, y + 28)
  } else {
    ctx.fillStyle = '#666666'
    ctx.font = 'bold 16px monospace'
    ctx.fillText('N/A', x + 50, y + 16)

    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)'
    ctx.font = '9px monospace'
    ctx.fillText('NO DATA', x + 10, y + 28)
  }
}

// Draw Open Interest section
const drawOpenInterest = (ctx, openInterest, y) => {
  // Title
  ctx.fillStyle = '#00ff66'
  ctx.font = 'bold 12px monospace'
  ctx.fillText('OPEN INTEREST (LIGHTER)', 20, y + 15)

  // BTC OI - pass null through
  const btcOI = openInterest?.btc
  drawOIBar(ctx, 'BTC', btcOI, 20, y + 28)

  // ETH OI
  const ethOI = openInterest?.eth
  drawOIBar(ctx, 'ETH', ethOI, 260, y + 28)

  // Total OI
  const totalOI = openInterest?.total
  const hasTotal = totalOI != null && !isNaN(totalOI)
  ctx.fillStyle = 'rgba(255, 255, 255, 0.5)'
  ctx.font = '10px monospace'
  ctx.fillText(`TOTAL: ${hasTotal ? '$' + formatLargeNumber(totalOI) : 'N/A'}`, 300, y + 15)
}

// Draw individual OI bar
const drawOIBar = (ctx, symbol, value, x, y) => {
  const hasData = value != null && !isNaN(value)

  // Background box
  ctx.fillStyle = 'rgba(0, 255, 100, 0.05)'
  ctx.fillRect(x, y, 220, 30)
  ctx.strokeStyle = 'rgba(0, 255, 100, 0.3)'
  ctx.strokeRect(x, y, 220, 30)

  // Symbol
  ctx.fillStyle = '#00ff66'
  ctx.font = 'bold 12px monospace'
  ctx.fillText(symbol, x + 10, y + 12)

  // Value - format as dollar amount or N/A
  ctx.fillStyle = hasData ? '#ffffff' : '#666666'
  ctx.font = 'bold 14px monospace'
  ctx.fillText(hasData ? `$${formatLargeNumber(value)}` : 'N/A', x + 50, y + 13)

  // Label
  ctx.fillStyle = 'rgba(255, 255, 255, 0.4)'
  ctx.font = '8px monospace'
  ctx.fillText('OPEN INTEREST', x + 10, y + 24)
}

// Format large numbers (e.g., 1500000 -> 1.5M)
const formatLargeNumber = (num) => {
  if (num == null || isNaN(num)) return 'N/A'
  if (num >= 1e9) return (num / 1e9).toFixed(2) + 'B'
  if (num >= 1e6) return (num / 1e6).toFixed(2) + 'M'
  if (num >= 1e3) return (num / 1e3).toFixed(1) + 'K'
  return num.toFixed(0)
}

export default MacroAgentScreen
