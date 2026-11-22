// Sacred Geometry — the card's LIVE 3D art: one lattice of eight ribbons that is, in turn, a lotus, a
// torus knot and a rose window (2026-11-21, rewritten as RL80's own).
//
// Everything here is written for this card. Three pens Michelle collected were the inspiration (a
// morphing wireframe, a torus knot, a rose of loops), and an earlier draft of this file adapted the first
// of them; none of that draft's shapes, wiring, shader or ripple is left.
//   · EIGHT ribbons, each a 13 x 5 grid of nodes, wired with rails, rungs and a braid down the middle
//   · the LOTUS: eight petals in two tiers of four, the outer tier open, the inner one half closed. The
//     tips of each tier are joined in a square: two squares, an eight-pointed star, the Miracle's shape
//   · the KNOT: the eight ribbons end to end are one closed band, three times round the ring and eight
//     times round the tube: a rosette of eight lobes, with a cuboctahedron at its heart
//   · the ROSE: each ribbon runs out from the centre, round a petal's tip and back: a rose window
//   · it changes from one to the next root first, tip last; and a light runs along the ribbons all the
//     while, petal after petal round the lotus, and in one unbroken circuit round the knot
// By the same rules as the other live scenes: no page chrome, no controls, the CARD's tilt turns it
// (opts.getTilt); everything is a function of time, so opts.still = seconds renders one exact moment (the
// poster); bloom is the one expensive pass, at half resolution, and off on a small machine (opts.bloom);
// it pauses when hidden and disposes everything on unmount.
import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";

const TAU = Math.PI * 2;
const RIBBONS = 8, ALONG = 13, ACROSS = 5, NODES = RIBBONS * ALONG * ACROSS;
const HOLD = [2.5, 2.5, 2.5], TURN = 1.6;         // seconds as lotus, knot, rose; and for each change between them
const FIRST = 1;                              // the form it opens on, and the one on the poster: 0 lotus, 1 knot, 2 rose. The others follow in that order
const at = (ribbon, a, c) => ((((ribbon % RIBBONS) + RIBBONS) % RIBBONS) * ALONG + a) * ACROSS + c;
const ease = (v) => { const x = Math.min(1, Math.max(0, v)); return x * x * (3 - 2 * x); };

// THE LOTUS. ribbon 0..7, t along 0..1 (root to tip), s across -1..1.
function lotus(ribbon, t, s, out) {
  const inner = ribbon % 2 === 1, dir = ribbon * (TAU / RIBBONS);
  const u = 0.06 + 0.9 * t;                                  // a hair short of root and tip, so both keep some width
  const reach = inner ? 5.4 : 7.9, rise = (inner ? 0.62 : 0.06) + (inner ? 0.62 : 0.5) * u * u; // the petal's midrib: it curls up as it goes
  const out0 = 0.85 + reach * u * Math.cos(rise), up = reach * u * Math.sin(rise);
  const half = (inner ? 2.1 : 2.9) * Math.pow(Math.sin(Math.PI * u), 0.7) * (1 - 0.3 * u); // a leaf: narrow, wide, pointed
  const cup = 0.42 * s * s * half;                           // its edges lift
  const rx = Math.cos(dir), rz = Math.sin(dir);
  return out.set(rx * out0 - rz * s * half, up + cup - 1.7, rz * out0 + rx * s * half);
}
// THE KNOT. The ribbons end to end are one band: ROUND times round the ring, RIBBONS times round the tube.
// Its rows are rails a third of the way round the tube apart, so every rail's lobes fall on the same spokes.
const RING = 5.0, TUBE = 1.75, ROUND = 3;
function knotAngles(ribbon, t, c) { const turn = ((ribbon + t) / RIBBONS) * TAU; return [ROUND * turn, RIBBONS * turn + c * (TAU / 3)]; }
function knot(ribbon, t, c, out) { const [phi, alpha] = knotAngles(ribbon, t, c), r = RING + TUBE * Math.cos(alpha); return out.set(r * Math.cos(phi), TUBE * Math.sin(alpha), r * Math.sin(phi)); }
function knotNormal(ribbon, t, c, out) { const [phi, alpha] = knotAngles(ribbon, t, c); return out.set(Math.cos(alpha) * Math.cos(phi), Math.sin(alpha), Math.cos(alpha) * Math.sin(phi)); }
// THE ROSE. Each ribbon leaves the centre, rounds a petal's tip and returns; its rows nest inside one another.
function rose(ribbon, t, s, out) {
  const dir = ribbon * (TAU / RIBBONS), u = Math.PI + 0.5 + t * (TAU - 1.0), k = 0.75 + 0.25 * s;
  const far = (3.75 + 3.75 * Math.cos(u)) * k, side = 2.3 * Math.sin(u) * k;
  return out.set(far * Math.cos(dir) - side * Math.sin(dir), Math.sin(u) * 0.22 * k, far * Math.sin(dir) + side * Math.cos(dir));
}

