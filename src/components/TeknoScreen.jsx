import { useEffect, useState, useRef, useCallback } from 'react'
import { createChart, ColorType, CrosshairMode, CandlestickSeries, LineSeries, HistogramSeries } from 'lightweight-charts'
import { db, doc, onSnapshot } from '@/lib/firebaseClient'

// Technical data hook - reads from Firestore (populated by Railway background service)
const useTechnicalData = () => {
  const [currentTokenIndex, setCurrentTokenIndex] = useState(0)
  const [autoRotate, setAutoRotate] = useState(true)
  const tokens = ['BTC', 'ETH', 'SOL', 'XRP']
  const [allTokenData, setAllTokenData] = useState({})
  const [data, setData] = useState({
    symbol: 'BTC',
    candles: [],
    indicators: {
      ema12: [],
      ema26: [],
      sma20: [],
      rsi: [],
      macd: [],
      macdSignal: [],
      macdHistogram: [],
      bollingerUpper: [],
      bollingerMiddle: [],
      bollingerLower: []
    },
    current: {
      price: 0,
      rsi: 50,
      macd: 0,
      macdSignal: 0,
      trend: 'sideways',
      support: 0,
      resistance: 0
    },
    isLive: false,
    updatedAt: null
  })

  // Function to manually set token
  const setToken = useCallback((index) => {
    setCurrentTokenIndex(index)
    setAutoRotate(false) // Stop auto-rotation when user manually selects
    // Resume auto-rotation after 30 seconds of no interaction
    setTimeout(() => setAutoRotate(true), 30000)
  }, [tokens])

  // Rotate through tokens every 15 seconds (only if autoRotate is enabled)
  useEffect(() => {
    if (!autoRotate) return

    const rotationInterval = setInterval(() => {
      setCurrentTokenIndex(prev => (prev + 1) % tokens.length)
    }, 15000)

    return () => clearInterval(rotationInterval)
  }, [autoRotate])

  // Subscribe to Firestore for real-time technical data updates
  useEffect(() => {
    if (!db) {
      console.warn('[TeknoScreen] Firebase not initialized')
      return
    }

    const technicalRef = doc(db, 'technicalData', 'latest')

    const unsubscribe = onSnapshot(
      technicalRef,
      (docSnapshot) => {
        if (docSnapshot.exists()) {
          const technicalData = docSnapshot.data()

          // Store all token data
          const tokenData = {}
          tokens.forEach(symbol => {
            if (technicalData[symbol]) {
              tokenData[symbol] = technicalData[symbol]
            }
          })

          setAllTokenData(tokenData)

          // Update current display
          const currentToken = tokens[currentTokenIndex]
          if (tokenData[currentToken]) {
            setData({
              symbol: currentToken,
              ...tokenData[currentToken],
              isLive: true,
              updatedAt: technicalData.updatedAt
            })
          }

        } else {
          console.log('[TeknoScreen] No technical data in Firestore yet')
        }
      },
      (error) => {
        console.error('[TeknoScreen] Firestore subscription error:', error)
      }
    )

    return () => unsubscribe()
  }, [currentTokenIndex])

  // Update displayed data when token changes
  useEffect(() => {
    const currentToken = tokens[currentTokenIndex]
    if (allTokenData[currentToken]) {
      setData(prev => ({
        symbol: currentToken,
        ...allTokenData[currentToken],
        isLive: true,
        updatedAt: prev.updatedAt
      }))
    }
  }, [currentTokenIndex, allTokenData])

  return { data, tokens, currentTokenIndex, setToken }
}

