import { NextResponse } from "next/server";
import { getAdminDb, FieldValue } from "@/lib/firebaseAdmin";
import {
  createDemonBounty,
  MAX_BONUS_DRILLS,
  BOUNTY_BONUS_DRILLS,
  BOUNTY_TTL_MS,
} from "@/lib/oilDemon";

// POST — Create a demon bounty event (called when a player drills a hell pocket).
// The creation logic is shared with the server-side strike loop via createDemonBounty.
export async function POST(req) {
  try {
    const { userId, username, col, row, unbankedOil } = await req.json();

    if (!userId || typeof userId !== "string") {
      return NextResponse.json({ error: "Missing userId" }, { status: 400 });
    }
    if (col == null || row == null) {
      return NextResponse.json({ error: "Missing col/row" }, { status: 400 });
    }

    const db = getAdminDb();
    const result = await createDemonBounty(db, { userId, username, col, row, unbankedOil });

    if (!result.ok) {
      return NextResponse.json({ error: "A demon is already loose" }, { status: 409 });
    }
    return NextResponse.json(result);
  } catch (err) {
    console.error("[oil-demon-bounty] POST error:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// PATCH — Claim the bounty (player clicks the demon)
export async function PATCH(req) {
  try {
    const { bountyId, hunterId, hunterUsername } = await req.json();

    if (!bountyId || !hunterId) {
      return NextResponse.json({ error: "Missing bountyId or hunterId" }, { status: 400 });
    }

    const db = getAdminDb();
    const bountyRef = db.collection("demonBounty").doc(bountyId);

    const result = await db.runTransaction(async (t) => {
      const snap = await t.get(bountyRef);
      if (!snap.exists) throw new Error("Bounty not found");

      const bounty = snap.data();
      // The capture challenge now lives client-side (timed banish), so the
      // bounty stays "active" for its whole life and is claimable throughout.
      if (!["active", "flying", "waiting"].includes(bounty.status)) {
        throw new Error("Bounty is not claimable (status: " + bounty.status + ")");
      }

      // Check stun: if hunter is the summoner, stun must have expired
      const isSummoner = hunterId === bounty.summonerId;
      if (isSummoner && bounty.stunEndsAt) {
        const stunEnd = bounty.stunEndsAt.toMillis();
        if (Date.now() < stunEnd) {
          throw new Error("You are still incapacitated");
        }
      }

      // Mark bounty as dismissed (summoner) or claimed (hunter)
      t.update(bountyRef, {
        status: isSummoner ? "dismissed" : "claimed",
        hunterId: isSummoner ? null : hunterId,
        hunterUsername: isSummoner ? null : (hunterUsername || "Anonymous"),
        claimedAt: FieldValue.serverTimestamp(),
      });

      if (isSummoner) {
        // Summoner dismisses — bounty returns to community pool, no reward
        if (bounty.bountyAmount > 0) {
          const communityRef = db.collection("oilGame").doc("communityStorage");
          t.set(communityRef, {
            totalOil: FieldValue.increment(bounty.bountyAmount),
            updatedAt: FieldValue.serverTimestamp(),
          }, { merge: true });
        }
      } else {
        // Hunter claims — credit bounty USDC + bonus drills
        const hunterDrillRef = db.collection("oilDrills").doc(hunterId);
        const hunterSnap = await t.get(hunterDrillRef);
        if (hunterSnap.exists) {
          const hunterData = hunterSnap.data();
          const currentBonus = hunterData.bonusDrills || 0;
          const bonusToAdd = Math.min(BOUNTY_BONUS_DRILLS, MAX_BONUS_DRILLS - currentBonus);
          const update = { updatedAt: FieldValue.serverTimestamp() };
          if (bonusToAdd > 0) update.bonusDrills = FieldValue.increment(bonusToAdd);
          if (bounty.bountyAmount > 0) {
            update.totalCollected = FieldValue.increment(bounty.bountyAmount);
          }
          t.set(hunterDrillRef, update, { merge: true });
        }
      }

      // Clear the blockade
      const blockadeRef = db.collection("oilGame").doc("demonBlockade");
      t.set(blockadeRef, {
        active: false,
        clearedAt: FieldValue.serverTimestamp(),
      }, { merge: true });

      return {
        bountyAmount: isSummoner ? 0 : bounty.bountyAmount,
        bonusDrills: isSummoner ? 0 : BOUNTY_BONUS_DRILLS,
        dismissed: isSummoner,
      };
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("[oil-demon-bounty] PATCH error:", err.message);
    const status = err.message.includes("not claimable") || err.message.includes("incapacitated") ? 409 : 500;
    return NextResponse.json({ error: err.message }, { status });
  }
}

// DELETE — Force-clear / expire a demon bounty (admin or auto-expiry)
export async function DELETE(req) {
  try {
    const { bountyId, password } = await req.json();

    const db = getAdminDb();

    // Allow admin force-clear or auto-expiry (no password needed for expired bounties)
    if (bountyId) {
      const bountyRef = db.collection("demonBounty").doc(bountyId);
      const snap = await bountyRef.get();

      if (!snap.exists) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }

      const bounty = snap.data();

      // Admin override
      const isAdmin = password && password === process.env.ADMIN_PASSWORD;
      // Auto-expiry: expired by explicit expiresAt, OR simply older than the TTL
      // (covers legacy/orphaned docs created before expiresAt existed).
      const expMs = bounty.expiresAt?.toMillis?.();
      const createdMs = bounty.createdAt?.toMillis?.();
      const isExpired =
        (expMs && Date.now() > expMs) ||
        (createdMs && Date.now() - createdMs > BOUNTY_TTL_MS);

      if (!isAdmin && !isExpired) {
        return NextResponse.json({ error: "Unauthorized — bounty not expired" }, { status: 401 });
      }

      await bountyRef.update({
        status: "expired",
        expiredAt: FieldValue.serverTimestamp(),
      });

      // Return the bounty to the community pool (unclaimed)
      if (bounty.bountyAmount > 0) {
        const communityRef = db.collection("oilGame").doc("communityStorage");
        await communityRef.set({
          totalOil: FieldValue.increment(bounty.bountyAmount),
          updatedAt: FieldValue.serverTimestamp(),
        }, { merge: true });
      }

      // Clear the blockade
      await db.collection("oilGame").doc("demonBlockade").set({
        active: false,
        clearedAt: FieldValue.serverTimestamp(),
      }, { merge: true });

      return NextResponse.json({ ok: true, expired: true });
    }

    return NextResponse.json({ error: "Missing bountyId" }, { status: 400 });
  } catch (err) {
    console.error("[oil-demon-bounty] DELETE error:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
