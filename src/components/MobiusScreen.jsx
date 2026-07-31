import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { tierValue } from '@/lib/deviceTier'

// MobiusScreen — paints an infinitely-morphing Möbius / spiral-cell shader onto
// one of the trade-scene monitor canvases (the 512x320 canvases wired up by
// VideoScreens.jsx). It matches the CRTScreen/DetectiveScreen painter contract:
// it looks up window[canvasGlobal] (a 2D canvas) + window[textureGlobal] (its
// CanvasTexture), and each frame it writes new pixels then flags the texture for
// upload.
//
// Since the effect is a WebGL fragment shader (not 2D-canvas drawing), we run it
// in a small offscreen WebGLRenderer and blit the result onto the shared 2D
// canvas with drawImage(). That keeps this component a drop-in painter — no
// changes to how VideoScreens binds textures to the Screen meshes — and lets us
// keep the scene's conventions: throttled to 30fps, paused when the tab is
// hidden, and yielding the canvas to EvidenceScreens while the player is reading
// a question's evidence (canvas.dataset.evidenceActive === 'true').
//
// Adapted from Pixelomo's "Möbius Cells" pen (MIT):
// https://codepen.io/pixelomo/pen/dPOWKXa
//   - i&1 bitwise op rewritten as a mod() check (invalid in GLSL ES 1.00, which
//     is what THREE.ShaderMaterial compiles by default; strict drivers reject it)
//   - full-screen three.min.js sketch reworked into an offscreen renderer sized
//     to the target canvas

const vertexShader = /* glsl */ `
  void main() { gl_Position = vec4(position, 1.0); }
`

