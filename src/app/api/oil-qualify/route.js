import { NextResponse } from "next/server";
import { getAdminDb, FieldValue } from "@/lib/firebaseAdmin";
import { getRL80Price, getRL80Balance } from "@/lib/oilPrice";
import { creditBonusDrills, holdingMilestonesPassed, MAX_BONUS_DRILLS, REFERRAL_BONUS } from "@/lib/oilBonus";

const QUALIFICATION_THRESHOLD_USD = 20;

// ── GET /api/oil-qualify?wallet=0x... ──
// Live check: reads balance + price, returns qualification status
export async function GET(req) {
  try {
    // Daily cron path: Vercel cron fires a GET with `Authorization: Bearer
    // $CRON_SECRET`. That runs the ONGOING snapshot (gated to active games inside
    // runSnapshot). The wallet live-check below is the initial/entry check and
    // stays open during registration.
    const auth = req.headers.get("authorization") || "";
    if (process.env.CRON_SECRET && auth === `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json(await runSnapshot());
    }

    const { searchParams } = new URL(req.url);
    const wallet = searchParams.get("wallet");
    if (!wallet || !wallet.startsWith("0x")) {
      return NextResponse.json({ error: "Missing or invalid wallet param" }, { status: 400 });
    }

    const [price, balance] = await Promise.all([
      getRL80Price(),
      getRL80Balance(wallet),
    ]);

    const balanceNum = Number(balance) / 1e18;
    const usdValue = balanceNum * price.rl80PriceUsd;
    const qualified = usdValue >= QUALIFICATION_THRESHOLD_USD;

    return NextResponse.json({
      qualified,
      balance: balanceNum.toString(),
      usdValue: Math.round(usdValue * 100) / 100,
      price: price.rl80PriceUsd,
      threshold: QUALIFICATION_THRESHOLD_USD,
      debug: {
        rawBalance: balance.toString(),
        rl80PerEth: price.rl80PerEth,
        ethPriceUsd: price.ethPriceUsd,
      },
    });
  } catch (err) {
    console.error("[oil-qualify GET]", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// ── POST /api/oil-qualify ──
// Admin-triggered snapshot: reads all registered players, checks balances, marks qualified
// When a player becomes disqualified, their oilPlots cell is released
export async function POST(req) {
  try {
    const { adminPassword } = await req.json().catch(() => ({}));

    // Admin auth — server-only secret. NEVER fall back to NEXT_PUBLIC_* (that
    // var is inlined into the client bundle, so accepting it would let any
    // visitor authorize this snapshot, which writes `qualified` for all players).
    const correctPassword = process.env.ADMIN_PASSWORD;
    if (!correctPassword || adminPassword !== correctPassword) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json(await runSnapshot());
  } catch (err) {
    console.error("[oil-qualify POST]", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// Shared snapshot runner — reads every registered player, recomputes count-based
// qualification, credits diamond-hands + deferred referrals, and releases plots
// for anyone who sold below their floor. Called by the admin POST and the daily
// cron (GET + CRON_SECRET bearer).
async function runSnapshot() {
    const db = getAdminDb();

    // Only run during an ACTIVE game. The INITIAL qualification check lives
    // elsewhere (oil-register + the oil-qualify GET live check) and runs during
    // registration — this snapshot is the ONGOING re-check (disqualify sellers,
    // credit diamond-hands + deferred referrals), which only matters once play
    // is live. No active game ⇒ no-op.
    const settings = (await db.collection("oilGame").doc("settings").get()).data() || {};
    if (settings.gamePhase !== "active") {
      return { ok: true, skipped: "not_active", phase: settings.gamePhase || null };
    }

    // Get current RL80 price
    const price = await getRL80Price();

    // Read all registered players from oilQualified collection
    const snap = await db.collection("oilQualified").get();
    const players = [];
    snap.forEach((d) => players.push({ id: d.id, ...d.data() }));

    let qualifiedCount = 0;
    const results = [];

    // Check each player's balance
    for (const player of players) {
      if (!player.walletAddress) continue;

      try {
        const balance = await getRL80Balance(player.walletAddress);
        const balanceNum = Number(balance) / 1e18;
        const usdValue = balanceNum * price.rl80PriceUsd;

        // Count-based qualification (price-independent): hold ≥ your entry count
        // floor. Disqualifies only on SELLING below entry, never on a price move.
        // Legacy/backfill: a player with no stored floor (registered before the
        // count rule) gets one derived once from the current price, fixed onward.
        let floor = player.qualifyTokenFloor;
        const backfillFloor = floor == null;
        if (backfillFloor) {
          floor = price.rl80PriceUsd > 0 ? QUALIFICATION_THRESHOLD_USD / price.rl80PriceUsd : Infinity;
        }
        const qualified = balanceNum >= floor;
        const wasQualified = player.qualified !== false; // treat undefined as qualified

        if (qualified) qualifiedCount++;

        // Update player doc with snapshot results
        await db.collection("oilQualified").doc(player.id).set({
          qualified,
          lastSnapshotBalance: balanceNum.toString(),
          lastSnapshotUsdValue: Math.round(usdValue * 100) / 100,
          lastSnapshotAt: FieldValue.serverTimestamp(),
          // Persist a backfilled floor once so it's fixed from here on.
          ...(backfillFloor && Number.isFinite(floor) ? { qualifyTokenFloor: floor } : {}),
        }, { merge: true });

        // Diamond-hands (long-term holding) depth lever. The streak starts on
        // first qualification (stored as ms) and credits the 30/60/90-day
        // milestones reached so far to the player's rig — distinct from the
        // per-season floor (rewards holding ACROSS seasons; see lib/oilBonus).
        if (qualified) {
          let sinceMs = player.qualifiedSince;
          if (sinceMs == null) {
            sinceMs = Date.now();
            await db.collection("oilQualified").doc(player.id).set({ qualifiedSince: sinceMs }, { merge: true });
          } else if (typeof sinceMs?.toMillis === "function") {
            sinceMs = sinceMs.toMillis();
          }
          const milestones = holdingMilestonesPassed(Date.now() - sinceMs);
          if (milestones > 0) {
            try {
              await creditBonusDrills(db, player.id, "holding", { targetTotal: milestones });
            } catch (e) {
              console.error(`[oil-qualify] holding bonus failed for ${player.id}:`, e.message);
            }
          }

          // Deferred referral credit (anti-sybil): pay the referrer only now that
          // the referred wallet is confirmed STILL qualified — a recycled $20
          // can't farm instant referral rewards. One credit per referral.
          if (player.referredByUserId && !player.referralCredited) {
            try {
              const rRef = db.collection("oilDrills").doc(player.referredByUserId);
              await db.runTransaction(async (t) => {
                const rSnap = await t.get(rRef);
                if (!rSnap.exists) return;
                const cur = rSnap.data().bonusDrills || 0;
                const add = Math.min(REFERRAL_BONUS, MAX_BONUS_DRILLS - cur);
                t.set(rRef, {
                  // Always count the confirmed referral; add depth only if under the cap.
                  confirmedReferrals: FieldValue.increment(1),
                  ...(add > 0 ? { bonusDrills: FieldValue.increment(add), rigDepleted: false, armed: true } : {}),
                  updatedAt: FieldValue.serverTimestamp(),
                }, { merge: true });
              });
              await db.collection("oilQualified").doc(player.id).set({ referralCredited: true }, { merge: true });
            } catch (e) {
              console.error(`[oil-qualify] deferred referral credit failed for ${player.id}:`, e.message);
            }
          }
        } else if (player.qualifiedSince != null) {
          // Dropped below the $20 floor → reset the holding streak (they keep any
          // bonus already earned; they must re-hold to climb again).
          await db.collection("oilQualified").doc(player.id).set(
            { qualifiedSince: FieldValue.delete() }, { merge: true },
          );
        }

        // If player just became disqualified, release their plot
        if (!qualified && wasQualified) {
          try {
            // Read their oilDrills doc for col/row
            const drillSnap = await db.collection("oilDrills").doc(player.id).get();
            if (drillSnap.exists) {
              const drillData = drillSnap.data();
              if (drillData.col != null && drillData.row != null) {
                const plotKey = `${drillData.col}_${drillData.row}`;
                // Release the plot
                await db.collection("oilPlots").doc(plotKey).set({
                  currentOwnerId: null,
                  disqualified: true,
                  ownerHistory: FieldValue.arrayUnion({
                    userId: player.id,
                    releasedAt: new Date().toISOString(),
                    reason: "disqualified",
                  }),
                }, { merge: true });
                // Clear col/row in oilDrills
                await db.collection("oilDrills").doc(player.id).set({
                  col: null,
                  row: null,
                  updatedAt: FieldValue.serverTimestamp(),
                }, { merge: true });
                // Clear in oilQualified
                await db.collection("oilQualified").doc(player.id).set({
                  plotCol: null,
                  plotRow: null,
                }, { merge: true });
              }
            }
          } catch (plotErr) {
            console.error(`[oil-qualify] Error releasing plot for ${player.id}:`, plotErr.message);
          }
        }

        results.push({
          userId: player.id,
          wallet: player.walletAddress,
          balance: balanceNum.toString(),
          usdValue: Math.round(usdValue * 100) / 100,
          qualified,
        });
      } catch (err) {
        console.error(`[oil-qualify] Error checking ${player.walletAddress}:`, err.message);
        results.push({ userId: player.id, error: err.message });
      }
    }

    // Save snapshot summary
    await db.collection("oilGame").doc("lastSnapshot").set({
      price: price.rl80PriceUsd,
      ethPrice: price.ethPriceUsd,
      qualifiedCount,
      totalChecked: players.length,
      threshold: QUALIFICATION_THRESHOLD_USD,
      timestamp: FieldValue.serverTimestamp(),
      results,
    });

    return {
      ok: true,
      price: price.rl80PriceUsd,
      qualifiedCount,
      totalChecked: players.length,
      timestamp: Date.now(),
    };
}
