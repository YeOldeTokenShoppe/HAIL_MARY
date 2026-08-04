// HOW AN ANALYST SPEAKS — the seats' version of virgilVoice.js, and deliberately
// the same shape, because it is the same problem with three more characters in
// it. Read that file first; this note only covers what differs.
//
// THE PROBLEM. Marisol, GR80 and Connor have ElevenLabs voices and stills. A
// still cannot lip-sync, so their lines played over a motionless face while the
// panel ran a level meter and a glow off the amplitude — chrome pulsing in time
// with a mouth that never moved. That effect was retired on 2026-08-04 ("just
// that screen trick of synching the screen pulses with the voice"), which left
// the honest version: voice, still face. This is the other half — giving them a
// real mouth instead of a better fake.
//
// WHY NO CLIPS HAD TO BE RECORDED, since the obvious reading of "SitePal" is a
// bank of uploads: `sayAudio` resolves NAMES IN THE ACCOUNT and never URLs (the
// /trade/spike-sayaudio route exists to prove exactly that), so uploads would be
// the only route IF the player had to speak our audio. It doesn't. Engine 14 is
// ElevenLabs THROUGH the SitePal account: `sayText` takes arbitrary text and the
// player fetches the same voice our API would have, then lip-syncs what it made.
// Fifteen clips of authored bank lines were scoped and then not needed.
//
// THE VOICE MUST NOT CHANGE WITH THE PATH — the one rule carried over verbatim.
// Both routes end at the same ElevenLabs id: one via /api/counsel-voice, one via
// SitePal's integration. Which one runs depends on whether a portal happened to
// load, so if the two ids ever diverge the character changes voice for reasons
// the player cannot see. DESK[seat].sitepal.voice.voice is that seat's id in
// api/counsel-voice's VOICES map, and verify-press-run asserts it.

import { DESK } from "@/game/terminal-traders/press/desk";
import { portalWindow, speakAdviserLine, speakInPortal, waitForPortal } from "@/lib/counselSpeech";

/** DOM id of the wrapper hosting a seat's portal. One live at a time — see the
 *  mount note in PressFigure — so the id is per-seat rather than per-instance. */
export function seatPortalId(seat) {
  return `seat-portal-${seat}`;
}

/** Does this seat have a player configured at all? Eugene never will: his mouth
 *  is drawn and measured, which is better than a 2D player, not worse. */
export function seatHasPortal(seat) {
  return !!DESK[seat]?.sitepal;
}

/** Is this seat's player up and able to take a line RIGHT NOW? */
export function seatPortalLive(seat) {
  return typeof portalWindow(seatPortalId(seat))?.sayText === "function";
}

/**
 * Give a just-mounted portal a moment to register `sayText`.
 *
 * VIRGIL DELIBERATELY DOES NOT DO THIS and the difference is the beat, not the
 * character. His line is an aside inside a turn already running, so holding the
 * floor for it would make a broken portal read as a hung game. A seat's line is
 * the ANSWER TO A PRESS — the player has just spent one of three questions and a
 * one-use specialist, and the reply already waits on MIN_BEAT and an ElevenLabs
 * fetch. A short wait here overlaps that rather than adding to it.
 *
 * Short on purpose. This is insurance for a portal that is nearly up, not a
 * substitute for mounting it early — the cold-start note in PressFigure records
 * what happens when you rely on a wait instead of a warm player.
 */
export function warmSeatPortal(seat, ms = 1200) {
  if (!seatHasPortal(seat) || seatPortalLive(seat)) return Promise.resolve(seatPortalLive(seat));
  return waitForPortal(seatPortalId(seat), ms).catch(() => false);
}

/**
 * Speak one of a seat's lines and resolve when it ENDS, so the turn stays paced.
 *
 * Resolves false only if BOTH paths declined, which callers treat the way they
 * treat every other voice failure: carry on. Voice is enrichment, never a gate.
 */
export async function speakSeatLine(seat, text, { signal } = {}) {
  if (!text) return false;
  const cfg = DESK[seat]?.sitepal;

  if (cfg && seatPortalLive(seat)) {
    const ok = await speakInPortal(seatPortalId(seat), text, cfg.voice);
    if (ok) return true;
    // FELL THROUGH ON PURPOSE — speakInPortal has already warned with a reason.
    // The line matters more than the lip-sync: a seat that says nothing reads as
    // a bug, a seat that says it without moving reads as a still.
  }

  return speakAdviserLine(DESK[seat]?.voice, text, { signal });
}
