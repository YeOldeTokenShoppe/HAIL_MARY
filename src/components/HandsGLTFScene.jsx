'use client'
import { useRef, useState, useEffect, Suspense, useCallback, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, useGLTF, Box, useCursor } from '@react-three/drei'

// Preload the model immediately when module loads
useGLTF.preload('/models/hands4.glb')
import { EffectComposer, Bloom } from '@react-three/postprocessing'
import * as THREE from 'three'
import { db } from '@/lib/firebaseClient'
import { collection, query, getDocs, limit, orderBy, onSnapshot } from 'firebase/firestore'
import { m } from 'framer-motion'
import { PhoneScreenTexture } from './PhoneScreenTexture'
import { PhoneAura } from './PhoneAura'


export function HandsModel({ mousePosition, onLoad, hasReachedSection, isInView, offerings, hoveredOffering, justLitOffering, onJustLitComplete, userRotation = 0, priceChange = 0, hasActiveClick = false, is80sMode = false }) {
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
  const modelPath = isMobileLocal ? '/models/hands_MOBILE2.glb' : '/models/hands4.glb'
  const gltf = useGLTF(modelPath)
  const hasReportedLoad = useRef(false)
  const rightHandRef = useRef()
  const leftHandRef = useRef()
  const backdropRef = useRef()
  const emoji1Ref = useRef()
  const emoji2Ref = useRef()
  const emoji3Ref = useRef()
  const emoji4Ref = useRef()
  const emoji5Ref = useRef()
  const worriedEmojiRef = useRef()
  const scaredEmojiRef = useRef()
  const devilEmojiRef = useRef()
  const cryingEmoji2Ref = useRef()
  const pukeEmojiRef = useRef()
  const sadEmojiRef = useRef()
  const questionMarkRef = useRef()
  const questionMark2Ref = useRef()
  const questionMarkMeshes = useRef([])  // Store ALL question mark related meshes
  const exclamationMarkRef = useRef()
  const exclamationMark2Ref = useRef()
  const iconLikeRef = useRef()
  const iconLoveRef = useRef()
  const iconText1Ref = useRef()
  const iconText2Ref = useRef()
  const iconPlayRef = useRef()
  const iconStarRef = useRef()
  const candleLabel2Ref = useRef()
  const phoneScreenRef = useRef()
  const phoneCaseRef = useRef()
  const pacManRef = useRef() // Reference for PacMan parent object
  const pacMan2Ref = useRef() // Reference for second PacMan object
  const [phoneCaseWorldPos, setPhoneCaseWorldPos] = useState([0, 0, 0])
  const [phoneCaseWorldQuat, setPhoneCaseWorldQuat] = useState([0, 0, 0, 1])
  const [raysVisible, setRaysVisible] = useState(true)
  const [randomUserImages, setRandomUserImages] = useState([])
  const [currentImageIndex, setCurrentImageIndex] = useState(0)
  const [hovered, setHovered] = useState(false)
  const randomUserImagesRef = useRef([])
  const currentImageIndexRef = useRef(0)
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
  
  // Debounced price for emoji changes (updates less frequently)
  const debouncedPriceRef = useRef(priceChange)
  const lastEmojiUpdateRef = useRef(0)
  
  // Market status based on debounced price change for emoji stability
  const isLargeDown = debouncedPriceRef.current <= -5 // Large downward price action (5% or more drop)
  const isModerateDown = debouncedPriceRef.current < -2 && debouncedPriceRef.current > -5 // Moderate down
  const isSlightlyNegative = debouncedPriceRef.current < 0 && debouncedPriceRef.current >= -2 // Slightly negative (-2% to 0%)
  const isSlightlyPositive = debouncedPriceRef.current >= 0 && debouncedPriceRef.current <= 2 // Slightly positive (0% to +2%)
  const isModeratelyPositive = debouncedPriceRef.current > 2 && debouncedPriceRef.current <= 5 // Moderately positive (2% to 5%)
  const isLargeUp = debouncedPriceRef.current > 5 // Large upward price action (more than 5% up)
  
  // Opacity targets for smooth fading - store target opacity for each emoji group
  // Initialize based on current price state to ensure correct visibility from start
  const getInitialOpacity = (emojiName) => {
    // Large upward movement - maximum celebration
    if (priceChange > 5) {
      const celebrationEmojis = ['emoji1', 'emoji3', 'emoji4', 'emoji5', 'iconLove', 'iconText1', 'iconText2']
      return celebrationEmojis.includes(emojiName) ? 1 : 0
    }
    // Moderately positive - happy emojis
    else if (priceChange > 2) {
      const positiveEmojis = ['emoji1', 'emoji3', 'emoji4', 'emoji5', 'iconLove']
      return positiveEmojis.includes(emojiName) ? 1 : 0
    }
    // Slightly positive - cautiously optimistic
    else if (priceChange >= 0) {
      const optimisticEmojis = ['emoji1', 'emoji2', 'emoji3']
      return optimisticEmojis.includes(emojiName) ? 1 : 0
    }
    // Slightly negative - mild concern
    else if (priceChange >= -2) {
      const concernedEmojis = ['emoji2', 'worriedEmoji', 'questionMark']
      return concernedEmojis.includes(emojiName) ? 1 : 0
    }
    // Moderate down - worried
    else if (priceChange > -5) {
      const worriedEmojis = ['worriedEmoji', 'scaredEmoji', 'sadEmoji', 'questionMark', 'questionMark2']
      return worriedEmojis.includes(emojiName) ? 1 : 0
    }
    // Large down - panic
    else {
      const panicEmojis = ['worriedEmoji', 'scaredEmoji', 'devilEmoji', 'cryingEmoji2', 'pukeEmoji', 'sadEmoji', 'questionMark', 'questionMark2', 'exclamationMark', 'exclamationMark2']
      return panicEmojis.includes(emojiName) ? 1 : 0
    }
  }
  
  const opacityTargets = useRef({
    emoji1: getInitialOpacity('emoji1'),
    emoji2: getInitialOpacity('emoji2'),
    emoji3: getInitialOpacity('emoji3'),
    emoji4: getInitialOpacity('emoji4'),
    emoji5: getInitialOpacity('emoji5'),
    worriedEmoji: getInitialOpacity('worriedEmoji'),
    scaredEmoji: getInitialOpacity('scaredEmoji'),
    devilEmoji: getInitialOpacity('devilEmoji'),
    cryingEmoji2: getInitialOpacity('cryingEmoji2'),
    pukeEmoji: getInitialOpacity('pukeEmoji'),
    sadEmoji: getInitialOpacity('sadEmoji'),
    questionMark: getInitialOpacity('questionMark'),
    questionMark2: getInitialOpacity('questionMark2'),
    exclamationMark: getInitialOpacity('exclamationMark'),
    exclamationMark2: getInitialOpacity('exclamationMark2'),
    iconLove: getInitialOpacity('iconLove'),
    iconText1: getInitialOpacity('iconText1'),
    iconText2: getInitialOpacity('iconText2')
  })
  
  // Current opacity values for smooth animation - start same as targets
  const currentOpacities = useRef({
    emoji1: getInitialOpacity('emoji1'),
    emoji2: getInitialOpacity('emoji2'),
    emoji3: getInitialOpacity('emoji3'),
    emoji4: getInitialOpacity('emoji4'),
    emoji5: getInitialOpacity('emoji5'),
    worriedEmoji: getInitialOpacity('worriedEmoji'),
    scaredEmoji: getInitialOpacity('scaredEmoji'),
    devilEmoji: getInitialOpacity('devilEmoji'),
    cryingEmoji2: getInitialOpacity('cryingEmoji2'),
    pukeEmoji: getInitialOpacity('pukeEmoji'),
    sadEmoji: getInitialOpacity('sadEmoji'),
    questionMark: getInitialOpacity('questionMark'),
    questionMark2: getInitialOpacity('questionMark2'),
    exclamationMark: getInitialOpacity('exclamationMark'),
    exclamationMark2: getInitialOpacity('exclamationMark2'),
    iconLove: getInitialOpacity('iconLove'),
    iconText1: getInitialOpacity('iconText1'),
    iconText2: getInitialOpacity('iconText2')
  })

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
      
      // Log all available animations
      if (gltf.animations && gltf.animations.length > 0) {
        console.log('📋 All available animations in model:')
        gltf.animations.forEach((clip, index) => {
          console.log(`  ${index}: "${clip.name}" (duration: ${clip.duration}s)`)
        })
      }
      
      // First pass: collect ALL QuestionMark-related objects
      questionMarkMeshes.current = []
      gltf.scene.traverse((child) => {
        if (child.name && (child.name.includes('QuestionMark') || child.name.includes('questionMark') || 
            child.name.includes('QSymbol') || child.name.includes('qsymbol'))) {
          questionMarkMeshes.current.push(child)
          console.log('Collected QuestionMark-related object:', child.name, child.type)
        }
      })
      
      // Second pass: traverse the scene to find specific objects
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
          // console.log('Found PhoneScreen mesh:', child.name, 'Type:', child.type, 'World Position:', child.getWorldPosition(new THREE.Vector3()))
          phoneScreenRef.current = child
        }
        
        // Look for phoneCase mesh for light ray positioning
        if (child.name === 'phoneCase' || child.name === 'PhoneCase' || child.name === 'phone_case') {
          console.log('Found phoneCase mesh:', child.name, 'Type:', child.type, 'World Position:', child.getWorldPosition(new THREE.Vector3()))
          phoneCaseRef.current = child
          
          // Mark that this mesh will have light rays attached
          child.userData.hasLightRays = true
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
          // Hide initially (on mobile and desktop) until price conditions are met
          const initialOpacity = getInitialOpacity('emoji1')
          child.visible = initialOpacity > 0.01
          child.traverse((node) => {
            if (node.isMesh && node.material) {
              node.material.opacity = initialOpacity
              node.material.transparent = true
            }
            node.visible = initialOpacity > 0.01
          })
          // console.log('✅ Found Emoji-1:', child.name, 'Position:', child.position)
        }
        if (child.name === 'Emoji-2' || child.name === 'emoji-2' || child.name === 'Emoji2') {
          emoji2Ref.current = child
          // Hide initially (on mobile and desktop) until price conditions are met
          const initialOpacity = getInitialOpacity('emoji2')
          child.visible = initialOpacity > 0.01
          child.traverse((node) => {
            if (node.isMesh && node.material) {
              node.material.opacity = initialOpacity
              node.material.transparent = true
            }
            node.visible = initialOpacity > 0.01
          })
          // console.log('✅ Found Emoji-2:', child.name, 'Position:', child.position)
        }
        if (child.name === 'Emoji-3' || child.name === 'emoji-3' || child.name === 'Emoji3') {
          emoji3Ref.current = child
          // Hide initially (on mobile and desktop) until price conditions are met
          const initialOpacity = getInitialOpacity('emoji3')
          child.visible = initialOpacity > 0.01
          child.traverse((node) => {
            if (node.isMesh && node.material) {
              node.material.opacity = initialOpacity
              node.material.transparent = true
            }
            node.visible = initialOpacity > 0.01
          })
          // console.log('✅ Found Emoji-3:', child.name, 'Position:', child.position)
        }
        if (child.name === 'Emoji-4' || child.name === 'emoji-4' || child.name === 'Emoji4') {
          emoji4Ref.current = child
          // Hide initially (on mobile and desktop) until price conditions are met
          const initialOpacity = getInitialOpacity('emoji4')
          child.visible = initialOpacity > 0.01
          child.traverse((node) => {
            if (node.isMesh && node.material) {
              node.material.opacity = initialOpacity
              node.material.transparent = true
            }
            node.visible = initialOpacity > 0.01
          })
          // console.log('✅ Found Emoji-4:', child.name, 'Position:', child.position)
        }
         if (child.name === 'Emoji-5' || child.name === 'emoji-5' || child.name === 'Emoji5') {
          emoji5Ref.current = child
          // Hide initially (on mobile and desktop) until price conditions are met
          const initialOpacity = getInitialOpacity('emoji5')
          child.visible = initialOpacity > 0.01
          child.traverse((node) => {
            if (node.isMesh && node.material) {
              node.material.opacity = initialOpacity
              node.material.transparent = true
            }
            node.visible = initialOpacity > 0.01
          })
          // console.log('✅ Found Emoji-5:', child.name, 'Position:', child.position)
        }
        
        // Find icon objects
        if (child.name === 'Icon-text3' || child.name === 'icon-like' || child.name === 'IconLike') {
          iconLikeRef.current = child
          // Hide initially until price conditions are met
          child.visible = false
          child.traverse((node) => {
            if (node.isMesh && node.material) {
              node.material.opacity = 0
              node.material.transparent = true
            }
            node.visible = false
          })
          // console.log('✅ Found Icon-like:', child.name, 'Position:', child.position)
        }
        if (child.name === 'Icon-love' || child.name === 'icon-love' || child.name === 'IconLove') {
          iconLoveRef.current = child
          // Hide initially until price conditions are met
          const initialOpacity = getInitialOpacity('iconLove')
          child.visible = initialOpacity > 0.01
          child.traverse((node) => {
            if (node.isMesh && node.material) {
              node.material.opacity = initialOpacity
              node.material.transparent = true
            }
            node.visible = initialOpacity > 0.01
          })
          // console.log('✅ Found Icon-love:', child.name, 'Position:', child.position)
        }
        if (child.name === 'Icon-text-1' || child.name === 'icon-text-1' || child.name === 'IconText1') {
          iconText1Ref.current = child
          // Hide initially until price conditions are met
          const initialOpacity = getInitialOpacity('iconText1')
          child.visible = initialOpacity > 0.01
          child.traverse((node) => {
            if (node.isMesh && node.material) {
              node.material.opacity = initialOpacity
              node.material.transparent = true
            }
            node.visible = initialOpacity > 0.01
          })
          // console.log('✅ Found Icon-text-1:', child.name, 'Position:', child.position)
        }
        if (child.name === 'Icon-text-2' || child.name === 'icon-text-2' || child.name === 'IconText2') {
          iconText2Ref.current = child
          // Hide initially until price conditions are met
          const initialOpacity = getInitialOpacity('iconText2')
          child.visible = initialOpacity > 0.01
          child.traverse((node) => {
            if (node.isMesh && node.material) {
              node.material.opacity = initialOpacity
              node.material.transparent = true
            }
            node.visible = initialOpacity > 0.01
          })
          // console.log('✅ Found Icon-text-2:', child.name, 'Position:', child.position)
        }
        if (child.name === 'Icon-play' || child.name === 'icon-play' || child.name === 'IconPlay') {
          iconPlayRef.current = child
          // Hide initially - iconPlay is not tracked in opacity system
          child.visible = false
          child.traverse((node) => {
            if (node.isMesh && node.material) {
              node.material.opacity = 0
              node.material.transparent = true
            }
            node.visible = false
          })
          // console.log('✅ Found Icon-play:', child.name, 'Position:', child.position)
        }
        if (child.name === 'Icon-star' || child.name === 'icon-star' || child.name === 'IconStar') {
          iconStarRef.current = child
          // Hide initially - iconStar is not tracked in opacity system
          child.visible = false
          child.traverse((node) => {
            if (node.isMesh && node.material) {
              node.material.opacity = 0
              node.material.transparent = true
            }
            node.visible = false
          })
          // console.log('✅ Found Icon-star:', child.name, 'Position:', child.position)
        }
        
        // Find new emoji objects
        if (child.name === 'WorriedEmoji' || child.name === 'worriedEmoji' || child.name === 'worried-emoji') {
          worriedEmojiRef.current = child
          // console.log('😟 Found WorriedEmoji:', child.name)
          
          // Apply initial visibility based on price state
          child.traverse((subChild) => {
            if (subChild.isMesh && subChild.material) {
              subChild.material.transparent = true
              subChild.material.opacity = getInitialOpacity('worriedEmoji')
              subChild.visible = getInitialOpacity('worriedEmoji') > 0.01
            }
          })
        }
        if (child.name === 'ScaredEmoji' || child.name === 'scaredEmoji' || child.name === 'scared-emoji') {
          scaredEmojiRef.current = child
          // console.log('😱 Found ScaredEmoji:', child.name)
          
          // Apply initial visibility based on price state
          child.traverse((subChild) => {
            if (subChild.isMesh && subChild.material) {
              subChild.material.transparent = true
              subChild.material.opacity = getInitialOpacity('scaredEmoji')
              subChild.visible = getInitialOpacity('scaredEmoji') > 0.01
            }
          })
        }
        if (child.name === 'DevilEmoji' || child.name === 'devilEmoji' || child.name === 'devil-emoji') {
          devilEmojiRef.current = child
          // console.log('😈 Found DevilEmoji:', child.name)
          
          // Apply initial visibility based on price state
          child.traverse((subChild) => {
            if (subChild.isMesh && subChild.material) {
              subChild.material.transparent = true
              subChild.material.opacity = getInitialOpacity('devilEmoji')
              subChild.visible = getInitialOpacity('devilEmoji') > 0.01
            }
          })
          
          // Set up animation mixer for DevilEmoji
          if (gltf.animations && gltf.animations.length > 0) {
            // Look for the Bone armature in the DevilEmoji
            let boneArmature = null
            child.traverse((subChild) => {
              if (subChild.name === 'Bone' || subChild.type === 'Bone' || subChild.name.includes('Armature')) {
                boneArmature = subChild
                console.log('Found Bone armature in DevilEmoji:', subChild.name)
              }
            })
            
            // Create mixer for the entire DevilEmoji object
            mixersRef.current.devil = new THREE.AnimationMixer(child)
            
            // Find and play the Idle animation
            const idleAnimation = gltf.animations.find(clip => clip.name === 'Armature|Idle')
            if (idleAnimation) {
              const action = mixersRef.current.devil.clipAction(idleAnimation)
              action.setLoop(THREE.LoopRepeat, Infinity) // Loop infinitely
              action.clampWhenFinished = false
              action.timeScale = 0.8 // Slightly slower for devil
              action.play()
              console.log('Playing Armature|Idle animation on DevilEmoji')
            }
          }
        }
        // Find CryingEmoji2 for large down scenarios (>5% drop)
        if (child.name === 'CryingEmoji2' || child.name === 'cryingEmoji2' || child.name === 'crying-emoji-2') {
          cryingEmoji2Ref.current = child
          console.log('😭 Found CryingEmoji2:', child.name)
          
          // Apply initial visibility based on price state
          child.traverse((subChild) => {
            if (subChild.isMesh && subChild.material) {
              subChild.material.transparent = true
              subChild.material.opacity = getInitialOpacity('cryingEmoji2')
              subChild.visible = getInitialOpacity('cryingEmoji2') > 0.01
            }
          })
          
          // Set up animation mixer for CryingEmoji2
          if (gltf.animations && gltf.animations.length > 0) {
            mixersRef.current.crying2 = new THREE.AnimationMixer(child)
            // Try both possible naming conventions
            const cryingAnimation = gltf.animations.find(clip => 
              clip.name === 'Armature|Idle.001' || clip.name === 'Armature|Idle001'
            )
            if (cryingAnimation) {
              const action = mixersRef.current.crying2.clipAction(cryingAnimation)
              action.setLoop(THREE.LoopRepeat, Infinity) // Loop infinitely
              action.clampWhenFinished = false
              action.timeScale = 0.9 // Slightly different speed for variety
              action.play()
              console.log('Playing ' + cryingAnimation.name + ' animation on CryingEmoji2')
            }
          }
        }
        
        // Find PukeEmoji for crash scenarios
        if (child.name === 'PukeEmoji' || child.name === 'pukeEmoji' || child.name === 'puke-emoji' || child.name === 'Puke-Emoji') {
          pukeEmojiRef.current = child
          console.log('🤮 Found PukeEmoji:', child.name)
          
          // Apply initial visibility based on price state
          child.traverse((subChild) => {
            if (subChild.isMesh && subChild.material) {
              subChild.material.transparent = true
              subChild.material.opacity = getInitialOpacity('pukeEmoji')
              subChild.visible = getInitialOpacity('pukeEmoji') > 0.01
            }
          })
        }
        
        // Find SadEmoji for downturn scenarios
        if (child.name === 'SadEmoji' || child.name === 'sadEmoji' || child.name === 'sad-emoji' || child.name === 'Sad-Emoji') {
          sadEmojiRef.current = child
          console.log('😢 Found SadEmoji:', child.name)
          
          // Apply initial visibility based on price state
          child.traverse((subChild) => {
            if (subChild.isMesh && subChild.material) {
              subChild.material.transparent = true
              subChild.material.opacity = getInitialOpacity('sadEmoji')
              subChild.visible = getInitialOpacity('sadEmoji') > 0.01
            }
          })
        }
        
        // Find QuestionMark for uncertain market conditions
        if (child.name === 'QuestionMark' || child.name === 'questionMark' || child.name === 'question-mark' || child.name === 'Question-Mark') {
          questionMarkRef.current = child
          console.log('❓ Found QuestionMark:', child.name)
          
          // Set initial visibility on parent object and ALL descendants
          const initialOpacity = getInitialOpacity('questionMark')
          const isVisible = initialOpacity > 0.01
          
          // Set visibility on the parent Group
          child.visible = isVisible
          
          // Traverse and set visibility on ALL children (Groups and Meshes)
          child.traverse((subChild) => {
            subChild.visible = isVisible
            if (subChild.isMesh && subChild.material) {
              subChild.material.transparent = true
              subChild.material.opacity = initialOpacity
            }
          })
        }
        
        // Find QuestionMark2 (linked to QuestionMark)
        if (child.name === 'QuestionMark2' || child.name === 'questionMark2' || child.name === 'question-mark-2' || child.name === 'Question-Mark2') {
          questionMark2Ref.current = child
          console.log('❓ Found QuestionMark2:', child.name)
          
          // Set initial visibility on parent object and ALL descendants
          const initialOpacity = getInitialOpacity('questionMark2')
          const isVisible = initialOpacity > 0.01
          
          // Set visibility on the parent Group
          child.visible = isVisible
          
          // Traverse and set visibility on ALL children (Groups and Meshes)
          child.traverse((subChild) => {
            subChild.visible = isVisible
            if (subChild.isMesh && subChild.material) {
              subChild.material.transparent = true
              subChild.material.opacity = initialOpacity
            }
          })
        }
        
        // Find ExclamationPoint for crisis conditions (checking both naming conventions)
        if (child.name === 'ExclamationPoint' || child.name === 'exclamationPoint' || child.name === 'ExclamationMark' || child.name === 'exclamationMark') {
          exclamationMarkRef.current = child
          console.log('❗ Found ExclamationPoint:', child.name)
          
          // Apply initial visibility based on price state
          child.traverse((subChild) => {
            if (subChild.isMesh && subChild.material) {
              subChild.material.transparent = true
              subChild.material.opacity = getInitialOpacity('exclamationMark')
              subChild.visible = getInitialOpacity('exclamationMark') > 0.01
            }
          })
        }
        
        // Find ExclamationPoint2 for crisis conditions
        if (child.name === 'ExclamationPoint2' || child.name === 'exclamationPoint2' || child.name === 'ExclamationMark2' || child.name === 'exclamationMark2') {
          exclamationMark2Ref.current = child
          console.log('❗ Found ExclamationPoint2:', child.name)
          
          // Apply initial visibility based on price state
          child.traverse((subChild) => {
            if (subChild.isMesh && subChild.material) {
              subChild.material.transparent = true
              subChild.material.opacity = getInitialOpacity('exclamationMark2')
              subChild.visible = getInitialOpacity('exclamationMark2') > 0.01
            }
          })
        }
        
        
        // Find PacMan parent object for 80s mode
        if (child.name === 'PacMan' || child.name === 'pacman' || child.name === 'Pacman' || child.name === 'PACMAN') {
          pacManRef.current = child
          console.log('🟡 Found PacMan parent object:', child.name)
          console.log('PacMan children:', child.children.map(c => c.name))
          console.log('PacMan type:', child.type)
          console.log('PacMan position:', child.position)
          console.log('PacMan scale:', child.scale)
          
          // Set initial visibility on the parent object (this should cascade to children)
          child.visible = is80sMode
          console.log('Set PacMan initial visibility to:', is80sMode)
          
          // Set up animation mixer for PacMan
          if (gltf.animations && gltf.animations.length > 0) {
            mixersRef.current.pacMan = new THREE.AnimationMixer(child)
            
            // Find the 'Animation' clip
            const pacManAnimation = gltf.animations.find(clip => 
              clip.name === 'Animation' || clip.name === 'animation' || 
              clip.name.toLowerCase().includes('pacman')
            )
            
            if (pacManAnimation) {
              console.log('🎮 Found PacMan animation:', pacManAnimation.name)
              actionsRef.current.pacMan = mixersRef.current.pacMan.clipAction(pacManAnimation)
              actionsRef.current.pacMan.setLoop(THREE.LoopRepeat, Infinity) // Loop infinitely
              actionsRef.current.pacMan.clampWhenFinished = false // Don't clamp at the end
              actionsRef.current.pacMan.timeScale = 1.0 // Normal speed
              
              // Play animation if 80s mode is already on
              if (is80sMode) {
                actionsRef.current.pacMan.reset() // Reset to start
                actionsRef.current.pacMan.play()
                console.log('🕹️ Starting PacMan animation')
              }
            } else {
              console.log('⚠️ No Animation found for PacMan, available animations:', 
                gltf.animations.map(a => a.name))
            }
          }
        }
        
        // Find second PacMan object for 80s mode
        if (child.name === 'pacman2' || child.name === 'PacMan2' || child.name === 'Pacman2' || child.name === 'PACMAN2') {
          pacMan2Ref.current = child
          console.log('🟡 Found PacMan2 object:', child.name)
          console.log('PacMan2 children:', child.children.map(c => c.name))
          console.log('PacMan2 type:', child.type)
          console.log('PacMan2 position:', child.position)
          
          // Set initial visibility on the parent object
          child.visible = is80sMode
          console.log('Set PacMan2 initial visibility to:', is80sMode)
          
          // Set up animation mixer for PacMan2
          if (gltf.animations && gltf.animations.length > 0) {
            mixersRef.current.pacMan2 = new THREE.AnimationMixer(child)
            
            // Find the 'Eating' animation clip
            const eatingAnimation = gltf.animations.find(clip => 
              clip.name === 'Eating' || clip.name === 'eating' || 
              clip.name.toLowerCase().includes('eating')
            )
            
            if (eatingAnimation) {
              console.log('🎮 Found PacMan2 Eating animation:', eatingAnimation.name)
              actionsRef.current.pacMan2 = mixersRef.current.pacMan2.clipAction(eatingAnimation)
              actionsRef.current.pacMan2.setLoop(THREE.LoopRepeat, Infinity) // Loop infinitely
              actionsRef.current.pacMan2.clampWhenFinished = false // Don't clamp at the end
              actionsRef.current.pacMan2.timeScale = 1.2 // Slightly faster as before
              
              // Play animation if 80s mode is already on
              if (is80sMode) {
                actionsRef.current.pacMan2.reset() // Reset to start
                actionsRef.current.pacMan2.play()
                console.log('🕹️ Starting PacMan2 Eating animation')
              }
            } else {
              console.log('⚠️ No Eating animation found for PacMan2')
            }
          }
        }
        
        // Create digital portal effect for emoji backdrop
        if (child.name === 'EmojiBackdrop' || child.name.toLowerCase().includes('emojibackdrop')) {
          if (child.isMesh && child.material) {
            console.log('Found EmojiBackdrop mesh, applying animated portal effect')
            
            // Create a cartoon-style swirling portal effect
            const portalMaterial = new THREE.ShaderMaterial({
              uniforms: {
                uTime: { value: 0 },
                uOpacity: { value: 0.6 }
              },
              vertexShader: `
                precision highp float;
                varying vec2 vUv;
                varying vec3 vPosition;
                
                void main() {
                  vUv = uv;
                  vPosition = position;
                  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
              `,
              fragmentShader: `
                precision highp float;
                uniform float uTime;
                uniform float uOpacity;
                varying vec2 vUv;
                
                void main() {
                  vec2 center = vec2(0.5, 0.5);
                  vec2 uv = vUv - center;
                  
                  // Create swirling effect
                  float angle = atan(uv.y, uv.x);
                  float radius = length(uv);
                  
                  // Add time-based rotation
                  angle += uTime * 2.0 * (1.0 - radius);
                  
                  // Create spiral pattern
                  float spiral = sin(radius * 20.0 - angle * 3.0 - uTime * 3.0);
                  
                  // Color based on angle and time for rainbow effect
                  vec3 color = vec3(
                    sin(angle + uTime) * 0.5 + 0.5,
                    sin(angle + uTime + 2.094) * 0.5 + 0.5,
                    sin(angle + uTime + 4.189) * 0.5 + 0.5
                  );
                  
                  // Add brightness variation
                  color *= 0.5 + spiral * 0.5;
                  
                  // Fade out at edges
                  float alpha = 1.0 - smoothstep(0.2, 0.5, radius);
                  alpha *= uOpacity;
                  
                  gl_FragColor = vec4(color, alpha);
                }
              `,
              transparent: true,
              side: THREE.DoubleSide,
              depthWrite: false,
              blending: THREE.NormalBlending // Normal blending to see it better
            })
            
            // Test with a simple material first
            const testMaterial = new THREE.MeshBasicMaterial({
              color: 0x00ff00,
              transparent: true,
              opacity: 0.5,
              side: THREE.DoubleSide
            })
            
            // child.material = testMaterial  // Use test material for now
            child.material = portalMaterial  // Use portal shader
            child.material.needsUpdate = true
            backdropRef.current = child
            console.log('EmojiBackdrop portal shader applied successfully')
          }
        }
      })
      

    }
    
    // Cleanup function
    return () => {
      console.log('🧹 Cleaning up HandsGLTFScene resources...')
      
      // Stop and dispose all animation mixers
      if (mixersRef.current) {
        Object.entries(mixersRef.current).forEach(([name, mixer]) => {
          if (mixer) {
            mixer.stopAllAction()
            mixer.uncacheRoot(mixer.getRoot())
            console.log(`Disposed mixer: ${name}`)
          }
        })
        mixersRef.current = {}
      }
      
      // Stop all animation actions
      if (actionsRef.current) {
        Object.entries(actionsRef.current).forEach(([name, action]) => {
          if (action) {
            action.stop()
            console.log(`Stopped action: ${name}`)
          }
        })
        actionsRef.current = {}
      }
      
      // Dispose of collected QuestionMark meshes
      if (questionMarkMeshes.current) {
        questionMarkMeshes.current = []
      }
      
      // Traverse and dispose all materials and geometries
      if (gltf.scene) {
        gltf.scene.traverse((child) => {
          if (child.isMesh) {
            // Dispose geometry
            if (child.geometry) {
              child.geometry.dispose()
            }
            
            // Dispose materials (can be array or single material)
            if (child.material) {
              const materials = Array.isArray(child.material) ? child.material : [child.material]
              materials.forEach(material => {
                // Dispose textures
                if (material.map) material.map.dispose()
                if (material.normalMap) material.normalMap.dispose()
                if (material.emissiveMap) material.emissiveMap.dispose()
                if (material.roughnessMap) material.roughnessMap.dispose()
                if (material.metalnessMap) material.metalnessMap.dispose()
                if (material.alphaMap) material.alphaMap.dispose()
                if (material.aoMap) material.aoMap.dispose()
                
                // Dispose the material itself
                material.dispose()
              })
            }
          }
        })
      }
      
      console.log('✅ HandsGLTFScene cleanup complete')
    }
  }, [gltf])

  // Add frame counter for throttling expensive operations
  const frameCounter = useRef(0)
  
  // Smooth opacity animation in render loop
  useFrame((state, delta) => {
    frameCounter.current++
    
    // Update debounced price every 1.5 seconds to reduce emoji switching
    const currentTime = state.clock.elapsedTime
    if (currentTime - lastEmojiUpdateRef.current > 1.5) {
      lastEmojiUpdateRef.current = currentTime
      // Smooth transition to new price state
      debouncedPriceRef.current += (priceChange - debouncedPriceRef.current) * 0.4
    }
    const fadeSpeed = 3.0 // Adjust this to control fade speed (higher = faster)
    
    // Helper function to update opacity for an object and its children
    const updateOpacityRecursive = (object, opacity) => {
      if (!object) return
      
      const isVisible = opacity > 0.01
      
      // Set visibility on the parent object itself
      object.visible = isVisible
      
      // For Groups with children, make sure to update them
      if (object.children && object.children.length > 0) {
        object.children.forEach(child => {
          child.visible = isVisible
          
          // Recursively handle nested children
          if (child.children && child.children.length > 0) {
            updateOpacityRecursive(child, opacity)
          }
          
          // Handle meshes
          if (child.isMesh && child.material) {
            child.material.transparent = true
            child.material.opacity = opacity
          }
        })
      }
      
      // Also use traverse as a backup to catch everything
      object.traverse((child) => {
        child.visible = isVisible
        if (child.isMesh && child.material) {
          child.material.transparent = true
          child.material.opacity = opacity
        }
      })
    }
    
    // Animate each emoji's opacity towards its target (throttle to every 2 frames)
    if (frameCounter.current % 2 === 0) {
      Object.keys(opacityTargets.current).forEach(key => {
        const target = opacityTargets.current[key]
        const current = currentOpacities.current[key]
        
        // Smooth interpolation towards target
        if (Math.abs(target - current) > 0.001) {
          currentOpacities.current[key] = THREE.MathUtils.lerp(current, target, fadeSpeed * delta * 2) // Multiply delta by 2 to compensate for throttling
        
        // Apply opacity to corresponding objects
        switch(key) {
          case 'emoji1':
            updateOpacityRecursive(emoji1Ref.current, currentOpacities.current[key])
            break
          case 'emoji2':
            updateOpacityRecursive(emoji2Ref.current, currentOpacities.current[key])
            break
          case 'emoji3':
            updateOpacityRecursive(emoji3Ref.current, currentOpacities.current[key])
            break
          case 'emoji4':
            updateOpacityRecursive(emoji4Ref.current, currentOpacities.current[key])
            break
          case 'emoji5':
            updateOpacityRecursive(emoji5Ref.current, currentOpacities.current[key])
            break
          case 'worriedEmoji':
            updateOpacityRecursive(worriedEmojiRef.current, currentOpacities.current[key])
            break
          case 'scaredEmoji':
            updateOpacityRecursive(scaredEmojiRef.current, currentOpacities.current[key])
            break
          case 'devilEmoji':
            updateOpacityRecursive(devilEmojiRef.current, currentOpacities.current[key])
            break
          case 'cryingEmoji2':
            updateOpacityRecursive(cryingEmoji2Ref.current, currentOpacities.current[key])
            break
          case 'pukeEmoji':
            updateOpacityRecursive(pukeEmojiRef.current, currentOpacities.current[key])
            break
          case 'sadEmoji':
            updateOpacityRecursive(sadEmojiRef.current, currentOpacities.current[key])
            break
          case 'questionMark':
            updateOpacityRecursive(questionMarkRef.current, currentOpacities.current[key])
            // Also update ALL collected QuestionMark-related objects
            questionMarkMeshes.current.forEach(obj => {
              obj.visible = currentOpacities.current[key] > 0.01
              if (obj.isMesh && obj.material) {
                obj.material.transparent = true
                obj.material.opacity = currentOpacities.current[key]
              }
            })
            break
          case 'questionMark2':
            updateOpacityRecursive(questionMark2Ref.current, currentOpacities.current[key])
            // Also update ALL collected QuestionMark-related objects
            questionMarkMeshes.current.forEach(obj => {
              obj.visible = currentOpacities.current[key] > 0.01
              if (obj.isMesh && obj.material) {
                obj.material.transparent = true
                obj.material.opacity = currentOpacities.current[key]
              }
            })
            break
          case 'exclamationMark':
            updateOpacityRecursive(exclamationMarkRef.current, currentOpacities.current[key])
            break
          case 'exclamationMark2':
            updateOpacityRecursive(exclamationMark2Ref.current, currentOpacities.current[key])
            break
          case 'iconLove':
            updateOpacityRecursive(iconLoveRef.current, currentOpacities.current[key])
            break
          case 'iconText1':
            updateOpacityRecursive(iconText1Ref.current, currentOpacities.current[key])
            break
          case 'iconText2':
            updateOpacityRecursive(iconText2Ref.current, currentOpacities.current[key])
            break
        }
      }
    })
    }
  })
  
  // Control emoji visibility based on market status
  useEffect(() => {
    // If 80s mode is active, hide ALL emojis/icons (PacMan handled separately)
    if (is80sMode) {
      // Hide all emojis and icons when in 80s mode
      Object.keys(opacityTargets.current).forEach(key => {
        opacityTargets.current[key] = 0
      })
      return // Exit early, don't process market-based visibility
    }
    
    if (isLargeUp) {
      // Large upward movement (>5%) - maximum celebration
      opacityTargets.current.emoji1 = 1
      opacityTargets.current.emoji3 = 1
      opacityTargets.current.emoji4 = 1
      opacityTargets.current.emoji5 = 1
      opacityTargets.current.iconLove = 1
      opacityTargets.current.iconText1 = 1
      opacityTargets.current.iconText2 = 1
      
      // Fade out all negative emojis
      opacityTargets.current.emoji2 = 0
      opacityTargets.current.worriedEmoji = 0
      opacityTargets.current.scaredEmoji = 0
      opacityTargets.current.devilEmoji = 0
      opacityTargets.current.cryingEmoji2 = 0
      opacityTargets.current.pukeEmoji = 0
      opacityTargets.current.sadEmoji = 0
      opacityTargets.current.questionMark = 0
      opacityTargets.current.questionMark2 = 0
      opacityTargets.current.exclamationMark = 0
      opacityTargets.current.exclamationMark2 = 0
      
    } else if (isModeratelyPositive) {
      // Moderately positive (2-5%) - happy emojis
      opacityTargets.current.emoji1 = 1
      opacityTargets.current.emoji3 = 1
      opacityTargets.current.emoji4 = 1
      opacityTargets.current.emoji5 = 1
      opacityTargets.current.iconLove = 1
      opacityTargets.current.iconText1 = 0.5
      opacityTargets.current.iconText2 = 0.5
      
      // Fade out negative emojis
      opacityTargets.current.emoji2 = 0
      opacityTargets.current.worriedEmoji = 0
      opacityTargets.current.scaredEmoji = 0
      opacityTargets.current.devilEmoji = 0
      opacityTargets.current.cryingEmoji2 = 0
      opacityTargets.current.pukeEmoji = 0
      opacityTargets.current.sadEmoji = 0
      opacityTargets.current.questionMark = 0
      opacityTargets.current.questionMark2 = 0
      opacityTargets.current.exclamationMark = 0
      opacityTargets.current.exclamationMark2 = 0
      
    } else if (isSlightlyPositive) {
      // Slightly positive (0-2%) - cautiously optimistic
      opacityTargets.current.emoji1 = 1
      opacityTargets.current.emoji2 = 0.5
      opacityTargets.current.emoji3 = 1
      opacityTargets.current.emoji4 = 0.5
      opacityTargets.current.emoji5 = 0
      opacityTargets.current.iconLove = 0
      opacityTargets.current.iconText1 = 0
      opacityTargets.current.iconText2 = 0
      
      // Fade out negative emojis
      opacityTargets.current.worriedEmoji = 0
      opacityTargets.current.scaredEmoji = 0
      opacityTargets.current.devilEmoji = 0
      opacityTargets.current.cryingEmoji2 = 0
      opacityTargets.current.pukeEmoji = 0
      opacityTargets.current.sadEmoji = 0
      opacityTargets.current.questionMark = 0
      opacityTargets.current.questionMark2 = 0
      opacityTargets.current.exclamationMark = 0
      opacityTargets.current.exclamationMark2 = 0
      
    } else if (isSlightlyNegative) {
      // Slightly negative (-2 to 0%) - mild concern
      opacityTargets.current.emoji2 = 1
      opacityTargets.current.worriedEmoji = 0.5
      opacityTargets.current.questionMark = 0.5
      opacityTargets.current.questionMark2 = 0
      
      // Fade out positive emojis
      opacityTargets.current.emoji1 = 0
      opacityTargets.current.emoji3 = 0
      opacityTargets.current.emoji4 = 0
      opacityTargets.current.emoji5 = 0
      opacityTargets.current.iconLove = 0
      opacityTargets.current.iconText1 = 0
      opacityTargets.current.iconText2 = 0
      
      // Fade out extreme negative emojis
      opacityTargets.current.scaredEmoji = 0
      opacityTargets.current.devilEmoji = 0
      opacityTargets.current.cryingEmoji2 = 0
      opacityTargets.current.pukeEmoji = 0
      opacityTargets.current.sadEmoji = 0
      opacityTargets.current.exclamationMark = 0
      opacityTargets.current.exclamationMark2 = 0
      
    } else if (isModerateDown) {
      // Moderate down (-5 to -2%) - worried
      opacityTargets.current.worriedEmoji = 1
      opacityTargets.current.scaredEmoji = 1
      opacityTargets.current.sadEmoji = 1
      opacityTargets.current.questionMark = 1
      opacityTargets.current.questionMark2 = 1
      
      // Fade out positive emojis
      opacityTargets.current.emoji1 = 0
      opacityTargets.current.emoji2 = 0.5
      opacityTargets.current.emoji3 = 0
      opacityTargets.current.emoji4 = 0
      opacityTargets.current.emoji5 = 0
      opacityTargets.current.iconLove = 0
      opacityTargets.current.iconText1 = 0
      opacityTargets.current.iconText2 = 0
      
      // Fade out extreme negative emojis
      opacityTargets.current.devilEmoji = 0
      opacityTargets.current.cryingEmoji2 = 0
      opacityTargets.current.pukeEmoji = 0
      opacityTargets.current.exclamationMark = 0
      opacityTargets.current.exclamationMark2 = 0
      
    } else if (isLargeDown) {
      // Large downward price action - fade in panic emojis
      opacityTargets.current.worriedEmoji = 1
      opacityTargets.current.scaredEmoji = 1
      opacityTargets.current.devilEmoji = 1
      opacityTargets.current.cryingEmoji2 = 1  // CryingEmoji2 appears when down >5%
      opacityTargets.current.pukeEmoji = 1  // PukeEmoji appears during crashes
      opacityTargets.current.sadEmoji = 1   // SadEmoji also visible during crashes
      opacityTargets.current.questionMark = 1  // QuestionMarks visible during chaos
      opacityTargets.current.questionMark2 = 1
      opacityTargets.current.exclamationMark = 1  // ExclamationMark only during crashes
      opacityTargets.current.exclamationMark2 = 1  // ExclamationMark2 only during crashes
      
      // Fade out all positive emojis
      opacityTargets.current.emoji1 = 0
      opacityTargets.current.emoji2 = 0
      opacityTargets.current.emoji3 = 0
      opacityTargets.current.emoji4 = 0
      opacityTargets.current.emoji5 = 0
      opacityTargets.current.iconLove = 0
      opacityTargets.current.iconText1 = 0
      opacityTargets.current.iconText2 = 0
      
      // Animations are already playing from model load, just ensure they're visible
      // console.log('📉💀 Market crash (' + priceChange.toFixed(2) + '%) - showing panic emojis with animations!')
    }
  }, [isLargeUp, isModeratelyPositive, isSlightlyPositive, isSlightlyNegative, isModerateDown, isLargeDown, priceChange, gltf, is80sMode])

  // Control PacMan visibility based on 80s mode
  useEffect(() => {
    console.log('🎮 80s mode changed to:', is80sMode)
    
    // Control first PacMan
    if (pacManRef.current) {
      // Visibility is now controlled in the animation loop
      // Just reset position when toggling mode
      if (!is80sMode) {
        pacManRef.current.visible = false
        pacManRef.current.position.x = 0 // Reset to center
      }
      
      // Control PacMan animation
      if (actionsRef.current.pacMan) {
        if (is80sMode) {
          actionsRef.current.pacMan.reset() // Reset animation to start
          actionsRef.current.pacMan.play()
          console.log('🕹️ Playing PacMan Animation')
        } else {
          actionsRef.current.pacMan.stop()
          console.log('⏸️ Stopping PacMan Animation')
        }
      }
    } else {
      console.log('⚠️ PacMan ref not found')
    }
    
    // Control second PacMan (now parented to first PacMan)
    if (pacMan2Ref.current) {
      // Since pacman2 is parented, we only need to control its animation
      // Visibility and position are handled by the parent
      if (!is80sMode) {
        pacMan2Ref.current.visible = false
      }
      
      // Control PacMan2 Eating animation
      if (actionsRef.current.pacMan2) {
        if (is80sMode) {
          actionsRef.current.pacMan2.reset() // Reset animation to start
          actionsRef.current.pacMan2.play()
          console.log('🍔 Playing PacMan2 Eating animation')
        } else {
          actionsRef.current.pacMan2.stop()
          console.log('⏸️ Stopping PacMan2 Eating animation')
        }
      }
    } else {
      console.log('⚠️ PacMan2 ref not found')
    }
  }, [is80sMode])
  
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
    
    // Simple texture loading with cleanup
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
    img.src = imageData.image
    
    // Cleanup function
    return () => {
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
  if (backdropRef.current && backdropRef.current.material && backdropRef.current.material.uniforms) {
    backdropRef.current.material.uniforms.uTime.value = state.clock.elapsedTime
  }
  
  // Track phoneCase world position for light rays
  if (phoneCaseRef.current) {
    const worldPos = new THREE.Vector3()
    const worldQuat = new THREE.Quaternion()
    phoneCaseRef.current.getWorldPosition(worldPos)
    phoneCaseRef.current.getWorldQuaternion(worldQuat)
    setPhoneCaseWorldPos([worldPos.x, worldPos.y, worldPos.z])
    setPhoneCaseWorldQuat([worldQuat.x, worldQuat.y, worldQuat.z, worldQuat.w])
    
    // Check if phone is facing camera (rays should only be visible from front)
    // Get phone's forward direction in world space
    const phoneForward = new THREE.Vector3(0, 0, 1)
    phoneForward.applyQuaternion(worldQuat)
    
    // Get camera direction to phone
    const cameraToPhone = worldPos.clone().sub(state.camera.position).normalize()
    
    // Calculate dot product - positive means facing camera, negative means facing away
    const dotProduct = phoneForward.dot(cameraToPhone)
    
    // Hide rays when viewing from behind (dot product negative)
    setRaysVisible(dotProduct < 0.3) // Threshold of 0.3 gives a nice fade zone
  }
  
  // Update all animation mixers efficiently
  Object.values(mixersRef.current).forEach(mixer => {
    if (mixer) mixer.update(delta)
  })
  
  // PacMan movement animation for 80s mode (pacman2 is parented and follows)
  if (is80sMode && pacManRef.current) {
    // Total cycle: 8 seconds move + 3 seconds wait = 11 seconds
    const totalCycleTime = 11 // 8 seconds for movement, 3 seconds for delay
    const cycleTime = state.clock.elapsedTime % totalCycleTime
    
    // Keep PacMan always visible
    pacManRef.current.visible = true
    
    // Calculate opacity for fade effect
    let opacity = 0
    
    // First 4 seconds: move left
    // Next 3 seconds: hidden/delay
    // Next 4 seconds: move right
    
    if (cycleTime < 4) {
      // Moving left phase (0 to 4 seconds)
      const leftProgress = cycleTime / 4 // 0 to 1
      
      // Fade in at start (0 to 0.15), fade out at end (0.85 to 1.0)
      if (leftProgress < 0.15) {
        opacity = leftProgress / 0.15 // Fade in from 0 to 1
      } else if (leftProgress > 0.85) {
        opacity = 1 - ((leftProgress - 0.85) / 0.15) // Fade out from 1 to 0
      } else {
        opacity = 1 // Fully visible in the middle
      }
      
      // Move from center to left
      pacManRef.current.position.x = -leftProgress * 5
      
      // Face left (no rotation needed, default facing)
      pacManRef.current.rotation.y = 0
      
    } else if (cycleTime < 7) {
      // Delay phase (4 to 7 seconds) - stay hidden
      opacity = 0
      pacManRef.current.position.x = 0 // Reset to center during delay
      
    } else {
      // Moving right phase (7 to 11 seconds)
      const rightProgress = (cycleTime - 7) / 4 // 0 to 1
      
      // Fade in at start (0 to 0.15), fade out at end (0.85 to 1.0)
      if (rightProgress < 0.15) {
        opacity = rightProgress / 0.15 // Fade in from 0 to 1
      } else if (rightProgress > 0.85) {
        opacity = 1 - ((rightProgress - 0.85) / 0.15) // Fade out from 1 to 0
      } else {
        opacity = 1 // Fully visible in the middle
      }
      
      // Move from center to right
      pacManRef.current.position.x = rightProgress * 5
      
      // Face right (180 degree rotation)
      pacManRef.current.rotation.y = Math.PI
    }
    
    // Apply opacity to all meshes in PacMan
    pacManRef.current.traverse((child) => {
      if (child.isMesh && child.material) {
        child.material.transparent = true
        child.material.opacity = opacity
      }
    })
    
    // Apply same opacity to pacman2 (parented to PacMan)
    if (pacMan2Ref.current) {
      pacMan2Ref.current.visible = true
      
      // Apply same opacity as parent
      pacMan2Ref.current.traverse((child) => {
        if (child.isMesh && child.material) {
          child.material.transparent = true
          child.material.opacity = opacity
        }
      })
      
      // If pacman2 appears to be moving backwards, flip it 180 degrees
      // This compensates for any initial rotation differences in the model
      pacMan2Ref.current.rotation.y = Math.PI // Rotate 180 degrees relative to parent
    }
  }
  
  // Floating animations for emojis and icons
  const time = state.clock.getElapsedTime()
  
  // Animate emojis with more dynamic floating motion (only if visible)
  if (emoji1Ref.current && emoji1Ref.current.visible) {
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
  
  if (emoji2Ref.current && emoji2Ref.current.visible) {
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
  
  if (emoji3Ref.current && emoji3Ref.current.visible) {
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
  
  if (emoji4Ref.current && emoji4Ref.current.visible) {
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
  
  if (emoji5Ref.current && emoji5Ref.current.visible) {
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
  
  // Animate icons with more noticeable floating motion (only if visible)
  if (iconLikeRef.current && iconLikeRef.current.visible) {
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
  
  if (iconLoveRef.current && iconLoveRef.current.visible) {
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
  
  if (iconText1Ref.current && iconText1Ref.current.visible) {
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
  
  if (iconText2Ref.current && iconText2Ref.current.visible) {
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
  
  if (iconPlayRef.current && iconPlayRef.current.visible) {
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
  
  if (iconStarRef.current && iconStarRef.current.visible) {
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
  
  // Animate worried and scared emojis with nervous shaking
  if (worriedEmojiRef.current && worriedEmojiRef.current.visible) {
    if (!worriedEmojiRef.current.userData.initialY) {
      worriedEmojiRef.current.userData.initialY = worriedEmojiRef.current.position.y
      worriedEmojiRef.current.userData.initialX = worriedEmojiRef.current.position.x
    }
    // Nervous shaking motion
    worriedEmojiRef.current.position.x = worriedEmojiRef.current.userData.initialX + Math.sin(time * 8) * 0.05
    worriedEmojiRef.current.position.y = worriedEmojiRef.current.userData.initialY + Math.sin(time * 2) * 0.2
  }
  
  if (scaredEmojiRef.current && scaredEmojiRef.current.visible) {
    if (!scaredEmojiRef.current.userData.initialY) {
      scaredEmojiRef.current.userData.initialY = scaredEmojiRef.current.position.y
      scaredEmojiRef.current.userData.initialX = scaredEmojiRef.current.position.x
    }
    // More intense shaking
    scaredEmojiRef.current.position.x = scaredEmojiRef.current.userData.initialX + Math.sin(time * 12) * 0.08
    scaredEmojiRef.current.position.y = scaredEmojiRef.current.userData.initialY + Math.sin(time * 2.5) * 0.15
  }
  
  // Animate PukeEmoji with rocking motion like it's about to puke
  if (pukeEmojiRef.current && pukeEmojiRef.current.visible) {
    if (!pukeEmojiRef.current.userData.initialPos) {
      pukeEmojiRef.current.userData.initialPos = {
        x: pukeEmojiRef.current.position.x,
        y: pukeEmojiRef.current.position.y,
        z: pukeEmojiRef.current.position.z
      }
      pukeEmojiRef.current.userData.initialRotation = {
        x: pukeEmojiRef.current.rotation.x,
        y: pukeEmojiRef.current.rotation.y,
        z: pukeEmojiRef.current.rotation.z
      }
    }
    // Gentler queasy wobbling motion
    pukeEmojiRef.current.position.x = pukeEmojiRef.current.userData.initialPos.x + Math.sin(time * 6) * 0.05
    pukeEmojiRef.current.position.y = pukeEmojiRef.current.userData.initialPos.y + Math.cos(time * 4) * 0.04
    
    // Add forward/backward rocking on x-axis (like dry heaving)
    pukeEmojiRef.current.rotation.x = pukeEmojiRef.current.userData.initialRotation.x + Math.sin(time * 3) * 0.3 // Rock forward and back
    pukeEmojiRef.current.rotation.z = Math.sin(time * 5) * 0.15 // Side wobble
    
    // Gentler pulsing for queasy effect
    const scale = 1 + Math.sin(time * 3) * 0.05
    pukeEmojiRef.current.scale.set(scale, scale, scale)
  }
  
  // Animate SadEmoji with slow, drooping motion and head shaking
  if (sadEmojiRef.current && sadEmojiRef.current.visible) {
    if (!sadEmojiRef.current.userData.initialY) {
      sadEmojiRef.current.userData.initialY = sadEmojiRef.current.position.y
      sadEmojiRef.current.userData.initialX = sadEmojiRef.current.position.x
    }
    // Slow, sad swaying
    sadEmojiRef.current.position.x = sadEmojiRef.current.userData.initialX + Math.sin(time * 0.8) * 0.05
    sadEmojiRef.current.position.y = sadEmojiRef.current.userData.initialY + Math.sin(time * 1.2) * 0.03 - 0.1 // Slight droop
    sadEmojiRef.current.rotation.z = Math.sin(time * 0.6) * 0.05 // Gentle tilt
    // Head shaking in disbelief (Y-axis rotation)
    sadEmojiRef.current.rotation.y = Math.sin(time * 2.5) * 0.3 // Shaking head "no" motion
  }
  
  // Animate QuestionMark with limited confused rotation
  if (questionMarkRef.current && questionMarkRef.current.visible) {
    if (!questionMarkRef.current.userData.initialPos) {
      questionMarkRef.current.userData.initialPos = {
        x: questionMarkRef.current.position.x,
        y: questionMarkRef.current.position.y
      }
    }
    // Limited rotation back and forth (like confused head tilting)
    questionMarkRef.current.rotation.y = Math.sin(time * 1.5) * 0.52 // Limited to 30 degrees
    // Floating motion
    questionMarkRef.current.position.y = questionMarkRef.current.userData.initialPos.y + Math.sin(time * 2) * 0.1
    questionMarkRef.current.position.x = questionMarkRef.current.userData.initialPos.x + Math.cos(time * 1.5) * 0.05
    // Add a slight Z-axis tilt for more confused look
    questionMarkRef.current.rotation.z = Math.sin(time * 1.8) * 0.2
  }
  
  // Animate QuestionMark2 with opposite limited rotation
  if (questionMark2Ref.current && questionMark2Ref.current.visible) {
    if (!questionMark2Ref.current.userData.initialPos) {
      questionMark2Ref.current.userData.initialPos = {
        x: questionMark2Ref.current.position.x,
        y: questionMark2Ref.current.position.y
      }
    }
    // Opposite limited rotation (like confused head tilting the other way)
    questionMark2Ref.current.rotation.y = -Math.sin(time * 1.5) * 0.52 // Opposite direction, limited to 30 degrees
    // Floating motion with offset phase
    questionMark2Ref.current.position.y = questionMark2Ref.current.userData.initialPos.y + Math.sin(time * 2 + Math.PI) * 0.1
    questionMark2Ref.current.position.x = questionMark2Ref.current.userData.initialPos.x + Math.cos(time * 1.5 + Math.PI) * 0.05
    // Opposite Z-axis tilt
    questionMark2Ref.current.rotation.z = -Math.sin(time * 1.8) * 0.2
  }
  
  // Animate ExclamationMark with limited rotation (30 degrees = ~0.52 radians)
  if (exclamationMarkRef.current && exclamationMarkRef.current.visible) {
    if (!exclamationMarkRef.current.userData.initialScale) {
      exclamationMarkRef.current.userData.initialScale = exclamationMarkRef.current.scale.clone()
      exclamationMarkRef.current.userData.initialY = exclamationMarkRef.current.position.y
    }
    // Urgent pulsing
    const pulseScale = 1 + Math.abs(Math.sin(time * 6)) * 0.2
    exclamationMarkRef.current.scale.set(
      exclamationMarkRef.current.userData.initialScale.x * pulseScale,
      exclamationMarkRef.current.userData.initialScale.y * pulseScale,
      exclamationMarkRef.current.userData.initialScale.z * pulseScale
    )
    // Bouncing motion
    exclamationMarkRef.current.position.y = exclamationMarkRef.current.userData.initialY + Math.abs(Math.sin(time * 4)) * 0.15
    // Limited rotation - 30 degrees (0.52 radians) max in each direction
    exclamationMarkRef.current.rotation.z = Math.sin(time * 3) * 0.52 // Slower, limited rotation
  }
  
  // Animate ExclamationMark2 with opposite limited rotation
  if (exclamationMark2Ref.current && exclamationMark2Ref.current.visible) {
    if (!exclamationMark2Ref.current.userData.initialScale) {
      exclamationMark2Ref.current.userData.initialScale = exclamationMark2Ref.current.scale.clone()
      exclamationMark2Ref.current.userData.initialY = exclamationMark2Ref.current.position.y
    }
    // Urgent pulsing (offset phase)
    const pulseScale = 1 + Math.abs(Math.sin(time * 6 + Math.PI/2)) * 0.2
    exclamationMark2Ref.current.scale.set(
      exclamationMark2Ref.current.userData.initialScale.x * pulseScale,
      exclamationMark2Ref.current.userData.initialScale.y * pulseScale,
      exclamationMark2Ref.current.userData.initialScale.z * pulseScale
    )
    // Bouncing motion (offset phase)
    exclamationMark2Ref.current.position.y = exclamationMark2Ref.current.userData.initialY + Math.abs(Math.sin(time * 4 + Math.PI/2)) * 0.15
    // Limited rotation opposite direction
    exclamationMark2Ref.current.rotation.z = -Math.sin(time * 3) * 0.52 // Opposite direction, limited to 30 degrees
  }
  
  // Animate arrows with directional motion
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
      // console.log('Forced garbage collection')
    }
    
    // console.log('HandsGLTFScene cleanup complete')
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
    // console.log('📱 Phone position from:', phoneCaseRef.current ? 'phoneCase' : 'phoneScreen')
    // console.log('📱 Phone world position:', worldPos)
    // console.log('📱 Offerings available:', offerings?.length || 0)
    
    return { position: worldPos, quaternion: worldQuat, scale: worldScale }
  }
  return null
}, [phoneCaseRef.current, phoneScreenRef.current, offerings, hoveredOffering, justLitOffering])

// Return with swivel animation applied

return (
  <group position={[0, isMobileLocal ? -0.3 : -0.6, 0]}> {/* Position hands higher on mobile */}
    <primitive 
      object={gltf.scene} 
      scale={[0.45, 0.45, 0.45]}
      rotation={[0, userRotation, 0]} // Apply user rotation to hands
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
        hasActiveClick={hasActiveClick}
      />
    )}
    
    {/* Aura that follows phoneCase world position */}
    {raysVisible && (
      <PhoneAura
        phonePosition={[
          phoneCaseWorldPos[0], 
          phoneCaseWorldPos[1] + 2.9,  // Y offset - adjust this value
          phoneCaseWorldPos[2] - 0.3
        ]}
        color='#00ffff'
        intensity={1}
        size={5}
        opacity={0.5}
        isActive={hasActiveClick}
        priceDirection={priceChange / 5}
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

export default function HandsGLTFScene({ onLoadComplete, offerings, hoveredOffering, justLitOffering, onJustLitComplete, priceChange = 0, is80sMode = false }) {
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 })
  // Scroll tracking removed - no longer needed
  const [isMobile, setIsMobile] = useState(false)
  const [showClickIndicator, setShowClickIndicator] = useState(false)
  const [modelLoaded, setModelLoaded] = useState(false)
  const containerRef = useRef(null)
  const [hasReachedSection, setHasReachedSection] = useState(false)
  const [isInView, setIsInView] = useState(false) // Track if currently in view
  
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
      
      
      {/* 3D Canvas */}
      <Canvas
        camera={{ position: [0, -0.5, 5], fov: 45 }}
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
            onLoad={() => {
              setModelLoaded(true);
              if (onLoadComplete) onLoadComplete();
            }}
          />
        </Suspense>
        
        {/* DISABLED: MouseTracker for memory leak testing */}
        {/* <MouseTracker setMousePosition={setMousePosition} /> */}
        
        {/* OrbitControls for rotation */}
        <OrbitControls 
          enablePan={false}
          enableZoom={false}
          enableRotate={true}
          maxPolarAngle={Math.PI / 2}
          minPolarAngle={Math.PI / 2}
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