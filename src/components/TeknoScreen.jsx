import { useEffect, useState } from 'react'

// Technical data fetching hook
const useTechnicalData = (refreshInterval = 60000) => { // 1 minute to check for updates
  const [currentTokenIndex, setCurrentTokenIndex] = useState(0)
  const tokens = ['BTC', 'ETH', 'SOL']
  const [allTokenData, setAllTokenData] = useState({})
  const [data, setData] = useState({
    symbol: 'BTC',
    price: { current: 0, change24h: 0, high24h: 0, low24h: 0 },
    candles: [], // OHLCV data
    rsi: { value: 50, signal: 'neutral', overbought: false, oversold: false },
    macd: { histogram: 0, signal: 0, macd: 0, trend: 'neutral' },
    movingAverages: { sma20: 0, sma50: 0, sma200: 0, ema12: 0, ema26: 0 },
    bollingerBands: { upper: 0, middle: 0, lower: 0, squeeze: false },
    volume: { current: 0, average: 0, trend: 'normal' },
    patterns: [], // Detected candle patterns
    support: 0,
    resistance: 0,
    momentum: 50, // 0-100 scale
    volatility: 'normal', // low, normal, high, extreme
    trend: 'sideways', // bullish, bearish, sideways
    isLive: false,
    cacheAge: 0 // Age of cached data in seconds
  })
  
  // Rotate through tokens every 15 seconds
  useEffect(() => {
    const rotationInterval = setInterval(() => {
      setCurrentTokenIndex(prev => (prev + 1) % tokens.length)
    }, 15000) // 15 seconds per token
    
    return () => clearInterval(rotationInterval)
  }, [])

  // Fetch technical data from cached API
  useEffect(() => {
    const fetchTechnicalData = async () => {
      try {
        // Fetch from our cached technical API endpoint with real CoinGecko data
        // Try real data first, fallback to simulated if it fails
        let response = await fetch('/api/ai/technical-real')
        if (!response.ok) {
          console.log('[TeknoScreen] Real API failed, falling back to simulated')
          response = await fetch('/api/ai/technical')
        }
        if (response.ok) {
          const cachedData = await response.json()
          
          // Store all token data
          const tokenData = {
            BTC: cachedData.BTC || {},
            ETH: cachedData.ETH || {},
            SOL: cachedData.SOL || {}
          }
          
          setAllTokenData(tokenData)
          
          // Also store cache age
          const cacheAge = cachedData.cacheAge || 0
          
          // Update current display with the current token's data
          const currentToken = tokens[currentTokenIndex]
          if (tokenData[currentToken]) {
            setData({
              symbol: currentToken,
              ...tokenData[currentToken],
              cacheAge: cacheAge
            })
          }
          
          console.log(`[TeknoScreen] Loaded cached data (age: ${cacheAge}s, source: ${cachedData.source})`)
        } else {
          console.error('[TeknoScreen] Failed to fetch technical data')
        }
      } catch (err) {
        console.error('[TeknoScreen] Error fetching technical data:', err)
      }
    }

    // Initial fetch
    fetchTechnicalData()
    
    // Set up refresh interval
    const interval = setInterval(fetchTechnicalData, refreshInterval)
    
    return () => clearInterval(interval)
  }, [refreshInterval]) // Refresh periodically
  
  // Update displayed data when token changes
  useEffect(() => {
    const currentToken = tokens[currentTokenIndex]
    if (allTokenData[currentToken]) {
      setData({
        symbol: currentToken,
        ...allTokenData[currentToken],
        cacheAge: data.cacheAge // Preserve cache age
      })
    }
  }, [currentTokenIndex, allTokenData])

  return data
}

