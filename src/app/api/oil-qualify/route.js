import { NextResponse } from "next/server";
import { getAdminDb, FieldValue } from "@/lib/firebaseAdmin";
import { getRL80Price, getRL80Balance } from "@/lib/oilPrice";

const QUALIFICATION_THRESHOLD_USD = 20;

// ── GET /api/oil-qualify?wallet=0x... ──
// Live check: reads balance + price, returns qualification status
export async function GET(req) {
  try {
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
    const { adminPassword } = await req.json();

    // Admin auth — server-only secret. NEVER fall back to NEXT_PUBLIC_* (that
    // var is inlined into the client bundle, so accepting it would let any
    // visitor authorize this snapshot, which writes `qualified` for all players).
    const correctPassword = process.env.ADMIN_PASSWORD;
    if (!correctPassword || adminPassword !== correctPassword) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const db = getAdminDb();

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
        const qualified = usdValue >= QUALIFICATION_THRESHOLD_USD;
        const wasQualified = player.qualified !== false; // treat undefined as qualified

        if (qualified) qualifiedCount++;

        // Update player doc with snapshot results
        await db.collection("oilQualified").doc(player.id).set({
          qualified,
          lastSnapshotBalance: balanceNum.toString(),
          lastSnapshotUsdValue: Math.round(usdValue * 100) / 100,
          lastSnapshotAt: FieldValue.serverTimestamp(),
        }, { merge: true });

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

    return NextResponse.json({
      ok: true,
      price: price.rl80PriceUsd,
      qualifiedCount,
      totalChecked: players.length,
      timestamp: Date.now(),
    });
  } catch (err) {
    console.error("[oil-qualify POST]", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
