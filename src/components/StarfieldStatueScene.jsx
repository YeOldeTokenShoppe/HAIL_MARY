'use client'

import React, { Suspense, useEffect, useRef } from 'react'
import { Canvas, useThree, useFrame } from '@react-three/fiber'
import { Stats } from '@react-three/drei'
import * as THREE from 'three'
import { useRouter } from 'next/navigation'
import StarField from '@/components/StarField'
import HolographicStatue3 from '@/components/HolographicStatue3'
import MobileCandleOrbital, { CandleOrbitalEffects } from './MobileCandleOrbital'
import BackgroundChart from './BackgroundChart'
import { getChamberFocus } from '@/utils/chamberFocus'

// Crane shot loop - sweeps low to high and back while gently orbiting
// `parkScreens` shortens the scroll distance the descent is mapped to,
// so the camera completes its travel that many viewport-heights BEFORE
// the page bottom and then sits parked — a static shot over the final
// stretch, which is what lets the chamber choreography (hold on the
// phone, slow reveal) play out fully on stage.
function getRootScrollProgress(parkScreens = 0) {
  if (typeof window === 'undefined') return 0

  const maxScroll =
    document.documentElement.scrollHeight - window.innerHeight
  const park = window.innerHeight * parkScreens
  const travel = Math.max(window.innerHeight * 3.4, maxScroll - park, 1)
  const progress = window.scrollY / travel
  return Math.min(Math.max(progress, 0), 1)
}

function smoothProgress(value) {
  return value * value * (3 - 2 * value)
}

