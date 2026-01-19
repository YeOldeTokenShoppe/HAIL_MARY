import { useEffect, useState } from 'react'
import { db, doc, onSnapshot } from '@/lib/firebaseClient'

// Sentiment data hook - reads from Firestore (populated by cron job)
const useSentimentData = () => {
  const [data, setData] = useState({
    fearGreed: { value: 0, label: 'Loading...' },
    trendingTopics: [],
    polymarket: null,
    whaleActivity: { activity: 'Loading...', confidence: 0 },
    googleTrends: { btc: null, eth: null },
    appRankings: { coinbase: null, binance: null, metamask: null },
    isGrokLive: false,
    dataStatus: {
      fearGreed: 'loading',
      trending: 'loading',
      whale: 'loading',
      googleTrends: 'loading',
      appRankings: 'loading'
    }
  })

  useEffect(() => {
    // If Firebase not available, show unavailable state
    if (!db) {
      console.warn('[SentimentScreen] Firebase not initialized')
      setData(prev => ({
        ...prev,
        fearGreed: { value: 0, label: 'Unavailable' },
        whaleActivity: { activity: 'Unavailable', confidence: 0 },
        dataStatus: {
          fearGreed: 'unavailable',
          trending: 'unavailable',
          whale: 'unavailable',
          googleTrends: 'unavailable',
          appRankings: 'unavailable'
        }
      }))
      return
    }

    // Listen to Firestore for real-time updates from cron job
    const sentimentRef = doc(db, 'sentimentData', 'latest')

    const unsubscribe = onSnapshot(
      sentimentRef,
      (docSnapshot) => {
        if (docSnapshot.exists()) {
          const sentimentData = docSnapshot.data()

          setData({
            fearGreed: sentimentData.fearGreed || { value: 0, label: 'Unavailable' },
            trendingTopics: sentimentData.trendingTopics || [],
            polymarket: sentimentData.polymarket || null,
            whaleActivity: sentimentData.whaleActivity || { activity: 'Unknown', confidence: 0 },
            googleTrends: sentimentData.googleTrends || { btc: null, eth: null },
            appRankings: sentimentData.appRankings || { coinbase: null, binance: null, metamask: null },
            isGrokLive: sentimentData.dataStatus?.trending === 'live',
            dataStatus: sentimentData.dataStatus || {
              fearGreed: 'unavailable',
              trending: 'unavailable',
              whale: 'unavailable',
              googleTrends: 'unavailable',
              appRankings: 'unavailable'
            }
          })
        } else {
          // No data yet - cron job hasn't run
          console.log('[SentimentScreen] No sentiment data in Firestore yet')
          setData(prev => ({
            ...prev,
            fearGreed: { value: 0, label: 'Awaiting data...' },
            whaleActivity: { activity: 'Awaiting data...', confidence: 0 },
            dataStatus: {
              fearGreed: 'loading',
              trending: 'loading',
              whale: 'loading',
              googleTrends: 'loading',
              appRankings: 'loading'
            }
          }))
        }
      },
      (error) => {
        console.error('[SentimentScreen] Error listening to Firestore:', error)
        setData(prev => ({
          ...prev,
          dataStatus: {
            fearGreed: 'unavailable',
            trending: 'unavailable',
            whale: 'unavailable',
            googleTrends: 'unavailable',
            appRankings: 'unavailable'
          }
        }))
      }
    )

    // Cleanup listener on unmount
    return () => unsubscribe()
  }, [])

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

      // Fear & Greed Index - Compact display (left side)
      drawFearGreedCompact(ctx, data.fearGreed, 50, t)

      // Google Trends (center)
      drawGoogleTrends(ctx, data.googleTrends, data.dataStatus, 50)

      // App Rankings (right side)
      drawAppRankings(ctx, data.appRankings, data.dataStatus, 50)

      // Polymarket Bet Display (pass time for animation)
      drawPolymarketBet(ctx, data.polymarket, 115, t)

      // Trending Topics
      drawTrendingTopics(ctx, data.trendingTopics, 195)

      // Whale Activity
      drawWhaleActivity(ctx, data.whaleActivity, data.dataStatus, 280)

      // Data source indicator - show actual status
      ctx.fillStyle = 'rgba(147, 51, 234, 0.4)'
      ctx.font = '8px monospace'
      const status = data.dataStatus || {}
      const statusParts = []
      if (status.fearGreed === 'live') statusParts.push('F&G')
      if (status.trending === 'live') statusParts.push('SOCIAL')
      if (status.whale === 'live') statusParts.push('WHALE')
      if (status.googleTrends === 'live') statusParts.push('GTRENDS')
      if (status.appRankings === 'live') statusParts.push('APPS')
      const dataStatusText = statusParts.length > 0
        ? `LIVE: ${statusParts.join(' | ')}`
        : 'CONNECTING...'
      ctx.fillText(dataStatusText, 10, 298)

      // Data sources footer
      ctx.fillStyle = 'rgba(147, 51, 234, 0.3)'
      ctx.font = '7px monospace'
      ctx.fillText('Sources: Alternative.me | Reddit | CoinGecko | Polymarket | Binance | Google Trends | App Store', 10, 310)

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
const drawFearGreedCompact = (ctx, { value, label }, y, time) => {
  const x = 16

  ctx.fillStyle = '#9333ea'
  ctx.font = 'bold 11px monospace'
  ctx.fillText('FEAR & GREED', x, y)

  // Handle loading/unavailable states
  if (label === 'Loading...' || label === 'Unavailable' || label === 'Awaiting data...') {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)'
    ctx.font = '10px monospace'
    ctx.fillText('--', x + 10, y + 28)
    return
  }

  // Compact gauge bar
  const gaugeX = x
  const gaugeY = y + 8
  const gaugeWidth = 120
  const gaugeHeight = 12

  // Gradient bar
  const gradient = ctx.createLinearGradient(gaugeX, 0, gaugeX + gaugeWidth, 0)
  gradient.addColorStop(0, '#ff4444')
  gradient.addColorStop(0.25, '#ff8844')
  gradient.addColorStop(0.5, '#ffff44')
  gradient.addColorStop(0.75, '#88ff44')
  gradient.addColorStop(1, '#44ff44')

  ctx.fillStyle = gradient
  ctx.fillRect(gaugeX, gaugeY, gaugeWidth, gaugeHeight)

  // Indicator needle with subtle pulse
  const needleX = gaugeX + (value / 100) * gaugeWidth
  const pulse = Math.sin(time * 4) * 1

  ctx.fillStyle = '#ffffff'
  ctx.beginPath()
  ctx.moveTo(needleX, gaugeY - 2 + pulse)
  ctx.lineTo(needleX - 4, gaugeY - 7)
  ctx.lineTo(needleX + 4, gaugeY - 7)
  ctx.closePath()
  ctx.fill()

  // Value and label below gauge
  ctx.fillStyle = '#ffffff'
  ctx.font = 'bold 18px monospace'
  ctx.fillText(value.toString(), gaugeX, gaugeY + 35)

  ctx.fillStyle = getGreedColor(value)
  ctx.font = 'bold 10px monospace'
  ctx.fillText(label.toUpperCase(), gaugeX + 40, gaugeY + 35)
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

const drawGoogleTrends = (ctx, googleTrends, dataStatus, y) => {
  const x = 160

  ctx.fillStyle = '#9333ea'
  ctx.font = 'bold 11px monospace'
  ctx.fillText('GOOGLE TRENDS', x, y)

  // BTC search interest
  ctx.font = '10px monospace'
  ctx.fillStyle = 'rgba(255, 255, 255, 0.6)'
  ctx.fillText('BTC Interest:', x, y + 18)

  if (dataStatus.googleTrends === 'live' && googleTrends?.btc !== null) {
    const btcValue = googleTrends.btc
    const trendColor = btcValue > 70 ? '#44ff44' : btcValue > 40 ? '#ffff44' : '#ff8844'

    // Draw mini bar
    const barX = x
    const barY = y + 24
    const barWidth = 80
    const barHeight = 8

    ctx.fillStyle = 'rgba(255, 255, 255, 0.2)'
    ctx.fillRect(barX, barY, barWidth, barHeight)

    ctx.fillStyle = trendColor
    ctx.fillRect(barX, barY, (btcValue / 100) * barWidth, barHeight)

    // Value
    ctx.fillStyle = trendColor
    ctx.font = 'bold 14px monospace'
    ctx.fillText(btcValue.toString(), x + 90, y + 32)
  } else {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)'
    ctx.font = '10px monospace'
    ctx.fillText('--', x + 70, y + 32)
  }

  // ETH (smaller, below)
  if (dataStatus.googleTrends === 'live' && googleTrends?.eth !== null) {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)'
    ctx.font = '9px monospace'
    ctx.fillText(`ETH: ${googleTrends.eth}`, x, y + 50)
  }
}

