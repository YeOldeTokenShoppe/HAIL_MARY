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
import { portalWindow, speakAdviserLine, speakInPortal, toSpeech, waitForPortal } from "@/lib/counselSpeech";

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

/* ─────────────────────────── THE 3D ROOM'S MOUTH ───────────────────────────
 *
 * SAME sayText, A DIFFERENT PLAYER — and that is the whole of the desktop bug.
 *
 * The flat surface gives each seat its OWN portal iframe and speaks into it
 * (speakInPortal -> w.sayText). PressSession cannot: the face you are looking at
 * in the room is not an iframe, it is `Detective_Face2`, a MESH being painted
 * every frame from the canvas of the page-level SitePal host that /trade mounts
 * once and scene-swaps per character (SITEPAL_PROJECTION_CONFIG). Mounting a
 * per-seat portal here would lip-sync a hidden tile while the projected face sat
 * still — the right mouth moving in the wrong place.
 *
 * So the line has to go to THAT host, and the host is not addressed by calling
 * sayText directly either: /trade owns a queue in front of it (retries, scene
 * gating, interrupt mode, volume) and reaching past it is how you get a silent
 * decline. The supported call is exactly what the case-file review flow makes —
 * stage `__sitePalPendingSpeech`, then poke `__sitePalSpeakPending`.
 *
 * WHY THIS WAS NEVER MISSING-BUT-BROKEN, only missing: PressSession's speakLine
 * has no `seat` parameter at all. Eugene and Virgil are special-cased by VOICE
 * and everyone else falls to speakAdviserLine, which plays our own <audio> and
 * drives adviserMouth — a channel the room has no reader for. You hear her, the
 * camera cuts to her, and the projected face never learns a line was spoken.
 *
 * THE THREE WAYS THE HOST DECLINES, all silent, all guarded here:
 *   1. VOLUME. runSpeechRequest bails when `__sitePalDesiredVolume <= 0`, and it
 *      initialises to 0. CyborgTempleScene raises it to 7 whenever a projection
 *      is active, which the press already causes by focusing the seat — but this
 *      sets it too rather than depending on another component's effect order.
 *   2. SCENE. It refuses a request whose sceneId is not the loaded one. We stage
 *      the request either way: /trade fires pending speech from vh_sceneLoaded,
 *      so a swap in flight delivers the line when it lands instead of dropping.
 *   3. NO HOST. On any surface without /trade's embed the globals are absent —
 *      returns false, and the caller falls back to our own audio.
 */

/**
 * WHICH SCENE THE HOST MUST BE ON to paint this seat's face.
 *
 * NOT `DESK[seat].sitepal.sceneId`, which is the trap this function exists to
 * close. That id is the seat's OWN portal scene — what the flat surface loads
 * into its per-seat iframe — and for two of the three seats it is a different
 * scene in the account from the one the temple's projection is configured
 * against (Connor 2775052 vs 2774900, GR80 2775053 vs 2774449). Marisol's two
 * ids happen to be identical, so driving the host with the seat's id worked on
 * exactly the character it was tested with and silently painted nothing on the
 * other two: paintProjection requires the loaded scene to match ITS config, and
 * when it doesn't it just leaves the static Face1 up (author, 2026-08-04 —
 * "marisol's mouth was moving, however no face movement on Connor's face").
 *
 * Read from the window map /trade publishes next to the host's other globals,
 * rather than imported, so a lib does not have to pull in the scene component.
 * Absent map → no host path at all, and the caller falls back to our own audio.
 * Guessing here is what produced a silent half-working feature the first time.
 */
function projectionSceneId(seat) {
  const agentId = DESK[seat]?.agentId;
  if (!agentId || typeof window === "undefined") return null;
  return window.__sitePalSceneIds?.[agentId] ?? null;
}

/** Can this seat's face be driven by the room's shared SitePal host? */
export function seatHasHostFace(seat) {
  return !!projectionSceneId(seat);
}

/**
 * SWAP SCENES WITHOUT STRANDING THE PROJECTION.
 *
 * `__sitePalSceneLoaded` is a latch we clear before loadSceneByID and only
 * vh_sceneLoaded sets back (page.js:440). If that callback never fires — the
 * player declines a swap it considers redundant, the load fails, the frame is
 * busy — the latch stays false for the rest of the session, and paintProjection
 * ANDs it into `onScene`, so every projected face silently stops painting.
 *
 * THE FAILURE IS ASYMMETRIC, which is why this is worth a timer. Speech does not
 * consult the latch at all: runSpeechRequest only compares `request.sceneId`
 * against `__sitePalCurrentSceneId`. So a stranded latch produces precisely the
 * report that led here — "only the correct audio played but the face mesh did
 * not play the mouth animation from sitepal". Right voice, right line, dead face,
 * nothing logged anywhere.
 *
 * Restoring it after a timeout can only ever paint a face one scene stale for a
 * moment; leaving it false paints nothing ever again. That trade is not close.
 */
