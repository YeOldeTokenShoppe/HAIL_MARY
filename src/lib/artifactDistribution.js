/**
 * Buried-artifact distribution for the voxel claim grid — the non-oil layer
 * ("The Substrate", docs/artifact-expansion.md).
 *
 * Deterministic from the SAME committed block-hash seed as the oil map, but on
 * SEPARATE RNG streams (the hell-pocket pattern in oilDistribution.js): tuning
 * artifact counts never moves the oil, so the commit-reveal fairness story is
 * unchanged. Artifact totals (the summary) are publishable at anchor time.
 *
 * Placement guarantees, in priority order:
 * 1. Every column gets ≥ perColumn artifacts — the 60% who strike no oil are
 *    guaranteed the other game board.
 * 2. At least one of them sits above shallowCap (the PASSIVE_DRILLS base depth),
 *    so a rig with zero bonus drills still reaches an artifact by season end.
 * 3. Placement prefers dry (zero-oil) cells: dry plots become dig sites; oil
 *    plots stay oil plots. Co-location with oil is a legal fallback on
 *    oil-saturated columns, never the norm.
 */

// Match hell pockets: nothing buried in the first layers, so the opening days
// aren't front-loaded with finds and the surface render stays clean.
export const ARTIFACT_SURFACE_BUFFER = 2;

// Distinct amber shards needed to sequence one specimen. Duplicates beyond a
// set are NOT waste — they level the item (Museum score), Miner Tycoon-style.
export const FRAGMENTS_PER_SPECIMEN = 6;

// Fixed rosters. Internal ids are mechanical (per the keep-internal-naming
// convention); labels are placeholders the display layer may re-theme.
export const SPECIMENS = [
  { id: "saurex", label: "SAUREX" },
  { id: "trike", label: "TRIKANT" },
  { id: "raptor", label: "VELOX" },
  { id: "bronto", label: "TITANOPOD" },
  { id: "ptero", label: "AERODON" },
  { id: "anky", label: "CRAGBACK" },
  { id: "stego", label: "SPINERIDGE" },
  { id: "mosa", label: "DEEPMAW" },
];

export const RELICS = [
  { id: "idol", label: "HOLLOW IDOL" },
  { id: "mask", label: "MOURNER'S MASK" },
  { id: "crown", label: "SUNKEN CROWN" },
  { id: "dagger", label: "RITE DAGGER" },
  { id: "tablet", label: "GRAVE TABLET" },
  { id: "bell", label: "SILENT BELL" },
];

// Distinct pieces of the outlaw-cache map. Each piece is placed mapCopies
// times so one absent player can't deadlock the community assembly.
export const MAP_PIECES = 6;

/**
 * Deterministic RNG (mulberry32-ish) from a string seed. MUST stay identical
 * to createRNG in oilDistribution.js — both libs derive streams from the same
 * committed block hash. Duplicated (not imported) so each lib stays free of
 * relative imports for the data:-module test harness.
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

export function artifactKey(x, y, z) {
  return `${x}_${y}_${z}`;
}

/**
 * Generate the buried-artifact layer over an already-generated oil grid.
 *
 * Reads (never mutates) the oil grid to bias placement toward dry cells, and
 * avoids hell-pocket cells outright. Note the one-way coupling this implies:
 * re-tuning hell pockets CAN move artifacts (collision avoidance re-rolls),
 * but re-tuning artifacts never moves oil or hell.
 *
 * Returns:
 * - cells: [{x, y, z, type, ...payload}] in deterministic placement order
 *     type "amber": { specimenId, fragmentIndex }   — dino-DNA shard
 *     type "relic": { relicId, cursed }             — burial ground; cursed ⇒ curse event
 *     type "map":   { pieceIndex }                  — outlaw-map fragment
 *     type "cache": {}                              — the treasure itself (exactly 1)
 * - byKey: { "x_y_z": cell } for O(1) strike-tick lookup
 * - summary: publishable-at-anchor counts (no positions)
 */
