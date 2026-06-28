"use client";

// TradeLaptop — the laptop + CRT-portal shell, lifted wholesale from
// HolyGrailPortal but WITHOUT the inner model (ironHorseRider.glb) that used to
// emanate through the screen. Everything else carries over: laptop model +
// position/scale, the pulsing green key, the green-key→zoom behaviour, the CRT
// terminal toggle (3D on desktop, fullscreen overlay on mobile) and the BuyModal.
//
// The portal screen is left as a CLEAN MeshPortalMaterial slot: when not zoomed
// it renders empty (transparent), ready for a new idea to be dropped inside the
// LaptopFrame children. The rider's sky-gradient world, clouds, breath smoke,
// spotlight and the model-through-screen clipping have all been stripped out.

import React, { useRef, useState, useEffect, Suspense, useMemo } from "react";
import { createPortal } from "react-dom";
import * as THREE from 'three';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useGLTF, MeshPortalMaterial, CameraControls, Text, useProgress, RenderTexture, PerspectiveCamera } from '@react-three/drei';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import BuyModal from './BuyModal';
import FullscreenCRTOverlay from './FullscreenCRTOverlay';
import { useLanguage } from './LanguageProvider';
import { createAsciiDecryptScreen } from './asciiDecryptScreen';

// Hardcoded bloom — the old halo-tuning panel is gone (no rider/halo to tune),
// these are the values it used to default to. The pulsing green key still blooms.
const BLOOM = { intensity: 0.7, radius: 0.5, threshold: 1.0 };

// Laptop-screen content selector — flip to compare without deleting either.
// 'model'     = CyberpunkMaryHeartRed2.glb rendered to an off-screen target and
//               stamped into live ASCII by a glyph shader (spins, full 3D punch).
// 'ascii-art' = the static-art "decrypt" canvas with the pingpong breathe.
const SCREEN_CONTENT = 'model';

// CRT transition shader for screen toggle effect
const CRTTransitionMaterial = {
  uniforms: {
    transition: { value: 0.0 },
    time: { value: 0.0 },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform float transition;
    uniform float time;
    varying vec2 vUv;

    float random(vec2 st) {
      return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);
    }

    void main() {
      vec2 uv = vUv;

      // Scanlines
      float scanline = sin(uv.y * 400.0 + time * 10.0) * 0.15;

      // Static noise
      float noise = random(uv * time) * 0.5;

      // CRT glow color (cyan/white)
      vec3 crtColor = vec3(0.4, 0.9, 1.0);

      // Bright horizontal line sweep
      float sweepPos = fract(time * 2.0);
      float sweep = smoothstep(sweepPos - 0.05, sweepPos, uv.y) * smoothstep(sweepPos + 0.05, sweepPos, uv.y);
      sweep *= 3.0;

      // Combine effects
      vec3 finalColor = crtColor * (noise + scanline + sweep);

      // Overall intensity based on transition (peaks at 0.5)
      float intensity = sin(transition * 3.14159);

      gl_FragColor = vec4(finalColor * intensity, intensity * 0.8);
    }
  `,
};

// CRT Background component with radial gradient effect
function CRTBackground() {
  return (
    <mesh position={[0, 0, 0.7]}>
      <planeGeometry args={[10, 10]} />
      <shaderMaterial
        uniforms={{
          darkGreen: { value: new THREE.Color('#0a1f0a') },
          black: { value: new THREE.Color('#000000') },
        }}
        vertexShader={`
          varying vec2 vUv;
          void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `}
        fragmentShader={`
          uniform vec3 darkGreen;
          uniform vec3 black;
          varying vec2 vUv;

          void main() {
            // Center the UV coordinates
            vec2 center = vUv - 0.5;

            // Radial distance from center
            float dist = length(center) * 2.0;

            // Radial gradient from dark green center to black edges
            vec3 color = mix(darkGreen, black, smoothstep(0.0, 1.0, dist));

            // Inner shadow/vignette effect
            float vignette = 1.0 - smoothstep(0.3, 1.2, dist);
            color *= mix(0.3, 1.0, vignette);

            gl_FragColor = vec4(color, 1.0);
          }
        `}
      />
    </mesh>
  );
}

// Cyberpunk Laptop Frame component
function LaptopFrame({ children, portalBlend = 0, screenRef, onKeyPress, onScreenClick, ...props }) {
  const { scene } = useGLTF('/models/laptop.glb');
  const portalRef = useRef();
  const keyMaterialsRef = useRef([]);

  // Clone and hide original screen
  const clonedScene = React.useMemo(() => {
    const clone = scene.clone();
    clone.traverse((child) => {
      if (child.isMesh && child.name === 'Cube_Screen_0') {
        child.visible = false;
      }
    });
    return clone;
  }, [scene]);

  // Set up green key after mount
  useEffect(() => {
    if (!clonedScene) return;

    const materials = [];
    clonedScene.traverse((child) => {
      if (child.isMesh && child.name === 'GreenKey1') {
        const glowMaterial = new THREE.MeshBasicMaterial({
          color: new THREE.Color('#00ff00'),
          toneMapped: false, // Prevents tone mapping from dimming the color
        });
        child.material = glowMaterial;
        materials.push(glowMaterial);
      }
    });
    keyMaterialsRef.current = materials;
  }, [clonedScene]);

  // Pulse the green keys - animate color directly for reliable cross-device rendering
  useFrame(({ clock }) => {
    const materials = keyMaterialsRef.current;
    if (materials.length === 0) return;

    const t = clock.getElapsedTime();
    const pulse = (Math.sin(t * 4) + 1) / 2; // 0 to 1 pulse

    // Animate between dark green and bright green
    const r = pulse * 0.2;
    const g = 0.4 + pulse * 0.6; // 0.4 to 1.0
    const b = pulse * 0.2;

    materials.forEach((mat) => {
      mat.color.setRGB(r, g, b);
    });
  });

  // Handle click on the laptop - check if it's the green key or hit areas
  const handleClick = (e) => {
    if (e.object?.name === 'GreenKey1' || e.object?.name === 'GreenKeyHitArea' || e.object?.name === 'ExtendedButtonArea') {
      e.stopPropagation();
      onKeyPress?.();
    }
  };

  return (
    <group {...props}>
      {/* The laptop model with click detection */}
      <group onPointerDown={handleClick} onClick={handleClick}>
        <primitive object={clonedScene} scale={0.06} />
      </group>
      {/* Larger hit area for the green key - use tiny opacity for reliable raycasting */}
      <mesh
        name="GreenKeyHitArea"
        position={[-0.52, 0.02, 0.32]}
        onPointerDown={(e) => {
          e.stopPropagation();
          onKeyPress?.();
        }}
        onClick={(e) => {
          e.stopPropagation();
          onKeyPress?.();
        }}
      >
        <boxGeometry args={[0.18, 0.08, 0.18]} />
        <meshBasicMaterial transparent opacity={0.001} depthWrite={false} />
      </mesh>

      {/* Portal positioned where the screen is — clean slot for the new idea */}
      <mesh
        ref={screenRef}
        position={[0, 0.65, -0.15]}
        rotation={[-0.35, 0, 0]}
        onClick={(e) => {
          e.stopPropagation();
          onScreenClick?.();
        }}
      >
        <planeGeometry args={[1.45, 1.0]} />
        <MeshPortalMaterial ref={portalRef} side={THREE.DoubleSide} blend={portalBlend}>
          {children}
        </MeshPortalMaterial>
      </mesh>
    </group>
  );
}

// Floating hover wrapper
function FloatingGroup({ children, amplitude = 0.0, speed = 1.2, rotationAmplitude = 0.02, rotationSpeed = 0.8 }) {
  const groupRef = useRef();

  useFrame(({ clock }) => {
    if (groupRef.current) {
      const t = clock.getElapsedTime();
      groupRef.current.position.y = Math.sin(t * speed) * amplitude;
      groupRef.current.rotation.y = Math.sin(t * rotationSpeed) * rotationAmplitude;
    }
  });

  return <group ref={groupRef}>{children}</group>;
}

// ASCII "decrypt" reveal of Our Lady of Perpetual Profit, painted onto a plane
// that sits on the laptop screen — the resting state, shown when not zoomed into
// the CRT terminal. createAsciiDecryptScreen() swaps the mesh's material for a
// CanvasTexture and hands back an update(dt) we pump from useFrame; it decrypts
// once over ~9s then self-stops (zero ongoing cost). Same helper MobileLobbyScene
// drives on its GLB screen mesh — here it's on a raw plane, so flipY:true.
function AsciiDecryptScreen({ screenWidth = 1.45, screenHeight = 1.0, margin = 0.03, mode = 'pingpong', ...props }) {
  const meshRef = useRef();
  const handleRef = useRef(null);
  const accum = useRef(0);

  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    // flipY:true — a plain PlaneGeometry uses bottom-left UVs (a glTF mesh wants
    // false). The helper replaces mesh.material with the ASCII CanvasTexture.
    // mode 'pingpong' → the figure perpetually materializes then dissolves.
    const handle = createAsciiDecryptScreen(mesh, { flipY: true, mode });
    handleRef.current = handle;

    // Fit-contain the portrait canvas inside the screen box (unit plane scaled),
    // so the figure keeps its aspect ratio instead of stretching to the screen.
    const boxW = screenWidth - margin * 2;
    const boxH = screenHeight - margin * 2;
    let w = boxW, h = boxW / handle.aspect;
    if (h > boxH) { h = boxH; w = boxH * handle.aspect; }
    mesh.scale.set(w, h, 1);

    return () => { handleRef.current = null; handle.dispose(); };
  }, [screenWidth, screenHeight, margin, mode]);

  // Throttle the redraw to ~20fps (matches MobileLobbyScene; the scramble reads
  // fine there). Pass real elapsed time so the decrypt timeline stays accurate.
  useFrame((_, delta) => {
    const h = handleRef.current;
    if (!h) return;
    accum.current += delta;
    if (accum.current >= 0.05) { h.update(accum.current); accum.current = 0; }
  });

  return (
    <group {...props}>
      {/* Dark backing fills the screen so the centered figure reads as one dark
          monitor (matches the ASCII canvas BG). raycast off so screen taps still
          reach the portal behind → zoom into the CRT. */}
      <mesh position={[0, 0, -0.005]} raycast={() => null}>
        <planeGeometry args={[screenWidth, screenHeight]} />
        <meshBasicMaterial color="#08060f" toneMapped={false} />
      </mesh>
      {/* ASCII plane — unit geometry, scaled to fit in the effect. Starts at
          scale 0 so the default white material never flashes before the texture
          is swapped in. raycast off (taps pass through to the screen behind). */}
      <mesh ref={meshRef} scale={0} raycast={() => null}>
        <planeGeometry args={[1, 1]} />
      </mesh>
    </group>
  );
}

// ── Model → live ASCII screen ────────────────────────────────────────────────
// Renders a 3D model to an off-screen target, then an ASCII shader on the screen
// plane samples that target per glyph-cell and stamps a character from a
// brightness ramp. Unlike three's AsciiEffect (a flat DOM <table>), this is a
// texture on the tilted screen mesh, so it tracks the model's spin AND the
// screen's perspective, and the scene Bloom makes it glow.

const ASCII_RAMP = ' .:-=+*ox#%@'; // dark → bright (leading space = empty cells)

// Build a horizontal glyph atlas (one square cell per ramp char) as a
// transparent-bg CanvasTexture; the shader reads each glyph's alpha as coverage.
function makeGlyphAtlas(ramp = ASCII_RAMP, cell = 32) {
  const chars = ramp.split('');
  const canvas = document.createElement('canvas');
  canvas.width = cell * chars.length;
  canvas.height = cell;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#fff';
  ctx.font = `bold ${Math.floor(cell * 0.92)}px 'Courier New', monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  chars.forEach((ch, i) => ctx.fillText(ch, i * cell + cell / 2, cell / 2 + 1));
  const tex = new THREE.CanvasTexture(canvas);
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;
  tex.flipY = false; // glyph v handled manually in the shader
  return { texture: tex, count: chars.length };
}

