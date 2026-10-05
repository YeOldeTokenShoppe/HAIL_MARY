"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Html, useGLTF } from "@react-three/drei";
import * as THREE from "three";

// ── Gachapon on the boardwalk ── click to zoom in, then turn the knob for a
// capsule. The machine is the same model as /gachapon's toyVENDnft.glb, baked
// into the strip GLB under the EMPTY parent `Gachapon` (~69 meshes); clicks on
// any of them are claimed by ancestry. Everything under Object_4 carries the
// identical transforms to toyVENDnft, so the knob/drop numbers below are the
// VendingMachine.jsx values unchanged.
//
// Same contract as ClawMachineController: CommercialStrip's deck handlers call
// interactionRef.current.handleClick / handlePointerDown first, and the walker
// reaches it through __hmVendorSpots + "hm-vendor-enter".
const NODE = "Gachapon";
const APPROACH = new THREE.Vector3(0, 0.12, 1); // machine-local: +Z is its front
const FIT = 1.25;                               // breathing room around the cabinet

// From VendingMachine.jsx.
const TURN = Math.PI / 2;           // a quarter turn of the knob drops a capsule
const DROP_HEIGHT = 0.3;            // Object_4 units (a capsule is ~11) — a hop, not a fall
const GRAVITY = 0.0015;             // per 60 fps frame, like the original
const BOUNCE_DAMPING = 0.4;
const KNOB_EASE = 0.08;             // fraction of the remaining turn per 60 fps frame
const CAPSULE_COLORS = ["#3943BC", "#14A122", "#A81814"];
const KNOB_GLOW = 0x00f5d4;         // teal pulse while a capsule is on offer
// The original mapped drag to world-x × 2, which means nothing at the strip's
// scale (the whole machine is ~0.14 world units tall), so drag is in pixels.
const DRAG_PX_PER_TURN = 140;

// ── Capsule reveal ── /gachapon's CenteredCapsule, re-staged for the field.
// There it sits at a fixed spot by the scene origin and the camera flies to it;
// here the world is the whole mesa, so the capsule comes to the CAMERA instead:
// it rises out of the tray to a spot just in front of the lens, then opens on a
// click. Same model, same open/float numbers, same choir and Play Again.
const REVEAL_MODEL = "/models/ipadMaryToy.glb";
const REVEAL_DIST = 0.16;      // world units in front of the lens (the page's near plane is 0.1)
const REVEAL_FILL = 0.55;      // capsule height as a share of the view height
const RISE_SECONDS = 0.9;
const LEAVE_SECONDS = 0.45;
const OPEN_TRAVEL = 0.15;      // glass up / base down, model units (CenteredCapsule)
const OPEN_EASE = 0.03;        // per 60 fps frame
const VEIL_OPACITY = 0.7;
const VEIL_FADE = 0.02;        // per 60 fps frame, as the original's reveal ramp
const TOY_GLOW = 0.6;          // self-lit toy stands in for /gachapon's spotlight (see below)
// Drawn AFTER the scene: the veil ignores depth entirely, so it never depends on
// how close the machine is. Veil and capsule both sit in the transparent pass,
// where renderOrder decides which goes first.
const VEIL_ORDER = 9998, CAPSULE_ORDER = 9999, GLASS_ORDER = 10000;
const SCREEN_CENTER = (_object, _camera, size) => [size.width / 2, size.height / 2];
// The page mounts the whole field inside a translated group (OilVoxelGrid sits
// at y=5), so a pose worked out in WORLD space has to be converted into the
// object's parent space before it is written — otherwise the capsule rises to a
// spot 5 units above the camera and simply never appears.
const _m = new THREE.Matrix4(), _inv = new THREE.Matrix4(), _s = new THREE.Vector3();
const setWorldPose = (obj, position, quaternion, scale) => {
  _m.compose(position, quaternion, _s.setScalar(scale));
  if (obj.parent) {
    obj.parent.updateWorldMatrix(true, false);
    _m.premultiply(_inv.copy(obj.parent.matrixWorld).invert());
  }
  _m.decompose(obj.position, obj.quaternion, obj.scale);
};
const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

const under = (object, ancestor) => { for (let o = object; o; o = o.parent) if (o === ancestor) return true; return false; };
const X_AXIS = new THREE.Vector3(1, 0, 0);
const _q = new THREE.Quaternion();

