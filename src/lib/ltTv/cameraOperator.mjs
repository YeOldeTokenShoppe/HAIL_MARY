import { MathUtils, Quaternion, Vector3 } from "three";

// A planted operator can cover the show's ~30° pans without a stepping clip.
// Shared by automatic shots, manual dragging and the operator tests.
export const CAMERA_OPERATOR_LIMITS = { yaw: MathUtils.degToRad(35), pitch: MathUtils.degToRad(10) };

const named = (root, name) => {
  const exact = root.getObjectByName(name);
  if (exact) return exact;
  let match = null;
  root.traverse((node) => {
    if (!match && node.name.startsWith(name) && /^_\d+$/.test(node.name.slice(name.length))) match = node;
  });
  return match;
};

/** Capture the authored pivot BEFORE the director first pans it. */
export function cameraOperatorMount(set) {
  const pivot = named(set, "Tripod_Head");
  const grip = pivot && named(pivot, "SM_Prop_Tripod_Head_01_Tilt");
  const camera = pivot && named(pivot, "Camera");
  return pivot && grip && camera
    ? { set, pivot, grip, camera, restQuaternion: pivot.quaternion.clone() }
    : null;
}

/**
 * Layer an analytic arm solve and a viewfinder gaze over the on_air clip.
 * Calibrate with that clip evaluated at time zero, after attaching the crew
 * to the set. Targets live in the prop's local space, so pan, tilt and moving
 * or uniformly scaling the entire studio all preserve the contact.
 */
