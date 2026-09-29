#!/usr/bin/env node
// How often does a core run hot, and why? Tuning readout for the heat reading
// (lib/oilLoopV2 heatReading): generates N seasons with the default settings
// and reports, per neighbour rule, the share of cores reading nominal /
// elevated / high, what caused the hot ones (hell vs motherlode, under you vs
// next door), and — the number that matters for the casing decision — how
// often a HIGH reading is hell.
// Usage: node scripts/oil-heat-rate.mjs [seasons=200] [grid=10] [depth=20] [lodeFraction=0.85] [hellPockets=default]
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
const load = async (rel) => import("data:text/javascript;charset=utf-8," + encodeURIComponent(readFileSync(new URL(rel, import.meta.url), "utf8")));
const { generateOilDistribution3D, OIL_FIELD_UNITS } = await load("../src/lib/oilDistribution.js");
const { heatReading, HEAT_LODE_FRACTION } = await load("../src/lib/oilLoopV2.js");

const seasons = Number(process.argv[2]) || 200, gridSize = Number(process.argv[3]) || 10, depthZ = Number(process.argv[4]) || 20;
const lodeFraction = process.argv[5] != null ? Number(process.argv[5]) : HEAT_LODE_FRACTION;
const hellPocketsArg = process.argv[6] != null ? Number(process.argv[6]) : null;
const rules = ["none", "ortho4", "all8"];
const tally = Object.fromEntries(rules.map((r) => [r, { cores: 0, elevated: 0, high: 0, highHell: 0, hellBelow: 0, lodeBelow: 0, hellSide: 0, lodeSide: 0 }]));
let hellPerMap = 0, lodeCells = 0;
for (let i = 0; i < seasons; i++) {
  const seed = createHash("sha256").update(`heat-rate-${i}`).digest("hex");
  const { grid, hellPockets, maxOil } = generateOilDistribution3D({ blockHash: seed, gridX: gridSize, gridY: gridSize, depthZ, totalOilBudget: OIL_FIELD_UNITS, numberOfDeposits: 5, numberOfHellPockets: hellPocketsArg });
  const hellSet = new Set(hellPockets.map((p) => `${p.x}_${p.y}_${p.z}`));
  const lodeMin = (maxOil || 0) * lodeFraction;
  hellPerMap += hellPockets.length;
  for (let c = 0; c < gridSize; c++) for (let r = 0; r < gridSize; r++) for (let z = 0; z < depthZ; z++) if ((grid[c][r][z] || 0) >= lodeMin && lodeMin > 0) lodeCells++;
  for (const rule of rules) {
    const t = tally[rule];
    for (let c = 0; c < gridSize; c++) for (let r = 0; r < gridSize; r++) for (let z = 0; z < depthZ - 1; z++) {
      const h = heatReading({ isHellAt: (x, y, k) => hellSet.has(`${x}_${y}_${k}`), oilAt: (x, y, k) => grid[x][y][k] || 0, motherlodeMin: lodeMin, col: c, row: r, layer: z, depthZ, gridSize, neighbours: rule });
      t.cores++;
      if (h.level === "nominal") continue;
      if (h.level === "high") { t.high++; if (h.kind === "hell") t.highHell++; } else t.elevated++;
      if (h.kind === "hell") { if (h.lateral) t.hellSide++; else t.hellBelow++; } else { if (h.lateral) t.lodeSide++; else t.lodeBelow++; }
    }
  }
}
const pct = (a, b) => (b ? `${(100 * a / b).toFixed(1)}%` : "—");
console.log(`${seasons} seasons · ${gridSize}×${gridSize}×${depthZ} · hell pockets/map ${(hellPerMap / seasons).toFixed(1)} · lode cells/map ${(lodeCells / seasons).toFixed(1)} (≥ ${lodeFraction * 100}% of the richest cell)`);
console.log("rule     cores   nominal   elevated   high   | HIGH is hell | hot causes: hell↓  lode↓  hell→  lode→");
for (const rule of rules) {
  const t = tally[rule]; const hot = t.elevated + t.high;
  console.log(`${rule.padEnd(8)} ${String(t.cores).padStart(6)}  ${pct(t.cores - hot, t.cores).padStart(7)}   ${pct(t.elevated, t.cores).padStart(7)}  ${pct(t.high, t.cores).padStart(6)} | ${pct(t.highHell, t.high).padStart(11)} | ${pct(t.hellBelow, hot).padStart(9)} ${pct(t.lodeBelow, hot).padStart(6)} ${pct(t.hellSide, hot).padStart(6)} ${pct(t.lodeSide, hot).padStart(6)}`);
}
