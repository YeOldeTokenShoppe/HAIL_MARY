import { useEffect, useState } from 'react'
import { db, doc, collection, onSnapshot, query, orderBy, limit, where } from '@/lib/firebaseClient'

// RL80 data hook - reads from Firestore (populated by scoring workflow)
const useRL80Data = () => {
  const [data, setData] = useState({
    // Latest RL80 decision from agentDecisions/RL80
    decision: {
      action: 'HOLD',
      symbol: 'ETH',
      confidence: 0.5,
      reasoning: 'Awaiting data...',
      timestamp: null
    },
    // Analyst scores from the latest workflow run
    analystScores: {
      EMO: { direction: 0, confidence: 0.5, signal: 'neutral' },
      TEKNO: { direction: 0, confidence: 0.5, signal: 'neutral' },
      MACRO: { direction: 0, confidence: 0.5, signal: 'neutral' }
    },
    // Aggregated consensus
    consensus: {
      score: 50,
      agreement: 0.5,
      direction: 'neutral'
    },
    // Performance from trade history
    performance: {
      winRate: 0,
      totalPnL: 0,
      tradeCount: 0,
      recentTrades: []
    },
    // Connection status
    isLive: false,
    lastUpdate: null
  })

  useEffect(() => {
    if (!db) {
      console.warn('[RL80Screen] Firebase not initialized')
      return
    }

    const unsubscribes = []

    // Listen to agentDecisions/RL80 for latest decision
    const decisionRef = doc(db, 'agentDecisions', 'RL80')
    unsubscribes.push(
      onSnapshot(decisionRef, (docSnapshot) => {
        if (docSnapshot.exists()) {
          const decisionData = docSnapshot.data()
          setData(prev => ({
            ...prev,
            decision: {
              action: decisionData.action || 'HOLD',
              symbol: decisionData.symbol || 'ETH',
              confidence: decisionData.confidence || 0.5,
              reasoning: decisionData.reasoning || 'No reasoning provided',
              timestamp: decisionData.timestamp?.toDate?.() || decisionData.timestamp || null,
              size: decisionData.size || 0,
              riskLevel: decisionData.riskLevel || 'normal'
            },
            isLive: true,
            lastUpdate: new Date()
          }))
        }
      }, (error) => {
        console.error('[RL80Screen] Decision subscription error:', error)
      })
    )

    // Listen to latest decisions collection for aggregated scores
    const decisionsQuery = query(
      collection(db, 'decisions'),
      orderBy('timestamp', 'desc'),
      limit(1)
    )
    unsubscribes.push(
      onSnapshot(decisionsQuery, (snapshot) => {
        if (!snapshot.empty) {
          const latestDecision = snapshot.docs[0].data()

          // Extract analyst scores
          const analysts = latestDecision.analysts || {}
          const analystScores = {
            EMO: formatAnalystScore(analysts.EMO),
            TEKNO: formatAnalystScore(analysts.TEKNO),
            MACRO: formatAnalystScore(analysts.MACRO)
          }

          // Calculate consensus from aggregated score
          const aggregated = latestDecision.aggregated || {}
          const consensusScore = ((aggregated.weightedDirection || 0) + 10) * 5 // Convert -10..+10 to 0..100

          setData(prev => ({
            ...prev,
            analystScores,
            consensus: {
              score: Math.round(consensusScore),
              agreement: aggregated.agreement || 0.5,
              direction: getDirectionFromScore(aggregated.weightedDirection || 0)
            }
          }))
        }
      }, (error) => {
        console.error('[RL80Screen] Decisions subscription error:', error)
      })
    )

    // Listen to recent trade history for performance metrics
    const tradesQuery = query(
      collection(db, 'tradeHistory'),
      orderBy('timestamp', 'desc'),
      limit(20)
    )
    unsubscribes.push(
      onSnapshot(tradesQuery, (snapshot) => {
        if (!snapshot.empty) {
          const trades = snapshot.docs.map(doc => doc.data())
          const performance = calculatePerformance(trades)
          setData(prev => ({
            ...prev,
            performance
          }))
        }
      }, (error) => {
        console.error('[RL80Screen] TradeHistory subscription error:', error)
      })
    )

    // Also listen to agentScores for real-time analyst updates
    const scoresQuery = query(
      collection(db, 'agentScores'),
      orderBy('createdAt', 'desc'),
      limit(4)
    )
    unsubscribes.push(
      onSnapshot(scoresQuery, (snapshot) => {
        if (!snapshot.empty) {
          const recentScores = {}
          snapshot.docs.forEach(doc => {
            const data = doc.data()
            const agentId = data.agentId
            if (agentId && !recentScores[agentId]) {
              // Get score for ETH (primary trading asset)
              const ethScore = data.scores?.find(s => s.asset === 'ETH') || data.scores?.[0]
              if (ethScore) {
                recentScores[agentId] = formatAnalystScore({
                  score: ethScore.direction,
                  confidence: ethScore.confidence,
                  rationale: ethScore.rationale
                })
              }
            }
          })

          if (Object.keys(recentScores).length > 0) {
            setData(prev => ({
              ...prev,
              analystScores: {
                ...prev.analystScores,
                ...recentScores
              }
            }))
          }
        }
      }, (error) => {
        console.error('[RL80Screen] AgentScores subscription error:', error)
      })
    )

    return () => {
      unsubscribes.forEach(unsub => unsub())
    }
  }, [])

  return data
}

