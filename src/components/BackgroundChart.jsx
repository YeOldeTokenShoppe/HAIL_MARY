'use client'

import React, { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

// Generate smooth price-like data using sine waves
// Frequencies are exact integer multiples of the base frequency so the
// wave completes full cycles and wraps seamlessly around the loop.
function generateChartData(pointCount, seed = 0) {
  const data = []
  const totalT = pointCount * 0.1
  const baseFreq = (2 * Math.PI) / totalT

  for (let i = 0; i < pointCount; i++) {
    const t = i * 0.1 + seed
    const value = 0.5 +
      Math.sin(t * baseFreq * 1) * 0.2 +
      Math.sin(t * baseFreq * 2 + 1) * 0.15 +
      Math.sin(t * baseFreq * 3 + 2) * 0.1 +
      Math.sin(t * baseFreq * 5) * 0.05

    data.push(Math.max(0.1, Math.min(0.9, value)))
  }

  return data
}

// Generate volume-like data (varied heights per bar, like real trade volume)
function generateVolumeData(count, seed = 0) {
  const data = []
  for (let i = 0; i < count; i++) {
    // Use the bar index to create a unique hash-like offset per bar
    // so neighboring bars get very different values
    const hash = Math.sin(i * 127.1 + 311.7) * 43758.5453
    const barSeed = hash - Math.floor(hash) // pseudo-random 0-1 per bar

    const t = seed + barSeed * 100
    // Mix several frequencies with the per-bar offset for variety
    const v1 = Math.abs(Math.sin(t * 0.4 + i * 2.3)) * 0.35
    const v2 = Math.abs(Math.sin(t * 1.1 + i * 5.7 + 1.3)) * 0.25
    const v3 = Math.abs(Math.sin(t * 0.7 + i * 11.1 + 4.0)) * 0.2
    // Occasional tall spikes
    const spike = Math.pow(Math.abs(Math.sin(t * 0.3 + i * 3.9)), 6) * 0.5

    const value = 0.05 + v1 + v2 + v3 + spike
    data.push(Math.min(0.95, value))
  }
  return data
}

function BackgroundChart({
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  radius = 3,
  height = 2,
  pointCount = 120,
  color = '#00ff88',
  glowColor = '#00ffaa',
  opacity = 0.6,
  scrollSpeed = 0.3,
  lineWidth = 2,
  gridLines = 15,
  verticalLines = 24,
  barOpacity = 0.05,
  barColor = '#8855ff',
  barMaxHeight = 0.5,
}) {
  const lineRef = useRef()
  const glowLineRef = useRef()
  const gridRef = useRef()
  const barsRef = useRef()
  const timeOffset = useRef(0)
  const dummy = useMemo(() => new THREE.Object3D(), [])

  // Create cylindrical line geometry
  const { lineGeometry, glowGeometry } = useMemo(() => {
    const lineGeo = new THREE.BufferGeometry()
    const glowGeo = new THREE.BufferGeometry()

    // Initial positions on cylinder (will be updated in useFrame)
    const positions = new Float32Array(pointCount * 3)
    for (let i = 0; i < pointCount; i++) {
      const angle = (i / pointCount) * Math.PI * 2
      positions[i * 3] = Math.cos(angle) * radius
      positions[i * 3 + 1] = 0
      positions[i * 3 + 2] = Math.sin(angle) * radius
    }

    lineGeo.setAttribute('position', new THREE.BufferAttribute(positions.slice(), 3))
    glowGeo.setAttribute('position', new THREE.BufferAttribute(positions.slice(), 3))

    return { lineGeometry: lineGeo, glowGeometry: glowGeo }
  }, [pointCount, radius])

  // Create cylindrical grid
  const gridGeometry = useMemo(() => {
    const points = []

    // Horizontal circles (rings)
    const ringSegments = 64
    for (let i = 0; i <= gridLines; i++) {
      const y = (i / gridLines) * height - height / 2
      for (let j = 0; j < ringSegments; j++) {
        const angle1 = (j / ringSegments) * Math.PI * 2
        const angle2 = ((j + 1) / ringSegments) * Math.PI * 2
        points.push(
          Math.cos(angle1) * radius, y, Math.sin(angle1) * radius,
          Math.cos(angle2) * radius, y, Math.sin(angle2) * radius
        )
      }
    }

    // Vertical lines
    for (let i = 0; i < verticalLines; i++) {
      const angle = (i / verticalLines) * Math.PI * 2
      const x = Math.cos(angle) * radius
      const z = Math.sin(angle) * radius
      points.push(x, -height / 2, z)
      points.push(x, height / 2, z)
    }

    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3))
    return geometry
  }, [radius, height, gridLines, verticalLines])

  // Line materials
  const lineMaterial = useMemo(() => new THREE.LineBasicMaterial({
    color: new THREE.Color(color),
    transparent: true,
    opacity: opacity,
    linewidth: lineWidth,
  }), [color, opacity, lineWidth])

  const glowMaterial = useMemo(() => new THREE.LineBasicMaterial({
    color: new THREE.Color(glowColor),
    transparent: true,
    opacity: opacity * 0.3,
    linewidth: lineWidth * 3,
    blending: THREE.AdditiveBlending,
  }), [glowColor, opacity, lineWidth])

  const gridMaterial = useMemo(() => new THREE.LineBasicMaterial({
    color: new THREE.Color(color),
    transparent: true,
    opacity: 0.1,
  }), [color])

  // Bar geometry and material (wide box, unit height - scaled per instance)
  const barGeometry = useMemo(() => {
    // Width fills most of the gap between bars, thin depth
    const arcWidth = (2 * Math.PI * radius) / verticalLines * 0.9
    return new THREE.BoxGeometry(arcWidth, 1, 0.03)
  }, [radius, verticalLines])

  const barMaterial = useMemo(() => new THREE.MeshBasicMaterial({
    color: new THREE.Color(barColor),
    transparent: true,
    opacity: barOpacity,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  }), [barColor, barOpacity])

  // Animate the chart
  useFrame((state, delta) => {
    timeOffset.current += delta * scrollSpeed

    const data = generateChartData(pointCount, timeOffset.current)

    if (lineRef.current && glowLineRef.current) {
      const positions = lineRef.current.geometry.attributes.position.array
      const glowPositions = glowLineRef.current.geometry.attributes.position.array

      for (let i = 0; i < pointCount; i++) {
        // Map data to Y position on cylinder
        const y = data[i] * height - height / 2
        positions[i * 3 + 1] = y
        glowPositions[i * 3 + 1] = y
      }

      lineRef.current.geometry.attributes.position.needsUpdate = true
      glowLineRef.current.geometry.attributes.position.needsUpdate = true
    }

    // Update volume bars
    if (barsRef.current) {
      const volumeData = generateVolumeData(verticalLines, timeOffset.current * 0.7)

      for (let i = 0; i < verticalLines; i++) {
        const angle = (i / verticalLines) * Math.PI * 2
        const x = Math.cos(angle) * radius
        const z = Math.sin(angle) * radius

        const barHeight = volumeData[i] * barMaxHeight * height
        const barY = -height / 2 + barHeight / 2

        dummy.position.set(x, barY, z)
        dummy.scale.set(1, barHeight, 1)
        // Face outward from cylinder center
        dummy.lookAt(0, barY, 0)
        dummy.rotateY(Math.PI)
        dummy.updateMatrix()
        barsRef.current.setMatrixAt(i, dummy.matrix)
      }

      barsRef.current.instanceMatrix.needsUpdate = true
    }
  })

  return (
    <group position={position} rotation={rotation}>
      {/* Cylindrical grid background */}
      <lineSegments ref={gridRef} geometry={gridGeometry} material={gridMaterial} />

      {/* Volume bars */}
      <instancedMesh ref={barsRef} args={[barGeometry, barMaterial, verticalLines]} />

      {/* Glow line (behind) */}
      <lineLoop ref={glowLineRef} geometry={glowGeometry} material={glowMaterial} />

      {/* Main line */}
      <lineLoop ref={lineRef} geometry={lineGeometry} material={lineMaterial} />
    </group>
  )
}

export default BackgroundChart
