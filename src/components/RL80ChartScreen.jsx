import { useEffect, useState, useRef, useCallback } from 'react'
import { createChart, ColorType, CrosshairMode, CandlestickSeries, HistogramSeries } from 'lightweight-charts'

const CA = '0x30D01555d88c76500a82754A1D53cAc082A6CB75'

const useRL80Data = () => {
  const [data, setData] = useState({
    price: null,
    priceChange24h: 0,
    fdv: null,
    liquidity: null,
    candles: [],
    timeframe: 'hourly',
  })

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/rl80-price')
      if (!res.ok) return
      const json = await res.json()
      setData(json)
    } catch (e) {
      console.error('[RL80ChartScreen] fetch error:', e)
    }
  }, [])

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 60_000) // refresh every minute
    return () => clearInterval(interval)
  }, [fetchData])

  return data
}

const RL80ChartScreen = () => {
  const data = useRL80Data()
  const chartContainerRef = useRef(null)
  const chartRef = useRef(null)
  const candlestickSeriesRef = useRef(null)
  const volumeSeriesRef = useRef(null)
  const [chartInitialized, setChartInitialized] = useState(false)
  const geckoLogoRef = useRef(null)

  // Preload GeckoTerminal logo
  useEffect(() => {
    const img = new Image()
    img.src = '/coinGeckoTerminalLogo.webp'
    img.onload = () => { geckoLogoRef.current = img }
  }, [])

  // Initialize off-screen chart
  useEffect(() => {
    let container = document.getElementById('rl80-chart-container')
    if (!container) {
      container = document.createElement('div')
      container.id = 'rl80-chart-container'
      container.style.position = 'absolute'
      container.style.left = '-9999px'
      container.style.top = '-9999px'
      container.style.width = '512px'
      container.style.height = '320px'
      container.style.overflow = 'hidden'
      document.body.appendChild(container)
    }
    chartContainerRef.current = container

    const chart = createChart(container, {
      width: 512,
      height: 220,
      layout: {
        background: { type: ColorType.Solid, color: '#000000' },
        textColor: '#00ffff',
        fontSize: 10,
      },
      grid: {
        vertLines: { color: 'rgba(0, 255, 255, 0.08)' },
        horzLines: { color: 'rgba(0, 255, 255, 0.08)' },
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
        timeVisible: true,
        secondsVisible: false,
      },
      handleScroll: false,
      handleScale: false,
    })

    const candlestickSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#26a69a',
      downColor: '#ef5350',
      borderUpColor: '#26a69a',
      borderDownColor: '#ef5350',
      wickUpColor: '#26a69a',
      wickDownColor: '#ef5350',
    })

    const volumeSeries = chart.addSeries(HistogramSeries, {
      color: '#26a69a',
      priceFormat: { type: 'volume' },
      priceScaleId: 'volume',
    })

    chart.priceScale('volume').applyOptions({
      scaleMargins: { top: 0.85, bottom: 0 },
    })

    chartRef.current = chart
    candlestickSeriesRef.current = candlestickSeries
    volumeSeriesRef.current = volumeSeries
    setChartInitialized(true)

    return () => {
      chart.remove()
      if (container && container.parentNode) {
        container.parentNode.removeChild(container)
      }
    }
  }, [])

  // Update chart data
  useEffect(() => {
    if (!chartInitialized || !data.candles || data.candles.length === 0) return

    const chart = chartRef.current
    const candlestickSeries = candlestickSeriesRef.current
    const volumeSeries = volumeSeriesRef.current
    if (!chart || !candlestickSeries) return

    candlestickSeries.setData(data.candles)

    const volumeData = data.candles.map(c => ({
      time: c.time,
      value: c.volume,
      color: c.close >= c.open ? 'rgba(38, 166, 154, 0.5)' : 'rgba(239, 83, 80, 0.5)',
    }))
    volumeSeries.setData(volumeData)

    chart.timeScale().fitContent()
  }, [data, chartInitialized])

  // Draw to Screen1 canvas texture
  useEffect(() => {
    const draw = () => {
      const canvas = window['__screen1Canvas']
      const texture = window['__screen1Texture']
      if (!canvas || !texture) return

      const ctx = canvas.getContext('2d')

      // Clear
      ctx.fillStyle = '#000000'
      ctx.fillRect(0, 0, 512, 320)

      // Header
      drawHeader(ctx, data)

      // Chart
      if (chartRef.current && chartInitialized) {
        try {
          const chartCanvas = chartRef.current.takeScreenshot()
          if (chartCanvas) {
            ctx.drawImage(chartCanvas, 0, 50, 512, 220)
          }
        } catch (e) {
          drawPlaceholderChart(ctx, data)
        }
      } else {
        drawPlaceholderChart(ctx, data)
      }

      // Footer
      drawFooter(ctx, data, geckoLogoRef.current)

      // Border
      ctx.strokeStyle = 'rgba(0, 255, 255, 0.8)'
      ctx.lineWidth = 1
      ctx.strokeRect(2, 2, 508, 316)

      texture.needsUpdate = true
    }

    const intervalId = setInterval(draw, 100)
    return () => clearInterval(intervalId)
  }, [data, chartInitialized])

  return null
}

