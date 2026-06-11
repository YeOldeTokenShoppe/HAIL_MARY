import { NextResponse } from "next/server";
import { clerkClient } from "@clerk/nextjs/server";
import { getAdminDb, FieldValue } from "@/lib/firebaseAdmin";
import { authedUserId } from "@/lib/oilAuth";
import { getRL80Price, getRL80Balance } from "@/lib/oilPrice";
import { checkHandleFollows } from "@/lib/xFollowers";

export const runtime = "nodejs";

const QUALIFICATION_THRESHOLD_USD = 20;

// Server-side identity for the X handle: if the Clerk user has an X account
// linked (OAuth), ITS username is authoritative — proof the player owns the
// handle. Returns null when no X account is linked (manual-entry handles are
// stored but flagged unverified). Clerk lookup failures degrade to null —
// registration must not 500 because Clerk hiccuped.
async function clerkLinkedXUsername(userId) {
  try {
    const client = await clerkClient();
    const u = await client.users.getUser(userId);
    const x = (u.externalAccounts || []).find(
      (a) => ["x", "twitter", "oauth_x", "oauth_twitter"].includes(a.provider),
    );
    return x?.username ? x.username.toLowerCase() : null;
  } catch (e) {
    console.warn("[oil-register] Clerk external-account lookup failed:", e.message);
    return null;
  }
}

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
    const submittedX = (typeof body.xUsername === "string" ? body.xUsername : "")
      .trim().replace(/^@/, "").toLowerCase().slice(0, 40);
    const clerkName = (typeof body.clerkName === "string" ? body.clerkName : "Anonymous").slice(0, 80);
    const clerkAvatar = typeof body.clerkAvatar === "string" ? body.clerkAvatar.slice(0, 500) : null;

    const db = getAdminDb();

    // ── X handle + follow — server-enforced ─────────────────────────────────
    // The handle from Clerk's linked X account (OAuth) overrides whatever the
    // client typed: that's proof of ownership (xVerified). A manually typed
    // handle is stored but flagged unverified — it proves only that SOME
    // account with that name follows, not that this player owns it.
    const linkedX = await clerkLinkedXUsername(userId);
    const xUsername = linkedX || submittedX;
    const xVerified = !!linkedX;
    if (!xUsername) {
      return NextResponse.json({ error: "Following @rl80token on X is required to register." }, { status: 400 });
    }

    // The follow itself, re-checked server-side (same three-tier check as the
    // VERIFY button) — the client gate alone was bypassable with a direct
    // API call.
    const follow = await checkHandleFollows(xUsername);
    if (!follow.follows) {
      return NextResponse.json({
        error: follow.reason === "user_not_found"
          ? "That X account doesn't exist — check the spelling."
          : "X follow not verified — make sure this account follows @rl80token, then try again.",
      }, { status: 400 });
    }

    // X-username uniqueness — server-checked. An OAuth-verified owner may
    // RECLAIM their handle from a manual (unverified) squatter; everything
    // else stays first-come.
    const dupe = await db.collection("oilQualified").where("xUsername", "==", xUsername).get();
    const holder = dupe.docs.find((d) => d.id !== userId);
    if (holder) {
      const holderVerified = holder.data().xVerified === true;
      if (holderVerified || !xVerified) {
        return NextResponse.json({ error: "This X username is already registered." }, { status: 409 });
      }
      // Verified owner displaces the squatter's handle claim (their
      // registration survives, just without the stolen handle).
      await holder.ref.set({ xUsername: null, xVerified: false }, { merge: true });
    }

    // Re-check the balance on-chain. This is the gate the client cannot forge.
    const [price, balance] = await Promise.all([
      getRL80Price(),
      getRL80Balance(walletAddress),
    ]);
    const balanceNum = Number(balance) / 1e18;
    const usdValue = balanceNum * price.rl80PriceUsd;
    const qualified = usdValue >= QUALIFICATION_THRESHOLD_USD;

    // Count floor = the $20-equivalent token COUNT at registration price. Entry is
    // value-gated (real $20 commitment), but ongoing snapshots check this fixed
    // COUNT — so a holder is never disqualified by a price drop, only by selling
    // below their entry position. Captured once, here, at the registration price.
    const qualifyTokenFloor = price.rl80PriceUsd > 0
      ? QUALIFICATION_THRESHOLD_USD / price.rl80PriceUsd
      : null;

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
      xVerified, // handle proven via Clerk X OAuth (vs typed — spoofable)
      xFollowSource: follow.source, // cache | refreshed | live, for audits
      referralCode: refCode,
      registeredAt: FieldValue.serverTimestamp(),
      qualified,
      lastSnapshotBalance: balanceNum.toString(),
      lastSnapshotUsdValue: Math.round(usdValue * 100) / 100,
      lastSnapshotAt: FieldValue.serverTimestamp(),
      // Lock the count floor at entry (only when they actually qualified).
      ...(qualified && qualifyTokenFloor != null ? { qualifyTokenFloor } : {}),
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
