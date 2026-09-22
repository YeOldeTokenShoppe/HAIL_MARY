"use client";
// LT TV on mobile — the talk_show3.glb set running inside the Liminal Terminal.
//
// WHY THIS EXISTS SEPARATELY FROM THE DESKTOP TAB. The desktop set is swapped
// into the page's big CleanCanvas (app/trade/page.js), which is gated
// `!isMobileView` — mobile never mounts it. The terminal is the natural home on
// a phone: TradeLaptop already unmounts its own heavy scene (SceneLoader +
// EffectComposer) while the fullscreen CRT is open, precisely so GPU memory is
// free for SitePal, and this screen spends exactly that freed budget.
//
// THE SET IS RENDERED AS A 16:9 PANEL, NOT FULLSCREEN. Two reasons, and the
// first is the real one:
//   • Fill rate. A letterboxed panel on a 390pt phone is ~0.2MP/frame instead
//     of ~0.75MP fullscreen. That headroom is what pays for the live face.
//   • Framing. Fitting the wide two-shot into a portrait viewport needs either
//     a ~120° vertical FOV or a camera ~12 units back — both wreck the
//     composition. In a 16:9 box the DESKTOP camera pose transfers unchanged,
//     and a broadcast that looks like a broadcast suits "LT TV" anyway.
//
// Three further mobile budget switches are passed to TalkShowScene: solo face
// projection, no in-scene camera monitor, and a viewport-fitted portal host.
// See the prop comments on TalkShowScene's default export.
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import TalkShowScene, { HouseAmbient } from "./TalkShowScene";
import { SHOWS } from "@/content/lt-tv";
import useNewEpisodes from "./useNewEpisodes";
import LTTvReactions from "./LTTvReactions";
import usePerfHud from "./PerfHud";
import useTalkShowTransport, { clockTime } from "./useTalkShowTransport";

// Camera + aim carried over from the desktop talk-show pose (`talkShowPose` in
// app/trade/page.js), pushed in for phone-sized real estate: the desktop shot is
// a wide that gives ~40% of the frame to carpet and ~23% to empty stage, which
// is fine on a monitor and unreadable at 390pt.
//
// FRAME WIDTH, NOT FOV, IS THE KNOB. A two-shot is a horizontal composition, so
// the width is the dimension that must not drift; the vertical fov is derived
// from it per aspect. That's what lets the same numbers hold the same shot in a
// portrait panel and in a rotated fullscreen broadcast, instead of needing a
// hand-fitted fov for every stage shape.
//
// Live-tunable from the console — same contract as the set's `__tsLights` /
// `__tsMonitor`: the per-frame sync reads these fields every tick, so edits go
// live. e.g. `__mtsCam.frameWidth = 3` to push in further.
export const MOBILE_TALK_SHOW_CAM = {
  position: [0.15, 0.15, 3.7],
  // THE SHOT IS MEASURED, NOT TYPED. Hand-fitted numbers were the wrong tool
  // here: eyeballing them off a screenshot put the guests half outside the
  // frame, and any re-export of the set would invalidate whatever number
  // finally looked right. So the rig locates the two head bones at runtime and
  // derives the framing from where the guests ACTUALLY are.
  //
  // How far apart the heads sit, times this, is the width the lens holds. The
  // heads are well inside the bodies — shoulders, knees and the arms of the
  // chairs all sit outside them — so this is comfortably above 1. Fitted by eye
  // against the set: the seated bodies span ~2.2× the head separation on their
  // own, so 2.0 clipped knees and shoulders at the frame edges and 2.75 left
  // the guests small in a lot of carpet. This is the tight end of what holds
  // both of them — go much below it and the outer knees start going out.
  spread: 1.3,
  // Drop below the eyeline, as a fraction of the head separation. Centring on
  // the heads themselves buys a lot of empty stage above and cuts the guests
  // off at the waist; a chest-up two-shot wants the frame centre lower. Kept
  // modest because everything below the guests is carpet — dropping further
  // buys floor, not subject.
  dropBelowHeads: 0.22,
  // Fallbacks if the bones can't be found (a renamed rig on re-export). These
  // are the desktop wide, which is safe-but-loose rather than wrong.
  fallbackTarget: [0.15, -0.45, 0.1],
  fallbackWidth: 6.2,
  // Guard rails on the derived vertical fov, so a freak aspect (a very tall
  // split screen, a landscape sliver) can't produce a fisheye or a periscope.
  minFov: 20,
  maxFov: 64,
};

