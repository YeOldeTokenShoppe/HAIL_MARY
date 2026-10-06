import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';

// Track_Car's four wheels, measured in mesh-local coordinates. The GLB root
// also carries a Blender scene placement; we intentionally use the mesh frame.
const WHEEL_HALF_GAUGE = 0.38344;
const WHEEL_HALF_BASE = 0.55361;
const UP = new THREE.Vector3(0, 1, 0);
const wrap = (u) => ((u % 1) + 1) % 1;

export function createTrackFrame() {
  return {
    point: new THREE.Vector3(), forward: new THREE.Vector3(),
    right: new THREE.Vector3(), up: new THREE.Vector3(),
  };
}

// Same world-up convention and road offset as the tunnel, shared by the
// rails, sleepers and cart so their frames agree through the climbs and seam.
export function sampleTrackFrame(curve, u, drop, frame) {
  curve.getPointAt(wrap(u), frame.point);
  curve.getTangentAt(wrap(u), frame.forward);
  frame.right.crossVectors(UP, frame.forward).normalize();
  frame.up.crossVectors(frame.forward, frame.right).normalize();
  frame.point.addScaledVector(frame.up, -drop);
  return frame;
}

function singleMesh(gltf, label) {
  const meshes = [];
  gltf.scene.traverse((object) => { if (object.isMesh) meshes.push(object); });
  if (meshes.length !== 1 || Array.isArray(meshes[0].material)) {
    throw new Error(`${label}: expected the single-mesh track export.`);
  }
  return meshes[0];
}

// Extract the authored rail profile and one intact sleeper, retaining the
// atlas UVs and hard-edge normals. The long rails have only end vertices:
// extruding each side along the spline supplies their missing subdivisions.
export function readTrackProfile(geometry) {
  geometry.computeBoundingBox();
  const { min, max } = geometry.boundingBox;
  const length = max.z - min.z;
  const position = geometry.attributes.position;
  const normal = geometry.attributes.normal;
  const uv = geometry.attributes.uv;
  const index = geometry.index;
  const sides = [];
  const ties = { position: [], normal: [], uv: [] };
  const read = (i) => ({
    x: position.getX(i), y: position.getY(i), z: position.getZ(i),
    normal: [normal.getX(i), normal.getY(i), normal.getZ(i)],
    uv: [uv.getX(i), uv.getY(i)],
  });
  for (let i = 0; i < (index?.count ?? position.count); i += 3) {
    const vertices = [0, 1, 2].map((k) => read(index ? index.getX(i + k) : i + k));
    const atStart = vertices.filter((v) => Math.abs(v.z - min.z) < 1e-4);
    if (atStart.length === 2 && vertices.some((v) => v.z > max.z - 1e-4)) {
      sides.push(atStart);
    }
    // Only the middle sleeper: rails span the entire source piece and fail
    // this test; all four disconnected parts of the sleeper are retained.
    if (vertices.every((v) => Math.abs(v.z - (min.z + length / 2)) < length / 6)) {
      for (const v of vertices) {
        ties.position.push(v.x, v.y, v.z - (min.z + length / 2));
        ties.normal.push(...v.normal);
        ties.uv.push(...v.uv);
      }
    }
  }
  if (sides.length !== 8 || !ties.position.length) {
    throw new Error('Track_Straight: rail profile or middle sleeper was not found.');
  }
  const positiveX = sides.flat().map((v) => v.x).filter((x) => x > 0);
  const halfGauge = (Math.min(...positiveX) + Math.max(...positiveX)) / 2;
  const top = Math.max(...sides.flat().map((v) => v.y));
  const sleeper = new THREE.BufferGeometry();
  for (const [name, values] of Object.entries(ties)) {
    sleeper.setAttribute(name, new THREE.Float32BufferAttribute(values, name === 'uv' ? 2 : 3));
  }
  sleeper.translate(0, -top, 0);
  sleeper.computeBoundingSphere();
  return { sides, sleeper, halfGauge, top };
}

export function buildCoasterTrack(curve, source, { scale, drop }) {
  const profile = readTrackProfile(source.geometry);
  const group = new THREE.Group();
  group.name = 'HubCoasterTrack';
  const length = curve.getLength();
  const segments = Math.ceil(length / 0.035);
  const frames = Array.from({ length: segments + 1 }, (_, i) =>
    sampleTrackFrame(curve, i / segments, drop, createTrackFrame()));
  const positions = [], normals = [], uvs = [], indices = [];
  const p = new THREE.Vector3(), n = new THREE.Vector3();
  for (const side of profile.sides) {
    const offset = positions.length / 3;
    for (let i = 0; i <= segments; i++) {
      const frame = frames[i];
      for (const v of side) {
        p.copy(frame.point).addScaledVector(frame.right, v.x * scale)
          .addScaledVector(frame.up, (v.y - profile.top) * scale);
        n.copy(frame.right).multiplyScalar(v.normal[0])
          .addScaledVector(frame.up, v.normal[1]).normalize();
        positions.push(p.x, p.y, p.z);
        normals.push(n.x, n.y, n.z);
        uvs.push(...v.uv);
      }
    }
    // Choose winding from the source face normal, rather than assuming the
    // decoder returns the two end vertices in a particular order.
    const edge = new THREE.Vector3(side[1].x - side[0].x, side[1].y - side[0].y, 0);
    const outward = new THREE.Vector3(...side[0].normal);
    const positive = edge.cross(new THREE.Vector3(0, 0, 1)).dot(outward) > 0;
    for (let i = 0; i < segments; i++) {
      const a = offset + i * 2, b = a + 1, c = a + 2, d = a + 3;
      if (positive) indices.push(a, b, c, b, d, c);
      else indices.push(a, c, b, b, c, d);
    }
  }
  const railGeometry = new THREE.BufferGeometry();
  railGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  railGeometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  railGeometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  railGeometry.setIndex(indices);
  railGeometry.computeBoundingSphere();
  const rails = new THREE.Mesh(railGeometry, source.material);
  rails.name = 'ContinuousRails';
  group.add(rails);

  const count = Math.round(length / 0.18);
  const sleepers = new THREE.InstancedMesh(profile.sleeper, source.material, count);
  sleepers.name = 'TrackSleepers';
  const frame = createTrackFrame(), matrix = new THREE.Matrix4();
  for (let i = 0; i < count; i++) {
    sampleTrackFrame(curve, i / count, drop, frame);
    matrix.makeBasis(frame.right, frame.up, frame.forward);
    matrix.scale(new THREE.Vector3(scale, scale, scale));
    matrix.setPosition(frame.point);
    sleepers.setMatrixAt(i, matrix);
  }
  sleepers.instanceMatrix.needsUpdate = true;
  sleepers.computeBoundingSphere();
  group.add(sleepers);
  return group;
}

