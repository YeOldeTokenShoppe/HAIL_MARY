// Shared light responses. Geometry lives in an overlay preset; cards opt in
// to that preset and may override its strength without duplicating the tuning.
export const FX_MATERIALS = {
  holographic: {
    hueTravel: 150, hueRange: null, rimHueOffset: 35, edgeHueOffset: 70,
    coreLightness: [65, 100], rimLightness: 75, edgeLightness: 60,
    emissionGain: 1, bloomGain: 1, bloomColor: "245 253 255",
    bloomLightness: 75, bloomRadius: [6, 20], bloomBrightness: 1.8,
    baseHueShift: [65, -45],
  },
  fire: {
    // Heat stays between ember-orange and gold, including the scattered glow.
    // Preserve the source colors; the masked light supplies the temperature
    // change instead of hue-rotating the flame image toward green or violet.
    hueTravel: 16, hueRange: [16, 46], rimHueOffset: -6, edgeHueOffset: -12,
    coreLightness: [55, 92], rimLightness: 66, edgeLightness: 48,
    emissionGain: 1.05, bloomGain: 1.1, bloomColor: "255 155 35",
    bloomLightness: 60, bloomRadius: [8, 38], bloomBrightness: 1.75,
    baseHueShift: [0, 0],
  },
};

export function fxMaterial(name) {
  return FX_MATERIALS[name] || FX_MATERIALS.holographic;
}

export const FLAME_REFLECTION = {
  overlay: "Flame", material: "fire", strength: 1,
  // Asset-space percentages stay fixed on the curls. Broader angular peaks
  // let the fire swell smoothly as the card turns, rather than snapping on.
  facets: [
    { x: 13, y: 12, radius: [26, 15], axis: [0.86, 0.5], angle: -0.2, roughness: 0.16, hue: 29 },
    { x: 6, y: 31, radius: [14, 24], axis: [0.72, -0.69], angle: 0.16, roughness: 0.17, hue: 23 },
    { x: 89, y: 22, radius: [20, 9], axis: [-0.85, 0.53], angle: -0.27, roughness: 0.15, hue: 35 },
    { x: 93, y: 65, radius: [14, 20], axis: [0.86, 0.5], angle: 0.21, roughness: 0.18, hue: 26 },
    { x: 72, y: 90, radius: [31, 14], axis: [-0.84, 0.54], angle: -0.16, roughness: 0.17, hue: 33 },
    { x: 22, y: 87, radius: [28, 15], axis: [-0.58, -0.82], angle: 0.2, roughness: 0.18, hue: 24 },
  ],
};