/* WHICH SWAP IS IN FLIGHT, so a second request for the same face cannot stomp
 * the first. `__sitePalCurrentSceneId` is NOT usable for this: it is only
 * updated inside vh_sceneLoaded, so for the whole duration of a load it still
 * reports the OLD scene, and any caller that tests it concludes a swap is needed
 * and fires another one.
 *
 * That is not hypothetical. press() calls warmSeatHostFace, then sayTurn reaches
 * speakSeatOnTempleHost milliseconds later, sees the stale id, and issues a
 * second loadSceneByID into the middle of the first. SitePal then dies mid-boot
 * with `Cannot read properties of null (reading 'offsetWidth')` inside
 * vhssHTML5_loadedCallback, vh_sceneLoaded never fires, and the id stays on the
 * previous character permanently — the "player was not ready in 5s (scene
 * 2774900/2774916)" report, where the two numbers are the whole story. */
let swapInFlight = null;

/**
 * The chatty half of this file's logging, off by default.
 *
 * FAILURES STAY LOUD — every early return here falls back to speakAdviserLine,
 * which plays the SAME voice through our own <audio>, so a declined host sounds
 * completely correct and only the face gives it away. Those warnings stay
 * unconditional for exactly that reason.
 *
 * What goes behind the switch is the SUCCESS narration, which is three lines per
 * press once it works. Turn it on with `?seatvoice=1` or, mid-session,
 * `window.__seatVoiceDebug = true`.
 */
function hostLog(msg) {
  if (typeof window === "undefined") return;
  if (window.__seatVoiceDebug === undefined) {
    try {
      window.__seatVoiceDebug =
        new URLSearchParams(window.location.search).get("seatvoice") === "1";
    } catch { window.__seatVoiceDebug = false; }
  }
  if (window.__seatVoiceDebug) console.log(`[seatVoice] ${msg}`);
}

function loadSceneWithLatchGuard(sceneId, timeoutMs = 8000) {
  if (typeof window.loadSceneByID !== "function") return false;
  // Already on the way there. Say so rather than re-issuing: the caller's job is
  // to WAIT for readiness, which it does either way.
  if (swapInFlight === sceneId) return true;
  swapInFlight = sceneId;
  window.__sitePalSceneLoaded = false;
  try { window.loadSceneByID(sceneId); }
  catch { swapInFlight = null; window.__sitePalSceneLoaded = true; return false; }
  clearTimeout(window.__seatSceneLatchTimer);
  window.__seatSceneLatchTimer = setTimeout(() => {
    if (swapInFlight === sceneId) swapInFlight = null;
    if (window.__sitePalSceneLoaded !== false) return;
    /* RELEASE THE LATCH ONLY IF THE SCENE ACTUALLY ARRIVED. The first version of
     * this released it unconditionally, which made a FAILED swap look like a
     * completed one: the log said "releasing so the projection can paint" while
     * the host was still on the previous character, and the readiness check then
     * reported `loaded true` about a scene that had never loaded. A lost
     * callback and a failed load need different answers, and only the scene id
     * can tell them apart. */
    if (window.__sitePalCurrentSceneId === sceneId) {
      console.warn(
        `[seatVoice] scene ${sceneId} is up but never reported loaded in ` +
        `${timeoutMs}ms — releasing the latch so the projection can paint.`,
      );
      window.__sitePalSceneLoaded = true;
    } else {
      console.warn(
        `[seatVoice] swap to scene ${sceneId} FAILED — host is still on ` +
        `${window.__sitePalCurrentSceneId}. Leaving the latch down; painting the ` +
        `wrong character's face would be worse than painting none.`,
      );
    }
  }, timeoutMs);
  return true;
}

/** The swap landed (or we gave up waiting) — let the next one through. */
function clearSwapInFlight(sceneId) {
  if (swapInFlight === sceneId) swapInFlight = null;
}

