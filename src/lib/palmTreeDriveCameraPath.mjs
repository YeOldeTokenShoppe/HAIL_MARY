// Desktop helper captures in tour order. Consecutive identical captures are omitted.
export const DESKTOP_CAMERA_SHOTS = [
  { x: 21.5916, y: 13.4449, z: 52.0857, targetX: -0.1704, targetY: 5.4254, targetZ: 22.118, fov: 45 },
  { x: 2.1236, y: 6.2065, z: 59.9345, targetX: -0.1704, targetY: 5.4254, targetZ: 22.118, fov: 45 },
  { x: -6.4188, y: 1.4823, z: 35.5205, targetX: 5.07, targetY: 0.435, targetZ: 26.1199, fov: 44.99 },
  { x: -5.6806, y: 1.4764, z: 20.514, targetX: 5.1688, targetY: 0.2511, targetZ: 25.9342, fov: 44.99 },
  { x: 2.3098, y: 1.9454, z: 10.2423, targetX: 0.6225, targetY: 1.7649, targetZ: 23.5833, fov: 42.1061 },
  { x: 7.9979, y: 2.1078, z: 28.1434, targetX: 1.1779, targetY: 0.7365, targetZ: 23.728, fov: 41.9528 },
  { x: 2.5133, y: 1.5917, z: 31.3361, targetX: 2.3144, targetY: 1.5036, targetZ: 24.2607, fov: 41.9528 },
  { x: 2.4802, y: 1.4387, z: 26.9541, targetX: 2.4047, targetY: 1.4052, targetZ: 24.2663, fov: 41.9528 },
  { x: 2.5139, y: 1.2955, z: 24.6193, targetX: 2.5193, targetY: 1.2913, targetZ: 24.2791, fov: 41.9528 }
];

// Spend the first 43% circling behind and along the left side.
export const DESKTOP_CAMERA_TIMES = [0, 0.15, 0.31, 0.43, 0.53, 0.69, 0.78, 0.87, 1];
export const DESKTOP_CAMERA_SECONDS = 32;

const fields = Object.keys(DESKTOP_CAMERA_SHOTS[0]);
// Shape-preserving cubic interpolation: continuous velocity at the captures,
// without overshooting their heights or cutting past their coordinate bounds.
const tangents = Object.fromEntries(fields.map(field => {
  const slopes = DESKTOP_CAMERA_SHOTS.slice(1).map((shot, i) =>
    (shot[field] - DESKTOP_CAMERA_SHOTS[i][field]) /
    (DESKTOP_CAMERA_TIMES[i + 1] - DESKTOP_CAMERA_TIMES[i]));
  const values = DESKTOP_CAMERA_SHOTS.map((_, i) => {
    if (i === 0 || i === DESKTOP_CAMERA_SHOTS.length - 1) return 0;
    const left = slopes[i - 1], right = slopes[i];
    if (left * right <= 0) return 0;
    const before = DESKTOP_CAMERA_TIMES[i] - DESKTOP_CAMERA_TIMES[i - 1];
    const after = DESKTOP_CAMERA_TIMES[i + 1] - DESKTOP_CAMERA_TIMES[i];
    const w1 = 2 * after + before, w2 = after + 2 * before;
    return (w1 + w2) / (w1 / left + w2 / right);
  });
  return [field, values];
}));

export function sampleDesktopCamera(progress, output = {}) {
  const p = Math.max(0, Math.min(1, progress));
  let i = 0;
  while (i < DESKTOP_CAMERA_TIMES.length - 2 && p > DESKTOP_CAMERA_TIMES[i + 1]) i++;
  const span = DESKTOP_CAMERA_TIMES[i + 1] - DESKTOP_CAMERA_TIMES[i];
  const t = (p - DESKTOP_CAMERA_TIMES[i]) / span;
  const t2 = t * t, t3 = t2 * t;
  for (const field of fields) {
    output[field] = (2 * t3 - 3 * t2 + 1) * DESKTOP_CAMERA_SHOTS[i][field]
      + (t3 - 2 * t2 + t) * span * tangents[field][i]
      + (-2 * t3 + 3 * t2) * DESKTOP_CAMERA_SHOTS[i + 1][field]
      + (t3 - t2) * span * tangents[field][i + 1];
  }
  return output;
}
