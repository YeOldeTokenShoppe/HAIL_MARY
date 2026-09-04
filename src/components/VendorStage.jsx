"use client";
// ── Phone boardwalk: one live stall inside a portal card ─────────────────────
// The phone never loads the whole strip GLB. Browsing is a row of POSTCARDS
// (stills rendered from the desktop strip by scripts/render-postcards.mjs);
// picking one mounts that STALL alone — its props extracted from the strip by
// scripts/extract-stalls.mjs (public/models/stalls/stall_<id>.glb, original
// transforms, the deck included) plus the vendor character, composed in the
// strip's own frame exactly as CommercialStrip does — inside a
// MeshPortalMaterial card (Wawa Sensei's "stage" idiom), with the stall's
// BACKPLATE (the same still with this stall's dressing hidden) behind it so
// the neighbours and sky show through. STEP UP blends the portal to full
// screen — the same face-zoom + SitePal pitch the desktop gives when you walk
// up — and the vendor's panel (the salesman's cart) sits under the scene in
// DOM. One portal is ever live, so one extra render pass and one stall's
// textures (1k) in memory.
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { MeshPortalMaterial, RoundedBox, useTexture, useGLTF } from "@react-three/drei";
import { VendorModel, VENDOR_CATALOG } from "@/components/CommercialStrip";
import { activateVendorSitePal, deactivateVendorSitePal, warmVendorSitePal } from "@/lib/vendorSitePal";
import { goodsForVendor } from "@/lib/oilVendor";

export const BOARDWALK_NAMES = {
  tonics: "SNAKE OIL", fortunes: "FORTUNES", hotdogs: "HOT DOGS", tacos: "TACOS", promos: "PROMOS",
  rugs: "RUGS", tattoos: "TATTOOS", carny: "CARNY", souvenirs: "SOUVENIRS",
};
// Row order on the phone: the salesman first (he sells the holy water). The
// souvenir tent is off the row: its prop is not in the current strip export.
export const BOARDWALK_ORDER = ["tonics", "fortunes", "hotdogs", "tacos", "promos", "rugs", "tattoos", "carny"];
export const postcardUrl = (id) => `/boardwalk/${id}.webp`;
export const plateUrl = (id) => `/boardwalk/${id}-plate.webp`;
export const stallUrl = (id) => `/models/stalls/stall_${id}.glb`;

// Step up to a stall: MUST run inside the user's tap. activateVendorSitePal
// unlocks browser audio and (on touch) boots the lazily embedded player from
// that gesture — the desktop walk-up calls it from the stall click for the
// same reason. Called from the STEP UP button and the card tap; the stage's
// effect only handles the mute on the way out.
export function stepUpVendor(vendorId) {
  const v = VENDOR_CATALOG.find((x) => x.id === vendorId);
  if (v?.sitepal) activateVendorSitePal(v.sitepal);
}
export function stepBackVendor() { deactivateVendorSitePal(); }
export function warmBoardwalk(reason = "boardwalk") { warmVendorSitePal(reason); }

// ?spdebug=1 — SitePal state on screen, for phone testing (Web Inspector optional).
function SitePalReadout() {
  const [txt, setTxt] = useState("");
  useEffect(() => {
    if (typeof window === "undefined" || !/[?&]spdebug=1\b/.test(window.location.search)) return;
    const t = setInterval(() => {
      const w = window;
      setTxt(`sitepal · embedded ${!!w.__vendorSitePalEmbedded} · wanted ${!!w.__vendorSitePalWanted} · scene ${w.__vendorSitePalCurrentSceneId ?? "-"} loaded ${w.__vendorSitePalSceneLoaded ?? "-"} · vol ${w.__vendorSitePalDesiredVolume ?? "-"} · say ${typeof w.sayText === "function" ? "ready" : "no"} · silent ${typeof w.saySilent === "function" ? "ok" : "no"}`);
    }, 500);
    return () => clearInterval(t);
  }, []);
  if (!txt) return null;
  return <div style={{ ...mono, position: "absolute", left: 8, right: 8, top: 96, fontSize: 8, lineHeight: 1.4, padding: "4px 6px", background: "rgba(0,0,0,0.7)", color: "#9fe0a8", borderRadius: 4, pointerEvents: "none", wordBreak: "break-word" }}>{txt}</div>;
}