/**
 * Speak a seat's line on the temple's projected face.
 *
 * RESOLVES WHEN SHE STOPS, NOT WHEN THE HOST ACCEPTS — and the first cut of this
 * got that wrong in a way worth recording, because it looked like it worked. The
 * request is accepted in ~100ms, so returning then let PressSession's
 * `Promise.all([sayTurn, MIN_BEAT])` settle at 1400ms flat: her receipt stamped
 * and SEE WHAT LANDED appeared while she was still mid-sentence. That is exactly
 * the contract the press() comment spells out — "the board updates when the
 * reporter STOPS, not when you press" — and speakAdviserLine had been honouring
 * it for free by awaiting its own <audio>.
 *
 * HOW WE KNOW SHE STOPPED, given we don't own the end event: we estimate, and
 * that is a deliberate second choice. /trade wraps vh_speechEnded /
 * vh_audioEnded for its own queue, so hooking a listener from here would either
 * race that chain or leak a wrapper per line.
 *
 * `__sitePalActiveSpeech` LOOKS LIKE THE RIGHT SIGNAL AND IS NOT — measured, not
 * assumed. Watching the slot empty resolved a 76-character line 1.9s after
 * sayText, under even the floor below: the queue clears its slot when the
 * request has been DISPATCHED, not when the character stops talking. Reading it
 * as an end event just reintroduces the accept-time bug with more code.
 *
 * ~62ms/char with a floor, matching speakInPortal's watchdog: both stand in for
 * the same missing signal, and two different guesses about how long one sentence
 * takes would drift the surfaces apart. Erring long is the safe direction — a
 * small dead beat after she finishes reads as a pause; the other way round, the
 * answer panel opens over her voice.
 */
