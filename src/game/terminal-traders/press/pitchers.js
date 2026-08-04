import { mulberry32 } from "../caseTable.js";

// WHICH BOT SHOWS UP — the cast rule for the VC game's pitcher.
//
// THE ONE RULE, AND IT IS THE SAME RULE AS identities.js:
//
//   THE RIG MUST NOT CORRELATE WITH THE ARCHETYPE, OR WITH THE OUTCOME.
//
// identities.js exists because names used to be authored per archetype, which
// made the deal's name a perfect predictor of its pattern — and its comment is
// blunt about the cost: correctly identifying the archetype is worth a ~44 point
// swing, "the single most valuable read in the game". A name that gave it away
// deleted the thing the game is about.
//
// A BODY GIVES IT AWAY FASTER THAN A NAME DOES. There will be three or four rigs
// against three archetypes, so a bot keyed to the case pattern is not a partial
// leak, it is close to a lookup table — and one the player reads before a word is
// spoken, since the pitcher is on screen from the first frame of the pitch. It
// would also be the most innocent-looking leak in the game: it reads as art.
//
// So the roll here sees NEITHER the archetype NOR the branch. It cannot: nothing
// about the deal is passed in. That is a structural guarantee rather than a
// promise to be careful — the leak is unavailable, not merely avoided.
//
// VC_GAME.md §1 rule 5 states the same constraint for the founder identity:
// "Roll the founder independently of archetype AND outcome. A founder who only
// appears on legit deals leaks the answer; a founder mapped to an archetype is
// the name-leak again."
//
// ONE CHARACTER, SEVERAL SHELLS (author's call, 2026-08-02). The rigs are bodies
// for a single role, not a cast: one voice bank, one set of asides, one
// commission rule, and NO per-rig prose. That keeps §1's "one voice, many
// clients" intact — the argument in [A§17] against a rotating cast was about
// authored content multiplying, and swapping a mesh multiplies nothing. Each
// shell may carry its own vocal timbre (see `voice` on the variants); what it
// must never carry is its own script, because a script is where a tell would
// hide.

/* ────────────────────────────────────────────────────────────────────────────
   WHO THE PITCHER IS — identity, as opposed to how it renders.

   THIS FILE IS PURE ON PURPOSE. It is imported by desk.js, which is imported by
   PressFlat — the flat, no-WebGL surface. lib/trade/pitchBotScene owns the rig
   configs and imports three; pulling that in here would drag the whole renderer
   onto a presentation that has no 3D at all, to answer the question "which
   portrait".

   SO THE SPLIT IS: identity (id, roster, portrait, voice) lives here and is
   safe anywhere; geometry, materials, clips and framing live next to three. Both
   sides resolve the SAME id through resolvePitcherId, so they cannot disagree
   about which bot is on. ────────────────────────────────────────────────────── */

/** Every rig that exists, cast or not. Keys match PITCH_BOT_VARIANTS. */
export const PITCHER_IDS = ["v1", "v2", "v3"];

/**
 * Rigs eligible for auto-assignment. A rig can exist without being cast — useful
 * while one is being re-authored, or to hold a new one back until its voice is
 * registered (v3 sat out for exactly that reason).
 */
export const PITCHER_ROSTER = ["v1", "v2", "v3"];

/**
 * FORCE ONE RIG from code. `null` = auto-assign from the roster.
 *
 * Beaten by `?pitchbot=`, so a pinned build can still be compared in a reload.
 * This is the knob to reach for while building — the fallback below sits BELOW
 * the roll and does nothing on a non-empty roster.
 */
export const PITCHER_PIN = null;

/** Used only when nothing was asked for and nothing rolled (empty roster). */
export const PITCHER_FALLBACK = "v2";

/**
 * WHAT THE PLAYER SEES OF EACH SHELL. Portrait and voice, and deliberately
 * nothing else: VC_GAME.md §1 rule 6 is one character in several bodies, so a
 * rig may differ in face and timbre and must never differ in script.
 *
 * The portrait matters more than it looks. These tiles sit in a row with the
 * four analysts, and a pitcher wearing a borrowed face is the cast-legibility
 * failure that whole row exists to prevent — desk.js records the day the bot
 * wore Barron's headshot two seats from Barron.
 */
/**
 * `stage` — CAN THIS RIG BE SHOWN LIVE RATHER THAN AS A PICTURE?
 *
 * The flat surface renders the staged rig's actual glb when this is true, so its
 * mouth is the one the artist authored instead of one drawn over a still (see
 * PressBotStage). It is a plain flag rather than a test for viseme meshes on
 * purpose: v2 and v3 drive their faces with PLATES, and v1's face is a texture,
 * so "has visemes" is the mechanism of two rigs and not the question being
 * asked. Flip v1 when its texture-swap face exists.
 *
 * IT LIVES HERE, WITH IDENTITY, so PressFigure can ask without importing
 * lib/trade/pitchBotScene — that module imports three, and the whole reason this
 * file exists is that the flat surface must be able to answer "which bot, and
 * what can it do" without dragging a renderer onto a page that has none. The
 * stage itself is loaded dynamically, so three arrives only when a rig that can
 * use it is actually cast.
 */
