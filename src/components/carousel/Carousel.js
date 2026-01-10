'use client'

import * as THREE from 'three'
import { useRef, useState, Suspense, useMemo, useEffect, useCallback } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Image, Environment, ScrollControls, useScroll, useTexture, Text } from '@react-three/drei'
import { easing } from 'maath'
import './util'
import ExperienceControls from './ExperienceControls'
import { useMusic } from '../MusicContext'
import { useLanguage } from '../LanguageProvider'

import MobilePolaroidGallerySimple from './MobilePolaroidGallerySimple'

export default function CarouselComponent({ onReady, disableScrollControls = false }) {
  const [hoveredCaption, setHoveredCaption] = useState(null)
  const [sceneReady, setSceneReady] = useState(false)
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' ? window.innerWidth <= 768 : false)
  const [isMobilePhone, setIsMobilePhone] = useState(() => typeof window !== 'undefined' ? window.innerWidth <= 480 : false)
  const { is80sMode } = useMusic()
  const { t } = useLanguage()
  
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768)
      // Check specifically for mobile phones (not tablets)
      setIsMobilePhone(window.innerWidth <= 480)
    }
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Clear any pending timers
      if (onReady) {
        onReady = null
      }
    }
  }, [])
  
  useEffect(() => {
    if (sceneReady && onReady) {
      // Give a small delay for final rendering
      const timer = setTimeout(() => {
        onReady()
      }, 500)
      return () => clearTimeout(timer)
    }
  }, [sceneReady, onReady])
  
  return (
    <>
      <style jsx>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
      <div style={{ 
        width: '100%', 
        height: '100vh', 
        backgroundColor: (is80sMode && isMobilePhone) ? 'transparent' : '#000',
        position: 'relative',
        overflow: 'hidden'
      }}>
        {/* Video background for 80s mode - desktop only */}
        {is80sMode && !isMobilePhone && (
          <video
            autoPlay
            loop
            muted
            playsInline
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              opacity: 0.8,
              zIndex: 1,
              pointerEvents: 'none',
            }}
          >
            <source src="/videos/85.mp4" type="video/mp4" />
          </video>
        )}
      
      
      {/* Experience Controls - positioned top-right */}
      {!isMobilePhone && <ExperienceControls isMobile={isMobile} />}
      
      {/* Desktop Intro Section - bottom-left overlay */}
      {!isMobilePhone && (
        <div style={{
          position: 'fixed',
          bottom: '8%',
          left: '3%',
          zIndex: 20,
          maxWidth: '380px',
          padding: '10px',
          background: 'rgba(20, 15, 25, 0.85)',
          backdropFilter: 'blur(12px)',
          borderRadius: '8px',
          border: '1px solid rgba(255, 215, 0, 0.2)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
          animation: 'fadeInUp 0.8s ease-out',
        }}>
          <h2 style={{
            fontSize: '26px',
            fontFamily: 'UnifrakturCook, serif',
            color: '#ffd700',
            marginBottom: '10px',
            marginTop: '10px',
            letterSpacing: '0.5px',
            textShadow: '0 2px 4px rgba(0, 0, 0, 0.5)',
          }}>
            {t('carousel.title') || 'Iconography'}
          </h2>
          <p style={{
            fontSize: '14px',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
            color: 'rgba(255, 255, 255, 0.85)',
            lineHeight: '1.5',
            margin: 0,
          }}>
            {t('carousel.subtitle') || 'A visual canon of Our Lady of Perpetual Profit, from antiquity to the future.'}
          </p>
        </div>
      )}
      
      {/* Mobile Phone Gallery - replaces 3D carousel on phones */}
      {isMobilePhone ? (
        <div style={{ position: 'relative', zIndex: 10 }}>
          <MobilePolaroidGallerySimple 
            is80sMode={is80sMode}
            images={[
              { url: '/carousel_images/img1.jpg' },
              { url: '/carousel_images/img2.jpg' },
              { url: '/carousel_images/img3.jpg' },
              { url: '/carousel_images/img4.jpg' },
              { url: '/carousel_images/img5.jpg' },
              { url: '/carousel_images/img6.jpg' },
              { url: '/carousel_images/img7.jpg' },
              { url: '/carousel_images/img8.jpg' },
            ]}
          />
        </div>
      ) : (
      <Canvas 
        style={{ position: 'relative', zIndex: 2 }}
        camera={{ position: [0, 0, 100], fov: 15 }}
        gl={{
          antialias: true,
          alpha: true,
          preserveDrawingBuffer: false, // Don't preserve buffer for better memory
          powerPreference: "high-performance",
          failIfMajorPerformanceCaveat: false,
          stencil: false, // Disable stencil buffer if not needed
        }}
        onCreated={({ gl }) => {
          gl.toneMapping = THREE.ACESFilmicToneMapping
          gl.toneMappingExposure = 1
          // Mark scene as ready after canvas is created
          setTimeout(() => setSceneReady(true), 100)
        }}
      >
        <fog attach="fog" args={['#a79', 8.5, 12]} />
        <Suspense fallback={null}>
          {disableScrollControls ? (
            <>
              <AutoRotatingRig rotation={[0, 0, isMobile ? 0.03 : 0.15]}>
                <Carousel setHoveredCaption={setHoveredCaption} />
              </AutoRotatingRig>
              {!isMobile && <Banner position={[0, -0.15, 0]} is80sMode={is80sMode} disableScrollControls={true} />}
            </>
          ) : (
            <ScrollControls pages={4} infinite>
              <Rig rotation={[0, 0, isMobile ? 0.03 : 0.15]}>
                <Carousel setHoveredCaption={setHoveredCaption} />
              </Rig>
              {!isMobile && <Banner position={[0, -0.15, 0]} is80sMode={is80sMode} disableScrollControls={false} />}
            </ScrollControls>
          )}
          {!is80sMode && <Environment preset="dawn" background blur={0.5} />}
        </Suspense>
      </Canvas>
      )}
      
      </div>
    </>
  )
}

