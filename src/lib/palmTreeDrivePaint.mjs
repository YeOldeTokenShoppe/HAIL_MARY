import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

const BODY_PANELS = new Set(['CarBody', 'LDoor', 'RDoor']);

export function createCandyEmeraldPaint(renderer) {
  // Generate soft reflection cards locally; no additional downloaded textures.
  const room = new RoomEnvironment();
  const generator = new THREE.PMREMGenerator(renderer);
  const environment = generator.fromScene(room, 0.12, 0.1, 100, { size: 128 });
  room.dispose();
  generator.dispose();
  const materials = [];
  const statueCenter = new THREE.Vector3(2.45, 1.30, 24.35);
  return {
    apply(mesh) {
      if (!mesh.isMesh || !BODY_PANELS.has(mesh.name)) return;
      const convert = source => {
        const paint = new THREE.MeshPhysicalMaterial();
        THREE.MeshStandardMaterial.prototype.copy.call(paint, source);
        paint.name = `${mesh.name}_CandyEmerald`;
        paint.roughness = 0.38;
        paint.metalness = 0.25;
        paint.clearcoat = 0.35;
        paint.clearcoatRoughness = 0.40;
        paint.specularIntensity = 0.35;
        paint.envMap = environment.texture;
        paint.envMapIntensity = 0.08;
        // Keep the source atlas, including trim and upholstery. Normalize only
        // green painted texels so the three panels share the same emerald hue.
        paint.onBeforeCompile = shader => {
          shader.uniforms.candyEmerald = { value: new THREE.Color('#087d50') };
          shader.fragmentShader = 'uniform vec3 candyEmerald;\n' + shader.fragmentShader;
          shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', `
            #include <map_fragment>
            float emeraldMask = smoothstep(0.025, 0.10,
              diffuseColor.g - max(diffuseColor.r, diffuseColor.b));
            diffuseColor.rgb = mix(diffuseColor.rgb, candyEmerald, emeraldMask);
          `);
        };
        paint.customProgramCacheKey = () => 'candy-emerald-v1';
        materials.push(paint);
        return paint;
      };
      mesh.material = Array.isArray(mesh.material)
        ? mesh.material.map(convert) : convert(mesh.material);
    },
    update(camera) {
      // Gradually soften the finish as the camera enters the cabin, keeping
      // bright paint highlights out of Mary's close-up without a visible switch.
      const distance = camera.position.distanceTo(statueCenter);
      const exterior = THREE.MathUtils.smoothstep(distance, 0.7, 3);
      for (const paint of materials) {
        paint.roughness = THREE.MathUtils.lerp(0.65, 0.38, exterior);
        paint.metalness = THREE.MathUtils.lerp(0.15, 0.25, exterior);
        paint.clearcoat = THREE.MathUtils.lerp(0.001, 0.35, exterior);
        paint.envMapIntensity = THREE.MathUtils.lerp(0.015, 0.08, exterior);
      }
    },
    dispose() {
      materials.forEach(material => material.dispose());
      environment.dispose();
    }
  };
}
