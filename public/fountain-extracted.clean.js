console.log('Fountain module script starting...');
import * as THREE from 'three';
// import { GUI } from 'three/addons/libs/lil-gui.module.min.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { GPUComputationRenderer } from 'three/addons/misc/GPUComputationRenderer.js';
import { SimplexNoise } from 'three/addons/math/SimplexNoise.js';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
console.log('Fountain imports successful!');

// --- Coin Material and Geometry (moved up for Firebase functions) ---
const baseCoinMaterial = new THREE.MeshStandardMaterial({
  color: 0xcebb43,
  metalness: 0.0,
  // High metalness for shine
  roughness: 1,
  // Very low roughness for maximum shine
  // emissive: 0xdfd86f, // Yellow emissive glow
  // emissiveIntensity: 0.05, // Strong glow effect
  transparent: false,
  opacity: 0.9,
  depthWrite: true,
  // Don't write to depth buffer
  depthTest: true,
  // Skip depth testing entirely
  side: THREE.DoubleSide // Render both sides
});
// const coinGeometry = new THREE.CylinderGeometry(0.02, 0.02, 0.002, 16); // Small cylinder for coin
const coinGeometry = new THREE.CylinderGeometry(0.02 * 2, 0.02 * 2, 0.005 * 2, 8); // Octagon shape with 8 segments
coinGeometry.rotateX(Math.PI / 2); // Lay the coin flat

// Define coin dimensions for use in physics

const COIN_THICKNESS = 0.002 * 1.5;

// --- Coin Counter and Performance Settings ---
let totalCoinCount = 0;
let collectedCoinCount = 0;
let charityAllocation = {
  'world-central-kitchen': 0,
  'aspca': 0
};
let isResetting = false;
let staticCoinInstancedMesh = null;
let staticCoinData = [];

// Mobile detection for other optimizations
const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth <= 768;

// Reduced performance settings for all devices to prevent crashes
const MAX_STATIC_COINS = 100; // Reduced from 300
const COINS_TO_LOAD = 75; // Reduced from 200
const RESET_THRESHOLD = 100; // Reduced from 200, same for all devices

function updateCoinCounter() {
  const coinCountElement = document.getElementById('coinCount');
  const collectedCountElement = document.getElementById('collectedCount');
  const mobileCurrentCountElement = document.getElementById('mobileCurrentCount');
  const wckPercentageElement = document.getElementById('wckPercentage');
  const aspcaPercentageElement = document.getElementById('aspcaPercentage');
  if (coinCountElement) {
    // Show actual count from database, even if we're only rendering some
    coinCountElement.textContent = totalCoinCount;
  }
  if (collectedCountElement) {
    collectedCountElement.textContent = collectedCoinCount;
  }

  // Update mobile counter with current pool count
  if (mobileCurrentCountElement) {
    mobileCurrentCountElement.textContent = totalCoinCount;
  }

  // Update allocation percentages
  const total = charityAllocation['world-central-kitchen'] + charityAllocation['aspca'];
  if (total > 0 && wckPercentageElement && aspcaPercentageElement) {
    const wckPercent = Math.round(charityAllocation['world-central-kitchen'] / total * 100);
    const aspcaPercent = Math.round(charityAllocation['aspca'] / total * 100);
    wckPercentageElement.textContent = wckPercent;
    aspcaPercentageElement.textContent = aspcaPercent;
  } else if (wckPercentageElement && aspcaPercentageElement) {
    wckPercentageElement.textContent = '0';
    aspcaPercentageElement.textContent = '0';
  }
}

// Load collected coins total from archives
async function loadCollectedTotal() {
  try {
    const response = await fetch('/api/archive-fountain-coins');
    if (response.ok) {
      const data = await response.json();
      collectedCoinCount = data.cumulativeTotal || 0;
      updateCoinCounter();
    }
  } catch (error) {
    console.error('Error loading collected total:', error);
  }
}

// Set up real-time listener for coin count updates
function setupRealtimeCoinCounter() {
  if (!coinsCollection || !db) {
    console.warn("Firestore not initialized, cannot set up real-time listener");
    return;
  }

  // Listen for changes to the collection
  coinsCollection.onSnapshot(snapshot => {
    // Update total count based on the collection size
    totalCoinCount = snapshot.size;

    // Update charity allocation based on changes
    charityAllocation = {
      'world-central-kitchen': 0,
      'aspca': 0
    };
    snapshot.forEach(doc => {
      const data = doc.data();
      if (data.charity && charityAllocation[data.charity] !== undefined) {
        charityAllocation[data.charity]++;
      }
    });

    // Update the display
    updateCoinCounter();

    // Check if we need to reset the fountain
    if (totalCoinCount >= RESET_THRESHOLD && !isResetting) {
      console.log('Fountain full (real-time update)! Archiving and resetting...');
      archiveAndResetFountain();
    }
    console.log('Real-time update: Total coins =', totalCoinCount);
  }, error => {
    console.error('Error with real-time listener:', error);
  });
}

// Archive and reset the fountain
async function archiveAndResetFountain() {
  console.log('archiveAndResetFountain called, isResetting:', isResetting, 'totalCoinCount:', totalCoinCount);
  if (isResetting) {
    console.log('Already resetting, skipping...');
    return; // Prevent multiple resets
  }
  isResetting = true;
  const resetMessage = document.getElementById('resetMessage');
  if (resetMessage) {
    resetMessage.style.display = 'block';
  }
  try {
    console.log('Sending archive request to API...');
    const response = await fetch('/api/archive-fountain-coins', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    const data = await response.json();
    console.log('Archive response:', response.status, data);
    if (response.ok) {
      console.log('Fountain archived successfully:', data);

      // Update collected count
      collectedCoinCount = data.cumulativeTotal || collectedCoinCount + data.archivedCount;
      totalCoinCount = 0;
      charityAllocation = {
        'world-central-kitchen': 0,
        'aspca': 0
      };
      updateCoinCounter();

      // Clear visual coins
      staticCoinData = [];
      createStaticCoinInstances();

      // Hide reset message after a moment
      setTimeout(() => {
        if (resetMessage) {
          resetMessage.style.display = 'none';
        }
        isResetting = false;
      }, 2000);
    } else {
      console.error('Failed to archive fountain:', data);
      isResetting = false;
      if (resetMessage) {
        resetMessage.style.display = 'none';
      }
    }
  } catch (error) {
    console.error('Error archiving fountain:', error);
    isResetting = false;
    if (resetMessage) {
      resetMessage.style.display = 'none';
    }
  }
}

// Make archiveAndResetFountain globally accessible for debugging
window.archiveAndResetFountain = archiveAndResetFountain;

// Create instanced mesh for static coins (huge performance boost)
function createStaticCoinInstances() {
  // Remove old instanced mesh if it exists
  if (staticCoinInstancedMesh) {
    scene.remove(staticCoinInstancedMesh);
    staticCoinInstancedMesh.geometry.dispose();
    staticCoinInstancedMesh.material.dispose();
  }
  if (staticCoinData.length === 0) return;

  // Create instanced mesh with capacity for all static coins
  const instanceCount = Math.min(staticCoinData.length, MAX_STATIC_COINS);

  // Create material for static coins with 80s mode support
  const staticCoinMaterial = baseCoinMaterial.clone();
  if (is80sMode) {
    staticCoinMaterial.emissive = new THREE.Color('#FFEB38');
    staticCoinMaterial.emissiveIntensity = 0.3;
  }
  staticCoinInstancedMesh = new THREE.InstancedMesh(coinGeometry, staticCoinMaterial, instanceCount);

  // Set up transform matrices for each coin
  const matrix = new THREE.Matrix4();
  const position = new THREE.Vector3();
  const quaternion = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  for (let i = 0; i < instanceCount; i++) {
    const coinInfo = staticCoinData[i];
    position.copy(coinInfo.position);
    quaternion.setFromEuler(coinInfo.rotation);

    // Scale underwater coins
    if (coinInfo.underwater) {
      scale.set(1.25, 1.25, 1.25);
    } else {
      scale.set(1, 1, 1);
    }
    matrix.compose(position, quaternion, scale);
    staticCoinInstancedMesh.setMatrixAt(i, matrix);
  }
  staticCoinInstancedMesh.instanceMatrix.needsUpdate = true;
  staticCoinInstancedMesh.renderOrder = 99;
  scene.add(staticCoinInstancedMesh);
  console.log(`Created instanced mesh with ${instanceCount} coins`);
}

// --- Firebase Configuration and Initialization ---
let db = null;
let coinsCollection = null;

// Initialize Firebase
async function initializeFirebase() {
  try {
    // Fetch Firebase configuration from API endpoint
    const response = await fetch('/api/firebase-config');
    if (!response.ok) {
      throw new Error('Failed to fetch Firebase configuration');
    }
    const firebaseConfig = await response.json();

    // Validate that we have the required config
    if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
      console.error('Invalid Firebase configuration received');
      return;
    }

    // Initialize Firebase
    if (!firebase.apps.length) {
      firebase.initializeApp(firebaseConfig);
    }
    db = firebase.firestore();
    coinsCollection = db.collection('fountain_coins');
    console.log("Firebase initialized successfully");

    // Load collected total first
    await loadCollectedTotal();

    // Set up real-time listener for coin count
    setupRealtimeCoinCounter();

    // Load existing coins
    loadSavedCoins();
  } catch (error) {
    console.error("Error initializing Firebase:", error);
    // Continue without Firebase if initialization fails
  }
}

// Function to save a coin to Firestore
async function saveCoinToFirestore(coinData) {
  if (!coinsCollection || !db) {
    console.warn("Firestore not initialized, cannot save coin");
    return;
  }
  try {
    const docRef = await coinsCollection.add({
      position: {
        x: coinData.position.x,
        y: coinData.position.y,
        z: coinData.position.z
      },
      rotation: {
        x: coinData.rotation.x,
        y: coinData.rotation.y,
        z: coinData.rotation.z
      },
      timestamp: firebase.firestore.FieldValue.serverTimestamp(),
      isInUpperBowl: coinData.isInUpperBowl || false,
      charity: coinData.charity || null
    });
    console.log("Coin saved with ID: ", docRef.id);
    if (coinData.charity) {
      console.log("Supporting charity:", coinData.charity);
    }
    return docRef.id;
  } catch (error) {
    console.error("Error saving coin: ", error);
  }
}

// Function to load saved coins from Firestore
async function loadSavedCoins() {
  if (!coinsCollection || !db) {
    console.warn("Firestore not initialized, cannot load coins");
    return;
  }
  try {
    // Get total count more efficiently with a limited query
    // For performance, we'll estimate if there are many coins
    const countSnapshot = await coinsCollection.limit(1000).get();
    totalCoinCount = countSnapshot.size;
    if (countSnapshot.size === 1000) {
      // If we hit the limit, show 1000+
      totalCoinCount = "1000+";
    }
    updateCoinCounter();

    // Check if we need to reset the fountain on load
    console.log('Checking fountain status - Count:', totalCoinCount, 'Threshold:', RESET_THRESHOLD);
    if (totalCoinCount >= RESET_THRESHOLD && !isResetting) {
      console.log('Fountain has ' + totalCoinCount + ' coins (threshold: ' + RESET_THRESHOLD + ') - triggering reset...');
      await archiveAndResetFountain();
      return; // Don't load coins since we're resetting
    }

    // Then load the most recent coins for display
    const snapshot = await coinsCollection.orderBy('timestamp', 'desc').limit(COINS_TO_LOAD).get();

    // Clear existing static coin data and reset charity allocation
    staticCoinData = [];
    charityAllocation = {
      'world-central-kitchen': 0,
      'aspca': 0
    };
    snapshot.forEach(doc => {
      const data = doc.data();
      if (data.position) {
        staticCoinData.push({
          position: new THREE.Vector3(data.position.x, data.position.y, data.position.z),
          rotation: new THREE.Euler(data.rotation.x || 0, data.rotation.y || 0, data.rotation.z || 0),
          underwater: data.position.y < -0.4,
          id: doc.id
        });
      }
      // Count charity allocations
      if (data.charity) {
        if (charityAllocation[data.charity] !== undefined) {
          charityAllocation[data.charity]++;
        }
      }
    });

    // Create instanced mesh for all static coins
    createStaticCoinInstances();
    console.log(`Total coins in fountain: ${totalCoinCount}, Rendering: ${Math.min(staticCoinData.length, MAX_STATIC_COINS)}`);
  } catch (error) {
    console.error("Error loading saved coins: ", error);
  }
}

// Function to add a new static coin to the instanced mesh
function addStaticCoinToInstances(position, rotation, firestoreId) {
  // Check if scene is initialized
  if (!scene) {
    console.warn('Scene not initialized yet, cannot create static coin');
    return;
  }

  // Add to static coin data
  staticCoinData.unshift({
    // Add to beginning (most recent)
    position: position,
    rotation: rotation,
    underwater: position.y < -0.4,
    id: firestoreId
  });

  // Limit the array size
  if (staticCoinData.length > MAX_STATIC_COINS) {
    staticCoinData = staticCoinData.slice(0, MAX_STATIC_COINS);
  }

  // Recreate the instanced mesh with updated data
  createStaticCoinInstances();
}

// --- End Firebase Functions ---

// Texture width for simulation - reduced for better performance
const WIDTH = isMobileDevice ? 256 : 384; // Reduced from 512

// Water size in system units
const BOUNDS = 2.65;
const BOUNDS_HALF = BOUNDS * 0.5;
let tmpHeightmap = null;
// let duckModel = null;

let container;
let camera, scene, renderer, controls;
let composer, bloomPass;
let chromaticAberrationPass, scanlinePass, noisePass, vignettePass;
let mousedown = false;
let hasAimed = false; // Track if user has clicked water to aim
let is80sMode = false; // Track 80s mode state
const mouseCoords = new THREE.Vector2();
const aimedCoords = new THREE.Vector2(); // Separate variable for aimed coin position
const raycaster = new THREE.Raycaster();
let sun;
let waterMesh;
let upperWaterMesh;
let meshRay;
let upperMeshRay;
let gpuCompute;
let heightmapVariable;
let smoothShader;
let readWaterLevelShader;
// --- NEW: 3D UI Elements ---
let tossCoinButton3D;
let localCoinButton3D;
// --- END NEW ---

// Charity modal variables
let selectedCharity = null;
// --- NEW: Splash Particle System Variables ---
let splashParticleSystem;
const maxSplashParticles = isMobileDevice ? 100 : 250; // Reduced from 500

// --- END NEW ---

