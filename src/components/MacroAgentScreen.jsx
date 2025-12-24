import { useEffect, useState } from 'react'

// Data fetching hook with 15 minute refresh interval and price history
const useMacroData = (refreshInterval = 900000) => { // 900000ms = 15 minutes
  const [data, setData] = useState({
    btc: { price: 0, change: 0, history: [] },
    eth: { price: 0, change: 0, history: [] },
    dominance: { btc: 0, eth: 0 },
    totalMarketCap: 0,
    volume24h: 0,
  })

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Try to fetch from our cached API first
        const response = await fetch('/api/ai/crypto')
        
        if (response.ok) {
          const cachedData = await response.json()
          // console.log('[MacroAgentScreen] Using cached data from:', cachedData.source)
          
          // If data is stale, trigger an update in the background
          if (cachedData.isStale) {
            // console.log('[MacroAgentScreen] Data is stale, triggering background update')
            fetch('/api/ai/update-crypto').catch(err => 
              console.log('[MacroAgentScreen] Background update failed:', err)
            )
          }
          
          setData({
            btc: cachedData.btc || { price: 95000, change: 2.5, history: [] },
            eth: cachedData.eth || { price: 3200, change: 3.2, history: [] },
            dominance: {
              btc: cachedData.dominance?.btc || "52.3",
              eth: cachedData.dominance?.eth || "16.8"
            },
            totalMarketCap: cachedData.totalMarketCap || 3400000000000,
            volume24h: cachedData.volume24h || 145000000000
          })
        } else {
          // console.log('[MacroAgentScreen] Failed to fetch cached data, using fallback')
          // Use fallback values
          setData({
            btc: { price: 95000, change: 2.5, history: [] },
            eth: { price: 3200, change: 3.2, history: [] },
            dominance: { btc: "52.3", eth: "16.8" },
            totalMarketCap: 3400000000000,
            volume24h: 145000000000
          })
        }
      } catch (err) {
        console.error('[MacroAgentScreen] Data fetch failed:', err)
        // Use fallback values on error
        setData({
          btc: { price: 95000, change: 2.5, history: [] },
          eth: { price: 3200, change: 3.2, history: [] },
          dominance: { btc: "52.3", eth: "16.8" },
          totalMarketCap: 3400000000000,
          volume24h: 145000000000
        })
      }
    }

    // Initial fetch
    fetchData()
    
    // Set up interval for refreshing every 15 minutes
    const interval = setInterval(fetchData, refreshInterval)
    
    return () => clearInterval(interval)
  }, [refreshInterval])

  return data
}

