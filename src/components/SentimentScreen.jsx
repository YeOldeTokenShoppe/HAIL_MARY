import { useEffect, useState } from 'react'
import { db, doc, onSnapshot } from '@/lib/firebaseClient'

// Sentiment data hook - reads from Firestore (populated by cron job)
const useSentimentData = () => {
  const [data, setData] = useState({
    fearGreed: { value: 0, label: 'Loading...' },
    trendingTopics: [],
    polymarket: null,
    googleTrends: { btc: null, eth: null },
    appRankings: { coinbase: null, binance: null, metamask: null },
    news: { headlines: [], sentiment: null, sentimentScore: 0 },
    isGrokLive: false,
    dataStatus: {
      fearGreed: 'loading',
      trending: 'loading',
      googleTrends: 'loading',
      appRankings: 'loading',
      news: 'loading'
    }
  })

  useEffect(() => {
    // If Firebase not available, show unavailable state
    if (!db) {
      console.warn('[SentimentScreen] Firebase not initialized')
      setData(prev => ({
        ...prev,
        fearGreed: { value: 0, label: 'Unavailable' },
        dataStatus: {
          fearGreed: 'unavailable',
          trending: 'unavailable',
          googleTrends: 'unavailable',
          appRankings: 'unavailable',
          news: 'unavailable'
        }
      }))
      return
    }

    // Listen to Firestore for real-time updates from cron job
    const sentimentRef = doc(db, 'sentimentData', 'latest')
    const newsRef = doc(db, 'newsData', 'latest')

    const unsubscribeSentiment = onSnapshot(
      sentimentRef,
      (docSnapshot) => {
        if (docSnapshot.exists()) {
          const sentimentData = docSnapshot.data()

          setData(prev => ({
            ...prev,
            fearGreed: sentimentData.fearGreed || { value: 0, label: 'Unavailable' },
            trendingTopics: sentimentData.trendingTopics || [],
            polymarket: sentimentData.polymarket || null,
            googleTrends: sentimentData.googleTrends || { btc: null, eth: null },
            appRankings: sentimentData.appRankings || { coinbase: null, binance: null, metamask: null },
            isGrokLive: sentimentData.dataStatus?.trending === 'live',
            dataStatus: {
              ...prev.dataStatus,
              fearGreed: sentimentData.dataStatus?.fearGreed || 'unavailable',
              trending: sentimentData.dataStatus?.trending || 'unavailable',
              googleTrends: sentimentData.dataStatus?.googleTrends || 'unavailable',
              appRankings: sentimentData.dataStatus?.appRankings || 'unavailable'
            }
          }))
        } else {
          console.log('[SentimentScreen] No sentiment data in Firestore yet')
          setData(prev => ({
            ...prev,
            fearGreed: { value: 0, label: 'Awaiting data...' }
          }))
        }
      },
      (error) => {
        console.error('[SentimentScreen] Error listening to sentiment:', error)
      }
    )

    // Subscribe to news data
    const unsubscribeNews = onSnapshot(
      newsRef,
      (docSnapshot) => {
        if (docSnapshot.exists()) {
          const newsData = docSnapshot.data()
          setData(prev => ({
            ...prev,
            news: {
              headlines: newsData.headlines || [],
              sentiment: newsData.sentiment || null,
              sentimentScore: newsData.sentimentScore || 0
            },
            dataStatus: {
              ...prev.dataStatus,
              news: 'live'
            }
          }))
        }
      },
      (error) => {
        console.error('[SentimentScreen] Error listening to news:', error)
      }
    )

    // Cleanup listeners on unmount
    return () => {
      unsubscribeSentiment()
      unsubscribeNews()
    }
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

      // Fear & Greed Index - left side (y=55 to clear header line at y=40)
      drawFearGreedLarge(ctx, data.fearGreed, 55, t)

      // Google Trends (right side, expanded)
      drawGoogleTrends(ctx, data.googleTrends, data.dataStatus, 55)

      // Polymarket Bet Display (y=125 to clear Fear & Greed which extends to ~110)
      drawPolymarketBet(ctx, data.polymarket, 125, t)

      // News Headlines - main content area
      drawNewsHeadlines(ctx, data.news, 190, t)

      // Data source indicator - show actual status (at bottom)
      ctx.fillStyle = 'rgba(147, 51, 234, 0.4)'
      ctx.font = '8px monospace'
      const status = data.dataStatus || {}
      const statusParts = []
      if (status.fearGreed === 'live') statusParts.push('F&G')
      if (status.news === 'live') statusParts.push('NEWS')
      if (status.googleTrends === 'live') statusParts.push('GTRENDS')
      const dataStatusText = statusParts.length > 0
        ? `LIVE: ${statusParts.join(' | ')}`
        : 'CONNECTING...'
      ctx.fillText(dataStatusText, 10, 300)

      // Data sources footer
      ctx.fillStyle = 'rgba(147, 51, 234, 0.3)'
      ctx.font = '7px monospace'
      ctx.fillText('Sources: Alternative.me | CryptoPanic | CoinDesk | CoinTelegraph | Decrypt | Google Trends', 10, 312)

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

// Fear & Greed display - compact but prominent
const drawFearGreedLarge = (ctx, { value, label }, y, time) => {
  const x = 16

  ctx.fillStyle = '#9333ea'
  ctx.font = 'bold 11px monospace'
  ctx.fillText('FEAR & GREED', x, y)

  // Handle loading/unavailable states
  if (label === 'Loading...' || label === 'Unavailable' || label === 'Awaiting data...') {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)'
    ctx.font = '12px monospace'
    ctx.fillText('--', x, y + 25)
    return
  }

  // Gauge bar first (at top)
  const gaugeX = x
  const gaugeY = y + 10
  const gaugeWidth = 130
  const gaugeHeight = 12

  // Gradient bar background
  const gradient = ctx.createLinearGradient(gaugeX, 0, gaugeX + gaugeWidth, 0)
  gradient.addColorStop(0, '#ff4444')
  gradient.addColorStop(0.25, '#ff8844')
  gradient.addColorStop(0.5, '#ffff44')
  gradient.addColorStop(0.75, '#88ff44')
  gradient.addColorStop(1, '#44ff44')

  ctx.fillStyle = gradient
  ctx.fillRect(gaugeX, gaugeY, gaugeWidth, gaugeHeight)

  // Indicator needle
  const needleX = gaugeX + (value / 100) * gaugeWidth
  const pulse = Math.sin(time * 3) * 1

  ctx.fillStyle = '#ffffff'
  ctx.beginPath()
  ctx.moveTo(needleX, gaugeY - 2 + pulse)
  ctx.lineTo(needleX - 4, gaugeY - 7)
  ctx.lineTo(needleX + 4, gaugeY - 7)
  ctx.closePath()
  ctx.fill()

  // Value and label below gauge
  ctx.fillStyle = getGreedColor(value)
  ctx.font = 'bold 24px monospace'
  ctx.fillText(value.toString(), x, y + 50)

  ctx.fillStyle = getGreedColor(value)
  ctx.font = 'bold 12px monospace'
  ctx.fillText(label.toUpperCase(), x + 45, y + 50)
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

const drawNewsHeadlines = (ctx, news, y, time) => {
  // Section header with border
  ctx.strokeStyle = 'rgba(147, 51, 234, 0.5)'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(16, y - 5)
  ctx.lineTo(496, y - 5)
  ctx.stroke()

  ctx.fillStyle = '#9333ea'
  ctx.font = 'bold 11px monospace'
  ctx.fillText('CRYPTO NEWS', 24, y + 8)

  if (!news?.headlines || news.headlines.length === 0) {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)'
    ctx.font = '10px monospace'
    ctx.fillText('Awaiting news data from CryptoPanic...', 24, y + 28)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)'
    ctx.font = '9px monospace'
    ctx.fillText('RSS feeds: CoinDesk | CoinTelegraph | Decrypt', 24, y + 44)
    return
  }

  // Filter tabs - rotate through different filters every 8 seconds
  const t = time || performance.now() / 1000
  const filterIndex = Math.floor(t / 8) % 5
  const filters = ['all', 'BTC', 'ETH', 'SOL', 'XRP']
  const currentFilter = filters[filterIndex]

  // Draw filter tabs
  const filterLabels = ['ALL', 'BTC', 'ETH', 'SOL', 'XRP']
  filterLabels.forEach((label, i) => {
    const isActive = i === filterIndex
    const tabX = 120 + (i * 40)

    // Tab background
    if (isActive) {
      ctx.fillStyle = 'rgba(147, 51, 234, 0.3)'
      ctx.fillRect(tabX - 2, y - 2, 35, 14)
    }

    ctx.fillStyle = isActive ? '#9333ea' : 'rgba(255, 255, 255, 0.4)'
    ctx.font = isActive ? 'bold 9px monospace' : '9px monospace'
    ctx.fillText(label, tabX, y + 8)
  })

  // Show sentiment summary on far right
  if (news.sentiment) {
    const total = news.sentiment.bullish + news.sentiment.bearish + news.sentiment.neutral
    if (total > 0) {
      ctx.fillStyle = '#44ff44'
      ctx.font = '8px monospace'
      ctx.fillText(`↑${news.sentiment.bullish}`, 400, y + 8)
      ctx.fillStyle = '#ff4444'
      ctx.fillText(`↓${news.sentiment.bearish}`, 430, y + 8)
      ctx.fillStyle = '#888888'
      ctx.fillText(`─${news.sentiment.neutral}`, 460, y + 8)
    }
  }

  // Filter out generic/low-value headlines
  const lowValuePatterns = [
    /here'?s what happened/i,
    /this week in crypto/i,
    /daily (roundup|recap|digest)/i,
    /what you need to know/i,
    /^crypto news:/i,
    /weekly (roundup|recap|wrap)/i,
    /morning (brief|update)/i,
    /evening (brief|update)/i,
    /^today in crypto/i,
    /newsletter/i
  ]

  // Filter headlines based on current filter
  let filteredHeadlines = news.headlines.filter(h =>
    !lowValuePatterns.some(pattern => pattern.test(h.title))
  )
  if (currentFilter !== 'all') {
    const assetKeywords = {
      BTC: ['bitcoin', 'btc', 'satoshi'],
      ETH: ['ethereum', 'eth', 'vitalik', 'layer 2', 'l2'],
      SOL: ['solana', 'sol'],
      XRP: ['ripple', 'xrp']
    }
    const keywords = assetKeywords[currentFilter] || []
    filteredHeadlines = news.headlines.filter(h =>
      keywords.some(kw => h.title.toLowerCase().includes(kw))
    )
    // If no specific headlines, show all
    if (filteredHeadlines.length === 0) {
      filteredHeadlines = news.headlines
    }
  }

  // Draw up to 5 headlines (we have the space)
  const headlinesToShow = filteredHeadlines.slice(0, 5)
  headlinesToShow.forEach((headline, i) => {
    const yPos = y + 24 + (i * 16)

    // Sentiment indicator dot
    const sentimentColor = headline.sentiment === 'bullish' ? '#44ff44' :
                          headline.sentiment === 'bearish' ? '#ff4444' : '#666666'
    ctx.fillStyle = sentimentColor
    ctx.beginPath()
    ctx.arc(28, yPos - 3, 3, 0, Math.PI * 2)
    ctx.fill()

    // Truncate headline text - using 8px font allows ~80 chars
    let title = headline.title || 'Unknown headline'
    const maxLength = 78
    if (title.length > maxLength) {
      title = title.substring(0, maxLength) + '..'
    }

    ctx.fillStyle = '#ffffff'
    ctx.font = '8px monospace'
    ctx.fillText(title, 38, yPos)
  })

  // Fill empty slots with subtle lines
  for (let i = headlinesToShow.length; i < 5; i++) {
    const yPos = y + 24 + (i * 16)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.1)'
    ctx.fillRect(38, yPos - 5, 430, 1)
  }
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