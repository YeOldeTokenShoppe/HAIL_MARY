'use client'

import React, { useRef, useEffect } from 'react'
import * as THREE from 'three'

export default function PinkPyramid() {
  const mountRef = useRef(null)
  const sceneRef = useRef(null)
  const rendererRef = useRef(null)
  const frameRef = useRef(null)
  const pyramidRef = useRef(null)

  useEffect(() => {
    if (!mountRef.current) return

    // Scene setup
    const scene = new THREE.Scene()
    sceneRef.current = scene

    // Camera setup
    const camera = new THREE.PerspectiveCamera(
      45,
      150 / 150, // Square aspect ratio for corner element
      0.1,
      100
    )
    camera.position.set(2, 2, 2)
    camera.lookAt(0, 0, 0)

    // Renderer setup
    const renderer = new THREE.WebGLRenderer({ 
      antialias: true, 
      alpha: true 
    })
    renderer.setSize(150, 150)
    renderer.setPixelRatio(window.devicePixelRatio)
    rendererRef.current = renderer
    mountRef.current.appendChild(renderer.domElement)

    // Create pyramid geometry (cone with 4 sides)
    const geometry = new THREE.ConeGeometry(0.5, 1, 4)
    
    // Pink wireframe material with emissive glow
    const material = new THREE.MeshBasicMaterial({
      wireframe: true,
      color: new THREE.Color("#ff00ff").multiplyScalar(5), // Bright magenta/pink
      fog: false
    })
    
    const pyramid = new THREE.Mesh(geometry, material)
    pyramidRef.current = pyramid
    scene.add(pyramid)

    // Add edge geometry for enhanced wireframe effect
    const edges = new THREE.EdgesGeometry(geometry)
    const lineMaterial = new THREE.LineBasicMaterial({ 
      color: new THREE.Color("#ff00ff").multiplyScalar(10) // Extra bright edges
    })
    const wireframe = new THREE.LineSegments(edges, lineMaterial)
    pyramid.add(wireframe)

    // Animation
    const animate = () => {
      frameRef.current = requestAnimationFrame(animate)
      
      // Rotate pyramid
      if (pyramidRef.current) {
        pyramidRef.current.rotation.y += 0.01
        pyramidRef.current.rotation.x += 0.005
      }
      
      renderer.render(scene, camera)
    }
    animate()

    // Cleanup
    return () => {
      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current)
      }
      if (mountRef.current && rendererRef.current) {
        mountRef.current.removeChild(rendererRef.current.domElement)
      }
      if (rendererRef.current) {
        rendererRef.current.dispose()
      }
    }
  }, [])

  return (
    <div 
      ref={mountRef}
      style={{
        position: 'fixed',
        bottom: '20px',
        right: '20px',
        width: '150px',
        height: '150px',
        pointerEvents: 'none',
        zIndex: 100,
        filter: 'drop-shadow(0 0 20px #ff00ff)',
      }}
    />
  )
}