// Helper: Format analyst score data
function formatAnalystScore(data) {
  if (!data) return { direction: 0, confidence: 0.5, signal: 'neutral' }

  const direction = data.score || data.direction || 0
  const confidence = data.confidence || 0.5

  return {
    direction,
    confidence,
    signal: getDirectionFromScore(direction),
    rationale: data.rationale || ''
  }
}

// Helper: Get signal direction from score
function getDirectionFromScore(score) {
  if (score >= 5) return 'bullish'
  if (score >= 2) return 'lean_bullish'
  if (score <= -5) return 'bearish'
  if (score <= -2) return 'lean_bearish'
  return 'neutral'
}

// Helper: Calculate performance metrics from trades
function calculatePerformance(trades) {
  if (!trades || trades.length === 0) {
    return { winRate: 0, totalPnL: 0, tradeCount: 0, recentTrades: [] }
  }

  const completedTrades = trades.filter(t => t.status === 'filled' || t.pnl !== undefined)
  const wins = completedTrades.filter(t => (t.pnl || 0) > 0).length
  const totalPnL = completedTrades.reduce((sum, t) => sum + (t.pnl || 0), 0)

  return {
    winRate: completedTrades.length > 0 ? (wins / completedTrades.length) * 100 : 0,
    totalPnL,
    tradeCount: completedTrades.length,
    recentTrades: trades.slice(0, 5).map(t => ({
      action: t.action || t.side,
      symbol: t.symbol,
      success: (t.pnl || 0) >= 0,
      pnl: t.pnl,
      timestamp: t.timestamp
    }))
  }
}

