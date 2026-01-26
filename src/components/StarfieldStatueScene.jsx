'use client'

import React, { Suspense, useEffect, useRef } from 'react'
import { Canvas, useThree, useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useRouter } from 'next/navigation'
import StarField from '@/components/StarField'
import HolographicStatue3 from '@/components/HolographicStatue3'
import MobileCandleOrbital, { CandleOrbitalEffects } from './MobileCandleOrbital'
import BackgroundChart from './BackgroundChart'

// Crane shot loop - sweeps low to high and back while gently orbiting
function CraneShotCamera({ target = [0, 0.5, 0], radius = 2.0, orbitSpeed = 0.12, craneSpeed = 0.15, heightRange = [-0.5, 1.8] }) {
  const { camera } = useThree()
  const timeRef = useRef(0)
  const lookTarget = new THREE.Vector3(...target)

  useFrame((_, delta) => {
    timeRef.current += delta

    const t = timeRef.current

    // Gentle orbit
    const x = radius * Math.sin(t * orbitSpeed)
    const z = radius * Math.cos(t * orbitSpeed)

    // Crane sweep: smooth ease between low and high using smoothstep-like motion
    const raw = 0.5 + 0.5 * Math.sin(t * craneSpeed - Math.PI / 2)
    const eased = raw * raw * (3 - 2 * raw) // smoothstep for natural acceleration/deceleration
    const yMin = heightRange[0]
    const yMax = heightRange[1]
    const y = yMin + (yMax - yMin) * eased

    camera.position.set(x, y, z)
    camera.lookAt(lookTarget)
  })

  return null
}

