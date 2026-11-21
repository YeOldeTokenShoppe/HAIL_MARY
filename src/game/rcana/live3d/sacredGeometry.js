// Sacred Geometry — the card's art as a LIVE 3D object (2026-11-20).
//
// Michelle's "Energy Sacred Geometry" construct (an octahedron inside an octahedron, energy tubes, a
// molten core, orbiting dust), adapted to sit in a card's art window:
//   · no page chrome, no orbit controls: the CARD's tilt turns the construct (opts.getTilt)
//   · the construct sits a little above centre, clear of the card's text box
//   · it pauses when the tab is hidden or the canvas is off screen, and disposes everything on unmount
//   · bloom is the one expensive pass, so it runs at half resolution and can be turned off (opts.bloom)
//   · opts.still = seconds renders that one moment and stops: the poster the card shows as a picture
//
// Plain three.js, no React: src/components/RcanaLive3D.jsx mounts it on a canvas. An eight-faced solid
// is also the shape of the game's d8.
import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";

const TUBE_VERT = `
  varying vec2 vUv; varying vec3 vNormal; varying vec3 vViewPosition;
  void main() { vUv = uv; vNormal = normalize(normalMatrix * normal); vec4 mv = modelViewMatrix * vec4(position, 1.0); vViewPosition = -mv.xyz; gl_Position = projectionMatrix * mv; }`;
const TUBE_FRAG = `
  uniform float uTime; uniform float uFlicker; uniform vec3 uColorA; uniform vec3 uColorB;
  varying vec2 vUv; varying vec3 vNormal; varying vec3 vViewPosition;
  float intermittent(float t) { float gate = step(0.4, sin(t * 5.0) * 0.5 + 0.5); float burst = smoothstep(0.8, 1.0, sin(t * 15.0) * 0.5 + 0.5); return max(gate * 0.4, burst); }
  void main() {
    vec3 viewDir = normalize(vViewPosition);
    float fresnel = pow(1.0 - abs(dot(viewDir, normalize(vNormal))), 2.35);
    float traveling = smoothstep(0.1, 0.0, abs(fract(vUv.y * 3.0 - uTime * 2.0) - 0.5) - 0.1);
    float filament = 0.5 + 0.5 * sin((vUv.y * 42.0) - uTime * 12.0);
    float pulse = intermittent(uTime + vUv.y * 2.0) * uFlicker;
    float alpha = 0.11 + fresnel * 0.42 + traveling * 0.56 + filament * pulse * 0.22;
    vec3 baseColor = mix(uColorA, uColorB, vUv.y + sin(uTime) * 0.2);
    gl_FragColor = vec4(mix(baseColor, vec3(1.0), traveling * 0.55) * 0.92, alpha);
  }`;
const WORLD_VERT = `
  varying vec3 vNormal; varying vec3 vWorld; varying vec3 vViewPosition;
  void main() { vNormal = normalize(normalMatrix * normal); vec4 world = modelMatrix * vec4(position, 1.0); vWorld = world.xyz; vec4 mv = viewMatrix * world; vViewPosition = -mv.xyz; gl_Position = projectionMatrix * mv; }`;
const FACE_FRAG = `
  uniform float uTime; uniform vec3 uColorA; uniform vec3 uColorB;
  varying vec3 vNormal; varying vec3 vWorld; varying vec3 vViewPosition;
  void main() {
    vec3 viewDir = normalize(vViewPosition);
    float fresnel = pow(1.0 - abs(dot(viewDir, normalize(vNormal))), 1.45);
    float scanline = smoothstep(0.8, 1.0, sin(vWorld.y * 60.0 - uTime * 15.0) * 0.5 + 0.5);
    float wave = sin(length(vWorld.xz) * 5.0 - uTime * 3.0) * 0.5 + 0.5;
    vec3 color = mix(uColorA, uColorB, wave + fresnel * 0.5);
    gl_FragColor = vec4(color, ((fresnel * 0.13) + (scanline * 0.08) + (wave * 0.04)) * 0.72);
  }`;
const CORE_FRAG = `
  uniform float uTime; uniform vec3 uColorA; uniform vec3 uColorB; uniform vec3 uColorC;
  varying vec3 vNormal; varying vec3 vWorld; varying vec3 vViewPosition;
  void main() {
    vec3 viewDir = normalize(vViewPosition);
    float rim = pow(1.0 - abs(dot(viewDir, normalize(vNormal))), 2.2);
    float latitude = sin((vWorld.y * 18.0) + uTime * 4.0) * 0.5 + 0.5;
    float lava = sin((vWorld.x + vWorld.y + vWorld.z) * 12.0 - uTime * 7.0) * 0.5 + 0.5;
    vec3 color = mix(uColorA, uColorB, latitude * 0.68 + lava * 0.22);
    color = mix(color, uColorC, rim * 0.38 + smoothstep(0.82, 1.0, lava) * 0.18);
    gl_FragColor = vec4(color, 0.95);
  }`;

