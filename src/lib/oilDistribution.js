/**
 * Oil distribution generation for the voxel claim grid.
 * Deterministic RNG from a block hash seed, producing blob-like 3D oil deposits.
 */

// Fixed internal resolution of the field, in abstract oil units. The grid is
// ALWAYS generated at this scale (not the $ prize) so the deposit blobs are
// faithful — at a low total, rounding wipes out the blob edges and collapses the
// distribution to its cores. The prize pool ($) is a SEPARATE value distributed
// by score share at payout. Every generateOilDistribution3D caller must pass
// this (not the prize) so client and server agree.
export const OIL_FIELD_UNITS = 500000;

// Depth distribution bias (0 = uniform, →1 = deeper). The single source of truth
// — every caller relies on this default so client and server never drift. (A
// mismatch here once had the server revealing oil at different depths than the
// client rendered.)
export const OIL_DEPTH_BIAS = 0.35;

/**
 * Deterministic RNG (mulberry32-ish) from a string seed (block hash).
 */
function createRNG(seedStr) {
  let s = 0;
  for (let i = 0; i < seedStr.length; i++) {
    s = ((s << 5) - s) + seedStr.charCodeAt(i);
    s |= 0;
  }
  return function rand() {
    s |= 0;
    s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Generate blob-like oil density across a 3D voxel grid (x × y × z).
 * Returns:
 * - grid[x][y][z] = integer oil amount
 * - deposits list (for post-game reveal / audit UI)
 * - maxOil = highest single-cell value (for normalization)
 */
export function generateOilDistribution3D({
  blockHash,
  gridX = 10,
  gridY = 10,
  depthZ = 20,
  totalOilBudget = OIL_FIELD_UNITS,
  numberOfDeposits = 5,
  // Hell-pocket count. null ⇒ derive from grid size (~3%). Decoupled from oil
  // (separate RNG stream below), so changing it never moves the oil map and
  // never affects provable-fairness verification.
  numberOfHellPockets = null,
  // Deposit blob radius range. Kept deliberately NARROW: a wide range (the old
  // 0.8–3.0) made each seed re-roll deposit *sizes* across ~4×, so on a small
  // grid the hit rate swung wildly seed-to-seed (e.g. 47%–86% at 4 deposits).
  // Tightening the band stabilizes the hit rate near a target WITHOUT weakening
  // fairness — placement (cx/cy) stays seed-random/unpredictable; only blob size
  // is made consistent. NOTE: shared by strike-tick + the verifier + the preview,
  // so this default changes all three together — lock it before the first real
  // committed game (changing it remaps every seed).
  radiusMin = 1.5,
  radiusMax = 2.2,
  richnessMin = 0.6,
  richnessMax = 2.0,
  depthBias = OIL_DEPTH_BIAS,
  hitThreshold = 0.005,
}) {
  const rand = createRNG(blockHash);

  const grid = Array.from({ length: gridX }, () =>
    Array.from({ length: gridY }, () => new Array(depthZ).fill(0))
  );

  // Deposits are STRATIFIED across the depth column so every season has reachable
  // oil shallow (within the base PASSIVE depth cap) AND richer oil deeper — a ramp,
  // not a wall. Without this, a depth-biased roll could put every deposit below the
  // base cap, leaving low-depth rigs with a structural zero chance (bait-and-switch).
  //
  // Each deposit's depth is random WITHIN its stratum, and its (cx,cy) is fully
  // seed-random — so WHICH cells hold oil stays unpredictable; only the public band
  // structure is fixed. Provable fairness is unaffected (same as the old depthBias
  // being a known parameter). Richness scales with depth: shallow = a modest taste,
  // deep = the jackpot the bonus-depth grind earns. (depthBias is now unused; the
  // stratification replaces it.)
  const zMin = 1.0;
  const zMax = depthZ - 1.5;
  const N = Math.max(1, numberOfDeposits);
  const deposits = Array.from({ length: N }, (_, i) => {
    const cx = rand() * (gridX - 1);
    const cy = rand() * (gridY - 1);
    const bandLo = zMin + (i / N) * (zMax - zMin);
    const bandHi = zMin + ((i + 1) / N) * (zMax - zMin);
    const cz = bandLo + rand() * (bandHi - bandLo);
    const radius = radiusMin + rand() * (radiusMax - radiusMin);
    // Richness rises with depth in EXPECTATION, but the full range stays reachable
    // at ANY depth — a shallow rig CAN still hit a rich pocket, just less often.
    // Bias a uniform roll by depth: shallow skews modest (high exponent ⇒ mostly
    // low, but a high roll still spikes), deep skews rich (low exponent).
    const depthFrac = zMax > zMin ? (cz - zMin) / (zMax - zMin) : 0; // 0 shallow → 1 deep
    const richExp = 2.4 - depthFrac * 2.0;     // ~2.4 shallow → ~0.4 deep
    const richness = richnessMin + Math.pow(rand(), richExp) * (richnessMax - richnessMin);
    return { cx, cy, cz, radius, richness };
  });

  let rawTotal = 0;
  for (let x = 0; x < gridX; x++) {
    for (let y = 0; y < gridY; y++) {
      for (let z = 0; z < depthZ; z++) {
        let cell = 0;
        for (const dep of deposits) {
          const dx = x - dep.cx;
          const dy = y - dep.cy;
          const dz = z - dep.cz;
          const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
          if (dist < dep.radius) {
            const falloff = 1 - dist / dep.radius;
            cell += (falloff * falloff) * dep.richness;
          }
        }
        grid[x][y][z] = cell;
        rawTotal += cell;
      }
    }
  }

  // Zero out faint edges below threshold (before scaling)
  let cleanTotal = 0;
  for (let x = 0; x < gridX; x++) {
    for (let y = 0; y < gridY; y++) {
      for (let z = 0; z < depthZ; z++) {
        if (grid[x][y][z] < hitThreshold) {
          grid[x][y][z] = 0;
        }
        cleanTotal += grid[x][y][z];
      }
    }
  }

  const scale = cleanTotal > 0 ? totalOilBudget / cleanTotal : 0;
  let maxOil = 0;

  let roundedTotal = 0;
  for (let x = 0; x < gridX; x++) {
    for (let y = 0; y < gridY; y++) {
      for (let z = 0; z < depthZ; z++) {
        const v = Math.round(grid[x][y][z] * scale);
        grid[x][y][z] = v;
        roundedTotal += v;
      }
    }
  }

  // Fix rounding drift so total lands exactly on budget
  let diff = totalOilBudget - roundedTotal;
  if (diff !== 0) {
    outer:
    for (let x = 0; x < gridX; x++) {
      for (let y = 0; y < gridY; y++) {
        for (let z = 0; z < depthZ; z++) {
          if (grid[x][y][z] > 0 && diff !== 0) {
            const nudge = diff > 0 ? 1 : -1;
            grid[x][y][z] += nudge;
            diff -= nudge;
            if (diff === 0) break outer;
          }
        }
      }
    }
  }

  for (let x = 0; x < gridX; x++) {
    for (let y = 0; y < gridY; y++) {
      for (let z = 0; z < depthZ; z++) {
        if (grid[x][y][z] > maxOil) maxOil = grid[x][y][z];
      }
    }
  }

  // ── Hell pockets: specific cells that trigger a bad event when drilled ──
  // Use a separate RNG stream so adding/removing hell pockets doesn't shift
  // oil deposit positions (the main rand has already been consumed above).
  const hellRng = createRNG(blockHash + "_hell");
  const hellCount = (numberOfHellPockets != null && numberOfHellPockets >= 0)
    ? Math.floor(numberOfHellPockets)
    : Math.max(1, Math.floor(gridX * gridY * 0.03)); // default ~3% of grid
  const hellPockets = [];
  const usedCells = new Set();
  for (let i = 0; i < hellCount * 20 && hellPockets.length < hellCount; i++) {
    const hx = Math.floor(hellRng() * gridX);
    const hy = Math.floor(hellRng() * gridY);
    const hz = Math.floor(hellRng() * (depthZ - 2)) + 2; // never at surface (z>=2)
    const key = `${hx}_${hy}_${hz}`;
    if (usedCells.has(key)) continue;
    // Skip cells that contain significant oil — don't punish a jackpot
    if (grid[hx]?.[hy]?.[hz] > 0) continue;
    usedCells.add(key);
    hellPockets.push({ x: hx, y: hy, z: hz });
  }

  return { grid, deposits, maxOil, hellPockets };
}
