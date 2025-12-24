import { useEffect, useState } from 'react'

// Sentiment data fetching hook
const useSentimentData = (refreshInterval = 28800000) => { // 8 hours for sentiment updates (8 * 60 * 60 * 1000)
  const [data, setData] = useState({
    fearGreed: { value: 0, label: 'Neutral' },
    trendingTopics: [],
    polymarket: null,
    whaleActivity: 'Normal',
    fundingRates: { btc: 0, eth: 0 },
    isGrokLive: false
  })

  useEffect(() => {
    const fetchSentimentData = async () => {
      try {
        // Fear & Greed Index
        const fgRes = await fetch('https://api.alternative.me/fng/?limit=1')
        const fg = await fgRes.json()
        
        // Fetch trending topics and Polymarket data from Grok API
        let trendingTopics = []
        let polymarket = null
        let isGrokLive = false
        
        try {
          // console.log('[SentimentScreen] Fetching from Grok API...')
          const grokRes = await fetch('/api/ai/trending', {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
          })
          
          // console.log('[SentimentScreen] Grok API status:', grokRes.status)
          
          if (grokRes.ok) {
            const grokData = await grokRes.json()
            // console.log('[SentimentScreen] Full Grok API response:', grokData)
            
            if (grokData.topics && grokData.topics.length > 0) {
              trendingTopics = grokData.topics
              polymarket = grokData.polymarket || null
              // Check source - it could be 'grok', 'firestore', or 'fallback'
              isGrokLive = grokData.source === 'grok' || grokData.source === 'firestore'
              // console.log('[SentimentScreen] Data source:', grokData.source)
              // console.log('[SentimentScreen] Using trending topics (live:', isGrokLive, '):', trendingTopics)
              // console.log('[SentimentScreen] Polymarket data:', polymarket)
            } else {
              // console.log('[SentimentScreen] No topics in Grok response')
            }
          } else {
            // console.log('[SentimentScreen] Grok API returned non-OK status:', grokRes.status)
          }
        } catch (err) {
          // console.log('[SentimentScreen] Failed to fetch from Grok API:', err)
        }
        
        // Don't use fallback trending topics - keep empty if not available
        
        // Don't use fallback Polymarket data - keep it null if not available
        
        // Simulated whale activity and funding rates
        const whaleStates = ['Accumulating', 'Normal', 'Distributing']
        const whaleActivity = whaleStates[Math.floor(Math.random() * whaleStates.length)]
        
        setData({
          fearGreed: {
            value: parseInt(fg.data?.[0]?.value || 0),  // REAL DATA from Alternative.me
            label: fg.data?.[0]?.value_classification || 'Unable to retrieve'  // REAL DATA
          },
          trendingTopics,  // Empty array if no data available
          polymarket,      // null if no data available
          whaleActivity,   // SIMULATED (ready for on-chain data)
          fundingRates: {  // SIMULATED (ready for exchange APIs)
            btc: (Math.random() * 0.04 - 0.02).toFixed(4),
            eth: (Math.random() * 0.04 - 0.02).toFixed(4)
          },
          isGrokLive: isGrokLive  // True if we got real Grok data
        })
      } catch (err) {
        console.error('[SentimentScreen] Data fetch failed:', err)
      }
    }

    // Initial fetch
    fetchSentimentData()
    
    // Set up refresh interval
    const interval = setInterval(fetchSentimentData, refreshInterval)
    
    return () => clearInterval(interval)
  }, [refreshInterval])

  return data
}

