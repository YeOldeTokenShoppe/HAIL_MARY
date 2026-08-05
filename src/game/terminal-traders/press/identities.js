// THE NAME POOL — shared by every archetype, and that is the entire point.
//
// THE BUG THIS FIXES. Identities used to be authored PER ARCHETYPE, five names
// under backdoor-fork, four under yield-mirage, five under anon-but-real —
// fourteen names, zero overlap. So the deal's name mapped 1:1 to its archetype,
// and memorising one short list handed you the pattern before Connor had
// said a word. backdoorFork.js described the intent correctly — "instances
// differ by surface identity so the player can't pattern-match on the name" —
// and the implementation did the exact opposite of it.
//
// WHY IT WENT FROM UNTIDY TO FATAL. With only backdoor-fork (74% rug) and
// yield-mirage (68% rug) built, knowing which one you faced moved your prior
// six points, so the leak was nearly free. anon-but-real runs 70% LEGIT, which
// makes correctly identifying the archetype worth a ~44 point swing — the
// single most valuable read in the game. A name that gives it away for free
// deletes the thing the game is about.
//
// THE RULES FOR ADDING A NAME, and they are not stylistic:
//
//   1. IT MUST NOT SUGGEST A MECHANISM. "SIREN YIELD" belongs to a ponzi,
//      "KEYSTONE VAULT" to a fork. Both were real entries here and both told
//      you the read.
//   2. IT MUST NOT SUGGEST A TEAM STYLE. "NIGHTJAR", "PALE FOX", "GREY HERON"
//      all read as pseudonymous-crypto-handle, which pointed straight at
//      anon-but-real.
//   3. IT MUST BE PLAUSIBLE FOR ANY ARCHETYPE, including ones not written yet.
//      A name that only fits some of the thirteen is a partial leak.
//
// Deliberately corporate and slightly boring. A name that carries no
// information is doing its job.
export const IDENTITIES = [
  { name: "MERIDIAN PROTOCOL", ticker: "$MRDN" },
  { name: "HARBORLIGHT", ticker: "$HRBR" },
  { name: "NORTHWIND FINANCE", ticker: "$NRTH" },
  { name: "ALDERMAN", ticker: "$ALDR" },
  { name: "TIDEWATER", ticker: "$TIDE" },
  { name: "GOLDEN HOUR", ticker: "$GLDH" },
  { name: "COLDWATER", ticker: "$CLDW" },
  { name: "SEVEN BELLS", ticker: "$BELL" },
  { name: "CASTLEGATE", ticker: "$CSTL" },
  { name: "BRIGHTLINE", ticker: "$BRLN" },
  { name: "STILLWATER", ticker: "$STLW" },
  { name: "FAIRWEATHER", ticker: "$FAIR" },
  { name: "LANTERN WORKS", ticker: "$LNTN" },
  { name: "OAKFIELD", ticker: "$OAKF" },
  { name: "REDPOINT LABS", ticker: "$RDPT" },
  { name: "SUMMERHILL", ticker: "$SMRH" },
  { name: "VANTAGE ROW", ticker: "$VNTG" },
  { name: "WESTBROOK", ticker: "$WSTB" },
];

// One chain for now. Kept here rather than on the identity so a future
// multi-chain roll can't accidentally become another per-archetype tell.
export const CHAINS = ["Base"];

/**
 * WHAT THE PROJECT ACTUALLY IS — added 2026-08-04.
 *
 * THE HOLE THIS FILLS. A deal used to be a name, a ticker, a chain and six
 * surface numbers, and nothing anywhere said what the thing DID. The bot opened
 * with "This is WESTBROOK: $WSTB, on Base" and then made a claim about its TEAM,
 * so the player was asked to judge the case for funding a company whose business
 * had never been stated ("there is no context to this claim", author 2026-08-04).
 * Every claim was an attribute of an unspecified thing.
 *
 * IT WENT MISSING FOR A GOOD REASON, which is why the fix belongs HERE and not
 * in an archetype. Rule 1 above bars the NAME from suggesting a mechanism —
 * "SIREN YIELD" belongs to a ponzi, "KEYSTONE VAULT" to a fork — so the design
 * correctly stripped every hint of what the project was, and then never replaced
 * it with a neutral one. A premise authored per archetype would reopen exactly
 * the leak the name pool was built to close.
 *
 * THE RULE FOR ADDING ONE, and it is stricter than the name rules:
 *
 *   IT MUST BE PLAUSIBLE FOR EVERY ARCHETYPE, INCLUDING UNWRITTEN ONES.
 *
 * Which in practice means it must take deposits, pay a return, and be an
 * upgradeable contract with a token — because yield-mirage needs something that
 * PAYS (its whole case is where the yield comes from), backdoor-fork needs an
 * upgrade path to hide a door in, and bad-tokenomics needs a supply schedule.
 * "A DEX aggregator" and "a bridge" were both considered and rejected on this:
 * neither pays a depositor, so a yield-mirage deal could not sit on one, and a
 * premise that only fits some archetypes is the name leak again in a new field.
 *
 * Deliberately generic, for the same reason the names are boring.
 */
export const SECTORS = [
  "a lending market",
  "a perpetuals venue",
  "a liquid-staking product",
  "an RWA credit vault",
  "a structured-yield vault",
  "a money market",
];

/**
 * CLAIMED PRIOR ROLES — shared, for exactly the reason the names above are.
 *
 * THE SAME BUG, FOUND AGAIN ON 2026-08-03 while authoring archetype #4. PRIORS
 * was authored per archetype and yield-mirage's list was DISJOINT from the
 * other two's: backdoor-fork and anon-but-real both drew from the protocol
 * names, yield-mirage from trading desks. So `ex-Jump` in the deal sheet
 * identified yield-mirage outright, and `ex-Aave` narrowed the field to two.
 *
 * Narrower than the identity leak — it separated one archetype rather than
 * all three — but the same rule 5 violation, and adding a fourth per-archetype
 * list would have widened it. Both lists are pooled here instead, so a prior
 * role is plausible for every archetype and tells you nothing about which one
 * you are in. That is the only property this array has to have.
 *
 * AUDITORS were already identical in all three files and are pooled for the
 * same reason: one copy cannot drift into a tell.
 */
export const PRIORS = [
  "ex-Aave", "ex-MakerDAO", "ex-Compound", "ex-Lido",
  "ex-Jump", "ex-Alameda", "ex-Cumberland", "ex-GSR",
];

export const AUDITORS = ["Trail of Bits", "Spearbit", "OpenZeppelin", "Zellic"];
