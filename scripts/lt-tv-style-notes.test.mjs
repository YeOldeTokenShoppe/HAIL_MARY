// Tests for the house notes, with:
//
//   node scripts/lt-tv-style-notes.test.mjs
//
// The file is prose with rules in it, edited by a person, and its contents go
// straight into a prompt. So the thing worth proving is the boundary: which
// lines become rules and which stay prose. Getting that wrong either drops a
// rule silently or sends the explanation of the file to the writer as if it
// were one.

import { mkdtemp, mkdir, writeFile, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  parseStyleNotes,
  withStyleNotes,
  readStyleNotes,
  rememberStyleNote,
  STYLE_NOTES_PATH,
} from "./lt-tv-style-notes.mjs";

let failures = 0;
const check = (label, actual, expected) => {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) return console.log(`  ✓ ${label}`);
  console.log(`  ✗ ${label}\n      expected ${e}\n      got      ${a}`);
  failures += 1;
};
const ok = (label, cond) => check(label, Boolean(cond), true);

const FILE = `# House notes

Some explanation, which is for the reader and not for the writer.

- this bullet is above the Rules heading and is not a rule

## How to add one

- nor is this one, under a different heading

## Rules

- Connor never explains his own joke
- nobody says "at the end of the day"

## What does not belong here

- not this either
`;

console.log("\nOnly the bullets under Rules are rules:");
check("the two real ones, in order", parseStyleNotes(FILE), [
  "Connor never explains his own joke",
  'nobody says "at the end of the day"',
]);
check("an empty Rules section has none", parseStyleNotes("## Rules\n\n## Next\n- no"), []);
check("no file at all is no rules, not a crash", parseStyleNotes(undefined), []);
check("a file with no Rules heading has none", parseStyleNotes("# Notes\n\n- a\n- b\n"), []);

console.log("\nA prompt is only changed when there is something to add:");
{
  const base = "You are the writer.";
  check("no rules leaves it byte for byte", withStyleNotes(base, []), base);
  check("and so does undefined", withStyleNotes(base, undefined), base);
  const with1 = withStyleNotes(base, ["never rhyme"]);
  ok("the show's own prompt stays first", with1.startsWith(base));
  ok("the rule is in there", with1.includes("- never rhyme"));
  ok("labelled so the model knows what it is", with1.includes("HOUSE NOTES"));
}

console.log("\nReading from a checkout:");
const root = await mkdtemp(join(tmpdir(), "lt-notes-"));
await mkdir(join(root, "docs"), { recursive: true });
check("a missing file reads as no rules", await readStyleNotes(root), []);
await writeFile(join(root, STYLE_NOTES_PATH), FILE);
check("and a real one reads its rules", await readStyleNotes(root), [
  "Connor never explains his own joke",
  'nobody says "at the end of the day"',
]);

console.log("\nRemembering a note adds it under the heading:");
{
  const added = await rememberStyleNote("GR80 does not quote scripture", root);
  check("it says it added it", added.added, true);
  check("and it is the newest rule", (await readStyleNotes(root)).at(-1), "GR80 does not quote scripture");
  const text = await readFile(join(root, STYLE_NOTES_PATH), "utf8");
  ok("the prose below the rules is untouched", text.includes("## What does not belong here"));
  ok("and the bullet under that heading is still not a rule",
    !(await readStyleNotes(root)).includes("not this either"));
}

console.log("\nIt refuses to make a mess:");
{
  const again = await rememberStyleNote("gr80 DOES NOT quote scripture", root);
  check("the same rule twice is a no-op whatever its case", again.added, false);
  check("and says why", again.reason, "already there");
  check("an empty note adds nothing", (await rememberStyleNote("   ", root)).added, false);
  check("three rules, not four", (await readStyleNotes(root)).length, 3);

  const bare = await mkdtemp(join(tmpdir(), "lt-notes-bare-"));
  await mkdir(join(bare, "docs"), { recursive: true });
  check("no file means nothing to append to", (await rememberStyleNote("a", bare)).reason, "no notes file");
  await writeFile(join(bare, STYLE_NOTES_PATH), "# Notes\n\nNo heading here.\n");
  check("nor does a file without the heading", (await rememberStyleNote("a", bare)).reason, "no Rules heading");
}

console.log("\nThe repo's own notes file is readable and has the heading:");
{
  const rules = await readStyleNotes();
  ok("it parses", Array.isArray(rules));
  const text = await readFile(STYLE_NOTES_PATH, "utf8");
  ok("and something can be appended to it", text.split("\n").some((l) => /^##\s+Rules\s*$/i.test(l.trim())));
}

console.log(failures === 0 ? "\nAll checks passed.\n" : `\n${failures} failed.\n`);
process.exit(failures === 0 ? 0 : 1);