function CraneShotCamera({
  target = [0, 0.5, 0],
  radius = 2.0,
  orbitSpeed = 0.12,
  craneSpeed = 0.15,
  heightRange = [-0.5, 1.8],
  scrollDepth = false,
  parkScreens = 0,
}) {
  const { camera } = useThree()
  const timeRef = useRef(0)
  const depthRef = useRef(0)
  const cameraPositionRef = useRef(new THREE.Vector3())
  const lookTarget = useRef(new THREE.Vector3(...target))
  const desiredPosition = useRef(new THREE.Vector3())
  const desiredTarget = useRef(new THREE.Vector3(...target))

  useFrame((_, delta) => {
    timeRef.current += delta

    const t = timeRef.current
    const targetDepth = scrollDepth
      ? smoothProgress(getRootScrollProgress(parkScreens))
      : 0
    const smoothing = 1 - Math.exp(-delta * 5)
    depthRef.current += (targetDepth - depthRef.current) * smoothing
    const depth = depthRef.current

    // Gentle orbit in the hero, easing toward a straight elevator descent
    // below the fold so the statue keeps its physical scale and perspective.
    const orbitX = radius * Math.sin(t * orbitSpeed)
    const orbitZ = radius * Math.cos(t * orbitSpeed)
    const x = orbitX * (1 - depth)
    const z = orbitZ * (1 - depth) + radius * depth

    // Crane sweep in the hero, then a simple downward ride as the page scrolls.
    const raw = 0.5 + 0.5 * Math.sin(t * craneSpeed - Math.PI / 2)
    const eased = raw * raw * (3 - 2 * raw) // smoothstep for natural acceleration/deceleration
    const yMin = heightRange[0]
    const yMax = heightRange[1]
    const craneY = yMin + (yMax - yMin) * eased
    const y = craneY * (1 - depth) + (-9.3 * depth)

    desiredPosition.current.set(x, y, z)
    desiredTarget.current.set(
      target[0],
      target[1] - depth * 9.3,
      target[2]
    )

    // Chamber phone focus — when the visitor clicks Our Lady's phone at
    // the bottom of the descent, override the scroll-derived framing
    // with the close-up. The existing lerp below turns the override
    // into a smooth dolly in and back out.
    const chamberFocus = getChamberFocus()
    if (chamberFocus.active) {
      desiredPosition.current.set(...chamberFocus.position)
      desiredTarget.current.set(...chamberFocus.target)
    }
    cameraPositionRef.current.copy(camera.position)
    cameraPositionRef.current.lerp(desiredPosition.current, smoothing)
    camera.position.copy(cameraPositionRef.current)
    lookTarget.current.lerp(desiredTarget.current, smoothing)
    camera.lookAt(lookTarget.current)
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
  showStats = false,
  paused = false,
  scrollDepth = false,
  // Viewport-heights before the page bottom at which the crane descent
  // completes and the camera parks (static shot for the chamber's
  // hold + reveal). 0 = original behavior, descent ends at the bottom.
  cameraParkScreens = 0,
  // Real RL80 market direction in [-1, 1] — shifts the red/green balance
  // of the orbital candle helix so the shrine's mood tracks the token.
  // 0 keeps the authored bullish-lean default.
  priceDirection = 0,
  // Raw 24h % change for the CRT HUD readout; null hides the line
  // (loading / no data) rather than showing a fake 0.0%.
  priceChange24h = null,
  // Live count of currently-burning community candles for the HUD;
  // null/0 falls back to the static authored readout.
  litCandleCount = null,
  children,
}) {
  const router = useRouter()
  // Shared with CandleOrbitalEffects so SelectiveBloom has a light to
  // enable on its selection layer — without this it warns and produces
  // a no-op bloom pass. Stable array identity prevents remount churn.
  //
  // Back the ref with a persistent THREE.PointLight so `.current` is
  // *never* null — not even on route unmount, when React detaches the
  // <primitive> before SelectiveBloom's passive cleanup runs. Without
  // this, navigating away crashes in SelectiveBloom at `light.layers`.
  const bloomLightObject = React.useMemo(() => new THREE.PointLight(0xffffff, 0), [])
  const dirLightRef = useRef(bloomLightObject)
  const bloomLights = React.useMemo(() => [dirLightRef], [])

  return (
    <div
      className={className}
      onClick={href ? () => router.push(href) : undefined}
      style={{
        width: '100%',
        height: '100%',
        background: '#000',
        position: 'relative',
        overflow: 'hidden',
        borderRadius: '10px',
        border: '1.5px solid rgba(0, 255, 136, 0.15)',
        boxShadow:
          'inset 0 0 30px rgba(0, 0, 0, 0.6), ' +
          '0 0 20px rgba(0, 255, 136, 0.07), ' +
          '0 0 60px rgba(0, 0, 0, 0.5)',

        // CRT screen curvature + 3D tilt on same element as border
        transform: 'perspective(800px) rotateX(1deg) rotateY(5deg)',
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
      transform: 'scaleX(1.2)',
      borderRadius: '8px',
      overflow: 'hidden',
      background: '#000',
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
          {typeof priceChange24h === 'number' && Number.isFinite(priceChange24h) && (
            <div
              style={{
                color: priceChange24h >= 0
                  ? 'rgba(0, 255, 136, 0.75)'
                  : 'rgba(255, 80, 80, 0.75)',
              }}
            >
              RL80 {priceChange24h >= 0 ? '▲' : '▼'} {Math.abs(priceChange24h).toFixed(1)}%
            </div>
          )}
        </div>
        {/* Bottom-left */}
        <div style={{ position: 'absolute', bottom: '12px', left: '14px', opacity: 0.4 }}>
          OLPP-MK.VII
        </div>
        {/* Bottom-right — live vigil count when we have one, otherwise the
            authored set-dressing readout. */}
        <div style={{ position: 'absolute', bottom: '12px', right: '14px', textAlign: 'right', opacity: 0.4 }}>
          {litCandleCount > 0 ? `VIGIL: ${litCandleCount} FLAMES` : 'VOL: 48 NODES'}
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

      {/* Mobile/tablet gating for GPU load — iOS Safari has a tight per-tab
          WebGL memory budget and will kill the tab after sustained GPU work.
          DPR=1 + antialias=false roughly quarters the backbuffer memory and
          fill-rate cost on mobile; desktop keeps the sharper rendering. */}
      <Canvas
        camera={{
          position: cameraPosition,
          fov: 50,
          // Tight near/far — scene extent is ~20 units (statue at origin,
          // cylinder at radius 4, camera at radius 2.2). The old 0.1/1000
          // ratio (10000:1) starved mobile 16-bit depth buffers and caused
          // visible z-fighting between the statue's depth-mask clone and
          // the BackgroundChart cylinder behind it.
          near: 0.5,
          far: 50
        }}
        gl={{
          antialias: typeof navigator === 'undefined'
            ? true
            : !/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent),
          alpha: false,
          powerPreference: 'high-performance',
        }}
        dpr={(() => {
          if (typeof window === 'undefined') return 1;
          const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
          return isMobile ? 1 : Math.min(window.devicePixelRatio, 2);
        })()}
        frameloop={paused ? 'never' : 'always'}
        style={{
          background: 'transparent',
          borderRadius: '12px',
          touchAction: 'pan-y',
          visibility: paused ? 'hidden' : 'visible',
        }}
      >
        <Suspense fallback={null}>
          {/* Crane shot loop camera */}
          <CraneShotCamera
            target={cameraTarget}
            radius={cameraRadius}
            scrollDepth={scrollDepth}
            parkScreens={cameraParkScreens}
          />

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
            position={[0, -3.5, 0]}
            radius={4}
            height={23}
            pointCount={120}
            color="#00ff88"
            glowColor="#00ffaa"
            opacity={0.85}
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

          <MobileCandleOrbital priceDirection={priceDirection} />

          {children}

          {/* OrbitControls removed in favor of Figure8Camera */}
        </Suspense>

        {/* Zero-intensity helper light whose lifetime matches the composer's.
            Using <primitive object={...}> instead of <pointLight ref={...}>
            so the light instance is owned by us, not R3F — the ref stays
            pointed at a live THREE.PointLight even after React unmounts
            this node during route transitions, so SelectiveBloom's
            passive cleanup can still read `light.layers` safely. */}
        <primitive object={bloomLightObject} position={[0, 0, 0]} />

        {/* Bloom postprocessing — outside Suspense so a re-suspend of
            the GLTF subtree can't unmount/remount the EffectComposer */}
        <CandleOrbitalEffects lights={bloomLights} />
        {showStats && <Stats />}
      </Canvas>
    </div>
    </div>
  )
}

export default StarfieldStatueScene
