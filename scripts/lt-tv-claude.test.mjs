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

console.log("\nJSON comes back however the model wraps it:");
check("bare", parseJson('{"a":1}'), { a: 1 });
check("in a fence", parseJson('```json\n{"a":1}\n```'), { a: 1 });
check("after prose", parseJson('Here you go:\n{"a":1}\nhope that helps'), { a: 1 });

console.log(failures === 0 ? "\nAll checks passed.\n" : `\n${failures} failed.\n`);
process.exit(failures === 0 ? 0 : 1);
