import { NextResponse } from "next/server";
import { createHmac, createHash } from "crypto";
import { getAdminDb } from "@/lib/firebaseAdmin";
import { authedUserId } from "@/lib/oilAuth";
import { computeCommitment } from "@/lib/oilFairness";
import { seedToInt, mintTicketCells, evaluateCells } from "@/lib/oilTicket";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ── POST /api/oil-ticket-verify ──  authed; a player checks their OWN tickets.
// The ticket seed is HMAC-SHA256(serverSecret, `${userId}:${day}`), and the
// ticket carries sha256(ticketSeed) from the moment it was minted. Two phases:
//
//   sealed   → the season secret is not revealed yet. We return each ticket's
//              fingerprint (seedHash) so the player can record it now; the
//              recipe below lets them check it themselves later. Nothing here
//              can leak the secret — it reads only the player's tickets.
//   revealed → the game has ended and oilGame/settings.seedReveal is published
//              (same gate as /api/oil-verify). For every ticket we re-derive
//              the seed from the REVEALED secret, confirm sha256(seed) matches
//              the fingerprint stamped at mint, regenerate the nine cells and
//              confirm they match what was scratched, and confirm the stored
//              result matches the cells. A mismatch anywhere → not fair.
//
// The recipe is returned in both phases so a player can do it without us:
//   seed  = HMAC_SHA256(secret, userId + ":" + YYYYMMDD)   (hex)
//   check = SHA256(seed) == the fingerprint on the ticket
//   cells = mintTicketCells(parseInt(seed.slice(0, 8), 16), { guaranteeWin })
//           — src/lib/oilTicket.js, open source, same code the server runs.

export async function POST(req) {
  try {
    const userId = await authedUserId(req);
    if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

    const db = getAdminDb();
    const [sSnap, tSnap] = await Promise.all([
      db.collection("oilGame").doc("settings").get(),
      db.collection("oilDrills").doc(userId).collection("tickets").get(), // one doc per day; sorted below — no index needed
    ]);
    const s = sSnap.exists ? sSnap.data() : {};
    const gameOver = s.gameEnded === true || s.gamePhase === "ended";
    const revealedSecret = (gameOver && s.seedReveal) ? s.seedReveal : null;
    const commitment = s.seedCommitment || null;
    const phase = revealedSecret ? "revealed" : commitment ? "sealed" : "uninitialized";

    const recipe = {
      seed: "HMAC_SHA256(secret, userId + ':' + YYYYMMDD) → hex",
      fingerprint: "SHA256(seed) must equal the ticket's fingerprint (stamped at mint)",
      cells: "mintTicketCells(parseInt(seed.slice(0, 8), 16), { guaranteeWin }) — src/lib/oilTicket.js",
      userId,
    };

    const tickets = tSnap.docs.map((d) => d.data()).filter((t) => t.day)
      .sort((a, b) => (a.day < b.day ? 1 : a.day > b.day ? -1 : 0)).slice(0, 60);
    if (!tickets.length) {
      return NextResponse.json({ ok: true, phase, commitment, tickets: [], recipe, summary: { checked: 0, ok: 0, mismatches: 0 } });
    }

    // The revealed secret must itself be the committed one, or nothing below means anything.
    const secretValid = revealedSecret ? computeCommitment(revealedSecret) === commitment : null;

    const out = tickets.map((t) => {
      const row = { day: t.day, status: t.status, seedHash: t.seedHash, win: t.win || null, tier: t.tier || null, guaranteeWin: !!t.guaranteeWin };
      if (!revealedSecret) return row;
      const seed = createHmac("sha256", revealedSecret).update(`${userId}:${t.day}`).digest("hex");
      const fingerprintOk = createHash("sha256").update(seed).digest("hex") === t.seedHash;
      const { cells } = mintTicketCells(seedToInt(seed), { guaranteeWin: !!t.guaranteeWin });
      const cellsOk = Array.isArray(t.cells) && cells.length === t.cells.length && cells.every((c, i) => c === t.cells[i]);
      const evaluated = evaluateCells(t.cells).sym || null;
      const resultOk = t.status !== "settled" || evaluated === (t.win || null);
      return { ...row, checks: { fingerprint: fingerprintOk, cells: cellsOk, result: resultOk }, ok: secretValid && fingerprintOk && cellsOk && resultOk };
    });

    const checked = revealedSecret ? out.length : 0;
    const okCount = out.filter((r) => r.ok).length;
    return NextResponse.json({
      ok: true, phase, commitment, secretValid, recipe, tickets: out,
      summary: { checked, ok: okCount, mismatches: checked - okCount },
      verdict: !revealedSecret ? "SEALED" : (secretValid && okCount === checked ? "VERIFIED" : "FAILED"),
    });
  } catch (e) {
    console.error("[oil-ticket-verify]", e);
    return NextResponse.json({ error: e.message || "verify failed" }, { status: 500 });
  }
}