// The technical analysis screen component
const TeknoScreen = () => {
  const data = useTechnicalData()
  const [hasStartedDrawing, setHasStartedDrawing] = useState(false)

  // Draw loop using useEffect with interval
  useEffect(() => {
    const draw = () => {
      // Use the global canvas set up by VideoScreens for Screen3
      // @ts-ignore
      const canvas = window['__screen3Canvas']
      // @ts-ignore
      const texture = window['__screen3Texture']
      
      if (!canvas || !texture) {
        return
      }
      
      // Log once when we start drawing
      if (!hasStartedDrawing) {
        console.log('[TeknoScreen] Started drawing to Screen3!')
        setHasStartedDrawing(true)
      }
      
      const ctx = canvas.getContext('2d')
      const t = performance.now() / 1000 // Time in seconds

      // Background - clean black
      ctx.fillStyle = '#000000'
      ctx.fillRect(0, 0, 512, 320)

      // Header with Tekno's color (cyan/tech blue)
      ctx.fillStyle = '#00ffff' // Cyan for Tekno
      ctx.font = 'bold 18px monospace'
      ctx.fillText(`⚡ TECHNICAL ANALYSIS - ${data.symbol}`, 16, 28)
      
      // Status indicator
      ctx.fillStyle = data.isLive ? '#44ff44' : '#ffff44'
      ctx.font = '10px monospace'
      ctx.fillText(data.isLive ? '●LIVE' : '●SIM', 460, 28)
      
      // Token rotation indicators (show dots for BTC, ETH, SOL)
      const tokens = ['BTC', 'ETH', 'SOL']
      const currentIndex = tokens.indexOf(data.symbol)
      tokens.forEach((token, i) => {
        ctx.fillStyle = i === currentIndex ? '#00ffff' : 'rgba(0, 255, 255, 0.3)'
        ctx.fillRect(380 + i * 25, 24, 20, 8)
        ctx.fillStyle = i === currentIndex ? '#000000' : 'rgba(255, 255, 255, 0.5)'
        ctx.font = '7px monospace'
        ctx.fillText(token.substring(0, 3), 382 + i * 25, 30)
      })
      
      // Cache age indicator
      if (data.cacheAge !== undefined) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.4)'
        ctx.font = '8px monospace'
        const ageMinutes = Math.floor(data.cacheAge / 60)
        const ageText = ageMinutes > 0 ? `${ageMinutes}m old` : `${data.cacheAge}s old`
        ctx.fillText(`Cache: ${ageText}`, 380, 38)
      }
      
      // Divider line
      ctx.strokeStyle = '#00ffff'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(16, 40)
      ctx.lineTo(496, 40)
      ctx.stroke()

      // Main sections layout
      // Top: Price & Trend
      drawPriceSection(ctx, data, 50, t)
      
      // Left column: Indicators
      drawRSIGauge(ctx, data.rsi, 110, t)
      drawMACDHistogram(ctx, data.macd, 180, t)
      
      // Right column: Candle chart and patterns
      drawMiniCandleChart(ctx, data.candles, data.movingAverages, 260, 110, t)
      drawPatterns(ctx, data.patterns, 260, 220)
      
      // Bottom: Support/Resistance & Signals - moved up slightly
      drawSupportResistance(ctx, data, 275)
      
      // Market summary bar - with more separation
      drawMarketSummary(ctx, data, 298)
      
      // Simple border
      ctx.strokeStyle = 'rgba(0, 255, 255, 0.8)'
      ctx.lineWidth = 1
      ctx.strokeRect(2, 2, 508, 316)

      // Update texture
      if (texture) {
        texture.needsUpdate = true
      }
    }
    
    // Set up interval for drawing
    const intervalId = setInterval(draw, 100) // Draw every 100ms (~10fps)
    
    return () => {
      clearInterval(intervalId)
    }
  }, [data, hasStartedDrawing])

  return null
}