export function generateArtifactDistribution3D({
  blockHash,
  gridX = 10,
  gridY = 10,
  depthZ = 20,
  oilGrid,
  hellPockets = [],
  // Guaranteed artifacts per column. At the 1–2 strikes/day season pace this
  // yields a find roughly every 2–3 dry layers — rewarding, not confetti.
  perColumn = 3,
  // Fully-dry columns (no oil at ANY depth) get this many extra artifacts:
  // the worst oil draw is the best dig site.
  dryColumnBonus = 1,
  // Base depth every rig reaches by the buzzer (PASSIVE_DRILLS). Guarantee #2
  // pins one artifact per column above this.
  shallowCap = 10,
  // Copies of each map piece placed in the field.
  mapCopies = 2,
  // Share of assignable cells (after cache + map) that become relics; the
  // rest are amber. Among relics, cursedFraction carry the curse trigger.
  relicFraction = 0.15,
  cursedFraction = 0.25,
}) {
  if (!oilGrid) throw new Error("generateArtifactDistribution3D requires oilGrid");

  const placeRng = createRNG(blockHash + "_artifact");
  const assignRng = createRNG(blockHash + "_artifact_assign");

  const hellSet = new Set(hellPockets.map((h) => artifactKey(h.x, h.y, h.z)));
  const used = new Set();
  const zLo = ARTIFACT_SURFACE_BUFFER;
  const zHi = depthZ; // exclusive

  // Depth bands per column: band 0 is the shallow guarantee [zLo, shallowCap);
  // the remaining depth splits evenly across the other perColumn-1 slots so
  // deeper (bonus-drill) layers hold artifacts too — a ramp, like the oil.
  const shallowEnd = Math.max(zLo + 1, Math.min(shallowCap, zHi));
  const bands = [[zLo, shallowEnd]];
  const deepSlots = Math.max(0, perColumn - 1);
  for (let i = 0; i < deepSlots; i++) {
    const lo = shallowEnd + ((zHi - shallowEnd) * i) / deepSlots;
    const hi = shallowEnd + ((zHi - shallowEnd) * (i + 1)) / deepSlots;
    // Degenerate (depthZ ≤ shallowCap): fall back to the shallow band.
    bands.push(hi - lo >= 1 ? [Math.floor(lo), Math.ceil(hi)] : [zLo, shallowEnd]);
  }

  const isFree = (x, y, z) => {
    const k = artifactKey(x, y, z);
    return !used.has(k) && !hellSet.has(k);
  };
  const isDry = (x, y, z) => (oilGrid[x]?.[y]?.[z] ?? 0) === 0;

  // Pick one cell in [lo, hi): dry-first rejection sampling, then any free
  // cell in the band, then any free cell in the column (never expected on a
  // 20-deep column — bands hold ~6 cells and hell is ~3% of the grid).
  const placeInBand = (x, y, lo, hi) => {
    const span = hi - lo;
    for (let tries = 0; tries < 12; tries++) {
      const z = lo + Math.floor(placeRng() * span);
      if (z >= zHi) continue;
      if (isFree(x, y, z) && isDry(x, y, z)) return z;
    }
    for (let z = lo; z < Math.min(hi, zHi); z++) if (isFree(x, y, z)) return z;
    for (let z = zLo; z < zHi; z++) if (isFree(x, y, z)) return z;
    return null;
  };

  const placed = []; // {x, y, z}
  for (let x = 0; x < gridX; x++) {
    for (let y = 0; y < gridY; y++) {
      for (let b = 0; b < perColumn; b++) {
        const [lo, hi] = bands[Math.min(b, bands.length - 1)];
        const z = placeInBand(x, y, lo, hi);
        if (z == null) continue;
        used.add(artifactKey(x, y, z));
        placed.push({ x, y, z });
      }
      let columnDry = true;
      for (let z = 0; z < zHi; z++) {
        if (!isDry(x, y, z)) { columnDry = false; break; }
      }
      if (columnDry) {
        for (let b = 0; b < dryColumnBonus; b++) {
          const z = placeInBand(x, y, zLo, zHi);
          if (z == null) continue;
          used.add(artifactKey(x, y, z));
          placed.push({ x, y, z });
        }
      }
    }
  }

  // ── Type assignment: separate stream, over a shuffled copy, so re-tuning
  // vein ratios re-deals types but never re-digs positions. ──
  const order = placed.slice();
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(assignRng() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }

  const cellsByKey = {};
  let cursor = 0;
  const take = () => (cursor < order.length ? order[cursor++] : null);

  // Exactly one cache.
  const cacheCell = take();
  if (cacheCell) {
    cellsByKey[artifactKey(cacheCell.x, cacheCell.y, cacheCell.z)] =
      { ...cacheCell, type: "cache" };
  }

  // Full map sets, mapCopies of each piece — every piece guaranteed in-field.
  let mapPlaced = 0;
  for (let c = 0; c < mapCopies; c++) {
    for (let p = 0; p < MAP_PIECES; p++) {
      const cell = take();
      if (!cell) break;
      cellsByKey[artifactKey(cell.x, cell.y, cell.z)] =
        { ...cell, type: "map", pieceIndex: p };
      mapPlaced++;
    }
  }

  // Relics: fixed count (not per-cell coin flips) so the anchor-time summary
  // is exact. The first cursedCount of the already-shuffled relic cells carry
  // the curse trigger — deterministic count, seed-random placement.
  const remaining = order.length - cursor;
  const relicCount = Math.round(remaining * relicFraction);
  const cursedCount = Math.round(relicCount * cursedFraction);
  for (let i = 0; i < relicCount; i++) {
    const cell = take();
    if (!cell) break;
    const relic = RELICS[Math.floor(assignRng() * RELICS.length)];
    cellsByKey[artifactKey(cell.x, cell.y, cell.z)] =
      { ...cell, type: "relic", relicId: relic.id, cursed: i < cursedCount };
  }

  // Amber: everything left. Lay one COMPLETE fragment set per active specimen
  // first (every specimen in the season is provably completable), then deal
  // duplicates randomly — dupes level the item, so they're a feature.
  const amberCount = order.length - cursor;
  const specimenCount = Math.max(1, Math.min(
    SPECIMENS.length,
    Math.floor(amberCount / FRAGMENTS_PER_SPECIMEN)
  ));
  let amberPlaced = 0;
  for (let s = 0; s < specimenCount && cursor < order.length; s++) {
    for (let f = 0; f < FRAGMENTS_PER_SPECIMEN; f++) {
      const cell = take();
      if (!cell) break;
      cellsByKey[artifactKey(cell.x, cell.y, cell.z)] =
        { ...cell, type: "amber", specimenId: SPECIMENS[s].id, fragmentIndex: f };
      amberPlaced++;
    }
  }
  let cell;
  while ((cell = take())) {
    const s = Math.floor(assignRng() * specimenCount);
    const f = Math.floor(assignRng() * FRAGMENTS_PER_SPECIMEN);
    cellsByKey[artifactKey(cell.x, cell.y, cell.z)] =
      { ...cell, type: "amber", specimenId: SPECIMENS[s].id, fragmentIndex: f };
    amberPlaced++;
  }

  // Deterministic placement order for the cells list (audit/reveal UI).
  const cells = placed.map((p) => cellsByKey[artifactKey(p.x, p.y, p.z)]);

  const summary = {
    total: cells.length,
    amber: amberPlaced,
    relics: relicCount,
    cursedRelics: cursedCount,
    mapFragments: mapPlaced,
    mapPieces: MAP_PIECES,
    mapCopies,
    caches: cacheCell ? 1 : 0,
    specimens: specimenCount,
    fragmentsPerSpecimen: FRAGMENTS_PER_SPECIMEN,
    perColumn,
    dryColumnBonus,
    shallowCap,
  };

  return { cells, byKey: cellsByKey, summary };
}
