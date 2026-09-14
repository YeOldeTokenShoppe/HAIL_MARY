import * as THREE from 'three';

export function createMaryCoinArc(car) {
  const left = car.getObjectByName('Object_4');
  const right = car.getObjectByName('Object_4.001') || car.getObjectByName('Object_4001');
  if (!left || !right) return null;
  car.updateMatrixWorld(true);
  const start = car.worldToLocal(new THREE.Box3().setFromObject(left, true).getCenter(new THREE.Vector3()));
  const end = car.worldToLocal(new THREE.Box3().setFromObject(right, true).getCenter(new THREE.Vector3()));
  const inverse = car.matrixWorld.clone().invert();
  const worldScale = car.getWorldScale(new THREE.Vector3()).y;
  const group = new THREE.Group();
  group.name = 'MaryHoveringCoinArc';
  const instances = [];
  const count = 7;
  const goldMaterials = [];
  const bodyMaterial = car.getObjectByName('CarBody')?.material;
  const reflectionMap = (Array.isArray(bodyMaterial) ? bodyMaterial[0] : bodyMaterial)?.envMap;
  const makeGold = source => {
    const rim = /rim/i.test(source.name);
    const material = new THREE.MeshPhysicalMaterial();
    THREE.MeshStandardMaterial.prototype.copy.call(material, source);
    material.name = rim ? 'MaryCoinPolishedRim' : 'MaryCoinWarmGold';
    material.color.set(rim ? '#ffe3a0' : '#ffc65c');
    material.metalness = rim ? 0.85 : 0.72;
    material.roughness = rim ? 0.20 : 0.30;
    material.clearcoat = 0.25;
    material.clearcoatRoughness = 0.3;
    material.envMap = reflectionMap || null;
    material.envMapIntensity = 0.22;
    // A faint warm lift keeps the faces legible as the camera moves past them.
    material.emissive.set('#6b3507');
    material.emissiveIntensity = 0.12;
    goldMaterials.push(material);
    return material;
  };
  left.traverse(mesh => {
    if (!mesh.isMesh) return;
    // Bake each source primitive into car space around the coin's center.
    const geometry = mesh.geometry.clone();
    geometry.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inverse, mesh.matrixWorld));
    geometry.translate(-start.x, -start.y, -start.z);
    const batch = new THREE.InstancedMesh(geometry, Array.isArray(mesh.material) ? mesh.material.map(makeGold) : makeGold(mesh.material), count);
    batch.name = `MaryCoinArc_${instances.length}`;
    batch.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    batch.frustumCulled = false;
    group.add(batch);
    instances.push(batch);
  });
  if (!instances.length) return null;
  const oldVisibility = [left.visible, right.visible];
  left.visible = right.visible = false;
  car.add(group);
  const settings = { arcHeight: 0.022, coinSize: 1.18, hoverStrength: 0.0008, motionSpeed: 0.7, spinSpeed: 0.55 };
  const dummy = new THREE.Object3D();
  let elapsed = 0;
  let spin = 0;
  function update(delta = 0) {
    const step = Math.min(Math.max(delta, 0), 0.1);
    elapsed += step;
    spin = (spin + step * settings.spinSpeed) % (Math.PI * 2);
    for (let i = 0; i < count; i++) {
      const t = i / (count - 1);
      dummy.position.lerpVectors(start, end, t);
      // World-up remains local-up for the car; local -Z points toward the viewer.
      dummy.position.y += (settings.arcHeight * 4 * t * (1-t)
        + Math.sin(elapsed * settings.motionSpeed * 2 - t * Math.PI) * settings.hoverStrength) / worldScale;
      dummy.position.z -= (0.008 + 0.005 * Math.sin(Math.PI * t)) / worldScale;
      // Offset the spins slightly so highlights travel across the arc.
      // YXZ keeps the main spin around the vertical axis with a subtle local tilt.
      const wave = elapsed * settings.motionSpeed * 2 - t * Math.PI;
      dummy.rotation.set(0.06 * Math.cos(wave), spin + (t - 0.5) * 0.9, 0.035 * Math.sin(wave), 'YXZ');
      dummy.scale.setScalar(settings.coinSize);
      dummy.updateMatrix();
      for (const batch of instances) batch.setMatrixAt(i, dummy.matrix);
    }
    instances.forEach(batch => { batch.instanceMatrix.needsUpdate = true; });
  }
  update();
  return { group, settings, update, dispose() {
    left.visible = oldVisibility[0]; right.visible = oldVisibility[1];
    group.removeFromParent();
    goldMaterials.forEach(material => material.dispose());
    instances.forEach(batch => { batch.dispose(); batch.geometry.dispose(); });
  } };
}