// The sentiment screen component
const SentimentScreen = () => {
  const data = useSentimentData()
  const [hasStartedDrawing, setHasStartedDrawing] = useState(false)
  
  // Only log when data actually changes
  useEffect(() => {
    // console.log('[SentimentScreen] Data updated:', data)
  }, [data.fearGreed.value, data.trendingTopics.length])

  // Draw loop using useEffect with interval
  useEffect(() => {
    const draw = () => {
      // Use the global canvas set up by VideoScreens
      // @ts-ignore
      const canvas = window['__screen1Canvas']
      // @ts-ignore
      const texture = window['__screen1Texture']
      
      if (!canvas || !texture) {
        // Only log once in a while to reduce spam
        if (Math.random() < 0.01) {  // 1% chance
          // console.log('[SentimentScreen] Waiting for canvas/texture...', {
          //   canvas: !!canvas,
          //   texture: !!texture,
          //   windowKeys: Object.keys(window).filter(k => k.includes('screen'))
          // })
        }
        return
      }
      
      // Log once when we start drawing
      if (!hasStartedDrawing) {
        // console.log('[SentimentScreen] Started drawing to Screen1!');
        setHasStartedDrawing(true);
      }
      
      const ctx = canvas.getContext('2d')
      const t = performance.now() / 1000 // Time in seconds

      // Background - clean black
      ctx.fillStyle = '#000000'
      ctx.fillRect(0, 0, 512, 320)

      // Header
      ctx.fillStyle = '#9333ea' // Purple for sentiment
      ctx.font = 'bold 18px monospace'
      ctx.fillText('◈ SENTIMENT ANALYSIS', 16, 28)
      
      // Divider line
      ctx.strokeStyle = '#9333ea'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(16, 40)
      ctx.lineTo(496, 40)
      ctx.stroke()

      // Fear & Greed Index - Larger display
      drawFearGreedGauge(ctx, data.fearGreed, 60, t)

      // Polymarket Bet Display (pass time for animation)
      drawPolymarketBet(ctx, data.polymarket, 130, t)

      // Trending Topics  
      drawTrendingTopics(ctx, data.trendingTopics, 215)

      // Whale Activity & Funding
      drawMarketMetrics(ctx, data.whaleActivity, data.fundingRates, 290)

      // Data source indicator
      ctx.fillStyle = 'rgba(147, 51, 234, 0.4)'
      ctx.font = '9px monospace'
      const dataStatus = data.isGrokLive 
        ? '*LIVE: Fear&Greed | AI: Grok Topics & Predictions | SIM: Whale,Funding'
        : '*LIVE: Fear&Greed | DATA UNAVAILABLE'
      ctx.fillText(dataStatus, 10, 310)
      
      // Simple border
      ctx.strokeStyle = 'rgba(147, 51, 234, 0.8)'
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
  }, [data, hasStartedDrawing]) // Redraw when data changes

  return null
}

// Helper functions
const drawFearGreedGauge = (ctx, { value, label }, y, time) => {
  ctx.fillStyle = '#9333ea'
  ctx.font = 'bold 16px monospace'
  ctx.fillText('FEAR & GREED INDEX', 24, y)

  // Larger gauge
  const gaugeX = 24
  const gaugeY = y + 20
  const gaugeWidth = 300
  const gaugeHeight = 30

  // Gradient bar
  const gradient = ctx.createLinearGradient(gaugeX, 0, gaugeX + gaugeWidth, 0)
  gradient.addColorStop(0, '#ff4444')
  gradient.addColorStop(0.25, '#ff8844')
  gradient.addColorStop(0.5, '#ffff44')
  gradient.addColorStop(0.75, '#88ff44')
  gradient.addColorStop(1, '#44ff44')
  
  ctx.fillStyle = gradient
  ctx.fillRect(gaugeX, gaugeY, gaugeWidth, gaugeHeight)

  // Indicator needle with pulse
  const needleX = gaugeX + (value / 100) * gaugeWidth
  const pulse = Math.sin(time * 4) * 2
  
  ctx.fillStyle = '#ffffff'
  ctx.beginPath()
  ctx.moveTo(needleX, gaugeY - 4 + pulse)
  ctx.lineTo(needleX - 8, gaugeY - 14)
  ctx.lineTo(needleX + 8, gaugeY - 14)
  ctx.closePath()
  ctx.fill()

  // Value and label
  ctx.fillStyle = '#ffffff'
  ctx.font = 'bold 28px monospace'
  ctx.fillText(value.toString(), gaugeX + gaugeWidth + 20, gaugeY + 25)
  
  ctx.fillStyle = getGreedColor(value)
  ctx.font = 'bold 14px monospace'
  ctx.fillText(label.toUpperCase(), gaugeX + gaugeWidth + 80, gaugeY + 25)
}

const drawPolymarketBet = (ctx, polymarket, y, time) => {
  ctx.fillStyle = '#9333ea'
  ctx.font = 'bold 14px monospace'
  const headerText = polymarket?.source === 'polymarket_real' ? '🎲 POLYMARKET BINARY MARKETS' : '🎲 PREDICTION MARKETS'
  ctx.fillText(headerText, 24, y)
  
  if (!polymarket) {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)'
    ctx.font = '11px monospace'
    ctx.fillText('Market data unavailable', 24, y + 20)
    return
  }
  
  // If we have multiple markets, alternate between them every 5 seconds
  if (polymarket.markets && polymarket.markets.length > 0) {
    // Use time to alternate between markets
    const t = time || performance.now() / 1000;
    const marketIndex = Math.floor(t / 5) % polymarket.markets.length; // Switch every 5 seconds
    const market = polymarket.markets[marketIndex];
    
    const marketY = y + 24;
    
    // Market title - no truncation needed, we have room
    ctx.fillStyle = '#ffffff'
    ctx.font = '11px monospace'
    // Simplify the title a bit for readability
    let title = market.title;
    title = title.replace(' by market cap on December 31?', '?');
    title = title.replace(' in the world', '');
    ctx.fillText(title, 24, marketY);
    
    // YES/NO bar below title with percentages
    const barY = marketY + 12;
    const barHeight = 16;
    const barWidth = 200;
    const yesWidth = (market.yes / 100) * barWidth;
    
    // Background bar (NO portion - red)
    ctx.fillStyle = 'rgba(255, 68, 68, 0.4)';
    ctx.fillRect(24, barY, barWidth, barHeight);
    
    // YES portion (green)
    if (market.yes > 0) {
      ctx.fillStyle = 'rgba(68, 255, 68, 0.7)';
      ctx.fillRect(24, barY, yesWidth, barHeight);
    }
    
    // Text labels - show YES/NO percentages
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 10px monospace';
    
    // YES percentage on the left
    if (market.yes > 10) {
      ctx.fillText(`YES ${market.yes}%`, 28, barY + 11);
    } else if (market.yes > 0) {
      ctx.fillText(`${market.yes}%`, 28, barY + 11);
    }
    
    // NO percentage on the right side of bar
    if (market.no > 10) {
      const noText = `NO ${market.no}%`;
      const noTextWidth = ctx.measureText(noText).width;
      ctx.fillText(noText, 24 + barWidth - noTextWidth - 4, barY + 11);
    }
    
    // Volume on the far right with better spacing
    ctx.fillStyle = 'rgba(147, 51, 234, 0.9)';
    ctx.font = 'bold 10px monospace';
    ctx.fillText(`VOL: ${market.volume}`, 24 + barWidth + 20, barY + 11);
    
    // Market indicator dots (show which market is displayed)
    if (polymarket.markets.length > 1) {
      ctx.fillStyle = 'rgba(147, 51, 234, 0.5)';
      for (let i = 0; i < polymarket.markets.length; i++) {
        if (i === marketIndex) {
          ctx.fillStyle = '#9333ea';
        } else {
          ctx.fillStyle = 'rgba(147, 51, 234, 0.3)';
        }
        ctx.fillRect(430 + (i * 15), marketY - 10, 8, 8);
      }
    }
    
    return;
  }
  
  // Single market display (fallback)
  ctx.fillStyle = '#ffffff'
  ctx.font = '11px monospace'
  const maxTitleLength = 40
  const title = polymarket.title.length > maxTitleLength 
    ? polymarket.title.substring(0, maxTitleLength) + '..'
    : polymarket.title
  ctx.fillText(title, 24, y + 20)
  
  // Draw YES/NO bars
  const barY = y + 30
  const barHeight = 18
  const barWidth = 200
  const yesWidth = (polymarket.yes / 100) * barWidth
  
  // Background bar
  ctx.fillStyle = 'rgba(255, 68, 68, 0.3)'
  ctx.fillRect(24, barY, barWidth, barHeight)
  
  // YES portion (green)
  ctx.fillStyle = 'rgba(68, 255, 68, 0.8)'
  ctx.fillRect(24, barY, yesWidth, barHeight)
  
  // Text labels
  ctx.fillStyle = '#000000'
  ctx.font = 'bold 11px monospace'
  ctx.fillText(`YES ${polymarket.yes}%`, 30, barY + 12)
  ctx.fillText(`NO ${polymarket.no}%`, barWidth - 40, barY + 12)
  
  // Volume indicator
  ctx.fillStyle = 'rgba(255, 255, 255, 0.6)'
  ctx.font = '10px monospace'
  ctx.fillText(`Volume: ${polymarket.volume}`, barWidth + 35, barY + 10)
}

