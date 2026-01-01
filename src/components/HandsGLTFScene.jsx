'use client'
import { useRef, useState, useEffect, Suspense, useCallback, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, useGLTF, Box, useCursor } from '@react-three/drei'

// Preload the model immediately when module loads
useGLTF.preload('/models/hands3.glb')
import { EffectComposer, Bloom } from '@react-three/postprocessing'
import * as THREE from 'three'
import { db } from '@/lib/firebaseClient'
import { collection, query, getDocs, limit, orderBy, onSnapshot } from 'firebase/firestore'
import { m } from 'framer-motion'
import { PhoneScreenFeed3D } from './Phonescreenfeed'
import { PhoneScreenTexture } from './PhoneScreenTexture'


function HandsModel({ mousePosition, scrollY, onLoad, hasReachedSection, isInView, offerings, hoveredOffering, justLitOffering, onJustLitComplete, userRotation = 0 }) {
  const gltf = useGLTF('/models/hands3.glb')
  const hasReportedLoad = useRef(false)
  const rightHandRef = useRef()
  const leftHandRef = useRef()
  const emoji1Ref = useRef()
  const emoji2Ref = useRef()
  const emoji3Ref = useRef()
  const emoji4Ref = useRef()
  const emoji5Ref = useRef()
  const iconLikeRef = useRef()
  const iconLoveRef = useRef()
  const iconText1Ref = useRef()
  const iconText2Ref = useRef()
  const iconPlayRef = useRef()
  const iconStarRef = useRef()
  const candleLabel2Ref = useRef()
  const phoneScreenRef = useRef()
  const [randomUserImages, setRandomUserImages] = useState([])
  const [currentImageIndex, setCurrentImageIndex] = useState(0)
  const [rotationProgress, setRotationProgress] = useState(0)
  const [hovered, setHovered] = useState(false)
  const [clickFeedback, setClickFeedback] = useState(false)
  const [imageTransition, setImageTransition] = useState(false)
  const animationStartTime = useRef(null)
  const lastMousePosition = useRef({ x: 0, y: 0 })
  const mouseVelocity = useRef({ x: 0, y: 0 })
  const randomUserImagesRef = useRef([])
  const currentImageIndexRef = useRef(0)
  const texturePoolRef = useRef([]) // Pool of textures to reuse
  const canvasPoolRef = useRef([]) // Pool of canvas elements to reuse
  const materialPoolRef = useRef([]) // Pool of materials to reuse
  const { camera } = useThree()
  const [swivelRotation, setSwivelRotation] = useState(0) // Track swivel rotation progress
  const swivelDirection = useRef('forward') // Track animation direction
  const animationStartTime2 = useRef(null) // Track animation start time

  // COMMENTED OUT: Image advance functionality for memory testing
  // const handleImageAdvance = useCallback(() => {
  //   try {
  //     console.log('handleImageAdvance called. Images available:', randomUserImagesRef.current.length)
      
  //     // Add safety checks
  //     if (!randomUserImagesRef.current || randomUserImagesRef.current.length === 0) {
  //       console.warn('No images available for advancing')
  //       return
  //     }
      
  //     if (randomUserImagesRef.current.length > 1 && !imageTransition) {
  //       // console.log('Current image index before:', currentImageIndexRef.current)
        
  //       // Trigger visual feedback
  //       setClickFeedback(true)
  //       setImageTransition(true)
        
  //       // Advance image with bounds checking
  //       setCurrentImageIndex((prevIndex) => {
  //         const newIndex = (prevIndex + 1) % randomUserImagesRef.current.length
  //         // console.log('Advancing from index', prevIndex, 'to', newIndex)
  //         currentImageIndexRef.current = newIndex
  //         return newIndex
  //       })
        
  //       // Reset feedback after animation (cleanup optimization)
  //       setTimeout(() => {
  //         setClickFeedback(false)
  //         setImageTransition(false)
  //       }, 600)
  //     }
  //   } catch (error) {
  //     console.error('Error in handleImageAdvance:', error)
  //   }
  // }, [imageTransition])
  


  
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
  useEffect(() => {
    // console.log('GLTF loaded:', gltf)
    if (gltf.scene && !hasReportedLoad.current && onLoad) {
      hasReportedLoad.current = true;
      // console.log('[HandsModel] Model loaded, reporting to parent');
      onLoad();
    }
    
    if (gltf.scene) {
      // console.log('Scene found:', gltf.scene)
      
      
      // Traverse the scene to find specific objects
      gltf.scene.traverse((child) => {
        // console.log('Found object:', child.name, 'Type:', child.type)
        
        // Look for VCANDLE001 and its Label2 child
        if (child.name === 'VCANDLE001' || child.name === 'VCandle001' || child.name === 'vcandle001') {
          // console.log('Found VCANDLE001 candle object!')
          
          // COMMENTED OUT: Click handlers for memory testing
          // child.userData.onClick = handleImageAdvance
          // child.userData.clickable = true
          
          child.traverse((subChild) => {
            if (subChild.name === 'Label2' || subChild.name === 'label2') {
              // console.log('Found Label2 under VCANDLE001!')
              candleLabel2Ref.current = subChild
              
              // COMMENTED OUT: Click handler for memory testing
              // subChild.userData.onClick = handleImageAdvance
              // subChild.userData.clickable = true
            }
          })
        }
        
        // Also check if Label2 is directly in the scene
        if ((child.name === 'Label2' || child.name === 'label2') && child.isMesh) {
          // console.log('Found Label2 mesh directly!')
          if (!candleLabel2Ref.current) {
            candleLabel2Ref.current = child
            
            // COMMENTED OUT: Click handler for memory testing
            // child.userData.onClick = handleImageAdvance
            // child.userData.clickable = true
          }
        }
        
        // Look for PhoneScreen mesh
        if (child.name === 'PhoneScreen' || child.name === 'phonescreen' || child.name === 'phone_screen' || 
            child.name === 'Phone_Screen' || child.name.toLowerCase().includes('phonescreen')) {
          console.log('Found PhoneScreen mesh:', child.name, 'Type:', child.type, 'World Position:', child.getWorldPosition(new THREE.Vector3()))
          phoneScreenRef.current = child
        }
        
        // Log all objects that contain 'emoji' or 'icon' in the name (case insensitive)
        if (child.name.toLowerCase().includes('emoji')) {
          // console.log('🟡 EMOJI FOUND:', child.name, 'Type:', child.type, 'Position:', child.position)
        }
        if (child.name.toLowerCase().includes('icon')) {
          // console.log('🔵 ICON FOUND:', child.name, 'Type:', child.type, 'Position:', child.position)
        }
        if (child.name === 'hand-r' || child.name === 'hand_r' || child.name === 'Hand-R' || 
            child.name.toLowerCase().includes('hand') && child.name.toLowerCase().includes('r')) {
          rightHandRef.current = child
          // console.log('Found right hand:', child.name, 'Position:', child.position)
          // console.log('Right hand type:', child.type)
          // console.log('Right hand children:', child.children.length)
          // console.log('Right hand world position:', child.getWorldPosition(new THREE.Vector3()))
          
          // if (child.type === 'Object3D' && child.children.length > 0) {
          //   console.log('Right hand is a group, children:', child.children.map(c => ({name: c.name, type: c.type})))
          //   // Store reference to the group itself - we'll move the whole group
          //   console.log('Moving entire hand group for better control')
          // }
        }
        // if (child.name === 'hand-l' || child.name === 'hand_l' || child.name === 'Hand-L') {
        //   leftHandRef.current = child
        //   console.log('Found left hand:', child.name)
        // }
        
        // Find emoji objects with flexible matching
        if (child.name === 'Emoji-1' || child.name === 'emoji-1' || child.name === 'Emoji1') {
          emoji1Ref.current = child
          // console.log('✅ Found Emoji-1:', child.name, 'Position:', child.position)
        }
        if (child.name === 'Emoji-2' || child.name === 'emoji-2' || child.name === 'Emoji2') {
          emoji2Ref.current = child
          // console.log('✅ Found Emoji-2:', child.name, 'Position:', child.position)
        }
        if (child.name === 'Emoji-3' || child.name === 'emoji-3' || child.name === 'Emoji3') {
          emoji3Ref.current = child
          // console.log('✅ Found Emoji-3:', child.name, 'Position:', child.position)
        }
        if (child.name === 'Emoji-4' || child.name === 'emoji-4' || child.name === 'Emoji4') {
          emoji4Ref.current = child
          // console.log('✅ Found Emoji-4:', child.name, 'Position:', child.position)
        }
         if (child.name === 'Emoji-5' || child.name === 'emoji-5' || child.name === 'Emoji5') {
          emoji5Ref.current = child
          // console.log('✅ Found Emoji-5:', child.name, 'Position:', child.position)
        }
        
        // Find icon objects
        if (child.name === 'Icon-text3' || child.name === 'icon-like' || child.name === 'IconLike') {
          iconLikeRef.current = child
          // console.log('✅ Found Icon-like:', child.name, 'Position:', child.position)
        }
        if (child.name === 'Icon-love' || child.name === 'icon-love' || child.name === 'IconLove') {
          iconLoveRef.current = child
          // console.log('✅ Found Icon-love:', child.name, 'Position:', child.position)
        }
        if (child.name === 'Icon-text-1' || child.name === 'icon-text-1' || child.name === 'IconText1') {
          iconText1Ref.current = child
          // console.log('✅ Found Icon-text-1:', child.name, 'Position:', child.position)
        }
        if (child.name === 'Icon-text-2' || child.name === 'icon-text-2' || child.name === 'IconText2') {
          iconText2Ref.current = child
          // console.log('✅ Found Icon-text-2:', child.name, 'Position:', child.position)
        }
        if (child.name === 'Icon-play' || child.name === 'icon-play' || child.name === 'IconPlay') {
          iconPlayRef.current = child
          // console.log('✅ Found Icon-play:', child.name, 'Position:', child.position)
        }
        if (child.name === 'Icon-star' || child.name === 'icon-star' || child.name === 'IconStar') {
          iconStarRef.current = child
          // console.log('✅ Found Icon-star:', child.name, 'Position:', child.position)
        }
        
        // Fix Backdrop transparency issue with bloom
        if (child.name === 'Backdrop' || child.name === 'backdrop' || child.name.toLowerCase().includes('backdrop')) {
          if (child.isMesh && child.material) {
            // console.log('Found Backdrop mesh, fixing transparency for bloom')
            // Set the material to not be affected by post-processing
            child.material.toneMapped = false
            // Ensure proper transparency handling
            child.material.transparent = true
            child.material.alphaTest = 0.9 // Discard pixels below 50% opacity
            child.material.depthWrite = false // Prevent depth writing issues
            // Remove any emissive properties that might interact with bloom
            child.material.emissive = new THREE.Color(0x000000)
            child.material.emissiveIntensity = 0
            child.material.needsUpdate = true
          }
        }
      })
      

    }
  }, [gltf])

  
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

  // SIMPLIFIED: Basic texture application (no complex disposal)
  useEffect(() => {
    if (!candleLabel2Ref.current || randomUserImages.length === 0) {
      return
    }
    
    const imageData = randomUserImages[0] // Only use first image
    if (!imageData?.image) return
    
    // Simple texture loading without complex memory management
    const canvas = document.createElement('canvas')
    canvas.width = 128
    canvas.height = 128
    const ctx = canvas.getContext('2d')
    
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
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
      
      const texture = new THREE.CanvasTexture(canvas)
      texture.needsUpdate = true
      texture.generateMipmaps = false
      texture.flipY = false // No additional flipping needed
      texture.wrapS = THREE.ClampToEdgeWrapping
      texture.wrapT = THREE.ClampToEdgeWrapping
      
      const material = new THREE.MeshBasicMaterial({
        map: texture,
        side: THREE.DoubleSide
      })
      
      candleLabel2Ref.current.material = material
    }
    img.src = imageData.image
  }, [randomUserImages])

  // COMMENTED OUT: Complex texture management
  // const imageData = randomUserImages[currentImageIndex]
  // ... rest of complex texture management code removed ...

  // Trigger swivel animation based on view state
  useEffect(() => {
    if (isInView && swivelDirection.current === 'forward') {
      console.log('🔄 Starting forward swivel animation!')
      animationStartTime2.current = Date.now()
    } else if (!isInView && swivelDirection.current === 'reverse') {
      console.log('🔄 Starting reverse swivel animation!')
      animationStartTime2.current = Date.now()
    }
  }, [isInView])

  // // Memoized rotation calculation
  // const calculateRotation = useMemo(() => {
  //   const initialRotation = -Math.PI * 0.8
    
  //   // If animation hasn't started yet, keep initial rotation
  //   if (!animationStartTime.current) {
  //     return initialRotation
  //   }
    
  //   // Interpolate from initial rotation to 0 based on animation progress
  //   const rotation = initialRotation * (1 - rotationProgress)
    
  //   return rotation
  // }, [rotationProgress])

