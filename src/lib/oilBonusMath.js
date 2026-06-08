// Pure bonus-drill math — no Firebase, unit-testable in isolation. Single source
// of MAX_BONUS_DRILLS (oilDemon and oilBonus both re-export from here).
//
// Earned-depth levers feed the shared `bonusDrills` pool (base 10 → cap 20).
// Principle (docs/oil-game.md → "Depth levers"): effort / network / loyalty
// earns DEPTH; token holdings SIZE earns cosmetics, never depth. Every lever is
// sub-capped so referrals stay primary and no single lever alone fills the pool;
// MAX_BONUS_DRILLS clamps the total.

export const MAX_BONUS_DRILLS = 10; // 10 base + 10 bonus = the 20 depth cap
export const REFERRAL_BONUS = 3;    // +depth per confirmed referral (credited at snapshot)

export const BONUS_LEVERS = {
  // Admin-APPROVED Field Dispatch post — a vetted, shareable moment (approval IS
  // the anti-sybil gate). +1 each, up to +3.
  share:   { per: 1, max: 3, counter: "bonusFromShares" },
  // Long-term holding (diamond hands) — held continuously qualified beyond a
  // single season. +1 each, up to +3. See HOLDING_MILESTONE_DAYS.
  holding: { per: 1, max: 3, counter: "bonusFromHolding" },
};

// Diamond-hands milestones in absolute days held (not season-relative — the
// point is loyalty BEYOND a single round, so it doesn't merely duplicate the
// per-season qualification floor). Measured from first continuous qualification
// (persists across seasons; resets if the wallet drops below the $20 floor).
export const HOLDING_MILESTONE_DAYS = [30, 60, 90];
export function holdingMilestonesPassed(heldMs) {
  if (!(heldMs > 0)) return 0;
  const heldDays = heldMs / 86400000;
  return HOLDING_MILESTONE_DAYS.filter((d) => heldDays >= d).length;
}

// How much a lever may add, respecting the per-lever sub-cap (`max`, tracked by
// `used`), the global MAX_BONUS_DRILLS (vs `current` total), and the crediting
// mode — incremental (`per` once) or top-up (toward `targetTotal`).
export function bonusAddFor({ current = 0, used = 0, per, max, targetTotal }) {
  const want = targetTotal != null
    ? Math.min(targetTotal, max) - used // top up toward a target (duration milestones)
    : Math.min(per, max - used);         // incremental per-event
  return Math.max(0, Math.min(want, MAX_BONUS_DRILLS - current));
}