export async function speakSeatOnTempleHost(seat, text) {
  if (typeof window === "undefined" || !text) return false;
  const cfg = DESK[seat]?.sitepal;
  const characterId = DESK[seat]?.agentId;
  const sceneId = projectionSceneId(seat);
  /* NAME THE REASON — counselSpeech's own rule, and this chain needed it more
   * than that one did. Every exit here is a fall back to speakAdviserLine, which
   * plays the SAME ElevenLabs voice through our own <audio>: the line sounds
   * completely correct and the face never moves. There is no symptom that
   * distinguishes "the host declined" from "the host spoke and the projection
   * isn't painting", which is what made this take four rounds to corner. */
  if (!characterId) {
    console.warn(`[seatVoice] seat "${seat}" has no agentId — no face in the room.`);
    return false;
  }
  if (!sceneId) {
    console.warn(
      `[seatVoice] no projection scene for "${characterId}". ` +
      `window.__sitePalSceneIds is ${window.__sitePalSceneIds ? "missing that key" : "not published"} ` +
      `— /trade sets it where it mounts the SitePal host.`,
    );
    return false;
  }
  if (typeof window.__sitePalSpeakPending !== "function") {
    console.warn("[seatVoice] no __sitePalSpeakPending — the SitePal host is not mounted.");
    return false;
  }

  // Optional-chained: the guard above is on the PROJECTION scene, so a seat can
  // reach this with a face in the room and no per-seat portal config at all.
  const v = cfg?.voice || {};
  const spoken = toSpeech(text);

  /* THE PREAMBLE IS NOT OPTIONAL, and skipping it is what made the first cut of
   * this fire sayText with every gate green and still show a still face. Lifted
   * from the character-click handler in CyborgTempleScene, which is the version
   * of this that has always worked — click any analyst in the lobby and they
   * turn and speak with a moving projected face. Same host, same call; the only
   * thing the press floor adds is our own text instead of a random meet-line.
   *
   * THE PRELOADER IS THE INTERESTING ONE. /trade warms the other characters'
   * scenes at startup by cycling loadSceneByID through them, and it will happily
   * swap the host off this seat between our staging and the host's init timer —
   * at which point runSpeechRequest's sceneId guard rejects the line and nothing
   * anywhere says so. The lobby handler cancels it for exactly this reason. */
  try {
    /* EVERY PLAYER CALL IN THIS PREAMBLE GETS ITS OWN CATCH, and saySilent is
     * why. On a player that is still booting it throws
     *
     *     TypeError: Cannot read properties of null (reading 'dontSayURL')
     *         at _saySilent (sitepalPlayer_v1.js)
     *
     * and because it was the FIRST statement inside one big try, that throw
     * skipped the staging, the swap and the poke, and returned false — so the
     * caller fell back to speakAdviserLine and you got the right voice out of our
     * own <audio> with a motionless face (author, 2026-08-04, test 2). A cleanup
     * call failing must never cost us the line it was cleaning up for. */
    try { if (typeof window.saySilent === "function") window.saySilent(0); } catch {}
    if (window.__sitePalSpeechRetryTimer) {
      clearTimeout(window.__sitePalSpeechRetryTimer);
      window.__sitePalSpeechRetryTimer = null;
    }
    // Drop whatever the host was doing — a previous seat's line, or the scene's
    // own bound audio — before claiming the slot.
    window.__sitePalActiveSpeech = null;
    if (typeof window.stopSpeech === "function") { try { window.stopSpeech(); } catch {} }
    if (window.__sitePalPreloading) {
      window.__sitePalPreloading = false;
      window.__sitePalPreloadQueue = null;
    }

    window.__sitePalDesiredVolume = 7;                     // (1) above
    window.__sitePalPendingSpeech = {
      characterId,
      sceneId,
      speech: {
        type: "text",
        text: spoken,
        voice: v.voice ?? v.id,
        lang: v.lang,
        engine: v.engine,
        effect: v.effect,
        effLevel: v.effLevel,
      },
    };

    /* THE SCENE ID IS THE TRUTH; THE LATCH IS ONLY A HINT.
     *
     * This used to read `sameScene && loaded` / `else if (loaded)` / else do
     * nothing — and the do-nothing arm is reachable in the one state that
     * matters. `__sitePalSceneLoaded` is stranded false whenever a loadSceneByID
     * goes unanswered (see loadSceneWithLatchGuard), and it stays that way. Land
     * in that state while the host is ALREADY on this character and both arms
     * fail: the right scene is up, the request is staged, and nobody ever pokes
     * it. The line is then never spoken by the host at all.
     *
     * runSpeechRequest does not consult the latch — it compares sceneIds. So if
     * the id matches we can speak, full stop, and a stale latch is something to
     * clear rather than to obey. */
    const sameScene = window.__sitePalCurrentSceneId === sceneId;
    if (sameScene) {
      // The scene we need IS up; if the latch says otherwise the latch is wrong,
      // and leaving it wrong also keeps paintProjection from ever painting.
      if (window.__sitePalSceneLoaded !== true) window.__sitePalSceneLoaded = true;
    } else {
      // Different scene. Swap for it either way — the guard releases the latch
      // if the load goes unanswered. Refusing to swap because a PREVIOUS swap
      // never reported back is how one lost callback disables this for good.
      loadSceneWithLatchGuard(sceneId);
    }
  } catch (err) {
    console.warn("[seatVoice] host speech threw:", err);
    return false;
  }

  /* AND NOW WAIT FOR THE PLAYER, which is the beat this whole path was missing.
   *
   * press() fires warmSeatHostFace and starts sayTurn in the SAME TICK, so the
   * scene swap and the line were simultaneous — and a swap re-initialises the
   * SitePal player, which takes seconds. We were talking to something still
   * booting. The two ways that showed up are both in the 2026-08-04 traces:
   * saySilent throwing on a null player (handled above), and the host accepting
   * the request and then logging "speech did not start" twice before giving up,
   * with vhsshtml5_startSitepal still on the stack.
   *
   * WHAT COUNTS AS READY: the scene ID matching, plus `sayText` existing. The
   * id is the honest signal because vh_sceneLoaded sets it and the latch
   * together, so a matching id means the load genuinely completed — whereas the
   * latch alone can be forced true by the watchdog above. `sayText` is the same
   * test seatPortalLive uses for the flat surface's portals. The latch is
   * deliberately NOT part of this test any more; it was reporting `loaded true`
   * about a scene that had never loaded.
   *
   * RESOLVES FALSE ON TIMEOUT so the caller falls back to our own audio: a line
   * in the right voice without lip-sync beats no line at all. The staged request
   * is cleared on that path, or it fires later on top of the fallback — the
   * double-audio bug in a new costume. */
  const WAIT_MS = 8000;
  const ready = await (async () => {
    const started = Date.now();
    while (Date.now() - started < WAIT_MS) {
      if (typeof window.sayText === "function" &&
          window.__sitePalCurrentSceneId === sceneId) return true;
      await new Promise((r) => setTimeout(r, 120));
    }
    return false;
  })();
  clearSwapInFlight(sceneId);

  if (!ready) {
    window.__sitePalPendingSpeech = null;
    console.warn(
      `[seatVoice] ${characterId}'s player was not ready in ${WAIT_MS}ms ` +
      `(scene ${window.__sitePalCurrentSceneId}/${sceneId}, ` +
      `loaded ${window.__sitePalSceneLoaded}, sayText ${typeof window.sayText}) ` +
      `— falling back to our own audio, so expect voice without lip-sync.`,
    );
    return false;
  }

  /* DON'T SPEAK IT TWICE. When we waited out a scene swap, vh_sceneLoaded has
   * ALREADY delivered our staged request on arrival — that is the whole reason
   * staging works across a swap. Poking again here would run the same text a
   * second time and put her on top of herself, which is the double-audio bug
   * wearing a new hat. `__sitePalActiveSpeech` holds the request currently being
   * spoken, so matching our own text against it is the cheapest way to tell
   * "already away" from "still staged". */
  const already = window.__sitePalActiveSpeech;
  if (already && already.type === "text" && already.text === spoken) {
    hostLog(`${characterId} was already started by the scene load — not re-poking.`);
  } else {
    try {
      // Volume EXPLICITLY as well as staged. runSpeechRequest raises it too, but
      // the lobby path does it here first and this is not the place to find out
      // which order matters.
      if (typeof window.setPlayerVolume === "function") window.setPlayerVolume(7);
      window.__sitePalSpeakPending(null);
    } catch (err) {
      window.__sitePalPendingSpeech = null;
      console.warn("[seatVoice] poke failed:", err);
      return false;
    }
  }

  const limit = Math.max(2200, Math.round(spoken.length * 62));
  // Worth keeping behind the switch rather than deleting: "the host accepted it"
  // and "the mesh animated" are different claims, and only the first is knowable
  // from here. Seeing this WITHOUT a moving face says the speech chain is fine
  // and the fault is in paintProjection's gates — a different file entirely, and
  // that distinction cost several rounds to establish the first time.
  hostLog(
    `${characterId} speaking on the host — scene ${sceneId}, ` +
    `vol ${window.__sitePalDesiredVolume}, holding ${limit}ms.`,
  );
  await new Promise((resolve) => setTimeout(resolve, limit));
  return true;
}

