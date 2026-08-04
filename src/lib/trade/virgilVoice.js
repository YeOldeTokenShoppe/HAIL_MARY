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
import { portalWindow, speakAdviserLine, speakInPortal } from "@/lib/counselSpeech";

/** DOM id of the wrapper that hosts his portal tile. Both the tile and the
 *  speaker have to agree on this string; nothing else uses it. */
export const VIRGIL_PORTAL_ID = "virgil-portal";

/** Is his player up and able to take a line right now? */
export function virgilPortalLive() {
  return typeof portalWindow(VIRGIL_PORTAL_ID)?.sayText === "function";
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
