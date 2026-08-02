"use client";
// LT TV on mobile — the talk_show2.glb set running inside the Liminal Terminal.
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
import React, { useCallback, useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import TalkShowScene from "./TalkShowScene";
import { EPISODES } from "./LTTvBroadcastPanel";
import usePerfHud from "./PerfHud";
import TerminalModuleHeader from "./TerminalModuleHeader";

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
function StageCamera() {
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

    const subject = subjectRef.current;
    const target = targetRef.current;
    let frameWidth;
    if (subject) {
      frameWidth = subject.separation * cfg.spread;
      target.copy(subject.mid);
      target.y -= subject.separation * cfg.dropBelowHeads;
    } else {
      frameWidth = cfg.fallbackWidth;
      target.set(...cfg.fallbackTarget);
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

  // Episode slate, shared with the desktop panel. NOTE: selection is
  // PRESENTATIONAL on both platforms — TalkShowScene's TALK_SHOW_AUDIO is a
  // fixed pair of uploaded tracks, so every episode plays the same recording
  // today. Mirrored here rather than "fixed" on mobile only, so the two
  // surfaces don't disagree about what picking an episode means.
  const [episodeIndex, setEpisodeIndex] = useState(0);
  const episode = EPISODES[episodeIndex];

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

  const play = () => {
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
    <div className={`mts-root ${wide ? "mts-wide" : ""}`} ref={rootRef}>
      <TerminalModuleHeader
        channel="LT TV"
        mode="BROADCAST"
        code={playing ? "ON AIR" : `EP ${episode.number}`}
        accent="#ef62dc"
        active={audioReady}
        onBack={exit}
      />

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
          <StageCamera />
          <ambientLight intensity={1.5} />
          <TalkShowScene
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
        {/* Scanline/vignette dressing, matched to TerminalBoot's CRT. */}
        <div className="mts-crt" />

          <div className="mts-stage-readout">
            <span>CH 01 // LIVE FEED</span>
            <span>{playing ? "● TRANSMITTING" : "● SIGNAL LOCKED"}</span>
          </div>

          {!audioReady && (
            <div className="mts-overlay">
              {voiceStatus === "failed" ? (
                <>
                  <span className="mts-overlay-tag">SIGNAL LOST</span>
                  <button className="mts-retry" onClick={retry}>RETRY FEED</button>
                </>
              ) : (
                <span className="mts-overlay-tag mts-blink">TUNING IN…</span>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="mts-controls">
        <button
          className="mts-play"
          onClick={playing ? stop : play}
          disabled={!audioReady}
        >
          {playing ? "■ STOP" : "▶ PLAY EPISODE"}
        </button>
        <div className="mts-caption">
          {voiceStatus === "failed"
            ? "voice feed unavailable"
            : !audioReady
              ? "loading voices…"
              : playing
                ? "GR80 & John Barron · live"
                : "one episode. two guests. no edit."}
        </div>
        {/* Portrait only (hidden in the wide layout). Rotating is an upgrade,
            not a requirement — the panel above is already watchable. */}
        <div className="mts-rotate-hint">↻ ROTATE FOR FULL SCREEN</div>
      </div>

      {/* ── Bottom half ── Portrait left ~40% of the screen empty, so it takes
          the desktop panel's production block: what's on, the slate you can
          pick from, and the studio status strip. All hidden in the wide layout,
          where the broadcast owns the full screen. */}
      <div className="mts-below">
        <div className="mts-now">
          <div className="mts-eyebrow">
            Current production · weekly roundtable
          </div>
          <h3 className="mts-ep-title">
            <span className="mts-ep-no">EP {episode.number}</span>
            {episode.title}
          </h3>
          <p className="mts-ep-sum">{episode.summary}</p>
          <div className="mts-facts">
            <span>◷ {episode.runtime}</span>
            <span>▣ July 31, 2026</span>
            <span className="mts-rec">● RECORDED</span>
          </div>
        </div>

        <div className="mts-rack" role="group" aria-label="Episodes">
          {EPISODES.map((ep, i) => (
            <button
              key={ep.number}
              className={`mts-rack-item ${i === episodeIndex ? "is-on" : ""}`}
              aria-pressed={i === episodeIndex}
              aria-label={`Episode ${ep.number}: ${ep.title}, ${ep.runtime}`}
              onClick={() => {
                if (playing) stop();
                setEpisodeIndex(i);
              }}
            >
              <span className="mts-rack-no">{ep.number}</span>
              <span className="mts-rack-title">{ep.title}</span>
              <span className="mts-rack-run">{ep.runtime}</span>
            </button>
          ))}
        </div>

        <div className="mts-status">
          <span><i>STUDIO</i>LT TALK SET</span>
          <span><i>CAM</i>01</span>
          <span><i>AUDIO</i>LIVE MIX</span>
          <span className={playing ? "mts-rec" : ""}>
            <i>STATUS</i>{playing ? "ON AIR" : audioReady ? "READY" : "STANDBY"}
          </span>
        </div>
      </div>

      <style>{`
        .mts-root {
          position: absolute; inset: 0; display: flex; flex-direction: column;
          background:
            linear-gradient(90deg, rgba(41,58,65,0.32) 0 8px, transparent 8px calc(100% - 8px), rgba(41,58,65,0.32) calc(100% - 8px)),
            radial-gradient(100% 65% at 50% 25%, rgba(10,53,49,0.38), transparent 72%),
            #000706;
          color: #2fd6d6; font-family: 'IoskeleyMono', 'Courier New', monospace;
          overflow: hidden; user-select: none;
        }
        /* The broadcast panel. 4:3 rather than 16:9 — a third more height for
           the guests, while staying landscape enough to hold a two-shot (a
           portrait panel would force the camera so far back the set shrinks
           again). The modest pixel count is what pays for the live SitePal
           face, so this grows deliberately rather than filling the screen. */
        .mts-stage-shell {
          position: relative; flex: 0 0 auto; margin: 10px 11px 0;
          padding: 8px;
          background: linear-gradient(145deg, #172427, #071010 32%, #020504 78%);
          border: 1px solid rgba(75,219,210,0.32);
          box-shadow: 0 9px 22px rgba(0,0,0,0.7), inset 0 0 0 1px rgba(255,255,255,0.025);
          clip-path: polygon(0 0, calc(100% - 11px) 0, 100% 11px, 100% 100%, 11px 100%, 0 calc(100% - 11px));
        }
        .mts-stage-shell::before {
          content: ""; position: absolute; inset: 3px; pointer-events: none;
          border: 1px solid rgba(239,98,220,0.18);
        }
        .mts-stage {
          position: relative; width: 100%; aspect-ratio: 4 / 3; flex: 0 0 auto;
          border: 1px solid color-mix(in srgb, #ef62dc 62%, transparent);
          background: #000; overflow: hidden;
          box-shadow: inset 0 0 30px rgba(0,0,0,0.8), 0 0 16px rgba(239,98,220,0.08);
        }

        /* ROTATED (.mts-wide, set from the measured box — see the comment on
           the ResizeObserver): the broadcast takes the whole screen and the
           chrome floats over it. The width-locked camera re-solves its fov on
           the resize, so this is the same shot at full size, not a crop of it.
           Costs ~2.8× the portrait panel's pixels, which is why it's the
           rotate-to-opt-in state rather than the default. */
        .mts-wide .tmh-root {
          position: absolute; top: 0; left: 0; right: 0; z-index: 3;
          background: linear-gradient(180deg, rgba(0,10,9,0.94), rgba(0,10,9,0.25));
        }
        .mts-wide .mts-stage-shell { flex: 1 1 auto; min-height: 0; margin: 0; padding: 0; border: 0; }
        .mts-wide .mts-stage-shell::before { display: none; }
        .mts-wide .mts-stage { height: 100%; aspect-ratio: auto; min-height: 0; border: none; }
        .mts-wide .mts-controls {
          position: absolute; bottom: 0; left: 0; right: 0; z-index: 3;
          flex: 0 0 auto; flex-direction: row; align-items: center; justify-content: center; gap: 16px;
          padding: 10px 16px calc(env(safe-area-inset-bottom, 0px) + 10px);
          background: linear-gradient(0deg, rgba(2,16,14,0.85), transparent);
        }
        .mts-wide .mts-play { width: auto; padding: 11px 22px; font-size: 13px; }
        .mts-wide .mts-caption { max-width: 40%; }
        .mts-wide .mts-rotate-hint { display: none; }
        .mts-crt {
          position: absolute; inset: 0; pointer-events: none;
          background: repeating-linear-gradient(0deg, rgba(0,0,0,0.22) 0 1px, transparent 1px 3px),
                      radial-gradient(130% 100% at 50% 50%, transparent 58%, rgba(0,0,0,0.6));
        }
        .mts-stage-readout {
          position: absolute; z-index: 2; left: 9px; right: 9px; top: 8px;
          display: flex; justify-content: space-between; gap: 10px;
          color: #b9dcd6; font-size: 7px; letter-spacing: 0.14em;
          text-shadow: 0 1px 3px #000;
        }
        .mts-stage-readout span:first-child { color: #ef62dc; }
        .mts-overlay {
          position: absolute; inset: 0; display: flex; flex-direction: column;
          align-items: center; justify-content: center; gap: 12px;
          background: rgba(2,16,14,0.82);
        }
        .mts-overlay-tag { font-size: 12px; letter-spacing: 0.18em; color: #ffd23a; }
        .mts-blink { animation: mtsBlink 1.4s steps(2, start) infinite; }
        @keyframes mtsBlink { 0%, 60% { opacity: 1; } 61%, 100% { opacity: 0.35; } }
        .mts-retry {
          background: none; border: 1px solid color-mix(in srgb, #2fd6d6 55%, transparent);
          color: #2fd6d6; font: inherit; font-size: 12px; letter-spacing: 0.08em;
          padding: 9px 14px; cursor: pointer;
          clip-path: polygon(0 0, calc(100% - 9px) 0, 100% 9px, 100% 100%, 9px 100%, 0 calc(100% - 9px));
        }

        /* Sits directly under the panel rather than centring itself in the
           leftover height — floating it in the middle of the dead space read
           as a layout bug. */
        .mts-controls {
          flex: 0 0 auto; display: flex; flex-direction: column;
          align-items: center; justify-content: flex-start; gap: 7px; padding: 13px 16px 0;
        }
        .mts-play {
          width: 100%; max-width: none;
          background: linear-gradient(90deg, #061412, #071b18 50%, #061412);
          border: 1px solid color-mix(in srgb, #ef62dc 55%, transparent);
          color: #eafff9; font: inherit; font-size: 15px; font-weight: bold;
          letter-spacing: 0.08em; padding: 15px 13px; cursor: pointer;
          clip-path: polygon(0 0, calc(100% - 11px) 0, 100% 11px, 100% 100%, 11px 100%, 0 calc(100% - 11px));
          transition: box-shadow 0.15s ease, transform 0.1s ease;
        }
        .mts-play:not(:disabled):active { transform: scale(0.99); }
        .mts-play:not(:disabled):hover { box-shadow: inset 0 0 22px color-mix(in srgb, #2fd6d6 18%, transparent); }
        .mts-play:disabled { opacity: 0.45; cursor: default; }
        .mts-caption { font-size: 11px; color: #2fd6d6; opacity: 0.8; letter-spacing: 0.05em; text-align: center; }
        .mts-rotate-hint {
          font-size: 10px; letter-spacing: 0.14em; color: #ffd23a; opacity: 0.65;
          text-align: center; margin-top: 2px;
        }

        /* ---- BOTTOM HALF (portrait only) ---- */
        /* Scrolls rather than clips when squeezed. The body is scroll-locked
           behind this overlay, so anything that overflows is unreachable, not
           merely below the fold. */
        .mts-below {
          flex: 0 1 auto; min-height: 0; display: flex; flex-direction: column;
          gap: 10px; padding: 12px 16px calc(env(safe-area-inset-bottom, 0px) + 12px);
          overflow-y: auto; overscroll-behavior: contain;
          -webkit-overflow-scrolling: touch;
        }
        .mts-eyebrow {
          font-size: 9px; letter-spacing: 0.16em; text-transform: uppercase;
          color: #2fd6d6; opacity: 0.6;
        }
        .mts-ep-title {
          margin: 5px 0 0; font-size: 17px; font-weight: bold; color: #f4fffb;
          letter-spacing: 0.02em;
        }
        .mts-ep-no {
          color: #ffd23a; font-size: 10px; letter-spacing: 0.14em;
          margin-right: 8px; vertical-align: middle;
        }
        .mts-ep-sum {
          margin: 4px 0 0; font-size: 11.5px; line-height: 1.5; color: #9fd8d0;
        }
        .mts-facts {
          display: flex; flex-wrap: wrap; gap: 12px; margin-top: 7px;
          font-size: 10px; letter-spacing: 0.06em; color: #2fd6d6; opacity: 0.75;
        }
        .mts-rec { color: #4dffaa; opacity: 1; }

        /* The slate, as a horizontal filmstrip. A vertical list squeezed to one
           and a half visible rows once the now-playing block and status strip
           took their share — sideways, all six are reachable with a thumb and
           the strip costs one fixed row of height instead of competing for it.
           The selected episode's title is NOT repeated here; the block above
           already carries it. */
        .mts-rack {
          flex: 0 0 auto; display: flex; gap: 6px; overflow-x: auto;
          -webkit-overflow-scrolling: touch; scrollbar-width: none;
          border-top: 1px solid color-mix(in srgb, #2fd6d6 22%, transparent);
          padding-top: 9px;
        }
        .mts-rack::-webkit-scrollbar { display: none; }
        .mts-rack-item {
          flex: 0 0 auto; display: flex; flex-direction: column; align-items: flex-start; gap: 3px;
          min-width: 96px; max-width: 128px; text-align: left;
          background: #061a18; border: 1px solid color-mix(in srgb, #2fd6d6 22%, transparent);
          color: #cfeee8; font: inherit; padding: 8px 10px; cursor: pointer;
          clip-path: polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 8px 100%, 0 calc(100% - 8px));
        }
        .mts-rack-item.is-on {
          border-color: color-mix(in srgb, #ef62dc 70%, transparent);
          color: #eafff9;
          box-shadow: inset 0 0 18px color-mix(in srgb, #ef62dc 12%, transparent);
        }
        .mts-rack-no { color: #ffd23a; font-size: 10px; letter-spacing: 0.1em; }
        .mts-rack-item.is-on .mts-rack-no { color: #ef62dc; }
        .mts-rack-title {
          font-size: 11px; line-height: 1.25; width: 100%;
          overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        .mts-rack-run { font-size: 9.5px; opacity: 0.55; letter-spacing: 0.06em; }

        .mts-status {
          flex: 0 0 auto; display: flex; flex-wrap: wrap; gap: 4px 14px;
          padding: 8px 0 2px; font-size: 9px; letter-spacing: 0.08em; color: #cfeee8;
          border-top: 1px solid color-mix(in srgb, #2fd6d6 22%, transparent);
        }
        .mts-status i { font-style: normal; color: #2fd6d6; opacity: 0.55; margin-right: 5px; }

        /* The wide layout gives the whole screen to the broadcast. */
        .mts-wide .mts-below { display: none; }

        .mts-play:focus-visible, .mts-retry:focus-visible, .mts-rack-item:focus-visible {
          outline: 1px solid #effffc; outline-offset: 2px;
        }
        @media (prefers-reduced-motion: reduce) {
          .mts-blink { animation: none; }
        }
      `}</style>
    </div>
  );
}