function CapsuleReveal({ apiRef }) {
  const { scene } = useGLTF(REVEAL_MODEL);
  const { camera } = useThree();
  const group = useRef(), veil = useRef();
  const [phase, setPhase] = useState("off");   // React copy, only for the Play Again button
  const st = useRef({ phase: "off", t: 0, from: new THREE.Vector3(), fromScale: 0, veil: 0, choir: null });

  // Own copy of the model and its materials. The toy is RL80 in this file — the
  // /gachapon code looks for IpadMary, which is why its toy never floated there.
  const model = useMemo(() => {
    const root = scene.clone(true);
    let glass = null, base = null, toy = null;
    const mats = [];
    root.traverse((o) => {
      if (o.name === "CapsuleGlassA") glass = o;
      else if (o.name === "CapsuleBaseA") base = o;
      else if (o.name === "RL80" || o.name === "IpadMary") toy = o;
      if (!o.isMesh) return;
      o.material = o.material.clone();
      o.material.userData = {};   // clone() JSON-round-trips userData; Textures in it break uploads
      // Transparent pass so renderOrder puts it after the veil; depth-tested so
      // glass, base and toy still occlude each other (the scene behind is
      // always further than the capsule's own spot past the lens).
      o.material.transparent = true;
      o.material.fog = false;
      mats.push(o.material);
    });
    root.traverse((o) => { if (o.isMesh) o.renderOrder = glass && under(o, glass) ? GLASS_ORDER : CAPSULE_ORDER; });
    // The toy glows from its own texture as the veil comes down.
    if (toy) toy.traverse((o) => {
      if (!o.isMesh || !o.material.map) return;
      o.material.emissive = new THREE.Color(0xffffff);
      o.material.emissiveMap = o.material.map;
      o.material.emissiveIntensity = 0;
    });
    const home = { glass: glass?.position.y ?? 0, base: base?.position.y ?? 0, toy: toy?.position.y ?? 0, toyRot: toy?.rotation.y ?? 0 };
    const height = new THREE.Box3().setFromObject(root).getSize(new THREE.Vector3()).y || 1;
    return { root, glass, base, toy, mats, home, height };
  }, [scene]);
  useEffect(() => () => model.mats.forEach((m) => m.dispose()), [model]);

  const go = (next) => { st.current.phase = next; st.current.t = 0; setPhase(next); };
  const stopChoir = () => { st.current.choir?.pause(); st.current.choir = null; };
  const open = () => {
    if (st.current.phase !== "closed") return;
    go("opening");
    try {
      const audio = new Audio("/choir.mp3");
      audio.volume = 0.5;
      audio.play().catch(() => {});
      st.current.choir = audio;
    } catch (e) {}
  };
  const finish = () => {
    const p = st.current.phase;
    if (p === "off" || p === "leaving") return;
    go("leaving");
    st.current.t = 1;
  };
  const stop = () => { stopChoir(); go("off"); };

  useEffect(() => {
    apiRef.current = {
      // from: the tray capsule's world centre; trayHeight: its world height, so
      // the reveal starts exactly the tray capsule's size and lifts out of it.
      start(color, from, trayHeight) {
        const m = model;
        if (m.glass) m.glass.position.y = m.home.glass;
        if (m.base) { m.base.position.y = m.home.base; m.base.material.color.set(color); }
        if (m.toy) { m.toy.position.y = m.home.toy; m.toy.rotation.y = m.home.toyRot; }
        st.current.from.copy(from);
        st.current.fromScale = trayHeight / m.height;
        go("rising");
      },
      finish,
      stop,
      active: () => st.current.phase !== "off",
      phase: () => st.current.phase,
    };
    return () => { stopChoir(); apiRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiRef, model]);

  const _fwd = useMemo(() => new THREE.Vector3(), []);
  const _at = useMemo(() => new THREE.Vector3(), []);
  const _pos = useMemo(() => new THREE.Vector3(), []);
  const _camPos = useMemo(() => new THREE.Vector3(), []);
  const _camQuat = useMemo(() => new THREE.Quaternion(), []);
  useFrame((state, delta) => {
    const s = st.current, m = model, g = group.current, v = veil.current;
    if (!g || !v) return;
    const f = Math.min(delta, 0.1) * 60;
    if (s.phase === "off") { g.visible = false; v.visible = false; s.veil = 0; return; }
    g.visible = true; v.visible = true;

    // Where the capsule sits when it has arrived: centred, just past the lens.
    const d = Math.max(REVEAL_DIST, camera.near * 1.6);
    camera.getWorldPosition(_camPos);
    camera.getWorldQuaternion(_camQuat);
    _fwd.set(0, 0, -1).applyQuaternion(_camQuat);
    _at.copy(_camPos).addScaledVector(_fwd, d);
    const fov = THREE.MathUtils.degToRad(camera.fov || 50);
    const scale = (2 * d * Math.tan(fov / 2) * REVEAL_FILL) / m.height;

    if (s.phase === "rising") {
      s.t = Math.min(1, s.t + delta / RISE_SECONDS);
      const e = ease(s.t);
      _pos.lerpVectors(s.from, _at, e);
      setWorldPose(g, _pos, _camQuat, THREE.MathUtils.lerp(s.fromScale, scale, e));
      if (s.t >= 1) go("closed");
    } else if (s.phase === "leaving") {
      s.t = Math.max(0, s.t - delta / LEAVE_SECONDS);
      setWorldPose(g, _at, _camQuat, scale * ease(s.t));
      if (s.t <= 0) { stopChoir(); go("off"); return; }
    } else {
      setWorldPose(g, _at, _camQuat, scale);
    }
    // (The camera's orientation also turns the model's +Z to face the viewer, as on /gachapon.)

    // Open: glass lifts, base drops; done once the glass arrives.
    if (s.phase === "opening" || s.phase === "open") {
      const k = 1 - Math.pow(1 - OPEN_EASE, f);
      if (m.glass) {
        const diff = m.home.glass + OPEN_TRAVEL - m.glass.position.y;
        if (Math.abs(diff) > 0.01) m.glass.position.y += diff * k;
        else if (s.phase === "opening") go("open");
      } else if (s.phase === "opening") go("open");
      if (m.base) m.base.position.y += (m.home.base - OPEN_TRAVEL - m.base.position.y) * k;
      if (m.toy) {
        m.toy.position.y = m.home.toy + Math.sin(state.clock.elapsedTime * 0.5) * 0.05;
        m.toy.rotation.y += 0.003 * f;
      }
    }

    // Veil: down while the capsule is open, back up as it leaves.
    const want = s.phase === "opening" || s.phase === "open" ? VEIL_OPACITY : 0;
    s.veil += Math.sign(want - s.veil) * Math.min(Math.abs(want - s.veil), VEIL_FADE * VEIL_OPACITY * f);
    v.material.opacity = s.veil;
    setWorldPose(v, _camPos, _camQuat, d * 2);   // any radius past the near plane: it ignores depth
    const glow = (s.veil / VEIL_OPACITY) * TOY_GLOW;
    if (m.toy) m.toy.traverse((o) => { if (o.isMesh && o.material.emissiveMap) o.material.emissiveIntensity = glow; });
  });

  const onCapsuleClick = (e) => {
    e.stopPropagation();
    const p = st.current.phase;
    if (p === "closed") open();
    else if (p === "open") finish();
  };
  // The veil swallows clicks that miss the capsule so they cannot reach the
  // deck behind it and fly the camera away mid-reveal.
  const swallow = (e) => e.stopPropagation();

  return (
    <>
      <mesh ref={veil} visible={false} renderOrder={VEIL_ORDER} onClick={swallow} onPointerDown={swallow}>
        <sphereGeometry args={[1, 16, 16]} />
        <meshBasicMaterial color="#000000" transparent opacity={0} side={THREE.BackSide} depthTest={false} depthWrite={false} fog={false} />
      </mesh>
      <group
        ref={group}
        visible={false}
        onClick={onCapsuleClick}
        onPointerOver={(e) => { e.stopPropagation(); document.body.style.cursor = "pointer"; }}
        onPointerOut={() => { document.body.style.cursor = "auto"; }}
      >
        <primitive object={model.root} />
        {phase === "open" && (
          <Html fullscreen calculatePosition={SCREEN_CENTER} zIndexRange={[110, 100]} style={{ pointerEvents: "none" }}>
            <div style={{ position: "absolute", bottom: "20%", left: 0, right: 0, display: "flex", justifyContent: "center" }}>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); finish(); }}
                style={{
                  pointerEvents: "auto", padding: "1rem 1.5rem", background: "rgba(255, 255, 255, 0.1)",
                  border: "1px solid rgba(255, 255, 255, 0.3)", borderRadius: 50, color: "#fff",
                  fontFamily: "'Orbitron', monospace", fontSize: "0.85rem", fontWeight: 600, cursor: "pointer",
                  textTransform: "uppercase", letterSpacing: "1.5px", backdropFilter: "blur(4px)",
                }}
              >
                Play Again
              </button>
            </div>
          </Html>
        )}
      </group>
    </>
  );
}

