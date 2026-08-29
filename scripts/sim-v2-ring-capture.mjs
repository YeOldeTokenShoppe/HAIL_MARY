// v2 field-tuning sim, extended per docs/oil-game.md §"The company ring",
// §"Rule of capture", and §"Multi-element core & relic distribution"
// (2026-08-26): 8×8 claimed interior + unclaimable company ring, threshold
// players, salvage laterals, border wildcats with pool drains, passive
// siphons, and flagged inclusions (relics). Pure math, no Firebase. Run:
//   node scripts/sim-v2-ring-capture.mjs
//
// Questions this answers (the build-order gate):
//   1. Do charges bind (does anyone rationally pass) at a given deposit count?
//   2. Archetype balance: deep-interior vs border-edge vs border-corner EV.
//   3. Where the field's oil ends up: banked / salvaged / wildcatted / royalty
//      / stranded.
//   4. Do inclusions create DEMAND for the slack-budget two-thirds — i.e. do
//      spare charges find work even where oil alone never binds?
import { readFileSync } from "node:fs";

const load = async (rel) => {
  const src = readFileSync(new URL(rel, import.meta.url), "utf8");
  return import("data:text/javascript;charset=utf-8," + encodeURIComponent(src));
};
const { generateOilDistribution3D, OIL_FIELD_UNITS } = await load("../src/lib/oilDistribution.js");

