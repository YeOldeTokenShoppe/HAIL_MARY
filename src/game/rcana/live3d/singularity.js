// The Singular80 — the card's art as a LIVE 3D object (2026-11-21, second version).
//
// A black hole that belongs to this card and no other. Written fresh for it; the first version was an
// adaptation of a "Stable Singularity" pen, and nothing of that pen's disc, shader or states remains.
//   · 80: the disc is made of code rain in terminal green: 8s and 0s six times in ten, and fourteen other
//     marks (a few digits, signs and angular strokes of this file's own), each upright to the viewer and
//     changing now and then. (The digits and the green are after a fourth pen Michelle
//     supplied, a strange attractor written in code; the glyphs here are drawn by this file's own shader.)
//   · EIGHT: the disc is a density wave of eight spiral arms. The digits orbit at their own speeds
//     (fast inside, slow outside) and light up as they pass through the arms, so the arms hold their
//     shape while everything moves through them. An eight-pointed flare sits on the rim: the Miracle
//     star's shape.
//   · TWO: a second, fainter disc turns a beat behind the first, on a plane leaned a few degrees off
//     it: a double exposure. The card's rule is "two main actions each turn"; this is that, drawn.
//     The gap between the two breathes, and now and then they fold together for a moment.
//   · the colour: nearly white at the rim, bright green, dark green at the edge; the flare is pale green.
// By the same rules as sacredGeometry.js: no page chrome, no controls, the CARD's tilt swings the camera
// (opts.getTilt); one render pass, no post-processing; a small machine gets half the digits
// (opts.bloom === false is how RcanaLive3D says "small machine"); it pauses when hidden and disposes
// everything on unmount; opts.still = seconds renders that one moment, for the card's poster.
import * as THREE from "three";

const ARMS = 8;
const R_IN = 5, R_OUT = 46;      // the disc, in units of the hole's radius 4
const PATTERN = 0.11;            // how fast the eight arms turn, rad/s
const WIND = 9;                  // how tightly they wind

const seeded = (seed) => () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

const DISC_VERT = `
  attribute vec4 aOrbit;   // radius, starting angle, height, seed
  uniform float uTime, uLag, uLean, uGrow, uArms, uWind, uPattern;
  varying vec3 vColor; varying float vAlpha, vGlyph; varying vec2 vUv;
  void main() {
    float r = aOrbit.x * uGrow, seed = aOrbit.w;
    float t = uTime - uLag;                                   // the echo lives a beat in the past
    float ang = aOrbit.y + t * (2.1 / sqrt(aOrbit.x));        // each streak at its own speed
    // The density wave: eight arms, wound, turning slowly; a streak is lit while it is inside one.
    float wave = cos(uArms * (ang - t * uPattern) + uWind * log(aOrbit.x));
    float arm = pow(0.5 + 0.5 * wave, 3.4);
    float lit = 0.03 + 0.97 * arm;
    vec3 c = vec3(cos(ang) * r, aOrbit.z + sin(ang * 3.0 + seed * 40.0 + t * 0.6) * 0.12 * sqrt(r), sin(ang) * r);
    vec3 tangent = vec3(-sin(ang), 0.0, cos(ang));
    // The echo's plane leans off the first disc's, about the x axis.
    float cl = cos(uLean), sl = sin(uLean); mat3 lean = mat3(1.0, 0.0, 0.0, 0.0, cl, sl, 0.0, -sl, cl);
    c = lean * c; tangent = lean * tangent;
    vec3 toEye = normalize(cameraPosition - c);
    // Each one is a digit, upright to the viewer wherever it is on the disc: bigger inside an arm.
    vec3 right = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]), up = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
    float tall = (0.95 + 0.85 * arm) * (0.75 + 0.5 * seed);
    vec3 world = c + right * position.x * tall * 0.6 + up * position.y * tall;
    // Which mark it is, and it changes its mind every so often: an 8 or a 0 six times in ten (they are the
    // card's name), otherwise one of fourteen code-rain marks.
    float tick = floor(t * (0.5 + 1.6 * seed) + seed * 37.0);
    float pick = fract(sin(seed * 913.7 + tick * 78.233) * 43758.5453), other = fract(sin(seed * 271.3 + tick * 12.9898) * 24634.6345);
    vGlyph = pick < 0.34 ? 0.0 : pick < 0.6 ? 1.0 : 2.0 + floor(other * 14.0);
    // Terminal green by radius: nearly white at the rim, bright green, then dark green at the edge.
    float k = (r - ${R_IN.toFixed(1)}) / ${(R_OUT - R_IN).toFixed(1)};
    vec3 col = mix(vec3(0.78, 1.0, 0.82), vec3(0.22, 1.0, 0.38), smoothstep(0.0, 0.14, k));
    col = mix(col, vec3(0.0, 0.86, 0.22), smoothstep(0.14, 0.42, k));
    col = mix(col, vec3(0.0, 0.42, 0.10), smoothstep(0.5, 0.95, k));
    float doppler = dot(tangent, toEye);                      // the side turning toward you is brighter
    vColor = col * (0.75 + 0.3 * doppler) * (0.45 + 0.85 * lit) * (1.0 + 0.5 * smoothstep(0.2, 0.0, k));
    vAlpha = lit * smoothstep(${(R_IN - 1.1).toFixed(1)}, ${(R_IN + 0.6).toFixed(1)}, r) * (1.0 - smoothstep(0.80, 1.0, k));
    vUv = position.xy;
    gl_Position = projectionMatrix * viewMatrix * vec4(world, 1.0);
  }`;
