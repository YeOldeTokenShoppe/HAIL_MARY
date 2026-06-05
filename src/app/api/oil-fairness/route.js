import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { getAdminDb, FieldValue } from "@/lib/firebaseAdmin";
import { fetchBlockHash, fetchLatestBlockNumber } from "@/lib/fetchBlockHash";
import { FAIRNESS_SCHEME, computeCommitment, computeFinalSeed } from "@/lib/oilFairness";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Default lead in Base blocks (~2s each) between commit and the anchor block.
// The cryptographic property only needs the anchor block to not yet exist at
// commit time; the buffer just guarantees the block is available to anchor a
// short while later. Overridable via ?lead= for testing.
const DEFAULT_LEAD_BLOCKS = 30;

function checkAuth(pw) {
  const correct = process.env.ADMIN_PASSWORD;
  return !!correct && pw === correct;
}

// ── COMMIT ──────────────────────────────────────────────────────────────────
// Generate a fresh random secret, pick a future Base block, publish the
// commitment + anchor block. The raw secret stays server-only.
async function commit(db, { lead }) {
  const serverSecret = randomBytes(32).toString("hex");
  const commitment = computeCommitment(serverSecret);
  const latest = await fetchLatestBlockNumber();
  const anchorBlock = latest + (lead || DEFAULT_LEAD_BLOCKS);

  await db.collection("oilSecret").doc("seed").set({
    scheme: FAIRNESS_SCHEME,
    serverSecret,
    anchorBlock,
    anchorBlockHash: null,
    seed: null, // finalSeed — set at anchor time; strike-tick stays idle until then
    committedAt: FieldValue.serverTimestamp(),
  }, { merge: false });

  // Public commitment — players can record this before the game and verify later.
  await db.collection("oilGame").doc("settings").set({
    seedScheme: FAIRNESS_SCHEME,
    seedCommitment: commitment,
    anchorBlock,
    anchorBlockHash: FieldValue.delete(),
    seedReveal: FieldValue.delete(),
    blockHash: FieldValue.delete(),
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });

  return { ok: true, step: "commit", commitment, anchorBlock, committedAtBlock: latest };
}

// ── ANCHOR ──────────────────────────────────────────────────────────────────
// Once the anchor block is mined, fetch its hash and derive the final seed.
async function anchor(db) {
  const snap = await db.collection("oilSecret").doc("seed").get();
  if (!snap.exists) return { ok: false, error: "nothing committed — run commit first" };
  const { serverSecret, anchorBlock, seed: existing } = snap.data();
  if (!serverSecret || anchorBlock == null) {
    return { ok: false, error: "commit is incomplete (no serverSecret / anchorBlock)" };
  }
  if (existing) return { ok: false, error: "already anchored" };

  const latest = await fetchLatestBlockNumber();
  if (latest < anchorBlock) {
    return { ok: false, error: `anchor block ${anchorBlock} not mined yet (latest ${latest}); wait ~${(anchorBlock - latest) * 2}s` };
  }

  const { blockHash, timestamp } = await fetchBlockHash(anchorBlock);
  const finalSeed = computeFinalSeed(serverSecret, blockHash);

  await db.collection("oilSecret").doc("seed").set({
    anchorBlockHash: blockHash,
    anchorBlockTimestamp: timestamp,
    seed: finalSeed, // strike-tick reads this as the distribution seed
    anchoredAt: FieldValue.serverTimestamp(),
  }, { merge: true });

  // Publish the on-chain anchor hash. Anyone can confirm it equals Base block
  // `anchorBlock` independently; the operator could not have predicted it.
  await db.collection("oilGame").doc("settings").set({
    anchorBlockHash: blockHash,
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });

  return { ok: true, step: "anchor", anchorBlock, anchorBlockHash: blockHash };
}

// ── REVEAL ──────────────────────────────────────────────────────────────────
// Publish the server secret so anyone can recompute the whole field. (Also
// triggered automatically when oil-settings sets gameEnded:true.)
async function reveal(db) {
  const snap = await db.collection("oilSecret").doc("seed").get();
  if (!snap.exists) return { ok: false, error: "nothing to reveal" };
  const { serverSecret, anchorBlockHash, seed } = snap.data();
  if (!serverSecret) return { ok: false, error: "no serverSecret to reveal" };

  await db.collection("oilGame").doc("settings").set({
    seedReveal: serverSecret,        // recompute commitment + finalSeed from this
    finalSeedReveal: seed || null,   // convenience: the actual distribution seed
    revealedAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });

  return { ok: true, step: "reveal", revealedSecret: !!serverSecret, anchored: !!anchorBlockHash };
}

async function handle(req) {
  try {
    const url = new URL(req.url);
    const body = await req.json().catch(() => ({}));
    const pw = body.adminPassword || url.searchParams.get("password");
    if (!checkAuth(pw)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

    const action = body.action || url.searchParams.get("action");
    const db = getAdminDb();

    if (action === "commit") {
      const lead = parseInt(body.lead || url.searchParams.get("lead") || "", 10);
      return NextResponse.json(await commit(db, { lead: Number.isFinite(lead) && lead > 0 ? lead : 0 }));
    }
    if (action === "anchor") return NextResponse.json(await anchor(db));
    if (action === "reveal") return NextResponse.json(await reveal(db));
    return NextResponse.json({ error: "unknown action — use commit | anchor | reveal" }, { status: 400 });
  } catch (err) {
    console.error("[oil-fairness] Error:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req) { return handle(req); }
export async function GET(req) { return handle(req); }
