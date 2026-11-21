// The Singular80 — the card's art as a LIVE 3D object (2026-11-20).
//
// Michelle's "Stable Singularity" piece (a black sphere, a hot rim, and an accretion disc of thousands of
// instanced streaks, drifting between three states: stable, turbulent, collapsing), adapted to sit in a
// card's art window, by the same rules as sacredGeometry.js:
//   · no page chrome, no orbit controls, no gsap: the states ease by themselves, and the CARD's tilt
//     swings the camera round and over the disc (opts.getTilt)
//   · the hole sits a little above centre, clear of the card's text box
//   · one render pass, no post-processing; a small machine gets half the streaks (opts.bloom === false
//     is how RcanaLive3D says "small machine")
//   · it pauses when hidden and disposes everything on unmount
//   · opts.still = seconds renders that one moment, in the stable state: the card's poster
import * as THREE from "three";

const NOISE = `
  vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec4 permute(vec4 x) { return mod289(((x*34.0)+1.0)*x); }
  vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
  float snoise(vec3 v) {
    const vec2 C = vec2(1.0/6.0, 1.0/3.0); const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
    vec3 i = floor(v + dot(v, C.yyy)); vec3 x0 = v - i + dot(i, C.xxx);
    vec3 g = step(x0.yzx, x0.xyz); vec3 l = 1.0 - g; vec3 i1 = min(g.xyz, l.zxy); vec3 i2 = max(g.xyz, l.zxy);
    vec3 x1 = x0 - i1 + C.xxx; vec3 x2 = x0 - i2 + C.yyy; vec3 x3 = x0 - D.yyy;
    i = mod289(i);
    vec4 p = permute(permute(permute(i.z + vec4(0.0, i1.z, i2.z, 1.0)) + i.y + vec4(0.0, i1.y, i2.y, 1.0)) + i.x + vec4(0.0, i1.x, i2.x, 1.0));
    float n_ = 0.142857142857; vec3 ns = n_ * D.wyz - D.xzx;
    vec4 j = p - 49.0 * floor(p * ns.z * ns.z); vec4 x_ = floor(j * ns.z); vec4 y_ = floor(j - 7.0 * x_);
    vec4 x = x_ * ns.x + ns.yyyy; vec4 y = y_ * ns.x + ns.yyyy; vec4 h = 1.0 - abs(x) - abs(y);
    vec4 b0 = vec4(x.xy, y.xy); vec4 b1 = vec4(x.zw, y.zw);
    vec4 s0 = floor(b0)*2.0 + 1.0; vec4 s1 = floor(b1)*2.0 + 1.0; vec4 sh = -step(h, vec4(0.0));
    vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy; vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;
    vec3 p0 = vec3(a0.xy,h.x); vec3 p1 = vec3(a0.zw,h.y); vec3 p2 = vec3(a1.xy,h.z); vec3 p3 = vec3(a1.zw,h.w);
    vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
    p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
    vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0); m = m * m;
    return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
  }`;

// The three states the piece drifts between, ten seconds each: stable, turbulent, collapsing.
const STATES = [
  { morph: 0.1, compress: 1.0, intensity: 1.0, spin: 0.4, camY: 25, dist: 85, orbit: 1.0 },
  { morph: 4.5, compress: 1.15, intensity: 1.4, spin: 1.5, camY: 45, dist: 95, orbit: 1.8 },
  { morph: 0.8, compress: 0.38, intensity: 3.5, spin: 5.0, camY: 12, dist: 55, orbit: 4.5 },
];
const HOLD = 10; // seconds in a state

const seeded = (seed) => () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

