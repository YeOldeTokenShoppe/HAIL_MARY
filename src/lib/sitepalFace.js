// ── SitePal face projection compositor (shared) ─────────────────────────────
// Crops the live SitePal frame onto a character's flat "projection" face mesh,
// dressed in a LIT clone of the painted face's material so both faces see the
// same lights through the day-night cycle, with an automatic skin match
// (material colour = authored flat colour ÷ measured crop median) and a short
// crossfade painted ↔ projected. This is the vendor compositor from
// CommercialStrip.jsx lifted out so the rig crew (RigCrew.jsx) can use it;
// the strip still carries its own copy with the per-pose overrides and the
// ?tune=vendor A/B pins. Keep the two in step if the math changes.
import * as THREE from "three";
import { SKIN_SAMPLE_DEFAULT } from "@/lib/vendorSitePal";

export const PROJ_FADE_S = 0.28;       // painted ↔ projected crossfade, seconds
const SKIN_SAMPLE_MS = 900;            // how often the crop is re-measured
const SKIN_EMA = 0.35;                 // smoothing on the measured skin colour
const SKIN_GAIN_MIN = 0.2;
const SKIN_GAIN_MAX = 5;
const SKIN_MATCH_ENABLED =
  typeof window === "undefined" || !/[?&]skinmatch=0\b/.test(window.location.search);
const _skinSample = new THREE.Color();

// glTF sanitizes object names ("Face3.001" → "Face3001"); match either form.
export const sanitizeName = (n) => String(n || "").replace(/[^A-Za-z0-9_]/g, "");
export function findByBaseName(root, name) {
  if (!root || !name) return null;
  const want = sanitizeName(name);
  const re = new RegExp(`^${want.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\d{3}$`);
  let exact = null, suffixed = null;
  root.traverse((o) => {
    if (exact) return;
    const n = sanitizeName(o.name);
    if (n === want) exact = o;
    else if (!suffixed && re.test(n)) suffixed = o;
  });
  return exact || suffixed;
}

// Find the faces in a loaded character and remember the projection face's
// authored material + flat colour (the skin-match target). Returns the per-
// character state the other calls take.
export function createProjectionState(root, cfg) {
  const st = { proj: null, regulars: [], authoredMaterial: null, cropCanvas: null, cropCtx: null, texture: null, material: null, materialApplied: false,
    fade: 0, skin: { measured: null, target: null, targetKey: undefined, lastSampleAt: 0, sceneVersion: -1 } };
  if (!root || !cfg) return st;
  st.proj = findByBaseName(root, cfg.projFace) || null;
  st.regulars = (cfg.regularFaces || []).map((n) => findByBaseName(root, n)).filter(Boolean);
  if (st.proj) {
    st.proj.visible = false;
    const cur = Array.isArray(st.proj.material) ? st.proj.material[0] : st.proj.material;
    if (cur && !cur.userData?.hmProjectionClone) {
      st.authoredMaterial = cur;
      if (!st.proj.userData.hmAuthoredColor && cur.color && !cur.map) st.proj.userData.hmAuthoredColor = cur.color.clone();
    }
  }
  return st;
}
export function disposeProjectionState(st) {
  if (!st) return;
  if (st.proj && st.authoredMaterial) st.proj.material = st.authoredMaterial;
  if (st.proj) st.proj.visible = false;
  st.regulars.forEach((m) => { m.visible = true; });
  try { st.texture?.dispose(); } catch (e) {}
  try { st.material?.dispose(); } catch (e) {}
  st.texture = null; st.material = null; st.materialApplied = false;
}