export function createCameraOperator(root, mount) {
  if (!mount) return null;
  const bones = Object.fromEntries(
    ["spine_01", "spine_02", "spine_03", "UpperArm_R", "lowerarm_r", "Hand_R", "head", "eyes"]
      .map((name) => [name, root.getObjectByName(name)]),
  );
  if (Object.values(bones).some((bone) => !bone?.isBone)) return null;
  const { set, pivot, grip, camera, restQuaternion } = mount;
  const { UpperArm_R: upper, lowerarm_r: lower, Hand_R: hand, head, eyes } = bones;
  const changed = [bones.spine_01, bones.spine_02, upper, lower, hand, head];
  const animated = changed.map((bone) => bone.quaternion.clone());
  const v = Array.from({ length: 16 }, () => new Vector3());
  const q = Array.from({ length: 8 }, () => new Quaternion());

  // Suspense may finish loading the operator after the camera has already
  // turned. Calibrate against the authored pivot, then put it straight back.
  const livePivot = pivot.quaternion.clone();
  let gripPosition, gripRotation, gazePosition, elbowPole, rightInSet;
  try {
    pivot.quaternion.copy(restQuaternion);
    set.updateWorldMatrix(true, true);
    gripPosition = grip.worldToLocal(hand.getWorldPosition(new Vector3()));
    gripRotation = grip.getWorldQuaternion(new Quaternion()).normalize().invert()
      .multiply(hand.getWorldQuaternion(new Quaternion()).normalize()).normalize();
    const forward = new Vector3(0, 0, 1).applyQuaternion(head.getWorldQuaternion(q[0]).normalize());
    const sceneScale = set.getWorldScale(v[0]).x;
    // Aim through the viewfinder along the lens axis. A target at the eyecup
    // itself can pass inside the head during a tilt and reverse the gaze.
    gazePosition = camera.worldToLocal(eyes.getWorldPosition(new Vector3())
      .addScaledVector(forward, 0.65 * sceneScale));
    elbowPole = bones.spine_03.worldToLocal(lower.getWorldPosition(new Vector3()));
    const up = new Vector3(0, 1, 0).applyQuaternion(set.getWorldQuaternion(q[0]));
    rightInSet = forward.cross(up).normalize().applyQuaternion(q[0].invert());
  } finally {
    pivot.quaternion.copy(livePivot);
    set.updateWorldMatrix(true, true);
  }

  function worldRotation(bone, rotation) {
    bone.parent.getWorldQuaternion(q[6]).normalize().invert();
    bone.quaternion.copy(q[6]).multiply(rotation).normalize();
    bone.updateWorldMatrix(false, true);
  }

  function rotateWorld(bone, rotation) {
    bone.getWorldQuaternion(q[7]).normalize();
    q[7].premultiply(rotation);
    worldRotation(bone, q[7]);
  }

  function aimChild(bone, child, target) {
    bone.getWorldPosition(v[12]);
    child.getWorldPosition(v[13]).sub(v[12]).normalize();
    v[14].copy(target).sub(v[12]).normalize();
    rotateWorld(bone, q[5].setFromUnitVectors(v[13], v[14]));
  }

  const status = { wristError: 0, reachable: true };
  return {
    status,
    // AnimationMixer may skip writing constant channels. Undo last frame's
    // procedural rotations first so neither those channels nor breathing drift.
    restore() {
      changed.forEach((bone, i) => bone.quaternion.copy(animated[i]));
    },
    update(yaw = 0, pitch = 0, influence = 1) {
      changed.forEach((bone, i) => animated[i].copy(bone.quaternion));
      root.updateWorldMatrix(true, true);
      set.getWorldQuaternion(q[0]);
      const up = v[0].set(0, 1, 0).applyQuaternion(q[0]);
      const right = v[1].copy(rightInSet).applyQuaternion(q[0]);
      const turn = MathUtils.clamp(yaw, -CAMERA_OPERATOR_LIMITS.yaw, CAMERA_OPERATOR_LIMITS.yaw);
      const tilt = MathUtils.clamp(pitch, -CAMERA_OPERATOR_LIMITS.pitch, CAMERA_OPERATOR_LIMITS.pitch);
      for (const [bone, weight] of [[bones.spine_01, 0.30], [bones.spine_02, 0.25]]) {
        q[1].setFromAxisAngle(up, turn * weight);
        q[2].setFromAxisAngle(right, tilt * weight * 0.55);
        rotateWorld(bone, q[1].multiply(q[2]));
      }

      // Use real joint positions, not the imported rig's oversized bone tails.
      const target = grip.localToWorld(v[2].copy(gripPosition));
      const a = upper.getWorldPosition(v[3]);
      const b = lower.getWorldPosition(v[4]);
      const c = hand.getWorldPosition(v[5]);
      const upperLength = a.distanceTo(b);
      const lowerLength = b.distanceTo(c);
      const direction = v[6].subVectors(target, a);
      const requested = direction.length();
      const reach = MathUtils.clamp(requested, Math.abs(upperLength - lowerLength) + 1e-7,
        upperLength + lowerLength - 1e-7);
      direction.normalize();
      const along = (upperLength ** 2 - lowerLength ** 2 + reach ** 2) / (2 * reach);
      const height = Math.sqrt(Math.max(0, upperLength ** 2 - along ** 2));
      const bend = bones.spine_03.localToWorld(v[7].copy(elbowPole)).sub(a);
      bend.addScaledVector(direction, -bend.dot(direction));
      if (bend.lengthSq() < 1e-10) bend.copy(right).addScaledVector(direction, -right.dot(direction));
      bend.normalize();
      const elbow = v[8].copy(a).addScaledVector(direction, along).addScaledVector(bend, height);
      aimChild(upper, lower, elbow);
      aimChild(lower, hand, target);
      grip.getWorldQuaternion(q[3]).normalize().multiply(gripRotation);
      worldRotation(hand, q[3]);

      // Solve gaze after the torso and arm. Limit the correction relative to
      // this frame's animated head so an out-of-range target cannot flip it.
      const gaze = camera.localToWorld(v[9].copy(gazePosition));
      head.getWorldQuaternion(q[3]).normalize();
      const baseForward = v[10].set(0, 0, 1).applyQuaternion(q[3]);
      for (let i = 0; i < 3; i += 1) {
        eyes.getWorldPosition(v[11]);
        v[11].subVectors(gaze, v[11]).normalize();
        q[4].setFromUnitVectors(baseForward, v[11]);
        const angle = 2 * Math.acos(MathUtils.clamp(q[4].w, -1, 1));
        if (angle > 1.05) q[4].slerp(q[0].identity(), 1 - 1.05 / angle);
        worldRotation(head, q[4].multiply(q[3]));
      }
      // Match the on_air action's blend so starting/stopping the show also
      // eases the hand and gaze into/out of contact with the camera.
      if (influence < 1) {
        changed.forEach((bone, i) => bone.quaternion.slerp(animated[i], 1 - MathUtils.clamp(influence, 0, 1)));
      }
      status.wristError = hand.getWorldPosition(v[15]).distanceTo(target);
      status.reachable = Math.abs(requested - reach) < 1e-5;
      return status;
    },
  };
}