const DISC_FRAG = `
  // Each mark's fifteen dots as one number: 8, 0, 1, 7, z, te, ni, ko, yo, e, to, ri, ki, plus, colon, ha.
  float glyphBits(float g) { if (g < 0.5) return 31727.0; if (g < 1.5) return 31599.0; if (g < 2.5) return 29850.0; if (g < 3.5) return 9383.0; if (g < 4.5) return 29351.0; if (g < 5.5) return 5575.0; if (g < 6.5) return 28728.0; if (g < 7.5) return 31015.0; if (g < 8.5) return 31207.0; if (g < 9.5) return 29847.0; if (g < 10.5) return 4809.0; if (g < 11.5) return 10541.0; if (g < 12.5) return 11962.0; if (g < 13.5) return 1488.0; if (g < 14.5) return 1040.0; return 23378.0; }
  uniform float uAlpha; uniform vec3 uTint;
  varying vec3 vColor; varying float vAlpha, vGlyph; varying vec2 vUv;
  void main() {
    // The mark, on a grid three dots wide and five tall.
    vec2 g = (vUv + 0.5) * vec2(3.0, 5.0); vec2 cell = floor(g), sub = fract(g);
    float on = mod(floor(glyphBits(vGlyph) / exp2(cell.x + 3.0 * (4.0 - cell.y))), 2.0); // dot (x, row from the top) is bit x + 3 * row
    float dot_ = step(0.12, sub.x) * step(sub.x, 0.88) * step(0.12, sub.y) * step(sub.y, 0.88);
    if (on * dot_ < 0.5) discard;
    gl_FragColor = vec4(vColor * uTint, vAlpha * uAlpha);
  }`;

// The eight-pointed flare: four long rays and four short, on a quad that always faces the camera. The
// hole itself is cut out of it, so the rays stand on the rim.
const FLARE_VERT = `
  varying vec2 vP;
  void main() {
    vP = position.xy;
    vec4 mv = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);
    mv.xy += position.xy;
    gl_Position = projectionMatrix * mv;
  }`;
const FLARE_FRAG = `
  uniform float uTime, uPower, uSpin;
  varying vec2 vP;
  float ray(vec2 p, float a, float reach, float thin) {
    float c = cos(a), s = sin(a); vec2 q = vec2(c * p.x + s * p.y, -s * p.x + c * p.y);
    return exp(-abs(q.y) * thin) * exp(-abs(q.x) / reach);
  }
  void main() {
    float r = length(vP);
    float f = 0.0;
    for (int i = 0; i < 4; i++) {
      float a = uSpin + float(i) * 0.7853982;
      f += ray(vP, a, (mod(float(i), 2.0) < 0.5) ? 8.0 : 5.0, 3.2);
    }
    float glow = exp(-max(r - 4.0, 0.0) * 0.55);
    float hole = smoothstep(4.02, 4.30, r);                   // nothing in front of the hole
    float edge = 1.0 - smoothstep(20.0, 26.0, r);
    vec3 col = vec3(0.55, 1.0, 0.62) * (f * 1.5 + glow * 0.55) * uPower * (0.92 + 0.08 * sin(uTime * 1.7));
    gl_FragColor = vec4(col * hole * edge, 1.0);
  }`;

