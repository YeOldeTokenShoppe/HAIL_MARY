// instanceDeal — roll a playable deal from an archetype. Pure and seeded.
//
// LAYER 1 (2026-07-26). Replaces the hand-written constant deal, whose
// `truth: 1` made the session a lookup after two plays. Same seed always
// produces the same deal, so a daily session is identical for every player
// (fair leaderboard, no reroll-fishing) while nothing is memorisable across
// days. Uses the repo's existing PRNG so replays and sims match the rest of
// the engine.

import { mulberry32 } from "../caseTable.js";
import * as BACKDOOR from "./archetypes/backdoorFork.js";
import * as MIRAGE from "./archetypes/yieldMirage.js";
import * as ANONREAL from "./archetypes/anonButReal.js";
import * as SUPPLYCLIFF from "./archetypes/supplyCliff.js";
import { IDENTITIES, CHAINS, SECTORS } from "./identities.js";
import { rollFate, fateLine } from "./fates.js";
import { getCardById } from "../cards.js";
import { getCardArt } from "../templateCard.js";

export const ARCHETYPES = {
  [BACKDOOR.ARCHETYPE_ID]: BACKDOOR,
  [MIRAGE.ARCHETYPE_ID]: MIRAGE,
  [ANONREAL.ARCHETYPE_ID]: ANONREAL,
  [SUPPLYCLIFF.ARCHETYPE_ID]: SUPPLYCLIFF,
};
export const ARCHETYPE_IDS = Object.keys(ARCHETYPES);

/** Backing is a property of the CLAIM, not of the branch — see slotBacking. */
export const backingOf = (slot) => slot.backing ?? slot.rug?.backing ?? null;

/**
 * Can pressing this slot tell you which branch you're in, and AT WHAT DEPTH?
 * Compares only what the player can observe — the receipts. Not the prose,
 * which can differ in wording while saying the same thing.
 *
 * TWO DEPTHS, MEASURED SEPARATELY, BECAUSE THE WHOLE DESK RESTS ON THE GAP.
 * The acceptance test on 2026-07-28 found generic and sharp discriminating
 * identically on 14 of 14 slots, which made every specialist decorative and let
 * three presses on the seller weakly dominate the desk. The cause was `backing`
 * being authored per branch: the engine zeroes every receipt on VIBES, so a
 * VIBES/HARD slot returned nothing to ANYONE in the rug branch. Backing is now
 * slot-level and cannot carry the signal; the receipts have to.
 *
 * `funding` in backdoor-fork is the deliberate zero on both axes — identical in
 * both branches at both depths, the impressive-sounding claim that tells you
 * nothing. A salesman disguises materiality on purpose, and scoring coverage of
 * the discriminating claims is what teaches that.
 */
export function genericDiscriminates(slot) {
  if (slot.generic) return false;   // hoisted: identical by construction
  const obs = (b) => JSON.stringify(b.generic?.receipt ?? null);
  return obs(slot.rug) !== obs(slot.legit);
}
export function sharpDiscriminates(slot) {
  const obs = (b) => JSON.stringify(b.sharp?.receipt ?? null);
  return obs(slot.rug) !== obs(slot.legit);
}
function slotDiscriminates(slot) {
  return genericDiscriminates(slot) || sharpDiscriminates(slot);
}

const pick = (rand, arr) => arr[Math.floor(rand() * arr.length)];
const between = (rand, lo, hi) => lo + Math.floor(rand() * (hi - lo + 1));

function rollOutcome(rand, outcomes) {
  const total = outcomes.reduce((s, o) => s + o.weight, 0);
  let r = rand() * total;
  for (const o of outcomes) { r -= o.weight; if (r <= 0) return o; }
  return outcomes[outcomes.length - 1];
}

/**
 * @param {number} seed          deterministic; in production this is the UTC date
 * @param {string} archetypeId   which read this deal is an instance of
 * @returns a deal object in exactly the shape pressRun.js already consumes
 */
/** Mixed into the seed so the premise rides its own stream. See vars.sector. */
const SECTOR_SALT = 0x6a09e667;

