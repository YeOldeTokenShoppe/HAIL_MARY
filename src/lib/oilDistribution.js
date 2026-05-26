/**
 * Oil distribution generation for the voxel claim grid.
 * Deterministic RNG from a block hash seed, producing blob-like 3D oil deposits.
 */

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
  totalOilBudget = 500000,
  numberOfDeposits = 5,
  radiusMin = 0.8,
  radiusMax = 3.0,
  richnessMin = 0.6,
  richnessMax = 2.0,
  depthBias = 0.55,
  hitThreshold = 0.005,
}) {
  const rand = createRNG(blockHash);

  const grid = Array.from({ length: gridX }, () =>
    Array.from({ length: gridY }, () => new Array(depthZ).fill(0))
  );

  function biasedDepth() {
    const u = rand();
    const biased = Math.pow(u, 1 - depthBias);
    return biased * (depthZ - 1);
  }

  const deposits = Array.from({ length: numberOfDeposits }, () => ({
    cx: rand() * (gridX - 1),
    cy: rand() * (gridY - 1),
    cz: biasedDepth(),
    radius: radiusMin + rand() * (radiusMax - radiusMin),
    richness: richnessMin + rand() * (richnessMax - richnessMin),
  }));

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
  const numberOfHellPockets = Math.max(1, Math.floor(gridX * gridY * 0.03)); // ~3% of grid
  const hellPockets = [];
  const usedCells = new Set();
  for (let i = 0; i < numberOfHellPockets * 3 && hellPockets.length < numberOfHellPockets; i++) {
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
