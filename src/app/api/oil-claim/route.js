import { NextResponse } from "next/server";
import { getAdminDb, FieldValue } from "@/lib/firebaseAdmin";
import { authedUserId } from "@/lib/oilAuth";
import { logTimeline } from "@/lib/oilTimeline";

export const runtime = "nodejs";

const GRID_MAX = 50;

// Initial plot claim during registration. Authenticated; the plot must be
// unclaimed (re-checked in the txn); sets up the user's drill doc with clean
// counters; records a pending referral (credited later, at the next
// qualification snapshot — anti-sybil; see oil-qualify).
export async function POST(req) {
  try {
    const userId = await authedUserId(req);
    if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

    const { col, row, username, referredByCode } = await req.json().catch(() => ({}));
    if (!Number.isInteger(col) || !Number.isInteger(row) ||
        col < 0 || row < 0 || col > GRID_MAX || row > GRID_MAX) {
      return NextResponse.json({ error: "Invalid cell" }, { status: 400 });
    }

    const db = getAdminDb();
    const key = `${col}_${row}`;
    const plotRef = db.collection("oilPlots").doc(key);
    const drillRef = db.collection("oilDrills").doc(userId);
    const qualRef = db.collection("oilQualified").doc(userId);

    const settings = (await db.collection("oilGame").doc("settings").get()).data() || {};

    // Qualification gate — server-authoritative. `qualified` is written only by
    // /api/oil-register (on-chain balance re-check) and the admin snapshot;
    // oilQualified is write:false, so the client cannot forge it. No plot
    // without a verified $20-RL80 stake.
    const qualSnap = await qualRef.get();
    if (!qualSnap.exists || qualSnap.data().qualified !== true) {
      return NextResponse.json(
        { error: "Not qualified — register with a wallet holding at least $20 of RL80 first." },
        { status: 403 }
      );
    }

    const isTester = qualSnap.data().isTester === true;
    if (isTester) {
      // Testers are a TESTING construct — they may claim any time testing is on
      // (including the active phase, so you can exercise the live loop). Testing
      // must be OFF for any live game, so this never weakens real-game fairness.
      if (settings.testingEnabled !== true) {
        return NextResponse.json({ error: "Testing is currently disabled." }, { status: 403 });
      }
    } else {
      // Fairness gate for real players — plots can ONLY be claimed before the map
      // is knowable: during registration and before the future-block seed is
      // anchored. Once anchored (or the game is active/ended), the operator could
      // compute the map and tip insiders toward rich plots, so claiming closes.
      // This is the timing defense that commit-reveal alone doesn't provide.
      // See docs/oil-game.md → "Insider-tipping defense".
      const claimsOpen = settings.gamePhase === "ticket_sale" && !settings.anchorBlockHash;
      if (!claimsOpen) {
        return NextResponse.json(
          { error: "Claims are closed — plots are chosen during registration, before the map is locked in." },
          { status: 403 }
        );
      }
    }

    // Derive this user's own referral code (wallet-based if we have it, else id).
    const wallet = qualSnap.data().walletAddress || "";
    const refCode = wallet ? wallet.replace(/^0x/i, "").slice(0, 8).toLowerCase() : userId.slice(0, 8);

    // Resolve the referrer up front (real code, not self). The credit is NOT
    // applied here — it's deferred to the next qualification snapshot, so the
    // referred wallet must still hold ≥ $20 then. This kills the buy-$20 →
    // refer → sell → recycle farm that an instant credit would reward.
    let referrerId = null;
    if (referredByCode) {
      const refSnap = await db.collection("oilReferrals").doc(referredByCode).get();
      const rid = refSnap.exists ? refSnap.data().userId : null;
      if (rid && rid !== userId) referrerId = rid;
    }

    const isNew = await db.runTransaction(async (t) => {
      const plotSnap = await t.get(plotRef);
      if (plotSnap.exists && plotSnap.data().currentOwnerId != null) {
        throw new Error("Plot already claimed");
      }
      const drillSnap = await t.get(drillRef);
      const fresh = !drillSnap.exists;
      const nowIso = new Date().toISOString();

      t.set(plotRef, {
        col, row,
        drillDay: plotSnap.exists ? (plotSnap.data().drillDay ?? 0) : 0, // inherit prior depth
        currentOwnerId: userId,
        ownerHistory: FieldValue.arrayUnion({ userId, claimedAt: nowIso }),
        disqualified: false,
      }, { merge: true });

      if (fresh) {
        // Brand-new player — clean slate.
        t.set(drillRef, {
          userId, col, row,
          drillDay: 0, lastDrillDate: null, claimJumpsUsed: 0,
          totalCollected: 0, tankDrains: 0, lastDrainExtracted: 0,
          bonusDrills: 0, confirmedReferrals: 0, referralCode: refCode,
          username: typeof username === "string" ? username.trim().slice(0, 60) : "",
          armed: true, rigDepleted: false,
          updatedAt: FieldValue.serverTimestamp(),
        }, { merge: true });
        t.set(db.collection("oilReferrals").doc(refCode), {
          userId, code: refCode, createdAt: FieldValue.serverTimestamp(),
        }, { merge: true });
      } else {
        // Returning player (released then re-claimed, or mid-season) — take the
        // plot and re-arm, but PRESERVE banked score + counters.
        t.set(drillRef, {
          col, row, armed: true, rigDepleted: false,
          ...(typeof username === "string" && username.trim() ? { username: username.trim().slice(0, 60) } : {}),
          updatedAt: FieldValue.serverTimestamp(),
        }, { merge: true });
      }

      t.set(qualRef, {
        plotCol: col, plotRow: row, pickedAt: FieldValue.serverTimestamp(),
        // Record the pending referral on fresh players; the snapshot credits the
        // referrer once this wallet is confirmed still-qualified.
        ...(fresh ? {
          referredBy: referredByCode || null,
          ...(referrerId ? { referredByUserId: referrerId, referralCredited: false } : {}),
        } : {}),
      }, { merge: true });

      return fresh;
    });

    // Public audit log (best-effort, server-only). For first-plot claims `anchored`
    // is normally false (claims are registration/pre-anchor for real players), but
    // we log it regardless so the record is complete. See oilClaimLog / docs.
    try {
      await db.collection("oilClaimLog").add({
        type: "claim", userId, username: typeof username === "string" ? username.trim().slice(0, 60) : null,
        col, row,
        phase: settings.gamePhase || null,
        anchored: !!settings.anchorBlockHash,
        isTester,
        createdAt: FieldValue.serverTimestamp(),
      });
    } catch (e) {
      console.error("[oil-claim] audit log failed:", e.message);
    }

    // FIELD ACTIVITY feed — only announce brand-new players claiming (not silent
    // re-claims), keeps the feed meaningful. No coords.
    if (isNew) {
      await logTimeline(db, { type: "claim", username: typeof username === "string" ? username.trim().slice(0, 60) || null : null, userId });
    }

    return NextResponse.json({ ok: true, col, row, refCode });
  } catch (err) {
    console.error("[oil-claim] Error:", err.message);
    const status = /already claimed/.test(err.message) ? 409 : 500;
    return NextResponse.json({ error: err.message }, { status });
  }
}
