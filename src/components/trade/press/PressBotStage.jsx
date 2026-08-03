"use client";
import React, { useEffect, useRef } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader";
import { getPitchBotConfig } from "@/lib/trade/pitchBotScene";
import {
  initPitchBotExpressions, initPitchBotVisemes, alignPitchBotPlates,
  bindPitchBotFaceSpec, setPitchBotPressure, tickPitchBotFace,
  getPitchBotFaceState, getPitchBotMouth, setPitchBotMouthLevel,
  setPitchBotExpression, disposePitchBotExpressions,
} from "@/lib/trade/pitchBotExpressions";
import { applyPitchBotHolo, tickPitchBotHolo, disposePitchBotHolo } from "@/lib/trade/pitchBotHolo";

// THE PITCH BOT, LIVE, ON THE FLAT SURFACE — the actual rig rather than a
// picture of it, so the mouth that moves is the one the artist authored.
//
// WHY THIS EXISTS AT ALL, given PressFlat's whole premise is "no WebGL": a
// still portrait with a drawn-on mouth reads as weak (author, 2026-08-02), and
// the alternative everyone reaches for first — SitePal — is unavailable to this
// character for a reason that is never going away. `sayAudio` resolves NAMES IN
// THE ACCOUNT, NEVER URLS (api/trade/director, "verified via the spike"), so a
// SitePal face can only lip-sync clips uploaded ahead of time, and the bot's
// lines name the deal it is pitching. There is no clip to upload. Its own glb,
// with its own LED viseme plates driven by the audio, is the only way this
// character's mouth can ever match its words.
//
// ONE RIG AT A TIME, WHICH IS WHAT THE BUDGET ALLOWS AND WHAT THE CODE ASSUMES.
// The three files are 560-925KB Draco, so a single one is affordable where the
// temple's 4MB is not. It is also the only shape the face system supports:
// pitchBotExpressions keeps its plate maps in a MODULE SINGLETON, so a second
// live rig would silently take the first one's face. That constraint is load
// bearing here rather than incidental — do not mount two.
//
// V1 DOES NOT COME THROUGH HERE YET, and the reason is in the file rather than
// in this component: it reports `0 expressions x 0 layer(s), 0 visemes` because
// its face is a TEXTURE, not a set of plates. A 3D v1 today would move its body
// and hold a painted smile — worse than the flat panel, which can at least draw
// a mouth on it, so it stays there for now (author, 2026-08-02: "save v1 for
// later").
//
// WHEN IT LANDS IT WILL SWAP IMAGE TEXTURES, NOT MESHES (author, same day), and
// that is a different mechanism from everything in pitchBotExpressions — which
// toggles `visible` on plates. desk.js already records the shape of it: the
// plate (SM_Chr_Kid_Robot_Face_01) is unskinned and untouched by both clips, and
// base colour and emissive share one image, so a face swap means setting `map`
// AND `emissiveMap` together. THE SELECTOR WILL HAVE TO WIDEN WITH IT: PressFigure
// currently asks "does this rig have a drivable face" via `stage` in
// press/pitchers, which today means plates. Flip that flag when the texture path
// exists — do not make it test for visemes, or v1 will read as ineligible
// forever.
//
// THE GPU BUDGET IS REAL BUT IT IS NOT THIS. What crashed iOS Safari on /trade
// was the temple's R3F canvas and its EffectComposer left rendering BEHIND an
// opaque overlay (see the gating on `!showFullscreenCRT`). By the time this
// mounts, that scene is already gated off — the mobile CRT covers it — so this
// canvas is not an additional load, it is the only load. Even so it renders
// nothing while hidden or backgrounded; see the visibility gate below.

/**
 * FRAME THE FACE, NOT THE FIGURE. Everything is a fraction of the rig's own
 * measured bounding box, so a re-export that rescales the model reframes itself.
 *
 * PER VARIANT, BECAUSE `aimAt` IS A FRACTION OF A BOX AND THE BOXES DIFFER IN
 * WHAT THEY CONTAIN. v3's includes its hair, which stands ~0.2 units above the
 * body, so the same fraction that lands on v2's face lands on v3's fringe. This
 * is the same trap `fitHeight` documents in pitchBotScene, arriving by a
 * different route: there the hair inflated a height measurement, here it moves
 * an aim point. Excluding the hair from the box would fix both and break the
 * framing of any rig whose silhouette IS the hair, so it stays per rig.
 *
 * Tune live and paste back — `__botStage({ aimAt: 0.8, zoom: 1.6 })` re-aims
 * immediately and returns the whole block.
 */