function build() {
  const P = [0, 1, 2].map(() => new Float32Array(NODES * 3)), N = [0, 1, 2].map(() => new Float32Array(NODES * 3));
  const where = new Float32Array(NODES * 3), tint = new Float32Array(NODES * 3); // where: ribbon, along, across (0..1 each); tint: its colour coordinate in each form
  const v = new THREE.Vector3();
  for (let r = 0; r < RIBBONS; r++) for (let a = 0; a < ALONG; a++) for (let c = 0; c < ACROSS; c++) {
    const i = at(r, a, c), t = a / (ALONG - 1), s = (c / (ACROSS - 1)) * 2 - 1;
    lotus(r, t, s, v).toArray(P[0], i * 3); knot(r, t, c, v).toArray(P[1], i * 3); rose(r, t, s, v).toArray(P[2], i * 3);
    knotNormal(r, t, c, v).toArray(N[1], i * 3); N[2][i * 3 + 1] = 1;
    where.set([r / RIBBONS, t, c / (ACROSS - 1)], i * 3);
    tint.set([t * 0.92 + (r % 2) * 0.06, (c % 3) / 2, 1 - Math.abs(2 * t - 1)], i * 3); // lotus: root to tip; knot: one colour to each of its three rails (gold, green, violet); rose: centre to petal tip
  }
  // The lotus's normals, from its neighbours in the grid.
  const a1 = new THREE.Vector3(), a0 = new THREE.Vector3(), c1 = new THREE.Vector3(), c0 = new THREE.Vector3();
  for (let r = 0; r < RIBBONS; r++) for (let a = 0; a < ALONG; a++) for (let c = 0; c < ACROSS; c++) {
    a1.fromArray(P[0], at(r, Math.min(a + 1, ALONG - 1), c) * 3).sub(a0.fromArray(P[0], at(r, Math.max(a - 1, 0), c) * 3));
    c1.fromArray(P[0], at(r, a, Math.min(c + 1, ACROSS - 1)) * 3).sub(c0.fromArray(P[0], at(r, a, Math.max(c - 1, 0)) * 3));
    v.crossVectors(c1, a1); if (v.lengthSq() < 1e-9) v.set(0, 1, 0); v.normalize().toArray(N[0], at(r, a, c) * 3);
  }
  return { P, N, where, tint };
}

