"use client";
// Talk-show set for the /trade page. Swapped in for CyborgTempleScene (the
// RL80_4anims temple GLB) when the player opens the TALK SHOW tab.
//
// The model (talk_show.glb) ships its own set dressing — chairs, floor, neon
// frame/screen, palms — plus two seated Mixamo characters that each carry a
// looping sit pose:
//   • Demon_Empty  → barron_sit_pose
//   • Monk_Empty   → monk_sit_pose   (monk_talking is also present, unused here)
//
// Both rigs use identically-named `mixamorig:` bones, so — exactly like
// CurtainCallStage — each character gets its OWN mixer rooted at its empty;
// a scene-rooted mixer would bind the shared bone names to the wrong rig.
// The GLB is authored to sit in the same volume as the temple model, so it
// mounts at the same transform CyborgTempleScene receives from page.js.
//
// SITEPAL FACE PROJECTION (fitting step). Same technique CyborgTempleScene
// uses for the temple faces: hide the static face (Face1 / FaceDemon1), show
// the projection mesh (Face2 / FaceDemon2) with a live-cropped SitePal render
// swapped onto a MeshBasicMaterial. Reuses the SINGLE shared host portal
// (#sitepal-container-host) + loadSceneByID with the SAME scene ids as the
// temple, so only one face projects at a time — enough to fit the crop.
// (Two faces at once is the pre-recorded-video job, a later step.)
import React, { Suspense, useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import { clone as skeletonClone } from "three/examples/jsm/utils/SkeletonUtils.js";
import {
  SITEPAL_PROJECTION_CONFIG,
  DEMON_SITEPAL_CONTAINER_ID,
} from "@/components/CyborgTempleScene";

const MODEL_URL = "/models/talk_show.glb";

// talk_show.glb is Draco-compressed (+ WebP textures); point drei at the
// bundled decoder instead of the gstatic CDN so it works offline / under CSP.
const DRACO_PATH = "/draco/";

// Each character's empty → its clips. `base` is the looping idle sit pose;
// `talk` (optional) is a looping talking animation crossfaded in while that
// character's SitePal face is being projected (i.e. speaking).
const CHARACTER_CLIPS = {
  Demon_Empty: { base: "barron_sit_pose" },
  Monk_Empty: { base: "monk_sit_pose", talk: "monk_talking" },
};

// Maps the projectCharacter value → the empty whose talk clip should play.
const PROJECT_TO_EMPTY = { Monk: "Monk_Empty", Barron: "Demon_Empty" };

// ── SitePal crop / filter for the talk-show faces ──────────────────────────
// SEPARATE from the temple's DEMON/MONK crops — these are different meshes
// with their own UVs, so the numbers won't transfer 1:1. Seeded from the
// temple Monk/Demon values as a starting point; fit them live with the
// SitePalCropPanel (?tune=sitepal → "TS Monk" / "TS Barron" tabs). The
// per-frame compositor reads these fields every tick, so edits go live.
export const TALKSHOW_MONK_CROP = { cropX: 249, cropY: 150, cropW: 160, cropH: 205, rotateZ: 0, rotateX: 0 };
export const TALKSHOW_MONK_FILTER = { saturate: 99, contrast: 99, brightness: 93, hueRotate: -27, sepia: 0 };
export const TALKSHOW_BARRON_CROP = { cropX: 180, cropY: 118, cropW: 145, cropH: 195, rotateZ: 0, rotateX: 0 };
export const TALKSHOW_BARRON_FILTER = { saturate: 106, contrast: 102, brightness: 73, hueRotate: 0, sepia: 20 };

// Projection registry. sceneId reuses the temple's SitePal scenes (Monk =
// GR80, Barron = the Demon/H80Z scene). face1 = static face to hide, face2 =
// projection target to reveal.
export const TALKSHOW_PROJECTION_CONFIG = {
  Monk: {
    label: "TS Monk",
    sceneId: SITEPAL_PROJECTION_CONFIG.Monk.sceneId,
    face1: "Face1",
    face2: "Face2",
    crop: TALKSHOW_MONK_CROP,
    filter: TALKSHOW_MONK_FILTER,
    // Extra static meshes hidden with the face swap so they don't float over
    // the projected face (the temple hides brows/eyes the same way). Brows
    // lives under Monk_Empty, so it pairs with the Monk's Face1.
    hideExtra: ["Brows"],
  },
  Barron: {
    label: "TS Barron",
    sceneId: SITEPAL_PROJECTION_CONFIG.Demon.sceneId,
    face1: "FaceDemon1",
    face2: "FaceDemon2",
    crop: TALKSHOW_BARRON_CROP,
    filter: TALKSHOW_BARRON_FILTER,
    // Barron's brows live under Demon_Empty as `Demon_Brows` (the Monk's are
    // just `Brows`). Hide with the face swap so they don't float over Face2.
    hideExtra: ["Demon_Brows"],
  },
};

// Warm the GLB fetch before the tab is opened (page.js calls this on mount).
export function preloadTalkShow() {
  useGLTF.preload(MODEL_URL, DRACO_PATH);
}

// Build (once) the crop canvas + CanvasTexture + MeshBasicMaterial for a
// projected face, mirroring CyborgTempleScene's ensureProjectionMaterial.
function ensureProjectionMaterial(st) {
  if (!st.cropCanvas) {
    const cropCanvas = document.createElement("canvas");
    cropCanvas.width = 512;
    cropCanvas.height = 512;
    st.cropCanvas = cropCanvas;
    st.cropCtx = cropCanvas.getContext("2d");
  }
  if (!st.texture) {
    const tex = new THREE.CanvasTexture(st.cropCanvas);
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.flipY = false;
    tex.wrapS = THREE.ClampToEdgeWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    st.texture = tex;
  }
  if (!st.material) {
    st.material = new THREE.MeshBasicMaterial({
      map: st.texture,
      toneMapped: false,
      side: THREE.DoubleSide,
    });
  }
  if (!st.materialApplied && st.face2) {
    st.face2.material = st.material;
    st.materialApplied = true;
  }
}

// Crop the shared SitePal source into the 512² face canvas (filter + rotate),
// matching CyborgTempleScene's paintProjection exactly.
function paintCrop(st, cfg, source) {
  const ctx = st.cropCtx;
  const canvas = st.cropCanvas;
  const { cropX, cropY, cropW, cropH, rotateZ, rotateX } = cfg.crop;
  const f = cfg.filter;
  ctx.fillStyle = "#9F7854";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  try {
    ctx.save();
    ctx.filter = `saturate(${f.saturate}%) contrast(${f.contrast}%) brightness(${f.brightness}%) hue-rotate(${f.hueRotate}deg) sepia(${f.sepia}%)`;
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate((rotateZ * Math.PI) / 180);
    ctx.scale(1, Math.cos((rotateX * Math.PI) / 180));
    ctx.translate(-canvas.width / 2, -canvas.height / 2);
    ctx.drawImage(source, cropX, cropY, cropW, cropH, 0, 0, canvas.width, canvas.height);
    ctx.restore();
    ctx.filter = "none";
  } catch (e) {
    // Source canvas not yet renderable (preserveDrawingBuffer race) — skip.
  }
  if (st.texture) st.texture.needsUpdate = true;
}

function TalkShowModel({ anchorY, projectCharacter }) {
  const { scene, animations } = useGLTF(MODEL_URL, DRACO_PATH);

  // Clone so toggling the tab (unmount/remount) and HMR never reuse a mutated
  // tree, and so R3F isn't handed the same cached object twice.
  const cloned = useMemo(() => {
    const c = skeletonClone(scene);
    // Hide the blank inner screen for now (the neon Frame border stays) —
    // reserved for a future topic screen. Flip visible = true to bring back.
    const screen = c.getObjectByName("Content_Screen");
    if (screen) screen.visible = false;
    // Projection targets start hidden; Face1 / FaceDemon1 are the visible
    // static faces until a SitePal projection activates.
    Object.values(TALKSHOW_PROJECTION_CONFIG).forEach((cfg) => {
      const m = c.getObjectByName(cfg.face2);
      if (m) m.visible = false;
    });
    return c;
  }, [scene]);

  // Per-character projection state (face refs + lazily-built canvas/texture/mat).
  const projRef = useRef({});
  useMemo(() => {
    const build = {};
    Object.entries(TALKSHOW_PROJECTION_CONFIG).forEach(([key, cfg]) => {
      build[key] = {
        face1: cloned.getObjectByName(cfg.face1) || null,
        face2: cloned.getObjectByName(cfg.face2) || null,
        hideExtra: (cfg.hideExtra || [])
          .map((n) => cloned.getObjectByName(n))
          .filter(Boolean),
        cropCanvas: null,
        cropCtx: null,
        texture: null,
        material: null,
        materialApplied: false,
      };
    });
    projRef.current = build;
  }, [cloned]);

  // One mixer per character, rooted at that character's empty so the shared
  // mixamorig bone names bind to the correct rig.
  const mixers = useMemo(() => {
    const out = {};
    Object.keys(CHARACTER_CLIPS).forEach((emptyName) => {
      const root = cloned.getObjectByName(emptyName);
      if (root) out[emptyName] = new THREE.AnimationMixer(root);
    });
    return out;
  }, [cloned]);

  // Per-character actions: { base, talk } — both kept playing (talk at weight 0)
  // so the crossfade below can blend between them without a hitch.
  const actionsRef = useRef({});
  useEffect(() => {
    const started = [];
    const out = {};
    const makeAction = (mixer, name, weight) => {
      const clip = animations.find((a) => a.name === name);
      if (!clip) {
        console.warn(`[TalkShowScene] clip "${name}" not found`);
        return null;
      }
      const action = mixer.clipAction(clip);
      action.reset();
      action.setLoop(THREE.LoopRepeat, Infinity);
      action.setEffectiveWeight(weight);
      action.play();
      started.push(action);
      return action;
    };
    Object.entries(CHARACTER_CLIPS).forEach(([emptyName, clips]) => {
      const mixer = mixers[emptyName];
      if (!mixer) return;
      out[emptyName] = {
        base: makeAction(mixer, clips.base, 1),
        talk: clips.talk ? makeAction(mixer, clips.talk, 0) : null,
      };
    });
    actionsRef.current = out;
    return () => started.forEach((a) => a.stop());
  }, [mixers, animations]);

  // Ask the shared SitePal host to load the chosen character's scene so its
  // face renders in the host canvas we crop from. Mutes the portal (fitting is
  // silent). Retries until the host is ready / the scene reports loaded.
  useEffect(() => {
    if (!projectCharacter) return;
    const cfg = TALKSHOW_PROJECTION_CONFIG[projectCharacter];
    if (!cfg || typeof window === "undefined") return;
    let cancelled = false;
    let timer = null;
    let attempts = 0;
    const req = () => {
      if (cancelled) return;
      const cur = window.__sitePalCurrentSceneId;
      const loaded = window.__sitePalSceneLoaded === true;
      if (cur === cfg.sceneId) {
        if (loaded) return; // on scene and ready — done
      } else if (loaded && typeof window.loadSceneByID === "function") {
        window.__sitePalDesiredVolume = 0; // silent fit
        window.__sitePalSceneLoaded = false;
        window.loadSceneByID(cfg.sceneId);
      }
      if (attempts++ < 30) timer = setTimeout(req, 400); // ~12s ceiling
    };
    timer = setTimeout(req, 0);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [projectCharacter]);

  // Cached SitePal source canvas + the scene version it was grabbed at.
  const sourceRef = useRef({ el: null, sceneVersion: -1 });

  useFrame((_, delta) => {
    // Blend each character between its idle sit pose and its talk clip by
    // driving weights directly each frame (robust vs crossFadeTo's stateful
    // fades, which StrictMode double-invocation can strand at bind pose). The
    // two weights always sum to 1, so the rig is never left unanimated (no
    // T-pose). A character talks while its SitePal face is being projected.
    const talkingEmpty = PROJECT_TO_EMPTY[projectCharacter];
    Object.entries(actionsRef.current).forEach(([emptyName, acts]) => {
      if (!acts?.base) return;
      const canTalk = !!acts.talk;
      const target = canTalk && emptyName === talkingEmpty ? 1 : 0;
      const cur = acts._talkW ?? 0;
      const next = cur + (target - cur) * Math.min(1, delta * 5); // ~0.4s ease
      acts._talkW = next;
      acts.base.setEffectiveWeight(1 - next);
      if (acts.talk) acts.talk.setEffectiveWeight(next);
    });

    Object.values(mixers).forEach((m) => m.update(delta));

    // Refresh the shared source canvas when missing or after a scene swap.
    const srcState = sourceRef.current;
    const ver = (typeof window !== "undefined" && window.__sitePalSceneVersion) || 0;
    if (!srcState.el || srcState.sceneVersion !== ver) {
      const host = document.getElementById(DEMON_SITEPAL_CONTAINER_ID);
      if (host) {
        const canvases = host.querySelectorAll("canvas");
        if (canvases.length) srcState.el = canvases[canvases.length - 1];
      }
      srcState.sceneVersion = ver;
    }
    const source = srcState.el;

    Object.entries(TALKSHOW_PROJECTION_CONFIG).forEach(([key, cfg]) => {
      const st = projRef.current[key];
      if (!st) return;
      const onScene =
        typeof window !== "undefined" &&
        window.__sitePalCurrentSceneId === cfg.sceneId &&
        window.__sitePalSceneLoaded === true;
      const show = projectCharacter === key && !!source && onScene;
      if (show) ensureProjectionMaterial(st);
      if (st.face1) st.face1.visible = !show;
      if (st.face2) st.face2.visible = show;
      st.hideExtra.forEach((m) => { m.visible = !show; });
      if (show && st.cropCtx) paintCrop(st, cfg, source);
    });
  });

  // Mirror CyborgTempleScene's internal anchor offset so the set lands at the
  // same height the temple model does.
  return (
    <group position={[0, anchorY, 0]}>
      <primitive object={cloned} />
    </group>
  );
}

// Mounts inside the existing CleanCanvas (no Canvas of its own). Takes the
// same position/scale/rotation CyborgTempleScene receives so the swap keeps
// the model in the same spot. `projectCharacter` ('Monk' | 'Barron' | null)
// activates the live SitePal projection on that character's face for fitting.
export default function TalkShowScene({
  position = [0, -1.9, 0],
  scale = [1.2, 1.2, 1.2],
  rotation = [0, 0, 0],
  anchorY = 0.3,
  projectCharacter = null,
}) {
  return (
    <group position={position} scale={scale} rotation={rotation}>
      <Suspense fallback={null}>
        <TalkShowModel anchorY={anchorY} projectCharacter={projectCharacter} />
      </Suspense>
    </group>
  );
}