const STAGE_FRAMING = {
  // Humanoid, no hair: the head sits at the very top of its own box.
  v2: { aimAt: 0.9, zoom: 1.6, lift: 0.02, yaw: 0.12 },
  // The hairdo owns the top ~10% of the box, so the face is lower in it.
  v3: { aimAt: 0.795, zoom: 1.5, lift: 0.02, yaw: 0.12 },
};
const STAGE_DEFAULTS = {
  /** Where the camera aims, as a fraction UP from the rig's feet. */
  aimAt: 0.86,
  /** How much of the frame the figure's height spans. Bigger = tighter. */
  zoom: 1.5,
  /** Camera height relative to the aim point, in rig heights. Near 0 = eye level. */
  lift: 0.02,
  /** A hair of perspective — a dead-on orthographic face reads as a mugshot. */
  yaw: 0.12,
};

/** Cap the pixel ratio: this is a ~200px panel and a 3x phone would triple the
 *  fill for nothing visible. */
const MAX_DPR = 2;

function dracoPath() {
  return typeof window !== "undefined" && window.location.hostname !== "localhost"
    ? `${window.location.origin}/draco/`
    : "/draco/";
}

/**
 * @param speaking  cross-fades idle <-> talking, and is what the viseme mouth
 *                  keys off via the amplitude in adviserMouth.
 * @param band      pressure().band -> the LED expression. THE ONLY THING ABOUT
 *                  THE PITCH THAT MAY REACH THE FACE (VC_GAME.md §1 rule 3),
 *                  and the same channel the rig uses in the room.
 * @param onFail    called if the rig cannot be loaded or the context is refused.
 *                  PressFigure falls back to the portrait — a panel that stays
 *                  empty because a glb 404'd is the one outcome worth avoiding.
 */