// Combined animations useFrame
useFrame((state) => {
  // Swivel animation
  if (animationStartTime2.current) {
    const elapsed = Date.now() - animationStartTime2.current
    const duration = 2000 // 2 seconds for full rotation
    const progress = Math.min(elapsed / duration, 1)
    
    // Use easeInOutCubic for smooth animation
    const easedProgress = progress < 0.5
      ? 4 * progress * progress * progress
      : 1 - Math.pow(-2 * progress + 2, 3) / 2
    
    if (isInView) {
      // Forward animation (0 to PI)
      setSwivelRotation(easedProgress * Math.PI)
      if (progress === 1) {
        swivelDirection.current = 'reverse'
        animationStartTime2.current = null
      }
    } else {
      // Reverse animation (PI to 0)
      setSwivelRotation((1 - easedProgress) * Math.PI)
      if (progress === 1) {
        swivelDirection.current = 'forward'
        animationStartTime2.current = null
      }
    }
  }

  // Floating animations for emojis and icons
  const time = state.clock.getElapsedTime()
  
  // Animate emojis with more dynamic floating motion
  if (emoji1Ref.current) {
    if (!emoji1Ref.current.userData.initialY) {
      emoji1Ref.current.userData.initialY = emoji1Ref.current.position.y
      emoji1Ref.current.userData.initialX = emoji1Ref.current.position.x
      emoji1Ref.current.userData.initialZ = emoji1Ref.current.position.z
    }
    emoji1Ref.current.position.y = emoji1Ref.current.userData.initialY + Math.sin(time * 1.5) * 0.6
    emoji1Ref.current.position.x = emoji1Ref.current.userData.initialX + Math.cos(time * 1.2) * 0.4
    emoji1Ref.current.position.z = emoji1Ref.current.userData.initialZ + Math.sin(time * 1.0) * 0.3
    emoji1Ref.current.rotation.z = Math.sin(time * 1.5) * 0.2
    emoji1Ref.current.rotation.y = Math.cos(time * 1.8) * 0.15
  }
  
  if (emoji2Ref.current) {
    if (!emoji2Ref.current.userData.initialY) {
      emoji2Ref.current.userData.initialY = emoji2Ref.current.position.y
      emoji2Ref.current.userData.initialX = emoji2Ref.current.position.x
      emoji2Ref.current.userData.initialZ = emoji2Ref.current.position.z
    }
    emoji2Ref.current.position.y = emoji2Ref.current.userData.initialY + Math.sin(time * 1.8 + 1) * 0.5
    emoji2Ref.current.position.x = emoji2Ref.current.userData.initialX + Math.cos(time * 1.4 + 1) * 0.35
    emoji2Ref.current.position.z = emoji2Ref.current.userData.initialZ + Math.sin(time * 1.2 + 1) * 0.25
    emoji2Ref.current.rotation.z = Math.sin(time * 1.8 + 1) * 0.18
    emoji2Ref.current.rotation.x = Math.cos(time * 2.0 + 1) * 0.12
  }
  
  if (emoji3Ref.current) {
    if (!emoji3Ref.current.userData.initialY) {
      emoji3Ref.current.userData.initialY = emoji3Ref.current.position.y
      emoji3Ref.current.userData.initialX = emoji3Ref.current.position.x
      emoji3Ref.current.userData.initialZ = emoji3Ref.current.position.z
    }
    emoji3Ref.current.position.y = emoji3Ref.current.userData.initialY + Math.sin(time * 1.6 + 2) * 0.7
    emoji3Ref.current.position.x = emoji3Ref.current.userData.initialX + Math.cos(time * 1.3 + 2) * 0.45
    emoji3Ref.current.position.z = emoji3Ref.current.userData.initialZ + Math.sin(time * 1.1 + 2) * 0.35
    emoji3Ref.current.rotation.z = Math.sin(time * 2.0 + 2) * 0.25
    emoji3Ref.current.rotation.y = Math.cos(time * 1.7 + 2) * 0.2
  }
  
  if (emoji4Ref.current) {
    if (!emoji4Ref.current.userData.initialY) {
      emoji4Ref.current.userData.initialY = emoji4Ref.current.position.y
      emoji4Ref.current.userData.initialX = emoji4Ref.current.position.x
      emoji4Ref.current.userData.initialZ = emoji4Ref.current.position.z
    }
    emoji4Ref.current.position.y = emoji4Ref.current.userData.initialY + Math.sin(time * 1.7 + 3) * 0.55
    emoji4Ref.current.position.x = emoji4Ref.current.userData.initialX + Math.cos(time * 1.5 + 3) * 0.38
    emoji4Ref.current.position.z = emoji4Ref.current.userData.initialZ + Math.sin(time * 1.3 + 3) * 0.28
    emoji4Ref.current.rotation.z = Math.sin(time * 1.9 + 3) * 0.22
    emoji4Ref.current.rotation.x = Math.cos(time * 1.6 + 3) * 0.14
  }
  
  if (emoji5Ref.current) {
    if (!emoji5Ref.current.userData.initialY) {
      emoji5Ref.current.userData.initialY = emoji5Ref.current.position.y
      emoji5Ref.current.userData.initialX = emoji5Ref.current.position.x
      emoji5Ref.current.userData.initialZ = emoji5Ref.current.position.z
    }
    emoji5Ref.current.position.y = emoji5Ref.current.userData.initialY + Math.sin(time * 1.4 + 4) * 0.65
    emoji5Ref.current.position.x = emoji5Ref.current.userData.initialX + Math.cos(time * 1.6 + 4) * 0.42
    emoji5Ref.current.position.z = emoji5Ref.current.userData.initialZ + Math.sin(time * 1.4 + 4) * 0.32
    emoji5Ref.current.rotation.z = Math.sin(time * 1.7 + 4) * 0.23
    emoji5Ref.current.rotation.y = Math.cos(time * 2.1 + 4) * 0.18
  }
  
  // Animate icons with more noticeable floating motion
  if (iconLikeRef.current) {
    if (!iconLikeRef.current.userData.initialY) {
      iconLikeRef.current.userData.initialY = iconLikeRef.current.position.y
      iconLikeRef.current.userData.initialX = iconLikeRef.current.position.x
      iconLikeRef.current.userData.initialZ = iconLikeRef.current.position.z
    }
    iconLikeRef.current.position.y = iconLikeRef.current.userData.initialY + Math.sin(time * 2.0 + 5) * 0.4
    iconLikeRef.current.position.x = iconLikeRef.current.userData.initialX + Math.cos(time * 1.7 + 5) * 0.25
    iconLikeRef.current.position.z = iconLikeRef.current.userData.initialZ + Math.sin(time * 1.5 + 5) * 0.2
    iconLikeRef.current.rotation.z = Math.sin(time * 2.2 + 5) * 0.15
  }
  
  if (iconLoveRef.current) {
    if (!iconLoveRef.current.userData.initialY) {
      iconLoveRef.current.userData.initialY = iconLoveRef.current.position.y
      iconLoveRef.current.userData.initialX = iconLoveRef.current.position.x
      iconLoveRef.current.userData.initialZ = iconLoveRef.current.position.z
    }
    iconLoveRef.current.position.y = iconLoveRef.current.userData.initialY + Math.sin(time * 1.9 + 6) * 0.45
    iconLoveRef.current.position.x = iconLoveRef.current.userData.initialX + Math.cos(time * 1.6 + 6) * 0.3
    iconLoveRef.current.position.z = iconLoveRef.current.userData.initialZ + Math.sin(time * 1.4 + 6) * 0.22
    iconLoveRef.current.rotation.z = Math.sin(time * 2.1 + 6) * 0.14
    iconLoveRef.current.rotation.y = Math.cos(time * 1.8 + 6) * 0.12
  }
  
  if (iconText1Ref.current) {
    if (!iconText1Ref.current.userData.initialY) {
      iconText1Ref.current.userData.initialY = iconText1Ref.current.position.y
      iconText1Ref.current.userData.initialX = iconText1Ref.current.position.x
      iconText1Ref.current.userData.initialZ = iconText1Ref.current.position.z
    }
    iconText1Ref.current.position.y = iconText1Ref.current.userData.initialY + Math.sin(time * 1.7 + 7) * 0.5
    iconText1Ref.current.position.x = iconText1Ref.current.userData.initialX + Math.cos(time * 1.9 + 7) * 0.28
    iconText1Ref.current.position.z = iconText1Ref.current.userData.initialZ + Math.sin(time * 1.3 + 7) * 0.24
    iconText1Ref.current.rotation.z = Math.sin(time * 1.8 + 7) * 0.18
  }
  
  if (iconText2Ref.current) {
    if (!iconText2Ref.current.userData.initialY) {
      iconText2Ref.current.userData.initialY = iconText2Ref.current.position.y
      iconText2Ref.current.userData.initialX = iconText2Ref.current.position.x
      iconText2Ref.current.userData.initialZ = iconText2Ref.current.position.z
    }
    iconText2Ref.current.position.y = iconText2Ref.current.userData.initialY + Math.sin(time * 2.1 + 8) * 0.38
    iconText2Ref.current.position.x = iconText2Ref.current.userData.initialX + Math.cos(time * 1.8 + 8) * 0.22
    iconText2Ref.current.position.z = iconText2Ref.current.userData.initialZ + Math.sin(time * 1.6 + 8) * 0.18
    iconText2Ref.current.rotation.z = Math.sin(time * 2.3 + 8) * 0.13
  }
  
  if (iconPlayRef.current) {
    if (!iconPlayRef.current.userData.initialY) {
      iconPlayRef.current.userData.initialY = iconPlayRef.current.position.y
      iconPlayRef.current.userData.initialX = iconPlayRef.current.position.x
      iconPlayRef.current.userData.initialZ = iconPlayRef.current.position.z
    }
    iconPlayRef.current.position.y = iconPlayRef.current.userData.initialY + Math.sin(time * 2.2 + 9) * 0.42
    iconPlayRef.current.position.x = iconPlayRef.current.userData.initialX + Math.cos(time * 2.0 + 9) * 0.26
    iconPlayRef.current.position.z = iconPlayRef.current.userData.initialZ + Math.sin(time * 1.7 + 9) * 0.2
    iconPlayRef.current.rotation.z = Math.sin(time * 2.0 + 9) * 0.16
  }
  
  if (iconStarRef.current) {
    if (!iconStarRef.current.userData.initialY) {
      iconStarRef.current.userData.initialY = iconStarRef.current.position.y
      iconStarRef.current.userData.initialX = iconStarRef.current.position.x
      iconStarRef.current.userData.initialZ = iconStarRef.current.position.z
    }
    iconStarRef.current.position.y = iconStarRef.current.userData.initialY + Math.sin(time * 1.8 + 10) * 0.52
    iconStarRef.current.position.x = iconStarRef.current.userData.initialX + Math.cos(time * 2.1 + 10) * 0.32
    iconStarRef.current.position.z = iconStarRef.current.userData.initialZ + Math.sin(time * 1.5 + 10) * 0.25
    iconStarRef.current.rotation.z = Math.sin(time * 2.4 + 10) * 0.2
    iconStarRef.current.rotation.y = Math.cos(time * 1.9 + 10) * 0.15
  }
})


