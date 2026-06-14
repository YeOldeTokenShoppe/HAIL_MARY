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
// `label` is what the picker chip shows; `text` is the phrase surfaces
// splice into sentences ("Lit a candle for PROSPER80", "burned 1.5K
// RL80 for PROSPER80"), so it carries its own "for".
export const INTENTION_PRESETS = [
  { key: "prosper80", label: "PROSPER80", text: "for PROSPER80" },
  { key: "secur80", label: "SECUR80", text: "for SECUR80" },
  { key: "notori80", label: "NOTORI80", text: "for NOTORI80" },
  { key: "liquid80", label: "LIQUID80", text: "for LIQUID80" },
  { key: "celebr80", label: "CELEBR80", text: "for CELEBR80" },
  { key: "etern80", label: "ETERN80", text: "for ETERN80" },

];

// Retired preset keys (the pre-"-80 virtues" list) still resolve for
// display so candles dedicated before the switch keep their lines;
// they're no longer offered in the picker or whitelisted in
// firestore.rules for new writes.
const RETIRED_INTENTIONS = [
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
  return (
    INTENTION_PRESETS.find((p) => p.key === key)?.text ??
    RETIRED_INTENTIONS.find((p) => p.key === key)?.text ??
    null
  );
}
