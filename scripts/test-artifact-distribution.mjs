// Unit test for the buried-artifact layer (src/lib/artifactDistribution.js).
// Pure math — no Firebase. Run: node scripts/test-artifact-distribution.mjs
//
// Loads the REAL lib sources (so we test the shipped files, not copies) by
// importing them as data: modules — both libs have no relative imports.
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";

const load = async (rel) => {
  const src = readFileSync(new URL(rel, import.meta.url), "utf8");
  return import("data:text/javascript;charset=utf-8," + encodeURIComponent(src));
};
const oil = await load("../src/lib/oilDistribution.js");
const art = await load("../src/lib/artifactDistribution.js");
const { generateOilDistribution3D } = oil;
const {
  generateArtifactDistribution3D, artifactKey,
  ARTIFACT_SURFACE_BUFFER, FRAGMENTS_PER_SPECIMEN, SPECIMENS, MAP_PIECES,
} = art;

let pass = 0, fail = 0;
const t = (name, fn) => {
  try { fn(); pass++; console.log(`  ✓ ${name}`); }
  catch (e) { fail++; console.log(`  ✗ ${name}\n      ${e.message}`); }
};

const SEEDS = [
  "0xabc123def4567890abc123def4567890abc123def4567890abc123def4567890",
  "0x1111111111111111111111111111111111111111111111111111111111111111",
  "0xfeedfacecafebeeffeedfacecafebeeffeedfacecafebeeffeedfacecafebeef",
  "0x9f8e7d6c5b4a39281706f5e4d3c2b1a09f8e7d6c5b4a39281706f5e4d3c2b1a0",
  "0x00000000000000000000000000000000000000000000000000000000deadbeef",
];
const DIMS = { gridX: 10, gridY: 10, depthZ: 20 };

const gen = (blockHash, over = {}) => {
  const o = generateOilDistribution3D({ blockHash, ...DIMS });
  const a = generateArtifactDistribution3D({
    blockHash, ...DIMS, oilGrid: o.grid, hellPockets: o.hellPockets, ...over,
  });
  return { o, a };
};

console.log("\nartifactDistribution — seeded placement\n");

console.log("determinism");
t("same seed → byte-identical output", () => {
  const r1 = gen(SEEDS[0]).a;
  const r2 = gen(SEEDS[0]).a;
  assert.equal(JSON.stringify(r1), JSON.stringify(r2));
});
t("different seed → different placement", () => {
  const k = (r) => r.cells.map((c) => artifactKey(c.x, c.y, c.z)).join("|");
  assert.notEqual(k(gen(SEEDS[0]).a), k(gen(SEEDS[1]).a));
});
t("oil grid is not mutated by artifact generation", () => {
  const o = generateOilDistribution3D({ blockHash: SEEDS[0], ...DIMS });
  const before = JSON.stringify(o.grid);
  generateArtifactDistribution3D({
    blockHash: SEEDS[0], ...DIMS, oilGrid: o.grid, hellPockets: o.hellPockets,
  });
  assert.equal(JSON.stringify(o.grid), before);
});
t("re-tuning vein ratios re-deals types but never moves positions", () => {
  const base = gen(SEEDS[0]).a;
  const tuned = gen(SEEDS[0], { relicFraction: 0.4, cursedFraction: 0.9, mapCopies: 3 }).a;
  const k = (r) => r.cells.map((c) => artifactKey(c.x, c.y, c.z)).join("|");
  assert.equal(k(base), k(tuned));
});

