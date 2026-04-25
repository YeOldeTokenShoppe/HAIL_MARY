import { useEffect, useRef } from 'react'

// Mock CRT screens — paints faux-terminal content onto one of the temple
// screen canvases (set up by VideoScreens.jsx). Three variants so the three
// monitors don't look identical:
//   - "ticker"   : scrolling market ticker (Screen2)
//   - "scope"    : oscilloscope / waveform readout (Screen3)
//   - "terminal" : scrolling code/log lines (Screen4)
// Visual treatment for all variants: scanlines, phosphor glow, vignette,
// occasional flicker. Throttled to 30fps and paused when the tab is hidden
// to keep mobile GPU costs in check.
const CRTScreen = ({ canvasGlobal, textureGlobal, variant = 'terminal' }) => {
  const rafRef = useRef(0)
  const startedAt = useRef(performance.now())

  useEffect(() => {
    const FRAME_INTERVAL = 1000 / 30
    let lastFrame = 0
    let hidden = document.hidden

    const onVis = () => { hidden = document.hidden }
    document.addEventListener('visibilitychange', onVis)

    // ---- per-variant content state ----
    // Ticker: a list of fake symbols cycling through prices.
    const tickerSymbols = [
      { sym: 'RL80', price: 0.0014, drift: 0 },
      { sym: 'BASE', price: 1924.42, drift: 0 },
      { sym: 'ETH',  price: 3187.10, drift: 0 },
      { sym: 'SOL',  price: 162.55,  drift: 0 },
      { sym: 'BTC',  price: 71210.0, drift: 0 },
      { sym: 'USDC', price: 1.00,    drift: 0 },
      { sym: 'GR80', price: 0.082,   drift: 0 },
      { sym: 'H80Z', price: 0.041,   drift: 0 },
    ]
    let tickerScroll = 0
    let lastTickerTick = 0

    // Scope: fixed-length ring of samples.
    const SCOPE_W = 256
    const scopeBuf = new Float32Array(SCOPE_W)
    let scopeIdx = 0
    let nextScopePeak = 0

    // Terminal: list of lines; oldest scroll off the top.
    const terminalLines = []
    const TERMINAL_MAX = 14
    let lastTerminalEmit = 0
    const terminalCorpus = [
      '> liminal::handshake OK',
      '> oracle.poll(rl80) → 200',
      '> feed lat: 42ms',
      '> agent::OUR_LADY heartbeat',
      '> agent::ST_GR80 heartbeat',
      '> agent::H80Z heartbeat',
      '> agent::VIRGIL heartbeat',
      '> tx 0x7f3a..b2 confirmed',
      '> sig verified rl80.eth',
      '> cache hit /ohlcv/15m',
      '> rebuilding orderbook…',
      '> WARN: depth thin @ 0.0014',
      '> mempool spike +18%',
      '> pulse: STEADY',
      '> liturgy v0.4.1 loaded',
      '> rite::candle.lit ok',
      '> tracer ok t+0',
      '> ⟁ scrying iv… resolved',
      '> ⟐ veil seam = 0.07',
    ]
    // Seed a few initial lines so the first frame isn't empty.
    for (let i = 0; i < 6; i++) {
      terminalLines.push(terminalCorpus[Math.floor(Math.random() * terminalCorpus.length)])
    }

    // ---- shared CRT chrome ----
    const drawScanlines = (ctx, w, h, color = 'rgba(0,255,180,0.08)') => {
      ctx.save()
      ctx.fillStyle = color
      for (let y = 0; y < h; y += 3) {
        ctx.fillRect(0, y, w, 1)
      }
      ctx.restore()
    }

    const drawVignette = (ctx, w, h) => {
      const g = ctx.createRadialGradient(w / 2, h / 2, h * 0.25, w / 2, h / 2, h * 0.95)
      g.addColorStop(0, 'rgba(0,0,0,0)')
      g.addColorStop(1, 'rgba(0,0,0,0.7)')
      ctx.fillStyle = g
      ctx.fillRect(0, 0, w, h)
    }

    const drawFlicker = (ctx, w, h, t) => {
      // Occasional faint horizontal hold dropout
      if (Math.random() < 0.04) {
        const y = Math.random() * h
        ctx.fillStyle = `rgba(255,255,255,${0.04 + Math.random() * 0.06})`
        ctx.fillRect(0, y, w, 1 + Math.random() * 2)
      }
      // Subtle global brightness wobble baked into a translucent overlay
      const wobble = 0.04 + 0.04 * Math.sin(t * 11)
      ctx.fillStyle = `rgba(0,0,0,${wobble})`
      ctx.fillRect(0, 0, w, h)
    }

    // ---- variant draws ----
    const drawTicker = (ctx, W, H, t) => {
      // Background — deep amber CRT
      ctx.fillStyle = '#0a0500'
      ctx.fillRect(0, 0, W, H)

      // Header bar
      ctx.fillStyle = 'rgba(255,140,40,0.12)'
      ctx.fillRect(0, 0, W, 28)
      ctx.fillStyle = 'rgba(255,180,80,0.95)'
      ctx.font = 'bold 13px monospace'
      ctx.textBaseline = 'middle'
      ctx.textAlign = 'left'
      ctx.fillText('LIMINAL · MARKETS', 14, 14)
      ctx.textAlign = 'right'
      const clock = new Date().toISOString().slice(11, 19)
      ctx.fillText(clock, W - 14, 14)

      // Scrolling marquee row
      const now = performance.now()
      if (now - lastTickerTick > 80) {
        lastTickerTick = now
        for (const s of tickerSymbols) {
          s.drift = (Math.random() - 0.5) * 0.8 // % swing
          s.price = Math.max(0.0001, s.price * (1 + s.drift / 100))
        }
        tickerScroll += 2
      }

      // Build a string repeated enough to fill the marquee
      const pieces = tickerSymbols.map(s => {
        const sign = s.drift >= 0 ? '+' : ''
        return `${s.sym} ${s.price < 1 ? s.price.toFixed(4) : s.price.toFixed(2)}  ${sign}${s.drift.toFixed(2)}%`
      })
      const marquee = pieces.join('   ·   ') + '   ·   '
      ctx.font = 'bold 18px monospace'
      ctx.textBaseline = 'middle'
      ctx.textAlign = 'left'
      const text = marquee + marquee + marquee
      const textW = ctx.measureText(text).width
      const offset = -(tickerScroll % textW)
      ctx.fillStyle = 'rgba(255,180,80,0.9)'
      ctx.fillText(text, offset, H / 2)

      // Per-symbol gain/loss colored dots above marquee for vibe
      ctx.font = '10px monospace'
      tickerSymbols.forEach((s, i) => {
        const x = 16 + i * 60
        ctx.fillStyle = s.drift >= 0 ? 'rgba(120,255,140,0.8)' : 'rgba(255,90,90,0.85)'
        ctx.beginPath()
        ctx.arc(x, H - 30, 3, 0, Math.PI * 2)
        ctx.fill()
        ctx.fillStyle = 'rgba(255,200,120,0.7)'
        ctx.fillText(s.sym, x + 8, H - 28)
      })

      // Bottom status line
      ctx.fillStyle = 'rgba(255,140,40,0.6)'
      ctx.fillRect(0, H - 14, W, 1)
      ctx.fillStyle = 'rgba(255,200,120,0.65)'
      ctx.font = '10px monospace'
      ctx.textAlign = 'left'
      ctx.fillText('FEED · LIVE · DELAY 50ms', 14, H - 7)
    }

    const drawScope = (ctx, W, H, t) => {
      // Background — CRT phosphor green
      ctx.fillStyle = '#001005'
      ctx.fillRect(0, 0, W, H)

      // Grid
      ctx.strokeStyle = 'rgba(0,255,140,0.12)'
      ctx.lineWidth = 1
      ctx.beginPath()
      for (let x = 0; x < W; x += 32) {
        ctx.moveTo(x, 0); ctx.lineTo(x, H)
      }
      for (let y = 0; y < H; y += 32) {
        ctx.moveTo(0, y); ctx.lineTo(W, y)
      }
      ctx.stroke()

      // Center reference line
      ctx.strokeStyle = 'rgba(0,255,140,0.25)'
      ctx.beginPath()
      ctx.moveTo(0, H / 2); ctx.lineTo(W, H / 2)
      ctx.stroke()

      // Push a new sample. Layer two sines + occasional spike.
      const baseT = t * 1.7
      const sample = Math.sin(baseT * 2.0) * 0.45
        + Math.sin(baseT * 6.3 + 0.6) * 0.18
        + Math.sin(baseT * 13.1) * 0.06
      const spike = (t > nextScopePeak) ? (Math.random() - 0.5) * 0.9 : 0
      if (t > nextScopePeak) nextScopePeak = t + 0.6 + Math.random() * 1.4
      scopeBuf[scopeIdx] = sample + spike
      scopeIdx = (scopeIdx + 1) % SCOPE_W

      // Trace
      ctx.strokeStyle = 'rgba(120,255,160,0.95)'
      ctx.lineWidth = 1.6
      ctx.beginPath()
      const stepX = W / SCOPE_W
      for (let i = 0; i < SCOPE_W; i++) {
        const idx = (scopeIdx + i) % SCOPE_W
        const v = scopeBuf[idx]
        const x = i * stepX
        const y = H / 2 - v * (H * 0.38)
        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.stroke()

      // Glow pass — re-stroke wider with low alpha for phosphor bloom
      ctx.strokeStyle = 'rgba(120,255,160,0.18)'
      ctx.lineWidth = 4
      ctx.stroke()

      // Readout overlay
      ctx.fillStyle = 'rgba(0,255,140,0.85)'
      ctx.font = 'bold 12px monospace'
      ctx.textAlign = 'left'
      ctx.textBaseline = 'top'
      ctx.fillText('CH1 · 50mV/div · 200ms/div', 14, 12)
      ctx.textAlign = 'right'
      const lastV = scopeBuf[(scopeIdx + SCOPE_W - 1) % SCOPE_W]
      ctx.fillText(`${(lastV * 50).toFixed(1)}mV`, W - 14, 12)
      ctx.textAlign = 'left'
      ctx.fillStyle = 'rgba(0,255,140,0.55)'
      ctx.font = '10px monospace'
      ctx.fillText('TRIG · AUTO', 14, H - 18)
      ctx.textAlign = 'right'
      ctx.fillText('SIG · LOCKED', W - 14, H - 18)
    }

    const drawTerminal = (ctx, W, H, t) => {
      // Background — deep blue/black
      ctx.fillStyle = '#020a08'
      ctx.fillRect(0, 0, W, H)

      // Emit a new line every ~600ms
      const now = performance.now()
      if (now - lastTerminalEmit > 550) {
        lastTerminalEmit = now
        terminalLines.push(terminalCorpus[Math.floor(Math.random() * terminalCorpus.length)])
        while (terminalLines.length > TERMINAL_MAX) terminalLines.shift()
      }

      // Header
      ctx.fillStyle = 'rgba(120,220,255,0.12)'
      ctx.fillRect(0, 0, W, 22)
      ctx.fillStyle = 'rgba(120,220,255,0.85)'
      ctx.font = 'bold 11px monospace'
      ctx.textBaseline = 'middle'
      ctx.textAlign = 'left'
      ctx.fillText('liminal:~$ stream --tail', 12, 11)
      ctx.textAlign = 'right'
      ctx.fillText('● LIVE', W - 12, 11)

      // Lines — older lines fade with age
      ctx.font = '13px monospace'
      ctx.textBaseline = 'top'
      ctx.textAlign = 'left'
      const lineH = 18
      const baseY = 32
      terminalLines.forEach((line, i) => {
        const fade = Math.min(1, (i + 1) / terminalLines.length + 0.1)
        ctx.fillStyle = `rgba(120,255,180,${0.3 + 0.6 * fade})`
        ctx.fillText(line, 14, baseY + i * lineH)
      })

      // Cursor on the next empty line
      const cursorY = baseY + terminalLines.length * lineH
      if (Math.floor(t * 2) % 2 === 0) {
        ctx.fillStyle = 'rgba(120,255,180,0.85)'
        ctx.fillRect(14, cursorY, 8, 14)
      }
    }

    const draw = (ts) => {
      rafRef.current = requestAnimationFrame(draw)
      if (hidden) return
      if (ts - lastFrame < FRAME_INTERVAL) return
      lastFrame = ts

      const canvas = window[canvasGlobal]
      const texture = window[textureGlobal]
      if (!canvas || !texture) return

      const ctx = canvas.getContext('2d')
      const W = canvas.width
      const H = canvas.height
      const t = (performance.now() - startedAt.current) / 1000

      if (variant === 'ticker')        drawTicker(ctx, W, H, t)
      else if (variant === 'scope')    drawScope(ctx, W, H, t)
      else                             drawTerminal(ctx, W, H, t)

      // Shared CRT chrome
      const scanlineColor = variant === 'ticker'
        ? 'rgba(255,180,80,0.06)'
        : variant === 'scope'
        ? 'rgba(0,255,140,0.07)'
        : 'rgba(120,255,180,0.07)'
      drawScanlines(ctx, W, H, scanlineColor)
      drawVignette(ctx, W, H)
      drawFlicker(ctx, W, H, t)

      texture.needsUpdate = true
    }

    rafRef.current = requestAnimationFrame(draw)

    return () => {
      cancelAnimationFrame(rafRef.current)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [canvasGlobal, textureGlobal, variant])

  return null
}

export default CRTScreen
