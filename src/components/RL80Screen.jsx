import { useEffect, useState } from 'react'
import { db, doc, collection, onSnapshot, query, orderBy, limit, where } from '@/lib/firebaseClient'

// Tradeable assets
const TRADEABLE_ASSETS = ['BTC', 'ETH', 'SOL', 'XRP']

// Default analyst score
const defaultAnalystScore = { direction: 0, confidence: 0.5 }

// RL80 data hook - reads from Firestore (populated by scoring workflow)
const useRL80Data = () => {
  const [data, setData] = useState({
    // Decisions for each tradeable asset
    decisions: {
      BTC: { action: 'HOLD', confidence: 0.5, reasoning: 'Awaiting data...', size: 0 },
      ETH: { action: 'HOLD', confidence: 0.5, reasoning: 'Awaiting data...', size: 0 },
      SOL: { action: 'HOLD', confidence: 0.5, reasoning: 'Awaiting data...', size: 0 },
      XRP: { action: 'HOLD', confidence: 0.5, reasoning: 'Awaiting data...', size: 0 }
    },
    // Primary decision (strongest signal)
    primaryAsset: 'BTC',
    // Analyst scores per asset
    assetScores: {
      BTC: { EMO: defaultAnalystScore, TEKNO: defaultAnalystScore, MACRO: defaultAnalystScore },
      ETH: { EMO: defaultAnalystScore, TEKNO: defaultAnalystScore, MACRO: defaultAnalystScore },
      SOL: { EMO: defaultAnalystScore, TEKNO: defaultAnalystScore, MACRO: defaultAnalystScore },
      XRP: { EMO: defaultAnalystScore, TEKNO: defaultAnalystScore, MACRO: defaultAnalystScore }
    },
    // Aggregated consensus per asset
    consensus: {
      BTC: { score: 50, direction: 'neutral' },
      ETH: { score: 50, direction: 'neutral' },
      SOL: { score: 50, direction: 'neutral' },
      XRP: { score: 50, direction: 'neutral' }
    },
    // Legacy format for backward compatibility
    analystScores: {
      EMO: { direction: 0, confidence: 0.5, signal: 'neutral' },
      TEKNO: { direction: 0, confidence: 0.5, signal: 'neutral' },
      MACRO: { direction: 0, confidence: 0.5, signal: 'neutral' }
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

    // Listen to latest decisions collection for aggregated scores - fetch for each tradeable asset
    const decisionsQuery = query(
      collection(db, 'decisions'),
      orderBy('timestamp', 'desc'),
      limit(10) // Get recent decisions to cover both assets
    )
    unsubscribes.push(
      onSnapshot(decisionsQuery, (snapshot) => {
        if (!snapshot.empty) {
          const assetDecisions = {}
          const assetScoresData = {}
          const consensusData = {}
          let latestAnalystScores = null

          // Process decisions for each asset
          snapshot.docs.forEach(doc => {
            const decision = doc.data()
            const asset = decision.asset || 'ETH'

            // Only process if we haven't seen this asset yet (get most recent)
            if (!assetDecisions[asset] && TRADEABLE_ASSETS.includes(asset)) {
              assetDecisions[asset] = {
                action: decision.recommendation?.action || 'HOLD',
                confidence: decision.aggregated?.weightedConfidence || 0.5,
                reasoning: decision.recommendation?.rationale || 'No data',
                size: decision.recommendation?.sizePercent || 0
              }

              // Extract per-asset analyst scores
              const analysts = decision.analysts || {}
              assetScoresData[asset] = {
                EMO: { direction: analysts.EMO?.score || 0, confidence: analysts.EMO?.confidence || 0.5 },
                TEKNO: { direction: analysts.TEKNO?.score || 0, confidence: analysts.TEKNO?.confidence || 0.5 },
                MACRO: { direction: analysts.MACRO?.score || 0, confidence: analysts.MACRO?.confidence || 0.5 }
              }

              // Calculate consensus for this asset
              const aggregated = decision.aggregated || {}
              const consensusScore = ((aggregated.weightedDirection || 0) + 10) * 5
              consensusData[asset] = {
                score: Math.round(consensusScore),
                direction: getDirectionFromScore(aggregated.weightedDirection || 0)
              }

              // Use first decision's analysts for legacy format
              if (!latestAnalystScores) {
                latestAnalystScores = {
                  EMO: formatAnalystScore(analysts.EMO),
                  TEKNO: formatAnalystScore(analysts.TEKNO),
                  MACRO: formatAnalystScore(analysts.MACRO)
                }
              }
            }
          })

          // Determine primary asset (strongest signal)
          let primaryAsset = 'ETH'
          let strongestSignal = 0
          TRADEABLE_ASSETS.forEach(asset => {
            const decision = assetDecisions[asset]
            if (decision && decision.action !== 'HOLD') {
              const signalStrength = Math.abs(consensusData[asset]?.score - 50 || 0)
              if (signalStrength > strongestSignal) {
                strongestSignal = signalStrength
                primaryAsset = asset
              }
            }
          })

          setData(prev => ({
            ...prev,
            decisions: { ...prev.decisions, ...assetDecisions },
            assetScores: { ...prev.assetScores, ...assetScoresData },
            consensus: { ...prev.consensus, ...consensusData },
            primaryAsset,
            analystScores: latestAnalystScores || prev.analystScores
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
          const assetScoresUpdate = { BTC: {}, ETH: {}, SOL: {}, XRP: {} }

          snapshot.docs.forEach(doc => {
            const docData = doc.data()
            const agentId = docData.agentId
            if (agentId && !recentScores[agentId]) {
              // Get scores for all tradeable assets
              TRADEABLE_ASSETS.forEach(asset => {
                const assetScore = docData.scores?.find(s => s.asset === asset)
                if (assetScore) {
                  assetScoresUpdate[asset][agentId] = {
                    direction: assetScore.direction || 0,
                    confidence: assetScore.confidence || 0.5
                  }
                }
              })

              // Use BTC for legacy format (backward compatibility)
              const btcScore = docData.scores?.find(s => s.asset === 'BTC') || docData.scores?.[0]
              if (btcScore) {
                recentScores[agentId] = formatAnalystScore({
                  score: btcScore.direction,
                  confidence: btcScore.confidence,
                  rationale: btcScore.rationale
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
              },
              assetScores: {
                BTC: { ...prev.assetScores.BTC, ...assetScoresUpdate.BTC },
                ETH: { ...prev.assetScores.ETH, ...assetScoresUpdate.ETH },
                SOL: { ...prev.assetScores.SOL, ...assetScoresUpdate.SOL },
                XRP: { ...prev.assetScores.XRP, ...assetScoresUpdate.XRP }
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

      // Status indicator - check if any asset has an active signal
      const pulse = Math.sin(t * 3) * 0.5 + 0.5
      const hasActiveSignal = TRADEABLE_ASSETS.some(asset =>
        data.decisions[asset]?.action && data.decisions[asset].action !== 'HOLD'
      )

      if (hasActiveSignal) {
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

      // Multi-Asset Decision Matrix - shows all 4 tradeable assets
      drawMultiAssetDecisionMatrix(ctx, data.decisions, data.consensus, 160, t)

      // Performance Metrics
      drawPerformanceMetrics(ctx, data.performance, 250)

      // Trade Signal Bar - shows primary active signal
      const primaryDecision = data.decisions[data.primaryAsset] || { action: 'HOLD', symbol: data.primaryAsset }
      drawTradeSignal(ctx, { ...primaryDecision, symbol: data.primaryAsset }, 300, t)

      // Confidence meter on the right - average confidence across assets
      const avgConfidence = TRADEABLE_ASSETS.reduce((sum, asset) =>
        sum + (data.decisions[asset]?.confidence || 0.5), 0) / TRADEABLE_ASSETS.length
      drawConfidenceMeter(ctx, avgConfidence, 470, 65, t)

      // Border with glow effect when active
      if (hasActiveSignal) {
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

// Draw multi-asset decision matrix - shows all 4 tradeable assets
function drawMultiAssetDecisionMatrix(ctx, decisions, consensus, y, time) {
  // Header
  ctx.fillStyle = '#FFD700'
  ctx.font = 'bold 12px monospace'
  ctx.fillText('ASSET SIGNALS', 24, y)

  const assets = TRADEABLE_ASSETS
  const boxWidth = 105
  const boxHeight = 70
  const startX = 24
  const boxY = y + 8
  const pulse = Math.sin(time * 4) * 0.5 + 0.5

  assets.forEach((asset, i) => {
    const decision = decisions[asset] || { action: 'HOLD', confidence: 0.5 }
    const assetConsensus = consensus[asset] || { score: 50, direction: 'neutral' }
    const x = startX + (i * (boxWidth + 4))

    // Background color based on action
    const isActive = decision.action && decision.action !== 'HOLD'
    const isBuy = decision.action?.includes('BUY') || decision.action === 'LONG'
    const isSell = decision.action?.includes('SELL') || decision.action === 'SHORT'

    const bgColor = isBuy ? 'rgba(0, 255, 0, 0.15)' :
                    isSell ? 'rgba(255, 0, 0, 0.15)' :
                    'rgba(255, 255, 255, 0.05)'

    // Draw box
    ctx.fillStyle = bgColor
    ctx.fillRect(x, boxY, boxWidth, boxHeight)

    // Border - highlight if active
    if (isActive) {
      ctx.strokeStyle = isBuy ? `rgba(68, 255, 68, ${0.5 + pulse * 0.5})` :
                        `rgba(255, 68, 68, ${0.5 + pulse * 0.5})`
      ctx.lineWidth = 2
    } else {
      ctx.strokeStyle = 'rgba(255, 215, 0, 0.3)'
      ctx.lineWidth = 1
    }
    ctx.strokeRect(x, boxY, boxWidth, boxHeight)

    // Asset symbol
    ctx.fillStyle = '#FFD700'
    ctx.font = 'bold 14px monospace'
    ctx.fillText(asset, x + 5, boxY + 18)

    // Action
    const actionColor = isBuy ? '#44ff44' : isSell ? '#ff4444' : '#888888'
    ctx.fillStyle = isActive ?
      `rgba(${isBuy ? '68, 255, 68' : isSell ? '255, 68, 68' : '136, 136, 136'}, ${0.6 + pulse * 0.4})` :
      actionColor
    ctx.font = 'bold 11px monospace'
    const actionText = decision.action || 'HOLD'
    ctx.fillText(actionText, x + 5, boxY + 35)

    // Consensus score bar
    const barX = x + 5
    const barY = boxY + 42
    const barWidth = boxWidth - 10
    const barHeight = 8

    // Bar background
    ctx.fillStyle = 'rgba(255, 255, 255, 0.1)'
    ctx.fillRect(barX, barY, barWidth, barHeight)

    // Bar fill based on consensus (0-100, 50 is neutral)
    const score = assetConsensus.score || 50
    const fillWidth = (score / 100) * barWidth
    const barColor = score > 60 ? '#44ff44' : score < 40 ? '#ff4444' : '#ffff44'
    ctx.fillStyle = barColor
    ctx.fillRect(barX, barY, fillWidth, barHeight)

    // Center line at 50
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(barX + barWidth / 2, barY)
    ctx.lineTo(barX + barWidth / 2, barY + barHeight)
    ctx.stroke()

    // Score text
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)'
    ctx.font = '9px monospace'
    ctx.fillText(`${score}`, x + 5, boxY + 62)

    // Confidence indicator (small dots)
    const confLevel = Math.floor((decision.confidence || 0.5) * 5)
    for (let j = 0; j < 5; j++) {
      ctx.fillStyle = j < confLevel ? '#FFD700' : 'rgba(255, 255, 255, 0.15)'
      ctx.fillRect(x + 35 + j * 8, boxY + 56, 5, 5)
    }

    // Size if trading
    if (decision.size > 0) {
      ctx.fillStyle = '#FFD700'
      ctx.font = '8px monospace'
      ctx.fillText(`${(decision.size * 100).toFixed(0)}%`, x + boxWidth - 25, boxY + 18)
    }
  })
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