// Helper drawing functions
const drawPriceSection = (ctx, data, y) => {
  // Current price with animation
  ctx.fillStyle = '#ffffff'
  ctx.font = 'bold 24px monospace'
  const priceStr = `$${(data.price?.current || 0).toLocaleString('en-US', { 
    minimumFractionDigits: 0,
    maximumFractionDigits: 0 
  })}`
  ctx.fillText(priceStr, 24, y + 20)
  
  // 24h change - with more spacing
  const change24h = data.price?.change24h || 0
  const changeColor = change24h >= 0 ? '#44ff44' : '#ff4444'
  ctx.fillStyle = changeColor
  ctx.font = 'bold 14px monospace'
  const changeStr = `${change24h >= 0 ? '↑' : '↓'} ${Math.abs(change24h).toFixed(2)}%`
  ctx.fillText(changeStr, 150, y + 20)  // Fixed position instead of relative
  
  // Trend indicator
  ctx.fillStyle = '#00ffff'
  ctx.font = '12px monospace'
  ctx.fillText('TREND:', 300, y + 10)
  
  const trendColors = {
    'bullish': '#44ff44',
    'bearish': '#ff4444',
    'sideways': '#ffff44'
  }
  ctx.fillStyle = trendColors[data.trend] || '#ffff44'
  ctx.font = 'bold 12px monospace'
  ctx.fillText((data.trend || 'sideways').toUpperCase(), 350, y + 10)
  
  // Momentum bar
  ctx.fillStyle = '#00ffff'
  ctx.font = '12px monospace'
  ctx.fillText('MOMENTUM:', 300, y + 25)
  
  // Draw momentum bar
  const barX = 380
  const barWidth = 100
  const barHeight = 8
  ctx.fillStyle = 'rgba(0, 255, 255, 0.2)'
  ctx.fillRect(barX, y + 18, barWidth, barHeight)
  
  const momentum = data.momentum || 50
  const momentumWidth = (momentum / 100) * barWidth
  const momentumColor = momentum > 70 ? '#44ff44' : 
                        momentum < 30 ? '#ff4444' : '#ffff44'
  ctx.fillStyle = momentumColor
  ctx.fillRect(barX, y + 18, momentumWidth, barHeight)
}

const drawRSIGauge = (ctx, rsi, y) => {
  if (!rsi) return
  
  ctx.fillStyle = '#00ffff'
  ctx.font = 'bold 12px monospace'
  ctx.fillText('RSI (14)', 24, y)
  
  // RSI gauge bar
  const gaugeX = 24
  const gaugeY = y + 10
  const gaugeWidth = 200
  const gaugeHeight = 20
  
  // Background gradient
  const gradient = ctx.createLinearGradient(gaugeX, 0, gaugeX + gaugeWidth, 0)
  gradient.addColorStop(0, '#ff4444')
  gradient.addColorStop(0.3, '#ff4444')
  gradient.addColorStop(0.5, '#ffff44')
  gradient.addColorStop(0.7, '#44ff44')
  gradient.addColorStop(1, '#44ff44')
  
  ctx.fillStyle = gradient
  ctx.globalAlpha = 0.3
  ctx.fillRect(gaugeX, gaugeY, gaugeWidth, gaugeHeight)
  ctx.globalAlpha = 1
  
  // Overbought/Oversold zones
  ctx.fillStyle = 'rgba(255, 68, 68, 0.2)'
  ctx.fillRect(gaugeX, gaugeY, gaugeWidth * 0.3, gaugeHeight) // Oversold zone
  ctx.fillRect(gaugeX + gaugeWidth * 0.7, gaugeY, gaugeWidth * 0.3, gaugeHeight) // Overbought zone
  
  // RSI needle
  const rsiValue = rsi.value || 50
  const needleX = gaugeX + (rsiValue / 100) * gaugeWidth
  
  ctx.strokeStyle = '#ffffff'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(needleX, gaugeY - 2)
  ctx.lineTo(needleX, gaugeY + gaugeHeight + 2)
  ctx.stroke()
  
  // RSI value
  ctx.fillStyle = '#ffffff'
  ctx.font = 'bold 16px monospace'
  ctx.fillText(rsiValue.toFixed(1), gaugeX + gaugeWidth + 10, gaugeY + 15)
  
  // Signal
  const signalColors = {
    'overbought': '#ff4444',
    'oversold': '#44ff44',
    'neutral': '#ffff44'
  }
  ctx.fillStyle = signalColors[rsi.signal] || '#ffff44'
  ctx.font = '10px monospace'
  ctx.fillText((rsi.signal || 'neutral').toUpperCase(), gaugeX + gaugeWidth + 60, gaugeY + 15)
}