// Both rigs use identically-named `mixamorig:` bones (see TalkShowScene), so
// this expects to find exactly two. Matched the same way TalkShowScene's own
// head-bone lookup does — strip every non-alphanumeric, then match exactly.
// GLTFLoader rewrites "mixamorig:Head" and suffixes duplicate rig names, so a
// naive /:Head$/ never matches; the exact match also excludes HeadTop_End.
const isHeadBone = (node) =>
  node.isBone &&
  /^mixamorighead\d*$/i.test(node.name.replace(/[^a-z0-9]/gi, ""));

// Plain <Canvas>, deliberately NOT CleanCanvas: that wrapper disposes every
// texture/geometry it can reach and clears THREE.Cache on unmount, which would
// gut the drei useGLTF entry the set is cloned from — the next open (or the
// desktop tab) would come up with dead materials. R3F disposes its own renderer.
function StageCamera({ newsMode }) {
  const { scene } = useThree();
  // The MEASUREMENT only — { separation, mid }. Deliberately not the solved
  // shot: baking `spread` in here at measure time is what made the advertised
  // `__mtsCam` knob inert, since nothing re-ran when it changed.
  const subjectRef = useRef(null);
  const targetRef = useRef(new THREE.Vector3());

  useEffect(() => {
    if (typeof window !== "undefined") window.__mtsCam = MOBILE_TALK_SHOW_CAM;
  }, []);

  // Solved EVERY tick, so console edits to `__mtsCam` go live — the same
  // contract as the set's `__tsLights` / `__tsMonitor`. It's a handful of trig
  // per frame against a scene that is rendering two skinned characters.
  useFrame((state) => {
    const cfg = MOBILE_TALK_SHOW_CAM;
    const camera = state.camera;

    // Locate the guests once. Retried per frame until it lands: the set streams
    // in under Suspense, so there's no mount moment where the bones are surely
    // present. Their world positions are what matter — the set carries a scale
    // and an offset, so local bone coordinates would frame the wrong volume.
    if (!subjectRef.current) {
      const heads = [];
      scene.traverse((o) => {
        if (isHeadBone(o)) heads.push(o);
      });
      if (heads.length >= 2) {
        const a = heads[0].getWorldPosition(new THREE.Vector3());
        const b = heads[1].getWorldPosition(new THREE.Vector3());
        const separation = a.distanceTo(b);
        if (separation > 0.01) {
          subjectRef.current = {
            separation,
            mid: new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5),
          };
        }
      }
    }

    const subject = newsMode ? null : subjectRef.current;
    const target = targetRef.current;
    let frameWidth;
    if (subject) {
      frameWidth = subject.separation * cfg.spread;
      target.copy(subject.mid);
      target.y -= subject.separation * cfg.dropBelowHeads;
    } else {
      frameWidth = newsMode ? 3.8 : cfg.fallbackWidth;
      target.set(...(newsMode ? [0, -0.65, 0] : cfg.fallbackTarget));
    }

    camera.position.set(...cfg.position);
    const distance = camera.position.distanceTo(target);
    // Locking the WIDTH rather than the fov is the point: rotating the phone
    // re-solves the vertical angle so the same shot fills the new frame,
    // instead of the frame cropping into a shot fitted for the old one.
    const aspect = state.size.width / Math.max(1, state.size.height);
    const hHalfTan = frameWidth / 2 / Math.max(0.001, distance);
    const vHalfTan = hHalfTan / Math.max(0.001, aspect);
    const fov = THREE.MathUtils.clamp(
      THREE.MathUtils.radToDeg(Math.atan(vHalfTan)) * 2,
      cfg.minFov,
      cfg.maxFov,
    );
    if (Math.abs(camera.fov - fov) > 0.01) {
      camera.fov = fov;
      camera.updateProjectionMatrix();
    }
    camera.lookAt(target);
  });

  return null;
}

