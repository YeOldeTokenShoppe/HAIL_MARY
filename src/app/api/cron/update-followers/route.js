import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebaseAdmin";
import { refreshFollowersCache } from "@/lib/xFollowers";

export const runtime = "nodejs";

// Daily scheduled backstop for the @rl80token follower cache (Firebase
// scheduled function pings this with the CRON_SECRET bearer). The cache is
// ALSO refreshed on demand by /api/check-follow when a verify misses — this
// job just guarantees freshness through quiet periods. Core logic lives in
// lib/xFollowers (shared with check-follow).
export async function GET(request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await refreshFollowersCache();
    return NextResponse.json({
      success: true,
      message: "Followers updated successfully via cron",
      totalCount: result.totalCount,
      partial: result.partial,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Cron job error:", error);
    try {
      await getAdminDb().collection("followers").doc("latest").set({
        error: error.message,
        updatedAt: new Date().toISOString(),
        success: false,
      }, { merge: true });
    } catch (firestoreError) {
      console.error("Failed to save error to Firestore:", firestoreError);
    }
    return NextResponse.json({
      error: "Cron job failed",
      message: error.message,
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}
