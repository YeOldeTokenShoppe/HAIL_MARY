import { useEffect, useState } from 'react'

// Data fetching hook with 30 minute refresh interval
const useMacroData = (refreshInterval = 1800000) => { // 1800000ms = 30 minutes
  const [data, setData] = useState({
    vix: { value: 18.5, change: 0, changePercent: 0 },
    spx: { value: 585, change: 0, changePercent: 0 },
    dxy: { value: 28.5, change: 0, changePercent: 0 },
    treasury10y: { value: 4.5, change: 0 },
    funding: { btc: 0.01, eth: 0.008 },
    openInterest: { btc: 0, eth: 0, total: 0 },
  })

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch('/api/ai/macro')

        if (response.ok) {
          const macroData = await response.json()
          setData({
            vix: macroData.vix || { value: 18.5, change: 0, changePercent: 0 },
            spx: macroData.spx || { value: 585, change: 0, changePercent: 0 },
            dxy: macroData.dxy || { value: 28.5, change: 0, changePercent: 0 },
            treasury10y: macroData.treasury10y || { value: 4.5, change: 0 },
            funding: macroData.funding || { btc: 0.01, eth: 0.008 },
            openInterest: macroData.openInterest || { btc: 0, eth: 0, total: 0 },
          })
        }
      } catch (err) {
        console.error('[MacroAgentScreen] Data fetch failed:', err)
      }
    }

    fetchData()
    const interval = setInterval(fetchData, refreshInterval)
    return () => clearInterval(interval)
  }, [refreshInterval])

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

      // Divider line
      ctx.strokeStyle = '#00ff66'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(16, 40)
      ctx.lineTo(496, 40)
      ctx.stroke()

      // Row 1: DXY and VIX
      drawIndicatorBoxCompact(ctx, 'DXY', data.dxy.value, data.dxy.changePercent, 20, 50, 'USD (UUP)', false)
      drawIndicatorBoxCompact(ctx, 'VIX', data.vix.value, data.vix.changePercent, 265, 50, 'Vol (VIXY)', true)

      // Row 2: 10Y Treasury and S&P 500
      drawIndicatorBoxCompact(ctx, '10Y', data.treasury10y.value, data.treasury10y.change, 20, 100, 'Treasury', true, true)
      drawIndicatorBoxCompact(ctx, 'SPX', data.spx.value, data.spx.changePercent, 265, 100, 'S&P 500', false)

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
  const isPositive = change >= 0
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

  // Value (center-right)
  ctx.fillStyle = '#ffffff'
  ctx.font = 'bold 18px monospace'
  const displayValue = isPercent ? `${value.toFixed(2)}%` : value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  ctx.fillText(displayValue, x + 70, y + 26)

  // Change (far right)
  ctx.fillStyle = showGreen ? '#00ff66' : '#ff4444'
  ctx.font = 'bold 10px monospace'
  const arrow = isPositive ? '▲' : '▼'
  const changeDisplay = isPercent ? `${arrow}${Math.abs(change).toFixed(2)}` : `${arrow}${Math.abs(change).toFixed(2)}%`
  ctx.fillText(changeDisplay, x + 175, y + 26)
}

// Draw Funding Rates section
const drawFundingRates = (ctx, funding, y) => {
  // Title
  ctx.fillStyle = '#00ff66'
  ctx.font = 'bold 12px monospace'
  ctx.fillText('PERP FUNDING RATES (LIGHTER)', 20, y + 15)

  // BTC Funding
  const btcRate = funding.btc || 0
  const btcPositive = btcRate >= 0
  drawFundingBar(ctx, 'BTC', btcRate, 20, y + 30, btcPositive)

  // ETH Funding
  const ethRate = funding.eth || 0
  const ethPositive = ethRate >= 0
  drawFundingBar(ctx, 'ETH', ethRate, 260, y + 30, ethPositive)
}

// Draw individual funding rate bar
const drawFundingBar = (ctx, symbol, rate, x, y, isPositive) => {
  // Background box
  ctx.fillStyle = 'rgba(0, 255, 100, 0.05)'
  ctx.fillRect(x, y, 220, 35)
  ctx.strokeStyle = 'rgba(0, 255, 100, 0.3)'
  ctx.strokeRect(x, y, 220, 35)

  // Symbol
  ctx.fillStyle = '#00ff66'
  ctx.font = 'bold 12px monospace'
  ctx.fillText(symbol, x + 10, y + 15)

  // Rate value - format as percentage with 4 decimals
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
}

// Draw Open Interest section
const drawOpenInterest = (ctx, openInterest, y) => {
  // Title
  ctx.fillStyle = '#00ff66'
  ctx.font = 'bold 12px monospace'
  ctx.fillText('OPEN INTEREST (LIGHTER)', 20, y + 15)

  // BTC OI
  const btcOI = openInterest.btc || 0
  drawOIBar(ctx, 'BTC', btcOI, 20, y + 28)

  // ETH OI
  const ethOI = openInterest.eth || 0
  drawOIBar(ctx, 'ETH', ethOI, 260, y + 28)

  // Total OI
  const totalOI = openInterest.total || (btcOI + ethOI)
  ctx.fillStyle = 'rgba(255, 255, 255, 0.5)'
  ctx.font = '10px monospace'
  ctx.fillText(`TOTAL: $${formatLargeNumber(totalOI)}`, 300, y + 15)
}

// Draw individual OI bar
const drawOIBar = (ctx, symbol, value, x, y) => {
  // Background box
  ctx.fillStyle = 'rgba(0, 255, 100, 0.05)'
  ctx.fillRect(x, y, 220, 30)
  ctx.strokeStyle = 'rgba(0, 255, 100, 0.3)'
  ctx.strokeRect(x, y, 220, 30)

  // Symbol
  ctx.fillStyle = '#00ff66'
  ctx.font = 'bold 12px monospace'
  ctx.fillText(symbol, x + 10, y + 12)

  // Value - format as dollar amount
  ctx.fillStyle = '#ffffff'
  ctx.font = 'bold 14px monospace'
  ctx.fillText(`$${formatLargeNumber(value)}`, x + 50, y + 13)

  // Label
  ctx.fillStyle = 'rgba(255, 255, 255, 0.4)'
  ctx.font = '8px monospace'
  ctx.fillText('OPEN INTEREST', x + 10, y + 24)
}

// Format large numbers (e.g., 1500000 -> 1.5M)
const formatLargeNumber = (num) => {
  if (num >= 1e9) return (num / 1e9).toFixed(2) + 'B'
  if (num >= 1e6) return (num / 1e6).toFixed(2) + 'M'
  if (num >= 1e3) return (num / 1e3).toFixed(1) + 'K'
  return num.toFixed(0)
}

export default MacroAgentScreen
