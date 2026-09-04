// ── Boardwalk vendor goods paid in-game (BTR from the un-banked tank) ────────
// Shared by the purchase route and the cart UI so the number the player sees
// is the number the server charges. Real-money (USDC/x402) stays on the
// cosmetics stall — gameplay items are bought with oil.
//
// HOLY WATER: the arena consumable. Thrown at the demon it forces the pause
// with its back turned (the backstab window on demand) and steadies the
// hunter's hand (clears a lockout). One vial ≈ two of the three pips.
//
// PRICE IS A PLACEHOLDER (Michelle, 2026-09-04: "10 RL80"). NOTE the rail:
// the purchase route charges `price` from the un-banked TANK (oil), while the
// label says RL80 — paying in the token needs a wallet→treasury flow that does
// not exist yet. Pick one before this ships: tank BTR (relabel) or an RL80 rail.
export const HOLY_WATER_PRICE = 10;
export const HOLY_WATER_CURRENCY = "RL80";

export const VENDOR_GOODS = {
  holyWater: {
    id: "holyWater",
    vendor: "tonics",
    label: "HOLY WATER",
    unit: "vial",
    price: HOLY_WATER_PRICE,
    currency: HOLY_WATER_CURRENCY,
    image: "/HolyWater.png",
    supply: "holyWater",          // drill doc: supplies.holyWater
    blurb: "Blessed at the mission spring. Thrown at a demon it reels, turns its back, and your hand steadies.",
  },
};

export const goodsForVendor = (vendorId) => Object.values(VENDOR_GOODS).filter((g) => g.vendor === vendorId);
