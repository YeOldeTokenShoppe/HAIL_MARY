import { FieldValue, Timestamp } from "@/lib/firebaseAdmin";

// Shared demon-bounty constants + creation logic. Used by both the player-facing
// POST /api/oil-demon-bounty and the server-side strike loop (oil-strike-tick),
// so a hell-pocket hit summons the demon identically however it was triggered.

export const MAX_BONUS_DRILLS = 10;
export const BOUNTY_BONUS_DRILLS = 3;
export const BOUNTY_USDC = 5; // deducted from the community pool
export const STUN_DURATION_MS = 2 * 60 * 1000; // 2 minutes
// A loose demon is transient — after this it's considered stale and any client
// may auto-expire it (so an orphaned bounty can't keep relighting hell forever).
export const BOUNTY_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Create a demon bounty (the hell-pocket event). `db` is an admin Firestore
 * instance from getAdminDb(). Returns:
 *   { ok: true, bountyId, targetCol, targetRow, bountyAmount, stunEndsAt }
 *   { ok: false, skipped: "demon_already_loose" }   — single-demon guard
 *
 * NOTE (admin SDK): DocumentSnapshot.exists is a PROPERTY, not a method.
 */
export async function createDemonBounty(db, { userId, username, col, row, unbankedOil }) {
  // Only one demon at a time.
  const activeSnap = await db.collection("demonBounty")
    .where("status", "in", ["active", "flying", "waiting"])
    .limit(1)
    .get();
  if (!activeSnap.empty) {
    return { ok: false, skipped: "demon_already_loose" };
  }

  // Pick a random occupied plot (not the summoner's) as the demon's target.
  const plotsSnap = await db.collection("oilPlots").get();
  const candidates = [];
  plotsSnap.forEach((d) => {
    const data = d.data();
    if (data.currentOwnerId && data.currentOwnerId !== userId) {
      candidates.push({ col: data.col, row: data.row, ownerId: data.currentOwnerId });
    }
  });

  let targetCol = col;
  let targetRow = row;
  if (candidates.length > 0) {
    const pick = candidates[Math.floor(Math.random() * candidates.length)];
    targetCol = pick.col;
    targetRow = pick.row;
  }

  // Bounty = up to BOUNTY_USDC from the community pool + the summoner's unbanked tank.
  const communityRef = db.collection("oilGame").doc("communityStorage");
  const communitySnap = await communityRef.get();
  const communityTotal = communitySnap.exists ? (communitySnap.data().totalOil || 0) : 0;
  const poolBounty = Math.min(BOUNTY_USDC, communityTotal);
  const tankBounty = Math.max(0, Math.round(unbankedOil || 0));
  const bountyAmount = poolBounty + tankBounty;

  if (poolBounty > 0) {
    await communityRef.set({
      totalOil: FieldValue.increment(-poolBounty),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
  }

  const now = Timestamp.now();
  const stunEndsAt = Timestamp.fromMillis(now.toMillis() + STUN_DURATION_MS);
  const expiresAt = Timestamp.fromMillis(now.toMillis() + BOUNTY_TTL_MS);

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

  // Set the global single-demon blockade (halts drilling while loose).
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

  // Drain the summoner's unbanked tank — the cost of unleashing hell. (Previously
  // a no-op that only re-wrote lastDrainExtracted; now correctly zeroes tankOil.)
  if (tankBounty > 0) {
    await db.collection("oilDrills").doc(userId).set({
      tankOil: 0,
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
  }

  // Telegram alert to the target plot owner if their plot has a camera.
  if (candidates.length > 0) {
    try {
      const targetPlot = candidates.find((c) => c.col === targetCol && c.row === targetRow);
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
      console.error("[oilDemon] Telegram alert failed:", tgErr.message);
    }
  }

  return {
    ok: true,
    bountyId: bountyRef.id,
    targetCol,
    targetRow,
    bountyAmount,
    stunEndsAt: stunEndsAt.toMillis(),
  };
}
