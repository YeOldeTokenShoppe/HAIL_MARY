import { useEffect, useRef } from 'react'

// Paints a looping, non-interactive slot machine onto one of the temple's
// screen canvases. Reuses the existing canvas/texture plumbing that
// VideoScreens sets up via window globals, matching LiminalTeaserScreen's
// pattern. Visuals mirror Jos Fabre's CodePen (josfabre/abReBvP) — three
// reels spin with a light overshoot easing, then pause a few seconds and
// spin again.
const SlotMachineScreen = ({ canvasGlobal, textureGlobal }) => {
  const rafRef = useRef(0)
  const kickoffRef = useRef(null)
  const nextSpinRef = useRef(null)

  useEffect(() => {
    const REEL_COUNT = 3
    const ICON_SIZE = 79
    const NUM_ICONS = 9
    const SPRITE_H = NUM_ICONS * ICON_SIZE
    const TIME_PER_ICON = 100
    const STAGGER_MS = 150
    const REST_BETWEEN_SPINS = 2500
    // Throttle to ~30fps and skip canvas work entirely while reels are at rest
    // so we're not re-uploading a static texture to the GPU every frame.
    const FRAME_INTERVAL = 1000 / 30
    let lastFrameTime = 0
    let prevAnySpinning = false
    let needsInitialDraw = true

    const state = {
      positions: new Array(REEL_COUNT).fill(0),
      startPositions: new Array(REEL_COUNT).fill(0),
      targets: new Array(REEL_COUNT).fill(0),
      startTimes: new Array(REEL_COUNT).fill(0),
      durations: new Array(REEL_COUNT).fill(0),
      spinning: new Array(REEL_COUNT).fill(false),
      nextScheduled: false,
    }

    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.src = '/slotreel.webp'

    const startSpin = () => {
      const now = performance.now()
      for (let i = 0; i < REEL_COUNT; i++) {
        const delta = (i + 2) * NUM_ICONS + Math.floor(Math.random() * NUM_ICONS)
        state.startPositions[i] = state.positions[i]
        state.targets[i] = state.positions[i] + delta * ICON_SIZE
        state.startTimes[i] = now + i * STAGGER_MS
        state.durations[i] = (8 + delta) * TIME_PER_ICON
        state.spinning[i] = true
      }
      state.nextScheduled = false
    }

    kickoffRef.current = setTimeout(startSpin, 800)

    // Approximation of cubic-bezier(.41,-0.01,.63,1.09) — slight pull-back
    // at the start, small overshoot near the end, so reels feel weighty.
    const easeReel = (t) => {
      if (t <= 0) return 0
      if (t >= 1) return 1
      // Ease-out cubic with a touch of overshoot, then settle.
      const ease = 1 - Math.pow(1 - t, 3)
      const overshoot = Math.sin(t * Math.PI) * 0.02 * (1 - t)
      return Math.min(1, ease + overshoot)
    }

    const draw = (ts) => {
      rafRef.current = requestAnimationFrame(draw)

      const canvas = window[canvasGlobal]
      const texture = window[textureGlobal]
      if (!canvas || !texture) return

      // 30fps throttle — enough for a convincing reel scroll, half the GPU
      // uploads of a 60fps RAF.
      if (ts - lastFrameTime < FRAME_INTERVAL) return
      lastFrameTime = ts

      // Advance reel state using wall-clock time (independent of throttle).
      const now = performance.now()
      for (let i = 0; i < REEL_COUNT; i++) {
        if (state.spinning[i]) {
          const elapsed = now - state.startTimes[i]
          if (elapsed < 0) continue
          const t = Math.min(1, elapsed / state.durations[i])
          const eased = easeReel(t)
          state.positions[i] =
            state.startPositions[i] +
            (state.targets[i] - state.startPositions[i]) * eased
          if (t >= 1) {
            state.positions[i] = state.targets[i] % SPRITE_H
            state.spinning[i] = false
          }
        }
      }

      const anySpinning = state.spinning.some(s => s)

      // Once all reels have settled, queue the next spin
      if (!anySpinning && !state.nextScheduled) {
        state.nextScheduled = true
        nextSpinRef.current = setTimeout(startSpin, REST_BETWEEN_SPINS)
      }

      // Skip repaint entirely while at rest. We still paint one "final" frame
      // after reels stop so the resting pose is shown, then go quiet until
      // the next spin flips anySpinning back to true.
      if (!anySpinning && !prevAnySpinning && !needsInitialDraw) return
      prevAnySpinning = anySpinning
      needsInitialDraw = false

      const ctx = canvas.getContext('2d')
      const W = canvas.width
      const H = canvas.height

      // Machine body — brushed metal gradient
      const bodyGrad = ctx.createLinearGradient(0, 0, W, H)
      bodyGrad.addColorStop(0, '#9a9a9a')
      bodyGrad.addColorStop(0.5, '#d4d4d4')
      bodyGrad.addColorStop(1, '#8f8f8f')
      ctx.fillStyle = bodyGrad
      ctx.fillRect(0, 0, W, H)

      // Inner bezel
      const pad = 18
      ctx.fillStyle = 'rgba(0,0,0,0.25)'
      ctx.fillRect(pad, pad, W - pad * 2, H - pad * 2)
      ctx.fillStyle = '#2a2a2a'
      ctx.fillRect(pad + 2, pad + 2, W - pad * 2 - 4, H - pad * 2 - 4)

      // Reel geometry — three reels centered horizontally, full inner height
      const reelH = H - pad * 2 - 16
      const reelW = 100
      const gap = 14
      const totalW = REEL_COUNT * reelW + (REEL_COUNT - 1) * gap
      const startX = (W - totalW) / 2
      const startY = (H - reelH) / 2

      // Draw each reel
      const scale = reelW / ICON_SIZE
      const scaledSpriteH = SPRITE_H * scale

      for (let i = 0; i < REEL_COUNT; i++) {
        const x = startX + i * (reelW + gap)

        // Reel backing
        ctx.fillStyle = '#fafafa'
        ctx.fillRect(x, startY, reelW, reelH)

        if (img.complete && img.naturalWidth > 0) {
          ctx.save()
          ctx.beginPath()
          ctx.rect(x, startY, reelW, reelH)
          ctx.clip()

          // Wrap the vertical offset into [0, scaledSpriteH) so we can
          // anchor one copy of the sprite and tile upward/downward from it.
          const wrapped = ((state.positions[i] * scale) % scaledSpriteH + scaledSpriteH) % scaledSpriteH
          const anchorY = startY + wrapped

          // Tile the sprite upward until we cover the top of the reel
          for (let y = anchorY; y > startY - scaledSpriteH; y -= scaledSpriteH) {
            ctx.drawImage(img, 0, 0, ICON_SIZE, SPRITE_H, x, y - scaledSpriteH, reelW, scaledSpriteH)
          }
          // And downward until we cover the bottom
          for (let y = anchorY; y < startY + reelH; y += scaledSpriteH) {
            ctx.drawImage(img, 0, 0, ICON_SIZE, SPRITE_H, x, y, reelW, scaledSpriteH)
          }

          ctx.restore()
        }

        // Top/bottom shadow inside each reel for depth
        const innerShadow = ctx.createLinearGradient(0, startY, 0, startY + reelH)
        innerShadow.addColorStop(0, 'rgba(0,0,0,0.45)')
        innerShadow.addColorStop(0.25, 'rgba(0,0,0,0)')
        innerShadow.addColorStop(0.75, 'rgba(0,0,0,0)')
        innerShadow.addColorStop(1, 'rgba(0,0,0,0.45)')
        ctx.fillStyle = innerShadow
        ctx.fillRect(x, startY, reelW, reelH)

        // Reel border
        ctx.strokeStyle = 'rgba(0,0,0,0.6)'
        ctx.lineWidth = 1
        ctx.strokeRect(x + 0.5, startY + 0.5, reelW - 1, reelH - 1)
      }

      // Subtle payline across the middle
      const lineY = startY + reelH / 2
      ctx.strokeStyle = 'rgba(220, 50, 50, 0.55)'
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.moveTo(startX - 6, lineY)
      ctx.lineTo(startX + totalW + 6, lineY)
      ctx.stroke()

      texture.needsUpdate = true
    }

    rafRef.current = requestAnimationFrame(draw)

    return () => {
      cancelAnimationFrame(rafRef.current)
      if (kickoffRef.current) clearTimeout(kickoffRef.current)
      if (nextSpinRef.current) clearTimeout(nextSpinRef.current)
    }
  }, [canvasGlobal, textureGlobal])

  return null
}

export default SlotMachineScreen
