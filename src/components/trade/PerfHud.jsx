"use client";
// Opt-in on-device perf readout for the heavy mobile screens (?perf=1).
//
// WHY THIS EXISTS RATHER THAN EYEBALLING. The way these screens fail on a phone
// is THERMAL, not instant: bloom plus additive overdraw runs clean for the first
// 30-60 seconds and then degrades as the SoC heats. Looking at it for ten
// seconds tells you nothing about minute three. So the headline number here is
// not FPS — it's DRIFT, the difference between the first ten seconds and the
// last ten. That's the number that says "this is fine" or "this cooks the
// phone", and it's the one you cannot see by looking.
//
// WORST also matters more than FPS: an average of 58 hides a 90ms hitch every
// two seconds, and hitches are what actually read as broken.
//
// THE gl.info TRAP. three resets renderer.info at the top of every render()
// call when autoReset is on — and a composer issues several render calls per
// frame, so a naive read reports one pass, not one frame. This turns autoReset
// off, resets once per frame itself, and reads the PREVIOUS frame's totals
// (post passes run at priority 1, after this). Hence the one-frame lag.
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";

const WINDOW_MS = 1000;
const DRIFT_SAMPLES = 10; // seconds held at each end for the drift comparison

function PerfProbe({ store }) {
  const { gl } = useThree();
  const acc = useRef({ frames: 0, since: 0, worst: 0, started: 0, lastInfo: null });

  useEffect(() => {
    gl.info.autoReset = false;
    return () => { gl.info.autoReset = true; };
  }, [gl]);

  useFrame((_, delta) => {
    const a = acc.current;
    const now = performance.now();
    if (!a.started) { a.started = now; a.since = now; }

    // Previous frame's accumulated totals, then clear for this one.
    const info = gl.info;
    a.lastInfo = { calls: info.render.calls, tris: info.render.triangles };
    info.reset();

    a.frames += 1;
    const ms = delta * 1000;
    if (ms > a.worst) a.worst = ms;

    if (now - a.since >= WINDOW_MS) {
      const fps = (a.frames * 1000) / (now - a.since);
      const s = store.current;
      s.fps = fps;
      s.worst = a.worst;
      s.calls = a.lastInfo.calls;
      s.tris = a.lastInfo.tris;
      s.elapsed = (now - a.started) / 1000;
      // `head` freezes the opening seconds; `history` is a rolling tail. Drift
      // is the gap between them, so only these two ends are ever kept.
      if (s.head.length < DRIFT_SAMPLES) s.head.push(fps);
      s.history.push(fps);
      if (s.history.length > DRIFT_SAMPLES) s.history.shift();
      a.frames = 0; a.worst = 0; a.since = now;
    }
  });

  return null;
}

function avg(xs) { return xs.length ? xs.reduce((t, x) => t + x, 0) / xs.length : 0; }

function PerfReadout({ v }) {
  // Drift: mean of the opening seconds vs the most recent. Negative = the phone
  // is throttling. Withheld until both windows are actually full, since a
  // comparison against two seconds of data is noise.
  const head = avg(v.head);
  const tail = avg(v.history);
  const drift =
    v.head.length >= DRIFT_SAMPLES && v.elapsed > DRIFT_SAMPLES * 2 ? tail - head : null;
  const bad = v.fps < 45 || v.worst > 50;
  const throttling = drift != null && drift < -6;

  return (
    <div className="perf-hud">
      <div className="perf-row">
        <b className={bad ? "is-bad" : "is-ok"}>{v.fps.toFixed(0)} fps</b>
        <span className={v.worst > 50 ? "is-bad" : ""}>worst {v.worst.toFixed(0)}ms</span>
      </div>
      <div className="perf-row">
        <span>{v.calls} draws</span>
        <span>{(v.tris / 1000).toFixed(0)}k tris</span>
      </div>
      <div className="perf-row">
        <span className={throttling ? "is-bad" : drift != null ? "is-ok" : ""}>
          {drift == null
            ? `drift … ${Math.max(0, Math.ceil(DRIFT_SAMPLES * 2 - v.elapsed))}s`
            : `drift ${drift > 0 ? "+" : ""}${drift.toFixed(0)} fps`}
        </span>
        <span>{v.elapsed.toFixed(0)}s</span>
      </div>
      <style>{`
        .perf-hud {
          position: absolute; top: 6px; left: 6px; z-index: 40; pointer-events: none;
          background: rgba(2,10,8,0.82); border: 1px solid rgba(77,255,170,0.35);
          padding: 5px 7px; font-family: 'Courier New', monospace; font-size: 9px;
          line-height: 1.5; color: #9fd8d0; letter-spacing: 0.04em; min-width: 118px;
        }
        .perf-row { display: flex; justify-content: space-between; gap: 10px; }
        .perf-hud b { font-size: 11px; }
        .is-ok { color: #4dffaa; }
        .is-bad { color: #ff6b6b; }
      `}</style>
    </div>
  );
}

/**
 * Returns `{ probe, readout }`. Put `probe` INSIDE the Canvas and `readout`
 * anywhere in the surrounding positioned container. Both are null unless the
 * URL carries ?perf=1, so this costs nothing in normal use.
 */
export default function usePerfHud() {
  const enabled = useMemo(() => {
    if (typeof window === "undefined") return false;
    return new URLSearchParams(window.location.search).has("perf");
  }, []);

  const store = useRef({ fps: 0, worst: 0, calls: 0, tris: 0, elapsed: 0, history: [], head: [] });
  const [view, setView] = useState(null);

  useEffect(() => {
    if (!enabled) return undefined;
    // 4Hz — fast enough to watch, slow enough that the HUD isn't measuring
    // itself. React work per sample is what would skew the thing being read.
    const id = setInterval(() => setView({ ...store.current }), 250);
    return () => clearInterval(id);
  }, [enabled]);

  return {
    probe: enabled ? <PerfProbe store={store} /> : null,
    readout: enabled && view ? <PerfReadout v={view} /> : null,
  };
}