const GX = 10, GY = 10, GZ = 20;
const SEEDS = 30;
const isRing = (x, y) => x === 0 || y === 0 || x === GX - 1 || y === GY - 1;

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// One season. Every interior column runs the same threshold agent; border
// agents additionally wildcat their private ring column(s). Round r = layer r
// revealed everywhere (lockstep approximation of the staggered tick).
function season({ seed, deposits, charges, capture, royalty, inclusions, threshQ, lattice }) {
  const { grid } = generateOilDistribution3D({
    blockHash: `0xsim${seed.toString(16).padStart(4, "0")}${"ab".repeat(28)}`,
    gridX: GX, gridY: GY, depthZ: GZ,
    totalOilBudget: OIL_FIELD_UNITS, numberOfDeposits: deposits,
  });
  const rng = mulberry32(seed * 7919 + deposits);

  // Global fixed threshold: q-quantile of positive INTERIOR cells (the crew line).
  const wet = [];
  for (let x = 1; x < GX - 1; x++) for (let y = 1; y < GY - 1; y++)
    for (let z = 0; z < GZ; z++) if (grid[x][y][z] > 0) wet.push(grid[x][y][z]);
  wet.sort((a, b) => a - b);
  const T = wet.length ? wet[Math.floor(wet.length * threshQ)] : Infinity;
  const meanWet = wet.length ? wet.reduce((s, v) => s + v, 0) / wet.length : 0;

  // Inclusions (§Multi-element core): ~1.2/column avg across ALL 100 columns,
  // ~70% in dry cells, depth-biased. Value tiers relative to the mean wet
  // cell: 60% small (0.5m) / 30% mid (1.5m) / 10% big (5m) → E ≈ 1.25m.
  const incl = new Map(); // "x_y_z" → value
  let relicPlaced = 0;
  if (inclusions) {
    for (let x = 0; x < GX; x++) for (let y = 0; y < GY; y++) {
      const k = [0, 1, 1, 1, 2, 2][Math.floor(rng() * 6)];
      for (let i = 0; i < k; i++) {
        let z = -1;
        for (let tries = 0; tries < 10; tries++) {
          const cand = GZ - 1 - Math.floor(Math.pow(rng(), 1.6) * GZ); // deep bias
          const dry = grid[x][y][cand] <= 0;
          if (!incl.has(`${x}_${y}_${cand}`) && (dry || rng() < 0.3)) { z = cand; break; }
        }
        if (z < 0) continue;
        const r = rng();
        const v = meanWet * (r < 0.6 ? 0.5 : r < 0.9 ? 1.5 : 5);
        incl.set(`${x}_${y}_${z}`, v);
        relicPlaced += v;
      }
    }
  }
  const relicEV = meanWet * 1.25; // what a rational agent expects behind a ping

  // Per-claim state. Lattice mode (Michelle's v3 sketch, 2026-08-27): claims
  // sit only on spaced rig pads (every 2nd col, every 3rd row → 15 pads on
  // 10×10); ALL other cells are frontier, wildcat-able 8-dir by adjacent pads.
  const C = new Map();
  const cls = (x, y) => {
    if (lattice) {
      return (x <= 1 || y <= 1 || x >= GX - 2 || y >= GY - 2) ? "edge" : "interior";
    }
    const rn = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dy]) => isRing(x + dx, y + dy)).length;
    return rn === 0 ? "interior" : rn === 1 ? "edge" : "corner";
  };
  if (lattice) {
    for (let x = 1; x < GX; x += 2) for (let y = 1; y < GY; y += 3)
      C.set(`${x}_${y}`, { x, y, charges, banked: 0, salvaged: 0, wildcatted: 0, relics: 0, cls: cls(x, y) });
  } else {
    for (let x = 1; x < GX - 1; x++) for (let y = 1; y < GY - 1; y++)
      C.set(`${x}_${y}`, { x, y, charges, banked: 0, salvaged: 0, wildcatted: 0, relics: 0, cls: cls(x, y) });
  }

  const ringTaken = new Set();
  let open = []; // passed pockets: { x, y, z, oil, ping, age }
  let bindCols = 0, demandCols = 0, relicRecovered = 0, royaltyTotal = 0, dryWildcats = 0;

  // Bind & demand metrics per claimed column
  for (const c of C.values()) {
    let nWet = 0, nPing = 0;
    for (let z = 0; z < GZ; z++) {
      if (grid[c.x][c.y][z] > 0) nWet++;
      if (incl.has(`${c.x}_${c.y}_${z}`)) nPing++;
    }
    if (nWet > charges) bindCols++;
    if (nWet + nPing > charges) demandCols++;
  }

  for (let z = 0; z < GZ; z++) {
    // 1. Reveals + extract-or-pass (threshold + endgame autopilot). The crew
    //    reads BTR only; a ping on a below-line layer is a MANUAL purchase.
    for (const c of C.values()) {
      const oil = grid[c.x][c.y][z];
      const key = `${c.x}_${c.y}_${z}`;
      const ping = incl.get(key);
      if (oil <= 0 && ping === undefined) continue;
      // Autopilot is opt-in as of 2026-08-27 — agents run threshold-only, so
      // charges stay live for the frontier/salvage market all season.
      if (oil > 0 && c.charges > 0 && oil >= T) {
        c.charges -= 1; c.banked += oil;
        if (ping !== undefined) { c.relics += ping; relicRecovered += ping; incl.delete(key); }
      } else if (ping !== undefined && c.charges > 2 && oil + relicEV >= T) {
        // Prospect the flagged inclusion (keep a 2-charge reserve for oil).
        c.charges -= 1; c.banked += Math.max(0, oil);
        c.relics += ping; relicRecovered += ping; incl.delete(key);
      } else if (oil > 0) {
        open.push({ x: c.x, y: c.y, z, oil, ping, age: 0 });
      }
    }
    // 2. Salvage laterals: eligible neighbours race for fresh pockets. A ping
    //    raises a pocket's expected worth by relicEV.
    open = open.filter((p) => {
      if (p.age === 0) { p.age = 1; return true; } // laterals fire the round AFTER the pass
      const worth = p.oil + (p.ping !== undefined ? relicEV : 0);
      const takers = [[1, 0], [-1, 0], [0, 1], [0, -1]]
        .map(([dx, dy]) => C.get(`${p.x + dx}_${p.y + dy}`))
        .filter((n) => n && n.charges > 0 && worth >= T);
      if (takers.length) {
        const w = takers[Math.floor(rng() * takers.length)];
        w.charges -= 1; w.salvaged += p.oil;
        if (p.ping !== undefined) { w.relics += p.ping; relicRecovered += p.ping; incl.delete(`${p.x}_${p.y}_${p.z}`); }
        return false;
      }
      // 3. Siphon: an adjacent bore drinks the FLUID free — a relic stays in
      //    the husk (stranded; a future husk-mining mechanic could revisit).
      if (capture) {
        const drinkers = [[1, 0], [-1, 0], [0, 1], [0, -1]]
          .map(([dx, dy]) => C.get(`${p.x + dx}_${p.y + dy}`)).filter(Boolean);
        if (drinkers.length && p.age >= 2) {
          const w = drinkers[Math.floor(rng() * drinkers.length)];
          w.salvaged += p.oil;
          return false;
        }
      }
      p.age += 1;
      return true;
    });
    // 4. Wildcats: border claims with spare charges drill their ring cell at
    //    this depth — blind per layer, informed per column. A direct strike
    //    recovers the cell's inclusion; pool drains carry fluid only.
    for (const c of C.values()) {
      if ((!lattice && c.cls === "interior") || c.charges <= 1) continue;
      // Lattice: every pad wildcats its 8-neighbourhood's frontier cells.
      // Classic: border claims reach their 4-orthogonal ring cells.
      const isFrontierCell = (fx, fy) =>
        lattice ? !C.has(`${fx}_${fy}`) : isRing(fx, fy);
      const rings = [];
      if (lattice) {
        for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
          if (!dx && !dy) continue;
          const nx = c.x + dx, ny = c.y + dy;
          if (nx >= 0 && nx < GX && ny >= 0 && ny < GY && !C.has(`${nx}_${ny}`)) rings.push([nx, ny]);
        }
      } else {
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = c.x + dx, ny = c.y + dy;
          if (isRing(nx, ny)) rings.push([nx, ny]);
        }
      }
      for (const [rx, ry] of rings) {
        const key = `${rx}_${ry}_${z}`;
        if (ringTaken.has(key)) continue;
        let colWet = false;
        for (let zz = 0; zz < GZ; zz++) if (grid[rx][ry][zz] > 0) { colWet = true; break; }
        const colPing = incl.has(key);
        if ((!colWet && !colPing) || rng() > 0.35) continue;
        ringTaken.add(key);
        c.charges -= 1;
        const oil = grid[rx][ry][z];
        if (colPing) { const v = incl.get(key); c.relics += v; relicRecovered += v; incl.delete(key); }
        if (oil > 0) {
          c.wildcatted += oil * (1 - royalty); royaltyTotal += oil * royalty;
          if (capture) {
            const q = [[rx, ry, z]], seen = new Set([key]);
            while (q.length) {
              const [ax, ay, az] = q.shift();
              for (const [dx, dy, dz] of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]) {
                const nx = ax + dx, ny = ay + dy, nz = az + dz;
                const k = `${nx}_${ny}_${nz}`;
                if (seen.has(k) || ringTaken.has(k)) continue;
                seen.add(k);
                if (nx < 0 || nx >= GX || ny < 0 || ny >= GY || nz < 0 || nz >= GZ) continue;
                if (!isFrontierCell(nx, ny) || grid[nx][ny][nz] <= 0) continue;
                ringTaken.add(k);
                const po = grid[nx][ny][nz];
                c.wildcatted += po * (1 - royalty); royaltyTotal += po * royalty;
                q.push([nx, ny, nz]);
              }
            }
          }
        } else if (!colPing) dryWildcats++;
        break; // one wildcat per claim per round
      }
    }
  }

  // Tally
  let fieldOil = 0;
  for (let x = 0; x < GX; x++) for (let y = 0; y < GY; y++)
    for (let z = 0; z < GZ; z++) fieldOil += grid[x][y][z];
  const byCls = { interior: [], edge: [], corner: [] };
  let banked = 0, salvaged = 0, wildcatted = 0;
  for (const c of C.values()) {
    banked += c.banked; salvaged += c.salvaged; wildcatted += c.wildcatted;
    byCls[c.cls].push(c.banked + c.salvaged + c.wildcatted + c.relics);
  }
  const mean = (a) => a.length ? a.reduce((s, v) => s + v, 0) / a.length : 0;
  return {
    fieldOil, banked, salvaged, wildcatted, royaltyTotal,
    stranded: fieldOil - banked - salvaged - wildcatted - royaltyTotal,
    bindCols, demandCols, relicPlaced, relicRecovered, dryWildcats,
    claims: C.size,
    evInterior: mean(byCls.interior), evEdge: mean(byCls.edge), evCorner: mean(byCls.corner),
  };
}