/**
 * Get the host onto a seat's scene BEFORE it is asked to talk.
 *
 * A cold swap is seconds; warm (after /trade's preload queue) it is near
 * instant. Called at press time, when the camera is already moving to the seat,
 * so the swap overlaps the beat the answer already waits out — the same trick
 * warmSeatPortal plays on the flat surface, against a different mechanism.
 */
export function warmSeatHostFace(seat) {
  if (typeof window === "undefined") return false;
  const sceneId = projectionSceneId(seat);
  if (!sceneId) return false;
  if (window.__sitePalCurrentSceneId === sceneId) return true;
  // NEVER SWAP ON TOP OF A SWAP — but that is loadSceneWithLatchGuard's job now,
  // by target scene rather than by the latch. Gating on the latch here was its
  // own bug: once the latch stranded false, warming refused to run at all, so
  // the face could never be got ready again for the rest of the session.
  if (typeof window.loadSceneByID !== "function") return false;
  try {
    // The preloader would otherwise cycle straight past this seat again — see
    // the long note in speakSeatOnTempleHost.
    if (window.__sitePalPreloading) {
      window.__sitePalPreloading = false;
      window.__sitePalPreloadQueue = null;
    }
    window.__sitePalDesiredVolume = 7;
    /* MUZZLE THE SCENE'S OWN GREETING BEFORE SWAPPING TO IT.
     *
     * vh_sceneLoaded calls speakPending, and a scene arriving with nothing
     * useful staged plays the meet-line bound to it in the SitePal account — so
     * warming Marisol's face made her deliver her lobby hello, the projected
     * mouth lip-synced THAT, and her actual answer arrived underneath it: "i
     * heard 'the chain doesn't lie, read the receipts' from her lobby intro, and
     * that's what the mouth moved to. At the same time, i could hear her
     * response to the pitchbot spoken" (author, 2026-08-04).
     *
     * AN EMPTY TEXT REQUEST, NOT A NULL AUDIO ONE. `{type:'audio', audioName:
     * null}` is the shape CyborgTempleScene's in-game branch stages and it does
     * NOT hold here, because vh_sceneLoaded calls speakPending(currentAudioName)
     * and speakPending refills a null audioName from that fallback:
     *
     *     audioName = speech.type === "audio"
     *       ? (speech.preferSceneAudio ? ... : (speech.audioName || fallbackAudioName))
     *       : null;                                          // page.js:373
     *
     * So the "silent" request became sayAudio(<her intro>) — the muzzle was the
     * thing playing the greeting. A TEXT request with empty text cannot be
     * refilled (the ternary yields null for any non-audio type), skips both
     * audio fixups below it, and then fails runSpeechRequest's `request.text`
     * guard, so no branch runs and nothing is spoken. */
    window.__sitePalPendingSpeech = {
      characterId: DESK[seat]?.agentId,
      sceneId,
      speech: { type: "text", text: "" },
    };
    return loadSceneWithLatchGuard(sceneId);
  } catch { return false; }
}