function Rig(props) {
  const ref = useRef()
  const scroll = useScroll()
  const frameCount = useRef(0)
  
  useFrame((state, delta) => {
    if (!ref.current) return
    
    frameCount.current++
    
    ref.current.rotation.y = -scroll.offset * (Math.PI * 2)
    
    // Throttle camera updates to every 2 frames
    if (frameCount.current % 2 === 0) {
      state.events.update()
      easing.damp3(state.camera.position, [-state.pointer.x * 2, state.pointer.y + 1.5, 10], 0.3, delta * 2)
      state.camera.lookAt(0, 0, 0)
    }
  })
  
  return <group ref={ref} {...props} />
}

function AutoRotatingRig(props) {
  const ref = useRef()
  const frameCount = useRef(0)
  
  useFrame((state, delta) => {
    if (!ref.current) return
    
    frameCount.current++
    
    // Auto-rotate the carousel
    ref.current.rotation.y += delta * 0.1
    
    // Throttle camera updates to every 2 frames
    if (frameCount.current % 2 === 0) {
      state.events.update()
      easing.damp3(state.camera.position, [-state.pointer.x * 2, state.pointer.y + 1.5, 10], 0.3, delta * 2)
      state.camera.lookAt(0, 0, 0)
    }
  })
  
  return <group ref={ref} {...props} />
}

