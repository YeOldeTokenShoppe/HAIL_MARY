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
