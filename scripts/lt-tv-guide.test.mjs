// Tests for what the channel menu says about an episode, with:
//
//   node scripts/lt-tv-guide.test.mjs
//
// The guide is the only part of LT TV a viewer reads before deciding whether
// to watch, and it is the one part nobody proof-reads before a deploy — the
// set gets played back, the guide gets glanced at. So the two claims it makes
// that could be wrong without anybody noticing are checked here:
//
//   "New episode", which is a claim about the clock, and
//   which show an episode belongs to, which is a claim about the slate.
//
// Both are read from the committed records, so a bad edit to a record fails
// here rather than on air.

import { readFile, readdir } from "node:fs/promises";
import { resolve, join } from "node:path";

import { isNewEpisode, isBadgePreview, NEW_EPISODE_DAYS, episodeIsPlayable } from "../src/lib/ltTv/episodeTimeline.mjs";

let failures = 0;
const check = (label, actual, expected) => {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) return console.log(`  ✓ ${label}`);
  console.log(`  ✗ ${label}\n      expected ${e}\n      got      ${a}`);
  failures += 1;
};
const ok = (label, cond) => check(label, Boolean(cond), true);

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.parse("2026-09-21T18:00:00Z");
const aired = (airDate) => ({ airDate, audio: { Connor: "x", Monk: "y" }, lineStarts: [0, 4] });

console.log("\n\"New episode\" is a week off the air date:");
ok("today's episode is new", isNewEpisode(aired("2026-09-21"), NOW));
ok("and so is one from six days ago", isNewEpisode(aired("2026-09-15"), NOW));
ok("but the week before is not", !isNewEpisode(aired(new Date(NOW - 8 * DAY).toISOString().slice(0, 10)), NOW));
check("the window is stated once, not per caller", NEW_EPISODE_DAYS, 7);

console.log("\nThe edges that would misfire on a real machine:");
// assemble() stamps airDate from the clock of whoever wrote the episode.
// Michelle is on US Pacific, so an episode written on a Sunday evening is
// stamped Monday — and would spend its first hours not-yet-new if a future
// date were treated as not qualifying.
ok("a date stamped ahead of the viewer's clock is new, not pending",
  isNewEpisode(aired("2026-09-22"), NOW));
// A planned entry already says "Not recorded yet" in the same row. Badging it
// New would promise something to watch that does not exist.
ok("a named but unrecorded episode is never new",
  !isNewEpisode({ airDate: "2026-09-21", status: "planned" }, NOW));
ok("nor is a record with no air date at all",
  !isNewEpisode({ audio: { Connor: "x" }, lineStarts: [0] }, NOW));
ok("a nonsense air date is not new either", !isNewEpisode(aired("last Tuesday"), NOW));
// The components resolve the clock in an effect, so the first render passes
// nothing. That must read as "not new" rather than throwing inside a render.
ok("and no clock yet means no badge, not a crash", !isNewEpisode(aired("2026-09-21"), undefined));

// The badge is only ever on when a recent episode is on the slate, so it is
// the one part of the guide that cannot be checked by looking at it. The
// preview switch exists for that, and must stay hard to turn on by accident.
console.log("\nThe preview switch, for looking at a badge nothing qualifies for:");
ok("?preview=new turns it on", isBadgePreview("?preview=new"));
ok("beside other params too", isBadgePreview("?show=news&preview=new"));
ok("a near miss does not", !isBadgePreview("?preview=newer"));
ok("nor an empty value", !isBadgePreview("?preview="));
ok("nor an unrelated query", !isBadgePreview("?utm_source=x"));
ok("nor no query at all", !isBadgePreview(""));
ok("and a non-string is not a URL", !isBadgePreview(undefined) && !isBadgePreview(null));

console.log("\nThe slate itself, as the guide reads it:");
const SLATE = "src/content/lt-tv/episodes";
const files = (await readdir(resolve(SLATE))).filter((f) => f.endsWith(".json"));
const records = await Promise.all(
  files.map(async (f) => ({ file: f, ...JSON.parse(await readFile(join(resolve(SLATE), f), "utf8")) })),
);
const shows = JSON.parse(await readFile(resolve("src/content/lt-tv/shows.json"), "utf8")).shows;
const index = await readFile(resolve("src/content/lt-tv/index.js"), "utf8");

// The lesson from the news episode that the studio could not find: an id that
// reaches a button has to be the string that names the file on disk.
ok("every record is named by its own id", records.every((r) => r.file === `${r.id}.json`));
ok("and its id is <show>-<NN>", records.every((r) => r.id === `${r.showId}-${r.number}`));
// A record nobody imports is invisible on the site, however complete it looks.
ok("every record is imported by the slate index",
  records.every((r) => index.includes(`./episodes/${r.file}`)));
ok("every record belongs to a show the guide knows",
  records.every((r) => shows.some((s) => s.id === r.showId)));
ok("no two episodes of a show share a number",
  records.every((r, i) => !records.some((o, j) => j !== i && o.showId === r.showId && o.number === r.number)));

// Michelle's decision, 2026-09-21: The Wealth Effect is the first Markets &
// Morality episode, not the roundtable's second. It is checked by title
// because the title is the thing she asked about.
const wealth = records.find((r) => r.title === "The Wealth Effect");
check("The Wealth Effect is on Markets & Morality", wealth?.showId, "morality");
check("as its first episode", wealth?.id, "morality-01");

// Her second decision the same day: two channels, news at the top. The order
// here IS the order the guide draws, and the first show is what /trade opens
// on, so it is worth pinning rather than leaving to whoever edits the file.
check("the channel list is exactly two shows, news first",
  shows.map((s) => s.id), ["news", "morality"]);
ok("The Liminal Terminal is not among them",
  !shows.some((s) => s.title.includes("Liminal Terminal")));
// Removing a show without rehoming its episodes would leave records that are
// imported, valid, and invisible — the failure this guards is silence.
ok("and no record is left pointing at a show that is gone",
  records.every((r) => shows.some((s) => s.id === r.showId)));

// Nothing on the slate is badged today, and that is correct rather than
// broken: the only recorded episode aired in July. This check exists so the
// badge cannot be quietly wrong about a record that IS playable.
const playable = records.filter(episodeIsPlayable);
ok("something is playable at all", playable.length > 0);
ok("and each playable record carries the air date the badge reads",
  playable.every((r) => typeof r.airDate === "string" && Number.isFinite(Date.parse(`${r.airDate}T00:00:00Z`))));

console.log(failures ? `\n${failures} check(s) failed.\n` : "\nAll checks passed.\n");
process.exit(failures ? 1 : 0);
