"use client";

import { useMemo, useLayoutEffect, useEffect, useRef } from "react";
import * as THREE from "three";

export function streetlightPart(node) {
  for (let p = node; p; p = p.parent) if (/^Streetlight(?:_|$)/.test(p.name)) return true;
  return false;
}

export function streetlightStrength(skyEnv, preset) {
  if (preset === "hell" || preset === "solstice") return 0;
  const h = skyEnv?.sunHour;
  if (!Number.isFinite(h)) return preset === "night" ? 1 : 0;
  const ramp = (a, b) => THREE.MathUtils.clamp((h - a) / (b - a), 0, 1);
  return h >= 12 ? ramp(17.75, 18.5) : 1 - ramp(5.5, 6.25);
}

// Clone only our geometry/materials. The cached GLB and its atlas stay untouched.
export function buildStreetlight(scene, scale) {
  scene.updateMatrixWorld(true);
  const inverse = scene.matrixWorld.clone().invert();
  const parts = [];
  let head = null;
  scene.traverse((node) => {
    if (!node.isMesh || !streetlightPart(node)) return;
    const geo = node.geometry.clone().applyMatrix4(inverse.clone().multiply(node.matrixWorld));
    geo.scale(scale, scale, scale);
    const bulb = node.name.startsWith("Streetlight_light");
    const mat = bulb ? new THREE.MeshBasicMaterial({ color: "#fff1c4", toneMapped: false }) : node.material.clone();
    if (bulb) {
      geo.computeBoundingBox();
      head = geo.boundingBox.getCenter(new THREE.Vector3());
      head.y = geo.boundingBox.min.y - 0.003;
    }
    parts.push({ geo, mat });
  });
  return { parts, head };
}

const noRaycast = () => null;
function Copies({ geometry, material, placements }) {
  const ref = useRef();
  useLayoutEffect(() => {
    const mesh = ref.current;
    const dummy = new THREE.Object3D();
    placements.forEach(({ position, yaw = 0 }, i) => {
      dummy.position.fromArray(position);
      dummy.rotation.set(0, yaw, 0);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [placements, geometry]);
  return <instancedMesh ref={ref} args={[geometry, material, placements.length]} raycast={noRaycast} dispose={null} />;
}

// One draw per fixture part, one for beams, one for pools, independent of plot count.
// The decorative shafts do not illuminate geometry. Only the focused plot gets a light.
export default function RigStreetlights({ scene, scale, placements, skyEnv, envPreset, focus = null }) {
  const on = streetlightStrength(skyEnv, envPreset);
  const asset = useMemo(() => buildStreetlight(scene, scale), [scene, scale]);
  const effects = useMemo(() => {
    if (!asset.head) return null;
    const head = asset.head;
    const end = new THREE.Vector3(0, 0.012, 0);
    const height = head.distanceTo(end);
    const radius = Math.min(0.3, height * 0.42);
    const beam = new THREE.ConeGeometry(radius, height, 16, 1, true);
    beam.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), head.clone().sub(end).normalize()));
    beam.translate(...head.clone().add(end).multiplyScalar(0.5).toArray());
    // Seat the whole bottom ring on the pad, even though the shaft is tilted.
    const vertices = beam.attributes.position;
    for (let i = 0; i < vertices.count; i++) {
      if (beam.attributes.uv.getY(i) < 0.5) vertices.setY(i, end.y);
    }
    beam.computeVertexNormals();
    const pool = new THREE.CircleGeometry(radius, 24);
    pool.rotateX(-Math.PI / 2);
    pool.translate(...end.toArray());
    const beamMat = new THREE.MeshBasicMaterial({ color: "#ffe6ad", transparent: true, opacity: 0.035, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.FrontSide, toneMapped: false });
    const poolMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { strength: { value: 0 }, tint: { value: new THREE.Color("#ffe6ad") } },
      vertexShader: "varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*instanceMatrix*vec4(position,1.); }",
      fragmentShader: "varying vec2 vUv; uniform float strength; uniform vec3 tint; void main(){float r=length(vUv-.5)*2.;gl_FragColor=vec4(tint, pow(max(0.,1.-r),2.)*strength*.15);}",
    });
    return { beam, pool, beamMat, poolMat };
  }, [asset]);
  useLayoutEffect(() => {
    if (!effects) return;
    effects.beamMat.opacity = 0.035 * on;
    effects.poolMat.uniforms.strength.value = on;
  }, [effects, on]);
  useEffect(() => () => {
    asset.parts.forEach(({ geo, mat }) => { geo.dispose(); mat.dispose(); });
    if (effects) { effects.beam.dispose(); effects.pool.dispose(); effects.beamMat.dispose(); effects.poolMat.dispose(); }
  }, [asset, effects]);
  const target = useMemo(() => new THREE.Object3D(), []);
  const lightPos = new THREE.Vector3();
  if (focus && asset.head) {
    const yaw = focus.yaw || 0;
    lightPos.copy(asset.head).applyAxisAngle(THREE.Object3D.DEFAULT_UP, yaw).add(new THREE.Vector3(...focus.position));
    target.position.set(focus.position[0], focus.position[1] + 0.25, focus.position[2]);
  }
  return <>
    <group visible={on > 0.001 && !!asset.head}>
      {asset.parts.map(({ geo, mat }, i) => <Copies key={i} geometry={geo} material={mat} placements={placements} />)}
      {effects && <><Copies geometry={effects.beam} material={effects.beamMat} placements={placements} /><Copies geometry={effects.pool} material={effects.poolMat} placements={placements} /></>}
    </group>
    <primitive object={target} />
    <spotLight position={lightPos} target={target} intensity={focus && asset.head ? on * 1.6 : 0} color="#fff1c4" angle={0.7} penumbra={0.85} distance={3} decay={2} castShadow={false} />
  </>;
}