// The RL80 command center screen
const RL80Screen = () => {
  const data = useRL80Data()
  const [animationFrame, setAnimationFrame] = useState(0)

  // Animation loop for pulsing effects
  useEffect(() => {
    const animate = () => setAnimationFrame(prev => prev + 1)
    const interval = setInterval(animate, 100)
    return () => clearInterval(interval)
  }, [])

  // Draw loop
  useEffect(() => {
    const draw = () => {
      const canvas = window['__screen4Canvas']
      const texture = window['__screen4Texture']

      if (!canvas || !texture) return

      const ctx = canvas.getContext('2d')
      const t = performance.now() / 1000

      // Background - dark with subtle grid
      ctx.fillStyle = '#0a0a0a'
      ctx.fillRect(0, 0, 512, 320)

      // Draw subtle grid
      ctx.strokeStyle = 'rgba(255, 215, 0, 0.05)'
      ctx.lineWidth = 0.5
      for (let x = 0; x < 512; x += 32) {
        ctx.beginPath()
        ctx.moveTo(x, 0)
        ctx.lineTo(x, 320)
        ctx.stroke()
      }
      for (let y = 0; y < 320; y += 32) {
        ctx.beginPath()
        ctx.moveTo(0, y)
        ctx.lineTo(512, y)
        ctx.stroke()
      }

      // Header
      ctx.fillStyle = '#FFD700'
      ctx.font = 'bold 18px monospace'
      ctx.fillText('\u26A1 RL80 COMMAND CENTER', 16, 28)

      // Status indicator
      const pulse = Math.sin(t * 3) * 0.5 + 0.5
      const isActive = data.decision.action !== 'HOLD'

      if (isActive) {
        ctx.fillStyle = `rgba(255, 215, 0, ${0.5 + pulse * 0.5})`
        ctx.font = 'bold 12px monospace'
        ctx.fillText('\u25CFACTIVE', 420, 28)
      } else {
        ctx.fillStyle = 'rgba(255, 215, 0, 0.5)'
        ctx.font = '10px monospace'
        ctx.fillText('\u25CFSTANDBY', 420, 28)
      }

      // Live indicator
      ctx.fillStyle = data.isLive ? '#44ff44' : '#ffff44'
      ctx.font = '9px monospace'
      ctx.fillText(data.isLive ? 'LIVE' : 'SYNC', 480, 28)

      // Divider line
      ctx.strokeStyle = '#FFD700'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(16, 40)
      ctx.lineTo(496, 40)
      ctx.stroke()

      // Last update timestamp
      if (data.lastUpdate) {
        const timeSince = Math.floor((Date.now() - data.lastUpdate.getTime()) / 1000)
        ctx.fillStyle = 'rgba(255, 215, 0, 0.6)'
        ctx.font = '9px monospace'
        ctx.fillText(`Last sync: ${timeSince}s ago`, 16, 54)
      }

      // Council Analysis Section
      drawCouncilAnalysis(ctx, data.analystScores, 68, t)

      // Decision Matrix
      drawDecisionMatrix(ctx, data.decision, data.consensus, 160, t)

      // Performance Metrics
      drawPerformanceMetrics(ctx, data.performance, 240)

      // Trade Signal Bar
      drawTradeSignal(ctx, data.decision, 295, t)

      // Confidence meter on the right
      drawConfidenceMeter(ctx, data.decision.confidence, 440, 65, t)

      // Border with glow effect when active
      if (isActive) {
        ctx.strokeStyle = `rgba(255, 215, 0, ${0.5 + pulse * 0.5})`
        ctx.lineWidth = 2
      } else {
        ctx.strokeStyle = 'rgba(255, 215, 0, 0.3)'
        ctx.lineWidth = 1
      }
      ctx.strokeRect(2, 2, 508, 316)

      if (texture) {
        texture.needsUpdate = true
      }
    }

    const intervalId = setInterval(draw, 100)
    return () => clearInterval(intervalId)
  }, [data, animationFrame])

  return null
}