const simplex = new SimplexNoise();
let frame = 0;
const coins = []; // Array to hold active coins
const gravity = 0.03; // Simple gravity strength
const coinSplashDuration = 75; // ms the splash force lasts
let coinSplashTimeout = null; // Timeout ID for resetting splash

const fallingWaterUniforms = {
  iTime: {
    value: 0.0
  }
  // We might add a noise texture sampler here later if needed
  // WN_TEX: { value: null }
};
const effectController = {
  mouseSize: 0.08,
  mouseDeep: 0.003,
  viscosity: 0.9,
  speed: 5,
  // ducksEnabled: ducksEnabled,
  wireframe: false,
  shadow: false
};

// --- NEW: Falling Water Shaders ---

const fallingWaterVertexShader = `
                varying vec2 vUv;
                varying vec3 vWorldPosition; // Pass world position to fragment shader

                void main() {
                    vUv = uv;
                    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
                    vWorldPosition = worldPosition.xyz;
                    gl_Position = projectionMatrix * viewMatrix * worldPosition;
                }
            `;
const fallingWaterFragmentShader = `
                uniform float iTime;
                // uniform sampler2D WN_TEX; // If using texture noise later

                varying vec2 vUv;
                varying vec3 vWorldPosition;

                // --- Include waterNoise function ---
                float waterNoise( in vec2 p ) {
                    // Simplified version without texture for now, using time-based trig
                    // You can replace this with the texture version if you set up WN_TEX
                    float r = sin((length(p)*40.0)-iTime*20.0)*0.003; // Increased amplitude slightly
                    r += cos((length(p)*25.0)+iTime*20.0)*0.003;
                    r += sin(p.x * 50.0 + iTime * 5.0) * 0.001; // Add some vertical movement/variation
                    r += cos(p.y * 30.0 - iTime * 8.0) * 0.0015;
                    return r;
                    // --- Original Texture Version (Requires WN_TEX uniform) ---
                    // float r = sin((length(p)*40.0)-iTime*20.0)*.0003;
                    // r += cos((length(p)*25.0)+iTime*20.0)*.0003;
                    // // Requires sampler WN_TEX (typically bound to iChannel1 or similar)
                    // r += texture(WN_TEX,p+iTime*.25).r*.00125;
                    // return r + texture(WN_TEX,(p*2.0)-iTime*.125).r*.0025;
                }
                // --- End waterNoise function ---

                void main() {
                    // --- Basic Flowing Effect using UVs and Time ---
                    vec2 scrollingUv = vUv + vec2(0.0, iTime * 0.3); // Keep vertical scroll for downward motion

                    // --- Add Noise ---
                    float noiseVal = waterNoise(vWorldPosition.xz * 0.5);
                    noiseVal += waterNoise(vUv * 5.0 + vec2(0.0, iTime * 0.5));

                    // --- Base Color & Transparency ---
                    vec3 baseColor = vec3(0.6, 0.8, 0.95);
                    float baseAlpha = 0.6;

                    // --- Modulate Alpha with Noise & Scrolling UV ---
                    // --- ADJUSTMENT: Use X component for pattern ---
                    // Use the horizontal UV coordinate (scrollingUv.x or vUv.x) for the repeating pattern
                    // Multiply by a larger number for more vertical streaks
                    float alphaPattern = fract(scrollingUv.x * 15.0 + noiseVal * 10.0); // Using .x now!
                    // --- END ADJUSTMENT ---

                    float finalAlpha = baseAlpha * smoothstep(0.1, 0.9, alphaPattern); // Apply pattern

                    // Discard fully transparent fragments (optional)
                    if (finalAlpha < 0.05) discard;

                    gl_FragColor = vec4(baseColor, finalAlpha);
                }
            `;
// --- END NEW ---

// --- NEW: Helper function to create 3D text using CanvasTexture and Sprite ---

// --- NEW: Helper function to create 3D button using CanvasTexture and Plane Mesh ---
function createButtonMesh(labelText, position, size = {
  width: 0.8,
  height: 0.25
}, fontSize = 64, bgColor = '#f0ad4e', textColor = 'white') {
  const canvas = document.createElement('canvas');
  // High resolution canvas for clarity
  canvas.width = 1024; // Doubled canvas resolution for sharper text
  canvas.height = Math.round(canvas.width * (size.height / size.width));
  const context = canvas.getContext('2d');

  // Background
  context.fillStyle = bgColor;
  // Rounded corners
  const cornerRadius = canvas.height * 0.2;
  context.beginPath();
  context.moveTo(cornerRadius, 0);
  context.lineTo(canvas.width - cornerRadius, 0);
  context.arcTo(canvas.width, 0, canvas.width, cornerRadius, cornerRadius);
  context.lineTo(canvas.width, canvas.height - cornerRadius);
  context.arcTo(canvas.width, canvas.height, canvas.width - cornerRadius, canvas.height, cornerRadius);
  context.lineTo(cornerRadius, canvas.height);
  context.arcTo(0, canvas.height, 0, canvas.height - cornerRadius, cornerRadius);
  context.lineTo(0, cornerRadius);
  context.arcTo(0, 0, cornerRadius, 0, cornerRadius);
  context.closePath();
  context.fill();

  // Text - handle multi-line
  // Scale font size for the canvas resolution
  const scaledFontSize = fontSize * (canvas.width / 512); // Scale based on canvas width
  context.font = `bold ${scaledFontSize}px Arial`;
  context.fillStyle = textColor;
  context.textAlign = 'center';
  context.textBaseline = 'middle';

  // Split text by newline characters
  const lines = labelText.split('\n');
  const lineHeight = scaledFontSize * 1.2;
  const totalHeight = lines.length * lineHeight;
  const startY = (canvas.height - totalHeight) / 2 + lineHeight / 2;
  lines.forEach((line, index) => {
    context.fillText(line, canvas.width / 2, startY + index * lineHeight);
  });
  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  const geometry = new THREE.PlaneGeometry(size.width, size.height);
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    depthTest: false,
    // Render on top
    depthWrite: false,
    side: THREE.FrontSide
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.copy(position);
  mesh.userData.isTossButton = true; // Identifier for raycasting
  // Optionally make it face the camera
  // mesh.lookAt(camera.position);

  return mesh;
}
// --- END NEW ---

// --- NEW: Splash Particle System Functions ---
function initSplashParticleSystem() {
  // Create particle geometry
  const particleGeometry = new THREE.BufferGeometry();
  const particleCount = maxSplashParticles;
  const positions = new Float32Array(particleCount * 3);
  const velocities = new Float32Array(particleCount * 3);
  const lifetimes = new Float32Array(particleCount);
  const sizes = new Float32Array(particleCount);

  // Initialize all particles as inactive
  for (let i = 0; i < particleCount; i++) {
    positions[i * 3] = 0;
    positions[i * 3 + 1] = -0.42; // Hide below scene
    positions[i * 3 + 2] = 0;
    velocities[i * 3] = 0;
    velocities[i * 3 + 1] = 0;
    velocities[i * 3 + 2] = 0;
    lifetimes[i] = 0;
    sizes[i] = 0;
  }
  particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  particleGeometry.setAttribute('velocity', new THREE.BufferAttribute(velocities, 3));
  particleGeometry.setAttribute('lifetime', new THREE.BufferAttribute(lifetimes, 1));
  particleGeometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

  // Create particle material with custom shader
  const particleMaterial = new THREE.ShaderMaterial({
    uniforms: {
      color: {
        value: new THREE.Color(0xffffff)
      },
      opacity: {
        value: 0.3
      },
      pointTexture: {
        value: new THREE.TextureLoader().load('/cloud.png', () => {
          assetsToLoad.cloudTexture = true;
          console.log('[Fountain] Cloud texture loaded');
          checkAllAssetsLoaded();
        }, undefined, error => {
          console.error('[Fountain] Error loading cloud texture:', error);
          assetsToLoad.cloudTexture = true; // Mark as loaded anyway to not block
          checkAllAssetsLoaded();
        })
      }
    },
    vertexShader: `
						attribute float size;
						attribute float lifetime;
						varying float vLifetime;
						
						void main() {
							vLifetime = lifetime;
							vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
							gl_PointSize = size * (300.0 / -mvPosition.z);
							gl_Position = projectionMatrix * mvPosition;
						}
					`,
    fragmentShader: `
						uniform vec3 color;
						uniform float opacity;
						uniform sampler2D pointTexture;
						varying float vLifetime;
						
						void main() {
							if (vLifetime <= 0.0) discard;

      vec2 uv = vec2(gl_PointCoord.x, 1.0 - gl_PointCoord.y);
      vec4 textureColor = texture2D(pointTexture, uv);

      // Fade out based on lifetime
      float alpha = opacity * vLifetime * textureColor.a;

      // Discard pixels that are too transparent
      if (alpha < 0.01) discard;

      gl_FragColor = vec4(color, alpha);
						}
					`,
    blending: THREE.NormalBlending,
    depthWrite: true,
    depthTest: true,
    transparent: true,
    opacity: 0.1,
    alphaTest: 0.1,
    renderOrder: 999
  });
  splashParticleSystem = new THREE.Points(particleGeometry, particleMaterial);
  scene.add(splashParticleSystem);
}
function emitSplashParticles(centerX, centerZ, radius, particleCount = 20) {
  const positions = splashParticleSystem.geometry.attributes.position.array;
  const velocities = splashParticleSystem.geometry.attributes.velocity.array;
  const lifetimes = splashParticleSystem.geometry.attributes.lifetime.array;
  const sizes = splashParticleSystem.geometry.attributes.size.array;
  let particlesEmitted = 0;

  // Find inactive particles and activate them
  for (let i = 0; i < maxSplashParticles && particlesEmitted < particleCount; i++) {
    if (lifetimes[i] <= 0) {
      // Generate position on the ring
      const angle = Math.random() * Math.PI * 2;
      const r = radius + (Math.random() - 0.5) * 0.41; // Some variation in radius

      positions[i * 3] = centerX + Math.cos(angle) * r;
      positions[i * 3 + 1] = -0.489; // Water surface level
      positions[i * 3 + 2] = centerZ + Math.sin(angle) * r;

      // Generate upward and outward velocity
      const speed = 0.2 + Math.random() * 0.002;
      ;
      const upwardBias = 0.05 + Math.random() * 0.02;
      velocities[i * 3] = Math.cos(angle) * speed * (1 - upwardBias);
      velocities[i * 3 + 1] = speed * upwardBias * 0.008;
      velocities[i * 3 + 2] = Math.sin(angle) * speed * (1 - upwardBias);
      lifetimes[i] = 1.0;
      sizes[i] = 1.5;
      particlesEmitted++;
    }
  }

  // Mark attributes as needing update
  splashParticleSystem.geometry.attributes.position.needsUpdate = true;
  splashParticleSystem.geometry.attributes.velocity.needsUpdate = true;
  splashParticleSystem.geometry.attributes.lifetime.needsUpdate = true;
  splashParticleSystem.geometry.attributes.size.needsUpdate = true;
}
function updateSplashParticles(deltaTime) {
  const positions = splashParticleSystem.geometry.attributes.position.array;
  const velocities = splashParticleSystem.geometry.attributes.velocity.array;
  const lifetimes = splashParticleSystem.geometry.attributes.lifetime.array;
  for (let i = 0; i < maxSplashParticles; i++) {
    if (lifetimes[i] > 0) {
      // Update position
      positions[i * 3] += velocities[i * 3] * deltaTime;
      positions[i * 3 + 1] += velocities[i * 3 + 1] * deltaTime;
      positions[i * 3 + 2] += velocities[i * 3 + 2] * deltaTime;

      // Apply gravity
      velocities[i * 3 + 1] -= gravity * deltaTime * 0.5;

      // Apply air resistance
      velocities[i * 3] *= 0.98;
      velocities[i * 3 + 1] *= 0.98;
      velocities[i * 3 + 2] *= 0.98;

      // Update lifetime
      lifetimes[i] -= deltaTime * 2.0; // Particles live for ~0.5 seconds

      // Hide particle if it falls below water
      if (positions[i * 3 + 1] < -0.5) {
        lifetimes[i] = 0;
      }
    }
  }

  // Mark attributes as needing update
  splashParticleSystem.geometry.attributes.position.needsUpdate = true;
  splashParticleSystem.geometry.attributes.velocity.needsUpdate = true;
  splashParticleSystem.geometry.attributes.lifetime.needsUpdate = true;
}
// --- END NEW ---

// Add loading state management

// Asset loading tracker
const assetsToLoad = {
  fountainModel: false,
  cloudTexture: false,
  alphaMask: false,
  envMap: false
};
function checkAllAssetsLoaded() {
  const loadedAssets = Object.entries(assetsToLoad).filter(([key, value]) => value === true);
  const totalAssets = Object.keys(assetsToLoad).length;
  console.log(`[Fountain] Assets loaded: ${loadedAssets.length}/${totalAssets}`, assetsToLoad);
  const allLoaded = Object.values(assetsToLoad).every(loaded => loaded === true);
  if (allLoaded && !hasCheckedModelLoading) {
    console.log('[Fountain] ✅ All assets loaded successfully, hiding loader and sending ready signal');
    hideLoader();
    hasCheckedModelLoading = true;
    // Start cinematic camera animation
    startCinematicIntro();
  }
  return allLoaded;
}
function startCinematicIntro() {
  console.log('[Fountain] Starting cinematic camera intro');

  // Initial camera position (far and high, looking down at fountain)
  camera.position.set(6, 8, 10);
  camera.lookAt(0, 0, 0);

  // Target positions for the camera animation (matching the default setup)
  const startPos = {
    x: 6,
    y: 6,
    z: 18
  };
  const endPos = {
    x: 0,
    y: 0,
    z: 4
  }; // Default camera position
  const startLookAt = {
    x: 0,
    y: 3,
    z: 0
  };
  const endLookAt = {
    x: 0,
    y: 0,
    z: 0
  }; // Default look-at target

  // Animation duration in milliseconds
  const duration = 6000;
  const startTime = Date.now();
  function animateCamera() {
    const elapsed = Date.now() - startTime;
    const progress = Math.min(elapsed / duration, 1);

    // Use easeInOutCubic for smooth acceleration/deceleration
    const eased = progress < 0.5 ? 4 * progress * progress * progress : 1 - Math.pow(-2 * progress + 2, 3) / 2;

    // Interpolate camera position
    camera.position.x = startPos.x + (endPos.x - startPos.x) * eased;
    camera.position.y = startPos.y + (endPos.y - startPos.y) * eased;
    camera.position.z = startPos.z + (endPos.z - startPos.z) * eased;

    // Interpolate look-at target
    const lookX = startLookAt.x + (endLookAt.x - startLookAt.x) * eased;
    const lookY = startLookAt.y + (endLookAt.y - startLookAt.y) * eased;
    const lookZ = startLookAt.z + (endLookAt.z - startLookAt.z) * eased;
    camera.lookAt(lookX, lookY, lookZ);

    // Update controls target to match
    controls.target.set(lookX, lookY, lookZ);
    if (progress < 1) {
      requestAnimationFrame(animateCamera);
    } else {
      // Animation complete, enable controls
      console.log('[Fountain] Cinematic intro complete, enabling controls');
      controls.enabled = true;
      controls.update();
    }
  }
  animateCamera();
}

