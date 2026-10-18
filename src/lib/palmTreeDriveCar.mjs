import * as THREE from 'three';

export const LOW_RIDER_MODEL_URL = '/models/lowRider_scene_V3_optimized.glb?v=lowrider-20261014-0932';

// Character clips loop during the drive; the car model is static.
// 'HaloRotation' was dropped when the halo was deleted from the scene — restore it here if it comes back.
// 'driver' replaced 'mixamo.com' in the V3 scene export (new Polygon driver rig, NLA track).
const TAP_CLIP = 'Hologirl_Seated_Sway_RestingForearm_SlowTap';
const LOOPING_CLIPS = new Set([
  'driver',
  'Unicorn_Seated_Music_Sway',
  'Shiba_Sitting_Baked',
  TAP_CLIP,
]);
// The hand-tap clip is authored at 24fps as a 60 BPM metronome: Hand_R peaks at
// 1.083s, 2.083s … 8.083s, but the export runs 8.75s, so every loop skipped
// 0.75 of a beat. Trim it to exactly 8 beats (0.5s → 8.5s, both in the rest
// valley between taps) so it loops on the grid, then scale it to the song.
const TAP_CLIP_FPS = 24;
const TAP_TRIM_FRAMES = [12, 204]; // inclusive: frames 12…204 = 192 intervals = 8.000s
const TAP_AUTHORED_BPM = 60;
// The hand lifts slowly to its apex (1.083s) and strikes the door 0.2s later;
// the beat belongs on the strike, not the apex.
const TAP_IMPACT_SECONDS = 1.285;
const TAP_BEAT_TIME = TAP_IMPACT_SECONDS - TAP_TRIM_FRAMES[0] / TAP_CLIP_FPS; // trimmed-clip time of the first strike
// Measured 2026-10-17 from the entry track "Feel It Still (Flatbush Zombies
// Remix)" (Firebase Storage): onset-flux beat grid fits 79.00 BPM (half of
// the original's 158) across the whole song, and the grid passes through
// t=0.000s ±5ms, so no downbeat offset. `?tapbpm=` / `?tapoffset=` override.
export const DEFAULT_TAP_BPM = 79;
export const DEFAULT_TAP_BEAT_OFFSET = 0;
const X_AXIS = new THREE.Vector3(1, 0, 0);

// Trim a looping clip to [start, end] seconds (inclusive), re-based to t=0. NOT
// THREE.AnimationUtils.subclip: that drops every track with no key inside the
// window, and 160 of this clip's 168 tracks are two-key STEP "holds" (keys at
// the first and last frame) that carry the seated pose. Dropping them sank the
// arm into the door. Holds are re-keyed to the new span; sampled tracks are cut.
export function trimLoopClip(sourceClip, name, start, end) {
  const duration = end - start;
  const tracks = [];
  for (const source of sourceClip.tracks) {
    const track = source.clone();
    const stride = track.getValueSize();
    const inside = [];
    for (let i = 0; i < track.times.length; i++) {
      if (track.times[i] >= start && track.times[i] <= end) inside.push(i);
    }
    if (inside.length < 2) {
      // Hold track (or a track keyed entirely outside the window): pin its
      // value at `start` across the whole new span.
      const interpolant = track.createInterpolant();
      const value = Array.from(interpolant.evaluate(start)).slice(0, stride);
      track.times = new track.TimeBufferType([0, duration]);
      track.values = new track.ValueBufferType([...value, ...value]);
    } else {
      const times = new track.TimeBufferType(inside.length);
      const values = new track.ValueBufferType(inside.length * stride);
      inside.forEach((keyIndex, n) => {
        times[n] = track.times[keyIndex] - start;
        for (let k = 0; k < stride; k++) values[n * stride + k] = track.values[keyIndex * stride + k];
      });
      track.times = times;
      track.values = values;
    }
    tracks.push(track);
  }
  return new THREE.AnimationClip(name, duration, tracks);
}

