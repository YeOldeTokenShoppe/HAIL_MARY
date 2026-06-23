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
  { key: "human80", label: "HUMAN80", text: "for HUMAN80" },
  { key: "liquid80", label: "LIQUID80", text: "for LIQUID80" },
    { key: "sobri80", label: "SOBRI80", text: "for SOBRI80" },
  { key: "opportun80", label: "OPPORTUN80", text: "for OPPORTUN80" },
  { key: "immortal80", label: "IMMORTAL80", text: "for IMMORTAL80" },
  { key: "char80", label: "CHAR80", text: "for CHAR80" },
  { key: "π80", label: "π80", text: "for π80" },

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

// A candle can carry MORE THAN ONE intention now ("all that apply"), so
// the stored `intention` field may be an array of keys. Legacy docs (and
// stale clients mid-deploy) may still store a single string; every reader
// below accepts string | string[] | null so both shapes render.

// Normalize a stored intention value to an array of keys. null/empty → [].
export function toIntentionKeys(value) {
  if (Array.isArray(value)) return value.filter(Boolean);
  if (typeof value === "string" && value) return [value];
  return [];
}

// A key's display label, for joined multi-intention phrases. Falls back to
// a retired entry's bespoke text minus its leading "for ".
function labelForKey(key) {
  const preset = INTENTION_PRESETS.find((p) => p.key === key);
  if (preset) return preset.label;
  const retired = RETIRED_INTENTIONS.find((p) => p.key === key);
  return retired ? retired.text.replace(/^for /, "") : null;
}

// "A" → "A"; "A","B" → "A & B"; "A","B","C" → "A, B & C"
function joinLabels(labels) {
  if (labels.length <= 1) return labels[0] ?? "";
  return `${labels.slice(0, -1).join(", ")} & ${labels[labels.length - 1]}`;
}

// Display text for a stored intention (a single key, an array of keys, or
// null); null for unknown/missing keys so callers can fall back to their
// own copy (the ticker synthesizes a generic phrase). Unknown keys can
// exist if a preset is ever retired — old docs keep their key, and this
// degrades gracefully.
export function intentionText(value) {
  const keys = toIntentionKeys(value);
  if (keys.length === 0) return null;
  // Single key: preserve the exact legacy phrasing, including retired
  // entries that carry their own bespoke text ("for my bags").
  if (keys.length === 1) {
    return (
      INTENTION_PRESETS.find((p) => p.key === keys[0])?.text ??
      RETIRED_INTENTIONS.find((p) => p.key === keys[0])?.text ??
      null
    );
  }
  // Multiple: one "for A, B & C" phrase built from the labels — splicing
  // each entry's own "for …" text would read "for A for B".
  const labels = keys.map(labelForKey).filter(Boolean);
  return labels.length ? `for ${joinLabels(labels)}` : null;
}
