// Checks on the address-bar memory of where you were watching. The cases that
// matter are the ones where somebody comes back: after a sign-in, from a
// bookmark, or with a link to an episode that has since been taken off.

import assert from "node:assert";

let passed = 0;
let failed = 0;

function check(name, actual, expected) {
  try {
    assert.deepStrictEqual(actual, expected);
    console.log(`  ✓ ${name}`);
    passed += 1;
  } catch (error) {
    console.log(`  ✗ ${name}`);
    console.log(`      expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    failed += 1;
  }
}

function group(name) {
  console.log(`\n${name}:`);
}

const { WATCH_PARAM, readWatch, watchValue, withWatch } = await import("../src/lib/ltTv/watchUrl.mjs");

const SHOWS = [
  { id: "news", episodes: [{ id: "news-01" }] },
  { id: "morality", episodes: [{ id: "morality-01" }, { id: "morality-02" }] },
];

group("Writing where you are");
check("in a show, the episode", watchValue({ open: true, view: "set", showId: "news", episodeId: "news-01" }), "news-01");
check("on the lineup, the show", watchValue({ open: true, view: "lineup", showId: "morality" }), "morality");
check("LT TV closed, nothing", watchValue({ open: false, view: "set", episodeId: "news-01" }), null);
check("nothing at all", watchValue(), null);
check(
  "in a show with no episode yet falls back to the show",
  watchValue({ open: true, view: "set", showId: "news", episodeId: null }),
  "news",
);

group("Reading it back");
check("an episode puts you in the show", readWatch("news-01", SHOWS), { view: "set", showId: "news", episodeIndex: 0 });
check("the second episode of a show", readWatch("morality-02", SHOWS), { view: "set", showId: "morality", episodeIndex: 1 });
check("a show id puts you on the lineup", readWatch("morality", SHOWS), { view: "lineup", showId: "morality", episodeIndex: 0 });
check("an episode that is no longer on the slate is ignored", readWatch("morality-09", SHOWS), null);
check("a show that no longer exists is ignored", readWatch("liminal", SHOWS), null);
check("an empty value is ignored", readWatch("", SHOWS), null);
check("a non-string is ignored", readWatch(7, SHOWS), null);
check("__proto__ names nothing", readWatch("__proto__", SHOWS), null);
check("no slate, no position", readWatch("news-01", undefined), null);
check("a show with no episodes yet", readWatch("news-01", [{ id: "news" }]), null);

group("Putting it in the address without losing what is there");
check("added to an empty address", withWatch("", "news-01"), "?lttv=news-01");
check("added beside another parameter", withWatch("?tune=lights", "news-01"), "?tune=lights&lttv=news-01");
check("replaced, not doubled", withWatch("?lttv=news-01", "morality-01"), "?lttv=morality-01");
check("removed when LT TV closes", withWatch("?tune=lights&lttv=news-01", null), "?tune=lights");
check("removing the only parameter leaves a clean address", withWatch("?lttv=news-01", null), "");
check("the parameter is the one the page reads", WATCH_PARAM, "lttv");

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
