import { useEffect, useState } from 'react'

// RL80 command center data fetching
const useRL80Data = (refreshInterval = 30000) => { // 30 seconds refresh
  const [data, setData] = useState({
    signals: {
      sentiment: { score: 50, signal: 'neutral', confidence: 0.5, factors: [] },
      technical: { score: 50, signal: 'neutral', confidence: 0.5, factors: [] },
      macro: { score: 50, signal: 'neutral', confidence: 0.5, factors: [] }
    },
    decision: {
      action: 'HOLD',
      size: 0,
      confidence: 0.5,
      reasoning: 'Initializing...',
      consensusScore: 50
    },
    performance: {
      winRate: 50,
      totalPnL: 0,
      recentTrades: []
    }
  })

  useEffect(() => {
    const fetchRL80Analysis = async () => {
      try {
        const response = await fetch('/api/ai/rl80-analysis')
        if (response.ok) {
          const analysisData = await response.json()
          setData(analysisData)
          console.log('[RL80Screen] Updated analysis data')
        }
      } catch (err) {
        console.error('[RL80Screen] Error fetching analysis:', err)
      }
    }

    // Initial fetch
    fetchRL80Analysis()
    
    // Set up refresh interval
    const interval = setInterval(fetchRL80Analysis, refreshInterval)
    
    return () => clearInterval(interval)
  }, [refreshInterval])

  return data
}

