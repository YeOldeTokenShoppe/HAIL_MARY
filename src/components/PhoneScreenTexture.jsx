import React, { useRef, useEffect, useMemo, useState } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { db, collection, query, orderBy, limit, onSnapshot } from '@/lib/firebaseClient'

// Component that renders the phone feed as a texture on the mesh
export function PhoneScreenTexture({ 
  meshRef, 
  offerings = [], 
  hoveredOffering = null, 
  justLitOffering = null,
  hasActiveClick = false,
  user = null, // Clerk user object
  onManualBrowse = null, // Callback when user manually browses
  showPolaroid = false // New prop to control polaroid display
}) {
  const canvasRef = useRef(document.createElement('canvas'))
  const textureRef = useRef()
  const materialRef = useRef()
  const frameCount = useRef(0)
  const currentOfferingIndex = useRef(0)
  const lastUpdateTime = useRef(Date.now())
  const lastInteractionTime = useRef(0) // Track when user last interacted
  const prayerReceivedStartTime = useRef(0) // Track when Prayer Received animation started
  const PRAYER_RECEIVED_DURATION = 1500 // Show Prayer Received for 1.5 seconds
  const [manualBrowsing, setManualBrowsing] = useState(false)
  const [manualIndex, setManualIndex] = useState(0)
  const manualBrowsingRef = useRef(false) // Track browsing state in ref too
  const [latestPolaroid, setLatestPolaroid] = useState(null)
  const polaroidImageRef = useRef(null)
  const polaroidLoadedRef = useRef(false)
  const [allPolaroids, setAllPolaroids] = useState([]) // Store all polaroids for cycling
  const polaroidIndexRef = useRef(0) // Track current polaroid index
  const lastPolaroidUpdateRef = useRef(Date.now()) // Track when we last cycled polaroids
  const userAvatarRef = useRef(null) // Store current user avatar image
  const userAvatarLoadedRef = useRef(false) // Track if avatar is loaded
  
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
  
  // Helper to load and cache user avatar image
  const avatarImageRef = useRef(null)
  const avatarLoadedRef = useRef(false)
  
  useEffect(() => {
    if (user?.imageUrl && !avatarLoadedRef.current) {
      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.onload = () => {
        avatarImageRef.current = img
        avatarLoadedRef.current = true
      }
      img.onerror = () => {
        avatarLoadedRef.current = true // Mark as loaded even on error
      }
      img.src = user.imageUrl
    }
  }, [user?.imageUrl])
  
  // Subscribe to recent offerings and load their images
  useEffect(() => {
    // Always load offerings to show them with images
    // Query for recent offerings
    const offeringsRef = collection(db, 'offerings');
    const q = query(offeringsRef, orderBy('createdAt', 'desc'), limit(20)); // Get last 20 offerings
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const polaroidsWithData = [];
      
      snapshot.forEach((doc) => {
        const data = doc.data();
        
        // Check for either customImage (base64) or polaroidUrl (Storage URL)
        const imageData = data.customImage || data.polaroidUrl;
        
        if (imageData) {
          polaroidsWithData.push({
            id: doc.id,
            imageUrl: imageData, // Can be either base64 or URL
            message: data.message || '',
            username: data.name || data.recipientName || 'Anonymous',
            userImageUrl: data.userImageUrl || null, // Add user avatar
            burnedAmount: data.tokensBurned || 1,
            type: data.type || 'petition',
            createdAt: data.createdAt,
            prayerFor: data.prayerFor || 'self',
            recipientName: data.recipientName || data.name || 'Someone'
          });

        } else if (data.message) {
          // Include offerings with messages even if no image
          polaroidsWithData.push({
            id: doc.id,
            imageUrl: null,
            message: data.message || '',
            username: data.name || data.recipientName || 'Anonymous',
            userImageUrl: data.userImageUrl || null, // Add user avatar
            burnedAmount: data.tokensBurned || 1,
            type: data.type || 'petition',
            createdAt: data.createdAt,
            prayerFor: data.prayerFor || 'self',
            recipientName: data.recipientName || data.name || 'Someone'
          });
        }
      });
      
      setAllPolaroids(polaroidsWithData);
      
      // Set the first one as current
      if (polaroidsWithData.length > 0) {
        setLatestPolaroid(polaroidsWithData[0]);
        polaroidIndexRef.current = 0;
      }
    });
    
    return () => unsubscribe();
  }, []) // Always run this effect
  
  // Load current polaroid image
  useEffect(() => {
    
    if (latestPolaroid?.imageUrl) {
      const isBase64 = latestPolaroid.imageUrl.startsWith('data:');
      const imagePreview = latestPolaroid.imageUrl.substring(0, 100) + '...';

      
      polaroidLoadedRef.current = false; // Reset loading state
      polaroidImageRef.current = null; // Clear previous image
      
      const img = new Image();
      
      // Only set crossOrigin for URLs, not base64
      if (!isBase64) {
        img.crossOrigin = 'anonymous';
      }
      
      img.onload = () => {
        polaroidImageRef.current = img;
        polaroidLoadedRef.current = true;

      };
      
      img.onerror = (error) => {
        console.error('[PhoneScreen] ❌ FAILED to load image:', {
          error,
          username: latestPolaroid.username,
          imageUrl: latestPolaroid.imageUrl.substring(0, 100) + '...'
        });
        polaroidLoadedRef.current = false;
        polaroidImageRef.current = null;
      };
      
      // Set the source (works for both base64 and URLs)
      try {
        img.src = latestPolaroid.imageUrl;
      } catch (e) {
        console.error('[PhoneScreen] Error setting image src:', e);
      }
    } else if (latestPolaroid) {
      console.warn('[PhoneScreen] ⚠️ Polaroid data missing imageUrl:', latestPolaroid);
      polaroidLoadedRef.current = false;
      polaroidImageRef.current = null;
    } else {
    }
  }, [latestPolaroid])
  
  // Load user avatar image
  useEffect(() => {
    if (latestPolaroid?.userImageUrl) {
      userAvatarLoadedRef.current = false;
      
      const avatarImg = new Image();
      avatarImg.crossOrigin = 'anonymous';
      
      avatarImg.onload = () => {
        userAvatarRef.current = avatarImg;
        userAvatarLoadedRef.current = true;
      };
      
      avatarImg.onerror = () => {
        console.error('[PhoneScreen] Failed to load user avatar');
        userAvatarLoadedRef.current = false;
        userAvatarRef.current = null;
      };
      
      avatarImg.src = latestPolaroid.userImageUrl;
    } else {
      userAvatarLoadedRef.current = false;
      userAvatarRef.current = null;
    }
  }, [latestPolaroid?.userImageUrl])
  
  // Helper to load custom images from offerings
  const customImagesRef = useRef({})
  
  useEffect(() => {
    offerings.forEach(offering => {
      if (offering.customImage && !customImagesRef.current[offering.id]) {
        const img = new Image()
        img.crossOrigin = 'anonymous'
        img.onload = () => {
          customImagesRef.current[offering.id] = img
        }
        img.src = offering.customImage
      }
    })
  }, [offerings])
  
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
    ctx.fillText("Our Lady's Inbox", 50, 230)
    
    // Show prayer type badge instead of status
    if (latestPolaroid) {
      const typeConfig = {
        petition: { icon: '🙏', color: '#ffaa00', label: 'PETITION' },
        confession: { icon: '🖤', color: '#aa66ff', label: 'CONFESSION' },
        appreciation: { icon: '✨', color: '#00ff66', label: 'APPRECIATION' }
      }
      const config = typeConfig[latestPolaroid.type] || typeConfig.petition
      
      // Draw prayer type badge
      const badgeText = `${config.icon} ${config.label}`
      ctx.font = 'bold 36px -apple-system, BlinkMacSystemFont, sans-serif'
      
      // Measure text for badge background
      const metrics = ctx.measureText(badgeText)
      const badgeX = 50
      const badgeY = 270
      const padding = 20
      
      // Draw badge background
      ctx.fillStyle = config.color + '22' // Low opacity background
      ctx.strokeStyle = config.color
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.roundRect(badgeX, badgeY, metrics.width + padding * 2, 50, 10)
      ctx.fill()
      ctx.stroke()
      
      // Draw badge text
      ctx.fillStyle = config.color
      ctx.fillText(badgeText, badgeX + padding, badgeY + 35)
    } else if (hasActiveClick) {
      // Fallback when no polaroid
      ctx.fillStyle = '#ff00ff'
      ctx.font = '38px -apple-system, BlinkMacSystemFont, sans-serif'
      ctx.fillText('● Candle Selected', 50, 300)
    }
    
    // Determine what to show
    // Show polaroid display when we have data and showPolaroid is true
    if (showPolaroid && latestPolaroid) {
      // Show the polaroid-style display (with or without image)
      drawPolaroid(ctx, width, height)
    } else if (latestPolaroid && !hoveredOffering && !justLitOffering) {
      // Also show polaroid when not hovering/just lit (fallback)
      drawPolaroid(ctx, width, height)
    } else {
      // console.log('[PhoneScreen] Not drawing polaroid:', {
      //   showPolaroid,
      //   hasLatestPolaroid: !!latestPolaroid,
      //   hoveredOffering: !!hoveredOffering,
      //   justLitOffering: !!justLitOffering
      // });
      // Show specific offering when hovered or just lit
      let displayOffering = null
      if (justLitOffering) {
        displayOffering = justLitOffering
        const now = Date.now()
        
        // Check if we're in the Prayer Received phase or showing user info
        if (now - prayerReceivedStartTime.current < PRAYER_RECEIVED_DURATION) {
          // First phase: Show Prayer Received screen
          drawPrayerReceivedOnly(ctx, width, height)
        } else {
          // Second phase: Show user's offering details
          drawOffering(ctx, displayOffering, width, height, true)
        }
      } else if (hoveredOffering) {
        displayOffering = hoveredOffering
        drawOffering(ctx, displayOffering, width, height, true)
      } else if (offerings.length > 0) {
        // Use manual index if manually browsing, otherwise auto-rotate
        const index = manualBrowsing ? manualIndex : currentOfferingIndex.current
        displayOffering = offerings[Math.min(index, offerings.length - 1)]
        drawOffering(ctx, displayOffering, width, height, false)
        
        // Show browse indicator when manually browsing
        if (manualBrowsing) {
          ctx.fillStyle = 'rgba(0, 255, 102, 0.8)'
          ctx.font = '28px -apple-system, BlinkMacSystemFont, sans-serif'
          ctx.textAlign = 'center'
          ctx.fillText(`↑ Swipe to browse ↓`, width / 2, height - 40)
          ctx.fillText(`${index + 1} / ${offerings.length}`, width / 2, height - 80)
          ctx.textAlign = 'left'
        }
      }
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
  
  // Draw the latest polaroid from Firebase with message
  const drawPolaroid = (ctx, width, height) => {
    if (!latestPolaroid) {
      return;
    }
    
    if (!polaroidImageRef.current) {
      // Continue to draw the rest without the image
    }
    
    // Removed the title to have more space for content
    
    // Draw prayer type and recipient
    const typeConfig = {
      petition: { icon: '🙏', color: '#ffaa00' },
      confession: { icon: '🖤', color: '#aa66ff' },
      appreciation: { icon: '✨', color: '#00ff66' }
    }
    const config = typeConfig[latestPolaroid.type] || typeConfig.petition
    
    // Draw user avatar if available - EVEN BIGGER and LEFT ALIGNED
    if (userAvatarRef.current && userAvatarLoadedRef.current) {
      const avatarSize = 160; // Even bigger!
      const avatarX = 60; // Far left position
      const avatarY = 370; // Moved down by 20
      
      // Draw avatar circle with glow effect
      ctx.save();
      
      // Add subtle glow
      ctx.shadowColor = config.color;
      ctx.shadowBlur = 15;
      
      ctx.beginPath();
      ctx.arc(avatarX + avatarSize/2, avatarY + avatarSize/2, avatarSize/2, 0, Math.PI * 2);
      ctx.strokeStyle = config.color;
      ctx.lineWidth = 5;
      ctx.stroke();
      
      // Reset shadow for image
      ctx.shadowBlur = 0;
      ctx.clip();
      
      // Draw avatar image
      ctx.drawImage(userAvatarRef.current, avatarX, avatarY, avatarSize, avatarSize);
      ctx.restore();
      
      // Draw username next to avatar - MUCH BIGGER
      ctx.font = 'bold 72px -apple-system, BlinkMacSystemFont, sans-serif'
      ctx.fillStyle = '#ffffff'
      ctx.textAlign = 'left'
      ctx.fillText(latestPolaroid.username, avatarX + avatarSize + 30, avatarY + avatarSize/2 + 15)
      ctx.textAlign = 'center'
    } else {
      // No avatar - just show larger username on the left
      ctx.font = 'bold 72px -apple-system, BlinkMacSystemFont, sans-serif'
      ctx.fillStyle = '#ffffff'
      ctx.textAlign = 'left'
      ctx.fillText(latestPolaroid.username, 60, 370) // Moved down by 20
      ctx.textAlign = 'center'
    }
    
    // Removed prayer type line to simplify the display
    
    // Only draw image if it's loaded
    let imageBottomY = 540; // Moved down by 20
    
    if (polaroidImageRef.current && polaroidLoadedRef.current) {
      const img = polaroidImageRef.current
      const maxWidth = width - 80  // Use more width
      const maxHeight = 600 // More height available now
      
      // Calculate scaling to fit - allow up to 90% scale for bigger display
      const scale = Math.min(maxWidth / img.width, maxHeight / img.height, 0.9)
      const scaledWidth = img.width * scale
      const scaledHeight = img.height * scale
      
      // Center the image
      const imgX = (width - scaledWidth) / 2
      const imgY = 540 // Moved down by 20
      
      // Draw shadow
      ctx.shadowColor = 'rgba(0, 0, 0, 0.5)'
      ctx.shadowBlur = 20
      ctx.shadowOffsetX = 0
      ctx.shadowOffsetY = 10
      
      // Draw the polaroid image
      try {
        ctx.drawImage(img, imgX, imgY, scaledWidth, scaledHeight)
        imageBottomY = imgY + scaledHeight; // Update bottom position
      } catch (e) {
        console.error('[PhoneScreen] ❌ Failed to draw image:', e);
      }
      
      // Reset shadow
      ctx.shadowBlur = 0
      ctx.shadowOffsetX = 0
      ctx.shadowOffsetY = 0
    } else {
      // // Show placeholder or loading text
      // ctx.fillStyle = 'rgba(255, 255, 255, 0.3)'
      // ctx.font = 'italic 36px -apple-system, BlinkMacSystemFont, sans-serif'
      // ctx.fillText('[Image Loading...]', width / 2, 600)
      // console.log('[PhoneScreen] ⏳ Image not ready - showing placeholder', {
      //   hasPolaroidRef: !!polaroidImageRef.current,
      //   isLoaded: polaroidLoadedRef.current
      // });
    }
    
    // Draw message below the image - bigger text
    if (latestPolaroid.message) {
      ctx.fillStyle = '#ffffff'
      ctx.font = '60px -apple-system, BlinkMacSystemFont, sans-serif'
      
      // Word wrap the message
      const words = latestPolaroid.message.split(' ')
      let line = ''
      let lineY = imageBottomY + 100
      const maxTextWidth = width - 80
      const lineHeight = 60
      let linesDrawn = 0
      const maxLines = 5
      
      for (let word of words) {
        const testLine = line + word + ' '
        const metrics = ctx.measureText(testLine)
        if (metrics.width > maxTextWidth && line.length > 0) {
          ctx.fillText(line.trim(), width / 2, lineY)
          line = word + ' '
          lineY += lineHeight
          linesDrawn++
          if (linesDrawn >= maxLines) {
            // Add ellipsis if text is cut off
            ctx.fillText('...', width / 2, lineY)
            break
          }
        } else {
          line = testLine
        }
      }
      if (line.length > 0 && linesDrawn < maxLines) {
        ctx.fillText(line.trim(), width / 2, lineY)
        lineY += lineHeight
      }
      
      // Draw burned amount below message
      ctx.fillStyle = '#ffaa00'
      ctx.font = 'bold 52px -apple-system, BlinkMacSystemFont, sans-serif'
      ctx.fillText(`🔥 ${latestPolaroid.burnedAmount || '1'} RL80 burned`, width / 2, lineY + 100)
    } else {
      // No message, just show burned amount
      ctx.fillStyle = '#ffaa00'
      ctx.font = 'bold 52px -apple-system, BlinkMacSystemFont, sans-serif'
      ctx.fillText(`🔥 ${latestPolaroid.burnedAmount || '1'} RL80 burned`, width / 2, imageBottomY + 120)
    }
    
    // Add navigation hint if multiple polaroids
    if (allPolaroids.length > 1) {
      ctx.fillStyle = 'rgba(0, 255, 102, 0.6)'
      ctx.font = '28px -apple-system, BlinkMacSystemFont, sans-serif'
      ctx.fillText('Auto-cycling every 5s', width / 2, height - 40)
    }
    
    ctx.textAlign = 'left'
  }
  
  // Helper function to get relative time
  const getTimeAgo = (date) => {
    const seconds = Math.floor((new Date() - date) / 1000)
    if (seconds < 60) return 'Just now'
    const minutes = Math.floor(seconds / 60)
    if (minutes < 60) return `${minutes}m ago`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours}h ago`
    const days = Math.floor(hours / 24)
    return `${days}d ago`
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
    
    // Draw user avatar if available (on the far left)
    const avatarSize = 120
    const avatarX = padding + 40  // Far left position
    const avatarY = y + 50
    
    // Draw avatar circle background
    ctx.save()
    ctx.beginPath()
    ctx.arc(avatarX + avatarSize/2, avatarY + avatarSize/2, avatarSize/2, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.1)'
    ctx.fill()
    ctx.strokeStyle = config.color
    ctx.lineWidth = 2
    ctx.stroke()
    ctx.clip()
    
    // Draw avatar image or initials
    if (avatarImageRef.current) {
      // Draw the loaded avatar image
      ctx.drawImage(avatarImageRef.current, avatarX, avatarY, avatarSize, avatarSize)
    } else if (user) {
      // Draw initials as fallback
      ctx.fillStyle = config.color
      ctx.fillRect(avatarX, avatarY, avatarSize, avatarSize)
      ctx.fillStyle = '#000'
      ctx.font = 'bold 48px -apple-system, BlinkMacSystemFont, sans-serif'  // Doubled from 24px
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      const initials = (user.firstName?.[0] || '') + (user.lastName?.[0] || '') || user.username?.[0] || '?'
      ctx.fillText(initials.toUpperCase(), avatarX + avatarSize/2, avatarY + avatarSize/2)
      ctx.textAlign = 'left'
      ctx.textBaseline = 'alphabetic'
    }
    ctx.restore()
    
    // Username text to the right of avatar
    ctx.fillStyle = '#fff'
    ctx.font = 'bold 64px -apple-system, BlinkMacSystemFont, sans-serif'
    ctx.fillText(offering.name || 'Anonymous', avatarX + avatarSize + 30, y + 140)
    
    // Add a colored accent pill/badge on the right side
    const pillY = y + 110
    const pillHeight = 50
    const pillWidth = 220
    const pillX = width - padding - pillWidth - 40  // Position on right side
    
    roundedRect(pillX, pillY, pillWidth, pillHeight, 25)
    const pillGradient = ctx.createLinearGradient(0, pillY, 0, pillY + pillHeight)
    pillGradient.addColorStop(0, config.color)
    pillGradient.addColorStop(1, config.color + '99')  // Add transparency
    ctx.fillStyle = pillGradient
    ctx.fill()
    
    // Type label and icon inside pill (on right)
    ctx.fillStyle = '#000'
    ctx.font = 'bold 28px -apple-system, BlinkMacSystemFont, sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText(`${config.icon} ${config.label}`, pillX + pillWidth/2, pillY + 34)
    ctx.textAlign = 'left'
    
    // Draw message if exists - much larger and more prominent
    if (offering.message) {
      ctx.fillStyle = '#ffffff'  // Brighter white for better visibility
      ctx.font = '52px -apple-system, BlinkMacSystemFont, sans-serif'  // Much larger font
      
      // Word wrap the message - below the avatar and name
      const words = offering.message.split(' ')
      let line = ''
      let lineY = y + 340  // Pushed lower (was 240)
      const messageLeftOffset = padding + 130  // Indent message text
      const maxWidth = width - messageLeftOffset - padding * 2  // Adjust max width accordingly
      const lineHeight = 80  // Increased line spacing for larger text
      
      // Message text
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
      
      // Draw custom image if available
      if (offering.customImage && customImagesRef.current[offering.id]) {
        const customImg = customImagesRef.current[offering.id]
        const imgWidth = 400
        const imgHeight = 300
        const imgX = width / 2 - imgWidth / 2
        const imgY = lineY + 40
        
        // Draw rounded border for image
        ctx.save()
        roundedRect(imgX - 5, imgY - 5, imgWidth + 10, imgHeight + 10, 15)
        ctx.strokeStyle = config.accent
        ctx.lineWidth = 3
        ctx.stroke()
        
        // Clip and draw image
        roundedRect(imgX, imgY, imgWidth, imgHeight, 12)
        ctx.clip()
        ctx.drawImage(customImg, imgX, imgY, imgWidth, imgHeight)
        ctx.restore()
      }
    }
    
    // Draw tokens burned - larger and at the bottom
    ctx.fillStyle = '#ff6b35'
    ctx.font = 'bold 48px -apple-system, BlinkMacSystemFont, sans-serif'
    ctx.fillText(`🔥 ${offering.tokensBurned?.toLocaleString() || '???'} RL80`, padding + 40, y + boxHeight - 60)
  }
  
  // Draw prayer received notification ONLY (no user info)
  const drawPrayerReceivedOnly = (ctx, width, height) => {
    const centerX = width / 2
    const centerY = height / 2
    
    // Draw glowing circle - much larger
    const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, 300)
    gradient.addColorStop(0, 'rgba(0, 255, 102, 0.6)')
    gradient.addColorStop(0.5, 'rgba(0, 255, 102, 0.3)')
    gradient.addColorStop(1, 'rgba(0, 255, 102, 0)')
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, width, height)
    
    // Draw checkmark circle
    ctx.beginPath()
    ctx.arc(centerX, centerY - 100, 120, 0, Math.PI * 2)
    ctx.fillStyle = '#00ff66'
    ctx.fill()
    
    ctx.fillStyle = '#000'
    ctx.font = 'bold 140px -apple-system, BlinkMacSystemFont, sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('✓', centerX, centerY - 50)
    
    // Draw text
    ctx.fillStyle = '#00ff66'
    ctx.font = 'bold 64px -apple-system, BlinkMacSystemFont, sans-serif'
    ctx.fillText('PRAYER RECEIVED', centerX, centerY + 120)
    
    ctx.fillStyle = '#fff'
    ctx.font = '48px -apple-system, BlinkMacSystemFont, sans-serif'
    ctx.fillText('Our Lady has heard you', centerX, centerY + 200)
    
    ctx.textAlign = 'left'
  }
  
  // Draw prayer received notification with user info (DEPRECATED - keeping for reference)
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
    
    // Draw checkmark circle - smaller and higher up
    ctx.beginPath()
    ctx.arc(centerX, centerY - 200, 100, 0, Math.PI * 2)
    ctx.fillStyle = '#00ff66'
    ctx.fill()
    
    ctx.fillStyle = '#000'
    ctx.font = 'bold 120px -apple-system, BlinkMacSystemFont, sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('✓', centerX, centerY - 160)
    
    // Draw text - much larger
    ctx.fillStyle = '#00ff66'
    ctx.font = 'bold 64px -apple-system, BlinkMacSystemFont, sans-serif'
    ctx.fillText('PRAYER RECEIVED', centerX, centerY - 50)
    
    // Show user's name prominently
    if (offering && offering.name) {
      ctx.fillStyle = '#fff'
      ctx.font = 'bold 56px -apple-system, BlinkMacSystemFont, sans-serif'
      ctx.fillText(`From: ${offering.name}`, centerX, centerY + 40)
    }
    
    // Show the user's message
    if (offering && offering.message) {
      ctx.fillStyle = '#ffffff'
      ctx.font = '44px -apple-system, BlinkMacSystemFont, sans-serif'
      
      // Word wrap the message
      const words = offering.message.split(' ')
      let line = ''
      let lineY = centerY + 120
      const maxWidth = width - 160
      const lineHeight = 60
      let maxLines = 4 // Limit to 4 lines
      let linesDrawn = 0
      
      for (let word of words) {
        const testLine = line + word + ' '
        const metrics = ctx.measureText(testLine)
        if (metrics.width > maxWidth && line.length > 0) {
          ctx.fillText(line.trim(), centerX, lineY)
          line = word + ' '
          lineY += lineHeight
          linesDrawn++
          if (linesDrawn >= maxLines) break
        } else {
          line = testLine
        }
      }
      if (line.length > 0 && linesDrawn < maxLines) {
        ctx.fillText(line.trim(), centerX, lineY)
      }
    }
    
    // Show tokens at the bottom
    if (offering && offering.tokensBurned) {
      ctx.fillStyle = '#ff6b35'
      ctx.font = 'bold 40px -apple-system, BlinkMacSystemFont, sans-serif'
      ctx.fillText(`🔥 ${offering.tokensBurned.toLocaleString()} RL80 sacrificed`, centerX, centerY + 380)
    }
    
    ctx.textAlign = 'left'
  }
  
  // Track when offerings change
  useEffect(() => {
    if (hoveredOffering) {
      lastInteractionTime.current = Date.now()
    }
  }, [hoveredOffering])
  
  // Track when justLitOffering changes to start the Prayer Received animation
  useEffect(() => {
    if (justLitOffering) {
      prayerReceivedStartTime.current = Date.now()
    }
  }, [justLitOffering])
  
  // Handle manual browsing
  useEffect(() => {
    if (manualBrowsing) {
      lastInteractionTime.current = Date.now()
      
      // Exit manual browsing after 10 seconds of inactivity
      const timeout = setTimeout(() => {
        setManualBrowsing(false)
        setManualIndex(currentOfferingIndex.current)
      }, 10000)
      
      return () => clearTimeout(timeout)
    }
  }, [manualBrowsing, manualIndex])
  
  // Sync ref with state
  useEffect(() => {
    manualBrowsingRef.current = manualBrowsing;
  }, [manualBrowsing]);
  
  // Expose swipe handlers via callback
  useEffect(() => {
    if (onManualBrowse) {
      onManualBrowse({
        startBrowsing: () => {
          // Only set index on first start, not on every arrow press
          if (!manualBrowsingRef.current) {
            setManualBrowsing(true)
            setManualIndex(currentOfferingIndex.current)
          }
        },
        swipeUp: () => {
          if (offerings.length > 0) {
            setManualIndex(prev => {
              const newIndex = (prev - 1 + offerings.length) % offerings.length;
              return newIndex;
            })
            lastInteractionTime.current = Date.now()
          }
        },
        swipeDown: () => {
          if (offerings.length > 0) {
            setManualIndex(prev => {
              const newIndex = (prev + 1) % offerings.length;
              return newIndex;
            })
            lastInteractionTime.current = Date.now()
          }
        },
        stopBrowsing: () => setManualBrowsing(false)
      })
    }
  }, [onManualBrowse, offerings.length])
  
  // Update canvas every frame
  useFrame(() => {
    frameCount.current++
    const now = Date.now()
    
    // Update every 10 frames or when offerings change
    if (frameCount.current % 10 === 0 || hoveredOffering || justLitOffering || showPolaroid) {
      drawPhoneInterface()
    }
    
    // Auto-cycle through polaroids when not showing a specific offering
    if (!hoveredOffering && !justLitOffering && allPolaroids.length > 1) {
      // Cycle every 5 seconds
      if (now - lastPolaroidUpdateRef.current > 5000) {
        polaroidIndexRef.current = (polaroidIndexRef.current + 1) % allPolaroids.length
        const nextPolaroid = allPolaroids[polaroidIndexRef.current]
        setLatestPolaroid(nextPolaroid)
        lastPolaroidUpdateRef.current = now
      }
    }
    
    // Removed old auto-rotation logic - now using polaroid cycling above
  })
  
  return null
}