// `tapClock` returns the song's current time in seconds, or null when nothing is
// playing. While it returns a time the tap is SCRUBBED from it every frame,
// so it cannot drift from the music; otherwise it free-runs at `tapBpm`.
export function createLowRider(gltf, {
  roadSpeed = 7.5,
  tapBpm = DEFAULT_TAP_BPM,
  tapBeatOffset = DEFAULT_TAP_BEAT_OFFSET,
  tapClock = null,
} = {}) {
  const model = gltf.scene;
  const car = new THREE.Group();
  car.name = 'PalmTreeDriveLowRider';
  car.add(model);
  const mixer = new THREE.AnimationMixer(model);

  let tapAction = null;
  for (let clip of gltf.animations || []) {
    if (!LOOPING_CLIPS.has(clip.name)) continue;
    if (clip.name === TAP_CLIP) {
      clip = trimLoopClip(clip, `${TAP_CLIP}_8beat`, TAP_TRIM_FRAMES[0] / TAP_CLIP_FPS, TAP_TRIM_FRAMES[1] / TAP_CLIP_FPS);
      tapAction = mixer.clipAction(clip).setLoop(THREE.LoopRepeat, Infinity).play();
      continue;
    }
    mixer.clipAction(clip).setLoop(THREE.LoopRepeat, Infinity).play();
  }

  let currentTapBpm = tapBpm;
  let currentBeatOffset = tapBeatOffset;
  const setTapBpm = (bpm) => {
    if (!tapAction || !(bpm > 0)) return;
    currentTapBpm = bpm;
    tapAction.timeScale = bpm / TAP_AUTHORED_BPM; // free-run rate when no clock
  };
  const setTapBeatOffset = (seconds) => { currentBeatOffset = Number(seconds) || 0; };
  // Clip time at which a strike lands on every beat of the song at `musicTime`.
  const clipTimeAtMusic = (musicTime) => {
    const duration = tapAction.getClip().duration;
    const beatsElapsed = (musicTime - currentBeatOffset) * currentTapBpm / 60;
    const clipTime = TAP_BEAT_TIME + beatsElapsed * (60 / TAP_AUTHORED_BPM);
    return ((clipTime % duration) + duration) % duration;
  };
  // One-shot phase lock for the free-running fallback (no clock available).
  const syncTap = (musicTime = 0, beatOffset = currentBeatOffset) => {
    if (!tapAction) return;
    currentBeatOffset = beatOffset;
    tapAction.time = clipTimeAtMusic(musicTime);
  };
  const scrubTapToClock = () => {
    if (!tapAction || !tapClock) return;
    const musicTime = tapClock();
    if (typeof musicTime === 'number' && Number.isFinite(musicTime)) {
      tapAction.paused = true; // mixer holds the playhead; we place it
      tapAction.time = clipTimeAtMusic(musicTime);
    } else if (tapAction.paused) {
      tapAction.paused = false; // music stopped: free-run from here
    }
  };
  setTapBpm(tapBpm);
  mixer.update(0);
  car.updateMatrixWorld(true);

  const wheelMeshes = [];
  model.traverse((object) => {
    if (object.isMesh && object.name.startsWith('Wheel')) wheelMeshes.push(object);
    // Use the landing page's lighting rather than the Blender export lights.
    if (object.isLight) object.visible = false;
  });

  const wheels = wheelMeshes.map((wheel) => {
    const parent = wheel.parent;
    const bounds = new THREE.Box3().setFromObject(wheel, true);
    const radius = bounds.getSize(new THREE.Vector3()).y / 2;
    const pivot = new THREE.Group();
    pivot.name = `${wheel.name}_RollingPivot`;
    pivot.position.copy(parent.worldToLocal(bounds.getCenter(new THREE.Vector3())));
    // glTF mesh-local X is not the axle. Align the new pivot's X to the
    // car's X, expressed in this wheel parent's coordinate system.
    const axle = X_AXIS.clone().transformDirection(model.matrixWorld)
      .transformDirection(parent.matrixWorld.clone().invert());
    pivot.quaternion.setFromUnitVectors(X_AXIS, axle);
    parent.add(pivot);
    pivot.attach(wheel); // Retain the mesh's authored position and orientation.
    return { mesh: wheel, pivot, rest: pivot.quaternion.clone(), radius, angle: 0 };
  });

  // Keep the previous car's length/placement and put the tires on the road.
  car.scale.setScalar(2.7);
  car.rotation.y = Math.PI;
  car.updateMatrixWorld(true);
  const tireBounds = new THREE.Box3();
  wheelMeshes.forEach((wheel) => tireBounds.union(new THREE.Box3().setFromObject(wheel)));
  const center = tireBounds.isEmpty() ? new THREE.Vector3() : tireBounds.getCenter(new THREE.Vector3());
  car.position.set(2.5 - center.x, tireBounds.isEmpty() ? 0 : -tireBounds.min.y, 25.6);
  car.updateMatrixWorld(true);

  // Transformed local bounding boxes overestimate tilted tire extents, and the
  // export's four tires have different clearances. Ground their actual vertices
  // individually, preserving the chassis and the authored dashboard camera pose.
  for (const wheel of wheels) {
    const bounds = new THREE.Box3().setFromObject(wheel.mesh, true);
    const groundedCenter = wheel.pivot.getWorldPosition(new THREE.Vector3());
    groundedCenter.y -= bounds.min.y;
    wheel.pivot.position.copy(wheel.pivot.parent.worldToLocal(groundedCenter));
  }
  car.updateMatrixWorld(true);

  const spin = new THREE.Quaternion();
  return {
    car,
    wheels,
    mixer,
    setTapBpm,
    setTapBeatOffset,
    syncTap,
    get tapBpm() { return currentTapBpm; },
    get tapBeatOffset() { return currentBeatOffset; },
    update(delta) {
      // Avoid a jump when returning from a background tab.
      const dt = Math.min(Math.max(delta, 0), 0.1);
      scrubTapToClock(); // before the mixer samples the pose this frame
      mixer.update(dt);
      for (const wheel of wheels) {
        const worldRadius = wheel.radius * car.scale.x;
        wheel.angle = (wheel.angle + roadSpeed * dt / Math.max(worldRadius, 0.001)) % (Math.PI * 2);
        spin.setFromAxisAngle(X_AXIS, wheel.angle);
        wheel.pivot.quaternion.copy(wheel.rest).multiply(spin);
      }
    },
    dispose() {
      mixer.stopAllAction();
      mixer.uncacheRoot(model);
    },
  };
}