// The wiring. kind 0 rails, 1 rungs, 2 the braid down the middle, 3 the octagon through the ribbons'
// middles, 4 the two squares through their tips.
function wire(d) {
  const pairs = []; const join = (a, b, kind) => pairs.push(a, b, kind);
  const MID = (ALONG - 1) / 2, SPINE = (ACROSS - 1) / 2, TIP = ALONG - 1;
  for (let r = 0; r < RIBBONS; r++) {
    for (let a = 0; a < ALONG; a++) for (let c = 0; c < ACROSS; c++) {
      if (a < TIP) join(at(r, a, c), at(r, a + 1, c), 0);
      if (c < ACROSS - 1) join(at(r, a, c), at(r, a, c + 1), 1);
    }
    for (let a = 0; a < TIP; a++) { const left = a % 2 === 0; join(at(r, a, left ? SPINE - 1 : SPINE + 1), at(r, a + 1, SPINE), 2); join(at(r, a, SPINE), at(r, a + 1, left ? SPINE + 1 : SPINE - 1), 2); }
    join(at(r, MID, SPINE), at(r + 1, MID, SPINE), 3);
    join(at(r, TIP, SPINE), at(r + 2, TIP, SPINE), 4);
  }
  const n = (pairs.length / 3) * 2, g = new THREE.BufferGeometry();
  const names = [["position", d.P[0]], ["aKnot", d.P[1]], ["aRose", d.P[2]], ["aN0", d.N[0]], ["aN1", d.N[1]], ["aN2", d.N[2]], ["aWhere", d.where], ["aTint", d.tint]];
  const bufs = names.map(() => new Float32Array(n * 3)), kind = new Float32Array(n);
  for (let k = 0; k < n; k++) { const src = pairs[Math.floor(k / 2) * 3 + (k % 2)]; names.forEach(([, arr], j) => bufs[j].set(arr.subarray(src * 3, src * 3 + 3), k * 3)); kind[k] = pairs[Math.floor(k / 2) * 3 + 2]; }
  names.forEach(([name], j) => g.setAttribute(name, new THREE.BufferAttribute(bufs[j], 3)));
  g.setAttribute("aKind", new THREE.BufferAttribute(kind, 1));
  return g;
}

const SHARED = `
  uniform float uTime, uStage;
  attribute vec3 aKnot, aRose, aN0, aN1, aN2, aWhere, aTint;
  varying vec3 vColor; varying float vLight, vTurning;
  // Gold at the root, candle green, teal, violet at the tip.
  vec3 ramp(float x) {
    x = clamp(x, 0.0, 1.0);
    vec3 c = mix(vec3(1.0, 0.62, 0.08), vec3(0.14, 0.86, 0.26), smoothstep(0.16, 0.48, x));
    c = mix(c, vec3(0.04, 0.62, 0.74), smoothstep(0.48, 0.72, x));
    return mix(c, vec3(0.46, 0.20, 1.0), smoothstep(0.72, 1.0, x));
  }
  vec3 place(out float light) {
    // uStage runs 0 lotus, 1 knot, 2 rose, 3 lotus again. A change starts at the roots and ends at the tips.
    float from = floor(min(uStage, 2.9999)), f = uStage - from;
    float m = smoothstep(0.0, 1.0, clamp(f * 1.7 - 0.7 * aWhere.y, 0.0, 1.0));
    vec3 w = from < 0.5 ? vec3(1.0 - m, m, 0.0) : from < 1.5 ? vec3(0.0, 1.0 - m, m) : vec3(m, 0.0, 1.0 - m); // how much lotus, knot, rose
    vec3 p = position * w.x + aKnot * w.y + aRose * w.z;
    vec3 n = normalize(aN0 * w.x + aN1 * w.y + aN2 * w.z + vec3(0.0, 0.0001, 0.0));
    vTurning = sin(f * 3.141593);
    // The light: it runs along the ribbons, one after the next, which round the knot is one unbroken circuit.
    float lap = fract((aWhere.x * 8.0 + aWhere.y) / 8.0 * 2.0 - uTime * 0.085);
    light = pow(lap, 26.0);
    // It breathes: the lotus most, the rose least.
    float calm = 1.0 - 0.45 * w.y - 0.6 * w.z;
    p += n * (0.11 * sin(uTime * 0.8 - aWhere.y * 4.0 + aWhere.x * 12.566371) * calm + 0.28 * light * (1.0 - 0.4 * w.z));
    vColor = mix(ramp(dot(aTint, w)), vec3(1.0, 0.86, 0.5), min(light * 0.7, 0.7)) * (1.0 - 0.4 * w.y); // the knot's rails lie on one another, so each is dimmer there
    vLight = light;
    return p;
  }`;