const drawAppRankings = (ctx, appRankings, dataStatus, y) => {
  const x = 330

  ctx.fillStyle = '#9333ea'
  ctx.font = 'bold 11px monospace'
  ctx.fillText('APP RANKINGS', x, y)

  if (dataStatus.appRankings !== 'live' || !appRankings) {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)'
    ctx.font = '10px monospace'
    ctx.fillText('Unavailable', x, y + 20)
    return
  }

  const apps = [
    { name: 'CB', data: appRankings.coinbase },
    { name: 'BIN', data: appRankings.binance },
    { name: 'MM', data: appRankings.metamask }
  ]

  let offsetX = 0
  apps.forEach((app, i) => {
    if (!app.data) return

    const appX = x + offsetX

    // App name
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)'
    ctx.font = '9px monospace'
    ctx.fillText(app.name, appX, y + 18)

    // Star rating
    const rating = app.data.score || app.data.rating || 0
    ctx.fillStyle = rating >= 4.5 ? '#44ff44' : rating >= 4.0 ? '#ffff44' : '#ff8844'
    ctx.font = 'bold 11px monospace'
    ctx.fillText(rating.toFixed(1), appX, y + 32)

    // Mini star
    ctx.fillStyle = '#ffd700'
    ctx.font = '8px monospace'
    ctx.fillText('★', appX + 25, y + 32)

    offsetX += 55
  })
}