const drawMACDHistogram = (ctx, macd, y) => {
  if (!macd) return
  
  ctx.fillStyle = '#00ffff'
  ctx.font = 'bold 12px monospace'
  ctx.fillText('MACD', 24, y)
  
  // MACD histogram bars
  const barX = 24
  const barY = y + 30
  const barWidth = 200
  const maxHeight = 25
  
  // Zero line
  ctx.strokeStyle = 'rgba(0, 255, 255, 0.5)'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(barX, barY)
  ctx.lineTo(barX + barWidth, barY)
  ctx.stroke()
  
  // Draw histogram bars (simplified - just show current value)
  const histogramValue = macd.histogram || 0
  const barHeight = Math.min(maxHeight, Math.abs(histogramValue) * 100)
  
  if (histogramValue > 0) {
    ctx.fillStyle = '#44ff44'
    ctx.fillRect(barX + barWidth/2 - 20, barY - barHeight, 40, barHeight)
  } else {
    ctx.fillStyle = '#ff4444'
    ctx.fillRect(barX + barWidth/2 - 20, barY, 40, Math.abs(barHeight))
  }
  
  // MACD values
  ctx.fillStyle = '#ffffff'
  ctx.font = '10px monospace'
  ctx.fillText(`MACD: ${(macd.macd || 0).toFixed(3)}`, barX, y + 60)
  ctx.fillText(`Signal: ${(macd.signal || 0).toFixed(3)}`, barX + 100, y + 60)
  
  // Trend indicator
  const trendColor = macd.trend === 'bullish' ? '#44ff44' : '#ff4444'
  ctx.fillStyle = trendColor
  ctx.font = 'bold 10px monospace'
  ctx.fillText((macd.trend || 'neutral').toUpperCase(), barX + 180, y + 60)
}

const drawMiniCandleChart = (ctx, candles, movingAverages, x, y) => {
  if (!candles || candles.length === 0) return
  
  ctx.fillStyle = '#00ffff'
  ctx.font = 'bold 12px monospace'
  ctx.fillText('PRICE ACTION', x, y - 5)
  
  const chartWidth = 220
  const chartHeight = 80
  const candleWidth = chartWidth / candles.length
  
  // Find price range
  const allPrices = candles.flatMap(c => [c.high, c.low])
  const maxPrice = Math.max(...allPrices)
  const minPrice = Math.min(...allPrices)
  const priceRange = maxPrice - minPrice || 1
  
  // Draw candles
  candles.forEach((candle, i) => {
    const candleX = x + i * candleWidth
    
    // Calculate Y positions
    const highY = y + (1 - (candle.high - minPrice) / priceRange) * chartHeight
    const lowY = y + (1 - (candle.low - minPrice) / priceRange) * chartHeight
    const openY = y + (1 - (candle.open - minPrice) / priceRange) * chartHeight
    const closeY = y + (1 - (candle.close - minPrice) / priceRange) * chartHeight
    
    // Candle color
    const isBullish = candle.close > candle.open
    ctx.strokeStyle = isBullish ? '#44ff44' : '#ff4444'
    ctx.fillStyle = isBullish ? 'rgba(68, 255, 68, 0.3)' : 'rgba(255, 68, 68, 0.3)'
    
    // Draw wick
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(candleX + candleWidth/2, highY)
    ctx.lineTo(candleX + candleWidth/2, lowY)
    ctx.stroke()
    
    // Draw body
    const bodyTop = Math.min(openY, closeY)
    const bodyHeight = Math.abs(closeY - openY)
    ctx.fillRect(candleX + 2, bodyTop, candleWidth - 4, Math.max(1, bodyHeight))
  })
  
  // Draw SMA20 line if available
  if (movingAverages && movingAverages.sma20 > 0) {
    const smaY = y + (1 - (movingAverages.sma20 - minPrice) / priceRange) * chartHeight
    ctx.strokeStyle = 'rgba(255, 255, 0, 0.5)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(x, smaY)
    ctx.lineTo(x + chartWidth, smaY)
    ctx.stroke()
    
    ctx.fillStyle = 'rgba(255, 255, 0, 0.7)'
    ctx.font = '8px monospace'
    ctx.fillText('MA20', x + chartWidth + 2, smaY + 3)
  }
}

