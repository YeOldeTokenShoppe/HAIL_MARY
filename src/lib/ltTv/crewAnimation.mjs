import {
  AnimationClip, AnimationMixer, MathUtils, PropertyBinding,
  QuaternionKeyframeTrack, VectorKeyframeTrack,
} from "three";
import { createCameraOperator } from "./cameraOperator.mjs";

const BLEND_SECONDS = 0.4;

// Keep one authored stance under every gesture. Include the rig and pelvis:
// fixing only the feet's local tracks still lets their parents slide them.
function withPlantedFeet(clips, rig, referenceName) {
  const reference = AnimationClip.findByName(clips, referenceName);
  if (!reference) return clips;
  const nodes = new Set([rig]);
  for (const name of ["toes_l", "toes_r"]) {
    let node = rig.getObjectByName(name);
    if (!node?.isBone) return clips;
    while (node && node !== rig) {
      nodes.add(node);
      node = node.parent;
    }
  }
  const sample = new AnimationMixer(rig);
  const stance = [];
  try {
    sample.clipAction(reference).play();
    sample.update(0);
    for (const node of nodes) {
      for (const property of ["position", "quaternion", "scale"]) {
        const Track = property === "quaternion" ? QuaternionKeyframeTrack : VectorKeyframeTrack;
        stance.push(new Track(`${node.name}.${property}`, [0], node[property].toArray()));
      }
    }
  } finally {
    sample.stopAllAction();
    sample.uncacheRoot(rig);
  }
  // New clips leave useGLTF's shared animation cache and the exported file
  // untouched. Identical constant tracks also hold through every crossfade.
  return clips.map((clip) => new AnimationClip(clip.name, clip.duration, [
    ...clip.tracks.filter((track) => {
      const path = PropertyBinding.parseTrackName(track.name);
      return !["position", "quaternion", "scale"].includes(path.propertyName)
        || !nodes.has(PropertyBinding.findNode(rig, path.nodeName));
    }),
    ...stance,
  ], clip.blendMode));
}

/** Idle crew between shows; reserve the grip and camera tracking for playback. */
export function createCrewAnimation(object, rig, clips, member, mount) {
  if (member.plantedFeet) clips = withPlantedFeet(clips, rig, member.onAir || member.idle);
  const mixer = new AnimationMixer(rig);
  const actionFor = (name) => {
    const clip = name && AnimationClip.findByName(clips, name);
    return clip ? mixer.clipAction(clip) : null;
  };
  const idles = (member.idleClips || [member.idle]).map(actionFor).filter(Boolean);
  const idleLoops = member.idleLoopsBetweenGestures || [1];
  const filming = actionFor(member.onAir);
  const actions = [...new Set([...idles, filming].filter(Boolean))];
  let operator = null;
  if (filming && member.followCamera) {
    // Calibrate with the authored grip, then immediately evaluate the idle.
    // Never capture targets from the off-air talking or clapping pose.
    filming.play();
    mixer.update(0);
    operator = createCameraOperator(object, mount);
    mixer.stopAllAction();
    if (!operator) console.warn("[TalkShowScene] Camera operator: missing grip target or required bones");
  }
  if (!idles.length) console.warn(`[TalkShowScene] ${member.empty}: no idle clips`);

  let target = null;
  let live = false;
  let gestureIndex = 1;
  let idleRun = 0;
  let idleTime = 0;
  let blendTime = BLEND_SECONDS;
  let starts = [];
  let corrected = false;

  function select(next, immediate = false) {
    if (next === target) return;
    starts = actions.map((action) => action.isRunning() ? action.getEffectiveWeight() : 0);
    target = next;
    idleTime = 0;
    blendTime = immediate ? BLEND_SECONDS : 0;
    if (next && !next.isRunning()) next.reset().setEffectiveWeight(0).play();
  }

  function evaluate(delta, yaw, pitch) {
    blendTime += delta;
    const blend = MathUtils.clamp(blendTime / BLEND_SECONDS, 0, 1);
    actions.forEach((action, i) => {
      const weight = MathUtils.lerp(starts[i] || 0, action === target ? 1 : 0, blend);
      action.setEffectiveWeight(weight);
      if (blend === 1 && action !== target) action.stop();
    });
    mixer.update(delta);
    const influence = filming?.getEffectiveWeight() || 0;
    corrected = !!operator && influence > 0;
    if (corrected) operator.update(yaw, pitch, influence);
  }

  select(idles[0] || null, true);
  evaluate(0, 0, 0);

  return {
    clips,
    mixer,
    update(delta, onAir, paused, yaw = 0, pitch = 0) {
      // Restore only if the previous frame actually applied tracking. Doing
      // this off air would overwrite the idle's constant animation channels.
      if (corrected) operator.restore();
      const nextLive = !!onAir && !!filming;
      if (nextLive !== live) {
        live = nextLive;
        gestureIndex = 1;
        idleRun = 0;
        select(live ? filming : idles[0] || null);
      }
      const step = onAir && paused ? 0 : delta;
      if (!live && idles.length > 1) {
        idleTime += step;
        const resting = target === idles[0];
        const loops = resting ? (idleLoops[idleRun % idleLoops.length] || 1) : 1;
        if (idleTime >= Math.max(BLEND_SECONDS, target.getClip().duration * loops - BLEND_SECONDS)) {
          // Let the base idle loop continuously, then play one gesture and
          // return to it. Alternate both the gestures and the resting lengths.
          if (resting) {
            select(idles[gestureIndex]);
            gestureIndex = 1 + (gestureIndex % (idles.length - 1));
          } else {
            idleRun += 1;
            select(idles[0]);
          }
        }
      }
      evaluate(step, yaw, pitch);
    },
    dispose() {
      if (corrected) operator.restore();
      mixer.stopAllAction();
    },
  };
}
