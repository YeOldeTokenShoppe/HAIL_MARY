// Tests for the pitch — pass 1, saved and argued with, with:
//
//   node scripts/lt-tv-pitch.test.mjs
//
// The load-bearing rule here is not that a change lands. It is that the ones
// which must NOT land do not: a story's fact, its sources and the board were
// confirmed against a real article in the rundown pass, and this show's whole
// claim is that everything it says out loud was checked. A number reworded in
// conversation is a number nobody checked.
//
// The rest is the outline itself, which is the only form of the pitch anybody
// reads, and the running order, which is the one change that looks harmless
// and moves which story lands in the slot the skeleton treats as the joke.

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import {
  renderPitch,
  pitchKind,
  editableFields,
  validatePitchChanges,
  applyPitchChanges,
  summarisePitch,
} from "./lt-tv-pitch.mjs";

let failures = 0;
const check = (label, actual, expected) => {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) return console.log(`  ✓ ${label}`);
  console.log(`  ✗ ${label}\n      expected ${e}\n      got      ${a}`);
  failures += 1;
};
const ok = (label, cond) => check(label, Boolean(cond), true);
const throws = (label, fn, match) => {
  try {
    fn();
    console.log(`  ✗ ${label}\n      expected it to refuse, and it did not`);
    failures += 1;
  } catch (err) {
    if (match && !String(err.message).includes(match)) {
      console.log(`  ✗ ${label}\n      refused with the wrong reason: ${err.message}`);
      failures += 1;
      return;
    }
    console.log(`  ✓ ${label}`);
  }
};

// The rundown of a real episode, taken from the worked sample rather than
// invented, so the shape here is the shape the generator actually writes.
const NEWS = JSON.parse(
  await readFile(resolve("content/lt-tv/samples/news-2026-W38.sample.json"), "utf8"),
).rundown;
const ARGUMENT = JSON.parse(
  await readFile(resolve("content/lt-tv/samples/morality-01.sample.json"), "utf8"),
).rundown;

const apply = (plan, kind, changes) => applyPitchChanges(plan, validatePitchChanges(changes, plan, kind));

console.log("\nwhich pitch a show makes");
{
  check("the news show picks stories", pitchKind("news"), "news");
  check("Markets & Morality picks an argument", pitchKind("morality"), "argument");
  check("and so does the roundtable it is the format of", pitchKind("roundtable"), "argument");
}

console.log("\nthe outline a person reads");
{
  const text = renderPitch(NEWS, { show: "news", id: "news-01", week: "2026-W38" });
  ok("it is headed by the show and the week", text.startsWith("LT WEEKLY NEWS RECAP — PITCH FOR 2026-W38"));
  ok("the title is in it", text.includes(NEWS.title));
  ok("and every story", (NEWS.stories || []).every((s) => text.includes(s.headline)));
  ok("with the fact each one rests on", (NEWS.stories || []).every((s) => text.includes(s.fact)));
  ok("and both angles", (NEWS.stories || []).every((s) => text.includes(s.connorAngle) && text.includes(s.gr80Angle)));
  // Where a number came from is the question this show has to be able to
  // answer, so the outline answers it without being asked.
  const sourced = (NEWS.stories || []).flatMap((s) => s.sources || []);
  ok("every source it was confirmed from", sourced.length > 0 && sourced.every((src) => text.includes(src.outlet)));
  ok("it says it is not the script", text.includes("This is the idea, not the script"));
  ok("and that the facts are not editable here", text.includes("not editable"));

  const argument = renderPitch(ARGUMENT, { show: "morality", id: "morality-01" });
  ok("an argument pitch leads with the question", argument.includes(ARGUMENT.question));
  ok("and says who concedes, by name", argument.includes("WHO CONCEDES"));
  ok("with GR80 written as he is spoken about", !argument.includes("Monk —"));
  ok("and what the concession costs", argument.includes(ARGUMENT.concession.what));
  ok("it names the show it is for", argument.startsWith("MARKETS & MORALITY — PITCH"));
}

