'use client'
import { useRef, useState, useEffect, Suspense, useCallback, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, useGLTF, Box, useCursor } from '@react-three/drei'


// Preload the model immediately when module loads
useGLTF.preload('/models/hands_MOBILE.glb')
import { EffectComposer, Bloom } from '@react-three/postprocessing'
import * as THREE from 'three'
import { db } from '@/lib/firebaseClient'
import { collection, query, getDocs, limit, orderBy, onSnapshot } from 'firebase/firestore'
import { m } from 'framer-motion'
import { PhoneScreenTexture } from './PhoneScreenTexture'
import { PhoneAura } from './PhoneAura'
import { Html } from '@react-three/drei'
import EmojiRain from './EmojiRain'
import { WatchlistPhoneTexture } from './WatchlistPhoneTexture'



export function HandsModel({ mousePosition, onLoad, hasReachedSection, isInView, offerings, hoveredOffering, justLitOffering, onJustLitComplete, userRotation = 0, priceChange = 0, hasActiveClick = false, is80sMode = false, onPhoneClick, user = null, showLatestPolaroid = false, isHighlighting = false,
  // Phone aura glow overrides — defaults preserve the /illumin80 look;
  // other mounts (e.g. the landing page chamber) tune their own.
  phoneAuraColor = '#00ffff', phoneAuraIntensity = 0.003, phoneAuraSize = 1, phoneAuraOpacity = 0.9 }) {

  // Get mobile state from parent or detect it locally
  const [isMobileLocal, setIsMobileLocal] = useState(false)
  useEffect(() => {
    const checkMobile = () => {
      setIsMobileLocal(window.innerWidth < 768)
    }
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])
  
  // Load different model based on device type
  // Assuming you'll create a hands_MOBILE.glb without emojis/icons
  const modelPath = isMobileLocal ? '/models/hands_MOBILE.glb' : '/models/hands_MOBILE.glb'
  const gltf = useGLTF(modelPath)
  const hasReportedLoad = useRef(false)
  const rightHandRef = useRef()
  const leftHandRef = useRef()
  const candleLabel2Ref = useRef()
  const phoneScreenRef = useRef()
  const phoneCaseRef = useRef()
  const pacManRef = useRef() // Reference for PacMan parent object
  const phoneSwipeHandlers = useRef(null)
  const swipeStartY = useRef(0)
  const isDragging = useRef(false)
  const backdropRef = useRef() // Reference for Backdrop object
  const circleRef = useRef() // Reference for Circle object
  const [phoneCaseWorldPos, setPhoneCaseWorldPos] = useState([0, 0, 0])
  const [phoneCaseWorldQuat, setPhoneCaseWorldQuat] = useState([0, 0, 0, 1])
  const [phoneCaseWorldRotation, setPhoneCaseWorldRotation] = useState([0, 0, 0])
  const [raysVisible, setRaysVisible] = useState(true)
  const [randomUserImages, setRandomUserImages] = useState([])
  const [currentImageIndex, setCurrentImageIndex] = useState(0)
  const [hovered, setHovered] = useState(false)
  const randomUserImagesRef = useRef([])
  const currentImageIndexRef = useRef(0)

  // MEMORY FIX: Refs to track values and throttle state updates
  const lastUpdateTime = useRef(0)
  const phoneCaseWorldPosRef = useRef([0, 0, 0])
  const phoneCaseWorldRotationRef = useRef([0, 0, 0])
  const raysVisibleRef = useRef(true)
  
  // Toggle visibility of Backdrop and Circle meshes based on highlighting state
  useEffect(() => {
    if (backdropRef.current) {
      backdropRef.current.visible = !isHighlighting
      backdropRef.current.traverse((node) => {
        node.visible = !isHighlighting
      })
    }
    
    if (circleRef.current) {
      circleRef.current.visible = !isHighlighting
      circleRef.current.traverse((node) => {
        node.visible = !isHighlighting
      })
    }
  }, [isHighlighting])

  // Traverse the model to find specific meshes including phoneScreen
  useEffect(() => {
    if (!gltf) return

    gltf.scene.traverse((child) => {
      // Set renderOrder and depth settings for proper occlusion with candles
      if (child.isMesh) {
        child.renderOrder = -1
        if (child.material) {
          child.material.depthWrite = true
          child.material.depthTest = true
        }
      }
      // Look for PhoneScreen mesh
      if (child.name === 'PhoneScreen' || child.name === 'phonescreen' || child.name === 'phone_screen' ||
          child.name === 'Phone_Screen' || child.name.toLowerCase().includes('phonescreen')) {
        phoneScreenRef.current = child
        // Ensure the mesh can be raycasted
        if (child.isMesh) {
          child.raycast = THREE.Mesh.prototype.raycast
          child.material = child.material.clone()
          child.material.side = THREE.DoubleSide // Make sure both sides are clickable
          child.material.depthWrite = true   // Write depth for proper occlusion
          child.material.depthTest = true    // Test depth
          child.material.transparent = false // Ensure not transparent so it fully occludes
          child.material.opacity = 1.0
          child.material.blending = THREE.NormalBlending  // Normal blending, not additive
          child.material.alphaTest = 0  // No alpha testing
          child.material.needsUpdate = true
          child.renderOrder = 5  // Render BEFORE flames (10) so flames can depth-test against phone
        }
        // Add click handler for focus mode with watchlist check
        child.userData.onClick = (event) => {
          // Check if this is the phone screen mesh and if watchlist handled the click
          if (child.userData.onWatchlistClick && event && event.uv) {
            const watchlistHandled = child.userData.onWatchlistClick(event.uv);
            if (watchlistHandled) {
              // Watchlist handled the click, don't trigger focus mode
              return;
            }
          }
          
          // No watchlist interaction, proceed with focus mode
          if (onPhoneClick) {
            onPhoneClick()
          } else {
          }
        }
        child.userData.clickable = true
      }
      
      // Look for phoneCase mesh for light ray positioning
      if (child.name === 'phoneCase' || child.name === 'PhoneCase' || child.name === 'phone_case') {
        phoneCaseRef.current = child
        // Mark that this mesh will have light rays attached
        child.userData.hasLightRays = true
        // Render after flames to occlude them
        if (child.isMesh && child.material) {
          child.material = child.material.clone()
          child.material.depthWrite = true
          child.material.depthTest = true
          child.material.transparent = false
          child.material.opacity = 1.0
          child.material.blending = THREE.NormalBlending
          child.material.alphaTest = 0
          child.material.needsUpdate = true
          child.renderOrder = 5  // Render BEFORE flames so flames can depth-test against phone
        }
      }
      
      // Look for candle label
      if (child.name === 'candleLabel2' || child.name === 'Candle_Label2' || child.name === 'candle_label2') {
        candleLabel2Ref.current = child
      }
      
      // Look for hands
      if (child.name === 'rightHand' || child.name.toLowerCase().includes('righthand')) {
        rightHandRef.current = child
      }
      if (child.name === 'leftHand' || child.name.toLowerCase().includes('lefthand')) {
        leftHandRef.current = child
      }
      


      
      // Store reference to Backdrop mesh (Mary's head) - render LAST to appear on top
      if (child.name === 'Backdrop' || child.name === 'backdrop' || child.name.toLowerCase().includes('backdrop')) {
        backdropRef.current = child
        // Disable raycasting so clicks pass through to candles behind
        child.raycast = () => {}
        if (child.isMesh && child.material) {
          // Clone material to avoid modifying shared material
          child.material = child.material.clone()
          child.material.depthWrite = false  // Don't write depth
          child.material.depthTest = false   // Don't test depth - always render
          child.material.transparent = true
          child.material.needsUpdate = true
          child.renderOrder = 999  // Render last, on top of everything
        }
      }

      // Store reference to Circle mesh (Mary's halo) - render before face but after candles
      if (child.name === 'Circle' || child.name === 'circle' || child.name.toLowerCase().includes('circle')) {
        circleRef.current = child
        // Disable raycasting so clicks pass through to candles behind
        child.raycast = () => {}
        if (child.isMesh && child.material) {
          // Clone material to avoid modifying shared material
          child.material = child.material.clone()
          child.material.depthWrite = false  // Don't write depth
          child.material.depthTest = false   // Don't test depth - always render
          child.material.transparent = true
          child.material.needsUpdate = true
          child.renderOrder = 998  // Render before face (999) but after candles
        }
      }

    })
    
    if (!hasReportedLoad.current) {
      if (onLoad) onLoad()
      hasReportedLoad.current = true
    }
  }, [gltf, onLoad, is80sMode, onPhoneClick])
  const texturePoolRef = useRef([]) // Pool of textures to reuse
  const canvasPoolRef = useRef([]) // Pool of canvas elements to reuse
  const materialPoolRef = useRef([]) // Pool of materials to reuse
  const { camera } = useThree()
  
  // Animation mixers for animated emojis - optimized with single ref object
  const mixersRef = useRef({
    devil: null,
    crying: null,
    crying2: null,
    pacMan: null,
    pacMan2: null
  })
  const actionsRef = useRef({
    pacMan: null,
    pacMan2: null
  })
  
  // Add keyboard controls for browsing offerings
  const isBrowsing = useRef(false);
  
  useEffect(() => {
    const handleKeyPress = (e) => {
      if (phoneSwipeHandlers.current) {
        if (e.key === 'ArrowUp') {
          // Only start browsing once, not on every key press
          if (!isBrowsing.current) {
            phoneSwipeHandlers.current.startBrowsing();
            isBrowsing.current = true;
          }
          phoneSwipeHandlers.current.swipeUp();
        } else if (e.key === 'ArrowDown') {
          // Only start browsing once, not on every key press
          if (!isBrowsing.current) {
            phoneSwipeHandlers.current.startBrowsing();
            isBrowsing.current = true;
          }
          phoneSwipeHandlers.current.swipeDown();
        } else if (e.key === 'Escape') {
          phoneSwipeHandlers.current.stopBrowsing();
          isBrowsing.current = false;
        }
      }
    };
    
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, []);
  
  // Debounced price for emoji changes (updates less frequently)
  
  // Market status based on debounced price change for emoji stability
  // Opacity targets for smooth fading - store target opacity for each emoji group
  // Initialize based on current price state to ensure correct visibility from start

  
  // MINIMAL: Fetch one image only
  useEffect(() => {
    fetchImagesFallback()
  }, [])

  // COMMENTED OUT: Real-time Firestore listener for memory testing
  // useEffect(() => {
  //   let unsubscribe = null
  //   
  //   try {
  //     const q = query(
  //       collection(db, 'results'), 
  //       orderBy('createdAt', 'desc'),
  //       limit(1)
  //     )
  //     
  //     unsubscribe = onSnapshot(q, (snapshot) => {
  //       const images = []
  //       snapshot.forEach((doc) => {
  //         const data = doc.data()
  //         if (!data) {
  //           console.warn('Document has null data:', doc.id)
  //           return
  //         }
  //         if (data.image && data.image !== '/defaultAvatar.png' && data.image !== '') {
  //           images.push({
  //             id: doc.id,
  //             image: data.image,
  //             username: data.username || 'Anonymous',
  //             message: data.message || '',
  //             createdAt: data.createdAt
  //           })
  //         }
  //       })
  //       
  //       if (images.length > 0) {
  //         setRandomUserImages(images)
  //         randomUserImagesRef.current = images
  //         setCurrentImageIndex(0)
  //         currentImageIndexRef.current = 0
  //       } else {
  //         console.log('No valid images found in Firestore')
  //       }
  //     }, (error) => {
  //       console.error('Error fetching user images:', error)
  //       fetchImagesFallback()
  //     })
  //     
  //   } catch (error) {
  //     console.error('Error setting up real-time listener:', error)
  //     fetchImagesFallback()
  //   }
  //   
  //   return () => {
  //     if (unsubscribe) {
  //       unsubscribe()
  //     }
  //   }
  // }, [])

  // Fallback function for one-time fetch
  const fetchImagesFallback = async () => {
    try {
      const q = query(
        collection(db, 'results'), 
        orderBy('createdAt', 'desc'),
        limit(1) // Fallback also uses only 1 result
      )
      const snapshot = await getDocs(q)
      
      const images = []
      snapshot.forEach((doc) => {
        const data = doc.data()
        // Add null check for data in fallback too
        if (!data) {
          console.warn('Fallback: Document has null data:', doc.id)
          return
        }
        if (data.image && data.image !== '/defaultAvatar.png' && data.image !== '') {
          images.push({
            id: doc.id,
            image: data.image,
            username: data.username || 'Anonymous',
            message: data.message || '',
            createdAt: data.createdAt
          })
        }
      })
      
      if (images.length > 0) {
        setRandomUserImages(images)
        randomUserImagesRef.current = images
        setCurrentImageIndex(0) // Start with newest
        currentImageIndexRef.current = 0
      }
    } catch (error) {
      console.error('Error in fallback fetch:', error)
    }
  }
  
  // Remove automatic image rotation - only advance on candle clicks

  // Log what we loaded and report when loaded


  // Add frame counter for throttling expensive operations
  const frameCounter = useRef(0)
  
  // Smooth opacity animation in render loop

  

  
  // Safe texture management utility
  const disposeTexture = useCallback((texture) => {
    if (texture && texture.dispose && !texture.disposed) {
      try {
        texture.dispose()
        // Don't set properties to null on disposed textures
      } catch (error) {
        console.warn('Error disposing texture:', error)
      }
    }
  }, [])

  const disposeMaterial = useCallback((material) => {
    if (material) {
      if (material.map) disposeTexture(material.map)
      if (material.emissiveMap) disposeTexture(material.emissiveMap)
      if (material.normalMap) disposeTexture(material.normalMap)
      if (material.roughnessMap) disposeTexture(material.roughnessMap)
      material.dispose()
    }
  }, [disposeTexture])

  // SIMPLIFIED: Basic texture application with proper disposal
  useEffect(() => {
    if (!candleLabel2Ref.current || randomUserImages.length === 0) {
      return
    }
    
    const imageData = randomUserImages[0] // Only use first image
    if (!imageData?.image) return
    
    // Store references for cleanup
    let texture = null
    let material = null
    let previousMaterial = null
    let isMounted = true // Track if effect is still mounted

    // Simple texture loading with cleanup
    const canvas = document.createElement('canvas')
    canvas.width = 128
    canvas.height = 128
    const ctx = canvas.getContext('2d')

    const img = new Image()
    img.crossOrigin = 'anonymous'

    img.onload = () => {
      // MEMORY FIX: Check if component is still mounted before applying texture
      if (!isMounted || !candleLabel2Ref.current) return

      // Draw image rotated to fix orientation
      ctx.save()
      ctx.translate(64, 64) // Move to center

      ctx.drawImage(img, -64, -64, 128, 128) // Draw centered and rotated
      ctx.restore()

      // Add username overlay AFTER image rotation (so text stays normal)
      if (imageData.username) {
        // Add semi-transparent background for text at bottom
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)'
        ctx.fillRect(0, 128 - 25, 128, 25)

        // Draw username normally (not rotated)
        ctx.fillStyle = '#ffffff'
        ctx.font = 'bold 12px Arial'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'

        // Add text shadow for better readability
        ctx.shadowColor = 'rgba(0, 0, 0, 0.8)'
        ctx.shadowBlur = 2
        ctx.shadowOffsetX = 1
        ctx.shadowOffsetY = 1

        ctx.fillText(imageData.username, 64, 128 - 12)
      }

      texture = new THREE.CanvasTexture(canvas)
      texture.needsUpdate = true
      texture.generateMipmaps = false
      texture.flipY = false // No additional flipping needed
      texture.wrapS = THREE.ClampToEdgeWrapping
      texture.wrapT = THREE.ClampToEdgeWrapping

      material = new THREE.MeshBasicMaterial({
        map: texture,
        side: THREE.DoubleSide
      })

      // Store previous material for disposal
      if (candleLabel2Ref.current.material) {
        previousMaterial = candleLabel2Ref.current.material
      }

      candleLabel2Ref.current.material = material

      // Dispose previous material and texture
      if (previousMaterial) {
        if (previousMaterial.map) previousMaterial.map.dispose()
        previousMaterial.dispose()
      }
    }

    // MEMORY FIX: Add error handler to prevent memory leaks on failed image loads
    img.onerror = (error) => {
      console.warn('Failed to load candle label image:', error)
      // Clean up img and canvas references
      img.src = '' // Clear src to prevent retries
    }

    img.src = imageData.image

    // Cleanup function
    return () => {
      isMounted = false // Mark as unmounted
      // Clear image src to cancel any pending loads
      img.src = ''
      img.onload = null
      img.onerror = null

      if (texture) texture.dispose()
      if (material) {
        if (material.map) material.map.dispose()
        material.dispose()
      }
    }
  }, [randomUserImages])

  // COMMENTED OUT: Complex texture management
  // const imageData = randomUserImages[currentImageIndex]
  // ... rest of complex texture management code removed ...


  // Scroll-based rotation removed - model now uses swivel and user-controlled rotation only

// Combined animations useFrame
useFrame((state, delta) => {
  // Update digital portal backdrop animation

  // Track phoneCase world position and rotation for light rays
  if (phoneCaseRef.current) {
    // MEMORY FIX: Reuse objects instead of creating new ones every frame
    const worldPos = new THREE.Vector3()
    const worldQuat = new THREE.Quaternion()
    const worldEuler = new THREE.Euler()
    phoneCaseRef.current.getWorldPosition(worldPos)
    phoneCaseRef.current.getWorldQuaternion(worldQuat)
    worldEuler.setFromQuaternion(worldQuat)

    // Check if phone is facing camera (rays should only be visible from front)
    const phoneForward = new THREE.Vector3(0, 0, 1)
    phoneForward.applyQuaternion(worldQuat)

    // Get camera direction to phone
    const cameraToPhone = new THREE.Vector3()
    cameraToPhone.copy(worldPos).sub(state.camera.position).normalize()

    // Calculate dot product
    const dotProduct = phoneForward.dot(cameraToPhone)
    const newRaysVisible = dotProduct < 0.3

    // Update refs every frame
    phoneCaseWorldPosRef.current = [worldPos.x, worldPos.y, worldPos.z]
    phoneCaseWorldRotationRef.current = [worldEuler.x, worldEuler.y, worldEuler.z]
    raysVisibleRef.current = newRaysVisible

    // MEMORY FIX: Only update state every 100ms to reduce re-renders
    const now = Date.now()
    if (now - lastUpdateTime.current > 100) {
      setPhoneCaseWorldPos([worldPos.x, worldPos.y, worldPos.z])
      setPhoneCaseWorldQuat([worldQuat.x, worldQuat.y, worldQuat.z, worldQuat.w])
      setPhoneCaseWorldRotation([worldEuler.x, worldEuler.y, worldEuler.z])
      setRaysVisible(newRaysVisible)
      lastUpdateTime.current = now
    }
  }
  
  // Update all animation mixers efficiently
  Object.values(mixersRef.current).forEach(mixer => {
    if (mixer) mixer.update(delta)
  })
  
  // PacMan movement animation for 80s mode (pacman2 is parented and follows)
  // if (is80sMode && pacManRef.current) {
  //   // Total cycle: 8 seconds move + 3 seconds wait = 11 seconds
  //   const totalCycleTime = 11 // 8 seconds for movement, 3 seconds for delay
  //   const cycleTime = state.clock.elapsedTime % totalCycleTime
    
  //   // Keep PacMan always visible
  //   pacManRef.current.visible = true
    
  //   // Calculate opacity for fade effect
  //   let opacity = 0
    
  //   // First 4 seconds: move left
  //   // Next 3 seconds: hidden/delay
  //   // Next 4 seconds: move right
    
  //   if (cycleTime < 4) {
  //     // Moving left phase (0 to 4 seconds)
  //     const leftProgress = cycleTime / 4 // 0 to 1
      
  //     // Fade in at start (0 to 0.15), fade out at end (0.85 to 1.0)
  //     if (leftProgress < 0.15) {
  //       opacity = leftProgress / 0.15 // Fade in from 0 to 1
  //     } else if (leftProgress > 0.85) {
  //       opacity = 1 - ((leftProgress - 0.85) / 0.15) // Fade out from 1 to 0
  //     } else {
  //       opacity = 1 // Fully visible in the middle
  //     }
      
  //     // Move from center to left
  //     pacManRef.current.position.x = -leftProgress * 5
      
  //     // Face left (no rotation needed, default facing)
  //     pacManRef.current.rotation.y = 0
      
  //   } else if (cycleTime < 7) {
  //     // Delay phase (4 to 7 seconds) - stay hidden
  //     opacity = 0
  //     pacManRef.current.position.x = 0 // Reset to center during delay
      
  //   } else {
  //     // Moving right phase (7 to 11 seconds)
  //     const rightProgress = (cycleTime - 7) / 4 // 0 to 1
      
  //     // Fade in at start (0 to 0.15), fade out at end (0.85 to 1.0)
  //     if (rightProgress < 0.15) {
  //       opacity = rightProgress / 0.15 // Fade in from 0 to 1
  //     } else if (rightProgress > 0.85) {
  //       opacity = 1 - ((rightProgress - 0.85) / 0.15) // Fade out from 1 to 0
  //     } else {
  //       opacity = 1 // Fully visible in the middle
  //     }
      
  //     // Move from center to right
  //     pacManRef.current.position.x = rightProgress * 5
      
  //     // Face right (180 degree rotation)
  //     pacManRef.current.rotation.y = Math.PI
  //   }
    
  //   // Apply opacity to all meshes in PacMan
  //   pacManRef.current.traverse((child) => {
  //     if (child.isMesh && child.material) {
  //       child.material.transparent = true
  //       child.material.opacity = opacity
  //     }
  //   })
    
  //   // Apply same opacity to pacman2 (parented to PacMan)
  //   if (pacMan2Ref.current) {
  //     pacMan2Ref.current.visible = true
      
  //     // Apply same opacity as parent
  //     pacMan2Ref.current.traverse((child) => {
  //       if (child.isMesh && child.material) {
  //         child.material.transparent = true
  //         child.material.opacity = opacity
  //       }
  //     })
      
  //     // If pacman2 appears to be moving backwards, flip it 180 degrees
  //     // This compensates for any initial rotation differences in the model
  //     pacMan2Ref.current.rotation.y = Math.PI // Rotate 180 degrees relative to parent
  //   }
  // }
  
  // Floating animations for emojis and icons
  
  // Animate arrows with directional motion
})


// Removed duplicate useFrame and useEffect - functionality merged into main useFrame above

// Memoized click handler to reduce re-renders
const handleClick = useCallback((event) => {
  // Stop propagation to prevent multiple handlers
  event.stopPropagation()
  
  // Get the clicked object
  const clickedObject = event.object
  
  // Check if the clicked object or any of its parents has a click handler
  let current = clickedObject
  while (current) {
    if (current.userData.onClick) {
      // console.log('Found onClick handler on:', current.name, 'triggering onClick')
      // Pass the full event (including UV coordinates) to the handler
      current.userData.onClick(event)
      break
    }
    current = current.parent
  }
}, [])

// Memoized hover handlers
const handlePointerOver = useCallback((event) => {
  const hoveredObject = event.object
  let current = hoveredObject
  while (current) {
    if (current.userData.onClick || current.userData.clickable) {
      setHovered(true)
      if (typeof document !== 'undefined' && document.body) {
        document.body.style.cursor = 'pointer'
      }
      break
    }
    current = current.parent
  }
}, [])

const handlePointerOut = useCallback(() => {
  setHovered(false)
  if (typeof document !== 'undefined' && document.body) {
    document.body.style.cursor = 'default'
  }
}, [])

// Use cursor hook for pointer changes
useCursor(hovered)

// AGGRESSIVE cleanup on component unmount
useEffect(() => {
  return () => {
    // console.log('HandsGLTFScene unmounting - aggressive cleanup starting')
    
    // Dispose all textures in pool
    texturePoolRef.current.forEach(disposeTexture)
    texturePoolRef.current = []
    
    // Dispose all materials in pool
    materialPoolRef.current.forEach(disposeMaterial)
    materialPoolRef.current = []
    
    // Dispose candle material
    if (candleLabel2Ref.current && candleLabel2Ref.current.material) {
      disposeMaterial(candleLabel2Ref.current.material)
    }
    
    // Dispose all animation mixers
    Object.values(mixersRef.current).forEach(mixer => {
      if (mixer) {
        mixer.stopAllAction()
        mixer.uncacheRoot(mixer.getRoot())
      }
    })
    
    // Clear mixer and action refs
    Object.keys(mixersRef.current).forEach(key => {
      mixersRef.current[key] = null
    })
    Object.keys(actionsRef.current).forEach(key => {
      actionsRef.current[key] = null
    })
    
    // Clear all object refs
    if (rightHandRef.current) rightHandRef.current = null
    if (leftHandRef.current) leftHandRef.current = null
    if (candleLabel2Ref.current) candleLabel2Ref.current = null
    randomUserImagesRef.current = []
    texturePoolRef.current = []
    materialPoolRef.current = []
    canvasPoolRef.current = []
    
    // Force browser garbage collection if available
    if (window.gc) {
      window.gc()
    }
    
  }
}, [disposeTexture, disposeMaterial])

// Get world position and rotation of phone (preferring phoneCase over phoneScreen)
const phoneWorldTransform = useMemo(() => {
  // Prefer phoneCase for positioning, fall back to phoneScreen
  const phoneRefLocal = phoneCaseRef.current || phoneScreenRef.current
  
  if (phoneRefLocal) {
    const worldPos = new THREE.Vector3()
    const worldQuat = new THREE.Quaternion()
    const worldScale = new THREE.Vector3()
    phoneRefLocal.getWorldPosition(worldPos)
    phoneRefLocal.getWorldQuaternion(worldQuat)
    phoneRefLocal.getWorldScale(worldScale)
    
    return { position: worldPos, quaternion: worldQuat, scale: worldScale }
  }
  return null
}, [phoneCaseRef.current, phoneScreenRef.current, offerings, hoveredOffering, justLitOffering])

// Create local click handler for phone
const handlePhoneClick = useCallback(() => {
  if (onPhoneClick && typeof onPhoneClick === 'function') {
    onPhoneClick();
  } else {
    console.warn('onPhoneClick prop not passed to HandsModel');
  }
}, [onPhoneClick]);

// Return with swivel animation applied

return (
  <group position={[0, isMobileLocal ? -0.4 : -0.3, 0]}> {/* Position hands higher on mobile */}
    <primitive 
      object={gltf.scene} 
      scale={ isMobileLocal ? [0.45, 0.45, 0.45] : [0.65, 0.65, 0.65] }
      rotation={[0, userRotation, 0]} // Apply user rotation to hands
      onClick={handleClick}
      onPointerOver={handlePointerOver}
      onPointerOut={handlePointerOut}
    />
    
    {/* Phone Screen Feed - Rendered as texture on the mesh */}
    {phoneScreenRef.current && (
<WatchlistPhoneTexture
  meshRef={phoneScreenRef.current}
  
  // Activity triggers
  justLitOffering={justLitOffering}
  // stakingEvents={stakingEvent}  // Add when staking events are available
  // tradeAlerts={tradeAlert}      // Add when Trade School integration is ready
  
  // Stats for footer
  candleCount={522}
  totalBurned={280000}
  totalStaked={15000000}
  onlineCount={47}
  
  user={user}
/>
    )}
    
    {/* Clickable overlay for phone - positioned approximately where the phone is */}
    <Box
      position={[0, 0.3, 1.0]}  // Adjusted to better match phone position
      rotation={[0, 0, 0]}
      scale={[0.6, 1.0, 0.2]}
      onPointerDown={(e) => {
        e.stopPropagation();
        isDragging.current = true;
        swipeStartY.current = e.clientY;
        
        // For touch devices, track if it's a touch event
        const isTouch = e.pointerType === 'touch';
        if (isTouch) {
          phoneSwipeHandlers.current?.startBrowsing();
        }
      }}
      onPointerMove={(e) => {
        if (isDragging.current && e.pointerType === 'touch' && phoneSwipeHandlers.current) {
          e.stopPropagation();
          const deltaY = e.clientY - swipeStartY.current;
          
          // Touch swipe threshold
          if (Math.abs(deltaY) > 20) { // Higher threshold for touch
            if (deltaY < 0) { // Swipe up = next
              phoneSwipeHandlers.current.swipeDown();
            } else { // Swipe down = previous
              phoneSwipeHandlers.current.swipeUp();
            }
            swipeStartY.current = e.clientY;
          }
        }
      }}
      onPointerUp={(e) => {
        e.stopPropagation();
        const wasDragging = isDragging.current;
        isDragging.current = false;
        
        const deltaY = Math.abs(e.clientY - swipeStartY.current);
        // For mouse/non-touch, any click toggles focus mode
        // For touch, only tap (no movement) toggles focus mode
        if (wasDragging && (e.pointerType !== 'touch' || deltaY < 10)) {
          handlePhoneClick();
        }
      }}
      onPointerLeave={(e) => {
        isDragging.current = false;
      }}
      onPointerOver={() => {
        document.body.style.cursor = 'pointer';
      }}
      onPointerOut={() => {
        document.body.style.cursor = 'default';
      }}
    >
      <meshBasicMaterial transparent opacity={0} depthWrite={false} visible={false} />
    </Box>
    
    {/* Aura that follows phoneCase world position */}
    {raysVisible && (
      <PhoneAura
        phonePosition={[
          phoneCaseWorldPos[0], 
          phoneCaseWorldPos[1] + 3,  // Use actual phone position
          phoneCaseWorldPos[2] + 3
        ]}
        phoneRotation={phoneCaseWorldRotation}
        color={phoneAuraColor}
        intensity={phoneAuraIntensity}
        size={phoneAuraSize}
        opacity={phoneAuraOpacity}
        isActive={hasActiveClick}
        priceDirection={priceChange / 5}
      />
    )}
    
    {/* EmojiRain attached to phone position */}
    {!is80sMode && phoneScreenRef.current && (
      <Html
        position={[
          phoneCaseWorldPos[0], 
          phoneCaseWorldPos[1], 
          phoneCaseWorldPos[2]
        ]}
        center
        style={{
          width: '400px',
          height: '600px',
          pointerEvents: 'none'
        }}
      >
        {/* <EmojiRain 
          priceChange={priceChange}
          isActive={!is80sMode}
          position={{ x: '50%', y: '50%' }}
          spread={100}
          maxEmojis={8}
        /> */}
      </Html>
    )}
  </group>
)
}

