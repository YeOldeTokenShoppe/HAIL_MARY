// An optional material treatment; works with the existing skinned animation and
// composes with the candy paint shader rather than replacing its texture atlas.
export function applyIllustratedStyle(root) {
  const visited = new Set();
  root.traverse(mesh => {
    if (!mesh.isMesh || /^(headlights|taillights|halo|eye)/i.test(mesh.name)) return;
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const material of materials) {
      if (visited.has(material) || material.transparent || !material.isMeshStandardMaterial) continue;
      visited.add(material);
      const previousCompile = material.onBeforeCompile;
      const previousKey = material.customProgramCacheKey();
      material.onBeforeCompile = function(shader, renderer) {
        previousCompile.call(this, shader, renderer);
        shader.fragmentShader = shader.fragmentShader.replace('#include <opaque_fragment>', `
          // Preserve the authored colors while compressing lighting to painted
          // tonal blocks. Screen derivatives soften band boundaries in motion.
          float inkLuma = dot(outgoingLight, vec3(0.2126, 0.7152, 0.0722));
          float inkBase = max(dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722)), 0.035);
          float inkLight = inkLuma / inkBase;
          float inkAA = max(fwidth(inkLight) * 1.25, 0.035);
          float inkMid = smoothstep(0.65-inkAA, 0.65+inkAA, inkLight);
          float inkHigh = smoothstep(1.45-inkAA, 1.45+inkAA, inkLight);
          float inkBand = 0.45 + 0.50 * inkMid + 0.48 * inkHigh;
          vec3 inkColor = outgoingLight * (inkBase * inkBand / max(inkLuma, 0.025));
          inkColor *= mix(vec3(0.78, 0.70, 1.06), vec3(1.10, 1.02, 0.90), inkMid);
          inkColor = mix(vec3(dot(inkColor, vec3(0.2126,0.7152,0.0722))), inkColor, 1.15);
          // Darken grazing faces to suggest drawn contours without adding
          // duplicate skinned meshes or interfering with the wheel pivots.
          float inkFacing = abs(dot(normalize(normal), normalize(vViewPosition)));
          float inkContour = 1.0 - smoothstep(0.12, 0.28, inkFacing);
          outgoingLight = mix(max(inkColor, vec3(0.0)), vec3(0.012, 0.007, 0.021), inkContour * 0.88);
          #include <opaque_fragment>
        `);
      };
      material.customProgramCacheKey = () => `${previousKey}|illustrated-v1`;
      material.needsUpdate = true;
    }
  });
}
