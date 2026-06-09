import { NextResponse } from "next/server";
import { createHash } from "crypto";
import { getAdminDb, FieldValue } from "@/lib/firebaseAdmin";

// Whitelist of fields the admin UI is allowed to set on oilGame/settings.
// ticketCount / currentPickOrder / pickDeadline are legacy draft fields (the
// ticket/draft system was removed) — not in the whitelist, so they stay
// unwritable from here.
//
// NOTE: `blockHash` (the distribution seed) is deliberately NOT public-writable.
// It is the secret that decides where the oil is; publishing it would let any
// player compute the entire field. It is handled specially below: the raw seed
// goes to the server-only `oilSecret/seed` doc, and only a SHA-256 commitment
// is published. The seed is revealed (published) at game end for verification.
const ALLOWED_FIELDS = new Set([
  "numberOfDeposits",
  "numberOfHellPockets",
  "totalOilBudget",
  "gridSize",
  "gamePhase",
  "gameEnded",
  "gameStartDate",
  "seasonLengthDays",
  "testingEnabled",
]);

const sha256Hex = (s) => createHash("sha256").update(String(s)).digest("hex");

function checkAuth(adminPassword) {
  const correct = process.env.ADMIN_PASSWORD;
  return !!correct && adminPassword === correct;
}

export async function POST(req) {
  try {
    const { adminPassword, settings } = await req.json();
    if (!checkAuth(adminPassword)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!settings || typeof settings !== "object") {
      return NextResponse.json({ error: "Missing settings object" }, { status: 400 });
    }

    const db = getAdminDb();
    const written = [];

    // ── Seed (commit-reveal) ────────────────────────────────────────────────
    // The raw seed is stored server-only; the public doc gets the commitment.
    if (settings.blockHash) {
      const seed = String(settings.blockHash);
      await db.collection("oilSecret").doc("seed").set(
        { seed, updatedAt: FieldValue.serverTimestamp() },
        { merge: true },
      );
      await db.collection("oilGame").doc("settings").set(
        {
          seedCommitment: sha256Hex(seed),
          // Purge any legacy public seed — it must never be client-readable.
          blockHash: FieldValue.delete(),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
      written.push("seedCommitment");
    }

    // ── Public, whitelisted settings ────────────────────────────────────────
    const filtered = {};
    for (const [key, value] of Object.entries(settings)) {
      if (ALLOWED_FIELDS.has(key)) filtered[key] = value;
    }
    if (Object.keys(filtered).length > 0) {
      await db.collection("oilGame").doc("settings").set(
        { ...filtered, updatedAt: FieldValue.serverTimestamp() },
        { merge: true },
      );
      written.push(...Object.keys(filtered));
    }

    // ── Reveal at game end ──────────────────────────────────────────────────
    // Publishing the secret once the game is over lets anyone re-run the
    // distribution and check it against the committed hash (provable fairness).
    // Future-block scheme: reveal the `serverSecret` (verifiers recompute the
    // commitment + finalSeed from it). Legacy scheme: reveal the raw seed.
    if (filtered.gameEnded === true) {
      const secretSnap = await db.collection("oilSecret").doc("seed").get();
      const sd = secretSnap.exists ? secretSnap.data() : null;
      if (sd?.serverSecret) {
        await db.collection("oilGame").doc("settings").set(
          {
            seedReveal: sd.serverSecret,
            finalSeedReveal: sd.seed || null,
            revealedAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true },
        );
        written.push("seedReveal");
      } else if (sd?.seed) {
        // Legacy admin-typed seed (no future-block anchor).
        await db.collection("oilGame").doc("settings").set(
          { seedReveal: sd.seed, updatedAt: FieldValue.serverTimestamp() },
          { merge: true },
        );
        written.push("seedReveal");
      }
    }

    if (written.length === 0) {
      return NextResponse.json({ error: "No valid settings fields provided" }, { status: 400 });
    }
    return NextResponse.json({ ok: true, written });
  } catch (err) {
    console.error("[oil-settings] Error:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// Admin-only: fetch the raw seed (so the admin inspector can compute the full
// field during a live game). Players never have access to this — the seed is
// only public after game end via `seedReveal`.
export async function GET(req) {
  try {
    const pw = new URL(req.url).searchParams.get("adminPassword");
    if (!checkAuth(pw)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const db = getAdminDb();
    const snap = await db.collection("oilSecret").doc("seed").get();
    return NextResponse.json({ ok: true, seed: snap.exists ? snap.data().seed : null });
  } catch (err) {
    console.error("[oil-settings] GET Error:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