function Carousel({ radius = 1.4, count = 8, setHoveredCaption }) {
  const { t } = useLanguage()
  
  // Memoize captions to prevent recreation
  const captions = useMemo(() => {
    // Try to get captions from translations, fallback to hardcoded if not available
    const translatedCaptions = []
    for (let i = 0; i < 8; i++) {
      const caption = t(`carousel.captions.${i}`)
      if (caption && typeof caption === 'object') {
        translatedCaptions.push(caption)
      }
    }
    
    // If we got all 8 captions from translations, use them
    if (translatedCaptions.length === 8) {
      return translatedCaptions
    }
    
    // Otherwise fallback to hardcoded captions
    return [
      {
        year: "2200 BCE",
        location: "High Pass of the Fertile Crescent",
        description: "Driving back bear market chaos with a vector of luminous intent"
      },
      {
        year: "1981 CE",
        location: "Los Angeles",
        description: "The Guardian of Good Times"
      },
      {
        year: "circa 1350–1450 CE",
        location: "Eastern Mediterranean",
        description: "Early clown encounter turns ugly."
      },
      {
        year: "2019 CE",
        location: "Tokyo",
        description: "Featured in popular manga series'"
      },
      {
        year: "2031 CE",
        location: "Neo-Miami",
        description: "Our Lady establishes a new musical sub-genre, 'DeFi Beats'"
      },
      {
        year: "2077 CE",
        location: "Night City",
        description: "Autonomous artisans inscribe digital sigils."
      },
      {
        year: "87 CE",
        location: "Peloponnesian Peninsula",
        description: "A timeless tutelage between good and evil"
      },
      {
        year: "4th century CE",
        location: "Transtiberim, Rome",
        description: "Pre-meme era patronage of the arts, mimes were gaining cultural traction."
      }
    ]
  }, [t])
  
  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <Card
          key={i}
          url={`/carousel_images/img${(i % 9) + 1}.${i === 8 ? 'jpeg' : 'jpg'}`}
          position={[Math.sin((i / count) * Math.PI * 2) * radius, 0, Math.cos((i / count) * Math.PI * 2) * radius]}
          rotation={[0, (i / count) * Math.PI * 2, 0]}
          caption={captions[i]}
          setHoveredCaption={setHoveredCaption}
        />
      ))}
    </>
  )
}

function Card({ url, caption, setHoveredCaption, ...props }) {
  const groupRef = useRef()
  const imageRef = useRef()
  const [hovered, hover] = useState(false)
  const frameCount = useRef(0)
  
  const pointerOver = useCallback((e) => {
    e.stopPropagation()
    hover(true)
    if (setHoveredCaption && caption) {
      setHoveredCaption(caption)
    }
  }, [setHoveredCaption, caption])
  
  const pointerOut = useCallback(() => {
    hover(false)
    if (setHoveredCaption) {
      setHoveredCaption(null)
    }
  }, [setHoveredCaption])
  
  useFrame((_, delta) => {
    if (!groupRef.current) return
    
    frameCount.current++
    
    // Throttle animations to every 2 frames for better performance
    if (frameCount.current % 2 === 0) {
      easing.damp3(groupRef.current.scale, hovered ? 1.15 : 1, 0.1, delta * 2)
      
      if (imageRef.current?.material) {
        easing.damp(imageRef.current.material, 'radius', hovered ? 0 : 0, 0.2, delta * 2)
        easing.damp(imageRef.current.material, 'zoom', hovered ? 1 : 1.5, 0.2, delta * 2)
      }
    }
  })
  
  return (
    <group ref={groupRef} {...props}>
      {/* White polaroid frame background */}
      <mesh position={[0, -0.08, -0.001]}>
        <planeGeometry args={[1.05, 1.3]} />
        <meshBasicMaterial color="#ffffff" side={THREE.DoubleSide} toneMapped={false} fog={false} />
      </mesh>
      
      {/* The actual image - front side only */}
      <Image 
        ref={imageRef} 
        url={url} 
        transparent 
        side={THREE.FrontSide} 
        onPointerOver={pointerOver} 
        onPointerOut={pointerOut} 
        position={[0, 0.05, 0.001]}
      >
        <planeGeometry args={[0.85, 0.85]} />
      </Image>
      
      {/* Black back of the entire polaroid */}
      <mesh position={[0, -0.08, -0.002]}>
        <planeGeometry args={[1.05, 1.3]} />
        <meshBasicMaterial color="#000000" side={THREE.BackSide} toneMapped={false} fog={false} />
      </mesh>
      
      {/* Caption text on the bottom border */}
      {caption && (
        <>
          <Text
            position={[0, -0.45, 0.001]}
            fontSize={0.06}
            color="black"
            anchorX="center"
            anchorY="middle"
            maxWidth={1.2}
            lineHeight={1.2}
            font="/fonts/HomemadeApple-Regular.ttf"
          >
            {caption.year}
          </Text>
          <Text
            position={[0, -0.52, 0.001]}
            fontSize={0.04}
            color="#444444"
            anchorX="center"
            anchorY="middle"
            maxWidth={1.2}
            lineHeight={1.4}
            font="/fonts/HomemadeApple-Regular.ttf"
          >
            {caption.location}
          </Text>
          <Text
            position={[0, -0.61, 0.001]}
            fontSize={0.04}
            color="#666666"
            anchorX="center"
            anchorY="middle"
            maxWidth={1}
            lineHeight={1.4}
            font="/fonts/HomemadeApple-Regular.ttf"
            textAlign="center"
          >
            {caption.description}
          </Text>
        </>
      )}
      
      {/* Shadow effect */}
      <mesh position={[0.02, -0.1, -0.002]}>
        <planeGeometry args={[1.08, 1.33]} />
        <meshBasicMaterial color="#000000" opacity={0.15} transparent side={THREE.DoubleSide} />
      </mesh>
    </group>
  )
}

