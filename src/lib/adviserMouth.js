// Shared mouth-open level (0..1) per adviser, bridging the ElevenLabs audio
// analyser in counselSpeech.speakAdviserLine to the 2D mouth sprites drawn over
// the shoulder figures on /main.
//
// This is the 2D twin of [[unicornMouth]], and deliberately the SAME SHAPE: a
// plain module singleton (NOT React state) so the per-frame RMS writes never
// trigger a re-render. The writer is the analyser loop; the reader is a rAF loop
// inside FigureMouth that swaps sprite frames imperatively.
//
// WHY THIS PORTS AT ALL: Eugene's lip-sync on /trade is not viseme-based — see
// unicornMouth's note, "Path A: jaw flap, no visemes, no Blender". It is one
// amplitude scalar driving a jaw bone. A scalar is renderer-agnostic, so the
// same signal that rotates a bone in R3F can pick a mouth sprite in the DOM.
// Visemes would have needed phoneme alignment and a drawn shape per phoneme;
// this needs neither.
//
// Keyed by VOICE ("JB" | "GR"), not by seat — the two advisers can never speak
// at once (the argument is strictly sequential, see /main's handleAsk), but
// keying them separately keeps a stale value from one bleeding onto the other's
// face when a new question interrupts mid-line.

export const adviserMouth = { JB: 0, GR: 0 };

export function setAdviserMouth(who, v) {
  if (!(who in adviserMouth)) return;
  adviserMouth[who] = Math.max(0, Math.min(1, Number(v) || 0));
}

/** Drop every mouth shut — used when a line is cut off or finishes. */
export function resetAdviserMouths() {
  adviserMouth.JB = 0;
  adviserMouth.GR = 0;
}