export default function MobileTalkShow({ onExit }) {
  const [audioReady, setAudioReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  // 'loading' | 'ready' | 'failed' — a portal that never builds its SitePal
  // player retries itself, then reports 'failed' so this can offer a retry
  // instead of sitting on "TUNING IN" forever.
  const [voiceStatus, setVoiceStatus] = useState("loading");
  const dprRef = useRef(
    typeof window === "undefined"
      ? 1
      : Math.min(window.devicePixelRatio || 1, 1.5),
  );

  // Landscape is decided by THIS COMPONENT'S box, not `@media (orientation)`.
  // The media query reads the window, which is right in the real fullscreen
  // overlay but wrong in /trade/comms-preview — a 390×740 phone frame inside a
  // landscape desktop window would take the landscape layout, so the harness
  // would misreport the layout exactly when it's being reviewed.
  const rootRef = useRef(null);
  const [wide, setWide] = useState(false);
  useEffect(() => {
    const el = rootRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      // Hysteresis-free threshold above 1: a near-square box keeps the stacked
      // layout, which degrades more gracefully than the overlay one.
      setWide(height > 0 && width / height > 1.25);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Episode slate, shared with the desktop panel — the same records from
  // src/content/lt-tv. Selection is real on both platforms: the chosen record
  // carries the clip names the set loads, so picking an episode plays that
  // episode (or says it isn't recorded yet).
  const [episodeIndex, setEpisodeIndex] = useState(0);
  const [showId, setShowId] = useState(SHOWS[0].id);
  const { isNew, showHasNew } = useNewEpisodes();
  const show = SHOWS.find((item) => item.id === showId) || SHOWS[0];
  const newsMode = show.id === "news";
  const hasEpisode = show.episodes.length > 0;
  const selectedEpisode = show.episodes[episodeIndex] || show.episodes[0] || null;
  const canPlay = Boolean(selectedEpisode?.playable);
  const episode = selectedEpisode || {
    title: "News studio preview", summary: "Take a look around the news set. Episodes are coming soon.",
  };
  const channelCards = useMemo(() => newsMode ? [{
    title: show.title, format: show.format, latest: null, episodeTitle: null,
  }] : null, [newsMode, show.title, show.format]);

  // ?perf=1 only. Worth having on this screen too: the SitePal face crop is a
  // per-frame texture upload, which shows up as drift rather than as a hitch.
  const { probe, readout } = usePerfHud();

  const handleReady = useCallback((ready, status) => {
    setAudioReady(ready);
    setVoiceStatus(status || (ready ? "ready" : "loading"));
    if (!ready) setPlaying(false);
  }, []);

  const handlePlayState = useCallback((isPlaying) => {
    setPlaying(isPlaying);
  }, []);

  // Leaving with a track in flight would keep SitePal talking under the hub
  // menu — the portals outlive this component's paint by a frame or two.
  useEffect(() => () => {
    try { window.__talkShowStop?.(); } catch (e) {}
  }, []);

  // Pause, resume and part-skipping, on the same window handles the desktop
  // console uses. What SitePal allows and why the bar is drawn in parts is
  // explained where the calls are made, in TalkShowScene.
  const { status, toggle, step, seek } = useTalkShowTransport(playing);
  const starts = status.sectionStarts?.length ? status.sectionStarts : [0];
  const parts = starts.map((startsAt, index) => {
    const endsAt = starts[index + 1] ?? Math.max(startsAt, status.duration);
    return { index, startsAt, endsAt, seconds: Math.max(1, endsAt - startsAt) };
  });
  const partFill = (part) => {
    if (status.elapsed >= part.endsAt) return 100;
    if (status.elapsed <= part.startsAt) return 0;
    return ((status.elapsed - part.startsAt) / (part.endsAt - part.startsAt)) * 100;
  };

  const play = () => {
    if (!canPlay) return;
    try {
      const started = window.__talkShowPlay?.();
      if (!started) setPlaying(false);
    } catch (e) {
      setPlaying(false);
    }
  };

  const stop = () => {
    try { window.__talkShowStop?.(); } catch (e) {}
  };

  const retry = () => {
    setVoiceStatus("loading");
    try { window.__talkShowRetryPortals?.(); } catch (e) {}
  };

  const exit = () => {
    stop();
    onExit?.();
  };

  return (
    <div className={`mts-root ${wide ? "mts-wide" : ""} ${hasEpisode ? "" : "mts-preview"}`} ref={rootRef}>
      <header className="mts-header">
        <button type="button" onClick={exit} aria-label="Return to terminal">‹ <span>LT TV</span></button>
        <select className="mts-program-select" aria-label="Browse programs" value={showId}
          onChange={(event) => { stop(); setPlaying(false); setShowId(event.target.value); setEpisodeIndex(0); }}>
          {/* A native <select> is the right control on a phone and cannot
              carry a drawn badge, so here the badge is words. It still reads
              at a glance, which is all the dot on desktop does. */}
          {SHOWS.map((program) => <option key={program.id} value={program.id}
            disabled={!program.episodes.length && program.id !== "news"}>
            {program.title}{program.id === "news" ? " — Studio preview"
              : !program.episodes.length ? " — Coming soon"
              : showHasNew(program) ? " — New episode" : ""}
          </option>)}
        </select>
      </header>

      <div className="mts-stage-shell">
        <div className="mts-stage">
        <Canvas
          dpr={dprRef.current}
          camera={{ position: MOBILE_TALK_SHOW_CAM.position, near: 0.1, far: 100 }}
          gl={{
            // Same posture as the page's temple canvas on touch devices: no
            // MSAA backbuffer, mediump, no stencil. This canvas shares a GPU
            // with two SitePal avatar renderers.
            antialias: false,
            alpha: false,
            powerPreference: "default",
            precision: "mediump",
            stencil: false,
            depth: true,
            preserveDrawingBuffer: false,
          }}
          style={{ width: "100%", height: "100%", background: "#000" }}
        >
          <StageCamera newsMode={newsMode} />
          {/* Same house-lights cue as the desktop set: the room goes down
              between episodes and comes up when one starts. */}
          <HouseAmbient dimmed={!playing} />
          <TalkShowScene
            episode={selectedEpisode}
            newsMode={newsMode}
            onAir={playing}
            channelCards={channelCards}
            soloProjection
            enableMonitorFeed={false}
            compactPortalHost
            hideCameraRig
            onPlaybackReady={handleReady}
            onPlaybackStateChange={handlePlayState}
          />
          {probe}
        </Canvas>

        {readout}
          {hasEpisode && !audioReady && (
            <div className="mts-overlay">
              {voiceStatus === "failed" ? (
                <>
                  <span className="mts-overlay-tag">Audio unavailable</span>
                  <button className="mts-retry" onClick={retry}>Retry audio</button>
                </>
              ) : (
                <span className="mts-overlay-tag mts-blink">Preparing studio…</span>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="mts-below">
        <div className="mts-now">
          <h2 className="mts-show-title">{show.title}</h2>
          <div className="mts-metadata"><span>{show.format}</span>{hasEpisode && <><span>{show.episodes.length} episodes</span><span className="mts-replay">Replay</span></>}</div>
          <div className="mts-episode-meta">{!hasEpisode ? "Studio preview"
            : `Episode ${episode.number} · ${episode.runtime || "Not recorded yet"}`}</div>
          <h3 className="mts-ep-title">{episode.title}</h3>
          <p className="mts-ep-sum">{episode.summary}</p>
        </div>
        <div className="mts-controls">
          {/* Pause holds the line where it is; a skip lands on the start of a
              part, because a SitePal clip can only be started at its
              beginning and a long episode is already several clips. */}
          {playing && (
            <div className="mts-scrub" role="group" aria-label="Episode parts">
              {parts.map((part) => (
                <button key={part.index} type="button"
                  className={`mts-part${part.index === status.section ? " is-on" : ""}`}
                  style={{ flexGrow: part.seconds }}
                  aria-label={`Play part ${part.index + 1} of ${parts.length}, from ${clockTime(part.startsAt)}`}
                  onClick={() => seek(part.startsAt)}>
                  <i style={{ width: `${partFill(part)}%` }} aria-hidden="true" />
                </button>
              ))}
            </div>
          )}
          <button type="button" className="mts-play" onClick={voiceStatus === "failed" ? retry : playing ? toggle : play}
            disabled={!canPlay || (!audioReady && voiceStatus !== "failed")}>
            <span aria-hidden="true">{playing ? (status.paused ? "▶" : "❚❚") : voiceStatus === "failed" ? "↻" : "▶"}</span>
            {!hasEpisode ? "Episodes coming soon" : !canPlay ? "Not recorded yet" : voiceStatus === "failed" ? "Retry audio" : !audioReady ? "Preparing studio…"
              : playing ? (status.paused ? "Resume episode" : "Pause episode") : "Play episode"}
          </button>
          {playing && (
            <div className="mts-keys" role="group" aria-label="Playback">
              <button type="button" onClick={() => step(-1)} aria-label="Back to the start of this part">⏮</button>
              <button type="button" onClick={() => step(1)} aria-label="Skip to the next part">⏭</button>
              <span className="mts-clock">{clockTime(status.elapsed)} / {clockTime(status.duration)}</span>
              <button type="button" onClick={stop} className="mts-stop">Stop</button>
            </div>
          )}
          <div className="mts-rotate-hint">Rotate your phone for full-screen viewing</div>
        </div>
        {hasEpisode && <h3 className="mts-episodes-heading">Episodes</h3>}
        <div className="mts-rack" role="group" aria-label="Episodes">
          {show.episodes.map((ep, i) => (
            <button
              key={ep.number}
              className={`mts-rack-item ${i === episodeIndex ? "is-on" : ""}`}
              aria-pressed={i === episodeIndex}
              aria-label={`Episode ${ep.number}: ${ep.title}, ${ep.runtime || "not recorded yet"}${isNew(ep) ? ", new" : ""}`}
              onClick={() => {
                if (playing) stop();
                setEpisodeIndex(i);
              }}
            >
              <span className="mts-rack-no">
                Episode {ep.number}
                {isNew(ep) && <em className="mts-new" aria-hidden="true">New</em>}
              </span>
              <span className="mts-rack-title">{ep.title}</span>
              <span className="mts-rack-run">{ep.runtime || "Not recorded yet"}</span>
            </button>
          ))}
        </div>

        {/* Ratings and comments sit UNDER the episode list, the way they sit
            under a video: the phone screen scrolls, so they need no sheet of
            their own the way the desktop console does. */}
        {selectedEpisode?.id && (
          <div className="mts-reactions">
            <LTTvReactions episodeId={selectedEpisode.id} episodeTitle={selectedEpisode.title} compact />
          </div>
        )}

      </div>

      <style>{`
        .mts-root { position: absolute; inset: 0; display: flex; flex-direction: column; background: #050408; color: #f7f4fa; font-family: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; overflow-y: auto; overscroll-behavior: contain; }
        .mts-root *, .mts-root *::before { box-sizing: border-box; }
        .mts-header { flex: 0 0 auto; display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: calc(env(safe-area-inset-top, 0px) + 8px) 20px 8px; min-height: 56px; }
        .mts-header button { display: flex; align-items: center; gap: 12px; min-height: 44px; border: 0; padding: 0; background: transparent; color: #b7b1c0; font-size: 26px; cursor: pointer; }
        .mts-header button span { color: #ffc096; font: 500 17px "Orbitron", sans-serif; letter-spacing: .19em; }
        .mts-program-select { min-height: 44px; width: min(58%, 260px); border: 1px solid #302a38; border-radius: 5px; padding: 8px; background: #15121b; color: #f7f4fa; font: 500 12px "Inter", sans-serif; }
        .mts-program-select:focus-visible { outline: 2px solid #8feeff; outline-offset: 2px; }
        .mts-header-status { color: #b4aaba; font-size: 12px; }
        .mts-stage-shell { position: relative; flex: 1 0 auto; aspect-ratio: 4 / 3; margin: 0; padding: 0; background: #000; }
        .mts-stage { position: absolute; inset: 0; width: 100%; height: 100%; background: #000; overflow: hidden; }
        .mts-stage::after { content: ""; position: absolute; inset: auto 0 0; height: 34px; background: linear-gradient(transparent, #050408); pointer-events: none; }
        .mts-overlay { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 14px; background: rgba(5,4,8,.8); }
        .mts-overlay-tag { color: #d1cad9; font-size: 14px; }
        .mts-retry { border: 1px solid #777080; border-radius: 5px; padding: 12px 18px; min-height: 44px; background: #232027; color: #fff; font: 600 14px "Inter", sans-serif; cursor: pointer; }
        .mts-below { flex: .6 0 auto; display: flex; flex-direction: column; padding: 14px 20px calc(env(safe-area-inset-bottom, 0px) + 24px); }
        .mts-show-title { margin: 0; color: #20d7f2; font: 700 25px/1.25 "Orbitron", sans-serif; letter-spacing: -.035em; text-align: left; text-wrap: balance; }
        .mts-metadata { display: flex; flex-wrap: wrap; gap: 8px; margin: 12px 0 22px; font-size: 12px; color: #b9b6c2; line-height: 1.5; }
        .mts-metadata span + span::before { content: "·"; margin-right: 8px; color: #6e687b; }
        .mts-metadata .mts-replay { color: #ef62dc; }
        .mts-episode-meta { color: #a9a5b2; font-size: 12px; margin-bottom: 6px; }
        .mts-ep-title { margin: 0 0 8px; font-size: 21px; line-height: 1.3; font-weight: 650; text-align: left; letter-spacing: -.02em; }
        .mts-ep-sum { margin: 0; color: #c9c6d0; font-size: 14px; line-height: 1.6; text-align: left; }
        .mts-preview:not(.mts-wide) .mts-controls { margin-top: auto; margin-bottom: 0; padding-top: 24px; }
        .mts-preview .mts-rack:empty { display: none; }
        .mts-controls { margin: 20px 0 26px; }
        .mts-play { width: 100%; min-height: 48px; border: 0; border-radius: 5px; padding: 12px 18px; display: flex; align-items: center; justify-content: center; gap: 10px; background: #f7f4fa; color: #131019; font: 650 15px/1.3 "Inter", sans-serif; cursor: pointer; }
        .mts-play span { font-size: 12px; }
        .mts-scrub { display: flex; align-items: stretch; gap: 3px; margin-bottom: 12px; }
        .mts-part { flex: 1 1 0; min-width: 12px; height: 26px; position: relative; border: 0; padding: 0; background: transparent; cursor: pointer; }
        .mts-part::before { content: ""; position: absolute; inset: 10px 0; border-radius: 2px; background: rgba(255,255,255,.17); }
        .mts-part.is-on::before { background: rgba(32,215,242,.26); }
        .mts-part > i { position: absolute; left: 0; top: 10px; bottom: 10px; border-radius: 2px; background: #ef62dc; }
        .mts-keys { display: flex; align-items: center; gap: 10px; margin-top: 12px; }
        .mts-keys button { min-width: 44px; min-height: 44px; border: 1px solid #302a38; border-radius: 5px; background: #15121b; color: #f7f4fa; font-size: 13px; cursor: pointer; }
        .mts-keys .mts-stop { margin-left: auto; padding: 0 14px; color: #d8b2c4; }
        .mts-clock { color: #b9b6c2; font: 500 12px/1 "IBM Plex Mono", monospace; }
        .mts-play:hover:not(:disabled) { background: #dfdce5; }
        .mts-play:disabled { opacity: .5; cursor: default; }
        .mts-rotate-hint { text-align: center; color: #96919f; font-size: 11px; line-height: 1.5; margin-top: 10px; }
        .mts-episodes-heading { text-align: left; font-size: 17px; font-weight: 650; margin: 0 0 12px; }
        .mts-rack { display: flex; gap: 10px; overflow-x: auto; overscroll-behavior-x: contain; scroll-snap-type: x proximity; padding: 3px 3px 12px; margin: 0 -3px; scrollbar-width: thin; scrollbar-color: #554659 transparent; }
        .mts-rack-item { flex: 0 0 156px; min-height: 108px; display: flex; flex-direction: column; align-items: flex-start; gap: 8px; padding: 14px; border: 1px solid rgba(255,255,255,.12); border-radius: 7px; background: #15121b; color: #f7f4fa; font: inherit; text-align: left; cursor: pointer; scroll-snap-align: start; }
        .mts-rack-item.is-on { border-color: #ef62dc; background: #28172c; }
        .mts-rack-no { display: flex; align-items: center; gap: 7px; color: #a9a5b2; font-size: 11px; }
        .mts-new { padding: 2px 6px; border-radius: 3px; background: #ef62dc; color: #1b0716; font: 700 9px/1.4 "Inter", sans-serif; font-style: normal; letter-spacing: .09em; text-transform: uppercase; }
        .mts-rack-item.is-on .mts-rack-no { color: #ef62dc; }
        .mts-rack-title { font-size: 13px; font-weight: 600; line-height: 1.35; }
        .mts-rack-run { margin-top: auto; font-size: 11px; color: #a9a5b2; }
        .mts-root button:focus-visible { outline: 2px solid #8feeff; outline-offset: 3px; }
        .mts-wide { overflow: hidden; }
        .mts-wide .mts-header { position: absolute; inset: 0 0 auto; z-index: 3; padding-left: max(20px, env(safe-area-inset-left)); padding-right: max(20px, env(safe-area-inset-right)); background: linear-gradient(#050408dd, transparent); }
        .mts-wide .mts-stage-shell { flex: 1 1 auto; min-height: 0; aspect-ratio: auto; }
        .mts-wide .mts-stage { height: 100%; aspect-ratio: auto; }
        .mts-wide .mts-below { display: contents; }
        .mts-reactions { padding: 4px 20px 32px; }
        .mts-wide .mts-now, .mts-wide .mts-rack, .mts-wide .mts-episodes-heading, .mts-wide .mts-rotate-hint, .mts-wide .mts-reactions { display: none; }
        .mts-wide .mts-controls { position: absolute; inset: auto 0 0; z-index: 3; margin: 0; padding: 12px 20px calc(env(safe-area-inset-bottom, 0px) + 12px); display: flex; justify-content: center; background: linear-gradient(transparent, #050408dd); }
        .mts-wide .mts-play { width: auto; min-width: 160px; }
        @media (max-width: 360px) { .mts-below { padding-left: 16px; padding-right: 16px; } .mts-show-title { font-size: 23px; } }
      `}</style>
    </div>
  );
}