// The screen component
const MacroAgentScreen = () => {
  const data = useMacroData()
  
  // Only log when data actually changes
  // useEffect(() => {
  //   if (data.btc.price > 0) {
  //     console.log('[MacroAgentScreen] Data updated:', data)
  //   }
  // }, [data.btc.price, data.eth.price])

  // Draw loop using useEffect with interval instead of useFrame
  useEffect(() => {
    const draw = () => {
      // Use the global canvas set up by VideoScreens
      // @ts-ignore
      const canvas = window.__screen2Canvas
      // @ts-ignore
      const texture = window.__screen2Texture
      
      if (!canvas || !texture) {
        // console.log('[MacroAgentScreen] Waiting for canvas/texture...')
        return
      }
      
      const ctx = canvas.getContext('2d')

    // Background - clean black
    ctx.fillStyle = '#000000'
    ctx.fillRect(0, 0, 512, 320)

    // Header
    ctx.fillStyle = '#00ff66'
    ctx.font = 'bold 18px monospace'
    ctx.fillText('◆ MACRO OVERVIEW', 16, 28)
    
    // Divider line
    ctx.strokeStyle = '#00ff66'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(16, 40)
    ctx.lineTo(496, 40)
    ctx.stroke()

    // BTC Price
    drawPriceRow(ctx, 'BTC', data.btc.price, data.btc.change, 70, data.btc.history)
    
    // ETH Price
    drawPriceRow(ctx, 'ETH', data.eth.price, data.eth.change, 110, data.eth.history)

    // Market Overview
    drawMarketOverview(ctx, data, 160)

    // Simple border
    ctx.strokeStyle = 'rgba(0, 255, 100, 0.8)'
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
  }, [data]) // Redraw when data changes

  // This component doesn't render anything in the 3D scene
  // It just updates the canvas that VideoScreens already attached to Screen2
  return null
}

// Helper functions
const drawPriceRow = (ctx, symbol, price, change, y, history = []) => {
  const isPositive = change >= 0
  
  ctx.fillStyle = '#00ff66'
  ctx.font = 'bold 16px monospace'
  ctx.fillText(symbol, 24, y)
  
  ctx.fillStyle = '#ffffff'
  ctx.font = '20px monospace'
  ctx.fillText(`$${price.toLocaleString(undefined, { maximumFractionDigits: 0 })}`, 80, y)
  
  ctx.fillStyle = isPositive ? '#00ff66' : '#ff4444'
  ctx.font = '14px monospace'
  const arrow = isPositive ? '▲' : '▼'
  ctx.fillText(`${arrow} ${Math.abs(change).toFixed(2)}%`, 220, y)
  
  // Draw real sparkline with historical data
  drawMiniSparkline(ctx, 320, y - 12, history, isPositive)
}

const drawMiniSparkline = (ctx, x, y, history, trending) => {
  // Add "24H" label
  ctx.fillStyle = 'rgba(255, 255, 255, 0.5)'
  ctx.font = '10px monospace'
  ctx.fillText('24H', x - 5, y - 2)
  
  ctx.strokeStyle = trending ? '#00ff66' : '#ff4444'
  ctx.lineWidth = 1.5
  
  if (history.length > 1) {
    // Draw real historical data
    const width = 140  // Width of sparkline area
    const height = 20  // Height of sparkline area
    const points = history.slice(-24) // Last 24 hours
    
    if (points.length > 0) {
      // Calculate min and max for scaling
      const min = Math.min(...points)
      const max = Math.max(...points)
      const range = max - min || 1
      
      ctx.beginPath()
      points.forEach((price, i) => {
        const xPos = x + (i / (points.length - 1)) * width
        const yPos = y + height - ((price - min) / range) * height
        
        if (i === 0) {
          ctx.moveTo(xPos, yPos)
        } else {
          ctx.lineTo(xPos, yPos)
        }
      })
      ctx.stroke()
      
      // Add a subtle glow effect
      ctx.strokeStyle = trending ? 'rgba(0, 255, 100, 0.3)' : 'rgba(255, 68, 68, 0.3)'
      ctx.lineWidth = 3
      ctx.stroke()
      
      // Add min/max price indicators
      ctx.fillStyle = 'rgba(255, 255, 255, 0.4)'
      ctx.font = '9px monospace'
      ctx.fillText(`H:${Math.floor(max).toLocaleString()}`, x + width + 5, y + 5)
      ctx.fillText(`L:${Math.floor(min).toLocaleString()}`, x + width + 5, y + height - 2)
    }
  } else {
    // Fallback to simple line if no history
    ctx.beginPath()
    ctx.moveTo(x, y + 10)
    ctx.lineTo(x + 140, y + 10 + (trending ? -5 : 5))
    ctx.stroke()
  }
}

const drawMarketOverview = (ctx, data, y) => {
  // Market Cap Header
  ctx.fillStyle = '#00ff66'
  ctx.font = 'bold 14px monospace'
  ctx.fillText('MARKET OVERVIEW', 24, y)
  
  // Total Market Cap
  ctx.fillStyle = '#ffffff'
  ctx.font = '12px monospace'
  const marketCapFormatted = (data.totalMarketCap / 1e12).toFixed(2) // Convert to trillions
  ctx.fillText(`Total Cap: $${marketCapFormatted}T`, 24, y + 25)
  
  // 24h Volume
  const volumeFormatted = (data.volume24h / 1e9).toFixed(1) // Convert to billions
  ctx.fillText(`24h Vol: $${volumeFormatted}B`, 24, y + 45)
  
  // Dominance Section
  ctx.fillStyle = '#00ff66'
  ctx.font = 'bold 14px monospace'
  ctx.fillText('DOMINANCE', 250, y)
  
  // BTC Dominance with visual bar
  drawDominanceBar(ctx, 'BTC', data.dominance.btc, 250, y + 20, '#f7931a')
  
  // ETH Dominance with visual bar
  drawDominanceBar(ctx, 'ETH', data.dominance.eth, 250, y + 45, '#627eea')
}

const drawDominanceBar = (ctx, symbol, percentage, x, y, color) => {
  // Label
  ctx.fillStyle = '#ffffff'
  ctx.font = '11px monospace'
  ctx.fillText(`${symbol}:`, x, y)
  
  // Bar background
  ctx.fillStyle = 'rgba(255, 255, 255, 0.1)'
  ctx.fillRect(x + 35, y - 10, 100, 12)
  
  // Bar fill
  ctx.fillStyle = color
  ctx.fillRect(x + 35, y - 10, (percentage / 100) * 100, 12)
  
  // Percentage text
  ctx.fillStyle = '#ffffff'
  ctx.font = 'bold 11px monospace'
  ctx.fillText(`${percentage}%`, x + 140, y)
}

export default MacroAgentScreen