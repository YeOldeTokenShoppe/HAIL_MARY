import { FieldValue } from "@/lib/firebaseAdmin";
import { BONUS_LEVERS, bonusAddFor } from "@/lib/oilBonusMath";

// Re-export the pure math so callers can import everything from one place.
export {
  MAX_BONUS_DRILLS, REFERRAL_BONUS, BONUS_LEVERS, HOLDING_MILESTONE_DAYS,
  holdingMilestonesPassed, bonusAddFor,
} from "@/lib/oilBonusMath";

// Atomically credit a lever's bonus to a rig, respecting BOTH the per-lever
// sub-cap and the global MAX_BONUS_DRILLS. Re-arms a capped rig (clears
// rigDepleted) so the now-higher depthCap takes effect on the next strike tick.
//
//   • Per-event levers (share): omit opts → adds `cfg.per` once per call.
//     Idempotency is the CALLER's job (guard on a per-event flag before calling).
//   • Duration levers (holding): pass { targetTotal } → tops the lever's counter
//     UP TO that target (never down), so repeated snapshots converge to the
//     milestones-passed count without double-crediting.
export async function creditBonusDrills(db, userId, lever, opts = {}) {
  const cfg = BONUS_LEVERS[lever];
  if (!cfg) throw new Error(`unknown bonus lever: ${lever}`);
  const ref = db.collection("oilDrills").doc(userId);
  return db.runTransaction(async (t) => {
    const snap = await t.get(ref);
    if (!snap.exists) return { credited: 0, reason: "no_drill" };
    const d = snap.data();
    const current = d.bonusDrills || 0;
    const used = d[cfg.counter] || 0;
    const add = bonusAddFor({ current, used, per: cfg.per, max: cfg.max, targetTotal: opts.targetTotal });
    if (add <= 0) return { credited: 0, reason: "capped", bonusDrills: current };
    t.set(ref, {
      bonusDrills: FieldValue.increment(add),
      [cfg.counter]: FieldValue.increment(add),
      rigDepleted: false, // revive a capped rig — the higher depthCap now applies
      armed: true,
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    return { credited: add, bonusDrills: current + add };
  });
}
