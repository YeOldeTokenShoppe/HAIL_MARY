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