// The model, normalized to a ~2-unit box centered at the origin. By default it
// gently ROCKS (a small ±rockAmplitude oscillation around front) so the flat
// icon stays front-facing/legible instead of going sparse edge-on; set
// rock=false to fall back to a continuous yaw spin at `spin` rad/s.
function AsciiModel({ url, rock = true, rockAmplitude = 0.22, rockSpeed = 0.5, spin = 0.3, emissive = null, emissiveIntensity = 0.85, emissiveMatch = null }) {
  const { scene } = useGLTF(url);
  const spinRef = useRef();
  const fit = useMemo(() => {
    const c = scene.clone();
    if (emissive) {
      // Make matching meshes self-illuminate (run hot) so the ASCII reads them as
      // the brightest part — e.g. a dedicated "Halo" mesh. emissiveMatch limits
      // it to those meshes; without it the whole model glows. Clone each material
      // first — useGLTF caches the source scene, so mutating it would leak.
      const col = new THREE.Color(emissive);
      const re = emissiveMatch ? new RegExp(emissiveMatch, 'i') : null;
      c.traverse((o) => {
        if (!o.isMesh || !o.material) return;
        if (re && !(re.test(o.name || '') || re.test(o.material.name || ''))) return;
        o.material = o.material.clone();
        o.material.emissive = col;
        o.material.emissiveIntensity = emissiveIntensity;
        o.material.toneMapped = false; // let it exceed 1.0 so it's clearly the hottest area
        o.material.needsUpdate = true;
      });
    }
    const box = new THREE.Box3().setFromObject(c);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z) || 1;
    return { scene: c, s: 2 / maxDim, center };
  }, [scene, emissive, emissiveIntensity, emissiveMatch]);
  useFrame((state, dt) => {
    const g = spinRef.current;
    if (!g) return;
    if (rock) g.rotation.y = Math.sin(state.clock.elapsedTime * rockSpeed) * rockAmplitude;
    else g.rotation.y += dt * spin;
  });
  return (
    <group ref={spinRef}>
      <group scale={fit.s} position={[-fit.center.x * fit.s, -fit.center.y * fit.s, -fit.center.z * fit.s]}>
        <primitive object={fit.scene} />
      </group>
    </group>
  );
}

const ASCII_VS = `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;
const ASCII_FS = `
  uniform sampler2D uSource;
  uniform sampler2D uGlyphs;
  uniform float uGlyphCount;
  uniform vec2 uGrid;
  uniform float uAspect;    // feed window W/H — letterboxes the square source
  uniform vec3 uTint;
  uniform float uColorMix;  // 0 = pure tint, 1 = model's own colour
  uniform float uBrightness;// glyph brightness multiplier (>1 blooms via the composer)
  uniform float uHiBoost;   // pushes bright areas (e.g. the halo) to denser glyphs
  uniform float uHiGlow;    // extra glyph brightness in the highlights (blooms)
  uniform vec3 uBg;         // feed background base colour (the dark areas)
  uniform vec3 uBgGlow;     // soft glow added toward the centre of the feed
  uniform float uTime;      // seconds — drives the transmission animation
  uniform float uGlitch;    // 0..1 channel-switch glitch (masks a subject swap)
  varying vec2 vUv;

  float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

  void main() {
    // --- transmission warp: occasional horizontal tear on random scan-bands ---
    vec2 uv = vUv;
    float band = floor(uv.y * 48.0);
    float gnz = hash(vec2(band, floor(uTime * 6.0)));
    float tearAmt = 0.07 + uGlitch * 0.28;
    float tear = step(0.95 - uGlitch * 0.45, gnz) * (hash(vec2(band, floor(uTime * 6.0) + 7.0)) - 0.5) * tearAmt;
    uv.x += tear + (hash(vec2(floor(uTime * 30.0), 3.0)) - 0.5) * uGlitch * 0.05;

    // --- ASCII sampling (letterboxed source) on the warped uv ---
    vec2 cell = floor(uv * uGrid);
    vec2 cc = (cell + 0.5) / uGrid;
    vec2 suv = vec2((cc.x - 0.5) * uAspect + 0.5, cc.y);
    vec3 src = vec3(0.0);
    if (suv.x >= 0.0 && suv.x <= 1.0) src = texture2D(uSource, suv).rgb;
    float lum = dot(src, vec3(0.299, 0.587, 0.114));
    float hi = smoothstep(0.5, 1.0, lum);                // highlight mask (e.g. the halo)
    float lumD = clamp(lum + hi * uHiBoost, 0.0, 1.0);   // denser glyphs in the highlights

    float idx = clamp(floor(lumD * uGlyphCount), 0.0, uGlyphCount - 1.0);
    vec2 local = fract(uv * uGrid);
    float cov = texture2D(uGlyphs, vec2((idx + local.x) / uGlyphCount, 1.0 - local.y)).a;

    float gl = smoothstep(1.0, 0.0, length((vUv - vec2(0.5, 0.55)) * vec2(1.05, 1.25)));
    vec3 bg = uBg + uBgGlow * gl * gl;
    vec3 glyphColor = mix(uTint, src * 1.6, uColorMix) * uBrightness * (1.0 + hi * uHiGlow);
    vec3 color = mix(bg, glyphColor, cov);

    // weak-signal static grain (stronger in the empty/dark areas, spikes on swap)
    float st = hash(vUv * vec2(640.0, 480.0) + uTime);
    color += (st - 0.5) * (0.05 + uGlitch * 0.5) * (1.0 - cov);

    // CRT scanlines
    color *= 0.82 + 0.18 * sin(vUv.y * 220.0);

    // slow bright roll bar drifting upward (transmission sweep)
    float roll = fract(vUv.y * 0.6 - uTime * 0.05);
    color += uTint * smoothstep(0.965, 1.0, roll) * 0.12;

    // overall signal flicker
    color *= 0.93 + 0.07 * hash(vec2(uTime, 1.7));

    // vignette toward the window edges
    vec2 vd = (vUv - 0.5) * 2.0;
    color *= 1.0 - dot(vd, vd) * 0.22;

    // channel-switch flash: desaturate + lift, masking the subject swap
    float gL = dot(color, vec3(0.333));
    color = mix(color, vec3(gL) + uTint * 0.15, uGlitch * 0.6);
    color += uGlitch * 0.08;

    gl_FragColor = vec4(color, 1.0);
  }
