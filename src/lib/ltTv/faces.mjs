// FACE BEATS: SitePal's facial expressions, as a screenplay can ask for them.
//
// A face beat travels exactly like a body beat. It is a cue on a line —
// `(Connor smile @ +0.4s)` under the line in the screenplay, `{ actor,
// reaction: "smile", offset }` in the record — and the set fires it that many
// seconds after the line starts. The difference is only at the very end: a
// body beat plays a clip on the character's rig, a face beat calls SitePal's
// `setFacialExpression(expression, amplitude, duration)` (docs/sitepal.md,
// Animation Control Functions) on that character's portal, the player their
// face on the set is cropped from.
//
// So these names share one namespace with the body reactions in
// modelContract.mjs, and must never collide with one. `lt-tv-format.mjs`
// checks that when it loads.
//
// WHY THE LIST IS THIS LIST. SitePal offers thirteen expressions. Michelle
// tried them on the set board (/trade?tune=faces) on 2026-09-23 and ruled out
// Blink (SitePal blinks by itself), Scream, Blush and both winks as never
// useful on this show. The rest are here under the word a writer would reach
// for, not SitePal's own spelling — and there are two smiles: `smile` is
// SitePal's closed-mouth one, `grin` its open-mouth one.
//
// Amplitude and duration are the defaults a beat gets. The face is a crop fitted
// to a NEUTRAL face, so a full-strength expression is the one most likely to
// push a mouth out of it — they start below 1.0 on purpose. Live-tunable from
// `window.__tsExpressions` on /trade, read at the moment each beat fires.

export const FACES = {
  smile: { expression: "ClosedSmile", amplitude: 0.8, duration: 3 },
  grin: { expression: "OpenSmile", amplitude: 0.7, duration: 2.5 },
  sad: { expression: "Sad", amplitude: 0.8, duration: 3 },
  angry: { expression: "Angry", amplitude: 0.7, duration: 2.5 },
  afraid: { expression: "Fear", amplitude: 0.7, duration: 2.5 },
  disgusted: { expression: "Disgust", amplitude: 0.7, duration: 2.5 },
  surprised: { expression: "Surprise", amplitude: 0.8, duration: 2 },
  thinking: { expression: "Thinking", amplitude: 0.8, duration: 3 },
};

export const FACE_NAMES = Object.keys(FACES);

/** Whether a cue's `reaction` is a face beat rather than a body clip. */
export function isFaceBeat(reaction) {
  return Object.prototype.hasOwnProperty.call(FACES, reaction);
}