function MouseTracker({ setMousePosition }) {
  const { pointer } = useThree()
  const frameCount = useRef(0)
  
  useFrame(() => {
    // Throttle updates to every 2nd frame for better performance
    frameCount.current++
    if (frameCount.current % 2 === 0) {
      setMousePosition({
        x: pointer.x,
        y: pointer.y
      })
    }
  })
  
  return null
}

// Camera controller for focus mode animation
export function CameraController({ focusMode, controlsRef }) {
  const { camera } = useThree()
  const targetPosition = useRef(new THREE.Vector3(0, 0, 5))  // Start from default camera position
  const currentPosition = useRef(new THREE.Vector3(0, 0, 5))  // Initialize at camera default
  const targetLookAt = useRef(new THREE.Vector3(0, 0, 0))
  const currentLookAt = useRef(new THREE.Vector3(0, 0, 0))
  const targetFOV = useRef(45)  // Default FOV
  const currentFOV = useRef(45)
  const hasLoggedRef = useRef(false)
  
  // Initialize camera position
  useEffect(() => {
    camera.position.set(0, 0, 5)
    currentPosition.current.set(0, 0, 5)
    targetPosition.current.set(0, 0, 5)
    camera.fov = 45
    currentFOV.current = 45
    camera.updateProjectionMatrix()
  }, [camera])
  
  useFrame(() => {
    // Set target position, look-at, and FOV based on focus mode
    if (focusMode) {
      // Move camera closer to the phone while maintaining forward view
      // Reduce FOV for zoom effect (like telephoto lens)
      targetPosition.current.set(0, 0.7, 2.5) // Get closer to phone
      targetLookAt.current.set(0, 0.0, 0) // Look slightly up at phone
      targetFOV.current = 30 // Narrow FOV for dramatic zoom effect
      if (!hasLoggedRef.current) {
        hasLoggedRef.current = true
      }
    } else {
      // Default view position
      targetPosition.current.set(0, 0, 5) 
      targetLookAt.current.set(0, 0, 0)
      targetFOV.current = 45 // Normal FOV
      hasLoggedRef.current = false
    }
    
    // Smooth lerp to target position and FOV
    currentPosition.current.lerp(targetPosition.current, 0.08)
    currentLookAt.current.lerp(targetLookAt.current, 0.08)
    currentFOV.current = THREE.MathUtils.lerp(currentFOV.current, targetFOV.current, 0.08)
    
    camera.position.copy(currentPosition.current)
    camera.lookAt(currentLookAt.current)
    
    // Update FOV if it changed significantly
    if (Math.abs(camera.fov - currentFOV.current) > 0.01) {
      camera.fov = currentFOV.current
      camera.updateProjectionMatrix()
    }
    
    // Update OrbitControls to prevent conflicts
    if (controlsRef?.current) {
      controlsRef.current.target.copy(currentLookAt.current)
      controlsRef.current.update()
    }
  })
  
  return null
}