/**
 * `model` — THE SHELL'S PLATE NUMBER, printed on the file's polaroid.
 *
 * Body data, not script: §1 rule 6 forbids per-rig PROSE, and a plate number is
 * the same kind of fact as a portrait or a timbre — which shell turned up. It
 * is safe to print for the same structural reason the face is: the rig is
 * rolled before the deal exists and the roll cannot see the archetype or the
 * branch, so the number correlates with nothing a player could trade on.
 *
 * It also satisfies the desk's own rule that a number on screen must be REAL
 * (see the caseload counter in engagement.jsx): this one identifies the machine
 * in the room, and swapping rigs changes it.
 */
export const PITCHER_IDENTITY = {
  v1: { portrait: "/pitchBot.webp", voice: "PB", stage: false, model: "PB-100" },
  v2: { portrait: "/pitchBot2.webp", voice: "PB2", stage: true, model: "PB-220" },
  v3: { portrait: "/pitchBot3.webp", voice: "PB3", stage: true, model: "PB-340" },
};

/** Cached so identity and geometry cannot roll separately within a page load. */
let _resolved = null;

/**
 * Which rig is staged. Precedence: explicit > `?pitchbot=` > PITCHER_PIN > roll.
 *
 * ONE RESOLVER FOR BOTH LAYERS. pitchBotScene delegates to this rather than
 * repeating the precedence, because two copies of "which bot is on" is a bug
 * that shows up as a portrait disagreeing with the thing in the beam.
 */
export function resolvePitcherId(explicit = null) {
  if (explicit && PITCHER_IDENTITY[explicit]) return explicit;
  if (typeof window !== "undefined") {
    try {
      const q = new URLSearchParams(window.location.search).get("pitchbot");
      if (q && PITCHER_IDENTITY[q]) return q;
    } catch { /* a malformed query string is not worth taking the room down for */ }
  }
  if (PITCHER_PIN && PITCHER_IDENTITY[PITCHER_PIN]) return PITCHER_PIN;
  /* NEVER ROLL ON THE SERVER. desk.js exposes the portrait as a GETTER, and that
   * getter is read during render — so rolling here would draw one rig server-side
   * and a different one on the client, and hydrate an <img src> that disagrees
   * with the markup. The renderer only ever runs in a browser, so the server's
   * answer is a placeholder that is replaced the moment the client resolves. */
  if (typeof window === "undefined") return PITCHER_FALLBACK;
  if (!_resolved) _resolved = rollPitcher(PITCHER_ROSTER);
  return _resolved || PITCHER_FALLBACK;
}

/** Re-roll the session's pitcher. Debug and tests only. */
export function assignPitcher(seed = null) {
  _resolved = rollPitcher(PITCHER_ROSTER, seed);
  return _resolved;
}

/** The staged rig's portrait path. */
export function pitcherPortrait(variant = null) {
  return PITCHER_IDENTITY[resolvePitcherId(variant)]?.portrait
    ?? PITCHER_IDENTITY[PITCHER_FALLBACK].portrait;
}

/** The staged rig's speaker code for api/counsel-voice. */
export function pitcherVoice(variant = null) {
  return PITCHER_IDENTITY[resolvePitcherId(variant)]?.voice ?? "PB";
}

/** The staged shell's plate number. See `model` on PITCHER_IDENTITY. */
export function pitcherModel(variant = null) {
  return PITCHER_IDENTITY[resolvePitcherId(variant)]?.model
    ?? PITCHER_IDENTITY[PITCHER_FALLBACK].model;
}

/** Can the staged rig be rendered live? See `stage` on PITCHER_IDENTITY. */
export function pitcherHasStage(variant = null) {
  return !!PITCHER_IDENTITY[resolvePitcherId(variant)]?.stage;
}

/**
 * Mixed into the seed so the pitcher rides its own stream.
 *
 * WHY NOT JUST CALL rand() INSIDE instanceDeal: that function's rolls come off
 * one mulberry32 sequence in a fixed order, so an extra draw shifts every roll
 * after it and the same seed stops producing the same deal. Any pinned seed —
 * a `?seed=` link, a sim, a bug report — would quietly describe a different
 * game. XOR-ing into a separate stream costs one line and cannot disturb the
 * sequence it is deliberately not part of.
 */
const PITCHER_SALT = 0x5f3a91c7;

/**
 * Pick the rig that pitches this deal.
 *
 * @param roster  eligible rig keys, in any order. Owned by the render layer
 *                (PITCH_BOT_ROSTER in lib/trade/pitchBotScene) because which
 *                MESHES exist is not a game concern; which rig a DEAL gets is,
 *                and that is this function.
 * @param seed    the deal's seed. Optional — pass it and a replayed seed brings
 *                back the same bot, which costs nothing and makes a pinned run
 *                reproduce completely. Omit it for a plain draw.
 *
 * NOTE the argument list: a roster and a number. There is deliberately no way to
 * hand this an archetype, an outcome, or a deal.
 */
export function rollPitcher(roster, seed = null) {
  if (!Array.isArray(roster) || roster.length === 0) return null;
  if (roster.length === 1) return roster[0];

  const r = Number.isFinite(seed)
    ? mulberry32((seed ^ PITCHER_SALT) >>> 0)()
    : Math.random();

  return roster[Math.min(roster.length - 1, Math.floor(r * roster.length))];
}
