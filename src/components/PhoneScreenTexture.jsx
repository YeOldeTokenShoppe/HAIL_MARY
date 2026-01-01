import React, { useRef, useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'

// Component that renders the phone feed as a texture on the mesh
export function PhoneScreenTexture({ 
  meshRef, 
  offerings = [], 
  hoveredOffering = null, 
  justLitOffering = null 
}) {
  const canvasRef = useRef(document.createElement('canvas'))
  const textureRef = useRef()
  const materialRef = useRef()
  const frameCount = useRef(0)
  const currentOfferingIndex = useRef(0)
  const lastUpdateTime = useRef(Date.now())
  
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
    
    // Clear canvas with phone background - darker for better contrast
    const gradient = ctx.createLinearGradient(0, 0, 0, height)
    gradient.addColorStop(0, '#0a0a14')  // Darker gradient
    gradient.addColorStop(0.5, '#06081a')
    gradient.addColorStop(1, '#000005')
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
    
    ctx.fillStyle = '#00ff66'
    ctx.font = '32px -apple-system, BlinkMacSystemFont, sans-serif'
    ctx.fillText('● Receiving prayers', 50, 260)
    
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
    
    // Restore context state
    ctx.restore()
  }
  
  // Draw offering notification (larger fonts)
  const drawOffering = (ctx, offering, width, height, isHovered) => {
    if (!offering) return
    
    const y = 400  // Adjusted position for larger header
    const padding = 50
    const boxHeight = 500
    
    // Draw offering box
    ctx.fillStyle = isHovered ? 'rgba(0, 255, 102, 0.15)' : 'rgba(255, 255, 255, 0.05)'
    ctx.fillRect(padding, y, width - padding * 2, boxHeight)
    
    ctx.strokeStyle = isHovered ? 'rgba(0, 255, 102, 0.3)' : 'rgba(255, 255, 255, 0.1)'
    ctx.lineWidth = 3
    ctx.strokeRect(padding, y, width - padding * 2, boxHeight)
    
    // Draw type icon and name
    const typeConfig = {
      petition: { icon: '🙏', color: '#ffaa00' },
      confession: { icon: '🖤', color: '#aa66ff' },
      appreciation: { icon: '✨', color: '#00ff66' }
    }
    const config = typeConfig[offering.type] || typeConfig.petition
    
    ctx.fillStyle = '#fff'
    ctx.font = 'bold 48px -apple-system, BlinkMacSystemFont, sans-serif'
    ctx.fillText(config.icon, padding + 30, y + 80)
    ctx.fillText(offering.name || 'Anonymous', padding + 120, y + 80)
    
    // Draw type label
    ctx.fillStyle = config.color
    ctx.font = '32px -apple-system, BlinkMacSystemFont, sans-serif'
    ctx.fillText(config.label?.toUpperCase() || 'PETITION', padding + 120, y + 130)  // Moved down and right
    
    // Draw message if exists
    if (offering.message) {
      ctx.fillStyle = '#ccc'
      ctx.font = '36px -apple-system, BlinkMacSystemFont, sans-serif'
      
      // Word wrap the message
      const words = offering.message.split(' ')
      let line = ''
      let lineY = y + 220  // Start message a bit lower
      const maxWidth = width - padding * 3
      
      for (let word of words) {
        const testLine = line + word + ' '
        const metrics = ctx.measureText(testLine)
        if (metrics.width > maxWidth && line.length > 0) {
          ctx.fillText('"' + line.trim() + '"', padding + 30, lineY)
          line = word + ' '
          lineY += 60  // Increased line spacing from 50 to 60
        } else {
          line = testLine
        }
      }
      if (line.length > 0) {
        ctx.fillText('"' + line.trim() + '"', padding + 30, lineY)
      }
    }
    
    // Draw tokens burned
    ctx.fillStyle = '#ff6b35'
    ctx.font = '36px -apple-system, BlinkMacSystemFont, sans-serif'
    ctx.fillText(`🔥 ${offering.tokensBurned?.toLocaleString() || '???'} RL80`, padding + 30, y + boxHeight - 50)
  }
  
  // Draw prayer received notification
  const drawPrayerReceived = (ctx, offering, width, height) => {
    const centerX = width / 2
    const centerY = height / 2
    
    // Draw glowing circle
    const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, 150)
    gradient.addColorStop(0, 'rgba(0, 255, 102, 0.4)')
    gradient.addColorStop(1, 'rgba(0, 255, 102, 0)')
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, width, height)
    
    // Draw checkmark circle
    ctx.beginPath()
    ctx.arc(centerX, centerY - 50, 80, 0, Math.PI * 2)
    ctx.fillStyle = '#00ff66'
    ctx.fill()
    
    ctx.fillStyle = '#000'
    ctx.font = 'bold 80px -apple-system, BlinkMacSystemFont, sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('✓', centerX, centerY - 20)
    
    // Draw text
    ctx.fillStyle = '#00ff66'
    ctx.font = 'bold 36px -apple-system, BlinkMacSystemFont, sans-serif'
    ctx.fillText('PRAYER RECEIVED', centerX, centerY + 80)
    
    ctx.fillStyle = '#888'
    ctx.font = '28px -apple-system, BlinkMacSystemFont, sans-serif'
    ctx.fillText('Our Lady has heard you', centerX, centerY + 120)
    
    if (offering && offering.tokensBurned) {
      ctx.fillStyle = '#00ff66'
      ctx.font = '24px -apple-system, BlinkMacSystemFont, sans-serif'
      ctx.fillText(`🔥 ${offering.tokensBurned.toLocaleString()} RL80 sacrificed`, centerX, centerY + 180)
    }
    
    ctx.textAlign = 'left'
  }
  
  // Update canvas every frame
  useFrame(() => {
    frameCount.current++
    const now = Date.now()
    
    // Update every 10 frames or when offerings change
    if (frameCount.current % 10 === 0 || hoveredOffering || justLitOffering) {
      drawPhoneInterface()
    }
    
    // Cycle through offerings every 4 seconds
    if (!hoveredOffering && !justLitOffering && offerings.length > 1) {
      if (now - lastUpdateTime.current > 4000) {
        currentOfferingIndex.current = (currentOfferingIndex.current + 1) % offerings.length
        lastUpdateTime.current = now
      }
    }
  })
  
  return null
}