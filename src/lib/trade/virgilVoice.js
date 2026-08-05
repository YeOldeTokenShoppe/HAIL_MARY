// HOW VIRGIL SPEAKS — and it is two different mechanisms with one entry point.
//
// THE PROBLEM THIS SOLVES. He has an ElevenLabs voice (VG in api/counsel-voice)
// and, since 2026-08-03, a SitePal scene. Those are not two ways of doing the
// same thing:
//
//   speakAdviserLine("VG", …)   ElevenLabs -> our own AnalyserNode -> a number in
//                               adviserMouth.VG. Every mouth on the flat surface
//                               is drawn from that number — but only for a
//                               character that HAS drawn mouth art, and Virgil
//                               has none. So this path is his voice over a
//                               motionless face.
//
//   speakInPortal(…, engine 14) SitePal fetches the SAME ElevenLabs voice through
//                               the connected account and drives its OWN lip-sync
//                               from the audio it just made. Voice and mouth, in
//                               one call, with no analyser and no mouth art.
//
// The second is strictly better and is the reason the scene exists. It is also
// the one that can fail for reasons this code cannot see — an unlicensed URL
// host, a portal that never came up, a WebKit-throttled subframe — so it is
// tried, not assumed.
//
// ONE ENTRY POINT, because the alternative is every call site learning which
// mouth Virgil currently has. VC_GAME.md §6: presentation differences belong in
// the surface, but "which of my two throats is available right now" is not a
// presentation difference, it is a runtime fact, and both surfaces get it wrong
// in the same way if they each answer it themselves.
//
// THE VOICE MUST NOT CHANGE WITH THE PATH. Both routes end at the same
// ElevenLabs voice id — one via our server, one via SitePal's account
// integration — which is the whole reason VIRGIL.sitepal.voice carries the same
// id the VG entry does. If those two ever diverge, Virgil changes voice depending
// on whether his portal happened to load, which is the trap GR80 fell into across
// /main's two layouts.

import { VIRGIL } from "@/game/terminal-traders/press/virgil";
import { portalWindow, recenterPortal, speakAdviserLine, speakInPortal } from "@/lib/counselSpeech";

/** DOM id of the wrapper that hosts his portal tile. Both the tile and the
 *  speaker have to agree on this string; nothing else uses it. */
export const VIRGIL_PORTAL_ID = "virgil-portal";

/** Is his player up and able to take a line right now? */
export function virgilPortalLive() {
  return typeof portalWindow(VIRGIL_PORTAL_ID)?.sayText === "function";
}

/* ---------------------------------------------------------------------- */

/**
 * HE KEEPS LOOKING UPWARDS (author, 2026-08-04), and at 230px you can see it.
 *
 * THE CAUSE IS followCursor, NOT IDLE DRIFT, and the difference matters because
 * the obvious fix does not work. SitePal scenes track the mouse by default, and
 * his tile is docked at the FOOT of the reading column — so the pointer is above
 * him essentially all the time, and a character dutifully following it reads as a
 * cat staring at the ceiling. Measured: `recenter()` alone straightened him and
 * he was back to looking up within seven seconds, because recentring fights the
 * tracking instead of turning it off. `followCursor(0)` then `recenter()` held
 * level past eight seconds and through a blink cycle.
 *
 * SO THE ORDER IS LOAD-BEARING: stop the tracking, THEN drop the pose. Reversed,
 * the next mouse move undoes the recenter.
 *
 * WHY IT ONLY MATTERS NOW: the tile was 104px for most of this game's life and a
 * 104px cat's eyeline is not legible. He is 230px while he briefs you, and the
 * first thing you notice about a face that size is where it is looking.
 *
 * `setGaze` IS AVAILABLE AND DELIBERATELY UNUSED BY DEFAULT. It aims the head at
 * a clock direction with an amplitude, which is a TURN — the wrong tool for
 * "look at the player", and pointing it anywhere non-zero reintroduces the exact
 * symptom. It stays wired behind `amp > 0` so a scene that needs an actual turn
 * can have one from the console: set `window.__virgilGaze = { deg, seconds, amp }`
 * and the next call picks it up. Gaze degrees are per-scene and cannot be
 * reasoned about from here — see the studio's note ("TUNE per scene; if a
 * character turns the WRONG way, swap its value").
 */
export const VIRGIL_GAZE = { deg: 90, seconds: 8, amp: 0 };

function gazeSettings() {
  const o = (typeof window !== "undefined" && window.__virgilGaze) || null;
  return { ...VIRGIL_GAZE, ...(o || {}) };
}

/**
 * Face front. Safe to call at any time — every hop is optional-chained and the
 * whole thing no-ops on a frame that has not come up.
 */
export function faceVirgilFront() {
  const w = portalWindow(VIRGIL_PORTAL_ID);
  if (!w) return false;
  // 1. STOP TRACKING THE POINTER. This is the fix; the rest is tidying.
  try { w.followCursor?.(0); } catch { /* frame not up */ }
  // 2. Drop any held expression and face front.
  recenterPortal(VIRGIL_PORTAL_ID);
  // 3. Only if somebody has asked for an actual turn. See the note above.
  const g = gazeSettings();
  if (g.amp > 0) {
    try { w.setGaze?.(g.deg, g.seconds, g.amp); } catch { /* frame not up */ }
  }
  return true;
}

/**
 * Speak one of his lines and resolve when it ENDS, so a turn stays paced.
 *
 * NO WAITING FOR THE PORTAL. counselSpeech exports waitForPortal for /main, where
 * the seeker asked a question and a beat of silence is the cost of getting the
 * presiding face to move. Here the line is an aside inside a turn that is already
 * running: holding the floor for up to eight seconds on the chance the cat's
 * player wakes up would make a broken portal read as a hung game. If he isn't
 * ready this instant, he speaks from ElevenLabs and only his mouth is lost.
 *
 * Resolves false only if BOTH paths declined — the caller treats that the way it
 * treats every other voice failure, which is to carry on. Voice is enrichment.
 */
export async function speakVirgilLine(text, { signal } = {}) {
  if (!text) return false;

  if (virgilPortalLive()) {
    // FACE FRONT BEFORE HE OPENS HIS MOUTH. Not once at boot: SitePal's idle
    // movement walks the head between lines, so a single recenter at startup is
    // correct for line one and gone by line four. Doing it per line is cheap
    // (two no-op-safe calls into a frame we are about to talk to anyway) and it
    // is the only version that survives an eight-line briefing.
    faceVirgilFront();
    // The portal resolves on its own talk-ended message, with a watchdog, so a
    // line that produces no audio cannot wedge the turn.
    const ok = await speakInPortal(VIRGIL_PORTAL_ID, text, VIRGIL.sitepal.voice);
    if (ok) return true;
    // FELL THROUGH ON PURPOSE. speakInPortal already warns with the reason. The
    // line still matters more than the lip-sync, so try the voice-only path
    // rather than dropping it — a cat who says nothing reads as a bug, a cat who
    // says it without moving reads as a still.
  }

  return speakAdviserLine("VG", text, { signal });
}

/** Cut him off mid-line. The portal and the audio element are separate
 *  mechanisms and a press can interrupt either, so both are stopped. */
export function stopVirgilLine() {
  try { portalWindow(VIRGIL_PORTAL_ID)?.stopSpeech?.(); } catch { /* frame not up */ }
}