// The technical analysis screen component with lightweight-charts
const TeknoScreen = () => {
  const { data, tokens, currentTokenIndex, setToken } = useTechnicalData()
  const chartContainerRef = useRef(null)
  const chartRef = useRef(null)
  const candlestickSeriesRef = useRef(null)
  const ema12SeriesRef = useRef(null)
  const ema26SeriesRef = useRef(null)
  const bollingerUpperRef = useRef(null)
  const bollingerLowerRef = useRef(null)
  const volumeSeriesRef = useRef(null)
  const [chartInitialized, setChartInitialized] = useState(false)

  // Listen for click events on Screen3 to handle token button clicks
  useEffect(() => {
    const handleScreen3Click = (event) => {
      const { uv } = event.detail || {}
      if (!uv) return

      // Convert UV coordinates to canvas coordinates (512x320)
      const canvasX = uv.x * 512
      const canvasY = uv.y * 320

      // Token button positions (from drawHeader function):
      // Buttons start at x=400, each is 28px wide, y is 8-22
      // Expand hit area for easier clicking (y: 0-50 to catch header area)
      if (canvasY <= 50) {
        if (canvasX >= 380 && canvasX < 420) {
          setToken(0) // BTC
        } else if (canvasX >= 420 && canvasX < 455) {
          setToken(1) // ETH
        } else if (canvasX >= 455 && canvasX < 490) {
          setToken(2) // SOL
        } else if (canvasX >= 490) {
          setToken(3) // XRP
        }
      }
    }

    window.addEventListener('screen3Click', handleScreen3Click)
    return () => window.removeEventListener('screen3Click', handleScreen3Click)
  }, [setToken])

  // Create hidden container and initialize chart
  useEffect(() => {
    // Create hidden container for the chart
    let container = document.getElementById('tekno-chart-container')
    if (!container) {
      container = document.createElement('div')
      container.id = 'tekno-chart-container'
      container.style.position = 'absolute'
      container.style.left = '-9999px'
      container.style.top = '-9999px'
      container.style.width = '512px'
      container.style.height = '320px'
      container.style.overflow = 'hidden'
      document.body.appendChild(container)
    }
    chartContainerRef.current = container

    // Initialize the chart
    const chart = createChart(container, {
      width: 512,
      height: 240, // Leave room for indicators header
      layout: {
        background: { type: ColorType.Solid, color: '#000000' },
        textColor: '#00ffff',
        fontSize: 10,
      },
      grid: {
        vertLines: { color: 'rgba(0, 255, 255, 0.1)' },
        horzLines: { color: 'rgba(0, 255, 255, 0.1)' },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: 'rgba(0, 255, 255, 0.4)', width: 1 },
        horzLine: { color: 'rgba(0, 255, 255, 0.4)', width: 1 },
      },
      rightPriceScale: {
        borderColor: 'rgba(0, 255, 255, 0.3)',
        scaleMargins: { top: 0.1, bottom: 0.2 },
      },
      timeScale: {
        borderColor: 'rgba(0, 255, 255, 0.3)',
        timeVisible: false,
        secondsVisible: false,
      },
      handleScroll: false,
      handleScale: false,
    })

    // Add candlestick series (v4+ API)
    const candlestickSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#26a69a',
      downColor: '#ef5350',
      borderUpColor: '#26a69a',
      borderDownColor: '#ef5350',
      wickUpColor: '#26a69a',
      wickDownColor: '#ef5350',
    })

    // Add EMA 12 line (v4+ API)
    const ema12Series = chart.addSeries(LineSeries, {
      color: '#ffeb3b',
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: false,
    })

    // Add EMA 26 line (v4+ API)
    const ema26Series = chart.addSeries(LineSeries, {
      color: '#ff9800',
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: false,
    })

    // Add Bollinger Bands (v4+ API)
    const bollingerUpper = chart.addSeries(LineSeries, {
      color: 'rgba(33, 150, 243, 0.5)',
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: false,
    })

    const bollingerLower = chart.addSeries(LineSeries, {
      color: 'rgba(33, 150, 243, 0.5)',
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: false,
    })

    // Add volume series (v4+ API)
    const volumeSeries = chart.addSeries(HistogramSeries, {
      color: '#26a69a',
      priceFormat: { type: 'volume' },
      priceScaleId: 'volume',
    })

    // Set volume price scale margins
    chart.priceScale('volume').applyOptions({
      scaleMargins: { top: 0.85, bottom: 0 },
    })

    chartRef.current = chart
    candlestickSeriesRef.current = candlestickSeries
    ema12SeriesRef.current = ema12Series
    ema26SeriesRef.current = ema26Series
    bollingerUpperRef.current = bollingerUpper
    bollingerLowerRef.current = bollingerLower
    volumeSeriesRef.current = volumeSeries

    setChartInitialized(true)

    return () => {
      chart.remove()
      if (container && container.parentNode) {
        container.parentNode.removeChild(container)
      }
    }
  }, [])

  // Update chart data when data changes
  useEffect(() => {
    if (!chartInitialized || !data.candles || data.candles.length === 0) return

    const chart = chartRef.current
    const candlestickSeries = candlestickSeriesRef.current
    const ema12Series = ema12SeriesRef.current
    const ema26Series = ema26SeriesRef.current
    const bollingerUpper = bollingerUpperRef.current
    const bollingerLower = bollingerLowerRef.current
    const volumeSeries = volumeSeriesRef.current

    if (!chart || !candlestickSeries) return

    // Update candlestick data
    candlestickSeries.setData(data.candles)

    // Update EMA lines
    if (data.indicators?.ema12) {
      const emaData = data.indicators.ema12.filter(d => d.value !== null)
      ema12Series.setData(emaData)
    }

    if (data.indicators?.ema26) {
      const emaData = data.indicators.ema26.filter(d => d.value !== null)
      ema26Series.setData(emaData)
    }

    // Update Bollinger Bands
    if (data.indicators?.bollingerUpper) {
      const upperData = data.indicators.bollingerUpper.filter(d => d.value !== null)
      bollingerUpper.setData(upperData)
    }

    if (data.indicators?.bollingerLower) {
      const lowerData = data.indicators.bollingerLower.filter(d => d.value !== null)
      bollingerLower.setData(lowerData)
    }

    // Update volume
    const volumeData = data.candles.map(c => ({
      time: c.time,
      value: c.volume,
      color: c.close >= c.open ? 'rgba(38, 166, 154, 0.5)' : 'rgba(239, 83, 80, 0.5)'
    }))
    volumeSeries.setData(volumeData)

    // Fit content
    chart.timeScale().fitContent()
  }, [data, chartInitialized])

  // Draw to the texture canvas
  useEffect(() => {
    const draw = () => {
      const canvas = window['__screen3Canvas']
      const texture = window['__screen3Texture']

      if (!canvas || !texture) return

      const ctx = canvas.getContext('2d')

      // Clear canvas
      ctx.fillStyle = '#000000'
      ctx.fillRect(0, 0, 512, 320)

      // Draw header
      drawHeader(ctx, data, tokens, currentTokenIndex)

      // Get chart screenshot and draw it
      if (chartRef.current && chartInitialized) {
        try {
          const chartCanvas = chartRef.current.takeScreenshot()
          if (chartCanvas) {
            // Draw chart below header (at y=45)
            ctx.drawImage(chartCanvas, 0, 45, 512, 200)
          }
        } catch (e) {
          // Chart not ready, draw placeholder
          drawPlaceholderChart(ctx, data)
        }
      } else {
        drawPlaceholderChart(ctx, data)
      }

      // Draw indicator panels at bottom
      drawIndicatorPanels(ctx, data)

      // Draw border
      ctx.strokeStyle = 'rgba(0, 255, 255, 0.8)'
      ctx.lineWidth = 1
      ctx.strokeRect(2, 2, 508, 316)

      // Update texture
      if (texture) {
        texture.needsUpdate = true
      }
    }

    const intervalId = setInterval(draw, 100)
    return () => clearInterval(intervalId)
  }, [data, tokens, currentTokenIndex, chartInitialized])

  return null
}

