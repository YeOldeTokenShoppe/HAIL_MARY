// beatRunner — plays a director turn end-to-end on the /trade stage.
//
// Calls /api/trade/director, then forks each beat and AWAITS it:
//   • Monk            → page.speak('Monk', {type:'text'})   live Gilbert TTS
//   • Demon/Detective → page.speak(id, {type:'audio'})       pre-uploaded clip
//   • Unicorn         → playUnicornBeat (Web Audio, faceless, horn glow)
//
// The SitePal voices DO NOT touch SitePal here — they go through the page's
// injected `speak(characterId, speech)`, which focuses the character (the same
// path a player click takes: focus → activateSitePalProjection scene swap →
// speakLine) and resolves when the line ends. Driving SitePal directly from
// here raced the page's own pipeline (stale-audio guards, scene auto-greetings),
// so all SitePal work is delegated.
//
// speech: { type:'text', text } | { type:'audio', audioName, text }

import { clipById } from './reactionBank';
import { playUnicornBeat } from './playUnicornBeat';
import { setUnicornGlow } from './unicornGlow';

// deps (page-supplied):
//   speak(characterId, speech) → Promise   resolves when the line finishes
//   setCaption(t) / setSpeaker(id) / playAnim(name)
export async function runBeats(beats, deps = {}) {
  const { speak, setCaption, setSpeaker, playAnim, resolveClip } = deps;
  const resolve = resolveClip || clipById; // resolves both generic + per-case ids

  for (const beat of beats || []) {
    if (!beat || !beat.speaker) continue;
    setSpeaker?.(beat.speaker);

    if (beat.speaker === 'Unicorn') {
      await playUnicornBeat(beat, { setCaption, setSpeaker, setGlow: setUnicornGlow, playAnim });
    } else if (beat.speaker === 'Monk') {
      setCaption?.(beat.line);
      if (speak) await speak('Monk', { type: 'text', text: beat.line });
    } else {
      // Demon | Detective — play the selected pre-uploaded clip by name.
      const clip = resolve(beat.clipId);
      if (!clip) continue;
      setCaption?.(clip.text);
      if (speak) await speak(beat.speaker, { type: 'audio', audioName: clip.audioName, text: clip.text });
    }

    await new Promise((r) => setTimeout(r, 250)); // beat to the next speaker
  }
}

// Fetch the director turn, then play it. input = { phase, caseContext,
// playerAction, playerType?, playerBiases?, history?, clipBank?, voices? }.
// Returns the beats it played (append to your running history).
export async function runDirectedTurn(input, deps = {}) {
  let beats = [];
  try {
    const res = await fetch('/api/trade/director', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(input),
    });
    if (res.ok) {
      const data = await res.json();
      beats = Array.isArray(data.beats) ? data.beats : [];
      console.log('[beatRunner] director beats:', beats.map((b) => b.speaker + (b.clipId ? ':' + b.clipId : '')));
    }
  } catch (e) {
    console.warn('[beatRunner] director fetch failed:', e?.message || e);
  }
  await runBeats(beats, deps);
  return beats;
}
