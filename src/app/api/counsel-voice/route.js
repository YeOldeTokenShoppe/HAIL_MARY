// /api/counsel-voice — server-side ElevenLabs proxy for the /main advisers.
//
// Our Lady speaks through her SitePal player (which is itself just proxying
// ElevenLabs — engine 14). Her advisers have no player on phones: three live
// SitePal players OOM-crash iOS Safari, so only she is mounted. This route
// gives them a voice WITHOUT a player — the client plays the returned mp3 in a
// plain <audio> element, which needs no AudioContext and so sidesteps iOS's
// one-context limit entirely.
//
// No lip-sync, by design: the advisers are illustrations (public/shoulder_*.webp),
// not avatars. A drawing that glows while a voice plays reads as intentional;
// it's a LIVE AVATAR with a dead mouth that reads as broken.
//
// Input  (POST JSON): { text: string, speaker: "JB" | "GR" }
// Output: audio/mpeg bytes, or 4xx/502 — the caller falls back to a silent
//         reading beat so the argument never stalls.

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
// Turbo = low latency, which matters: this is an awaited beat mid-argument.
const ELEVENLABS_MODEL = process.env.ELEVENLABS_MODEL || "eleven_turbo_v2_5";

// Voice per adviser, both confirmed by the user 2026-07-15. NOTE these are the
// PHONE voices (no player available there). On desktop each adviser still
// speaks through his own SitePal player — GR80 as built-in "Gilbert" (engine 7)
// with reverb — so the same character can sound different across layouts until
// the two are reconciled.
const VOICES = {
  JB: {
    id: process.env.ELEVENLABS_VOICE_BARRON || "IcFWazAaBzXNwLWpySgF",
    // Low stability = he wanders and pushes; he's a seducer, not a narrator.
    settings: { stability: 0.4, similarity_boost: 0.75, style: 0.55 },
  },
  GR: {
    id: process.env.ELEVENLABS_VOICE_GR80 || "VG7zjqAT7O4FXCR57Wwv",
    // High stability, near-zero style = flat, procedural, unbothered. The
    // saint reports what the maxim yields; he doesn't perform it.
    settings: { stability: 0.85, similarity_boost: 0.6, style: 0.1 },
  },
};

// ElevenLabs reads "RL80" as "R-L-eighty"; the shrine says "R-Lady". Spoken
// text only. (Mirrors toSpeech in lib/oracleSpeech + lib/counselSpeech.)
function toSpeech(text) {
  return text.replace(/\$?\bRL[-\s]?80\b/gi, "R-Lady");
}

export async function POST(request) {
  if (!ELEVENLABS_API_KEY) {
    return Response.json({ error: "voice not configured" }, { status: 500 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "bad json" }, { status: 400 });
  }

  const speaker = body?.speaker === "GR" ? "GR" : "JB";
  const voice = VOICES[speaker];
  if (!voice?.id) {
    // Not an error — this adviser simply has no voice yet.
    return Response.json({ error: "no_voice_for_speaker", speaker }, { status: 409 });
  }

  const text = toSpeech(String(body?.text || "").slice(0, 320).trim());
  if (!text) return Response.json({ error: "empty" }, { status: 400 });

  try {
    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice.id}`, {
      method: "POST",
      headers: {
        "xi-api-key": ELEVENLABS_API_KEY,
        "content-type": "application/json",
        accept: "audio/mpeg",
      },
      body: JSON.stringify({
        text,
        model_id: ELEVENLABS_MODEL,
        voice_settings: voice.settings,
      }),
    });

    if (!res.ok) {
      const t = await res.text();
      console.warn("[counsel-voice]", speaker, res.status, t.slice(0, 160));
      return Response.json({ error: "tts_failed" }, { status: 502 });
    }

    return new Response(await res.arrayBuffer(), {
      headers: { "content-type": "audio/mpeg", "cache-control": "no-store" },
    });
  } catch (err) {
    console.warn("[counsel-voice] failed:", err?.message || err);
    return Response.json({ error: "tts_failed" }, { status: 502 });
  }
}