// Removed duplicate useFrame and useEffect - functionality merged into main useFrame above

// Memoized click handler to reduce re-renders
const handleClick = useCallback((event) => {
  // Stop propagation to prevent multiple handlers
  event.stopPropagation()
  
  // Get the clicked object
  const clickedObject = event.object
  // console.log('Click detected on object:', clickedObject.name, 'Type:', clickedObject.type)
  
  // Check if the clicked object or any of its parents has a click handler
  let current = clickedObject
  while (current) {
    if (current.userData.onClick) {
      // console.log('Clicked on:', current.name, 'triggering image advance')
      current.userData.onClick()
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
      document.body.style.cursor = 'pointer'
      break
    }
    current = current.parent
  }
}, [])

const handlePointerOut = useCallback(() => {
  setHovered(false)
  document.body.style.cursor = 'default'
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
    
    // Dispose candle material
    if (candleLabel2Ref.current && candleLabel2Ref.current.material) {
      disposeMaterial(candleLabel2Ref.current.material)
    }
    
    // Force browser garbage collection if available
    if (window.gc) {
      window.gc()
      // console.log('Forced garbage collection')
    }
    
    // Clear all object refs
    if (rightHandRef.current) rightHandRef.current = null
    if (leftHandRef.current) leftHandRef.current = null
    if (candleLabel2Ref.current) candleLabel2Ref.current = null
    randomUserImagesRef.current = []
    texturePoolRef.current = []
    
    // console.log('HandsGLTFScene cleanup complete')
  }
}, [disposeTexture, disposeMaterial])