function ensureProjectionMaterial(st) {
  if (!st.cropCanvas) {
    const c = document.createElement("canvas"); c.width = 512; c.height = 512;
    st.cropCanvas = c; st.cropCtx = c.getContext("2d", { willReadFrequently: true });   // the skin sample reads it back every frame
  }
  if (!st.texture) {
    const tex = new THREE.CanvasTexture(st.cropCanvas);
    tex.minFilter = THREE.LinearFilter; tex.magFilter = THREE.LinearFilter;
    tex.colorSpace = THREE.SRGBColorSpace; tex.flipY = false;
    tex.wrapS = THREE.ClampToEdgeWrapping; tex.wrapT = THREE.ClampToEdgeWrapping;
    st.texture = tex;
  }
  if (!st.material && st.proj) {
    const authored = Array.isArray(st.proj.material) ? st.proj.material[0] : st.proj.material;
    const painted = st.regulars[0]?.material;
    const base = painted?.isMeshStandardMaterial ? painted : authored?.isMeshStandardMaterial ? authored : null;
    const m = base ? base.clone() : new THREE.MeshStandardMaterial({ roughness: 0.5, metalness: 0 });
    m.map = st.texture;
    m.emissiveMap = m.emissiveMap ? st.texture : null;
    m.normalMap = null; m.bumpMap = null; m.roughnessMap = null; m.metalnessMap = null;
    m.aoMap = null; m.alphaMap = null; m.lightMap = null; m.displacementMap = null;
    m.vertexColors = false;
    m.color.set(0xffffff);
    m.side = THREE.DoubleSide; m.toneMapped = true; m.transparent = false; m.opacity = 1; m.depthWrite = true;
    m.polygonOffset = true; m.polygonOffsetFactor = -2; m.polygonOffsetUnits = -2;
    m.userData.hmProjectionClone = true; m.needsUpdate = true;
    st.material = m;
  }
  if (!st.materialApplied && st.proj && st.material) { st.proj.material = st.material; st.materialApplied = true; }
}

function refreshSkinTarget(st, cfg) {
  const skin = st.skin; const key = cfg.skinTarget || "";
  if (skin.targetKey === key) return;
  skin.targetKey = key;
  if (key) { skin.target = new THREE.Color(key); return; }
  const authored = st.proj?.userData?.hmAuthoredColor;
  skin.target = authored ? authored.clone() : null;
}

function sampleSkin(st, cfg, nowMs) {
  const skin = st.skin;
  if (nowMs - skin.lastSampleAt < SKIN_SAMPLE_MS) return;
  skin.lastSampleAt = nowMs;
  const c = st.cropCanvas; const box = cfg.skinSample || SKIN_SAMPLE_DEFAULT;
  const x = Math.round(box.x * c.width), y = Math.round(box.y * c.height);
  const w = Math.max(4, Math.round(box.w * c.width)), h = Math.max(4, Math.round(box.h * c.height));
  let data;
  try { data = st.cropCtx.getImageData(x, y, w, h).data; } catch (e) { return; }
  const rs = [], gs = [], bs = [];
  for (let j = 0; j < h; j += 4) for (let i = 0; i < w; i += 4) { const k = (j * w + i) * 4; rs.push(data[k]); gs.push(data[k + 1]); bs.push(data[k + 2]); }
  if (rs.length < 16) return;
  const med = (a) => { a.sort((p, q) => p - q); return a[a.length >> 1]; };
  const mr = med(rs), mg = med(gs), mb = med(bs);
  const sum = mr + mg + mb;
  if (sum < 24 || sum > 740) return;                    // blank or white frame: not a gain
  _skinSample.setRGB(mr / 255, mg / 255, mb / 255, THREE.SRGBColorSpace);
  if (!skin.measured) skin.measured = _skinSample.clone(); else skin.measured.lerp(_skinSample, SKIN_EMA);
}