console.log("\nwhat the room may set");
{
  const news = editableFields(NEWS, "news");
  ok("the title and the chiron", news.includes("title") && news.includes("headline"));
  ok("and each story's angles", news.includes("story-1.connorAngle") && news.includes("story-1.gr80Angle"));
  ok("but never a fact", !news.some((f) => f.endsWith(".fact")));
  ok("never a source", !news.some((f) => f.includes("source")));
  ok("and never the board", !news.includes("board"));

  const argument = editableFields(ARGUMENT, "argument");
  ok("every part of the argument", ["question", "connorCase", "gr80Reframe", "hardCase", "landing"].every((f) => argument.includes(f)));
  ok("and who concedes", argument.includes("concession.who"));
}

console.log("\nchanging the judgment");
{
  const { plan, applied } = apply(NEWS, "news", [
    { op: "set", field: "title", text: "A Better Name", why: "the old one is a summary" },
    { op: "set", field: "story-2.connorAngle", text: "He would call that a rounding error." },
  ]);
  check("both land", applied.length, 2);
  check("the title changed", plan.title, "A Better Name");
  check("and the angle", plan.stories[1].connorAngle, "He would call that a rounding error.");
  check("the fact under it did not", plan.stories[1].fact, NEWS.stories[1].fact);
  check("and the pitch it came from is untouched", NEWS.title !== "A Better Name", true);
  ok("it says what it did", summarisePitch(applied).includes("title"));

  const conceded = apply(ARGUMENT, "argument", [{ op: "set", field: "concession.who", text: "Saint GR80" }]);
  check("a host is named the way he is spoken about, and stored the way he is recorded",
    conceded.plan.concession.who, "Monk");
  check("and what he concedes is left alone", conceded.plan.concession.what, ARGUMENT.concession.what);
}

console.log("\nthe running order");
{
  const slots = NEWS.stories.map((s) => s.slot);
  const { plan } = apply(NEWS, "news", [{ op: "order", slots: [slots[2], slots[0], slots[1]], why: "the card story is the joke" }]);
  // The SLOT is which segment a story is written into and the skeleton always
  // plays 1, 2, 3 — so reordering has to move the stories between the slots.
  // Leaving them with the slots they arrived with would reorder the list and
  // change nothing on air, which is the failure worth a test.
  check("the stories come back in the order asked for",
    plan.stories.map((s) => s.headline),
    [NEWS.stories[2].headline, NEWS.stories[0].headline, NEWS.stories[1].headline]);
  check("and the slots still run in the skeleton's order", plan.stories.map((s) => s.slot), slots);
  check("nothing else about a story moved with it", plan.stories[0].fact, NEWS.stories[2].fact);
}

console.log("\nwhat it refuses");
{
  const bad = (changes, plan = NEWS, kind = "news") => () => validatePitchChanges(changes, plan, kind);
  throws("a story's fact", bad([{ op: "set", field: "story-1.fact", text: "Something else entirely." }]), "checked fact");
  throws("its sources", bad([{ op: "set", field: "story-1.sources", text: "trust me" }]), "checked fact");
  throws("marking an unconfirmed story confirmed", bad([{ op: "set", field: "story-1.verified", text: "true" }]), "checked fact");
  throws("the board", bad([{ op: "set", field: "board", text: "The ten-year did something." }]), "checked fact");
  throws("a field that does not exist", bad([{ op: "set", field: "vibes", text: "good" }]), "not something the pitch lets you set");
  throws("an empty replacement", bad([{ op: "set", field: "title", text: "   " }]), "came back empty");
  throws("an op it does not have", bad([{ op: "delete-story", field: "story-1" }]), "not something a pitch can do");
  throws("a running order missing a story", bad([{ op: "order", slots: ["story-1", "story-2"] }]), "every story once");
  throws("a running order that repeats one", bad([{ op: "order", slots: ["story-1", "story-1", "story-2"] }]), "every story once");
  throws("a third host conceding", bad([{ op: "set", field: "concession.who", text: "the audience" }], ARGUMENT, "argument"), "not one of the two hosts");

  // The same rule as the screenplay room: a proposal she said yes to lands
  // completely or not at all.
  throws(
    "one bad change refuses the lot",
    bad([{ op: "set", field: "title", text: "Fine" }, { op: "set", field: "story-1.fact", text: "Not" }]),
    "checked fact",
  );
  check("and nothing at all is fine", validatePitchChanges(undefined, NEWS, "news"), []);
}

console.log(failures ? `\n${failures} failure(s)\n` : "\nAll good.\n");
process.exit(failures ? 1 : 0);