const drawPatterns = (ctx, patterns, x, y) => {
  ctx.fillStyle = '#00ffff'
  ctx.font = 'bold 12px monospace'
  ctx.fillText('PATTERNS', x, y)
  
  if (!patterns || patterns.length === 0) {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)'
    ctx.font = '10px monospace'
    ctx.fillText('No patterns detected', x, y + 20)
    return
  }
  
  patterns.slice(0, 3).forEach((pattern, i) => {
    const yPos = y + 20 + (i * 15)
    
    // Pattern signal color
    const signalColor = pattern.signal === 'bullish' ? '#44ff44' :
                       pattern.signal === 'bearish' ? '#ff4444' : '#ffff44'
    
    ctx.fillStyle = signalColor
    ctx.font = '10px monospace'
    ctx.fillText('●', x, yPos)
    
    ctx.fillStyle = '#ffffff'
    ctx.font = '10px monospace'
    ctx.fillText(pattern.name, x + 12, yPos)
  })
}

const drawSupportResistance = (ctx, data, y) => {
  ctx.fillStyle = '#00ffff'
  ctx.font = 'bold 11px monospace'
  ctx.fillText('S/R LEVELS', 24, y)
  
  // Support - moved up to avoid overlap
  ctx.fillStyle = '#44ff44'
  ctx.font = '10px monospace'
  ctx.fillText(`Support: $${(data.support || 0).toFixed(0)}`, 24, y + 14)
  
  // Resistance - adjusted spacing
  ctx.fillStyle = '#ff4444'
  ctx.font = '10px monospace'
  ctx.fillText(`Resistance: $${(data.resistance || 0).toFixed(0)}`, 150, y + 14)
  
  // Volatility - better positioned
  ctx.fillStyle = '#00ffff'
  ctx.font = '10px monospace'
  ctx.fillText(`Volatility:`, 300, y + 14)
  
  const volColors = {
    'low': '#44ff44',
    'normal': '#ffff44',
    'high': '#ff8844',
    'extreme': '#ff4444'
  }
  ctx.fillStyle = volColors[data.volatility] || '#ffff44'
  ctx.font = 'bold 10px monospace'
  ctx.fillText((data.volatility || 'normal').toUpperCase(), 370, y + 14)
}

const drawMarketSummary = (ctx, data, y) => {
  // Summary line
  const summaryColor = data.trend === 'bullish' ? '#44ff44' :
                       data.trend === 'bearish' ? '#ff4444' : '#ffff44'
  
  ctx.fillStyle = summaryColor
  ctx.font = 'bold 10px monospace'
  
  let summary = 'SIGNAL: '
  const rsiValue = data.rsi?.value || 50
  if (data.trend === 'bullish' && rsiValue < 70) {
    summary += 'BUY - Bullish trend, RSI room to grow'
  } else if (data.trend === 'bearish' && rsiValue > 30) {
    summary += 'SELL - Bearish trend, RSI room to fall'
  } else if (rsiValue > 70) {
    summary += 'WAIT - Overbought conditions'
  } else if (rsiValue < 30) {
    summary += 'ACCUMULATE - Oversold conditions'
  } else {
    summary += 'HOLD - Neutral conditions'
  }
  
  ctx.fillText(summary, 24, y)
}

export default TeknoScreen