// The RL80 command center screen
const RL80Screen = () => {
  const data = useRL80Data()
  const [hasStartedDrawing, setHasStartedDrawing] = useState(false)
  const [animationFrame, setAnimationFrame] = useState(0)
  const [dataReceived, setDataReceived] = useState({
    emo: false,
    tekno: false,
    macro: false
  })
  const [lastDataTime, setLastDataTime] = useState(null)
  
  // Track when new data arrives
  useEffect(() => {
    if (data && data.signals) {
      const newDataReceived = {
        emo: data.signals.sentiment && data.signals.sentiment.score !== 50,
        tekno: data.signals.technical && data.signals.technical.score !== 50,
        macro: data.signals.macro && data.signals.macro.score !== 50
      }
      setDataReceived(newDataReceived)
      
      // Update timestamp when any real data arrives
      if (newDataReceived.emo || newDataReceived.tekno || newDataReceived.macro) {
        setLastDataTime(Date.now())
      }
    }
  }, [data])

  // Animation loop
  useEffect(() => {
    const animate = () => {
      setAnimationFrame(prev => prev + 1)
    }
    const interval = setInterval(animate, 100)
    return () => clearInterval(interval)
  }, [])

  // Draw loop
  useEffect(() => {
    const draw = () => {
      // Use the global canvas set up by VideoScreens for Screen4
      // @ts-ignore
      const canvas = window['__screen4Canvas']
      // @ts-ignore
      const texture = window['__screen4Texture']
      
      if (!canvas || !texture) {
        return
      }
      
      // Log once when we start drawing
      if (!hasStartedDrawing) {
        console.log('[RL80Screen] Started drawing to Screen4!')
        setHasStartedDrawing(true)
      }
      
      const ctx = canvas.getContext('2d')
      const t = performance.now() / 1000 // Time in seconds

      // Background - dark with subtle grid
      ctx.fillStyle = '#0a0a0a'
      ctx.fillRect(0, 0, 512, 320)
      
      // Draw subtle grid
      ctx.strokeStyle = 'rgba(255, 215, 0, 0.05)' // Very faint gold
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

      // Header with RL80's golden color
      ctx.fillStyle = '#FFD700' // Gold for the boss
      ctx.font = 'bold 18px monospace'
      ctx.fillText('⚡ RL80 COMMAND CENTER', 16, 28)
      
      // Data flow indicators - show which agents are feeding data
      const agentStatuses = [
        { name: 'EMO', active: dataReceived.emo, x: 280, color: '#9333ea' },
        { name: 'TEK', active: dataReceived.tekno, x: 320, color: '#00ffff' },
        { name: 'MAC', active: dataReceived.macro, x: 360, color: '#00ff00' }
      ]
      
      agentStatuses.forEach(agent => {
        const pulseFactor = agent.active ? Math.sin(t * 4) * 0.3 + 0.7 : 0.3
        ctx.fillStyle = agent.active ? agent.color : 'rgba(255, 255, 255, 0.2)'
        ctx.globalAlpha = pulseFactor
        ctx.font = 'bold 10px monospace'
        ctx.fillText('▼', agent.x, 24)
        ctx.font = '8px monospace'
        ctx.fillText(agent.name, agent.x - 4, 36)
        ctx.globalAlpha = 1.0
      })
      
      // Status indicator - pulses when making decisions
      const pulse = Math.sin(t * 3) * 0.5 + 0.5
      if (data.decision.action !== 'HOLD') {
        ctx.fillStyle = `rgba(255, 215, 0, ${pulse})`
        ctx.font = 'bold 12px monospace'
        ctx.fillText('●ACTIVE', 460, 28)
      } else {
        ctx.fillStyle = 'rgba(255, 215, 0, 0.5)'
        ctx.font = '10px monospace'
        ctx.fillText('●STANDBY', 450, 28)
      }
      
      // Divider line
      ctx.strokeStyle = '#FFD700'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(16, 40)
      ctx.lineTo(496, 40)
      ctx.stroke()
      
      // Show data sync status
      if (lastDataTime) {
        const timeSinceUpdate = Math.floor((Date.now() - lastDataTime) / 1000)
        const nextSyncIn = Math.max(0, 60 - (timeSinceUpdate % 60)) // API polls every 60s
        const nextFreshDataIn = Math.max(0, 900 - (timeSinceUpdate % 900)) // Fresh data every 15 min
        ctx.fillStyle = 'rgba(255, 215, 0, 0.6)'
        ctx.font = '9px monospace'
        ctx.fillText(`Last sync: ${timeSinceUpdate}s ago`, 16, 54)
        // Show minutes:seconds for fresh data countdown
        const minutes = Math.floor(nextFreshDataIn / 60)
        const seconds = nextFreshDataIn % 60
        ctx.fillText(`Next fresh data: ${minutes}:${seconds.toString().padStart(2, '0')}`, 140, 54)
      }

      // Council Analysis Section with connection indicators
      drawCouncilSignals(ctx, data.signals, 70, t, dataReceived)
      
      // Decision Matrix
      drawDecisionMatrix(ctx, data.decision, 155, t)
      
      // Performance Metrics
      drawPerformanceMetrics(ctx, data.performance, 235)
      
      // Trade Signal Bar
      drawTradeSignal(ctx, data.decision, 290, t)
      
      // Confidence meter on the right
      drawConfidenceMeter(ctx, data.decision.confidence, 420, 60, t)
      
      // Border with glow effect when active
      if (data.decision.action !== 'HOLD') {
        ctx.strokeStyle = `rgba(255, 215, 0, ${0.5 + pulse * 0.5})`
        ctx.lineWidth = 2
      } else {
        ctx.strokeStyle = 'rgba(255, 215, 0, 0.3)'
        ctx.lineWidth = 1
      }
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
  }, [data, dataReceived, lastDataTime, hasStartedDrawing, animationFrame])

  return null
}

// Helper drawing functions
const drawCouncilSignals = (ctx, signals, y, time, dataReceived = {}) => {
  ctx.fillStyle = '#FFD700'
  ctx.font = 'bold 14px monospace'
  ctx.fillText('COUNCIL ANALYSIS', 24, y)
  
  const agents = [
    { name: 'EMO', data: signals.sentiment, color: '#9333ea', connected: dataReceived.emo },
    { name: 'TEK', data: signals.technical, color: '#00ffff', connected: dataReceived.tekno },
    { name: 'MAC', data: signals.macro, color: '#00ff00', connected: dataReceived.macro }
  ]
  
  agents.forEach((agent, i) => {
    const yPos = y + 20 + (i * 22)
    
    // Connection indicator
    if (agent.connected) {
      const pulse = Math.sin(time * 3) * 0.3 + 0.7
      ctx.fillStyle = agent.color
      ctx.globalAlpha = pulse
      ctx.font = '10px monospace'
      ctx.fillText('◉', 12, yPos)
      ctx.globalAlpha = 1.0
    } else {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.2)'
      ctx.font = '10px monospace'
      ctx.fillText('○', 12, yPos)
    }
    
    // Agent name
    ctx.fillStyle = agent.connected ? agent.color : 'rgba(255, 255, 255, 0.5)'
    ctx.font = 'bold 11px monospace'
    ctx.fillText(agent.name + ':', 24, yPos)
    
    // Score bar
    const barX = 70
    const barWidth = 150
    const barHeight = 14
    
    // Background bar
    ctx.fillStyle = 'rgba(255, 255, 255, 0.1)'
    ctx.fillRect(barX, yPos - 12, barWidth, barHeight)
    
    // Filled bar based on score
    const fillWidth = (agent.data.score / 100) * barWidth
    const barColor = agent.data.score > 65 ? '#44ff44' : 
                     agent.data.score < 35 ? '#ff4444' : '#ffff44'
    ctx.fillStyle = barColor
    ctx.fillRect(barX, yPos - 12, fillWidth, barHeight)
    
    // Score text
    ctx.fillStyle = '#ffffff'
    ctx.font = '10px monospace'
    ctx.fillText(`${agent.data.score.toFixed(0)}%`, barX + barWidth + 5, yPos - 2)
    
    // Signal
    ctx.fillStyle = agent.color
    ctx.font = 'bold 10px monospace'
    const signalText = agent.data.signal.toUpperCase()
    ctx.fillText(signalText, barX + barWidth + 40, yPos - 2)
    
    // Confidence indicator
    const confSize = 4
    const confX = barX + barWidth + 110
    const confLevel = Math.floor(agent.data.confidence * 5)
    for (let j = 0; j < 5; j++) {
      ctx.fillStyle = j < confLevel ? agent.color : 'rgba(255, 255, 255, 0.1)'
      ctx.fillRect(confX + j * (confSize + 2), yPos - 8, confSize, confSize)
    }
  })
}

