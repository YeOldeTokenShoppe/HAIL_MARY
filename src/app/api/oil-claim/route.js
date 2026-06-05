import { NextResponse } from "next/server";
import { getAdminDb, FieldValue } from "@/lib/firebaseAdmin";
import { authedUserId } from "@/lib/oilAuth";

export const runtime = "nodejs";

const MAX_BONUS_DRILLS = 10;
const REFERRAL_BONUS = 3;
const GRID_MAX = 50;

// Initial plot claim during registration. Authenticated; the plot must be
// unclaimed (re-checked in the txn); sets up the user's drill doc with clean
// counters; credits the referrer (capped at MAX_BONUS_DRILLS, no self-referral).
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

    // Derive this user's own referral code (wallet-based if we have it, else id).
    const wallet = qualSnap.data().walletAddress || "";
    const refCode = wallet ? wallet.replace(/^0x/i, "").slice(0, 8).toLowerCase() : userId.slice(0, 8);

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
        ...(fresh ? { referredBy: referredByCode || null } : {}),
      }, { merge: true });

      return fresh;
    });

    // Referral credit — only for genuinely new players. Best-effort, capped, no self-referral.
    if (isNew && referredByCode) {
      try {
        const refSnap = await db.collection("oilReferrals").doc(referredByCode).get();
        const referrerId = refSnap.exists ? refSnap.data().userId : null;
        if (referrerId && referrerId !== userId) {
          const rRef = db.collection("oilDrills").doc(referrerId);
          const rSnap = await rRef.get();
          if (rSnap.exists) {
            const cur = rSnap.data().bonusDrills || 0;
            const add = Math.min(REFERRAL_BONUS, MAX_BONUS_DRILLS - cur);
            if (add > 0) {
              await rRef.set({
                bonusDrills: FieldValue.increment(add),
                confirmedReferrals: FieldValue.increment(1),
                updatedAt: FieldValue.serverTimestamp(),
              }, { merge: true });
            }
          }
        }
      } catch (e) {
        console.error("[oil-claim] referral credit failed:", e.message);
      }
    }

    return NextResponse.json({ ok: true, col, row, refCode });
  } catch (err) {
    console.error("[oil-claim] Error:", err.message);
    const status = /already claimed/.test(err.message) ? 409 : 500;
    return NextResponse.json({ error: err.message }, { status });
  }
}
