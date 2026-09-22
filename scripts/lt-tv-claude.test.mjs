// Tests for the shared Claude client, with:
//
//   node scripts/lt-tv-claude.test.mjs
//
// This file exists because of a real failure. `ANTHROPIC_URL` was defined in
// lt-news-script.mjs and stayed there when the client was extracted, so every
// call through here died with "ANTHROPIC_URL is not defined" — both shows, at
// the first model call, with the API key set and everything else correct. No
// test caught it because no test called `claude()`: they all stop short of the
// model to avoid spending money.
//
// The fix is to call it with `fetch` replaced. That costs nothing, needs no
// key that works, and would have caught the one bug that mattered.

import { claude, parseJson } from "./lt-tv-claude.mjs";

let failures = 0;
const check = (label, actual, expected) => {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) return console.log(`  ✓ ${label}`);
  console.log(`  ✗ ${label}\n      expected ${e}\n      got      ${a}`);
  failures += 1;
};
const ok = (label, cond) => check(label, Boolean(cond), true);

/** Run `claude()` against a stubbed fetch, and report what it sent. */
async function callWith(reply, opts = {}) {
  const realFetch = globalThis.fetch;
  const realKey = process.env.ANTHROPIC_API_KEY;
  const sent = [];
  globalThis.fetch = async (url, init) => {
    sent.push({ url, init });
    return {
      ok: true,
      status: 200,
      json: async () => reply,
      text: async () => JSON.stringify(reply),
    };
  };
  process.env.ANTHROPIC_API_KEY = "sk-ant-test";
  try {
    const result = await claude({ system: "s", user: "u", model: "m", ...opts });
    return { sent, result, threw: null };
  } catch (err) {
    return { sent, result: null, threw: err };
  } finally {
    globalThis.fetch = realFetch;
    if (realKey === undefined) delete process.env.ANTHROPIC_API_KEY;
    else process.env.ANTHROPIC_API_KEY = realKey;
  }
}

const textReply = (text) => ({ stop_reason: "end_turn", content: [{ type: "text", text }] });

console.log("\nA call reaches the Messages API:");
{
  const { sent, result, threw } = await callWith(textReply('{"title":"ok"}'));
  ok("it does not throw", threw === null);
  check("it called fetch once", sent.length, 1);
  check("at the Anthropic messages endpoint", sent[0]?.url, "https://api.anthropic.com/v1/messages");
  check("with the model it was handed", JSON.parse(sent[0].init.body).model, "m");
  check("and the key in the header", sent[0].init.headers["x-api-key"], "sk-ant-test");
  check("it returns the parsed JSON", result, { title: "ok" });
}

console.log("\nWithout a key it refuses before spending anything:");
{
  const realKey = process.env.ANTHROPIC_API_KEY;
  const realFetch = globalThis.fetch;
  let called = false;
  globalThis.fetch = async () => { called = true; };
  delete process.env.ANTHROPIC_API_KEY;
  let message = null;
  try {
    await claude({ system: "s", user: "u", model: "m" });
  } catch (err) {
    message = err.message;
  }
  globalThis.fetch = realFetch;
  if (realKey !== undefined) process.env.ANTHROPIC_API_KEY = realKey;
  ok("it names the missing key", message && message.includes("ANTHROPIC_API_KEY"));
  check("and never called fetch", called, false);
}

console.log("\nA paused turn is resumed, not abandoned:");
{
  const realFetch = globalThis.fetch;
  const realKey = process.env.ANTHROPIC_API_KEY;
  let n = 0;
  globalThis.fetch = async () => {
    n += 1;
    const body = n === 1
      ? { stop_reason: "pause_turn", content: [{ type: "text", text: "half" }] }
      : textReply('{"done":true}');
    return { ok: true, status: 200, json: async () => body, text: async () => "" };
  };
  process.env.ANTHROPIC_API_KEY = "sk-ant-test";
  const result = await claude({ system: "s", user: "u", model: "m" });
  globalThis.fetch = realFetch;
  if (realKey === undefined) delete process.env.ANTHROPIC_API_KEY;
  else process.env.ANTHROPIC_API_KEY = realKey;
  check("it called fetch twice", n, 2);
  check("and returned the finished answer", result, { done: true });
}

console.log("\nA cut-off or refused reply is an error, not half an episode:");
{
  const cut = await callWith({ stop_reason: "max_tokens", content: [{ type: "text", text: "{" }] });
  ok("max_tokens says to raise the limit", cut.threw && cut.threw.message.includes("max-tokens"));
  const no = await callWith({ stop_reason: "refusal", content: [] });
  ok("a refusal says so", no.threw && no.threw.message.includes("declined"));
}

console.log("\nIn a conversation the words are the point, not the JSON:");
{
  // The failure this is here for, 2026-09-21: Michelle asked the writers' room
  // "what is the takeaway for the crypto audience?", the model answered in
  // plain prose, and the room threw the whole answer away with "Model did not
  // return JSON" — showing her the first 400 characters of it inside an error.
  const prose =
    "For a crypto room the takeaway is the disclosure asymmetry: irony is a consent form " +
    "the early cohort signs on behalf of the late one.";

  const strict = await callWith(textReply(prose));
  ok("a generator still refuses it", strict.threw && strict.threw.message.includes("did not return JSON"));

  const room = await callWith(textReply(prose), { lenient: true });
  ok("a room does not throw", room.threw === null);
  check("what it said is what it said", room.result.say, prose);
  check("with nothing proposed", room.result.changes, []);
  ok("and it is marked as prose rather than a proposal", room.result._prose === prose);

  // Well-formed JSON is still parsed the same way; lenience is a fallback, not
  // a change of contract.
  const proper = await callWith(textReply('{"say":"cut the middle","changes":[{"op":"drop","n":12}]}'), { lenient: true });
  check("JSON is still read as JSON", proper.result.say, "cut the middle");
  ok("with its changes intact", proper.result.changes.length === 1);
  ok("and not marked as prose", proper.result._prose === undefined);
}

console.log("\nA reply cut off mid-sentence keeps what was said:");
{
  const half = { stop_reason: "max_tokens", content: [{ type: "text", text: "and the hard case is the part that ear" }] };
  const room = await callWith(half, { lenient: true });
  ok("it does not throw", room.threw === null);
  check("the words up to the cut survive", room.result.say, "and the hard case is the part that ear");
  ok("and it says it was cut off", room.result._cutOff === true);
  ok("a generator still refuses half an episode", (await callWith(half)).threw !== null);
}

console.log("\nJSON comes back however the model wraps it:");
check("bare", parseJson('{"a":1}'), { a: 1 });
check("in a fence", parseJson('```json\n{"a":1}\n```'), { a: 1 });
check("after prose", parseJson('Here you go:\n{"a":1}\nhope that helps'), { a: 1 });

console.log(failures === 0 ? "\nAll checks passed.\n" : `\n${failures} failed.\n`);
process.exit(failures === 0 ? 0 : 1);
