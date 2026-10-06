// Where desert dressing must NOT go (2026-10-06): the claims, the boardwalk
// strip hanging off the −Z edge, and the refinery complex on the +X/+Z corner.
// Shared by the tumbleweeds (which test a whole crossing against it) and the
// cactus scatter (which tests points). World units; the field is centred on
// the origin with +Z toward the viewer's default side and the strip on −Z.

export function fieldKeepOutRects(worldW, worldD, cellSize = 1) {
  return [
    // Claims + strip. The strip's stalls and the clown entrance stand several
    // cells behind the deck, hence the deep −Z margin.
    {
      minX: -(worldW / 2 + 1.2 * cellSize), maxX: worldW / 2 + 1.2 * cellSize,
      minZ: -(worldD / 2 + 5 * cellSize), maxZ: worldD / 2 + 1.2 * cellSize,
    },
    // Refinery complex wrapping the front-right corner (COMPLEX.corner pxpz).
    {
      minX: worldW / 2 - 2 * cellSize, maxX: worldW / 2 + 4 * cellSize,
      minZ: worldD / 2 - 2 * cellSize, maxZ: worldD / 2 + 4 * cellSize,
    },
  ];
}

export function pointInRect(x, z, r) {
  return x >= r.minX && x <= r.maxX && z >= r.minZ && z <= r.maxZ;
}

// Liang–Barsky: does the segment p→p+d·L cross the axis-aligned rect?
export function segmentHitsRect(px, pz, dx, dz, L, rect) {
  let t0 = 0, t1 = L;
  const clip = (p, q) => {
    if (p === 0) return q >= 0;
    const r = q / p;
    if (p < 0) { if (r > t1) return false; if (r > t0) t0 = r; }
    else { if (r < t0) return false; if (r < t1) t1 = r; }
    return true;
  };
  return clip(-dx, px - rect.minX) && clip(dx, rect.maxX - px) &&
         clip(-dz, pz - rect.minZ) && clip(dz, rect.maxZ - pz);
}

// Small seeded PRNG (mulberry32) so a scatter is identical on every load and
// for every player; change the seed to reroll the whole desert.
export function seededRandom(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── The dirt road (2026-10-06) ───────────────────────────────────────────────
// One access track leaving the boardwalk's +X end and running off toward the
// horizon ridge on −Z. Control points in world units, scaled off the field size
// so the start stays pinned to the deck's corner; the far end tucks behind the
// first hill range (radius ≈236) so the road never visibly stops on the plain.
// Shared so the cactus scatter can keep off it and the road mesh can draw it.
export function roadControlPoints(worldW, worldD, cellSize = 1) {
  const hx = worldW / 2, hz = worldD / 2, c = cellSize;
  return [
    [hx + 1.3 * c, -(hz + 0.6 * c)],
    [hx + 3.5 * c, -(hz + 2.6 * c)],
    [hx + 7 * c, -(hz + 8 * c)],
    [22, -40],
    [45, -110],
    [75, -235],
  ];
}

// Road half-width at a fraction t∈[0,1] of its length: a two-track lane near
// the strip, widening toward the horizon so perspective does not pinch it to a
// hairline before the fog takes it.
export function roadHalfWidth(t) {
  return 0.45 + 0.65 * t;
}

// Shortest distance from (x,z) to a polyline of [x,z] points.
export function distanceToPolyline(x, z, pts) {
  let best = Infinity;
  for (let i = 0; i + 1 < pts.length; i++) {
    const [ax, az] = pts[i], [bx, bz] = pts[i + 1];
    const dx = bx - ax, dz = bz - az;
    const len2 = dx * dx + dz * dz || 1e-9;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / len2));
    const px = ax + dx * t, pz = az + dz * t;
    best = Math.min(best, Math.hypot(x - px, z - pz));
  }
  return best;
}
