// Tests for the dashboard, run with:
//
//   node scripts/lt-tv-status.test.mjs
//
// The dashboard's one promise is that it reports what is on disk rather than
// what it remembers, so every check here works by putting files in a temporary
// repo and asking what it says. If it ever starts inferring a stage from
// anything but a file, these fail.

import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readStatus, findRoot } from "./lt-tv-status.mjs";
import { renderStatusPage } from "./lt-tv-status-page.mjs";

let failures = 0;
const check = (label, actual, expected) => {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) return console.log(`  ✓ ${label}`);
  console.log(`  ✗ ${label}\n      expected ${e}\n      got      ${a}`);
  failures += 1;
};
const ok = (label, cond) => check(label, Boolean(cond), true);

/** A throwaway repo with exactly the files a case needs. */
async function fixture(files) {
  const root = await mkdtemp(join(tmpdir(), "lttv-status-"));
  for (const [path, body] of Object.entries(files)) {
    const full = join(root, path);
    await mkdir(join(full, ".."), { recursive: true });
    await writeFile(full, typeof body === "string" ? body : JSON.stringify(body));
  }
  return root;
}

const slatePath = (id) => `src/content/lt-tv/episodes/${id}.json`;
const stagePath = (id) => `content/lt-tv/episodes/${id}.json`;
const indexFor = (ids) =>
  ids.map((i) => `import x from "./episodes/${i}.json";`).join("\n");

const planned = { id: "roundtable-02", showId: "roundtable", number: "02", title: "The Wealth Effect", summary: "Paper gains." };
const written = { ...planned, speakers: ["Connor", "Monk"], audienceLines: [0], cues: [], estimatedRuntime: "04:29" };
const onAir = { ...written, audio: { Connor: "lttv_rt_ep02_connor", Monk: "lttv_rt_ep02_gr80" }, lineStarts: [0, 4], dialogueEnd: 9.5 };

const staging = (timing = null) => ({
  id: "roundtable-02", show: "roundtable", number: "02", title: "The Wealth Effect",
  slate: { runtime: "04:29", words: 649 },
  segments: [{ id: "the-question", lines: [{ n: 0, actor: "Connor", text: "A." }, { n: 1, actor: "Monk", text: "B." }] }],
  cast: { Connor: { sitepalAudio: "lttv_rt_ep02_connor" }, Monk: { sitepalAudio: "lttv_rt_ep02_gr80" } },
  warnings: [],
  timing: { lineStarts: timing, lineEnds: null, durationSeconds: null, leadIn: 2.5 },
});

const only = async (files) => (await readStatus(await fixture(files))).episodes[0];

console.log("\nEach stage is decided by a file, not by memory:");
let e = await only({ [slatePath("roundtable-02")]: planned, "src/content/lt-tv/index.js": indexFor(["roundtable-02"]) });
check("a title and nothing else is planned", e.stage, "planned");
check("and the next step is to write it", e.next.run, "npm run lt:roundtable -- --topic roundtable-02");

e = await only({ [slatePath("roundtable-02")]: written, [stagePath("roundtable-02")]: staging(), "src/content/lt-tv/index.js": indexFor(["roundtable-02"]) });
check("a script with no audio is written", e.stage, "written");
ok("and the next step records it", e.next.run.startsWith("npm run lt:audio"));
ok("pointing first at the screenplay", e.next.then.includes("lt:edit"));

e = await only({ [slatePath("roundtable-02")]: written, [stagePath("roundtable-02")]: staging([0, 4]), "src/content/lt-tv/index.js": indexFor(["roundtable-02"]) });
check("timing in the working record means recorded", e.stage, "recorded");
ok("and the next step splits the master", e.next.run.includes("lt:split"));
ok("then hands over to the join, never to the generator", e.next.then.includes("lt:slate"));

e = await only({ [slatePath("roundtable-02")]: onAir, [stagePath("roundtable-02")]: staging([0, 4]), "src/content/lt-tv/index.js": indexFor(["roundtable-02"]) });
check("clip names and line starts mean on air", e.stage, "on-air");
check("with nothing left to do", e.next.run, null);

console.log("\nThe trap the guide itself has:");
// episodeIsPlayable needs BOTH audio and lineStarts. A record with one of them
// is not playable, and calling it on air here would say an episode is live
// when the guide will not offer a Play button for it.
e = await only({ [slatePath("roundtable-02")]: { ...written, audio: { Connor: "x", Monk: "y" } }, "src/content/lt-tv/index.js": indexFor(["roundtable-02"]) });
check("clip names without line starts is not on air", e.stage, "written");
e = await only({ [slatePath("roundtable-02")]: { ...written, lineStarts: [0, 4] }, "src/content/lt-tv/index.js": indexFor(["roundtable-02"]) });
check("line starts without clip names is not on air either", e.stage, "written");

console.log("\nAn episode nothing imports is invisible on the site:");
e = await only({ [slatePath("roundtable-02")]: onAir, "src/content/lt-tv/index.js": "// nothing imported" });
check("so that is what it is told to fix", e.registered, false);
ok("and the next step says so", e.next.run.includes("EPISODE_RECORDS"));
ok("in the words of the actual problem", e.next.why.includes("nothing imports it"));

