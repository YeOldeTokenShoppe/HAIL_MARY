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

/**
 * The clip with `shape` applied, under the same name. `rig` is the node the
 * character's mixer is rooted at (their armature), from the LOADED file; it is
 * cloned for sampling and never posed itself.
 *
 * Returns `{ clip, report }`. `report` says what was found, so a bone name
 * that does not exist is reported rather than silently doing nothing.
 */
export function shapeClip(clip, rig, shape) {
  const fps = shape.fps || 30;
  const report = { clip: clip.name, missingBones: [], turnedBones: [], closedOver: 0 };
  let tracks = clip.tracks;

  if (shape.closeLoopFrames > 0) {
    tracks = closeLoop(tracks, shape.closeLoopFrames / fps);
    report.closedOver = shape.closeLoopFrames / fps;
  }

  const turn = shape.turn;
  const boneNames = Object.keys(turn?.degrees || {});
  if (!boneNames.length || !rig) {
    return { clip: new THREE.AnimationClip(clip.name, clip.duration, tracks), report };
  }

  // A private copy of the whole character to pose: the clip is sampled on it
  // frame by frame, and the turn is applied down the chain so each bone's
  // parent already carries the turn above it.
  const holder = new THREE.Group();
  const sampleRoot = skeletonClone(rig);
  holder.add(sampleRoot);
  const bones = bonesInOrder(sampleRoot, boneNames);
  report.turnedBones = bones.map((b) => b.name);
  report.missingBones = boneNames.filter((n) => !report.turnedBones.includes(n));

  const loopClosed = new THREE.AnimationClip(clip.name, clip.duration, tracks);
  const mixer = new THREE.AnimationMixer(sampleRoot);
  const action = mixer.clipAction(loopClosed);
  // Once and clamped, so sampling the last frame does not wrap to the first.
  action.setLoop(THREE.LoopOnce, 1);
  action.clampWhenFinished = true;
  action.play();

  // Each turned bone's quaternion track is replaced by one resampled on the
  // densest grid the clip already has (the baked per-frame tracks).
  const grid = tracks.reduce((a, t) => (t.times.length > a.length ? t.times : a), []);
  const times = grid.length > 2 ? Float32Array.from(grid) : (() => {
    const n = Math.max(2, Math.round(clip.duration * fps) + 1);
    return Float32Array.from({ length: n }, (_, i) => (i / (n - 1)) * clip.duration);
  })();
  const values = Object.fromEntries(bones.map((b) => [b.name, new Float32Array(times.length * 4)]));

  const parentWorld = new THREE.Quaternion();
  const yaw = new THREE.Quaternion();
  const local = new THREE.Quaternion();
  const animated = bones.map(() => new THREE.Quaternion());
  for (let k = 0; k < times.length; k += 1) {
    // The mixer only writes a value that CHANGED since its last write, so a
    // turned bone is put back to what the mixer left before the next sample —
    // otherwise a frame the clip holds still would keep the last frame's turn
    // and turn it again.
    if (k > 0) bones.forEach((bone, i) => bone.quaternion.copy(animated[i]));
    // A clamped LoopOnce action pauses itself on reaching the end, and a
    // paused action ignores setTime — so un-pause before every sample.
    action.paused = false;
    mixer.setTime(times[k]);
    bones.forEach((bone, i) => animated[i].copy(bone.quaternion));
    const amount = turnAmount(turn.keys, times[k] * fps);
    for (const bone of bones) {
      const degrees = turn.degrees[bone.name] * amount;
      if (degrees !== 0) {
        bone.parent.updateWorldMatrix(true, false);
        bone.parent.getWorldQuaternion(parentWorld);
        yaw.setFromAxisAngle(UP, THREE.MathUtils.degToRad(degrees));
        // parent⁻¹ · yaw · parent · local: the bone's animated orientation,
        // turned about world up where it stands.
        local
          .copy(parentWorld)
          .invert()
          .multiply(yaw)
          .multiply(parentWorld)
          .multiply(bone.quaternion);
        bone.quaternion.copy(local.normalize());
      }
      bone.quaternion.toArray(values[bone.name], k * 4);
    }
  }
  mixer.stopAllAction();
  mixer.uncacheRoot(sampleRoot);

  const turnedTrackNames = new Set(bones.map((b) => `${b.name}.quaternion`));
  const shaped = tracks.filter((t) => !turnedTrackNames.has(t.name));
  for (const bone of bones) {
    shaped.push(new THREE.QuaternionKeyframeTrack(`${bone.name}.quaternion`, times, values[bone.name]));
  }
  return { clip: new THREE.AnimationClip(clip.name, clip.duration, shaped), report };
}