// Removed LoadingBox - no fallback cube needed

export default function HandsGLTFScene({ onLoadComplete, offerings, hoveredOffering, justLitOffering, onJustLitComplete, priceChange = 0, is80sMode = false, user = null }) {
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 })
  // Scroll tracking removed - no longer needed
  const [isMobile, setIsMobile] = useState(false)
  const [showClickIndicator, setShowClickIndicator] = useState(false)
  const [modelLoaded, setModelLoaded] = useState(false)
  const containerRef = useRef(null)
  const controlsRef = useRef(null)
  const [hasReachedSection, setHasReachedSection] = useState(false)
  const [isInView, setIsInView] = useState(false) // Track if currently in view
  const [focusMode, setFocusMode] = useState(false) // Track focus mode for phone zoom
  
  // Track when component comes into view using Intersection Observer
  useEffect(() => {
    if (!containerRef.current) return

    const observer = new IntersectionObserver(
      ([entry]) => {

        
        setIsInView(entry.isIntersecting)
        
        if (entry.isIntersecting && !hasReachedSection) {
          setHasReachedSection(true)
        }
      },
      {
        threshold: 0.1, // Trigger when 10% of component is visible
        rootMargin: '0px 0px 0px 0px'
      }
    )

    observer.observe(containerRef.current)

    return () => {
      observer.disconnect()
    }
  }, [hasReachedSection])
  
  // COMMENTED OUT: Memory monitoring to reduce overhead
  // useEffect(() => {
  //   const logMemory = () => {
  //     if (performance.memory) {
  //       console.log('JS Memory:', Math.round(performance.memory.usedJSHeapSize / 1048576) + 'MB')
  //     }
  //   }
  //   const interval = setInterval(logMemory, 5000)
  //   return () => clearInterval(interval)
  // }, [])
  
  // Mobile detection
  useEffect(() => {
    const checkMobile = () => {
      if (typeof window !== 'undefined') {
        setIsMobile(window.innerWidth < 768)
      }
    }
    checkMobile()
    if (typeof window !== 'undefined') {
      window.addEventListener('resize', checkMobile)
      return () => window.removeEventListener('resize', checkMobile)
    }
  }, [])

  // Fix sticky OrbitControls on mouse release
  useEffect(() => {
    const handleMouseUp = () => {
      if (controlsRef.current) {
        // Force the controls to stop any ongoing rotation
        controlsRef.current.enabled = false
        setTimeout(() => {
          if (controlsRef.current) {
            controlsRef.current.enabled = true
          }
        }, 0)
      }
    }

    window.addEventListener('mouseup', handleMouseUp)
    window.addEventListener('mouseleave', handleMouseUp)
    window.addEventListener('touchend', handleMouseUp)

    return () => {
      window.removeEventListener('mouseup', handleMouseUp)
      window.removeEventListener('mouseleave', handleMouseUp)
      window.removeEventListener('touchend', handleMouseUp)
    }
  }, [])

  // Scroll listener removed - no longer needed for rotation
  
  return (
    <div 
      ref={containerRef}
      style={{ 
        width: '100%', 
        height: '100%', 
        position: 'relative',
        overflow: 'hidden',
        pointerEvents: 'auto',  // Enable pointer events
        isolation: 'isolate'
      }}>
      
      
      {/* Focus Mode Indicator */}
      {focusMode && (
        <div
          style={{
            position: 'absolute',
            top: '20px',
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(0, 0, 0, 0.7)',
            color: '#00ff66',
            padding: '10px 20px',
            borderRadius: '20px',
            fontSize: '14px',
            fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
            zIndex: 100,
            pointerEvents: 'none',
            border: '1px solid #00ff66',
            backdropFilter: 'blur(10px)'
          }}
        >
          📱 Focus Mode • Click phone to exit
        </div>
      )}
      
      {/* 3D Canvas */}
      <Canvas
        camera={{ position: [0, 0, 5], fov: 45 }}
        style={{ 
          width: '100%', 
          height: '100%',
          position: 'absolute',
          top: 0,
          left: 0,
          pointerEvents: 'auto' // Enable pointer events for hands interaction
        }}
        gl={{ 
          alpha: true, 
          antialias: false, // Reduced for memory optimization
          powerPreference: "high-performance",
          stencil: false,
          depth: true
        }}
        // dpr={Math.min(window.devicePixelRatio, 2)} // Limit DPR for memory
      >
        <ambientLight intensity={0.5} />
        <directionalLight position={[10, 10, 5]} intensity={1} />
        <pointLight position={[-10, -10, -10]} intensity={1} />
        
        <Suspense fallback={null}>
          <HandsModel 
            mousePosition={mousePosition} 
            hasReachedSection={hasReachedSection}
            isInView={isInView}
            offerings={offerings}
            hoveredOffering={hoveredOffering}
            justLitOffering={justLitOffering}
            onJustLitComplete={onJustLitComplete}
            priceChange={priceChange}
            is80sMode={is80sMode}
            user={user}
            onPhoneClick={() => {
              setFocusMode(!focusMode);
            }}
            onLoad={() => {
              setModelLoaded(true);
              if (onLoadComplete) onLoadComplete();
            }}
          />
        </Suspense>

        {/* Camera controller for focus mode */}
        <CameraController focusMode={focusMode} controlsRef={controlsRef} />

        {/* DISABLED: MouseTracker for memory leak testing */}
        {/* <MouseTracker setMousePosition={setMousePosition} /> */}
        
        {/* OrbitControls for rotation - only on drag, disabled in focus mode */}
        <OrbitControls 
          ref={controlsRef}
          enabled={!focusMode}
          enablePan={false}
          enableZoom={false}
          enableRotate={true}
          maxPolarAngle={Math.PI * 0.6}  // Can look slightly down (about 18° below horizontal)
          minPolarAngle={Math.PI / 3}    // Can look up (about 30° above horizontal)
          enableDamping={true}
          dampingFactor={0.1}
          rotateSpeed={0.5}
          mouseButtons={{
            LEFT: THREE.MOUSE.ROTATE,
            MIDDLE: null,
            RIGHT: null
          }}
          touches={{
            ONE: THREE.TOUCH.ROTATE,
            TWO: null
          }}
          onEnd={() => {
            // Force release of any stuck state
            if (controlsRef.current) {
              controlsRef.current.enabled = true
            }
          }}
        />
        
        {/* Post-processing effects - disabled on mobile for performance */}
        {!isMobile && (
          <EffectComposer>
            <Bloom 
              intensity={0.2}
              luminanceThreshold={0.3}
              luminanceSmoothing={0.9}
              mipmapBlur
              radius={0.7}
            />
          </EffectComposer>
        )}
      </Canvas>
      

      
      {/* CSS for animations */}
      <style jsx>{`
        @keyframes pulse {
          0% {
            transform: scale(0.5);
            opacity: 1;
          }
          100% {
            transform: scale(2);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  )
}