export function mount(canvas, opts = {}) {
  const { getTilt = () => ({ x: 0, y: 0 }), still = null, bloom = true, maxPixelRatio = 1.5 } = opts;
  const rand = seeded(88);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: "high-performance", preserveDrawingBuffer: still != null });
  renderer.setClearColor(0x010103, 1);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.6;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 1000);
  const TARGET = new THREE.Vector3(0, -7, 0); // looking a little below the hole lifts it in the window, clear of the text box
  const disposables = []; const keep = (x) => { disposables.push(x); return x; };

  scene.add(new THREE.Mesh(keep(new THREE.SphereGeometry(4, 48, 48)), keep(new THREE.MeshBasicMaterial({ color: 0x000000 }))));
  const auraMat = keep(new THREE.ShaderMaterial({
    uniforms: { uIntensity: { value: 1.0 } },
    vertexShader: `varying vec3 vNormal; varying vec3 vView; void main() { vNormal = normalize(normalMatrix * normal); vView = normalize(-(modelViewMatrix * vec4(position, 1.0)).xyz); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform float uIntensity; varying vec3 vNormal; varying vec3 vView; void main() { float rim = pow(1.0 - max(dot(vNormal, vView), 0.0), 4.0); gl_FragColor = vec4(vec3(1.0, 0.45, 0.1) * rim * uIntensity * 5.0, 1.0); }`,
    side: THREE.BackSide, transparent: true, blending: THREE.AdditiveBlending,
  }));
  scene.add(new THREE.Mesh(keep(new THREE.SphereGeometry(4.25, 48, 48)), auraMat));

  const count = bloom ? 5000 : 2500; // `bloom: false` is RcanaLive3D's word for a small machine
  const streak = keep(new THREE.CylinderGeometry(0.01, 0.12, 2.2, 3)); streak.rotateX(Math.PI / 2);
  const disk = keep(new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uMorph: { value: 0.1 }, uCompression: { value: 1.0 }, uIntensity: { value: 1.0 }, uPhase: { value: 0 } },
    vertexShader: `${NOISE}
      uniform float uTime; uniform float uMorph; uniform float uCompression; uniform float uIntensity; uniform float uPhase;
      varying vec3 vColor; varying float vOpacity;
      void main() {
        vec4 instPos = instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
        float rOriginal = length(instPos.xz); float r = rOriginal * uCompression;
        float initialAngle = atan(instPos.z, instPos.x);
        // uPhase is the orbit, integrated on the CPU, so a change of speed never makes the disc jump.
        float currentAngle = initialAngle + uPhase * (1.5 / sqrt(rOriginal));
        vec3 world = vec3(cos(currentAngle) * r, instPos.y, sin(currentAngle) * r);
        world.y += snoise(vec3(world.x * 0.08, world.z * 0.08, uTime * 0.3)) * uMorph * 4.0;
        vec3 viewDir = normalize(cameraPosition - world); vec3 orbitDir = normalize(vec3(-sin(currentAngle), 0.0, cos(currentAngle)));
        float doppler = dot(orbitDir, viewDir);
        vec3 color = mix(vec3(0.1, 0.35, 1.0), vec3(1.0, 0.45, 0.1), smoothstep(45.0, 12.0, r)); color = mix(color, vec3(1.0, 0.95, 0.9), smoothstep(10.0, 4.0, r));
        vColor = color * (1.3 + doppler * 0.7) * uIntensity;
        vOpacity = (smoothstep(3.8, 5.5, r) * (1.0 - smoothstep(38.0, 48.0, r))) * 0.8;
        float d = currentAngle - initialAngle; float c = cos(d); float s = sin(d);
        mat3 rotY = mat3(c, 0, s, 0, 1, 0, -s, 0, c);
        gl_Position = projectionMatrix * viewMatrix * vec4(world + rotY * (instanceMatrix * vec4(position, 0.0)).xyz, 1.0);
      }`,
    fragmentShader: `varying vec3 vColor; varying float vOpacity; void main() { gl_FragColor = vec4(vColor, vOpacity); }`,
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  const mesh = new THREE.InstancedMesh(streak, disk, count); mesh.frustumCulled = false;
  const dummy = new THREE.Object3D();
  for (let i = 0; i < count; i++) {
    const r = 5 + Math.pow(rand(), 1.3) * 40, a = rand() * Math.PI * 2;
    dummy.position.set(Math.cos(a) * r, (rand() - 0.5) * (8 / r), Math.sin(a) * r);
    dummy.lookAt(dummy.position.x + Math.sin(a), dummy.position.y, dummy.position.z - Math.cos(a));
    dummy.updateMatrix(); mesh.setMatrixAt(i, dummy.matrix);
  }
  scene.add(mesh);

  // The piece's state, eased toward whichever of the three it is in.
  const cur = { ...STATES[0] }; let azimuth = Math.PI / 4, phase = 0, last = null;
  const tilt = { x: 0, y: 0 };
  function frame(time, fixed = false) {
    const dt = last == null || fixed ? 0 : Math.min(0.1, Math.max(0, time - last)); last = time;
    const want = fixed ? STATES[0] : STATES[Math.floor(time / HOLD) % STATES.length];
    const k = fixed ? 1 : 1 - Math.exp(-dt * 0.9); // about four seconds to settle into a new state
    for (const key of Object.keys(cur)) cur[key] += (want[key] - cur[key]) * k;
    phase = fixed ? time : phase + dt * cur.orbit; azimuth += dt * cur.spin * 0.105; // autoRotateSpeed 1 is about 0.105 rad/s
    disk.uniforms.uTime.value = time; disk.uniforms.uPhase.value = phase; disk.uniforms.uMorph.value = cur.morph; disk.uniforms.uCompression.value = cur.compress; disk.uniforms.uIntensity.value = cur.intensity; auraMat.uniforms.uIntensity.value = cur.intensity;
    // The card's lean: left/right swings the camera round the disc, up/down lifts it over or drops it level.
    const t = getTilt() || { x: 0, y: 0 }; tilt.x += (t.x - tilt.x) * 0.1; tilt.y += (t.y - tilt.y) * 0.1;
    const az = azimuth + tilt.x * 0.7; const flat = cur.dist * 1.06;
    camera.position.set(Math.cos(az) * flat, cur.camY - tilt.y * 18, Math.sin(az) * flat);
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
    start() { if (running || still != null) return; running = true; t0 = now(); last = null; raf = requestAnimationFrame(loop); },
    stop() { if (!running) return; running = false; held += now() - t0; cancelAnimationFrame(raf); },
    renderStill(seconds) { frame(seconds, true); },
    dispose() { api.stop(); for (const d of disposables) d.dispose?.(); mesh.dispose?.(); renderer.dispose(); },
  };
  return api;
}
