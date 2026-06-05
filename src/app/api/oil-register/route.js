import { NextResponse } from "next/server";
import { getAdminDb, FieldValue } from "@/lib/firebaseAdmin";
import { authedUserId } from "@/lib/oilAuth";
import { getRL80Price, getRL80Balance } from "@/lib/oilPrice";

export const runtime = "nodejs";

const QUALIFICATION_THRESHOLD_USD = 20;

// ── POST /api/oil-register ──
// Server-authoritative qualification. The client may NOT decide whether it
// qualifies: we re-read the on-chain RL80 balance for the supplied wallet and
// compute `qualified` here. This route + the admin snapshot are the ONLY
// writers of `qualified` (oilQualified is write:false in firestore.rules).
// Prize money rides on this — never trust a client-supplied qualified flag.
export async function POST(req) {
  try {
    const userId = await authedUserId(req);
    if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const walletAddress = typeof body.walletAddress === "string" ? body.walletAddress.trim() : "";
    if (!walletAddress.startsWith("0x") || walletAddress.length !== 42) {
      return NextResponse.json({ error: "Missing or invalid wallet" }, { status: 400 });
    }
    const xUsername = (typeof body.xUsername === "string" ? body.xUsername : "")
      .trim().replace(/^@/, "").toLowerCase().slice(0, 40);
    const clerkName = (typeof body.clerkName === "string" ? body.clerkName : "Anonymous").slice(0, 80);
    const clerkAvatar = typeof body.clerkAvatar === "string" ? body.clerkAvatar.slice(0, 500) : null;

    const db = getAdminDb();

    // X-username uniqueness — server-checked (was a client-only guard before).
    if (xUsername) {
      const dupe = await db.collection("oilQualified").where("xUsername", "==", xUsername).get();
      const takenByOther = dupe.docs.some((d) => d.id !== userId);
      if (takenByOther) {
        return NextResponse.json({ error: "This X username is already registered." }, { status: 409 });
      }
    }

    // Re-check the balance on-chain. This is the gate the client cannot forge.
    const [price, balance] = await Promise.all([
      getRL80Price(),
      getRL80Balance(walletAddress),
    ]);
    const balanceNum = Number(balance) / 1e18;
    const usdValue = balanceNum * price.rl80PriceUsd;
    const qualified = usdValue >= QUALIFICATION_THRESHOLD_USD;

    // Deterministic referral code = first 8 hex chars of the wallet. Same
    // derivation as /api/oil-claim and the OilQualify page. Stored on the
    // player doc so the referral link is shareable from registration onward.
    const refCode = walletAddress.replace(/^0x/i, "").slice(0, 8).toLowerCase();

    // Preserve any existing plot pick / counters; only (re)write identity +
    // the server-computed qualification snapshot.
    await db.collection("oilQualified").doc(userId).set({
      userId,
      clerkName,
      clerkAvatar,
      walletAddress,
      xUsername,
      referralCode: refCode,
      registeredAt: FieldValue.serverTimestamp(),
      qualified,
      lastSnapshotBalance: balanceNum.toString(),
      lastSnapshotUsdValue: Math.round(usdValue * 100) / 100,
      lastSnapshotAt: FieldValue.serverTimestamp(),
    }, { merge: true });

    // Create the code→userId mapping so referrals credit even if the referrer
    // shares their link before claiming a plot. Idempotent (merge).
    await db.collection("oilReferrals").doc(refCode).set({
      userId, code: refCode, createdAt: FieldValue.serverTimestamp(),
    }, { merge: true });

    return NextResponse.json({
      ok: true,
      qualified,
      usdValue: Math.round(usdValue * 100) / 100,
      balance: balanceNum.toString(),
      threshold: QUALIFICATION_THRESHOLD_USD,
    });
  } catch (err) {
    console.error("[oil-register]", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
