"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// THE TRANSPORT'S VIEW OF THE SET.
//
// The set is a 3D scene with a frame loop; its playback clock lives on a ref
// and moves sixty times a second, and nothing on the page should re-render at
// that rate to follow it. So TalkShowScene publishes `window.__talkShowStatus`
// and the controls ask, rather than being pushed to.
//
// The same window handles are how /trade and the phone screen already start
// and stop an episode (`__talkShowPlay`, `__talkShowStop`), so this follows a
// path that exists rather than threading a second one through the page.

// Asked four times a second, but only handed on when the second changes or a
// flag flips — so the console re-renders about once a second while an episode
// plays, and the progress bar still moves without a visible step.
const POLL_MS = 250;

const IDLE = {
  running: false,
  paused: false,
  settling: false,
  elapsed: 0,
  duration: 0,
  section: 0,
  sectionCount: 0,
  sectionStart: 0,
  sectionStarts: [],
  exactPause: true,
};

const sameEnough = (a, b) =>
  a.running === b.running &&
  a.paused === b.paused &&
  a.settling === b.settling &&
  a.section === b.section &&
  a.sectionCount === b.sectionCount &&
  a.duration === b.duration &&
  a.exactPause === b.exactPause &&
  Math.round(a.elapsed) === Math.round(b.elapsed);

const read = () => {
  try {
    const status = window.__talkShowStatus?.();
    return status ? { ...IDLE, ...status } : IDLE;
  } catch (e) {
    return IDLE;
  }
};

/**
 * @param active  whether an episode is up. Polling stops when it isn't, so a
 *                page sitting on the lineup runs no timer at all.
 */
export default function useTalkShowTransport(active) {
  const [status, setStatus] = useState(IDLE);
  const statusRef = useRef(IDLE);

  const refresh = useCallback(() => {
    const next = read();
    if (sameEnough(next, statusRef.current)) return next;
    statusRef.current = next;
    setStatus(next);
    return next;
  }, []);

  useEffect(() => {
    if (!active) {
      statusRef.current = IDLE;
      setStatus(IDLE);
      return undefined;
    }
    refresh();
    const timer = setInterval(refresh, POLL_MS);
    return () => clearInterval(timer);
  }, [active, refresh]);

  // Each of these acts and then reads back, so a control shows what actually
  // happened rather than what it asked for — a pause pressed while a section
  // is still loading, for instance, is held by the set until the audio starts.
  const call = useCallback(
    (name, ...args) => {
      let result = null;
      try {
        result = window[name]?.(...args) ?? null;
      } catch (e) {
        result = null;
      }
      refresh();
      return result;
    },
    [refresh],
  );

  const pause = useCallback(() => call("__talkShowPause"), [call]);
  const resume = useCallback(() => call("__talkShowResume"), [call]);
  const toggle = useCallback(
    () => (statusRef.current.paused ? resume() : pause()),
    [pause, resume],
  );
  const step = useCallback((by) => call("__talkShowStep", by), [call]);
  const seek = useCallback((seconds) => call("__talkShowSeek", seconds), [call]);

  return { status, pause, resume, toggle, step, seek, refresh };
}

/** "6:51" — the clock a viewer reads, not the guide's zero-padded runtime. */
export function clockTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const whole = Math.floor(seconds);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
}