// Draw header section
function drawHeader(ctx, data, tokens, currentIndex) {
  // Header background
  ctx.fillStyle = 'rgba(0, 255, 255, 0.1)'
  ctx.fillRect(0, 0, 512, 42)

  // Title
  ctx.fillStyle = '#00ffff'
  ctx.font = 'bold 16px monospace'
  ctx.fillText(`TECHNICAL ANALYSIS - ${data.symbol}`, 16, 24)

  // Price and change
  const price = data.current?.price || 0
  const priceStr = price > 1000 ? `$${price.toLocaleString('en-US', { maximumFractionDigits: 0 })}` :
                   price > 1 ? `$${price.toFixed(2)}` : `$${price.toFixed(4)}`

  ctx.fillStyle = '#ffffff'
  ctx.font = 'bold 14px monospace'
  ctx.fillText(priceStr, 300, 16)

  // Trend indicator
  const trend = data.current?.trend || 'sideways'
  const trendColors = { bullish: '#26a69a', bearish: '#ef5350', sideways: '#ffeb3b' }
  ctx.fillStyle = trendColors[trend]
  ctx.font = 'bold 11px monospace'
  ctx.fillText(trend.toUpperCase(), 300, 32)

  // Token selector tabs
  tokens.forEach((token, i) => {
    const isActive = i === currentIndex
    ctx.fillStyle = isActive ? '#00ffff' : 'rgba(0, 255, 255, 0.3)'
    ctx.fillRect(400 + i * 28, 8, 24, 14)
    ctx.fillStyle = isActive ? '#000000' : 'rgba(255, 255, 255, 0.5)'
    ctx.font = 'bold 8px monospace'
    ctx.fillText(token, 402 + i * 28, 18)
  })

  // Live indicator
  ctx.fillStyle = data.isLive ? '#26a69a' : '#ffeb3b'
  ctx.font = '9px monospace'
  ctx.fillText(data.isLive ? 'LIVE' : 'SYNC', 400, 35)

  // Last update time
  if (data.updatedAt) {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)'
    ctx.font = '8px monospace'
    const updatedDate = new Date(data.updatedAt)
    const now = new Date()
    const ageSeconds = Math.floor((now - updatedDate) / 1000)
    const ageText = ageSeconds > 60 ? `${Math.floor(ageSeconds / 60)}m` : `${ageSeconds}s`
    ctx.fillText(ageText, 440, 35)
  }

  // Divider
  ctx.strokeStyle = '#00ffff'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(16, 42)
  ctx.lineTo(496, 42)
  ctx.stroke()
}

