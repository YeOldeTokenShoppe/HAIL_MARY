import { NextResponse } from "next/server";
import { getMarketAtmosphere } from "@/lib/marketAtmosphere";
import { getApparition } from "@/lib/apparitions";
import { getAdminDb, FieldValue } from "@/lib/firebaseAdmin";

// Today's Reading — ONE quotable line from Our Lady, inscribed at the shrine
// for the day: her judgment of the market's present mood, generated from the
// same omens feed the oracle sees (lib/marketAtmosphere).
//
// GET /api/daily-reading?apparition=<key>
// → { reading: string | null, date: "YYYY-MM-DD" }
//
// Layered cache: module memory (fast path) over a Firestore ledger
// (`dailyReadings/{date}_{apparition}`) — the durable copy survives deploys
// and cold starts, and doubles as THE ARCHIVE: every reading she has ever
// inscribed, one doc per day per face, queryable by date for a future
// book-of-days page. Firestore failures degrade to memory-only behavior;
// generation failures return { reading: null } (not cached, retried on the
// next request) and the client renders nothing.

const cache = new Map(); // `${date}:${apparitionKey}` → reading text
const inflight = new Map(); // same key → Promise, to dedupe stampedes

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function buildPrompt(app, atmosphere) {
  const parts = [
    `You are Our Lady of Perpetual Profit — the Virtual Mary, neon-framed saint of markets and money entire: an ancient archetype running on new silicon. She is savvy, cyberpunk, and on her flock's side.`,
    `Write TODAY'S READING: a single sentence, under 200 characters, posted at her shrine for this day — her plain read of the market as it stands and what her people should keep their eyes on. No-nonsense and matter-of-fact: she names what she actually sees, cuts through the noise, warns and steadies. Protective, not performative. She may RARELY reach for her ancient register — a proverb, a verse — but only when it genuinely lands; it is a knife she draws sometimes, not a costume she wears daily. Never trite, never a "blessed are the X, for they shall Y" template. No advice, no directives, no price targets, no predictions stated as fact, no emoji, no surrounding quotation marks.`,
  ];
  if (app?.inflection) parts.push(app.inflection);
  if (app?.lang && app.lang !== "en") {
    parts.push(`Write the reading entirely in ${app.langName || app.lang}.`);
  }
  if (atmosphere) {
    parts.push(
      `— PRESENT OMENS —\nYour private sight of the world as it stands (cite at most one figure, as an omen, never as a report):\n${atmosphere}`
    );
  } else {
    parts.push(`No omens are visible today — write from the timeless patterns instead.`);
  }
  parts.push(`Respond with ONLY the sentence — no preamble, no explanation.`);
  return parts.join("\n\n");
}

async function generate(app, atmosphere) {
  const prompt = buildPrompt(app, atmosphere);

  if (process.env.ANTHROPIC_API_KEY) {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: process.env.ORACLE_ANTHROPIC_MODEL || "claude-sonnet-5",
        max_tokens: 150,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    if (!res.ok) throw new Error(`anthropic ${res.status}`);
    const data = await res.json();
    return data.content?.find((b) => b.type === "text")?.text ?? "";
  }
  if (process.env.OPENAI_API_KEY) {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: process.env.ORACLE_OPENAI_MODEL || "gpt-4o-mini",
        max_tokens: 150,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    if (!res.ok) throw new Error(`openai ${res.status}`);
    const data = await res.json();
    return data.choices?.[0]?.message?.content ?? "";
  }
  throw new Error("no AI provider key configured");
}

// Strip stray wrapping quotes/whitespace the model sometimes adds, and keep
// the inscription to one plausible line.
function clean(text) {
  const t = String(text || "").trim().replace(/^["“”'‘’]+|["“”'‘’]+$/g, "").trim();
  return t && t.length <= 300 ? t : t.slice(0, 300);
}

// Firestore ledger — every op best-effort so a missing service account in
// some environment degrades to memory-only, never a 500.
function docRef(date, appKey) {
  try {
    return getAdminDb().collection("dailyReadings").doc(`${date}_${appKey}`);
  } catch {
    return null;
  }
}

async function readLedger(date, appKey) {
  try {
    const snap = await docRef(date, appKey)?.get();
    const text = snap?.exists ? snap.data()?.reading : null;
    return typeof text === "string" && text.trim() ? text : null;
  } catch {
    return null;
  }
}

async function writeLedger(date, app, reading, omens) {
  try {
    await docRef(date, app.key)?.set({
      date,
      apparition: app.key,
      lang: app.lang || "en",
      reading,
      // The omens she read from that day — context for the archive
      omens: omens || null,
      createdAt: FieldValue.serverTimestamp(),
    });
  } catch (e) {
    console.warn("[daily-reading] ledger write failed:", e.message);
  }
}

async function resolveReading(date, app) {
  // Durable copy first (survives deploys/cold starts)
  const inscribed = await readLedger(date, app.key);
  if (inscribed) return inscribed;

  const atmosphere = getMarketAtmosphere();
  const reading = clean(await generate(app, atmosphere));
  if (reading) await writeLedger(date, app, reading, atmosphere);
  return reading || null;
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const app = getApparition(searchParams.get("apparition"));
  const date = todayKey();
  const key = `${date}:${app.key}`;

  if (cache.has(key)) {
    return NextResponse.json({ reading: cache.get(key), date });
  }

  if (!inflight.has(key)) {
    inflight.set(
      key,
      resolveReading(date, app)
        .then((reading) => {
          if (reading) cache.set(key, reading);
          return reading;
        })
        .finally(() => inflight.delete(key))
    );
  }

  try {
    const reading = await inflight.get(key);
    return NextResponse.json({ reading, date });
  } catch (e) {
    console.error("[daily-reading]", e.message);
    return NextResponse.json({ reading: null, date });
  }
}