// Get world position and rotation of phone screen if available
const phoneWorldTransform = useMemo(() => {
  if (phoneScreenRef.current) {
    const worldPos = new THREE.Vector3()
    const worldQuat = new THREE.Quaternion()
    const worldScale = new THREE.Vector3()
    phoneScreenRef.current.getWorldPosition(worldPos)
    phoneScreenRef.current.getWorldQuaternion(worldQuat)
    phoneScreenRef.current.getWorldScale(worldScale)
    console.log('📱 Phone screen world position:', worldPos)
    console.log('📱 Offerings available:', offerings?.length || 0)
    return { position: worldPos, quaternion: worldQuat, scale: worldScale }
  }
  return null
}, [phoneScreenRef.current, offerings, hoveredOffering, justLitOffering])

// Return with swivel animation applied
return (
  <group position={[0, -0.7, 0]}> {/* Position hands at bottom of screen */}
    <primitive 
      object={gltf.scene} 
      scale={[0.35, 0.35, 0.35]}
      rotation={[0, Math.PI + swivelRotation + userRotation, 0]} // Combine swivel and user rotation
      onClick={handleClick}
      onPointerOver={handlePointerOver}
      onPointerOut={handlePointerOut}
    />
    
    {/* Phone Screen Feed - Rendered as texture on the mesh */}
    {phoneScreenRef.current && (
      <PhoneScreenTexture
        meshRef={phoneScreenRef.current}
        offerings={offerings}
        hoveredOffering={hoveredOffering}
        justLitOffering={justLitOffering}

        />
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

// Removed LoadingBox - no fallback cube needed

export default function HandsGLTFScene({ onLoadComplete, offerings, hoveredOffering, justLitOffering, onJustLitComplete }) {
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 })
  const [scrollY, setScrollY] = useState(0)
  const [isMobile, setIsMobile] = useState(false)
  const [showClickIndicator, setShowClickIndicator] = useState(false)
  const [modelLoaded, setModelLoaded] = useState(false)
  const containerRef = useRef(null)
  const [hasReachedSection, setHasReachedSection] = useState(false)
  const [isInView, setIsInView] = useState(false) // Track if currently in view
  const [userRotation, setUserRotation] = useState(0) // Track user's manual rotation
  const isDragging = useRef(false)
  const dragStart = useRef({ x: 0, rotation: 0 })
  
  // Simple drag handlers for rotation
  const handlePointerDown = useCallback((event) => {
    isDragging.current = true
    dragStart.current = {
      x: event.clientX,
      rotation: userRotation
    }
    document.body.style.cursor = 'grabbing'
  }, [userRotation])

  const handlePointerMove = useCallback((event) => {
    if (isDragging.current) {
      const deltaX = (event.clientX - dragStart.current.x) * 0.01
      const newRotation = dragStart.current.rotation + deltaX
      setUserRotation(newRotation)
    }
  }, [])

  const handlePointerUp = useCallback(() => {
    isDragging.current = false
    document.body.style.cursor = 'auto'
  }, [])
  
  // Track when component comes into view using Intersection Observer
  useEffect(() => {
    if (!containerRef.current) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        console.log('Intersection Observer triggered:', {
          isIntersecting: entry.isIntersecting,
          intersectionRatio: entry.intersectionRatio
        })
        
        setIsInView(entry.isIntersecting)
        
        if (entry.isIntersecting && !hasReachedSection) {
          console.log('🎯 HandsGLTFScene entered viewport!')
          setHasReachedSection(true)
        }
      },
      {
        threshold: 0.1, // Trigger when 10% of component is visible
        rootMargin: '0px 0px 0px 0px'
      }
    )

    observer.observe(containerRef.current)
    console.log('Intersection Observer set up for container')

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
      setIsMobile(window.innerWidth < 768)
    }
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // Add scroll listener
  useEffect(() => {
    const handleScroll = () => {
      setScrollY(window.scrollY)
    }
    
    window.addEventListener('scroll', handleScroll)
    handleScroll() // Set initial scroll position
    
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])
  
  return (
    <div 
      ref={containerRef}
      style={{ 
        width: '100%', 
        height: '100%', 
        position: 'relative',
        overflow: 'hidden',
        pointerEvents: 'auto',
        isolation: 'isolate'
      }}>
      
      
      {/* 3D Canvas */}
      <Canvas
        camera={{ position: [0, -0.5, 5], fov: 45 }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
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
            scrollY={scrollY}
            hasReachedSection={hasReachedSection}
            isInView={isInView}
            offerings={offerings}
            hoveredOffering={hoveredOffering}
            justLitOffering={justLitOffering}
            onJustLitComplete={onJustLitComplete}
            userRotation={userRotation}
            onLoad={() => {
              setModelLoaded(true);
              if (onLoadComplete) onLoadComplete();
            }}
          />
        </Suspense>
        
        {/* DISABLED: MouseTracker for memory leak testing */}
        {/* <MouseTracker setMousePosition={setMousePosition} /> */}
        
        {/* OrbitControls removed - using manual rotation only */}
        
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