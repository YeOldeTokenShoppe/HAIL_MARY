// https://cydstumpel.nl/

import * as THREE from 'three'
import { useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Image, Environment, ScrollControls, useScroll, useTexture, useVideoTexture } from '@react-three/drei'
import { easing } from 'maath'
import './util'

const cardSlides = [
  { type: 'image', url: '/carousel_images/img1.jpg' },
  { type: 'image', url: '/carousel_images/img2.jpg' },
  { type: 'image', url: '/carousel_images/img3.jpg' },
  { type: 'image', url: '/carousel_images/img4.jpg' },
  { type: 'image', url: '/carousel_images/img5.jpg' },
  { type: 'video', url: '/videos/gr80_greetings.mp4' },
  { type: 'image', url: '/carousel_images/img7.jpg' },
  { type: 'image', url: '/carousel_images/img8.jpg' },
]

export const App = () => (
  <Canvas camera={{ position: [0, 0, 100], fov: 15 }}>
    <fog attach="fog" args={['#a79', 8.5, 12]} />
    <ScrollControls pages={4} infinite>
      <Rig rotation={[0, 0, 0.15]}>
        <Carousel />
      </Rig>
      <Banner position={[0, -0.15, 0]} />
    </ScrollControls>
    <Environment preset="dawn" background blur={0.5} />
  </Canvas>
)

function Rig(props) {
  const ref = useRef()
  const scroll = useScroll()
  useFrame((state, delta) => {
    ref.current.rotation.y = scroll.offset * (Math.PI * 2)
    state.events.update()
    easing.damp3(state.camera.position, [-state.pointer.x * 2, state.pointer.y + 1.5, 10], 0.3, delta)
    state.camera.lookAt(0, 0, 0)
  })
  return <group ref={ref} {...props} />
}

function Carousel({ radius = 1.4, count = 8 }) {
  return Array.from({ length: count }, (_, i) => {
    const slide = cardSlides[i % cardSlides.length]
    const position = [Math.sin((i / count) * Math.PI * 2) * radius, 0, Math.cos((i / count) * Math.PI * 2) * radius]
    const rotation = [0, (i / count) * Math.PI * 2, 0]

    if (slide.type === 'video') {
      return <VideoCard key={i} url={slide.url} position={position} rotation={rotation} />
    }
    return <Card key={i} url={slide.url} position={position} rotation={rotation} />
  })
}

function Card({ url, ...props }) {
  const ref = useRef()
  const [hovered, hover] = useState(false)
  const pointerOver = (e) => (e.stopPropagation(), hover(true))
  const pointerOut = () => hover(false)
  useFrame((state, delta) => {
    easing.damp3(ref.current.scale, hovered ? 1.15 : 1, 0.1, delta)
    easing.damp(ref.current.material, 'radius', hovered ? 0.25 : 0.1, 0.2, delta)
    easing.damp(ref.current.material, 'zoom', hovered ? 1 : 1.5, 0.2, delta)
  })
  return (
    <Image ref={ref} url={url} transparent side={THREE.DoubleSide} onPointerOver={pointerOver} onPointerOut={pointerOut} {...props}>
      <bentPlaneGeometry args={[0.001, 1, 1, 20, 20]} />
    </Image>
  )
}

function VideoCard({ url, ...props }) {
  const ref = useRef()
  const [hovered, hover] = useState(false)
  const texture = useVideoTexture(url, { muted: true, loop: true, playsInline: true })
  const pointerOver = (e) => (e.stopPropagation(), hover(true))
  const pointerOut = () => hover(false)
  const handleClick = () => {
    const video = texture.image
    if (video) {
      video.muted = !video.muted
    }
  }
  useFrame((state, delta) => {
    easing.damp3(ref.current.scale, hovered ? 1.15 : 1, 0.1, delta)
  })
  return (
    <mesh ref={ref} onPointerOver={pointerOver} onPointerOut={pointerOut} onClick={handleClick} {...props}>
      <bentPlaneGeometry args={[0.001, 1, 1, 20, 20]} />
      <meshBasicMaterial map={texture} side={THREE.DoubleSide} toneMapped={false} />
    </mesh>
  )
}

function Banner(props) {
  const ref = useRef()
  const texture = useTexture('/images/carouselSIgn3.webp')
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping
  const scroll = useScroll()
  useFrame((state, delta) => {
    ref.current.material.time.value += Math.abs(scroll.delta) * 4
    ref.current.material.map.offset.x += delta / 2
  })
  return (
    <mesh ref={ref} {...props}>
      <cylinderGeometry args={[1.6, 1.6, 0.14, 128, 16, true]} />
      <meshSineMaterial map={texture} map-anisotropy={16} map-repeat={[30, 1]} side={THREE.DoubleSide} toneMapped={false} />
    </mesh>
  )
}
