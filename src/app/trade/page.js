"use client";
import React, { Suspense, useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import * as THREE from 'three';
import CleanCanvas from '@/components/CleanCanvas';
import FullscreenCRTOverlay from '@/components/FullscreenCRTOverlay';
import FullscreenChatOverlay from '@/components/FullscreenChatOverlay';
import EvidenceScreens from '@/components/EvidenceScreens';
import EvidenceOverlay, { hasRichVisual } from '@/components/EvidenceOverlay';
import ProgressiveText from '@/components/ProgressiveText';
import { CameraControls, Stats, Cloud, Clouds } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import ConstellationModel from '@/components/ConstellationModel';
import Aurora from '@/components/Aurora';
import StarField from '@/components/StarField';
import Link from 'next/link';
import PostProcessingEffects from '@/components/PostProcessingEffects';
import CyborgTempleScene, {
  DEMON_SITEPAL_CONTAINER_ID,
  SITEPAL_PROJECTION_CONFIG,
} from '@/components/CyborgTempleScene';
import VideoScreens from "@/components/VideoScreens";
// import VideoScreensOptimized from "@/components/VideoScreensOptimized";
import CouncilChatScreens from "@/components/CouncilChatScreens";
import ScreenBSlotMachine from "@/components/ScreenBSlotMachine";
import TickerDisplay3 from "@/components/TickerDisplay3";
import { useMusic } from '@/components/MusicContext';
import { useUser, useClerk } from "@clerk/nextjs";
import CyberNav from '@/components/CyberNav';
import NavControls from '@/components/NavControls';
import NavControlsMobile from '@/components/NavControlsMobile';
import MobileBottomNav from '@/components/MobileBottomNav';
import CoinLoader from '@/components/CoinLoader';
import SynthSunset from '@/components/SynthSunset';
import BuyModal from '@/components/BuyModal';
import { useBuyModal } from '@/lib/useBuyModal';
import TradeServiceRail from '@/components/TradeServiceRail';
import { SAMPLE_CASE, computeBrier, STATION_ORDER, pickReturnLine, pickVindicationKey, resolveLine } from '@/components/GameOverlay';
import CameraTuningPanel from '@/components/CameraTuningPanel';
import SitePalCropPanel from '@/components/SitePalCropPanel';
import { useRouter } from 'next/navigation';

// Mounts the SitePal embed offscreen so CyborgTempleScene can crop it
// into a CanvasTexture and overlay it on the Demon's Face mesh. The
// embed is loaded only while the Demon is focused — proof of concept;
// once we want it persistent we can lift this into a parent always-on
// mount and switch the audio with setPlayerVolume(0/7) instead. See the
// equivalent in /main/page.js (SitePalEmbed) for the pattern.
// Single-portal SitePal architecture. One embed hosts the avatar for
// ALL characters; CyborgTempleScene calls window.loadSceneByID(...)
// on focus to swap which character's scene is loaded into the portal.
// This is SitePal's recommended pattern for multi-character apps and
// avoids the multi-portal fragility (vhsshtml5_* internal state
// arrays don't fully register when AC_VHost_Embed is called twice).
//
// context=1 (10th positional) is REQUIRED for Next.js per SitePal docs;
// it switches the embed into the JS-framework bootstrap path so
// setPlayerVolume / saySilent / replay behave correctly.
const HOST_SITEPAL_CONFIG = {
  containerId: DEMON_SITEPAL_CONTAINER_ID, // shared host container
  account: "9308752",
  // Initial scene is Demon (2774900). Other characters loaded via
  // loadSceneByID(SITEPAL_PROJECTION_CONFIG.Detective.sceneId), etc.
  embedParams: '9308752,600,800,"",1,1,2774900,0,1,1,"YnR4tCeRwrDH29TfMAxvtPb4anz6oa6n",0,1',
};

// Load the SitePal embed functions script ONCE per page (cached
// promise on window). Loading it twice for the same account
// re-initializes SitePal's global state (vhssHTML_scenes, etc.) and
// the second load was clobbering the first portal — making both
// characters share whichever portal/scene initialized last.
function loadSitePalScriptOnce(account) {
  if (typeof window === "undefined") return Promise.resolve();
  if (!window.__sitePalScriptPromise) {
    window.__sitePalScriptPromise = new Promise((resolve) => {
      // preserveDrawingBuffer patch needs to be in place before SitePal
      // creates its WebGL canvas; restore after bootstrap. Stored on
      // window so the second character's mount doesn't re-patch.
      if (!window.__sitePalGetContextPatched) {
        window.__sitePalGetContextPatched = true;
        const orig = HTMLCanvasElement.prototype.getContext;
        window.__sitePalOrigGetContext = orig;
        HTMLCanvasElement.prototype.getContext = function (type, attrs) {
          if (type === "webgl" || type === "webgl2" || type === "experimental-webgl") {
            attrs = { ...attrs, preserveDrawingBuffer: true };
          }
          return orig.call(this, type, attrs);
        };
        setTimeout(() => {
          if (window.__sitePalOrigGetContext) {
            HTMLCanvasElement.prototype.getContext = window.__sitePalOrigGetContext;
          }
        }, 8000);
      }
      const script = document.createElement("script");
      script.src = `//vhss-d.oddcast.com/vhost_embed_functions_v4.php?acc=${account}&js=0`;
      script.type = "text/javascript";
      script.onload = () => resolve();
      script.onerror = () => resolve();
      document.head.appendChild(script);
    });
  }
  return window.__sitePalScriptPromise;
}

function SitePalHostEmbed({ config }) {
  const containerRef = useRef(null);

  useEffect(() => {
    const { containerId, account, embedParams } = config;
    let cancelled = false;

    loadSitePalScriptOnce(account).then(() => {
      if (cancelled || !containerRef.current) return;
      const script2 = document.createElement("script");
      script2.type = "text/javascript";
      script2.textContent =
        `try { AC_VHost_Embed(${embedParams}); } ` +
        `catch (e) { AC_Vhost_Embed(${embedParams}); }`;
      containerRef.current.appendChild(script2);
    });

    // Reset the shared scene-ready flag so the per-frame compositor
    // in CyborgTempleScene won't paint stale content while the host
    // portal is still bootstrapping.
    window.__sitePalSceneLoaded = false;
    // The initial scene that boots in the embedParams (Demon, 2774900).
    // CyborgTempleScene updates this on loadSceneByID swaps.
    if (window.__sitePalCurrentSceneId === undefined) {
      window.__sitePalCurrentSceneId = 2774900;
    }
    // Desired volume after the next vh_sceneLoaded. The click handler
    // sets this BEFORE calling loadSceneByID so the new scene applies
    // it on load — calling setPlayerVolume directly across a scene
    // swap crashes SitePal with "setHostVolume on null" because the
    // old host is being torn down while the new one isn't ready yet.
    if (window.__sitePalDesiredVolume === undefined) {
      window.__sitePalDesiredVolume = 0;
    }

    // Shared SitePal lifecycle callbacks. vh_sceneLoaded fires both
    // on initial scene load and on every loadSceneByID() swap. Use
    // getSceneAttributes() to read the ACTUAL loaded scene ID rather
    // than trusting our own optimistic flag — loadSceneByID() can
    // fall back to the previously-loaded scene if the requested one
    // fails, in which case our preemptive flag would lie about which
    // character's avatar the source canvas is showing.
    // Pre-warm queue: list of scene IDs to load after the initial
    // scene boots. The SitePal server caches the scene assets after
    // first fetch, so a brief load → load-back cycle at startup
    // means the user's first click on a non-default character is
    // near-instant instead of taking ~3-5s. Last entry should be
    // the default character so we end up there for the actual UI.
    const PRELOAD_QUEUE = [
      ...Object.entries(SITEPAL_PROJECTION_CONFIG)
        .filter(([id, config]) => config.preload && id !== 'Demon')
        .map(([, config]) => config.sceneId),
      SITEPAL_PROJECTION_CONFIG.Demon.sceneId, // revert to default after preload
    ];

    const advancePreload = () => {
      if (!Array.isArray(window.__sitePalPreloadQueue) ||
          window.__sitePalPreloadQueue.length === 0) {
        window.__sitePalPreloading = false;
        window.__sitePalPreloadQueue = null;
        console.log('[SitePal] preload complete');
        return;
      }
      const next = window.__sitePalPreloadQueue.shift();
      window.__sitePalSceneLoaded = false;
      try {
        if (typeof window.loadSceneByID === "function") {
          console.log('[SitePal] preloading sceneID=', next);
          window.loadSceneByID(next);
        }
      } catch (e) {
        window.__sitePalPreloading = false;
      }
    };

    const clearSpeechRetryTimer = () => {
      if (window.__sitePalSpeechRetryTimer) {
        clearTimeout(window.__sitePalSpeechRetryTimer);
        window.__sitePalSpeechRetryTimer = null;
      }
    };

    const clearActiveSpeech = () => {
      clearSpeechRetryTimer();
      window.__sitePalPendingSpeech = null;
      window.__sitePalActiveSpeech = null;
    };

    const runSpeechRequest = (request, isRetry = false) => {
      const active = window.__sitePalActiveSpeech;
      if (!active || active.token !== request.token) return false;
      if (request.sceneId && request.sceneId !== window.__sitePalCurrentSceneId) return false;
      if ((window.__sitePalDesiredVolume || 0) <= 0) return false;

      try {
        request.attempts += 1;
        let result = null;
        if (typeof window.setPlayerVolume === "function") {
          try { window.setPlayerVolume(window.__sitePalDesiredVolume || 7); } catch (e) {}
        }
        if (isRetry || request.attempts === 1) {
          try { if (typeof window.stopSpeech === "function") window.stopSpeech(); } catch (e) {}
        }

        if (request.type === "audio" && request.audioName && typeof window.sayAudio === "function") {
          if (request.attempts === 1 && typeof window.loadAudio === "function") {
            try { window.loadAudio(request.audioName); } catch (e) {}
          }
          console.log('[SitePal] sayAudio(', request.audioName, ') attempt=', request.attempts);
          result = window.sayAudio(request.audioName);
        } else if (request.type === "text" && request.text && typeof window.sayText === "function") {
          const voice = request.voice || "3";
          const lang = request.lang || 1;
          const engine = request.engine || 3;
          console.log('[SitePal] sayText(', request.text, ') attempt=', request.attempts);
          if (request.effect !== undefined && request.effLevel !== undefined) {
            result = window.sayText(request.text, voice, lang, engine, request.effect, request.effLevel, request.xData1, request.xData2);
          } else {
            result = window.sayText(request.text, voice, lang, engine);
          }
        } else if (request.type === "scene" && typeof window.replay === "function") {
          console.log('[SitePal] replay scene audio attempt=', request.attempts);
          result = window.replay();
        }

        if (result && typeof result === "object") {
          request.requestId = result.id || request.requestId;
          if (result.status !== 0) {
            console.warn("[SitePal] speech returned", result);
          }
        }

        clearSpeechRetryTimer();
        window.__sitePalSpeechRetryTimer = setTimeout(() => {
          const latest = window.__sitePalActiveSpeech;
          if (!latest || latest.token !== request.token || latest.started) return;
          if (latest.attempts < 3 && latest.sceneId === window.__sitePalCurrentSceneId) {
            console.warn('[SitePal] speech did not start; retrying', {
              characterId: latest.characterId,
              sceneId: latest.sceneId,
              audioName: latest.audioName,
              attempts: latest.attempts,
            });
            runSpeechRequest(latest, true);
          } else {
            console.warn('[SitePal] speech did not start after retries', {
              characterId: latest.characterId,
              sceneId: latest.sceneId,
              audioName: latest.audioName,
            });
            clearActiveSpeech();
          }
        }, 1200);
        return true;
      } catch (e) {
        console.warn("[SitePal] speech error", e);
        if (request.attempts < 3) {
          clearSpeechRetryTimer();
          window.__sitePalSpeechRetryTimer = setTimeout(() => runSpeechRequest(request, true), 500);
        } else {
          clearActiveSpeech();
        }
        return false;
      }
    };

    const speakPending = (fallbackAudioName = null) => {
      const pending = window.__sitePalPendingSpeech;
      if (pending && pending.sceneId && pending.sceneId !== window.__sitePalCurrentSceneId) {
        return false;
      }
      const speech = pending?.speech || (
        fallbackAudioName
          ? { type: "audio", audioName: fallbackAudioName }
          : { type: "scene" }
      );

      const audioName = speech.type === "audio"
        ? (speech.preferSceneAudio
            ? (fallbackAudioName || speech.audioName)
            : (speech.audioName || fallbackAudioName))
        : null;
      const request = {
        ...speech,
        token: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        characterId: pending?.characterId || null,
        sceneId: pending?.sceneId || window.__sitePalCurrentSceneId,
        type: speech.type || (audioName ? "audio" : "scene"),
        audioName,
        attempts: 0,
        started: false,
        requestId: null,
      };
      if (request.type === "audio" && !request.audioName && fallbackAudioName) {
        request.audioName = fallbackAudioName;
      }
      if (request.type === "audio" && !request.audioName && typeof window.replay === "function") {
        request.type = "scene";
      }

      clearSpeechRetryTimer();
      window.__sitePalActiveSpeech = request;
      setTimeout(() => runSpeechRequest(request, false), 160);
      return true;
    };

    window.__sitePalSpeakPending = speakPending;

    window.vh_sceneLoaded = () => {
      let currentAudioName = null;
      try {
        if (typeof window.getSceneAttributes === "function") {
          const attrs = window.getSceneAttributes();
          if (attrs && attrs.sceneID) {
            window.__sitePalCurrentSceneId = Number(attrs.sceneID);
          }
          if (attrs && attrs.audioName) {
            currentAudioName = attrs.audioName;
            window.__sitePalCurrentAudioName = attrs.audioName;
          }
          console.log('[SitePal vh_sceneLoaded] sceneID=',
            attrs && attrs.sceneID, 'audio=', attrs && attrs.audioName);
        }
      } catch (e) {}
      window.__sitePalSceneLoaded = true;
      window.__sitePalSceneVersion = (window.__sitePalSceneVersion || 0) + 1;
      if (typeof window.setStatus === "function") {
        try { window.setStatus(1, 0, 0, 1, 0); } catch (e) {}
      }

      // Preload mode: don't trigger audio; advance to the next
      // scene in the queue. When the queue empties, drop into
      // normal user-driven mode for subsequent vh_sceneLoaded calls.
      if (window.__sitePalPreloading) {
        // Force-mute during preload so any audio that auto-starts
        // for the swapped scene doesn't leak through.
        if (typeof window.setPlayerVolume === "function") {
          try { window.setPlayerVolume(0); } catch (e) {}
        }
        if (typeof window.stopSpeech === "function") {
          try { window.stopSpeech(); } catch (e) {}
        }
        // Brief delay before advancing so SitePal can settle.
        setTimeout(advancePreload, 150);
        return;
      }

      // First scene load → kick off preload of remaining characters,
      // then revert to the default. Skips on subsequent loads (the
      // __sitePalInitialLoaded sentinel ensures preload runs once).
      if (!window.__sitePalInitialLoaded && PRELOAD_QUEUE.length > 0) {
        window.__sitePalInitialLoaded = true;
        window.__sitePalPreloading = true;
        window.__sitePalPreloadQueue = PRELOAD_QUEUE.slice();
        console.log('[SitePal] starting preload', window.__sitePalPreloadQueue);
        // Mute, then kick off after a beat so the initial paint can
        // happen first.
        if (typeof window.setPlayerVolume === "function") {
          try { window.setPlayerVolume(0); } catch (e) {}
        }
        setTimeout(advancePreload, 250);
        return;
      }

      // Normal mode: apply desired volume and play the scene's audio
      // if a character is currently focused.
      if (typeof window.setPlayerVolume === "function") {
        try { window.setPlayerVolume(window.__sitePalDesiredVolume || 0); } catch (e) {}
      }
      if ((window.__sitePalDesiredVolume || 0) > 0) {
        speakPending(currentAudioName);
      }
    };
    window.vh_audioError = (audID, portal, errCode, errMsg) => {
      console.warn("[SitePal] vh_audioError", { audID, errCode, errMsg });
      const active = window.__sitePalActiveSpeech;
      if (!active || active.started) return;
      if (active.requestId && audID && active.requestId !== audID) return;
      if (active.attempts < 3) {
        clearSpeechRetryTimer();
        window.__sitePalSpeechRetryTimer = setTimeout(() => runSpeechRequest(active, true), 500);
      } else {
        clearActiveSpeech();
      }
    };
    window.vh_audioStarted = (audID, portal) => {
      const active = window.__sitePalActiveSpeech;
      if (!active) return;
      if (active.requestId && audID && active.requestId !== audID) {
        console.warn("[SitePal] stale audio started", { audID, expected: active.requestId });
        return;
      }
      active.started = true;
      console.log("[SitePal] vh_audioStarted", {
        audID,
        characterId: active.characterId,
        audioName: active.audioName,
      });
      clearActiveSpeech();
    };

    // Patch AudioContext + install resume listener (idempotent — only
    // patches the first time, and the listener guards against
    // double-priming via its `primed` closure).
    const OrigCtx = window.AudioContext || window.webkitAudioContext;
    if (OrigCtx && !OrigCtx._patched) {
      OrigCtx._instances = [];
      const OrigConstructor = OrigCtx;
      const PatchedCtx = function (...args) {
        const instance = new OrigConstructor(...args);
        OrigCtx._instances.push(instance);
        return instance;
      };
      PatchedCtx.prototype = OrigConstructor.prototype;
      PatchedCtx._patched = true;
      PatchedCtx._instances = OrigCtx._instances;
      window.AudioContext = PatchedCtx;
    }

    let primed = false;
    const resumeAudio = () => {
      if (primed) return;
      primed = true;
      try {
        if (typeof window.saySilent === "function") window.saySilent(0);
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (Ctx && Ctx._instances) {
          Ctx._instances.forEach((c) => { try { c.resume(); } catch (e) {} });
        }
        if (window._vhssAudioCtx) {
          try { window._vhssAudioCtx.resume(); } catch (e) {}
        }
      } catch (e) {}
    };
    document.addEventListener("pointerdown", resumeAudio, true);
    document.addEventListener("touchstart", resumeAudio, true);
    document.addEventListener("keydown", resumeAudio, true);

    return () => {
      cancelled = true;
      document.removeEventListener("pointerdown", resumeAudio, true);
      document.removeEventListener("touchstart", resumeAudio, true);
      document.removeEventListener("keydown", resumeAudio, true);
      // Don't delete vh_sceneLoaded / vh_audioError or the SitePal
      // state globals on cleanup — Strict Mode in dev runs effects
      // mount→cleanup→mount, and if SitePal fires vh_sceneLoaded
      // during the brief unmounted window the flag never flips and
      // audio is silently broken. Globals stay for page lifetime.
      if (containerRef.current) containerRef.current.innerHTML = "";
    };
  }, [config]);

  return (
    <div
      id={config.containerId}
      ref={containerRef}
      style={{
        // Keep the container ONSCREEN (left:0 not -9999) — browsers
        // throttle WebGL render rate to ~1fps for offscreen canvases,
        // which makes SitePal video lag behind its audio. opacity 0.01
        // + pointerEvents:none keeps it invisible and non-interactive
        // while still receiving full GPU time.
        position: "fixed",
        left: 0,
        top: 0,
        width: 600,
        height: 800,
        opacity: 0.01,
        pointerEvents: "none",
        zIndex: -1,
      }}
    />
  );
}

// Drop-in replacement for the previous <OrbitControls> rig. Uses
// camera-controls under the hood so fly-to transitions (setLookAt with
// transition=true in CyborgTempleScene) animate position + target as a
// single critically-damped motion instead of two competing systems.
function CameraControlsRig({
  autoRotate = false,
  autoRotateSpeed = 1.2,
  initialPosition,
  initialTarget,
  zoomEndDistance = null,
  zoomDuration = 25,
  introStartDistance = null,
  introDuration = 12,
}) {
  const ref = useRef(null);
  const startDistanceRef = useRef(null);
  const zoomElapsedRef = useRef(0);
  const userInteractedRef = useRef(false);
  const initedRef = useRef(false);
  // Intro state — scripted 360° fly-around + zoom-in on first load. When
  // active it overrides the auto-rotate / slow-dolly logic below.
  const introElapsedRef = useRef(0);
  const introCompleteRef = useRef(introStartDistance == null);
  const initialPolarRef = useRef(null);
  // Capture initial pose in refs so re-renders that pass new array
  // identities for `initialPosition` / `initialTarget` don't re-trigger
  // the setup effect (which would yank the camera back to the seed pose
  // and reset the zoom each time).
  const initialPositionRef = useRef(initialPosition);
  const initialTargetRef = useRef(initialTarget);

  useEffect(() => {
    if (initedRef.current) return;
    const c = ref.current;
    if (!c) return;
    initedRef.current = true;
    c.minDistance = 0.1;
    // Bumped so the intro can start beyond the normal orbit envelope
    // without setLookAt clamping the radius.
    c.maxDistance = 20;
    c.minPolarAngle = Math.PI * 0.18;
    c.maxPolarAngle = Math.PI * 0.52;
    // Roughly matches the previous dampingFactor=0.1 feel.
    c.smoothTime = 0.25;
    c.draggingSmoothTime = 0.125;
    c.dollyToCursor = true;
    const ip = initialPositionRef.current;
    const it = initialTargetRef.current;
    if (ip && it) {
      const dx = ip[0] - it[0];
      const dy = ip[1] - it[1];
      const dz = ip[2] - it[2];
      const r = Math.sqrt(dx * dx + dy * dy + dz * dz);
      startDistanceRef.current = r;
      // Polar at the seed direction — held constant through the intro
      // so the fly-around stays at the same elevation.
      initialPolarRef.current = Math.acos(
        Math.max(-1, Math.min(1, dy / r)),
      );
      let startX = ip[0], startY = ip[1], startZ = ip[2];
      if (introStartDistance != null && r > 0) {
        const k = introStartDistance / r;
        startX = it[0] + dx * k;
        startY = it[1] + dy * k;
        startZ = it[2] + dz * k;
      }
      c.setLookAt(startX, startY, startZ, it[0], it[1], it[2], false);
      zoomElapsedRef.current = 0;
      introElapsedRef.current = 0;
    }
    // Stop the slow zoom as soon as the user takes the wheel — otherwise
    // dollyTo would yank them back every frame.
    const onControlStart = () => {
      userInteractedRef.current = true;
      // Bail out of the intro so the user's input isn't fought.
      introCompleteRef.current = true;
    };
    c.addEventListener('controlstart', onControlStart);
    return () => c.removeEventListener('controlstart', onControlStart);
  }, []);

  // Manual auto-orbit when no character is focused. The `autoRotate`
  // prop is already gated on focusedAgent, so we don't need an extra
  // c.active check (which appeared to swallow the rotation on initial
  // mount). We use rotate() with enableTransition=false rather than
  // mutating azimuthAngle — direct property writes get damped by
  // smoothTime and tiny per-frame increments smear out before they're
  // visible.
  useFrame((_, delta) => {
    const c = ref.current;
    if (!c) return;

    // Cancel the intro if the user focuses a character — the focus
    // fly-to drives the camera and our scripted setLookAt would fight it.
    if (!autoRotate && !introCompleteRef.current) {
      introCompleteRef.current = true;
    }

    // Scripted intro fly-around: 540° orbit (one full turn + an extra
    // half-spin so the model lands with a different face forward) + dolly-in
    // over `introDuration` seconds. Smoothstep easing so it eases in and out.
    if (
      !introCompleteRef.current &&
      autoRotate &&
      !userInteractedRef.current &&
      introStartDistance != null &&
      zoomEndDistance != null &&
      initialPolarRef.current != null &&
      initialTargetRef.current
    ) {
      introElapsedRef.current += delta;
      const t = Math.min(introElapsedRef.current / introDuration, 1);
      const eased = t * t * (3 - 2 * t); // smoothstep
      const dir = autoRotateSpeed >= 0 ? 1 : -1;
      const azimuth = dir * eased * Math.PI * 3;
      const polar = initialPolarRef.current;
      const distance = introStartDistance + (zoomEndDistance - introStartDistance) * eased;
      const it = initialTargetRef.current;
      const x = it[0] + distance * Math.sin(polar) * Math.sin(azimuth);
      const y = it[1] + distance * Math.cos(polar);
      const z = it[2] + distance * Math.sin(polar) * Math.cos(azimuth);
      c.setLookAt(x, y, z, it[0], it[1], it[2], false);
      if (t >= 1) {
        introCompleteRef.current = true;
        // Mark the slow zoom as already done — intro brought us to
        // zoomEndDistance, no need to dolly any further.
        zoomElapsedRef.current = zoomDuration;
      }
      return;
    }

    if (autoRotate) {
      c.rotate(delta * autoRotateSpeed * 0.1, 0, false);
    }

    // Slow idle zoom-in. Pauses when a character is focused (autoRotate
    // goes false) so the focus fly-to isn't fought, and aborts entirely
    // once the user grabs the camera themselves. Skipped when an intro
    // is in use (intro handles the zoom). We pass enableTransition=true
    // so camera-controls' own damping smooths the radius approach —
    // calling dollyTo(..., false) every frame hard-snaps `_spherical.radius`
    // and visibly stutters against the per-frame `rotate()` updates.
    if (
      introStartDistance == null &&
      autoRotate &&
      !userInteractedRef.current &&
      zoomEndDistance != null &&
      startDistanceRef.current != null &&
      zoomElapsedRef.current < zoomDuration
    ) {
      zoomElapsedRef.current += delta;
      const t = Math.min(zoomElapsedRef.current / zoomDuration, 1);
      const eased = 1 - Math.pow(1 - t, 3); // ease-out cubic
      const distance = startDistanceRef.current + (zoomEndDistance - startDistanceRef.current) * eased;
      c.dollyTo(distance, true);
    }
  });

  return <CameraControls ref={ref} makeDefault />;
}

// Mobile CRT overlay stubs — placeholder copy per Screen1-4. Replace later
// with real content once the per-screen mobile views are designed.
// Maps station keys to the primary screen mesh each consultant owns.
// Used by both EvidenceScreens (canvas painter) and the mobile fullscreen
// overlay (FullscreenCRTOverlay) to route evidence to the right surface.
const STATION_TO_SCREEN = {
  monk:    'Screen1',
  demon:   'Screen2',
  marisol: 'Screen3',
  eugene:  'Screen4',
};
const SCREEN_TO_STATION = Object.fromEntries(
  Object.entries(STATION_TO_SCREEN).map(([k, v]) => [v, k]),
);

// Convert an evidence entry into a typewriter sequence for FullscreenCRTOverlay.
// Mirrors the canvas-painted card on the in-scene screen so a mobile tap
// expands the same evidence into the viewport.
function buildEvidenceTextSequence(station, entry) {
  const role = (station?.role || '// EVIDENCE').toUpperCase();
  const threat = entry.threat;
  const verdict = threat === 'red'
    ? '⚠ CONFIRMED SIGNAL'
    : threat === 'amber'
      ? '⚠ ELEVATED RISK'
      : '✓ NORMAL';
  return [
    { text: '> CHANNEL ACQUIRED', type: 'command', delay: 400 },
    { text: `> ${role}`,         type: 'command', delay: 600 },
    { text: '',                  type: 'pause',   delay: 300 },
    { text: `// ${entry.label}`, type: 'header',  delay: 500 },
    { text: '',                  type: 'pause',   delay: 200 },
    { text: entry.value,         type: 'body',    delay: 700 },
    { text: '',                  type: 'pause',   delay: 400 },
    { text: `> ${verdict}`,      type: 'command', delay: 0 },
  ];
}

const SCREEN_OVERLAY_STUBS = {
  Screen1: {
    title: 'RL80 // CHART',
    sequence: [
      { text: '> LOADING CHART FEED...', type: 'command', delay: 600 },
      { text: '> LINK ESTABLISHED', type: 'command', delay: 800 },
      { text: '', type: 'pause', delay: 400 },
      { text: 'RL80 / USD', type: 'header', delay: 600 },
      { text: '', type: 'pause', delay: 300 },
      { text: 'Live price + chart', type: 'body', delay: 600 },
      { text: 'available on desktop.', type: 'body', delay: 800 },
      { text: '', type: 'pause', delay: 400 },
      { text: '> MOBILE VIEW: COMING SOON', type: 'command', delay: 0 },
    ],
  },
  Screen2: {
    title: 'MACRO // AGENT',
    sequence: [
      { text: '> CONNECTING TO AGENT...', type: 'command', delay: 600 },
      { text: '> SIGNAL ACQUIRED', type: 'command', delay: 800 },
      { text: '', type: 'pause', delay: 400 },
      { text: 'MACRO FEED', type: 'header', delay: 600 },
      { text: '', type: 'pause', delay: 300 },
      { text: 'AI commentary on', type: 'body', delay: 500 },
      { text: 'global markets.', type: 'body', delay: 800 },
      { text: '', type: 'pause', delay: 400 },
      { text: '> MOBILE VIEW: COMING SOON', type: 'command', delay: 0 },
    ],
  },
  Screen3: {
    title: 'TEKNO // TERMINAL',
    sequence: [
      { text: '> BOOTING TEKNO...', type: 'command', delay: 600 },
      { text: '> TERMINAL ONLINE', type: 'command', delay: 800 },
      { text: '', type: 'pause', delay: 400 },
      { text: 'TEKNO INTERFACE', type: 'header', delay: 600 },
      { text: '', type: 'pause', delay: 300 },
      { text: 'Interactive console', type: 'body', delay: 500 },
      { text: 'available on desktop.', type: 'body', delay: 800 },
      { text: '', type: 'pause', delay: 400 },
      { text: '> MOBILE VIEW: COMING SOON', type: 'command', delay: 0 },
    ],
  },
  Screen4: {
    title: 'RESERVED // SLOT',
    sequence: [
      { text: '> SCANNING CHANNEL 4...', type: 'command', delay: 600 },
      { text: '> NO TRANSMISSION', type: 'command', delay: 800 },
      { text: '', type: 'pause', delay: 400 },
      { text: 'RESERVED', type: 'header', delay: 600 },
      { text: '', type: 'pause', delay: 300 },
      { text: 'This slot is held', type: 'body', delay: 500 },
      { text: 'for future content.', type: 'body', delay: 800 },
      { text: '', type: 'pause', delay: 400 },
      { text: '> STAY TUNED', type: 'command', delay: 0 },
    ],
  },
};

// Pairs each 3D-scene character with its Liminal Terminal station.
// agentId on the left is what CyborgTempleScene fires through onAgentClick;
// station key on the right matches GameOverlay's SAMPLE_CASE.stations.
//   Monk      → Saint GR80        (Ethos · credibility)
//   Demon     → John Barron       (Pathos · sentiment)
//   Detective → Detective Marisol (Logos · onchain)
//   RL80      → Eugene            (Mythos · narrative — the unicorn)
const CHARACTER_TO_STATION = {
  Monk: 'monk',
  Demon: 'demon',
  Detective: 'marisol',
  RL80: 'eugene',
};
const STATION_TO_CHARACTER = Object.fromEntries(
  Object.entries(CHARACTER_TO_STATION).map(([agent, station]) => [station, agent])
);



export default function CyborgTemple() {
  const [isMobileView, setIsMobileView] = useState(false);
  const [fontLoaded, setFontLoaded] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [isSceneLoading, setIsSceneLoading] = useState(true);
  const [sceneReady, setSceneReady] = useState(false);
  const [modelLoaded, setModelLoaded] = useState(false);
  const [tickerLoaded, setTickerLoaded] = useState(false);
  const [canvasReady, setCanvasReady] = useState(false);
  const [tickerReady, setTickerReady] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [loadingMessage, setLoadingMessage] = useState("Initializing");
  const [modelLoadStartTime] = useState(Date.now());
  const [focusedAgent, setFocusedAgent] = useState(null);
  const [useAurora, setUseAurora] = useState(false);
  const [userHasInteracted, setUserHasInteracted] = useState(false);
  const [isMobileDevice, setIsMobileDevice] = useState(false);
  const [showCyberNav, setShowCyberNav] = useState(false);
  const [showBuyModal, setShowBuyModal] = useBuyModal();
  // Which modality the user has entered. null = lobby (no mode chosen).
  // 'game' = Liminal Terminal active → verdict buttons replace MENU in center.
  const [tradeMode, setTradeMode] = useState(null);
  // Tracks whether game mode is actively running.
  const [gameStarted, setGameStarted] = useState(false);
  // Liminal Terminal game state — lifted out of the old modal so the in-scene
  // UI can read/write it directly. SAMPLE_CASE is the only case for now; once
  // a case loader exists, this becomes a useState pulled from the loader.
  const caseData = SAMPLE_CASE;
  // Question-level tracking (model B): a scan = one question, 3 questions total
  // across all 4 characters. `asked` maps station key → Set of question indices.
  const [asked, setAsked] = useState(() => ({
    monk: new Set(), demon: new Set(), marisol: new Set(), eugene: new Set(),
  }));
  // Stations the player has rotated to at least once — drives intro vs return
  // micro-line selection. Reset on enterGameMode.
  const [visitedStations, setVisitedStations] = useState(() => new Set());
  // The currently-displayed Q&A in the side panel. Cleared on character switch
  // or when the player taps a new question. `null` = show the question list.
  const [activeAnswer, setActiveAnswer] = useState(null);
  // The verdict-reaction line currently displayed by the focused character
  // (immediate response on Believe/Abstain/Doubt commit, before the reveal modal).
  const [activeReaction, setActiveReaction] = useState(null);
  // Eugene (the unicorn, RL80 agent) is text-only — SitePal can't drive her
  // head shape. This holds her current spoken line so we can render it as an
  // HTML chat bubble near her position. The bubble persists until the player
  // proceeds (CONTINUE / switch consultant / ask another question).
  const [eugeneBubble, setEugeneBubble] = useState(null);
  // When set, the unified widget's top section shows this spoken-line text +
  // a CONTINUE button INSTEAD of the question list. Used to gate the player
  // on the intro / return line — so they can read along while listening,
  // and explicitly advance to the questions when ready. Cleared on continue,
  // on asking a question, or on character switch.
  const [currentSpeech, setCurrentSpeech] = useState(null);
  // shape: { stationKey, text, kind: 'intro' | 'return' } | null
  // GR80 delivers a one-time rules speech prepended to his intro on the player's
  // first-ever monk visit this session. Skipped on subsequent cases.
  const rulesSpokenRef = useRef(false);
  const [verdict, setVerdict] = useState(null);
  const [brier, setBrier] = useState(null);
  // Derived: total questions asked across all stations, and what remains.
  const scansUsed = Object.values(asked).reduce((n, set) => n + set.size, 0);
  const scansRemaining = Math.max(0, caseData.maxScans - scansUsed);
  // Derived: stations with at least one asked question. Used by the reveal
  // modal's "scans used" indicator and by tab/portrait state styling later.
  const investigated = useMemo(() => {
    const s = new Set();
    Object.entries(asked).forEach(([k, set]) => { if (set.size > 0) s.add(k); });
    return s;
  }, [asked]);
  const enterGameMode = () => {
    setTradeMode('game');
    setGameStarted(true);
    setAsked({ monk: new Set(), demon: new Set(), marisol: new Set(), eugene: new Set() });
    setVisitedStations(new Set());
    setActiveAnswer(null);
    setActiveReaction(null);
    rulesSpokenRef.current = false;
    setVerdict(null);
    setBrier(null);
  };
  const returnToServiceRail = () => {
    setTradeMode(null);
    setGameStarted(false);
  };
  // Derive the overlay's active station from focusedAgent when in game mode.
  // Falls back to 'monk' (the opener) so the overlay renders something stable
  // before the player has clicked any character.
  const gameActiveStation =
    (focusedAgent && CHARACTER_TO_STATION[focusedAgent]) || 'monk';
  const gameStation = caseData.stations[gameActiveStation];

  // Speech helper: routes a case-data dialogue value (string or `{text, audio}`)
  // through SitePal's pending-speech queue and `runSpeechRequest` retry path —
  // same pipeline the working lobby "meet" line uses. We were previously
  // calling `window.sayAudio` directly which (a) bypassed the retry timer that
  // tolerates audio-not-yet-loaded after a scene swap, (b) produced no console
  // log, and (c) silently failed when the SitePal scene was still warming up.
  //
  // Eugene is text-only (no SitePal scene) — her lines surface as an HTML chat
  // bubble. The bubble persists until the player proceeds (asks another
  // question / CONTINUE / switches consultant); no time-based auto-dismiss.
  const speakLine = useCallback((line, stationKey) => {
    const resolved = resolveLine(line);
    if (!resolved || !resolved.text) return;

    if (stationKey === 'eugene') {
      setEugeneBubble(resolved.text);
      return;
    }
    if (typeof window === 'undefined') return;
    try {
      // Ensure volume is up — activateSitePalProjection may have touched it
      // during the scene swap and the speech here is intentional.
      window.__sitePalDesiredVolume = 7;
      if (typeof window.setPlayerVolume === 'function') {
        try { window.setPlayerVolume(7); } catch (e) {}
      }

      // Map station → SitePal scene so the request knows which scene it
      // belongs to. runSpeechRequest cross-checks request.sceneId against
      // window.__sitePalCurrentSceneId and retries until they match.
      const characterId = STATION_TO_CHARACTER[stationKey];
      const sceneConfig = characterId ? SITEPAL_PROJECTION_CONFIG[characterId] : null;
      if (!sceneConfig) {
        console.warn('[speakLine] no SitePal scene for station', stationKey);
        return;
      }

      // Build the speech payload. Audio wins when present; otherwise TTS
      // with the per-station voice override.
      let speech;
      if (resolved.audio) {
        speech = { type: 'audio', audioName: resolved.audio };
      } else {
        // Per-station voice override. Each station may set a `voice` field in
        // its case-data entry. Two shapes supported:
        //   string  → just the SitePal voice ID; lang/engine fall back to
        //             system defaults (lang 1, engine 3). Use when only the
        //             voice ID changes (e.g. demon: "2" for a US male slot).
        //   object  → { voice, lang?, engine? }. Use when lang or engine
        //             need overriding (e.g. monk: { voice: "1", lang: 2,
        //             engine: 1 } for Gilbert in English-UK / Acapela).
        const v = caseData?.stations?.[stationKey]?.voice;
        let voiceId = "3";
        let lang = 1;
        let engine = 3;
        if (typeof v === 'string') {
          voiceId = v;
        } else if (v && typeof v === 'object') {
          voiceId = v.voice || "3";
          if (typeof v.lang === 'number') lang = v.lang;
          if (typeof v.engine === 'number') engine = v.engine;
        }
        speech = {
          type: 'text',
          text: resolved.text,
          voice: voiceId,
          lang,
          engine,
        };
      }

      // Queue + fire through the existing speech pipeline. If the scene is
      // already loaded, speakPending plays now. If the swap is still in
      // flight, vh_sceneLoaded will pick up this pending entry once SitePal
      // finishes initializing.
      window.__sitePalPendingSpeech = {
        characterId,
        sceneId: sceneConfig.sceneId,
        speech,
      };
      if (
        window.__sitePalSceneLoaded === true &&
        window.__sitePalCurrentSceneId === sceneConfig.sceneId &&
        typeof window.__sitePalSpeakPending === 'function'
      ) {
        window.__sitePalSpeakPending(null);
      }
    } catch (e) {
      console.warn('[speakLine] failed', e);
    }
  }, []);

  // When the player rotates to a game character in game mode, play their intro
  // (or return micro-line on revisit). Slight delay so the camera fly-in lands
  // before the line fires. Eugene's lines are rendered in the panel, not TTS.
  useEffect(() => {
    if (tradeMode !== 'game' || verdict) return;
    if (!focusedAgent) return;
    const stationKey = CHARACTER_TO_STATION[focusedAgent];
    if (!stationKey) return;
    const station = caseData.stations[stationKey];
    if (!station) return;
    // Clear any prior answer / speech beat when switching to a new character.
    // Also clear Eugene's persistent bubble if she's no longer focused, so
    // revisiting her later doesn't flash the previous line before her new
    // intro/return fires.
    setActiveAnswer(null);
    setCurrentSpeech(null);
    if (stationKey !== 'eugene') {
      setEugeneBubble(null);
    }

    // Compute the spoken line + display text SYNCHRONOUSLY so the question
    // list is hidden the moment the player focuses a character. Previously
    // currentSpeech was set inside the 900ms camera-fly timer, which left
    // the question list briefly visible during the fly-in.
    const isFirstVisit = !visitedStations.has(stationKey);
    let toSpeak = null;
    let displayText = '';
    let kind = 'intro';
    if (isFirstVisit) {
      setVisitedStations((prev) => {
        const next = new Set(prev);
        next.add(stationKey);
        return next;
      });
      // Rules preamble: monk speaks them once on his first visit. If the
      // intro has a pre-recorded audio, we assume that recording already
      // contains the rules and play it as-is. Otherwise (TTS fallback) we
      // concat the rules text in front of the intro text. The *displayed*
      // text always includes the full content so the player reads along.
      const introLine = station.intro;
      const introResolved = resolveLine(introLine);
      const introText = introResolved?.text || '';
      toSpeak = introLine;
      displayText = introText;
      if (stationKey === 'monk' && !rulesSpokenRef.current && caseData.rulesIntro) {
        rulesSpokenRef.current = true;
        const rulesText = resolveLine(caseData.rulesIntro)?.text || '';
        displayText = `${rulesText} ${introText}`.trim();
        if (!introResolved?.audio) {
          toSpeak = displayText;
        }
      }
    } else {
      const ret = pickReturnLine(station);
      if (ret) {
        toSpeak = ret;
        displayText = resolveLine(ret)?.text || '';
        kind = 'return';
      }
    }

    if (displayText) {
      setCurrentSpeech({ stationKey, text: displayText, kind });
    }

    // Audio plays after a short delay so the camera fly-in lands first.
    // The text reveal starts immediately (above) — at ~70ms/char it'll
    // run slightly ahead of the recorded audio, but for the long intros
    // they re-converge by the middle of the paragraph.
    const t = setTimeout(() => {
      if (toSpeak) speakLine(toSpeak, stationKey);
    }, 900);
    return () => clearTimeout(t);
    // visitedStations is intentionally read inside the effect — including it in
    // deps would re-fire on every visit toggle and double-speak the intro.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusedAgent, tradeMode, verdict, caseData, speakLine]);

  // Asking a question = spending 1 scan. Plays the answer line and surfaces the
  // matching evidence card in the side panel via `activeAnswer`.
  const askQuestion = (stationKey, idx) => {
    if (verdict) return;
    if (scansRemaining <= 0) return;
    if (asked[stationKey]?.has(idx)) return;
    const q = caseData.stations[stationKey]?.questions?.[idx];
    if (!q) return;
    setAsked((prev) => {
      const next = { ...prev };
      next[stationKey] = new Set(next[stationKey]);
      next[stationKey].add(idx);
      return next;
    });
    // Asking implicitly continues past the intro/return beat (defense in
    // depth — the speech-beat view hides the question buttons, so this
    // shouldn't trigger in practice, but stay clean if it ever does).
    setCurrentSpeech(null);
    setActiveAnswer({ stationKey, idx, ...q });
    speakLine(q.a, stationKey);
  };

  const submitVerdict = (v) => {
    if (verdict) return;
    setVerdict(v);
    setBrier(computeBrier(v, caseData.correctVerdict));
    // Play the focused character's immediate verdict reaction (before the
    // reveal modal renders). Vindication fires ~1.8s later via the effect below.
    const stationKey = focusedAgent && CHARACTER_TO_STATION[focusedAgent];
    const station = stationKey && caseData.stations[stationKey];
    const reaction = station?.verdictReaction?.[v];
    if (reaction) {
      setActiveReaction({ stationKey, text: reaction });
      speakLine(reaction, stationKey);
    }
  };

  // Computed: what the focused character will say after the truth is revealed.
  // Stores the raw line so the speak effect can pass audio through; `text` is
  // pre-resolved for the reveal modal's display.
  const vindicationDelivery = useMemo(() => {
    if (!verdict) return null;
    const stationKey = focusedAgent && CHARACTER_TO_STATION[focusedAgent];
    if (!stationKey) return null;
    const station = caseData.stations[stationKey];
    const vKey = pickVindicationKey(verdict, caseData.correctVerdict);
    const line = station?.vindication?.[vKey];
    const resolved = resolveLine(line);
    if (!resolved || !resolved.text) return null;
    return { stationKey, character: station.character, line, text: resolved.text };
  }, [verdict, focusedAgent, caseData]);

  // After verdict commit, wait ~1.8s for the reaction line to land, then
  // speak the focused character's vindication line. Pass the raw line so
  // speakLine can route to sayAudio if the user has uploaded a recording.
  useEffect(() => {
    if (!vindicationDelivery) return;
    const t = setTimeout(() => {
      speakLine(vindicationDelivery.line, vindicationDelivery.stationKey);
    }, 1800);
    return () => clearTimeout(t);
  }, [vindicationDelivery, speakLine]);

  // Stable camera rig inputs — without `useMemo`, these inline arrays would
  // get a new identity every render and re-mount the rig's effect, lurching
  // the camera back to the start pose on every parent re-render.
  const cameraInitialPosition = useMemo(
    () => (isMobileView ? [0, 4.5, 7] : [0, 1.5, 7.5]),
    [isMobileView],
  );
  const cameraInitialTarget = useMemo(() => [0, -0.5, 0], []);
  const cameraZoomEndDistance = isMobileView ? 6.5 : 3.8;

  // First-visit hint: tells the user characters are clickable. Hides when
  // they click any character (focusedAgent flips truthy) or after a timer.
  const [showCharacterHint, setShowCharacterHint] = useState(false);
  // Hand-tap GIF prompt: appears ~3s after the scene reveals to nudge the
  // user to tap characters/screens, then auto-hides after a few seconds.
  const [showHandTap, setShowHandTap] = useState(false);
  // One-shot hint shown on the user's first character zoom-in: explains how
  // to leave the close-up. Stays dismissed for the rest of the session once
  // shown (zoomHintSeenRef).
  const [showZoomOutHint, setShowZoomOutHint] = useState(false);
  const zoomHintSeenRef = useRef(false);
  // Mobile-only: when a Screen1-4 is tapped, fade in a fullscreen CRT overlay
  // after the camera fly-in. The 3D screens are unreadable on phones.
  const [screenOverlay, setScreenOverlay] = useState(null);
  const screenOverlayTimerRef = useRef(null);
  // Mobile-only: ScreenA-D all paint the same council group chat. After the
  // fly-in, fade in a readable chat overlay instead of the canvas-painted
  // texture (illegible at phone resolution).
  const [chatOverlay, setChatOverlay] = useState(false);
  const chatOverlayTimerRef = useRef(null);
  useEffect(() => {
    return () => {
      if (screenOverlayTimerRef.current) {
        clearTimeout(screenOverlayTimerRef.current);
      }
      if (chatOverlayTimerRef.current) {
        clearTimeout(chatOverlayTimerRef.current);
      }
    };
  }, []);
  const router = useRouter();
  
  // Get music context
  const { 
    play, 
    pause, 
    isPlaying: contextIsPlaying, 
    nextTrack,
    currentTrack,
    is80sMode: context80sMode, 
    setIs80sMode: setContext80sMode
  } = useMusic();
    

    // Check if mobile view and device
    useEffect(() => {
      const checkMobile = () => {
        const isMobile = window.innerWidth <= 768;
        setIsMobileView(isMobile);
        setIsMobileDevice(isMobile);
      };
      checkMobile();
      window.addEventListener('resize', checkMobile);
      return () => window.removeEventListener('resize', checkMobile);
    }, []);

  // Get user context and auth functions
  const { isSignedIn, user } = useUser();
  const { openSignIn, openUserProfile } = useClerk();

  // Suppress WebGL context lost warnings when modal is open
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const originalWarn = console.warn;
      const originalError = console.error;
      
      console.warn = (...args) => {
        // Suppress Three.js context lost warning
        if (typeof args[0] === 'string' && args[0].includes('Context Lost')) {
          // console.log('🎨 3D scene paused for modal display');
          return;
        }
        originalWarn.apply(console, args);
      };
      
      console.error = (...args) => {
        // Also suppress as error in case it comes that way
        if (typeof args[0] === 'string' && args[0].includes('Context Lost')) {
          return;
        }
        originalError.apply(console, args);
      };
      
      return () => {
        console.warn = originalWarn;
        console.error = originalError;
      };
    }
  }, []);

  // Removed auto-collapse timer - only manual interaction collapses the panel

  // Check if mobile on mount
  useEffect(() => {
    const checkMobile = () => {
      if (typeof window !== 'undefined') {
        const isMobile = window.innerWidth <= 768;
        setIsMobileView(isMobile);
        
        // Preload the appropriate model
      const modelToPreload = '/models/RL80_4anims_v40_opt.glb';
          // const modelToPreload = '/models/RL80_4anims_v5_Compact.glb';
        
        if (!document.querySelector(`link[href="${modelToPreload}"]`)) {
          const link = document.createElement('link');
          link.rel = 'preload';
          link.as = 'fetch';
          link.href = modelToPreload;
          link.crossOrigin = 'anonymous';
          link.type = 'model/gltf-binary';
          document.head.appendChild(link);
          // console.log(`[Temple] Preloading ${modelToPreload}`);
          
          // Also actively fetch the model to warm up the cache
          fetch(modelToPreload, { 
            mode: 'cors',
            cache: 'force-cache'
          })
          .then(response => {
            if (!response.ok) {
              throw new Error(`Failed to preload: ${response.status}`);
            }
            // console.log(`[Temple] Successfully preloaded ${modelToPreload}`);
            return response.blob();
          })
          .then(blob => {
            // console.log(`[Temple] Model size: ${(blob.size / 1024 / 1024).toFixed(2)} MB`);
          })
          .catch(error => {
            console.error(`[Temple] Failed to preload model:`, error);
          });
        }
      }
    };
    checkMobile();
    if (typeof window !== 'undefined') {
      window.addEventListener('resize', checkMobile);
    }
    setMounted(true);
    setLoadingProgress(10);
    setLoadingMessage("Setting up environment");
    
    // Now we can start Canvas immediately since we're using a lightweight loader
    setCanvasReady(true);
    setLoadingProgress(20);
    setLoadingMessage("Loading 3D Model...");
    
    // Don't set tickerReady here - wait for model to load first
    
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('resize', checkMobile);
      }
    };
  }, []);

  // Check if font is loaded
  useEffect(() => {
    const checkFont = async () => {
      if (typeof window !== 'undefined' && typeof document !== 'undefined') {
        try {
          await document.fonts.load("1em 'UnifrakturMaguntia'");
          setFontLoaded(true);
          setLoadingProgress(prev => Math.min(prev + 10, 100));
        } catch (e) {
          // console.log('Font load failed, using fallback');
          setTimeout(() => {
            setFontLoaded(true);
            setLoadingProgress(prev => Math.min(prev + 10, 100));
          }, 100);
        }
      } else {
        // Server-side fallback
        setFontLoaded(true);
        setLoadingProgress(prev => Math.min(prev + 10, 100));
      }
    };
    checkFont();
  }, []);

  // Handle model loading completion
  const handleSceneLoad = () => {
    // console.log('🎨 CyborgTempleScene loaded - GLB model ready');
    // console.log('ModelRef current:', modelRef.current);
    setModelLoaded(true);
    setLoadingProgress(70);
    setLoadingMessage("Finalizing...");

    // Mobile and desktop now share the same model, so the ticker mesh exists
    // in both. Enable rendering unconditionally.
    setTickerReady(true);
  };

  // Handle ticker loading completion
  const handleTickerLoad = () => {
    // console.log('📊 TickerDisplay3 loaded');
    setTickerLoaded(true);
    setLoadingProgress(90);
    setLoadingMessage("Almost ready");
  };

  // Comprehensive loading coordination
  useEffect(() => {
    // console.log('🔄 Loading state check:', {
    //   fontLoaded,
    //   mounted,
    //   modelLoaded,
    //   tickerReady,
    //   tickerLoaded
    // });
    
    // Only hide loading when everything is ready
    // Model MUST be loaded before proceeding
    if (!modelLoaded) {
      // console.log('⏳ Waiting for model to load...');
      return; // Don't proceed until model is loaded
    }
    
    // Check ticker condition only after model is loaded
    // On mobile, we don't need to wait for ticker at all
    const tickerCondition = isMobileView ? true : (!tickerReady || (tickerReady && tickerLoaded));
    
    // console.log('📋 Ticker condition:', tickerCondition, 'tickerReady:', tickerReady, 'tickerLoaded:', tickerLoaded);
    
    if (fontLoaded && mounted && modelLoaded && tickerCondition) {
      // console.log('✅ All conditions met! Starting scene reveal sequence...');
      
      // Calculate time elapsed since loading started
      const timeElapsed = Date.now() - modelLoadStartTime;
      const minimumLoadTime = 2000; // Minimum 2 seconds to prevent flash
      const remainingTime = Math.max(0, minimumLoadTime - timeElapsed);
      
      setLoadingProgress(100);
      setLoadingMessage("Ready!");
      
      // Add delay to ensure smooth transition
      const timer = setTimeout(() => {
        // console.log('🚀 Setting scene ready!');
        setSceneReady(true);
        setTimeout(() => {
          // console.log('🎬 Hiding loading screen!');
          setIsSceneLoading(false);
        }, 500); // Brief additional delay for smooth transition
      }, remainingTime + (isMobileView ? 500 : 1000)); // Wait for minimum time plus transition
      
      return () => clearTimeout(timer);
    }
  }, [fontLoaded, mounted, modelLoaded, tickerLoaded, tickerReady, isMobileView, modelLoadStartTime]);

  // Fallback timeout to prevent infinite loading
  useEffect(() => {
    const fallbackTimer = setTimeout(() => {
      if (isSceneLoading && !modelLoaded) {
        // Only force ready if model still hasn't loaded after extended timeout
        console.log('[Temple] Fallback timeout reached, model still not loaded');
        console.log('[Temple] Consider checking network or model file size');
        // Don't reveal the scene - keep showing loader
        // Just log the issue for debugging
      } else if (isSceneLoading && modelLoaded) {
        // If model is loaded but scene is still loading, it's safe to reveal
        console.log('[Temple] Fallback timeout reached but model is loaded, revealing scene');
        setSceneReady(true);
        setIsSceneLoading(false);
      }
    }, isMobileView ? 30000 : 30000); // 30 seconds for both - give model time to load

    return () => clearTimeout(fallbackTimer);
  }, [isSceneLoading, isMobileView, modelLoaded]);

  // Hand-tap GIF prompt: ~3s after the scene reveals, fade in for ~3.5s,
  // then fade out. Skip entirely if the user has already focused something
  // (they don't need the hint) or if the entry overlay is up. Also skip if
  // the user has interacted at all this session — un-focusing back to null
  // would otherwise re-fire this effect and re-show the GIF. Hide
  // immediately on the first click/tap anywhere — they've engaged.
  useEffect(() => {
    if (!sceneReady || focusedAgent || userHasInteracted) return;
    const showTimer = setTimeout(() => setShowHandTap(true), 12500);
    const hideTimer = setTimeout(() => setShowHandTap(false), 15500);
    const hideOnInteraction = () => {
      clearTimeout(showTimer);
      clearTimeout(hideTimer);
      setShowHandTap(false);
    };
    window.addEventListener('pointerdown', hideOnInteraction, { once: true });
    return () => {
      clearTimeout(showTimer);
      clearTimeout(hideTimer);
      window.removeEventListener('pointerdown', hideOnInteraction);
    };
  }, [sceneReady, focusedAgent, userHasInteracted]);

  // Show the "tap a character" hint once the scene is visible. Auto-fade
  // after 6s; if the user clicks a character before then, hide immediately.
  useEffect(() => {
    if (!sceneReady) return;
    if (focusedAgent) {
      setShowCharacterHint(false);
      return;
    }
    setShowCharacterHint(true);
    const t = setTimeout(() => setShowCharacterHint(false), 6000);
    return () => clearTimeout(t);
  }, [sceneReady, focusedAgent]);

  // First-zoom hint: on the user's first character focus this session, after
  // a brief beat (camera has flown in) surface a tip explaining how to leave
  // the close-up. Stays visible for the entire focused view; hides as soon
  // as the user un-focuses. Doesn't reappear on subsequent focuses.
  useEffect(() => {
    if (!focusedAgent) {
      setShowZoomOutHint(false);
      return;
    }
    if (zoomHintSeenRef.current) return;
    const showTimer = setTimeout(() => {
      zoomHintSeenRef.current = true;
      setShowZoomOutHint(true);
    }, 1200);
    return () => clearTimeout(showTimer);
  }, [focusedAgent]);

  // Don't render on server-side
  if (!mounted) {
    return <CoinLoader loading={true} />;
  }

  return (
    <>
      {/* Loading Screen */}
      <CoinLoader loading={isSceneLoading} />

      {/* Dev camera-tuning panel — shows only when ?tune=1 is in URL */}
      <CameraTuningPanel />

      {/* Dev SitePal crop tuning panel — shows only when ?tune=sitepal */}
      <SitePalCropPanel />

      {/* Single host SitePal embed. CyborgTempleScene swaps the
          loaded scene per character via window.loadSceneByID() on
          focus. One WebGL/AudioContext shared across all characters.
          Container kept onscreen-but-invisible (left:0, opacity:0.01)
          to avoid the WebGL throttling that hits offscreen canvases. */}
      {mounted && <SitePalHostEmbed config={HOST_SITEPAL_CONFIG} />}
          
      <div 
        style={{ 
        width: '100vw', 
        height: '100vh', 
        margin: 0, 
        padding: 0, 
        overflow: 'hidden',
        position: 'fixed',
        top: 0,
        left: 0,
        backgroundColor: '#000',
        opacity: sceneReady ? 1 : 0,
        transition: 'opacity 0.8s ease-in-out',
        visibility: sceneReady ? 'visible' : 'hidden'
      }}>
      <style jsx global>{`
        @font-face {
          font-family: 'UnifrakturMaguntia';
          src: url('/fonts/UnifrakturMaguntia-Regular.ttf') format('truetype');
          font-weight: normal;
          font-style: normal;
          font-display: swap;
        }
        
        #text, .text__copy {
          font-family: 'UnifrakturMaguntia', serif !important;
        }
        
        /* Force RL80 logo to always be visible */
        .rl80-logo-container,
        .rl80-logo-text,
        .rl80-logo-container *,
        .rl80-logo-text * {
          opacity: 1 !important;
          visibility: visible !important;
        }
        
        /* Override any extension rules targeting UnifrakturMaguntia */
        [style*="UnifrakturMaguntia"] {
          opacity: 1 !important;
          visibility: visible !important;
        }
        
        @keyframes spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        } 
        
        @keyframes pulse {
          0% {
            opacity: 0.6;
            transform: scale(1);
          }
          50% {
            opacity: 1;
            transform: scale(1.2);
          }
          100% {
            opacity: 0.6;
            transform: scale(1);
          }
        }
        
        .spinning-record {
          animation: spin 3s linear infinite;
        }
        
        .stats-monitor {
          position: fixed !important;
          top: 0 !important;
          left: 100px !important;
          right: auto !important;
        }

        @keyframes liminalComingSoonPulse {
          0%, 100% {
            opacity: 0.85;
            text-shadow:
              0 0 6px rgba(57, 255, 20, 0.75),
              0 0 14px rgba(57, 255, 20, 0.45),
              0 0 24px rgba(57, 255, 20, 0.2);
          }
          50% {
            opacity: 1;
            text-shadow:
              0 0 10px rgba(57, 255, 20, 0.95),
              0 0 22px rgba(57, 255, 20, 0.65),
              0 0 40px rgba(57, 255, 20, 0.35);
          }
        }

        @keyframes characterHintPulse {
          0%, 100% {
            opacity: 0.85;
            box-shadow:
              0 0 12px rgba(218, 165, 32, 0.4),
              0 0 24px rgba(218, 165, 32, 0.18);
          }
          50% {
            opacity: 1;
            box-shadow:
              0 0 18px rgba(218, 165, 32, 0.65),
              0 0 36px rgba(218, 165, 32, 0.32);
          }
        }

        @keyframes characterHintIconPulse {
          0%, 100% {
            opacity: 0.85;
            transform: scale(1);
          }
          50% {
            opacity: 1;
            transform: scale(1.12);
          }
        }
      `}</style>
      
      <div style={{
        width: "100%",
        height: "100vh",
        background: "#000",
        position: "relative",
        overflow: "hidden"
      }}>
        {/* RL80 Title and Description */}
        {/* <div style={{
          position: "fixed",
          top: "20px",
          left: isMobileView ? "2rem" : "5rem",
          borderRadius: "8px",
          padding: "10px",
          pointerEvents: focusedAgent?.startsWith('Screen') ? 'none' : 'auto',
          opacity: focusedAgent?.startsWith('Screen') ? 0 : (fontLoaded ? 1 : 0),
          transition: "opacity 0.3s ease-in-out",
          zIndex: 10000,
        }}>
          <div 
            id="text"
            style={{
              position: "relative",
              fontFamily: "'UnifrakturMaguntia', serif",
              fontSize: isMobileView ? "3rem" : "4rem",
              color: "#ffffff",
              cursor: "pointer",
            }}
          >
            <Link href="/about" style={{ textDecoration: 'none', color: 'inherit', display: 'inline-block' }}>
              RL80
            </Link>
            {Array.from({length: 100}).map((_, i) => {
              const index = i + 1;
              return (
                <div
                  key={index}
                  className="text__copy"
                  style={{
                    position: "absolute",
                    pointerEvents: "none",
                    zIndex: -1,
                    top: 0,
                    left: 0,
                    color: `rgba(${255 - index * 2}, ${255 - index * 3}, ${255 - index * 2})`,
                    filter: "blur(0.1rem)",
                    transform: `translate(
                      ${index * 0.1}rem, 
                      ${index * 0.1}rem
                    ) scale(${1 + index * 0.01})`,
                    opacity: (1 / index) * 1.5,
                  }}
                >
                  RL80
                </div>
              );
            })}
          </div>
        </div> */}
         <h1
              className="custom-title"
              style={{
                position: "relative",
                left: isMobileView ? "1rem" : "2rem",
                // top: "1.5rem",
                color: "#f6f5f1ff",
                fontFamily: "UnifrakturCook, serif",
                textShadow: "0 0 10px rgba(212, 175, 55, 0.8), 0 0 20px rgba(212, 175, 55, 0.6), 0 0 30px rgba(212, 175, 55, 0.8), 6px 6px 16px rgba(0, 0, 0, 1), -2px -2px 8px rgba(255, 192, 203, 0.7), 0 0 100px rgba(212, 175, 55, 0.1)",
                fontSize: isMobileView ? "2rem" : "3rem",
                fontWeight: 900,
                lineHeight: 0.85,
                transform: "rotate(-8deg) skew(-15deg)",
                zIndex: 1000,
                whiteSpace: "nowrap",
                marginTop: "0",
                // Fade out the title while a character/screen is focused so
                // the close-up has the visual stage to itself.
                opacity: focusedAgent ? 0 : 1,
                // The h1 has no click handler — make it pointer-transparent
                // so its rotated/skewed hit rectangle doesn't swallow clicks
                // on 3D objects underneath it (notably the Angel, which sits
                // high in the upper viewport where the title overlaps).
                pointerEvents: "none",
                transition: "opacity 0.4s ease",
              }}
            >
            <span className="title-line" style={{ display: 'block', position: 'relative' }}>The</span>
            <span className="title-line" style={{ display: 'block', marginLeft: "2rem",position: 'relative' }}>

              <span style={{ fontSize: "2rem" }}></span>
                Liminal
            </span>
            <span className="title-line" style={{ display: 'block', marginLeft: "4rem", position: 'relative' }}>Terminal</span>
          </h1>

          {/* Diagonal "COMING SOON" corner ribbon — cyber-styled, neon green
              on a dark glass plate, clipped by the parent's overflow:hidden
              so it reads as a corner-pinned banner. */}
          <div
            style={{
              position: 'absolute',
              top: isMobileView ? '4em' : '4.5em',
              left: isMobileView ? '-4em' : '-5em',
              width: isMobileView ? '28em' : '32em',
              transform: 'rotate(-35deg)',
              transformOrigin: 'center',
              textAlign: 'center',
              padding: '0.55em 0',
              background: 'linear-gradient(135deg, rgba(6, 20, 8, 0.9) 0%, rgba(20, 60, 30, 0.9) 50%, rgba(6, 20, 8, 0.9) 100%)',
              border: '2px solid rgba(57, 255, 20, 0.85)',
              boxShadow:
                '0 0 18px rgba(57, 255, 20, 0.55), ' +
                '0 0 36px rgba(57, 255, 20, 0.25), ' +
                'inset 0 0 14px rgba(57, 255, 20, 0.18), ' +
                '2px 2px 6px rgba(0, 0, 0, 0.7)',
              color: '#39ff14',
              fontFamily: "'Orbitron', 'Courier New', monospace",
              fontWeight: 900,
              letterSpacing: '0.3em',
              textTransform: 'uppercase',
              textShadow:
                '0 0 8px rgba(57, 255, 20, 0.9), ' +
                '0 0 16px rgba(57, 255, 20, 0.5)',
              fontSize: isMobileView ? '0.65rem' : '0.8rem',
              lineHeight: 1.05,
              animation: 'liminalComingSoonPulse 2.4s ease-in-out infinite',
              zIndex: 1000,
              whiteSpace: 'nowrap',
              pointerEvents: 'none',
              // Fade with the title on close-up.
              opacity: focusedAgent ? 0 : 1,
              transition: 'opacity 0.4s ease',
            }}
          >
            Coming
            <span style={{
              display: 'block',
              fontSize: '1.45em',
              letterSpacing: '0.4em',
              marginTop: '0.1em',
            }}>
              Soon!
            </span>
          </div>

        {/* Temple Description Panel - Separate from RL80 logo */}
        <div 
          onClick={() => {
            if (!userHasInteracted) {
              console.log('Panel clicked, collapsing');
              setUserHasInteracted(true);
            }
          }}
          onTouchStart={() => {
            if (!userHasInteracted) {
              console.log('Panel touched, collapsing');
              setUserHasInteracted(true);
            }
          }}
          style={{
          position: "fixed",
          // Mobile: always 5.5rem from bottom
          // Desktop: stays in same position (120px from top) even when collapsed
          top: isMobileView ? "auto" : "120px",
          bottom: isMobileView ? "5.5rem" : "auto",
          left: isMobileView ? "0.625rem" : "1.25rem",
          right: isMobileView ? "0.625rem" : "auto",
          maxWidth: userHasInteracted ? 
            (isMobileView ? "100%" : "350px") : 
            (isMobileView ? "100%" : "380px"),
          padding: isMobileView ? "0.5rem" : "1rem",
          zIndex: 10,
          transition: "all 0.5s ease-in-out",
          cursor: userHasInteracted ? "default" : "pointer",
          // Pass through pointer events when collapsed on mobile (otherwise blocks 3D coin clicks)
          pointerEvents: userHasInteracted ? "none" : "auto",
        }}>
        </div>
        {/* Aurora Background - Only render when Aurora is selected AND (not in 80s mode OR on mobile) */}
        {canvasReady && useAurora && (!context80sMode || isMobileView) && (
          <div style={{ 
            position: 'absolute', 
            inset: 0, 
            zIndex: 1 
          }}>
            <Aurora />
          </div>
        )}

        {/* Main Canvas */}
        {canvasReady && (
        <CleanCanvas
          key="temple-canvas"
          camera={{
            // Mobile was framed for the old compact MOBILE3.glb — now that it loads
            // the full desktop scene, pull back + widen FOV so the whole tableau
            // fits on portrait aspect. Tune z/fov further if it still reads tight.
            // Raised + tilted down via CameraControlsRig setLookAt below; these
            // values are the seed before the rig takes over.
            position: isMobileView ? [0, 4.5, 7] : [0, 3.5, 5.5],
            fov: isMobileView ? 55 : 50
          }}
          gl={{
            antialias: !isMobileView,
            alpha: true,
            powerPreference: isMobileView ? "default" : "high-performance",
            precision: isMobileView ? "mediump" : "highp",
            stencil: false,
            depth: true,
            preserveDrawingBuffer: false
          }}
          dpr={isMobileView ? 
            (typeof window !== 'undefined' ? Math.min(window.devicePixelRatio || 1, 1.5) : 1) : 
            (typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1)
          }
          performance={{ min: 0.5 }}
          frameloop="always"
          style={{ 
            background: useAurora ? 'transparent' : '#000', 
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            zIndex: 2
          }}
        >
          <fog attach="fog" args={context80sMode ? ['#1a0033', 50, 300] : ['#000000', 20, 200]} />
          <Suspense fallback={null}>
            <ambientLight intensity={1.5} />
            <PostProcessingEffects is80sMode={context80sMode} isMobile={isMobileView} />
            
            {/* Synthwave sunset for 80s mode - desktop only */}
            {context80sMode && !isMobileView && (
              <>
                {/* Gradient skybox sphere */}
                <mesh scale={[500, 500, 500]}>
                  <sphereGeometry args={[1, 32, 32]} />
                  <shaderMaterial
                    side={1}  // BackSide - render inside of sphere
                    depthWrite={false}
                    vertexShader={`
                      varying vec3 vWorldPosition;
                      void main() {
                        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
                        vWorldPosition = worldPosition.xyz;
                        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                      }
                    `}
                    fragmentShader={`
                      varying vec3 vWorldPosition;
                      void main() {
                        // Normalize height from -1 to 1
                        float height = normalize(vWorldPosition).y;
                        
                        // Define gradient colors - subtle horizon glow
                        vec3 bottomColor = vec3(0.15, 0.05, 0.2);   // Dark purple (below horizon)
                        vec3 horizonGlow = vec3(0.4, 0.15, 0.0);    // Muted orange glow at horizon line
                        vec3 lowerSky = vec3(0.15, 0.0, 0.25);      // Purple just above horizon
                        vec3 midColor = vec3(0.1, 0.0, 0.2);        // Medium purple
                        vec3 topColor = vec3(0.02, 0.0, 0.1);       // Very dark purple
                        
                        vec3 color;
                        
                        if (height < -0.1) {
                          // Well below horizon - dark purple
                          color = bottomColor;
                        } else if (height < 0.0) {
                          // Just below horizon - transition to glow
                          float t = (height + 0.1) / 0.1;
                          color = mix(bottomColor, horizonGlow, t);
                        } else if (height < 0.1) {
                          // Just above horizon - orange glow fading to purple
                          float t = height / 0.1;
                          color = mix(horizonGlow, lowerSky, t);
                        } else if (height < 0.5) {
                          // Lower to mid sky
                          float t = (height - 0.1) / 0.4;
                          color = mix(lowerSky, midColor, t);
                        } else {
                          // Upper sky
                          float t = (height - 0.5) / 0.5;
                          color = mix(midColor, topColor, t);
                        }
                        
                        gl_FragColor = vec4(color, 1.0);
                      }
                    `}
                  />
                </mesh>
                
                {/* Synthwave sun model */}
                <SynthSunset 
                  position={[0, 8, -20]}
                  scale={[8, 8, 8]}
                  rotation={[0, 0, 0]}
                />
                
                {/* Scattered clouds for 80s atmosphere - avoiding SynthSunset area */}
                <Clouds material={THREE.MeshBasicMaterial}>
                  {/* Clouds positioned to avoid the sunset at [0, 8, -20] */}
                  {/* Far left side clouds */}
                  <Cloud 
                    position={[-45, 16, 0]} 
                    speed={0.18} 
                    opacity={0.26}
                    color="#fb5607"
                    scale={[3.5, 2, 4]}
                  />
                  <Cloud 
                    position={[-40, 11, -35]} 
                    speed={0.22} 
                    opacity={0.32}
                    color="#8338ec"
                    scale={[4, 2.5, 3]}
                  />
                  <Cloud 
                    position={[-50, 19, 20]} 
                    speed={0.14} 
                    opacity={0.24}
                    color="#c233b1"
                    scale={[3, 2, 3.5]}
                  />
                  {/* Far right side clouds */}
                  <Cloud 
                    position={[45, 13, -35]} 
                    speed={0.2} 
                    opacity={0.3}
                    color="#3a86ff"
                    scale={[3.5, 2, 4]}
                  />
                  <Cloud 
                    position={[50, 22, -10]} 
                    speed={0.16} 
                    opacity={0.2}
                    color="#ff006e"
                    scale={[2.8, 1.8, 3]}
                  />
                  <Cloud 
                    position={[40, 18, 10]} 
                    speed={0.1} 
                    opacity={0.2}
                    color="#ffbe0b"
                    scale={[2.5, 1.5, 3]}
                  />
                  {/* Behind/side positions */}
                  <Cloud 
                    position={[25, 10, 35]} 
                    speed={0.25} 
                    opacity={0.35}
                    color="#8338ec"
                    scale={[3.5, 2, 4]}
                  />
                  <Cloud 
                    position={[0, 14, 45]} 
                    speed={0.18} 
                    opacity={0.28}
                    color="#3a86ff"
                    scale={[4, 2.5, 3]}
                  />
                  <Cloud 
                    position={[-30, 20, 30]} 
                    speed={0.12} 
                    opacity={0.22}
                    color="#ff006e"
                    scale={[3, 1.8, 3.5]}
                  />
                  <Cloud 
                    position={[20, 25, 25]} 
                    speed={0.11} 
                    opacity={0.18}
                    color="#8338ec"
                    scale={[4, 2, 3.5]}
                  />
                  {/* High clouds that won't obstruct */}
                  <Cloud 
                    position={[-25, 28, -15]} 
                    speed={0.15} 
                    opacity={0.2}
                    color="#fb5607"
                    scale={[3, 1.5, 2.5]}
                  />
                  <Cloud 
                    position={[30, 30, -25]} 
                    speed={0.13} 
                    opacity={0.18}
                    color="#ff006e"
                    scale={[2.5, 1.5, 3]}
                  />
                </Clouds>
              </>
            )}
            
            {/* Starfield background - only show when Aurora is off AND (not in 80s mode OR on mobile) */}
            {!useAurora && (!context80sMode || isMobileView) && (
              <StarField 
                radius={150} 
                count1={isMobileView ? 200 : 500} 
                count2={isMobileView ? 150 : 300} 
                is80sMode={false} 
              />
            )}
            
            {/* CyborgTempleScene with the RL80 model */}
            <CyborgTempleScene
              position={isMobileView ? [0, -1.2, 0] : [0, -1.9, 0]}
              scale={[1.2, 1.2, 1.2]}
              rotation={[0, 0, 0]}
              isPlaying={false}
              onLoad={handleSceneLoad}
              showAnnotations={true}
              is80sMode={context80sMode}
              isMobile={isMobileView}
              disableCandleInteraction
              gameStarted={gameStarted}
              showCharacterHints={showCharacterHint && !focusedAgent}
              useSitePalForDemon={focusedAgent === 'Demon'}
              useSitePalForDetective={focusedAgent === 'Detective'}
              useSitePalForMonk={focusedAgent === 'Monk'}
              externalFocusAgent={focusedAgent}
              onCoinFaceTap={(coinIndex) => {
                // TODO: show leaderboard player info for tapped coin
                console.log(`CoinFace ${coinIndex} tapped`)
              }}
              onAgentClick={(agentId) => {
                if (agentId) {
                  setFocusedAgent(agentId);
                  if (!userHasInteracted) {
                    setTimeout(() => {
                      setUserHasInteracted(true);
                    }, 500);
                  }
                  // Mobile: schedule fullscreen CRT overlay after camera fly-in.
                  // The 3D screens are unreadable at phone resolution; the
                  // overlay shows readable content instead.
                  if (isMobileView && /^Screen[1-4]$/.test(agentId)) {
                    if (screenOverlayTimerRef.current) {
                      clearTimeout(screenOverlayTimerRef.current);
                    }
                    screenOverlayTimerRef.current = setTimeout(() => {
                      setScreenOverlay(agentId);
                    }, 1100);
                  }
                  // Mobile: ScreenA-D share the council group chat — fade in
                  // the readable chat overlay after the fly-in completes.
                  if (isMobileView && /^Screen[A-D]$/.test(agentId)) {
                    if (chatOverlayTimerRef.current) {
                      clearTimeout(chatOverlayTimerRef.current);
                    }
                    chatOverlayTimerRef.current = setTimeout(() => {
                      setChatOverlay(true);
                    }, 1100);
                  }
                } else {
                  setFocusedAgent(null);
                  if (screenOverlayTimerRef.current) {
                    clearTimeout(screenOverlayTimerRef.current);
                    screenOverlayTimerRef.current = null;
                  }
                  setScreenOverlay(null);
                  if (chatOverlayTimerRef.current) {
                    clearTimeout(chatOverlayTimerRef.current);
                    chatOverlayTimerRef.current = null;
                  }
                  setChatOverlay(false);
                }
              }}
            />

            {/* TickerDisplay3 — now rendered on both mobile and desktop since
                they share the same GLB model. autoRotate props mirror the
                OrbitControls below so the cylinder spins opposite the camera. */}
            {tickerReady && (
              <TickerDisplay3
                modelRef={null}
                onLoad={handleTickerLoad}
                isMobile={isMobileView}
                autoRotate={!focusedAgent}
                autoRotateSpeed={0.4}
              />
            )}

          
            {/* Constellation */}
            <ConstellationModel  
              groupScale={[10, 10, 10]} 
              groupPosition={[0, 15, -80]} 
              isVisible={true} 
            />

            {/* Liminal Terminal preview — screens render cryptic teasers */}
            <VideoScreens is80sMode={context80sMode} previewMode={true} />

            {/* Council group chat painted onto ScreenA/C/D */}
            <CouncilChatScreens />

            {/* ScreenB → looping slot machine */}
            <ScreenBSlotMachine />

              {/* <NeuralNetworkR3F 
              theme={2}
              opacity={0.8}            // Slightly dimmed
              useNormalBlending={true}
              formation={0}
              density={300}
              position={[0.64, -0.72, 0.37]}
              scale={0.005}
              enableInteraction={true}
              nodeSize={0.06}  
            /> */}
            
            {/* CameraControls (camera-controls under the hood) — handles
                fly-to transitions atomically (position + target damped
                together), avoiding the two-segment feel that came from
                running an external tween alongside OrbitControls'
                damping. Auto-orbit and limits replicated in the rig. */}
            <CameraControlsRig
              autoRotate={!focusedAgent}
              autoRotateSpeed={-0.8}
              initialPosition={cameraInitialPosition}
              initialTarget={cameraInitialTarget}
              zoomEndDistance={cameraZoomEndDistance}
              zoomDuration={25}
              introStartDistance={isMobileView ? 13 : 11}
              introDuration={12}
            />
          </Suspense>
          {/* <Stats className="stats-monitor" /> */}
        </CleanCanvas>
        )}

        {/* Floating Character Label on Focus */}
        {(() => {
          const agentInfo = {
            RL80: { name: 'Eugene', pronunciation: 'yoo-JEEN', tagline: 'Scans the tech tapestry for uncommon insights.' },
            Demon: { name: 'John Barron', pronunciation: '', tagline: 'Devil\'s advocate. Short seller. Insider trader.' },
            Monk: { name: 'St. GR80', pronunciation: 'saint GREAT-ee', tagline: 'Android theologian hell-bent on saving humanity from itself.' },
            Detective: { name: 'Detective Marisol', pronunciation: '', tagline: 'Field agent for an interdimensional anti-fraud task force.' },
          };
          // In game mode, the in-scene evidence side panel takes over —
          // suppress the floating agent label so the two cards don't stack.
          const info = tradeMode !== 'game' && focusedAgent && agentInfo[focusedAgent];
          // On mobile, place the label as a bottom banner above the bottom
          // nav so it doesn't overlap the focused character. On desktop,
          // keep the right-side floating card.
          const baseStyle = isMobileView ? {
            position: 'fixed',
            left: '0.75rem',
            right: '0.75rem',
            // Bottom nav is ~5.5rem; sit above it with a gap.
            bottom: '6.5rem',
            opacity: info ? 1 : 0,
            transition: 'opacity 0.4s ease',
            pointerEvents: 'none',
            zIndex: 20,
            background: 'rgba(0, 0, 0, 0.78)',
            border: '1px solid rgba(218, 165, 32, 0.55)',
            borderRadius: '10px',
            padding: '0.7rem 1rem',
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',
            textAlign: 'center',
            boxShadow: '0 0 24px rgba(218, 165, 32, 0.18)',
          } : {
            position: 'fixed',
            right: '20%',
            top: '50%',
            transform: 'translateY(-50%)',
            opacity: info ? 1 : 0,
            transition: 'opacity 0.4s ease',
            pointerEvents: 'none',
            zIndex: 20,
            background: 'rgba(0, 0, 0, 0.7)',
            border: '1px solid rgba(218, 165, 32, 0.5)',
            borderRadius: '8px',
            padding: '1rem 1.5rem',
            maxWidth: '260px',
            backdropFilter: 'blur(8px)',
            textAlign: 'center',
          };
          return (
            <div style={baseStyle}>
              <div style={{
                fontFamily: "'Pirata One', serif",
                fontSize: isMobileView ? '1.6rem' : '1.4rem',
                color: '#daa520',
                marginBottom: '0.15rem',
                letterSpacing: '0.5px',
                lineHeight: 1.1,
              }}>
                {info?.name}
              </div>
              {info?.pronunciation && (
                <div style={{
                  fontFamily: "'Orbitron', 'Courier New', monospace",
                  fontSize: isMobileView ? '0.6rem' : '0.65rem',
                  color: 'rgba(218, 165, 32, 0.7)',
                  fontStyle: 'italic',
                  letterSpacing: '0.08em',
                  marginBottom: '0.4rem',
                  lineHeight: 1.2,
                }}>
                  /{info.pronunciation}/
                </div>
              )}
              <div style={{
                fontSize: isMobileView ? '0.78rem' : '0.85rem',
                color: 'rgba(255, 255, 255, 0.78)',
                fontStyle: 'italic',
                lineHeight: 1.35,
              }}>
                {info?.tagline}
              </div>
              {showZoomOutHint && (
                <div style={{
                  marginTop: '0.5rem',
                  paddingTop: '0.4rem',
                  borderTop: '1px solid rgba(218, 165, 32, 0.25)',
                  fontFamily: "'Orbitron', 'Courier New', monospace",
                  fontSize: isMobileView ? '0.4rem' : '0.45rem',
                  fontWeight: 700,
                  textAlign: 'center',
                  letterSpacing: '0.18em',
                  textTransform: 'uppercase',
                  color: 'rgba(218, 165, 32, 0.85)',
                  // animation: 'characterHintPulse 2.4s ease-in-out infinite',
                }}>
                  ✦ Tap the character to return ✦
                </div>
              )}
            </div>
          );
        })()}

        {/* Hand-tap GIF prompt — sits in a dark empty area so the caption
            has breathing room. Mobile: bottom-center above the nav bar.
            Desktop: right side, vertically centered. */}
        <div
          style={{
            position: 'fixed',
            ...(isMobileView
              ? { left: '50%', bottom: '6.5rem', transform: 'translateX(-50%)' }
              : { right: '4%', top: '50%', transform: 'translateY(-50%)' }),
            width: isMobileView ? '110px' : '160px',
            opacity: showHandTap ? 1 : 0,
            transition: 'opacity 0.5s ease',
            pointerEvents: 'none',
            zIndex: 25,
            filter: 'drop-shadow(0 4px 14px rgba(0, 0, 0, 0.6))',
          }}
        >
          <img
            src="/handTap.gif"
            alt="Tap to interact"
            style={{
              width: '100%',
              height: 'auto',
              display: 'block',
            }}
          />
          <div
            style={{
              marginTop: '0.4rem',
              textAlign: 'center',
              fontFamily: "'Orbitron', 'Courier New', monospace",
              fontSize: isMobileView ? '0.6rem' : '0.7rem',
              fontWeight: 700,
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              color: '#8effc4',
              textShadow: '0 0 8px rgba(77, 255, 170, 0.7), 0 0 16px rgba(77, 255, 170, 0.35)',
              lineHeight: 1.3,
            }}
          >
            Tap characters &amp; screens
          </div>
        </div>

        {/* Top Controls Container - Music, User, and Nav */}
        {mounted && (
          <>
            {/* Nav Controls - Desktop only */}
            {!isMobileView && (
              <div
                style={{
                  position: "fixed",
                  top: "1rem",
                  right: "1rem",
                  zIndex: 1001,
                  opacity: focusedAgent?.startsWith('Screen') ? 0 : 1,
                  pointerEvents: focusedAgent?.startsWith('Screen') ? 'none' : 'auto',
                  transition: 'opacity 0.3s ease',
                }}
              >
                {/* <NavControls
                  auroraOn={useAurora}
                  setAuroraOn={setUseAurora}
                  is80s={context80sMode}
                  setIs80s={setContext80sMode}
                  isPlaying={contextIsPlaying}
                  onPlayMusic={() => play()}
                  onStopMusic={() => pause()}
                  onSkipTrack={() => nextTrack()}
                  onMenuClick={() => setShowCyberNav(!showCyberNav)}
                  isUserSignedIn={isSignedIn}
                  isMenuOpen={showCyberNav}
                /> */}
              </div>
            )}

            {/* Bottom Nav — rendered on both mobile and desktop, mirrors
                /exlibris: 3 slots (LOGIN | CHAT teaser FAB | HOME + BUY). */}
            <>
              {tradeMode !== 'game' && !focusedAgent && (
                <TradeServiceRail onSelect={enterGameMode} />
              )}
              {/* In-scene HUD strip — top of viewport, 40px tall, doesn't
                  block. Shows case name + scans remaining. */}
              {tradeMode === 'game' && !verdict && (
                <div
                  style={{
                    position: 'fixed',
                    top: 'calc(env(safe-area-inset-top, 0px) + 12px)',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    zIndex: 1050,
                    padding: '8px 16px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 14,
                    background: 'linear-gradient(180deg, rgba(4,12,8,0.86), rgba(2,5,8,0.74))',
                    border: '1px solid rgba(77,255,170,0.55)',
                    borderRadius: 6,
                    boxShadow: '0 0 18px rgba(77,255,170,0.22)',
                    backdropFilter: 'blur(8px)',
                    WebkitBackdropFilter: 'blur(8px)',
                    fontFamily: "'IBM Plex Mono', 'SF Mono', Menlo, monospace",
                    color: '#c8ffe0',
                    fontSize: 11,
                    letterSpacing: '0.16em',
                    pointerEvents: 'none',
                  }}
                >
                  <span style={{ color: '#8effc4', fontWeight: 700 }}>// CASE</span>
                  <span>{caseData.projectName}</span>
                  <span style={{ color: '#3a6b54' }}>·</span>
                  <span style={{ color: '#8effc4' }}>{caseData.ticker}</span>
                  <span style={{ color: '#3a6b54' }}>·</span>
                  <span>SCANS {scansRemaining}/{caseData.maxScans}</span>
                  <span style={{ color: '#3a6b54' }}>·</span>
                  <span style={{ color: '#6db59a', fontStyle: 'italic' }}>
                    {focusedAgent && CHARACTER_TO_STATION[focusedAgent]
                      ? 'investigate or render verdict'
                      : 'click a character to investigate'}
                  </span>
                </div>
              )}

              {/* EvidenceScreens — paints the active question's evidence card
                  onto the focused character's primary workstation screen
                  (Screen1-4). Honored via canvas.dataset.evidenceActive by the
                  ambient CRT painters (CRTScreen, DetectiveScreen) so they
                  yield while a card is up and resume when activeAnswer clears. */}
              {tradeMode === 'game' && (
                <EvidenceScreens activeAnswer={activeAnswer} caseData={caseData} />
              )}

              {/* Unified game console — single bottom widget combining the
                  question card (top section) and the consultant railway
                  (bottom section). Replaces the old right-side scan panel +
                  centered bottom railway with one decision surface: questions
                  for the current consultant above, switch-consultant portraits
                  below. Same layout on desktop and mobile. */}
              {tradeMode === 'game' && !verdict && (
                <div
                  style={{
                    position: 'fixed',
                    left: '50%',
                    bottom: isMobileView
                      ? 'calc(env(safe-area-inset-bottom, 0px) + 5.5rem)'
                      : '5.5rem',
                    transform: 'translateX(-50%)',
                    zIndex: 1055,
                    width: isMobileView
                      ? 'calc(100vw - 12px)'
                      : 'min(540px, calc(100vw - 24px))',
                    maxHeight: '70vh',
                    display: 'flex',
                    flexDirection: 'column',
                    background: 'linear-gradient(180deg, rgba(4,12,8,0.92), rgba(2,5,8,0.82))',
                    border: '1px solid rgba(77,255,170,0.45)',
                    borderRadius: 10,
                    boxShadow: '0 0 28px rgba(77,255,170,0.18)',
                    backdropFilter: 'blur(10px)',
                    WebkitBackdropFilter: 'blur(10px)',
                    fontFamily: "'IBM Plex Mono','SF Mono',Menlo,monospace",
                    color: '#c8ffe0',
                    overflow: 'hidden',
                    pointerEvents: 'auto',
                  }}
                >
                  {/* Top section: question content state machine, or a
                      "tap a consultant" hint when no character is focused. */}
                  {focusedAgent && CHARACTER_TO_STATION[focusedAgent] && gameStation ? (
                  <div style={{ maxHeight: '46vh', overflowY: 'auto', padding: '10px 14px', borderBottom: '1px solid rgba(77,255,170,0.18)' }}>
                    {(() => {
                      const stationKey = gameActiveStation;
                      const askedAtStation = asked[stationKey] || new Set();
                      const questions = gameStation.questions || [];
                      const unaskedQuestions = questions
                        .map((q, idx) => ({ q, idx }))
                        .filter(({ idx }) => !askedAtStation.has(idx));
                      const noQuestionsLeftAtStation = unaskedQuestions.length === 0;
                      const isActiveAnswerHere = activeAnswer && activeAnswer.stationKey === stationKey;
                      const revealedEntry = isActiveAnswerHere
                        ? gameStation.entries.find((e) => e.label === activeAnswer.reveals)
                        : null;

                      // 1) Active answer — small italic Q echo, the spoken
                      //    line in a magenta-quote box, the revealed evidence,
                      //    Continue back to questions (or to verdict if 0 scans).
                      if (isActiveAnswerHere) {
                        return (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            <div style={{
                              fontSize: 11,
                              color: '#6db59a',
                              fontStyle: 'italic',
                              lineHeight: 1.3,
                            }}>
                              "{activeAnswer.q}"
                            </div>
                            <div style={{
                              padding: '10px 12px',
                              borderLeft: '2px solid #ff3ea0',
                              background: 'rgba(255,62,160,0.05)',
                            }}>
                              <div style={{
                                fontFamily: "'Cinzel Decorative','Cinzel',serif",
                                fontSize: 13,
                                color: '#c8ffe0',
                                lineHeight: 1.4,
                              }}>
                                "{resolveLine(activeAnswer.a)?.text || ''}"
                              </div>
                            </div>
                            {revealedEntry && (
                              <div
                                style={{
                                  display: 'grid',
                                  gridTemplateColumns: '110px 1fr 18px',
                                  gap: 10,
                                  padding: '8px 10px',
                                  background: revealedEntry.threat === 'red' ? 'rgba(120,0,30,0.18)'
                                    : revealedEntry.threat === 'amber' ? 'rgba(120,80,0,0.16)'
                                    : 'rgba(10,58,38,0.20)',
                                  borderLeft: `2px solid ${revealedEntry.threat === 'red' ? '#ff4d6d' : revealedEntry.threat === 'amber' ? '#ffb84d' : '#4dffaa'}`,
                                  fontSize: 11,
                                  animation: 'lt-fade-in 0.5s ease-out',
                                }}
                              >
                                <div style={{ fontSize: 9, letterSpacing: '0.16em', color: '#6db59a' }}>{revealedEntry.label}</div>
                                <div style={{ color: '#c8ffe0' }}>{revealedEntry.value}</div>
                                <div style={{ textAlign: 'center', color: revealedEntry.threat === 'red' ? '#ff4d6d' : revealedEntry.threat === 'amber' ? '#ffb84d' : '#4dffaa' }}>
                                  {revealedEntry.threat === 'red' ? '▲' : revealedEntry.threat === 'amber' ? '◆' : '○'}
                                </div>
                              </div>
                            )}
                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                              <button
                                onClick={() => {
                                  setActiveAnswer(null);
                                  // CONTINUE counts as "proceeding past the
                                  // answer," so dismiss Eugene's bubble too.
                                  setEugeneBubble(null);
                                }}
                                style={{
                                  background: 'transparent',
                                  border: '1px solid #4dffaa',
                                  color: '#4dffaa',
                                  padding: '6px 14px',
                                  fontFamily: "'IBM Plex Mono','SF Mono',Menlo,monospace",
                                  fontSize: 10,
                                  letterSpacing: '0.22em',
                                  cursor: 'pointer',
                                }}
                              >
                                ▸ {scansRemaining > 0 ? 'CONTINUE' : 'RENDER VERDICT'}
                              </button>
                              {/* Mobile-essential, desktop-handy: expand the
                                  evidence card into the viewport via the same
                                  FullscreenCRTOverlay the in-scene screen tap
                                  uses. Necessary because the character body
                                  often occludes the workstation screen at the
                                  current camera distance, especially on mobile. */}
                              {STATION_TO_SCREEN[activeAnswer.stationKey] && (
                                <button
                                  onClick={() => setScreenOverlay(STATION_TO_SCREEN[activeAnswer.stationKey])}
                                  style={{
                                    background: 'rgba(255,62,160,0.10)',
                                    border: '1px solid #ff3ea0',
                                    color: '#ff3ea0',
                                    padding: '6px 14px',
                                    fontFamily: "'IBM Plex Mono','SF Mono',Menlo,monospace",
                                    fontSize: 10,
                                    letterSpacing: '0.22em',
                                    cursor: 'pointer',
                                  }}
                                >
                                  ▸ VIEW ON SCREEN
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      }

                      // 2) Speech beat — character just spoke their intro or
                      //    return line; player should read along and tap
                      //    CONTINUE to advance to the question list. Hides
                      //    the questions so the player isn't tempted to
                      //    pick one before hearing the line. Text reveals
                      //    progressively in sentence-sized chunks (paced
                      //    ~70ms/char) to trail the audio rather than
                      //    dump the whole script up front.
                      if (currentSpeech && currentSpeech.stationKey === stationKey) {
                        return (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                            <div style={{
                              padding: '10px 12px',
                              borderLeft: '2px solid #ff3ea0',
                              background: 'rgba(255,62,160,0.05)',
                            }}>
                              <div style={{
                                fontFamily: "'Cinzel Decorative','Cinzel',serif",
                                fontSize: isMobileView ? 18 : 17,
                                color: '#c8ffe0',
                                lineHeight: 1.5,
                              }}>
                                <ProgressiveText
                                  text={currentSpeech.text}
                                  maxVisibleLines={isMobileView ? 2 : 3}
                                  approxLineHeight={1.5}
                                />
                              </div>
                            </div>
                            <button
                              onClick={() => {
                                setCurrentSpeech(null);
                                // Continue past the speech beat also clears
                                // Eugene's bubble — she's the only character
                                // with a separate persistent display surface
                                // and we want the dismissal to be unified.
                                setEugeneBubble(null);
                              }}
                              style={{
                                background: 'transparent',
                                border: '1px solid #4dffaa',
                                color: '#4dffaa',
                                padding: '6px 14px',
                                fontFamily: "'IBM Plex Mono','SF Mono',Menlo,monospace",
                                fontSize: 10,
                                letterSpacing: '0.22em',
                                cursor: 'pointer',
                                alignSelf: 'flex-start',
                              }}
                            >
                              ▸ CONTINUE
                            </button>
                          </div>
                        );
                      }

                      // 3) No scans left — nudge toward the verdict buttons.
                      if (scansRemaining <= 0) {
                        return (
                          <div style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            height: '100%',
                            textAlign: 'center',
                            gap: 10,
                            padding: '0 8px',
                          }}>
                            <div style={{
                              fontSize: 11,
                              letterSpacing: '0.18em',
                              color: '#6db59a',
                            }}>
                              ALL QUESTIONS SPENT
                            </div>
                            <div style={{ fontSize: 12, color: '#c8ffe0', fontStyle: 'italic', lineHeight: 1.5, maxWidth: 280 }}>
                              Render your verdict below — Believe, Abstain, or Doubt.
                            </div>
                          </div>
                        );
                      }

                      // 3) All this character's questions already asked, but
                      //    scans remain — point the player toward someone else.
                      if (noQuestionsLeftAtStation) {
                        return (
                          <div style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            height: '100%',
                            textAlign: 'center',
                            gap: 10,
                            padding: '0 8px',
                          }}>
                            <div style={{
                              fontSize: 11,
                              letterSpacing: '0.18em',
                              color: '#6db59a',
                            }}>
                              NOTHING MORE TO ASK HERE
                            </div>
                            <div style={{ fontSize: 12, color: '#c8ffe0', fontStyle: 'italic', lineHeight: 1.5, maxWidth: 280 }}>
                              Try another consultant — {scansRemaining} {scansRemaining === 1 ? 'question' : 'questions'} remaining.
                            </div>
                            <div style={{
                              fontSize: 22,
                              color: '#8effc4',
                              marginTop: 4,
                              textShadow: '0 0 10px rgba(77,255,170,0.7)',
                              animation: 'promptArrowBounce 1.6s ease-in-out infinite',
                            }}>↓</div>
                          </div>
                        );
                      }

                      // 4) Default — tappable question list. No tagline, no
                      //    "// ASK ..." subhead, no OR divider — the railway
                      //    sitting directly below this section makes the
                      //    "switch consultant" affordance obvious by adjacency.
                      return (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          {unaskedQuestions.map(({ q, idx }) => (
                            <button
                              key={idx}
                              onClick={() => askQuestion(stationKey, idx)}
                              style={{
                                textAlign: 'left',
                                background: 'rgba(10,58,38,0.18)',
                                border: '1px solid rgba(77,255,170,0.25)',
                                borderLeft: '2px solid #4dffaa',
                                color: '#c8ffe0',
                                padding: '8px 12px',
                                fontFamily: "'IBM Plex Mono','SF Mono',Menlo,monospace",
                                fontSize: 12,
                                lineHeight: 1.35,
                                cursor: 'pointer',
                                transition: 'background 0.15s, border-color 0.15s',
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.background = 'rgba(77,255,170,0.10)';
                                e.currentTarget.style.borderColor = 'rgba(77,255,170,0.55)';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.background = 'rgba(10,58,38,0.18)';
                                e.currentTarget.style.borderColor = 'rgba(77,255,170,0.25)';
                              }}
                            >
                              <span style={{ color: '#8effc4', marginRight: 8 }}>▸</span>
                              {q.q}
                            </button>
                          ))}
                          <div style={{ fontSize: 9, letterSpacing: '0.18em', color: '#3a6b54', marginTop: 2, textAlign: 'right' }}>
                            each question costs 1 of {scansRemaining} {scansRemaining === 1 ? 'scan' : 'scans'}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                  ) : (
                    <div style={{
                      padding: '10px 14px',
                      textAlign: 'center',
                      fontSize: 11,
                      color: '#8effc4',
                      letterSpacing: '0.10em',
                      borderBottom: '1px solid rgba(77,255,170,0.18)',
                    }}>
                      Tap an agent to begin
                    </div>
                  )}

                  {/* Bottom section: consultant railway. Always visible in
                      game mode. State per portrait: current (phosphor ring),
                      visited (small tick dot), all-asked (amber dim, grayscale),
                      unvisited (neutral). Click → setFocusedAgent → scene
                      rotates the platform / flies camera / loads SitePal scene. */}
                  <div style={{
                    display: 'flex',
                    gap: isMobileView ? 6 : 8,
                    padding: '6px 8px',
                    justifyContent: 'center',
                    background: 'rgba(2,5,8,0.4)',
                  }}>
                    {[
                      { agentId: 'Monk',      stationKey: 'monk',    portrait: '/thumbnail_gr80.png' },
                      { agentId: 'Demon',     stationKey: 'demon',   portrait: '/thumbnail_johnBarron.png' },
                      { agentId: 'Detective', stationKey: 'marisol', portrait: '/thumbnail_marisol.png' },
                      { agentId: 'RL80',      stationKey: 'eugene',  portrait: '/thumbnail_eugene.png' },
                    ].map(({ agentId, stationKey, portrait }) => {
                      const station = caseData.stations[stationKey];
                      if (!station) return null;
                      const isCurrent = focusedAgent === agentId;
                      const isVisited = visitedStations.has(stationKey);
                      const askedCount = asked[stationKey]?.size || 0;
                      const totalQuestions = station.questions?.length || 0;
                      const remaining = Math.max(0, totalQuestions - askedCount);
                      const allAsked = remaining === 0;
                      const shortName = station.character.split(' ').slice(-1)[0];
                      const portraitSize = isMobileView ? 36 : 44;

                      return (
                        <button
                          key={agentId}
                          onClick={() => { if (!isCurrent) setFocusedAgent(agentId); }}
                          disabled={isCurrent}
                          title={`${station.character} — ${station.role}`}
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 2,
                            minWidth: isMobileView ? 64 : 80,
                            padding: isMobileView ? '6px 4px' : '8px 6px',
                            background: isCurrent
                              ? 'rgba(77,255,170,0.18)'
                              : allAsked && isVisited
                                ? 'rgba(120,80,0,0.12)'
                                : 'rgba(10,58,38,0.18)',
                            border: isCurrent
                              ? '1px solid #4dffaa'
                              : allAsked && isVisited
                                ? '1px solid rgba(255,184,77,0.55)'
                                : '1px solid rgba(77,255,170,0.28)',
                            borderRadius: 7,
                            color: isCurrent ? '#8effc4' : allAsked && isVisited ? '#ffb84d' : '#c8ffe0',
                            cursor: isCurrent ? 'default' : 'pointer',
                            fontFamily: "'IBM Plex Mono','SF Mono',Menlo,monospace",
                            boxShadow: isCurrent
                              ? '0 0 12px rgba(77,255,170,0.45), inset 0 0 12px rgba(77,255,170,0.10)'
                              : 'none',
                            transition: 'all 0.18s ease',
                            position: 'relative',
                            opacity: isCurrent ? 1 : allAsked && isVisited ? 0.78 : 0.92,
                          }}
                        >
                          <img
                            src={portrait}
                            alt={station.character}
                            width={portraitSize}
                            height={portraitSize}
                            style={{
                              width: portraitSize,
                              height: portraitSize,
                              borderRadius: '50%',
                              objectFit: 'cover',
                              background: 'rgba(10,58,38,0.4)',
                              border: isCurrent
                                ? '2px solid #4dffaa'
                                : allAsked && isVisited
                                  ? '2px solid rgba(255,184,77,0.55)'
                                  : '2px solid rgba(255,62,160,0.55)',
                              boxShadow: isCurrent
                                ? '0 0 12px rgba(77,255,170,0.6)'
                                : '0 0 6px rgba(255,62,160,0.3)',
                              filter: allAsked && isVisited ? 'grayscale(0.35)' : 'none',
                              transition: 'all 0.2s ease',
                            }}
                          />
                          <div style={{
                            fontSize: isMobileView ? 9 : 10,
                            letterSpacing: '0.10em',
                            color: 'inherit',
                            textTransform: 'uppercase',
                            marginTop: 3,
                            fontWeight: 600,
                          }}>
                            {shortName}
                          </div>
                          <div style={{
                            fontSize: 7,
                            letterSpacing: '0.18em',
                            color: allAsked && isVisited
                              ? 'rgba(255,184,77,0.85)'
                              : isCurrent
                                ? 'rgba(142,255,196,0.75)'
                                : isVisited
                                  ? '#6db59a'
                                  : '#3a6b54',
                            textTransform: 'uppercase',
                            marginTop: 1,
                          }}>
                            {allAsked && isVisited
                              ? 'ASKED'
                              : isVisited
                                ? `${remaining} LEFT`
                                : 'TAP'}
                          </div>
                          {isVisited && !isCurrent && !allAsked && (
                            <div style={{
                              position: 'absolute',
                              top: 4,
                              right: 4,
                              width: 6,
                              height: 6,
                              borderRadius: '50%',
                              background: '#4dffaa',
                              boxShadow: '0 0 6px #4dffaa',
                            }} />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Eugene's text bubble — she's TTS-less because SitePal can't
                  drive a unicorn head. When she's focused and has a current
                  line, render it as a chat bubble overlaying the upper canvas.
                  Auto-clears via speakLine's timer. Positioned to read as if
                  coming from her direction, not 3D-anchored to her head bone
                  (that's a later polish pass). */}
              {tradeMode === 'game' && !verdict && focusedAgent === 'RL80' && eugeneBubble && (
                <div
                  style={{
                    position: 'fixed',
                    top: 'calc(env(safe-area-inset-top, 0px) + 64px)',
                    left: isMobileView ? '50%' : 'calc(50% - 80px)',
                    transform: 'translateX(-50%)',
                    zIndex: 1060,
                    maxWidth: 'min(360px, calc(100vw - 24px))',
                    padding: '12px 16px 14px',
                    background: 'linear-gradient(180deg, rgba(255,235,250,0.96), rgba(255,210,240,0.96))',
                    border: '1px solid rgba(255,62,160,0.6)',
                    borderRadius: 16,
                    boxShadow: '0 6px 24px rgba(255,62,160,0.32), 0 0 0 4px rgba(255,255,255,0.4) inset',
                    color: '#3a0f2b',
                    fontFamily: "'IBM Plex Mono','SF Mono',Menlo,monospace",
                    fontSize: 13,
                    lineHeight: 1.45,
                    pointerEvents: 'none',
                    transition: 'opacity 0.2s ease',
                  }}
                >
                  <div style={{
                    position: 'absolute',
                    bottom: -10,
                    left: 36,
                    width: 0,
                    height: 0,
                    borderLeft: '10px solid transparent',
                    borderRight: '10px solid transparent',
                    borderTop: '12px solid rgba(255,210,240,0.96)',
                    filter: 'drop-shadow(0 2px 1px rgba(255,62,160,0.3))',
                  }} />
                  <div style={{
                    fontSize: 9,
                    letterSpacing: '0.22em',
                    color: 'rgba(140,30,90,0.7)',
                    marginBottom: 4,
                    textTransform: 'uppercase',
                  }}>
                    @eugene
                  </div>
                  <div>{eugeneBubble}</div>
                </div>
              )}

              {/* Reveal overlay — only after verdict is rendered. Centered card,
                  dismissible. Verdict-result + Brier + ground truth + voice. */}
              {verdict && tradeMode === 'game' && typeof document !== 'undefined' &&
                createPortal(
                  <div
                    style={{
                      position: 'fixed',
                      inset: 0,
                      zIndex: 10500,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: 24,
                      background: 'radial-gradient(ellipse at center, rgba(2,5,7,0.78) 0%, rgba(2,5,7,0.94) 100%)',
                      backdropFilter: 'blur(6px)',
                      WebkitBackdropFilter: 'blur(6px)',
                    }}
                    onClick={returnToServiceRail}
                  >
                    {(() => {
                      const isCorrect = verdict === caseData.correctVerdict;
                      const isAbstain = verdict === 'abstain';
                      const grade = brier <= 0.05 ? 'EXCELLENT' : brier <= 0.15 ? 'STRONG' : brier <= 0.30 ? 'FAIR' : 'POOR';
                      const gradeColor = brier <= 0.15 ? '#8effc4' : brier <= 0.30 ? '#ffb84d' : '#ff4d6d';
                      return (
                        <div
                          onClick={(e) => e.stopPropagation()}
                          style={{
                            width: 'min(560px, calc(100vw - 48px))',
                            padding: '32px 32px 24px',
                            background: 'linear-gradient(180deg, rgba(13,80,50,0.18), rgba(5,10,7,0.95))',
                            border: '1px solid rgba(77,255,170,0.7)',
                            boxShadow: '0 0 80px rgba(13,80,50,0.5)',
                            color: '#c8ffe0',
                            fontFamily: "'IBM Plex Mono','SF Mono',Menlo,monospace",
                            textAlign: 'center',
                          }}
                        >
                          <div style={{ fontSize: 72, lineHeight: 1, color: isCorrect ? '#8effc4' : isAbstain ? '#6db59a' : '#ff4d6d', textShadow: isCorrect ? '0 0 36px #4dffaa' : isAbstain ? 'none' : '0 0 36px rgba(255,77,109,0.6)' }}>
                            {isCorrect ? '✓' : isAbstain ? '◇' : '✗'}
                          </div>
                          <div style={{ fontSize: 9, letterSpacing: '0.32em', color: '#3a6b54', marginTop: 8 }}>YOU RENDERED</div>
                          <div style={{ fontFamily: "'Cinzel Decorative','Cinzel',serif", fontSize: 18, letterSpacing: '0.32em', color: '#8effc4', marginTop: 4 }}>
                            {verdict.toUpperCase()}
                          </div>

                          <div style={{ marginTop: 22, padding: '14px 18px', border: '1px solid rgba(13,80,50,0.6)', background: 'rgba(13,80,50,0.08)' }}>
                            <div style={{ fontSize: 9, letterSpacing: '0.26em', color: '#3a6b54', marginBottom: 6 }}>// GROUND TRUTH</div>
                            <div style={{ fontFamily: "'Cinzel Decorative','Cinzel',serif", fontSize: 14, color: '#c8ffe0' }}>{caseData.reveal.summary}</div>
                          </div>

                          <div style={{ marginTop: 18, display: 'flex', gap: 24, justifyContent: 'center', padding: '14px 24px', border: '1px solid rgba(13,80,50,0.6)' }}>
                            <div>
                              <div style={{ fontSize: 9, letterSpacing: '0.26em', color: '#3a6b54' }}>BRIER</div>
                              <div style={{ fontFamily: "'Cinzel Decorative','Cinzel',serif", fontSize: 22, color: gradeColor, marginTop: 4 }}>{brier.toFixed(3)}</div>
                            </div>
                            <div>
                              <div style={{ fontSize: 9, letterSpacing: '0.26em', color: '#3a6b54' }}>GRADE</div>
                              <div style={{ fontFamily: "'Cinzel Decorative','Cinzel',serif", fontSize: 22, color: gradeColor, marginTop: 4 }}>{grade}</div>
                            </div>
                            <div>
                              <div style={{ fontSize: 9, letterSpacing: '0.26em', color: '#3a6b54' }}>SCANS</div>
                              <div style={{ fontFamily: "'Cinzel Decorative','Cinzel',serif", fontSize: 22, color: '#c8ffe0', marginTop: 4 }}>{investigated.size}/{caseData.maxScans}</div>
                            </div>
                          </div>

                          <div style={{ marginTop: 18, padding: '12px 18px', borderLeft: '2px solid #ff3ea0', background: 'rgba(255,62,160,0.05)', textAlign: 'left' }}>
                            <div style={{ fontSize: 9, letterSpacing: '0.26em', color: '#3a6b54', marginBottom: 4 }}>
                              // {vindicationDelivery ? vindicationDelivery.character.toUpperCase() : 'THE TERMINAL RESPONDS'}
                            </div>
                            <div style={{ fontStyle: 'italic', fontSize: 13, color: '#c8ffe0' }}>
                              "{vindicationDelivery ? vindicationDelivery.text : caseData.reveal.voices[verdict]}"
                            </div>
                          </div>

                          <button
                            onClick={returnToServiceRail}
                            style={{
                              marginTop: 22,
                              background: 'transparent',
                              border: '1px solid #4dffaa',
                              color: '#4dffaa',
                              padding: '10px 32px',
                              fontFamily: "'IBM Plex Mono','SF Mono',Menlo,monospace",
                              fontSize: 11,
                              letterSpacing: '0.32em',
                              cursor: 'pointer',
                            }}
                          >
                            ▸ CLOSE
                          </button>
                        </div>
                      );
                    })()}
                  </div>,
                  document.body
                )}
              <MobileBottomNav
                hideWallet
                accountOnLeft
                /* Trade-style center: three side-by-side actions (BUY / HOLD /
                   SELL). BUY opens the existing BuyModal; HOLD and SELL are
                   placeholders for now. */
                onBuyClick={() => {}}
                centerSlot={
                  tradeMode === 'game' ? (
                    <div
                      style={{
                        display: 'flex',
                        gap: 6,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {[
                        { label: 'Believe', verdict: 'believe', bg: 'rgba(40,180,90,0.85)',  border: 'rgba(120,255,160,0.9)' },
                        { label: 'Abstain', verdict: 'abstain', bg: 'rgba(80,80,90,0.85)',   border: 'rgba(200,200,210,0.7)' },
                        { label: 'Doubt',   verdict: 'doubt',   bg: 'rgba(200,55,55,0.85)',  border: 'rgba(255,140,140,0.9)' },
                      ].map(({ label, verdict: v, bg, border }) => {
                        const enabled = investigated.size > 0 && !verdict;
                        const onClick = () => { if (enabled) submitVerdict(v); };
                        return (
                        <button
                          key={label}
                          onClick={onClick}
                          disabled={!enabled}
                          title={!enabled && investigated.size === 0 ? 'Investigate at least one station first' : undefined}
                          style={{
                            minWidth: 70,
                            height: 60,
                            padding: '10px 10px',
                            borderRadius: 10,
                            background: bg,
                            border: `1px solid ${border}`,
                            color: '#fff',
                            fontFamily: "'Orbitron', monospace",
                            fontSize: 11,
                            fontWeight: 800,
                            letterSpacing: '0.12em',
                            cursor: enabled ? 'pointer' : 'not-allowed',
                            opacity: enabled ? 1 : 0.4,
                            textShadow: '0 1px 0 rgba(0,0,0,0.4)',
                            boxShadow: `0 0 8px ${border}, inset 0 1px 0 rgba(255,255,255,0.15)`,
                          }}
                        >
                          {label}
                        </button>
                        );
                      })}
                    </div>
                  ) : (
                    <button
                      onClick={enterGameMode}
                      aria-label="Judge a case"
                      style={{
                        minWidth: 190,
                        height: 60,
                        padding: '10px 22px',
                        borderRadius: 10,
                        background: 'linear-gradient(135deg, rgba(77,255,170,0.18), rgba(13,80,50,0.32))',
                        border: '1px solid rgba(77,255,170,0.85)',
                        color: '#8effc4',
                        fontFamily: "'Orbitron', monospace",
                        fontSize: 13,
                        fontWeight: 800,
                        letterSpacing: '0.22em',
                        cursor: 'pointer',
                        textShadow: '0 0 10px rgba(77,255,170,0.55)',
                        boxShadow: '0 0 14px rgba(77,255,170,0.35), inset 0 1px 0 rgba(255,255,255,0.1)',
                      }}
                    >
                      ✦ START
                    </button>
                  )
                }
                /* Right slot: in lobby it's HOME; in game mode it becomes
                   MENU so the path picker is always reachable (verdict
                   buttons have taken the center). Book slot (left) is BUY. */
                onMenuClick={
                  tradeMode === 'game'
                    ? returnToServiceRail
                    : () => router.push('/')
                }
                menuIcon={
                  tradeMode === 'game' ? (
                    <svg
                      className="btm-book-icon-svg"
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <rect x="3" y="3" width="7" height="7" rx="1" />
                      <rect x="14" y="3" width="7" height="7" rx="1" />
                      <rect x="3" y="14" width="7" height="7" rx="1" />
                      <rect x="14" y="14" width="7" height="7" rx="1" />
                    </svg>
                  ) : (
                    <svg
                      className="btm-book-icon-svg"
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M9 5v4" />
                      <rect width="4" height="6" x="7" y="9" rx="1" />
                      <path d="M9 15v2" />
                      <path d="M17 3v2" />
                      <rect width="4" height="8" x="15" y="5" rx="1" />
                      <path d="M17 13v3" />
                      <path d="M3 3v16a2 2 0 0 0 2 2h16" />
                    </svg>
                  )
                }
                menuLabel={tradeMode === 'game' ? 'MENU' : 'HOME'}
                isUserSignedIn={isSignedIn}
                userImage={user?.imageUrl}
                show80sButton={false}
                isMobile
                neonMode
                onBookClick={() => setShowBuyModal(true)}
                bookLabel="BUY"
                bookTitle="Buy RL80"
                bookIcon={
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 22, height: 22, color: '#d4a854' }}>
                    <line x1="12" y1="1" x2="12" y2="23" />
                    <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                  </svg>
                }
              />
            </>

            {/* Buy Modal — triggered from the repurposed menu slot */}
            <BuyModal
              isOpen={showBuyModal}
              onClose={() => setShowBuyModal(false)}
            />

            {/* Fullscreen evidence / preview overlay for Screen1-4. Mobile
                opens this when the player taps the screen mesh in-scene; the
                unified widget's "▸ VIEW ON SCREEN" button opens it on any
                device so evidence is reachable even when the character body
                occludes the workstation screen.

                Routing:
                  • activeAnswer matches screen's consultant AND a rich visual
                    is registered for that (stationKey, label) →  EvidenceOverlay
                    (SVG visualization — flow graph, timeline, etc.)
                  • activeAnswer matches but no rich visual yet →
                    FullscreenCRTOverlay with the typewriter evidence sequence
                    (fallback text card)
                  • No activeAnswer → FullscreenCRTOverlay with COMING SOON stub

                Both paths share the same `screenOverlay` state and close hook. */}
            {typeof document !== 'undefined' && createPortal(
              (() => {
                if (!screenOverlay) {
                  return (
                    <FullscreenCRTOverlay
                      isActive={false}
                      onClose={() => {}}
                      locale="en"
                      textSequence={[]}
                      terminalTitle=""
                      terminalStatus="MOBILE PREVIEW"
                    />
                  );
                }
                const stationKey = SCREEN_TO_STATION[screenOverlay];
                const stationForScreen = stationKey ? caseData?.stations?.[stationKey] : null;
                const liveEntry = (
                  activeAnswer &&
                  activeAnswer.stationKey === stationKey &&
                  stationForScreen?.entries?.find((e) => e.label === activeAnswer.reveals)
                ) || null;

                const closeOverlay = () => {
                  setScreenOverlay(null);
                  // Defocus the screen so the camera glides back. Reuses the
                  // existing event the on-screen back buttons dispatch.
                  if (typeof window !== 'undefined') {
                    window.dispatchEvent(new CustomEvent('screenGoBack'));
                  }
                };

                // Rich-visual path
                if (liveEntry && stationForScreen && hasRichVisual(stationKey, liveEntry)) {
                  return (
                    <EvidenceOverlay
                      isActive={true}
                      stationKey={stationKey}
                      station={stationForScreen}
                      entry={liveEntry}
                      onClose={closeOverlay}
                    />
                  );
                }

                // Typewriter fallback (text card or COMING SOON stub)
                let textSequence = [];
                let terminalTitle = '';
                if (liveEntry && stationForScreen) {
                  textSequence = buildEvidenceTextSequence(stationForScreen, liveEntry);
                  terminalTitle = `${stationForScreen.character.toUpperCase()} // EVIDENCE`;
                } else {
                  const stub = SCREEN_OVERLAY_STUBS[screenOverlay];
                  textSequence = stub?.sequence || [];
                  terminalTitle = stub?.title || '';
                }
                return (
                  <FullscreenCRTOverlay
                    isActive={true}
                    onClose={closeOverlay}
                    locale="en"
                    textSequence={textSequence}
                    terminalTitle={terminalTitle}
                    terminalStatus="MOBILE PREVIEW"
                    tapToReturnLabel="> tap anywhere to return"
                  />
                );
              })(),
              document.body
            )}

            {/* Mobile fullscreen council-chat overlay for ScreenA-D taps. */}
            {typeof document !== 'undefined' && createPortal(
              <FullscreenChatOverlay
                isActive={chatOverlay}
                onClose={() => {
                  setChatOverlay(false);
                  if (typeof window !== 'undefined') {
                    window.dispatchEvent(new CustomEvent('screenGoBack'));
                  }
                }}
              />,
              document.body
            )}

            {/* Telegram Feature Box - Desktop only */}
            {/* {!isMobileView && !focusedAgent?.startsWith('Screen') && (
              <a
                href="https://t.me/rl80_chat"
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  position: 'fixed',
                  top: '1.5rem',
                  right: '1rem',
                  zIndex: 1001,
                  width: '200px',
                  background: 'rgba(0, 0, 0, 0.7)',
                  border: '1px solid rgba(0, 255, 255, 0.3)',
                  borderRadius: '8px',
                  padding: '10px',
                  textDecoration: 'none',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  backdropFilter: 'blur(8px)',
                }}
              >
                <img
                  src="/groupPhoto.webp"
                  alt="RL80 Team"
                  style={{
                    width: '100%',
                    borderRadius: '6px',
                    objectFit: 'cover',
                  }}
                />
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', }}>
                  <img
                    src="/telegram_blue.svg"
                    alt="Telegram"
                    style={{ width: '32px', height: '32px', flexShrink: 0, }}
                  />
                  <span style={{
                    color: 'rgba(0, 255, 255, 0.8)',
                    fontSize: '10px',
                    fontFamily: 'monospace',
                    lineHeight: '1.3',
                    textAlign: 'center',
                  }}>
                    Join us in Telegram!
                  </span>
                </div>
              </a>
            )} */}

            {/* CyberNav Menu - Show when toggled */}
            {/* <CyberNav
              is80sMode={context80sMode} 
              position="fixed"
              isOpen={showCyberNav}
              onClose={() => setShowCyberNav(false)}
              showButton={false}
            /> */}
            

          </>
        )}
      </div>
    </div>
    </>
  );
}