export function mount(canvas, opts = {}) {
  const { getTilt = () => ({ x: 0, y: 0 }), still = null, bloom = true, maxPixelRatio = 1.5 } = opts;
  const rand = seeded(88);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: "high-performance", preserveDrawingBuffer: still != null });
  renderer.setClearColor(0x000201, 1);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 1000);
  const TARGET = new THREE.Vector3(0, -8, 0); // looking a little below the hole lifts it in the window, clear of the text box
  const disposables = []; const keep = (x) => { disposables.push(x); return x; };

  // The hole: black, and it hides whatever passes behind it.
  const hole = new THREE.Mesh(keep(new THREE.SphereGeometry(4, 48, 48)), keep(new THREE.MeshBasicMaterial({ color: 0x000000 })));
  hole.renderOrder = 0; scene.add(hole);

  // The digits: one quad, drawn `count` times, each with its own orbit.
  const count = bloom ? 3600 : 1800; // `bloom: false` is RcanaLive3D's word for a small machine
  const geo = keep(new THREE.InstancedBufferGeometry());
  geo.setAttribute("position", new THREE.Float32BufferAttribute([-0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0], 3));
  geo.setIndex([0, 1, 2, 0, 2, 3]);
  const orbit = new Float32Array(count * 4);
  for (let i = 0; i < count; i++) {
    const r = R_IN + Math.pow(rand(), 1.25) * (R_OUT - R_IN);
    orbit.set([r, rand() * Math.PI * 2, (rand() - 0.5) * (7 / r), rand()], i * 4);
  }
  geo.setAttribute("aOrbit", new THREE.InstancedBufferAttribute(orbit, 4));
  geo.instanceCount = count;
  const discMat = (over) => keep(new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uLag: { value: 0 }, uLean: { value: 0 }, uGrow: { value: 1 }, uAlpha: { value: 0.9 }, uTint: { value: new THREE.Color(1, 1, 1) },
      uArms: { value: ARMS }, uWind: { value: WIND }, uPattern: { value: PATTERN }, ...over },
    vertexShader: DISC_VERT, fragmentShader: DISC_FRAG, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
  }));
  const first = discMat({});
  // The echo: the same disc a beat behind, fainter, a touch wider, cooler, on a leaned plane.
  const echo = discMat({ uAlpha: { value: 0.2 }, uGrow: { value: 1.07 }, uLean: { value: 0.16 }, uTint: { value: new THREE.Color(0.8, 1.0, 0.85) } });
  for (const m of [echo, first]) { const mesh = new THREE.Mesh(geo, m); mesh.frustumCulled = false; mesh.renderOrder = 1; scene.add(mesh); }

  const flareMat = keep(new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uPower: { value: 1 }, uSpin: { value: 0 } },
    vertexShader: FLARE_VERT, fragmentShader: FLARE_FRAG, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false,
  }));
  const flare = new THREE.Mesh(keep(new THREE.PlaneGeometry(52, 52)), flareMat); flare.frustumCulled = false; flare.renderOrder = 2; scene.add(flare);

  const tilt = { x: 0, y: 0 };
  function frame(time) {
    // The gap between the two discs breathes; every 16 seconds they fold into one for a moment.
    const fold = Math.pow(Math.max(0, Math.cos(((time % 16) / 16 - 0.5) * Math.PI * 2) * -1), 6); // 1 at the fold, 0 otherwise
    const lag = (1.5 + 0.5 * Math.sin(time * 0.37)) * (1 - fold);
    first.uniforms.uTime.value = time; echo.uniforms.uTime.value = time; echo.uniforms.uLag.value = lag;
    echo.uniforms.uLean.value = 0.16 * (1 - fold); echo.uniforms.uGrow.value = 1 + 0.07 * (1 - fold);
    flareMat.uniforms.uTime.value = time; flareMat.uniforms.uSpin.value = time * 0.05; flareMat.uniforms.uPower.value = 1 + 1.4 * fold;
    // The card's lean: left/right swings the camera round the disc, up/down lifts it over or drops it level.
    const t = getTilt() || { x: 0, y: 0 }; tilt.x += (t.x - tilt.x) * 0.1; tilt.y += (t.y - tilt.y) * 0.1;
    const az = Math.PI / 4 + time * 0.03 + tilt.x * 0.7;
    camera.position.set(Math.cos(az) * 100, 56 - tilt.y * 24, Math.sin(az) * 100);
    camera.lookAt(TARGET);
    renderer.render(scene, camera);
  }

  function resize(width, height, pixelRatio = 1) {
    const w = Math.max(2, Math.round(width)), h = Math.max(2, Math.round(height));
    renderer.setPixelRatio(Math.min(pixelRatio, maxPixelRatio)); renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
  }

  let raf = 0, running = false, t0 = 0, held = 0;
  const now = () => (typeof performance !== "undefined" ? performance.now() : Date.now()) / 1000;
  const loop = () => { if (!running) return; frame(held + now() - t0); raf = requestAnimationFrame(loop); };
  const api = {
    resize,
    start() { if (running || still != null) return; running = true; t0 = now(); raf = requestAnimationFrame(loop); },
    stop() { if (!running) return; running = false; held += now() - t0; cancelAnimationFrame(raf); },
    renderStill(seconds) { tilt.x = 0; tilt.y = 0; frame(seconds); },
    dispose() { api.stop(); for (const d of disposables) d.dispose?.(); renderer.dispose(); },
  };
  return api;
}