console.log("placement guarantees");
for (const seed of SEEDS) {
  const { o, a } = gen(seed);
  const short = seed.slice(0, 10);
  t(`[${short}] every column ≥ perColumn artifacts, ≥1 above shallowCap`, () => {
    const byCol = new Map();
    for (const c of a.cells) {
      const k = `${c.x}_${c.y}`;
      if (!byCol.has(k)) byCol.set(k, []);
      byCol.get(k).push(c);
    }
    for (let x = 0; x < DIMS.gridX; x++) {
      for (let y = 0; y < DIMS.gridY; y++) {
        const col = byCol.get(`${x}_${y}`) || [];
        assert.ok(col.length >= a.summary.perColumn, `column ${x},${y} has ${col.length}`);
        assert.ok(col.some((c) => c.z < a.summary.shallowCap),
          `column ${x},${y} has none above shallowCap`);
      }
    }
  });
  t(`[${short}] never at surface, never on a hell pocket, never stacked`, () => {
    const hell = new Set(o.hellPockets.map((h) => artifactKey(h.x, h.y, h.z)));
    const seen = new Set();
    for (const c of a.cells) {
      assert.ok(c.z >= ARTIFACT_SURFACE_BUFFER, `surface artifact at z=${c.z}`);
      assert.ok(c.z < DIMS.depthZ, `out of range z=${c.z}`);
      const k = artifactKey(c.x, c.y, c.z);
      assert.ok(!hell.has(k), `artifact on hell pocket ${k}`);
      assert.ok(!seen.has(k), `two artifacts in cell ${k}`);
      seen.add(k);
    }
  });
  t(`[${short}] placement is dry-biased (>70% on zero-oil cells)`, () => {
    const dry = a.cells.filter((c) => o.grid[c.x][c.y][c.z] === 0).length;
    assert.ok(dry / a.cells.length > 0.7, `only ${dry}/${a.cells.length} dry`);
  });
}

console.log("type assignment");
{
  const { a } = gen(SEEDS[0]);
  t("exactly one cache", () => {
    assert.equal(a.cells.filter((c) => c.type === "cache").length, 1);
    assert.equal(a.summary.caches, 1);
  });
  t("every map piece placed exactly mapCopies times", () => {
    const counts = new Array(MAP_PIECES).fill(0);
    for (const c of a.cells) if (c.type === "map") counts[c.pieceIndex]++;
    for (let p = 0; p < MAP_PIECES; p++) {
      assert.equal(counts[p], a.summary.mapCopies, `piece ${p}: ${counts[p]}`);
    }
  });
  t("every active specimen has a complete distinct-fragment set", () => {
    const frags = new Map(); // specimenId → Set(fragmentIndex)
    for (const c of a.cells) {
      if (c.type !== "amber") continue;
      if (!frags.has(c.specimenId)) frags.set(c.specimenId, new Set());
      frags.get(c.specimenId).add(c.fragmentIndex);
    }
    assert.equal(frags.size, a.summary.specimens);
    for (const [id, set] of frags) {
      assert.equal(set.size, FRAGMENTS_PER_SPECIMEN, `${id} missing fragments`);
    }
    for (const id of frags.keys()) {
      assert.ok(SPECIMENS.some((s) => s.id === id), `unknown specimen ${id}`);
    }
  });
  t("cursed relic count matches summary, cursed ⊆ relics", () => {
    const relics = a.cells.filter((c) => c.type === "relic");
    assert.equal(relics.length, a.summary.relics);
    assert.equal(relics.filter((c) => c.cursed).length, a.summary.cursedRelics);
  });
  t("summary totals reconcile with cells and byKey", () => {
    const n = { amber: 0, relic: 0, map: 0, cache: 0 };
    for (const c of a.cells) n[c.type]++;
    assert.equal(a.summary.total, a.cells.length);
    assert.equal(n.amber, a.summary.amber);
    assert.equal(n.relic, a.summary.relics);
    assert.equal(n.map, a.summary.mapFragments);
    assert.equal(Object.keys(a.byKey).length, a.cells.length);
    for (const c of a.cells) {
      assert.equal(a.byKey[artifactKey(c.x, c.y, c.z)], c);
    }
  });
}

console.log("edge cases");
t("shallow field (depthZ=8 < shallowCap) still satisfies guarantees", () => {
  const o = generateOilDistribution3D({ blockHash: SEEDS[2], gridX: 6, gridY: 6, depthZ: 8 });
  const a = generateArtifactDistribution3D({
    blockHash: SEEDS[2], gridX: 6, gridY: 6, depthZ: 8,
    oilGrid: o.grid, hellPockets: o.hellPockets,
  });
  for (const c of a.cells) {
    assert.ok(c.z >= ARTIFACT_SURFACE_BUFFER && c.z < 8, `z=${c.z} out of range`);
  }
  assert.ok(a.cells.length >= 6 * 6 * 3, `only ${a.cells.length} placed`);
});
t("perColumn=1 places within the shallow band", () => {
  const { a } = gen(SEEDS[3], { perColumn: 1, dryColumnBonus: 0 });
  for (const c of a.cells) assert.ok(c.z < a.summary.shallowCap, `z=${c.z} below shallowCap`);
});
t("missing oilGrid throws", () => {
  assert.throws(() => generateArtifactDistribution3D({ blockHash: SEEDS[0], ...DIMS }));
});

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