// Function to update loading progress
function updateLoadingProgress(progress) {
  loadingProgress = progress;
  // Update the loader if needed
  const loader = document.getElementById('magic8BallLoader');
  if (loader) {
    loader.setAttribute('data-progress', progress);
  }
}

// Function to hide loader
function hideLoader() {
  const loaderContainer = document.getElementById('loaderContainer');
  if (loaderContainer) {
    loaderContainer.classList.add('hidden');
    setTimeout(() => {
      loaderContainer.style.display = 'none';
    }, 500);
  }

  // Notify parent window that fountain is fully loaded
  if (window.parent !== window) {
    window.parent.postMessage({
      type: 'fountainReady'
    }, '*');
    console.log('[Fountain] Sent fountainReady message to parent');
  }
}
init();

// Cleanup function for memory management
function cleanup() {
  console.log('Cleaning up fountain resources...');

  // Stop animation
  if (renderer) {
    renderer.setAnimationLoop(null);
  }

  // Dispose of GPU compute resources
  if (gpuCompute) {
    gpuCompute.dispose();
  }

  // Dispose of geometries and materials
  if (scene) {
    scene.traverse(child => {
      if (child.geometry) {
        child.geometry.dispose();
      }
      if (child.material) {
        if (Array.isArray(child.material)) {
          child.material.forEach(material => material.dispose());
        } else {
          child.material.dispose();
        }
      }
    });
  }

  // Dispose of renderer
  if (renderer) {
    renderer.dispose();
  }

  // Clear intervals
  clearInterval(updateCompactStats);
}

// Add cleanup on page unload
window.addEventListener('beforeunload', cleanup);
window.addEventListener('pagehide', cleanup);

// Function to update button text
function updateButtonText(buttonMesh, newText, bgColorOverride = null, textColorOverride = null) {
  if (!buttonMesh) return;

  // Store current text in userData
  buttonMesh.userData.currentText = newText;

  // Get the original button properties
  const position = buttonMesh.position.clone();
  const isLocalCoin = buttonMesh.userData.isLocalCoin;

  // Determine button size based on screen
  const isMobile = window.innerWidth <= 768;
  const buttonWidth = isMobile ? 0.35 : 0.35; // Increased desktop width from 0.25 to 0.35
  const buttonHeight = isMobile ? 0.12 : 0.12; // Increased desktop height from 0.084 to 0.12

  // Use override colors if provided, otherwise use original colors
  let bgColor, textColor, fontSize;
  if (isLocalCoin) {
    bgColor = bgColorOverride || '#30cfd0';
    textColor = textColorOverride || 'black';
    fontSize = isMobile ? 48 : 56; // Increased desktop font from 42 to 56
  } else {
    bgColor = bgColorOverride || '#ffa100';
    textColor = textColorOverride || 'black';
    fontSize = isMobile ? 42 : 48; // Increased desktop font from 36 to 48
  }

  // Remove old button
  scene.remove(buttonMesh);

  // Create new button with updated text and colors
  const newButton = createButtonMesh(newText, position, {
    width: buttonWidth,
    height: buttonHeight
  }, fontSize, bgColor, textColor);
  newButton.userData.isTossButton = true;
  newButton.userData.isLocalCoin = isLocalCoin;
  newButton.userData.currentText = newText;

  // Update the correct reference
  if (isLocalCoin) {
    localCoinButton3D = newButton;
  } else {
    tossCoinButton3D = newButton;
  }
  scene.add(newButton);
}

// Track if modal is being shown to prevent immediate close
let modalJustOpened = false;

// Charity Modal Functions
function showAimReminderModal() {
  // Create a simple reminder popup
  const existingReminder = document.getElementById('aimReminder');
  if (existingReminder) {
    existingReminder.remove();
  }
  const reminder = document.createElement('div');
  reminder.id = 'aimReminder';
  reminder.className = 'pumpkin-modal';
  reminder.style.cssText = `
					position: fixed;
					top: 50%;
					left: 50%;
					transform: translate(-50%, -50%);
					z-index: 10001;
					max-width: 90vw;
					width: min(400px, 90vw);
					animation: fadeIn 0.3s ease-out;
				`;
  reminder.innerHTML = `
					<h3>⚠️ Aim First! ⚠️</h3>
					<p>Please click on the water to aim where you want to toss your coin!</p>
					<button onclick="document.getElementById('aimReminder').remove()" class="pumpkin-modal-button">
						Got it!
					</button>
				`;
  document.body.appendChild(reminder);

  // Auto-remove after 3 seconds
  setTimeout(() => {
    if (document.getElementById('aimReminder')) {
      document.getElementById('aimReminder').remove();
    }
  }, 3000);
}
function showCharityModal() {
  const modal = document.getElementById('charityModal');
  modal.style.display = 'block';
  document.body.classList.add('modal-open');
  modalJustOpened = true;

  // Tell parent window to hide UI elements
  if (window.parent !== window) {
    window.parent.postMessage({
      type: 'hideUIElements'
    }, '*');
  }

  // Prevent immediate close on mobile
  setTimeout(() => {
    modalJustOpened = false;
  }, 300);
}
function hideCharityModal() {
  if (modalJustOpened) return; // Prevent immediate close
  const modal = document.getElementById('charityModal');
  modal.style.display = 'none';
  document.body.classList.remove('modal-open');

  // Tell parent window to show UI elements again
  if (window.parent !== window) {
    window.parent.postMessage({
      type: 'showUIElements'
    }, '*');
  }

  // Don't clear selectedCharity here - keep it for the next coin toss
  pendingCoinToss = null;
}
function setupCharityModalListeners() {
  const modal = document.getElementById('charityModal');
  const charityButtons = modal.querySelectorAll('.charity-button');
  const cancelButton = modal.querySelector('.modal-cancel');

  // Handle charity selection with both click and touch events
  charityButtons.forEach(button => {
    const handleSelection = e => {
      e.preventDefault();
      e.stopPropagation();
      selectedCharity = e.currentTarget.getAttribute('data-charity');
      const charityName = e.currentTarget.textContent.trim();
      console.log('Charity selected:', selectedCharity);

      // Update button text to show selected charity
      if (tossCoinButton3D) {
        updateButtonText(tossCoinButton3D, `Toss Coin for\n${charityName}`);
      }

      // Small delay before hiding to ensure touch event completes
      setTimeout(() => {
        hideCharityModal();
      }, 100);
    };
    button.addEventListener('click', handleSelection);
    button.addEventListener('touchend', handleSelection);
  });

  // Handle cancel with both click and touch events
  const handleCancel = e => {
    e.preventDefault();
    e.stopPropagation();
    selectedCharity = null; // Clear selection on cancel
    setTimeout(() => {
      hideCharityModal();
    }, 100);
  };
  cancelButton.addEventListener('click', handleCancel);
  cancelButton.addEventListener('touchend', handleCancel);

  // Close modal when clicking outside
  const handleBackdropClick = e => {
    if (e.target === modal && !modalJustOpened) {
      selectedCharity = null; // Clear selection when clicking outside
      hideCharityModal();
    }
  };
  modal.addEventListener('click', handleBackdropClick);
  modal.addEventListener('touchend', handleBackdropClick);

  // Prevent modal content from closing modal on touch
  const modalContent = modal.querySelector('.charity-modal-content');
  modalContent.addEventListener('click', e => e.stopPropagation());
  modalContent.addEventListener('touchend', e => e.stopPropagation());
}

// Set up mobile button event handlers
function setupMobileButtons() {
  const localCoinBtnMobile = document.getElementById('localCoinBtnMobile');
  const realCoinBtnMobile = document.getElementById('realCoinBtnMobile');

  // Handle Local Coin Button Click (Mobile)
  if (localCoinBtnMobile) {
    localCoinBtnMobile.addEventListener('click', function (e) {
      // Add ripple effect
      this.classList.add('clicked');
      setTimeout(() => this.classList.remove('clicked'), 600);
      console.log('[Mobile Button] Local Coin Button clicked!');

      // Check if user has aimed first
      if (window.hasAimed && !window.hasAimed()) {
        if (window.showAimReminderModal) window.showAimReminderModal();
        return;
      }

      // Toss local coin immediately
      if (window.triggerCoinToss) window.triggerCoinToss(true);
    });
  }

  // Handle Real Coin Button Click (Mobile)
  if (realCoinBtnMobile) {
    realCoinBtnMobile.addEventListener('click', function (e) {
      // Add ripple effect
      this.classList.add('clicked');
      setTimeout(() => this.classList.remove('clicked'), 600);
      console.log('[Mobile Button] Real Coin Button clicked!');

      // Check if user has aimed first
      if (window.hasAimed && !window.hasAimed()) {
        if (window.showAimReminderModal) window.showAimReminderModal();
        return;
      }

      // Check if charity is already selected
      const currentSelectedCharity = window.getSelectedCharity ? window.getSelectedCharity() : null;
      if (currentSelectedCharity) {
        // Charity selected - toss the coin
        console.log(`Tossing coin for charity: ${currentSelectedCharity}`);
        if (window.triggerCoinToss) window.triggerCoinToss(false);

        // Reset button text after toss
        setTimeout(() => {
          if (window.setSelectedCharity) window.setSelectedCharity(null);
          this.innerHTML = '<span class="btn-icon" style="margin-right: 8px; font-size: 18px;">💰</span><span class="btn-text mobile-text">Donate</span><span class="ripple"></span>';
        }, 100);
      } else {
        // Show charity selection modal
        if (window.showCharityModal) window.showCharityModal();
      }
    });
  }
}

