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
// OUR LADY IS SERVED HERE TOO, as a FALLBACK ONLY. Her player is still the
// preferred path — it is the one that moves her face — but her voice must not
// depend on it. Measured on a real phone (2026-07-25): her SitePal portal never
// came up at all, so her frame showed the still cameo and she answered in
// silence while both advisers spoke normally, because they never needed a
// player. Two voices arguing over a mute presiding face is the worst state this
// page can be in. Now: if the portal fails, she speaks from here with the same
// ElevenLabs voice the player would have used, and only her lip-sync is lost.
// Her voice varies by apparition, so the caller sends the apparition KEY and
// the id is resolved HERE — never accept a raw voice id from the client, or the
// endpoint becomes an open bill on someone else's ElevenLabs quota.
//
// Input  (POST JSON): { text, speaker: "JB" | "GR" | "OL", apparition? }
// Output: audio/mpeg bytes, or 4xx/502 — the caller falls back to a silent
//         reading beat so the argument never stalls.
import { APPARITIONS } from "@/lib/apparitions";
import { ORACLE_VOICE } from "@/lib/oracleSpeech";

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
    // Kept in lockstep with COUNSEL_VOICES.GR in lib/counselSpeech.js — that
    // map voices the `?triptych=1` layout, this route voices every other one,
    // and a mismatch means GR80 changes voice when the layout changes.
    id: process.env.ELEVENLABS_VOICE_GR80 || "JBFqnCBsd6RMkjVDRZzb",
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

  const speaker = ["GR", "OL"].includes(body?.speaker) ? body.speaker : "JB";
  // Her id is looked up from the apparition KEY the client names — the same
  // source the SitePal player reads, so the fallback sounds like the same
  // person. Unknown or missing key falls back to ORACLE_VOICE, which is also
  // what an apparition with `voice: null` (the classic face) resolves to.
  const voice =
    speaker === "OL"
      ? {
          id:
            APPARITIONS.find((a) => a.key === body?.apparition)?.voice?.id ||
            ORACLE_VOICE.id,
          // Warmer and freer than GR80's procedural flatness, steadier than
          // Barron's push: she is unhurried and means it.
          settings: { stability: 0.6, similarity_boost: 0.75, style: 0.35 },
        }
      : VOICES[speaker];
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