// A small seeded generator, so the dust and the stars are the same in the still and in every session.
const seeded = (seed) => () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

export function mount(canvas, opts = {}) {
  const { getTilt = () => ({ x: 0, y: 0 }), still = null, bloom = true, maxPixelRatio = 1.5 } = opts;
  const rand = seeded(80);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: "high-performance", preserveDrawingBuffer: still != null });
  renderer.setClearColor(0x020308, 1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.95;

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x020204, 0.022);
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
  camera.position.set(2.0, 1.1, 9.4);
  const LOOK = new THREE.Vector3(0, -0.42, 0); // looking a little below the construct lifts it in the window, clear of the text box
  camera.lookAt(LOOK);

  const composer = bloom ? new EffectComposer(renderer) : null;
  let bloomPass = null;
  if (composer) { composer.addPass(new RenderPass(scene, camera)); bloomPass = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.8, 0.44, 0.5); composer.addPass(bloomPass); composer.addPass(new OutputPass()); }

  const colors = { cyan: new THREE.Color(0x00f0ff), deepBlue: new THREE.Color(0x0022ff), magenta: new THREE.Color(0xff0055), gold: new THREE.Color(0xffaa00), amberCore: new THREE.Color(0xffbc40), violetCore: new THREE.Color(0x8a2cff), hotWhite: new THREE.Color(0xffffff) };
  const shared = { uTime: { value: 0 }, uFlicker: { value: 1 } };
  const disposables = [];
  const keep = (x) => { disposables.push(x); return x; };

  // The room: two soft nebulae behind the construct, where the page had CSS gradients.
  const nebula = (hex, x, y, size, opacity) => {
    const c = document.createElement("canvas"); c.width = c.height = 128; const g = c.getContext("2d");
    const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64); grad.addColorStop(0, hex); grad.addColorStop(1, "rgba(0,0,0,0)"); g.fillStyle = grad; g.fillRect(0, 0, 128, 128);
    const tex = keep(new THREE.CanvasTexture(c)); const mat = keep(new THREE.SpriteMaterial({ map: tex, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
    const s = new THREE.Sprite(mat); s.position.set(x, y, -9); s.scale.setScalar(size); scene.add(s);
  };
  nebula("rgba(0,240,255,1)", -4.5, 3.6, 15, 0.1); nebula("rgba(255,0,118,1)", 5.2, -3.4, 15, 0.085); nebula("rgba(255,188,64,1)", 0, 0.4, 9, 0.07);

  const master = new THREE.Group(), outer = new THREE.Group(), inner = new THREE.Group();
  master.add(outer, inner); scene.add(master);

  const tubeMat = (a, b) => keep(new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { uTime: shared.uTime, uFlicker: shared.uFlicker, uColorA: { value: a }, uColorB: { value: b } }, vertexShader: TUBE_VERT, fragmentShader: TUBE_FRAG }));
  const faceMat = (a, b) => keep(new THREE.ShaderMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, uniforms: { uTime: shared.uTime, uColorA: { value: a }, uColorB: { value: b } }, vertexShader: WORLD_VERT, fragmentShader: FACE_FRAG }));
  const Z = new THREE.Vector3(0, 0, 1);
  const tube = (a, b, radius, mat, parent) => {
    const dir = new THREE.Vector3().subVectors(b, a); const geo = keep(new THREE.CylinderGeometry(radius, radius, dir.length(), 8, 1, true)); geo.rotateX(Math.PI * 0.5);
    const mesh = new THREE.Mesh(geo, mat); mesh.position.addVectors(a, b).multiplyScalar(0.5); mesh.quaternion.setFromUnitVectors(Z, dir.normalize()); parent.add(mesh);
  };
  const nodes = [];
  const nodeGeo = keep(new THREE.SphereGeometry(0.08, 12, 12)), glowGeo = keep(new THREE.SphereGeometry(0.2, 12, 12));
  const node = (p, color, scale, parent) => {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(nodeGeo, keep(new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false }))));
    g.add(new THREE.Mesh(glowGeo, keep(new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.2, blending: THREE.AdditiveBlending, depthWrite: false }))));
    g.position.copy(p); g.userData = { phase: rand() * Math.PI * 2, base: scale }; parent.add(g); nodes.push(g);
  };

  const R = 2.5, K = 0.45;
  const V = { top: [0, R, 0], bottom: [0, -R, 0], left: [-R, 0, 0], right: [R, 0, 0], front: [0, 0, R], back: [0, 0, -R] };
  const O = Object.fromEntries(Object.entries(V).map(([k, v]) => [k, new THREE.Vector3(...v)]));
  const I = Object.fromEntries(Object.entries(O).map(([k, v]) => [k, v.clone().multiplyScalar(K)]));
  const edges = (P) => [[P.top, P.left], [P.top, P.right], [P.top, P.front], [P.top, P.back], [P.bottom, P.left], [P.bottom, P.right], [P.bottom, P.front], [P.bottom, P.back], [P.left, P.front], [P.front, P.right], [P.right, P.back], [P.back, P.left]];
  const outerMat = tubeMat(colors.magenta, colors.gold), innerMat = tubeMat(colors.deepBlue, colors.cyan), linkMat = tubeMat(colors.magenta, colors.cyan);
  const outerEdges = edges(O);
  outerEdges.forEach(([a, b]) => tube(a, b, 0.015, outerMat, outer));
  edges(I).forEach(([a, b]) => tube(a, b, 0.01, innerMat, inner));
  Object.keys(O).forEach((k) => tube(O[k], I[k], 0.005, linkMat, master));

  const outerGeo = keep(new THREE.OctahedronGeometry(R * 0.99, 0)), innerGeo = keep(new THREE.OctahedronGeometry(R * K * 0.98, 0));
  outer.add(new THREE.Mesh(outerGeo, faceMat(colors.deepBlue, colors.cyan)));
  inner.add(new THREE.Mesh(innerGeo, faceMat(colors.magenta, colors.gold)));
  const wire = (geo, color, opacity, parent) => { const l = new THREE.LineSegments(keep(new THREE.WireframeGeometry(geo)), keep(new THREE.LineBasicMaterial({ color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false }))); parent.add(l); return l; };
  wire(innerGeo, 0x00f0ff, 0.16, inner); wire(outerGeo, 0xffbc40, 0.09, outer);
  Object.values(O).forEach((p) => node(p, colors.magenta, 1.2, outer));
  Object.values(I).forEach((p) => node(p, colors.amberCore, 0.78, inner));

  const core = new THREE.Mesh(keep(new THREE.IcosahedronGeometry(0.42, 3)), keep(new THREE.ShaderMaterial({ transparent: true, uniforms: { uTime: shared.uTime, uColorA: { value: colors.amberCore }, uColorB: { value: colors.violetCore }, uColorC: { value: colors.hotWhite } }, vertexShader: WORLD_VERT, fragmentShader: CORE_FRAG })));
  inner.add(core);
  const coreWire = wire(keep(new THREE.IcosahedronGeometry(0.475, 2)), 0xffffff, 0.38, inner);
  const halo = new THREE.Mesh(keep(new THREE.SphereGeometry(0.82, 32, 32)), keep(new THREE.MeshBasicMaterial({ color: colors.amberCore, transparent: true, opacity: 0.07, blending: THREE.AdditiveBlending, depthWrite: false })));
  inner.add(halo);
  const ring = (radius, color, opacity) => { const pts = new THREE.EllipseCurve(0, 0, radius, radius).getPoints(160).map((p) => new THREE.Vector3(p.x, p.y, 0)); const l = new THREE.LineLoop(keep(new THREE.BufferGeometry().setFromPoints(pts)), keep(new THREE.LineBasicMaterial({ color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false }))); inner.add(l); return l; };
  const rings = [ring(0.72, 0xffbc40, 0.46), ring(0.95, 0x8a2cff, 0.32), ring(1.16, 0x00f0ff, 0.22)];
  rings[0].rotation.x = Math.PI * 0.5; rings[1].rotation.y = Math.PI * 0.5; rings[2].rotation.z = Math.PI * 0.25;

  // Orbs running the outer edges.
  const orbCore = keep(new THREE.SphereGeometry(0.06, 12, 12)), orbGlow = keep(new THREE.SphereGeometry(0.15, 12, 12));
  const orbs = outerEdges.map(([a, b], i) => {
    const g = new THREE.Group(); const glowMat = keep(new THREE.MeshBasicMaterial({ color: colors.magenta, transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, depthWrite: false }));
    g.add(new THREE.Mesh(orbCore, keep(new THREE.MeshBasicMaterial({ color: 0xffffff }))), new THREE.Mesh(orbGlow, glowMat)); outer.add(g);
    const dir = new THREE.Vector3().subVectors(b, a).normalize(); const up = Math.abs(dir.y) > 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
    return { g, glowMat, a, b, side: new THREE.Vector3().crossVectors(dir, up).normalize(), speed: 0.2 + rand() * 0.3, offset: rand() * Math.PI * 2, dir: i % 2 === 0 ? 1 : -1 };
  });

  // Dust in a disc round the construct, and a few far stars. Fewer than the full-page piece: the window is small.
  const points = (count, place, vert, frag, uniforms) => {
    const pos = new Float32Array(count * 3), scale = new Float32Array(count), mix = new Float32Array(count);
    for (let i = 0; i < count; i++) { place(pos, i); scale[i] = rand(); mix[i] = rand(); }
    const geo = keep(new THREE.BufferGeometry()); geo.setAttribute("position", new THREE.BufferAttribute(pos, 3)); geo.setAttribute("aScale", new THREE.BufferAttribute(scale, 1)); geo.setAttribute("aColorMix", new THREE.BufferAttribute(mix, 1));
    const p = new THREE.Points(geo, keep(new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms, vertexShader: vert, fragmentShader: frag }))); scene.add(p); return p;
  };
  const uPx = { value: 1 }; // point sizes follow the canvas, so the dust looks the same on a thumbnail-sized card and a full-screen one
  const dust = points(700, (pos, i) => { const r = 0.35 + Math.pow(rand(), 2.0) * 4.35, th = rand() * Math.PI * 2; pos[i * 3] = Math.cos(th) * r; pos[i * 3 + 1] = (rand() - 0.5) * (1.0 / r) * 2.2; pos[i * 3 + 2] = Math.sin(th) * r; },
    `uniform float uTime; uniform float uPx; attribute float aScale; attribute float aColorMix; varying float vAlpha; varying float vColorMix;
     void main() { float d = max(length(position.xz), 0.001); float a = uTime * (0.5 / d); mat2 rot = mat2(cos(a), -sin(a), sin(a), cos(a)); vec3 pos = position; pos.xz = rot * pos.xz; pos.y += sin(uTime * 1.2 + d * 3.0 + aScale * 8.0) * 0.045;
       vec4 mv = modelViewMatrix * vec4(pos, 1.0); gl_PointSize = (16.0 * aScale + 1.6) * uPx * (1.0 / -mv.z); vAlpha = (0.28 + 0.72 * sin(uTime * 3.0 + aScale * 10.0)) * (1.0 - smoothstep(0.0, 5.2, length(pos))); vColorMix = aColorMix; gl_Position = projectionMatrix * mv; }`,
    `uniform vec3 uColorA; uniform vec3 uColorB; uniform vec3 uColorC; varying float vAlpha; varying float vColorMix;
     void main() { float dist = length(gl_PointCoord - vec2(0.5)); if (dist > 0.5) discard; float glow = smoothstep(0.5, 0.0, dist); vec3 c = mix(uColorA, uColorB, smoothstep(0.25, 0.85, vColorMix)); c = mix(c, uColorC, smoothstep(0.78, 1.0, vColorMix) * 0.45); gl_FragColor = vec4(c * glow, vAlpha * glow); }`,
    { uTime: shared.uTime, uPx, uColorA: { value: colors.cyan }, uColorB: { value: colors.amberCore }, uColorC: { value: colors.magenta } });
  dust.position.copy(master.position);
  const stars = points(320, (pos, i) => { const r = 15 + rand() * 34, th = rand() * Math.PI * 2, ph = Math.acos(2 * rand() - 1); pos[i * 3] = r * Math.sin(ph) * Math.cos(th); pos[i * 3 + 1] = r * Math.cos(ph); pos[i * 3 + 2] = r * Math.sin(ph) * Math.sin(th); },
    `uniform float uTime; uniform float uPx; attribute float aScale; varying float vAlpha; void main() { vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = (8.0 * aScale + 1.0) * uPx * (1.0 / -mv.z) * 6.0; vAlpha = 0.28 + 0.5 * sin(uTime * 1.5 + aScale * 20.0); gl_Position = projectionMatrix * mv; }`,
    `varying float vAlpha; void main() { float dist = length(gl_PointCoord - vec2(0.5)); if (dist > 0.5) discard; float glow = smoothstep(0.5, 0.0, dist); gl_FragColor = vec4(vec3(0.75, 0.92, 1.0), vAlpha * glow * 0.56); }`,
    { uTime: shared.uTime, uPx });

  const coreLight = new THREE.PointLight(0xffbc40, 7, 9, 2); inner.add(coreLight);

  const sstep = (e0, e1, x) => { const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };
  const tilt = { x: 0, y: 0 };
  const tmp = new THREE.Vector3();
  function frame(time) {
    shared.uTime.value = time;
    const surge = sstep(0.85, 1.0, Math.sin(time * 7.3) * 0.5 + 0.5);
    shared.uFlicker.value = 0.8 + 0.2 * Math.sin(time * 2.0) + surge * 1.5;
    // The card's lean turns the whole construct: left/right about the vertical, up/down about the horizontal.
    const want = getTilt() || { x: 0, y: 0 }; tilt.x += (want.x - tilt.x) * 0.12; tilt.y += (want.y - tilt.y) * 0.12;
    master.position.y = Math.sin(time * 0.5) * 0.1;
    master.rotation.set(tilt.y * 0.55, time * 0.12 + tilt.x * 0.9, 0);
    outer.rotation.set(Math.sin(time * 0.15) * 0.1, time * 0.1, Math.cos(time * 0.1) * 0.05);
    inner.rotation.set(Math.cos(time * 0.2) * 0.15, -time * 0.25, 0);
    core.rotation.set(time * 1.5, time * 1.2, time * 0.38); core.scale.setScalar(1.0 + Math.sin(time * 8.0) * 0.045 + surge * 0.16);
    coreWire.rotation.set(-time * 1.1, time * 1.35, 0); coreWire.scale.setScalar(1.0 + Math.sin(time * 6.0) * 0.035 + surge * 0.11);
    halo.scale.setScalar(1.0 + Math.sin(time * 3.4) * 0.02 + surge * 0.05); halo.material.opacity = 0.055 + Math.sin(time * 3.1) * 0.015 + surge * 0.03;
    coreLight.intensity = 4.5 + Math.sin(time * 10) * 0.8 + surge * 2.2;
    rings.forEach((r, i) => { r.rotation.x = (i === 0 ? Math.PI * 0.5 : 0) + time * (0.24 + i * 0.06); r.rotation.y = (i === 1 ? Math.PI * 0.5 : 0) + time * (0.18 + i * 0.09); r.rotation.z = (i === 2 ? Math.PI * 0.25 : 0) + time * (0.12 + i * 0.05); r.scale.setScalar(1.0 + Math.sin(time * (2.0 + i) + i) * 0.025 + surge * 0.05); r.material.opacity = i === 0 ? 0.42 + surge * 0.14 : 0.22 + surge * 0.1; });
    dust.rotation.y = time * 0.025; stars.rotation.y = time * 0.004; stars.rotation.x = Math.sin(time * 0.08) * 0.02;
    nodes.forEach((n) => n.scale.setScalar(n.userData.base * (1.0 + 0.15 * Math.sin(time * 5.0 + n.userData.phase) + surge * 0.3)));
    orbs.forEach((o) => { const raw = (time * o.speed + o.offset) % 2.0; const t = raw > 1.0 ? 2.0 - raw : raw; tmp.lerpVectors(o.a, o.b, o.dir === 1 ? t : 1.0 - t).addScaledVector(o.side, Math.sin(time * 15.0 + o.offset) * 0.02); o.g.position.copy(tmp); const flare = Math.sin(time * 10.0 + o.offset) * 0.5 + 0.5; o.g.scale.setScalar(1.0 + flare * 0.5); o.glowMat.opacity = 0.3 + flare * 0.4; });
    if (composer) composer.render(); else renderer.render(scene, camera);
  }

  function resize(width, height, pixelRatio = 1) {
    const pr = Math.min(pixelRatio, maxPixelRatio); const w = Math.max(2, Math.round(width)), h = Math.max(2, Math.round(height));
    renderer.setPixelRatio(pr); renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
    uPx.value = (h * pr) / 900; // the full-page piece was tuned at about 900px tall
    if (composer) { composer.setPixelRatio(pr); composer.setSize(w, h); bloomPass.resolution.set(w * pr * 0.5, h * pr * 0.5); }
  }

  let raf = 0, running = false, t0 = 0, held = 0;
  const now = () => (typeof performance !== "undefined" ? performance.now() : Date.now()) / 1000;
  const loop = () => { if (!running) return; frame(held + now() - t0); raf = requestAnimationFrame(loop); };
  const api = {
    resize,
    start() { if (running || still != null) return; running = true; t0 = now(); raf = requestAnimationFrame(loop); },
    stop() { if (!running) return; running = false; held += now() - t0; cancelAnimationFrame(raf); },
    renderStill(seconds) { frame(seconds); },
    dispose() { api.stop(); for (const d of disposables) d.dispose?.(); if (composer) { composer.dispose?.(); bloomPass.dispose?.(); } renderer.dispose(); },
  };
  return api;
}
