'use client'

import React, { useRef, useEffect } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js'

// Custom scanline shader
const ScanlineShader = {
  uniforms: {
    tDiffuse: { value: null },
    time: { value: 0 },
    intensity: { value: 0.2 }  // Reduced from 0.5 for more subtle effect
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float time;
    uniform float intensity;
    varying vec2 vUv;
    
    void main() {
      vec4 color = texture2D(tDiffuse, vUv);
      
      // Create scanlines
      float scanline = sin(vUv.y * 98.0 * 3.14159 * 2.0 + time * 0.5);  // Increased from 72 to 144 for finer lines
      scanline = abs(scanline);
      scanline = pow(scanline, 3.0);  // Increased from 2.0 to 3.0 for sharper/thinner lines
      
      // Apply scanline effect
      color.rgb *= mix(1.0, scanline, intensity);
      
      gl_FragColor = color;
    }
  `
}

class FloatingGallery extends THREE.Group {
  constructor(curve) {
    super()
    
    this.images = []
    this.textures = [] // Track textures for disposal
    this.materials = [] // Track materials for disposal
    this.geometries = [] // Track geometries for disposal
    this.imageData = [
      { 
        url: '/carousel_images/img1.jpg', 
        year: '1970',
        description: 'The Dawn of Digital Dreams',
        curvePosition: 0.11,  // Position along curve (0-1)
        width: 1.2,
        height: 1.2,
        radialOffset: -1,     // Distance from center of tunnel
        angle: -Math.PI,             // Angle around tunnel (radians)
        verticalOffset: 0.2,     // Additional vertical offset
        rotateY: Math.PI       // Rotate 180 degrees around Y-axis
      },
      // { 
      //   url: '/carousel_images/img2.jpg', 
      //   year: '1975',
      //   curvePosition: 0.18,
      //   width: 1.2,
      //   height: 1.2,
      //   radialOffset: 0.7,  // Changed from -1/3 to a more visible distance
      //   angle: -Math.PI,
      //   verticalOffset: 0.1,
      //   rotateY: Math.PI,     // Rotate 180 degrees around Y-axis
      //           rotateZ: Math.PI,  // Flip upside down (180 degrees)

      // },
      { 
        url: '/carousel_images/img3.jpg', 
        year: '1980',
        description: 'Neon Nights and Arcade Lights',
        curvePosition: 0.27,
        width: 1,
        height: 1,
        radialOffset: -0.6,
        angle: -Math.PI,
        rotateY: Math.PI,
    rotateZ: Math.PI/7,  // Flip upside down (180 degrees)
        verticalOffset: 0.5
      },
      { 
        url: '/carousel_images/img4.jpg', 
        year: '1985',
        description: 'Synthwave Sunset Boulevard',
        curvePosition: 0.37,
        width: 1,
        height: 1,
        radialOffset: 0.5,
        angle: Math.PI,
        rotateY: Math.PI,

        verticalOffset: 0.2

      },
      { 
        url: '/carousel_images/img5.jpg', 
        year: '1990',
        description: 'Grunge Meets the Grid',
        curvePosition: 0.46,
        width: 1,
        height: 1,
        radialOffset: -0.65,
        angle: -Math.PI,
        verticalOffset: 0.3,

        rotateY: Math.PI       // Rotate 180 degrees around Y-axis

      },
      { 
        url: '/carousel_images/img6.jpg', 
        year: '1995',
        description: 'The Internet Awakens',
        curvePosition: 0.55,
        width: 1.3,
        height: 1.3,
        radialOffset: -0.5,
        // angle: -Math.PI/6,
        verticalOffset: 0.5,
        rotateY: Math.PI       // Rotate 180 degrees around Y-axis

      },
      { 
        url: '/carousel_images/img7.jpg', 
        year: '2000',
        description: 'Y2K Millennium Vibes',
        curvePosition: 0.66,
        width: 1.4,
        height: 1.4,
        radialOffset: 1,
        angle: -Math.PI,
        verticalOffset: 0.1,
        rotateY: Math.PI       // Rotate 180 degrees around Y-axis

      },
      { 
        url: '/carousel_images/img8.jpg', 
        year: '2005',
        description: 'Web 2.0 Revolution',
        curvePosition: 0.74,
        width: 1.2,
        height: 1.2,
        radialOffset: 0.6,
        angle: -Math.PI,
        verticalOffset: 0.4,
        rotateY: Math.PI       // Rotate 180 degrees around Y-axis

      },
      { 
        url: '/carousel_images/img9.jpg', 
        year: '2010',
        description: 'The Social Network Era',
        curvePosition: 0.83,
        width: 1,
        height: 1,
        radialOffset: 0.6,
        angle: -Math.PI,
        verticalOffset: 0.2,
        rotateY: Math.PI,  // 180° + 30° to fix mirror and rotation
        rotateZ: 0                      // No vertical flip needed
      },
      { 
        url: '/carousel_images/img11.jpg', 
        year: '2015',
        description: 'Mobile-First World',
        curvePosition: 0.98,
        width: 1,
        height: 1,
        radialOffset: -0.5,
        angle: -Math.PI,
        verticalOffset: 0.5,
            rotateZ: -Math.PI/7,  // Flip upside down (180 degrees)

        rotateY: Math.PI       // Rotate 180 degrees around Y-axis

      },
      // { 
      //   url: '/carousel_images/img12.jpg', 
      //   year: '2020',
      //   curvePosition: 0.2,
      //   width: 1,
      //   height: 1,
      //   radialOffset: -1,
      //   angle: -Math.PI,
      //   verticalOffset: -0.5,
      //   rotateY: Math.PI,       // Rotate 180 degrees around Y-axis
      //           rotateZ: Math.PI,  // Flip upside down (180 degrees)

      // },
      // { 
      //   url: '/carousel_images/img13.jpg', 
      //   year: '2025',
      //   curvePosition: 1.0,
      //   width: 1.2,
      //   height: 1.2,
      //   radialOffset: 0.5,
      //   angle: -Math.PI,
      //   verticalOffset: 0,
      //           rotateY: Math.PI       // Rotate 180 degrees around Y-axis

      // }
    ]
    
    const loader = new THREE.TextureLoader()
    
    this.imageData.forEach((imageInfo, i) => {
      const position = new THREE.Vector3()
      const tangent = new THREE.Vector3()
      const normal = new THREE.Vector3()
      const binormal = new THREE.Vector3()
      
      curve.getPointAt(imageInfo.curvePosition, position)
      curve.getTangentAt(imageInfo.curvePosition, tangent)
      
      normal.crossVectors(tangent, new THREE.Vector3(0, 1, 0)).normalize()
      binormal.crossVectors(tangent, normal)
      
      const xOffset = Math.cos(imageInfo.angle) * imageInfo.radialOffset
      const zOffset = Math.sin(imageInfo.angle) * imageInfo.radialOffset
      
      position.add(normal.clone().multiplyScalar(xOffset))
      position.add(binormal.clone().multiplyScalar(zOffset))
      position.y += imageInfo.verticalOffset
      
      const geometry = new THREE.PlaneGeometry(imageInfo.width, imageInfo.height)
      const material = new THREE.MeshBasicMaterial({
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.95,
        fog: false
      })
      
      loader.load(imageInfo.url, (texture) => {
        // Optimize texture size
        texture.minFilter = THREE.LinearMipMapLinearFilter
        texture.magFilter = THREE.LinearFilter
        texture.generateMipmaps = true
        
        material.map = texture
        material.needsUpdate = true
        this.textures.push(texture) // Track for disposal
      })
      
      const mesh = new THREE.Mesh(geometry, material)
      mesh.position.copy(position)
      mesh.lookAt(position.clone().add(tangent))
      
      // Apply rotations - Y rotation defaults to 180 degrees to face camera
      const yRotation = imageInfo.rotateY !== undefined ? imageInfo.rotateY : Math.PI
      const xRotation = imageInfo.rotateX || 0
      const zRotation = imageInfo.rotateZ || 0
      
      // Apply rotations in order: Y, X, Z
      mesh.rotation.y += yRotation
      mesh.rotation.x += xRotation  
      mesh.rotation.z += zRotation
      


      
      const edgeGeometry = new THREE.EdgesGeometry(geometry)
      const edgeMaterial = new THREE.LineBasicMaterial({ 
        color: new THREE.Color('#41f').multiplyScalar(4)
      })
      const edges = new THREE.LineSegments(edgeGeometry, edgeMaterial)
      mesh.add(edges)
      
      const canvas = document.createElement('canvas')
      canvas.width = 256
      canvas.height = 64
      const ctx = canvas.getContext('2d')
      ctx.fillStyle = '#fa0'
      ctx.font = 'bold 48px Tourney, sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(imageInfo.year, canvas.width * 0.5, canvas.height * 0.5)
      
      const yearTexture = new THREE.CanvasTexture(canvas)
      const yearLabelWidth = imageInfo.width * 0.4
      const yearGeometry = new THREE.PlaneGeometry(yearLabelWidth, yearLabelWidth * 0.25)
      const yearMaterial = new THREE.MeshBasicMaterial({
        map: yearTexture,
        transparent: true,
        side: THREE.DoubleSide,
        fog: false
      })
      const yearMesh = new THREE.Mesh(yearGeometry, yearMaterial)
      yearMesh.position.set(0, -(imageInfo.height/2 + 0.1), 0.1)
      mesh.add(yearMesh)
      
      // Track for disposal
      this.textures.push(yearTexture)
      this.materials.push(material, yearMaterial, edgeMaterial)
      this.geometries.push(geometry, yearGeometry, edgeGeometry)
      
      mesh.userData = {
        initPosition: mesh.position.clone(),
        year: imageInfo.year,
        floatOffset: i * Math.PI / 6,
        floatSpeed: 0.5,
        floatAmplitude: 0.2
      }
      
      this.add(mesh)
      this.images.push(mesh)
    })
    
    this.frustumCulled = false
  }
  
  update(t) {
    this.images.forEach((image) => {
      const userData = image.userData
      
      const floatY = Math.sin(t * userData.floatSpeed + userData.floatOffset) * userData.floatAmplitude
      image.position.y = userData.initPosition.y + floatY
    })
  }
  
  dispose() {
    // Dispose of all tracked resources
    this.textures.forEach(texture => texture.dispose())
    this.materials.forEach(material => material.dispose())
    this.geometries.forEach(geometry => geometry.dispose())
    
    // Clear arrays
    this.textures = []
    this.materials = []
    this.geometries = []
    this.images = []
  }
}

class WireTunnel extends THREE.LineSegments {
  constructor() {
    const basePoints = [
      { x: 6.097824119373165, y: 2.962665382204997, z: 1.7433171949691226 },
      { x: 2.498887329278077, y: 1.876906878980996, z: -6.263607800877008 },
      { x: -2.157131886014289, y: 6.643373663865348, z: 0.46083444814894103 },
      { x: -3.4743927694436687, y: -3.0277132522771772, z: 5.268922787973147 },
      { x: -6.004952702196002, y: 0.16039311931742395, z: -3.59371911696846 }
    ]
    
    const curve = new THREE.CatmullRomCurve3(basePoints, true, 'catmullrom', 0.7)
    const tube = new THREE.TubeGeometry(curve, 100, 0.2, 7, true)
    const wire = new THREE.EdgesGeometry(tube, 1.125)

    super(
      wire, 
      new THREE.LineBasicMaterial({ 
        color: new THREE.Color('#41f').multiplyScalar(10) 
      })
    )
    this.curve = curve

    const gPoints = tube.clone()
    gPoints.deleteAttribute('uv')
    gPoints.deleteAttribute('normal')
    const gPointsMerged = mergeVertices(gPoints)
    const positions = gPointsMerged.attributes.position
    
    const color = new THREE.Color()
    const colors = new Float32Array(positions.count * 3)
    for(let i = 0; i < positions.count; i++) {
      color.setHSL((Math.random() - 0.5) * 0.15, 1, 0.6).multiplyScalar(7)
      colors[i * 3] = color.r
      colors[i * 3 + 1] = color.g
      colors[i * 3 + 2] = color.b
    }
    
    const pointsGeometry = new THREE.BufferGeometry()
    pointsGeometry.setAttribute('position', positions)
    pointsGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    
    const pointsMaterial = new THREE.PointsMaterial({
      size: 0.05,
      vertexColors: true,
      transparent: true,
      opacity: 0.9,
      sizeAttenuation: true
    })
    
    const points = new THREE.Points(pointsGeometry, pointsMaterial)
    points.frustumCulled = false
    this.add(points)
    
    const gShip = new THREE.ConeGeometry(0.1, 0.05, 3).translate(0, -0.1, 0)
    const mShip = new THREE.MeshLambertMaterial({
      polygonOffset: true,
      polygonOffsetUnits: -0.001,
      polygonOffsetFactor: 1,
      color: new THREE.Color('magenta')
    })
    const ship = new THREE.Mesh(gShip, mShip)
    this.ship = ship
    this.add(ship)
    
    const shipWire = new THREE.LineSegments(
      new THREE.EdgesGeometry(gShip), 
      new THREE.LineBasicMaterial({
        color: new THREE.Color('magenta').multiplyScalar(10)
      })
    )
    ship.add(shipWire)
  }
}

class FlyThrough {
  constructor(camera, curve, ship) {
    this.camera = camera
    this.curve = curve
    this.ship = ship
    this.la = new THREE.Vector3()
    this.laShip = new THREE.Vector3()
  }

  update(t) {
    const move = t * 0.025
    const cameraA = move % 1
    const lookAtA = (move + 0.025) % 1
    const lookAtShip = (move + 0.05) % 1

    this.curve.getPointAt(cameraA, this.camera.position)
    this.curve.getPointAt(lookAtA, this.la)
    this.camera.lookAt(this.la)
    
    this.ship.position.copy(this.la)
    this.curve.getPointAt(lookAtShip, this.laShip)
    this.ship.lookAt(this.laShip)
  }
}

export default function OldsCoolTunnel({ isFullscreen = false }) {
  const mountRef = useRef(null)
  const sceneRef = useRef(null)
  const rendererRef = useRef(null)
  const frameIdRef = useRef(null)
  const [isPaused, setIsPaused] = React.useState(false)
  const [focusedImage, setFocusedImage] = React.useState(null)
  const [focusedIndex, setFocusedIndex] = React.useState(-1)
  const galleryRef = useRef(null)
  const cameraRef = useRef(null)
  const raycasterRef = useRef(new THREE.Raycaster())
  const mouseRef = useRef(new THREE.Vector2())
  const focusStateRef = useRef({ image: null, index: -1 })

  useEffect(() => {
    console.log('OldsCoolTunnel mounting, mountRef.current =', mountRef.current)
    if (!mountRef.current) return

    const scene = new THREE.Scene()
    scene.background = new THREE.Color('#000')
    scene.fog = new THREE.Fog(scene.background, 0.1, 3)
    sceneRef.current = scene

    // Get container dimensions first
    const containerWidth = mountRef.current?.clientWidth || window.innerWidth
    const containerHeight = mountRef.current?.clientHeight || window.innerHeight
    
    const camera = new THREE.PerspectiveCamera(
      45,
      containerWidth / containerHeight,
      0.01,
      1000
    )
    camera.position.set(0, 0, 1).setLength(10)
    cameraRef.current = camera
    
    const cameraPositions = {
      tunnel: camera.position.clone(),
      overview: new THREE.Vector3(0, 50, 0),
      originalPosition: null,
      originalRotation: null
    }

    const renderer = new THREE.WebGLRenderer({ 
      antialias: true,
      powerPreference: 'high-performance'
    })
    
    renderer.setPixelRatio(window.devicePixelRatio)
    renderer.setSize(containerWidth, containerHeight)
    renderer.toneMapping = THREE.ReinhardToneMapping
    renderer.toneMappingExposure = Math.pow(0.9, 4.0)
    rendererRef.current = renderer
    
    // Ensure canvas is visible
    renderer.domElement.style.position = 'absolute'
    renderer.domElement.style.top = '0'
    renderer.domElement.style.left = '0'
    renderer.domElement.style.width = '100%'
    renderer.domElement.style.height = '100%'
    
    mountRef.current.appendChild(renderer.domElement)
    console.log('Renderer DOM element added, size:', containerWidth, 'x', containerHeight)
    
    // Removed OrbitControls - no longer needed

    const composer = new EffectComposer(renderer)
    const renderPass = new RenderPass(scene, camera)
    composer.addPass(renderPass)

    const bloomPass = new UnrealBloomPass(
      new THREE.Vector2(containerWidth, containerHeight),
      0.75,
      0,
      1
    )
    composer.addPass(bloomPass)
    
    // Add scanline effect
    const scanlinePass = new ShaderPass(ScanlineShader)
    composer.addPass(scanlinePass)

    // Removed "Old's cool" text - no longer needed

    const light = new THREE.DirectionalLight(0xffffff, Math.PI)
    light.position.setScalar(1)
    scene.add(light, new THREE.AmbientLight(0xffffff, Math.PI * 0.25))
    
    const wireTunnel = new WireTunnel()
    scene.add(wireTunnel)

    const gallery = new FloatingGallery(wireTunnel.curve)
    scene.add(gallery)
    galleryRef.current = gallery
    
    // Removed position arrow - no longer needed
    
    const flyThrough = new FlyThrough(camera, wireTunnel.curve, wireTunnel.ship)

    let t = 0
    let isPausedLocal = false
    let lastTime = performance.now()
    const targetFPS = 60
    const frameInterval = 1000 / targetFPS

    const animate = () => {
      frameIdRef.current = requestAnimationFrame(animate)
      
      const currentTime = performance.now()
      const elapsed = currentTime - lastTime
      
      // Throttle to target FPS
      if (elapsed > frameInterval) {
        const dt = elapsed / 1000 // Convert to seconds
        lastTime = currentTime - (elapsed % frameInterval)
        
        if (!isPausedLocal) {
          t += dt
          flyThrough.update(t)
        }
        
        gallery.update(t)
        
        // Update scanline shader time
        if (scanlinePass && scanlinePass.uniforms.time) {
          scanlinePass.uniforms.time.value = t
        }
        
        if (composer) {
          composer.render()
        } else {
          renderer.render(scene, camera)
        }
      }
    }

    const handleResize = () => {
      const width = mountRef.current?.clientWidth || window.innerWidth
      const height = mountRef.current?.clientHeight || window.innerHeight
      camera.aspect = width / height
      camera.updateProjectionMatrix()
      renderer.setSize(width, height)
      if (composer) {
        composer.setSize(width, height)
      }
    }

    const handleKeyPress = (e) => {
      if (e.code === 'Space') {
        e.preventDefault()
        isPausedLocal = !isPausedLocal
        setIsPaused(isPausedLocal)
      }
      
      if (e.code === 'Escape' && focusStateRef.current.image) {
        focusStateRef.current = { image: null, index: -1 }
        setFocusedImage(null)
        setFocusedIndex(-1)
        isPausedLocal = false
        setIsPaused(false)
      }
      
      // Arrow keys for navigation when focused
      if (focusStateRef.current.image && galleryRef.current) {
        if (e.code === 'ArrowLeft') {
          e.preventDefault()
          const prevIndex = (focusStateRef.current.index - 1 + galleryRef.current.images.length) % galleryRef.current.images.length
          focusStateRef.current = { image: galleryRef.current.images[prevIndex], index: prevIndex }
          setFocusedImage(galleryRef.current.images[prevIndex])
          setFocusedIndex(prevIndex)
        }
        if (e.code === 'ArrowRight') {
          e.preventDefault()
          const nextIndex = (focusStateRef.current.index + 1) % galleryRef.current.images.length
          focusStateRef.current = { image: galleryRef.current.images[nextIndex], index: nextIndex }
          setFocusedImage(galleryRef.current.images[nextIndex])
          setFocusedIndex(nextIndex)
        }
      }
      
      // Removed V and R key handlers - no longer needed
    }
    
    const handleTouch = (e) => {
      e.preventDefault()
      
      // If already focused on an image, unfocus first
      if (focusStateRef.current.image) {
        focusStateRef.current = { image: null, index: -1 }
        setFocusedImage(null)
        setFocusedIndex(-1)
        isPausedLocal = false
        setIsPaused(false)
        return
      }
      
      // If paused, check if clicking on an image
      if (isPausedLocal) {
        const rect = renderer.domElement.getBoundingClientRect()
        const x = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left
        const y = (e.touches ? e.touches[0].clientY : e.clientY) - rect.top
        
        mouseRef.current.x = (x / rect.width) * 2 - 1
        mouseRef.current.y = -(y / rect.height) * 2 + 1
        
        raycasterRef.current.setFromCamera(mouseRef.current, camera)
        
        if (galleryRef.current && galleryRef.current.images) {
          const intersects = raycasterRef.current.intersectObjects(galleryRef.current.images, false)
          
          if (intersects.length > 0) {
            const clickedImage = intersects[0].object
            const imageIndex = galleryRef.current.images.indexOf(clickedImage)
            
            if (imageIndex !== -1) {
              // Store original camera position
              cameraPositions.originalPosition = camera.position.clone()
              cameraPositions.originalRotation = camera.rotation.clone()
              
              // Focus on the clicked image
              focusStateRef.current = { image: clickedImage, index: imageIndex }
              setFocusedImage(clickedImage)
              setFocusedIndex(imageIndex)
              return
            }
          }
        }
      }
      
      // Default behavior - toggle pause
      isPausedLocal = !isPausedLocal
      setIsPaused(isPausedLocal)
    }
    
    const handleClick = (e) => {
      // Handle click when focused to exit focus mode
      if (focusStateRef.current.image && !e.touches) {
        // Check if clicking on UI buttons (they have stopPropagation)
        if (!e.defaultPrevented) {
          focusStateRef.current = { image: null, index: -1 }
          setFocusedImage(null)
          setFocusedIndex(-1)
          isPausedLocal = false
          setIsPaused(false)
        }
        return
      }
      // Same as touch but for mouse clicks when paused
      if (isPausedLocal && !e.touches) {
        handleTouch(e)
      }
    }

    window.addEventListener('resize', handleResize)
    window.addEventListener('keydown', handleKeyPress)
    
    // Add touch and click event listeners to the renderer's canvas
    renderer.domElement.addEventListener('touchstart', handleTouch)
    renderer.domElement.addEventListener('click', handleClick)
    
    console.log('Starting animation loop')
    animate()

    return () => {
      window.removeEventListener('resize', handleResize)
      window.removeEventListener('keydown', handleKeyPress)
      if (renderer.domElement) {
        renderer.domElement.removeEventListener('touchstart', handleTouch)
        renderer.domElement.removeEventListener('click', handleClick)
      }
      if (frameIdRef.current) {
        cancelAnimationFrame(frameIdRef.current)
      }
      
      // Dispose of gallery resources
      if (gallery && gallery.dispose) {
        gallery.dispose()
      }
      
      // Dispose of composer and passes
      if (composer) {
        composer.passes.forEach(pass => {
          if (pass.dispose) pass.dispose()
        })
      }
      
      // Traverse and dispose all scene objects
      if (sceneRef.current) {
        sceneRef.current.traverse((object) => {
          if (object.geometry) object.geometry.dispose()
          if (object.material) {
            if (Array.isArray(object.material)) {
              object.material.forEach(material => material.dispose())
            } else {
              object.material.dispose()
            }
          }
          if (object.texture) object.texture.dispose()
        })
        sceneRef.current.clear()
      }
      
      if (rendererRef.current) {
        rendererRef.current.dispose()
        rendererRef.current.forceContextLoss()
        if (mountRef.current && rendererRef.current.domElement) {
          mountRef.current.removeChild(rendererRef.current.domElement)
        }
      }
    }
  }, [])

  // Handle camera animation for focused image
  useEffect(() => {
    if (!cameraRef.current || !focusedImage) return
    
    const camera = cameraRef.current
    const targetPosition = new THREE.Vector3()
    const targetLookAt = new THREE.Vector3()
    
    if (focusedImage) {
      // Calculate position in front of the image
      targetPosition.copy(focusedImage.position)
      const normal = new THREE.Vector3(0, 0, 1)
      normal.applyQuaternion(focusedImage.quaternion)
      targetPosition.add(normal.multiplyScalar(4)) // Move camera 4 units in front
      
      targetLookAt.copy(focusedImage.position)
    }
    
    // Animate camera to target position
    let animationFrame
    const animateCamera = () => {
      // Smooth interpolation
      camera.position.lerp(targetPosition, 0.1)
      camera.lookAt(targetLookAt)
      
      if (camera.position.distanceTo(targetPosition) > 0.1) {
        animationFrame = requestAnimationFrame(animateCamera)
      }
    }
    
    animateCamera()
    
    return () => {
      if (animationFrame) cancelAnimationFrame(animationFrame)
    }
  }, [focusedImage])

  return (
    <div style={{ position: 'relative', width: '100%', height: '100vh' }}>
      <div 
        ref={mountRef} 
        style={{ 
          width: '100%', 
          height: '100vh', 
          overflow: 'hidden',
          position: 'relative',
          margin: 0
        }} 
      />
      {isFullscreen && !focusedImage && (
        <div 
          style={{
            position: 'absolute',
            bottom: '20px',
            left: '50%',
            transform: 'translateX(-50%)',
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            color: '#fa0',
            padding: '10px 20px',
            borderRadius: '5px',
            fontFamily: 'Tourney, monospace',
            fontSize: '16px',
            border: '2px solid #41f',
            zIndex: 1000,
            textAlign: 'center',
            pointerEvents: 'none'
          }}
        >
          <div>{isPaused ? '⏸ PAUSED' : '▶ PLAYING'}</div>
          <div style={{ fontSize: '14px', marginTop: '5px', color: '#8af' }}>
            {isPaused ? 
              ('ontouchstart' in window ? 'Tap an image to focus' : 'Click an image to focus') :
              ('ontouchstart' in window ? 'Tap to Pause' : 'Press SPACE to Pause')
            }
          </div>
        </div>
      )}
      
      {/* Focused Image UI */}
      {isFullscreen && focusedImage && galleryRef.current && (
        <div 
          style={{
            position: 'absolute',
            bottom: '20px',
            left: '50%',
            transform: 'translateX(-50%)',
            backgroundColor: 'rgba(0, 0, 0, 0.85)',
            color: '#fa0',
            padding: '20px 30px',
            borderRadius: '10px',
            fontFamily: 'Tourney, monospace',
            fontSize: '20px',
            border: '2px solid #41f',
            zIndex: 1000,
            textAlign: 'center',
            minWidth: '300px'
          }}
        >
          <div style={{ fontSize: '28px', marginBottom: '10px', color: '#fff' }}>
            {galleryRef.current.imageData[focusedIndex]?.year || ''}
          </div>
          {galleryRef.current.imageData[focusedIndex]?.description && (
            <div style={{ fontSize: '16px', color: '#fa0', marginBottom: '15px', fontStyle: 'italic' }}>
              "{galleryRef.current.imageData[focusedIndex].description}"
            </div>
          )}
          <div style={{ fontSize: '14px', color: '#8af', marginTop: '15px' }}>
            {'ontouchstart' in window ? 'Tap outside to exit' : 'Click outside or ESC to exit'}
          </div>
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            marginTop: '15px',
            gap: '20px'
          }}>
            <button
              onClick={(e) => {
                e.stopPropagation()
                const prevIndex = (focusedIndex - 1 + galleryRef.current.images.length) % galleryRef.current.images.length
                focusStateRef.current = { image: galleryRef.current.images[prevIndex], index: prevIndex }
                setFocusedImage(galleryRef.current.images[prevIndex])
                setFocusedIndex(prevIndex)
              }}
              style={{
                background: 'transparent',
                border: '2px solid #41f',
                color: '#8af',
                padding: '5px 15px',
                borderRadius: '5px',
                cursor: 'pointer',
                fontSize: '16px'
              }}
            >
              ← Previous
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation()
                const nextIndex = (focusedIndex + 1) % galleryRef.current.images.length
                focusStateRef.current = { image: galleryRef.current.images[nextIndex], index: nextIndex }
                setFocusedImage(galleryRef.current.images[nextIndex])
                setFocusedIndex(nextIndex)
              }}
              style={{
                background: 'transparent',
                border: '2px solid #41f',
                color: '#8af',
                padding: '5px 15px',
                borderRadius: '5px',
                cursor: 'pointer',
                fontSize: '16px'
              }}
            >
              Next →
            </button>
          </div>
        </div>
      )}
    </div>
  )
}