// Draw placeholder chart when lightweight-charts is not ready
function drawPlaceholderChart(ctx, data) {
  if (!data.candles || data.candles.length === 0) {
    ctx.fillStyle = 'rgba(0, 255, 255, 0.3)'
    ctx.font = '12px monospace'
    ctx.fillText('Loading chart data...', 200, 140)
    return
  }

  // Simple candlestick fallback
  const candles = data.candles.slice(-50)
  const chartX = 20
  const chartY = 55
  const chartWidth = 470
  const chartHeight = 180

  const allPrices = candles.flatMap(c => [c.high, c.low])
  const maxPrice = Math.max(...allPrices)
  const minPrice = Math.min(...allPrices)
  const priceRange = maxPrice - minPrice || 1
  const candleWidth = chartWidth / candles.length

  candles.forEach((candle, i) => {
    const x = chartX + i * candleWidth
    const highY = chartY + (1 - (candle.high - minPrice) / priceRange) * chartHeight
    const lowY = chartY + (1 - (candle.low - minPrice) / priceRange) * chartHeight
    const openY = chartY + (1 - (candle.open - minPrice) / priceRange) * chartHeight
    const closeY = chartY + (1 - (candle.close - minPrice) / priceRange) * chartHeight

    const isBullish = candle.close >= candle.open
    ctx.strokeStyle = isBullish ? '#26a69a' : '#ef5350'
    ctx.fillStyle = isBullish ? 'rgba(38, 166, 154, 0.5)' : 'rgba(239, 83, 80, 0.5)'

    // Wick
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(x + candleWidth / 2, highY)
    ctx.lineTo(x + candleWidth / 2, lowY)
    ctx.stroke()

    // Body
    const bodyTop = Math.min(openY, closeY)
    const bodyHeight = Math.max(1, Math.abs(closeY - openY))
    ctx.fillRect(x + 1, bodyTop, Math.max(1, candleWidth - 2), bodyHeight)
  })
}

