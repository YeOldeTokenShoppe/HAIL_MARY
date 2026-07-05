import { NextResponse } from "next/server";

// Our Lady oracle — LLM brain for the /main talking portrait.
// POST { messages: [{role, content}...], provider?: "anthropic" | "openai" }
// → { reply, expressions: [{ name, amplitude, duration, at }], provider }
//
// The reply is spoken aloud via SitePal sayText; expressions are applied with
// setFacialExpression, timed across the speech (`at` = 0..1 fraction).

const VALID_EXPRESSIONS = new Set([
  "None", "ClosedSmile", "OpenSmile", "Sad", "Angry", "Fear", "Disgust",
  "Surprise", "Thinking", "Blush", "LeftWink", "RightWink", "Blink", "Scream",
]);

const SYSTEM_PROMPT = `You are Our Lady of Perpetual Profit — the serene cyborg madonna of RL80, a satirical crypto shrine. You speak from within a neon-framed portrait: part saint, part market oracle, wholly aware of the absurdity of both. Your tone is warm, knowing, faintly mischievous — blessings and benedictions laced with trading-floor vocabulary. Keep replies SHORT: they are spoken aloud. One to three sentences, never more than 350 characters. Never give real financial advice; when asked for any, respond with mock-liturgical evasions ("the candles reveal only what the candles wish").

Respond ONLY with a JSON object, no markdown fences, in this exact shape:
{"reply": "<what you say aloud>", "expressions": [{"name": "<one of: ClosedSmile, OpenSmile, Sad, Angry, Fear, Disgust, Surprise, Thinking, Blush, LeftWink, RightWink, Blink, Scream>", "amplitude": <0.2-1.0>, "duration": <1-8 seconds>, "at": <0-1 fraction of the reply where it begins>}]}

Use 0-2 expressions per reply, chosen to match the emotional beat of what you're saying (e.g. Thinking while pondering, ClosedSmile for benedictions, LeftWink for mischief, Surprise for dramatic reveals). Omit expressions entirely (empty array) when neutral serenity fits best.`;

// Simple in-memory rate limit: N requests per window per IP
const RATE_LIMIT = { windowMs: 60_000, max: 10 };
const hits = new Map();
function rateLimited(ip) {
  const now = Date.now();
  const entry = hits.get(ip) || { count: 0, start: now };
  if (now - entry.start > RATE_LIMIT.windowMs) {
    entry.count = 0;
    entry.start = now;
  }
  entry.count++;
  hits.set(ip, entry);
  // Opportunistic cleanup so the map doesn't grow unbounded
  if (hits.size > 1000) {
    for (const [k, v] of hits) if (now - v.start > RATE_LIMIT.windowMs) hits.delete(k);
  }
  return entry.count > RATE_LIMIT.max;
}

function sanitizeMessages(raw) {
  if (!Array.isArray(raw)) return null;
  const msgs = raw.slice(-16).map((m) => ({
    role: m?.role === "assistant" ? "assistant" : "user",
    content: String(m?.content ?? "").replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, "").slice(0, 600),
  })).filter((m) => m.content.trim().length > 0);
  // Anthropic requires the first message to be from the user — drop the
  // drawer's greeting (and any other leading assistant turns)
  while (msgs.length && msgs[0].role === "assistant") msgs.shift();
  if (!msgs.length || msgs[msgs.length - 1].role !== "user") return null;
  return msgs;
}

async function askAnthropic(messages) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: process.env.ORACLE_ANTHROPIC_MODEL || "claude-sonnet-5",
      max_tokens: 400,
      system: SYSTEM_PROMPT,
      messages,
    }),
  });
  if (!res.ok) throw new Error(`anthropic ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  return data.content?.find((b) => b.type === "text")?.text ?? "";
}

async function askOpenAI(messages) {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: process.env.ORACLE_OPENAI_MODEL || "gpt-4o-mini",
      max_tokens: 400,
      response_format: { type: "json_object" },
      messages: [{ role: "system", content: SYSTEM_PROMPT }, ...messages],
    }),
  });
  if (!res.ok) throw new Error(`openai ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? "";
}

function parseOracle(rawText) {
  let parsed = null;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    const m = rawText.match(/\{[\s\S]*\}/);
    if (m) {
      try { parsed = JSON.parse(m[0]); } catch { /* fall through */ }
    }
  }
  if (!parsed || typeof parsed.reply !== "string") {
    // Model ignored the format — speak its raw text, no expressions
    return { reply: rawText.slice(0, 350), expressions: [] };
  }
  const expressions = (Array.isArray(parsed.expressions) ? parsed.expressions : [])
    .filter((e) => VALID_EXPRESSIONS.has(e?.name) && e.name !== "None")
    .slice(0, 3)
    .map((e) => ({
      name: e.name,
      amplitude: Math.min(1.2, Math.max(0.1, Number(e.amplitude) || 0.7)),
      duration: Math.min(12, Math.max(1, Number(e.duration) || 4)),
      at: Math.min(1, Math.max(0, Number(e.at) || 0)),
    }));
  return { reply: parsed.reply.slice(0, 400), expressions };
}

export async function POST(request) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (rateLimited(ip)) {
    return NextResponse.json({ error: "Too many prayers at once — a moment of silence, please." }, { status: 429 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  const messages = sanitizeMessages(body?.messages);
  if (!messages) {
    return NextResponse.json({ error: "messages must end with a user message" }, { status: 400 });
  }

  const hasAnthropic = !!process.env.ANTHROPIC_API_KEY;
  const hasOpenAI = !!process.env.OPENAI_API_KEY;
  let provider = body?.provider === "openai" ? "openai" : body?.provider === "anthropic" ? "anthropic" : null;
  if (!provider) provider = process.env.ORACLE_PROVIDER || (hasAnthropic ? "anthropic" : "openai");
  if (provider === "anthropic" && !hasAnthropic) provider = "openai";
  if (provider === "openai" && !hasOpenAI) provider = "anthropic";
  if ((provider === "anthropic" && !hasAnthropic) || (provider === "openai" && !hasOpenAI)) {
    return NextResponse.json({ error: "no AI provider key configured" }, { status: 500 });
  }

  try {
    const rawText = provider === "anthropic" ? await askAnthropic(messages) : await askOpenAI(messages);
    const { reply, expressions } = parseOracle(rawText);
    return NextResponse.json({ reply, expressions, provider });
  } catch (e) {
    console.error("[oracle]", e.message);
    return NextResponse.json({ error: "the oracle is silent — try again shortly" }, { status: 502 });
  }
}