export const STAGE_CAMERA = { position: [0, 0.06, 1.45], target: [0, 0.06, 0] };
// Stepped up: the desktop's hero close-up — under the eyeline, looking up a touch.
const FACE_CAMERA = { position: [0, 0.1, 0.46], target: [0, 0.15, 0] };
const CARD = { w: 0.72, h: 0.96, depth: 0.05, radius: 0.04 };
const CHAR_H = 0.62;           // character height inside the card
const FLOOR_Y = -0.4;          // his feet
const STRIP_ROT_Y = Math.PI / 2;          // the strip's frame turn
const VENDOR_LOCAL_FACE_YAW = -Math.PI / 2; // the strip's default facing (CommercialStrip)

function StageCamera({ open }) {
  const { camera } = useThree();
  const tmp = useMemo(() => ({ p: new THREE.Vector3(), t: new THREE.Vector3(), cur: new THREE.Vector3(...STAGE_CAMERA.target) }), []);
  useEffect(() => {
    camera.position.set(...STAGE_CAMERA.position);
    camera.lookAt(...STAGE_CAMERA.target);
    camera.updateProjectionMatrix();
  }, [camera]);
  useFrame((_, dt) => {
    const want = open ? FACE_CAMERA : STAGE_CAMERA;
    tmp.p.set(...want.position); tmp.t.set(...want.target);
    const k = 1 - Math.exp(-dt * 3.5);
    camera.position.lerp(tmp.p, k); tmp.cur.lerp(tmp.t, k); camera.lookAt(tmp.cur);
  });
  return null;
}

function Backdrop({ id }) {
  const tex = useTexture(plateUrl(id));
  useEffect(() => { tex.colorSpace = THREE.SRGBColorSpace; tex.needsUpdate = true; }, [tex]);
  // Big enough to fill the card's view AND the full-screen view (see the frustum note in the file header).
  return (
    <mesh position={[0, 0.02, -0.62]}>
      <planeGeometry args={[1.6, 2.13]} />
      <meshBasicMaterial map={tex} toneMapped={false} />
    </mesh>
  );
}

// The stall's props (extracted from the strip, original transforms) and the
// character at the catalog offset, in the strip's own frame — one group turned
// so the vendor faces the camera (the strip's yaw maths, so VendorModel's head
// tracking agrees) and FITTED from the vendor's POSED bones a few frames in:
// scaled so he stands CHAR_H tall, moved so his feet meet FLOOR_Y at the card's
// centre. The props ride along, so his place in his stall is the desktop's.
// (Box3 on a skinned mesh only measures the bind pose — a seated vendor would
// float; bones don't lie.)
function StallProps({ id }) {
  const { scene } = useGLTF(stallUrl(id));
  useEffect(() => { scene.traverse((o) => { if (o.isMesh) { o.frustumCulled = false; } }); }, [scene]);
  return <primitive object={scene} />;
}
function StageStall({ vendor, focusedRef }) {
  const group = useRef();
  const headRef = useRef(null);
  const frames = useRef(0);
  const fitted = useRef(false);
  const rotY = STRIP_ROT_Y + (VENDOR_LOCAL_FACE_YAW - (vendor.faceYaw ?? VENDOR_LOCAL_FACE_YAW));
  const hasCharacter = !!(vendor.model || vendor.poseModels?.length);
  useFrame(() => {
    const g = group.current; if (!g || fitted.current) return;
    if (++frames.current < 4) return;
    const w = new THREE.Vector3(); let lo = Infinity, hi = -Infinity, cx = 0, cz = 0, n = 0;
    g.scale.setScalar(1); g.position.set(0, 0, 0); g.updateMatrixWorld(true);
    g.traverse((o) => { if (o.isBone) { o.getWorldPosition(w); lo = Math.min(lo, w.y); hi = Math.max(hi, w.y); cx += w.x; cz += w.z; n++; } });
    if (!n || !(hi - lo > 1e-4)) { if (frames.current > 90) fitted.current = true; return; }
    const h = (hi - lo) * 1.12;              // bones stop at the crown; allow for hair/hat
    const s = CHAR_H / h;
    g.scale.setScalar(s);
    g.position.set(-(cx / n) * s, FLOOR_Y - lo * s, -(cz / n) * s);
    fitted.current = true;
  });
  return (
    <group ref={group} rotation={[0, rotY, 0]}>
      <Suspense fallback={null}><StallProps id={vendor.id} /></Suspense>
      {hasCharacter && (
        <group position={vendor.offset || [0, 0, 0]}>
          <VendorModel vendor={vendor} focusedRef={focusedRef} headRef={headRef} stripScene={null} stripRotY={rotY} />
        </group>
      )}
    </group>
  );
}