const drawTrendingTopics = (ctx, topics, y) => {
  ctx.fillStyle = '#9333ea'
  ctx.font = 'bold 14px monospace'
  ctx.fillText('TRENDING TOPICS', 24, y)
  
  if (!topics || topics.length === 0) {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)'
    ctx.font = '11px monospace'
    ctx.fillText('Unable to retrieve trending topics', 24, y + 20)
    return
  }
  
  // Draw up to 4 trending topics
  topics.slice(0, 3).forEach((topic, i) => {
    const yPos = y + 20 + (i * 20)
    
    // Sentiment color
    const sentimentColor = topic.sentiment === 'bullish' ? '#44ff44' : 
                          topic.sentiment === 'bearish' ? '#ff4444' : '#ffff44'
    
    ctx.fillStyle = sentimentColor
    ctx.font = 'bold 11px monospace'
    ctx.fillText('●', 24, yPos)
    
    // Truncate topic text if too long (max ~35 chars)
    const topicText = topic.topic || `Topic ${i + 1}`
    const maxLength = 35
    const displayText = topicText.length > maxLength 
      ? topicText.substring(0, maxLength) + '..' 
      : topicText
    
    ctx.fillStyle = '#ffffff'
    ctx.font = '11px monospace'
    ctx.fillText(displayText, 40, yPos)
    
    // Move mentions to the right with proper spacing
    if (topic.mentions) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.5)'
      ctx.font = '10px monospace'
      const mentionsText = `(${topic.mentions})`
      // Position at the far right
      const textWidth = ctx.measureText(mentionsText).width
      ctx.fillText(mentionsText, 490 - textWidth, yPos)
    }
  })
}

