import React, { useRef, useEffect, useMemo, useState } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { db, collection, query, orderBy, limit, onSnapshot } from '@/lib/firebaseClient';

// Global tracker to prevent duplicate Prayer Received for the same offering
// Use WeakSet to allow garbage collection of old offerings
const shownPrayerForOfferings = new Map() // Use Map with timestamp cleanup

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
  // Add unique ID to track multiple instances
  const instanceId = useRef(Math.random().toString(36).substring(7));
  
  // Cleanup refs for proper disposal
  const imagesToCleanup = useRef([]);
  const listenersToCleanup = useRef([]);
  
  useEffect(() => {
    return () => {
      console.log(`[PhoneScreenTexture-${instanceId.current}] Component unmounting - cleaning up`);
      
      // Clean up image objects
      imagesToCleanup.current.forEach(img => {
        if (img && img.src) {
          img.onload = null;
          img.onerror = null;
          img.src = '';
        }
      });
      imagesToCleanup.current = [];
      
      // Clean up listeners
      listenersToCleanup.current.forEach(cleanup => {
        if (typeof cleanup === 'function') cleanup();
      });
      listenersToCleanup.current = [];
      
      // Clean up canvas context reference
      canvasContextRef.current = null;
      
      // Clear other refs
      polaroidImageRef.current = null;
      userAvatarRef.current = null;
      hoveredPolaroidImageRef.current = null;
      previousPolaroidImageRef.current = null;
      customImagesRef.current = {};
    };
  }, []);
  const canvasRef = useRef(document.createElement('canvas'))
  const textureRef = useRef()
  const materialRef = useRef()
  const frameCount = useRef(0)
  const currentOfferingIndex = useRef(0)
  const lastUpdateTime = useRef(Date.now())
  const lastInteractionTime = useRef(0) // Track when user last interacted
  const prayerReceivedStartTime = useRef(0) // Track when Prayer Received animation started
  const PRAYER_RECEIVED_DURATION = 3500 // Show Prayer Received for 3.5 seconds to let effects complete
  const [manualBrowsing, setManualBrowsing] = useState(false)
  const [manualIndex, setManualIndex] = useState(0)
  const manualBrowsingRef = useRef(false) // Track browsing state in ref too
  const [latestPolaroid, setLatestPolaroid] = useState(null)
  const polaroidImageRef = useRef(null)
  const polaroidLoadedRef = useRef(false)
  const polaroidReadyRef = useRef(false)
  
  // Separate state for hovered offering polaroid
  const [hoveredPolaroid, setHoveredPolaroid] = useState(null)
  const hoveredPolaroidImageRef = useRef(null)
  const hoveredPolaroidLoadedRef = useRef(false) // Track when image is ready to display
  const [allPolaroids, setAllPolaroids] = useState([]) // Store all polaroids for cycling
  const polaroidIndexRef = useRef(0) // Track current polaroid index
  const [isLoadingInitialData, setIsLoadingInitialData] = useState(true) // Track initial loading state
  
  // Transition animation state
  const [isTransitioning, setIsTransitioning] = useState(false)
  const transitionProgressRef = useRef(0)
  const transitionStartTimeRef = useRef(0)
  const previousPolaroidRef = useRef(null)
  const previousPolaroidImageRef = useRef(null)
  const lastPolaroidUpdateRef = useRef(Date.now()) // Track when we last cycled polaroids
  const userAvatarRef = useRef(null) // Store current user avatar image
  const userAvatarLoadedRef = useRef(false) // Track if avatar is loaded
  const [fadeInProgress, setFadeInProgress] = useState(0) // Track fade-in animation from loading to content
  const fadeInStartRef = useRef(0)
  
  // Initialize canvas
  useEffect(() => {
    const canvas = canvasRef.current
    // Balanced resolution for memory usage and visual quality
    canvas.width = 640  // Compromise between 512 and 768
    canvas.height = 1280  // Compromise between 1024 and 1536
    
    // Create texture from canvas
    const texture = new THREE.CanvasTexture(canvas)
    texture.needsUpdate = true
    texture.flipY = true  // Flip the texture vertically
    texture.minFilter = THREE.LinearFilter  // Sharper filtering
    texture.magFilter = THREE.LinearFilter
    texture.generateMipmaps = false  // Disable mipmaps for sharper text
    texture.anisotropy = 16  // Maximum anisotropic filtering for better quality at angles
    textureRef.current = texture
    
    // Create material with the texture
    const material = new THREE.MeshBasicMaterial({
      map: texture,
      side: THREE.FrontSide,
      transparent: false,  // No transparency for better contrast
      toneMapped: true,  // Enable tone mapping to control brightness
      color: 0xeeeeee,  // Slightly darken the material (93% brightness)
    })
    materialRef.current = material
    
    // Apply material to the phone screen mesh
    if (meshRef && materialRef.current) {
      meshRef.material = materialRef.current
    }
    
    return () => {
      // Proper cleanup of THREE.js resources
      if (texture && !texture.disposed) {
        texture.dispose()
      }
      if (material && material.dispose) {
        material.dispose()
      }
      textureRef.current = null
      materialRef.current = null
    }
  }, [meshRef])
  
  // Helper to load and cache user avatar image
  const avatarImageRef = useRef(null)
  const avatarLoadedRef = useRef(false)
  
  useEffect(() => {
    if (user?.imageUrl && !avatarLoadedRef.current) {
      const img = new Image()
      img.crossOrigin = 'anonymous'
      
      // Add to cleanup list
      imagesToCleanup.current.push(img)
      
      img.onload = () => {
        avatarImageRef.current = img
        avatarLoadedRef.current = true
      }
      img.onerror = () => {
        avatarLoadedRef.current = true // Mark as loaded even on error
      }
      img.src = user.imageUrl
      
      return () => {
        // Cleanup on unmount or when imageUrl changes
        if (img) {
          img.onload = null
          img.onerror = null
          img.src = ''
        }
      }
    }
  }, [user?.imageUrl])
  
  // Subscribe to recent offerings and load their images
  useEffect(() => {
    // Load offerings - they also have polaroid images in polaroidUrl field
    // Query for recent offerings (client-side filtering for polaroidUrl)
    const offeringsRef = collection(db, 'offerings');
    // Simple query without where clause to avoid index requirement
    const q = query(
      offeringsRef,
      orderBy('createdAt', 'desc'), 
      limit(30) // Get more to account for filtering
    ); // Get recent offerings, filter for polaroids client-side
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const polaroidsWithData = [];
      
      snapshot.forEach((doc) => {
        const data = doc.data();
        
        // The offerings collection uses 'polaroidUrl' field for the image
        const imageData = data.polaroidUrl;
        
        // Skip offerings without polaroid images
        if (!imageData) {
          return; // Skip offerings that don't have polaroid images yet
        }
        
        // Additional validation: polaroidUrl must be a valid string URL
        if (typeof imageData !== 'string' || imageData.length < 10) {
          return;
        }
        
        // Check if it's a complete polaroid URL (not a placeholder)
        const isCompletePolaroid = imageData.includes('firebasestorage.googleapis.com') || 
                                   imageData.startsWith('data:image');
        
        if (!isCompletePolaroid) {
          return;
        }
        
        // Include offering with polaroid
        polaroidsWithData.push({
          id: doc.id,
          imageUrl: imageData, // This is the polaroidUrl from offerings
          message: data.message || '',
          username: data.name || data.recipientName || 'Anonymous', // offerings uses 'name'
          userImageUrl: data.userImageUrl || null, // Add user avatar
          burnedAmount: data.tokensBurned || '1', // offerings uses 'tokensBurned'
          type: data.type || 'petition', // offerings uses 'type'
          createdAt: data.createdAt,
          prayerFor: data.prayerFor || 'self',
          recipientName: data.recipientName || data.name || 'Someone'
        });
      });
      
      // Limit to prevent memory issues - only keep most recent 10 polaroids
      const limitedPolaroids = polaroidsWithData.slice(0, 10);
      setAllPolaroids(limitedPolaroids);
      
      // Set the first one as current
      if (limitedPolaroids.length > 0) {
        setLatestPolaroid(limitedPolaroids[0]);
        polaroidIndexRef.current = 0;
        
        // If this is the first load, start fade-in transition
        if (isLoadingInitialData) {
          fadeInStartRef.current = Date.now();
          setFadeInProgress(0);
        }
      }
      
      // Mark loading as complete after first data arrives
      setIsLoadingInitialData(false);
    }, (error) => {
      console.error('PhoneScreenTexture: Firebase listener error:', error);
      setIsLoadingInitialData(false);
    });
    
    // Add to cleanup listeners
    listenersToCleanup.current.push(unsubscribe);
    
    return () => {
      unsubscribe();
    };
  }, []) // Always run this effect
  
  // Load current polaroid image
  useEffect(() => {
    // IMMEDIATELY reset states when polaroid changes
    polaroidLoadedRef.current = false;
    polaroidReadyRef.current = false;
    polaroidImageRef.current = null;
    
    if (latestPolaroid?.imageUrl) {
      const isBase64 = latestPolaroid.imageUrl.startsWith('data:');
      const imagePreview = latestPolaroid.imageUrl.substring(0, 100) + '...';
      

      
      const img = new Image();
      
      // Add to cleanup list
      imagesToCleanup.current.push(img);
      
      // Only set crossOrigin for URLs, not base64
      if (!isBase64) {
        img.crossOrigin = 'anonymous';
      }
      
      img.onload = () => {
        polaroidImageRef.current = img;
        // Small delay just for canvas formatting
        requestAnimationFrame(() => {
          polaroidLoadedRef.current = true;
          polaroidReadyRef.current = true;
        });
      };
      
      img.onerror = (error) => {
        console.error('[PhoneScreen] ❌ FAILED to load image:', {
          error,
          username: latestPolaroid.username,
          imageUrl: latestPolaroid.imageUrl.substring(0, 100) + '...'
        });
        polaroidLoadedRef.current = false;
        polaroidReadyRef.current = false;
        polaroidImageRef.current = null;
      };
      
      // Set the source (works for both base64 and URLs)
      try {
        img.src = latestPolaroid.imageUrl;
      } catch (e) {
        console.error('[PhoneScreen] Error setting image src:', e);
      }
      
      return () => {
        // Cleanup on effect change
        if (img) {
          img.onload = null;
          img.onerror = null;
          img.src = '';
        }
      };
    } else if (latestPolaroid) {
      console.warn('[PhoneScreen] ⚠️ Polaroid data missing imageUrl:', latestPolaroid);
      polaroidLoadedRef.current = false;
      polaroidReadyRef.current = false;
      polaroidImageRef.current = null;
    } else {
      // No polaroid at all - reset states
      polaroidLoadedRef.current = false;
      polaroidReadyRef.current = false;
      polaroidImageRef.current = null;
    }
  }, [latestPolaroid])
  
  // Load user avatar image
  useEffect(() => {
    if (latestPolaroid?.userImageUrl) {
      userAvatarLoadedRef.current = false;
      
      const avatarImg = new Image();
      avatarImg.crossOrigin = 'anonymous';
      
      // Add to cleanup list
      imagesToCleanup.current.push(avatarImg);
      
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
      
      return () => {
        // Cleanup on effect change
        if (avatarImg) {
          avatarImg.onload = null;
          avatarImg.onerror = null;
          avatarImg.src = '';
        }
      };
    } else {
      userAvatarLoadedRef.current = false;
      userAvatarRef.current = null;
    }
  }, [latestPolaroid?.userImageUrl])
  
  // Helper to load custom images from offerings
  const customImagesRef = useRef({})
  
  useEffect(() => {
    const loadedImages = []
    
    offerings.forEach(offering => {
      if (offering.customImage && !customImagesRef.current[offering.id]) {
        const img = new Image()
        img.crossOrigin = 'anonymous'
        
        // Add to cleanup list
        imagesToCleanup.current.push(img)
        loadedImages.push(img)
        
        img.onload = () => {
          customImagesRef.current[offering.id] = img
        }
        img.onerror = () => {
          console.error('[PhoneScreen] Failed to load custom image for offering:', offering.id)
        }
        img.src = offering.customImage
      }
    })
    
    return () => {
      // Cleanup custom images on offerings change
      loadedImages.forEach(img => {
        if (img) {
          img.onload = null
          img.onerror = null
          img.src = ''
        }
      })
    }
  }, [offerings])
  
  // Draw loading animation
  const drawLoadingState = (ctx, width, height) => {
    // Draw shimmer/skeleton effect
    const shimmerTime = Date.now() / 1000 // Time in seconds for animation
    
    // Draw header skeleton
    ctx.fillStyle = 'rgba(255, 255, 255, 0.1)'
    ctx.fillRect(40, 260, 200, 40) // User avatar placeholder
    ctx.fillRect(260, 270, 300, 30) // Username placeholder
    
    // Draw polaroid frame skeleton with shimmer effect
    const shimmerOffset = (Math.sin(shimmerTime * 2) + 1) * 0.5 // 0 to 1
    const gradient = ctx.createLinearGradient(0, 380, width, 680)
    gradient.addColorStop(0, 'rgba(255, 255, 255, 0.05)')
    gradient.addColorStop(shimmerOffset * 0.5, 'rgba(255, 255, 255, 0.1)')
    gradient.addColorStop(shimmerOffset, 'rgba(255, 255, 255, 0.15)')
    gradient.addColorStop(Math.min(shimmerOffset + 0.1, 1), 'rgba(255, 255, 255, 0.1)')
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0.05)')
    
    ctx.fillStyle = gradient
    ctx.fillRect(40, 380, width - 80, 300) // Image placeholder
    
    // Draw message skeleton lines
    ctx.fillStyle = 'rgba(255, 255, 255, 0.08)'
    ctx.fillRect(60, 720, width - 120, 25)
    ctx.fillRect(60, 760, width - 180, 25)
    ctx.fillRect(60, 800, width - 240, 25)
    
    // Draw loading text with pulsing effect
    const pulseAlpha = (Math.sin(shimmerTime * 3) + 1) * 0.25 + 0.25 // 0.25 to 0.75
    ctx.fillStyle = `rgba(138, 43, 226, ${pulseAlpha})` // Purple glow
    ctx.font = 'bold 42px -apple-system, BlinkMacSystemFont, sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('Loading prayers...', width / 2, height / 2 + 200)
    
    // Add some floating dots animation
    const dotCount = 3
    for (let i = 0; i < dotCount; i++) {
      const dotAlpha = Math.sin(shimmerTime * 2 - i * 0.5) * 0.5 + 0.5
      ctx.fillStyle = `rgba(255, 255, 255, ${dotAlpha * 0.5})`
      ctx.beginPath()
      ctx.arc(
        width / 2 - 40 + i * 40, 
        height / 2 + 250 + Math.sin(shimmerTime * 2 + i) * 10,
        5, 0, Math.PI * 2
      )
      ctx.fill()
    }
    
    ctx.textAlign = 'left'
  }
  
  // Memoize canvas context to avoid repeated creation
  const canvasContextRef = useRef(null);
  
  // Draw the phone interface
  const drawPhoneInterface = () => {
    const canvas = canvasRef.current
    
    // Reuse canvas context instead of creating new one each time
    if (!canvasContextRef.current) {
      canvasContextRef.current = canvas.getContext('2d', { 
        alpha: false,
        desynchronized: false,
        willReadFrequently: false
      });
    }
    const ctx = canvasContextRef.current;
    const width = canvas.width
    const height = canvas.height
    
    // Set high quality image rendering
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
    
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
      gradient.addColorStop(0, '#03a700ff')  // Darker gradient
      gradient.addColorStop(0.5, '#04495eff')
      gradient.addColorStop(1, '#0000eeff')
    }
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, width, height)
    
    // Draw status bar (adjusted for 768px width)
    ctx.fillStyle = '#aaa'
    ctx.font = '28px -apple-system, BlinkMacSystemFont, sans-serif'
    ctx.fillText('9:41', 40, 60)
    ctx.fillText('📶 🔋', width - 110, 60)
    
    // Draw app header
    ctx.fillStyle = '#fff'
    ctx.font = 'bold 36px -apple-system, BlinkMacSystemFont, sans-serif'
    ctx.fillText("𝓞𝖚𝖗 𝕷𝖆𝖉𝖞 𝔬𝔣 𝕻𝖊𝖗𝖕𝖊𝖙𝖚𝖆𝖑 𝕻𝖗𝖔𝖋𝖎𝖙 Inbox", 40, 170)
    
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
      ctx.font = 'bold 24px -apple-system, BlinkMacSystemFont, sans-serif'
      
      // Measure text for badge background
      const metrics = ctx.measureText(badgeText)
      const badgeX = 40
      const badgeY = 200
      const padding = 12
      
      // Draw badge background
      ctx.fillStyle = config.color + '22' // Low opacity background
      ctx.strokeStyle = config.color
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.roundRect(badgeX, badgeY, metrics.width + padding * 2, 35, 8)
      ctx.fill()
      ctx.stroke()
      
      // Draw badge text
      ctx.fillStyle = config.color
      ctx.fillText(badgeText, badgeX + padding, badgeY + 24)
    } else if (hasActiveClick) {
      // Fallback when no polaroid
      ctx.fillStyle = '#ff00ff'
      ctx.font = '38px -apple-system, BlinkMacSystemFont, sans-serif'
      ctx.fillText('● Candle Selected', 50, 300)
    }
    
    // Determine what to show
    const now = Date.now();
    const inPrayerReceivedPhase = justLitOffering && (now - prayerReceivedStartTime.current < PRAYER_RECEIVED_DURATION);
    
    // Show loading state if still loading initial data
    if (isLoadingInitialData && !hoveredOffering && !justLitOffering) {
      drawLoadingState(ctx, width, height)
    } else if (showPolaroid && latestPolaroid && !inPrayerReceivedPhase) {
      // Apply fade-in effect if transitioning from loading
      if (fadeInProgress < 1 && fadeInStartRef.current > 0) {
        // Draw loading state with decreasing opacity
        ctx.save()
        ctx.globalAlpha = 1 - fadeInProgress
        drawLoadingState(ctx, width, height)
        ctx.restore()
        
        // Draw content with increasing opacity
        ctx.save()
        ctx.globalAlpha = fadeInProgress
        drawPolaroid(ctx, width, height)
        ctx.restore()
      } else {
        // Show the polaroid-style display (with or without image)
        drawPolaroid(ctx, width, height)
      }
    } else if (latestPolaroid && !hoveredOffering && !justLitOffering && !inPrayerReceivedPhase) {
      // Also show polaroid when not hovering/just lit (fallback)
      drawPolaroid(ctx, width, height)
    } else {

      // Show specific offering when hovered or just lit
      let displayOffering = null
      if (justLitOffering) {
        displayOffering = justLitOffering
        const now = Date.now()
        
        // Check if we're in the Prayer Received phase or showing user info
        const timeInPhase = now - prayerReceivedStartTime.current;
        if (timeInPhase < PRAYER_RECEIVED_DURATION) {
          // First phase: Show Prayer Received screen
          drawPrayerReceivedOnly(ctx, width, height)
        } else {
          // Second phase: Show user's offering details
          drawOffering(ctx, displayOffering, width, height, true)
        }
      } else if (hoveredOffering) {
        // Check if we have hovered polaroid data ready
        console.log('[PhoneScreen] 🖼️ Drawing hovered offering:', {
          hasHoveredPolaroid: !!hoveredPolaroid,
          isLoaded: hoveredPolaroidLoadedRef.current,
          hasImage: !!hoveredPolaroidImageRef.current,
          hoveredId: hoveredPolaroid?.id,
          hoveredUsername: hoveredPolaroid?.username
        });
        
        if (hoveredPolaroid && hoveredPolaroidLoadedRef.current && hoveredPolaroidImageRef.current) {
          // Temporarily swap in the hovered polaroid data
          const savedPolaroid = latestPolaroid;
          const savedImage = polaroidImageRef.current;
          const savedLoaded = polaroidLoadedRef.current;
          const savedReady = polaroidReadyRef.current;
          
          // Use hovered polaroid data for drawing
          setLatestPolaroid(hoveredPolaroid);
          polaroidImageRef.current = hoveredPolaroidImageRef.current;
          polaroidLoadedRef.current = true;
          polaroidReadyRef.current = true;
          
          console.log('[PhoneScreen] 🎨 Drawing polaroid for:', hoveredPolaroid.username);
          // Draw the hovered offering as a polaroid
          drawPolaroid(ctx, width, height);
          
          // Restore original polaroid data
          setLatestPolaroid(savedPolaroid);
          polaroidImageRef.current = savedImage;
          polaroidLoadedRef.current = savedLoaded;
          polaroidReadyRef.current = savedReady;
        } else {
          console.log('[PhoneScreen] 📝 Polaroid not ready, skipping render');
          // No polaroid data or still loading, don't render anything
          return;
        }
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
    
    // Check if image is ready - if not, don't draw ANYTHING (including text)
    if (latestPolaroid.imageUrl && (!polaroidReadyRef.current || !polaroidLoadedRef.current)) {
      // Image exists but isn't ready - don't draw anything at all

      return;
    }
    

    
    // Apply transition effects
    ctx.save();
    
    if (isTransitioning) {
      // Calculate slide offset
      const slideDistance = width; // Slide across the full width
      const currentX = -slideDistance * transitionProgressRef.current;
      const previousX = slideDistance * (1 - transitionProgressRef.current);
      
      // Draw previous polaroid sliding out to the left
      if (previousPolaroidRef.current) {
        ctx.save();
        ctx.translate(previousX, 0);
        ctx.globalAlpha = 1 - transitionProgressRef.current * 0.3; // Fade out slightly
        // We'll draw the previous polaroid here (simplified for now)
        ctx.restore();
      }
      
      // Apply offset for current polaroid sliding in from right
      ctx.translate(currentX, 0);
      ctx.globalAlpha = 0.7 + transitionProgressRef.current * 0.3; // Fade in
    }
    
    // Removed the title to have more space for content
    
    // Draw prayer type and recipient
    const typeConfig = {
      petition: { icon: '🙏', color: '#ffaa00' },
      confession: { icon: '🖤', color: '#aa66ff' },
      appreciation: { icon: '✨', color: '#00ff66' }
    }
    const config = typeConfig[latestPolaroid.type] || typeConfig.petition
    
    // Draw user avatar if available - adjusted for 768px width
    if (userAvatarRef.current && userAvatarLoadedRef.current) {
      const avatarSize = 100; // Appropriate size for 768px canvas
      const avatarX = 40; // Left position
      const avatarY = 260; // Position below badge
      
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
      
      // Draw username next to avatar - adjusted for 768px width
      ctx.font = 'bold 48px -apple-system, BlinkMacSystemFont, sans-serif'
      ctx.fillStyle = '#ffffff'
      ctx.textAlign = 'left'
      ctx.fillText(latestPolaroid.username, avatarX + avatarSize + 30, avatarY + avatarSize/2 + 10)
      ctx.textAlign = 'center'
    } else {
      // No avatar - just show username on the left
      ctx.font = 'bold 48px -apple-system, BlinkMacSystemFont, sans-serif'
      ctx.fillStyle = '#ffffff'
      ctx.textAlign = 'left'
      ctx.fillText(latestPolaroid.username, 40, 310) // Position below badge
      ctx.textAlign = 'center'
    }
    
    // Removed prayer type line to simplify the display
    
    // Only draw image if it's loaded AND ready
    let imageBottomY = 540; // Moved down by 20
    
    if (polaroidImageRef.current && polaroidLoadedRef.current && polaroidReadyRef.current) {
      // IMPORTANT: Save context state to prevent any clipping from affecting our image
      ctx.save();
      
      // Ensure high quality image rendering for this specific image
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      
      const img = polaroidImageRef.current
      const canvasWidth = canvasRef.current.width;  // Get actual canvas width (768)
      const maxWidth = canvasWidth + 10  // Small padding for wider image (768 - 60 = 708px)
      const maxHeight = 300 // Limit height for wide aspect ratio
      
      // ADJUSTABLE CROP SETTINGS - Tweak these values to get perfect framing
      // For polaroid images, crop to zoom in and exclude borders
      const cropRatio = 0.65; // How much of the image to use (0.65 = 65% to exclude borders)
      const cropOffsetY = 0.0; // Shift crop area down slightly (0.05 = 5% down)
      
      // Calculate crop area - take a wider section from the center
      // Use most of the width but less height to create a wider aspect ratio
      const sourceWidth = img.width * cropRatio;
      const sourceHeight = img.height * (cropRatio * 0.65); // Take less height to make it wider
      const sourceX = (img.width - sourceWidth) / 2;  // Center horizontally
      const sourceY = (img.height - sourceHeight) / 2 + (img.height * cropOffsetY); // Center vertically with offset
      
      // Calculate destination size - fill the available width
      const aspectRatio = sourceWidth / sourceHeight;
      const scaledWidth = maxWidth;  // Use full available width
      const scaledHeight = scaledWidth / aspectRatio;
      

      
      // Center the image horizontally
      const imgX = (width - scaledWidth) / 2
      const imgY = 380 // Position below username (adjusted for 768px canvas)
      
      // Draw shadow for the frame
      ctx.save();
      ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
      ctx.shadowBlur = 20;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 10;
      
      // Draw polaroid frame background (white border) - straight, not rotated
      const framePaddingSide = 15;
      const framePaddingTop = 0; // Reduced top padding to eliminate gap
      const framePaddingBottom = 0;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(imgX - framePaddingSide, imgY - framePaddingTop, 
                   scaledWidth + framePaddingSide * 2, scaledHeight + framePaddingTop + framePaddingBottom);
      
      // Reset shadow
      ctx.shadowBlur = 0;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;
      ctx.restore();
      
      // Set up clipping region for the image area
      ctx.save();
      ctx.beginPath();
      ctx.rect(imgX, imgY, scaledWidth, scaledHeight);
      ctx.clip();
      
      // Apply counter-rotation to straighten the tilted polaroid image
      ctx.save();
      const imageCenterX = imgX + scaledWidth / 2;
      const imageCenterY = imgY + scaledHeight / 2;
      ctx.translate(imageCenterX, imageCenterY);
      ctx.rotate(5 * Math.PI / 180); // Rotate 5 degrees to counter the original tilt
      ctx.translate(-imageCenterX, -imageCenterY);
      
      // Draw the cropped polaroid image (rotated to appear straight)
      try {
        // Draw the image with a larger scale to ensure it fills the frame after rotation
        const scaleCompensation = 1.15; // Scale up more to fill gaps from rotation
        const compensatedWidth = scaledWidth * scaleCompensation;
        const compensatedHeight = scaledHeight * scaleCompensation;
        const compensatedX = imgX - (compensatedWidth - scaledWidth) / 2;
        const compensatedY = imgY - (compensatedHeight - scaledHeight) / 2 - 12; // Shift up more to fully cover top gap
        
        ctx.drawImage(
          img, 
          sourceX, sourceY, sourceWidth, sourceHeight,  // Source rectangle (cropped)
          compensatedX, compensatedY, compensatedWidth, compensatedHeight  // Destination rectangle
        )
        
        // Apply a very slight darkening overlay to reduce brightness
        ctx.globalCompositeOperation = 'multiply';
        ctx.fillStyle = 'rgba(245, 245, 245, 1)'; // Darken to about 96% brightness
        ctx.fillRect(compensatedX, compensatedY, compensatedWidth, compensatedHeight);
        ctx.globalCompositeOperation = 'source-over';
        
        imageBottomY = imgY + scaledHeight; // Update bottom position
      } catch (e) {
        console.error('[PhoneScreen] ❌ Failed to draw image:', e);
      }
      
      // Restore rotation context
      ctx.restore();
      
      // Restore clipping context
      ctx.restore();
      
      // Reset shadow
      ctx.shadowBlur = 0
      ctx.shadowOffsetX = 0
      ctx.shadowOffsetY = 0
      
      // IMPORTANT: Restore context to clear any clipping paths
      ctx.restore();
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
    
    // Draw message below the image
    if (latestPolaroid.message) {
      ctx.fillStyle = '#ffffff'
      ctx.font = '42px -apple-system, BlinkMacSystemFont, sans-serif'
      
      // Word wrap the message
      const words = latestPolaroid.message.split(' ')
      let line = ''
      let lineY = imageBottomY + 60
      const maxTextWidth = width - 60
      const lineHeight = 36
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
    // if (allPolaroids.length > 1) {
    //   ctx.fillStyle = 'rgba(0, 255, 102, 0.6)'
    //   ctx.font = '28px -apple-system, BlinkMacSystemFont, sans-serif'
    //   ctx.fillText('Auto-cycling every 5s', width / 2, height - 40)
    // }
    
    ctx.textAlign = 'left'
    
    // Restore transition context
    ctx.restore();
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
    ctx.fillText(offering.name || 'Anonymous', avatarX + avatarSize + 70, y + 100)
    
    // Add a colored accent pill/badge on the right side
    const pillY = y + 70
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
      ctx.font = '28px -apple-system, BlinkMacSystemFont, sans-serif'
      
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
  
  // Track when offerings change and load hovered offering's polaroid
 
  
  // Track when justLitOffering changes to start the Prayer Received animation
  // Only show Prayer Received once per offering using a unique identifier
  const previousJustLitOffering = useRef(null)
  useEffect(() => {
    const now = Date.now()
    
    // Create a unique identifier for this offering (using timestamp + username or id)
    const offeringId = justLitOffering ? 
      `${justLitOffering.id || justLitOffering.createdBy || justLitOffering.username}-${justLitOffering.tokensBurned}-${Math.floor(now / 60000)}` : // Round to minute to group rapid changes
      null
    
    console.log(`[PhoneScreen-${instanceId.current}] 📊 justLitOffering changed:`, {
      current: justLitOffering?.username || 'null',
      previous: previousJustLitOffering.current?.username || 'null', 
      offeringId,
      alreadyShown: offeringId ? shownPrayerForOfferings.has(offeringId) : false,
      willStartTimer: !!(justLitOffering && !previousJustLitOffering.current && offeringId && !shownPrayerForOfferings.has(offeringId)),
      currentTime: now
    })
    
    // Only start timer if:
    // 1. We have a justLitOffering 
    // 2. Previous was null (new offering)
    // 3. We haven't shown Prayer Received for this specific offering yet
    if (justLitOffering && !previousJustLitOffering.current && offeringId && !shownPrayerForOfferings.has(offeringId)) {
      console.log(`[PhoneScreen-${instanceId.current}] 🙏 Starting Prayer Received timer for:`, justLitOffering.username || 'Anonymous', 'ID:', offeringId)
      prayerReceivedStartTime.current = now
      shownPrayerForOfferings.set(offeringId, now)
      
      // Clean up old offerings after 5 minutes to prevent memory leaks
      const cleanupTimer = setTimeout(() => {
        shownPrayerForOfferings.delete(offeringId)
        console.log(`[PhoneScreen] 🧹 Cleaned up offering ID:`, offeringId)
      }, 5 * 60 * 1000)
      
      // Add cleanup timer to cleanup list
      listenersToCleanup.current.push(() => clearTimeout(cleanupTimer))
      
      // Clean up old entries regularly to prevent map from growing indefinitely
      for (const [id, timestamp] of shownPrayerForOfferings.entries()) {
        if (now - timestamp > 10 * 60 * 1000) { // Remove entries older than 10 minutes
          shownPrayerForOfferings.delete(id)
        }
      }
    } else if (justLitOffering && !previousJustLitOffering.current && offeringId && shownPrayerForOfferings.has(offeringId)) {
      console.log(`[PhoneScreen-${instanceId.current}] ⏭️ Skipping Prayer Received - already shown for offering:`, offeringId)
    }
    
    previousJustLitOffering.current = justLitOffering
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
  
  // Update canvas every frame with throttling
  useFrame(() => {
    frameCount.current++
    const now = Date.now()
    
    // Update fade-in progress
    if (fadeInStartRef.current > 0 && fadeInProgress < 1) {
      const elapsed = now - fadeInStartRef.current
      const duration = 800 // 800ms fade-in
      const newProgress = Math.min(elapsed / duration, 1)
      setFadeInProgress(newProgress)
      
      // Force redraw during fade-in
      drawPhoneInterface()
    } else if (frameCount.current % 15 === 0 || hoveredOffering || justLitOffering || showPolaroid || isLoadingInitialData) {
      // Update every 15 frames (instead of 10) or when offerings change - reduced for better performance
      drawPhoneInterface()
    }
    
    // Auto-cycle through polaroids when not showing a specific offering
    if (!hoveredOffering && !justLitOffering && allPolaroids.length > 1) {
      // Cycle every 5 seconds with transition
      if (now - lastPolaroidUpdateRef.current > 5000) {
        // Store the current polaroid as previous
        previousPolaroidRef.current = latestPolaroid
        previousPolaroidImageRef.current = polaroidImageRef.current
        
        // Start transition
        setIsTransitioning(true)
        transitionStartTimeRef.current = now
        transitionProgressRef.current = 0
        
        // Update to next polaroid
        polaroidIndexRef.current = (polaroidIndexRef.current + 1) % allPolaroids.length
        const nextPolaroid = allPolaroids[polaroidIndexRef.current]
        setLatestPolaroid(nextPolaroid)
        lastPolaroidUpdateRef.current = now
        
        // End transition after animation completes
        setTimeout(() => {
          setIsTransitioning(false)
        }, 500) // 500ms transition duration
      }
    }
    
    // Removed old auto-rotation logic - now using polaroid cycling above
    
    // Update transition progress
    if (isTransitioning) {
      const elapsed = now - transitionStartTimeRef.current
      const duration = 500 // 500ms transition
      transitionProgressRef.current = Math.min(elapsed / duration, 1)
      
      // Use easing function for smooth animation
      const easeInOutCubic = (t) => {
        return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
      }
      transitionProgressRef.current = easeInOutCubic(transitionProgressRef.current)
    }
  })
  
  return null
}