export default function VendorStage({ vendorId = "tonics", open = false, onToggle, lowTier = false }) {
  const vendor = useMemo(() => VENDOR_CATALOG.find((v) => v.id === vendorId) || VENDOR_CATALOG[0], [vendorId]);
  const portal = useRef();
  const focusedRef = useRef(open); focusedRef.current = open;
  useFrame((_, dt) => {
    const m = portal.current; if (!m) return;
    m.blend = THREE.MathUtils.damp(m.blend, open ? 1 : 0, 4.5, dt);
  });
  // The greeting starts in the tap (stepUpVendor) and the mute on the way out
  // is imperative too (stepBackVendor, from the page's toggle/select/tab
  // switch) — the desktop's enter/exit are imperative for the same reason.
  // Only the unmount mutes from here.
  useEffect(() => () => { deactivateVendorSitePal(); }, []);
  return (
    <group name="vendor-stage">
      <StageCamera open={open} />
      {/* rim in the stall's accent, a hair behind the card */}
      <RoundedBox args={[CARD.w + 0.03, CARD.h + 0.03, 0.02]} radius={CARD.radius} position={[0, 0.04, -0.03]}>
        <meshBasicMaterial color={vendor.accent || "#ffd27a"} toneMapped={false} />
      </RoundedBox>
      <RoundedBox name="vendor-card" args={[CARD.w, CARD.h, CARD.depth]} radius={CARD.radius} position={[0, 0.04, 0]}
        onClick={(e) => { e.stopPropagation(); if (!open) stepUpVendor(vendor.id); else stepBackVendor(); onToggle?.(); }}>
        <MeshPortalMaterial ref={portal} blend={0} side={THREE.DoubleSide} resolution={lowTier ? 512 : 1024} events={false}>
          <ambientLight intensity={0.9} />
          <directionalLight position={[0.6, 1.2, 1.4]} intensity={1.6} />
          <directionalLight position={[-0.8, 0.6, 0.4]} intensity={0.5} color="#ffd9b0" />
          <Suspense fallback={null}>
            <Backdrop id={vendor.id} />
            <StageStall key={vendor.id} vendor={vendor} focusedRef={focusedRef} />
          </Suspense>
        </MeshPortalMaterial>
      </RoundedBox>
    </group>
  );
}