const drawDecisionMatrix = (ctx, decision, y, time) => {
  // Decision box with golden border
  ctx.strokeStyle = '#FFD700'
  ctx.lineWidth = 2
  ctx.strokeRect(24, y, 380, 60)
  
  // Decision background - changes color based on action
  const bgColor = decision.action.includes('BUY') ? 'rgba(0, 255, 0, 0.1)' :
                  decision.action.includes('SELL') ? 'rgba(255, 0, 0, 0.1)' :
                  'rgba(255, 255, 255, 0.05)'
  ctx.fillStyle = bgColor
  ctx.fillRect(24, y, 380, 60)
  
  // Decision header
  ctx.fillStyle = '#FFD700'
  ctx.font = 'bold 14px monospace'
  ctx.fillText('DECISION MATRIX', 34, y + 18)
  
  // Action with animation
  const pulse = Math.sin(time * 4) * 0.5 + 0.5
  const actionColor = decision.action.includes('BUY') ? '#44ff44' :
                      decision.action.includes('SELL') ? '#ff4444' :
                      '#ffff44'
  
  ctx.fillStyle = decision.action !== 'HOLD' ? 
    `rgba(${actionColor === '#44ff44' ? '68, 255, 68' : 
           actionColor === '#ff4444' ? '255, 68, 68' : '255, 255, 68'}, ${0.5 + pulse * 0.5})` :
    actionColor
  ctx.font = 'bold 20px monospace'
  ctx.fillText(decision.action, 34, y + 44)
  
  // Size indicator
  if (decision.size > 0) {
    ctx.fillStyle = '#ffffff'
    ctx.font = '12px monospace'
    ctx.fillText(`Size: ${(decision.size * 100).toFixed(0)}%`, 150, y + 44)
  }
  
  // Consensus score
  ctx.fillStyle = '#FFD700'
  ctx.font = '11px monospace'
  ctx.fillText(`Consensus: ${decision.consensusScore.toFixed(0)}/100`, 250, y + 44)
  
  // Reasoning
  ctx.fillStyle = 'rgba(255, 255, 255, 0.7)'
  ctx.font = '9px monospace'
  const reasoning = decision.reasoning.length > 50 ? 
    decision.reasoning.substring(0, 50) + '...' : decision.reasoning
  ctx.fillText(reasoning, 34, y + 58)
}

const drawPerformanceMetrics = (ctx, performance, y) => {
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
  ctx.fillText(`P&L: ${performance.totalPnL >= 0 ? '+' : ''}${performance.totalPnL.toFixed(2)}%`, 250, y + 20)
  
  // Recent trades visualization
  ctx.fillStyle = '#ffffff'
  ctx.font = '10px monospace'
  ctx.fillText('Recent:', 24, y + 35)
  
  if (performance.recentTrades && performance.recentTrades.length > 0) {
    performance.recentTrades.slice(0, 5).forEach((trade, i) => {
      const xPos = 75 + i * 25
      ctx.fillStyle = trade.success ? '#44ff44' : '#ff4444'
      ctx.font = 'bold 14px monospace'
      ctx.fillText(trade.success ? '✓' : '✗', xPos, y + 35)
    })
  } else {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)'
    ctx.font = '10px monospace'
    ctx.fillText('No trades yet', 75, y + 35)
  }
}

const drawTradeSignal = (ctx, decision, y, time) => {
  if (decision.action === 'HOLD') {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)'
    ctx.font = '11px monospace'
    ctx.fillText('⚡ AWAITING OPPORTUNITY - NO ACTIVE SIGNALS', 24, y)
  } else {
    // Animated trade signal
    const pulse = Math.sin(time * 5) * 0.5 + 0.5
    const signalColor = decision.action.includes('BUY') ? 
      `rgba(68, 255, 68, ${0.5 + pulse * 0.5})` :
      `rgba(255, 68, 68, ${0.5 + pulse * 0.5})`
    
    ctx.fillStyle = signalColor
    ctx.font = 'bold 12px monospace'
    ctx.fillText(`⚡ SIGNAL: ${decision.action} ${decision.size > 0 ? `@ ${(decision.size * 100).toFixed(0)}% SIZE` : ''}`, 24, y)
    
    // Flash effect
    if (pulse > 0.8) {
      ctx.strokeStyle = signalColor
      ctx.lineWidth = 1
      ctx.strokeRect(20, y - 12, 400, 18)
    }
  }
}

const drawConfidenceMeter = (ctx, confidence, x, y, time) => {
  ctx.fillStyle = '#FFD700'
  ctx.font = '10px monospace'
  ctx.fillText('CONF', x, y - 5)
  
  // Vertical confidence meter
  const meterHeight = 180
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
  
  // Animated indicator
  const indicatorY = y + meterHeight - fillHeight
  const pulse = Math.sin(time * 3)
  ctx.strokeStyle = '#FFD700'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(x - 5, indicatorY)
  ctx.lineTo(x + meterWidth + 5, indicatorY)
  ctx.stroke()
}

export default RL80Screen