const drawMarketMetrics = (ctx, whaleActivity, fundingRates, y) => {
  // Whale Activity
  ctx.fillStyle = '#9333ea'
  ctx.font = 'bold 14px monospace'
  ctx.fillText('WHALE ACTIVITY:', 24, y)
  
  const whaleColor = whaleActivity === 'Accumulating' ? '#44ff44' :
                     whaleActivity === 'Distributing' ? '#ff4444' : '#ffff44'
  ctx.fillStyle = whaleColor
  ctx.font = 'bold 14px monospace'
  ctx.fillText(whaleActivity.toUpperCase(), 150, y)
  
  // Funding Rates
  ctx.fillStyle = '#9333ea'
  ctx.font = 'bold 12px monospace'
  ctx.fillText('FUNDING:', 280, y)
  
  ctx.font = '11px monospace'
  const btcFundingColor = fundingRates.btc > 0 ? '#44ff44' : '#ff4444'
  const ethFundingColor = fundingRates.eth > 0 ? '#44ff44' : '#ff4444'
  
  ctx.fillStyle = btcFundingColor
  ctx.fillText(`BTC: ${fundingRates.btc}%`, 350, y)
  
  ctx.fillStyle = ethFundingColor
  ctx.fillText(`ETH: ${fundingRates.eth}%`, 430, y)
}

const getGreedColor = (value) => {
  if (value < 25) return '#ff4444'
  if (value < 45) return '#ff8844'
  if (value < 55) return '#ffff44'
  if (value < 75) return '#88ff44'
  return '#44ff44'
}

export default SentimentScreen