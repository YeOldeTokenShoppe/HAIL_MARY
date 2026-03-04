import { useEffect, useRef } from 'react'

// Button layout constants (canvas is 512x320)
const BTN_Y = 280
const BTN_H = 28
const BTN_R = 6
const PLAY_BTN = { x: 170, w: 80 }    // "Play" / "Stop"
const BACK_BTN = { x: 262, w: 80 }    // "Go Back"

const ReservedScreen = () => {
  const videoRef = useRef(null)
  const animFrameRef = useRef(null)
  const isPlayingRef = useRef(false)

  useEffect(() => {
    const drawButton = (ctx, x, y, w, h, label, active) => {
      ctx.fillStyle = active ? 'rgba(0, 255, 255, 0.2)' : 'rgba(255, 255, 255, 0.08)'
      ctx.beginPath()
      ctx.roundRect(x, y, w, h, BTN_R)
      ctx.fill()

      ctx.strokeStyle = active ? 'rgba(0, 255, 255, 0.6)' : 'rgba(255, 255, 255, 0.25)'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.roundRect(x, y, w, h, BTN_R)
      ctx.stroke()

      ctx.fillStyle = active ? 'rgba(0, 255, 255, 0.9)' : 'rgba(255, 255, 255, 0.6)'
      ctx.font = '13px monospace'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(label, x + w / 2, y + h / 2)
      ctx.textAlign = 'left'
      ctx.textBaseline = 'alphabetic'
    }

    const drawIdle = () => {
      const canvas = window['__screen3Canvas']
      const texture = window['__screen3Texture']
      if (!canvas || !texture) return

      const ctx = canvas.getContext('2d')
      const w = canvas.width
      const h = canvas.height

      ctx.fillStyle = '#000000'
      ctx.fillRect(0, 0, w, h)

      // Subtle radial glow
      const glow = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, 120)
      glow.addColorStop(0, 'rgba(0, 255, 255, 0.06)')
      glow.addColorStop(1, 'rgba(0, 0, 0, 0)')
      ctx.fillStyle = glow
      ctx.fillRect(0, 0, w, h)

      // Play triangle
      const cx = w / 2
      const cy = h / 2 - 20
      const r = 28
      ctx.beginPath()
      ctx.moveTo(cx - r * 0.4, cy - r * 0.5)
      ctx.lineTo(cx - r * 0.4, cy + r * 0.5)
      ctx.lineTo(cx + r * 0.5, cy)
      ctx.closePath()
      ctx.fillStyle = 'rgba(0, 255, 255, 0.7)'
      ctx.fill()

      ctx.beginPath()
      ctx.arc(cx, cy, r, 0, Math.PI * 2)
      ctx.strokeStyle = 'rgba(0, 255, 255, 0.4)'
      ctx.lineWidth = 2
      ctx.stroke()

      // Label
      ctx.fillStyle = 'rgba(0, 255, 255, 0.5)'
      ctx.font = '14px monospace'
      ctx.textAlign = 'center'
      ctx.fillText('Meet St. GR80', cx, cy + r + 24)
      ctx.textAlign = 'left'

      // Buttons
      drawButton(ctx, PLAY_BTN.x, BTN_Y, PLAY_BTN.w, BTN_H, 'Play', true)
      drawButton(ctx, BACK_BTN.x, BTN_Y, BACK_BTN.w, BTN_H, 'Go Back', false)

      texture.needsUpdate = true
    }

    const drawVideoFrame = () => {
      const canvas = window['__screen3Canvas']
      const texture = window['__screen3Texture']
      const video = videoRef.current
      if (!canvas || !texture || !video) return

      const ctx = canvas.getContext('2d')
      const w = canvas.width
      const h = canvas.height

      // Video area (leave room for buttons)
      const videoAreaH = BTN_Y - 8
      const vAspect = video.videoWidth / video.videoHeight
      const cAspect = w / videoAreaH
      let drawW, drawH
      if (vAspect > cAspect) {
        drawW = w
        drawH = w / vAspect
      } else {
        drawH = videoAreaH
        drawW = videoAreaH * vAspect
      }
      const drawX = (w - drawW) / 2
      const drawY = (videoAreaH - drawH) / 2

      ctx.fillStyle = '#000000'
      ctx.fillRect(0, 0, w, h)
      ctx.drawImage(video, drawX, drawY, drawW, drawH)

      // Buttons over video
      drawButton(ctx, PLAY_BTN.x, BTN_Y, PLAY_BTN.w, BTN_H, 'Stop', true)
      drawButton(ctx, BACK_BTN.x, BTN_Y, BACK_BTN.w, BTN_H, 'Go Back', false)

      texture.needsUpdate = true
      animFrameRef.current = requestAnimationFrame(drawVideoFrame)
    }

    const stopVideo = () => {
      isPlayingRef.current = false
      if (videoRef.current) {
        videoRef.current.pause()
        videoRef.current.currentTime = 0
      }
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current)
        animFrameRef.current = null
      }
      drawIdle()
    }

    const playVideo = () => {
      const video = videoRef.current
      if (!video) return
      video.currentTime = 0
      video.play().then(() => {
        isPlayingRef.current = true
        drawVideoFrame()
      }).catch(() => {
        video.muted = true
        video.play().then(() => {
          isPlayingRef.current = true
          drawVideoFrame()
        })
      })
    }

    // Create the video element once
    const video = document.createElement('video')
    video.playsInline = true
    video.muted = false
    video.loop = false
    video.preload = 'auto'
    video.src = '/videos/gr80_greetings.mp4'
    videoRef.current = video

    video.addEventListener('ended', stopVideo)
    video.addEventListener('error', () => {
      console.error('[ReservedScreen] Video error:', video.error?.code, video.error?.message)
    })

    // Handle clicks via UV coordinates
    const handleScreen3Click = (event) => {
      const { uv } = event.detail || {}
      if (!uv) {
        // No UV — legacy toggle behavior
        if (isPlayingRef.current) stopVideo()
        else playVideo()
        return
      }

      // Convert UV to canvas coordinates (512x320)
      const cx = uv.x * 512
      const cy = uv.y * 320

      // Check Play/Stop button
      if (cx >= PLAY_BTN.x && cx <= PLAY_BTN.x + PLAY_BTN.w &&
          cy >= BTN_Y && cy <= BTN_Y + BTN_H) {
        if (isPlayingRef.current) stopVideo()
        else playVideo()
        return
      }

      // Check Go Back button
      if (cx >= BACK_BTN.x && cx <= BACK_BTN.x + BACK_BTN.w &&
          cy >= BTN_Y && cy <= BTN_Y + BTN_H) {
        stopVideo()
        window.dispatchEvent(new CustomEvent('screenGoBack'))
        return
      }

      // Click elsewhere on screen — toggle play
      if (isPlayingRef.current) stopVideo()
      else playVideo()
    }

    // Draw idle state
    drawIdle()
    const intervalId = setInterval(() => {
      if (!isPlayingRef.current) drawIdle()
    }, 1000)

    window.addEventListener('screen3Click', handleScreen3Click)

    return () => {
      clearInterval(intervalId)
      window.removeEventListener('screen3Click', handleScreen3Click)
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current)
      }
      if (videoRef.current) {
        videoRef.current.removeEventListener('ended', stopVideo)
        videoRef.current.pause()
        videoRef.current.removeAttribute('src')
        videoRef.current.load()
        videoRef.current = null
      }
    }
  }, [])

  return null
}

export default ReservedScreen