export default function PressBotStage({ speaking = false, band = "cool", onFail = null }) {
  const hostRef = useRef(null);
  // Everything the rAF loop and the cleanup need, in one object that is never
  // read through a ref-that-might-be-null. Refs ARE null in effect cleanups when
  // the node has already unmounted, which is how the temple leaked 66 textures;
  // this is captured in a local at effect start and closed over.
  const rigRef = useRef(null);

  /* ── mount: renderer, scene, rig ── */
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;

    let disposed = false;
    let raf = 0;
    let renderer = null;
    let root = null;
    let mixer = null;
    const actions = {};
    const clock = new THREE.Clock();

    const cfg = getPitchBotConfig();

    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "low-power" });
    } catch (err) {
      console.warn("[PressBotStage] no WebGL context:", err?.message || err);
      onFail?.();
      return undefined;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, MAX_DPR));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    host.appendChild(renderer.domElement);
    Object.assign(renderer.domElement.style, { width: "100%", height: "100%", display: "block" });

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(28, 1, 0.01, 100);
    // The holo wash is largely self-lit, but the LED plates are held OUT of it
    // (they have to keep reading as a screen), so they still need something.
    scene.add(new THREE.HemisphereLight(0xbff4ff, 0x0a1a1c, 2.2));
    const key = new THREE.DirectionalLight(0xffffff, 1.1);
    key.position.set(0.6, 1.2, 1.4);
    scene.add(key);

    const size = () => {
      const w = host.clientWidth || 1;
      const h = host.clientHeight || 1;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    size();
    const ro = new ResizeObserver(size);
    ro.observe(host);

    const loader = new GLTFLoader();
    const draco = new DRACOLoader();
    draco.setDecoderPath(dracoPath());
    loader.setDRACOLoader(draco);

    loader.load(
      cfg.url,
      (gltf) => {
        if (disposed) return;
        root = gltf.scene;
        root.traverse((o) => {
          // Skinned bounds describe the bind pose, not the animated mesh, so a
          // head that leans out of the bind box pops out of view mid-word.
          if (o.isMesh) o.frustumCulled = false;
        });

        // THE FACE BEFORE ANYTHING MEASURES THE SILHOUETTE. glTF carries no
        // visibility channel, so every plate arrives visible and coincident —
        // until this runs the "face" is 19 meshes z-fighting in one pocket, and
        // a bounding box taken now would include all of them.
        initPitchBotExpressions(root, cfg.expressions || {});
        initPitchBotVisemes(root, { ...(cfg.visemes || {}), voice: cfg.visemes?.voice || cfg.voice });
        // Eyes, mouths and visemes have to land on ONE plane or the mouth jumps
        // the moment it starts talking.
        alignPitchBotPlates(cfg.expressions?.alignTo || null);
        applyPitchBotHolo(root, cfg.holo || {});

        scene.add(root);

        // FRAME FROM THE MEASURED RIG rather than from the variant's `framing`
        // block: those numbers are absolute world offsets tuned inside the
        // temple's parent chain (which carries a 1.2 scale), so they mean
        // nothing here. A bounding box is the only datum this stage shares with
        // that one.
        const box = new THREE.Box3().setFromObject(root);
        const span = new THREE.Vector3();
        box.getSize(span);
        const height = span.y || 1;
        const centreX = (box.min.x + box.max.x) / 2;
        const centreZ = (box.min.z + box.max.z) / 2;
        const t = { ...STAGE_DEFAULTS, ...(STAGE_FRAMING[cfg.variant] || {}) };
        const place = () => {
          const aimY = box.min.y + height * t.aimAt;
          const dist = height / t.zoom;
          camera.position.set(
            centreX + Math.sin(t.yaw) * dist,
            aimY + height * t.lift,
            centreZ + Math.cos(t.yaw) * dist,
          );
          camera.lookAt(centreX, aimY, centreZ);
        };
        place();

        // Live framing, same convention as every other tunable in this room
        // (__pitchBotFrame, __rl80Mouth): the numbers above were judged in a
        // 200px panel and want re-judging on a real phone.
        if (typeof window !== "undefined") {
          window.__botStage = (patch = {}) => {
            Object.assign(t, patch);
            place();
            return { ...t };
          };
          /* WHICH PLATE IS ACTUALLY UP. The whole face is mesh visibility, so
             every failure mode in it — a viseme group that never initialised, a
             band that matches no expression, an amplitude arriving under a key
             nothing reads — renders as the SAME THING: a face that doesn't move.
             None of them logs. This answers which one it is in one call, and it
             is the flat surface's equivalent of the temple's __pitchBotFace. */
          /**
           * Read the face, or PIN one plate to look at it.
           *
           *     __botFace()           // which set is live, and every name in it
           *     __botFace("Happy")    // hold that plate; null releases
           *
           * WHICH SET IS LIVE IS ANSWERABLE FROM THE NAME LIST ALONE, which is
           * worth knowing because the two rigs' plates are GEOMETRY, not a
           * texture — there is no atlas that could be swapped, so a face that
           * looks wrong is a wrong PLATE, not a wrong image. The vocabularies
           * differ by exactly one entry and that is the fingerprint:
           * v2 (Adult_Male_Face_*) ships `Sad`; v3 (Adult_Female_Face_*) ships
           * `Surprised`. If `expressions` contains Surprised while you asked for
           * v2, the sets really are crossed. If it contains Sad, they are not
           * and the thing to look at is the blink — both rigs borrow `Happy`'s
           * eyes for it, which is CONFIRMED to be closed arcs on v3 and has
           * never been checked on v2 (see that variant's `blink` note). A
           * borrowed grin firing every few seconds reads as the wrong face.
           */
          window.__botFace = (name) => {
            if (name !== undefined) setPitchBotExpression(name);
            return getPitchBotFaceState();
          };
          /** Which viseme is up, and whether the rig thinks it is talking. */
          window.__botMouth = () => getPitchBotMouth();
          /** Hold the mouth open to check registration; null hands it back. */
          window.__botMouthLevel = (v) => setPitchBotMouthLevel(v);
        }

        // CLIPS UNDER CANONICAL NAMES. The rigs disagree about what their own
        // animations are called (`idle` vs `Stand_Idle` vs `standing_idle`), and
        // the face system's clip follower reads the canonical keys — a bare
        // registration stages a bot that never moves without erroring.
        mixer = new THREE.AnimationMixer(root);
        const byName = new Map(gltf.animations.map((a) => [a.name, a]));
        for (const [alias, clipName] of Object.entries(cfg.clips || {})) {
          const clip = byName.get(clipName);
          if (!clip) {
            console.warn(`[PressBotStage] ${cfg.variant}: no clip named "${clipName}" for "${alias}"`);
            continue;
          }
          actions[alias] = mixer.clipAction(clip);
        }
        bindPitchBotFaceSpec(actions, cfg.expressions || {});
        actions.idle?.reset().play();
        setPitchBotPressure(band);

        rigRef.current = { actions, mixer };
        // `speaking` may already be true by the time a 900KB rig finishes
        // decoding — the opening starts talking the moment the floor opens.
        applySpeaking(actions, speakingRef.current);
      },
      undefined,
      (err) => {
        if (disposed) return;
        console.warn(`[PressBotStage] ${cfg.variant} failed to load:`, err?.message || err);
        onFail?.();
      },
    );

    /* ── the loop ──
       RENDERS NOTHING WHILE THE PANE IS HIDDEN. The feed shares its stage with
       the evidence boards, so for stretches of the session this canvas sits
       behind `display:none` — and a WebGL canvas left rendering under something
       opaque is precisely what took /trade's mobile path down.

       NO `document.hidden` CHECK, deliberately. A backgrounded tab already gets
       no rAF, so it buys nothing — and it actively breaks the one way this
       surface can be inspected, since a screenshot forces a frame that the guard
       would then skip, rendering black. It cost a debugging round to find that,
       which is cheap next to shipping a panel that only ever looks empty. */
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const dt = clock.getDelta();
      if (host.offsetParent === null) return;
      mixer?.update(dt);
      tickPitchBotFace();
      try { tickPitchBotHolo(clock.elapsedTime); } catch { /* wash is cosmetic */ }
      renderer.render(scene, camera);
    };
    tick();

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      ro.disconnect();
      try { disposePitchBotExpressions(); } catch {}
      try { disposePitchBotHolo(); } catch {}
      mixer?.stopAllAction();
      // Walk the graph we actually built rather than trusting a ref: by now the
      // host node may already be detached.
      scene.traverse((o) => {
        if (o.isMesh) {
          o.geometry?.dispose?.();
          const mats = Array.isArray(o.material) ? o.material : [o.material];
          mats.forEach((m) => {
            if (!m) return;
            for (const k in m) {
              const v = m[k];
              if (v && v.isTexture) v.dispose();
            }
            m.dispose?.();
          });
        }
      });
      try { draco.dispose?.(); } catch {}
      renderer.dispose();
      renderer.domElement.remove();
      rigRef.current = null;
      if (typeof window !== "undefined") {
        delete window.__botStage; delete window.__botFace;
        delete window.__botMouth; delete window.__botMouthLevel;
      }
    };
    // Mount once. `speaking` and `band` are pushed in through the effects below
    // rather than through this dependency list — re-downloading a 900KB rig
    // because somebody started a sentence is not a re-render, it is a reload.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── it talks ── */
  const speakingRef = useRef(speaking);
  useEffect(() => { speakingRef.current = speaking; }, [speaking]);
  useEffect(() => {
    const rig = rigRef.current;
    if (rig) applySpeaking(rig.actions, speaking);
  }, [speaking]);

  /* ── the band drives the face, and nothing else may ── */
  useEffect(() => { try { setPitchBotPressure(band); } catch {} }, [band]);

  return <div className="pbs-host" ref={hostRef} style={{ position: "absolute", inset: 0 }} />;
}

/**
 * Cross-fade the body between standing and pitching.
 *
 * FADE, NOT SWAP. Both clips run for the length of the fade, which is also what
 * lets the face's clip follower resolve the dominant one by WEIGHT and turn the
 * expression over at the visual midpoint instead of at either end.
 */
function applySpeaking(actions, speaking) {
  const to = speaking ? actions.talking : actions.idle;
  const from = speaking ? actions.idle : actions.talking;
  if (!to) return;
  to.reset().setEffectiveWeight(1).fadeIn(0.28).play();
  from?.fadeOut(0.28);
}