console.log("\nIt finds the files, which is the point:");
const root = await fixture({
  [slatePath("roundtable-02")]: written,
  [stagePath("roundtable-02")]: staging(),
  "content/lt-tv/episodes/roundtable-02.txt": "THE LIMINAL TERMINAL — The Wealth Effect",
  "content/lt-tv/audio/roundtable-02/master-dialogue.wav": "RIFF",
  "content/lt-tv/samples/roundtable-02.draft.json": {},
  "src/content/lt-tv/index.js": indexFor(["roundtable-02"]),
});
const found = (await readStatus(root)).episodes[0];
const paths = found.files.map((f) => f.path.replace(/\\/g, "/"));
ok("the slate record", paths.includes("src/content/lt-tv/episodes/roundtable-02.json"));
ok("the working record", paths.includes("content/lt-tv/episodes/roundtable-02.json"));
ok("the screenplay", paths.includes("content/lt-tv/episodes/roundtable-02.txt"));
ok("the recorded master", paths.includes("content/lt-tv/audio/roundtable-02/master-dialogue.wav"));
ok("the worked sample, flagged as one", found.files.find((f) => f.path.includes("samples")).what.includes("not a scheduled episode"));
ok("each file says what it is for", found.files.every((f) => f.what));
ok("the screenplay is the one it points at", found.files.find((f) => f.path.endsWith(".txt")).what.includes("read and edit"));
ok("a file that is not there is not listed", !paths.some((p) => p.includes("voice-segments")));

console.log("\nSitePal is outside the repo and it says so:");
ok("clip names are reported", found.clips.includes("lttv_rt_ep02_connor"));
const page = renderStatusPage(await readStatus(root));
ok("the page never claims the upload was checked", page.includes("not checked against the Audio Manager"));
ok("and the footer repeats why", page.includes("the Audio Manager lives outside the repo"));

console.log("\nGrouping and the page:");
const many = await readStatus(await fixture({
  [slatePath("roundtable-02")]: planned,
  [slatePath("news-01")]: { id: "news-01", showId: "news", number: "01", title: "A Week" },
  [slatePath("orphan-01")]: { id: "orphan-01", showId: "gardening", number: "01", title: "Compost" },
  "src/content/lt-tv/index.js": indexFor(["roundtable-02", "news-01"]),
}));
// Every show on the slate is listed, including one with nothing on it yet:
// a show that vanishes until it has an episode is a show nobody can see they
// need to write for.
check("each show gets its own episodes", many.shows.map((s) => `${s.id}:${s.episodes.length}`),
  ["news:1", "roundtable:1", "morality:0"]);
check("an episode of no known show is not dropped", many.orphans.map((e) => e.id), ["orphan-01"]);
const p2 = renderStatusPage(many);
ok("the page lists both shows", p2.includes("LT Weekly News Recap") && p2.includes("The Liminal Terminal"));
ok("and surfaces the orphan rather than hiding it", p2.includes("Not attached to any show"));
ok("it says it is a snapshot", p2.includes("snapshot"));
ok("and how to refresh it", p2.includes("lt-tv-status.mjs --html"));
ok("it is a whole document", p2.startsWith("<!doctype html>") && p2.trimEnd().endsWith("</html>"));
ok("it works in dark mode", p2.includes("prefers-color-scheme: dark"));
ok("it fetches nothing", !/<script|https?:\/\//i.test(p2.replace(/<title>[\s\S]*?<\/title>/, "")));

console.log("\nHostile titles do not break the page:");
const nasty = await readStatus(await fixture({
  [slatePath("news-01")]: { id: "news-01", showId: "news", number: "01", title: '<script>alert(1)</script>', summary: 'a & b "c"' },
  "src/content/lt-tv/index.js": indexFor(["news-01"]),
}));
const p3 = renderStatusPage(nasty);
ok("a title is escaped, not executed", !p3.includes("<script>alert"));
ok("and still readable", p3.includes("&lt;script&gt;alert(1)&lt;/script&gt;"));
ok("ampersands too", p3.includes("a &amp; b"));

console.log("\nAn empty repo says so rather than failing:");
const empty = await readStatus(await fixture({ "src/content/lt-tv/index.js": "" }));
check("no episodes", empty.episodes.length, 0);
ok("every show still appears", empty.shows.length === 3);
ok("and the page renders", renderStatusPage(empty).includes("Nothing on the slate yet"));

console.log("\nThe commands it prints are the ones that work from anywhere:");
// `npm run` starts in the repo root; `node scripts/...` is relative to whoever
// typed it. A dashboard is read from whatever directory you are standing in,
// so printing the second form makes it hand out commands that fail.
const everyRun = (await readStatus(await fixture({
  [slatePath("roundtable-02")]: planned,
  [slatePath("news-01")]: { id: "news-01", showId: "news", number: "01", title: "A Week" },
  "src/content/lt-tv/index.js": indexFor(["roundtable-02", "news-01"]),
}))).episodes.map((e) => e.next.run).filter(Boolean);
ok("there are commands to check", everyRun.length >= 2);
ok("none of them is a bare node path", everyRun.every((r) => !r.startsWith("node scripts/")));

console.log("\nIt finds the repo from wherever you run it:");
// A dashboard is the script you reach for from whatever directory you are
// already in. Requiring the repo root would make it wrong exactly when it is
// most useful, and wrong quietly — an empty slate rather than an error.
const nested = await fixture({
  [slatePath("roundtable-02")]: planned,
  "src/content/lt-tv/index.js": indexFor(["roundtable-02"]),
  "scripts/placeholder.txt": "",
});
check("from a subdirectory", findRoot(join(nested, "scripts")), nested);
check("from the root itself", findRoot(nested), nested);
const outside = await fixture({ "unrelated.txt": "" });
check("and outside a repo it reports where it looked", findRoot(outside), outside);
check("which is an empty slate, not a crash", (await readStatus(outside)).episodes.length, 0);

console.log(failures ? `\n${failures} check(s) failed.\n` : "\nAll checks passed.\n");
process.exit(failures ? 1 : 0);
