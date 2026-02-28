import { NextResponse } from "next/server";
import {
  db,
  doc,
  getDoc,
  setDoc,
  collection,
  getDocs,
  serverTimestamp,
} from "@/lib/firebaseServer";
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
    });
  } catch (err) {
    console.error("[oil-qualify GET]", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// ── POST /api/oil-qualify ──
// Admin-triggered snapshot: reads all registered players, checks balances, marks qualified
export async function POST(req) {
  try {
    if (!db) {
      return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
    }

    const { adminPassword } = await req.json();

    // Admin auth — same pattern as other oil admin routes
    const correctPassword = process.env.ADMIN_PASSWORD || process.env.NEXT_PUBLIC_ADMIN_PASSWORD;
    if (!correctPassword || adminPassword !== correctPassword) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get current RL80 price
    const price = await getRL80Price();

    // Read all registered players from oilQualified collection
    const snap = await getDocs(collection(db, "oilQualified"));
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

        if (qualified) qualifiedCount++;

        // Update player doc with snapshot results
        await setDoc(doc(db, "oilQualified", player.id), {
          qualified,
          lastSnapshotBalance: balanceNum.toString(),
          lastSnapshotUsdValue: Math.round(usdValue * 100) / 100,
          lastSnapshotAt: serverTimestamp(),
        }, { merge: true });

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
    await setDoc(doc(db, "oilGame", "lastSnapshot"), {
      price: price.rl80PriceUsd,
      ethPrice: price.ethPriceUsd,
      qualifiedCount,
      totalChecked: players.length,
      threshold: QUALIFICATION_THRESHOLD_USD,
      timestamp: serverTimestamp(),
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
