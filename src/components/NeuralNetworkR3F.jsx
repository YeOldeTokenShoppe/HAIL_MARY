'use client'

import React, { useRef, useMemo, useEffect, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { shaderMaterial } from '@react-three/drei'
import { extend } from '@react-three/fiber'

const colorPalettes = [
  [
    new THREE.Color(0x667eea),
    new THREE.Color(0x764ba2),
    new THREE.Color(0xf093fb),
    new THREE.Color(0x9d50bb),
    new THREE.Color(0x6e48aa)
  ],
  [
    new THREE.Color(0xf857a6),
    new THREE.Color(0xff5858),
    new THREE.Color(0xfeca57),
    new THREE.Color(0xff6348),
    new THREE.Color(0xff9068)
  ],
  [
    new THREE.Color(0x4facfe),
    new THREE.Color(0x00f2fe),
    new THREE.Color(0x43e97b),
    new THREE.Color(0x38f9d7),
    new THREE.Color(0x4484ce)
  ]
]

const noiseFunctions = `
vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 permute(vec4 x) { return mod289(((x * 34.0) + 1.0) * x); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

float snoise(vec3 v) {
    const vec2 C = vec2(1.0/6.0, 1.0/3.0);
    const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
    
    vec3 i = floor(v + dot(v, C.yyy));
    vec3 x0 = v - i + dot(i, C.xxx);
    
    vec3 g = step(x0.yzx, x0.xyz);
    vec3 l = 1.0 - g;
    vec3 i1 = min(g.xyz, l.zxy);
    vec3 i2 = max(g.xyz, l.zxy);
    
    vec3 x1 = x0 - i1 + C.xxx;
    vec3 x2 = x0 - i2 + C.yyy;
    vec3 x3 = x0 - D.yyy;
    
    i = mod289(i);
    vec4 p = permute(permute(permute(
        i.z + vec4(0.0, i1.z, i2.z, 1.0))
        + i.y + vec4(0.0, i1.y, i2.y, 1.0))
        + i.x + vec4(0.0, i1.x, i2.x, 1.0));
        
    float n_ = 0.142857142857;
    vec3 ns = n_ * D.wyz - D.xzx;
    
    vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
    vec4 x_ = floor(j * ns.z);
    vec4 y_ = floor(j - 7.0 * x_);
    
    vec4 x = x_ * ns.x + ns.yyyy;
    vec4 y = y_ * ns.x + ns.yyyy;
    vec4 h = 1.0 - abs(x) - abs(y);
    
    vec4 b0 = vec4(x.xy, y.xy);
    vec4 b1 = vec4(x.zw, y.zw);
    
    vec4 s0 = floor(b0) * 2.0 + 1.0;
    vec4 s1 = floor(b1) * 2.0 + 1.0;
    vec4 sh = -step(h, vec4(0.0));
    
    vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
    vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
    
    vec3 p0 = vec3(a0.xy, h.x);
    vec3 p1 = vec3(a0.zw, h.y);
    vec3 p2 = vec3(a1.xy, h.z);
    vec3 p3 = vec3(a1.zw, h.w);
    
    vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
    p0 *= norm.x;
    p1 *= norm.y;
    p2 *= norm.z;
    p3 *= norm.w;
    
    vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
    m = m * m;
    return 42.0 * dot(m * m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
}`

const NodeMaterial = shaderMaterial(
  {
    uTime: 0,
    uPulsePositions: [new THREE.Vector3(1e3, 1e3, 1e3), new THREE.Vector3(1e3, 1e3, 1e3), new THREE.Vector3(1e3, 1e3, 1e3)],
    uPulseTimes: [-1e3, -1e3, -1e3],
    uPulseColors: [new THREE.Color(1, 1, 1), new THREE.Color(1, 1, 1), new THREE.Color(1, 1, 1)],
    uPulseSpeed: 18.0,
    uBaseNodeSize: 0.6,
    uOpacity: 1.0
  },
  // Vertex shader
  `${noiseFunctions}
  attribute float nodeSize;
  attribute float nodeType;
  attribute vec3 nodeColor;
  attribute float distanceFromRoot;
  
  uniform float uTime;
  uniform vec3 uPulsePositions[3];
  uniform float uPulseTimes[3];
  uniform float uPulseSpeed;
  uniform float uBaseNodeSize;
  
  varying vec3 vColor;
  varying float vNodeType;
  varying vec3 vPosition;
  varying float vPulseIntensity;
  varying float vDistanceFromRoot;
  varying float vGlow;
  
  float getPulseIntensity(vec3 worldPos, vec3 pulsePos, float pulseTime) {
      if (pulseTime < 0.0) return 0.0;
      float timeSinceClick = uTime - pulseTime;
      if (timeSinceClick < 0.0 || timeSinceClick > 4.0) return 0.0;
      float pulseRadius = timeSinceClick * uPulseSpeed;
      float distToClick = distance(worldPos, pulsePos);
      float pulseThickness = 3.0;
      float waveProximity = abs(distToClick - pulseRadius);
      return smoothstep(pulseThickness, 0.0, waveProximity) * smoothstep(4.0, 0.0, timeSinceClick);
  }
  
  void main() {
      vNodeType = nodeType;
      vColor = nodeColor;
      vDistanceFromRoot = distanceFromRoot;
      vec3 worldPos = (modelMatrix * vec4(position, 1.0)).xyz;
      vPosition = worldPos;
      // Pulse comparison uses LOCAL space so wave speed/thickness are scale-independent
      float totalPulseIntensity = 0.0;
      for (int i = 0; i < 3; i++) {
          totalPulseIntensity += getPulseIntensity(position, uPulsePositions[i], uPulseTimes[i]);
      }
      vPulseIntensity = min(totalPulseIntensity, 1.0);
      float breathe = sin(uTime * 0.7 + distanceFromRoot * 0.15) * 0.15 + 0.85;
      float baseSize = nodeSize * breathe;
      float pulseSize = baseSize * (1.0 + vPulseIntensity * 2.5);
      vGlow = 0.5 + 0.5 * sin(uTime * 0.5 + distanceFromRoot * 0.2);
      vec3 modifiedPosition = position;
      if (nodeType > 0.5) {
          float noise = snoise(position * 0.08 + uTime * 0.08);
          modifiedPosition += normal * noise * 0.15;
      }
      vec4 mvPosition = modelViewMatrix * vec4(modifiedPosition, 1.0);
      gl_PointSize = pulseSize * uBaseNodeSize * (1000.0 / -mvPosition.z);
      gl_Position = projectionMatrix * mvPosition;
  }`,
  // Fragment shader
  `uniform float uTime;
  uniform vec3 uPulseColors[3];
  uniform float uOpacity;

  varying vec3 vColor;
  varying float vNodeType;
  varying vec3 vPosition;
  varying float vPulseIntensity;
  varying float vDistanceFromRoot;
  varying float vGlow;

  void main() {
      vec2 center = 2.0 * gl_PointCoord - 1.0;
      float dist = length(center);
      if (dist > 1.0) discard;
      float glow1 = 1.0 - smoothstep(0.0, 0.5, dist);
      float glow2 = 1.0 - smoothstep(0.0, 1.0, dist);
      float glowStrength = pow(glow1, 1.2) + glow2 * 0.3;
      float breatheColor = 0.9 + 0.1 * sin(uTime * 0.6 + vDistanceFromRoot * 0.25);
      vec3 baseColor = vColor * breatheColor;
      vec3 finalColor = baseColor;
      if (vPulseIntensity > 0.0) {
          vec3 pulseColor = mix(vec3(1.0), uPulseColors[0], 0.4);
          finalColor = mix(baseColor, pulseColor, vPulseIntensity * 0.8);
          finalColor *= (1.0 + vPulseIntensity * 1.2);
          glowStrength *= (1.0 + vPulseIntensity);
      }
      float coreBrightness = smoothstep(0.4, 0.0, dist);
      finalColor += vec3(1.0) * coreBrightness * 0.3;
      float alpha = glowStrength * (0.95 - 0.3 * dist);
      float camDistance = length(vPosition - cameraPosition);
      float distanceFade = smoothstep(100.0, 15.0, camDistance);
      if (vNodeType > 0.5) {
          finalColor *= 1.1;
          alpha *= 0.9;
      }
      finalColor *= (1.0 + vGlow * 0.1);
      gl_FragColor = vec4(finalColor, alpha * distanceFade * uOpacity);
  }`
)

const ConnectionMaterial = shaderMaterial(
  {
    uTime: 0,
    uPulsePositions: [new THREE.Vector3(1e3, 1e3, 1e3), new THREE.Vector3(1e3, 1e3, 1e3), new THREE.Vector3(1e3, 1e3, 1e3)],
    uPulseTimes: [-1e3, -1e3, -1e3],
    uPulseColors: [new THREE.Color(1, 1, 1), new THREE.Color(1, 1, 1), new THREE.Color(1, 1, 1)],
    uPulseSpeed: 18.0,
    uOpacity: 1.0
  },
  // Vertex shader
  `${noiseFunctions}
  attribute vec3 startPoint;
  attribute vec3 endPoint;
  attribute float connectionStrength;
  attribute float pathIndex;
  attribute vec3 connectionColor;
  
  uniform float uTime;
  uniform vec3 uPulsePositions[3];
  uniform float uPulseTimes[3];
  uniform float uPulseSpeed;
  
  varying vec3 vColor;
  varying float vConnectionStrength;
  varying float vPulseIntensity;
  varying float vPathPosition;
  varying float vDistanceFromCamera;
  
  float getPulseIntensity(vec3 worldPos, vec3 pulsePos, float pulseTime) {
      if (pulseTime < 0.0) return 0.0;
      float timeSinceClick = uTime - pulseTime;
      if (timeSinceClick < 0.0 || timeSinceClick > 4.0) return 0.0;
      
      float pulseRadius = timeSinceClick * uPulseSpeed;
      float distToClick = distance(worldPos, pulsePos);
      float pulseThickness = 3.0;
      float waveProximity = abs(distToClick - pulseRadius);
      
      return smoothstep(pulseThickness, 0.0, waveProximity) * smoothstep(4.0, 0.0, timeSinceClick);
  }
  
  void main() {
      float t = position.x;
      vPathPosition = t;
      vec3 midPoint = mix(startPoint, endPoint, 0.5);
      float pathOffset = sin(t * 3.14159) * 0.15;
      vec3 perpendicular = normalize(cross(normalize(endPoint - startPoint), vec3(0.0, 1.0, 0.0)));
      if (length(perpendicular) < 0.1) perpendicular = vec3(1.0, 0.0, 0.0);
      midPoint += perpendicular * pathOffset;
      vec3 p0 = mix(startPoint, midPoint, t);
      vec3 p1 = mix(midPoint, endPoint, t);
      vec3 finalPos = mix(p0, p1, t);
      float noiseTime = uTime * 0.15;
      float noise = snoise(vec3(pathIndex * 0.08, t * 0.6, noiseTime));
      finalPos += perpendicular * noise * 0.12;
      vec3 worldPos = (modelMatrix * vec4(finalPos, 1.0)).xyz;
      // Pulse comparison uses LOCAL space so wave speed/thickness are scale-independent
      float totalPulseIntensity = 0.0;
      for (int i = 0; i < 3; i++) {
          totalPulseIntensity += getPulseIntensity(finalPos, uPulsePositions[i], uPulseTimes[i]);
      }
      vPulseIntensity = min(totalPulseIntensity, 1.0);
      vColor = connectionColor;
      vConnectionStrength = connectionStrength;
      
      vDistanceFromCamera = length(worldPos - cameraPosition);
      gl_Position = projectionMatrix * modelViewMatrix * vec4(finalPos, 1.0);
  }`,
  // Fragment shader
  `uniform float uTime;
  uniform vec3 uPulseColors[3];
  uniform float uOpacity;

  varying vec3 vColor;
  varying float vConnectionStrength;
  varying float vPulseIntensity;
  varying float vPathPosition;
  varying float vDistanceFromCamera;

  void main() {
      float flowPattern1 = sin(vPathPosition * 25.0 - uTime * 4.0) * 0.5 + 0.5;
      float flowPattern2 = sin(vPathPosition * 15.0 - uTime * 2.5 + 1.57) * 0.5 + 0.5;
      float combinedFlow = (flowPattern1 + flowPattern2 * 0.5) / 1.5;

      vec3 baseColor = vColor * (0.8 + 0.2 * sin(uTime * 0.6 + vPathPosition * 12.0));
      float flowIntensity = 0.4 * combinedFlow * vConnectionStrength;
      vec3 finalColor = baseColor;
      if (vPulseIntensity > 0.0) {
          vec3 pulseColor = mix(vec3(1.0), uPulseColors[0], 0.3);
          finalColor = mix(baseColor, pulseColor * 1.2, vPulseIntensity * 0.7);
          flowIntensity += vPulseIntensity * 0.8;
      }
      finalColor *= (0.7 + flowIntensity + vConnectionStrength * 0.5);
      float baseAlpha = 0.7 * vConnectionStrength;
      float flowAlpha = combinedFlow * 0.3;
      float alpha = baseAlpha + flowAlpha;
      alpha = mix(alpha, min(1.0, alpha * 2.5), vPulseIntensity);
      float distanceFade = smoothstep(100.0, 15.0, vDistanceFromCamera);
      gl_FragColor = vec4(finalColor, alpha * distanceFade * uOpacity);
  }`
)

extend({ NodeMaterial, ConnectionMaterial })

class Node {
  constructor(position, level = 0, type = 0) {
    this.position = position
    this.connections = []
    this.level = level
    this.type = type
    this.size = type === 0 ? THREE.MathUtils.randFloat(0.8, 1.4) : THREE.MathUtils.randFloat(0.5, 1.0)
    this.distanceFromRoot = 0
  }

  addConnection(node, strength = 1.0) {
    if (!this.isConnectedTo(node)) {
      this.connections.push({ node, strength })
      node.connections.push({ node: this, strength })
    }
  }

  isConnectedTo(node) {
    return this.connections.some(conn => conn.node === node)
  }
}

function generateNeuralNetwork(formationIndex, densityFactor = 1.0) {
  let nodes = []
  let rootNode

  const generateCrystallineSphere = () => {
    rootNode = new Node(new THREE.Vector3(0, 0, 0), 0, 0)
    rootNode.size = 2.0
    nodes.push(rootNode)
    
    const layers = 5
    const goldenRatio = (1 + Math.sqrt(5)) / 2
    
    for (let layer = 1; layer <= layers; layer++) {
      const radius = layer * 4
      const numPoints = Math.floor(layer * 12 * densityFactor)
      
      for (let i = 0; i < numPoints; i++) {
        const phi = Math.acos(1 - 2 * (i + 0.5) / numPoints)
        const theta = 2 * Math.PI * i / goldenRatio
        const pos = new THREE.Vector3(
          radius * Math.sin(phi) * Math.cos(theta),
          radius * Math.sin(phi) * Math.sin(theta),
          radius * Math.cos(phi)
        )
        const isLeaf = layer === layers || Math.random() < 0.3
        const node = new Node(pos, layer, isLeaf ? 1 : 0)
        node.distanceFromRoot = radius
        nodes.push(node)
        
        if (layer > 1) {
          const prevLayerNodes = nodes.filter(n => n.level === layer - 1 && n !== rootNode)
          prevLayerNodes.sort((a, b) => pos.distanceTo(a.position) - pos.distanceTo(b.position))
          for (let j = 0; j < Math.min(3, prevLayerNodes.length); j++) {
            const dist = pos.distanceTo(prevLayerNodes[j].position)
            const strength = 1.0 - (dist / (radius * 2))
            node.addConnection(prevLayerNodes[j], Math.max(0.3, strength))
          }
        } else {
          rootNode.addConnection(node, 0.9)
        }
      }
    }
  }

  switch (formationIndex % 3) {
    case 0:
      generateCrystallineSphere()
      break
    default:
      generateCrystallineSphere()
      break
  }

  return { nodes, rootNode }
}

const NeuralNetworkR3F = ({
  theme = 0,
  formation = 0,
  density = 70,
  position = [0, 0, 0],
  scale = 1,
  enableInteraction = true,
  opacity = 1.0,
  useNormalBlending = false,
  nodeSize = 1.0,
  autoFire = false,
  autoFireMinInterval = 0.35,
  autoFireMaxInterval = 1.1
}) => {
  const groupRef = useRef()
  const nodesRef = useRef()
  const connectionsRef = useRef()
  const { clock, camera, raycaster, pointer } = useThree()

  const [lastPulseIndex, setLastPulseIndex] = useState(0)
  const autoFireTimer = useRef(0)
  const autoFireIdx = useRef(0)
  
  const neuralNetwork = useMemo(() => {
    return generateNeuralNetwork(formation, density / 100)
  }, [formation, density])
  
  const [nodesGeometry, nodeAttributes] = useMemo(() => {
    const geometry = new THREE.BufferGeometry()
    const positions = []
    const nodeTypes = []
    const nodeSizes = []
    const nodeColors = []
    const distancesFromRoot = []
    
    const palette = colorPalettes[theme]
    
    neuralNetwork.nodes.forEach((node) => {
      positions.push(node.position.x, node.position.y, node.position.z)
      nodeTypes.push(node.type)
      nodeSizes.push(node.size)
      distancesFromRoot.push(node.distanceFromRoot)
      
      const colorIndex = Math.min(node.level, palette.length - 1)
      const baseColor = palette[colorIndex % palette.length].clone()
      baseColor.offsetHSL(
        THREE.MathUtils.randFloatSpread(0.03),
        THREE.MathUtils.randFloatSpread(0.08),
        THREE.MathUtils.randFloatSpread(0.08)
      )
      nodeColors.push(baseColor.r, baseColor.g, baseColor.b)
    })
    
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    geometry.setAttribute('nodeType', new THREE.Float32BufferAttribute(nodeTypes, 1))
    geometry.setAttribute('nodeSize', new THREE.Float32BufferAttribute(nodeSizes, 1))
    geometry.setAttribute('nodeColor', new THREE.Float32BufferAttribute(nodeColors, 3))
    geometry.setAttribute('distanceFromRoot', new THREE.Float32BufferAttribute(distancesFromRoot, 1))
    
    return [geometry, { nodeColors, palette }]
  }, [neuralNetwork, theme])
  
  const connectionsGeometry = useMemo(() => {
    const geometry = new THREE.BufferGeometry()
    const connectionColors = []
    const connectionStrengths = []
    const connectionPositions = []
    const startPoints = []
    const endPoints = []
    const pathIndices = []
    
    const processedConnections = new Set()
    let pathIndex = 0
    const palette = nodeAttributes.palette
    
    neuralNetwork.nodes.forEach((node, nodeIndex) => {
      node.connections.forEach(connection => {
        const connectedNode = connection.node
        const connectedIndex = neuralNetwork.nodes.indexOf(connectedNode)
        if (connectedIndex === -1) return
        
        const key = [Math.min(nodeIndex, connectedIndex), Math.max(nodeIndex, connectedIndex)].join('-')
        if (!processedConnections.has(key)) {
          processedConnections.add(key)
          
          const startPoint = node.position
          const endPoint = connectedNode.position
          const numSegments = 20
          
          for (let i = 0; i < numSegments; i++) {
            const t = i / (numSegments - 1)
            connectionPositions.push(t, 0, 0)
            startPoints.push(startPoint.x, startPoint.y, startPoint.z)
            endPoints.push(endPoint.x, endPoint.y, endPoint.z)
            pathIndices.push(pathIndex)
            connectionStrengths.push(connection.strength)
            
            const avgLevel = Math.min(Math.floor((node.level + connectedNode.level) / 2), palette.length - 1)
            const baseColor = palette[avgLevel % palette.length].clone()
            baseColor.offsetHSL(
              THREE.MathUtils.randFloatSpread(0.03),
              THREE.MathUtils.randFloatSpread(0.08),
              THREE.MathUtils.randFloatSpread(0.08)
            )
            connectionColors.push(baseColor.r, baseColor.g, baseColor.b)
          }
          pathIndex++
        }
      })
    })
    
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(connectionPositions, 3))
    geometry.setAttribute('startPoint', new THREE.Float32BufferAttribute(startPoints, 3))
    geometry.setAttribute('endPoint', new THREE.Float32BufferAttribute(endPoints, 3))
    geometry.setAttribute('connectionStrength', new THREE.Float32BufferAttribute(connectionStrengths, 1))
    geometry.setAttribute('connectionColor', new THREE.Float32BufferAttribute(connectionColors, 3))
    geometry.setAttribute('pathIndex', new THREE.Float32BufferAttribute(pathIndices, 1))
    
    return geometry
  }, [neuralNetwork, nodeAttributes])
  
  useFrame((state, delta) => {
    const t = clock.getElapsedTime()

    if (nodesRef.current) {
      nodesRef.current.material.uniforms.uTime.value = t
      nodesRef.current.material.uniforms.uBaseNodeSize.value = 0.6 * nodeSize
      nodesRef.current.material.uniforms.uOpacity.value = opacity
      nodesRef.current.rotation.y = Math.sin(t * 0.04) * 0.05
    }

    if (connectionsRef.current) {
      connectionsRef.current.material.uniforms.uTime.value = t
      connectionsRef.current.material.uniforms.uOpacity.value = opacity
      connectionsRef.current.rotation.y = Math.sin(t * 0.04) * 0.05
    }

    if (groupRef.current) {
      groupRef.current.rotation.y += 0.001
    }

    // Autonomous firing — clustered bursts that mimic coordinated neural activity
    if (autoFire && nodesRef.current && connectionsRef.current && neuralNetwork.nodes.length > 1) {
      autoFireTimer.current -= delta
      if (autoFireTimer.current <= 0) {
        const nodes = neuralNetwork.nodes
        const root = nodes[0]

        // Pick a seed node (skip root)
        const seed = nodes[1 + Math.floor(Math.random() * (nodes.length - 1))]

        // Build a cluster of 1–3 nodes (seed + connected neighbors)
        // Distribution: 25% single, 50% pair, 25% triple — cluster firings dominate
        const cluster = [seed]
        const r = Math.random()
        const targetSize = r < 0.25 ? 1 : r < 0.75 ? 2 : 3

        if (targetSize > 1 && seed.connections.length > 0) {
          // Shuffle connected neighbors and take what we need (skip root)
          const neighbors = seed.connections
            .map(c => c.node)
            .filter(n => n !== root)
          for (let i = neighbors.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1))
            const tmp = neighbors[i]; neighbors[i] = neighbors[j]; neighbors[j] = tmp
          }
          for (let i = 0; i < Math.min(targetSize - 1, neighbors.length, 2); i++) {
            cluster.push(neighbors[i])
          }
        }

        // Single shared color for the whole cluster — visual signal of synchrony
        const palette = colorPalettes[theme]
        const burstColor = palette[Math.floor(Math.random() * palette.length)]

        // Fire each cluster member with a small cascading delay (~50ms apart)
        // Future-time offsets cause each pulse to start firing in sequence,
        // creating a rapid wavefront across the cluster
        const nodeUniforms = nodesRef.current.material.uniforms
        const connUniforms = connectionsRef.current.material.uniforms
        const cascadeStep = 0.05
        for (let i = 0; i < cluster.length; i++) {
          const idx = (autoFireIdx.current + 1 + i) % 3
          const fireTime = t + i * cascadeStep
          nodeUniforms.uPulsePositions.value[idx].copy(cluster[i].position)
          nodeUniforms.uPulseTimes.value[idx] = fireTime
          connUniforms.uPulsePositions.value[idx].copy(cluster[i].position)
          connUniforms.uPulseTimes.value[idx] = fireTime
          nodeUniforms.uPulseColors.value[idx].copy(burstColor)
          connUniforms.uPulseColors.value[idx].copy(burstColor)
        }
        autoFireIdx.current = (autoFireIdx.current + cluster.length) % 3

        // Longer quiet interval between bursts for rhythmic activity
        autoFireTimer.current = autoFireMinInterval + Math.random() * (autoFireMaxInterval - autoFireMinInterval)
      }
    }
  })
  
  const handlePointerDown = (event) => {
    if (!enableInteraction) return

    // Convert world-space hit to the network's local space (shaders now compare in local space)
    const localPoint = event.point.clone()
    if (nodesRef.current) nodesRef.current.worldToLocal(localPoint)
    const time = clock.getElapsedTime()

    const idx = (lastPulseIndex + 1) % 3
    setLastPulseIndex(idx)

    if (nodesRef.current && connectionsRef.current) {
      nodesRef.current.material.uniforms.uPulsePositions.value[idx].copy(localPoint)
      nodesRef.current.material.uniforms.uPulseTimes.value[idx] = time
      connectionsRef.current.material.uniforms.uPulsePositions.value[idx].copy(localPoint)
      connectionsRef.current.material.uniforms.uPulseTimes.value[idx] = time

      const palette = colorPalettes[theme]
      const randomColor = palette[Math.floor(Math.random() * palette.length)]
      nodesRef.current.material.uniforms.uPulseColors.value[idx].copy(randomColor)
      connectionsRef.current.material.uniforms.uPulseColors.value[idx].copy(randomColor)
    }
  }
  
  return (
    <group ref={groupRef} position={position} scale={scale}>
      <points 
        ref={nodesRef} 
        geometry={nodesGeometry}
        onPointerDown={handlePointerDown}
      >
        <nodeMaterial 
          transparent 
          depthWrite={false}
          blending={useNormalBlending ? THREE.NormalBlending : THREE.AdditiveBlending}
          opacity={opacity}
        />
      </points>
      
      <lineSegments 
        ref={connectionsRef} 
        geometry={connectionsGeometry}
      >
        <connectionMaterial 
          transparent
          depthWrite={false}
          blending={useNormalBlending ? THREE.NormalBlending : THREE.AdditiveBlending}
          opacity={opacity}
        />
      </lineSegments>
    </group>
  )
}

export default NeuralNetworkR3F