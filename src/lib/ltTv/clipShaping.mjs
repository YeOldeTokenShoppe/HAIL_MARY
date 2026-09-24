// RESHAPING A CLIP ON LOAD, so a character can do something their Blender
// action does not, without anyone going back into Blender.
//
// Two things, both declared per clip in modelContract.mjs (`shapes`):
//
//   closeLoopFrames  The last N frames of every channel are eased onto the
//                    clip's own first frame, so a looping clip that ends
//                    somewhere else no longer snaps at the join.
//
//   turn             A yaw about WORLD UP, spread over named bones and faded in
//                    and out by a keyframed amount (0 = as animated, 1 = the
//                    full turn). Applied in each bone's PARENT space at every
//                    frame, from the posed skeleton, so it is a true turn
//                    whatever the rig's local axes are — the Unreal-style
//                    spines Kip and Holly have are rolled ~150° about X, and a
//                    yaw in bone-local space on those would tilt them sideways.
//
// It is done to the clip DATA once, at load, rather than per frame on top of
// the mixer: the mixer then plays it like any other clip, a cross-fade blends
// the turn with everything else, and a re-export of the same action picks the
// shape straight back up because the shape is keyed by the clip's name.
//
// Kip's intermission is the first user (Michelle, 2026-09-24): he turns to
// Holly, back to his laptop for the typing, to Holly again, and the loop comes
// home to frame 1.

import * as THREE from "three";
import { clone as skeletonClone } from "three/examples/jsm/utils/SkeletonUtils.js";

const UP = new THREE.Vector3(0, 1, 0);

/** Hermite ease, 0 → 1 with zero slope at both ends. */
const smooth = (x) => {
  const t = Math.min(1, Math.max(0, x));
  return t * t * (3 - 2 * t);
};

/**
 * How much of the turn is on at `frame`, from `[frame, amount]` keys, eased
 * between them. Before the first key and after the last it holds.
 */
export function turnAmount(keys, frame) {
  if (!keys?.length) return 0;
  if (frame <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i += 1) {
    const [f1, a1] = keys[i];
    if (frame <= f1) {
      const [f0, a0] = keys[i - 1];
      return a0 + (a1 - a0) * smooth((frame - f0) / Math.max(1e-6, f1 - f0));
    }
  }
  return keys[keys.length - 1][1];
}

/**
 * Ease the last `seconds` of every track onto its first key. Returns new
 * tracks; the clip's own are not touched (the loader caches them).
 */
export function closeLoop(tracks, seconds) {
  return tracks.map((track) => {
    const out = track.clone();
    const n = out.times.length;
    if (n < 2 || !(seconds > 0)) return out;
    const size = out.getValueSize();
    const end = out.times[n - 1];
    const from = end - seconds;
    const isQuat = out instanceof THREE.QuaternionKeyframeTrack;
    const first = new THREE.Quaternion();
    const q = new THREE.Quaternion();
    if (isQuat) first.fromArray(out.values, 0);
    for (let k = 0; k < n; k += 1) {
      const t = out.times[k];
      if (t < from) continue;
      const w = smooth((t - from) / seconds);
      const o = k * size;
      if (isQuat) {
        q.fromArray(out.values, o);
        // Take the short way round: q and -q are the same rotation.
        if (q.dot(first) < 0) q.set(-q.x, -q.y, -q.z, -q.w);
        q.slerp(first, w).toArray(out.values, o);
      } else {
        for (let c = 0; c < size; c += 1) {
          out.values[o + c] += (out.values[c] - out.values[o + c]) * w;
        }
      }
    }
    return out;
  });
}

/** Every bone under `root` in parent-before-child order, by name. */
function bonesInOrder(root, names) {
  const found = [];
  root.traverse((node) => {
    if (names.includes(node.name)) found.push(node);
  });
  return found;
}

/** Turn a bone by a WORLD rotation `r` where it stands: parent⁻¹ · r · parent · local. */
function rotateInWorld(bone, r, scratch) {
  bone.parent.updateWorldMatrix(true, false);
  bone.parent.getWorldQuaternion(scratch);
  const local = scratch.clone().invert().multiply(r).multiply(scratch).multiply(bone.quaternion);
  bone.quaternion.copy(local.normalize());
  bone.updateMatrixWorld(true);
}

/**
 * Bring a hand down by `drop` metres with a two-bone solve on the arm, keeping
 * the elbow in the plane it was already in and the hand's own orientation — so
 * the fingers lie the way they were animated, only lower.
 */