const fragmentShader = /* glsl */ `
  precision highp float;
  uniform vec2  iResolution;
  uniform float iTime;
  uniform float uScrollSpeed;
  uniform float uWaveFreq;
  uniform float uWaveAmp;
  uniform float uCameraRoll;
  uniform float uSpiral1Strength;
  uniform float uSpiral1Radius;
  uniform float uSpiral2Strength;
  uniform float uSpiral2Radius;
  uniform float uSpiralBlendLow;
  uniform float uSpiralBlendHigh;
  uniform float uBlockScale;
  uniform float uBlockRounding;
  uniform float uBlockInset;
  uniform float uBlockRimWidth;
  uniform float uBlockLineWidth;
  uniform float uExtrusion;
  uniform float uHueShift;
  uniform float uSaturation;
  uniform float uPalette1Spread;
  uniform float uPalette2Spread;
  uniform float uPalette2Offset;
  uniform float uFloorColor;
  uniform float uLightX;
  uniform float uLightY;
  uniform float uLightZ;
  uniform float uAmbientStrength;
  uniform float uSpecPower;
  uniform float uSpecStrength;
  uniform float uShadowSharpness;
  uniform float uAoStrength;
  uniform float uRimInner;
  uniform float uRimOuter;
  uniform float uCamY;
  uniform float uCamZ;
  uniform float uFov;

  #define FAR 10.0
  const vec2 rDim = vec2(1.0, 4.0);

  float objID;
  vec2  gP;
  float tempR;
  vec4  gID;

  mat2 rot2(float a) {
    float c = cos(a), s = sin(a);
    return mat2(c, -s, s, c);
  }

  float opExtrusion(float sdf, float pz, float h) {
    vec2 w = vec2(sdf, abs(pz) - h);
    return min(max(w.x, w.y), 0.0) + length(max(w, 0.0));
  }

  float hm(vec2 p) {
    return sin(6.2831 * (p.y * uWaveFreq + p.x) + iTime * 2.0) * uWaveAmp + uWaveAmp;
  }

  float sBoxS(vec2 p, vec2 b, float sf) {
    vec2 d = abs(p) - b + sf;
    return min(max(d.x, d.y), 0.0) + length(max(d, 0.0)) - sf;
  }

  vec2 cMul(vec2 z, vec2 w) { return mat2(z.x, z.y, -z.y, z.x) * w; }
  vec2 cInv(vec2 z) { return vec2(z.x, -z.y) / dot(z, z); }
  vec2 cDiv(vec2 z, vec2 w) { return cMul(z, cInv(w)); }
  vec2 cLog(vec2 z) { return vec2(log(length(z)), atan(z.y, z.x)); }
  vec2 caTanh(vec2 z, float sc) {
    return cLog(cDiv(vec2(sc, 0.0) + z, vec2(sc, 0.0) - z));
  }

  vec4 blocks(vec3 q3) {
    vec2 scale = vec2(uBlockScale);
    vec2 l = scale;
    vec2 s = scale * 2.0;
    float d = 1e5;
    float data = 0.0;
    vec4 bestID = vec4(0.0);

    vec2 ps4[4];
    ps4[0] = vec2(-0.25,  0.25);
    ps4[1] = vec2( 0.25,  0.25);
    ps4[2] = vec2( 0.5,  -0.25);
    ps4[3] = vec2( 0.0,  -0.25);

    for (int i = 0; i < 24; i++) {
      vec2 p = q3.xy;
      vec2 ip = floor(p / s - ps4[i]);
      vec2 idi = (ip + 0.5 + ps4[i]) * s;
      p -= idi;
      vec2 index = mod(idi, rDim.yx) / rDim.yx;
      float h = hm(index) * tempR * 0.1;
      float di2D = sBoxS(p, l * 0.5 - uBlockInset, uBlockRounding);
      float di = opExtrusion(di2D, q3.z + h - 1.0, (h + 1.0) * uExtrusion);
      if (di < d) {
        d = di;
        bestID = vec4(d, idi, di2D);
        data = di2D;
        gP = p;
      }
    }
    return vec4(d, bestID.yz, data);
  }

  float map(vec3 p) {
    float fl = -p.z + 0.01;
    vec2 z = rot2(-sin(iTime / 3.0) * uSpiral1Strength) * p.xy;
    float r = min(length(z - vec2(uSpiral1Radius, 0.0)), length(z - vec2(-uSpiral1Radius, 0.0)));
    tempR = r;
    z = caTanh(-z, uSpiral1Radius) / 6.2831;
    vec2 z2 = rot2(-cos(iTime / 3.0) * uSpiral2Strength) * p.xy;
    float r2 = min(length(z2 - vec2(uSpiral2Radius, 0.0)), length(z2 - vec2(-uSpiral2Radius, 0.0)));
    tempR = min(tempR, r2);
    z += caTanh(z2, uSpiral2Radius) / 6.2831;
    tempR = smoothstep(uSpiralBlendLow, uSpiralBlendHigh, tempR);
    z.y = fract(z.y + iTime * uScrollSpeed);
    z = cMul(rDim, z);
    p.xy = z;
    vec4 d4 = blocks(p);
    gID = d4;
    objID = d4.x < fl ? 0.0 : 1.0;
    return min(d4.x, fl);
  }

  float trace(vec3 ro, vec3 rd) {
    float t = 0.0;
    for (int i = 0; i < 128; i++) {
      float d = map(ro + rd * t);
      if (abs(d) < 0.001 || t > FAR) break;
      t += d * 0.8;
    }
    return min(t, FAR);
  }

  vec3 getNormal(vec3 p) {
    float sgn = 1.0;
    vec3 e = vec3(0.001, 0.0, 0.0);
    vec3 mp = vec3(0.0);
    for (int i = 0; i < 6; i++) {
      mp.x += map(p + sgn * e) * sgn;
      sgn = -sgn;
      if (mod(float(i), 2.0) == 1.0) { mp = mp.yzx; e = e.zxy; }
    }
    return normalize(mp);
  }

  float softShadow(vec3 ro, vec3 lp, vec3 n, float k) {
    ro += n * 0.015;
    vec3 rd = lp - ro;
    float shade = 1.0;
    float end = max(length(rd), 0.0001);
    rd /= end;
    float t = 0.02;
    for (int i = 0; i < 16; i++) {
      float d = map(ro + rd * t);
      shade = min(shade, k * d / t);
      t += clamp(d, 0.01, 0.1);
      if (d < 0.0 || t > end) break;
    }
    return max(shade, 0.0);
  }

  float calcAO(vec3 p, vec3 n) {
    float occ = 1.0;
    float ds = 0.01;
    float k = 0.05 / ds;
    float dst = ds * 2.0;
    for (int i = 0; i < 5; i++) {
      occ -= (dst - map(p + n * dst)) * k;
      dst += ds;
      k *= 0.5;
    }
    return clamp(occ, 0.0, 1.0);
  }

  void main() {
    vec2 uv = (gl_FragCoord.xy - iResolution.xy * 0.5) / iResolution.y;
    vec3 ro  = vec3(0.0, uCamY, uCamZ);
    vec3 lk  = ro + vec3(0.0, 0.1, 0.5);
    vec3 lp  = ro + vec3(uLightX, uLightY, uLightZ);
    vec3 fwd = normalize(lk - ro);
    vec3 rgt = normalize(vec3(fwd.z, 0.0, -fwd.x));
    vec3 up  = cross(fwd, rgt);
    vec3 rd  = normalize(uv.x * rgt + uv.y * up + fwd / uFov);
    rd.xy = rot2(sin(iTime) / 32.0 * uCameraRoll) * rd.xy;

    float t = trace(ro, rd);
    vec4  svGID   = gID;
    float svObjID = objID;
    float svTempR = tempR;
    vec3 col = vec3(0.0);

    if (t < FAR) {
      vec3 sp = ro + rd * t;
      vec3 sn = getNormal(sp);
      vec3 ld = lp - sp;
      float lDist = max(length(ld), 0.001);
      ld /= lDist;
      float sh    = softShadow(sp, lp, sn, uShadowSharpness);
      float ao    = calcAO(sp, sn);
      float atten = 1.0 / (1.0 + lDist * 0.05);
      float diff  = max(dot(sn, ld), 0.0);
      float spec  = pow(max(dot(reflect(-ld, sn), -rd), 0.0), uSpecPower);
      float Schlick = pow(1.0 - max(dot(rd, normalize(rd + ld)), 0.0), 5.0);
      float freS  = mix(0.15, 1.0, Schlick);
      vec3 texCol = vec3(0.6);

      if (svObjID < 0.5) {
        vec2 index = mod(svGID.yz, rDim.yx) / rDim.yx;
        float hueBase = index.y + uHueShift;
        vec3 col1 = 0.5 + uSaturation * cos(6.2831 * hueBase + vec3(0.0, 1.0, 2.0) * uPalette1Spread);
        vec3 col2 = 0.5 + uSaturation * cos(6.2831 * hueBase + uPalette2Offset + vec3(0.0, 1.0, 2.0) * uPalette2Spread);
        texCol = col1;

        float di2D = svGID.w;
        vec3 spOff;
        spOff = sp - vec3(3.0 / 150.0, 0.0, 0.0);
        map(spOff);
        float di2DX = gID.w;
        spOff = sp - vec3(0.0, 3.0 / 150.0, 0.0);
        map(spOff);
        float di2DY = gID.w;
        float sf = length(vec2(di2DX, di2DY) - di2D);

        texCol = mix(texCol, vec3(0.0), (1.0 - smoothstep(0.0, sf, svGID.w + uBlockRimWidth)) * uRimInner);
        texCol = mix(texCol, col2,      (1.0 - smoothstep(0.0, sf, svGID.w + uBlockRimWidth + 0.005)));

        float dS = abs(svGID.w) - uBlockLineWidth * 0.5;
        texCol = mix(texCol, texCol / 3.0, (1.0 - smoothstep(0.0, sf, dS)));

        float h2 = hm(index);
        dS = max(dS, abs(sp.z + h2 * 0.1 * svTempR * 2.0) - uBlockLineWidth * 0.5);
        texCol = mix(texCol, vec3(0.0), (1.0 - smoothstep(0.0, sf, dS)) * uRimOuter);
      } else {
        texCol = vec3(uFloorColor);
      }

      col = texCol * (diff * sh + uAmbientStrength + vec3(1.0, 0.87, 0.82) * spec * freS * uSpecStrength * sh);
      col *= mix(1.0, ao, uAoStrength) * atten;
    }

    gl_FragColor = vec4(sqrt(max(col, 0.0)), 1.0);
  }
`

