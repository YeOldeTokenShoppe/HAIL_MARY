'use client'

import React, { Suspense } from 'react'
import dynamic from 'next/dynamic'
import { Canvas, useThree, useFrame } from '@react-three/fiber'
import * as THREE from 'three'

const HolographicStatue3 = dynamic(
  () => import('@/components/HolographicStatue3'),
  { ssr: false }
)
const BackgroundChart = dynamic(
  () => import('@/components/BackgroundChart'),
  { ssr: false }
)
const CandleOrbitalEffects = dynamic(
  () => import('@/components/MobileCandleOrbital').then((m) => ({ default: m.CandleOrbitalEffects })),
  { ssr: false }
)

function CraneShotCamera({
  target = [0, 0.5, 0],
  radius = 2.0,
  orbitSpeed = 0.12,
  craneSpeed = 0.15,
  heightRange = [-0.5, 1.8],
}) {
  const { camera } = useThree()
  const timeRef = React.useRef(0)
  const lookTarget = new THREE.Vector3(...target)

  useFrame((_, delta) => {
    timeRef.current += delta
    const t = timeRef.current
    const x = radius * Math.sin(t * orbitSpeed)
    const z = radius * Math.cos(t * orbitSpeed)
    const raw = 0.5 + 0.5 * Math.sin(t * craneSpeed - Math.PI / 2)
    const eased = raw * raw * (3 - 2 * raw)
    const y = heightRange[0] + (heightRange[1] - heightRange[0]) * eased
    camera.position.set(x, y, z)
    camera.lookAt(lookTarget)
  })

  return null
}

export default function StatueTestMinPage() {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: '#000',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem',
      }}
    >
      <div style={{ width: 'min(700px, 90vw)', height: 'min(500px, 70vh)', background: '#000' }}>
        <Canvas
          camera={{ position: [0, 0.5, 1.5], fov: 50, near: 0.1, far: 1000 }}
          gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
          dpr={typeof window !== 'undefined' ? Math.min(window.devicePixelRatio, 2) : 1}
          style={{ background: 'transparent' }}
        >
          <Suspense fallback={null}>
            <CraneShotCamera radius={2.0} />
            <ambientLight intensity={0.3} />
            <directionalLight position={[5, 5, 5]} intensity={0.5} />
            <BackgroundChart
              position={[0, -2, 0]}
              radius={4}
              height={18.5}
              pointCount={120}
              color="#00ff88"
              glowColor="#00ffaa"
              opacity={0.5}
              scrollSpeed={0.5}
              verticalLines={48}
            />
            <HolographicStatue3
              position={[0, 0, 0]}
              scale={[3, 3, 3]}
              rotation={[0, -Math.PI * 0.2, 0]}
              hover={true}
              rotate={true}
            />
          </Suspense>
          <CandleOrbitalEffects />
        </Canvas>
      </div>
    </div>
  )
}