const NODE_VERT = `${SHARED}
  uniform float uPoint, uKnot;
  void main() {
    float light; vec3 p = place(light);
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_PointSize = min((2.0 + vTurning * 0.6 + light * 3.6 + uKnot * 0.9) * uPoint * (76.0 / max(7.0, -mv.z)), 36.0 * uPoint);
    gl_Position = projectionMatrix * mv;
  }`;
// A node is a soft disc; when the light passes through, it flares as an eight-pointed star.
const NODE_FRAG = `
  varying vec3 vColor; varying float vLight, vTurning;
  void main() {
    vec2 c = gl_PointCoord - 0.5; float r = length(c); if (r > 0.5) discard;
    float disc = smoothstep(0.5, 0.1, r), heart = smoothstep(0.22, 0.0, r);
    vec2 d = vec2(0.7071 * (c.x + c.y), 0.7071 * (c.x - c.y));
    float star = (exp(-abs(c.x) * 46.0) + exp(-abs(c.y) * 46.0) + 0.55 * exp(-abs(d.x) * 46.0) + 0.55 * exp(-abs(d.y) * 46.0)) * smoothstep(0.5, 0.05, r) * vLight;
    gl_FragColor = vec4(vColor * (0.95 + heart * 0.4 + vTurning * 0.12 + vLight * 0.6 + star * 0.5), disc * (0.72 + heart * 0.3) + star * 0.4);
  }`;
const LINE_VERT = `${SHARED}
  attribute float aKind; varying float vKind;
  void main() { float light; vec3 p = place(light); vKind = aKind; gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0); }`;
const LINE_FRAG = `
  uniform float uKnot;
  varying vec3 vColor; varying float vLight, vTurning, vKind;
  void main() {
    float o = 0.5;                                        // rails
    if (vKind > 0.5) o = 0.3;                             // rungs
    if (vKind > 1.5) o = 0.16;                            // the braid
    if (vKind > 2.5) o = 0.4 * (1.0 - uKnot);             // the octagon and the two squares would cut across the knot's heart, so they fade there
    gl_FragColor = vec4(vColor * (0.95 + vLight * 0.8 + vTurning * 0.15), min(o + vLight * 0.35 + vTurning * 0.05, 0.98));
  }`;

