import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebaseAdmin";
import { fetchBlockHash } from "@/lib/fetchBlockHash";
import { computeCommitment, computeFinalSeed, verifyRevealedField } from "@/lib/oilFairness";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ── GET /api/oil-verify ──  PUBLIC, no auth.
// Independently re-derives and checks the provable-fairness chain from data
// that is public at each phase. It reads ONLY oilGame/settings + oilPlots —
// never the server-only secret — so it can never leak the seed early.
//
//   committed  → commitment + anchor block are published
//   anchored   → the on-chain anchor hash is published; we re-fetch it from
//                Base and confirm it matches (operator couldn't predict it)
//   revealed   → the secret is published; we recompute the commitment, the
//                final seed, and the ENTIRE field, and check every played cell
export async function GET() {
  try {
    const db = getAdminDb();
    const sSnap = await db.collection("oilGame").doc("settings").get();
    const s = sSnap.exists ? sSnap.data() : {};

    const scheme = s.seedScheme || null;
    const commitment = s.seedCommitment || null;
    const anchorBlock = s.anchorBlock ?? null;
    const publishedAnchorHash = s.anchorBlockHash || null;
    // The secret is only "revealed" once the game has actually ended. A leftover
    // seedReveal on an active game (e.g. a prior test cycle that wasn't cleared)
    // must NOT expose the field — that would leak the live map to players.
    const gameOver = s.gameEnded === true || s.gamePhase === "ended";
    const revealedSecret = (gameOver && s.seedReveal) ? s.seedReveal : null;

    const phase = revealedSecret ? "revealed" : publishedAnchorHash ? "anchored" : commitment ? "committed" : "uninitialized";

    const checks = {};

    // 1. Anchor — re-fetch the block hash from Base and compare to what was
    //    published. This proves the seed is bound to an unpredictable value.
    if (publishedAnchorHash && anchorBlock != null) {
      try {
        const onChain = await fetchBlockHash(anchorBlock);
        checks.anchor = {
          block: anchorBlock,
          publishedHash: publishedAnchorHash,
          onChainHash: onChain.blockHash,
          matches: onChain.blockHash?.toLowerCase() === publishedAnchorHash.toLowerCase(),
        };
      } catch (e) {
        checks.anchor = { block: anchorBlock, publishedHash: publishedAnchorHash, error: e.message };
      }
    }

    // 2. Commitment — once revealed, SHA256(secret) must equal the commitment
    //    that was published before play.
    if (revealedSecret && commitment) {
      checks.commitment = {
        recomputed: computeCommitment(revealedSecret),
        published: commitment,
        matches: computeCommitment(revealedSecret) === commitment,
      };
    }

    // 3. Final seed + field — recompute the distribution and compare against
    //    every cell that was actually revealed during play. Future-block scheme
    //    derives finalSeed = SHA256(secret : blockHash); the legacy admin-typed
    //    scheme used the revealed value directly as the distribution seed.
    if (revealedSecret) {
      const finalSeed = publishedAnchorHash
        ? computeFinalSeed(revealedSecret, publishedAnchorHash)
        : revealedSecret;
      checks.finalSeed = {
        value: finalSeed,
        scheme: publishedAnchorHash ? "future-block" : "legacy-direct",
        matchesPublished: s.finalSeedReveal ? s.finalSeedReveal === finalSeed : null,
      };

      const plotsSnap = await db.collection("oilPlots").get();
      const plots = [];
      plotsSnap.forEach((d) => {
        const p = d.data();
        if (p.revealed && p.col != null && p.row != null) {
          plots.push({ col: p.col, row: p.row, revealed: p.revealed });
        }
      });
      const field = verifyRevealedField({
        finalSeed,
        gridSize: s.gridSize || 10,
        depthZ: s.depthZ || 20,
        numberOfDeposits: s.numberOfDeposits || 5,
        plots,
      });
      checks.field = field;
    }

    // Overall verdict.
    let verdict = "PENDING";
    if (phase === "revealed") {
      const allPass =
        checks.commitment?.matches === true &&
        (checks.anchor ? checks.anchor.matches === true : true) &&
        checks.field?.ok === true;
      verdict = allPass ? "VERIFIED" : "FAILED";
    } else if (phase === "anchored" && checks.anchor) {
      verdict = checks.anchor.matches === true ? "ANCHOR_OK" : "FAILED";
    }

    return NextResponse.json({
      scheme,
      phase,
      verdict,
      commitment,
      anchorBlock,
      anchorBlockHash: publishedAnchorHash,
      checks,
      explainer:
        "Fairness chain: commit SHA256(secret) + a future Base block number → anchor on the block's hash → reveal the secret. " +
        "Anyone can recompute the field from the revealed secret + on-chain block hash and confirm it matches what was played.",
    });
  } catch (err) {
    console.error("[oil-verify] Error:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
