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

    // Scope (now a multi-row data table + bar chart). Generate a stable list
    // of rows with mutating values so the table reads as live but doesn't
    // reshuffle every frame.
    const scopeRows = [
      'RL80', 'BTC', 'ETH', 'SOL', 'BASE', 'GR80', 'H80Z', 'USDC', 'WETH'
    ].map(sym => ({
      sym,
      price: Math.random() * 1000,
      change: (Math.random() - 0.5) * 5,
      vol: Math.random() * 9999,
      flashUntil: 0,
    }))
    let lastScopeTick = 0
    // Bar chart bars — historical "volume" values that scroll left.
    const SCOPE_BARS = 36
    const scopeBars = new Float32Array(SCOPE_BARS).map(() => 0.3 + Math.random() * 0.7)
    let lastBarTick = 0

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
      // Background — deep phosphor green CRT
      ctx.fillStyle = '#001005'
      ctx.fillRect(0, 0, W, H)

      // Header bar
      ctx.fillStyle = 'rgba(0,255,140,0.12)'
      ctx.fillRect(0, 0, W, 28)
      ctx.fillStyle = 'rgba(120,255,160,0.95)'
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
      ctx.fillStyle = 'rgba(120,255,160,0.9)'
      ctx.fillText(text, offset, H / 2)

      // Per-symbol gain/loss colored dots above marquee for vibe
      ctx.font = '10px monospace'
      tickerSymbols.forEach((s, i) => {
        const x = 16 + i * 60
        ctx.fillStyle = s.drift >= 0 ? 'rgba(180,255,180,0.95)' : 'rgba(255,90,90,0.85)'
        ctx.beginPath()
        ctx.arc(x, H - 30, 3, 0, Math.PI * 2)
        ctx.fill()
        ctx.fillStyle = 'rgba(120,255,160,0.7)'
        ctx.fillText(s.sym, x + 8, H - 28)
      })

      // Bottom status line
      ctx.fillStyle = 'rgba(0,255,140,0.6)'
      ctx.fillRect(0, H - 14, W, 1)
      ctx.fillStyle = 'rgba(120,255,160,0.65)'
      ctx.font = '10px monospace'
      ctx.textAlign = 'left'
      ctx.fillText('FEED · LIVE · DELAY 50ms', 14, H - 7)
    }

    const drawScope = (ctx, W, H, t) => {
      // Background — CRT phosphor green
      ctx.fillStyle = '#001005'
      ctx.fillRect(0, 0, W, H)

      const now = performance.now()
      // Tick row data ~3x/sec — small drifts on a couple of random rows so
      // the table reads as live without churning everything at once.
      if (now - lastScopeTick > 320) {
        lastScopeTick = now
        const hits = 1 + Math.floor(Math.random() * 3)
        for (let i = 0; i < hits; i++) {
          const r = scopeRows[Math.floor(Math.random() * scopeRows.length)]
          r.change += (Math.random() - 0.5) * 0.6
          r.change = Math.max(-9.9, Math.min(9.9, r.change))
          r.price = Math.max(0.01, r.price * (1 + r.change / 1000))
          r.vol = Math.max(1, r.vol + (Math.random() - 0.5) * 200)
          r.flashUntil = now + 350
        }
      }
      // Bar chart shifts left ~10x/sec.
      if (now - lastBarTick > 100) {
        lastBarTick = now
        for (let i = 0; i < SCOPE_BARS - 1; i++) scopeBars[i] = scopeBars[i + 1]
        scopeBars[SCOPE_BARS - 1] = 0.2 + Math.random() * 0.8
      }

      // ---- Header strip ----
      ctx.fillStyle = 'rgba(0,255,140,0.12)'
      ctx.fillRect(0, 0, W, 22)
      ctx.fillStyle = 'rgba(120,255,160,0.95)'
      ctx.font = 'bold 11px monospace'
      ctx.textBaseline = 'middle'
      ctx.textAlign = 'left'
      ctx.fillText('LIMINAL · SCREENER', 12, 11)
      ctx.textAlign = 'right'
      ctx.fillText(new Date().toISOString().slice(11, 19), W - 12, 11)

      // ---- Bar chart (top quarter, right column) ----
      const chartX = Math.floor(W * 0.55)
      const chartY = 28
      const chartW = W - chartX - 12
      const chartH = 70
      // Frame
      ctx.strokeStyle = 'rgba(0,255,140,0.3)'
      ctx.lineWidth = 1
      ctx.strokeRect(chartX + 0.5, chartY + 0.5, chartW - 1, chartH - 1)
      // Faint grid
      ctx.strokeStyle = 'rgba(0,255,140,0.1)'
      ctx.beginPath()
      for (let g = 1; g < 4; g++) {
        const gy = chartY + (chartH * g) / 4
        ctx.moveTo(chartX, gy); ctx.lineTo(chartX + chartW, gy)
      }
      ctx.stroke()
      // Bars
      const barW = chartW / SCOPE_BARS
      for (let i = 0; i < SCOPE_BARS; i++) {
        const v = scopeBars[i]
        const bh = v * (chartH - 4)
        const bx = chartX + i * barW + 1
        const by = chartY + chartH - bh - 2
        ctx.fillStyle = i === SCOPE_BARS - 1
          ? 'rgba(180,255,200,0.95)'
          : `rgba(120,255,160,${0.35 + v * 0.5})`
        ctx.fillRect(bx, by, Math.max(1, barW - 2), bh)
      }
      ctx.fillStyle = 'rgba(0,255,140,0.55)'
      ctx.font = '9px monospace'
      ctx.textAlign = 'left'
      ctx.textBaseline = 'top'
      ctx.fillText('VOL · 1m', chartX + 4, chartY + 4)

      // ---- Mini sparkline panel (top quarter, left column) ----
      const sparkX = 12
      const sparkY = 28
      const sparkW = chartX - sparkX - 12
      const sparkH = 70
      ctx.strokeStyle = 'rgba(0,255,140,0.3)'
      ctx.strokeRect(sparkX + 0.5, sparkY + 0.5, sparkW - 1, sparkH - 1)
      // Three layered sparklines from sin combos (deterministic so they're
      // smooth, not jittery).
      const lines = [
        { phase: 0, freq: 1.6, amp: 0.42, alpha: 0.85 },
        { phase: 1.5, freq: 2.3, amp: 0.28, alpha: 0.55 },
        { phase: 0.7, freq: 0.8, amp: 0.18, alpha: 0.4 },
      ]
      lines.forEach((l) => {
        ctx.strokeStyle = `rgba(120,255,160,${l.alpha})`
        ctx.lineWidth = 1.3
        ctx.beginPath()
        const N = 60
        for (let i = 0; i < N; i++) {
          const u = i / (N - 1)
          const v = Math.sin(t * l.freq + l.phase + u * 6) * l.amp
            + Math.sin(t * (l.freq * 2.7) + l.phase * 2 + u * 12) * (l.amp * 0.3)
          const px = sparkX + 4 + u * (sparkW - 8)
          const py = sparkY + sparkH / 2 - v * (sparkH * 0.42)
          if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py)
        }
        ctx.stroke()
      })
      ctx.fillStyle = 'rgba(0,255,140,0.55)'
      ctx.font = '9px monospace'
      ctx.textAlign = 'left'
      ctx.fillText('PULSE · 3CH', sparkX + 4, sparkY + 4)

      // ---- Data table (lower 2/3) ----
      const tableY = 110
      // Column headers
      ctx.fillStyle = 'rgba(0,255,140,0.18)'
      ctx.fillRect(0, tableY, W, 16)
      ctx.fillStyle = 'rgba(120,255,160,0.85)'
      ctx.font = 'bold 10px monospace'
      ctx.textBaseline = 'middle'
      const cols = [
        { label: 'SYMBOL', x: 14, align: 'left' },
        { label: 'PRICE',  x: Math.floor(W * 0.42), align: 'right' },
        { label: 'Δ%',     x: Math.floor(W * 0.62), align: 'right' },
        { label: 'VOL',    x: W - 14,               align: 'right' },
      ]
      cols.forEach(c => { ctx.textAlign = c.align; ctx.fillText(c.label, c.x, tableY + 8) })

      // Body rows
      ctx.font = '12px monospace'
      const rowH = 18
      scopeRows.forEach((r, i) => {
        const y = tableY + 22 + i * rowH
        // Row flash background when value just updated
        if (now < r.flashUntil) {
          const k = (r.flashUntil - now) / 350
          ctx.fillStyle = `rgba(120,255,160,${0.12 * k})`
          ctx.fillRect(0, y - 9, W, rowH)
        }
        ctx.textBaseline = 'middle'
        ctx.fillStyle = 'rgba(120,255,160,0.92)'
        ctx.textAlign = 'left'
        ctx.fillText(r.sym, 14, y)
        ctx.textAlign = 'right'
        ctx.fillStyle = 'rgba(180,255,200,0.92)'
        ctx.fillText(r.price < 1 ? r.price.toFixed(4) : r.price.toFixed(2), Math.floor(W * 0.42), y)
        ctx.fillStyle = r.change >= 0 ? 'rgba(180,255,200,0.95)' : 'rgba(255,120,120,0.92)'
        const sign = r.change >= 0 ? '+' : ''
        ctx.fillText(`${sign}${r.change.toFixed(2)}`, Math.floor(W * 0.62), y)
        ctx.fillStyle = 'rgba(120,255,160,0.7)'
        ctx.fillText(Math.round(r.vol).toLocaleString(), W - 14, y)
      })

      // ---- Footer ----
      ctx.fillStyle = 'rgba(0,255,140,0.55)'
      ctx.font = '9px monospace'
      ctx.textBaseline = 'middle'
      ctx.textAlign = 'left'
      ctx.fillText('FEED · LIVE · DELAY 50ms', 14, H - 9)
      ctx.textAlign = 'right'
      ctx.fillText(`ROWS ${scopeRows.length} · BARS ${SCOPE_BARS}`, W - 14, H - 9)
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
        ? 'rgba(120,255,160,0.07)'
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
