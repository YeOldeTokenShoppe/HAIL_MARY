'use client'

import * as THREE from 'three'
import { useRef, useState, Suspense, useMemo, useEffect } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Image, Environment, ScrollControls, useScroll, useTexture } from '@react-three/drei'
import { easing } from 'maath'
import './util'

export default function CarouselComponent() {
  const [hoveredCaption, setHoveredCaption] = useState(null)
  
  return (
    <div style={{ width: '100%', height: '100vh', background: '#000' }}>
      <CaptionOverlay caption={hoveredCaption} />
      <Canvas 
        camera={{ position: [0, 0, 100], fov: 15 }}
        onCreated={({ gl }) => {
          gl.toneMapping = THREE.ACESFilmicToneMapping
          gl.toneMappingExposure = 1
        }}
      >
        <fog attach="fog" args={['#a79', 8.5, 12]} />
        <Suspense fallback={null}>
          <ScrollControls pages={4} infinite>
            <Rig rotation={[0, 0, 0.15]}>
              <Carousel setHoveredCaption={setHoveredCaption} />
            </Rig>
            <Banner position={[0, -0.15, 0]} />
          </ScrollControls>
          <Environment preset="dawn" background blur={0.5} />
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
          rotation={[0, Math.PI + (i / count) * Math.PI * 2, 0]}
          caption={captions[i]}
          setHoveredCaption={setHoveredCaption}
        />
      ))}
    </>
  )
}

function Card({ url, caption, setHoveredCaption, ...props }) {
  const ref = useRef()
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
    if (!ref.current) return
    
    easing.damp3(ref.current.scale, hovered ? 1.15 : 1, 0.1, delta)
    
    if (ref.current.material) {
      easing.damp(ref.current.material, 'radius', hovered ? 0.25 : 0.1, 0.2, delta)
      easing.damp(ref.current.material, 'zoom', hovered ? 1 : 1.5, 0.2, delta)
    }
  })
  
  return (
    <Image 
      ref={ref} 
      url={url} 
      transparent 
      side={THREE.DoubleSide} 
      onPointerOver={pointerOver} 
      onPointerOut={pointerOut} 
      {...props}
    >
      <planeGeometry args={[0.85, 1]} />
    </Image>
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

function CaptionOverlay({ caption }) {
  return (
    <div
      style={{
        position: 'fixed',
        bottom: '30px',
        left: '50%',
        transform: `translateX(-50%) ${caption ? 'translateY(0)' : 'translateY(150px)'}`,
        background: 'rgba(0, 0, 0, 0.9)',
        backdropFilter: 'blur(20px)',
        padding: '12px 20px',
        borderRadius: '12px',
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        zIndex: 100,
        border: '1px solid rgba(255, 100, 255, 0.3)',
        boxShadow: '0 10px 40px rgba(255, 100, 255, 0.25)',
        opacity: caption ? 1 : 0,
        pointerEvents: 'none',
        maxWidth: '400px',
      }}
    >
      {caption && (
        <div
          style={{
            textAlign: 'center',
          }}
        >
          <div
            style={{
              fontSize: '0.9rem',
              fontWeight: 'bold',
              background: 'linear-gradient(135deg, #ff6ec7, #c77dff, #7209b7)',
              backgroundClip: 'text',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              marginBottom: '4px',
              letterSpacing: '1.5px',
              textTransform: 'uppercase',
              fontFamily: 'monospace',
              textShadow: '0 0 10px rgba(255, 100, 255, 0.4)',
            }}
          >
            {caption.year}
          </div>
          <div
            style={{
              fontSize: '0.75rem',
              color: '#ff6ec7',
              marginBottom: '6px',
              fontWeight: '300',
              letterSpacing: '1px',
              textTransform: 'uppercase',
            }}
          >
            {caption.location}
          </div>
          <div
            style={{
              fontSize: '0.65rem',
              color: 'rgba(255, 255, 255, 0.85)',
              lineHeight: '1.4',
              fontStyle: 'italic',
            }}
          >
            {caption.description}
          </div>
        </div>
      )}
    </div>
  )
}

function Banner(props) {
  const ref = useRef()
  const scroll = useScroll()
  
  // Create text texture using canvas
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas')
    const context = canvas.getContext('2d')
    canvas.width = 2048
    canvas.height = 128
    
    // Style the canvas
    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, canvas.width, canvas.height)
    
    // Add text
    context.fillStyle = '#000000'
    context.font = 'bold 4rem UnifrakturCook, serif'
    context.textAlign = 'center'
    context.textBaseline = 'middle'
    
    // Repeat text pattern
    const text = 'Our Lady of Perpetual Profit • Nostra Mater de Perpetuum Lucrum • '
    const textWidth = context.measureText(text).width
    const repeats = Math.ceil(canvas.width / textWidth) + 1
    
    for (let i = 0; i < repeats; i++) {
      context.fillText(text, i * textWidth, canvas.height / 2)
    }
    
    // Create texture from canvas
    const canvasTexture = new THREE.CanvasTexture(canvas)
    canvasTexture.wrapS = canvasTexture.wrapT = THREE.RepeatWrapping
    canvasTexture.repeat.set(5, 1)
    canvasTexture.needsUpdate = true
    
    return canvasTexture
  }, [])
  
  useFrame((_, delta) => {
    if (texture) {
      texture.offset.x += delta / 4
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