// Draw council analysis with real analyst scores
function drawCouncilAnalysis(ctx, scores, y, time) {
  ctx.fillStyle = '#FFD700'
  ctx.font = 'bold 14px monospace'
  ctx.fillText('COUNCIL ANALYSIS', 24, y)

  const agents = [
    { name: 'EMO', data: scores.EMO, color: '#9333ea' },
    { name: 'TEK', data: scores.TEKNO, color: '#00ffff' },
    { name: 'MAC', data: scores.MACRO, color: '#00ff00' }
  ]

  agents.forEach((agent, i) => {
    const yPos = y + 18 + (i * 22)
    const hasData = agent.data && agent.data.direction !== 0

    // Connection indicator
    const pulse = hasData ? Math.sin(time * 3) * 0.3 + 0.7 : 0.3
    ctx.fillStyle = hasData ? agent.color : 'rgba(255, 255, 255, 0.2)'
    ctx.globalAlpha = pulse
    ctx.font = '10px monospace'
    ctx.fillText(hasData ? '\u25C9' : '\u25CB', 12, yPos)
    ctx.globalAlpha = 1.0

    // Agent name
    ctx.fillStyle = hasData ? agent.color : 'rgba(255, 255, 255, 0.5)'
    ctx.font = 'bold 11px monospace'
    ctx.fillText(agent.name + ':', 24, yPos)

    // Direction score bar - convert -10..+10 to percentage
    const barX = 70
    const barWidth = 140
    const barHeight = 14
    const direction = agent.data?.direction || 0
    const scorePercent = ((direction + 10) / 20) * 100 // -10 to +10 -> 0 to 100

    // Background bar
    ctx.fillStyle = 'rgba(255, 255, 255, 0.1)'
    ctx.fillRect(barX, yPos - 12, barWidth, barHeight)

    // Center line (neutral)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(barX + barWidth / 2, yPos - 12)
    ctx.lineTo(barX + barWidth / 2, yPos + 2)
    ctx.stroke()

    // Filled bar based on direction (from center)
    const fillWidth = Math.abs(direction) / 10 * (barWidth / 2)
    const barColor = direction > 2 ? '#44ff44' : direction < -2 ? '#ff4444' : '#ffff44'
    ctx.fillStyle = barColor

    if (direction >= 0) {
      ctx.fillRect(barX + barWidth / 2, yPos - 12, fillWidth, barHeight)
    } else {
      ctx.fillRect(barX + barWidth / 2 - fillWidth, yPos - 12, fillWidth, barHeight)
    }

    // Direction score text
    ctx.fillStyle = '#ffffff'
    ctx.font = '10px monospace'
    const dirStr = direction >= 0 ? `+${direction.toFixed(1)}` : direction.toFixed(1)
    ctx.fillText(dirStr, barX + barWidth + 5, yPos - 2)

    // Signal label
    const signalText = getSignalLabel(agent.data?.signal)
    ctx.fillStyle = agent.color
    ctx.font = 'bold 9px monospace'
    ctx.fillText(signalText, barX + barWidth + 40, yPos - 2)

    // Confidence dots
    const confLevel = Math.floor((agent.data?.confidence || 0.5) * 5)
    const confX = barX + barWidth + 95
    for (let j = 0; j < 5; j++) {
      ctx.fillStyle = j < confLevel ? agent.color : 'rgba(255, 255, 255, 0.1)'
      ctx.fillRect(confX + j * 6, yPos - 8, 4, 4)
    }
  })
}

// Get display label for signal
function getSignalLabel(signal) {
  switch (signal) {
    case 'bullish': return 'BULLISH'
    case 'lean_bullish': return 'LEAN BUY'
    case 'bearish': return 'BEARISH'
    case 'lean_bearish': return 'LEAN SELL'
    default: return 'NEUTRAL'
  }
}