// Solve from the two axle contact points, not just a tangent under the cart's
// middle. Its pitch follows crests/dips and its wheelbase spans each bend.
export function createCartFollower(curve, { drop, wheelbase }) {
  const front = createTrackFrame(), rear = createTrackFrame();
  const forward = new THREE.Vector3(), up = new THREE.Vector3(), right = new THREE.Vector3();
  const matrix = new THREE.Matrix4();
  const length = curve.getLength();
  return (rig, u) => {
    let span = wheelbase / length;
    // Offset-track length differs slightly from the camera curve. Iterate
    // until the chord between axles matches the rigid model's wheelbase.
    for (let i = 0; i < 4; i++) {
      sampleTrackFrame(curve, u + span / 2, drop, front);
      sampleTrackFrame(curve, u - span / 2, drop, rear);
      const chord = front.point.distanceTo(rear.point);
      if (Math.abs(chord - wheelbase) < 1e-6) break;
      span *= wheelbase / Math.max(chord, 1e-6);
    }
    forward.subVectors(front.point, rear.point).normalize();
    up.copy(front.up).add(rear.up).normalize();
    right.crossVectors(up, forward).normalize();
    up.crossVectors(forward, right).normalize();
    rig.position.copy(front.point).add(rear.point).multiplyScalar(0.5);
    matrix.makeBasis(right, up, forward);
    rig.quaternion.setFromRotationMatrix(matrix);
  };
}

function disposeObjects(objects) {
  const geometries = new Set(), materials = new Set(), textures = new Set();
  for (const root of objects) root?.traverse((object) => {
    if (object.geometry) geometries.add(object.geometry);
    for (const material of (Array.isArray(object.material) ? object.material : [object.material])) {
      if (!material) continue;
      materials.add(material);
      for (const value of Object.values(material)) if (value?.isTexture) textures.add(value);
    }
    if (object.isInstancedMesh) object.dispose();
  });
  geometries.forEach((geometry) => geometry.dispose());
  materials.forEach((material) => material.dispose());
  textures.forEach((texture) => texture.dispose());
  objects.forEach((object) => object?.removeFromParent());
}

export function loadHubCoaster({ scene, rig, curve, drop, carLength, onError }) {
  const draco = new DRACOLoader().setDecoderPath('/draco/').setWorkerLimit(1);
  const loader = new GLTFLoader().setDRACOLoader(draco);
  let cancelled = false, track = null, cart = null, follow = null;
  const sourceScenes = [];
  Promise.allSettled([
    loader.loadAsync('/models/Track_Straight.glb'),
    loader.loadAsync('/models/Track_Car.glb'),
  ]).then((results) => {
    sourceScenes.push(...results.filter((r) => r.status === 'fulfilled').map((r) => r.value.scene));
    if (cancelled) { disposeObjects(sourceScenes); return; }
    const failed = results.find((r) => r.status === 'rejected');
    if (failed) throw failed.reason;
    const source = singleMesh(results[0].value, 'Track_Straight');
    const car = singleMesh(results[1].value, 'Track_Car');
    car.geometry.computeBoundingBox();
    const bounds = car.geometry.boundingBox;
    const carScale = carLength / (bounds.max.z - bounds.min.z);
    const profile = readTrackProfile(source.geometry);
    const trackScale = WHEEL_HALF_GAUGE * carScale / profile.halfGauge;
    profile.sleeper.dispose();
    // Keep the supplied textures and soften the export's emissive
    // contribution under the tunnel bloom.
    source.material.emissiveIntensity = 0.35;
    car.material.emissiveIntensity = 0.35;
    car.material.fog = false;
    track = buildCoasterTrack(curve, source, { scale: trackScale, drop });
    cart = new THREE.Group();
    cart.name = 'EmptyTrackCar';
    const body = new THREE.Mesh(car.geometry, car.material);
    body.name = 'TrackCarBody';
    body.scale.setScalar(carScale);
    body.position.set(0, -bounds.min.y * carScale, -(bounds.min.z + bounds.max.z) * carScale / 2);
    cart.add(body);
    scene.add(track);
    rig.add(cart);
    follow = createCartFollower(curve, { drop, wheelbase: WHEEL_HALF_BASE * 2 * carScale });
  }).catch((error) => {
    disposeObjects([track, cart, ...sourceScenes]);
    track = cart = null;
    if (!cancelled) { console.warn('Hub coaster could not load.', error); onError?.(); }
  });
  return {
    placeVehicle(u) { if (follow) follow(rig, u); },
    dispose() {
      cancelled = true;
      follow = null;
      disposeObjects([track, cart, ...sourceScenes]);
      draco.dispose();
    },
  };
}