`;

// Feed subjects the [ICON-80] window cycles through. Each: model url + the panel
// label + the footer SUBJECT name. The reliquary icon and the cortex scan
// alternate — faith + cognition — a scanning terminal "accessing minds".
// Per-subject overrides: tint (figure colour) + motion. Our Lady rocks gently
// (icon, front-facing); the brain spins at a steady medium speed so it reads as
// a rotating brain, in its own magenta so the two feeds are instantly distinct.
const SUBJECTS = [
  { url: '/models/CyberpunkMaryHeartRed3.glb', label: '[ ICON-80 ]',   name: 'OUR LADY', tint: '#00f5d4', rock: true, emissive: '#ffd24a', emissiveMatch: 'halo', emissiveIntensity: 1.8 },
  { url: '/models/Brain.glb',                  label: '[ CORTEX-80 ]', name: 'NEURAL',   tint: '#ff7ae0', rock: false, spin: 0.65 },
];

function AsciiModelScreen({
  subjects = SUBJECTS,
  cyclePeriod = 9,     // seconds each subject holds before the feed switches
  transDuration = 0.9, // seconds of glitch masking the swap
  screenWidth = 1.45,
  screenHeight = 1.0,
  cols = 104,          // ASCII grid density — higher = finer figure (+ halo) detail
  fboSize = 416,       // off-screen render resolution feeding the ASCII sampler
  tint = '#00f5d4',
  colorMix = 0.7,
  rock = true,         // gentle front-facing rock (false → continuous spin)
  rockAmplitude = 0.22,
  rockSpeed = 0.5,
  spin = 0.3,
  brightness = 1.9,    // glyph brightness (>1 glows through the Bloom pass)
  highlightBoost = 0.4, // bright areas (halo) → denser glyphs
  highlightGlow = 1.1,  // bright areas → extra glyph brightness (bloom)
  bg = '#000000',
  bgGlow = '#000000',
  feedAnchorRef,        // object3D at the feed centre, so the camera can fly to it
  ...props
}) {
  const glyph = useMemo(() => makeGlyphAtlas(), []);
  // Feed + code panels are placed to line up with the HUD chrome frames.
  const feed = rectToPlane(HUD.feedImg, screenWidth, screenHeight);
  const code = rectToPlane(HUD.codeImg, screenWidth, screenHeight);
  const rows = Math.max(1, Math.round(cols * (feed.h / feed.w)));
  const matRef = useRef();

  // Which subject is on the feed, and a glitch-transition timer for the swap.
  const [index, setIndex] = useState(0);
  const subject = subjects[index] || subjects[0];
  const transRef = useRef(0);
  // Current subject info read live by the HUD canvas (label + footer name).
  const infoRef = useRef(subject);
  useEffect(() => { infoRef.current = subjects[index] || subjects[0]; }, [index, subjects]);
  // Swap the feed tint to the current subject (masked by the glitch window).
  useEffect(() => {
    const m = matRef.current;
    if (m) m.uniforms.uTint.value.set(subject.tint || tint);
  }, [index, subject, tint]);

  // Cycle subjects (only if there's more than one).
  useEffect(() => {
    if (subjects.length < 2) return;
    const id = setInterval(() => setIndex((i) => (i + 1) % subjects.length), cyclePeriod * 1000);
    return () => clearInterval(id);
  }, [subjects.length, cyclePeriod]);
  // Kick off the glitch window whenever the subject changes.
  useEffect(() => { transRef.current = transDuration; }, [index, transDuration]);

  const uniforms = useMemo(() => ({
    uSource: { value: null },
    uGlyphs: { value: glyph.texture },
    uGlyphCount: { value: glyph.count },
    uGrid: { value: new THREE.Vector2(cols, rows) },
    uAspect: { value: feed.w / feed.h },
    uTint: { value: new THREE.Color((subjects[0] && subjects[0].tint) || tint) },
    uColorMix: { value: colorMix },
    uBrightness: { value: brightness },
    uHiBoost: { value: highlightBoost },
    uHiGlow: { value: highlightGlow },
    uBg: { value: new THREE.Color(bg) },
    uBgGlow: { value: new THREE.Color(bgGlow) },
    uTime: { value: 0 },
    uGlitch: { value: 0 },
  }), [glyph, cols, rows, feed.w, feed.h, tint, colorMix, brightness, highlightBoost, highlightGlow, bg, bgGlow]);

  // Drive the transmission animation + pulse the glitch over the swap window.
  useFrame((state, dt) => {
    const m = matRef.current;
    if (!m) return;
    m.uniforms.uTime.value = state.clock.elapsedTime;
    if (transRef.current > 0) {
      transRef.current = Math.max(0, transRef.current - dt);
      const p = transRef.current / transDuration;          // 1 → 0 over the window
      m.uniforms.uGlitch.value = Math.sin(p * Math.PI);     // 0 → 1 → 0 (peak mid-swap)
    } else {
      m.uniforms.uGlitch.value = 0;
    }
  });

  return (
    <group {...props}>
      {/* Full-screen black backing — the rest of the monitor stays black. raycast
          off → taps reach the portal → zoom into the CRT. */}
      <mesh raycast={() => null} position={[0, 0, -0.006]}>
        <planeGeometry args={[screenWidth, screenHeight]} />
        <meshBasicMaterial color="#000000" toneMapped={false} />
      </mesh>

      {/* Transmission feed: model → ASCII + scanlines/glitch FX. key={index}
          remounts on a subject swap (clean GLB switch, masked by the glitch). */}
      <mesh raycast={() => null} position={[feed.x, feed.y, 0]}>
        <planeGeometry args={[feed.w, feed.h]} />
        <shaderMaterial ref={matRef} uniforms={uniforms} vertexShader={ASCII_VS} fragmentShader={ASCII_FS} toneMapped={false}>
          <RenderTexture attach="uniforms-uSource-value" width={fboSize} height={fboSize}>
            {/* Pulled back so the full figure + halo fits the square frame with
                headroom (was clipping the top); fboSize bump keeps the detail. */}
            <PerspectiveCamera makeDefault manual aspect={1} fov={32} position={[0, 0, 3.8]} />
            <color attach="background" args={['#000000']} />
            <ambientLight intensity={1.1} />
            <directionalLight position={[2, 3, 4]} intensity={2.4} />
            <directionalLight position={[-3, 1, 2]} intensity={1.0} color="#88aaff" />
            <Suspense fallback={null}>
              <AsciiModel
                key={index}
                url={subject.url}
                rock={subject.rock !== undefined ? subject.rock : rock}
                rockAmplitude={rockAmplitude}
                rockSpeed={rockSpeed}
                spin={subject.spin !== undefined ? subject.spin : spin}
                emissive={subject.emissive || null}
                emissiveIntensity={subject.emissiveIntensity}
                emissiveMatch={subject.emissiveMatch || null}
              />
            </Suspense>
          </RenderTexture>
        </shaderMaterial>
      </mesh>

      {/* Anchor at the feed-window centre (its +Z faces the viewer) — the camera
          fly-in reads its world transform to aim straight at the ASCII models. */}
      <object3D ref={feedAnchorRef} position={[feed.x, feed.y, 0]} />

      {/* [DATA] green code feed (borderless — the HUD frames it). */}
      <CrtCodeColumn position={[code.x, code.y, 0.002]} width={code.w} height={code.h} showBorder={false} />

      {/* Cyberpunk HUD chrome on top: header, frames, labels, waveform, footer. */}
      <HudOverlay position={[0, 0, 0.006]} screenWidth={screenWidth} screenHeight={screenHeight} infoRef={infoRef} />
    </group>
  );
}

// ── Cyberpunk HUD layout ─────────────────────────────────────────────────────
// Normalized rects (u,v with v=0 at the TOP) shared by the HUD chrome (one
// canvas) and the live panels behind it, so the frames line up with content.
const HUD = {
  header:  { u0: 0.03,  v0: 0.03,  u1: 0.97,  v1: 0.145 },
  footer:  { u0: 0.03,  v0: 0.905, u1: 0.97,  v1: 0.965 },
  code:    { u0: 0.03,  v0: 0.185, u1: 0.36,  v1: 0.62 },  // [DATA] frame
  codeImg: { u0: 0.045, v0: 0.255, u1: 0.345, v1: 0.605 }, // green text hole
  wave:    { u0: 0.03,  v0: 0.655, u1: 0.36,  v1: 0.875 }, // [SIGNAL] waveform
  feed:    { u0: 0.40,  v0: 0.185, u1: 0.97,  v1: 0.875 }, // [ICON-80] frame
  feedImg: { u0: 0.415, v0: 0.265, u1: 0.955, v1: 0.855 }, // ASCII hole
};
// Normalized rect → a screen-local plane {x,y,w,h} (origin centre, +y up).
function rectToPlane(r, sw, sh) {
  return {
    w: (r.u1 - r.u0) * sw,
    h: (r.v1 - r.v0) * sh,
    x: ((r.u0 + r.u1) / 2) * sw - sw / 2,
    y: sh / 2 - ((r.v0 + r.v1) / 2) * sh,
  };
}

// The full-screen HUD chrome — one animated canvas: header (title + count-up
// clock + LIVE + segment bars), cut-corner framed panels with bracket labels
// ([ICON-80]/[DATA]/[SIGNAL]), an animated waveform, a footer status line and
// screen corner brackets. Cyan with yellow accents, transparent over the panels.
const HUD_CY = '#37e3e3';
const HUD_CYd = 'rgba(75,210,210,0.42)';
const HUD_YL = '#ffd23a';
function HudOverlay({ screenWidth = 1.45, screenHeight = 1.0, infoRef, ...props }) {
  const matRef = useRef();
  useEffect(() => {
    const W = 768; // kept modest — re-uploaded ~14×/s; this page's GPU budget is tight
    const H = Math.round(W * (screenHeight / screenWidth));
    const canvas = document.createElement('canvas');
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d');
    const tex = new THREE.CanvasTexture(canvas);
    tex.minFilter = THREE.LinearFilter; tex.generateMipmaps = false;
    if (matRef.current) { matRef.current.map = tex; matRef.current.needsUpdate = true; }

    const px = (r) => ({ x: r.u0 * W, y: r.v0 * H, w: (r.u1 - r.u0) * W, h: (r.v1 - r.v0) * H });
    const cut = (x, y, w, h, c) => {
      ctx.beginPath();
      ctx.moveTo(x + c, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w, y + h - c);
      ctx.lineTo(x + w - c, y + h); ctx.lineTo(x, y + h); ctx.lineTo(x, y + c); ctx.closePath();
    };
    const brackets = (x, y, w, h, L, col) => {
      ctx.strokeStyle = col; ctx.lineWidth = 2;
      const seg = (a, b, c, d, e, f) => { ctx.beginPath(); ctx.moveTo(a, b); ctx.lineTo(c, d); ctx.lineTo(e, f); ctx.stroke(); };
      seg(x, y + L, x, y, x + L, y);
      seg(x + w - L, y, x + w, y, x + w, y + L);
      seg(x + w, y + h - L, x + w, y + h, x + w - L, y + h);
      seg(x + L, y + h, x, y + h, x, y + h - L);
    };
    const segs = (x, y, h, widths, col) => { ctx.fillStyle = col; let cx = x; widths.forEach((wd) => { ctx.fillRect(cx, y, wd, h); cx += wd + 4; }); };
    const label = (p, text) => {
      const tw = Math.min(p.w * 0.62, 18 + text.length * 9);
      ctx.fillStyle = HUD_YL; cut(p.x, p.y, tw, 20, 7); ctx.fill();
      ctx.fillStyle = '#06121a'; ctx.font = "bold 13px 'Courier New', monospace";
      ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
      ctx.fillText(text, p.x + 9, p.y + 11);
    };
    const panel = (r, text) => {
      const p = px(r);
      ctx.strokeStyle = HUD_CY; ctx.lineWidth = 2; cut(p.x, p.y, p.w, p.h, 14); ctx.stroke();
      brackets(p.x - 4, p.y - 4, p.w + 8, p.h + 8, 11, HUD_CYd);
      label(p, text);
    };

    const wave = new Array(60).fill(0).map(() => Math.random());
    let frame = 0;
    function draw() {
      ctx.clearRect(0, 0, W, H);
      brackets(7, 7, W - 14, H - 14, 28, HUD_CY);

      // header
      const hd = px(HUD.header);
      ctx.strokeStyle = HUD_CY; ctx.lineWidth = 2; cut(hd.x, hd.y, hd.w, hd.h, 16); ctx.stroke();
      ctx.fillStyle = HUD_YL; cut(hd.x, hd.y, hd.w * 0.32, hd.h * 0.5, 9); ctx.fill();
      ctx.fillStyle = '#06121a'; ctx.font = "bold 19px 'Courier New', monospace"; ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
      ctx.fillText('LIMINAL // RL80', hd.x + 14, hd.y + hd.h * 0.25);
      const t = frame * 0.07;
      const mm = String(Math.floor(t / 60) % 100).padStart(2, '0');
      const ss = String(Math.floor(t % 60)).padStart(2, '0');
      const cs = String(Math.floor((t * 100) % 100)).padStart(2, '0');
      ctx.fillStyle = HUD_CY; ctx.font = "bold 22px 'Courier New', monospace"; ctx.textAlign = 'center';
      ctx.fillText(`${mm}:${ss}:${cs}`, W * 0.5, hd.y + hd.h * 0.68);
      ctx.textAlign = 'left';
      const on = Math.floor(frame / 6) % 2 === 0;
      ctx.fillStyle = on ? '#ff4040' : 'rgba(255,64,64,0.22)';
      ctx.beginPath(); ctx.arc(hd.x + hd.w - 112, hd.y + hd.h * 0.5, 6, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = HUD_CY; ctx.font = "bold 15px 'Courier New', monospace";
      ctx.fillText('LIVE', hd.x + hd.w - 98, hd.y + hd.h * 0.5);
      segs(hd.x + hd.w * 0.40, hd.y + hd.h * 0.66, 6, [18, 10, 26, 8, 14, 6], HUD_CYd);

      // framed panels — the feed label tracks the current subject
      const info = (infoRef && infoRef.current) || {};
      panel(HUD.feed, info.label || '[ ICON-80 ]');
      panel(HUD.code, '[ DATA ]');
      panel(HUD.wave, '[ SIGNAL ]');

      // signal bars, top-right of the feed panel
      const fp = px(HUD.feed);
      const sb = 2 + Math.floor((Math.sin(frame * 0.25) * 0.5 + 0.5) * 3);
      for (let i = 0; i < 4; i++) { const bh = 6 + i * 5; ctx.fillStyle = i < sb ? HUD_CY : HUD_CYd; ctx.fillRect(fp.x + fp.w - 74 + i * 13, fp.y + 22 - bh, 9, bh); }

      // waveform inside the SIGNAL panel
      const wv = px(HUD.wave);
      if (frame % 2 === 0) { wave.push(Math.random()); wave.shift(); }
      ctx.strokeStyle = HUD_CY; ctx.lineWidth = 2; ctx.beginPath();
      for (let i = 0; i < wave.length; i++) {
        const x = wv.x + 10 + (i / (wave.length - 1)) * (wv.w - 20);
        const y = wv.y + wv.h * 0.62 + (wave[i] - 0.5) * (wv.h * 0.5);
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.stroke();

      // footer status line
      const ft = px(HUD.footer);
      ctx.strokeStyle = HUD_CYd; ctx.lineWidth = 1.5; cut(ft.x, ft.y, ft.w, ft.h, 8); ctx.stroke();
      ctx.fillStyle = HUD_CY; ctx.font = "12px 'Courier New', monospace"; ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
      ctx.fillText('STATUS: ONLINE   SUBJECT: ' + (info.name || '████') + '   ENC: AES-80   PKT ' + (1000 + frame % 9000), ft.x + 12, ft.y + ft.h * 0.5);
      segs(ft.x + ft.w - 120, ft.y + ft.h * 0.5 - 3, 6, [12, 8, 20, 6, 16], HUD_YL);

      tex.needsUpdate = true;
    }
    const id = setInterval(() => { frame++; draw(); }, 70);
    draw();
    return () => { clearInterval(id); tex.dispose(); };
  }, [screenWidth, screenHeight]);
  return (
    <mesh raycast={() => null} {...props}>
      <planeGeometry args={[screenWidth, screenHeight]} />
      <meshBasicMaterial ref={matRef} transparent depthWrite={false} toneMapped={false} />
    </mesh>
  );
}

// A small CRT "code" panel beside the ASCII figure — green monospace that types
// out forever (mostly unintelligible streaming glyphs + occasional tokens), with
// a blinking cursor and faint bordered box. Canvas-texture based and driven by a
// setInterval (cheaper than re-laying-out a drei <Text> every tick).
const CODE_CHARS = '0123456789ABCDEF<>{}[]()/\\|=+-*#$%&.:;_';
const CODE_TOKENS = ['0x', 'RUN', 'EXEC', 'RL80', 'OK', 'ERR', '>>', '::', 'SYS', 'ACK', 'MEM', 'NULL', '...'];

function CrtCodeColumn({ width = 0.34, height = 0.82, tick = 55, showBorder = true, ...props }) {
  const matRef = useRef();

  useEffect(() => {
    const canvasW = 220;
    const canvasH = Math.round(canvasW * (height / width));
    const canvas = document.createElement('canvas');
    canvas.width = canvasW;
    canvas.height = canvasH;
    const ctx = canvas.getContext('2d');
    const tex = new THREE.CanvasTexture(canvas);
    tex.minFilter = THREE.LinearFilter;
    tex.generateMipmaps = false;
    if (matRef.current) { matRef.current.map = tex; matRef.current.needsUpdate = true; }

    const FONT_PX = 13;
    const LINE_H = 16;
    const maxCols = Math.max(6, Math.floor((canvasW - 12) / (FONT_PX * 0.6)));
    const maxLines = Math.max(4, Math.floor((canvasH - 12) / LINE_H));
    const lines = [];
    let cur = '';
    let cursor = true;
    let blink = 0;
    const rnd = (a) => a[Math.floor(Math.random() * a.length)];

    function draw() {
      // transparent interior → the screen's black shows through (no green wash)
      ctx.clearRect(0, 0, canvasW, canvasH);
      if (showBorder) {
        ctx.strokeStyle = 'rgba(60,255,120,0.5)';
        ctx.lineWidth = 2;
        ctx.strokeRect(1, 1, canvasW - 2, canvasH - 2);
      }
      ctx.font = `${FONT_PX}px 'Courier New', monospace`;
      ctx.textBaseline = 'top';
      const all = lines.concat([cur + (cursor ? '█' : '')]);
      const start = Math.max(0, all.length - maxLines);
      for (let i = start; i < all.length; i++) {
        const t = (i - start) / Math.max(1, maxLines); // older = dimmer
        ctx.fillStyle = `rgba(70,255,130,${0.35 + t * 0.6})`;
        ctx.fillText(all[i], 6, 6 + (i - start) * LINE_H);
      }
      tex.needsUpdate = true;
    }

    const id = setInterval(() => {
      cur += Math.random() < 0.16 ? ' ' + rnd(CODE_TOKENS) + ' ' : rnd(CODE_CHARS);
      if (cur.length >= maxCols || Math.random() < 0.07) {
        lines.push(cur);
        if (lines.length > maxLines) lines.shift();
        cur = '';
      }
      if (++blink % 8 === 0) cursor = !cursor;
      draw();
    }, tick);

    draw();
    return () => { clearInterval(id); tex.dispose(); };
  }, [width, height, tick, showBorder]);

  return (
    <mesh raycast={() => null} {...props}>
      <planeGeometry args={[width, height]} />
      <meshBasicMaterial ref={matRef} transparent depthWrite={false} toneMapped={false} />
    </mesh>
  );
}

// CRT Screen with typing effect - now uses translations
// RTL languages for text direction
const RTL_LOCALES = ['ar', 'he', 'fa', 'ur'];

// Locales that need the Noto Sans Mono font (non-Latin scripts)
const NOTO_FONT_LOCALES = ['ja', 'ko', 'zh', 'ar', 'hi', 'ru'];

// Font paths
const FONT_ORBITRON = '/fonts/Orbitron.ttf';
const FONT_NOTO = '/fonts/NotoSansMono-VariableFont_wdth,wght.ttf';

// Get the appropriate font for a locale
const getFontForLocale = (locale) => {
  return NOTO_FONT_LOCALES.includes(locale) ? FONT_NOTO : FONT_ORBITRON;
};

// Get CSS font family stack for a locale
const getFontFamilyForLocale = (locale) => {
  if (NOTO_FONT_LOCALES.includes(locale)) {
    return "'Noto Sans Mono', 'Courier New', monospace";
  }
  return "'Courier New', 'Orbitron', monospace";
};

const getCrtTextSequence = (t, locale = 'en') => [
  { text: t('crtScreen.establishing') || '> ESTABLISHING CONNECTION...', type: 'command', delay: 800 },
  { text: t('crtScreen.receiving') || '> RECEIVING TRANSMISSION...', type: 'command', delay: 1000 },
  { text: '', type: 'pause', delay: 1000 },
  { text: t('crtScreen.coreModule') || 'RL80 CORE MODULE:', type: 'header', delay: 800 },
  { text: '', type: 'pause', delay: 400 },
  { text: t('scroll.credo.line1') || "We are trustless—", type: 'body', delay: 600 },
  { text: t('scroll.credo.line2') || 'But we believe', type: 'body', delay: 600 },
  { text: '', type: 'pause', delay: 300 },
  { text: t('scroll.credo.line3') || 'In code and cryptography', type: 'body', delay: 500 },
  { text: t('scroll.credo.line4') || 'In the purity of circuitry', type: 'body', delay: 600 },
  { text: '', type: 'pause', delay: 300 },
  { text: t('scroll.credo.line5') || 'In virtue over villainy', type: 'body', delay: 1000 },
  { text: t('scroll.credo.line6') || 'In the virtual machine', type: 'body', delay: 600 },
  { text: '', type: 'pause', delay: 1200 },
  { text: t('scroll.credo.line7') || 'Mater ex machina', type: 'highlight', delay: 3000 },
  { text: t('scroll.credo.line8') || 'Incorruptible integrity', type: 'body', delay: 600 },
  { text: '', type: 'pause', delay: 400 },
  { text: t('scroll.credo.line9') || 'An avatar of resistance', type: 'body', delay: 100 },
  { text: t('scroll.credo.line10') || 'in a market built to break you', type: 'body', delay: 1200 },
  { text: '', type: 'pause', delay: 600 },
  { text: t('crtScreen.holdWallet') || '> HOLD RL80 IN YOUR WALLET', type: 'command', delay: 600 },
  { text: t('crtScreen.rosary') || '> AS A ROSARY FOR PROSPERITY', type: 'command', delay: 0 },
];


// CRT Screen component with typing animation
function CRTScreen({ width = 2, height = 1.4, isActive = true, noBackground = false, onButtonClick, buttonText = "ENTER THE PORTAL", onLineComplete, textScale = 1, t, locale, ...props }) {
  const [displayedLines, setDisplayedLines] = useState([]);
  const [currentLineIndex, setCurrentLineIndex] = useState(0);
  const [currentCharIndex, setCurrentCharIndex] = useState(0);
  const [showCursor, setShowCursor] = useState(true);
  const [isTyping, setIsTyping] = useState(false);
  const [scrollOffset, setScrollOffset] = useState(0);
  const [animationComplete, setAnimationComplete] = useState(false);
  const [buttonHovered, setButtonHovered] = useState(false);
  const [buttonPulse, setButtonPulse] = useState(0);

  // Generate translated text sequence
  const crtTextSequence = useMemo(() => getCrtTextSequence(t, locale), [t, locale]);
  const isRTL = RTL_LOCALES.includes(locale);

  const lineHeight = 0.05 * textScale;
  const fontSize = 0.042 * textScale;
  // Start scrolling earlier to leave room for button at bottom
  const scrollThreshold = 8;
  // Top clipping - hide text before it goes above the screen
  const topClip = height / 2 - 0.02;
  // Bottom clipping - leave space for button
  const bottomClip = -height / 2 + 0.18 * textScale;

  // Reset animation when becoming active
  useEffect(() => {
    if (isActive) {
      setDisplayedLines([]);
      setCurrentLineIndex(0);
      setCurrentCharIndex(0);
      setScrollOffset(0);
      setAnimationComplete(false);
      // Delay before starting typing to let transmission effects play
      const timer = setTimeout(() => {
        setIsTyping(true);
      }, 1500); // 1.5 second delay
      return () => clearTimeout(timer);
    } else {
      setIsTyping(false);
    }
  }, [isActive]);

  // Detect when animation is complete
  useEffect(() => {
    if (currentLineIndex >= crtTextSequence.length && !animationComplete) {
      // Small delay before showing button
      const timer = setTimeout(() => {
        setAnimationComplete(true);
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [currentLineIndex, animationComplete]);

  // Button pulse animation
  useFrame(({ clock }) => {
    if (animationComplete) {
      setButtonPulse((Math.sin(clock.getElapsedTime() * 3) + 1) / 2);
    }
  });

  // Typing effect
  useEffect(() => {
    if (!isTyping || currentLineIndex >= crtTextSequence.length) {
      return;
    }

    const currentLine = crtTextSequence[currentLineIndex];
    const typingSpeed = currentLine.type === 'command' ? 25 : 35;

    // If it's a pause, wait then move to next line
    if (currentLine.type === 'pause') {
      const timer = setTimeout(() => {
        setDisplayedLines(prev => {
          const newLines = [...prev, { text: '', type: 'pause' }];
          // Scroll up if we exceed visible lines
          if (newLines.filter(l => l.type !== 'pause').length > scrollThreshold) {
            setScrollOffset(off => off + lineHeight);
          }
          return newLines;
        });
        setCurrentLineIndex(prev => prev + 1);
        setCurrentCharIndex(0);
      }, currentLine.delay);
      return () => clearTimeout(timer);
    }

    // If we haven't finished typing the current line
    if (currentCharIndex < currentLine.text.length) {
      const timer = setTimeout(() => {
        setCurrentCharIndex(prev => prev + 1);
      }, typingSpeed);
      return () => clearTimeout(timer);
    }

    // Line finished, wait then move to next
    const timer = setTimeout(() => {
      setDisplayedLines(prev => {
        const newLines = [...prev, { text: currentLine.text, type: currentLine.type }];
        // Scroll up if we exceed visible lines
        const textLines = newLines.filter(l => l.type !== 'pause').length;
        if (textLines > scrollThreshold) {
          setScrollOffset(off => off + lineHeight);
        }
        return newLines;
      });
      setCurrentLineIndex(prev => prev + 1);
      setCurrentCharIndex(0);
      onLineComplete?.(); // Play sound for each line
    }, currentLine.delay);

    return () => clearTimeout(timer);
  }, [isTyping, currentLineIndex, currentCharIndex, scrollThreshold, onLineComplete]);

  // Blinking cursor
  useEffect(() => {
    const cursorInterval = setInterval(() => {
      setShowCursor(prev => !prev);
    }, 530);
    return () => clearInterval(cursorInterval);
  }, []);

  // Get current typing line
  const currentLine = crtTextSequence[currentLineIndex];
  const typingText = currentLine && currentLine.type !== 'pause'
    ? currentLine.text.slice(0, currentCharIndex)
    : '';

  // Calculate line positions with scroll
  let lineIndex = 0;
  const getLineY = () => {
    const y = height / 2 - 0.06 - (lineIndex * lineHeight) + scrollOffset;
    lineIndex++;
    return y;
  };

  const getColor = (type) => {
    switch (type) {
      case 'command': return '#00ffaa';
      case 'header': return '#ffff00';
      case 'highlight': return '#ff00ff';
      default: return '#00ff88';
    }
  };

  const getFontSize = (type) => {
    switch (type) {
      case 'header': return fontSize * 1.2;
      case 'command': return fontSize * 0.9;
      default: return fontSize;
    }
  };

  return (
    <group {...props}>
      {/* Solid black background - small plane behind text only */}
      {!noBackground && (
        <mesh position={[0, 0, -0.01]}>
          <planeGeometry args={[width * 0.95, height * 0.95]} />
          <meshBasicMaterial color="#000000" transparent opacity={0.9} />
        </mesh>
      )}

      {/* Render completed lines */}
      {displayedLines.map((line, index) => {
        if (line.type === 'pause') {
          lineIndex++; // Still increment for spacing
          return null;
        }

        const y = height / 2 - 0.06 - (lineIndex * lineHeight) + scrollOffset;
        lineIndex++;

        // Don't render lines that have scrolled off screen or below button area
        if (y > topClip || y < bottomClip) return null;

        return (
          <Text
            key={index}
            position={[isRTL ? (width / 2 - 0.08) : (-width / 2 + 0.08), y, 0.02]}
            fontSize={getFontSize(line.type)}
            color={getColor(line.type)}
            anchorX={isRTL ? "right" : "left"}
            anchorY="top"
            font={getFontForLocale(locale)}
            maxWidth={width - 0.16}
            renderOrder={2}
          >
            {line.text}
          </Text>
        );
      })}

      {/* Current typing line with cursor */}
      {currentLine && currentLine.type !== 'pause' && currentLineIndex < crtTextSequence.length && (
        <Text
          position={[isRTL ? (width / 2 - 0.08) : (-width / 2 + 0.08), height / 2 - 0.06 - (lineIndex * lineHeight) + scrollOffset, 0.02]}
          fontSize={getFontSize(currentLine.type)}
          color={getColor(currentLine.type)}
          anchorX={isRTL ? "right" : "left"}
          anchorY="top"
          font={getFontForLocale(locale)}
          maxWidth={width - 0.16}
          renderOrder={2}
        >
          {isRTL ? `${showCursor ? '█' : ' '}${typingText}` : `${typingText}${showCursor ? '█' : ' '}`}
        </Text>
      )}

      {/* Clickable button after animation completes */}
      {animationComplete && (
        <group position={[0, -height / 2 + 0.12 * textScale, 0.02]}>
          {/* Button background */}
          <mesh
            onClick={(e) => {
              e.stopPropagation();
              onButtonClick?.();
            }}
            onPointerOver={() => {
              setButtonHovered(true);
              document.body.style.cursor = 'pointer';
            }}
            onPointerOut={() => {
              setButtonHovered(false);
              document.body.style.cursor = 'auto';
            }}
          >
            <planeGeometry args={[0.38 * textScale, 0.09 * textScale]} />
            <meshBasicMaterial
              color={buttonHovered ? '#00ff88' : '#004422'}
              transparent
              opacity={0.6 + buttonPulse * 0.4}
            />
          </mesh>
          {/* Button border */}
          <mesh position={[0, 0, -0.001]}>
            <planeGeometry args={[0.4 * textScale, 0.105 * textScale]} />
            <meshBasicMaterial
              color={buttonHovered ? '#00ffaa' : '#00ff66'}
              transparent
              opacity={0.3 + buttonPulse * 0.5}
            />
          </mesh>
          {/* Button text */}
          <Text
            position={[0, 0, 0.01]}
            fontSize={0.035 * textScale}
            color={buttonHovered ? '#ffffff' : '#00ffaa'}
            anchorX="center"
            anchorY="middle"
            font={getFontForLocale(locale)}
            renderOrder={4}
          >
            {buttonText}
          </Text>
        </group>
      )}

      {/* Scanline overlay - only when background is shown */}
      {!noBackground && (
        <mesh position={[0, 0, 0.03]} renderOrder={3}>
          <planeGeometry args={[width, height]} />
          <shaderMaterial
            transparent
            depthWrite={false}
            uniforms={{
              time: { value: 0 },
            }}
            vertexShader={`
              varying vec2 vUv;
              void main() {
                vUv = uv;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
              }
            `}
            fragmentShader={`
              varying vec2 vUv;
              void main() {
                float scanline = sin(vUv.y * 300.0) * 0.08;
                vec2 vignetteUV = vUv * (1.0 - vUv.yx);
                float vignette = vignetteUV.x * vignetteUV.y * 25.0;
                vignette = pow(vignette, 0.5);
                float alpha = (1.0 - vignette) * 0.2 + scanline * 0.3;
                gl_FragColor = vec4(0.0, 0.0, 0.0, alpha);
              }
            `}
          />
        </mesh>
      )}
    </group>
  );
}

// CRT overlay effect during transition
function CRTOverlay({ transition }) {
  const materialRef = useRef();

  useFrame(({ clock }) => {
    if (materialRef.current && materialRef.current.uniforms) {
      materialRef.current.uniforms.transition.value = transition;
      materialRef.current.uniforms.time.value = clock.getElapsedTime();
    }
  });

  if (transition <= 0) return null;

  return (
    <mesh position={[0, 0, 0.2]}>
      <planeGeometry args={[3, 2.2]} />
      <shaderMaterial
        ref={materialRef}
        args={[CRTTransitionMaterial]}
        transparent
        depthWrite={false}
      />
    </mesh>
  );
}

// Main Portal Scene
// Component to apply camera view offset (shifts view without affecting rotation center)
function CameraViewOffset({ offsetX = 0 }) {
  const { camera, size } = useThree();

  useEffect(() => {
    if (offsetX === 0) {
      camera.clearViewOffset();
    } else {
      // Use setViewOffset to shift the view
      // fullWidth/fullHeight = virtual canvas size (larger than actual)
      // width/height = actual canvas size
      // offsetX/offsetY = where to position the actual view within the virtual canvas
      const fullWidth = size.width * 1.5;
      const xOffset = (fullWidth - size.width) / 2 + (offsetX * size.width * 0.3);
      camera.setViewOffset(fullWidth, size.height, xOffset, 0, size.width, size.height);
    }
    camera.updateProjectionMatrix();

    return () => {
      camera.clearViewOffset();
      camera.updateProjectionMatrix();
    };
  }, [camera, offsetX, size]);

  return null;
}

// Scene lighting for the laptop — a key spotlight from the upper front plus a
// cool key-fill and a violet back-rim, so the body/keyboard read against the
// black page (the old scene had only a flat ambient). decay={0} keeps the
// intensities intuitive (no distance falloff), like the original MountSpotlight.
function LaptopLights({ isMobile = false }) {
  const spotRef = useRef();
  const targetRef = useRef();
  useEffect(() => {
    if (spotRef.current && targetRef.current) spotRef.current.target = targetRef.current;
  }, []);
  return (
    <>
      <ambientLight intensity={isMobile ? 0.7 : 0.85} />
      {/* key spotlight, upper-front, aimed at the laptop body */}
      <spotLight
        ref={spotRef}
        position={[2.4, 4, 4]}
        angle={0.85}
        penumbra={0.8}
        intensity={isMobile ? 6 : 5}
        decay={0}
        color="#fff2e6"
      />
      <object3D ref={targetRef} position={[0, -0.3, 0]} />
      {/* cool fill from the left to model the keys */}
      <pointLight position={[-2.4, 1.4, 2.6]} intensity={1.1} decay={0} color="#bcd8ff" />
      {/* violet back-rim to lift the lid off the black background */}
      <pointLight position={[0, 1.6, -3]} intensity={1.0} decay={0} color="#c8a8ff" />
    </>
  );
}

// Soft radial backglow behind the laptop — atmosphere + separation from the
// black page, and the Bloom pass picks it up as a halo. A plain transparent
// shader plane (NOT additive / CanvasTexture, to dodge the iOS artifact).
function Backglow({ color = '#5a2aa0', position = [0, 0.3, -2.2], size = [7, 6], strength = 0.6 }) {
  const uniforms = useMemo(
    () => ({ glow: { value: new THREE.Color(color) }, strength: { value: strength } }),
    [color, strength]
  );
  return (
    <mesh position={position}>
      <planeGeometry args={size} />
      <shaderMaterial
        transparent
        depthWrite={false}
        uniforms={uniforms}
        vertexShader={`
          varying vec2 vUv;
          void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
        `}
        fragmentShader={`
          uniform vec3 glow;
          uniform float strength;
          varying vec2 vUv;
          void main() {
            float d = length(vUv - 0.5) * 2.0;
            float a = smoothstep(1.0, 0.0, d);
            gl_FragColor = vec4(glow, a * a * strength);
          }
        `}
      />
    </mesh>
  );
}

function PortalScene({ isMobile = false, isTabletPortrait = false, onScreenClick, onBuyClick, onLineComplete, t, locale, feedAnchorRef }) {
  const [showScroll, setShowScroll] = useState(false);
  const [transition, setTransition] = useState(0);
  const transitionTarget = useRef(0);
  const screenRef = useRef();

  // Handle green key press - toggle between bare portal / CRT and zoom camera
  const handleKeyPress = () => {
    // For mobile/tablet portrait, skip the 3D CRT transition - use fullscreen overlay instead
    if (!isMobile && !isTabletPortrait) {
      transitionTarget.current = showScroll ? 0 : 1;
    }
    // Trigger camera zoom (or fullscreen overlay for mobile/tablet portrait)
    onScreenClick?.();
  };

  // Position for the laptop frame + the portal screen plane within it.
  const laptopPos = [0, isTabletPortrait ? -0.6 : -0.5, 0];
  const laptopScale = isMobile ? 1.5 : isTabletPortrait ? 0.75 : 0.9;
  const portalPos = [0, 0.65, -0.15];

  // Overall rotation to accentuate 3D dimensionality
  const sceneRotation = [0, 0.6, 0]; // rotate to the side

  // Handle transition animation (green-key → CRT toggle on desktop).
  useFrame((_, delta) => {
    const speed = 1.2; // lower = slower/longer effect
    if (transition < transitionTarget.current) {
      const newVal = Math.min(transition + delta * speed, transitionTarget.current);
      setTransition(newVal);
      // Switch content at midpoint of transition
      if (newVal >= 0.5 && !showScroll) {
        setShowScroll(true);
      }
    } else if (transition > transitionTarget.current) {
      const newVal = Math.max(transition - delta * speed, transitionTarget.current);
      setTransition(newVal);
      // Switch content at midpoint of transition
      if (newVal <= 0.5 && showScroll) {
        setShowScroll(false);
      }
    }
  });

  return (
    <group>
    <FloatingGroup amplitude={0} rotationAmplitude={(isMobile || showScroll) ? 0 : 0.04}>
    <group rotation={sceneRotation}>
      {/* The laptop frame with portal screen */}
      <LaptopFrame
        position={laptopPos}
        scale={laptopScale}
        screenRef={screenRef}
        onKeyPress={handleKeyPress}
        onScreenClick={onScreenClick}
      >
        {/* The portal world stays empty — the resting screen content (the ASCII
            decrypt) is rendered as an overlay IN FRONT of the screen below, the
            same way the CRT terminal text is. */}

        {/* Black/CRT screen background inside portal when showing CRT */}
        {showScroll && (
          <CRTBackground />
        )}
        {/* CRT transition overlay */}
        <CRTOverlay transition={transition > 0 && transition < 1 ? transition : 0} />
      </LaptopFrame>

      {/* ASCII decrypt — the resting laptop screen (shown when NOT zoomed into
          the CRT). Placed at the screen transform, in front of the portal glass,
          exactly like the CRT text overlay below. */}
      {!showScroll && (
        <group position={laptopPos} scale={laptopScale}>
          <group position={portalPos} rotation={[-0.35, 0, 0]}>
            {SCREEN_CONTENT === 'model'
              ? <AsciiModelScreen position={[0, 0, 0.02]} feedAnchorRef={feedAnchorRef} />
              : <AsciiDecryptScreen position={[0, 0, 0.02]} />}
          </group>
        </group>
      )}

      {/* CRT screen text - outside portal to follow screen transform */}
      {showScroll && (
        <group position={laptopPos} scale={laptopScale}>
          <group position={portalPos} rotation={[-0.35, 0, 0]}>
            <CRTScreen
              position={[0, 0.05, 0.02]}
              width={1.35}
              height={0.9}
              isActive={showScroll}
              noBackground={true}
              onButtonClick={onBuyClick}
              buttonText={t('crtScreen.buyButton') || "BUY RL80"}
              onLineComplete={onLineComplete}
              textScale={isMobile ? 0.7 : isTabletPortrait ? 0.65 : 1}
              t={t}
              locale={locale}
            />
          </group>
        </group>
      )}

      {/* Scene lighting + atmospheric backglow behind the laptop */}
      <Backglow />
      <LaptopLights isMobile={isMobile} />
    </group>
    </FloatingGroup>
    </group>
  );
}

// Loader component that waits for models before showing scene
function SceneLoader({ children }) {
  const [ready, setReady] = useState(false);
  const hasScheduledRef = useRef(false);

  useEffect(() => {
    // Subscribe to progress changes without causing re-renders during child renders
    const checkProgress = (state) => {
      if (state.progress === 100 && !state.active && !hasScheduledRef.current) {
        hasScheduledRef.current = true;
        setTimeout(() => setReady(true), 50);
      }
    };

    // Check initial state
    checkProgress(useProgress.getState());

    // Subscribe to future changes
    const unsubscribe = useProgress.subscribe(checkProgress);
    return unsubscribe;
  }, []);

  return (
    <group visible={ready}>
      {children}
    </group>
  );
}

// Main exported component
export default function TradeLaptop({ isMobile = false, isTabletPortrait = false, onZoomChange, viewOffsetX = 0, isActive = true }) {
  const [clientReady, setClientReady] = useState(false);
  const cameraControlsRef = useRef();
  const feedAnchorRef = useRef(); // world anchor at the ASCII feed centre (fly-in target)
  const savedViewRef = useRef(null); // camera pose captured on zoom-in, restored on exit
  const [isZoomedIn, setIsZoomedIn] = useState(false);
  const [showBuyModal, setShowBuyModal] = useState(false);
  const [showFullscreenCRT, setShowFullscreenCRT] = useState(false);

  // Get translations
  const { t, locale } = useLanguage();

  // Audio refs for sound effects
  const pressEnterSoundRef = useRef(null);
  const dataDisplaySoundRef = useRef(null);
  const digitalTextSoundRef = useRef(null);

  useEffect(() => {
    setClientReady(true);
    // Initialize audio elements
    pressEnterSoundRef.current = new Audio('/pressEnter.mp3');
    dataDisplaySoundRef.current = new Audio('/dataDisplay.mp3');
    digitalTextSoundRef.current = new Audio('/');
    pressEnterSoundRef.current.volume = 0.5;
    dataDisplaySoundRef.current.volume = 0.4;
    digitalTextSoundRef.current.volume = 0.3;
  }, []);

  // Notify parent when zoom state changes (either camera zoom or fullscreen CRT)
  useEffect(() => {
    onZoomChange?.(isZoomedIn || showFullscreenCRT);
  }, [isZoomedIn, showFullscreenCRT, onZoomChange]);

  // Reset state when section becomes inactive (user navigated away)
  useEffect(() => {
    if (!isActive && (isZoomedIn || showFullscreenCRT)) {
      // Stop all sounds
      [pressEnterSoundRef, dataDisplaySoundRef, digitalTextSoundRef].forEach(ref => {
        if (ref.current) {
          ref.current.pause();
          ref.current.currentTime = 0;
        }
      });
      // Reset zoom state
      setShowFullscreenCRT(false);
      setIsZoomedIn(false);
      // Reset camera position
      if (cameraControlsRef.current) {
        cameraControlsRef.current.setLookAt(0, 0, 3, 0, 0, 0, false);
      }
    }
  }, [isActive]);


  // Play sound effect helper
  const playSound = (audioRef) => {
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(() => {});
    }
  };

  // Toggle camera zoom or fullscreen CRT on mobile
  // Fly the camera straight at the ASCII feed window: aim at its world centre and
  // sit `dist` in front along its facing normal (so it dives directly toward the
  // models, not the old hand-tuned point). Returns false if the anchor isn't
  // mounted yet (e.g. ascii-art mode) so callers fall back to the old framing.
  const flyToFeed = (controls, dist) => {
    const a = feedAnchorRef.current;
    if (!a) return false;
    a.updateWorldMatrix(true, false);
    const p = new THREE.Vector3();
    a.getWorldPosition(p);
    const n = new THREE.Vector3(0, 0, 1).applyQuaternion(a.getWorldQuaternion(new THREE.Quaternion())).normalize();
    const camPos = new THREE.Vector3();
    controls.getPosition(camPos);
    if (n.dot(camPos.clone().sub(p)) < 0) n.negate(); // keep the camera on the viewing side
    const cam = p.clone().addScaledVector(n, dist);
    controls.setLookAt(cam.x, cam.y, cam.z, p.x, p.y, p.z, true);
    return true;
  };

  // Remember the exact camera pose at zoom-in so exiting returns to it (rather
  // than a hardcoded default, which sat slightly off the real resting view).
  const saveView = (controls) => {
    const pos = new THREE.Vector3();
    const tgt = new THREE.Vector3();
    controls.getPosition(pos);
    controls.getTarget(tgt);
    savedViewRef.current = { pos, tgt };
  };
  const restoreView = (transition = true) => {
    const controls = cameraControlsRef.current;
    if (!controls) return;
    const v = savedViewRef.current;
    if (v) controls.setLookAt(v.pos.x, v.pos.y, v.pos.z, v.tgt.x, v.tgt.y, v.tgt.z, transition);
    else controls.setLookAt(0, 0, 3, 0, 0, 0, transition);
  };

  const handleCameraZoom = () => {
    if (!cameraControlsRef.current) return;

    const controls = cameraControlsRef.current;

    // On mobile/tablet portrait, show fullscreen CRT overlay
    if (isMobile || isTabletPortrait) {
      if (showFullscreenCRT) {
        // Exiting: hide overlay first, then return to the pre-zoom view
        setShowFullscreenCRT(false);
        setTimeout(() => {
          restoreView(true);
          setIsZoomedIn(false);
        }, 300);
      } else {
        // Entering: play key press sound and zoom in
        playSound(pressEnterSoundRef);

        // Remember where we were, then reset (instant) to clear any manual rotation
        saveView(controls);
        controls.reset(false);
        // Use requestAnimationFrame to ensure reset is processed before zoom animation
        requestAnimationFrame(() => {
          // Dive straight toward the ASCII feed window.
          if (!flyToFeed(controls, isMobile ? 0.9 : 1.0)) {
            // Fallback (e.g. ascii-art mode): the old hand-tuned framing.
            const distance = isMobile ? 0.6 : 0.8;
            const sceneRotY = 0.55;
            const camX = Math.sin(sceneRotY) * distance;
            const camZ = Math.cos(sceneRotY) * distance;
            const camY = isTabletPortrait ? 0.05 : 0.58;
            const targetY = isTabletPortrait ? -0.1 : 0.65;
            controls.setLookAt(camX, camY, camZ, -0.2, targetY, -0.2, true);
          }
        });
        setIsZoomedIn(true);
        // Show fullscreen overlay after zoom animation, play data display sound
        setTimeout(() => {
          setShowFullscreenCRT(true);
          playSound(dataDisplaySoundRef);
        }, 600); // Delay to let camera zoom complete
      }
      return;
    }

    // Desktop behavior - just zoom
    if (isZoomedIn) {
      // Zoom out: return to the pre-zoom view
      restoreView(true);
      setIsZoomedIn(false);
    } else {
      // Entering: play key press sound and zoom in
      playSound(pressEnterSoundRef);
      // Play data display sound when CRT content appears (after transition)
      setTimeout(() => {
        playSound(dataDisplaySoundRef);
      }, 500);
      // Remember where we were, then reset (instant) to clear any manual rotation
      saveView(controls);
      controls.reset(false);
      // Use requestAnimationFrame to ensure reset is processed before zoom animation
      requestAnimationFrame(() => {
        // Dive straight toward the ASCII feed window.
        if (!flyToFeed(controls, 1.1)) {
          // Fallback (e.g. ascii-art mode): the old hand-tuned framing.
          const distance = 1.0;
          const sceneRotY = 0.55;
          const camX = Math.sin(sceneRotY) * distance;
          const camZ = Math.cos(sceneRotY) * distance;
          controls.setLookAt(camX - 0.32, 0.15, camZ, -0.55, 0.05, -0.2, true);
        }
      });
      setIsZoomedIn(true);
    }
  };

  return (
    <div style={{
      width: '100%',
      height: '100%',
      ...((isMobile || isTabletPortrait) && {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
      }),
    }}>
      <Canvas
        gl={{
          antialias: true,
          alpha: true,
        }}
        camera={{
          fov: 50,
          position: [0, 0.5, 5],
          near: 0.1,
          far: 100
        }}
        style={{
          width: '100%',
          height: '100%',
          background: 'transparent',
        }}
      >
        <Suspense fallback={null}>
          {/* Apply view offset to shift laptop to left side without affecting rotation */}
          {!isMobile && viewOffsetX !== 0 && <CameraViewOffset offsetX={viewOffsetX} />}
          <SceneLoader>
            <PortalScene
              isMobile={isMobile}
              isTabletPortrait={isTabletPortrait}
              feedAnchorRef={feedAnchorRef}
              onScreenClick={handleCameraZoom}
              onBuyClick={() => setShowBuyModal(true)}
              onLineComplete={() => {
                if (digitalTextSoundRef.current) {
                  digitalTextSoundRef.current.currentTime = 0;
                  digitalTextSoundRef.current.play().catch(() => {});
                }
              }}
              t={t}
              locale={locale}
            />
          </SceneLoader>
          <CameraControls
            ref={cameraControlsRef}
            makeDefault
            target={[0, 0, 0]}
            minAzimuthAngle={-Math.PI / 2.5}
            maxAzimuthAngle={Math.PI / 2.5}
            minPolarAngle={0.5}
            maxPolarAngle={Math.PI / 2}
            minDistance={0.5}
            maxDistance={3}
            dollySpeed={0}
            truckSpeed={0}
            mouseButtons={{
              left: 1,    // ROTATE - enable left-click drag to rotate
              middle: 0,  // NONE
              right: 0,   // NONE
              wheel: 0,   // NONE - allow page scroll
            }}
            touches={{
              one: 1,     // ROTATE - enable single touch rotation
              two: 0,     // NONE - disable two-finger gestures
              three: 0,   // NONE
            }}
          />
          <EffectComposer>
            <Bloom
              intensity={BLOOM.intensity}
              radius={BLOOM.radius}
              luminanceThreshold={BLOOM.threshold}
              luminanceSmoothing={0.9}
              mipmapBlur
            />
          </EffectComposer>
        </Suspense>
      </Canvas>

      {/* Buy Modal */}
      <BuyModal
        isOpen={showBuyModal}
        onClose={() => {
          setShowBuyModal(false);
          // Return to the pre-zoom view when the modal closes
          restoreView(true);
          setIsZoomedIn(false);
          setShowFullscreenCRT(false);
        }}
      />

      {/* Fullscreen CRT Overlay - rendered via portal to escape carousel transforms */}
      {typeof document !== 'undefined' && createPortal(
        <FullscreenCRTOverlay
          isActive={showFullscreenCRT}
          onClose={() => {
            // Fade out overlay, then return to the pre-zoom view
            setShowFullscreenCRT(false);
            setTimeout(() => {
              restoreView(true);
              setIsZoomedIn(false);
            }, 300);
          }}
          onLineComplete={() => {
            if (digitalTextSoundRef.current) {
              digitalTextSoundRef.current.currentTime = 0;
              digitalTextSoundRef.current.play().catch(() => {});
            }
          }}
          locale={locale}
          textSequence={getCrtTextSequence(t, locale)}
          terminalTitle={t('crtScreen.terminalTitle') || 'RL80 TERMINAL v1.0'}
          terminalStatus={t('crtScreen.secureConnection') || 'SECURE CONNECTION'}
          tapToReturnLabel={t('crtScreen.tapToReturn') || '> tap anywhere to return'}
          actionButton={{
            label: t('crtScreen.buyButton') || 'BUY RL80',
            onClick: () => {
              setShowFullscreenCRT(false);
              setShowBuyModal(true);
            },
          }}
        />,
        document.body
      )}
    </div>
  );
}

// Preload the models
useGLTF.preload('/models/laptop.glb');
useGLTF.preload('/models/CyberpunkMaryHeartRed3.glb');
useGLTF.preload('/models/Brain.glb');
