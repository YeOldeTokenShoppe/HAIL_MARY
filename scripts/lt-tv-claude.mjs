#!/usr/bin/env node
// Talking to Claude, for whichever LT TV generator needs it.
//
// Raw fetch against the Messages API, matching how every other Claude call in
// this repo is written (src/app/api/trade/director, /api/review/characters,
// /api/council-chat). No SDK dependency is added for a script.
//
// The model is passed in rather than read from the environment here, because
// the two shows are written by different prompts and there is no reason they
// must always share a model.

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";

export async function claude({
  system,
  user,
  messages: turns = null,
  model,
  maxTokens = 8000,
  tools = null,
  // A GENERATOR wants an episode or nothing: a reply it cannot read is an
  // error, because half a record is worse than none. A CONVERSATION is the
  // other way round — the writer's words are the point and the JSON is only
  // how a proposal rides along with them, so the room asks for the text back
  // instead of an exception. See `prose` on the result.
  lenient = false,
  // How hard the model thinks before it answers (output_config.effort). Left
  // unset, the model's own default — which is what every generator uses. The
  // live desk lowers it, because a viewer is waiting on the answer.
  effort = null,
}) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("ANTHROPIC_API_KEY is not set (or use --draft to skip the model).");

  // One instruction is the usual shape here — a generator says what it wants
  // and gets an episode back. The writer's room is a CONVERSATION, so it hands
  // over the turns instead; copied rather than used in place, because the
  // pause_turn loop below appends to this list.
  const messages = turns ? [...turns] : [{ role: "user", content: user }];
  const searchNotes = [];
  let data;

  // Server-side tools run on Anthropic's side, but a long tool-using turn can
  // come back as `pause_turn` — resume it by echoing the content back and
  // asking for the rest. Bounded so a misbehaving turn cannot loop forever.
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const res = await fetch(ANTHROPIC_URL, {
      method: "POST",
      headers: {
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        system,
        messages,
        ...(tools ? { tools } : {}),
        ...(effort ? { output_config: { effort } } : {}),
      }),
    });

    if (!res.ok) {
      throw new Error(`Anthropic ${res.status}: ${(await res.text()).slice(0, 500)}`);
    }

    data = await res.json();

    // A server-tool failure arrives as a 200 with an error object in place of
    // the usual result list. The show degrades rather than dying: an
    // unverified rundown is worse than a verified one, but far better than no
    // episode at all.
    for (const block of data.content || []) {
      if (block.type === "web_search_tool_result" && !Array.isArray(block.content)) {
        searchNotes.push(`web search unavailable: ${block.content?.error_code ?? "unknown error"}`);
      }
    }

    if (data.stop_reason !== "pause_turn") break;
    messages.push({ role: "assistant", content: data.content });
  }

  const text = (data.content || [])
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("");

  if (data.stop_reason === "refusal") {
    throw new Error("The model declined this request. Check the brief for anything unexpected.");
  }
  if (data.stop_reason === "max_tokens") {
    // Cut off mid-sentence. In a conversation the words up to the cut are
    // still worth reading and saying so is more use than losing them; in a
    // generator they are half an episode.
    if (!lenient) throw new Error("Model hit max_tokens — the reply was cut off. Raise --max-tokens and retry.");
    return { say: text.trim(), changes: [], _prose: text.trim(), _cutOff: true };
  }

  let parsed;
  try {
    parsed = parseJson(text);
  } catch (err) {
    // The contract asks for JSON and a model in conversation sometimes simply
    // answers. That is not a failure worth throwing away a good answer over,
    // so the answer IS the reply and nothing is proposed with it.
    if (!lenient) throw err;
    parsed = { say: text.trim(), changes: [], _prose: text.trim() };
  }
  if (searchNotes.length) parsed._searchNotes = searchNotes;
  return parsed;
}

/** Models occasionally wrap JSON in prose or fences despite instruction. */
export function parseJson(text) {
  const trimmed = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start === -1 || end <= start) throw new Error(`Model did not return JSON:\n${text.slice(0, 400)}`);
    return JSON.parse(trimmed.slice(start, end + 1));
  }
}
