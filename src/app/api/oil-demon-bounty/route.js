import { NextResponse } from "next/server";
import { getAdminDb, FieldValue, Timestamp } from "@/lib/firebaseAdmin";

const MAX_BONUS_DRILLS = 10;
const BOUNTY_BONUS_DRILLS = 3;
const BOUNTY_USDC = 5; // deducted from community pool
const STUN_DURATION_MS = 2 * 60 * 1000; // 2 minutes
// A loose demon is a transient event — after this it's considered stale and any
// client may auto-expire it (so an unclaimed/orphaned bounty can't keep relighting
// hell forever on refresh).
const BOUNTY_TTL_MS = 5 * 60 * 1000; // 5 minutes

// POST — Create a demon bounty event (called when a player drills a hell pocket)
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

    // Check for existing active demon — only one at a time
    const activeSnap = await db.collection("demonBounty")
      .where("status", "in", ["active", "flying", "waiting"])
      .limit(1)
      .get();

    if (!activeSnap.empty) {
      return NextResponse.json({ error: "A demon is already loose" }, { status: 409 });
    }

    // Pick a random occupied plot (not the summoner's) as the demon's target
    const plotsSnap = await db.collection("oilPlots").get();
    const candidates = [];
    plotsSnap.forEach((d) => {
      const data = d.data();
      if (data.currentOwnerId && data.currentOwnerId !== userId) {
        candidates.push({ col: data.col, row: data.row, ownerId: data.currentOwnerId });
      }
    });

    // If no other occupied plots, demon stays at summoner's plot
    let targetCol = col;
    let targetRow = row;
    if (candidates.length > 0) {
      const pick = candidates[Math.floor(Math.random() * candidates.length)];
      targetCol = pick.col;
      targetRow = pick.row;
    }

    // Compute bounty: deduct up to $BOUNTY_USDC from the community pool
    const communityRef = db.collection("oilGame").doc("communityStorage");
    const communitySnap = await communityRef.get();
    const communityTotal = communitySnap.exists() ? (communitySnap.data().totalOil || 0) : 0;
    const poolBounty = Math.min(BOUNTY_USDC, communityTotal);
    const tankBounty = Math.max(0, Math.round(unbankedOil || 0));
    const bountyAmount = poolBounty + tankBounty;

    // Deduct the pool portion from community storage
    if (poolBounty > 0) {
      await communityRef.set({
        totalOil: FieldValue.increment(-poolBounty),
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
    }

    const now = Timestamp.now();
    const stunEndsAt = Timestamp.fromMillis(now.toMillis() + STUN_DURATION_MS);
    const expiresAt = Timestamp.fromMillis(now.toMillis() + BOUNTY_TTL_MS);

    // Create the bounty event
    const bountyRef = await db.collection("demonBounty").add({
      status: "active",
      summonerId: userId,
      summonerUsername: username || "Anonymous",
      summonerCol: col,
      summonerRow: row,
      targetCol,
      targetRow,
      bountyAmount,
      hunterId: null,
      hunterUsername: null,
      createdAt: FieldValue.serverTimestamp(),
      stunEndsAt,
      expiresAt,
    });

    // Set the global blockade
    await db.collection("oilGame").doc("demonBlockade").set({
      active: true,
      bountyId: bountyRef.id,
      summonerId: userId,
      summonerUsername: username || "Anonymous",
      bountyAmount,
      summonerCol: col,
      summonerRow: row,
      targetCol,
      targetRow,
      stunEndsAt,
      expiresAt,
      startedAt: FieldValue.serverTimestamp(),
    });

    // Drain summoner's unbanked oil (reset their tank)
    if (bountyAmount > 0) {
      const drillRef = db.collection("oilDrills").doc(userId);
      const drillSnap = await drillRef.get();
      if (drillSnap.exists) {
        const drill = drillSnap.data();
        await drillRef.set({
          lastDrainExtracted: drill.lastDrainExtracted || 0,
          updatedAt: FieldValue.serverTimestamp(),
        }, { merge: true });
      }
    }

    // Telegram alert to target plot owner (if they have a camera)
    if (candidates.length > 0) {
      try {
        const targetPlot = candidates.find(c => c.col === targetCol && c.row === targetRow);
        if (targetPlot?.ownerId) {
          const configSnap = await db.collection("pumpConfigs")
            .where("userId", "==", targetPlot.ownerId)
            .where("col", "==", targetCol)
            .where("row", "==", targetRow)
            .limit(1)
            .get();

          const hasCamera = !configSnap.empty && configSnap.docs[0].data()?.config?.showCamera;
          if (hasCamera) {
            const tgDoc = await db.collection("oilTelegram").doc(targetPlot.ownerId).get();
            if (tgDoc.exists) {
              const { chatId } = tgDoc.data();
              const botToken = process.env.TELEGRAM_BOT_TOKEN;
              if (botToken && chatId) {
                await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    chat_id: chatId,
                    text: `🔥 DEMON INCOMING — Plot (${targetCol + 1}, ${targetRow + 1})\n${username || "Someone"} unleashed hell!\nBounty: ${bountyAmount} USDC + ${BOUNTY_BONUS_DRILLS} bonus drills\nClick the demon to claim the bounty!`,
                  }),
                });
              }
            }
          }
        }
      } catch (tgErr) {
        console.error("[oil-demon-bounty] Telegram alert failed:", tgErr.message);
      }
    }

    return NextResponse.json({
      ok: true,
      bountyId: bountyRef.id,
      targetCol,
      targetRow,
      bountyAmount,
      stunEndsAt: stunEndsAt.toMillis(),
    });
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
