'use client'

import React, { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

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

  // Animate the chart — inline the chart/volume math so we don't allocate
  // two new arrays per frame (ran at ~60fps, ~170 push() calls + array
  // growth was constant GC pressure on mobile).
  useFrame((state, delta) => {
    timeOffset.current += delta * scrollSpeed
    const seed = timeOffset.current
    const volumeSeed = seed * 0.7
    const halfHeight = height / 2

    if (lineRef.current && glowLineRef.current) {
      const positions = lineRef.current.geometry.attributes.position.array
      const glowPositions = glowLineRef.current.geometry.attributes.position.array
      const totalT = pointCount * 0.1
      const baseFreq = (2 * Math.PI) / totalT

      for (let i = 0; i < pointCount; i++) {
        const t = i * 0.1 + seed
        const raw = 0.5 +
          Math.sin(t * baseFreq) * 0.2 +
          Math.sin(t * baseFreq * 2 + 1) * 0.15 +
          Math.sin(t * baseFreq * 3 + 2) * 0.1 +
          Math.sin(t * baseFreq * 5) * 0.05
        const clamped = raw < 0.1 ? 0.1 : raw > 0.9 ? 0.9 : raw
        const y = clamped * height - halfHeight
        positions[i * 3 + 1] = y
        glowPositions[i * 3 + 1] = y
      }

      lineRef.current.geometry.attributes.position.needsUpdate = true
      glowLineRef.current.geometry.attributes.position.needsUpdate = true
    }

    // Update volume bars
    if (barsRef.current) {
      for (let i = 0; i < verticalLines; i++) {
        const hash = Math.sin(i * 127.1 + 311.7) * 43758.5453
        const barSeed = hash - Math.floor(hash)
        const tv = volumeSeed + barSeed * 100
        const v1 = Math.abs(Math.sin(tv * 0.4 + i * 2.3)) * 0.35
        const v2 = Math.abs(Math.sin(tv * 1.1 + i * 5.7 + 1.3)) * 0.25
        const v3 = Math.abs(Math.sin(tv * 0.7 + i * 11.1 + 4.0)) * 0.2
        const spike = Math.pow(Math.abs(Math.sin(tv * 0.3 + i * 3.9)), 6) * 0.5
        const raw = 0.05 + v1 + v2 + v3 + spike
        const value = raw > 0.95 ? 0.95 : raw

        const angle = (i / verticalLines) * Math.PI * 2
        const x = Math.cos(angle) * radius
        const z = Math.sin(angle) * radius
        const barHeight = value * barMaxHeight * height
        const barY = -halfHeight + barHeight / 2

        dummy.position.set(x, barY, z)
        dummy.scale.set(1, barHeight, 1)
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