// Set up HTML button event handlers
function setupHTMLButtons() {
  const localCoinBtn = document.getElementById('localCoinBtn');
  const realCoinBtn = document.getElementById('realCoinBtn');

  // Handle Local Coin Button Click
  if (localCoinBtn) {
    localCoinBtn.addEventListener('click', function (e) {
      // Add ripple effect
      this.classList.add('clicked');
      setTimeout(() => this.classList.remove('clicked'), 600);
      console.log('[HTML Button] Local Coin Button clicked!');

      // Check if user has aimed first
      if (!hasAimed) {
        showAimReminderModal();
        return;
      }

      // Toss local coin immediately
      triggerCoinToss(true);
    });
  }

  // Handle Real Coin Button Click
  if (realCoinBtn) {
    realCoinBtn.addEventListener('click', function (e) {
      // Add ripple effect
      this.classList.add('clicked');
      setTimeout(() => this.classList.remove('clicked'), 600);
      console.log('[HTML Button] Real Coin Button clicked!');

      // Check if user has aimed first
      if (!hasAimed) {
        showAimReminderModal();
        return;
      }

      // Check if charity is already selected
      if (selectedCharity) {
        // Charity selected - toss the coin
        console.log(`Tossing coin for charity: ${selectedCharity}`);
        triggerCoinToss(false);

        // Reset button text after toss
        setTimeout(() => {
          selectedCharity = null;
          this.innerHTML = '<span class="btn-icon" style="margin-right: 8px; font-size: 18px;">💰</span>Connect Wallet & Donate<span class="ripple"></span>';
        }, 100);
      } else {
        // No charity selected - show modal
        showCharityModal();
      }
    });
  }

  // Listen for 80s mode changes from parent
  window.addEventListener('message', function (event) {
    if (event.data) {
      // Support both message formats
      if (event.data.type === 'toggle80sMode') {
        document.body.classList.toggle('mode-80s', event.data.enabled);
      } else if (event.data.type === '80sMode') {
        document.body.classList.toggle('mode-80s', event.data.value);
      }
    }
  });
}
async function init() {
  container = document.createElement('div');
  document.body.appendChild(container);

  // Set up HTML button click handlers
  setupHTMLButtons();

  // Check for 80s mode in URL parameters
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('80s') === 'true') {
    is80sMode = true;
  }
  camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.set(0, 0, 5);
  camera.lookAt(0, 0, 0);
  scene = new THREE.Scene();

  // Initialize Firebase after scene is created
  initializeFirebase();

  // Create Venice sunset directional light
  sun = new THREE.DirectionalLight(0xff8c42, 3.5); // Warm sunset orange color
  sun.position.set(-8, 3, -1); // Low on horizon for sunset effect
  sun.castShadow = true;
  scene.add(sun);
  renderer = new THREE.WebGLRenderer({
    antialias: !isMobileDevice,
    // Disable antialiasing on mobile
    powerPreference: "high-performance",
    stencil: false,
    depth: true
  });
  // Limit pixel ratio on mobile to reduce memory usage
  const pixelRatio = isMobileDevice ? Math.min(window.devicePixelRatio, 1.5) : window.devicePixelRatio;
  renderer.setPixelRatio(pixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.5;
  container.appendChild(renderer.domElement);

  // Post-processing will be setup after shaders are defined

  controls = new OrbitControls(camera, container);
  controls.minDistance = 0.1;
  controls.maxDistance = 6;
  controls.zoomToCursor = true;
  controls.minPolarAngle = 0;
  controls.maxPolarAngle = Math.PI / 2;

  // Disable controls initially for cinematic intro
  controls.enabled = false;

  // stats = new Stats();
  // container.appendChild( stats.dom );

  container.style.touchAction = 'none';
  container.addEventListener('pointermove', onPointerMove);
  container.addEventListener('pointerdown', onPointerDown);
  container.addEventListener('pointerup', onPointerUp);
  window.addEventListener('resize', onWindowResize);
  window.addEventListener('keydown', onKeyDown);

  // Handle WebGL context loss (important for mobile stability)
  renderer.domElement.addEventListener('webglcontextlost', function (event) {
    event.preventDefault();
    console.log('WebGL context lost - attempting recovery');
    cancelAnimationFrame(animationId);
  }, false);
  renderer.domElement.addEventListener('webglcontextrestored', function () {
    console.log('WebGL context restored');
    init(); // Reinitialize the scene
  }, false);

  // Setup charity modal listeners
  setupCharityModalListeners();
  const rgbeLoader = new RGBELoader().setPath('./');

  // --- NEW: Add Button Listener ---
  const tossCoinButton = document.getElementById('tossCoinButton');
  if (tossCoinButton) {
    tossCoinButton.addEventListener('pointerdown', event => {
      event.stopPropagation(); // Prevent triggering water disturbance
      triggerCoinToss();
    });
  }
  // --- END NEW ---

  const env = await rgbeLoader.loadAsync('venice_sunset_1k.hdr').then(texture => {
    console.log('[Fountain] Venice sunset environment map loaded');
    assetsToLoad.envMap = true;
    checkAllAssetsLoaded();
    return texture;
  }, error => {
    console.warn('[Fountain] Venice sunset HDR not found, falling back to sunrise:', error);
    // Fallback to the original sunrise HDR
    return rgbeLoader.loadAsync('blouberg_sunrise_2_1k.hdr').then(texture => {
      console.log('[Fountain] Fallback environment map loaded');
      assetsToLoad.envMap = true;
      checkAllAssetsLoaded();
      return texture;
    }, fallbackError => {
      console.error('[Fountain] Error loading fallback environment map:', fallbackError);
      assetsToLoad.envMap = true; // Mark as loaded anyway to not block
      checkAllAssetsLoaded();
      throw fallbackError;
    });
  });
  env.mapping = THREE.EquirectangularReflectionMapping;
  scene.environment = env; // Keep HDR for reflections
  // scene.environmentIntensity = 1.15; // Slightly reduced for better balance with new background

  // Create sublime dawn gradient background - completely new implementation
  // Create a simple gradient using a large mesh with gradient texture
  const gradientCanvas = document.createElement('canvas');
  gradientCanvas.width = 2;
  gradientCanvas.height = 512;
  const context = gradientCanvas.getContext('2d');

  // Create gradient - TOP to BOTTOM
  const gradient = context.createLinearGradient(0, 0, 0, 512);
  gradient.addColorStop(0.0, '#0000ff'); // Blue at top
  gradient.addColorStop(0.3, '#030c4d'); // Deep blue
  gradient.addColorStop(0.5, '#f25c54'); // Bright orange-red in middle
  gradient.addColorStop(1.0, '#ffeadb'); // Light peach at bottom

  // Fill gradient
  context.fillStyle = gradient;
  context.fillRect(0, 0, 2, 512);

  // Create texture
  const gradientTexture = new THREE.CanvasTexture(gradientCanvas);
  gradientTexture.needsUpdate = true;

  // Create a large background sphere with inside-out faces
  const skyGeo = new THREE.SphereGeometry(400, 32, 32);
  const skyMat = new THREE.MeshBasicMaterial({
    map: gradientTexture,
    side: THREE.BackSide,
    depthWrite: false
  });

  // Add the sky sphere
  const sky = new THREE.Mesh(skyGeo, skyMat);
  originalSky = sky; // Store reference for 80s mode toggling
  scene.add(sky);

  // Configure shadow mapping for sunset lighting
  sun.shadow.mapSize.width = isMobileDevice ? 512 : 1024;
  sun.shadow.mapSize.height = isMobileDevice ? 512 : 1024;
  sun.shadow.camera.near = 0.5;
  sun.shadow.camera.far = 50;
  sun.shadow.camera.left = -10;
  sun.shadow.camera.right = 10;
  sun.shadow.camera.top = 10;
  sun.shadow.camera.bottom = -10;

  // --- NEW: Initialize Splash Particle System ---
  initSplashParticleSystem();
  // --- END NEW ---

  // --- NEW: Load Fountain GLB ---
  const loader = new GLTFLoader();

  // Set up DRACO decoder
  const dracoLoader = new DRACOLoader();
  dracoLoader.setDecoderPath('/draco/'); // Path to DRACO decoder files
  loader.setDRACOLoader(dracoLoader);
  console.log('[Fountain] Starting to load model: /models/fountain2.glb with DRACO compression');

  // Add timeout for model loading
  let modelLoadTimeout = setTimeout(() => {
    console.warn('[Fountain] Model load timeout after 30 seconds, proceeding without model');
    assetsToLoad.fountainModel = true;
    checkAllAssetsLoaded();
  }, 30000); // 30 second timeout

  loader.load(
  // Resource URL - REPLACE WITH YOUR FILE PATH
  '/models/fountain2.glb',
  // Called when the resource is loaded
  function (gltf) {
    clearTimeout(modelLoadTimeout);
    const fountainModel = gltf.scene;
    const fallRadius = 0.32; // Match the inner radius of the SDF's roundCyl
    const fallHeight = 0.94; // Match the height from the SDF (bowl bottom to top water level approx)
    const fallSegments = 64; // Resolution

    // console.log("Searching for GoldCoin in model...");

    // Log the full model structure to see all available objects
    // console.log("Full model structure:", gltf.scene);

    fountainModel.traverse(function (node) {
      // Log all nodes to help identify object names
      if (node.name) {
        console.log("Found node:", node.name, node.type, node.material ? "has material" : "no material");
      }

      // Check for Neon objects
      if (node.name && node.name.startsWith('Neon')) {
        console.log("Found Neon object:", node.name);
        neonObjects.push(node);
        // Set visibility based on current 80s mode state
        node.visible = is80sMode;
      }

      // Hide Raybans by default (only show in 80s mode)
      if (node.name === 'Raybans') {
        console.log("Found Raybans object:", node.name);
        node.visible = is80sMode; // Only visible if already in 80s mode
      }

      // Force GoldCoin objects to match dynamic coin appearance in normal mode
      if (node.name && (node.name.includes('GoldCoin') || node.name.startsWith('GoldCoin'))) {
        console.log(`Found gold object: ${node.name}`);
        if (node.material && !is80sMode) {
          node.material.color = new THREE.Color(0xcebb43);
          node.material.emissive = new THREE.Color(0x000000);
          node.material.emissiveIntensity = 0;
          node.material.metalness = 0.0;
          node.material.roughness = 1.0;
          node.material.ior = 1.5;
        }
      }

      // Look for GoldCoin by name (case insensitive to be safe)
      if (node.name.toLowerCase().includes("coin") || node.name.toLowerCase().includes("gold")) {
        // console.log("FOUND POTENTIAL COIN OBJECT:", node.name);
        // console.log("Position:", node.position);
        // console.log("Rotation:", node.rotation);
        // console.log("Scale:", node.scale);
        // console.log("Visible:", node.visible);
        // console.log("Full details:", node);

        // Store a reference
        goldCoin = node;

        // Optional: Highlight the coin by changing material
        if (node.isMesh) {
          // Keep original material to restore later
          node.userData.originalMaterial = node.material;

          // Apply a glowing material to make it obvious
          node.material = new THREE.MeshBasicMaterial({
            // color: 0xff00ff, // Bright magenta to stand out
            // emissive: 0xff00ff,
            // emissiveIntensity: 1
          });
        }
      }

      // Make each part of the fountain model available for raycasting
      if (node.isMesh) {
        node.userData.isFountainPart = true;
      }
    });

    // Store model reference for collision detection
    window.fountainModel = fountainModel;
    const fallingWaterGeometry = new THREE.CylinderGeometry(fallRadius, fallRadius, fallHeight, fallSegments, 1, true); // Open ended cylinder
    // Position it: Center X/Z, Y position depends on where the water should start falling from
    // Example: If bowl bottom is at y=2.9, center the cylinder below it
    const bowlExitY = 0.4; // Adjusted to match new water level (-0.5 offset)
    fallingWaterGeometry.translate(0.052, bowlExitY - fallHeight / 2, -0.01); // Center it vertically

    const fallingWaterMaterial = new THREE.ShaderMaterial({
      uniforms: fallingWaterUniforms,
      // Use the uniforms we defined earlier
      vertexShader: fallingWaterVertexShader,
      fragmentShader: fallingWaterFragmentShader,
      transparent: true,
      // Needed for alpha
      side: THREE.DoubleSide // Render inside and outside

      // depthWrite: false // Sometimes needed for transparency sorting issues
    });
    const fallingWaterMesh = new THREE.Mesh(fallingWaterGeometry, fallingWaterMaterial);
    // Ensure it doesn't cast shadows itself, but might receive them
    fallingWaterMesh.castShadow = false;
    fallingWaterMesh.receiveShadow = true; // Or false if preferred

    scene.add(fallingWaterMesh);
    console.log("Falling water cylinder added.");

    // --- Adjust position, scale, rotation as needed ---
    // Center it roughly where the water is
    fountainModel.position.set(0, -0.5, 0); // Adjust Y if needed so base is at water level or slightly below

    // Scale the model to fit the water BOUNDS
    // You'll need to determine the original size of your model
    // and calculate the scale factor. Example assumes model's
    // inner diameter should match BOUNDS. Measure your model!
    const modelOriginalSize = 10; // EXAMPLE: Replace with your model's approximate diameter

    // fountainModel.scale.set(desiredScale, desiredScale, desiredScale); // Uniform scale
    // Or scale non-uniformly if needed:
    // Try different scales to debug visibility
    fountainModel.scale.set(0.8, 0.8, 0.8); // Changed from 0.8 to 1.0 for debugging

    // Rotate if necessary (e.g., if it loads sideways)
    // fountainModel.rotation.y = Math.PI / 8; // Example: Rotate slightly if needed

    // Enable shadows on all meshes within the loaded model
    let meshCount = 0;
    fountainModel.traverse(function (child) {
      if (child.isMesh) {
        meshCount++;
        child.castShadow = true;
        child.receiveShadow = true;
        // Make sure materials are visible
        if (child.material) {
          child.material.opacity = 1.0;
          child.material.transparent = false;
          // Log material info
          console.log(`Mesh ${meshCount}:`, child.name, 'Material type:', child.material.type);
        }
      }
    });
    console.log(`Total meshes found in model: ${meshCount}`);
    scene.add(fountainModel);
    console.log("Fountain model loaded and added.");
    console.log("Model position:", fountainModel.position);
    console.log("Model scale:", fountainModel.scale);
    console.log("Model visible:", fountainModel.visible);

    // Calculate bounding box to see actual size
    const box = new THREE.Box3().setFromObject(fountainModel);
    const size = box.getSize(new THREE.Vector3());
    console.log("Model bounding box size:", size);
    console.log("Model bounding box:", box);

    // Mark model as loaded
    fountainModelLoaded = true;
    assetsToLoad.fountainModel = true;
    checkAllAssetsLoaded();
  },
  // Called while loading is progressing
  function (xhr) {
    if (xhr.total > 0) {
      const percentLoaded = (xhr.loaded / xhr.total * 100).toFixed(1);
      console.log(`[Fountain] DRACO model loading: ${percentLoaded}% (${(xhr.loaded / 1024 / 1024).toFixed(2)}MB / ${(xhr.total / 1024 / 1024).toFixed(2)}MB)`);
    }
  },
  // Called when loading has errors
  function (error) {
    console.error('An error happened loading the fountain model:', error);
    // Still mark as loaded to prevent infinite wait
    assetsToLoad.fountainModel = true;
    checkAllAssetsLoaded();
  });
  // --- END NEW ---

  // Skip duck model loading
  // duckModel = null;

  // Comment out GUI code - remove control panel
  // const gui = new GUI();
  // gui.domElement.style.right = '0px';

  const valuesChanger = function () {
    heightmapVariable.material.uniforms['mouseSize'].value = effectController.mouseSize;
    heightmapVariable.material.uniforms['deep'].value = effectController.mouseDeep;
    heightmapVariable.material.uniforms['viscosity'].value = effectController.viscosity;
  };

  // --- NEW: Create 3D UI elements ---
  // const textContent = "Tap water to aim, tap button or press 'c' to toss coin";
  // instructionText3D = createTextSprite(textContent, new THREE.Vector3(0, 1.5, 0), 32, 'white', new THREE.Vector3(4, 2, 1)); // Adjust position/scale as needed
  // scene.add(instructionText3D);

  // Determine button sizes based on screen size
  const isMobile = window.innerWidth <= 768;
  const buttonWidth = isMobile ? 0.35 : 0.35; // Increased desktop width from 0.25 to 0.35
  const buttonHeight = isMobile ? 0.12 : 0.12; // Increased desktop height from 0.084 to 0.12
  // Increased desktop font from 42 to 56
  // Increased desktop font from 36 to 48

  // Increased desktop spacing from 0.18 to 0.25

  // Canvas buttons are now replaced with HTML overlay buttons
  // Commenting out the 3D button creation
  /*
  localCoinButton3D = createButtonMesh(
  	"Click to Toss Coin",
  	new THREE.Vector3(-buttonSpacing, -0.38, 1.4),
  	{width: buttonWidth, height: buttonHeight},
  	fontSize1,
  	'#30cfd0',
  	'black'
  );
  localCoinButton3D.userData.isLocalCoin = true;
  scene.add(localCoinButton3D);
  	tossCoinButton3D = createButtonMesh(
  	"Connect Wallet\n and Donate Token",
  	new THREE.Vector3(buttonSpacing, -0.38, 1.4),
  	{width: buttonWidth, height: buttonHeight},
  	fontSize2,
  	'#ffa100',
  	'black'
  );
  tossCoinButton3D.userData.isLocalCoin = false;
  scene.add(tossCoinButton3D);
  */
  // --- END NEW ---

  initWater();
  valuesChanger();
  renderer.setAnimationLoop(animate);
  updateLoadingProgress(100);
  isLoading = false;

  // Check if all assets are already loaded (in case they loaded synchronously or very quickly)
  console.log('[Fountain] Initial asset check:', assetsToLoad);
  checkAllAssetsLoaded();

  // Keep a reasonable fallback timer just in case
  setTimeout(() => {
    if (!hasCheckedModelLoading) {
      console.log('[Fountain] Fallback timer - checking assets:', assetsToLoad);
      // Force all assets as loaded if still waiting
      Object.keys(assetsToLoad).forEach(key => {
        if (!assetsToLoad[key]) {
          console.warn(`[Fountain] Asset ${key} not loaded, forcing as complete`);
          assetsToLoad[key] = true;
        }
      });
      checkAllAssetsLoaded();
    }
  }, 10000); // 10 seconds fallback

  // Add infinite ground with gradient fade
  const groundGeometry = new THREE.PlaneGeometry(500, 500, 50, 50);

  // Create custom shader material for gradient fade
  const groundMaterial = new THREE.ShaderMaterial({
    uniforms: {
      uColor1: {
        value: new THREE.Color(0xa79d7e)
      },
      // Near color (original sand color)
      uColor2: {
        value: new THREE.Color(0x9b8270)
      },
      // Mid color (slightly darker)
      uFogColor: {
        value: new THREE.Color(0xc8a08c)
      },
      // Far color (peachy to match sky horizon)
      uFadeStart: {
        value: 20.0
      },
      // Where fade begins
      uFadeEnd: {
        value: 120.0
      } // Where fade completes
    },
    vertexShader: `
						varying vec3 vWorldPosition;
						void main() {
							vec4 worldPosition = modelMatrix * vec4(position, 1.0);
							vWorldPosition = worldPosition.xyz;
							gl_Position = projectionMatrix * viewMatrix * worldPosition;
						}
					`,
    fragmentShader: `
						uniform vec3 uColor1;
						uniform vec3 uColor2;
						uniform vec3 uFogColor;
						uniform float uFadeStart;
						uniform float uFadeEnd;
						
						varying vec3 vWorldPosition;
						
						void main() {
							// Calculate distance from center
							float dist = length(vWorldPosition.xz);
							
							// Create smooth fade based on distance
							float fadeFactor = smoothstep(uFadeStart, uFadeEnd, dist);
							
							// Mix between near and far colors
							vec3 color = mix(uColor1, uColor2, fadeFactor * 0.5);
							color = mix(color, uFogColor, fadeFactor);
							
							// Add subtle noise for texture
							float noise = (fract(sin(dot(vWorldPosition.xz, vec2(12.9898, 78.233))) * 43758.5453) - 0.5) * 0.02;
							color += noise;
							
							// Apply very subtle transparency at edges
							float alpha = 1.0 - fadeFactor * 0.1; // Reduced from 0.3 to 0.1
							
							gl_FragColor = vec4(color, alpha);
						}
					`,
    transparent: true,
    side: THREE.DoubleSide
  });
  const groundMesh = new THREE.Mesh(groundGeometry, groundMaterial);
  groundMesh.rotation.x = -Math.PI / 2; // Rotate to lie flat
  groundMesh.position.y = -2; // Position below fountain
  groundMesh.receiveShadow = true;
  scene.add(groundMesh);

  // No fog - let the ground shader handle the horizon blend
  // The sky gradient should remain untouched

  // Add distant mountain range
  const mountainGeometry = new THREE.PlaneGeometry(600, 80, 200, 1);

  // Create mountain silhouette with custom shader
  const mountainMaterial = new THREE.ShaderMaterial({
    uniforms: {
      uColor1: {
        value: new THREE.Color(0x8b7d8c)
      },
      // Light purple-gray for distant mountains
      uColor2: {
        value: new THREE.Color(0x9b8595)
      },
      // Slightly warmer for variety
      uSkyBlend: {
        value: 0.7
      },
      // How much the mountains blend with sky
      uTime: {
        value: 0.0
      }
    },
    vertexShader: `
						varying vec2 vUv;
						varying float vElevation;
						uniform float uTime;
						
						// Simple noise function
						float random(vec2 st) {
							return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453);
						}
						
						void main() {
							vUv = uv;
							
							// Create mountain silhouette using sine waves and noise
							float elevation = 0.0;
							
							// Main mountain peaks
							elevation += sin(position.x * 0.05) * 15.0;
							elevation += sin(position.x * 0.02 + 1.0) * 25.0;
							elevation += sin(position.x * 0.08 - 2.0) * 10.0;
							
							// Add smaller variations
							elevation += sin(position.x * 0.15) * 5.0;
							elevation += sin(position.x * 0.3 + 3.0) * 2.0;
							
							// Add some noise for natural randomness
							elevation += random(vec2(position.x * 0.1, 0.0)) * 8.0;
							
							// Taper edges
							float edgeFade = smoothstep(0.0, 0.1, vUv.x) * smoothstep(1.0, 0.9, vUv.x);
							elevation *= edgeFade;
							
							vElevation = elevation;
							
							vec3 newPosition = position;
							newPosition.y += elevation;
							
							gl_Position = projectionMatrix * modelViewMatrix * vec4(newPosition, 1.0);
						}
					`,
    fragmentShader: `
						uniform vec3 uColor1;
						uniform vec3 uColor2;
						uniform float uSkyBlend;
						varying vec2 vUv;
						varying float vElevation;
						
						void main() {
							// Create gradient from bottom to top
							float gradient = vUv.y + (vElevation * 0.01);
							
							// Mix between two mountain colors for variety
							vec3 color = mix(uColor1, uColor2, gradient);
							
							// Fade out at the base to blend with ground
							float baseFade = smoothstep(0.0, 0.3, vUv.y);
							
							// Add atmospheric perspective (fade with distance)
							float distanceFade = 0.4 + (vUv.y * 0.3); // Mountains are naturally faded
							
							// Apply haze effect
							color = mix(color, vec3(0.95, 0.85, 0.95), uSkyBlend * (1.0 - baseFade));
							
							gl_FragColor = vec4(color, distanceFade * baseFade);
						}
					`,
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: false // Ensures mountains render behind other objects properly
  });
  const mountainMesh = new THREE.Mesh(mountainGeometry, mountainMaterial);
  mountainMesh.rotation.x = -Math.PI / 2;
  mountainMesh.position.set(0, -1, -150); // Far in the distance
  mountainMesh.scale.y = 1.1; // Stretch depth for perspective
  scene.add(mountainMesh);

  // Add a second layer of more distant mountains
  const distantMountainMesh = mountainMesh.clone();
  distantMountainMesh.material = mountainMaterial.clone();
  distantMountainMesh.material.uniforms.uColor1.value = new THREE.Color(0xa595a8); // Even lighter/hazier
  distantMountainMesh.material.uniforms.uSkyBlend.value = 0.85; // More sky blend
  distantMountainMesh.position.set(0, -2, -180); // Even farther
  distantMountainMesh.scale.set(1.2, 2, 0.8); // Wider and more stretched
  scene.add(distantMountainMesh);

  // Setup post-processing after shaders are defined
  setupPostProcessing();

  // Enable 80s mode if it was set via URL parameter
  if (is80sMode) {
    toggle80sMode(true);
  }
}
function initWater() {
  const geometry = new THREE.PlaneGeometry(BOUNDS, BOUNDS, WIDTH - 1, WIDTH - 1);

  // --- NEW: Load Alpha Mask Texture ---
  const textureLoader = new THREE.TextureLoader();
  // IMPORTANT: Replace 'path/to/your/fountain_mask.png' with the actual path
  const alphaMaskTexture = textureLoader.load('/octagon.png', texture => {
    console.log("Alpha mask loaded successfully.");
    assetsToLoad.alphaMask = true;
    checkAllAssetsLoaded();
    // Optional: Configure texture wrapping/filtering if needed
    // texture.wrapS = THREE.ClampToEdgeWrapping;
    // texture.wrapT = THREE.ClampToEdgeWrapping;
  }, undefined,
  // onProgress callback (optional)
  err => {
    console.error("Error loading alpha mask texture:", err);
    assetsToLoad.alphaMask = true; // Mark as loaded anyway to not block
    checkAllAssetsLoaded();
  });
  // --- END NEW ---

  // Generate a circular mask for the upper bowl water
  const circleCanvas = document.createElement('canvas');
  circleCanvas.width = 256;
  circleCanvas.height = 256;
  const circleContext = circleCanvas.getContext('2d');

  // Draw a white circle on black background
  circleContext.fillStyle = 'black';
  circleContext.fillRect(0, 0, 256, 256);
  circleContext.fillStyle = 'white';
  circleContext.beginPath();
  circleContext.arc(128, 128, 120, 0, Math.PI * 2);
  circleContext.fill();

  // Create the circle texture
  const circleTexture = new THREE.CanvasTexture(circleCanvas);
  circleTexture.needsUpdate = true;
  const material = new WaterMaterial({
    color: 0x9bd2ec,
    metalness: 0.9,
    roughness: 0,
    transparent: true,
    // Make sure transparency is enabled
    opacity: 0.8,
    // Make water more transparent
    alphaTest: 0.6,
    // Lower alphaTest value
    side: THREE.DoubleSide,
    depthTest: true,
    depthWrite: false,
    // Don't write to depth buffer
    // --- NEW: Apply Alpha Map ---
    alphaMap: alphaMaskTexture
    // --- END NEW ---
  });
  waterMesh = new THREE.Mesh(geometry, material);
  waterMesh.rotation.x = -Math.PI * 0.5;
  waterMesh.position.y = -0.5; // Lower the water mesh by 0.2 units
  waterMesh.matrixAutoUpdate = true; // Enable matrix auto-update
  waterMesh.updateMatrix();
  waterMesh.receiveShadow = true;
  waterMesh.castShadow = true;
  scene.add(waterMesh);

  // Create a second, smaller water mesh for the upper bowl
  const upperBowlSize = 0.6; // Smaller size for the upper bowl
  const upperBowlGeometry = new THREE.PlaneGeometry(upperBowlSize, upperBowlSize, WIDTH / 4 - 1, WIDTH / 4 - 1);

  // Create a duplicate of water material for upper bowl
  const upperWaterMaterial = new WaterMaterial({
    color: 0x9bd2ec,
    metalness: 0.9,
    roughness: 0,
    transparent: true,
    opacity: 0.8,
    alphaTest: 0.6,
    side: THREE.DoubleSide,
    depthTest: true,
    depthWrite: false,
    // Using a circle alpha mask for the upper bowl
    alphaMap: circleTexture
  });

  // Create and position the upper water mesh
  upperWaterMesh = new THREE.Mesh(upperBowlGeometry, upperWaterMaterial);
  upperWaterMesh.rotation.x = -Math.PI * 0.5;
  upperWaterMesh.position.set(0.05, 0.4, -0.01); // Position at the upper bowl
  upperWaterMesh.matrixAutoUpdate = true;
  upperWaterMesh.updateMatrix();
  upperWaterMesh.receiveShadow = true;
  upperWaterMesh.castShadow = true;
  scene.add(upperWaterMesh);

  // THREE.Mesh just for mouse raycasting
  const geometryRay = new THREE.PlaneGeometry(BOUNDS, BOUNDS, 1, 1);
  meshRay = new THREE.Mesh(geometryRay, new THREE.MeshBasicMaterial({
    color: 0xFFFFFF,
    visible: false
  }));
  meshRay.rotation.x = -Math.PI / 2;
  meshRay.position.y = -0.5; // Match the water mesh position
  meshRay.matrixAutoUpdate = true;
  meshRay.updateMatrix();
  scene.add(meshRay);

  // Ray mesh for upper bowl
  const upperGeometryRay = new THREE.PlaneGeometry(upperBowlSize, upperBowlSize, 1, 1);
  upperMeshRay = new THREE.Mesh(upperGeometryRay, new THREE.MeshBasicMaterial({
    color: 0xFFFFFF,
    visible: false
  }));
  upperMeshRay.rotation.x = -Math.PI / 2;
  upperMeshRay.position.copy(upperWaterMesh.position);
  upperMeshRay.matrixAutoUpdate = true;
  upperMeshRay.updateMatrix();
  upperMeshRay.userData.isUpperBowl = true; // Mark this as upper bowl for raycasting
  scene.add(upperMeshRay);

  // Creates the gpu computation class and sets it up

  gpuCompute = new GPUComputationRenderer(WIDTH, WIDTH, renderer);
  const heightmap0 = gpuCompute.createTexture();
  fillTexture(heightmap0);
  heightmapVariable = gpuCompute.addVariable('heightmap', shaderChange.heightmap_frag, heightmap0);
  gpuCompute.setVariableDependencies(heightmapVariable, [heightmapVariable]);
  heightmapVariable.material.uniforms['mousePos'] = {
    value: new THREE.Vector2(10000, 10000)
  };
  heightmapVariable.material.uniforms['mouseSize'] = {
    value: 0.2
  };
  heightmapVariable.material.uniforms['viscosity'] = {
    value: 0.93
  };
  heightmapVariable.material.uniforms['deep'] = {
    value: 0.01
  };
  heightmapVariable.material.uniforms['time'] = {
    value: 0.0
  };
  heightmapVariable.material.uniforms['fallingWaterCenter'] = {
    value: new THREE.Vector2(0.052, -0.01)
  };
  heightmapVariable.material.uniforms['fallingWaterSize'] = {
    value: 0.1
  };
  heightmapVariable.material.uniforms['fallingWaterDeep'] = {
    value: 0.001
  };
  heightmapVariable.material.defines.BOUNDS = BOUNDS.toFixed(1);
  const error = gpuCompute.init();
  if (error !== null) console.error(error);

  // Create compute shader to smooth the water surface and velocity
  smoothShader = gpuCompute.createShaderMaterial(document.getElementById('smoothFragmentShader').textContent, {
    smoothTexture: {
      value: null
    }
  });

  // Create compute shader to read water level
  readWaterLevelShader = gpuCompute.createShaderMaterial(document.getElementById('readWaterLevelFragmentShader').textContent, {
    point1: {
      value: new THREE.Vector2()
    },
    levelTexture: {
      value: null
    }
  });
  readWaterLevelShader.defines.WIDTH = WIDTH.toFixed(1);
  readWaterLevelShader.defines.BOUNDS = BOUNDS.toFixed(1);

  // Create a 4x1 pixel image and a render target (Uint8, 4 channels, 1 byte per channel) to read water height and orientation
  readWaterLevelImage = new Uint8Array(4 * 1 * 4);
  readWaterLevelRenderTarget = new THREE.WebGLRenderTarget(4, 1, {
    wrapS: THREE.ClampToEdgeWrapping,
    wrapT: THREE.ClampToEdgeWrapping,
    minFilter: THREE.NearestFilter,
    magFilter: THREE.NearestFilter,
    format: THREE.RGBAFormat,
    type: THREE.UnsignedByteType,
    depthBuffer: false
  });

  // Listen for 80s mode messages from parent
  window.addEventListener('message', event => {
    if (event.data.type === '80sMode') {
      toggle80sMode(event.data.value);
    }
  });
}

