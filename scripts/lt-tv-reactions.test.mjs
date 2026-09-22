// Checks on episode ratings and comments. The interesting cases are the ones
// where a viewer changes their mind — a star average that counts a re-rating
// twice is wrong in a way nobody notices until the number is silly — and the
// ways a comment box gets abused.

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

const {
  applyRating,
  applyCommentDelta,
  isKnownEpisode,
  normaliseName,
  ratingSummary,
  sortComments,
  validateComment,
  validateRating,
  COMMENT_MAX_LEN,
} = await import("../src/lib/ltTv/reactions.mjs");

group("An episode id is checked against the episodes that exist");
const slate = ["news-01", "morality-01", "morality-02"];
check("a real id passes", isKnownEpisode("news-01", slate), true);
check("an id that merely looks right is refused", isKnownEpisode("news-99", slate), false);
check("a Set works as well as an array", isKnownEpisode("news-01", new Set(slate)), true);
check("traversal is not an episode", isKnownEpisode("../../etc/passwd", slate), false);
check("an empty id is refused", isKnownEpisode("", slate), false);
check("a non-string is refused", isKnownEpisode(1, slate), false);
check("__proto__ is not an episode", isKnownEpisode("__proto__", slate), false);
check("no slate means nothing is known", isKnownEpisode("news-01", undefined), false);

group("A rating is one to five whole stars");
check("three stars", validateRating(3), { ok: true, rating: 3 });
check("one star", validateRating(1), { ok: true, rating: 1 });
check("five stars", validateRating(5), { ok: true, rating: 5 });
check("a numeric string is read as a number", validateRating("4"), { ok: true, rating: 4 });
check("null clears the rating", validateRating(null), { ok: true, rating: null });
check("zero is refused", validateRating(0).ok, false);
check("six is refused", validateRating(6).ok, false);
check("half stars are refused", validateRating(4.5).ok, false);
check("a negative is refused", validateRating(-3).ok, false);
check("nonsense is refused", validateRating("five").ok, false);
check("undefined is refused", validateRating(undefined).ok, false);
check("Infinity is refused", validateRating(Infinity).ok, false);

group("The tally follows a viewer who changes their mind");
check("first rating", applyRating({ count: 0, sum: 0 }, { next: 5 }), { count: 1, sum: 5, average: 5 });
check("a second viewer", applyRating({ count: 1, sum: 5 }, { next: 4 }), { count: 2, sum: 9, average: 4.5 });
check(
  "re-rating moves the sum and leaves the count alone",
  applyRating({ count: 2, sum: 9 }, { previous: 5, next: 1 }),
  { count: 2, sum: 5, average: 2.5 },
);
check(
  "taking a rating back",
  applyRating({ count: 2, sum: 5 }, { previous: 1, next: null }),
  { count: 1, sum: 4, average: 4 },
);
check(
  "the last rating leaving empties the tally",
  applyRating({ count: 1, sum: 4 }, { previous: 4, next: null }),
  { count: 0, sum: 0, average: 0 },
);
check(
  "re-rating to the same value changes nothing",
  applyRating({ count: 3, sum: 12 }, { previous: 4, next: 4 }),
  { count: 3, sum: 12, average: 4 },
);
check("the average is kept to two places", applyRating({ count: 2, sum: 7 }, { next: 4 }), { count: 3, sum: 11, average: 3.67 });
check("a missing tally starts from nothing", applyRating(undefined, { next: 2 }), { count: 1, sum: 2, average: 2 });
check(
  "a drifted tally cannot go negative",
  applyRating({ count: 0, sum: 0 }, { previous: 5, next: null }),
  { count: 0, sum: 0, average: 0 },
);
check(
  "a corrupt tally is read as empty",
  applyRating({ count: "lots", sum: null }, { next: 3 }),
  { count: 1, sum: 3, average: 3 },
);

group("The comment count moves by one at a time");
check("a comment arrives", applyCommentDelta({ commentCount: 4 }, 1), 5);
check("a comment is deleted", applyCommentDelta({ commentCount: 4 }, -1), 3);
check("it never goes below zero", applyCommentDelta({ commentCount: 0 }, -1), 0);
check("a missing count starts at zero", applyCommentDelta(undefined, 1), 1);

group("What a comment may say");
check("ordinary praise", validateComment("  Connor was on form this week.  "), {
  ok: true,
  text: "Connor was on form this week.",
});
check("empty is refused", validateComment("   ").ok, false);
check("null is refused", validateComment(null).ok, false);
check("a link is refused", validateComment("watch this at spam.xyz").ok, false);
check("a bare http link is refused", validateComment("http://x/y").ok, false);
check("a slur is refused", validateComment("you retard").ok, false);
check("a slur in caps is still refused", validateComment("YOU RETARD").ok, false);
check("at the limit it passes", validateComment("a".repeat(COMMENT_MAX_LEN)).ok, true);
check("one over the limit is refused", validateComment("a".repeat(COMMENT_MAX_LEN + 1)).ok, false);

group("The name shown beside a comment");
check("an ordinary handle", normaliseName("  Michelle  "), "Michelle");
check("a long handle is cut", normaliseName("m".repeat(80)).length, 40);
check("a missing handle gets a stand-in", normaliseName(""), "Viewer");
check("null gets a stand-in", normaliseName(null), "Viewer");

group("What the console draws");
check("nothing rated yet", ratingSummary({ count: 0, sum: 0 }), {
  count: 0, average: 0, display: "—", label: "Not rated yet",
});
check("one rating reads in the singular", ratingSummary({ count: 1, sum: 5 }).label, "5.0 out of 5, from 1 rating");
check("a crowd", ratingSummary({ count: 12, sum: 55 }), {
  count: 12, average: 4.58, display: "4.6", label: "4.6 out of 5, from 12 ratings",
});
check("a missing tally", ratingSummary(undefined).display, "—");

group("Comments come back newest first");
const feed = [
  { id: "a", createdAt: 1000 },
  { id: "c", createdAt: { seconds: 3 } },
  { id: "b", createdAt: { toMillis: () => 2000 } },
  { id: "d", createdAt: null },
];
check("ordered by when they were written", sortComments(feed).map((c) => c.id), ["c", "b", "a", "d"]);
check("capped", sortComments(feed, 2).map((c) => c.id), ["c", "b"]);
check("nothing in, nothing out", sortComments(undefined), []);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