function applySkinGain(st, cfg, id) {
  const m = st.material; if (!m) return;
  const skin = st.skin;
  const active = SKIN_MATCH_ENABLED && cfg.skinMatch !== false && !!skin.target && !!skin.measured;
  let gain = null;
  if (active) {
    const t = skin.target, s = skin.measured;
    const g = (a, b) => Math.min(SKIN_GAIN_MAX, Math.max(SKIN_GAIN_MIN, a / Math.max(b, 1e-3)));
    gain = [g(t.r, s.r), g(t.g, s.g), g(t.b, s.b)];
    m.color.setRGB(gain[0], gain[1], gain[2]);
  } else m.color.set(0xffffff);
  if (typeof window !== "undefined") {
    window.__vendorSitePalSkinMatch = { vendorId: id, active, measured: skin.measured ? "#" + skin.measured.getHexString() : null, target: skin.target ? "#" + skin.target.getHexString() : null, gain };
  }
}

// Per frame. `source` is the live SitePal canvas (or null), `onScene` whether
// the host has THIS character's scene up, `show` whether the projection is
// wanted right now. Draws only with a live frame of the right scene, then
// crossfades and hides the painted layers once fully projected.
export function updateProjection(st, cfg, { source, onScene, show, delta, id = "sitepal" }) {
  if (!st || !cfg || !st.proj) return 0;
  // ?tune=vendor face A/B pin, scoped to this character: "face1" = painted mesh only, "face2" =
  // the projection mesh only (its last frame, or its authored colour if it never projected).
  const ab = typeof window !== "undefined" ? window.__vendorSitePalFaceOverride : null;
  const pinned = ab && ab.vendorId === id ? ab.mode : null;
  if (pinned === "face1") show = false;
  else if (pinned === "face2") show = true;
  const draw = show && !!source && onScene;
  if (draw) {
    ensureProjectionMaterial(st);
    const skin = st.skin;
    const ver = (typeof window !== "undefined" && window.__vendorSitePalSceneVersion) || 0;
    if (ver !== skin.sceneVersion) { skin.sceneVersion = ver; skin.measured = null; skin.lastSampleAt = 0; }
    refreshSkinTarget(st, cfg);
    const ctx = st.cropCtx, canvas = st.cropCanvas;
    const { cropX, cropY, cropW, cropH, rotateZ = 0, rotateX = 0 } = cfg.crop;
    const f = cfg.filter;
    ctx.fillStyle = skin.measured ? skin.measured.getStyle() : skin.target ? skin.target.getStyle() : "#9F7854";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    try {
      ctx.save();
      ctx.filter = `saturate(${f.saturate}%) contrast(${f.contrast}%) brightness(${f.brightness}%) hue-rotate(${f.hueRotate}deg) sepia(${f.sepia}%)`;
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate((rotateZ * Math.PI) / 180);
      ctx.scale(1, Math.cos((rotateX * Math.PI) / 180));
      ctx.translate(-canvas.width / 2, -canvas.height / 2);
      ctx.drawImage(source, cropX, cropY, cropW, cropH, 0, 0, canvas.width, canvas.height);
      ctx.restore(); ctx.filter = "none";
    } catch (e) { /* source not renderable yet */ }
    if (st.texture) st.texture.needsUpdate = true;
    sampleSkin(st, cfg, performance.now());
    applySkinGain(st, cfg, id);
  }
  const target = pinned ? (show ? 1 : 0) : draw ? 1 : 0;
  if (pinned && show && !st.material) ensureProjectionMaterial(st);   // a pinned face2 needs its material even before a frame arrives
  if (pinned || !st.material) st.fade = target;                        // pins are hard cuts: the point is to see the swap
  else if (st.fade !== target) { const step = delta / PROJ_FADE_S; st.fade = target > st.fade ? Math.min(1, st.fade + step) : Math.max(0, st.fade - step); }
  const fade = st.fade;
  st.proj.visible = fade > 0;
  if (st.material) { const mid = fade > 0 && fade < 1; st.material.opacity = fade; st.material.transparent = mid; st.material.depthWrite = !mid; }
  st.regulars.forEach((m) => { m.visible = fade < 1; });
  return fade;
}