export function lowerHand(upper, lower, hand, drop) {
  if (!(drop > 0)) return;
  const q = new THREE.Quaternion();
  const r = new THREE.Quaternion();
  upper.updateWorldMatrix(true, true);
  const handWorld = hand.getWorldQuaternion(new THREE.Quaternion());
  const A = upper.getWorldPosition(new THREE.Vector3());
  const B = lower.getWorldPosition(new THREE.Vector3());
  const C = hand.getWorldPosition(new THREE.Vector3());
  const T = C.clone();
  T.y -= drop;
  const a = A.distanceTo(B);
  const b = B.distanceTo(C);
  const d = THREE.MathUtils.clamp(A.distanceTo(T), Math.abs(a - b) + 1e-4, a + b - 1e-4);
  // 1. Open or close the elbow until shoulder-to-hand is the length it needs.
  const u = A.clone().sub(B);
  const v = C.clone().sub(B);
  const axis = new THREE.Vector3().crossVectors(u, v);
  if (axis.lengthSq() > 1e-12) {
    const current = u.angleTo(v);
    const wanted = Math.acos(THREE.MathUtils.clamp((a * a + b * b - d * d) / (2 * a * b), -1, 1));
    r.setFromAxisAngle(axis.normalize(), wanted - current);
    rotateInWorld(lower, r, q);
  }
  // 2. Swing the whole arm at the shoulder so the hand lands on the target.
  const reach = hand.getWorldPosition(new THREE.Vector3()).sub(A).normalize();
  r.setFromUnitVectors(reach, T.clone().sub(A).normalize());
  rotateInWorld(upper, r, q);
  // 3. The hand keeps the orientation it had.
  hand.parent.updateWorldMatrix(true, false);
  hand.parent.getWorldQuaternion(q);
  hand.quaternion.copy(q.invert().multiply(handWorld));
  hand.updateMatrixWorld(true);
}

/**
 * The clip with `shape` applied, under the same name. `rig` is the node the
 * character's mixer is rooted at (their armature), from the LOADED file; it is
 * cloned for sampling and never posed itself. `placement` is the seat the
 * clip plays in ({position, quaternion, scale} from the contract) — only a
 * `rest` needs it, because a desk height is a height in the set.
 *
 * Shape fields, all optional:
 *   turns    [{ degrees: {bone: °}, keys: [[frame, 0..1]], lag: {bone: frames} }]
 *            Layers of yaw about world up, summed per bone. `lag` makes a
 *            bone follow the rest of its layer by that many frames, so a turn
 *            travels down the body instead of arriving everywhere at once.
 *            (`turn`, a single layer, is still read.)
 *   rest     [{ upper, lower, hand, tips: [bone], surface, keys }]
 *            Lowers a hand that hovers over a surface until its lowest tip
 *            touches it, eased by `keys`. Judged against the lowest the tips
 *            get within `window` frames either way (default a second), so a
 *            gesture lifting off the desk still lifts — it just starts from
 *            the desk. A hand may have more than one, with keys that do not
 *            overlap (Kip's right hand rests on the desk, then on the keys).
 *
 * Returns `{ clip, report }`. `report` says what was found, so a bone name
 * that does not exist is reported rather than silently doing nothing.
 */
