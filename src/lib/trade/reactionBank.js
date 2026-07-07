// Reaction bank for the BANKED SitePal voices — Demon and Detective.
//
// These two lip-sync through SitePal, which can only play audio already in the
// account's Audio Manager (sayAudio plays by NAME, never a URL — verified via
// the spike). So they don't improvise: each line is an ElevenLabs clip in that
// character's voice, uploaded ONCE to SitePal account 9308752, played live by
// sayAudio(audioName). The director SELECTS from these by `id` — it never
// writes new words for Demon or Detective.
//
// TO RECORD: generate each `text` in that character's ElevenLabs voice and
// upload it to the SitePal Audio Manager named EXACTLY its `audioName`. Once
// uploaded, ?live=paid plays it. Until then those beats are caption-only.
//
// These fire as REACTIONS the moment the player commits a verdict, so they're
// written situation-general within each tag. The director picks by:
//   • the player's call  → verdict-trust | verdict-doubt | verdict-abstain
//   • the case's tell     → fresh-deployer | mixer-funded | concentration |
//                           hype-velocity | rug-shape | dormant | clean-legit
//
// Voices (from src/lib/review/characterPrompts.js):
//   Demon = John Barron — hype-critic, loud, staccato, cynical, names the greed.
//   Detective = Marisol — cold, agnostic, states evidence, renders NO verdict.
//
// Fields: id (director returns this as clipId) · character · audioName (the
// SitePal clip name) · tag (situation) · text (spoken words + caption).
//
// Edit freely — these are your characters. Trim or add; keep id/audioName unique.

export const REACTION_BANK = [
  // ── Demon — John Barron. Cuts against hope; entertained by the con. ──
  { id: 'd_trust',   character: 'Demon', audioName: 'demon_trust',   tag: 'verdict-trust',
    text: "You leaned Trust. Of course you did. Hope is the cheapest thing they sell." },
  { id: 'd_doubt',   character: 'Demon', audioName: 'demon_doubt',   tag: 'verdict-doubt',
    text: "Doubt. Good. Suspicion is the only loyalty that ever pays out." },
  { id: 'd_abstain', character: 'Demon', audioName: 'demon_abstain', tag: 'verdict-abstain',
    text: "Abstain? You smelled smoke and decided not to look. Bold." },
  { id: 'd_fresh',   character: 'Demon', audioName: 'demon_fresh',   tag: 'fresh-deployer',
    text: "Wallet's barely a week old. New mask. Same old face." },
  { id: 'd_mixer',   character: 'Demon', audioName: 'demon_mixer',   tag: 'mixer-funded',
    text: "Funded through a mixer. Honest money doesn't wear a hood." },
  { id: 'd_conc',    character: 'Demon', audioName: 'demon_conc',    tag: 'concentration',
    text: "One wallet holds the whole bag. Guess who's leaving first." },
  { id: 'd_hype',    character: 'Demon', audioName: 'demon_hype',    tag: 'hype-velocity',
    text: "Loud. Fast. Everywhere. The good ones never have to shout." },
  { id: 'd_rug',     character: 'Demon', audioName: 'demon_rug',     tag: 'rug-shape',
    text: "Spike, then silence. I've been to this funeral before." },
  { id: 'd_dormant', character: 'Demon', audioName: 'demon_dormant', tag: 'dormant',
    text: "Nothing to steal here yet. Not a trap — just empty." },
  { id: 'd_clean',   character: 'Demon', audioName: 'demon_clean',   tag: 'clean-legit',
    text: "Annoyingly clean. Even I can't find the knife." },

  // ── Detective — Marisol. States the evidence, renders no verdict. ──
  { id: 't_trust',   character: 'Detective', audioName: 'detective_trust',   tag: 'verdict-trust',
    text: "You weighted toward Trust. The evidence permits it. It does not insist on it." },
  { id: 't_doubt',   character: 'Detective', audioName: 'detective_doubt',   tag: 'verdict-doubt',
    text: "Doubt logged. The pattern supports caution. I won't call it more than that." },
  { id: 't_abstain', character: 'Detective', audioName: 'detective_abstain', tag: 'verdict-abstain',
    text: "Abstain. Defensible — the signal here is thin in both directions." },
  { id: 't_fresh',   character: 'Detective', audioName: 'detective_fresh',   tag: 'fresh-deployer',
    text: "Deployer wallet, six days old. A fact. Not yet a verdict." },
  { id: 't_mixer',   character: 'Detective', audioName: 'detective_mixer',   tag: 'mixer-funded',
    text: "Deploy funds routed through a mixer. Note it. Motive is unproven." },
  { id: 't_conc',    character: 'Detective', audioName: 'detective_conc',    tag: 'concentration',
    text: "Top holder controls a majority. On its own, that proves nothing." },
  { id: 't_hype',    character: 'Detective', audioName: 'detective_hype',    tag: 'hype-velocity',
    text: "Volume far exceeds the holder base. Consistent with wash. Not conclusive." },
  { id: 't_rug',     character: 'Detective', audioName: 'detective_rug',     tag: 'rug-shape',
    text: "Eighty-five percent match to a known template, escape hatch intact." },
  { id: 't_dormant', character: 'Detective', audioName: 'detective_dormant', tag: 'dormant',
    text: "Eleven holders, four transfers this month. Insufficient to read." },
  { id: 't_clean',   character: 'Detective', audioName: 'detective_clean',   tag: 'clean-legit',
    text: "Verified contract, distributed supply, steady flow. Nothing flags." },
];

const byId = new Map(REACTION_BANK.map((c) => [c.id, c]));
export const clipById = (id) => byId.get(id) || null;

// The menu handed to the director — id/tag/text only (no audioName). Optionally
// filter to the situation tags relevant to this case so the prompt stays lean.
export function clipMenuForDirector(tags = null) {
  const want = tags && tags.length ? new Set(tags) : null;
  const menu = { Demon: [], Detective: [] };
  for (const c of REACTION_BANK) {
    if (want && !want.has(c.tag)) continue;
    if (menu[c.character]) menu[c.character].push({ id: c.id, tag: c.tag, text: c.text });
  }
  return menu;
}

// The set of valid clip ids in a menu — used to validate the director's picks.
export function validClipIds(menu) {
  const ids = new Set();
  for (const arr of Object.values(menu || {})) for (const c of arr) ids.add(c.id);
  return ids;
}