// Draw decision matrix with real decision data
function drawDecisionMatrix(ctx, decision, consensus, y, time) {
  // Decision box with golden border
  ctx.strokeStyle = '#FFD700'
  ctx.lineWidth = 2
  ctx.strokeRect(24, y, 380, 65)

  // Background color based on action
  const bgColor = decision.action.includes('BUY') || decision.action === 'LONG' ? 'rgba(0, 255, 0, 0.1)' :
                  decision.action.includes('SELL') || decision.action === 'SHORT' ? 'rgba(255, 0, 0, 0.1)' :
                  'rgba(255, 255, 255, 0.05)'
  ctx.fillStyle = bgColor
  ctx.fillRect(24, y, 380, 65)

  // Header
  ctx.fillStyle = '#FFD700'
  ctx.font = 'bold 14px monospace'
  ctx.fillText('DECISION MATRIX', 34, y + 18)

  // Action with pulsing effect
  const pulse = Math.sin(time * 4) * 0.5 + 0.5
  const actionColor = decision.action.includes('BUY') || decision.action === 'LONG' ? '#44ff44' :
                      decision.action.includes('SELL') || decision.action === 'SHORT' ? '#ff4444' :
                      '#ffff44'

  ctx.fillStyle = decision.action !== 'HOLD' ?
    `rgba(${actionColor === '#44ff44' ? '68, 255, 68' :
           actionColor === '#ff4444' ? '255, 68, 68' : '255, 255, 68'}, ${0.5 + pulse * 0.5})` :
    actionColor
  ctx.font = 'bold 20px monospace'
  ctx.fillText(decision.action, 34, y + 44)

  // Symbol
  ctx.fillStyle = '#ffffff'
  ctx.font = '12px monospace'
  ctx.fillText(decision.symbol || 'ETH', 120, y + 44)

  // Size indicator if available
  if (decision.size > 0) {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)'
    ctx.font = '10px monospace'
    ctx.fillText(`Size: ${(decision.size * 100).toFixed(0)}%`, 170, y + 44)
  }

  // Consensus score
  ctx.fillStyle = '#FFD700'
  ctx.font = '11px monospace'
  ctx.fillText(`Consensus: ${consensus.score}/100`, 250, y + 44)

  // Reasoning (truncated)
  ctx.fillStyle = 'rgba(255, 255, 255, 0.7)'
  ctx.font = '9px monospace'
  const reasoning = decision.reasoning || 'Awaiting analysis...'
  const truncatedReasoning = reasoning.length > 55 ? reasoning.substring(0, 55) + '...' : reasoning
  ctx.fillText(truncatedReasoning, 34, y + 60)
}

// Draw performance metrics from real trade data
function drawPerformanceMetrics(ctx, performance, y) {
  ctx.fillStyle = '#FFD700'
  ctx.font = 'bold 12px monospace'
  ctx.fillText('PERFORMANCE METRICS', 24, y)

  // Win rate gauge
  ctx.fillStyle = '#ffffff'
  ctx.font = '11px monospace'
  ctx.fillText('Win Rate:', 24, y + 20)

  const winRateX = 90
  const winRateWidth = 100
  const winRateHeight = 10

  // Background
  ctx.fillStyle = 'rgba(255, 255, 255, 0.1)'
  ctx.fillRect(winRateX, y + 12, winRateWidth, winRateHeight)

  // Fill based on win rate
  const winRateFill = (performance.winRate / 100) * winRateWidth
  const winRateColor = performance.winRate > 60 ? '#44ff44' :
                       performance.winRate < 40 ? '#ff4444' : '#ffff44'
  ctx.fillStyle = winRateColor
  ctx.fillRect(winRateX, y + 12, winRateFill, winRateHeight)

  // Win rate text
  ctx.fillStyle = '#ffffff'
  ctx.font = 'bold 11px monospace'
  ctx.fillText(`${performance.winRate.toFixed(0)}%`, winRateX + winRateWidth + 5, y + 20)

  // P&L
  const pnlColor = performance.totalPnL >= 0 ? '#44ff44' : '#ff4444'
  ctx.fillStyle = pnlColor
  ctx.font = '11px monospace'
  const pnlDisplay = performance.totalPnL >= 0 ? `+$${performance.totalPnL.toFixed(2)}` : `-$${Math.abs(performance.totalPnL).toFixed(2)}`
  ctx.fillText(`P&L: ${pnlDisplay}`, 230, y + 20)

  // Trade count
  ctx.fillStyle = 'rgba(255, 255, 255, 0.6)'
  ctx.font = '10px monospace'
  ctx.fillText(`Trades: ${performance.tradeCount}`, 340, y + 20)

  // Recent trades visualization
  ctx.fillStyle = '#ffffff'
  ctx.font = '10px monospace'
  ctx.fillText('Recent:', 24, y + 38)

  if (performance.recentTrades && performance.recentTrades.length > 0) {
    performance.recentTrades.slice(0, 5).forEach((trade, i) => {
      const xPos = 75 + i * 25
      ctx.fillStyle = trade.success ? '#44ff44' : '#ff4444'
      ctx.font = 'bold 14px monospace'
      ctx.fillText(trade.success ? '\u2713' : '\u2717', xPos, y + 38)
    })
  } else {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)'
    ctx.font = '10px monospace'
    ctx.fillText('No trades yet', 75, y + 38)
  }
}