const drawWhaleActivity = (ctx, whaleActivity, dataStatus, y) => {
  ctx.fillStyle = '#9333ea'
  ctx.font = 'bold 11px monospace'
  ctx.fillText('WHALE ACTIVITY:', 16, y)

  // Handle whale activity as object or string
  const whaleState = typeof whaleActivity === 'object' ? whaleActivity.activity : whaleActivity
  const whaleConfidence = typeof whaleActivity === 'object' ? whaleActivity.confidence : 0

  // Handle loading state
  if (whaleState === 'Loading...' || whaleState === 'Awaiting data...') {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)'
    ctx.font = '11px monospace'
    ctx.fillText('Loading...', 130, y)
    return
  }

  const whaleColor = whaleState === 'Accumulating' ? '#44ff44' :
                     whaleState === 'Distributing' ? '#ff4444' :
                     whaleState === 'Normal' ? '#ffff44' :
                     'rgba(255, 255, 255, 0.5)'

  ctx.fillStyle = whaleColor
  ctx.font = 'bold 12px monospace'
  ctx.fillText(whaleState?.toUpperCase() || 'N/A', 130, y)

  // Show confidence if available and state is known
  if (whaleConfidence > 0 && whaleState !== 'Unknown' && whaleState !== 'Unavailable') {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)'
    ctx.font = '9px monospace'
    ctx.fillText(`(${whaleConfidence}% conf)`, 240, y)
  }
}

const getGreedColor = (value) => {
  if (value < 25) return '#ff4444'
  if (value < 45) return '#ff8844'
  if (value < 55) return '#ffff44'
  if (value < 75) return '#88ff44'
  return '#44ff44'
}

export default SentimentScreen