// Video Card component - use this if you want video support
function VideoCard({ videoUrl, ...props }) {
  const ref = useRef()
  const [hovered, hover] = useState(false)
  const [videoReady, setVideoReady] = useState(false)
  
  const [video] = useState(() => {
    const vid = document.createElement('video')
    vid.crossOrigin = 'anonymous'
    vid.loop = true
    vid.muted = true
    vid.playsInline = true
    vid.autoplay = true
    vid.setAttribute('muted', '')
    vid.setAttribute('playsinline', '')
    return vid
  })
  
  const texture = useMemo(() => {
    if (!videoReady) return null
    const videoTexture = new THREE.VideoTexture(video)
    videoTexture.minFilter = THREE.LinearFilter
    videoTexture.magFilter = THREE.LinearFilter
    videoTexture.format = THREE.RGBAFormat
    return videoTexture
  }, [video, videoReady])
  
  useEffect(() => {
    const handleLoadedData = () => {
      setVideoReady(true)
      video.play().catch(e => {
        console.log('Video autoplay failed, trying muted play:', e)
        video.muted = true
        video.play().catch(err => console.error('Video play still failed:', err))
      })
    }
    
    const handleError = () => {
      console.log('Video not available, using fallback image')
      setVideoReady(false)
    }
    
    video.addEventListener('loadeddata', handleLoadedData)
    video.addEventListener('error', handleError)
    
    video.src = videoUrl
    video.load()
    
    return () => {
      video.removeEventListener('loadeddata', handleLoadedData)
      video.removeEventListener('error', handleError)
      video.pause()
      video.src = ''
      video.load() // Reset video element
      if (texture) texture.dispose()
    }
  }, [video, videoUrl, texture])
  
  useFrame((_, delta) => {
    if (!ref.current) return
    easing.damp3(ref.current.scale, hovered ? 1.15 : 1, 0.1, delta)
  })
  
  // Fallback to image while video loads or if it fails
  if (!texture) {
    return (
      <Card url="/carousel_images/img1.jpg" {...props} />
    )
  }
  
  return (
    <mesh 
      ref={ref} 
      onPointerOver={(e) => {
        e.stopPropagation()
        hover(true)
        video.play()
      }}
      onPointerOut={() => {
        hover(false)
      }}
      {...props}
    >
      <planeGeometry args={[0.85, 1]} />
      <meshBasicMaterial map={texture} side={THREE.DoubleSide} toneMapped={false} />
    </mesh>
  )
}


