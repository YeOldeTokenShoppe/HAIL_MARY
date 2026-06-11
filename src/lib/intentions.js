// Preset dedication intentions for a lit candle. The KEY (not the text)
// is what's stored on the shrineCandles doc, and the key list is
// whitelisted in firestore.rules — when adding a preset, update BOTH:
//   1. this list
//   2. the `intention in [...]` clause on shrineCandles in firestore.rules
// The dedication card and the VigilTicker both read from here, so the
// display text can be reworded freely without touching stored data.
//
// Preset-only (no free text) is deliberate: every entry scrolls across
// the landing-page chyron, so an open text field would be a spam/scam
// surface that needs moderation. If free text ever ships, gate it behind
// holding RL80 and keep these as the fast path.
export const INTENTION_PRESETS = [
  { key: "bags", text: "for my bags" },
  { key: "bullrun", text: "for the bull run" },
  { key: "family", text: "for my family" },
  { key: "green", text: "for a green dexscreener" },
  { key: "us-all", text: "for us all" },
];

// Display text for a stored intention key; null for unknown/missing keys
// so callers can fall back to their own copy (the ticker synthesizes a
// generic phrase). Unknown keys can exist if a preset is ever retired —
// old docs keep their key, and this degrades them gracefully.
export function intentionText(key) {
  return INTENTION_PRESETS.find((p) => p.key === key)?.text ?? null;
}
