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

// PB / MR / EU joined on 2026-07-29 when the VC game's press floor started
// routing every seat through its own voice. They are inert until something reads
// them — setAdviserMouth early-returns on an unknown key, so the analyser was
// silently discarding those writes rather than failing loudly.
// PB2 joined on 2026-08-02 with the second pitch-bot rig. IT HAS TO BE LISTED
// HERE OR IT DOES NOT EXIST: setAdviserMouth early-returns on an unknown key, so
// PressSession voicing the pitcher as "PB2" would run the analyser, compute a
// level every frame, and throw all of it away without a warning — the exact trap
// the note above records PB/MR/EU falling into. Adding a voice to
// api/counsel-voice is therefore never a one-file change.
// ALL THREE PITCH-BOT KEYS ARE NOW DRAWN FROM, on two surfaces. Desktop feeds
// the split-face viseme group in lib/trade/pitchBotExpressions (v2 and v3 only);
// the flat surface feeds PressFigure, which has no mouth art at all and runs the
// whole projection — glow, swell, level meter — off this number for WHICHEVER
// rig is staged. A key missing here used to be a silent no-op nobody would
// notice; on the flat surface it is a bot that talks behind a dead panel.
export const adviserMouth = { JB: 0, GR: 0, MR: 0, EU: 0, PB: 0, PB2: 0, PB3: 0 };

// READABLE FROM THE CONSOLE, because every failure in this chain is silent and
// looks identical from the outside: a mouth that never opens is either a voice
// missing from this map, a route that 409'd, an AudioContext that never got its
// gesture, or a reader watching the wrong key — and none of them logs. The
// values are also indistinguishable from a working rig speaking quietly, since
// a level of 0 renders exactly like a closed mouth. `__adviserMouth.PB2` while a
// line plays answers in one look which half of the chain is broken.
if (typeof window !== "undefined") window.__adviserMouth = adviserMouth;

export function setAdviserMouth(who, v) {
  if (!(who in adviserMouth)) return;
  adviserMouth[who] = Math.max(0, Math.min(1, Number(v) || 0));
}

/** Drop every mouth shut — used when a line is cut off or finishes. */
export function resetAdviserMouths() {
  for (const k of Object.keys(adviserMouth)) adviserMouth[k] = 0;
}