function Banner(props) {
  const { is80sMode, disableScrollControls } = props
  const ref = useRef()
  const scroll = disableScrollControls ? null : useScroll()
  
  // Create text texture using canvas
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas')
    const context = canvas.getContext('2d')
    
    // Configuration for exact phrase repetitions
    const DESIRED_PHRASE_COUNT = 5  // Exactly 5 complete phrases around cylinder
    const CYLINDER_RADIUS = 1.6
    const CYLINDER_CIRCUMFERENCE = 2 * Math.PI * CYLINDER_RADIUS  // ≈ 10.05
    
    // Set up canvas styling first
    const fontSize = 84
    context.font = `bold ${fontSize}px UnifrakturCook, serif`
    
    // Single instance of text for texture
    const text = 'Our Lady of Perpetual Profit • Domina Nostra Lucri Perpetui • ';
    
    // Measure text to determine canvas dimensions
    const metrics = context.measureText(text)
    const textWidth = metrics.width
    
    // Calculate canvas width to fit exact number of phrases
    // We want the texture to contain exactly enough text for the desired repetitions
    const texturePhraseCount = Math.ceil(DESIRED_PHRASE_COUNT)
    canvas.width = Math.ceil(textWidth * texturePhraseCount)
    canvas.height = 128
    
    // Style the canvas - neon blue in 80s mode, white normally
    context.fillStyle = is80sMode ? '#00ffff' : '#ffffff'
    context.fillRect(0, 0, canvas.width, canvas.height)
    
    // Re-set font after canvas resize (canvas resize resets context state)
    context.font = `bold ${fontSize}px UnifrakturCook, serif`
    context.fillStyle = is80sMode ? '#000000' : '#000000'
    context.textAlign = 'left'
    context.textBaseline = 'middle'
    
    // Draw exactly the right number of phrases
    for (let i = 0; i < texturePhraseCount; i++) {
      context.fillText(text, i * textWidth, canvas.height / 2)
    }
    
    // Create texture from canvas
    const canvasTexture = new THREE.CanvasTexture(canvas)
    canvasTexture.wrapS = THREE.RepeatWrapping
    canvasTexture.wrapT = THREE.ClampToEdgeWrapping
    
    // Set texture repeat to exactly 1 to use the full texture once around the cylinder
    // This ensures exactly DESIRED_PHRASE_COUNT phrases appear
    canvasTexture.repeat.set(1, 1)
    canvasTexture.needsUpdate = true
    
    return canvasTexture
  }, [is80sMode])
  
  // Cleanup texture on unmount
  useEffect(() => {
    return () => {
      if (texture) {
        texture.dispose()
      }
    }
  }, [texture])
  
  // Add frame counter for throttling
  const frameCount = useRef(0)
  
  useFrame((_, delta) => {
    frameCount.current++
    
    // Update texture offset every frame for smooth scrolling
    if (texture) {
      texture.offset.x += delta / 24
    }
    
    // Throttle material time updates
    if (frameCount.current % 3 === 0 && ref.current?.material?.time) {
      // Use a default animation speed when scroll is not available
      const scrollDelta = scroll ? Math.abs(scroll.delta) : 0.01
      ref.current.material.time.value += scrollDelta * 4 * 3 // Multiply by 3 to compensate for throttling
    }
  })
  
  return (
    <mesh ref={ref} {...props}>
      <cylinderGeometry args={[1.6, 1.6, 0.14, 128, 16, true]} />
      <meshSineMaterial 
        map={texture} 
        side={THREE.DoubleSide} 
        transparent={true}
        toneMapped={false}
      />
    </mesh>
  )
}