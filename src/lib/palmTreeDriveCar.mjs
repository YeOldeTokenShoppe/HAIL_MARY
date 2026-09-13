import * as THREE from 'three';

export const LOW_RIDER_MODEL_URL = '/models/lowRider_scene_emerald_optimized.glb';

// Only character clips run during the drive. Take 01 also opens doors and
// moves the chassis, so sample its starting pose without advancing it.
const CHARACTER_CLIPS = new Set(['mixamo.com', 'mixamo.com.001']);
const X_AXIS = new THREE.Vector3(1, 0, 0);

export function createLowRider(gltf, { roadSpeed = 7.5 } = {}) {
  const model = gltf.scene;
  const car = new THREE.Group();
  car.name = 'PalmTreeDriveLowRider';
  car.add(model);
  const mixer = new THREE.AnimationMixer(model);

  for (const clip of gltf.animations || []) {
    if (clip.name === 'Take 01') {
      const action = mixer.clipAction(clip).play();
      action.paused = true;
      action.time = 0;
    } else if (CHARACTER_CLIPS.has(clip.name)) {
      mixer.clipAction(clip).setLoop(THREE.LoopRepeat, Infinity).play();
    }
  }
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
    update(delta) {
      // Avoid a jump when returning from a background tab.
      const dt = Math.min(Math.max(delta, 0), 0.1);
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