// ── Configs ──────────────────────────────────────────────────────────────────
const CONFIGS = [
  { name: "5 dep · 8ch · capture ON · roy 10%", deposits: 5, charges: 8, capture: true, royalty: 0.10, inclusions: false },
  { name: "16 dep · 8ch · capture ON · roy 10%", deposits: 16, charges: 8, capture: true, royalty: 0.10, inclusions: false },
  { name: "16 dep · 8ch · capt ON · roy 10% · INCL", deposits: 16, charges: 8, capture: true, royalty: 0.10, inclusions: true },
  { name: "30 dep · 8ch · capture OFF", deposits: 30, charges: 8, capture: false, royalty: 0.10, inclusions: false },
  { name: "30 dep · 8ch · capture ON · roy 10%", deposits: 30, charges: 8, capture: true, royalty: 0.10, inclusions: false },
  { name: "30 dep · 8ch · capture ON · roy 0%", deposits: 30, charges: 8, capture: true, royalty: 0, inclusions: false },
  { name: "30 dep · 8ch · capt ON · roy 10% · INCL", deposits: 30, charges: 8, capture: true, royalty: 0.10, inclusions: true },
  { name: "LATTICE 15 pads · 30dep · 8ch · INCL", deposits: 30, charges: 8, capture: true, royalty: 0.10, inclusions: true, lattice: true },
  { name: "LATTICE 15 pads · 30dep · 14ch · INCL", deposits: 30, charges: 14, capture: true, royalty: 0.10, inclusions: true, lattice: true },
  { name: "LATTICE 15 pads · 30dep · 20ch · INCL", deposits: 30, charges: 20, capture: true, royalty: 0.10, inclusions: true, lattice: true },
  { name: "30 dep · 20ch · capt ON · roy 10% · INCL", deposits: 30, charges: 20, capture: true, royalty: 0.10, inclusions: true },
];
const THRESH_Q = 0.35;