// Draw trade signal bar
function drawTradeSignal(ctx, decision, y, time) {
  if (decision.action === 'HOLD') {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)'
    ctx.font = '11px monospace'
    ctx.fillText('\u26A1 AWAITING OPPORTUNITY - NO ACTIVE SIGNALS', 24, y)
  } else {
    const pulse = Math.sin(time * 5) * 0.5 + 0.5
    const signalColor = decision.action.includes('BUY') || decision.action === 'LONG' ?
      `rgba(68, 255, 68, ${0.5 + pulse * 0.5})` :
      `rgba(255, 68, 68, ${0.5 + pulse * 0.5})`

    ctx.fillStyle = signalColor
    ctx.font = 'bold 12px monospace'
    const sizeText = decision.size > 0 ? ` @ ${(decision.size * 100).toFixed(0)}% SIZE` : ''
    ctx.fillText(`\u26A1 SIGNAL: ${decision.action} ${decision.symbol}${sizeText}`, 24, y)

    // Flash effect
    if (pulse > 0.8) {
      ctx.strokeStyle = signalColor
      ctx.lineWidth = 1
      ctx.strokeRect(20, y - 12, 400, 18)
    }
  }
}

// Draw vertical confidence meter
function drawConfidenceMeter(ctx, confidence, x, y, time) {
  ctx.fillStyle = '#FFD700'
  ctx.font = '10px monospace'
  ctx.fillText('CONF', x, y - 5)

  const meterHeight = 160
  const meterWidth = 20

  // Background
  ctx.fillStyle = 'rgba(255, 255, 255, 0.1)'
  ctx.fillRect(x, y, meterWidth, meterHeight)

  // Gradient fill
  const gradient = ctx.createLinearGradient(0, y + meterHeight, 0, y)
  gradient.addColorStop(0, '#ff4444')
  gradient.addColorStop(0.5, '#ffff44')
  gradient.addColorStop(1, '#44ff44')

  // Fill based on confidence
  const fillHeight = confidence * meterHeight
  ctx.fillStyle = gradient
  ctx.fillRect(x, y + meterHeight - fillHeight, meterWidth, fillHeight)

  // Confidence percentage
  ctx.fillStyle = '#ffffff'
  ctx.font = 'bold 10px monospace'
  ctx.fillText(`${(confidence * 100).toFixed(0)}%`, x - 5, y + meterHeight + 15)

  // Animated indicator line
  const indicatorY = y + meterHeight - fillHeight
  ctx.strokeStyle = '#FFD700'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(x - 5, indicatorY)
  ctx.lineTo(x + meterWidth + 5, indicatorY)
  ctx.stroke()

  // Threshold markers
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)'
  ctx.lineWidth = 1
  const thresholds = [0.4, 0.6, 0.8]
  thresholds.forEach(thresh => {
    const threshY = y + meterHeight - (thresh * meterHeight)
    ctx.beginPath()
    ctx.moveTo(x + meterWidth + 2, threshY)
    ctx.lineTo(x + meterWidth + 8, threshY)
    ctx.stroke()
  })
}

export default RL80Screen