// Elements for 80s mode
let neonGrid, retroSun;
// Store original materials
let neonObjects = []; // Store references to Neon objects from the model

// Custom shader for chromatic aberration
const ChromaticAberrationShader = {
  uniforms: {
    'tDiffuse': {
      value: null
    },
    'amount': {
      value: 0.003
    }
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
					uniform float amount;
					varying vec2 vUv;
					void main() {
						vec2 offset = amount * vec2(1.0, 0.0);
						vec4 cr = texture2D(tDiffuse, vUv + offset);
						vec4 cg = texture2D(tDiffuse, vUv);
						vec4 cb = texture2D(tDiffuse, vUv - offset);
						gl_FragColor = vec4(cr.r, cg.g, cb.b, cg.a);
					}
				`
};

// Custom shader for scanlines
const ScanlineShader = {
  uniforms: {
    'tDiffuse': {
      value: null
    },
    'time': {
      value: 0.0
    },
    'opacity': {
      value: 0.3
    }
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
					uniform float opacity;
					varying vec2 vUv;
					void main() {
						vec4 color = texture2D(tDiffuse, vUv);
						float scanline = sin(vUv.y * 1200.0 + time * 10.0) * 0.025;
						color.rgb -= scanline * opacity;
						gl_FragColor = color;
					}
				`
};

// Custom shader for vignette
const VignetteShader = {
  uniforms: {
    'tDiffuse': {
      value: null
    },
    'offset': {
      value: 0.5
    },
    'darkness': {
      value: 0.5
    }
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
					uniform float offset;
					uniform float darkness;
					varying vec2 vUv;
					void main() {
						vec4 color = texture2D(tDiffuse, vUv);
						vec2 uv = (vUv - vec2(0.5)) * vec2(offset);
						float vignette = 1.0 - dot(uv, uv);
						color.rgb = mix(color.rgb * darkness, color.rgb, vignette);
						gl_FragColor = color;
					}
				`
};

// Custom shader for noise
const NoiseShader = {
  uniforms: {
    'tDiffuse': {
      value: null
    },
    'time': {
      value: 0.0
    },
    'amount': {
      value: 0.05
    }
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
					uniform float amount;
					varying vec2 vUv;
					
					float random(vec2 p) {
						return fract(sin(dot(p.xy, vec2(12.9898, 78.233))) * 43758.5453);
					}
					
					void main() {
						vec4 color = texture2D(tDiffuse, vUv);
						float noise = random(vUv + time) * amount;
						color.rgb += vec3(noise);
						gl_FragColor = color;
					}
				`
};
function setupPostProcessing() {
  if (!renderer || !scene || !camera) {
    console.error('Cannot setup post-processing: renderer, scene, or camera not initialized');
    return;
  }
  composer = new EffectComposer(renderer);
  const renderPass = new RenderPass(scene, camera);
  composer.addPass(renderPass);

  // Bloom pass (always active)
  const resolution = new THREE.Vector2(window.innerWidth, window.innerHeight);
  bloomPass = new UnrealBloomPass(resolution, 0.9,
  // strength
  0.4,
  // radius
  0.85 // threshold
  );
  composer.addPass(bloomPass);

  // Chromatic aberration (80s mode only)
  chromaticAberrationPass = new ShaderPass(ChromaticAberrationShader);
  chromaticAberrationPass.enabled = false;
  composer.addPass(chromaticAberrationPass);

  // Scanlines (80s mode only)
  scanlinePass = new ShaderPass(ScanlineShader);
  scanlinePass.enabled = false;
  composer.addPass(scanlinePass);

  // Noise (80s mode only)
  noisePass = new ShaderPass(NoiseShader);
  noisePass.enabled = false;
  composer.addPass(noisePass);

  // Vignette (80s mode only)
  vignettePass = new ShaderPass(VignetteShader);
  vignettePass.enabled = false;
  composer.addPass(vignettePass);

  // FXAA for antialiasing - temporarily disabled for debugging
  // fxaaPass = new ShaderPass(FXAAShader);
  // fxaaPass.uniforms['resolution'].value.set(1 / window.innerWidth, 1 / window.innerHeight);
  // composer.addPass(fxaaPass);
}
function updatePostProcessingFor80s(enabled) {
  if (!composer) return;
  if (enabled) {
    // 80s mode: moderate bloom, enable all effects
    bloomPass.strength = 0.9;
    bloomPass.radius = 0.4;
    bloomPass.threshold = 0.85;
    chromaticAberrationPass.enabled = true;
    chromaticAberrationPass.uniforms.amount.value = 0.005;
    scanlinePass.enabled = true;
    scanlinePass.uniforms.opacity.value = 0.15;
    noisePass.enabled = true;
    noisePass.uniforms.amount.value = 0.1;
    vignettePass.enabled = true;
    vignettePass.uniforms.darkness.value = 0.5;
  } else {
    // Normal mode: disable bloom entirely
    bloomPass.strength = 0.0;
    bloomPass.radius = 0.4;
    bloomPass.threshold = 1.2;
    chromaticAberrationPass.enabled = false;
    scanlinePass.enabled = false;
    noisePass.enabled = false;
    vignettePass.enabled = false;
  }
}
function toggle80sMode(enabled) {
  is80sMode = enabled;
  console.log('80s Mode:', enabled);
  if (enabled) {
    enable80sMode();
  } else {
    disable80sMode();
  }
}
function enable80sMode() {
  // Hide original sky
  // if (originalSky) originalSky.visible = false;

  // Create synthwave background
  // if (!synthwaveBackground) {
  // 	createSynthwaveBackground();
  // }
  // if (synthwaveBackground) synthwaveBackground.visible = true;

  // Create neon grid floor
  // if (!neonGrid) {
  // 	createNeonGrid();
  // }
  // if (neonGrid) neonGrid.visible = true;

  // Create retro sun
  // if (!retroSun) {
  // 	createRetroSun();
  // }
  // if (retroSun) retroSun.visible = true;

  // Show Neon objects from the model
  neonObjects.forEach(obj => {
    obj.visible = true;
  });

  // Make gold coins glow and show Raybans
  scene.traverse(child => {
    if (child.isMesh) {
      // Gold coin emissive glow
      if (child.name && (child.name.includes('GoldCoin') || child.name.startsWith('GoldCoin'))) {
        // Store original material properties before modifying
        if (!child.userData.originalEmissive) {
          child.userData.originalEmissive = child.material.emissive.clone();
          child.userData.originalEmissiveIntensity = child.material.emissiveIntensity;
        }
        child.material = child.material.clone();
        // Match the base color of dynamic coins
        child.material.color = new THREE.Color(0xcebb43);
        child.material.emissive = new THREE.Color('#FFEB38');
        child.material.emissiveIntensity = 1.0;
        child.userData.original80sEmissive = true;
      }

      // Show Raybans only in 80s mode
      if (child.name === 'Raybans') {
        child.visible = true;
        child.userData.raybansin80s = true;
      }
    }
  });

  // Modify water colors for neon effect
  updateWaterFor80s(true);

  // Update button colors
  updateButtonsFor80s(true);

  // Enable 80s post-processing effects
  updatePostProcessingFor80s(true);

  // Update existing dynamic coins with emissive glow
  coins.forEach(coin => {
    if (coin.material) {
      coin.material.emissive = new THREE.Color('#FFEB38');
      coin.material.emissiveIntensity = 0.3;
    }
  });

  // Update static coins from Firebase
  createStaticCoinInstances();

  // Keep original atmosphere (don't add fog)
  // scene.fog = new THREE.Fog(0x1a0033, 2, 20);
}
function disable80sMode() {
  // Keep original sky (don't change sky when leaving 80s mode)
  // if (originalSky) originalSky.visible = true;

  // Hide 80s elements
  // if (synthwaveBackground) synthwaveBackground.visible = false;
  // if (neonGrid) neonGrid.visible = false;
  // if (retroSun) retroSun.visible = false;

  // Restore original water colors
  updateWaterFor80s(false);

  // Restore button colors
  updateButtonsFor80s(false);

  // Disable 80s post-processing effects
  updatePostProcessingFor80s(false);

  // Remove emissive glow from existing dynamic coins
  coins.forEach(coin => {
    if (coin.material) {
      coin.material.emissive = new THREE.Color(0x000000);
      coin.material.emissiveIntensity = 0;
    }
  });

  // Update static coins from Firebase (remove glow)
  createStaticCoinInstances();

  // Clear fog - let the gradient sky show properly
  scene.fog = null;

  // Restore gold coins and hide Raybans
  scene.traverse(child => {
    if (child.isMesh) {
      // Remove gold coin emissive glow and standardize base color
      if (child.userData.original80sEmissive || child.name && (child.name.includes('GoldCoin') || child.name.startsWith('GoldCoin'))) {
        child.material.emissive = new THREE.Color(0x000000);
        child.material.emissiveIntensity = 0;
        // Match all properties of dynamic coins
        child.material.color = new THREE.Color(0xcebb43);
        child.material.metalness = 0.0;
        child.material.roughness = 1.0;
        child.material.ior = 1.5;
        child.userData.original80sEmissive = false;
      }

      // Hide Raybans in normal mode
      if (child.userData.raybansin80s) {
        child.visible = false;
        child.userData.raybansin80s = false;
      }
    }
  });

  // Hide Neon objects from the model
  neonObjects.forEach(obj => {
    obj.visible = false;
  });
}
function updateWaterFor80s(enabled) {
  if (waterMesh && waterMesh.material) {
    if (enabled) {
      // Neon cyan/pink water
      waterMesh.material.color = new THREE.Color(0x00ffff);
      waterMesh.material.emissive = new THREE.Color(0xff00ff);
      waterMesh.material.emissiveIntensity = 0.3;
    } else {
      // Original water colors
      waterMesh.material.color = new THREE.Color(0x4499bb);
      waterMesh.material.emissive = new THREE.Color(0x000000);
      waterMesh.material.emissiveIntensity = 0;
    }
  }
}
function updateButtonsFor80s(enabled) {
  // Update button colors for 80s neon look
  if (tossCoinButton3D) {
    if (enabled) {
      updateButtonText(tossCoinButton3D, tossCoinButton3D.userData.currentText || "Click to Connect Wallet\nand Toss Real Coin", '#ff00ff', '#00ffff');
    } else {
      updateButtonText(tossCoinButton3D, tossCoinButton3D.userData.currentText || "Click to Connect Wallet\nand Toss Real Coin", '#ffa100', 'black');
    }
  }
  if (localCoinButton3D) {
    if (enabled) {
      updateButtonText(localCoinButton3D, "Click to Toss Coin (free toss)", '#00ffff', '#ff00ff');
    } else {
      updateButtonText(localCoinButton3D, "Click to Toss Coin free toss", '#30cfd0', 'black');
    }
  }
}
function fillTexture(texture) {
  const waterMaxHeight = 0.1;
  function noise(x, y) {
    let multR = waterMaxHeight;
    let mult = 0.025;
    let r = 0;
    for (let i = 0; i < 15; i++) {
      r += multR * simplex.noise(x * mult, y * mult);
      multR *= 0.53 + 0.025 * i;
      mult *= 1.25;
    }
    return r;
  }
  const pixels = texture.image.data;
  let p = 0;
  for (let j = 0; j < WIDTH; j++) {
    for (let i = 0; i < WIDTH; i++) {
      const x = i * 128 / WIDTH;
      const y = j * 128 / WIDTH;
      pixels[p + 0] = noise(x, y);
      pixels[p + 1] = pixels[p + 0];
      pixels[p + 2] = 0;
      pixels[p + 3] = 1;
      p += 4;
    }
  }
}
function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}
function onPointerDown(event) {
  // Don't process 3D interactions if modal is open
  const modal = document.getElementById('charityModal');
  if (modal && modal.style.display === 'block') {
    return;
  }

  // --- Update mouseCoords here --- 
  const dom = renderer.domElement;
  const pointerX = event.clientX / dom.clientWidth * 2 - 1;
  const pointerY = -(event.clientY / dom.clientHeight) * 2 + 1;
  const currentPointerCoords = new THREE.Vector2(pointerX, pointerY); // Use temporary vector for this event

  console.log("[Pointer Down] Event Coords:", currentPointerCoords.x.toFixed(2), currentPointerCoords.y.toFixed(2));
  raycaster.setFromCamera(currentPointerCoords, camera);

  // --- Modified Raycasting Logic ---
  // Button clicks are now handled by HTML buttons, not raycasting
  // Commenting out the canvas button raycasting
  /*
  const buttonIntersects = raycaster.intersectObjects( [tossCoinButton3D, localCoinButton3D] );
  if (buttonIntersects.length > 0) {
  	const button = buttonIntersects[0].object;
  	if (button.userData.isTossButton) {
  		// Old canvas button logic removed
  	}
  }
  */

  // Only check for water interaction if button wasn't clicked
  let waterClicked = false;
  if (!buttonClicked) {
    const waterIntersects = raycaster.intersectObjects([meshRay, upperMeshRay]);
    if (waterIntersects.length > 0) {
      const firstHit = waterIntersects[0].object;
      if (firstHit === meshRay || firstHit === upperMeshRay) {
        console.log("[Pointer Down] Water interaction plane clicked.");
        // Update both mouseCoords (for water effect) and aimedCoords (for coin aiming)
        mouseCoords.copy(currentPointerCoords);
        aimedCoords.copy(currentPointerCoords); // Save aimed position for coin tosses
        hasAimed = true; // Mark that user has aimed
        console.log(`[Pointer Down] Updated global mouseCoords: (${mouseCoords.x.toFixed(2)}, ${mouseCoords.y.toFixed(2)})`);
        console.log(`[Pointer Down] Updated aimedCoords: (${aimedCoords.x.toFixed(2)}, ${aimedCoords.y.toFixed(2)})`);
        mousedown = true; // Enable water disturbance via raycast() function
        waterClicked = true;

        // Optional: Log hit point for debugging water interaction itself
        console.log("Water raycast successful on click at:", waterIntersects[0].point);
      }
    }
  }

  // Only disable controls if water was clicked to allow dragging
  if (waterClicked && controls.enabled) {
    controls.enabled = false;
  }
  // --- End Modified Logic ---
}
function onKeyDown(event) {
  if (event.key.toLowerCase() === 'c') {
    console.log("'c' key pressed - Tossing coin");
    triggerCoinToss(); // Use the refactored function
  }
}
function triggerCoinToss(isLocalCoin = false) {
  // Use the aimed coordinates (set when water was clicked) to determine target
  console.log(`[Coin Toss] Using aimedCoords: (${aimedCoords.x.toFixed(2)}, ${aimedCoords.y.toFixed(2)})`); // Log coords
  console.log(`[Coin Toss] Local coin: ${isLocalCoin}`);
  raycaster.setFromCamera(aimedCoords, camera);

  // Raycast towards the invisible water plane (meshRay)
  console.log(`[Coin Toss] Raycasting against meshRay at position: (${meshRay.position.x.toFixed(2)}, ${meshRay.position.y.toFixed(2)}, ${meshRay.position.z.toFixed(2)})`); // Log mesh position
  console.log(`[Coin Toss] Camera position: (${camera.position.x.toFixed(2)}, ${camera.position.y.toFixed(2)}, ${camera.position.z.toFixed(2)})`); // Log camera position

  const intersects = raycaster.intersectObject(meshRay);
  console.log(`[Coin Toss] Intersection results count: ${intersects.length}`); // Log intersections count

  if (intersects.length > 0) {
    const targetPoint = intersects[0].point; // Where the coin should land (approx)
    console.log(`[Coin Toss] Target point determined: (${targetPoint.x.toFixed(2)}, ${targetPoint.y.toFixed(2)}, ${targetPoint.z.toFixed(2)})`);

    // --- Calculate Starting Position & Velocity ---
    // Start slightly above and in front of the camera, aimed towards the target
    const startPosition = new THREE.Vector3();
    camera.getWorldPosition(startPosition); // Get camera's world position

    // Move start position slightly forward from camera towards target
    const directionToTarget = new THREE.Vector3().subVectors(targetPoint, startPosition).normalize();
    startPosition.addScaledVector(directionToTarget, 1.5); // Start 1.5 units in front of camera
    startPosition.y += 0.5; // Start slightly higher

    // Calculate initial velocity vector
    const initialVelocity = new THREE.Vector3();
    const throwSpeed = 1.7;
    const upwardAngle = 0.6;
    initialVelocity.subVectors(targetPoint, startPosition).normalize(); // Direction
    initialVelocity.multiplyScalar(throwSpeed * Math.cos(upwardAngle)); // Horizontal speed component
    initialVelocity.y = throwSpeed * Math.sin(upwardAngle); // Vertical speed component

    createCoin(startPosition, initialVelocity, isLocalCoin);
  } else {
    console.log("[Coin Toss] Cannot determine target point for coin toss.");
  }
}
function isWithinFountainWater(position) {
  // Get distance from center of fountain
  const centerX = 0;
  const centerZ = 0;
  const distanceFromCenter = Math.sqrt(Math.pow(position.x - centerX, 2) + Math.pow(position.z - centerZ, 2));
  const fountainWaterRadius = 1.15;

  // Return true if position is within the circular boundary
  return distanceFromCenter < fountainWaterRadius;
}
function createCoin(startPosition, initialVelocity, isLocalCoin = false) {
  const coinMaterialInstance = baseCoinMaterial.clone();

  // Apply 80s mode emissive glow if in 80s mode
  if (is80sMode) {
    coinMaterialInstance.emissive = new THREE.Color('#FFEB38');
    coinMaterialInstance.emissiveIntensity = 0.3;
  }
  const coin = new THREE.Mesh(coinGeometry, coinMaterialInstance);
  coin.position.copy(startPosition);
  coin.userData.velocity = initialVelocity.clone();
  coin.userData.rotationAxis = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize();
  coin.userData.rotationSpeed = (Math.random() * 0.1 + 0.05) * (Math.random() < 0.5 ? 1 : -1);
  coin.userData.underwater = false;
  coin.userData.stopped = false;
  coin.userData.isLocalCoin = isLocalCoin; // Mark if this is a local-only coin
  coin.userData.charity = isLocalCoin ? null : selectedCharity; // Store selected charity for real coins
  coin.renderOrder = 99; // Extremely high render order to ensure it renders last
  scene.add(coin);
  coins.push(coin);
  console.log(`${isLocalCoin ? 'Local' : 'Real'} coin created at`, startPosition.x.toFixed(2), startPosition.y.toFixed(2), startPosition.z.toFixed(2), "with velocity", initialVelocity.x.toFixed(2), initialVelocity.y.toFixed(2), initialVelocity.z.toFixed(2));
  if (!isLocalCoin && selectedCharity) {
    console.log(`Coin will support: ${selectedCharity}`);
  }
}

// Make functions globally accessible for mobile buttons
window.triggerCoinToss = triggerCoinToss;
window.hasAimed = () => hasAimed;
window.setHasAimed = value => {
  hasAimed = value;
};
window.showAimReminderModal = showAimReminderModal;
window.showCharityModal = showCharityModal;
window.getSelectedCharity = () => selectedCharity;
window.setSelectedCharity = charity => {
  selectedCharity = charity;
};

// Now that global functions are set up, initialize mobile buttons if they exist
setTimeout(() => {
  setupMobileButtons();
}, 100);
function onPointerUp() {
  mousedown = false;
  controls.enabled = true;
}
function onPointerMove(event) {
  const dom = renderer.domElement;
  // Update mouseCoords continuously for water interaction aiming and visual effect
  mouseCoords.set(event.clientX / dom.clientWidth * 2 - 1, -(event.clientY / dom.clientHeight) * 2 + 1);
  // We don't need to raycast here unless we want hover effects on the button
}
function raycast() {
  // Set uniforms: mouse interaction
  const uniforms = heightmapVariable.material.uniforms;
  if (mousedown) {
    raycaster.setFromCamera(mouseCoords, camera);

    // Check for both water meshes
    const allWaterObjects = [meshRay, upperMeshRay];
    const intersects = raycaster.intersectObjects(allWaterObjects);
    if (intersects.length > 0) {
      // Record which mesh was hit
      const hitObject = intersects[0].object;
      const point = intersects[0].point;
      if (hitObject === meshRay) {
        // Main water - convert to normalized position relative to water bounds
        // BOUNDS is the water size (e.g. 2.7)
        // Water is centered at origin in XZ, so point ranges from -BOUNDS/2 to +BOUNDS/2
        // Convert to 0-1 range for the heightmap
        const waterX = (point.x + BOUNDS_HALF) / BOUNDS;
        const waterZ = (point.z + BOUNDS_HALF) / BOUNDS;

        // Convert 0-1 range back to world space for the shader
        const coordX = (waterX - 0.5) * BOUNDS;
        const coordZ = (waterZ - 0.5) * BOUNDS;
        uniforms['mousePos'].value.set(coordX, coordZ);
      } else if (hitObject === upperMeshRay) {
        // Upper bowl - just use world position for now
        uniforms['mousePos'].value.set(point.x, point.z);
      }
      if (controls.enabled) controls.enabled = false;
    } else {
      uniforms['mousePos'].value.set(10000, 10000);
    }
  } else {
    uniforms['mousePos'].value.set(10000, 10000);
  }
}
let lastTime = 0;
let animationId = null; // Store animation ID for cleanup

function animate(currentTime) {
  const deltaTime = Math.min((currentTime - lastTime) * 0.001, 0.1); // Convert to seconds, cap at 0.1s
  lastTime = currentTime;

  // No need to check in animation loop anymore - assets are tracked properly

  fallingWaterUniforms.iTime.value = performance.now() / 1000.0; // Pass time in seconds
  // --- END NEW ---
  if (heightmapVariable) {
    // Check if initialized
    heightmapVariable.material.uniforms['time'].value = performance.now() / 1000.0;
  }

  // --- NEW: Update splash particles ---
  updateSplashParticles(deltaTime);

  // Continuously emit particles at the water intersection
  const fallingWaterCenter = heightmapVariable.material.uniforms['fallingWaterCenter'].value;
  const fallingWaterRadius = heightmapVariable.material.uniforms['fallingWaterSize'].value;

  // Emit a few particles each frame
  if (Math.random() < 0.95) {
    // 80% chance each frame
    emitSplashParticles(fallingWaterCenter.x, fallingWaterCenter.y, fallingWaterRadius, Math.floor(2 + Math.random() * 6) // 2-4 particles per emission
    );
  }
  // --- END NEW ---

  render();
  // stats.update();
}
function render() {
  if (coinSplashTimeout === null) {
    raycast(); // Process mouse interaction only if no coin splash is resetting
  }
  const dt = 1 / 60;
  // Lower bowl water levels
  const lowerWaterLevel = -0.5; // Adjusted to match water mesh position
  const lowerBottomDepth = -0.78; // Adjusted bottom depth (-0.28 - 0.5)

  // Upper bowl water levels
  const upperWaterLevel = 0.4; // Match upper water mesh Y position

  // Upper bowl bottom (adjust this value based on your fountain model)

  const waterDamping = 0.70;
  const underwaterGravityFactor = 0.35;
  const uniforms = heightmapVariable.material.uniforms;

  // Temporary raycaster for coin collision detection
  const coinRaycaster = new THREE.Raycaster();
  // Collection of fountain parts for collision testing
  const fountainParts = [];

  // Get all fountain model parts for collision detection
  if (window.fountainModel) {
    window.fountainModel.traverse(function (node) {
      if (node.isMesh && node.userData.isFountainPart) {
        fountainParts.push(node);
      }
    });
  }
  for (let i = coins.length - 1; i >= 0; i--) {
    const coin = coins[i];
    const velocity = coin.userData.velocity;

    // --- Track if coin is stuck ---
    if (!coin.userData.lastPositions) {
      coin.userData.lastPositions = [];
      coin.userData.stuckTimer = 0;
    }

    // --- Determine which bowl the coin is in FIRST ---
    // Upper bowl center is at (0.05, 0.4, -0.01) with size 0.6
    const upperBowlRadius = 0.25; // Slightly smaller than half to ensure we're inside
    const distanceFromUpperCenter = Math.sqrt(Math.pow(coin.position.x - 0.05, 2) + Math.pow(coin.position.z + 0.01, 2));
    const isInUpperBowl = coin.position.y > 0.2 && distanceFromUpperCenter < upperBowlRadius;

    // Calculate dynamic bottom depth for upper bowl based on distance from center
    let bottomDepth;
    if (isInUpperBowl) {
      // Create a parabolic bowl shape: deeper in center, shallower at edges
      const normalizedDistance = distanceFromUpperCenter / upperBowlRadius; // 0 at center, 1 at edge
      const bowlCurve = normalizedDistance * normalizedDistance; // Quadratic curve
      // Interpolate between center depth (0.3) and edge depth (0.38)
      bottomDepth = 0.3 + bowlCurve * 0.08; // Ranges from 0.3 to 0.38
    } else {
      bottomDepth = lowerBottomDepth;
    }
    const waterLevel = isInUpperBowl ? upperWaterLevel : lowerWaterLevel;
    const isUnderwater = coin.userData.underwater;
    if (!hasStopped) {
      // --- Apply Spin ---
      coin.rotateOnWorldAxis(coin.userData.rotationAxis, coin.userData.rotationSpeed);

      // --- Apply Gravity / Damping ---
      if (isUnderwater) {
        // Apply overall damping
        velocity.multiplyScalar(waterDamping);
        // Apply a small residual downward force (gravity - buoyancy approx)
        velocity.y -= gravity * underwaterGravityFactor; // Ensures it continues sinking
      } else {
        // Apply normal gravity above water
        velocity.y -= gravity;
      }

      // Calculate next position before applying it
      const nextPosition = coin.position.clone().add(velocity.clone().multiplyScalar(dt));

      // --- Check for Fountain Collision ---
      if (fountainParts.length > 0 && !isUnderwater) {
        // Create a ray from current position to next position
        const rayDirection = nextPosition.clone().sub(coin.position).normalize();
        coinRaycaster.set(coin.position, rayDirection);

        // Check distance to travel this frame
        const distanceToTravel = coin.position.distanceTo(nextPosition);

        // Set max distance to slightly more than we'd travel this frame
        const intersects = coinRaycaster.intersectObjects(fountainParts, false);

        // If we hit something within our travel distance
        if (intersects.length > 0 && intersects[0].distance < distanceToTravel + 0.01) {
          console.log("Coin hit fountain part:", intersects[0].object.name);

          // Get normal of the surface hit
          const surfaceNormal = intersects[0].face.normal.clone();

          // Transform normal to world space
          surfaceNormal.transformDirection(intersects[0].object.matrixWorld);

          // Calculate the bounce effect
          const impactSpeed = velocity.length();
          const bounceCoefficient = 0.3; // How much the coin bounces (0-1)
          const minSpeedForBounce = 0.03; // Minimum speed needed to bounce

          // Position coin near point of impact but offset along normal to prevent penetration
          // Use coin half-thickness plus a small buffer for the offset
          const offsetDistance = COIN_THICKNESS / 2 + 0.003; // Ensure no embedding
          const impactPoint = intersects[0].point.clone();
          coin.position.copy(impactPoint.add(surfaceNormal.clone().multiplyScalar(offsetDistance)));

          // Only bounce if impact speed is significant enough
          if (impactSpeed > minSpeedForBounce) {
            // Reflect velocity vector along normal (bounce) and reduce magnitude
            velocity.reflect(surfaceNormal).multiplyScalar(bounceCoefficient);

            // Add some randomness to bounce to make it more natural
            velocity.x += (Math.random() - 0.5) * 0.01;
            velocity.z += (Math.random() - 0.5) * 0.01;

            // Add a small rolling effect on angled surfaces
            const surfaceAngle = surfaceNormal.angleTo(new THREE.Vector3(0, 1, 0));
            if (surfaceAngle > 0.2) {
              // Only roll on sufficiently angled surfaces
              // Calculate a vector along the slope direction
              const slopeDirection = new THREE.Vector3(surfaceNormal.x, 0, surfaceNormal.z).normalize();
              velocity.add(slopeDirection.multiplyScalar(-rollForce)); // Roll downhill
            }

            // Increase spin based on impact
            coin.userData.rotationSpeed *= 1.5;
          } else {
            // If impact speed is too low, the coin comes to rest on this surface
            velocity.set(0, 0, 0);
            coin.userData.stopped = true;

            // Align coin with surface - ensure the FLAT side is parallel to surface
            // First reset rotation
            coin.rotation.set(0, 0, 0);

            // Then create rotation to align coin's up vector with surface normal
            // Since coin was initially rotated PI/2 on X, its "up" is now along Z axis
            const coinUpVector = new THREE.Vector3(0, 0, 1);
            const quaternion = new THREE.Quaternion().setFromUnitVectors(coinUpVector, surfaceNormal);
            coin.quaternion.copy(quaternion);

            // Add a random rotation around the normal for visual variety
            const randomAngle = Math.random() * Math.PI * 2;
            coin.rotateOnWorldAxis(surfaceNormal, randomAngle);

            // Save coin to Firestore if not already saved (skip for local coins)
            if (!coin.userData.firestoreId && !coin.userData.isStatic && !coin.userData.isLocalCoin) {
              saveCoinToFirestore({
                position: coin.position,
                rotation: coin.rotation,
                isInUpperBowl: isInUpperBowl,
                charity: coin.userData.charity
              }).then(id => {
                if (id) {
                  coin.userData.firestoreId = id;
                  totalCoinCount++;
                  updateCoinCounter();

                  // Add to instanced mesh and remove individual mesh
                  addStaticCoinToInstances(coin.position.clone(), coin.rotation.clone(), id);
                  scene.remove(coin);
                  const coinIndex = coins.indexOf(coin);
                  if (coinIndex > -1) {
                    coins.splice(coinIndex, 1);
                  }

                  // Check if we've reached the reset threshold
                  console.log('Coin saved. Total count:', totalCoinCount, 'Threshold:', RESET_THRESHOLD);
                  if (totalCoinCount >= RESET_THRESHOLD && !isResetting) {
                    console.log('Fountain full! Archiving and resetting...');
                    archiveAndResetFountain();
                  }
                }
              });
            }
          }

          // If coin is stopped, continue to next coin
          if (coin.userData.stopped) {
            continue;
          }
        }
      }

      // --- Update Position ---
      coin.position.copy(nextPosition);

      // --- Check for Water Entry ---
      // Check if coin is within the appropriate bowl's water area
      let isInWaterArea = false;
      if (isInUpperBowl) {
        // For upper bowl, we already checked the radius in isInUpperBowl
        // Double-check we're still within bounds
        isInWaterArea = distanceFromUpperCenter < upperBowlRadius;
      } else {
        // For lower bowl, use the existing function
        isInWaterArea = isWithinFountainWater(coin.position);
      }

      // Trigger splash FIRST, then slow down
      if (!isUnderwater && coin.position.y <= waterLevel && velocity.y < 0 && isInWaterArea) {
        console.log("Coin entered water at", coin.position.x.toFixed(2), coin.position.y.toFixed(2), coin.position.z.toFixed(2), "water level:", waterLevel, "in", isInUpperBowl ? "upper" : "lower", "bowl");

        // --- Trigger Splash Immediately ---
        const impactX = coin.position.x;
        const impactZ = coin.position.z;
        uniforms['mousePos'].value.set(impactX, impactZ);
        console.log("Setting splash at", impactX, impactZ);
        if (coinSplashTimeout !== null) clearTimeout(coinSplashTimeout);
        coinSplashTimeout = setTimeout(() => {
          if (heightmapVariable) uniforms['mousePos'].value.set(10000, 10000);
          coinSplashTimeout = null;
        }, coinSplashDuration);

        // --- THEN Modify State & Physics for Underwater ---
        coin.userData.underwater = true;
        coin.material.opacity = 0.6; // Set opacity
        // Increase emissive intensity underwater to make coin more visible
        // coin.material.emissiveIntensity = 0.05; // Maximum glow underwater
        // Make the coin slightly larger underwater for better visibility
        coin.scale.set(1.25, 1.25, 1.25);
        velocity.multiplyScalar(0.5); // Reduce velocity upon entry
      }

      // --- Check for Reaching Bottom ---
      if (isUnderwater && coin.position.y <= bottomDepth + 0.01) {
        // Check if close to or past bottom
        console.log("Coin reached bottom");
        coin.position.y = bottomDepth; // Settle exactly at bottom
        coin.userData.stopped = true;
        velocity.set(0, 0, 0); // Stop all movement

        // --- ADJUSTMENT: Set rotation to flat on XZ plane ---
        // Apply rotation relative to the mesh's current state to align with world XZ plane
        // Since geometry was rotated PI/2 on X, we rotate mesh -PI/2 on X
        coin.rotation.set(-Math.PI / 2, 0, 0);
        // We might also want a random Z rotation so they don't all face the same way
        coin.rotateZ(Math.random() * Math.PI * 2); // Add random rotation around world Z
        // --- END ADJUSTMENT ---

        // Save coin to Firestore if not already saved (skip for local coins)
        if (!coin.userData.firestoreId && !coin.userData.isStatic && !coin.userData.isLocalCoin) {
          saveCoinToFirestore({
            position: coin.position,
            rotation: coin.rotation,
            isInUpperBowl: isInUpperBowl,
            charity: coin.userData.charity
          }).then(id => {
            if (id) {
              coin.userData.firestoreId = id;
              totalCoinCount++;
              updateCoinCounter();

              // Add to instanced mesh and remove individual mesh
              addStaticCoinToInstances(coin.position.clone(), coin.rotation.clone(), id);
              scene.remove(coin);
              const coinIndex = coins.indexOf(coin);
              if (coinIndex > -1) {
                coins.splice(coinIndex, 1);
              }

              // Check if we've reached the reset threshold
              console.log('Coin saved. Total count:', totalCoinCount, 'Threshold:', RESET_THRESHOLD);
              if (totalCoinCount >= RESET_THRESHOLD && !isResetting) {
                console.log('Fountain full! Archiving and resetting...');
                archiveAndResetFountain();
              }
            }
          });
        }
      }

      // --- Check if coin is stuck on statue ---
      // Track position history
      coin.userData.lastPositions.push(coin.position.clone());
      if (coin.userData.lastPositions.length > 60) {
        // Keep last 1 second of positions (60 fps)
        coin.userData.lastPositions.shift();
      }

      // Check if coin has barely moved in the last second
      if (coin.userData.lastPositions.length >= 60) {
        const oldPos = coin.userData.lastPositions[0];
        const movement = coin.position.distanceTo(oldPos);

        // If coin is above water, not stopped, and barely moving
        if (!isUnderwater && !coin.userData.stopped && movement < 0.02 && coin.position.y > waterLevel) {
          coin.userData.stuckTimer += dt;

          // If stuck for more than 0.5 seconds on the statue area (high up)
          if (coin.userData.stuckTimer > 0.5 && coin.position.y > 0.5) {
            console.log("Coin stuck on statue, applying slide");
            // Apply a small random sideways velocity to make it slide off
            velocity.x += (Math.random() - 0.5) * 0.3;
            velocity.z += (Math.random() - 0.5) * 0.3;
            velocity.y = -0.2; // Small downward velocity
            coin.userData.stuckTimer = 0; // Reset timer
          }

          // If stuck for too long anywhere, just drop it
          if (coin.userData.stuckTimer > 2.0) {
            console.log("Coin stuck too long, forcing drop");
            velocity.y = -1.0; // Force it to fall
            coin.userData.stuckTimer = 0;
          }
        } else {
          coin.userData.stuckTimer = 0; // Reset if moving normally
        }
      }
    } // end if (!hasStopped)

    // --- Cleanup Check ---
    if (coin.position.y < -10) {
      console.log("Coin out of bounds, removing");
      scene.remove(coin);
      coins.splice(i, 1);
    }
  }
  frame++;
  if (frame >= 7 - effectController.speed) {
    // Do the gpu computation
    gpuCompute.compute();
    tmpHeightmap = gpuCompute.getCurrentRenderTarget(heightmapVariable).texture;

    // if ( ducksEnabled ) duckDynamics();

    // Get compute output in custom uniform
    if (waterMesh) waterMesh.material.heightmap = tmpHeightmap;
    // Also apply to upper water mesh
    if (upperWaterMesh) upperWaterMesh.material.heightmap = tmpHeightmap;
    frame = 0;
  }

  // 80s Mode Animations
  if (is80sMode) {
    // Animate neon grid
    if (neonGrid) {
      neonGrid.rotation.y += 0.001;
      // Pulse grid opacity
      const pulse = Math.sin(Date.now() * 0.002) * 0.2 + 0.8;
      neonGrid.material.opacity = pulse;
    }

    // Animate retro sun
    if (retroSun) {
      // Slowly move sun up and down
      retroSun.position.y = 3 + Math.sin(Date.now() * 0.0005) * 0.5;
      // Update time uniform for shader animation
      if (retroSun.material.uniforms && retroSun.material.uniforms.time) {
        retroSun.material.uniforms.time.value = Date.now() * 0.001;
      }
    }

    // Pulse water glow
    if (waterMesh && waterMesh.material) {
      const glow = Math.sin(Date.now() * 0.003) * 0.15 + 0.3;
      waterMesh.material.emissiveIntensity = glow;
    }
  }

  // Render with bloom
  if (composer) {
    composer.render();
  } else {
    renderer.render(scene, camera);
  }
}

//----------------------

class WaterMaterial extends THREE.MeshStandardMaterial {
  constructor(parameters) {
    super();
    this.defines = {
      'STANDARD': '',
      'USE_UV': '',
      'WIDTH': WIDTH.toFixed(1),
      'BOUNDS': BOUNDS.toFixed(1)
    };
    this.extra = {};
    this.addParameter('heightmap', null);
    this.setValues(parameters);
  }
  addParameter(name, value) {
    this.extra[name] = value;
    Object.defineProperty(this, name, {
      get: () => this.extra[name],
      set: v => {
        this.extra[name] = v;
        if (this.userData.shader) this.userData.shader.uniforms[name].value = this.extra[name];
      }
    });
  }
  onBeforeCompile(shader) {
    for (const name in this.extra) {
      shader.uniforms[name] = {
        value: this.extra[name]
      };
    }
    shader.vertexShader = shader.vertexShader.replace('#include <common>', shaderChange.common);
    //shader.vertexShader = 'uniform sampler2D heightmap;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace('#include <beginnormal_vertex>', shaderChange.beginnormal_vertex);
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', shaderChange.begin_vertex);
    this.userData.shader = shader;
  }
}
const shaderChange = {
  heightmap_frag: /* glsl */`
				#include <common>

				uniform vec2 mousePos;
				uniform float mouseSize;
				uniform float viscosity;
				uniform float deep;
				uniform float time;
				uniform vec2 fallingWaterCenter;
				uniform float fallingWaterSize;
				uniform float fallingWaterDeep;

				// Simple pseudo-random function (hash)
				float hash(vec2 p) {
					// Simple 2D hash function
					return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453123);
				}

				// Basic procedural noise using hash
				float noise(vec2 p) {
					vec2 i = floor(p);
					vec2 f = fract(p);
					// Smooth interpolation (smoothstep can be used too)
					vec2 u = f * f * (3.0 - 2.0 * f);
					// Mix corners
					return mix(mix(hash(i + vec2(0.0, 0.0)),
								   hash(i + vec2(1.0, 0.0)), u.x),
							   mix(hash(i + vec2(0.0, 1.0)),
								   hash(i + vec2(1.0, 1.0)), u.x), u.y);
				}

				void main()	{
					vec2 cellSize = 1.0 / resolution.xy;
					vec2 uv = gl_FragCoord.xy * cellSize;

					vec4 heightmapValue = texture2D( heightmap, uv );

					// Get neighbours
					vec4 north = texture2D( heightmap, uv + vec2( 0.0, cellSize.y ) );
					vec4 south = texture2D( heightmap, uv + vec2( 0.0, - cellSize.y ) );
					vec4 east = texture2D( heightmap, uv + vec2( cellSize.x, 0.0 ) );
					vec4 west = texture2D( heightmap, uv + vec2( - cellSize.x, 0.0 ) );

					// Calculate base new height using simulation equation
					float newHeight = ( ( north.x + south.x + east.x + west.x ) * 0.5 - heightmapValue.y ) * viscosity;

					// --- ADD CONTINUOUS PROCEDURAL NOISE TO PREVENT FLATTENING ---
					float noiseFrequency = 8.0;   // Controls the scale of the noise pattern
					float noiseSpeed = 0.2;       // Controls how fast the noise pattern evolves
					float noiseStrength = 0.0008; // <<< VERY IMPORTANT: TUNE THIS CAREFULLY! Start small.

					// Calculate noise based on UV coordinates and time
					float noiseVal = noise(uv * noiseFrequency + vec2(time * noiseSpeed));

					// Add the noise (scaled to [-1, 1] range) to the height calculation
					// This continuously perturbs the surface away from perfect flatness
					newHeight += (noiseVal * 2.0 - 1.0) * noiseStrength;
					// --- END NOISE ---

					// --- Mouse/Coin influence ---
					// Apply the user/coin interaction force
					vec2 mouseInfluencePos = vec2(mousePos.x, -mousePos.y); // Use the flipped coord for calculation
					float mousePhase = clamp( length( ( uv - vec2( 0.5 ) ) * BOUNDS - mouseInfluencePos ) * PI / mouseSize, 0.0, PI );
					newHeight -= ( cos( mousePhase ) + 1.0 ) * deep; // Subtract influence

					// --- Falling water continuous splash ---
					vec2 worldPos = (uv - vec2(0.5)) * BOUNDS;
  float distToCenter = length(worldPos - fallingWaterCenter);

  // Create expanding ripples from center
  float rippleSpeed = 4.0; // How fast ripples expand
  float rippleFrequency = 15.0; // How many ripples
  float rippleDecay = 2.0; // How quickly ripples fade with distance

  // Create outward moving ripples
  float ripplePhase = distToCenter * rippleFrequency - time * rippleSpeed;
  float rippleAmplitude = exp(-distToCenter * rippleDecay) * fallingWaterDeep;

  // Single clean ripple pattern
  float ripple = sin(ripplePhase) * rippleAmplitude;

  // Only apply ripples within a certain radius
  float maxRadius = 1.2; // Maximum ripple distance
  ripple *= smoothstep(maxRadius, 0.0, distToCenter);

  newHeight += ripple;
					// --- END falling water splash ---

					// Update height history
					heightmapValue.y = heightmapValue.x;
					heightmapValue.x = newHeight;

					gl_FragColor = heightmapValue;
				}
				`,
  // FOR MATERIAL
  common: /* glsl */`				#include <common>
				uniform sampler2D heightmap;
				`,
  beginnormal_vertex: /* glsl */`
				vec2 cellSize = vec2( 1.0 / WIDTH, 1.0 / WIDTH );
				vec3 objectNormal = vec3(
				( texture2D( heightmap, uv + vec2( - cellSize.x, 0 ) ).x - texture2D( heightmap, uv + vec2( cellSize.x, 0 ) ).x ) * WIDTH / BOUNDS,
				( texture2D( heightmap, uv + vec2( 0, - cellSize.y ) ).x - texture2D( heightmap, uv + vec2( 0, cellSize.y ) ).x ) * WIDTH / BOUNDS,
				1.0 );
				#ifdef USE_TANGENT
					vec3 objectTangent = vec3( tangent.xyz );
				#endif
				`,
  begin_vertex: /* glsl */`
				float heightValue = texture2D( heightmap, uv ).x;
				vec3 transformed = vec3( position.x, position.y, heightValue );
				#ifdef USE_ALPHAHASH
					vPosition = vec3( position );
				#endif
				`
};