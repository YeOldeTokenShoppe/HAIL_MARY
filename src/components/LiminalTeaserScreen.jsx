import { useEffect, useRef } from 'react'
import { tierValue } from '@/lib/deviceTier'

// Paints a cryptic "coming soon" teaser to one of the temple's screen canvases.
// Parameterized so VideoScreens can reuse it for every screen slot in preview mode.
const LiminalTeaserScreen = ({
  canvasGlobal,
  textureGlobal,
  variant = 'glyph',
  agent = null,
  tagline = null,
}) => {
  const startRef = useRef(Date.now())

  useEffect(() => {
    // Seed per-instance noise so each screen's static looks different.
    const seed = Math.random()

    const drawScanlines = (ctx, w, h) => {
      ctx.save()
      ctx.globalAlpha = 0.08
      ctx.fillStyle = '#00ffff'
      for (let y = 0; y < h; y += 3) {
        ctx.fillRect(0, y, w, 1)
      }
      ctx.restore()
    }

    const drawVignette = (ctx, w, h) => {
      const g = ctx.createRadialGradient(w / 2, h / 2, h * 0.2, w / 2, h / 2, h * 0.9)
      g.addColorStop(0, 'rgba(0,0,0,0)')
      g.addColorStop(1, 'rgba(0,0,0,0.85)')
      ctx.fillStyle = g
      ctx.fillRect(0, 0, w, h)
    }

    const drawWatermark = (ctx, w, h) => {
      ctx.save()
      ctx.fillStyle = 'rgba(120, 220, 255, 0.35)'
      ctx.font = '8px monospace'
      ctx.textAlign = 'left'
      ctx.fillText('LIMINAL//TERMINAL', 10, h - 10)
      ctx.textAlign = 'right'
      const ts = new Date().toISOString().slice(11, 19)
      ctx.fillText(ts, w - 10, h - 10)
      ctx.restore()
    }

    // Top-of-screen "COMING SOON" banner — visible on every variant so the
    // preview state is unambiguous no matter which agent/panel a viewer looks at.
    const drawComingSoonBanner = (ctx, w, t) => {
      ctx.save()
      const pulse = 0.7 + 0.3 * Math.sin(t * 1.6)
      // Thin accent line under the banner
      ctx.strokeStyle = `rgba(241, 215, 122, ${0.25 + pulse * 0.15})`
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(16, 26)
      ctx.lineTo(w - 16, 26)
      ctx.stroke()
      // Banner text
      ctx.fillStyle = `rgba(241, 215, 122, ${0.7 + pulse * 0.3})`
      ctx.font = 'bold 11px monospace'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      const dots = '.'.repeat(Math.floor(t * 2) % 4)
      ctx.fillText(`· COMING SOON${dots} ·`, w / 2, 14)
      ctx.restore()
    }

    const drawStatic = (ctx, w, h, intensity = 0.12) => {
      const img = ctx.getImageData(0, 0, w, h)
      const d = img.data
      for (let i = 0; i < d.length; i += 4) {
        if (Math.random() < intensity) {
          const v = Math.random() * 60
          d[i] = Math.max(0, d[i] - v)
          d[i + 1] = Math.max(0, d[i + 1] - v)
          d[i + 2] = Math.max(0, d[i + 2] - v)
        }
      }
      ctx.putImageData(img, 0, 0)
    }

    // Glyph tables — Greek + symbols for a "lost scripture" feel
    const glyphSet = 'ΑΒΓΔΕΖΗΘΙΚΛΜΝΞΟΠΡΣΤΥΦΧΨΩ†‡§¶∞◊◈◉○●◐◑⟁⟐⟡⟠'
    const randomGlyph = () => glyphSet[Math.floor(Math.random() * glyphSet.length)]

    const draw = () => {
      const canvas = window[canvasGlobal]
      const texture = window[textureGlobal]
      if (!canvas || !texture) return

      // willReadFrequently hints the browser to keep this canvas backed by a
      // CPU-side buffer — drawStatic does getImageData every ~120ms.
      const ctx = canvas.getContext('2d', { willReadFrequently: true })
      const W = canvas.width
      const H = canvas.height
      const t = (Date.now() - startRef.current) / 1000

      // Base fill
      ctx.fillStyle = '#050510'
      ctx.fillRect(0, 0, W, H)

      if (variant === 'agent') {
        // Agent-focused teaser: big sigil halo + classified name reveal
        ctx.save()
        const cx = W / 2
        const cy = H / 2 - 10
        // Pulsing halo
        const pulse = 0.5 + 0.5 * Math.sin(t * 1.2 + seed * 6)
        ctx.strokeStyle = `rgba(241, 215, 122, ${0.35 + pulse * 0.35})`
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.arc(cx, cy, 60 + pulse * 4, 0, Math.PI * 2)
        ctx.stroke()
        ctx.strokeStyle = `rgba(241, 215, 122, ${0.15})`
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.arc(cx, cy, 78, 0, Math.PI * 2)
        ctx.stroke()
        // Center glyph — wander between symbols
        ctx.fillStyle = 'rgba(255, 235, 180, 0.92)'
        ctx.font = 'bold 48px serif'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        const glyph = glyphSet[Math.floor(t * 1.5 + seed * 10) % glyphSet.length]
        ctx.fillText(glyph, cx, cy)
        // Agent name — redacted/partial reveal
        const name = agent || 'UNKNOWN'
        const revealFrac = Math.min(1, (Math.sin(t * 0.3) * 0.5 + 0.5) * 1.4)
        const revealLen = Math.floor(name.length * revealFrac)
        let shown = ''
        for (let i = 0; i < name.length; i++) {
          shown += i < revealLen ? name[i] : (name[i] === ' ' ? ' ' : '█')
        }
        ctx.fillStyle = 'rgba(120, 220, 255, 0.85)'
        ctx.font = 'bold 14px monospace'
        ctx.fillText(shown, cx, cy + 90)
        ctx.fillStyle = 'rgba(120, 220, 255, 0.45)'
        ctx.font = '10px monospace'
        ctx.fillText(tagline || 'CLASSIFIED', cx, cy + 108)
        ctx.restore()
      } else if (variant === 'countdown') {
        // Countdown / standby teaser
        ctx.save()
        ctx.fillStyle = 'rgba(120, 220, 255, 0.9)'
        ctx.font = 'bold 20px monospace'
        ctx.textAlign = 'center'
        ctx.fillText('BROADCAST PENDING', W / 2, H / 2 - 20)
        ctx.fillStyle = 'rgba(241, 215, 122, 0.85)'
        ctx.font = 'bold 36px monospace'
        const dots = '.'.repeat(Math.floor(t * 2) % 4)
        ctx.fillText(`SOON${dots}`, W / 2, H / 2 + 20)
        ctx.fillStyle = 'rgba(200, 200, 255, 0.35)'
        ctx.font = '10px monospace'
        ctx.fillText(tagline || 'THE TERMINAL WAKES AT AN UNDISCLOSED HOUR', W / 2, H / 2 + 52)
        ctx.restore()
      } else if (variant === 'scanlines') {
        // Flickering signal-lock screen
        ctx.save()
        ctx.fillStyle = 'rgba(0, 40, 60, 0.4)'
        ctx.fillRect(0, 0, W, H)
        ctx.fillStyle = 'rgba(120, 220, 255, 0.9)'
        ctx.font = 'bold 14px monospace'
        ctx.textAlign = 'left'
        const lines = [
          '> awaiting handshake...',
          '> oracle key: ' + '█'.repeat(16),
          '> feed latency: ∞',
          '> signal: locked',
          '> payload: ' + randomGlyph() + randomGlyph() + randomGlyph() + randomGlyph(),
        ]
        lines.forEach((line, i) => {
          const cursor = Math.floor(t * 2) % lines.length === i ? '_' : ' '
          ctx.fillText(line + cursor, 20, 40 + i * 22)
        })
        ctx.restore()
      } else {
        // Default 'glyph' variant — drifting glyph grid + faint tagline
        ctx.save()
        const cols = 16
        const rows = 10
        const cellW = W / cols
        const cellH = H / rows
        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            const alpha = 0.1 + 0.4 * Math.sin(t * 0.7 + r * 0.9 + c * 0.5 + seed * 10)
            if (alpha <= 0.05) continue
            ctx.fillStyle = `rgba(120, 220, 255, ${alpha * 0.7})`
            ctx.font = '14px serif'
            ctx.textAlign = 'center'
            ctx.textBaseline = 'middle'
            const g = glyphSet[(r * cols + c + Math.floor(t * 1.3)) % glyphSet.length]
            ctx.fillText(g, c * cellW + cellW / 2, r * cellH + cellH / 2)
          }
        }
        ctx.fillStyle = 'rgba(241, 215, 122, 0.8)'
        ctx.font = 'bold 12px monospace'
        ctx.textAlign = 'center'
        ctx.fillText(tagline || 'FRAGMENT · UNVERIFIED', W / 2, H - 26)
        ctx.restore()
      }

      drawVignette(ctx, W, H)
      drawComingSoonBanner(ctx, W, t)
      drawScanlines(ctx, W, H)
      drawWatermark(ctx, W, H)
      if (Math.random() < 0.08) drawStatic(ctx, W, H, 0.05)

      texture.needsUpdate = true
    }

    draw()
    const id = setInterval(draw, tierValue({ desktop: 120, touch: 220 }))
    return () => clearInterval(id)
  }, [canvasGlobal, textureGlobal, variant, agent, tagline])

  return null
}

export default LiminalTeaserScreen
