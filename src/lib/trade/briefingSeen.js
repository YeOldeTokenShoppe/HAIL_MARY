// HAS THIS PLAYER SAT THROUGH VIRGIL'S BRIEFING BEFORE?
//
// The briefing (BRIEFING in press/virgil.js) explains the objective, the four
// specialists, the follow-up budget and what the final control does. It is ~55
// seconds. A player who already knows all that and is starting their fourth case
// does not need to hear it again, and a game that makes them is a game they stop
// starting.
//
// SO THE LONG VERSION IS A FIRST-RUN BEAT and the one-line version is what a
// returning player gets. Both live in virgil.js; this module owns only the
// question of WHICH, because that question is about the browser rather than
// about the game, and press/virgil.js is pure by design — it reads run state and
// returns strings, and nothing in it may touch a Web API.
//
// NEVER READ DURING RENDER. `briefingMode()` reaches for localStorage and the
// query string, so calling it in a useState initialiser would run it on the
// server too and hand hydration a different answer than the client's. Both
// surfaces resolve it in a mount effect and hold the result in state.

/** Bumping the suffix re-briefs everybody, which is the right move if the rules change. */
const KEY = "ct_briefed_v1";

/**
 * WHICH BRIEFING THIS SITTING GETS.
 *
 * @returns {"long"|"short"|"off"}
 *
 * `?brief=` overrides everything and is the reason it exists — the first-run
 * beat is otherwise a one-shot you have to clear storage to see again, which
 * makes it the least testable thing in the session:
 *
 *   ?brief=long    the full six-line briefing, however many times you've played
 *   ?brief=short   the one-line version
 *   ?brief=off     straight to the pitch bot, no cat
 *
 * Beaten by nothing. A malformed query string falls through to the stored answer
 * rather than taking the floor down with it.
 */
export function briefingMode() {
  if (typeof window === "undefined") return "long";
  try {
    const q = new URLSearchParams(window.location.search).get("brief");
    if (q === "long" || q === "1") return "long";
    if (q === "short") return "short";
    if (q === "off" || q === "0") return "off";
  } catch { /* not worth taking the room down for */ }
  try {
    return window.localStorage.getItem(KEY) ? "short" : "long";
  } catch {
    // Private mode, or storage disabled. Erring toward the LONG version is the
    // right failure: a returning player hears the rules again, which is mildly
    // tedious, where the other way round drops a first-timer onto the floor with
    // no idea what the slider does.
    return "long";
  }
}

/**
 * Remember that they've heard it.
 *
 * Called when the briefing is FINISHED OR SKIPPED, not when it starts — skipping
 * is still a decision about the briefing, and a player who skips it does not want
 * it again next time. Cheap and idempotent.
 */
export function markBriefingSeen() {
  if (typeof window === "undefined") return;
  try { window.localStorage.setItem(KEY, String(Date.now())); } catch { /* see above */ }
}

/** Debug helper: forget, so the next load briefs from scratch. */
export function clearBriefingSeen() {
  if (typeof window === "undefined") return;
  try { window.localStorage.removeItem(KEY); } catch { /* see above */ }
}
