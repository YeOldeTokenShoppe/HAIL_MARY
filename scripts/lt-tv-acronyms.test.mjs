// Tests for the spoken-acronym check, with:
//
//   node scripts/lt-tv-acronyms.test.mjs
//
// The rule is easy to state and easy to get subtly wrong in two directions,
// and both are costly: a missed one puts an unexplained noise on air (the
// first news episode said "FRED" four times and never once said what it was),
// while a false one nags a writer about a line that is already correct, which
// is how a warning list stops being read at all.

import { unexpandedAcronyms, SPOKEN_ACRONYMS, ACRONYMS_TAKEN_AS_READ, TITLE_RULES } from "./lt-tv-format.mjs";

let failures = 0;
const check = (label, actual, expected) => {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) return console.log(`  ✓ ${label}`);
  console.log(`  ✗ ${label}\n      expected ${e}\n      got      ${a}`);
  failures += 1;
};
const ok = (label, cond) => check(label, Boolean(cond), true);

const lines = (...texts) => texts.map((text, n) => ({ n, text }));
const names = (found) => found.map((f) => f.acronym);

console.log("\nAn acronym spoken before it is expanded:");
{
  check(
    "is reported, with the line it is on",
    unexpandedAcronyms(lines("FRED says the curve steepened.")),
    [{ n: 0, acronym: "FRED", expansion: "Federal Reserve Economic Data" }],
  );
  check(
    "and so is a plural or a possessive",
    names(unexpandedAcronyms(lines("The ETFs bled out.", "CPI's print was hot."))),
    ["ETF", "CPI"],
  );
}

console.log("\nAn acronym that has been expanded is not reported:");
{
  check(
    "expanded in the same line, before it",
    unexpandedAcronyms(lines("Federal Reserve Economic Data — FRED — says otherwise.")),
    [],
  );
  check(
    "expanded in the same line, after it",
    unexpandedAcronyms(lines("FRED, the Federal Reserve Economic Data, says otherwise.")),
    [],
  );
  check(
    "expanded in an earlier line",
    unexpandedAcronyms(lines("The Consumer Price Index landed.", "CPI again next month.")),
    [],
  );
  check(
    "expanded in a wording we accept instead of the official name",
    unexpandedAcronyms(lines("Pull the Federal Reserve's economic data. FRED has it.")),
    [],
  );
  check("expanded in lower case", unexpandedAcronyms(lines("An exchange-traded fund. The ETF bled.")), []);
}

console.log("\nNoise control:");
{
  check(
    "one warning per acronym, not one per mention",
    names(unexpandedAcronyms(lines("FRED.", "FRED again.", "And FRED."))),
    ["FRED"],
  );
  check(
    "letters inside a longer word are not a mention",
    unexpandedAcronyms(lines("Fredericks bought a QEII stamp and an APRIL contract.")),
    [],
  );
  check(
    "lower-case prose is not a mention",
    unexpandedAcronyms(lines("He was apr about it and said gdp under his breath.")),
    [],
  );
  check(
    "the ones everyone says out loud are exempt",
    unexpandedAcronyms(lines("The SEC, the IRS, the CEO, some AI, and pure FOMO.")),
    [],
  );
}

console.log("\nThe tables themselves:");
{
  ok("every acronym has an expansion", Object.values(SPOKEN_ACRONYMS).every((a) => a.expansion?.length > 3));
  ok(
    "no acronym is in both tables",
    !Object.keys(SPOKEN_ACRONYMS).some((a) => ACRONYMS_TAKEN_AS_READ.includes(a)),
  );
  ok(
    "an expansion never contains its own acronym, which would exempt it forever",
    Object.entries(SPOKEN_ACRONYMS).every(
      ([acronym, { expansion, also }]) =>
        ![expansion, ...(also || [])].some((form) => new RegExp(`\\b${acronym}\\b`).test(form)),
    ),
  );
}

console.log("\nThe title rules, which are prompt text and are shared by both shows:");
{
  ok("name the failure they exist to prevent", /Hike Barrel Charizard/.test(TITLE_RULES));
  ok("say how long a title may be", /\bsix words\b/.test(TITLE_RULES));
  ok("give examples of the right shape", /The Cut That Wasn't/.test(TITLE_RULES));
}

console.log(failures === 0 ? "\nAll checks passed.\n" : `\n${failures} failed.\n`);
process.exit(failures === 0 ? 0 : 1);