// Uniform seed values (identical to the pen's defaults).
const BASE_UNIFORMS = {
  uScrollSpeed: 0.1,
  uWaveFreq: 2.0,
  uWaveAmp: 0.5,
  uCameraRoll: 1.0,
  uSpiral1Strength: 0.65,
  uSpiral1Radius: 1.5,
  uSpiral2Strength: 0.8,
  uSpiral2Radius: 0.75,
  uSpiralBlendLow: 0.1,
  uSpiralBlendHigh: 0.5,
  uBlockScale: 0.25,
  uBlockRounding: 0.02,
  uBlockInset: 0.0035,
  uBlockRimWidth: 0.04,
  uBlockLineWidth: 0.0035,
  uExtrusion: 1.0,
  uHueShift: 0.0,
  uSaturation: 0.75,
  uPalette1Spread: 1.0,
  uPalette2Spread: 3.35,
  uPalette2Offset: 2.257,
  uFloorColor: 0.0,
  uLightX: -0.75,
  uLightY: 1.0,
  uLightZ: 1.0,
  uAmbientStrength: 0.7,
  uSpecPower: 32.0,
  uSpecStrength: 3.0,
  uShadowSharpness: 16.0,
  uAoStrength: 1.0,
  uRimInner: 0.95,
  uRimOuter: 1.0,
  uCamY: -1.5,
  uCamZ: -3.3,
  uFov: 1.0,
}

