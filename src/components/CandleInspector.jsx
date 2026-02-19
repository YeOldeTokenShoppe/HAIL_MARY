'use client'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, useGLTF, Environment } from '@react-three/drei'
import { useRef, useEffect } from 'react'
import * as THREE from 'three'

function CandleModel({ userImageUrl }) {
  const { scene, animations } = useGLTF('/models/tinyVotiveOnly.glb')
  const groupRef = useRef()
  const mixerRef = useRef()

  useEffect(() => {
    if (animations.length > 0) {
      const mixer = new THREE.AnimationMixer(scene)
      animations.forEach(clip => {
        mixer.clipAction(clip).play()
      })
      mixerRef.current = mixer
    }
    return () => {
      if (mixerRef.current) mixerRef.current.stopAllAction()
    }
  }, [scene, animations])

  // Apply user image to senora mesh
  useEffect(() => {
    if (!userImageUrl) return
    const loader = new THREE.TextureLoader()
    loader.load(userImageUrl, (texture) => {
      texture.colorSpace = THREE.SRGBColorSpace
      texture.flipY = false
      texture.wrapS = THREE.ClampToEdgeWrapping
      texture.wrapT = THREE.ClampToEdgeWrapping
      scene.traverse((child) => {
        if (!child.isMesh) return
        const isSenora = child.name === 'senora' || child.name === 'Senora' ||
          (child.material && (
            child.material.name === 'senora' || child.material.name === 'senora.001' ||
            child.material.name === 'Senora' || child.material.name === 'Material.001'
          )) ||
          (child.parent && child.parent.name === 'senora')
        if (!isSenora) return
        if (!child.material.userData?.cloned) {
          child.material = child.material.clone()
          child.material.userData = { cloned: true }
        }
        child.material.map = texture
        child.material.transparent = true
        child.material.opacity = 1
        child.material.alphaTest = 0.1
        child.material.needsUpdate = true
      })
    })
  }, [userImageUrl, scene])

  // Animate
  useEffect(() => {
    let frameId
    const animate = () => {
      if (mixerRef.current) mixerRef.current.update(0.016)
      frameId = requestAnimationFrame(animate)
    }
    animate()
    return () => cancelAnimationFrame(frameId)
  }, [])

  return (
    <group ref={groupRef}>
      <primitive object={scene} scale={2.1} position={[0, 0.2, 0]} />
    </group>
  )
}

export default function CandleInspector({ onClose, candleData, onLightCandle }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 2000,
        background: 'rgba(0, 0, 0, 0.75)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '80vw',
          height: '70vh',
          maxWidth: 600,
          maxHeight: 500,
          borderRadius: 16,
          overflow: 'hidden',
          border: '2px solid rgba(255, 215, 0, 0.5)',
          background: '#0a0a1a',
          boxShadow: '0 0 40px rgba(255, 215, 0, 0.1)',
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* 3D candle view */}
        <div style={{ flex: 1, minHeight: 0 }}>
          <Canvas
            camera={{ position: [0, 0, 5], fov: 45 }}
            style={{ width: '100%', height: '100%' }}
          >
            <ambientLight intensity={0.4} />
            <directionalLight position={[3, 5, 7]} intensity={1} />
            <pointLight position={[-2, 2, -1]} intensity={0.5} color="#ffd700" />
            <CandleModel userImageUrl={candleData?.userImageUrl} />
            <OrbitControls
              enablePan={false}
              enableZoom={true}
              minDistance={1.5}
              maxDistance={6}
              autoRotate
              autoRotateSpeed={1.5}
            />
            <Environment preset="night" />
          </Canvas>
        </div>

        {/* Info panel at bottom */}
        <div style={{
          padding: '10px 16px',
          background: 'linear-gradient(transparent, rgba(0,0,0,0.8))',
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
        }}>
          {candleData ? (
            <>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {candleData.userImageUrl && (
                    <img
                      src={candleData.userImageUrl}
                      alt=""
                      style={{
                        width: 28, height: 28, borderRadius: '50%',
                        border: '1px solid rgba(255, 215, 0, 0.5)',
                      }}
                    />
                  )}
                  <span style={{
                    color: 'rgba(255, 215, 0, 0.9)',
                    fontFamily: 'monospace',
                    fontSize: 14,
                    fontWeight: 700,
                  }}>
                    {candleData.username || 'Anonymous'}
                  </span>
                </div>
                <button
                  onClick={onClose}
                  style={{
                    background: 'none',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    borderRadius: 8,
                    color: 'rgba(255, 255, 255, 0.6)',
                    fontSize: 12,
                    fontFamily: 'monospace',
                    padding: '4px 12px',
                    cursor: 'pointer',
                  }}
                >
                  Close
                </button>
              </div>
              {candleData.message && (
                <p style={{
                  color: 'rgba(255, 255, 255, 0.7)',
                  fontFamily: 'monospace',
                  fontSize: 12,
                  margin: 0,
                  fontStyle: 'italic',
                  lineHeight: 1.4,
                  maxHeight: 60,
                  overflow: 'hidden',
                }}>
                  &ldquo;{candleData.message}&rdquo;
                </p>
              )}
              {candleData.tokensBurned > 0 && (
                <span style={{
                  color: 'rgba(255, 165, 0, 0.7)',
                  fontFamily: 'monospace',
                  fontSize: 11,
                }}>
                  {candleData.tokensBurned.toLocaleString()} RL80 burned
                </span>
              )}
            </>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{
                  color: 'rgba(255, 215, 0, 0.9)',
                  fontFamily: 'monospace',
                  fontSize: 14,
                  fontWeight: 700,
                }}>
                  Empty Candle
                </span>
                {onLightCandle && (
                  <button
                    onClick={onLightCandle}
                    style={{
                      background: 'rgba(255, 215, 0, 0.15)',
                      border: '1px solid rgba(255, 215, 0, 0.5)',
                      borderRadius: 8,
                      color: 'rgba(255, 215, 0, 0.9)',
                      fontSize: 12,
                      fontFamily: 'monospace',
                      padding: '4px 12px',
                      cursor: 'pointer',
                    }}
                  >
                    Light this candle
                  </button>
                )}
              </div>
              <button
                onClick={onClose}
                style={{
                  background: 'none',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  borderRadius: 8,
                  color: 'rgba(255, 255, 255, 0.6)',
                  fontSize: 12,
                  fontFamily: 'monospace',
                  padding: '4px 12px',
                  cursor: 'pointer',
                }}
              >
                Close
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