export function shapeClip(clip, rig, shape, placement = null) {
  const fps = shape.fps || 30;
  const report = { clip: clip.name, missingBones: [], turnedBones: [], rested: [], closedOver: 0 };
  let tracks = clip.tracks;

  if (shape.closeLoopFrames > 0) {
    tracks = closeLoop(tracks, shape.closeLoopFrames / fps);
    report.closedOver = shape.closeLoopFrames / fps;
  }

  const layers = shape.turns || (shape.turn ? [shape.turn] : []);
  const rests = shape.rest || [];
  const turnNames = [...new Set(layers.flatMap((l) => Object.keys(l.degrees || {})))];
  if ((!turnNames.length && !rests.length) || !rig) {
    return { clip: new THREE.AnimationClip(clip.name, clip.duration, tracks), report };
  }

  // A private copy of the whole character to pose, standing where the clip
  // plays: sampled frame by frame, with the turn applied down the chain so
  // each bone's parent already carries the turn above it.
  const holder = new THREE.Group();
  if (placement) {
    holder.position.fromArray(placement.position);
    holder.quaternion.fromArray(placement.quaternion);
    holder.scale.setScalar(placement.scale ?? 1);
  }
  const sampleRoot = skeletonClone(rig);
  holder.add(sampleRoot);
  const byName = (name) => sampleRoot.getObjectByName(name) || null;

  const turned = bonesInOrder(sampleRoot, turnNames);
  report.turnedBones = turned.map((b) => b.name);
  report.missingBones = turnNames.filter((n) => !report.turnedBones.includes(n));
  const arms = rests
    .map((rest) => ({
      rest,
      upper: byName(rest.upper),
      lower: byName(rest.lower),
      hand: byName(rest.hand),
      tips: (rest.tips || []).map(byName).filter(Boolean),
    }))
    .filter((arm) => {
      const ok = arm.upper && arm.lower && arm.hand && arm.tips.length;
      if (!ok) report.missingBones.push(`${arm.rest.hand} (rest)`);
      return ok;
    });
  report.rested = arms.map((arm) => arm.hand.name);

  // Every bone this writes, in parent-before-child order.
  const touched = [];
  sampleRoot.traverse((node) => {
    if (turned.includes(node) || arms.some((arm) => [arm.upper, arm.lower, arm.hand].includes(node))) {
      touched.push(node);
    }
  });

  const loopClosed = new THREE.AnimationClip(clip.name, clip.duration, tracks);
  const mixer = new THREE.AnimationMixer(sampleRoot);
  const action = mixer.clipAction(loopClosed);
  // Once and clamped, so sampling the last frame does not wrap to the first.
  action.setLoop(THREE.LoopOnce, 1);
  action.clampWhenFinished = true;
  action.play();

  // Each written bone's quaternion track is replaced by one resampled on the
  // densest grid the clip already has (the baked per-frame tracks).
  const grid = tracks.reduce((a, t) => (t.times.length > a.length ? t.times : a), []);
  const times = grid.length > 2 ? Float32Array.from(grid) : (() => {
    const n = Math.max(2, Math.round(clip.duration * fps) + 1);
    return Float32Array.from({ length: n }, (_, i) => (i / (n - 1)) * clip.duration);
  })();

  const scratch = new THREE.Quaternion();
  const yaw = new THREE.Quaternion();
  const animated = touched.map(() => new THREE.Quaternion());
  let sampled = false;
  const pose = (k, drops) => {
    // The mixer only writes a value that CHANGED since its last write, so a
    // written bone is put back to what the mixer left before the next sample —
    // otherwise a frame the clip holds still would keep the last frame's turn
    // and turn it again.
    if (sampled) touched.forEach((bone, i) => bone.quaternion.copy(animated[i]));
    sampled = true;
    // A clamped LoopOnce action pauses itself on reaching the end, and a
    // paused action ignores setTime — so un-pause before every sample.
    action.paused = false;
    mixer.setTime(times[k]);
    touched.forEach((bone, i) => animated[i].copy(bone.quaternion));
    const frame = times[k] * fps;
    for (const bone of turned) {
      let degrees = 0;
      for (const layer of layers) {
        const d = layer.degrees?.[bone.name];
        if (d) degrees += d * turnAmount(layer.keys, frame - (layer.lag?.[bone.name] || 0));
      }
      if (degrees !== 0) {
        yaw.setFromAxisAngle(UP, THREE.MathUtils.degToRad(degrees));
        rotateInWorld(bone, yaw, scratch);
      }
    }
    holder.updateMatrixWorld(true);
    if (drops) arms.forEach((arm, i) => lowerHand(arm.upper, arm.lower, arm.hand, drops[i][k]));
  };

  // Pass one, only when a hand is to be rested: how high its tips are.
  const drops = arms.map(() => new Float32Array(times.length));
  if (arms.length) {
    const lowest = arms.map(() => new Float32Array(times.length));
    const p = new THREE.Vector3();
    for (let k = 0; k < times.length; k += 1) {
      pose(k, null);
      arms.forEach((arm, i) => {
        lowest[i][k] = Math.min(...arm.tips.map((tip) => tip.getWorldPosition(p).y));
      });
    }
    arms.forEach((arm, i) => {
      const window = arm.rest.window ?? Math.round(fps);
      for (let k = 0; k < times.length; k += 1) {
        let floor = Infinity;
        for (let j = Math.max(0, k - window); j <= Math.min(times.length - 1, k + window); j += 1) {
          floor = Math.min(floor, lowest[i][j]);
        }
        const hover = Math.min(Math.max(0, floor - arm.rest.surface), arm.rest.maxDrop ?? 0.08);
        drops[i][k] = hover * turnAmount(arm.rest.keys || [[0, 1]], times[k] * fps);
      }
    });
  }

  const values = touched.map(() => new Float32Array(times.length * 4));
  for (let k = 0; k < times.length; k += 1) {
    pose(k, arms.length ? drops : null);
    touched.forEach((bone, i) => bone.quaternion.toArray(values[i], k * 4));
  }
  mixer.stopAllAction();
  mixer.uncacheRoot(sampleRoot);

  const written = new Set(touched.map((b) => `${b.name}.quaternion`));
  const shaped = tracks.filter((t) => !written.has(t.name));
  touched.forEach((bone, i) => {
    shaped.push(new THREE.QuaternionKeyframeTrack(`${bone.name}.quaternion`, times, values[i]));
  });
  return { clip: new THREE.AnimationClip(clip.name, clip.duration, shaped), report };
}
