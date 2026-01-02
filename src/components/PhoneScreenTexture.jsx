import React, { useRef, useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'

// Component that renders the phone feed as a texture on the mesh
export function PhoneScreenTexture({ 
  meshRef, 
  offerings = [], 
  hoveredOffering = null, 
  justLitOffering = null,
  hasActiveClick = false 
}) {
  const canvasRef = useRef(document.createElement('canvas'))
  const textureRef = useRef()
  const materialRef = useRef()
  const frameCount = useRef(0)
  const currentOfferingIndex = useRef(0)
  const lastUpdateTime = useRef(Date.now())
  const lastInteractionTime = useRef(0) // Track when user last interacted
  
  // Initialize canvas
  useEffect(() => {
    const canvas = canvasRef.current
    canvas.width = 1024  // Higher resolution for sharper text
    canvas.height = 2048
    
    // Create texture from canvas
    const texture = new THREE.CanvasTexture(canvas)
    texture.needsUpdate = true
    texture.flipY = true  // Flip the texture vertically
    texture.minFilter = THREE.LinearFilter  // Sharper filtering
    texture.magFilter = THREE.LinearFilter
    texture.generateMipmaps = false  // Disable mipmaps for sharper text
    textureRef.current = texture
    
    // Create material with the texture
    const material = new THREE.MeshBasicMaterial({
      map: texture,
      side: THREE.FrontSide,
      transparent: false,  // No transparency for better contrast
      toneMapped: false,  // Disable tone mapping for true colors
    })
    materialRef.current = material
    
    // Apply material to the phone screen mesh
    if (meshRef && materialRef.current) {
      meshRef.material = materialRef.current
    }
    
    return () => {
      texture.dispose()
      material.dispose()
    }
  }, [meshRef])
  
  // Draw the phone interface
  const drawPhoneInterface = () => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    const width = canvas.width
    const height = canvas.height
    
    // Save context state and flip horizontally
    ctx.save()
    ctx.scale(-1, 1)  // Flip horizontally
    ctx.translate(-width, 0)  // Adjust translation after flip
    
    // Clear canvas with phone background - purple when active click, dark blue otherwise
    const gradient = ctx.createLinearGradient(0, 0, 0, height)
    if (hasActiveClick) {
      // Purple gradient when candle is clicked
      gradient.addColorStop(0, '#2a0a3a')  // Dark purple top
      gradient.addColorStop(0.5, '#3a0a4a')  // Mid purple
      gradient.addColorStop(1, '#1a0525')  // Deep purple bottom
    } else {
      // Normal dark blue gradient
      gradient.addColorStop(0, '#0a0a14')  // Darker gradient
      gradient.addColorStop(0.5, '#06081a')
      gradient.addColorStop(1, '#000005')
    }
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, width, height)
    
    // Draw status bar (larger fonts for better readability)
    ctx.fillStyle = '#aaa'
    ctx.font = '36px -apple-system, BlinkMacSystemFont, sans-serif'
    ctx.fillText('9:41', 50, 80)
    ctx.fillText('📶 🔋', width - 150, 80)
    
    // Draw app header
    ctx.fillStyle = '#fff'
    ctx.font = 'bold 48px -apple-system, BlinkMacSystemFont, sans-serif'
    ctx.fillText("🕯️ Our Lady's Inbox", 50, 200)
    
    // Status indicator - purple when active click
    ctx.fillStyle = hasActiveClick ? '#ff00ff' : '#00ff66'
    ctx.font = '32px -apple-system, BlinkMacSystemFont, sans-serif'
    const statusText = hasActiveClick ? '● Candle Selected' : '● Receiving prayers'
    ctx.fillText(statusText, 50, 260)
    
    // Determine which offering to show
    let displayOffering = null
    if (justLitOffering) {
      displayOffering = justLitOffering
      drawPrayerReceived(ctx, displayOffering, width, height)
    } else if (hoveredOffering) {
      displayOffering = hoveredOffering
      drawOffering(ctx, displayOffering, width, height, true)
    } else if (offerings.length > 0) {
      displayOffering = offerings[currentOfferingIndex.current]
      drawOffering(ctx, displayOffering, width, height, false)
    }
    
    // Update texture
    if (textureRef.current) {
      textureRef.current.needsUpdate = true
    }
    
    // Add purple glow border when active click
    if (hasActiveClick) {
      ctx.strokeStyle = '#ff00ff'
      ctx.lineWidth = 6
      ctx.shadowColor = '#ff00ff'
      ctx.shadowBlur = 20
      ctx.strokeRect(10, 10, width - 20, height - 20)
      ctx.shadowBlur = 0
    }
    
    // Restore context state
    ctx.restore()
  }
  
  // Draw offering notification (larger fonts)
  const drawOffering = (ctx, offering, width, height, isHovered) => {
    if (!offering) return
    
    const y = 320  // Move up to use more screen space
    const padding = 40  // Slightly less padding to maximize content area
    const boxHeight = 800  // Much larger box to fill the screen
    
    // Draw offering box with modern social media styling
    // Create a rounded rectangle function
    const roundedRect = (x, y, w, h, radius) => {
      ctx.beginPath()
      ctx.moveTo(x + radius, y)
      ctx.lineTo(x + w - radius, y)
      ctx.quadraticCurveTo(x + w, y, x + w, y + radius)
      ctx.lineTo(x + w, y + h - radius)
      ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h)
      ctx.lineTo(x + radius, y + h)
      ctx.quadraticCurveTo(x, y + h, x, y + h - radius)
      ctx.lineTo(x, y + radius)
      ctx.quadraticCurveTo(x, y, x + radius, y)
      ctx.closePath()
    }
    
    // Draw message bubble background with color based on type
    const bubbleColors = {
      petition: {
        bg: 'rgba(255, 170, 0, 0.15)',  // Orange tint
        border: 'rgba(255, 170, 0, 0.3)',
        accent: '#ffaa00'
      },
      confession: {
        bg: 'rgba(170, 102, 255, 0.15)',  // Purple tint
        border: 'rgba(170, 102, 255, 0.3)',
        accent: '#aa66ff'
      },
      appreciation: {
        bg: 'rgba(0, 255, 102, 0.15)',  // Green tint
        border: 'rgba(0, 255, 102, 0.3)',
        accent: '#00ff66'
      }
    }
    
    const colors = bubbleColors[offering.type] || bubbleColors.petition
    
    // Draw main message bubble with gradient
    const boxGradient = ctx.createLinearGradient(0, y, 0, y + boxHeight)
    if (isHovered) {
      boxGradient.addColorStop(0, colors.bg.replace('0.15', '0.25'))
      boxGradient.addColorStop(0.5, colors.bg)
      boxGradient.addColorStop(1, colors.bg.replace('0.15', '0.08'))
    } else {
      boxGradient.addColorStop(0, colors.bg)
      boxGradient.addColorStop(1, colors.bg.replace('0.15', '0.05'))
    }
    
    // Draw rounded rectangle for modern look
    roundedRect(padding, y, width - padding * 2, boxHeight, 20)
    ctx.fillStyle = boxGradient
    ctx.fill()
    
    // Add border with glow effect
    ctx.strokeStyle = isHovered ? colors.border.replace('0.3', '0.5') : colors.border
    ctx.lineWidth = isHovered ? 3 : 2
    ctx.stroke()
    
    // Add subtle inner shadow effect at top
    const shadowGradient = ctx.createLinearGradient(0, y, 0, y + 100)
    shadowGradient.addColorStop(0, 'rgba(0, 0, 0, 0.2)')
    shadowGradient.addColorStop(1, 'rgba(0, 0, 0, 0)')
    roundedRect(padding, y, width - padding * 2, 100, 20)
    ctx.fillStyle = shadowGradient
    ctx.fill()
    
    // Draw type icon and name (bigger and bolder)
    const typeConfig = {
      petition: { icon: '🙏', color: '#ffaa00', label: 'PETITION' },
      confession: { icon: '🖤', color: '#aa66ff', label: 'CONFESSION' },
      appreciation: { icon: '✨', color: '#00ff66', label: 'APPRECIATION' }
    }
    const config = typeConfig[offering.type] || typeConfig.petition
    
    // Add a colored accent pill/badge at the top
    const pillY = y + 30
    const pillHeight = 40
    const pillWidth = 180
    roundedRect(padding + 40, pillY, pillWidth, pillHeight, 20)
    const pillGradient = ctx.createLinearGradient(0, pillY, 0, pillY + pillHeight)
    pillGradient.addColorStop(0, config.color)
    pillGradient.addColorStop(1, config.color + '99')  // Add transparency
    ctx.fillStyle = pillGradient
    ctx.fill()
    
    // Type label inside pill
    ctx.fillStyle = '#000'
    ctx.font = 'bold 24px -apple-system, BlinkMacSystemFont, sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText(config.label, padding + 40 + pillWidth/2, pillY + 28)
    ctx.textAlign = 'left'
    
    // Larger name text
    ctx.fillStyle = '#fff'
    ctx.font = 'bold 64px -apple-system, BlinkMacSystemFont, sans-serif'
    ctx.fillText(config.icon, padding + 40, y + 120)
    ctx.fillText(offering.name || 'Anonymous', padding + 160, y + 120)
    
    // Draw message if exists - much larger and more prominent
    if (offering.message) {
      ctx.fillStyle = '#ffffff'  // Brighter white for better visibility
      ctx.font = '52px -apple-system, BlinkMacSystemFont, sans-serif'  // Much larger font
      
      // Word wrap the message - shifted right to avoid thumb
      const words = offering.message.split(' ')
      let line = ''
      let lineY = y + 240  // Adjusted for new layout with pill
      const messageLeftOffset = 200  // Shift text right to avoid thumb
      const maxWidth = width - messageLeftOffset - padding * 2  // Adjust max width accordingly
      const lineHeight = 80  // Increased line spacing for larger text
      
      // Add opening quote - positioned to the left but higher
      ctx.fillStyle = config.color
      ctx.font = 'bold 72px Georgia, serif'
      ctx.fillText('"', padding + 100, lineY - 60)
      
      // Message text - shifted right
      ctx.fillStyle = '#ffffff'
      ctx.font = '52px -apple-system, BlinkMacSystemFont, sans-serif'
      
      for (let word of words) {
        const testLine = line + word + ' '
        const metrics = ctx.measureText(testLine)
        if (metrics.width > maxWidth && line.length > 0) {
          ctx.fillText(line.trim(), messageLeftOffset, lineY)
          line = word + ' '
          lineY += lineHeight
          // Stop if we're running out of space
          if (lineY > y + boxHeight - 150) break
        } else {
          line = testLine
        }
      }
      if (line.length > 0 && lineY < y + boxHeight - 150) {
        ctx.fillText(line.trim(), messageLeftOffset, lineY)
      }
      
      // Add closing quote
      ctx.fillStyle = config.color
      ctx.font = 'bold 72px Georgia, serif'
      ctx.fillText('"', width - padding - 80, lineY + 40)
    }
    
    // Draw tokens burned - larger and at the bottom
    ctx.fillStyle = '#ff6b35'
    ctx.font = 'bold 48px -apple-system, BlinkMacSystemFont, sans-serif'
    ctx.fillText(`🔥 ${offering.tokensBurned?.toLocaleString() || '???'} RL80`, padding + 40, y + boxHeight - 60)
  }
  
  // Draw prayer received notification
  const drawPrayerReceived = (ctx, offering, width, height) => {
    const centerX = width / 2
    const centerY = height / 2
    
    // Draw glowing circle - much larger
    const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, 300)
    gradient.addColorStop(0, 'rgba(0, 255, 102, 0.6)')
    gradient.addColorStop(0.5, 'rgba(0, 255, 102, 0.3)')
    gradient.addColorStop(1, 'rgba(0, 255, 102, 0)')
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, width, height)
    
    // Draw checkmark circle - larger
    ctx.beginPath()
    ctx.arc(centerX, centerY - 100, 120, 0, Math.PI * 2)
    ctx.fillStyle = '#00ff66'
    ctx.fill()
    
    ctx.fillStyle = '#000'
    ctx.font = 'bold 140px -apple-system, BlinkMacSystemFont, sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('✓', centerX, centerY - 50)
    
    // Draw text - much larger
    ctx.fillStyle = '#00ff66'
    ctx.font = 'bold 64px -apple-system, BlinkMacSystemFont, sans-serif'
    ctx.fillText('PRAYER RECEIVED', centerX, centerY + 120)
    
    ctx.fillStyle = '#fff'
    ctx.font = '48px -apple-system, BlinkMacSystemFont, sans-serif'
    ctx.fillText('Our Lady has heard you', centerX, centerY + 200)
    
    if (offering && offering.tokensBurned) {
      ctx.fillStyle = '#00ff66'
      ctx.font = 'bold 40px -apple-system, BlinkMacSystemFont, sans-serif'
      ctx.fillText(`🔥 ${offering.tokensBurned.toLocaleString()} RL80 sacrificed`, centerX, centerY + 280)
    }
    
    ctx.textAlign = 'left'
  }
  
  // Track when hoveredOffering changes (user clicked a candle)
  useEffect(() => {
    if (hoveredOffering) {
      lastInteractionTime.current = Date.now()
      console.log('User clicked candle, showing:', hoveredOffering.name, hoveredOffering.message)
    }
  }, [hoveredOffering])
  
  // Update canvas every frame
  useFrame(() => {
    frameCount.current++
    const now = Date.now()
    
    // Update every 10 frames or when offerings change
    if (frameCount.current % 10 === 0 || hoveredOffering || justLitOffering) {
      drawPhoneInterface()
    }
    
    // Auto-rotate only after 8 seconds of no interaction (instead of 4 seconds always)
    const timeSinceInteraction = now - lastInteractionTime.current
    const autoRotateDelay = 8000 // Wait 8 seconds after user interaction before auto-rotating
    
    // Only cycle through offerings if:
    // 1. No hoveredOffering (user hasn't clicked)
    // 2. No justLitOffering (no recent candle lighting animation)
    // 3. Enough time has passed since last interaction
    // 4. There are multiple offerings to cycle through
    if (!hoveredOffering && !justLitOffering && offerings.length > 1) {
      if (timeSinceInteraction > autoRotateDelay && now - lastUpdateTime.current > 4000) {
        currentOfferingIndex.current = (currentOfferingIndex.current + 1) % offerings.length
        lastUpdateTime.current = now
        console.log('Auto-rotating to offering:', offerings[currentOfferingIndex.current].name)
      }
    }
  })
  
  return null
}