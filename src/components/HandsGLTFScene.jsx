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
import { PhoneScreenFeed3D } from './Phonescreenfeed'
import { PhoneScreenTexture } from './PhoneScreenTexture'
import { PhoneAura } from './PhoneAura'


export function HandsModel({ mousePosition, onLoad, hasReachedSection, isInView, offerings, hoveredOffering, justLitOffering, onJustLitComplete, userRotation = 0, priceChange = 0, hasActiveClick = false }) {
  const gltf = useGLTF('/models/hands4.glb')
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
  const cryingEmojiRef = useRef()
  const cryingEmoji2Ref = useRef()
  const greenArrowRef = useRef()
  const redArrowRef = useRef()
  const iconLikeRef = useRef()
  const iconLoveRef = useRef()
  const iconText1Ref = useRef()
  const iconText2Ref = useRef()
  const iconPlayRef = useRef()
  const iconStarRef = useRef()
  const candleLabel2Ref = useRef()
  const phoneScreenRef = useRef()
  const phoneCaseRef = useRef()
  const [phoneCaseWorldPos, setPhoneCaseWorldPos] = useState([0, 0, 0])
  const [phoneCaseWorldQuat, setPhoneCaseWorldQuat] = useState([0, 0, 0, 1])
  const [raysVisible, setRaysVisible] = useState(true)
  const [randomUserImages, setRandomUserImages] = useState([])
  const [currentImageIndex, setCurrentImageIndex] = useState(0)
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
  
  // Animation mixers for animated emojis
  const devilMixerRef = useRef(null)
  const cryingMixerRef = useRef(null)
  const cryingMixer2Ref = useRef(null)
  
  // Market status based on price change
  const isLargeDown = priceChange <= -5 // Large downward price action (5% or more drop)
  const isModerateDown = priceChange < -2 && priceChange > -5 // Moderate down
  const isMiddling = priceChange >= -2 && priceChange <= 2 // Small swings (-2% to +2%)
  const isPositive = priceChange > 2 // Positive price action (more than 2% up)
  
  // Opacity targets for smooth fading - store target opacity for each emoji group
  const opacityTargets = useRef({
    emoji1: 0,
    emoji2: 0,
    emoji3: 0,
    emoji4: 0,
    emoji5: 0,
    worriedEmoji: 0,
    scaredEmoji: 0,
    devilEmoji: 0,
    cryingEmoji: 0,
    cryingEmoji2: 0,
    greenArrow: 0,
    redArrow: 0,
    iconLove: 0,
    iconText1: 0,
    iconText2: 0
  })
  
  // Current opacity values for smooth animation
  const currentOpacities = useRef({
    emoji1: 0,
    emoji2: 0,
    emoji3: 0,
    emoji4: 0,
    emoji5: 0,
    worriedEmoji: 0,
    scaredEmoji: 0,
    devilEmoji: 0,
    cryingEmoji: 0,
    cryingEmoji2: 0,
    greenArrow: 0,
    redArrow: 0,
    iconLove: 0,
    iconText1: 0,
    iconText2: 0
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
        
        // Find new emoji objects
        if (child.name === 'WorriedEmoji' || child.name === 'worriedEmoji' || child.name === 'worried-emoji') {
          worriedEmojiRef.current = child
          // console.log('😟 Found WorriedEmoji:', child.name)
        }
        if (child.name === 'ScaredEmoji' || child.name === 'scaredEmoji' || child.name === 'scared-emoji') {
          scaredEmojiRef.current = child
          // console.log('😱 Found ScaredEmoji:', child.name)
        }
        if (child.name === 'DevilEmoji' || child.name === 'devilEmoji' || child.name === 'devil-emoji') {
          devilEmojiRef.current = child
          // console.log('😈 Found DevilEmoji:', child.name)
          
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
            devilMixerRef.current = new THREE.AnimationMixer(child)
            
            // Find and play the Idle animation
            const idleAnimation = gltf.animations.find(clip => clip.name === 'Armature|Idle')
            if (idleAnimation) {
              const action = devilMixerRef.current.clipAction(idleAnimation)
              action.play()
              // console.log('Playing Armature|Idle animation on DevilEmoji')
            }
          }
        }
        if (child.name === 'CryingEmoji' || child.name === 'cryingEmoji' || child.name === 'crying-emoji') {
          cryingEmojiRef.current = child
          // console.log('😭 Found CryingEmoji:', child.name)
          
          // Set up animation mixer for CryingEmoji
          if (gltf.animations && gltf.animations.length > 0) {
            cryingMixerRef.current = new THREE.AnimationMixer(child)
            // Try both possible naming conventions
            const cryingAnimation = gltf.animations.find(clip => 
              clip.name === 'Armature|Idle.001' || clip.name === 'Armature|Idle001'
            )
            if (cryingAnimation) {
              const action = cryingMixerRef.current.clipAction(cryingAnimation)
              action.play()
              // console.log('Playing ' + cryingAnimation.name + ' animation on CryingEmoji')
            }
          }
        }
        if (child.name === 'CryingEmoji2' || child.name === 'cryingEmoji2' || child.name === 'crying-emoji-2') {
          cryingEmoji2Ref.current = child
          // console.log('😭 Found CryingEmoji2:', child.name)
          
          // Set up animation mixer for CryingEmoji2
          if (gltf.animations && gltf.animations.length > 0) {
            cryingMixer2Ref.current = new THREE.AnimationMixer(child)
            // Try both possible naming conventions
            const cryingAnimation = gltf.animations.find(clip => 
              clip.name === 'Armature|Idle.001' || clip.name === 'Armature|Idle001'
            )
            if (cryingAnimation) {
              const action = cryingMixer2Ref.current.clipAction(cryingAnimation)
              action.play()
              // console.log('Playing ' + cryingAnimation.name + ' animation on CryingEmoji2')
            }
          }
        }
        if (child.name === 'GreenArrow' || child.name === 'greenArrow' || child.name === 'green-arrow') {
          greenArrowRef.current = child
          // console.log('⬆️ Found GreenArrow:', child.name)
        }
        if (child.name === 'RedArrow' || child.name === 'redArrow' || child.name === 'red-arrow') {
          redArrowRef.current = child
          // console.log('⬇️ Found RedArrow:', child.name)
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
  }, [gltf])

  // Smooth opacity animation in render loop
  useFrame((state, delta) => {
    const fadeSpeed = 3.0 // Adjust this to control fade speed (higher = faster)
    
    // Helper function to update opacity for an object and its children
    const updateOpacityRecursive = (object, opacity) => {
      if (!object) return
      
      object.traverse((child) => {
        if (child.isMesh && child.material) {
          // Ensure material supports transparency
          child.material.transparent = true
          child.material.opacity = opacity
          
          // Hide object completely when opacity is near 0
          child.visible = opacity > 0.01
        }
      })
    }
    
    // Animate each emoji's opacity towards its target
    Object.keys(opacityTargets.current).forEach(key => {
      const target = opacityTargets.current[key]
      const current = currentOpacities.current[key]
      
      // Smooth interpolation towards target
      if (Math.abs(target - current) > 0.001) {
        currentOpacities.current[key] = THREE.MathUtils.lerp(current, target, fadeSpeed * delta)
        
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
          case 'cryingEmoji':
            updateOpacityRecursive(cryingEmojiRef.current, currentOpacities.current[key])
            break
          case 'cryingEmoji2':
            updateOpacityRecursive(cryingEmoji2Ref.current, currentOpacities.current[key])
            break
          case 'greenArrow':
            updateOpacityRecursive(greenArrowRef.current, currentOpacities.current[key])
            break
          case 'redArrow':
            updateOpacityRecursive(redArrowRef.current, currentOpacities.current[key])
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
  })
  
  // Control emoji visibility based on market status
  useEffect(() => {
    
    if (isPositive) {
      // Positive prices - fade in happy emojis and green arrow
      opacityTargets.current.emoji1 = 1
      opacityTargets.current.emoji3 = 1
      opacityTargets.current.emoji4 = 1
      opacityTargets.current.emoji5 = 1
      opacityTargets.current.greenArrow = 1
      opacityTargets.current.iconLove = 1
      opacityTargets.current.iconText1 = 1
      opacityTargets.current.iconText2 = 1
      
      // Fade out negative emojis
      opacityTargets.current.emoji2 = 0 // Not in positive list
      opacityTargets.current.worriedEmoji = 0
      opacityTargets.current.scaredEmoji = 0
      opacityTargets.current.devilEmoji = 0
      opacityTargets.current.cryingEmoji = 0
      opacityTargets.current.cryingEmoji2 = 0
      opacityTargets.current.redArrow = 0
      
      // console.log('📈 Market positive (+' + priceChange.toFixed(2) + '%) - showing happy emojis')
    } else if (isMiddling || isModerateDown) {
      // Middling prices and moderate downward action - fade in worried/scared emojis
      opacityTargets.current.worriedEmoji = 1
      opacityTargets.current.scaredEmoji = 1
      
      // Fade out positive emojis
      opacityTargets.current.emoji1 = 0
      opacityTargets.current.emoji3 = 0
      opacityTargets.current.emoji4 = 0
      opacityTargets.current.emoji5 = 0
      opacityTargets.current.greenArrow = 0
      opacityTargets.current.iconLove = 0
      opacityTargets.current.iconText1 = 0
      opacityTargets.current.iconText2 = 0
      
      // Fade out extreme negative emojis
      opacityTargets.current.devilEmoji = 0
      opacityTargets.current.cryingEmoji = 0
      opacityTargets.current.cryingEmoji2 = 0
      opacityTargets.current.redArrow = 0
      
      // Keep emoji2 and other icons neutral
      opacityTargets.current.emoji2 = 1
      
      // console.log('😟 Market middling (' + priceChange.toFixed(2) + '%) - showing worried emojis')
    } else if (isLargeDown) {
      // Large downward price action - fade in panic emojis
      opacityTargets.current.worriedEmoji = 1
      opacityTargets.current.scaredEmoji = 1
      opacityTargets.current.devilEmoji = 1
      opacityTargets.current.cryingEmoji = 1
      opacityTargets.current.cryingEmoji2 = 1
      opacityTargets.current.redArrow = 1
      
      // Fade out all positive emojis
      opacityTargets.current.emoji1 = 0
      opacityTargets.current.emoji2 = 0
      opacityTargets.current.emoji3 = 0
      opacityTargets.current.emoji4 = 0
      opacityTargets.current.emoji5 = 0
      opacityTargets.current.greenArrow = 0
      opacityTargets.current.iconLove = 0
      opacityTargets.current.iconText1 = 0
      opacityTargets.current.iconText2 = 0
      
      // Animations are already playing from model load, just ensure they're visible
      // console.log('📉💀 Market crash (' + priceChange.toFixed(2) + '%) - showing panic emojis with animations!')
    }
  }, [isPositive, isMiddling, isModerateDown, isLargeDown, priceChange, gltf])

  
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
      // console.log('🔄 Starting forward swivel animation!')
      animationStartTime2.current = Date.now()
    } else if (!isInView && swivelDirection.current === 'reverse') {
      // console.log('🔄 Starting reverse swivel animation!')
      animationStartTime2.current = Date.now()
    }
  }, [isInView])

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
  
  // Update animation mixers
  if (devilMixerRef.current) {
    devilMixerRef.current.update(delta)
  }
  if (cryingMixerRef.current) {
    cryingMixerRef.current.update(delta)
  }
  if (cryingMixer2Ref.current) {
    cryingMixer2Ref.current.update(delta)
  }
  
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
  
  // Animate arrows with directional motion
  if (greenArrowRef.current && greenArrowRef.current.visible) {
    if (!greenArrowRef.current.userData.initialY) {
      greenArrowRef.current.userData.initialY = greenArrowRef.current.position.y
    }
    // Upward pulsing motion
    greenArrowRef.current.position.y = greenArrowRef.current.userData.initialY + Math.sin(time * 3) * 0.06 + 0.2
  }
  
  if (redArrowRef.current && redArrowRef.current.visible) {
    if (!redArrowRef.current.userData.initialY) {
      redArrowRef.current.userData.initialY = redArrowRef.current.position.y
    }
    // Downward pulsing motion
    redArrowRef.current.position.y = redArrowRef.current.userData.initialY - Math.sin(time * 3) * 0.3 - 0.2
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
    console.log('📱 Phone position from:', phoneCaseRef.current ? 'phoneCase' : 'phoneScreen')
    console.log('📱 Phone world position:', worldPos)
    console.log('📱 Offerings available:', offerings?.length || 0)
    
    return { position: worldPos, quaternion: worldQuat, scale: worldScale }
  }
  return null
}, [phoneCaseRef.current, phoneScreenRef.current, offerings, hoveredOffering, justLitOffering])

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
        hasActiveClick={hasActiveClick}
      />
    )}
    
    {/* Aura that follows phoneCase world position */}
    {raysVisible && (
      <PhoneAura
        phonePosition={[
          phoneCaseWorldPos[0], 
          phoneCaseWorldPos[1] + 2.7,  // Y offset - adjust this value
          phoneCaseWorldPos[2] - 0.3
        ]}
        color='#00ffff'
        intensity={1}
        size={4}
        opacity={0.8}
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

export default function HandsGLTFScene({ onLoadComplete, offerings, hoveredOffering, justLitOffering, onJustLitComplete, priceChange = 0 }) {
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 })
  // Scroll tracking removed - no longer needed
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
    // Only start dragging if clicking in the bottom 40% of screen (where hands are)
    const screenHeight = window.innerHeight
    const clickY = event.clientY
    
    if (clickY > screenHeight * 0.6) {  // Bottom 40% of screen
      isDragging.current = true
      dragStart.current = {
        x: event.clientX,
        rotation: userRotation
      }
      if (typeof document !== 'undefined' && document.body) {
        document.body.style.cursor = 'grabbing'
      }
    }
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
    if (typeof document !== 'undefined' && document.body) {
      document.body.style.cursor = 'auto'
    }
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
        onPointerDown={(event) => {
          // Check if click is in upper portion where candles are
          const screenHeight = window.innerHeight
          const clickY = event.clientY || event.nativeEvent?.clientY || 0
          
          if (clickY < screenHeight * 0.6) {
            // Upper 60% - don't handle, let it pass through
            event.stopPropagation = () => {} // Disable stopPropagation
            return
          }
          handlePointerDown(event)
        }}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        onPointerMissed={(event) => {
          // When clicking on empty space, pass the event through
          console.log('Canvas pointer missed - clientY:', event?.clientY)
        }}
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
            userRotation={userRotation}
            priceChange={priceChange}
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