export function mount(canvas, opts = {}) {
  const { getTilt = () => ({ x: 0, y: 0 }), still = null, bloom = true, maxPixelRatio = 1.5 } = opts;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: "high-performance", preserveDrawingBuffer: still != null });
  renderer.setClearColor(0x030409, 1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(43, 1, 0.1, 100);
  const composer = bloom ? new EffectComposer(renderer) : null;
  let bloomPass = null;
  if (composer) { composer.addPass(new RenderPass(scene, camera)); bloomPass = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.6, 0.4, 0.3); composer.addPass(bloomPass); composer.addPass(new OutputPass()); }

  // The ground: a dark burst behind the form, eight broad rays and eight narrow ones between them, turning
  // slowly the other way. It is what tells this card from The Singular80's empty black at a glance.
  const burstMat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uCentre: { value: new THREE.Vector2(0, 0.2) }, uAspect: { value: 1 } },
    vertexShader: `varying vec2 vP; void main() { vP = position.xy; gl_Position = vec4(position.xy, 1.0, 1.0); }`,
    fragmentShader: `
      uniform float uTime, uAspect; uniform vec2 uCentre; varying vec2 vP;
      void main() {
        vec2 q = (vP - uCentre) * vec2(uAspect, 1.0); float r = length(q), a = atan(q.y, q.x) - uTime * 0.02;
        float broad = smoothstep(0.15, 0.6, cos(a * 8.0)), fine = smoothstep(0.75, 0.98, cos(a * 8.0 + 3.141593));
        float reach = smoothstep(0.1, 0.34, r) * (1.0 - smoothstep(0.75, 1.75, r));   // nothing right behind the form, fading to the corners
        float rings = 0.5 + 0.5 * cos(r * 15.0 - 0.4);                                // the rays are stepped, like cut stone
        vec3 ground = mix(vec3(0.004, 0.006, 0.02), vec3(0.0015, 0.002, 0.008), smoothstep(0.3, 1.5, r));
        vec3 ray = vec3(0.017, 0.009, 0.045) * broad * (0.6 + 0.4 * rings) + vec3(0.022, 0.014, 0.004) * fine;
        gl_FragColor = vec4(ground + ray * reach, 1.0);
      }`,
    depthTest: false, depthWrite: false,
  });
  const burstGeo = new THREE.BufferGeometry(); burstGeo.setAttribute("position", new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
  const burst = new THREE.Mesh(burstGeo, burstMat); burst.frustumCulled = false; burst.renderOrder = -1; scene.add(burst);

  const art = new THREE.Group(); scene.add(art);
  const d = build();
  const uniforms = { uTime: { value: 0 }, uStage: { value: 0 }, uPoint: { value: 1 }, uKnot: { value: 0 } };
  const nodeGeo = new THREE.BufferGeometry();
  for (const [name, arr] of [["position", d.P[0]], ["aKnot", d.P[1]], ["aRose", d.P[2]], ["aN0", d.N[0]], ["aN1", d.N[1]], ["aN2", d.N[2]], ["aWhere", d.where], ["aTint", d.tint]]) nodeGeo.setAttribute(name, new THREE.BufferAttribute(arr, 3));
  const lineGeo = wire(d);
  const mat = (vertexShader, fragmentShader) => new THREE.ShaderMaterial({ uniforms, vertexShader, fragmentShader, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  const nodeMat = mat(NODE_VERT, NODE_FRAG), lineMat = mat(LINE_VERT, LINE_FRAG);
  const lines = new THREE.LineSegments(lineGeo, lineMat); lines.frustumCulled = false; lines.renderOrder = 1; art.add(lines);
  const nodes = new THREE.Points(nodeGeo, nodeMat); nodes.frustumCulled = false; nodes.renderOrder = 2; art.add(nodes);

  // The knot's heart: a cuboctahedron with its twelve spokes, which fades in with the knot and out with it.
  const cv = []; for (const a of [1, -1]) for (const b of [1, -1]) cv.push([a, b, 0], [a, 0, b], [0, a, b]);
  const HEART = 1.75, heartPts = [];
  for (let a = 0; a < 12; a++) { heartPts.push(0, 0, 0, ...cv[a].map((x) => x * HEART));
    for (let b = a + 1; b < 12; b++) if (Math.abs((cv[a][0] - cv[b][0]) ** 2 + (cv[a][1] - cv[b][1]) ** 2 + (cv[a][2] - cv[b][2]) ** 2 - 2) < 0.1) heartPts.push(...cv[a].map((x) => x * HEART), ...cv[b].map((x) => x * HEART)); }
  const heartGeo = new THREE.BufferGeometry(); heartGeo.setAttribute("position", new THREE.Float32BufferAttribute(heartPts, 3));
  const heartMat = new THREE.LineBasicMaterial({ color: 0xffc23a, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  const heart = new THREE.LineSegments(heartGeo, heartMat); heart.rotation.set(Math.PI / 2, 0, Math.PI / 4); art.add(heart);
  const dotGeo = new THREE.BufferGeometry(); dotGeo.setAttribute("position", new THREE.Float32BufferAttribute([0, 0, 0, ...cv.flatMap((v) => v.map((x) => x * HEART))], 3));
  const dotMat = new THREE.PointsMaterial({ color: 0xffe08a, size: 0.34, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  heart.add(new THREE.Points(dotGeo, dotMat));

  // Where the form is in its cycle at a given time: 0 lotus, 1 knot, 2 rose, 3 lotus again.
  const cycle = HOLD[0] + HOLD[1] + HOLD[2] + TURN * 3;
  const start = [0, HOLD[0] + TURN, HOLD[0] + HOLD[1] + TURN * 2][FIRST]; // where in the cycle time 0 falls
  const stageAt = (time) => { let t = (((time + start) % cycle) + cycle) % cycle;
    for (let k = 0; k < 3; k++) { if (t < HOLD[k]) return k; t -= HOLD[k]; if (t < TURN) return k + t / TURN; t -= TURN; }
    return 0; };

  const tilt = { x: 0, y: 0 };
  function frame(time) {
    const stage = stageAt(time), from = Math.floor(Math.min(stage, 2.9999)), m = ease(stage - from);
    const knotness = from === 0 ? m : from === 1 ? 1 - m : 0, roseness = from === 1 ? m : from === 2 ? 1 - m : 0;
    uniforms.uTime.value = time; uniforms.uStage.value = stage; uniforms.uKnot.value = knotness; burstMat.uniforms.uTime.value = time;
    heartMat.opacity = 0.75 * knotness * knotness; dotMat.opacity = knotness * knotness; heart.visible = knotness > 0.01; heart.scale.setScalar(0.6 + 0.4 * knotness + 0.03 * Math.sin(time * 2.5));
    // The card's lean turns the form; left alone it sways a little and turns slowly. The knot and the rose
    // are flat, so the whole piece tips to face you as they form.
    const t = getTilt() || { x: 0, y: 0 }; tilt.x += (t.x - tilt.x) * 0.1; tilt.y += (t.y - tilt.y) * 0.1;
    art.rotation.set(0.1 + 0.74 * (knotness + roseness) + Math.sin(time * 0.13 + 1.0) * 0.03 + tilt.y * 0.3, 0.3 + time * 0.045 + Math.sin(time * 0.2) * 0.08 + tilt.x * 0.8, -0.06 + Math.sin(time * 0.11 + 2.4) * 0.025);
    art.scale.setScalar(1.06 + 0.1 * knotness);
    if (bloomPass) { bloomPass.strength = 0.55 - 0.1 * knotness - 0.1 * roseness + 0.15 * Math.sin((stage % 1) * Math.PI); bloomPass.radius = 0.38; }
    if (composer) composer.render(); else renderer.render(scene, camera);
  }

  function resize(width, height, pixelRatio = 1) {
    const w = Math.max(2, Math.round(width)), h = Math.max(2, Math.round(height)), pr = Math.min(pixelRatio, maxPixelRatio);
    renderer.setPixelRatio(pr); renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
    camera.position.set(2.9, 16.4, 20.6); camera.lookAt(0, -1.9, 0); // the form sits a little above the window's centre, clear of the card's text box
    uniforms.uPoint.value = pr * (h / 900) * 1.5;
    camera.updateMatrixWorld(); const c = new THREE.Vector3(0, 0, 0).project(camera); burstMat.uniforms.uCentre.value.set(c.x, c.y); burstMat.uniforms.uAspect.value = w / h; // the burst is centred on the form
    if (composer) { composer.setPixelRatio(pr); composer.setSize(w, h); bloomPass.resolution.set(w * pr * 0.5, h * pr * 0.5); }
  }

  let raf = 0, running = false, t0 = 0, held = 0;
  const now = () => (typeof performance !== "undefined" ? performance.now() : Date.now()) / 1000;
  const loop = () => { if (!running) return; frame(held + now() - t0); raf = requestAnimationFrame(loop); };
  const api = {
    resize,
    start() { if (running || still != null) return; running = true; t0 = now(); raf = requestAnimationFrame(loop); },
    stop() { if (!running) return; running = false; held += now() - t0; cancelAnimationFrame(raf); },
    renderStill(seconds) { tilt.x = 0; tilt.y = 0; frame(seconds); },
    dispose() { api.stop(); for (const x of [nodeGeo, lineGeo, nodeMat, lineMat, heartGeo, heartMat, dotGeo, dotMat, burstGeo, burstMat]) x.dispose(); if (composer) { composer.dispose?.(); bloomPass.dispose?.(); } renderer.dispose(); },
  };
  return api;
}
