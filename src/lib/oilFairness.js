import { createHash } from "crypto";
import { generateOilDistribution3D, OIL_FIELD_UNITS } from "./oilDistribution";

// Provable-fairness scheme: future-block-anchored commit-reveal.
//
//   1. COMMIT  — operator generates a random `serverSecret` (NOT chosen/typed),
//                publishes commitment = SHA256(serverSecret) and a future Base
//                block number `anchorBlock`. Both are fixed before that block
//                exists, so the operator cannot know the eventual block hash.
//   2. ANCHOR  — once `anchorBlock` is mined, fetch its hash on-chain and derive
//                finalSeed = SHA256(serverSecret : anchorBlockHash). The field is
//                generated from finalSeed. Neither side could grind it: the
//                operator fixed serverSecret first, the chain fixed the hash.
//   3. REVEAL  — at game end, publish serverSecret. Anyone can then recompute
//                the commitment, the finalSeed, and the entire field, and check
//                it against the cells that were actually played.
export const FAIRNESS_SCHEME = "future-block-v1";

export const sha256Hex = (s) => createHash("sha256").update(String(s)).digest("hex");

export function computeCommitment(serverSecret) {
  return sha256Hex(serverSecret);
}

// finalSeed feeds generateOilDistribution3D as its `blockHash` seed string.
export function computeFinalSeed(serverSecret, anchorBlockHash) {
  return sha256Hex(`${serverSecret}:${anchorBlockHash}`);
}

// Recompute the field from finalSeed and compare it against the cells that were
// actually revealed during play (oilPlots[].revealed). A single mismatch means
// the played field did not come from the committed seed → fairness broken.
export function verifyRevealedField({ finalSeed, gridSize, depthZ, numberOfDeposits, plots }) {
  const { grid } = generateOilDistribution3D({
    blockHash: finalSeed,
    gridX: gridSize,
    gridY: gridSize,
    depthZ,
    totalOilBudget: OIL_FIELD_UNITS,
    numberOfDeposits,
  });

  let checked = 0;
  const mismatches = [];
  for (const p of plots || []) {
    const revealed = p.revealed || {};
    for (const [layerStr, val] of Object.entries(revealed)) {
      const z = Number(layerStr);
      const expected = grid?.[p.col]?.[p.row]?.[z] ?? 0;
      checked++;
      if (expected !== val) {
        mismatches.push({ col: p.col, row: p.row, z, expected, got: val });
      }
    }
  }
  return { ok: mismatches.length === 0, checked, mismatches: mismatches.slice(0, 25) };
}
