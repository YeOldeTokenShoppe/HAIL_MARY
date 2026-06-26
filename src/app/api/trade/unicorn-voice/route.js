// /api/trade/unicorn-voice — server-side ElevenLabs proxy for the Unicorn.
//
// The Unicorn is the one /trade voice that does NOT go through SitePal (no
// humanoid Face2 mesh to lip-sync onto). It speaks via its own TTS, played
// on the client as a decoded AudioBuffer with an amplitude-driven horn glow.
// This route keeps the ElevenLabs key server-side (same posture as the
// Anthropic key) and returns raw audio bytes the client decodes.
//
// Input  (POST JSON): { text: string }
// Output: audio/mpeg bytes (or 502 on upstream failure — caller falls back to
//         a caption-only beat so the scene never freezes).

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const ELEVENLABS_VOICE_ID = process.env.ELEVENLABS_VOICE_ID; // the Unicorn's voice
// Turbo = low latency, which matters because this is a live, awaited beat.
const ELEVENLABS_MODEL = process.env.ELEVENLABS_MODEL || 'eleven_turbo_v2_5';

export async function POST(request) {
  if (!ELEVENLABS_API_KEY || !ELEVENLABS_VOICE_ID) {
    return Response.json({ error: 'unicorn voice not configured' }, { status: 500 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'bad json' }, { status: 400 });
  }

  const text = String(body?.text || '').slice(0, 280).trim();
  if (!text) return Response.json({ error: 'empty' }, { status: 400 });

  try {
    const res = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${ELEVENLABS_VOICE_ID}`,
      {
        method: 'POST',
        headers: {
          'xi-api-key': ELEVENLABS_API_KEY,
          'content-type': 'application/json',
          accept: 'audio/mpeg',
        },
        body: JSON.stringify({
          text,
          model_id: ELEVENLABS_MODEL,
          // Loose, dreamy delivery — low stability lets it wander, which suits
          // an oracle. Tune to taste.
          voice_settings: { stability: 0.35, similarity_boost: 0.75, style: 0.5 },
        }),
      }
    );

    if (!res.ok) {
      const t = await res.text();
      console.warn('[trade/unicorn-voice] elevenlabs', res.status, t.slice(0, 160));
      return Response.json({ error: 'tts_failed' }, { status: 502 });
    }

    const buf = await res.arrayBuffer();
    return new Response(buf, {
      headers: {
        'content-type': 'audio/mpeg',
        'cache-control': 'no-store',
      },
    });
  } catch (err) {
    console.warn('[trade/unicorn-voice] failed:', err?.message || err);
    return Response.json({ error: 'tts_failed' }, { status: 502 });
  }
}