function StarfieldStatueScene({
  style = {},
  className = '',
  starfieldProps = {},
  statueProps = {},
  cameraPosition = [0, 0.5, 1.5],
  cameraTarget = [0, 0.5, 0],
  cameraRadius = 2.0,
  enableControls = true,
  href,
  onStatueLoad,
}) {
  const router = useRouter()

  return (
    <div
      className={className}
      onClick={href ? () => router.push(href) : undefined}
      style={{
        width: '100%',
        height: '100%',
        background: 'transparent',
        position: 'relative',

        // CRT screen curvature

        perspective: '800px',
        cursor: href ? 'pointer' : 'default',
        transition: 'filter 0.3s ease',
        ...style
      }}
      onMouseEnter={href ? (e) => {
        e.currentTarget.style.filter = 'drop-shadow(0 0 25px rgba(0, 100, 255, 0.7)) brightness(1.05)'
      } : undefined}
      onMouseLeave={href ? (e) => {
        e.currentTarget.style.filter = 'none'
      } : undefined}
    >
    {/* Inner wrapper for barrel distortion effect */}
    <div style={{
      width: '100%',
      height: '100%',
      position: 'relative',
      transform: 'rotateX(1deg) rotateY(5deg) scaleX(1.2)',
      borderRadius: '8px',
      overflow: 'hidden',
    }}>
      {/* Monitor bezel frame */}
      <div style={{
        position: 'absolute',
        inset: 0,
        borderRadius: '12px',
        border: '2px solid rgba(80, 80, 80, 0.6)',
        boxShadow:
          'inset 0 0 30px rgba(0, 0, 0, 0.8), ' +
          '0 0 15px rgba(0, 255, 136, 0.15), ' +
          '0 0 40px rgba(0, 0, 0, 0.5)',
        zIndex: 10,
        pointerEvents: 'none',
        overflow: 'hidden',
      }}>
        {/* CRT scanlines */}
        <div style={{
          position: 'absolute',
          inset: 0,
          background:
            'repeating-linear-gradient(0deg, ' +
            'rgba(0, 0, 0, 0.15) 0px, ' +
            'rgba(0, 0, 0, 0.15) 1px, ' +
            'transparent 1px, ' +
            'transparent 3px)',
          opacity: 0.6,
          pointerEvents: 'none',
        }} />

        {/* Vignette */}
        <div style={{
          position: 'absolute',
          inset: 0,
          background:
            'radial-gradient(ellipse at center, ' +
            'transparent 50%, ' +
            'rgba(0, 0, 0, 0.4) 80%, ' +
            'rgba(0, 0, 0, 0.8) 100%)',
          pointerEvents: 'none',
        }} />

        {/* Subtle screen flicker */}
        <div style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(0, 255, 136, 0.02)',
          animation: 'crtFlicker 0.1s infinite alternate',
          pointerEvents: 'none',
        }} />

        {/* Screen reflection / glare */}
        <div style={{
          position: 'absolute',
          top: '-50%',
          left: '-50%',
          width: '200%',
          height: '200%',
          background:
            'linear-gradient(135deg, ' +
            'rgba(255, 255, 255, 0.03) 0%, ' +
            'transparent 40%, ' +
            'transparent 60%, ' +
            'rgba(255, 255, 255, 0.015) 100%)',
          pointerEvents: 'none',
        }} />
      </div>

      {/* HUD data overlay */}
      <div style={{
        position: 'absolute',
        inset: 0,
        zIndex: 11,
        pointerEvents: 'none',
        fontFamily: "'Courier New', monospace",
        fontSize: '0.6rem',
        letterSpacing: '0.1em',
        color: 'rgba(0, 255, 136, 0.5)',
      }}>
        {/* Top-left */}
        <div style={{ position: 'absolute', top: '12px', left: '14px' }}>
          <div>SIG: ACTIVE</div>
          <div style={{ opacity: 0.4 }}>CH-03 :: 120Hz</div>
        </div>
        {/* Top-right */}
        <div style={{ position: 'absolute', top: '12px', right: '14px', textAlign: 'right' }}>
          <div>LIVEi rev &#9679;</div>
          <div style={{ opacity: 0.4 }}>HOLO-FEED</div>
        </div>
        {/* Bottom-left */}
        <div style={{ position: 'absolute', bottom: '12px', left: '14px', opacity: 0.4 }}>
          OLPP-MK.VII
        </div>
        {/* Bottom-right */}
        <div style={{ position: 'absolute', bottom: '12px', right: '14px', textAlign: 'right', opacity: 0.4 }}>
          VOL: 48 NODES
        </div>
      </div>

      {/* Keyframes for CRT flicker */}
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes crtFlicker {
          0% { opacity: 0.02; }
          50% { opacity: 0.04; }
          100% { opacity: 0.01; }
        }
      `}} />

      <Canvas
        camera={{
          position: cameraPosition,
          fov: 50,
          near: 0.1,
          far: 1000
        }}
        gl={{
          antialias: true,
          alpha: true,
          powerPreference: 'high-performance',
        }}
        dpr={typeof window !== 'undefined' ? Math.min(window.devicePixelRatio, 2) : 1}
        style={{ background: 'transparent', borderRadius: '12px' }}
      >
        <Suspense fallback={null}>
          {/* Crane shot loop camera */}
          <CraneShotCamera target={cameraTarget} radius={cameraRadius} />

          {/* Ambient lighting */}
          <ambientLight intensity={0.3} />

          {/* Directional light for the statue */}
          <directionalLight
            position={[5, 5, 5]}
            intensity={0.5}
          />

          {/* Starfield background */}
          {/* <StarField
            radius={150}
            count1={500}
            count2={300}
            is80sMode={false}
            {...starfieldProps}
          /> */}

          {/* Cylindrical background chart */}
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

          {/* Holographic Statue */}
          <HolographicStatue3
            position={[0, 0, 0]}
            scale={[9, 9, 9]}
            rotation={[0, -Math.PI * 0.2, 0]}
            hover={true}
            rotate={true}
            onLoad={onStatueLoad}
            {...statueProps}
          />

          <MobileCandleOrbital />

          {/* OrbitControls removed in favor of Figure8Camera */}

          {/* Bloom postprocessing for flame glow */}
          <CandleOrbitalEffects />
        </Suspense>
      </Canvas>
    </div>
    </div>
  )
}

export default StarfieldStatueScene
