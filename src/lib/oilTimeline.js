import { FieldValue } from "@/lib/firebaseAdmin";

// Append-only public activity feed for the oil game ("FIELD ACTIVITY"). Stores
// only WHO + WHAT + WHEN — deliberately NO amounts and NO coordinates, so the
// live feed can't be used as a treasure map (cell locations stay secret until the
// post-game reveal). Server-only writes (oilTimeline is read:true/write:false).
//
// type: "strike" | "gusher" | "hell" | "contain" | "claim" | "rogue" | "system"
export async function logTimeline(db, { type, username = null, userId = null, detail = null }) {
  try {
    await db.collection("oilTimeline").add({
      type,
      username,
      userId,
      detail, // optional short sub-text, e.g. "the field froze" — never a location
      createdAt: FieldValue.serverTimestamp(),
    });
  } catch (e) {
    console.error("[oilTimeline] write failed:", e.message);
  }
}
