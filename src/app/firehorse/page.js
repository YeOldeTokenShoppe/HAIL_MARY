'use client'

import React, { Suspense } from 'react'
import { Canvas } from '@react-three/fiber'
import {
  OrbitControls,
  Stage,
  useGLTF,
  Html,
  useProgress,
} from '@react-three/drei'

function FireHorse(props) {
  const { scene } = useGLTF('/models/fireHorse.glb')
  return <primitive object={scene} {...props} />
}

// Preload so the model starts fetching before the canvas mounts
useGLTF.preload('/models/fireHorse.glb')

function Loader() {
  const { progress } = useProgress()
  return (
    <Html center>
      <div style={{ color: '#ff7a18', fontFamily: 'monospace', fontSize: 14 }}>
        {progress.toFixed(0)}% loaded
      </div>
    </Html>
  )
}

export default function FireHorsePage() {
  return (
    <div style={{ position: 'fixed', inset: 0, background: '#0a0608' }}>
      <Canvas
        shadows
        camera={{ position: [3, 2, 5], fov: 45, near: 0.1, far: 100 }}
        gl={{ antialias: true, powerPreference: 'high-performance' }}
        dpr={typeof window !== 'undefined' ? Math.min(window.devicePixelRatio, 2) : 1}
      >
        <color attach="background" args={['#0a0608']} />
        <Suspense fallback={<Loader />}>
          <Stage
            environment="city"
            intensity={0.5}
            adjustCamera={1.2}
            shadows={{ type: 'contact', opacity: 0.6, blur: 2 }}
          >
            <FireHorse />
          </Stage>
        </Suspense>
        <OrbitControls
          makeDefault
          autoRotate
          autoRotateSpeed={0.8}
          enablePan={false}
          minDistance={2}
          maxDistance={12}
        />
      </Canvas>
    </div>
  )
}
