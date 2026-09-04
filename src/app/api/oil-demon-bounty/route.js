import { NextResponse } from "next/server";
import { getAdminDb, FieldValue } from "@/lib/firebaseAdmin";
import { authedUserId } from "@/lib/oilAuth";
import { logTimeline } from "@/lib/oilTimeline";
import {
  createDemonBounty,
  MAX_BONUS_DRILLS,
  BOUNTY_BONUS_DRILLS,
  BOUNTY_TTL_MS,
} from "@/lib/oilDemon";

// POST — Create a demon bounty for the authenticated user. The real summon path
// is now the server strike-tick (createDemonBounty directly); this endpoint is
// kept session-gated and fully server-derived (plot + un-banked tank read from
// the user's own drill doc) so the bounty amount can never be inflated from the
// client.
export async function POST(req) {
  try {
    const userId = await authedUserId(req);
    if (!userId) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const db = getAdminDb();
    const drillSnap = await db.collection("oilDrills").doc(userId).get();
    if (!drillSnap.exists) {
      return NextResponse.json({ error: "No drill record" }, { status: 400 });
    }
    const drill = drillSnap.data();
    if (drill.col == null || drill.row == null) {
      return NextResponse.json({ error: "No claimed plot" }, { status: 400 });
    }

    const result = await createDemonBounty(db, {
      userId,
      username: drill.username || null,
      col: drill.col,
      row: drill.row,
      unbankedOil: Math.max(0, drill.tankOil || 0), // server-derived, never client
    });

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
    // Hunter identity is the verified session — never trusted from the body, so
    // nobody can claim a bounty as someone else.
    const hunterId = await authedUserId(req);
    if (!hunterId) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    // `arena: true` marks a banish won in the arena. The summoner may fight
    // their own demon there and, on winning, end the stun early: the bounty
    // still returns to the pool (a dismiss, not a claim) but the blockade
    // lifts now instead of at the end of the two minutes (2026-09-03).
    const { bountyId, hunterUsername, arena } = await req.json().catch(() => ({}));
    if (!bountyId) {
      return NextResponse.json({ error: "Missing bountyId" }, { status: 400 });
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
      if (isSummoner && bounty.stunEndsAt && !arena) {
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

    // FIELD ACTIVITY feed — demon contained (drilling resumes for everyone).
    await logTimeline(db, {
      type: "contain",
      username: typeof hunterUsername === "string" ? hunterUsername.slice(0, 60) : null,
      userId: hunterId,
      detail: result.dismissed ? "banished their own demon" : "drilling resumed",
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
