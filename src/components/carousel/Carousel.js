'use client'

import * as THREE from 'three'
import { useRef, useState, Suspense, useMemo, useEffect } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Image, Environment, ScrollControls, useScroll, useTexture, Text } from '@react-three/drei'
import { easing } from 'maath'
import './util'
import CyberGlitchButton from './CyberGlitchButton'
import ExperienceControls from './ExperienceControls'
import { useMusic } from '../MusicContext'

export default function CarouselComponent({ onReady }) {
  const [hoveredCaption, setHoveredCaption] = useState(null)
  const [sceneReady, setSceneReady] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const { is80sMode } = useMusic()
  
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768)
    }
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
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
    <div style={{ width: '100%', height: '100vh', background: '#000', position: 'relative' }}>
      {/* Video background for 80s mode */}
      {is80sMode && (
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
            zIndex: 2,
            pointerEvents: 'none',
          }}
        >
          <source src="/videos/84.mp4" type="video/mp4" />
        </video>
      )}
      
      {isMobile && (
        <div
          style={{
            position: 'fixed',
            bottom: '30px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 100,
          }}
        >
          <CyberGlitchButton 
            text="BUY RL80_"
            onClick={() => {
              const event = new CustomEvent('openBuyModal')
              window.dispatchEvent(event)
            }}
            label="RP80"
            mobile={true}
          />
        </div>
      )}
      
      {/* Experience Controls - positioned top-right */}
      <ExperienceControls isMobile={isMobile} />
      
      <Canvas 
        style={{ position: 'relative', zIndex: 2 }}
        camera={{ position: [0, 0, 100], fov: 15 }}
        onCreated={({ gl }) => {
          gl.toneMapping = THREE.ACESFilmicToneMapping
          gl.toneMappingExposure = 1
          // Mark scene as ready after canvas is created
          setTimeout(() => setSceneReady(true), 100)
        }}
      >
        <fog attach="fog" args={['#a79', 8.5, 12]} />
        <Suspense fallback={null}>
          <ScrollControls pages={4} infinite>
            <Rig rotation={[0, 0, isMobile ? 0.03 : 0.15]}>
              <Carousel setHoveredCaption={setHoveredCaption} />
            </Rig>
            <Banner position={[0, -0.15, 0]} is80sMode={is80sMode} />
          </ScrollControls>
          {!is80sMode && <Environment preset="dawn" background blur={0.5} />}
        </Suspense>
      </Canvas>
    </div>
  )
}

function Rig(props) {
  const ref = useRef()
  const scroll = useScroll()
  
  useFrame((state, delta) => {
    if (!ref.current) return
    
    ref.current.rotation.y = -scroll.offset * (Math.PI * 2)
    state.events.update()
    easing.damp3(state.camera.position, [-state.pointer.x * 2, state.pointer.y + 1.5, 10], 0.3, delta)
    state.camera.lookAt(0, 0, 0)
  })
  
  return <group ref={ref} {...props} />
}