// ── DOM: the postcard row + the step-up control, overlaid on the phone canvas ──
const mono = { fontFamily: "'Share Tech Mono', monospace", letterSpacing: "0.1em" };
const panel = { background: "rgba(14,10,12,0.78)", border: "1px solid rgba(255,140,90,0.45)", borderRadius: 6, color: "#ffd9c9", backdropFilter: "blur(4px)" };
export function BoardwalkStrip({ vendorId, onSelect, open, onToggleOpen, children }) {
  const name = BOARDWALK_NAMES[vendorId] || vendorId.toUpperCase();
  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 4 }}>
      {/* At rest the card and the postcards are the whole scene — a tap on the
          card steps in. The title, STEP BACK and the vendor's panel only show
          once the player is inside the portal. */}
      {open && (
        <div style={{ position: "absolute", top: "calc(8px + env(safe-area-inset-top, 0px))", left: "calc(8px + env(safe-area-inset-left, 0px))", display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 6 }}>
          <div style={{ ...panel, ...mono, padding: "7px 10px", fontSize: 10 }}>
            <div style={{ color: "#ff8c5a", fontSize: 9 }}>BOARDWALK</div>
            <div>{name}</div>
          </div>
          <button type="button" onClick={onToggleOpen}
            style={{ ...panel, ...mono, padding: "9px 12px", fontSize: 10, cursor: "pointer", pointerEvents: "auto", color: "#ffd9c9" }}>
            ◂ STEP BACK
          </button>
        </div>
      )}
      <SitePalReadout />
      {/* the vendor's own panel (cart, booth…) — sits at the bottom once inside, the postcards are gone */}
      {open && children && <div style={{ position: "absolute", left: "calc(8px + env(safe-area-inset-left, 0px))", bottom: "calc(10px + env(safe-area-inset-bottom, 0px))", pointerEvents: "auto" }}>{children}</div>}
      {/* the deck under the postcards — Wood_FloorBoards turned 90° so the planks
          run away from the viewer (public/boardwalk/deck.webp), tiled along the row */}
      {!open && <div aria-hidden style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 110, backgroundImage: "linear-gradient(to bottom, rgba(10,6,8,0.45), rgba(0,0,0,0) 18%), url(/boardwalk/deck.webp)", backgroundRepeat: "no-repeat, repeat-x", backgroundSize: "100% 100%, auto 260%", backgroundPosition: "0 0, 0 35%", filter: "brightness(1.35) saturate(1.1)", boxShadow: "inset 0 8px 12px -8px rgba(0,0,0,0.8)" }} />}
      {/* postcards — the boardwalk at rest; hidden while stepped into a stall */}
      {!open && <div style={{ position: "absolute", left: 0, right: 0, bottom: 10, display: "flex", gap: 8, overflowX: "auto", padding: "0 8px", pointerEvents: "auto", WebkitOverflowScrolling: "touch", scrollbarWidth: "none" }}>
        {BOARDWALK_ORDER.map((id) => {
          const on = id === vendorId;
          return (
            <button key={id} type="button" aria-label={BOARDWALK_NAMES[id] || id} aria-pressed={on} onClick={() => { warmBoardwalk("postcard:" + id); onSelect?.(id); }}
              style={{ flex: "0 0 auto", width: 64, height: 86, padding: 0, borderRadius: 6, overflow: "hidden", cursor: "pointer", background: "#1a1214",
                border: on ? "2px solid #ffd27a" : "1px solid rgba(255,140,90,0.45)", boxShadow: on ? "0 0 10px rgba(255,210,122,0.45)" : "none", position: "relative" }}>
              <img src={postcardUrl(id)} alt="" draggable={false} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", opacity: on ? 1 : 0.8 }} />
              <span style={{ ...mono, position: "absolute", left: 0, right: 0, bottom: 0, fontSize: 7, padding: "3px 2px", background: "rgba(0,0,0,0.55)", color: on ? "#ffd27a" : "#ffd9c9", textAlign: "center" }}>{BOARDWALK_NAMES[id]}</span>
            </button>
          );
        })}
      </div>}
    </div>
  );
}