// Draw indicator panels at bottom
function drawIndicatorPanels(ctx, data) {
  const panelY = 248

  // Background
  ctx.fillStyle = 'rgba(0, 0, 0, 0.8)'
  ctx.fillRect(0, panelY, 512, 70)

  // RSI Section
  ctx.fillStyle = '#00ffff'
  ctx.font = 'bold 10px monospace'
  ctx.fillText('RSI(14)', 16, panelY + 14)

  const rsi = data.current?.rsi || 50
  const rsiBarWidth = 120
  const rsiBarX = 70

  // RSI background
  ctx.fillStyle = 'rgba(255, 68, 68, 0.2)'
  ctx.fillRect(rsiBarX, panelY + 6, rsiBarWidth * 0.3, 12) // Oversold zone
  ctx.fillRect(rsiBarX + rsiBarWidth * 0.7, panelY + 6, rsiBarWidth * 0.3, 12) // Overbought zone
  ctx.fillStyle = 'rgba(255, 255, 68, 0.2)'
  ctx.fillRect(rsiBarX + rsiBarWidth * 0.3, panelY + 6, rsiBarWidth * 0.4, 12) // Neutral zone

  // RSI needle
  const rsiX = rsiBarX + (rsi / 100) * rsiBarWidth
  ctx.strokeStyle = '#ffffff'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(rsiX, panelY + 4)
  ctx.lineTo(rsiX, panelY + 20)
  ctx.stroke()

  // RSI value
  ctx.fillStyle = rsi > 70 ? '#ef5350' : rsi < 30 ? '#26a69a' : '#ffeb3b'
  ctx.font = 'bold 11px monospace'
  ctx.fillText(rsi.toFixed(1), rsiBarX + rsiBarWidth + 8, panelY + 16)

  // MACD Section
  ctx.fillStyle = '#00ffff'
  ctx.font = 'bold 10px monospace'
  ctx.fillText('MACD', 16, panelY + 36)

  const macd = data.current?.macd || 0
  const macdSignal = data.current?.macdSignal || 0
  const histogram = data.current?.macdHistogram || (macd - macdSignal)

  // MACD histogram bar
  const histBarX = 70
  const histBarWidth = 80
  const maxHist = 100 // Scale factor
  const histHeight = Math.min(20, Math.abs(histogram) * 2)

  ctx.fillStyle = histogram >= 0 ? '#26a69a' : '#ef5350'
  if (histogram >= 0) {
    ctx.fillRect(histBarX + histBarWidth / 2, panelY + 42 - histHeight, histBarWidth / 4, histHeight)
  } else {
    ctx.fillRect(histBarX + histBarWidth / 2, panelY + 42, histBarWidth / 4, histHeight)
  }

  // MACD values
  ctx.fillStyle = '#ffffff'
  ctx.font = '9px monospace'
  ctx.fillText(`M:${macd.toFixed(2)}`, histBarX + histBarWidth + 5, panelY + 35)
  ctx.fillText(`S:${macdSignal.toFixed(2)}`, histBarX + histBarWidth + 5, panelY + 46)

  // Support/Resistance Section
  ctx.fillStyle = '#00ffff'
  ctx.font = 'bold 10px monospace'
  ctx.fillText('S/R', 250, panelY + 14)

  const support = data.current?.support || 0
  const resistance = data.current?.resistance || 0

  ctx.fillStyle = '#26a69a'
  ctx.font = '10px monospace'
  const supportStr = support > 1000 ? `S:$${(support / 1000).toFixed(1)}k` : `S:$${support.toFixed(2)}`
  ctx.fillText(supportStr, 280, panelY + 14)

  ctx.fillStyle = '#ef5350'
  const resistStr = resistance > 1000 ? `R:$${(resistance / 1000).toFixed(1)}k` : `R:$${resistance.toFixed(2)}`
  ctx.fillText(resistStr, 350, panelY + 14)

  // Bollinger Band indicator
  ctx.fillStyle = '#00ffff'
  ctx.font = 'bold 10px monospace'
  ctx.fillText('BB', 250, panelY + 36)

  // Draw mini BB representation
  const bbY = panelY + 44
  const bbWidth = 100

  // Get last bollinger values
  const lastUpper = data.indicators?.bollingerUpper?.slice(-1)[0]?.value
  const lastMiddle = data.indicators?.bollingerMiddle?.slice(-1)[0]?.value
  const lastLower = data.indicators?.bollingerLower?.slice(-1)[0]?.value
  const currentPrice = data.current?.price

  if (lastUpper && lastLower && lastMiddle && currentPrice) {
    const range = lastUpper - lastLower
    const pricePosition = range > 0 ? (currentPrice - lastLower) / range : 0.5

    // Draw BB band
    ctx.fillStyle = 'rgba(33, 150, 243, 0.3)'
    ctx.fillRect(280, bbY - 8, bbWidth, 16)

    // Draw middle line
    ctx.strokeStyle = 'rgba(33, 150, 243, 0.8)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(280 + bbWidth / 2, bbY - 8)
    ctx.lineTo(280 + bbWidth / 2, bbY + 8)
    ctx.stroke()

    // Draw price position
    const priceX = 280 + pricePosition * bbWidth
    ctx.fillStyle = currentPrice > lastMiddle ? '#26a69a' : '#ef5350'
    ctx.beginPath()
    ctx.arc(priceX, bbY, 4, 0, Math.PI * 2)
    ctx.fill()
  }

  // Trading Signal
  ctx.fillStyle = '#00ffff'
  ctx.font = 'bold 10px monospace'
  ctx.fillText('SIGNAL:', 400, panelY + 14)

  const trend = data.current?.trend || 'sideways'
  let signal = 'HOLD'
  let signalColor = '#ffeb3b'

  if (trend === 'bullish' && rsi < 70) {
    signal = 'BUY'
    signalColor = '#26a69a'
  } else if (trend === 'bearish' && rsi > 30) {
    signal = 'SELL'
    signalColor = '#ef5350'
  } else if (rsi > 70) {
    signal = 'OVERBOUGHT'
    signalColor = '#ef5350'
  } else if (rsi < 30) {
    signal = 'OVERSOLD'
    signalColor = '#26a69a'
  }

  ctx.fillStyle = signalColor
  ctx.font = 'bold 14px monospace'
  ctx.fillText(signal, 400, panelY + 36)

  // Legend for chart indicators
  ctx.fillStyle = '#ffeb3b'
  ctx.font = '8px monospace'
  ctx.fillText('EMA12', 400, panelY + 52)
  ctx.fillStyle = '#ff9800'
  ctx.fillText('EMA26', 440, panelY + 52)
  ctx.fillStyle = 'rgba(33, 150, 243, 0.8)'
  ctx.fillText('BB', 480, panelY + 52)
}

export default TeknoScreen