export function instanceDeal(seed = 1, archetypeId = null) {
  const rand = mulberry32(seed >>> 0);
  // Which READ you're facing is itself part of the shuffle. Pass an id to pin
  // one (tests/tuning); otherwise the seed picks.
  const pickedId = archetypeId || ARCHETYPE_IDS[Math.floor(rand() * ARCHETYPE_IDS.length)];
  const A = ARCHETYPES[pickedId];
  if (!A) throw new Error(`unknown archetype: ${pickedId}`);

  const rolled = rollOutcome(rand, A.OUTCOMES);
  const branch = rolled.outcome; // "rug" | "legit"
  // THE NAME COMES FROM A SHARED POOL, NEVER FROM THE ARCHETYPE. Per-archetype
  // identity lists made the deal's name a perfect predictor of its pattern —
  // and therefore of its base rate — which is the one thing the player is meant
  // to work out. See identities.js.
  const id = { ...pick(rand, IDENTITIES), chain: pick(rand, CHAINS) };
  // Two DISTINCT prior roles — "ex-Aave, ex-Aave" reads as a bug, not a founder.
  const priorA = pick(rand, A.PRIORS);
  const priorB = pick(rand, A.PRIORS.filter((p) => p !== priorA));

  // Surface numbers. Deliberately NOT correlated with the outcome — the tape
  // and the listing stats must never leak ground truth, or the whole game
  // becomes "read the mcap". Only what the analysts can PRODUCE differs.
  const vars = {
    ...id,
    priorA,
    priorB,
    auditor: pick(rand, A.AUDITORS),
    seed: (between(rand, 8, 24) / 10).toFixed(1),   // $0.8M – $2.4M
    pump: between(rand, 18, 62),
    days: between(rand, 90, 420),          // yield-mirage: days paid without a miss
    apy: between(rand, 14, 41),            // yield-mirage: headline APY
    collapseDay: between(rand, 41, 88),
    age: `${between(rand, 22, 61)} days`,
    mcap: `$${(between(rand, 18, 92) / 10).toFixed(1)}M`,
    holders: String(between(rand, 900, 6400)),
    price: `$0.0${between(rand, 11, 89)}`,
    change24h: `+${between(rand, 2, 14)}%`,
    social: `${(between(rand, 55, 88) / 10).toFixed(1)}/10`,
  };

  /* WHAT THE PROJECT IS — off its own salted stream, for the same two reasons
     the pitcher and the fate are: the draw must not shift the sequence above it
     (a pinned ?dealseed has to keep describing the same deal), and riding a
     separate stream makes the independence STRUCTURAL rather than a promise.
     Nothing about the archetype or the branch is in scope at this line, so the
     premise cannot correlate with either — which is the whole requirement. See
     SECTORS in identities.js for why it may not be authored per archetype. */
  vars.sector = SECTORS[
    Math.floor(mulberry32((seed ^ SECTOR_SALT) >>> 0)() * SECTORS.length)];

  const resolve = (v) => (typeof v === "function" ? v(vars) : v);

  // Off a salted stream, so it cannot shift the sequence above it — the same
  // reasoning as rollPitcher. Taken here rather than at the return so the
  // draw is unconditional and identical for every branch.
  const fate = rollFate(seed >>> 0);

  // Play SIX of the archetype's slots. loadBearing slots are always in (a deal
  // must stay solvable cardless); the rest are a seeded pick, so which question
  // shapes are live shifts day to day.
  //
  // EVERY LANE MUST SURVIVE THE CUT. A lane with exactly one slot in the
  // archetype is protected from being dropped, because dropping it leaves that
  // specialist with no claim they're deep on all session — measured at 95 of
  // 200 yield-mirage seeds before this guard, since RECORD and CHART have a
  // single slot each there. Under the gradient model they'd still be sendable,
  // so nothing would look broken; their expertise would just be silently
  // decorative, which is worse than an obvious failure.
  // A LANE ALSO HAS TO KEEP SOMETHING THAT CAN SETTLE SOMETHING (2026-08-03).
  // The count guard below stops a lane being emptied, and for a year that was
  // read as "no specialist is left without a deep target". It isn't the same
  // thing: a lane can survive the cut holding only a slot that returns the same
  // receipt in both branches — the DELIBERATE ZERO every archetype now carries
  // (§4 rule 7), or a VIBES slot that returns no receipt to anyone. The seat is
  // still sendable and still says something, so nothing looks broken, and the
  // one specialist you spent could never have moved your call.
  //
  //   yield-mirage  SOCIAL   26% of seeds — Eugene left holding `sustain` alone
  //   anon-but-real CHAIN    19% of seeds — Marisol left holding `funding` alone
  //   bad-tokenomics RECORD  26% of seeds — GR80 left holding `commission` alone
  //
  // So the last DISCRIMINATING slot in a lane is pinned too. Where a lane has
  // several this changes nothing; where it has exactly one, that one now always
  // plays. It cannot leak: `slotDiscriminates` compares the two authored
  // branches against each other and is a fact about the SLOT, identical for
  // every instance — the same reason `discriminates` is safe to derive here at
  // all. What it must never do is reach the floor, and it still doesn't.
  //
  // A single-slot lane whose one slot is VIBES stays exactly as it was —
  // backdoor-fork's and anon-but-real's `chart` are unsettleable on purpose,
  // and there is no discriminating slot in that lane to pin. Barron's job there
  // is to tell you price movement is not evidence, which is `[A§15]`'s lesson
  // and not a gap.
  const PLAYED = 6;
  const laneCounts = {};
  const laneDiscCounts = {};
  for (const s of A.SLOTS) {
    laneCounts[s.lane] = (laneCounts[s.lane] || 0) + 1;
    if (slotDiscriminates(s)) laneDiscCounts[s.lane] = (laneDiscCounts[s.lane] || 0) + 1;
  }
  const mustKeep = (s) =>
    s.loadBearing
    || laneCounts[s.lane] === 1
    || (slotDiscriminates(s) && laneDiscCounts[s.lane] === 1);

  const forced = A.SLOTS.filter(mustKeep);
  const optional = A.SLOTS.filter((s) => !mustKeep(s));
  for (let i = optional.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [optional[i], optional[j]] = [optional[j], optional[i]];
  }
  const chosen = new Set([...forced, ...optional.slice(0, Math.max(0, PLAYED - forced.length))].map((s) => s.id));
  // Keep authored order — the pitch has a rhythm and shuffling it reads wrong.
  const played = A.SLOTS.filter((s) => chosen.has(s.id));

  const claims = played.map((slot) => {
    const b = slot[branch];
    return {
      id: slot.id,
      speaker: "demon",
      shape: slot.shape,
      // Which adviser could settle this, and its agenda-rail label. The lane
      // is public from second zero — the game is materiality and timing (which
      // claim inside a lane deserves the one use), not a lane map you memorise.
      lane: slot.lane,
      subject: slot.subject,
      // Does pressing this claim tell you WHICH BRANCH you're in? Derived from
      // the authored data rather than hand-tagged, so it can never drift out of
      // sync with the prose. Never sent to the FLOOR — autopsy only.
      discriminates: slotDiscriminates(slot),
      // loadBearing only means anything when there IS something to find.
      loadBearing: !!slot.loadBearing,
      // THE FRAMING SENTENCE THE SELLER OPENS THE POINT WITH. Slot-level and
      // therefore branch-independent by construction, exactly like `fact` and
      // `spin`: it is deck language, never evidence, so there is nothing in it
      // that could differ between a rug and an honest run. A claim now reads
      // lead → fact → spin: what this point is about, the checkable specifics,
      // and the inference sold on top of them.
      lead: resolve(slot.lead),
      fact: resolve(slot.fact),
      spin: resolve(slot.spin),
      backing: backingOf(slot) ?? b.backing,
      // GENERIC IS HOISTED TO THE SLOT on every rewritten claim, so the seller's
      // shallow answer CANNOT differ by branch — the leak is now impossible by
      // construction rather than caught by assertion. The per-branch fallback
      // exists for exactly one case: the loadBearing claim, which invariant 1
      // requires stay reachable on a free press and therefore MUST discriminate.
      press: { generic: slot.generic ?? b.generic, sharp: b.sharp },
    };
  });

  return {
    id: `${pickedId}:${seed}`,
    archetype: pickedId,
    // The player-facing name of the pattern. `archetype` is a code slug and was
    // being printed on the post-deal screen; this is what the UI shows.
    archetypeLabel: A.ARCHETYPE_LABEL || pickedId,
    // What would have given it away — the one thing the post-deal screen can
    // teach that the player's own deal can't, because it generalises.
    archetypeTell: A.ARCHETYPE_TELL || "",
    // The pattern library entry this deal is an instance of. Art + dossier are
    // shown at the autopsy — that's where the archetype gets NAMED, so the
    // player leaves with a read they can reuse rather than one token's answer.
    exemplar: (() => {
      const coin = getCardById(A.EXEMPLAR_COIN);
      return coin ? { id: coin.id, name: coin.name, ticker: coin.ticker,
        note: coin.caseRef?.note || "", art: getCardArt(coin.id) } : null;
    })(),
    ticker: vars.ticker,
    name: vars.name,
    chain: vars.chain,
    // WHAT IT IS, in words the record and the opening can both print. Rolled
    // blind of archetype and branch — see the note on vars.sector above.
    sector: vars.sector,
    truth: rolled.truth,          // 1 = rug, 0 = legit
    outcome: branch,
    collapseDay: branch === "rug" ? vars.collapseDay : null,
    verdictLabel: branch === "rug" ? "SHORT" : "LONG",
    surface: {
      age: vars.age, mcap: vars.mcap, holders: vars.holders,
      price: vars.price, change24h: vars.change24h, social: vars.social,
    },
    claims,
    autopsy: A.AUTOPSY[branch],
    // WHAT BECAME OF IT — legit only, and narration only. See fates.js and §7
    // item 7: the archetype's legit line says the CLAIMS held, the fate says
    // what happened to the venture, and they are different axes. A rug branch
    // already has its ending, so it gets no fate.
    //
    // ROLLED OFF ITS OWN STREAM, always, even on a rug. Rolling it only on legit
    // would make the draw conditional on the branch, and the reason it rides a
    // salted stream at all (see FATE_SALT) is so that no roll here can disturb
    // or observe another. Nothing reads `fate` before the reveal.
    fate: branch === "legit" ? fate : null,
    resolution: branch === "legit"
      ? `${A.RESOLUTION.legit(vars)} ${fateLine(fate, vars.name)}`
      : A.RESOLUTION.rug(vars),
  };
}