// ── The salesman's cart (DOM) — goods paid from the tank ─────────────────────
// `tank` is the live un-banked balance from the drill doc, `owned` the current
// count; `onBuy(item)` posts to /api/oil-vendor-buy and resolves { ok, error }.
export function VendorCart({ vendorId, tank = 0, owned = {}, signedIn = false, onBuy, compact = false }) {
  const goods = goodsForVendor(vendorId);
  const [busy, setBusy] = useState(null);
  const [note, setNote] = useState("");
  if (!goods.length) return null;
  const buy = async (g) => {
    if (busy) return;
    setBusy(g.id); setNote("");
    try {
      const r = await onBuy?.(g.id);
      if (r?.ok) setNote(`◆ BOUGHT · ${g.label} ×${r.count ?? ""}`.trim());
      else if (r?.error === "not_enough_oil") setNote("✗ NOT ENOUGH IN THE TANK");
      else if (r?.error === "unauthorized") setNote("✗ SIGN IN TO BUY");
      else setNote("✗ THE SALE FELL THROUGH");
    } finally { setBusy(null); }
  };
  // A compact goods card, not a bar: the bottle on the left, title / blurb /
  // price on the right, BUY underneath. Sized to its content (≤ 300px).
  return (
    <div style={{ ...panel, ...mono, padding: 10, fontSize: 10, display: "grid", gap: 8, width: 300, maxWidth: "calc(100vw - 24px)", boxSizing: "border-box" }}>
      <div style={{ display: "flex", justifyContent: "space-between", color: "#ff8c5a", fontSize: 9 }}>
        <span>THE CART</span><span title="Oil in your tank, un-banked">TANK {Math.floor(tank).toLocaleString()} BTR</span>
      </div>
      {goods.map((g) => {
        const have = owned?.[g.supply] || 0; const canPay = tank >= g.price; const ok = canPay && signedIn;
        return (
          <div key={g.id} style={{ display: "grid", gridTemplateColumns: "72px 1fr", gap: 10, alignItems: "start" }}>
            <div style={{ width: 72, height: 72, borderRadius: 6, background: "radial-gradient(circle at 50% 40%, rgba(159,216,255,0.35), rgba(159,216,255,0.04) 70%)", display: "grid", placeItems: "center" }}>
              {g.image ? <img src={g.image} alt="" draggable={false} style={{ width: 64, height: 64, objectFit: "contain", filter: "drop-shadow(0 0 6px rgba(159,216,255,0.6))" }} /> : <span style={{ fontSize: 28 }}>💧</span>}
            </div>
            <div style={{ display: "grid", gap: 4 }}>
              <div style={{ color: "#ffd27a", fontSize: 11 }}>{g.label}{have > 0 && <span style={{ marginLeft: 8, color: "#9fe0a8", fontSize: 9 }}>×{have} held</span>}</div>
              <div style={{ opacity: 0.8, fontSize: 9, lineHeight: 1.45, letterSpacing: "0.04em" }}>{g.blurb}</div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginTop: 2 }}>
                <span style={{ color: "#dff2ff", fontSize: 11 }}>{g.price.toLocaleString()} {g.currency || "BTR"}<span style={{ opacity: 0.6, fontSize: 9 }}> · {g.unit}</span></span>
                <button type="button" disabled={!!busy || !ok} onClick={() => buy(g)}
                  style={{ ...mono, padding: "7px 10px", fontSize: 10, borderRadius: 4, cursor: busy || !ok ? "default" : "pointer",
                    background: ok ? "rgba(255,210,122,0.16)" : "transparent", color: ok ? "#ffd27a" : "rgba(255,217,201,0.45)", border: `1px solid ${ok ? "#ffd27a" : "rgba(255,217,201,0.25)"}` }}>
                  {busy === g.id ? "…" : !signedIn ? "SIGN IN" : "BUY"}
                </button>
              </div>
            </div>
          </div>
        );
      })}
      {note && <div style={{ color: note.startsWith("◆") ? "#9fe0a8" : "#ff8c5a" }}>{note}</div>}
    </div>
  );
}