// Which uniforms slowly drift, and their random target ranges (from the pen).
const MORPH_RANGES = {
  uWaveFreq: { min: 0.0, max: 1.0 },
  uWaveAmp: { min: 0.0, max: 1.0 },
  uSpiral1Strength: { min: 1.0, max: 2.0 },
  uSpiral1Radius: { min: 1.0, max: 2.0 },
  uSpiral2Strength: { min: 0.5, max: 1.0 },
  uSpiral2Radius: { min: 0.0, max: 1.0 },
  uBlockScale: { min: 0.3, max: 0.6 },
  uBlockRounding: { min: 0.0, max: 0.3 },
  uBlockInset: { min: 0.0, max: 0.02 },
  uBlockRimWidth: { min: 0.0, max: 0.15 },
  uBlockLineWidth: { min: 0.0, max: 0.2 },
  uHueShift: { min: 0.0, max: 1.6 },
  uPalette1Spread: { min: 0.5, max: 5.0 },
  uPalette2Spread: { min: 0.5, max: 7.0 },
  uExtrusion: { min: 1.1, max: 1.7 },
  uFov: { min: 0.4, max: 1.3 },
}

const randomInRange = (min, max) => min + Math.random() * (max - min)
const easeInOut = (t) => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t)

const MobiusScreen = ({
  canvasGlobal = '__screen4Canvas',
  textureGlobal = '__screen4Texture',
  // Tiered: this is the most expensive painter on the page (its own WebGL
  // context, raymarched). A tablet gets a third of the frames.
  fps = tierValue({ desktop: 30, touch: 10 }),
  // Internal render scale — the shader is raymarched, so this is the biggest
  // perf lever. 0.75 (=384x240 on a 512x320 screen) reads crisp on an in-world
  // monitor while leaving headroom for the rest of the trade scene.
  // Halving this quarters the raymarch cost — on a monitor this size in
  // world space, nobody can tell.
  renderScale = tierValue({ desktop: 0.75, touch: 0.5 }),
  // Paint an "analysis HUD" over the shader so the monitor reads as if it's
  // performing live pattern analysis on the Möbius field (scan sweep, lock-on
  // reticles, feature boxes, telemetry that tracks the morph state).
  overlay = true,
  label = 'PATTERN ANALYSIS',
}) => {
  const rafRef = useRef(0)

  useEffect(() => {
    // The shared 2D canvas may not exist yet on the first mount tick (VideoScreens
    // creates it once the GLB has traversed). Poll briefly until it appears.
    let disposed = false
    let renderer = null
    let material = null
    let geometry = null
    let glCanvas = null
    let lastFrame = 0
    let lastTime = performance.now()
    let elapsed = 0
    let contextAttempts = 0
    let retryTimer = 0
    const MAX_CONTEXT_ATTEMPTS = 10

    const FRAME_INTERVAL = 1000 / fps
    let hidden = document.hidden
    const onVis = () => {
      hidden = document.hidden
      // Avoid a large delta jump when the tab comes back.
      lastTime = performance.now()
    }
    document.addEventListener('visibilitychange', onVis)

    // Morph state — cross-fade the live uniform values toward random targets.
    const live = { ...BASE_UNIFORMS }
    const morph = {
      from: {},
      to: {},
      progress: 0,
      duration: 8,
    }
    const newTarget = () => {
      const t = {}
      for (const k in MORPH_RANGES) t[k] = randomInRange(MORPH_RANGES[k].min, MORPH_RANGES[k].max)
      return t
    }
    for (const k in MORPH_RANGES) morph.from[k] = live[k]
    morph.to = newTarget()

    const updateMorph = (delta) => {
      morph.progress += delta / morph.duration
      if (morph.progress >= 1) {
        for (const k in MORPH_RANGES) morph.from[k] = live[k]
        morph.progress = 0
        morph.to = newTarget()
        morph.duration = 8 + Math.random() * 8
      }
      const e = easeInOut(Math.min(morph.progress, 1))
      for (const k in MORPH_RANGES) live[k] = morph.from[k] + (morph.to[k] - morph.from[k]) * e
    }

    const start = () => {
      // These are re-read every frame in draw(), not captured for the life of
      // the effect: VideoScreens rebuilds the screen canvases whenever the
      // temple model reloads (the talk-show swap unmounts it), and the painter
      // that keeps pointing at the old canvas is the one that comes back blank.
      // CRTScreen/DetectiveScreen already work this way — match them.
      let canvas = window[canvasGlobal]
      let texture = window[textureGlobal]
      if (!canvas || !texture) {
        if (!disposed) rafRef.current = requestAnimationFrame(start)
        return
      }

      let W = canvas.width
      let H = canvas.height
      let rw = Math.max(2, Math.round(W * renderScale))
      let rh = Math.max(2, Math.round(H * renderScale))

      glCanvas = document.createElement('canvas')
      glCanvas.width = rw
      glCanvas.height = rh

      try {
        renderer = new THREE.WebGLRenderer({
          canvas: glCanvas,
          antialias: true,
          alpha: false,
          powerPreference: 'low-power',
        })
      } catch (err) {
        // No spare WebGL context right now. This used to give up for good,
        // which left the screen dark forever — and a temple reload is exactly
        // when contexts are most contended (the outgoing scene's may not be
        // reclaimed yet). Back off and try again instead.
        glCanvas = null
        contextAttempts += 1
        if (contextAttempts === 1) {
          console.warn('[MobiusScreen] could not create WebGL context, retrying:', err)
        }
        if (!disposed && contextAttempts <= MAX_CONTEXT_ATTEMPTS) {
          retryTimer = setTimeout(() => {
            retryTimer = 0
            if (!disposed) rafRef.current = requestAnimationFrame(start)
          }, 600)
        }
        return
      }
      renderer.setPixelRatio(1)
      renderer.setSize(rw, rh, false)

      const scene = new THREE.Scene()
      const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)

      const uniforms = { iResolution: { value: new THREE.Vector2(rw, rh) }, iTime: { value: 0 } }
      for (const k in BASE_UNIFORMS) uniforms[k] = { value: BASE_UNIFORMS[k] }

      material = new THREE.ShaderMaterial({ vertexShader, fragmentShader, uniforms })
      geometry = new THREE.PlaneGeometry(2, 2)
      scene.add(new THREE.Mesh(geometry, material))

      let ctx = canvas.getContext('2d')

      // Re-point at the current screen canvas. Returns false while there is
      // nothing to paint onto (between a temple unmount and VideoScreens
      // rebuilding the canvases), so draw() just idles that frame.
      const retarget = () => {
        const nextCanvas = window[canvasGlobal]
        const nextTexture = window[textureGlobal]
        if (!nextCanvas || !nextTexture) return false
        texture = nextTexture
        if (nextCanvas === canvas) return true

        canvas = nextCanvas
        ctx = canvas.getContext('2d')
        if (canvas.width !== W || canvas.height !== H) {
          W = canvas.width
          H = canvas.height
          rw = Math.max(2, Math.round(W * renderScale))
          rh = Math.max(2, Math.round(H * renderScale))
          renderer.setSize(rw, rh, false)
          uniforms.iResolution.value.set(rw, rh)
          features = makeFeatures()
        }
        return true
      }

      // ---- analysis-HUD state ------------------------------------------------
      const t0 = performance.now() // overlay clock (independent of the slow shader clock)
      const FEATURE_LABELS = ['CELL', 'NODE', 'SEAM', 'LOOP', 'TWIST', 'FLUX', 'KNOT']
      const makeFeatures = () => {
        const n = 2 + (Math.random() < 0.5 ? 1 : 0)
        const arr = []
        for (let i = 0; i < n; i++) {
          const fw = 46 + Math.random() * 46
          const fh = 32 + Math.random() * 34
          const fx = 34 + Math.random() * Math.max(1, W - 68 - fw)
          const fy = 30 + Math.random() * Math.max(1, H - 66 - fh)
          const id = '0x' + ((Math.random() * 4096) | 0).toString(16).toUpperCase().padStart(3, '0')
          arr.push({
            x: fx, y: fy, w: fw, h: fh,
            label: FEATURE_LABELS[(Math.random() * FEATURE_LABELS.length) | 0] + ' ' + id,
            conf: 0.6 + Math.random() * 0.39,
          })
        }
        return arr
      }
      let features = makeFeatures()
      let lastProgress = 0
      let shiftFlashUntil = 0 // "PATTERN SHIFT → RESYNC" flash window

      const paintAnalysis = (now) => {
        const CY = '130,240,255'
        const GR = '120,255,180'
        const AM = '255,170,80'
        const ot = (now - t0) / 1000
        const progress = Math.min(morph.progress, 1)
        const ease = easeInOut(progress)
        const shifting = now < shiftFlashUntil

        let conf = 0.42 + 0.55 * ease + 0.02 * Math.sin(ot * 6)
        if (shifting) conf *= 0.35
        conf = Math.max(0, Math.min(0.999, conf))

        const status = shifting ? 'RESYNC'
          : progress < 0.12 ? 'ACQUIRE'
          : conf > 0.9 ? 'LOCKED' : 'ANALYZING'
        const statusCol = shifting ? AM : conf > 0.9 ? GR : CY

        ctx.save()
        ctx.shadowColor = 'rgba(0,0,0,0.55)'
        ctx.shadowBlur = 2

        // Downward scan sweep with a soft trailing glow.
        const sy = ((ot * 46) % (H + 44)) - 22
        const grad = ctx.createLinearGradient(0, sy - 34, 0, sy)
        grad.addColorStop(0, `rgba(${CY},0)`)
        grad.addColorStop(1, `rgba(${CY},0.10)`)
        ctx.fillStyle = grad
        ctx.fillRect(0, sy - 34, W, 34)
        ctx.strokeStyle = `rgba(${CY},0.5)`
        ctx.lineWidth = 1
        ctx.beginPath(); ctx.moveTo(0, sy + 0.5); ctx.lineTo(W, sy + 0.5); ctx.stroke()

        // Corner registration brackets.
        ctx.strokeStyle = `rgba(${CY},0.5)`
        ctx.lineWidth = 1.5
        const bl = 12, mg = 6
        const bracket = (cx, cy, sx, sy2) => {
          ctx.beginPath()
          ctx.moveTo(cx, cy + sy2 * bl); ctx.lineTo(cx, cy); ctx.lineTo(cx + sx * bl, cy)
          ctx.stroke()
        }
        bracket(mg, mg, 1, 1); bracket(W - mg, mg, -1, 1)
        bracket(mg, H - mg, 1, -1); bracket(W - mg, H - mg, -1, -1)

        // Feature lock-on boxes (corner ticks + label + confidence).
        const tick = 7
        features.forEach((f, i) => {
          const a = shifting ? 0.25 : 0.6
          ctx.strokeStyle = `rgba(${GR},${a})`
          ctx.lineWidth = 1
          const corner = (px, py, sx, sy2) => {
            ctx.beginPath()
            ctx.moveTo(px, py + sy2 * tick); ctx.lineTo(px, py); ctx.lineTo(px + sx * tick, py)
            ctx.stroke()
          }
          corner(f.x, f.y, 1, 1); corner(f.x + f.w, f.y, -1, 1)
          corner(f.x, f.y + f.h, 1, -1); corner(f.x + f.w, f.y + f.h, -1, -1)
          ctx.font = '9px monospace'
          ctx.textBaseline = 'alphabetic'
          ctx.textAlign = 'left'
          ctx.fillStyle = `rgba(${GR},${a + 0.25})`
          ctx.fillText(f.label, f.x, f.y - 3)
          ctx.textAlign = 'right'
          const fc = Math.max(0, Math.min(99, (f.conf * 100 + Math.sin(ot * 3 + i) * 1.5) | 0))
          ctx.fillText(fc + '%', f.x + f.w, f.y + f.h + 9)
        })

        // Center tracking reticle drifting over the field.
        const cx = W / 2 + Math.sin(ot * 0.5) * 36
        const cy = H / 2 + Math.cos(ot * 0.37) * 20
        ctx.strokeStyle = `rgba(${CY},0.55)`
        ctx.lineWidth = 1
        ctx.beginPath(); ctx.arc(cx, cy, 11, 0, 6.2832); ctx.stroke()
        ctx.beginPath()
        ctx.moveTo(cx - 16, cy); ctx.lineTo(cx - 5, cy)
        ctx.moveTo(cx + 5, cy); ctx.lineTo(cx + 16, cy)
        ctx.moveTo(cx, cy - 16); ctx.lineTo(cx, cy - 5)
        ctx.moveTo(cx, cy + 5); ctx.lineTo(cx, cy + 16)
        ctx.stroke()
        const ang = ot * 1.3
        ctx.fillStyle = `rgba(${CY},0.85)`
        ctx.fillRect(cx + Math.cos(ang) * 11 - 1, cy + Math.sin(ang) * 11 - 1, 2, 2)
        ctx.font = '8px monospace'
        ctx.textAlign = 'left'
        ctx.fillStyle = `rgba(${CY},0.6)`
        ctx.fillText('TRK ' + (cx | 0) + ',' + (cy | 0), cx + 15, cy - 13)

        // Header bar.
        ctx.shadowBlur = 0
        ctx.fillStyle = 'rgba(0,10,12,0.5)'
        ctx.fillRect(0, 0, W, 20)
        ctx.fillStyle = `rgba(${GR},0.9)`
        ctx.fillRect(8, 7, 6, 6)
        ctx.strokeStyle = `rgba(${CY},0.35)`
        ctx.lineWidth = 1
        ctx.beginPath(); ctx.moveTo(0, 20.5); ctx.lineTo(W, 20.5); ctx.stroke()
        ctx.shadowColor = 'rgba(0,0,0,0.55)'
        ctx.shadowBlur = 2
        ctx.font = 'bold 11px monospace'
        ctx.textBaseline = 'middle'
        ctx.textAlign = 'left'
        ctx.fillStyle = `rgba(${CY},0.92)`
        ctx.fillText(label, 20, 11)
        const blink = Math.floor(ot * 2) % 2 === 0
        ctx.textAlign = 'right'
        ctx.fillStyle = `rgba(${statusCol},${blink ? 0.95 : 0.5})`
        ctx.fillText((blink ? '● ' : '   ') + status, W - 10, 11)

        // Bottom telemetry strip + confidence bar — values track the live pattern.
        const by = H - 30
        ctx.shadowBlur = 0
        ctx.fillStyle = 'rgba(0,10,12,0.5)'
        ctx.fillRect(0, by, W, 30)
        ctx.strokeStyle = `rgba(${CY},0.3)`
        ctx.beginPath(); ctx.moveTo(0, by + 0.5); ctx.lineTo(W, by + 0.5); ctx.stroke()
        ctx.shadowColor = 'rgba(0,0,0,0.55)'
        ctx.shadowBlur = 2

        const entropy = live.uPalette2Spread / 7 * 0.6 + live.uHueShift / 1.6 * 0.4
        const symmetry = live.uSpiral1Strength / 2
        const cells = Math.round(6 / Math.max(0.05, live.uBlockScale)) * 100
        ctx.font = '9px monospace'
        ctx.textBaseline = 'middle'
        const pairs = [
          ['ENTROPY', entropy.toFixed(3)],
          ['SYMMETRY', symmetry.toFixed(2)],
          ['CELLS', cells >= 1000 ? (cells / 1000).toFixed(1) + 'k' : String(cells)],
          ['TOPO', 'MÖBIUS χ0'],
        ]
        let px = 10
        const trow = by + 10
        pairs.forEach(([k, v]) => {
          ctx.textAlign = 'left'
          ctx.fillStyle = `rgba(${CY},0.45)`
          ctx.fillText(k, px, trow)
          const kw = ctx.measureText(k).width
          ctx.fillStyle = `rgba(${GR},0.85)`
          ctx.fillText(v, px + kw + 5, trow)
          px += kw + 5 + ctx.measureText(v).width + 16
        })

        const cby = by + 21
        ctx.textAlign = 'left'
        ctx.fillStyle = `rgba(${CY},0.45)`
        ctx.fillText('CONF', 10, cby)
        const barX = 44, barW = W - 44 - 58, barH = 6
        ctx.strokeStyle = `rgba(${CY},0.4)`
        ctx.strokeRect(barX, cby - barH / 2, barW, barH)
        ctx.fillStyle = `rgba(${statusCol},0.8)`
        ctx.fillRect(barX + 1, cby - barH / 2 + 1, (barW - 2) * conf, barH - 2)
        ctx.textAlign = 'right'
        ctx.fillStyle = `rgba(${statusCol},0.9)`
        ctx.fillText((conf * 100).toFixed(1) + '%', W - 10, cby)

        ctx.restore()
      }

      const draw = (ts) => {
        rafRef.current = requestAnimationFrame(draw)
        if (hidden) return
        if (ts - lastFrame < FRAME_INTERVAL) return
        lastFrame = ts

        // Follow the canvas the scene is actually showing — it changes under
        // us whenever the temple model reloads.
        if (!retarget()) {
          lastTime = performance.now()
          return
        }

        // Yield to EvidenceScreens while the player is reading this station's
        // evidence card (it owns the canvas and sets this flag).
        if (canvas.dataset && canvas.dataset.evidenceActive === 'true') {
          lastTime = performance.now()
          return
        }

        const now = performance.now()
        const delta = Math.min((now - lastTime) / 1000, 0.05) // clamp resume jumps
        lastTime = now

        elapsed += delta * 0.1
        uniforms.iTime.value = elapsed
        updateMorph(delta)
        for (const k in MORPH_RANGES) uniforms[k].value = live[k]

        // A morph wrap = the field just reshaped → re-detect features + flash RESYNC.
        if (overlay) {
          if (morph.progress < lastProgress) {
            features = makeFeatures()
            shiftFlashUntil = now + 1400
          }
          lastProgress = morph.progress
        }

        renderer.render(scene, camera)
        ctx.drawImage(glCanvas, 0, 0, W, H)
        if (overlay) paintAnalysis(now)
        texture.needsUpdate = true
      }

      rafRef.current = requestAnimationFrame(draw)
    }

    rafRef.current = requestAnimationFrame(start)

    return () => {
      disposed = true
      cancelAnimationFrame(rafRef.current)
      if (retryTimer) clearTimeout(retryTimer)
      document.removeEventListener('visibilitychange', onVis)
      if (material) material.dispose()
      if (geometry) geometry.dispose()
      if (renderer) {
        renderer.dispose()
        renderer.forceContextLoss?.()
      }
      glCanvas = null
    }
  }, [canvasGlobal, textureGlobal, fps, renderScale, overlay, label])

  return null
}

export default MobiusScreen