function Carousel({ radius = 1.4, count = 8, setHoveredCaption }) {
  // Caption data for each image - customize these as needed
  const captions = [
    {
      year: "3500 BCE",
      location: "Mesopotamian Temple",
      description: "The first algorithmic prophecy carved in cuneiform, predicting the rise of digital consciousness"
    },
    {
      year: "1348 CE",
      location: "Venice Trading Floor",
      description: "Medieval merchants discover fractal patterns in plague-era market collapses"
    },
    {
      year: "1987 CE",
      location: "Tokyo Stock Exchange",
      description: "Black Monday's neon afterglow reveals the sacred geometry of financial crisis"
    },
    {
      year: "2089 CE",
      location: "Neo-Miami Crypto Basilica",
      description: "Post-flood traders worship at the altar of quantum blockchain oracles"
    },
    {
      year: "2156 CE",
      location: "Lunar Mining Colony",
      description: "Helium-3 futures manifest as holographic prayer wheels in low gravity"
    },
    {
      year: "2234 CE",
      location: "Europa Deep Station",
      description: "Submarine markets trade in bioluminescent currencies beneath alien ice"
    },
    {
      year: "2455 CE",
      location: "Dyson Sphere Exchange",
      description: "Solar energy derivatives reach enlightenment at the speed of light"
    },
    {
      year: "2801 CE",
      location: "Andromeda Gateway",
      description: "Intergalactic arbitrage creates wormholes in the fabric of economic reality"
    }
  ]
  
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
  const pointerOver = (e) => {
    e.stopPropagation()
    hover(true)
    if (setHoveredCaption && caption) {
      setHoveredCaption(caption)
    }
  }
  const pointerOut = () => {
    hover(false)
    if (setHoveredCaption) {
      setHoveredCaption(null)
    }
  }
  
  useFrame((_, delta) => {
    if (!groupRef.current) return
    
    easing.damp3(groupRef.current.scale, hovered ? 1.15 : 1, 0.1, delta)
    
    if (imageRef.current?.material) {
      easing.damp(imageRef.current.material, 'radius', hovered ? 0 : 0, 0.2, delta)
      easing.damp(imageRef.current.material, 'zoom', hovered ? 1 : 1.5, 0.2, delta)
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
            position={[0, -0.48, 0.001]}
            fontSize={0.06}
            color="black"
            anchorX="center"
            anchorY="middle"
            maxWidth={0.9}
            lineHeight={1.4}
            font="/fonts/HomemadeApple-Regular.ttf"
          >
            {caption.year}
          </Text>
          <Text
            position={[0, -0.54, 0.001]}
            fontSize={0.04}
            color="#444444"
            anchorX="center"
            anchorY="middle"
            maxWidth={0.9}
            lineHeight={1.4}
            font="/fonts/HomemadeApple-Regular.ttf"
          >
            {caption.location}
          </Text>
          <Text
            position={[0, -0.62, 0.001]}
            fontSize={0.04}
            color="#666666"
            anchorX="center"
            anchorY="middle"
            maxWidth={0.85}
            lineHeight={1.4}
            font="/fonts/HomemadeApple-Regular.ttf"
            textAlign="center"
          >
            {caption.description.substring(0, 45)}...
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
    video.addEventListener('loadeddata', () => {
      setVideoReady(true)
      video.play().catch(e => {
        console.log('Video autoplay failed, trying muted play:', e)
        video.muted = true
        video.play().catch(err => console.error('Video play still failed:', err))
      })
    })
    
    video.addEventListener('error', (e) => {
      console.log('Video not available, using fallback image')
      setVideoReady(false)
    })
    
    video.src = videoUrl
    video.load()
    
    return () => {
      video.pause()
      video.src = ''
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
  const { is80sMode } = props
  const ref = useRef()
  const scroll = useScroll()
  
  // Create text texture using canvas
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas')
    const context = canvas.getContext('2d')
    canvas.width = 2048  // Higher resolution for better quality
    canvas.height = 128
    
    // Style the canvas - neon blue in 80s mode, white normally
    context.fillStyle = is80sMode ? '#00ffff' : '#ffffff'
    context.fillRect(0, 0, canvas.width, canvas.height)
    
    // Add text - white in 80s mode, black normally
    context.fillStyle = is80sMode ? '#000000' : '#000000'
    // Use fixed pixel size for consistency
    const fontSize = 84  // Adjust this value to change text size
    context.font = `bold ${fontSize}px UnifrakturCook, serif`
    context.textAlign = 'left'  // Use left alignment for precise positioning
    context.textBaseline = 'middle'
    
    // Single instance of text for texture
    const text = 'Our Lady of Perpetual Profit • Domina Nostra Lucri Perpetui • ';
    
    // Measure text to create seamless texture
    const metrics = context.measureText(text)
    const textWidth = metrics.width
    
    // Draw text multiple times to fill the canvas width
    let currentX = 0
    while (currentX < canvas.width + textWidth) {
      context.fillText(text, currentX, canvas.height / 2)
      currentX += textWidth
    }
    
    // Create texture from canvas
    const canvasTexture = new THREE.CanvasTexture(canvas)
    canvasTexture.wrapS = THREE.RepeatWrapping
    canvasTexture.wrapT = THREE.ClampToEdgeWrapping
    
    // Calculate repeat based on cylinder circumference
    // Cylinder radius is 1.6, so circumference = 2 * PI * 1.6 ≈ 10.05
    // Adjust this value to control how many times text appears around cylinder
    const textRepeatCount = 5  // Number of complete text repetitions around the cylinder
    canvasTexture.repeat.set(textRepeatCount, 1)
    canvasTexture.needsUpdate = true
    
    return canvasTexture
  }, [is80sMode])
  
  useFrame((_, delta) => {
    if (texture) {
      texture.offset.x += delta / 12
    }
    if (ref.current?.material?.time) {
      ref.current.material.time.value += Math.abs(scroll.delta) * 4
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