console.log(`v2 ring+capture+relic sim · ${GX}×${GY}×${GZ}, interior 8×8=64 claims, ${SEEDS} seeds, threshQ=${THRESH_Q}\n`);
console.log("config".padEnd(42), "bind%", "dem%", " bank%", " salv%", " wild%", " roy%", " strand%", " relic%", "  EV int/edge/corner (rel)");
for (const cfg of CONFIGS) {
  const acc = [];
  for (let s = 1; s <= SEEDS; s++) acc.push(season({ seed: s, threshQ: THRESH_Q, ...cfg }));
  const m = (f) => acc.reduce((t, r) => t + f(r), 0) / acc.length;
  const fo = m((r) => r.fieldOil);
  const pct = (f) => ((m(f) / fo) * 100).toFixed(1).padStart(5);
  const evI = m((r) => r.evInterior), evE = m((r) => r.evEdge), evC = m((r) => r.evCorner);
  const relic = cfg.inclusions ? ((m((r) => r.relicRecovered) / m((r) => r.relicPlaced)) * 100).toFixed(0).padStart(5) + "%" : "    —";
  const nClaims = m((r) => r.claims) || 64;
  console.log(
    cfg.name.padEnd(42),
    ((m((r) => r.bindCols) / nClaims) * 100).toFixed(0).padStart(4) + "%",
    ((m((r) => r.demandCols) / nClaims) * 100).toFixed(0).padStart(3) + "%",
    pct((r) => r.banked), pct((r) => r.salvaged), pct((r) => r.wildcatted),
    pct((r) => r.royaltyTotal), pct((r) => r.stranded).padStart(7), relic,
    `  1.00 / ${(evE / evI).toFixed(2)} / ${(evC / evI).toFixed(2)}`,
  );
}
console.log("\nEV columns are relative to deep-interior = 1.00 and INCLUDE relic value.");
console.log("bind% = columns where wet layers alone exceed charges. dem% = wet + flagged inclusions exceed charges.");