function drawHeader(ctx, data) {
  // Header background
  ctx.fillStyle = 'rgba(0, 255, 255, 0.1)'
  ctx.fillRect(0, 0, 512, 48)

  // Title
  ctx.fillStyle = '#00ffff'
  ctx.font = 'bold 14px monospace'
  ctx.fillText('RL80 / USD', 16, 20)

  // Timeframe badge
  ctx.fillStyle = 'rgba(0, 255, 255, 0.3)'
  ctx.fillRect(130, 8, 50, 16)
  ctx.fillStyle = '#00ffff'
  ctx.font = 'bold 9px monospace'
  const tfLabel = data.timeframe === 'daily' ? '1D' : data.timeframe === '15m' ? '15M' : '1H'
  ctx.fillText(tfLabel, 145, 19)

  // Price
  const price = data.price
  if (price !== null && price !== undefined) {
    ctx.fillStyle = '#ffffff'
    ctx.font = 'bold 18px monospace'
    const priceStr = price < 0.0001 ? `$${price.toFixed(10)}` :
                     price < 0.001 ? `$${price.toFixed(8)}` :
                     price < 1 ? `$${price.toFixed(6)}` :
                     `$${price.toFixed(2)}`
    ctx.fillText(priceStr, 16, 42)
  }

  // 24h change
  const change = data.priceChange24h || 0
  const changePositive = change >= 0
  ctx.fillStyle = changePositive ? '#26a69a' : '#ef5350'
  ctx.font = 'bold 12px monospace'
  ctx.fillText(`${changePositive ? '+' : ''}${change.toFixed(2)}%`, 200, 42)

  // CA (truncated)
  ctx.fillStyle = 'rgba(255, 255, 255, 0.3)'
  ctx.font = '8px monospace'
  ctx.fillText(`CA: ${CA.slice(0, 6)}...${CA.slice(-4)}`, 350, 20)

  // Chain badge
  ctx.fillStyle = 'rgba(0, 100, 255, 0.4)'
  ctx.fillRect(350, 28, 40, 14)
  ctx.fillStyle = '#6699ff'
  ctx.font = 'bold 9px monospace'
  ctx.fillText('BASE', 355, 39)

  // Divider
  ctx.strokeStyle = '#00ffff'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(16, 48)
  ctx.lineTo(496, 48)
  ctx.stroke()
}

function drawPlaceholderChart(ctx, data) {
  if (!data.candles || data.candles.length === 0) {
    ctx.fillStyle = 'rgba(0, 255, 255, 0.3)'
    ctx.font = '12px monospace'
    ctx.fillText('Loading RL80 chart data...', 160, 160)
    return
  }

  // Simple candlestick fallback
  const candles = data.candles.slice(-50)
  const chartX = 20
  const chartY = 60
  const chartWidth = 470
  const chartHeight = 200

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

    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(x + candleWidth / 2, highY)
    ctx.lineTo(x + candleWidth / 2, lowY)
    ctx.stroke()

    const bodyTop = Math.min(openY, closeY)
    const bodyHeight = Math.max(1, Math.abs(closeY - openY))
    ctx.fillRect(x + 1, bodyTop, Math.max(1, candleWidth - 2), bodyHeight)
  })
}

function drawFooter(ctx, data, geckoLogo) {
  const y = 275

  ctx.fillStyle = 'rgba(0, 0, 0, 0.8)'
  ctx.fillRect(0, y, 512, 45)

  // GeckoTerminal logo
  if (geckoLogo) {
    const logoH = 16
    const logoW = (geckoLogo.width / geckoLogo.height) * logoH
    ctx.drawImage(geckoLogo, 420, y + 18, logoW, logoH)
  }

  // FDV
  ctx.fillStyle = '#00ffff'
  ctx.font = 'bold 9px monospace'
  ctx.fillText('FDV', 16, y + 14)
  ctx.fillStyle = '#ffffff'
  ctx.font = '10px monospace'
  const fdv = data.fdv
  const fdvStr = fdv ? (fdv >= 1_000_000 ? `$${(fdv / 1_000_000).toFixed(2)}M` :
                        fdv >= 1_000 ? `$${(fdv / 1_000).toFixed(1)}K` :
                        `$${fdv.toFixed(0)}`) : '--'
  ctx.fillText(fdvStr, 16, y + 28)

  // Liquidity
  ctx.fillStyle = '#00ffff'
  ctx.font = 'bold 9px monospace'
  ctx.fillText('LIQUIDITY', 130, y + 14)
  ctx.fillStyle = '#ffffff'
  ctx.font = '10px monospace'
  const liq = data.liquidity
  const liqStr = liq ? (liq >= 1_000_000 ? `$${(liq / 1_000_000).toFixed(2)}M` :
                        liq >= 1_000 ? `$${(liq / 1_000).toFixed(1)}K` :
                        `$${liq.toFixed(0)}`) : '--'
  ctx.fillText(liqStr, 130, y + 28)

  // 24h Change
  ctx.fillStyle = '#00ffff'
  ctx.font = 'bold 9px monospace'
  ctx.fillText('24H', 270, y + 14)
  const change = data.priceChange24h || 0
  ctx.fillStyle = change >= 0 ? '#26a69a' : '#ef5350'
  ctx.font = 'bold 12px monospace'
  ctx.fillText(`${change >= 0 ? '+' : ''}${change.toFixed(2)}%`, 270, y + 28)

  // Timestamp
  if (data.timestamp) {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)'
    ctx.font = '8px monospace'
    const updated = new Date(data.timestamp)
    const ago = Math.floor((Date.now() - updated.getTime()) / 1000)
    const agoStr = ago > 60 ? `${Math.floor(ago / 60)}m ago` : `${ago}s ago`
    ctx.fillText(agoStr, 420, y + 14)
  }
}

export default RL80ChartScreen