/* ---------------------------------------------------------------------- *
 * EVERY DEAL IS A FRESH ROLL.
 *
 * `pressRun.js` — the controller — never sees a seed; it takes a deal object.
 * So which deal you get is purely which number goes into instanceDeal(), which
 * is why changing this costs nothing and never touches the resolver.
 *
 * THE HISTORY, BECAUSE IT'S A RULE AND NOT A STORY. The deal used to always be
 * dailySeed(), which made the opening dice a lie: you pressed ROLL and received
 * something decided at midnight for everybody — *"if the deal is already
 * predetermined for the day, then rolling the dice is pointless"* (author,
 * 2026-07-28). A LOCAL/DAILY mode split was built to fix it, then cut the same
 * day once the daily's last justification went with the leaderboard:
 *
 *   - leaderboard fairness   -> rejected outright (VC_GAME.md §8)
 *   - anti-reroll-fishing    -> only matters when there's a rank to protect
 *   - BOOK continuity        -> local runs bank just as well
 *   - a shared talking point -> real, but Wordle-shaped, and entirely latent
 *                               until something is built to exploit it
 *
 * The last one is the only live argument and it is a bet on traction:
 * *"that seems like a build-out for the scenario where the game gets lots and
 * lots of traction and buzz — not likely. But I am hoping for a nice little
 * engagement puzzle."* A nice little engagement puzzle wants a fresh deal every
 * sitting and a collection to fill, not a daily ritual with nowhere to go.
 *
 * `dailySeed` is KEPT and unused. It is six lines, it is the whole restore
 * path, and deleting it would only mean rewriting it if a share hook ever
 * lands. Nothing calls it.
 * ---------------------------------------------------------------------- */

/**
 * A fresh deal, every time you sit down. Genuinely random per call — the one
 * place in this game where that's correct, because it IS the roll. Everything
 * downstream stays pure: instanceDeal(seed) is deterministic, so any run can
 * still be replayed exactly from its seed.
 */
export function rollSeed() {
  // 1..2^31, avoiding 0 because callers treat a falsy seed as "not set".
  return 1 + Math.floor(Math.random() * 2147483646);
}

/** UTC date seed. UNUSED — see the note above; kept as the restore path for a
 *  shared daily, which needs a social hook to be worth anything. */
export function dailySeed(d = null) {
  const now = d || new Date();
  return Number(
    `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, "0")}${String(now.getUTCDate()).padStart(2, "0")}`
  );
}