export default function GachaponController({ stripScene, interactionRef, focus, onFocusChange, onFocusObject, onZoomOut, onVendorClick, stripScale }) {
  const { camera, controls } = useThree();
  const controlsRef = useRef(controls); controlsRef.current = controls;
  const parts = useRef(null);
  const active = useRef(false);
  const knob = useRef({ target: 0, current: 0, drag: null, orbitWas: true });
  const capsule = useRef({ dropped: false, settled: false, offset: 0, velocity: 0, bounces: 0, color: 0 });
  const clank = useRef(null);
  const reveal = useRef(null);
  const revealing = () => !!reveal.current?.active();
  const callbacks = useRef({});
  callbacks.current = { onFocusChange, onFocusObject, onZoomOut, onVendorClick };

  useEffect(() => {
    clank.current = new Audio("/clank.mp3");
    clank.current.volume = 0.5;
  }, []);

  // Find the parts, hide the capsule until it is earned, and give the knob and
  // capsule base their own materials: Material_55 is shared with the machine
  // body and every capsule in the globe, so tinting it in place would recolour
  // the whole gachapon.
  useEffect(() => {
    const root = stripScene.getObjectByName(NODE);
    if (!root) return;
    const dial = root.getObjectByName("DIAL");
    const glass = root.getObjectByName("CapsuleGlassA");
    const base = root.getObjectByName("CapsuleBaseA");
    const toy = root.getObjectByName("IpadMary");
    const restore = [];
    const own = (mesh, setup) => {
      if (!mesh?.isMesh) return null;
      const original = mesh.material;
      const mat = original.clone();
      mat.userData = {};   // clone() JSON-round-trips userData; Textures in it break uploads
      setup?.(mat);
      mesh.material = mat;
      restore.push(() => { mesh.material = original; mat.dispose(); });
      return mat;
    };
    const dialMats = [];
    dial?.traverse((o) => {
      const m = own(o, (mat) => { mat.emissive = new THREE.Color(KNOB_GLOW); mat.emissiveIntensity = 0; });
      if (m) dialMats.push(m);
    });
    const baseMat = own(base);
    const dialQuat = dial?.quaternion.clone();
    const home = { glass: glass?.position.y, base: base?.position.y };
    const shown = [glass, base, toy].filter(Boolean).map((o) => [o, o.visible]);
    shown.forEach(([o]) => { o.visible = false; });
    parts.current = { root, dial, glass, base, toy, dialMats, baseMat, home };
    return () => {
      restore.forEach((fn) => fn());
      shown.forEach(([o, v]) => { o.visible = v; });
      if (dial && dialQuat) dial.quaternion.copy(dialQuat);
      if (glass) glass.position.y = home.glass;
      if (base) base.position.y = home.base;
      parts.current = null;
    };
  }, [stripScene]);

  const placeCapsule = (offset) => {
    const p = parts.current; if (!p) return;
    if (p.glass) p.glass.position.y = p.home.glass + offset;
    if (p.base) p.base.position.y = p.home.base + offset;
  };
  const dropCapsule = () => {
    const p = parts.current, c = capsule.current; if (!p) return;
    Object.assign(c, { dropped: true, settled: false, offset: DROP_HEIGHT, velocity: 0, bounces: 0 });
    p.baseMat?.color.set(CAPSULE_COLORS[c.color++ % CAPSULE_COLORS.length]);
    placeCapsule(DROP_HEIGHT);
    [p.glass, p.base, p.toy].forEach((o) => { if (o) o.visible = true; });
  };
  // Picking the capsule up clears the tray and hands it to the reveal, which
  // lifts it out of the tray from exactly where it sat.
  const collectCapsule = () => {
    const p = parts.current; if (!p) return;
    const shell = new THREE.Box3();
    [p.glass, p.base].forEach((o) => { if (o) shell.expandByObject(o); });
    if (!shell.isEmpty() && reveal.current) {
      const size = shell.getSize(new THREE.Vector3());
      const color = CAPSULE_COLORS[(capsule.current.color - 1 + CAPSULE_COLORS.length) % CAPSULE_COLORS.length];
      reveal.current.start(color, shell.getCenter(new THREE.Vector3()), size.y);
    }
    capsule.current.dropped = false;
    [p.glass, p.base, p.toy].forEach((o) => { if (o) o.visible = false; });
    placeCapsule(0);
  };
  const turnKnob = () => {
    if (capsule.current.dropped || revealing()) return;
    knob.current.target = -TURN;
  };
  const playClank = () => {
    const a = clank.current; if (!a) return;
    a.currentTime = 0;
    a.play().catch(() => {});
  };

  const frame = () => {
    const root = parts.current?.root; if (!root) return;
    root.updateWorldMatrix(true, true);
    const box = new THREE.Box3().setFromObject(root);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    // Height against the vertical fov, footprint against the horizontal one —
    // whichever is tighter (phones are the width-bound case).
    const tanV = Math.tan(THREE.MathUtils.degToRad(camera.fov || 50) / 2);
    const dist = Math.max(size.y / 2 / tanV, Math.max(size.x, size.z) / 2 / (tanV * camera.aspect)) * FIT;
    const normal = APPROACH.clone().transformDirection(root.matrixWorld);
    // The strip is scaled way down, so this lands well inside OrbitControls'
    // default 0.3 floor — pass a closer one or the dolly stops short.
    callbacks.current.onFocusObject?.(center, normal, dist, Math.min(0.1, dist * 0.5));
  };
  const enter = () => {
    if (active.current || !parts.current) return;
    // Finish any vendor / claw / booth visit before taking the shared camera.
    window.dispatchEvent(new CustomEvent("hm-vendor-exit"));
    active.current = true;
    callbacks.current.onVendorClick?.("gachapon");
    callbacks.current.onFocusChange?.({ id: "gachapon", object: parts.current.root });   // the spotlight follows it
    frame();
  };
  const endDrag = () => {
    const k = knob.current; if (!k.drag) return;
    window.removeEventListener("pointermove", k.drag.move);
    window.removeEventListener("pointerup", k.drag.up);
    window.removeEventListener("pointercancel", k.drag.up);
    k.drag = null;
    if (controlsRef.current) controlsRef.current.enabled = k.orbitWas;
    // Past halfway commits the turn; short of it springs back.
    k.target = k.target < -TURN / 2 ? -TURN : 0;
  };
  const close = (flyOut = true) => {
    if (!active.current) return;
    active.current = false;
    endDrag();
    reveal.current?.stop();
    knob.current.target = 0;
    // Do not clear a different stall's focus when it has just taken over.
    callbacks.current.onFocusChange?.((current) => (current?.id === "gachapon" ? null : current));
    if (flyOut) callbacks.current.onZoomOut?.();
    // Ends a walker visit, whichever door it left through.
    window.dispatchEvent(new CustomEvent("hm-vendor-left"));
  };
  const handlers = useRef({});
  handlers.current = { enter, close, turnKnob, dropCapsule, collectCapsule, playClank, endDrag };

  useEffect(() => {
    interactionRef.current = {
      close: (flyOut) => handlers.current.close(flyOut),
      // Drag the knob. Only once zoomed in — from the overview the first click
      // is the fly-in, not a turn.
      handlePointerDown(e) {
        const p = parts.current;
        if (!active.current || !p?.dial || !under(e.object, p.dial) || capsule.current.dropped || revealing()) return false;
        e.stopPropagation();
        handlers.current.playClank();
        const k = knob.current;
        const startX = e.nativeEvent?.clientX ?? 0, startTarget = k.target;
        const move = (ev) => {
          const turned = startTarget - ((ev.clientX - startX) / DRAG_PX_PER_TURN) * TURN;
          k.target = THREE.MathUtils.clamp(turned, -TURN, 0);
        };
        const up = () => handlers.current.endDrag();
        k.drag = { move, up };
        k.orbitWas = controlsRef.current?.enabled ?? true;
        if (controlsRef.current) controlsRef.current.enabled = false;
        window.addEventListener("pointermove", move);
        window.addEventListener("pointerup", up);
        window.addEventListener("pointercancel", up);
        return true;
      },
      handleClick(e) {
        // Mid-reveal, every deck click is ours: the capsule is the only thing to
        // do, and a stray click must not zoom out or fly the camera.
        if (revealing()) {
          e.stopPropagation();
          if (reveal.current.phase() === "open") reveal.current.finish();
          return true;
        }
        const p = parts.current;
        if (!p || !under(e.object, p.root)) return false;
        e.stopPropagation();
        if (!active.current) { handlers.current.enter(); return true; }
        // The capsule glass sits in front of the toy, so check every hit, not
        // just the first.
        const hits = e.intersections || [e];
        const hit = (o) => o && hits.some((h) => under(h.object, o));
        if (hit(p.dial)) handlers.current.turnKnob();
        else if (capsule.current.settled && (hit(p.glass) || hit(p.base) || hit(p.toy))) handlers.current.collectCapsule();
        else handlers.current.close();   // the rest of the cabinet: second click pulls back, like a vendor
        return true;
      },
    };
    const onEnter = (e) => { if (e.detail?.id === "gachapon") handlers.current.enter(); };
    const onExit = () => handlers.current.close(false);
    window.addEventListener("hm-vendor-enter", onEnter);
    window.addEventListener("hm-vendor-exit", onExit);
    return () => {
      interactionRef.current = null;
      handlers.current.endDrag();
      window.removeEventListener("hm-vendor-enter", onEnter);
      window.removeEventListener("hm-vendor-exit", onExit);
      if (active.current) {
        active.current = false;
        window.dispatchEvent(new CustomEvent("hm-vendor-left"));
      }
    };
  }, [interactionRef, stripScene]);

  // Another stall took the camera.
  useEffect(() => {
    if (active.current && focus?.id !== "gachapon") handlers.current.close(false);
  }, [focus]);

  // Walker registration: stand in front of the machine and press E.
  useEffect(() => {
    const root = stripScene.getObjectByName(NODE); if (!root) return;
    root.updateWorldMatrix(true, true);
    const box = new THREE.Box3().setFromObject(root);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const registry = (window.__hmVendorSpots = window.__hmVendorSpots || {});
    // eyeY at the globe, not the base: that is what the hat-cam should meet.
    registry.gachapon = { id: "gachapon", label: "Gachapon", x: center.x, z: center.z, eyeY: center.y + size.y * 0.2 };
    return () => { delete registry.gachapon; };
  }, [stripScene, stripScale]);

  // Keep OrbitControls parked while the knob is held (the page can re-enable
  // it underneath us); runs before drei's controls update at -1.
  useFrame(() => {
    if (knob.current.drag && controlsRef.current) controlsRef.current.enabled = false;
  }, -2);

  useFrame((state, delta) => {
    const p = parts.current; if (!p) return;
    const k = knob.current, c = capsule.current;
    const f = Math.min(delta, 0.1) * 60;   // the original's per-frame constants, at any frame rate

    // Ease the knob toward its target. The original's rotateOnWorldAxis(X) is a
    // premultiply in the DIAL's parent space, so do exactly that.
    if (p.dial) {
      const diff = k.target - k.current;
      if (Math.abs(diff) > 0.001) {
        const step = diff * (1 - Math.pow(1 - KNOB_EASE, f));
        k.current += step;
        p.dial.quaternion.premultiply(_q.setFromAxisAngle(X_AXIS, step));
      }
      // A full turn drops the capsule and the knob springs back.
      if (k.current <= -TURN + 0.05 && k.target !== 0 && !k.drag) {
        if (!c.dropped) handlers.current.dropCapsule();
        k.target = 0;
      }
    }

    // Pulse the knob while there is a capsule on offer.
    const glow = c.dropped || revealing() ? 0 : 0.1 + Math.sin(state.clock.elapsedTime * 1.5) * 0.05;
    p.dialMats.forEach((m) => { m.emissiveIntensity = glow; });

    // Capsule drop: fall, bounce twice, settle.
    if (c.dropped && !c.settled) {
      c.velocity += GRAVITY * f;
      c.offset -= c.velocity * f;
      if (c.offset <= 0) {
        c.offset = 0;
        c.bounces++;
        if (c.bounces < 3 && Math.abs(c.velocity) > 0.005) c.velocity = -c.velocity * BOUNCE_DAMPING;
        else { c.velocity = 0; c.settled = true; }
      }
      placeCapsule(c.offset);
    }
  });

  return (
    <Suspense fallback={null}>
      <CapsuleReveal apiRef={reveal} />
    </Suspense>
  );
}

useGLTF.preload(REVEAL_MODEL);
