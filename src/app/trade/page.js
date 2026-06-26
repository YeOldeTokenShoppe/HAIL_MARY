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
import LiveCaption from '@/components/LiveCaption';
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
import TickerDisplay3 from "@/components/TickerDisplay3";
import { useMusic } from '@/components/MusicContext';
import { useUser, useClerk } from "@clerk/nextjs";
import CyberNav from '@/components/CyberNav';
import NavControls from '@/components/NavControls';
import NavControlsMobile from '@/components/NavControlsMobile';
import MobileBottomNav from '@/components/MobileBottomNav';
import CoinLoader from '@/components/CoinLoader';
import MobileLobbyScene from '@/components/MobileLobbyScene';
import SynthSunset from '@/components/SynthSunset';
import BuyModal from '@/components/BuyModal';
import { useBuyModal } from '@/lib/useBuyModal';
import ReviewFunnel from '@/components/ReviewFunnel';
import ConsensusRibbon from '@/components/ConsensusRibbon';
import TradeServiceRail from '@/components/TradeServiceRail';
import ConfidenceVerdict from '@/components/ConfidenceVerdict';
import { CASE_FILES, SAMPLE_CASE, computeBrier, STATION_ORDER, pickReturnLine, pickVindicationKey, resolveLine, lensLabel, recordCaseResult, readSessionScore, sessionAvgBrier, sessionAccuracy } from '@/components/GameOverlay';
import CameraTuningPanel from '@/components/CameraTuningPanel';
import SitePalCropPanel from '@/components/SitePalCropPanel';
import { runDirectedTurn } from '@/lib/trade/beatRunner';
import { clipMenuForDirector, clipById } from '@/lib/trade/reactionBank';
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
        // console.log('[SitePal] preload complete');
        return;
      }
      const next = window.__sitePalPreloadQueue.shift();
      window.__sitePalSceneLoaded = false;
      try {
        if (typeof window.loadSceneByID === "function") {
          // console.log('[SitePal] preloading sceneID=', next);
          window.loadSceneByID(next);
        }
      } catch (e) {
        window.__sitePalPreloading = false;
      }
    };

    // Warm SitePal's audio cache for the just-loaded scene. loadAudio()
    // fetches+buffers the named track without playing it, so the first
    // sayAudio after a real click skips the cold fetch (~200–800ms saved
    // on the first per-character intro). Tracked in __sitePalLoadedAudio
    // so we don't re-fetch the same name on every scene re-enter.
    const preloadAudioForScene = (sceneId) => {
      if (typeof window === "undefined" || typeof window.loadAudio !== "function") return;
      const config = Object.values(SITEPAL_PROJECTION_CONFIG)
        .find((c) => c.sceneId === sceneId);
      const names = Array.isArray(config?.audioNames) ? config.audioNames : [];
      if (names.length === 0) return;
      const loaded = (window.__sitePalLoadedAudio ||= new Set());
      names.forEach((name) => {
        if (!name || loaded.has(name)) return;
        try {
          window.loadAudio(name);
          loaded.add(name);
        } catch (e) {}
      });
    };

    const clearSpeechRetryTimer = () => {
      if (window.__sitePalSpeechRetryTimer) {
        clearTimeout(window.__sitePalSpeechRetryTimer);
        window.__sitePalSpeechRetryTimer = null;
      }
    };

    const clearSpeechInitTimer = () => {
      if (window.__sitePalSpeechInitTimer) {
        clearTimeout(window.__sitePalSpeechInitTimer);
        window.__sitePalSpeechInitTimer = null;
      }
    };

    const clearActiveSpeech = () => {
      clearSpeechRetryTimer();
      clearSpeechInitTimer();
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
        // Re-assert interruptMode=1 right before sayAudio. setStatus is
        // also set in vh_sceneLoaded, but SitePal lives in a cross-origin
        // iframe and we can't observe its state — explicitly re-asserting
        // here is cheap and makes sure a new sayAudio interrupts whatever
        // is playing instead of being queued/overlaid.
        try {
          if (typeof window.setStatus === "function") {
            window.setStatus(1, 0, 0, 1, 0);
          }
        } catch (e) {}

        if (request.type === "audio" && request.audioName && typeof window.sayAudio === "function") {
          if (request.attempts === 1 && typeof window.loadAudio === "function") {
            try { window.loadAudio(request.audioName); } catch (e) {}
          }
          // console.log('[SitePal] sayAudio(', request.audioName, ') attempt=', request.attempts);
          result = window.sayAudio(request.audioName);
        } else if (request.type === "text" && request.text && typeof window.sayText === "function") {
          const voice = request.voice || "3";
          const lang = request.lang || 1;
          const engine = request.engine || 3;
          // console.log('[SitePal] sayText(', request.text, ') attempt=', request.attempts);
          if (request.effect !== undefined && request.effLevel !== undefined) {
            result = window.sayText(request.text, voice, lang, engine, request.effect, request.effLevel, request.xData1, request.xData2);
          } else {
            result = window.sayText(request.text, voice, lang, engine);
          }
        } else if (request.type === "scene" && typeof window.replay === "function") {
          // console.log('[SitePal] replay scene audio attempt=', request.attempts);
          result = window.replay();
        }

        if (result && typeof result === "object") {
          request.requestId = result.id || request.requestId;
          if (result.status !== 0) {
            console.warn("[SitePal] speech returned", result);
          }
        }

        clearSpeechRetryTimer();
        // Retry budget bumped from 1200ms → 3500ms because mobile (cellular
        // especially) often takes >1.2s to actually start sayAudio playback
        // on the longer recordings. The retry calls stopSpeech() before its
        // sayAudio, but on iOS stopSpeech doesn't reliably cancel an
        // already-buffered original, so a too-eager retry plays the same
        // audio twice with ~200ms offset.
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
        }, 3500);
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
      clearSpeechInitTimer();
      window.__sitePalActiveSpeech = request;
      // Track the init setTimeout so stopSitePalAudio can cancel a
      // pending sayAudio call that hasn't fired yet. SitePal's docs are
      // clear that stopSpeech() can't prevent "speech that has not yet
      // begun" — once this elapses, sayAudio runs and the audio buffers
      // and plays regardless of stopSpeech. So we cancel the timer
      // itself when the user moves on.
      //
      // Fast path: when the active scene is already loaded and matches
      // the request (no swap pending), use a 0ms timer instead of 160.
      // We still go through setTimeout so clearSpeechInitTimer can win
      // the race if the user clicks away mid-task. The 160ms gap is
      // preserved when a scene swap is in flight so SitePal has time
      // to settle interruptMode/volume after loadSceneByID.
      const sceneReady = window.__sitePalSceneLoaded === true
        && (!request.sceneId || request.sceneId === window.__sitePalCurrentSceneId);
      const initDelayMs = sceneReady ? 0 : 160;
      window.__sitePalSpeechInitTimer = setTimeout(() => {
        window.__sitePalSpeechInitTimer = null;
        runSpeechRequest(request, false);
      }, initDelayMs);
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
          // console.log('[SitePal vh_sceneLoaded] sceneID=',
          //   attrs && attrs.sceneID, 'audio=', attrs && attrs.audioName);
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
        preloadAudioForScene(window.__sitePalCurrentSceneId);
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
        // console.log('[SitePal] starting preload', window.__sitePalPreloadQueue);
        preloadAudioForScene(window.__sitePalCurrentSceneId);
        // Mute AND stopSpeech — the published scene has a bound audio
        // (`11devil1`) that SitePal auto-plays on embed load. setPlayerVolume(0)
        // alone leaves that audio queued in the AudioContext (suspended
        // pre-gesture), so it leaks out audibly on the user's first
        // click. stopSpeech kills it before the buffer can be queued
        // for resume. (Subsequent preload swaps already do this — only
        // the initial load was missing the stop.)
        if (typeof window.setPlayerVolume === "function") {
          try { window.setPlayerVolume(0); } catch (e) {}
        }
        if (typeof window.stopSpeech === "function") {
          try { window.stopSpeech(); } catch (e) {}
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
      // Consumer hook: lets the parent component react to actual audio
      // start (e.g., flip speechActive=true so text reveals fire in
      // lockstep with the voice). Wrapping vh_audioStarted from outside
      // is fragile because this assignment runs after the SitePal script
      // loads asynchronously and would clobber the wrap.
      if (typeof window.__onSitePalAudioStarted === 'function') {
        try { window.__onSitePalAudioStarted(audID, portal); } catch (e) {}
      }
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

    // Audio unlock for iOS/iPadOS. The previous one-shot `primed` flag
    // permanently disarmed after ANY first pointerdown — but on iPadOS
    // saySilent(0) doesn't actually unlock audio (zero-duration play),
    // so a stray early touch (scroll, dismiss) consumed the only attempt
    // and the actual START click did nothing. Now: keep attempting on
    // each gesture, with a real silent-buffer Web Audio play that DOES
    // unlock iOS, until the context is running.
    const resumeAudio = () => {
      try {
        // Kill any audio that SitePal queued before this gesture — most
        // notably the published Demon scene's bound `11devil1` greeting,
        // which auto-plays on embed load. The vh_sceneLoaded mute keeps
        // it silent until now, but resuming the AudioContext below
        // would otherwise release the queued buffer at full volume.
        // Runs in capture phase before any onClick handler, so a
        // legitimate Demon click still queues + plays the greeting
        // afterwards via activateSitePalProjection.
        //
        // Guard: skip this when a line is intentionally playing — otherwise
        // ANY tap (e.g. VIEW EVIDENCE) cuts the character off mid-sentence.
        // The stray auto-greeting plays before our speechActive is set, so
        // it's still silenced; only deliberate speech is spared.
        if (!speechActiveRef.current && typeof window.stopSpeech === "function") {
          try { window.stopSpeech(); } catch (e) {}
        }
        if (typeof window.saySilent === "function") window.saySilent(0);
        const Ctx = window.AudioContext || window.webkitAudioContext;
        const ctx = window.__rl80UnlockCtx || (Ctx ? new Ctx() : null);
        if (ctx) {
          window.__rl80UnlockCtx = ctx;
          if (ctx.state === "suspended" && typeof ctx.resume === "function") {
            ctx.resume().catch(() => {});
          }
          try {
            const src = ctx.createBufferSource();
            src.buffer = ctx.createBuffer(1, 1, 22050);
            src.connect(ctx.destination);
            src.start(0);
          } catch (e) {}
        }
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

// Debug probe — logs renderer.info (memory.textures, memory.geometries,
// render.calls, render.triangles) once a few seconds after first paint
// so we can see what's actually allocated on the GPU. Re-logs every
// 5s to catch growth over time. Remove or guard behind a debug flag
// once GPU memory is back under control.
function GpuMemoryProbe() {
  const loggedAtRef = useRef(0);
  useFrame((state) => {
    const now = performance.now();
    // First log at ~2s (lets the GLB finish loading), then every 5s.
    const interval = loggedAtRef.current === 0 ? 2000 : 5000;
    if (now - loggedAtRef.current < interval) return;
    loggedAtRef.current = now;
    const heapMB = typeof performance !== 'undefined' && performance.memory
      ? (performance.memory.totalJSHeapSize / 1048576).toFixed(1)
      : 'n/a';
    // console.log('[GPU]', {
    //   textures: state.gl.info.memory.textures,
    //   geometries: state.gl.info.memory.geometries,
    //   calls: state.gl.info.render.calls,
    //   triangles: state.gl.info.render.triangles,
    //   jsHeapMB: heapMB,
    // });
  });
  return null;
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

// Styling for the lobby "START …" action button. Mirrors the service-rail
// card language (dark translucent fill, accent border, glowing left strip,
// hover sheen sweep) so it reads as the "armed" sibling of the cards above
// it. The accent color is injected per-render via the `--sa` CSS variable.
const TSR_START_CSS = `
.tsr-start {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 9px;
  min-width: 248px;
  height: 56px;
  padding: 0 24px 0 26px;
  overflow: hidden;
  border: 1px solid color-mix(in srgb, var(--sa) 52%, rgba(140, 150, 170, 0.22));
  border-top-color: color-mix(in srgb, var(--sa) 82%, transparent);
  border-radius: 4px;
  background:
    linear-gradient(180deg,
      color-mix(in srgb, var(--sa) 18%, rgba(8, 10, 16, 0.6)),
      color-mix(in srgb, var(--sa) 5%, rgba(2, 3, 6, 0.55)));
  color: color-mix(in srgb, var(--sa) 26%, #ffffff);
  font-family: 'Orbitron', monospace;
  cursor: pointer;
  text-align: left;
  box-shadow:
    0 0 18px color-mix(in srgb, var(--sa) 30%, transparent),
    0 0 30px rgba(217, 45, 176, 0.16),
    inset 0 1px 0 rgba(255, 255, 255, 0.14),
    inset 0 -1px 0 rgba(0, 0, 0, 0.3);
  transition:
    border-color 180ms ease,
    background 180ms ease,
    box-shadow 180ms ease,
    transform 120ms ease;
}

/* Glowing left accent strip — same motif as .tsr-card::after. */
.tsr-start::after {
  content: "";
  position: absolute;
  left: 0;
  top: 6px;
  bottom: 6px;
  width: 5px;
  border-radius: 0 3px 3px 0;
  background: var(--sa);
  box-shadow:
    0 0 12px color-mix(in srgb, var(--sa) 75%, transparent),
    0 0 24px color-mix(in srgb, var(--sa) 35%, transparent);
}

/* Diagonal sheen that sweeps across on hover/focus. */
.tsr-start::before {
  content: "";
  position: absolute;
  inset: 0;
  pointer-events: none;
  opacity: 0;
  background: linear-gradient(120deg, transparent, color-mix(in srgb, var(--sa) 20%, transparent), transparent);
  transform: translateX(-70%);
  transition: opacity 200ms ease, transform 600ms ease;
}

.tsr-start:hover,
.tsr-start:focus-visible {
  border-color: color-mix(in srgb, var(--sa) 85%, white 6%);
  box-shadow:
    0 0 26px color-mix(in srgb, var(--sa) 42%, transparent),
    0 0 34px rgba(217, 45, 176, 0.2),
    inset 0 0 0 1px color-mix(in srgb, var(--sa) 42%, transparent);
  outline: none;
  transform: translateY(-1px);
}

.tsr-start:hover::before,
.tsr-start:focus-visible::before {
  opacity: 1;
  transform: translateX(70%);
}

.tsr-start:active {
  transform: translateY(0);
}

.tsr-start__eyebrow,
.tsr-start__label,
.tsr-start__chev {
  position: relative;
  z-index: 1;
}

.tsr-start__eyebrow {
  color: var(--sa);
  font-size: 9px;
  font-weight: 800;
  letter-spacing: 0.22em;
  text-shadow: 0 0 10px color-mix(in srgb, var(--sa) 55%, transparent);
}

.tsr-start__label {
  font-size: 13px;
  font-weight: 800;
  letter-spacing: 0.16em;
  text-shadow: 0 0 12px color-mix(in srgb, var(--sa) 45%, transparent);
}

.tsr-start__chev {
  margin-left: auto;
  font-size: 15px;
  color: var(--sa);
  text-shadow: 0 0 10px color-mix(in srgb, var(--sa) 60%, transparent);
  transition: transform 180ms ease;
}

.tsr-start:hover .tsr-start__chev,
.tsr-start:focus-visible .tsr-start__chev {
  transform: translateX(3px);
}
`;

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
// Monk's only live SitePal voice (Gilbert), used for sayText in the live turn.
const GILBERT = { voice: '9', lang: 1, engine: 7, effect: 'T', effLevel: 3 };

// Compact case summary handed to the director as caseContext.
function caseSummaryForDirector(c) {
  if (!c) return '';
  const m = c.surfaceMetrics || {};
  return `${c.projectName || 'Token'} (${c.ticker || ''}) on ${c.chain || 'chain'} — ${c.tagline || ''}. `
    + `Surface: age ${m.age || '?'}, mcap ${m.mcap || '?'}, holders ${m.holders || '?'}, 24h ${m.change24h || '?'}.`;
}

const STATION_TO_CHARACTER = Object.fromEntries(
  Object.entries(CHARACTER_TO_STATION).map(([agent, station]) => [station, agent])
);

const createEmptyAskedMap = () => Object.fromEntries(
  STATION_ORDER.map((stationKey) => [stationKey, new Set()])
);



// Read `?case=` from the URL so a specific case can be loaded directly,
// without having to play through prior cases first. Accepts:
//   ?case=case-002   — full id
//   ?case=002        — id suffix
//   ?case=2          — 1-based position in CASE_FILES
// Unknown or missing values fall back to the first case.
function pickInitialCaseIndex(caseFiles) {
  if (typeof window === 'undefined') return 0;
  const raw = new URLSearchParams(window.location.search).get('case');
  if (!raw) return 0;
  const trimmed = raw.trim().toLowerCase();
  const byId = caseFiles.findIndex((c) => c.id.toLowerCase() === trimmed);
  if (byId >= 0) return byId;
  const bySuffix = caseFiles.findIndex((c) => c.id.toLowerCase().endsWith(`-${trimmed}`));
  if (bySuffix >= 0) return bySuffix;
  const n = parseInt(trimmed, 10);
  if (Number.isFinite(n) && n >= 1 && n <= caseFiles.length) return n - 1;
  return 0;
}

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
  // Confirm dialog for leaving an in-progress case via the bottom-nav MENU
  // button. Without this, a single mistaken tap wipes asked/visitedStations/
  // verdict and dumps the player back to the service rail.
  const [showLeaveGameConfirm, setShowLeaveGameConfirm] = useState(false);
  // Token Review funnel — opened from TradeServiceRail's "Token Review" tile.
  // At this stage the funnel just builds a stub case object on Confirm; the
  // x402 paywall and live data layer land in subsequent passes.
  const [showReviewFunnel, setShowReviewFunnel] = useState(false);
  // Service-rail selection — drives both the active tile and the bottom
  // Start button's label/action.
  // 'game' = Token Task Force, 'analysis' = Token Review.
  const [selectedService, setSelectedService] = useState('game');
  // Lobby service-drawer open state. Lifted out of TradeServiceRail so the
  // center "START" button can reveal the menu — first-time visitors were
  // missing the slim edge handle.
  const [railExpanded, setRailExpanded] = useState(false);
  // Lobby "MORE" popover (right bottom-nav slot) — mirrors the shrine's MORE
  // menu so the bottom nav reads as one shared system across pages.
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  // Mobile: launching a case isn't wired yet (the clip player lands in a
  // later phase), so START shows a brief "coming soon" notice instead of
  // entering game mode (which needs the live scene we don't mount on mobile).
  const [mobileSoon, setMobileSoon] = useState(false);
  // Which modality the user has entered. null = lobby (no mode chosen).
  // 'game' = Liminal Terminal active → verdict buttons replace MENU in center.
  const [tradeMode, setTradeMode] = useState(null);
  // Tracks whether game mode is actively running.
  const [gameStarted, setGameStarted] = useState(false);
  // Liminal Terminal game state — lifted out of the old modal so the in-scene
  // UI can read/write it directly. Free case files live in GameOverlay for now;
  // when a loader exists, this index can become the current case id.
  const [currentCaseIndex, setCurrentCaseIndex] = useState(() => pickInitialCaseIndex(CASE_FILES));
  // Dropdown that lets the player (or dev) jump straight to any case from
  // the in-game HUD strip. Lives next to the project name display.
  const [caseMenuOpen, setCaseMenuOpen] = useState(false);
  const caseMenuRef = useRef(null);
  // Runtime-generated case from the Token Review service. When set, it
  // overrides the hand-authored case files; cleared by returnToServiceRail.
  // Identified at runtime by `correctVerdict == null` (reviews have no
  // ground truth; outcome resolves to 'abstained' regardless of verdict).
  const [reviewCase, setReviewCase] = useState(null);
  const caseData = reviewCase || CASE_FILES[currentCaseIndex] || SAMPLE_CASE;
  // Mirror caseData into a ref so the speech queue (whose useCallback
  // identity we don't want to invalidate every render) can read the
  // current station voice configs for TTS fallback in review mode.
  const caseDataRef = useRef(caseData);
  useEffect(() => { caseDataRef.current = caseData; }, [caseData]);
  // The Token Review service hands off a runtime-generated case. We
  // detect it via the presence of a reviewCase override OR (defensively)
  // a null correctVerdict on the active case data. Several UI surfaces
  // branch on this:
  //   • Bottom-nav center slot shows "READ TEAM VERDICT" instead of
  //     the Trust/Abstain/Doubt trio (the team renders the verdict,
  //     not the player).
  //   • Verdict ribbon renders the consensus meter instead of the
  //     player-grading layout.
  const isReviewMode = !!reviewCase || caseData?.correctVerdict == null;
  // Question-level tracking (model B): a scan = one question, 3 questions total
  // across all 4 characters. `asked` maps station key → Set of question indices.
  const [asked, setAsked] = useState(createEmptyAskedMap);
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

  // Queued next speech beat. Used to split the monk's first-visit rules
  // preamble from his intro line — rules render first; CONTINUE swaps in the
  // intro text. The audio for both is the single intro recording, which keeps
  // playing across the swap.
  const [pendingSpeech, setPendingSpeech] = useState(null);

  // True while the focused character is actively delivering a line (audio
  // playing or TTS in progress). Drives the 3D animation mode — idle while
  // speaking, typing in between — so the character looks like they're
  // looking up information between exchanges instead of just staring.
  // Cleared via a setTimeout estimated from text length (matches
  // ProgressiveText's reveal pace, ~70ms/char) — close enough to audio
  // duration for the visual handoff to feel right.
  const [speechActive, setSpeechActive] = useState(false);
  // Live mirror of speechActive for the document-level audio-unlock handler
  // (resumeAudio), which runs in a stable `[]` effect and can't read state
  // directly. Lets it skip the stray-greeting stopSpeech while a line is
  // intentionally playing, so a tap mid-line (e.g. VIEW EVIDENCE) doesn't cut
  // the character off.
  const speechActiveRef = useRef(false);
  useEffect(() => { speechActiveRef.current = speechActive; }, [speechActive]);
  const speechEndTimerRef = useRef(null);
  // Mobile-only: gates the inline CONTINUE button so it doesn't appear
  // until the player has actually heard the line (audio started AND
  // ended). Lets the speech-beat panel render compact during the
  // line — caption only — and grow when the player's turn arrives.
  // Reset on every new currentSpeech; flipped true by the speechActive
  // false→true→false transition, or by a length-based safety net if
  // audio never starts.
  const [speechReady, setSpeechReady] = useState(false);
  const hasHeardSpeechRef = useRef(false);
  // Audio follow-up queued for after the current line's audio ends.
  // Used for the monk's rules → intro chain (two separate recordings).
  // Cleared when consumed (audio-end handler or manual CONTINUE).
  const pendingAudioRef = useRef(null);
  // Tracks the audID of the most recently STARTED SitePal audio. Used to
  // gate `vh_audioEnded` so the queued chain only advances when the audio
  // that actually ended is the one we were waiting on. Without this, a
  // stale natural-end from a previous audio (e.g., the SitePal scene's
  // default sound finishing after we focus-switched and queued the
  // rules→intro chain) would prematurely swap the rules text → intro
  // text BEFORE the rules audio even gets a chance to start playing —
  // which presents as "GR80 speaks the rules but the intro transcript
  // appears." Reset whenever we explicitly stop SitePal audio.
  const lastStartedAudIDRef = useRef(null);
  // Charbudget stashed by speakLine for SitePal characters, consumed by
  // vh_audioStarted to arm the safety-net timer. We defer flipping
  // `speechActive` until the audio actually starts (rather than at
  // speakLine call time) so the text reveal lines up with the voice
  // instead of leading it by the camera-fly + SitePal-init delay.
  const pendingSpeechBudgetRef = useRef(0);
  // Mirror pendingSpeech into a ref so the wrapped vh_audio* callbacks
  // can read it without closure-staleness (the wrappers are installed
  // once at mount but need to see the latest pending text).
  const pendingSpeechRef = useRef(null);
  useEffect(() => {
    pendingSpeechRef.current = pendingSpeech;
  }, [pendingSpeech]);

  // Hook SitePal's audio-end / speech-end callbacks to clear `speechActive`
  // the moment the line actually finishes — much more accurate than the
  // text-length safety-net timer in `speakLine` (which can undershoot when
  // the audio file is longer than the displayed text, e.g. monk's first
  // visit). Wraps any pre-existing handler so we don't stomp other code.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const clearLocalSpeechActive = () => {
      setSpeechActive(false);
      if (speechEndTimerRef.current) {
        clearTimeout(speechEndTimerRef.current);
        speechEndTimerRef.current = null;
      }
    };
    // Advance the queued follow-up beat (e.g. monk's rules → intro)
    // when the current audio ends NATURALLY. Important: only hook this
    // off `vh_audioEnded` (the SitePal documented natural-end callback),
    // NOT `vh_audioStopped` / `vh_speechEnded` — those fire on any stop
    // including the `stopSpeech()` calls that runSpeechRequest uses to
    // clear the way before sayAudio. Hooking the wrong callback caused
    // the intro to chain on top of itself: stopSpeech fired during the
    // intro's own start sequence, re-entered advanceQueuedSpeech, and
    // launched a second intro alongside the first.
    const advanceQueuedSpeech = () => {
      const pending = pendingSpeechRef.current;
      const queuedAudio = pendingAudioRef.current;
      if (!pending && !queuedAudio) return;
      if (pending) {
        setCurrentSpeech(pending);
        setPendingSpeech(null);
      }
      if (queuedAudio) {
        pendingAudioRef.current = null;
        speakLine(queuedAudio.line, queuedAudio.stationKey, queuedAudio.options);
      }
    };
    const prevAudioStopped = window.vh_audioStopped;
    const prevSpeechEnded = window.vh_speechEnded;
    const prevAudioEnded = window.vh_audioEnded;
    // Register a hook on the SitePal pipeline's vh_audioStarted (see the
    // setter in the SitePal pipeline effect for the call site). Wrapping
    // window.vh_audioStarted directly doesn't survive — the pipeline
    // setter runs asynchronously after the SitePal script loads and
    // overwrites any wrap installed before it. The hook approach lets
    // us run logic from inside the canonical handler.
    const prevAudioStartedHook = window.__onSitePalAudioStarted;
    window.__onSitePalAudioStarted = (audID, portal) => {
      // Record which audio is now actually playing so vh_audioEnded can
      // tell a real natural-end of THIS audio apart from a stale event.
      if (audID) lastStartedAudIDRef.current = audID;
      // Audio just began — flip speechActive on now (not when speakLine
      // queued it ~1s ago) so the text reveal kicks off in lockstep
      // with the voice. Arm the safety-net here too so it counts down
      // from the actual audio start, not from the queue moment.
      setSpeechActive(true);
      if (speechEndTimerRef.current) {
        clearTimeout(speechEndTimerRef.current);
        speechEndTimerRef.current = null;
      }
      const charBudget = pendingSpeechBudgetRef.current || 0;
      if (charBudget > 0) {
        // Floor at 14s instead of 8s so multi-sentence intros with
        // dramatic pauses (audio routinely runs 11–14s) don't get the
        // safety net to chop them off mid-line. Per-line audioDurationMs
        // overrides could feed in here too if more precision is needed.
        const safetyMs = Math.max(14000, Math.min(90000, charBudget * 100));
        speechEndTimerRef.current = setTimeout(() => {
          setSpeechActive(false);
          speechEndTimerRef.current = null;
        }, safetyMs);
      }
      if (typeof prevAudioStartedHook === 'function') {
        try { prevAudioStartedHook(audID, portal); } catch (e) {}
      }
    };
    window.vh_audioStopped = function (audID, portal) {
      try { clearLocalSpeechActive(); } catch (e) {}
      if (typeof prevAudioStopped === 'function') {
        try { prevAudioStopped.call(this, audID, portal); } catch (e) {}
      }
    };
    window.vh_speechEnded = function (audID) {
      try { clearLocalSpeechActive(); } catch (e) {}
      if (typeof prevSpeechEnded === 'function') {
        try { prevSpeechEnded.call(this, audID); } catch (e) {}
      }
    };
    window.vh_audioEnded = function (audID, portal) {
      // Only advance the chain if this end-event matches the audio that
      // actually started playing most recently. Stale events (e.g., a
      // previous scene's default audio ending after focus-switch) would
      // have a mismatched or missing audID and must NOT advance the
      // queue — otherwise the chain swaps rules text → intro text
      // before the rules audio even gets to start, presenting as
      // "speaks the rules but the intro transcript appears."
      const matches = audID && lastStartedAudIDRef.current === audID;
      if (matches) {
        lastStartedAudIDRef.current = null;
        try { advanceQueuedSpeech(); } catch (e) {}
      }
      if (typeof prevAudioEnded === 'function') {
        try { prevAudioEnded.call(this, audID, portal); } catch (e) {}
      }
    };
    return () => {
      window.__onSitePalAudioStarted = prevAudioStartedHook;
      window.vh_audioStopped = prevAudioStopped;
      window.vh_speechEnded = prevSpeechEnded;
      window.vh_audioEnded = prevAudioEnded;
    };
  }, []);

  // GR80 delivers a one-time rules speech prepended to his intro on the player's
  // first-ever monk visit this session. Skipped on subsequent cases.
  const rulesSpokenRef = useRef(false);

  // Cross-session: once the rules have played end-to-end (or been skipped),
  // skip the rules preamble AND the GR80 attract loop on future visits.
  // Version the key so future rule changes can force a replay.
  const RULES_HEARD_KEY = 'rl80_rules_heard_v1';
  const [rulesHeard, setRulesHeard] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      if (window.localStorage.getItem(RULES_HEARD_KEY) === '1') {
        setRulesHeard(true);
      }
    } catch (e) {}
  }, []);
  const markRulesHeard = useCallback(() => {
    setRulesHeard(true);
    try { window.localStorage.setItem(RULES_HEARD_KEY, '1'); } catch (e) {}
  }, []);
  const replayRules = useCallback(() => {
    try { window.localStorage.removeItem(RULES_HEARD_KEY); } catch (e) {}
    setRulesHeard(false);
    rulesSpokenRef.current = false;
    // Drop monk from visitedStations so the first-visit branch (which carries
    // the rules preamble) fires again next time he's focused.
    setVisitedStations((prev) => {
      const next = new Set(prev);
      next.delete('monk');
      return next;
    });
    // If the user is currently on monk, drop focus so re-focusing triggers
    // the first-visit speech effect. Otherwise leave focus alone.
    if (focusedAgent === 'Monk') {
      try { if (typeof window.stopSpeech === 'function') window.stopSpeech(); } catch (e) {}
      setCurrentSpeech(null);
      setPendingSpeech(null);
      setFocusedAgent(null);
    }
  }, [focusedAgent]);

  // Reset speechReady when the active beat changes. Also arms a length-based
  // safety net so CONTINUE eventually appears even if SitePal audio is denied
  // (iOS silent mode, missing recording, etc) — without it the panel would
  // sit caption-only forever.
  useEffect(() => {
    setSpeechReady(false);
    hasHeardSpeechRef.current = false;
    if (!currentSpeech) return;
    const text = currentSpeech.text || '';
    // Generous budget: ~100ms/char + 4s buffer, floored at 10s. Audio normally
    // ends before this and flips speechReady via the speechActive effect; this
    // only fires if the audio path failed entirely.
    const fallbackMs = Math.max(10000, text.length * 100 + 4000);
    const t = setTimeout(() => setSpeechReady(true), fallbackMs);
    return () => clearTimeout(t);
  }, [currentSpeech]);

  // Drive speechReady from the audio lifecycle: mark "started" while audio
  // is playing, then flip ready true on the next transition to false.
  useEffect(() => {
    if (speechActive) {
      hasHeardSpeechRef.current = true;
      return;
    }
    if (hasHeardSpeechRef.current) {
      setSpeechReady(true);
    }
  }, [speechActive]);

  // Auto-advance from the current speech beat to any queued follow-up when
  // the visual reveal of the current text finishes. The audio for split beats
  // (e.g. monk's rules → intro) is one continuous recording, so without this
  // the audio sails into the next section while the player still sees the
  // first section's text until they click CONTINUE.
  useEffect(() => {
    if (!currentSpeech || !pendingSpeech) return;
    // When audio chaining is queued (e.g. monk's rules → intro, two
    // separate recordings), let the audio-end callback drive the swap
    // so text and audio stay in lockstep. The text-paced timer below
    // is the legacy fallback for cases where audio ends aren't wired.
    if (pendingAudioRef.current) return;
    const text = currentSpeech.text || '';
    const chunks = text.match(/[^.!?—]+[.!?—]+\s*|[^.!?—]+$/g) || [text];
    // Mirrors ProgressiveText's pacing: ~70ms/char with a 2200ms floor per
    // chunk (raised from 900→1500→2200 so short chunks like Barron's
    // "Cheaply. Loudly. Badly." don't outrun the audio). Slight lead so
    // the swap lands just before the next audio sentence starts,
    // avoiding a beat of stale text on screen.
    let revealMs = 0;
    chunks.forEach((c) => { revealMs += Math.max(2200, c.length * 70); });
    revealMs = Math.max(0, revealMs - 200);
    const t = setTimeout(() => {
      setCurrentSpeech(pendingSpeech);
      setPendingSpeech(null);
    }, revealMs);
    return () => clearTimeout(t);
  }, [currentSpeech, pendingSpeech]);
  const [verdict, setVerdict] = useState(null);
  // Live four-voice turn (option A): gated by ?live=free|paid. 'off' keeps the
  // legacy single recorded reaction. liveTurnRef suppresses the reveal driver
  // while the argument plays.
  const liveTier = useMemo(() => {
    if (typeof window === 'undefined') return 'off';
    const p = (new URLSearchParams(window.location.search).get('live') || '')
      .toLowerCase().replace(/[^a-z]/g, ''); // tolerate stray punctuation (e.g. a trailing comma)
    return p === 'paid' || p === 'free' ? p : 'off';
  }, []);
  const liveTurnRef = useRef(false);
  // Paid live argument is playing in the curtain-call lineup (no outcome shown yet).
  const [councilActive, setCouncilActive] = useState(false);
  const [brier, setBrier] = useState(null);
  // The player's committed P(scam) from the confidence slider (0..1), or null
  // for review mode / team verdicts. Drives the Brier score and the reveal HUD.
  const [confidence, setConfidence] = useState(null);
  // Running session scorecard (avg Brier, accuracy, streak) persisted in
  // localStorage. Snapshotted on each graded commit so the reveal ribbon can
  // show the updated totals; refreshed from storage when the game (re)starts.
  const [sessionScore, setSessionScore] = useState(null);
  // Load the persisted scorecard on the client only (avoids an SSR/hydration
  // mismatch — readSessionScore returns an empty card on the server).
  useEffect(() => { setSessionScore(readSessionScore()); }, []);
  // Staged reveal for the verdict modal so the reaction audio and the
  // vindication audio land on visually distinct beats:
  //   null       — modal hidden
  //   'weighing' — verdict locked; "weighing evidence" pulse; reaction plays
  //   'reveal'   — icon + ground truth + grade fade in; silent pause
  //   'vindicate'— vindication audio + final card row + buttons
  const [revealPhase, setRevealPhase] = useState(null);
  // Derived: total questions asked across all stations, and what remains.
  // Token Review service lifts the cap — the team has already composed
  // their full read, so the player should be able to drill into any
  // character without budgeting questions. Forensic cases (case-001/002/003)
  // keep the 3-scan rule since the cap is part of the calibration game.
  const scansUsed = Object.values(asked).reduce((n, set) => n + set.size, 0);
  const scansRemaining = (reviewCase || caseData?.correctVerdict == null)
    ? Infinity
    : Math.max(0, caseData.maxScans - scansUsed);
  // First-case tutorial gate: case-001 requires the player to start with
  // GR80/ETHOS (the Monk) so he can deliver the rules audio. The other
  // consultant buttons stay locked until the player either taps Monk this
  // session OR the rules have been heard in a prior session (rulesHeard
  // persists in localStorage). Only applies to the first case AND only in
  // game mode — the lobby is meant to be freely explorable so the player
  // can meet all four characters before committing to play. (Also: the
  // gate's resolution paths — markRulesHeard and the visitedStations add
  // for Monk — only run inside the game-mode speech effect, so leaving the
  // gate active in the lobby permanently locks out the other characters
  // until the player enters the game on this device.)
  const mustStartWithMonk =
    tradeMode === 'game' &&
    caseData.id === 'case-001' &&
    !rulesHeard &&
    !visitedStations.has('monk');
  // Gate the scan-counter "punch" animation by 3s after entering game mode
  // (when the counter first mounts), so the initial pop doesn't fire
  // instantly on Start Token Task Force. Subsequent tick-down pops (via
  // key={remaining}) fire instantly once this is true. Resets when the
  // player leaves game mode so the next session re-arms the delay.
  const [scanPunchArmed, setScanPunchArmed] = useState(false);
  useEffect(() => {
    if (tradeMode !== 'game') {
      setScanPunchArmed(false);
      return;
    }
    setScanPunchArmed(false);
    const t = setTimeout(() => setScanPunchArmed(true), 6000);
    return () => clearTimeout(t);
  }, [tradeMode]);
  // Derived: stations with at least one asked question. Used by the reveal
  // modal's "scans used" indicator and by tab/portrait state styling later.
  const investigated = useMemo(() => {
    const s = new Set();
    Object.entries(asked).forEach(([k, set]) => { if (set.size > 0) s.add(k); });
    return s;
  }, [asked]);
  const enterGameMode = () => {
    // iOS/iPadOS Safari blocks audio that isn't triggered synchronously
    // from a user gesture. START is a real click, so use this window to
    // unlock both audio paths the app uses:
    //   (1) Web Audio API — play a 1-frame silent buffer to flip the
    //       AudioContext to 'running' state.
    //   (2) SitePal — call saySilent(0) AND set volume so the very next
    //       speakLine (which fires from a useEffect outside gesture
    //       context) plays. Without this, character intros stay silent
    //       on tablet until some later in-gesture speakLine (e.g. the
    //       verdict reaction from the Doubt button) does the unlock.
    try {
      if (typeof window !== 'undefined') {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (Ctx) {
          const ctx = window.__rl80UnlockCtx || new Ctx();
          window.__rl80UnlockCtx = ctx;
          if (ctx.state === 'suspended' && typeof ctx.resume === 'function') {
            ctx.resume().catch(() => {});
          }
          const src = ctx.createBufferSource();
          src.buffer = ctx.createBuffer(1, 1, 22050);
          src.connect(ctx.destination);
          src.start(0);
        }
        window.__sitePalDesiredVolume = 7;
        if (typeof window.setPlayerVolume === 'function') {
          try { window.setPlayerVolume(7); } catch (e) {}
        }
        if (typeof window.saySilent === 'function') {
          try { window.saySilent(0); } catch (e) {}
        }
      }
    } catch (e) {}

    setTradeMode('game');
    setGameStarted(true);
    setCurrentCaseIndex(0);
    setReviewCase(null);
    setAsked(createEmptyAskedMap());
    setVisitedStations(new Set());
    setActiveAnswer(null);
    setActiveReaction(null);
    rulesSpokenRef.current = false;
    setVerdict(null);
    setBrier(null);
    setConfidence(null);
    setRevealPhase(null);
  };
  // Token Review entry — same reset shape as enterGameMode, but the case
  // body comes from the generated reviewCase instead of the CASE_FILES
  // array. tradeMode stays as 'game' so the entire game UI (HUD, question
  // panel, EvidenceScreens, verdict ribbon) lights up unchanged; the
  // review identity is implicit in caseData.correctVerdict being null.
  const enterReviewMode = (reviewCaseObj) => {
    if (!reviewCaseObj) return;
    setReviewCase(reviewCaseObj);
    setTradeMode('game');
    setGameStarted(true);
    setAsked(createEmptyAskedMap());
    setVisitedStations(new Set());
    setActiveAnswer(null);
    setActiveReaction(null);
    rulesSpokenRef.current = true; // skip rules on reviews — players got them in forensics
    setVerdict(null);
    setBrier(null);
    setConfidence(null);
    setRevealPhase(null);
  };
  const returnToServiceRail = () => {
    setTradeMode(null);
    setGameStarted(false);
    setReviewCase(null);
    // Clear post-game state so the vindication useEffect doesn't refire when
    // the player focuses a new character in the lobby (focusedAgent change
    // would recompute vindicationDelivery against the stale verdict and
    // schedule the wrong line ~1.8s later).
    setVerdict(null);
    setBrier(null);
    setConfidence(null);
    setRevealPhase(null);
    setActiveAnswer(null);
    setActiveReaction(null);
    setCurrentSpeech(null);
    setPendingSpeech(null);
    // Drop focus so the camera unlocks and TradeServiceRail can render
    // (it's gated on `!focusedAgent`).
    setFocusedAgent(null);
  };

  // Curtain-call reveal mode for the 3D scene. Engages during the 'reveal'
  // and 'vindicate' phases so the blackout-and-stage transition lands on
  // the dramatic beat (after the focused character's reaction). Maps the
  // verdict against ground truth: aligned / missed / abstained.
  const revealMode = useMemo(() => {
    // Paid live argument: line the four up (props hidden, wide shot) WITHOUT
    // revealing the outcome. 'council' isn't an outcome key, so the reveal
    // effect stages the lineup but plays no spoiler reaction.
    if (councilActive) return 'council';
    if (!verdict) return null;
    if (revealPhase !== 'reveal' && revealPhase !== 'vindicate') return null;
    if (verdict === 'abstain') return 'abstained';
    // Token Review cases carry no ground truth — every outcome falls
    // through to 'abstained' so the verdict screen stays neutral (no
    // phantom right/wrong grading against a non-existent answer key).
    if (caseData.correctVerdict == null) return 'abstained';
    return verdict === caseData.correctVerdict ? 'aligned' : 'missed';
  }, [councilActive, verdict, revealPhase, caseData.correctVerdict]);

  // Forceful stop for SitePal audio. Per the SitePal docs, stopSpeech()
  // only halts audio that's currently speaking — it "does not prevent
  // speech that has not yet begun." So our biggest leak was the 160ms
  // init setTimeout inside speakPending: that scheduled sayAudio call
  // fires regardless of how many stopSpeech() invocations land before
  // it, and the resulting audio plays over whatever new line we kicked
  // off afterward. The fix is to cancel that init timer + the retry
  // timer here (the speakPending code stores them as window globals
  // specifically so we can reach in). Then we still call stopSpeech()
  // for any audio that DID start, and pause DOM <audio> elements as a
  // belt-and-suspenders fallback for platforms where stopSpeech misses
  // an HTMLAudioElement that's mid-buffer.
  const stopSitePalAudio = useCallback(() => {
    let initTimerCleared = false;
    let retryTimerCleared = false;
    let domAudiosPaused = 0;
    // Drop the tracked "last started" audID — if stopSpeech misses an
    // already-started audio that ends naturally moments later, we don't
    // want vh_audioEnded to treat it as the chain's expected source.
    lastStartedAudIDRef.current = null;
    try {
      if (typeof window !== 'undefined') {
        if (window.__sitePalSpeechInitTimer) {
          clearTimeout(window.__sitePalSpeechInitTimer);
          window.__sitePalSpeechInitTimer = null;
          initTimerCleared = true;
        }
        if (window.__sitePalSpeechRetryTimer) {
          clearTimeout(window.__sitePalSpeechRetryTimer);
          window.__sitePalSpeechRetryTimer = null;
          retryTimerCleared = true;
        }
        window.__sitePalPendingSpeech = null;
        window.__sitePalActiveSpeech = null;
      }
    } catch (e) {}
    try {
      if (typeof window !== 'undefined' && typeof window.stopSpeech === 'function') {
        window.stopSpeech();
      }
    } catch (e) {}
    try {
      if (typeof document === 'undefined') return;
      const musicAudio = (typeof window !== 'undefined' && window.__globalAudioInstance)
        ? window.__globalAudioInstance.audio
        : null;
      const pauseAudio = (a) => {
        if (a === musicAudio) return; // never touch the music
        try {
          if (!a.paused) {
            a.pause();
            try { a.currentTime = 0; } catch (e) {}
            domAudiosPaused += 1;
          }
        } catch (e) {}
      };
      document.querySelectorAll('audio').forEach(pauseAudio);
      // Same-origin iframes too (SitePal sometimes nests its audio there).
      document.querySelectorAll('iframe').forEach((frame) => {
        try {
          const doc = frame.contentDocument || frame.contentWindow?.document;
          if (!doc) return;
          doc.querySelectorAll('audio').forEach(pauseAudio);
        } catch (e) {
          // cross-origin — can't reach in; nothing we can do
        }
      });
    } catch (e) {}
    // console.log('[stopSitePalAudio]', {
    //   initTimerCleared,
    //   retryTimerCleared,
    //   domAudiosPaused,
    //   sitepalAudiosFound: typeof document !== 'undefined' ? document.querySelectorAll('audio').length : 0,
    //   iframesFound: typeof document !== 'undefined' ? document.querySelectorAll('iframe').length : 0,
    // });
  }, []);

  // Hook for the post-verdict "NEXT CASE" button. These first files are the
  // free training ladder; premium case loading can replace this array later.
  const nextCaseAvailable = currentCaseIndex < CASE_FILES.length - 1;
  // Reset every per-case piece of state and load `index`. Used by both the
  // NEXT CASE button and the case-picker dropdown in the HUD strip.
  const jumpToCase = (index) => {
    if (index < 0 || index >= CASE_FILES.length) return;
    setCurrentCaseIndex(index);
    setAsked(createEmptyAskedMap());
    setVisitedStations(new Set());
    setVerdict(null);
    setBrier(null);
    setConfidence(null);
    setRevealPhase(null);
    setActiveAnswer(null);
    setActiveReaction(null);
    setEugeneBubble(null);
    setCurrentSpeech(null);
    setPendingSpeech(null);
    setFocusedAgent(null);
    rulesSpokenRef.current = true;
  };
  const advanceToNextCase = () => {
    if (!nextCaseAvailable) return;
    jumpToCase(currentCaseIndex + 1);
  };

  // Close the case-picker dropdown when the player clicks/taps outside it.
  useEffect(() => {
    if (!caseMenuOpen) return;
    const handler = (e) => {
      if (caseMenuRef.current && !caseMenuRef.current.contains(e.target)) {
        setCaseMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('touchstart', handler);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('touchstart', handler);
    };
  }, [caseMenuOpen]);
  // Derive the overlay's active station from focusedAgent when in game mode.
  // Falls back to 'monk' (the opener) so the overlay renders something stable
  // before the player has clicked any character.
  const gameActiveStation =
    (focusedAgent && CHARACTER_TO_STATION[focusedAgent]) || 'monk';
  const gameStation = caseData.stations[gameActiveStation];

  // Speech helper: routes a case-data dialogue value (string or `{text, audio}`)
  // through SitePal's pending-speech queue and `runSpeechRequest` retry path —
  // same pipeline the working lobby "meet" line uses.
  //
  // TTS fallback was REMOVED — pre-recorded audio is the only voice path now.
  // Reasons: real-time TTS via `sayText` caused several recurring problems
  // (em-dash 503s from Acapela engine 1, mismatched voice IDs across (engine,
  // lang) combos, CORS preflight noise on tts/genC.php). Lines without an
  // `audio` field are now silent — speechActive still flips on (so the
  // character cross-fades to idle for the estimated duration) and the text
  // still reveals in the widget, but no SitePal call is made. This keeps the
  // dev flow clean during the recording phase: as each line's audio lands in
  // the case data, it just starts playing.
  //
  // Eugene is text-only (no SitePal scene) — her lines surface as an HTML chat
  // bubble. The bubble persists until the player proceeds (asks another
  // question / CONTINUE / switches consultant); no time-based auto-dismiss.
  const speakLine = useCallback((line, stationKey, options) => {
    const resolved = resolveLine(line);
    if (!resolved || !resolved.text) return;

    // Flip the focused character to idle (looking at camera) for the
    // estimated duration of this line. SitePal's vh_audioStopped /
    // vh_speechEnded callbacks (wired below) clear `speechActive` as soon
    // as the actual audio ends — this setTimeout is a safety net only,
    // so we make it generous. Caller may pass an explicit estimatedChars
    // when the spoken audio differs from `resolved.text` (e.g. monk's
    // first-visit recording contains rules + intro, but `intro.text` only
    // has the intro proper — using just text.length would undershoot and
    // flip back to typing mid-speech).
    if (speechEndTimerRef.current) {
      clearTimeout(speechEndTimerRef.current);
      speechEndTimerRef.current = null;
    }
    const charBudget = options?.estimatedChars ?? resolved.text.length;

    if (stationKey === 'eugene') {
      // Eugene has no SitePal audio — flip speechActive immediately so
      // her bubble's typing animation and the safety-net timer start
      // right away.
      setSpeechActive(true);
      const safetyMs = Math.max(8000, Math.min(90000, charBudget * 100));
      speechEndTimerRef.current = setTimeout(() => {
        setSpeechActive(false);
        speechEndTimerRef.current = null;
      }, safetyMs);
      setEugeneBubble(resolved.text);
      return;
    }

    // SitePal characters: stash the budget so the vh_audioStarted wrap
    // can flip speechActive=true and arm the safety net the moment audio
    // actually begins playing. Without this deferral, speechActive flips
    // here (~900ms before audible start) and the text reveal races
    // ahead of the voice by the camera-fly + SitePal-init delay.
    pendingSpeechBudgetRef.current = charBudget;
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

      // No `audio` field → no pre-recorded line. Two sub-paths:
      //   • Station has a `voice` config (review mode for monk/demon/
      //     marisol) → push a sayText request through the SitePal
      //     queue so the character actually speaks the LLM text.
      //   • Station has no voice config (recorded case files where a
      //     line is still pending recording) → silent placeholder
      //     animation only; just flip speechActive + arm the safety
      //     timer so the on-screen reveal still runs.
      if (!resolved.audio) {
        const station = caseDataRef.current?.stations?.[stationKey];
        const voiceCfg = station?.voice;
        const voice = typeof voiceCfg === 'string' ? voiceCfg : voiceCfg?.voice;
        const lang = typeof voiceCfg === 'object' ? voiceCfg?.lang : undefined;
        const engine = typeof voiceCfg === 'object' ? voiceCfg?.engine : undefined;
        // Optional SitePal sayText voice FX (e.g. reverb) carried on the voice
        // config as { effect, effLevel }. Only affects the TTS fallback —
        // uploaded recordings (sayAudio, incl. ElevenLabs) are unaffected.
        const effect = typeof voiceCfg === 'object' ? voiceCfg?.effect : undefined;
        const effLevel = typeof voiceCfg === 'object' ? voiceCfg?.effLevel : undefined;

        if (voice) {
          const speech = {
            type: 'text',
            text: resolved.text,
            voice,
            lang,
            engine,
            effect,
            effLevel,
          };
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
          // speechActive is flipped on by the vh_audioStarted callback
          // once SitePal actually begins playback. The text branch
          // shares that callback path with the audio branch.
          return;
        }

        // Silent fallback (no voice config, no recording). Mirrors the
        // Eugene branch above so reveal animations still tick.
        setSpeechActive(true);
        const safetyMs = Math.max(4000, Math.min(60000, charBudget * 70));
        speechEndTimerRef.current = setTimeout(() => {
          setSpeechActive(false);
          speechEndTimerRef.current = null;
        }, safetyMs);
        return;
      }
      const speech = { type: 'audio', audioName: resolved.audio };

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

  // Live-turn glue: a speaker for the beat runner that goes through the SAME
  // focus → speakLine pipeline a player click uses (so SitePal scene swaps and
  // auto-greeting suppression behave), and resolves when the line ends.
  const focusedAgentRef = useRef(null);
  useEffect(() => { focusedAgentRef.current = focusedAgent; }, [focusedAgent]);

  const waitForSpeechEnd = useCallback((text) => new Promise((resolve) => {
    let started = false;
    const t0 = Date.now();
    const max = Math.min(30000, Math.max(6000, String(text || '').length * 90 + 1500));
    const iv = setInterval(() => {
      const active = speechActiveRef.current;
      if (active) started = true;
      if ((started && !active) || Date.now() - t0 > max) {
        clearInterval(iv);
        resolve();
      }
    }, 120);
  }), []);

  const speakBeat = useCallback((characterId, speech) => {
    const stationKey = CHARACTER_TO_STATION[characterId];
    if (!stationKey) return Promise.resolve();
    // Focus the speaker so the scene swaps the proper (player-click) way.
    // No-op when they're already focused — which is the free-tier Monk case,
    // so no re-focus, no intro, no collision.
    if (focusedAgentRef.current !== characterId) setFocusedAgent(characterId);
    const line = speech.type === 'audio'
      ? { audio: speech.audioName, text: speech.text }
      : { text: speech.text };
    speakLine(line, stationKey);
    return waitForSpeechEnd(speech.text);
  }, [speakLine, waitForSpeechEnd]);

  // Council speaker (paid lineup) — plays through the pipeline on the CURRENTLY
  // loaded scene (no swap, no focus, no auto-greeting), so all four can speak in
  // the wide shot with audio + caption while nobody's face is projected. Monk
  // carries Gilbert's voice for live TTS; Demon/Detective play their clip.
  const speakCouncil = useCallback((characterId, speech) => {
    if (typeof window === 'undefined') return Promise.resolve();
    const sceneId = window.__sitePalCurrentSceneId; // current scene — do not swap
    const full = speech.type === 'text' ? { ...speech, ...GILBERT } : speech;
    try {
      window.__sitePalPendingSpeech = { characterId, sceneId, speech: full };
      if (typeof window.__sitePalSpeakPending === 'function') window.__sitePalSpeakPending(null);
    } catch (e) {
      console.warn('[council speak] failed', e);
    }
    return waitForSpeechEnd(speech.text);
  }, [waitForSpeechEnd]);

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
    // Cut the previous character's in-flight audio synchronously. Without
    // this, switching mid-line lets the old audio keep playing for the
    // ~900ms camera-fly delay + another ~160ms before runSpeechRequest's
    // own stopSpeech fires — long enough to overlap the new character's
    // intro. Also clear the safety-net timer + speechActive so the old
    // speech is fully torn down.
    stopSitePalAudio();
    if (speechEndTimerRef.current) {
      clearTimeout(speechEndTimerRef.current);
      speechEndTimerRef.current = null;
    }
    setSpeechActive(false);

    // Clear any prior answer / speech beat when switching to a new character.
    // Also clear Eugene's persistent bubble if she's no longer focused, so
    // revisiting her later doesn't flash the previous line before her new
    // intro/return fires. The queued follow-up audio (e.g. monk's intro
    // chained after rules) is also dropped so a mid-rules switch doesn't
    // resurrect monk's intro inside the new character's beat.
    setActiveAnswer(null);
    setCurrentSpeech(null);
    setPendingSpeech(null);
    pendingAudioRef.current = null;
    if (stationKey !== 'eugene') {
      setEugeneBubble(null);
    }

    // Compute the spoken line + display text SYNCHRONOUSLY so the question
    // list is hidden the moment the player focuses a character. Previously
    // currentSpeech was set inside the 900ms camera-fly timer, which left
    // the question list briefly visible during the fly-in.
    const isFirstVisit = !visitedStations.has(stationKey);
    // If the player has already spent a scan elsewhere, they've effectively
    // started the game — playing monk's full intro (which has the rules audio
    // baked in) at that point would dump 30 seconds of orientation on top of
    // an in-progress run. Treat first-visit-after-scans as a return.
    const isMidGameMonkFirstVisit =
      isFirstVisit && stationKey === 'monk' && scansUsed > 0;
    let toSpeak = null;
    let displayText = '';
    let kind = 'intro';
    if (isFirstVisit && !isMidGameMonkFirstVisit) {
      setVisitedStations((prev) => {
        const next = new Set(prev);
        next.add(stationKey);
        return next;
      });
      // Rules preamble: monk speaks them once on his first visit. The rules
      // and intro now live in SEPARATE recordings (`case001_monk_rules` +
      // `case001_monk_intro`) so that subsequent sessions can skip the
      // rules audio entirely when `rulesHeard` is true. The rules audio
      // plays first; the audio-end handler in this file picks up the
      // queued intro audio + swaps the displayed text when rules ends.
      const introLine = station.intro;
      const introResolved = resolveLine(introLine);
      const introText = introResolved?.text || '';
      toSpeak = introLine;
      displayText = introText;
      if (stationKey === 'monk' && !rulesSpokenRef.current && !rulesHeard && caseData.rulesIntro) {
        rulesSpokenRef.current = true;
        const rulesResolved = resolveLine(caseData.rulesIntro);
        const rulesText = rulesResolved?.text || '';
        if (rulesText) {
          displayText = rulesText;
          setPendingSpeech({
            stationKey,
            text: introText,
            kind: 'intro',
            audioDurationMs: introResolved?.audioDurationMs || null,
          });
          if (rulesResolved?.audio) {
            // Two-track path: play rules audio now, queue intro audio
            // for the audio-end handler to chain. speakLine receives
            // `caseData.rulesIntro` (the object) so the rules audio
            // fires; the intro is queued via the audio ref.
            toSpeak = caseData.rulesIntro;
            pendingAudioRef.current = {
              line: introLine,
              stationKey,
              options: introText ? { estimatedChars: introText.length } : undefined,
            };
          } else if (!introResolved?.audio) {
            // No-audio fallback (e.g. during dev before recording): TTS
            // path concats rules + intro into a single sayText call.
            toSpeak = `${rulesText} ${introText}`.trim();
          }
          // Persist across sessions so the rules preamble + attract loop
          // don't fire on subsequent visits. `replayRules` clears this.
          markRulesHeard();
        }
      }
    } else {
      // Mark visited on the mid-game monk path too, otherwise next visit
      // would re-trigger first-visit logic and play the rules.
      if (isMidGameMonkFirstVisit) {
        setVisitedStations((prev) => {
          const next = new Set(prev);
          next.add(stationKey);
          return next;
        });
        // Burn the rules flag so even a hypothetical re-entry won't try to
        // play them again.
        rulesSpokenRef.current = true;
      }
      const ret = pickReturnLine(station);
      if (ret) {
        toSpeak = ret;
        displayText = resolveLine(ret)?.text || '';
        kind = 'return';
      }
    }

    // Eugene's dialog is rendered exclusively in her floating chat bubble
    // (speakLine sets eugeneBubble for her). Skip currentSpeech for her so
    // the bottom transcript doesn't duplicate the same line.
    // Pull the audioDurationMs of whichever line drives the CURRENT
    // displayed text (rules first if the chain fires, otherwise intro
    // or return). Lets ProgressiveText/LiveCaption pace the reveal to
    // the actual audio length rather than the char-count fallback.
    let displayAudioDurationMs = null;
    if (toSpeak) {
      const toSpeakResolved = resolveLine(toSpeak);
      displayAudioDurationMs = toSpeakResolved?.audioDurationMs || null;
    }
    if (displayText && stationKey !== 'eugene') {
      setCurrentSpeech({ stationKey, text: displayText, kind, audioDurationMs: displayAudioDurationMs });
    }

    // Audio plays after a short delay so the camera fly-in lands first.
    // The text reveal starts immediately (above) — at ~70ms/char it'll
    // run slightly ahead of the recorded audio, but for the long intros
    // they re-converge by the middle of the paragraph.
    // We pass `displayText.length` as the speech-active safety-net budget
    // so monk's first-visit audio (rules+intro combined) doesn't undershoot
    // and flip the character back to typing mid-speech.
    const speakOptions = displayText
      ? { estimatedChars: displayText.length }
      : undefined;
    const t = setTimeout(() => {
      if (toSpeak) speakLine(toSpeak, stationKey, speakOptions);
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
    // Cut any in-flight audio synchronously before the new line starts —
    // covers the case where the player taps a question while the intro
    // (or a previous answer's audio) is still playing.
    stopSitePalAudio();
    if (speechEndTimerRef.current) {
      clearTimeout(speechEndTimerRef.current);
      speechEndTimerRef.current = null;
    }
    setSpeechActive(false);
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

  // Token Review path — the four characters render their own verdicts
  // via the LLM pipeline; the player just opens the report. Skips the
  // weighing → reveal → vindicate state machine (no character reaction
  // to play since the player didn't choose anything) and jumps straight
  // to 'vindicate' so the consensus ribbon renders immediately.
  const revealTeamVerdict = () => {
    if (verdict) return;
    // Stash the team's plurality leaning as the "verdict" so the existing
    // gating on `verdict` flips the ribbon on. Defaults to 'abstain' if
    // somehow the consensus block is missing.
    const teamVerdict = caseData?.consensus?.leaning;
    const v = ['believe', 'doubt', 'abstain', 'dormant', 'split'].includes(teamVerdict)
      ? teamVerdict
      : 'abstain';
    setVerdict(v);
    setBrier(null);
    setConfidence(null);
    setRevealPhase('vindicate');
  };

  const submitVerdict = (v, prob = null) => {
    if (verdict) return;
    setVerdict(v);
    setConfidence(prob);
    // No Brier score for reviews (no ground truth) — leave it null so the
    // verdict ribbon's grade chip can suppress itself. When a slider
    // probability is supplied we score on the raw probability; otherwise we
    // fall back to the legacy discrete-verdict mapping.
    const score = caseData.correctVerdict == null
      ? null
      : computeBrier(prob != null ? prob : v, caseData.correctVerdict);
    setBrier(score);
    // Fold this result into the running session scorecard (graded cases only).
    // `correct` is null for an abstain (mid-band) commit so it breaks the
    // streak without counting as a wrong call.
    if (caseData.correctVerdict != null) {
      const correct = v === 'abstain' ? null : (v === caseData.correctVerdict);
      try { setSessionScore(recordCaseResult({ brier: score, correct })); } catch (e) {}
    }
    setRevealPhase('weighing');

    // Option A — live four-voice argument replaces the single recorded reaction
    // when the live tier is on. paid = all four; free = Monk only. On completion
    // we advance weighing → reveal (the driver below is held off via liveTurnRef).
    console.log('[live] commit', { v, liveTier, isReviewMode, focusedAgent });
    // Free preview covers only Monk (the live-TTS voice) and only when he's the
    // focused character — so the line plays in his already-loaded scene with no
    // swap/intro collision. Paid covers all four. Otherwise fall through to the
    // recorded reaction.
    const doLive = liveTier === 'paid' || (liveTier === 'free' && focusedAgent === 'Monk');
    if (doLive) {
      const isPaid = liveTier === 'paid';
      const voices = liveTier === 'paid'
        ? ['Monk', 'Demon', 'Detective', 'Unicorn']
        : ['Monk'];
      const focusStation = (focusedAgent && CHARACTER_TO_STATION[focusedAgent]) || 'monk';

      // Merge this case's recorded verdictReaction lines (Demon/Detective) into
      // the director menu as PREFERRED, with the generic bank as fallback. Per-
      // case clips resolve via extraClips; generic via clipById.
      const menu = clipMenuForDirector(null);
      const extraClips = {};
      for (const ch of ['Demon', 'Detective']) {
        const sk = CHARACTER_TO_STATION[ch];
        const vr = caseData?.stations?.[sk]?.verdictReaction;
        if (!vr || !menu[ch]) continue;
        for (const vk of ['believe', 'doubt', 'abstain']) {
          const ln = vr[vk];
          const audio = ln && typeof ln === 'object' ? ln.audio : null;
          const text = ln && typeof ln === 'object' ? ln.text : null;
          if (!audio || !text) continue;
          const id = `case_${ch}_${vk}`;
          const tag = vk === 'believe' ? 'verdict-trust' : vk === 'doubt' ? 'verdict-doubt' : 'verdict-abstain';
          extraClips[id] = { audioName: audio, text };
          menu[ch].unshift({ id, tag, text, preferred: true });
        }
      }

      let liveSpeaker = null;
      liveTurnRef.current = true;
      // Paid = the council: drop the 1:1 zoom and engage the curtain-call lineup
      // (props hidden, wide shot, four standing) WITHOUT revealing the outcome.
      if (isPaid) { setFocusedAgent(null); setCouncilActive(true); }
      runDirectedTurn(
        {
          phase: 'case',
          caseContext: caseSummaryForDirector(caseData),
          playerAction: `${v}${prob != null ? ` at ${Math.round(prob * 100)}%` : ''}`,
          clipBank: menu,
          voices,
          // ?uni=1 forces a Unicorn beat — for verifying the faceless voice path.
          forceUnicorn: typeof window !== 'undefined'
            && new URLSearchParams(window.location.search).get('uni') === '1',
        },
        {
          speak: isPaid ? speakCouncil : speakBeat,
          resolveClip: (id) => extraClips[id] || clipById(id),
          setSpeaker: (id) => { liveSpeaker = id; },
          setCaption: (text) => setActiveReaction({ stationKey: CHARACTER_TO_STATION[liveSpeaker] || focusStation, text }),
          playAnim: () => {},
        },
      ).finally(() => {
        liveTurnRef.current = false;
        if (isPaid) setCouncilActive(false);
        setRevealPhase('reveal');
      });
      return;
    }

    // Play the focused character's immediate verdict reaction. The reveal
    // phase driver below transitions weighing → reveal (when reaction ends)
    // → vindicate (after a beat for the player to absorb the truth).
    const stationKey = focusedAgent && CHARACTER_TO_STATION[focusedAgent];
    const station = stationKey && caseData.stations[stationKey];
    const reaction = station?.verdictReaction?.[v];
    if (reaction) {
      setActiveReaction({ stationKey, text: reaction });
      speakLine(reaction, stationKey);
    } else {
      // No reaction line for this character/verdict — skip the weighing
      // beat and go straight to reveal.
      setRevealPhase('reveal');
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

  // Reveal-phase driver.
  //
  // 'weighing' → 'reveal' : fires when the reaction audio ends. For SitePal
  //   characters we wait on `speechActive` (which vh_audioStopped clears the
  //   instant audio ends). For Eugene (no SitePal callbacks; speechActive
  //   sticks on the 8s safety floor) we use a text-paced delay instead.
  //
  // 'reveal' → 'vindicate' : ~1.1s pause for the player to absorb the truth
  //   card, then speak the vindication line. The vindicationFiredForRef
  //   guard prevents the line from re-firing if other state churns the
  //   effect.
  const vindicationFiredForRef = useRef(null);
  useEffect(() => {
    if (!verdict) {
      vindicationFiredForRef.current = null;
      return;
    }

    if (revealPhase === 'weighing') {
      // Live four-voice turn in progress — submitVerdict advances to 'reveal'
      // when the whole argument ends; don't let the single-line driver cut in.
      if (liveTurnRef.current) return;
      const isEugene = (focusedAgent && CHARACTER_TO_STATION[focusedAgent]) === 'eugene';
      if (!isEugene && speechActive) return; // reaction still playing
      const reactionMs = isEugene
        ? Math.max(2200, (activeReaction?.text?.length || 0) * 70)
        : 350;
      const t = setTimeout(() => setRevealPhase('reveal'), reactionMs);
      return () => clearTimeout(t);
    }

    if (revealPhase === 'reveal') {
      const t = setTimeout(() => setRevealPhase('vindicate'), 1100);
      return () => clearTimeout(t);
    }

    if (revealPhase === 'vindicate' && vindicationDelivery) {
      if (vindicationFiredForRef.current === vindicationDelivery.line) return;
      vindicationFiredForRef.current = vindicationDelivery.line;
      speakLine(vindicationDelivery.line, vindicationDelivery.stationKey);
    }
  }, [verdict, revealPhase, vindicationDelivery, speechActive, activeReaction, focusedAgent, speakLine]);

  // Stable camera rig inputs — without `useMemo`, these inline arrays would
  // get a new identity every render and re-mount the rig's effect, lurching
  // the camera back to the start pose on every parent re-render.
  const cameraInitialPosition = useMemo(
    () => (isMobileView ? [0, 4.5, 7] : [0, 1.5, 7.5]),
    [isMobileView],
  );
  const cameraInitialTarget = useMemo(() => [0, -0.5, 0], []);
  // Tightened framing: dolly the resting shot ~15% closer so the workstation
  // fills more of the frame and the empty sky band above the monitors crops
  // down. Angle/target unchanged — same approved composition, just nearer.
  const cameraZoomEndDistance = isMobileView ? 5.6 : 3.25;

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
    setIs80sMode: setContext80sMode,
    setMusicDucked,
  } = useMusic();

  // Duck the background music while a character is speaking; restore it when
  // they finish (and force-restore on unmount so navigating away mid-sentence
  // never leaves the music stuck quiet).
  useEffect(() => {
    setMusicDucked(speechActive);
  }, [speechActive, setMusicDucked]);
  useEffect(() => () => setMusicDucked(false), [setMusicDucked]);
    

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
      const modelToPreload = '/models/RL80_4anims_v70_opt.glb';
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
          // console.log('[Temple] Fallback timeout reached, model still not loaded');
          // console.log('[Temple] Consider checking network or model file size');
        // Don't reveal the scene - keep showing loader
        // Just log the issue for debugging
      } else if (isSceneLoading && modelLoaded) {
        // If model is loaded but scene is still loading, it's safe to reveal
        // console.log('[Temple] Fallback timeout reached but model is loaded, revealing scene');
        setSceneReady(true);
        setIsSceneLoading(false);
      }
    }, isMobileView ? 30000 : 30000); // 30 seconds for both - give model time to load

    return () => clearTimeout(fallbackTimer);
  }, [isSceneLoading, isMobileView, modelLoaded]);

  // Mobile lobby renders a baked backdrop instead of the live scene, so the
  // model-load gate (handleSceneLoad → modelLoaded) never fires. Mark the
  // scene "ready" on mobile so the loader clears and the lobby shows.
  useEffect(() => {
    if (!isMobileView) return;
    setModelLoaded(true);
    setTickerReady(true);
    setSceneReady(true);
    setIsSceneLoading(false);
  }, [isMobileView]);

  // Auto-dismiss the mobile "coming soon" notice.
  useEffect(() => {
    if (!mobileSoon) return;
    const t = setTimeout(() => setMobileSoon(false), 2600);
    return () => clearTimeout(t);
  }, [mobileSoon]);

  // Hand-tap GIF prompt: ~3s after the scene reveals, fade in for ~3.5s,
  // then fade out. Skip entirely if the user has already focused something
  // (they don't need the hint) or if the entry overlay is up. Also skip if
  // the user has interacted at all this session — un-focusing back to null
  // would otherwise re-fire this effect and re-show the GIF. Hide
  // immediately on the first click/tap anywhere — they've engaged.
  useEffect(() => {
    // Desktop-only: the mobile lobby is the coin scene (no full diorama to
    // nudge a tap into), so skip the hand-tap prompt there entirely.
    if (!sceneReady || focusedAgent || userHasInteracted || isMobileView) return;
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
  }, [sceneReady, focusedAgent, userHasInteracted, isMobileView]);

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

  // Consultant railway — shared between the mobile bottom sheet (rendered
  // inline inside the console) and the desktop centered-bottom strip
  // (rendered as a separate sibling). Extracted so it isn't duplicated.
  // State per portrait: current (phosphor ring), visited (small tick dot),
  // all-asked (amber dim, grayscale), unvisited (neutral).
  const consultantRailway = (
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: isMobileView ? 4 : 6,
                    ...(isMobileView ? {} : { pointerEvents: 'auto' }),
                  }}>
                    {/* Call-to-action — sits directly above the portraits, right
                        where the player needs to act. Shown only until they've
                        consulted their first character, then it's gone. */}
                    {visitedStations.size === 0 && (
                      <div style={{
                        fontSize: isMobileView ? 10 : 12,
                        letterSpacing: '0.16em',
                        textTransform: 'uppercase',
                        fontWeight: 700,
                        color: '#8effc4',
                        textShadow: '0 0 12px rgba(77,255,170,0.65)',
                        whiteSpace: 'nowrap',
                      }}>
                        ▸ Tap a consultant to begin
                      </div>
                    )}
                    <div style={{
                    display: 'flex',
                    gap: isMobileView ? 5 : 8,
                    padding: isMobileView ? '2px 6px 3px' : '2px 4px',
                    justifyContent: 'center',
                    alignItems: 'center',
                    // On desktop the surrounding strip box supplies the
                    // background, so the row stays transparent (no box-in-box).
                    background: isMobileView ? 'rgba(2,5,8,0.4)' : 'transparent',
                  }}>
                    {/* Inline scan counter — sits as the first tile in the
                        consultant railway so the player can't miss it. Same
                        height as the portrait tiles; narrower since it's
                        just a number. Color follows the same red/amber/green
                        threshold the desktop header uses. Hidden in Token
                        Review mode — no scan budget there. */}
                    {!isReviewMode && (() => {
                      const r = scansRemaining;
                      const accent = r <= 0 ? '#ff3ea0' : r === 1 ? '#ffb84d' : '#8effc4';
                      const soft = r <= 0 ? 'rgba(255,62,160,0.55)'
                        : r === 1 ? 'rgba(255,184,77,0.55)'
                        : 'rgba(142,255,196,0.55)';
                      return (
                        <div
                          aria-label={`${r} of ${caseData.maxScans} scans remaining`}
                          style={{
                            width: isMobileView ? 66 : 78,
                            height: isMobileView ? 72 : 110,
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: isMobileView ? 2 : 3,
                            marginRight: isMobileView ? 0 : 2,
                            borderRight: isMobileView ? 'none' : '1px solid rgba(77,255,170,0.18)',
                            paddingRight: isMobileView ? 0 : 6,
                            color: accent,
                            textShadow: `0 0 10px ${soft}`,
                            lineHeight: 1,
                            pointerEvents: 'none',
                          }}
                        >
                          <div
                            key={r}
                            style={{
                              fontFamily: "'Orbitron','IBM Plex Mono',monospace",
                              fontSize: isMobileView ? 26 : 44,
                              fontWeight: 900,
                              letterSpacing: '0.02em',
                              transformOrigin: 'center',
                              willChange: 'transform, filter',
                              animation: scanPunchArmed
                                ? 'scanPunch 0.8s cubic-bezier(0.2, 1.5, 0.4, 1) both, scanBreath 2.6s ease-in-out 0.9s infinite'
                                : 'none',
                            }}
                          >
                            {r}
                          </div>
                          <div style={{
                            fontSize: isMobileView ? 7 : 8,
                            letterSpacing: '0.18em',
                            fontWeight: 800,
                            opacity: 0.9,
                          }}>
                            {r === 1 ? 'SCAN' : 'SCANS'}
                          </div>
                          <div style={{
                            fontSize: isMobileView ? 7 : 8,
                            letterSpacing: '0.10em',
                            fontWeight: 700,
                            opacity: 0.75,
                          }}>
                            REMAINING
                          </div>
                        </div>
                      );
                    })()}
                    {[
                      { agentId: 'Monk',      stationKey: 'monk',    portrait: '/thumbnail_gr80.png',        label: 'ETHOS' },
                      { agentId: 'Demon',     stationKey: 'demon',   portrait: '/thumbnail_johnBarron.png',  label: 'PATHOS' },
                      { agentId: 'Detective', stationKey: 'marisol', portrait: '/thumbnail_marisol.png',     label: 'LOGOS' },
                      { agentId: 'RL80',      stationKey: 'eugene',  portrait: '/thumbnail_eugene.png',      label: 'MYTHOS' },
                    ].map(({ agentId, stationKey, portrait, label }) => {
                      const station = caseData.stations[stationKey];
                      if (!station) return null;
                      const isCurrent = focusedAgent === agentId;
                      const isVisited = visitedStations.has(stationKey);
                      const askedCount = asked[stationKey]?.size || 0;
                      const totalQuestions = station.questions?.length || 0;
                      const remaining = Math.max(0, totalQuestions - askedCount);
                      const allAsked = remaining === 0;
                      const shortName = label;
                      const buttonW = isMobileView ? 58 : 92;
                      const buttonH = isMobileView ? 72 : 110;

                      const outOfScans = scansRemaining <= 0;
                      const lockedToMonk = mustStartWithMonk && agentId !== 'Monk';
                      const disabled = isCurrent || outOfScans || lockedToMonk;
                      return (
                        <button
                          key={agentId}
                          onClick={() => { if (!disabled) setFocusedAgent(agentId); }}
                          disabled={disabled}
                          title={lockedToMonk
                            ? 'Tap ETHOS first — he sets the rules'
                            : outOfScans && !isCurrent
                              ? 'No scans left — render your verdict'
                              : `${station.character} — ${station.role}`}
                          style={{
                            position: 'relative',
                            width: buttonW,
                            height: buttonH,
                            padding: 0,
                            overflow: 'hidden',
                            background: 'rgba(10,58,38,0.18)',
                            border: isCurrent
                              ? '2px solid #4dffaa'
                              : allAsked && isVisited
                                ? '2px solid rgba(255,184,77,0.55)'
                                : '2px solid rgba(255,62,160,0.55)',
                            borderRadius: 9,
                            color: isCurrent ? '#8effc4' : allAsked && isVisited ? '#ffb84d' : '#c8ffe0',
                            cursor: disabled ? (isCurrent ? 'default' : 'not-allowed') : 'pointer',
                            fontFamily: "'IBM Plex Mono','SF Mono',Menlo,monospace",
                            boxShadow: isCurrent
                              ? '0 0 14px rgba(77,255,170,0.55)'
                              : '0 0 8px rgba(255,62,160,0.28)',
                            transition: 'all 0.18s ease',
                            opacity: isCurrent
                              ? 1
                              : lockedToMonk
                                ? 0.32
                                : outOfScans
                                  ? 0.4
                                  : allAsked && isVisited
                                    ? 0.78
                                    : 0.94,
                            filter: lockedToMonk
                              ? 'grayscale(0.7)'
                              : outOfScans && !isCurrent
                                ? 'grayscale(0.5)'
                                : 'none',
                          }}
                        >
                          <img
                            src={portrait}
                            alt={station.character}
                            style={{
                              position: 'absolute',
                              inset: 0,
                              width: '100%',
                              height: '100%',
                              objectFit: 'cover',
                              filter: allAsked && isVisited ? 'grayscale(0.35)' : 'none',
                              transition: 'all 0.2s ease',
                            }}
                          />
                          <div style={{
                            position: 'absolute',
                            left: 0,
                            right: 0,
                            bottom: 0,
                            padding: isMobileView ? '10px 3px 3px' : '14px 4px 5px',
                            background: 'linear-gradient(180deg, rgba(2,5,8,0) 0%, rgba(2,5,8,0.78) 55%, rgba(2,5,8,0.92) 100%)',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: 1,
                          }}>
                            <div style={{
                              fontSize: isMobileView ? 9 : 11,
                              letterSpacing: '0.12em',
                              color: 'inherit',
                              textTransform: 'uppercase',
                              fontWeight: 700,
                              textShadow: '0 1px 4px rgba(0,0,0,0.85)',
                            }}>
                              {shortName}
                            </div>
                            {/* Lens/specialty — surfaced at the decision point so
                                the player knows who covers what before spending a
                                question. */}
                            <div style={{
                              fontSize: isMobileView ? 6.5 : 8,
                              letterSpacing: '0.04em',
                              color: allAsked && isVisited
                                ? 'rgba(255,184,77,0.75)'
                                : isCurrent
                                  ? 'rgba(142,255,196,0.7)'
                                  : 'rgba(200,255,224,0.55)',
                              textTransform: 'uppercase',
                              textShadow: '0 1px 3px rgba(0,0,0,0.85)',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              maxWidth: '100%',
                            }}>
                              {lensLabel(station)}
                            </div>
                            <div style={{
                              fontSize: 7,
                              letterSpacing: '0.18em',
                              color: allAsked && isVisited
                                ? 'rgba(255,184,77,0.9)'
                                : isCurrent
                                  ? 'rgba(142,255,196,0.85)'
                                  : isVisited
                                    ? '#8fd4b6'
                                    : 'rgba(200,255,224,0.7)',
                              textTransform: 'uppercase',
                              textShadow: '0 1px 3px rgba(0,0,0,0.85)',
                            }}>
                              {outOfScans && !isCurrent
                                ? '—'
                                : allAsked && isVisited
                                  ? 'ASKED'
                                  : isVisited
                                    ? (isReviewMode
                                        ? `${remaining} LEFT`
                                        : `${Math.min(remaining, scansRemaining)} LEFT`)
                                    : 'TAP'}
                            </div>
                          </div>
                          {isVisited && !isCurrent && !allAsked && (
                            <div style={{
                              position: 'absolute',
                              top: 5,
                              right: 5,
                              width: 7,
                              height: 7,
                              borderRadius: '50%',
                              background: '#4dffaa',
                              boxShadow: '0 0 8px #4dffaa',
                            }} />
                          )}
                        </button>
                      );
                    })}
                    </div>
                  </div>
  );

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
      {mounted && !isMobileView && <SitePalHostEmbed config={HOST_SITEPAL_CONFIG} />}
          
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

        @keyframes scanPunch {
          0%   { transform: scale(1);    filter: brightness(1); }
          18%  { transform: scale(1.75); filter: brightness(1.7); }
          42%  { transform: scale(0.88); filter: brightness(1.15); }
          68%  { transform: scale(1.14); filter: brightness(1.05); }
          100% { transform: scale(1);    filter: brightness(1); }
        }

        @keyframes scanBreath {
          0%, 100% { transform: scale(1);     opacity: 0.92; }
          50%      { transform: scale(1.09);  opacity: 1; }
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
                left: isMobileView ? "1rem" : "1rem",
                top: isMobileView ? "0.5rem" : "-2rem",
                color: "#f6f5f1ff",
                fontFamily: "UnifrakturCook, serif",
                textShadow: "0 0 10px rgba(212, 175, 55, 0.8), 0 0 20px rgba(212, 175, 55, 0.6), 0 0 30px rgba(212, 175, 55, 0.8), 6px 6px 16px rgba(0, 0, 0, 1), -2px -2px 8px rgba(255, 192, 203, 0.7), 0 0 100px rgba(212, 175, 55, 0.1)",
                fontSize: isMobileView ? "2.5rem" : "3rem",
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
            <span className="title-line" style={{ display: 'block', position: 'relative', fontSize: "1rem", marginLeft: "0.75rem" }}>The</span>
            <span className="title-line" style={{ display: 'block', marginLeft: isMobileView ? "1rem" : "2rem",position: 'relative' }}>

              {/* <span style={{ fontSize: "3rem" }}></span> */}
                Liminal
            </span>
            <span className="title-line" style={{ display: 'block', marginLeft: isMobileView ? "2rem" : "4rem", position: 'relative' }}>Terminal</span>
          </h1>

          {/* Diagonal "COMING SOON" corner ribbon — cyber-styled, neon green
              on a dark glass plate, clipped by the parent's overflow:hidden
              so it reads as a corner-pinned banner. */}
          {/* <div
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
          </div> */}

        {/* Temple Description Panel - Separate from RL80 logo */}
        <div 
          onClick={() => {
            if (!userHasInteracted) {
              // console.log('Panel clicked, collapsing');
              setUserHasInteracted(true);
            }
          }}
          onTouchStart={() => {
            if (!userHasInteracted) {
              // console.log('Panel touched, collapsing');
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

        {/* Main Canvas — desktop only. On mobile the live four-character
            scene (plus SitePal projection, video screens, post) is the perf
            problem, so we swap in a baked backdrop below. */}
        {canvasReady && !isMobileView && (
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
            <GpuMemoryProbe />
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
                <Clouds material={THREE.MeshBasicMaterial} texture="/cloud.png">
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
              attractMonk={gameStarted && !rulesHeard && !focusedAgent}
              showCharacterHints={showCharacterHint && !focusedAgent}
              useSitePalForDemon={focusedAgent === 'Demon'}
              useSitePalForDetective={focusedAgent === 'Detective'}
              useSitePalForMonk={focusedAgent === 'Monk'}
              externalFocusAgent={revealMode ? 'Stage' : focusedAgent}
              speechActive={speechActive}
              revealMode={revealMode}
              showEugeneLobbyBubble={tradeMode !== 'game' && focusedAgent === 'RL80'}
              eugeneGameBubble={
                tradeMode === 'game' && !verdict && focusedAgent === 'RL80'
                  ? eugeneBubble
                  : null
              }
              onCoinFaceTap={(coinIndex) => {
                // TODO: show leaderboard player info for tapped coin
                // console.log(`CoinFace ${coinIndex} tapped`)
              }}
              onAgentClick={(agentId) => {
                if (agentId) {
                  // First-case tutorial gate: in case-001 the player must tap
                  // GR80/Monk first so the rules audio plays. Ignore taps on
                  // other consultants until Monk has been focused this session
                  // (or rules were heard in a prior session).
                  if (mustStartWithMonk && agentId !== 'Monk' &&
                      !/^Screen[1-4]$/.test(agentId) && !/^Screen[A-D]$/.test(agentId)) {
                    return;
                  }
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
                autoRotate={!focusedAgent && !revealMode}
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

            {/* Council group chat painted onto ScreenA-D */}
            <CouncilChatScreens />

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
              autoRotate={!focusedAgent && !revealMode}
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

        {/* Mobile lobby → lite "council of coins" scene (small angel+coins
            GLB with portrait-textured coins) instead of the full diorama. */}
        {canvasReady && isMobileView && <MobileLobbyScene />}

        {/* Floating Character Label on Focus */}
        {(() => {
          const agentInfo = {
            RL80: { name: 'Eugene', pronunciation: 'yoo-JEEN', tagline: 'Every story wants to be a myth. The rare ones earn it.' },
            Demon: { name: 'John Barron', pronunciation: '', tagline: 'Devil\'s advocate. Short seller. Insider trader.' },
            Monk: { name: 'St. GR80', pronunciation: 'saint GREAT-ee', tagline: 'Android theologian hell-bent on saving humanity from itself.' },
            Detective: { name: 'Detective Trinity', pronunciation: '', tagline: 'Field agent for an interdimensional cyber-crimes task force.' },
          };
          // In game mode, the in-scene evidence side panel takes over —
          // suppress the floating agent label so the two cards don't stack.
          // Eugene is also suppressed here in lobby: she speaks via chat
          // bubble (rendered below), not the generic gold card — keeps her
          // medium consistent between lobby and game.
          const info =
            tradeMode !== 'game' &&
            focusedAgent &&
            focusedAgent !== 'RL80' &&
            agentInfo[focusedAgent];
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
              {/* Close affordance — explicit return-to-overview button.
                  Parent card has pointerEvents: 'none' so the rest of the
                  card stays click-through (tap-anywhere-to-unfocus); the
                  button itself opts back in. */}
              <button
                type="button"
                aria-label="Return to overview"
                onClick={() => {
                  if (typeof window !== 'undefined') {
                    window.dispatchEvent(new CustomEvent('screenGoBack'));
                  }
                }}
                style={{
                  position: 'absolute',
                  top: isMobileView ? '0.3rem' : '0.35rem',
                  right: isMobileView ? '0.5rem' : '0.5rem',
                  width: isMobileView ? '1.75rem' : '1.5rem',
                  height: isMobileView ? '1.75rem' : '1.5rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: 0,
                  background: 'transparent',
                  border: 'none',
                  color: 'rgba(218, 165, 32, 0.7)',
                  fontFamily: "'Orbitron', 'Courier New', monospace",
                  fontSize: isMobileView ? '1.1rem' : '1rem',
                  lineHeight: 1,
                  cursor: 'pointer',
                  pointerEvents: 'auto',
                  transition: 'color 0.15s ease, transform 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = '#daa520';
                  e.currentTarget.style.transform = 'scale(1.15)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = 'rgba(218, 165, 32, 0.7)';
                  e.currentTarget.style.transform = 'scale(1)';
                }}
              >
                ×
              </button>
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

        {/* Top Controls Container - User and Nav.
            No music control here on purpose: /trade is a speaking-avatars page,
            so music would compete with the dialogue. (Any music already playing
            from another page is ducked during speech via setMusicDucked.) */}
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
              {!tradeMode && !focusedAgent && (!isMobileView || railExpanded) && (
                <TradeServiceRail
                  selectedId={selectedService}
                  onSelect={setSelectedService}
                  open={railExpanded}
                  onOpenChange={setRailExpanded}
                  sheet={isMobileView}
                  onLaunch={(id) => {
                    if (isMobileView) {
                      setRailExpanded(false);
                      setMobileSoon(true);
                      return;
                    }
                    if (id === 'analysis') setShowReviewFunnel(true);
                    else enterGameMode();
                  }}
                />
              )}
              {/* In-scene HUD strip — top of viewport, 40px tall, doesn't
                  block. Shows case name + scans remaining. */}
              {tradeMode === 'game' && !verdict && (
                <div
                  style={{
                    position: 'fixed',
                    top: `calc(env(safe-area-inset-top, 0px) + ${isMobileView ? 8 : 12}px)`,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    zIndex: 1050,
                    padding: isMobileView ? '5px 10px' : '8px 16px',
                    maxWidth: isMobileView ? 'calc(100vw - 12px)' : undefined,
                    display: 'flex',
                    alignItems: 'center',
                    gap: isMobileView ? 8 : 14,
                    background: 'linear-gradient(180deg, rgba(4,12,8,0.86), rgba(2,5,8,0.74))',
                    border: '1px solid rgba(77,255,170,0.55)',
                    borderRadius: 6,
                    boxShadow: '0 0 18px rgba(77,255,170,0.22)',
                    backdropFilter: 'blur(8px)',
                    WebkitBackdropFilter: 'blur(8px)',
                    fontFamily: "'IBM Plex Mono', 'SF Mono', Menlo, monospace",
                    color: '#c8ffe0',
                    fontSize: isMobileView ? 9 : 11,
                    letterSpacing: isMobileView ? '0.12em' : '0.16em',
                    pointerEvents: 'auto',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {!isMobileView && (
                    <span style={{ color: '#8effc4', fontWeight: 700 }}>
                      {reviewCase ? '// REVIEW' : '// CASE'}
                    </span>
                  )}
                  {reviewCase ? (
                    // Review mode — case is bound to the resolved token, so
                    // the file picker is replaced with a plain label. The
                    // dropdown's CASE_FILES choices would be no-ops while
                    // reviewCase overrides currentCaseIndex anyway.
                    <span
                      style={{
                        padding: isMobileView ? '3px 8px' : '4px 10px',
                        background: 'rgba(142,233,255,0.10)',
                        border: '1px solid rgba(142,233,255,0.55)',
                        color: '#c8ffe0',
                        borderRadius: 4,
                        fontWeight: 700,
                      }}
                    >
                      {caseData.projectName}
                    </span>
                  ) : (
                  <div ref={caseMenuRef} style={{ position: 'relative', display: 'inline-flex' }}>
                    <button
                      type="button"
                      onClick={() => setCaseMenuOpen((o) => !o)}
                      aria-haspopup="listbox"
                      aria-expanded={caseMenuOpen}
                      aria-label="Choose case"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: isMobileView ? '3px 8px' : '4px 10px',
                        background: caseMenuOpen
                          ? 'rgba(77,255,170,0.18)'
                          : 'rgba(77,255,170,0.07)',
                        border: '1px solid rgba(142,255,196,0.55)',
                        color: 'inherit',
                        font: 'inherit',
                        letterSpacing: 'inherit',
                        cursor: 'pointer',
                        borderRadius: 4,
                        boxShadow: caseMenuOpen
                          ? 'inset 0 0 10px rgba(77,255,170,0.18)'
                          : '0 0 6px rgba(77,255,170,0.10)',
                        transition: 'background 0.12s ease, box-shadow 0.12s ease',
                      }}
                      onMouseEnter={(e) => {
                        if (!caseMenuOpen) {
                          e.currentTarget.style.background = 'rgba(77,255,170,0.14)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!caseMenuOpen) {
                          e.currentTarget.style.background = 'rgba(77,255,170,0.07)';
                        }
                      }}
                    >
                      {caseData.projectName}
                      <span
                        aria-hidden
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: isMobileView ? 14 : 16,
                          height: isMobileView ? 14 : 16,
                          fontSize: isMobileView ? 11 : 13,
                          lineHeight: 1,
                          color: '#8effc4',
                          background: 'rgba(77,255,170,0.18)',
                          borderRadius: 3,
                          transform: caseMenuOpen ? 'rotate(180deg)' : 'none',
                          transition: 'transform 0.15s ease',
                        }}
                      >
                        ▾
                      </span>
                    </button>
                    {caseMenuOpen && (
                      <div
                        role="listbox"
                        style={{
                          position: 'absolute',
                          top: '100%',
                          left: -6,
                          marginTop: 8,
                          minWidth: 220,
                          maxHeight: '60vh',
                          overflowY: 'auto',
                          background: 'linear-gradient(180deg, rgba(4,12,8,0.96), rgba(2,5,8,0.96))',
                          border: '1px solid rgba(77,255,170,0.55)',
                          borderRadius: 6,
                          boxShadow: '0 8px 28px rgba(0,0,0,0.55), 0 0 18px rgba(77,255,170,0.18)',
                          backdropFilter: 'blur(8px)',
                          WebkitBackdropFilter: 'blur(8px)',
                          padding: 4,
                          zIndex: 1051,
                        }}
                      >
                        {CASE_FILES.map((c, i) => {
                          const isCurrent = i === currentCaseIndex;
                          return (
                            <button
                              key={c.id}
                              type="button"
                              role="option"
                              aria-selected={isCurrent}
                              onClick={() => {
                                setCaseMenuOpen(false);
                                if (!isCurrent) jumpToCase(i);
                              }}
                              style={{
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'flex-start',
                                gap: 2,
                                width: '100%',
                                padding: '8px 10px',
                                background: isCurrent ? 'rgba(77,255,170,0.12)' : 'transparent',
                                border: 'none',
                                borderLeft: `2px solid ${isCurrent ? '#8effc4' : 'transparent'}`,
                                borderRadius: 3,
                                cursor: isCurrent ? 'default' : 'pointer',
                                textAlign: 'left',
                                fontFamily: "'IBM Plex Mono','SF Mono',Menlo,monospace",
                                color: '#c8ffe0',
                              }}
                              onMouseEnter={(e) => {
                                if (!isCurrent) e.currentTarget.style.background = 'rgba(77,255,170,0.08)';
                              }}
                              onMouseLeave={(e) => {
                                if (!isCurrent) e.currentTarget.style.background = 'transparent';
                              }}
                            >
                              <span style={{ fontSize: 9, letterSpacing: '0.18em', color: isCurrent ? '#8effc4' : '#6db59a' }}>
                                {c.id.toUpperCase()}
                                {isCurrent && ' ·  CURRENT'}
                              </span>
                              <span style={{ fontSize: 11, color: '#c8ffe0' }}>
                                {c.projectName}
                                <span style={{ color: '#8effc4', marginLeft: 8 }}>{c.ticker}</span>
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  )}
                  <span style={{ color: '#3a6b54' }}>·</span>
                  <span style={{ color: '#8effc4' }}>{caseData.ticker}</span>
                  {!isMobileView && <span style={{ color: '#3a6b54' }}>·</span>}
                  {!isMobileView && (
                    <span style={{ color: '#6db59a', fontStyle: 'italic' }}>
                      {focusedAgent && CHARACTER_TO_STATION[focusedAgent]
                        ? 'investigate or render verdict'
                        : 'click a character to investigate'}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={replayRules}
                    aria-label="Replay how-to-play rules"
                    title="Replay rules"
                    style={{
                      marginLeft: isMobileView ? 2 : 6,
                      width: isMobileView ? 18 : 22,
                      height: isMobileView ? 18 : 22,
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: 0,
                      borderRadius: 999,
                      border: '1px solid rgba(142,233,255,0.6)',
                      background: 'rgba(8,28,36,0.55)',
                      color: '#8ee9ff',
                      fontFamily: "'Orbitron','IBM Plex Mono',monospace",
                      fontSize: isMobileView ? 9 : 11,
                      fontWeight: 800,
                      cursor: 'pointer',
                      textShadow: '0 0 8px rgba(142,233,255,0.45)',
                      boxShadow: '0 0 8px rgba(142,233,255,0.25)',
                    }}
                  >
                    ?
                  </button>
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

              {/* Game console. MOBILE: one bottom sheet stacking the scan
                  counter, the question/transcript card, and the consultant
                  railway. WIDE SCREENS: splits into two pieces so the centered
                  3D character isn't covered — the transcript card docks
                  top-left, and the consultant railway renders as a separate
                  centered strip along the bottom (sibling below). */}
              {tradeMode === 'game' && !verdict && (
                <>
                {/* Transcript panel. On desktop it's only shown once a
                    consultant is focused — before that the "tap a consultant"
                    CTA lives on the railway, so there's no empty box floating.
                    On mobile it always renders (it also hosts the railway). */}
                {(isMobileView || (focusedAgent && CHARACTER_TO_STATION[focusedAgent] && gameStation)) && (
                <div
                  style={{
                    position: 'fixed',
                    zIndex: 1055,
                    // Mobile: full-width sheet centered along the bottom —
                    // [A hidden][B][C] stacked, exactly as before.
                    // Wide screens: this console becomes the TRANSCRIPT panel
                    // ([A]+[B] only), docked TOP-LEFT. The consultant railway
                    // [C] is rendered separately as a centered-bottom strip
                    // (sibling below) so it isn't trapped by this panel's
                    // backdrop-filter.
                    ...(isMobileView
                      ? {
                          bottom: 'calc(env(safe-area-inset-bottom, 0px) + 4.75rem)',
                          left: '50%',
                          transform: 'translateX(-50%)',
                          width: 'calc(100vw - 12px)',
                          maxHeight: '58vh',
                        }
                      : {
                          // Centered on the left at roughly the character's eye
                          // level (reads as "consulting them"). Center is pulled
                          // slightly above the midline and maxHeight kept modest
                          // so the panel's bottom clears the centered railway
                          // strip even in the taller answer view.
                          top: '44%',
                          bottom: 'auto',
                          left: '1.5rem',
                          transform: 'translateY(-50%)',
                          width: 'min(410px, 38vw)',
                          maxHeight: '54vh',
                        }),
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
                  {/* The scan counter now lives inline as the first tile of the
                      consultant railway (see `consultantRailway`), on both mobile
                      and desktop — so it's no longer duplicated here as a panel
                      header. */}

                  {/* Top section: question content state machine, or a
                      "tap a consultant" hint when no character is focused. */}
                  {focusedAgent && CHARACTER_TO_STATION[focusedAgent] && gameStation ? (
                  <div style={{ minHeight: currentSpeech ? (isMobileView ? 0 : 210) : 0, maxHeight: isMobileView ? '38vh' : '46vh', overflowY: 'auto', padding: isMobileView ? '8px 10px' : '10px 14px', borderBottom: '1px solid rgba(77,255,170,0.18)', display: 'flex', flexDirection: 'column' }}>
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
                          <div style={{ display: 'flex', flexDirection: 'column', gap: isMobileView ? 6 : 10 }}>
                            <div style={{
                              fontSize: isMobileView ? 11 : 12,
                              color: '#6db59a',
                              fontStyle: 'italic',
                              lineHeight: 1.3,
                            }}>
                              "{activeAnswer.q}"
                            </div>
                            {/* Desktop: keep the inline Cinzel quote — there's
                                room for it and it reads nicely next to the
                                evidence card. Mobile: the floating top
                                caption is the sole surface for the spoken
                                line; the inline quote is dropped to keep
                                the panel compact. Eugene is always skipped
                                — her pink bubble already serves this role. */}
                            {stationKey !== 'eugene' && !isMobileView && (
                              <div style={{
                                padding: '14px 16px',
                                borderLeft: '2px solid #ff3ea0',
                                background: 'rgba(255,62,160,0.05)',
                              }}>
                                <div style={{
                                  fontFamily: "'Cinzel Decorative','Cinzel',serif",
                                  fontSize: 24,
                                  color: '#c8ffe0',
                                  lineHeight: 1.45,
                                }}>
                                  "{resolveLine(activeAnswer.a)?.text || ''}"
                                </div>
                              </div>
                            )}
                            {revealedEntry && (
                              <div
                                style={{
                                  display: 'grid',
                                  gridTemplateColumns: isMobileView ? '88px 1fr 16px' : '110px 1fr 18px',
                                  gap: isMobileView ? 6 : 10,
                                  padding: isMobileView ? '6px 8px' : '8px 10px',
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
                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                              {scansRemaining > 0 && (
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
                                  ▸ CONTINUE
                                </button>
                              )}
                              {/* No scans left: collapse the dismiss-and-show-prompt
                                  step; the bottom-nav verdict buttons are the
                                  direct path. Nudge the player toward them so
                                  the evidence view doesn't feel like a dead end. */}
                              {scansRemaining <= 0 && (
                                <div style={{
                                  fontSize: 11,
                                  color: '#8effc4',
                                  fontStyle: 'italic',
                                  letterSpacing: '0.04em',
                                  textShadow: '0 0 8px rgba(77,255,170,0.45)',
                                  animation: 'lt-fade-in 0.5s ease-out',
                                }}>
                                  ↓ Choose Trust, Abstain, or Doubt to render your verdict.
                                </div>
                              )}
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
                                  ▸ VIEW EVIDENCE
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
                        // Mobile: panel runs in two compact phases —
                        //   1) caption-only while audio plays (no
                        //      CONTINUE button taking space below),
                        //   2) CONTINUE-only after audio ends (caption
                        //      hidden so the panel collapses to button
                        //      height). Desktop keeps the simultaneous
                        //      transcript + CONTINUE layout.
                        const showContinue = !isMobileView || speechReady;
                        const showCaption = !isMobileView || !speechReady;
                        return (
                          <div style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: isMobileView ? 8 : 14,
                            flex: isMobileView ? '0 1 auto' : 1,
                            justifyContent: isMobileView ? 'flex-start' : 'center',
                          }}>
                            {/* Inline transcript. Desktop: ProgressiveText
                                teleprompter (accumulates chunks). Mobile:
                                LiveCaption — one sentence at a time, like
                                closed captioning, so the panel doesn't
                                cram four lines of small text on a phone.
                                Both replace the floating top caption for
                                speech beats so the character's face stays
                                clear. */}
                            {showCaption && (
                            <div style={{
                              padding: isMobileView ? '8px 10px' : '14px 16px',
                              borderLeft: '2px solid #ff3ea0',
                              background: 'rgba(255,62,160,0.05)',
                            }}>
                              <div style={{
                                fontFamily: "'Cinzel Decorative','Cinzel',serif",
                                fontSize: isMobileView ? 15 : 24,
                                color: '#c8ffe0',
                                lineHeight: 1.4,
                                textAlign: 'center',
                                minHeight: isMobileView ? '1.4em' : undefined,
                              }}>
                                {isMobileView ? (
                                  <LiveCaption
                                    text={currentSpeech.text}
                                    isPlaying={speechActive}
                                    audioDurationMs={currentSpeech.audioDurationMs}
                                  />
                                ) : (
                                  <ProgressiveText
                                    text={currentSpeech.text}
                                    isPlaying={speechActive}
                                    audioDurationMs={currentSpeech.audioDurationMs}
                                    maxVisibleLines={3}
                                    approxLineHeight={1.4}
                                  />
                                )}
                              </div>
                            </div>
                            )}
                            {showContinue && (
                            <button
                              onClick={() => {
                                // Stop whatever's currently speaking. This
                                // covers BOTH branches below — pressing
                                // CONTINUE mid-line should silence the
                                // audio regardless of whether there's a
                                // queued follow-up or we're just dismissing
                                // the beat.
                                stopSitePalAudio();
                                if (speechEndTimerRef.current) {
                                  clearTimeout(speechEndTimerRef.current);
                                  speechEndTimerRef.current = null;
                                }
                                setSpeechActive(false);
                                // If a follow-up beat is queued (e.g. monk's
                                // intro after his rules preamble), swap it
                                // in instead of dismissing — and play its
                                // audio. The stopSpeech above kills the
                                // outgoing rules audio first.
                                if (pendingSpeech) {
                                  setCurrentSpeech(pendingSpeech);
                                  setPendingSpeech(null);
                                  const queuedAudio = pendingAudioRef.current;
                                  if (queuedAudio) {
                                    pendingAudioRef.current = null;
                                    // stopSitePalAudio above already
                                    // killed the rules audio — fire the
                                    // intro audio fresh.
                                    speakLine(queuedAudio.line, queuedAudio.stationKey, queuedAudio.options);
                                  }
                                  return;
                                }
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
                                alignSelf: 'center',
                                animation: isMobileView ? 'lt-fade-in 0.35s ease-out' : undefined,
                              }}
                            >
                              ▸ CONTINUE
                            </button>
                            )}
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
                              Set your confidence below and lock in your verdict.
                            </div>
                            <div style={{
                              display: 'flex',
                              flexDirection: 'column',
                              gap: 3,
                              fontSize: 10,
                              lineHeight: 1.35,
                              color: '#9ed6bb',
                              maxWidth: 280,
                              textAlign: 'left',
                              fontFamily: "'IBM Plex Mono','SF Mono',Menlo,monospace",
                              letterSpacing: '0.02em',
                            }}>
                              <div>Slide toward <span style={{ color: '#8effc4', fontWeight: 700 }}>TRUST</span> (legit) or <span style={{ color: '#ff8a8a', fontWeight: 700 }}>DOUBT</span> (scam).</div>
                              <div>Leave it in the middle to <span style={{ color: '#dcdce4', fontWeight: 700 }}>ABSTAIN</span>.</div>
                              <div>Confident-and-right scores best; confident-and-wrong is worst.</div>
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
                              {isReviewMode
                                ? 'Try another consultant for their angle on this token.'
                                : `Try another consultant — ${scansRemaining} ${scansRemaining === 1 ? 'question' : 'questions'} remaining.`}
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
                        <div style={{ display: 'flex', flexDirection: 'column', gap: isMobileView ? 4 : 6 }}>
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
                                padding: isMobileView ? '5px 10px' : '8px 12px',
                                fontFamily: "'IBM Plex Mono','SF Mono',Menlo,monospace",
                                fontSize: isMobileView ? 11 : 12,
                                lineHeight: 1.3,
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
                          {!isMobileView && !isReviewMode && (
                            <div style={{ fontSize: 9, letterSpacing: '0.18em', color: '#3a6b54', marginTop: 2, textAlign: 'right' }}>
                              each question costs 1 of {scansRemaining} {scansRemaining === 1 ? 'scan' : 'scans'}
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                  ) : null}

                  {/* Bottom section: consultant railway. On mobile it lives
                      inline inside this console sheet (below the transcript).
                      On desktop the railway is rendered separately as a
                      centered-bottom strip (sibling below this panel). */}
                  {isMobileView && consultantRailway}
                </div>
                )}
                {/* Desktop only: consultant railway as a centered strip along
                    the bottom of the viewport. Kept as a SEPARATE sibling (not
                    a child of the transcript panel) because the panel uses
                    backdrop-filter, which would trap a fixed descendant. */}
                {!isMobileView && (
                  <div style={{
                    position: 'fixed',
                    left: 0,
                    right: 0,
                    bottom: '5.5rem',
                    display: 'flex',
                    justifyContent: 'center',
                    zIndex: 1055,
                    pointerEvents: 'none',
                  }}>
                    <div style={{
                      pointerEvents: 'auto',
                      padding: '8px 12px 7px',
                      background: 'linear-gradient(180deg, rgba(4,12,8,0.92), rgba(2,5,8,0.82))',
                      border: '1px solid rgba(77,255,170,0.45)',
                      borderRadius: 10,
                      boxShadow: '0 0 28px rgba(77,255,170,0.18)',
                      backdropFilter: 'blur(10px)',
                      WebkitBackdropFilter: 'blur(10px)',
                    }}>
                      {consultantRailway}
                    </div>
                  </div>
                )}
                </>
              )}

              {/* Floating subtitle — mobile only. Mirrors the spoken line
                  one sentence at a time, paced ~70ms/char and gated on
                  speechActive so it pauses with the audio. Sits above the
                  bottom console (which has been shrunk for mobile) and
                  below the top HUD so the avatar's mouth remains visible.

                  Speech beats (intros, returnLines, reactions) are now
                  rendered inline in the bottom panel next to CONTINUE, so
                  this floating caption is reserved for question-answer
                  playback (activeAnswer) only — keeps the character's face
                  clear during the intro read-along. */}
              {tradeMode === 'game' && !verdict && isMobileView && (() => {
                const stationForFocus = CHARACTER_TO_STATION[focusedAgent];
                const activeAnswerResolved =
                  activeAnswer && stationForFocus === activeAnswer.stationKey
                    ? resolveLine(activeAnswer.a)
                    : null;
                const captionText = activeAnswerResolved?.text || null;
                const captionDurationMs = activeAnswerResolved?.audioDurationMs || null;
                if (!captionText) return null;
                // Eugene has no SitePal audio — skip the live caption for
                // her (her chat bubble plays the same role).
                if (focusedAgent === 'RL80') return null;
                return (
                  <LiveCaption
                    text={captionText}
                    isPlaying={speechActive}
                    audioDurationMs={captionDurationMs}
                    style={{
                      position: 'fixed',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      // Anchored just below the top HUD strip (which sits at
                      // safe-area + 8px and is ~30px tall on mobile). Reads
                      // as a passive newsreel at the top — keeps the
                      // character mid-screen clear and the thumb-zone at
                      // the bottom free for taps.
                      top: 'calc(env(safe-area-inset-top, 0px) + 48px)',
                      zIndex: 1058,
                      maxWidth: 'calc(100vw - 24px)',
                      padding: '8px 14px',
                      background: 'rgba(2,5,8,0.78)',
                      borderLeft: '2px solid #ff3ea0',
                      borderRadius: 4,
                      backdropFilter: 'blur(6px)',
                      WebkitBackdropFilter: 'blur(6px)',
                      color: '#c8ffe0',
                      fontFamily: "'Cinzel Decorative','Cinzel',serif",
                      fontSize: 18,
                      lineHeight: 1.35,
                      textAlign: 'center',
                      textShadow: '0 1px 6px rgba(0,0,0,0.85)',
                      pointerEvents: 'none',
                    }}
                  />
                );
              })()}

              {/* Eugene's in-game dialogue bubble now renders inside the 3D
                  scene (CyborgTempleScene's `eugeneGameBubble` prop), anchored
                  to her head bone so it tracks her in world space and stays
                  out of her head/horn footprint. */}

              {/* Reveal ribbon — anchored to the edge that leaves the
                  curtain-call lineup visible: BOTTOM on mobile (lineup keeps
                  the upper frame), TOP on desktop (lineup keeps lower-center).
                  Same state machine as before (weighing → reveal → vindicate);
                  only the layout changed from a right-side card to a ribbon.
                  Dismissed only via the explicit NEXT CASE / BACK TO SERVICES
                  buttons (the result is too important to dismiss by accident). */}
              {verdict && tradeMode === 'game' && typeof document !== 'undefined' &&
                createPortal(
                  <div
                    style={{
                      position: 'fixed',
                      left: 0,
                      right: 0,
                      // Mobile: anchor to the BOTTOM (overlapping the nav is
                      // fine) so the curtain-call lineup keeps the upper frame.
                      // Desktop: anchor to the TOP so the lineup keeps the
                      // lower-center frame where the camera frames them.
                      ...(isMobileView
                        ? {
                            bottom: 0,
                            justifyContent: 'flex-end',
                            paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 5rem)',
                            paddingLeft: 12,
                            paddingRight: 12,
                          }
                        : {
                            // Desktop: dock the whole score panel to the RIGHT
                            // edge, centered in the space ABOVE the bottom nav
                            // (paddingBottom) so it never overlaps it, and tucked
                            // tight to the edge (small paddingRight).
                            top: 0,
                            bottom: 0,
                            right: 0,
                            left: 'auto',
                            justifyContent: 'center',
                            paddingRight: '0.85rem',
                            paddingLeft: 0,
                            paddingTop: '1.5rem',
                            paddingBottom: '6rem',
                          }),
                      zIndex: 10500,
                      display: 'flex',
                      flexDirection: 'column',
                      // Desktop: stretch the panel children to fill the
                      // right-side column. Mobile: centered.
                      alignItems: isMobileView ? 'center' : 'stretch',
                      gap: isMobileView ? 6 : 10,
                      // No backdrop / blur during reveal — let the 3D curtain
                      // call breathe. The ribbon itself reads against the scene
                      // thanks to its own border + glow.
                      pointerEvents: 'none',
                    }}
                  >
                    <style>{`
                      @keyframes verdictWeighPulse {
                        0%, 100% { opacity: 0.55; }
                        50%      { opacity: 1;    }
                      }
                      @keyframes verdictDots {
                        0%   { content: ''; }
                        25%  { content: '.'; }
                        50%  { content: '..'; }
                        75%  { content: '...'; }
                      }
                      .reveal-dots::after {
                        display: inline-block;
                        width: 1.6em;
                        text-align: left;
                        animation: verdictDots 1.6s steps(4, end) infinite;
                        content: '';
                      }
                      @keyframes ribbonRiseIn {
                        from { opacity: 0; transform: translateY(14px); }
                        to   { opacity: 1; transform: translateY(0);    }
                      }
                      .reveal-ribbon {
                        animation: ribbonRiseIn 0.45s ease-out both;
                      }
                    `}</style>
                    {isReviewMode && caseData?.consensus ? (
                      <ConsensusRibbon
                        consensus={caseData.consensus}
                        stations={caseData.stations}
                        token={{ projectName: caseData.projectName, ticker: caseData.ticker, chain: caseData.chain }}
                        isMobileView={isMobileView}
                        onClose={returnToServiceRail}
                      />
                    ) : (() => {
                      const isCorrect = verdict === caseData.correctVerdict;
                      const isAbstain = verdict === 'abstain';
                      const hasBrier = typeof brier === 'number';
                      const grade = !hasBrier ? '—' : brier <= 0.05 ? 'EXCELLENT' : brier <= 0.15 ? 'STRONG' : brier <= 0.30 ? 'FAIR' : 'POOR';
                      const gradeColor = !hasBrier ? '#6db59a' : brier <= 0.15 ? '#8effc4' : brier <= 0.30 ? '#ffb84d' : '#ff4d6d';
                      // Committed P(scam) from the confidence slider, for the HUD.
                      const confPct = confidence != null ? Math.round(confidence * 100) : null;
                      // Lens coaching — where the case-cracking evidence lived
                      // (decisiveLenses = station keys) vs. where the player
                      // actually spent scans (investigated = Set of station keys).
                      const decisive = Array.isArray(caseData.decisiveLenses) ? caseData.decisiveLenses : [];
                      const lensName = (k) => lensLabel(caseData.stations[k]) || k;
                      const charName = (k) => caseData.stations[k]?.character || lensName(k);
                      // Always pair the character with their lens — "Saint GR80
                      // (CREDIBILITY)" — so the note teaches the mapping rather than
                      // assuming the player already knows who owns which lens.
                      const tag = (k) => `${charName(k)} (${lensName(k)})`;
                      const joinAnd = (arr) =>
                        arr.length <= 1 ? (arr[0] || '')
                        : arr.length === 2 ? `${arr[0]} and ${arr[1]}`
                        : `${arr.slice(0, -1).join(', ')}, and ${arr[arr.length - 1]}`;
                      const missedDecisive = decisive.filter((k) => !investigated.has(k));
                      const caughtDecisive = decisive.filter((k) => investigated.has(k));
                      let lensNote = null;
                      if (decisive.length > 0) {
                        const where = `The tell was in ${joinAnd(decisive.map(tag))}.`;
                        if (missedDecisive.length === 0) {
                          lensNote = `${where} You looked there — good instincts.`;
                        } else if (caughtDecisive.length === 0) {
                          lensNote = `${where} And you never looked there.`;
                        } else {
                          lensNote = `${where} You consulted ${joinAnd(caughtDecisive.map(charName))} but never ${joinAnd(missedDecisive.map(charName))}.`;
                        }
                      }
                      // Running session totals (snapshotted at commit time).
                      const avgB = sessionAvgBrier(sessionScore);
                      const acc = sessionAccuracy(sessionScore);
                      const revealed = revealPhase === 'reveal' || revealPhase === 'vindicate';
                      const vindicated = revealPhase === 'vindicate';
                      const verdictColor = revealed
                        ? (isCorrect ? '#8effc4' : isAbstain ? '#c8ffe0' : '#ff4d6d')
                        : '#6db59a';
                      const verdictGlow = revealed
                        ? (isCorrect ? '0 0 22px rgba(77,255,170,0.55)' : isAbstain ? '0 0 16px rgba(200,255,224,0.35)' : '0 0 22px rgba(255,77,109,0.55)')
                        : 'none';
                      const fadeIn = (visible) => ({
                        opacity: visible ? 1 : 0,
                        transform: visible ? 'translateY(0)' : 'translateY(6px)',
                        transition: 'opacity 0.55s ease, transform 0.55s ease',
                        pointerEvents: visible ? 'auto' : 'none',
                      });
                      const statBlock = (label, value, color, caption) => (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: isMobileView ? 64 : 86 }}>
                          <div style={{ fontSize: isMobileView ? 8 : 9, letterSpacing: '0.24em', color: '#3a6b54' }}>{label}</div>
                          <div style={{ fontFamily: "'Cinzel Decorative','Cinzel',serif", fontSize: isMobileView ? 20 : 30, color: color || '#c8ffe0', marginTop: isMobileView ? 3 : 5, lineHeight: 1 }}>{value}</div>
                          {caption && <div style={{ fontSize: isMobileView ? 7 : 8.5, letterSpacing: '0.08em', color: '#3a6b54', marginTop: 3 }}>{caption}</div>}
                        </div>
                      );
                      return (
                        <>
                          {/* Vindication quote — floats above the ribbon. Only
                              shown in the final phase so the line lands as a
                              payoff, not a footnote. */}
                          {vindicated && (
                            <div
                              style={{
                                width: isMobileView ? 'min(720px, calc(100vw - 24px))' : 'min(620px, 64vw)',
                                padding: '10px 16px 11px',
                                border: '1px solid rgba(255,62,160,0.45)',
                                // Accent on the left in the mobile sheet, on top
                                // when it's the centered desktop banner.
                                borderLeft: isMobileView ? '3px solid #ff3ea0' : '1px solid rgba(255,62,160,0.45)',
                                borderTop: isMobileView ? '1px solid rgba(255,62,160,0.45)' : '3px solid #ff3ea0',
                                borderRadius: 8,
                                // Desktop: float the debrief as a centered banner
                                // at the top of the scene (the score panel docks
                                // right). Mobile: in-flow in the bottom sheet.
                                ...(isMobileView ? {} : {
                                  position: 'fixed',
                                  top: '1.5rem',
                                  left: '50%',
                                  transform: 'translateX(-50%)',
                                  zIndex: 10600,
                                  textAlign: 'center',
                                }),
                                // Solid, blurred backing so the debrief stays
                                // legible over the bright curtain-call scene
                                // (was a gradient that faded to transparent).
                                background: 'linear-gradient(180deg, rgba(22,6,17,0.94), rgba(6,2,10,0.9))',
                                backdropFilter: 'blur(10px)',
                                WebkitBackdropFilter: 'blur(10px)',
                                boxShadow: '0 0 22px rgba(255,62,160,0.22)',
                                color: '#ffeaf5',
                                fontFamily: "'IBM Plex Mono','SF Mono',Menlo,monospace",
                                fontStyle: 'italic',
                                fontSize: 13,
                                lineHeight: 1.4,
                                pointerEvents: 'auto',
                                ...fadeIn(true),
                                // Re-assert the centering transform AFTER fadeIn,
                                // which would otherwise overwrite it with
                                // translateY(0) and leave the quote off-center.
                                ...(isMobileView ? {} : { transform: 'translateX(-50%)' }),
                              }}
                            >
                              <div style={{
                                fontStyle: 'normal',
                                fontSize: 9,
                                letterSpacing: '0.24em',
                                color: 'rgba(255,160,205,0.95)',
                                marginBottom: 4,
                              }}>
                                // {vindicationDelivery ? vindicationDelivery.character.toUpperCase() : 'THE TERMINAL'} · DEBRIEF
                              </div>
                              "{vindicationDelivery ? vindicationDelivery.text : caseData.reveal.voices[verdict]}"
                            </div>
                          )}

                          <div
                            className="reveal-ribbon"
                            onClick={(e) => e.stopPropagation()}
                            style={{
                              width: isMobileView ? 'min(960px, calc(100vw - 24px))' : 'min(360px, 34vw)',
                              display: 'flex',
                              flexDirection: isMobileView ? 'row' : 'column',
                              alignItems: 'stretch',
                              gap: 0,
                              padding: '10px 14px',
                              background: 'linear-gradient(180deg, rgba(4,12,8,0.92), rgba(2,5,8,0.86))',
                              border: '1px solid rgba(77,255,170,0.55)',
                              borderRadius: 10,
                              boxShadow: '0 0 28px rgba(77,255,170,0.22)',
                              backdropFilter: 'blur(10px)',
                              WebkitBackdropFilter: 'blur(10px)',
                              color: '#c8ffe0',
                              fontFamily: "'IBM Plex Mono','SF Mono',Menlo,monospace",
                              pointerEvents: 'auto',
                              flexWrap: 'wrap',
                            }}
                          >
                            {/* Cell A — verdict glyph + label */}
                            <div style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 12,
                              paddingRight: 14,
                              ...(isMobileView
                                ? { borderRight: '1px solid rgba(77,255,170,0.18)' }
                                : { borderBottom: '1px solid rgba(77,255,170,0.18)', paddingBottom: 10 }),
                              minWidth: 168,
                            }}>
                              <div style={{
                                fontSize: 44,
                                lineHeight: 1,
                                color: verdictColor,
                                textShadow: verdictGlow,
                                transform: revealed ? 'scale(1)' : 'scale(0.92)',
                                transition: 'color 0.6s ease, text-shadow 0.6s ease, transform 0.6s ease',
                              }}>
                                {revealed ? (isCorrect ? '✓' : isAbstain ? '◇' : '✗') : '◌'}
                              </div>
                              <div style={{ display: 'flex', flexDirection: 'column' }}>
                                <div style={{ fontSize: 8, letterSpacing: '0.28em', color: '#3a6b54' }}>YOU RENDERED</div>
                                <div style={{
                                  fontFamily: "'Cinzel Decorative','Cinzel',serif",
                                  fontSize: 18,
                                  letterSpacing: '0.22em',
                                  color: '#8effc4',
                                  marginTop: 2,
                                  lineHeight: 1.1,
                                }}>
                                  {verdict.toUpperCase()}
                                </div>
                              </div>
                            </div>

                            {/* Cell B — weighing pulse, OR ground-truth summary */}
                            <div style={{
                              flex: '1 1 220px',
                              minWidth: 220,
                              padding: isMobileView ? '2px 14px' : '10px 0',
                              ...(isMobileView
                                ? { borderRight: '1px solid rgba(77,255,170,0.18)' }
                                : { borderBottom: '1px solid rgba(77,255,170,0.18)' }),
                              display: 'flex',
                              flexDirection: 'column',
                              justifyContent: 'center',
                            }}>
                              {!revealed ? (() => {
                                // During the weighing beat the focused character
                                // speaks their immediate verdict reaction — show
                                // that line as text (the transcript panel is gone
                                // once a verdict is committed, so it has nowhere
                                // else to surface).
                                const reactionResolved = resolveLine(activeReaction?.text);
                                const reactionText = reactionResolved?.text;
                                const reactionChar = activeReaction?.stationKey
                                  ? caseData.stations[activeReaction.stationKey]?.character
                                  : null;
                                const weighing = (
                                  <div style={{
                                    fontSize: 9,
                                    letterSpacing: '0.24em',
                                    color: '#6db59a',
                                    animation: 'verdictWeighPulse 1.6s ease-in-out infinite',
                                  }}>
                                    // WEIGHING EVIDENCE<span className="reveal-dots" />
                                  </div>
                                );
                                if (!reactionText) {
                                  return (
                                    <div style={{ fontSize: 11, letterSpacing: '0.26em' }}>{weighing}</div>
                                  );
                                }
                                return (
                                  <div style={fadeIn(true)}>
                                    <div style={{ fontSize: 8, letterSpacing: '0.26em', color: '#3a6b54', marginBottom: 3 }}>
                                      // {(reactionChar || 'THE TERMINAL').toUpperCase()}
                                    </div>
                                    <div style={{
                                      fontFamily: "'IBM Plex Mono','SF Mono',Menlo,monospace",
                                      fontStyle: 'italic',
                                      fontSize: 12.5,
                                      color: '#c8ffe0',
                                      lineHeight: 1.4,
                                      marginBottom: 5,
                                    }}>
                                      "{reactionText}"
                                    </div>
                                    {weighing}
                                  </div>
                                );
                              })() : (
                                <div style={fadeIn(true)}>
                                  <div style={{ fontSize: 8, letterSpacing: '0.26em', color: '#3a6b54', marginBottom: 3 }}>// GROUND TRUTH</div>
                                  <div style={{
                                    fontFamily: "'Cinzel Decorative','Cinzel',serif",
                                    fontSize: 13,
                                    color: '#c8ffe0',
                                    lineHeight: 1.35,
                                  }}>
                                    {caseData.reveal.summary}
                                  </div>
                                  {lensNote && (
                                    <div style={{
                                      marginTop: 6,
                                      fontSize: 9.5,
                                      lineHeight: 1.4,
                                      letterSpacing: '0.02em',
                                      color: missedDecisive.length === 0 ? '#7fe6b3' : '#f0c98a',
                                    }}>
                                      <span style={{ letterSpacing: '0.22em', color: '#3a6b54' }}>// LENS · </span>
                                      {lensNote}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>

                            {/* Cell C — stats. Inline on mobile (row sheet) and
                                in-flow on desktop (vertical panel): a centered
                                wrapping row of stat blocks. */}
                            {revealed && (
                              <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                flexWrap: 'wrap',
                                justifyContent: 'center',
                                gap: 14,
                                ...(isMobileView
                                  ? { padding: '2px 14px', borderRight: '1px solid rgba(77,255,170,0.18)' }
                                  : { width: '100%', padding: '10px 0 0', borderTop: '1px solid rgba(77,255,170,0.18)' }),
                                ...fadeIn(true),
                              }}>
                                {confPct != null && statBlock('YOUR CALL', `${confPct}%`, isAbstain ? '#dcdce4' : (isCorrect ? '#8effc4' : '#ff8a8a'), 'P(scam)')}
                                {statBlock('BRIER', hasBrier ? brier.toFixed(3) : '—', gradeColor, '0 = perfect')}
                                {statBlock('GRADE', grade, gradeColor)}
                                {statBlock('SCANS', `${investigated.size}/${caseData.maxScans}`)}
                                {sessionScore && sessionScore.count > 0 && (
                                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 92, paddingLeft: 14, borderLeft: '1px solid rgba(77,255,170,0.18)' }}>
                                    <div style={{ fontSize: 8, letterSpacing: '0.20em', color: '#3a6b54' }}>SESSION ·{sessionScore.count}</div>
                                    <div style={{ fontFamily: "'IBM Plex Mono','SF Mono',Menlo,monospace", fontSize: 11, color: '#c8ffe0', marginTop: 4, lineHeight: 1.5, textAlign: 'center' }}>
                                      <div>avg <span style={{ color: '#8effc4' }}>{avgB != null ? avgB.toFixed(3) : '—'}</span>{acc != null ? ` · ${Math.round(acc * 100)}%` : ''}</div>
                                      <div style={{ color: '#6db59a' }}>streak {sessionScore.streak}{sessionScore.bestStreak > 0 ? ` (best ${sessionScore.bestStreak})` : ''}</div>
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Actions (NEXT CASE / BACK) live in the bottom-nav
                                center slot during the reveal, not in this panel. */}

                            {/* Plain-language explainer — most players won't know
                                what a Brier score is. Wraps to its own line along
                                the bottom of the ribbon. */}
                            {revealed && hasBrier && (
                              <div style={{
                                width: '100%',
                                marginTop: 8,
                                paddingTop: 8,
                                borderTop: '1px solid rgba(77,255,170,0.12)',
                                fontSize: 9.5,
                                lineHeight: 1.5,
                                color: '#6db59a',
                                letterSpacing: '0.02em',
                                ...fadeIn(vindicated),
                              }}>
                                <span style={{ letterSpacing: '0.22em', color: '#3a6b54', marginRight: 8 }}>// SCORING</span>
                                Brier measures how well your confidence matched reality — <strong style={{ color: '#8effc4', fontWeight: 700 }}>0 is a perfect call</strong>, and lower is always better. Confident-and-right scores lowest, confident-and-wrong worst; sitting near 50% (Abstain) lands in the middle.
                              </div>
                            )}
                          </div>
                        </>
                      );
                    })()
                    }
                  </div>,
                  document.body
                )}
              <MobileBottomNav
                  hideWallet
                  accountOnLeft
                /* Lobby center is the round START FAB — consistent with the
                   shrine's MY CANDLE FAB. onBuyClick is the FAB's action and
                   opens the services drawer. In game/review modes the
                   centerSlot below overrides the FAB with the verdict UI. */
                onBuyClick={() => {
                  if (railExpanded) {
                    setRailExpanded(false);
                  } else {
                    setFocusedAgent(null);
                    setRailExpanded(true);
                  }
                }}
                centerLabel={
                  <svg viewBox="0 0 24 24" fill="currentColor" style={{ width: 26, height: 26, display: 'block', color: '#ffffff' }} aria-hidden="true">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                }
                centerSubLabel="START"
                centerTitle="Open services"
                centerHighlight={railExpanded}
                centerSlot={
                  // Once a verdict is committed the verdict control is dropped
                  // and, in the final reveal beat, replaced with the NEXT CASE /
                  // BACK actions (moved here out of the score panel).
                  tradeMode === 'game' && verdict ? (
                    revealPhase === 'vindicate' ? (
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'center' }}>
                        <button
                          onClick={advanceToNextCase}
                          disabled={!nextCaseAvailable}
                          title={nextCaseAvailable ? undefined : 'More cases coming soon'}
                          style={{
                            height: 60,
                            padding: '0 18px',
                            borderRadius: 10,
                            background: nextCaseAvailable
                              ? 'linear-gradient(135deg, rgba(77,255,170,0.22), rgba(13,80,50,0.34))'
                              : 'rgba(20,30,40,0.45)',
                            border: `1px solid ${nextCaseAvailable ? 'rgba(120,255,180,0.95)' : 'rgba(77,255,170,0.25)'}`,
                            color: nextCaseAvailable ? '#d6ffe5' : 'rgba(142,255,196,0.35)',
                            fontFamily: "'Orbitron', monospace",
                            fontSize: 12,
                            fontWeight: 800,
                            letterSpacing: '0.14em',
                            cursor: nextCaseAvailable ? 'pointer' : 'not-allowed',
                            textShadow: nextCaseAvailable ? '0 0 10px rgba(77,255,170,0.5)' : 'none',
                            boxShadow: nextCaseAvailable
                              ? '0 0 14px rgba(77,255,170,0.35), inset 0 1px 0 rgba(255,255,255,0.1)'
                              : 'none',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {nextCaseAvailable ? '▸ NEXT CASE' : '▸ NEXT — SOON'}
                        </button>
                        <button
                          onClick={returnToServiceRail}
                          style={{
                            height: 60,
                            padding: '0 16px',
                            borderRadius: 10,
                            background: 'rgba(20,30,40,0.45)',
                            border: '1px solid rgba(110,181,154,0.6)',
                            color: '#9ed6bb',
                            fontFamily: "'Orbitron', monospace",
                            fontSize: 12,
                            fontWeight: 800,
                            letterSpacing: '0.14em',
                            cursor: 'pointer',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          ▸ BACK
                        </button>
                      </div>
                    ) : null
                  )
                  : tradeMode === 'game' && isReviewMode ? (
                    // Review mode — the team renders the verdict, not
                    // the player. Single READ TEAM VERDICT button stays
                    // disabled until they've asked at least one question
                    // (otherwise the consensus screen would render
                    // before they've engaged with any character).
                    (() => {
                      const enabled = investigated.size > 0 && !verdict;
                      return (
                        <button
                          type="button"
                          onClick={() => { if (enabled) revealTeamVerdict(); }}
                          disabled={!enabled}
                          aria-label="Read the team's verdict on this token"
                          title={enabled
                            ? "Read the team's consensus"
                            : "Talk to at least one character first"}
                          style={{
                            minWidth: 220,
                            height: 60,
                            padding: '10px 18px',
                            borderRadius: 10,
                            background: enabled
                              ? 'linear-gradient(135deg, rgba(142,233,255,0.20), rgba(13,50,80,0.32))'
                              : 'rgba(20,30,40,0.45)',
                            border: `1px solid ${enabled ? 'rgba(142,233,255,0.85)' : 'rgba(142,233,255,0.25)'}`,
                            color: enabled ? '#c8efff' : 'rgba(200,239,255,0.35)',
                            fontFamily: "'Orbitron', monospace",
                            fontSize: 12,
                            fontWeight: 800,
                            letterSpacing: '0.18em',
                            cursor: enabled ? 'pointer' : 'not-allowed',
                            textShadow: enabled ? '0 0 10px rgba(142,233,255,0.55)' : 'none',
                            boxShadow: enabled
                              ? '0 0 14px rgba(142,233,255,0.35), inset 0 1px 0 rgba(255,255,255,0.1)'
                              : 'none',
                          }}
                        >
                          ✦ READ TEAM VERDICT
                        </button>
                      );
                    })()
                  ) : tradeMode === 'game' ? (
                    // Forensic (graded) case — calibrated confidence slider.
                    // The player sets P(scam); the committed probability buckets
                    // to believe/abstain/doubt only for the character reaction.
                    <ConfidenceVerdict
                      enabled={investigated.size > 0 && !verdict}
                      isMobileView={isMobileView}
                      disabledHint="Investigate at least one station first"
                      onCommit={(p, bucket) => submitVerdict(bucket, p)}
                    />
                  ) : (
                    // Lobby → no centerSlot override, so the round START FAB
                    // (centerLabel/centerSubLabel above) renders, matching the
                    // shrine's center FAB. The FAB's onBuyClick opens the
                    // services drawer; each service launches from its own card.
                    null
                  )
                }
                /* Shared app-nav slots (lobby only): a cross-link back to the
                   shrine on the left, Hail Mary on the right — mirrors the
                   shrine's BUY | Terminal | CANDLE | Hail Mary | MORE layout.
                   Suppressed in game/review so the immersive nav stays minimal
                   and can't bypass the leave-game confirm. */
                extraLeft={
                  tradeMode ? [] : [
                    {
                      key: 'shrine',
                      label: 'Shrine',
                      title: 'Our Lady of Perpetual Profit',
                      onClick: () => router.push('/'),
                      icon: (
                        <img src="/images/flame.svg" alt="" style={{ width: 24, height: 24, display: 'block' }} />
                      ),
                    },
                  ]
                }
                extraRight={
                  tradeMode ? [] : [
                    {
                      key: 'hailmary',
                      label: 'Hail Mary',
                      title: 'Hail Mary Prospecting Co — coming soon',
                      onClick: () => router.push('/hailmary'),
                      icon: (
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#ff5db1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 24, height: 24, display: 'block' }} aria-hidden="true">
                          <path d="m14 13-8.381 8.38a1 1 0 0 1-3.001-3L11 9.999" />
                          <path d="M15.973 4.027A13 13 0 0 0 5.902 2.373c-1.398.342-1.092 2.158.277 2.601a19.9 19.9 0 0 1 5.822 3.024" />
                          <path d="M16.001 11.999a19.9 19.9 0 0 1 3.024 5.824c.444 1.369 2.26 1.676 2.603.278A13 13 0 0 0 20 8.069" />
                          <path d="M18.352 3.352a1.205 1.205 0 0 0-1.704 0l-5.296 5.296a1.205 1.205 0 0 0 0 1.704l2.296 2.296a1.205 1.205 0 0 0 1.704 0l5.296-5.296a1.205 1.205 0 0 0 0-1.704z" />
                        </svg>
                      ),
                    },
                  ]
                }
                /* Right slot: lobby → MORE popover (matches the shrine);
                   game mode → MENU so the path picker is reachable (verdict
                   buttons have taken the center). Book slot (left) is BUY.
                   Mid-case (game, no verdict yet) → confirm first so a stray
                   tap doesn't nuke an in-progress investigation. */
                onMenuClick={
                  tradeMode === 'game'
                    ? (verdict ? returnToServiceRail : () => setShowLeaveGameConfirm(true))
                    : () => setShowMoreMenu((v) => !v)
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
                      <circle cx="12" cy="12" r="10" />
                      <path d="M17 12h.01" />
                      <path d="M12 12h.01" />
                      <path d="M7 12h.01" />
                    </svg>
                  )
                }
                menuLabel={tradeMode === 'game' ? 'MENU' : 'MORE'}
                isUserSignedIn={isSignedIn}
                userImage={user?.imageUrl}
                show80sButton={false}
                isMobile
                is80sMode
                onBookClick={() => setShowBuyModal(true)}
                bookLabel="BUY RL80"
                bookTitle="Buy RL80"
                bookIcon={
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 22, height: 22, color: '#d4a854' }}>
                    <line x1="12" y1="1" x2="12" y2="23" />
                    <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                  </svg>
                }
              />
            </>

            {/* MORE popover — secondary destinations; mirrors the shrine's
                MORE menu so the nav system reads the same across pages.
                Lobby-only (the lobby right slot is MORE). */}
            {showMoreMenu && (
              <>
                <div
                  onClick={() => setShowMoreMenu(false)}
                  style={{ position: 'fixed', inset: 0, zIndex: 10001, background: 'transparent' }}
                />
                <div
                  role="menu"
                  aria-label="More"
                  style={{
                    position: 'fixed',
                    right: '10px',
                    bottom: 'calc(74px + env(safe-area-inset-bottom, 0px))',
                    zIndex: 10002,
                    display: 'flex',
                    flexDirection: 'column',
                    minWidth: '184px',
                    padding: '6px',
                    borderRadius: '14px',
                    background: 'rgba(15, 0, 30, 0.97)',
                    border: '1px solid rgba(255, 0, 255, 0.3)',
                    backdropFilter: 'blur(20px)',
                    WebkitBackdropFilter: 'blur(20px)',
                    boxShadow: '0 -2px 24px rgba(255, 0, 255, 0.18), 0 8px 32px rgba(0, 0, 0, 0.5)',
                    fontFamily: "'Rajdhani', sans-serif",
                  }}
                >
                  {[
                    {
                      path: '/fountain',
                      label: 'Coin Fountain',
                      icon: (
                        <>
                          <path d="M12 10L12 2" />
                          <path d="M16 6L12 10L8 6" />
                          <path d="M2 15C2.6 15.5 3.2 16 4.5 16C7 16 7 14 9.5 14C12.1 14 11.9 16 14.5 16C17 16 17 14 19.5 14C20.8 14 21.4 14.5 22 15" />
                          <path d="M2 21C2.6 21.5 3.2 22 4.5 22C7 22 7 20 9.5 20C12.1 20 11.9 22 14.5 22C17 22 17 20 19.5 20C20.8 20 21.4 20.5 22 21" />
                        </>
                      ),
                    },
                    {
                      path: '/exlibris',
                      label: 'Ex Libris',
                      icon: (
                        <>
                          <path d="M15 12h-5" />
                          <path d="M15 8h-5" />
                          <path d="M19 17V5a2 2 0 0 0-2-2H4" />
                          <path d="M8 21h12a2 2 0 0 0 2-2v-1a1 1 0 0 0-1-1H11a1 1 0 0 0-1 1v1a2 2 0 1 1-4 0V5a2 2 0 1 0-4 0v2a1 1 0 0 0 1 1h3" />
                        </>
                      ),
                    },
                  ].map((link) => (
                    <button
                      key={link.path}
                      role="menuitem"
                      onClick={() => { setShowMoreMenu(false); router.push(link.path); }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        width: '100%',
                        padding: '11px 12px',
                        borderRadius: '10px',
                        border: 'none',
                        background: 'transparent',
                        cursor: 'pointer',
                        textAlign: 'left',
                        transition: 'background 0.15s ease',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255, 0, 255, 0.12)')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="#ff00ff"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        style={{ width: 22, height: 22, flexShrink: 0, display: 'block' }}
                        aria-hidden="true"
                      >
                        {link.icon}
                      </svg>
                      <span style={{ fontSize: '0.95rem', fontWeight: 700, letterSpacing: '0.5px', textTransform: 'uppercase', color: '#ffffff' }}>
                        {link.label}
                      </span>
                    </button>
                  ))}
                </div>
              </>
            )}

            {/* Mobile "coming soon" notice — shown when START is tapped on
                mobile, where the case player isn't wired yet. */}
            {mobileSoon && (
              <div
                onClick={() => setMobileSoon(false)}
                style={{
                  position: 'fixed',
                  left: '50%',
                  bottom: 'calc(96px + env(safe-area-inset-bottom, 0px))',
                  transform: 'translateX(-50%)',
                  zIndex: 10050,
                  maxWidth: 'calc(100vw - 32px)',
                  padding: '10px 16px',
                  borderRadius: 10,
                  background: 'rgba(8, 12, 18, 0.92)',
                  border: '1px solid rgba(77, 255, 170, 0.5)',
                  boxShadow: '0 0 18px rgba(77, 255, 170, 0.2)',
                  backdropFilter: 'blur(8px)',
                  WebkitBackdropFilter: 'blur(8px)',
                  color: '#c8ffe0',
                  fontFamily: "'IBM Plex Mono', 'SF Mono', Menlo, monospace",
                  fontSize: 12,
                  letterSpacing: '0.04em',
                  textAlign: 'center',
                }}
              >
                Cases play on desktop — mobile coming soon.
              </div>
            )}

            {/* Buy Modal — triggered from the repurposed menu slot */}
            <BuyModal
              isOpen={showBuyModal}
              onClose={() => setShowBuyModal(false)}
            />

            {/* Token Review funnel — triggered from the service-rail tile.
                On Confirm, the funnel hands back a case-file-shaped object
                generated from the resolved token. Next step will route that
                object into the game machinery (tradeMode === 'review'); for
                now we just log and close, matching the "step 1 funnel only"
                scope. */}
            <ReviewFunnel
              isOpen={showReviewFunnel}
              onClose={() => setShowReviewFunnel(false)}
              onConfirm={(generatedCase) => {
                setShowReviewFunnel(false);
                enterReviewMode(generatedCase);
              }}
            />

            {/* Leave-game confirm — fires when the bottom-nav MENU is tapped
                during an active case. Post-verdict the MENU passes through
                without prompting (the case is already resolved). */}
            {showLeaveGameConfirm && typeof document !== 'undefined' &&
              createPortal(
                <div
                  onClick={() => setShowLeaveGameConfirm(false)}
                  style={{
                    position: 'fixed',
                    inset: 0,
                    zIndex: 11000,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: 16,
                    background: 'rgba(2,5,8,0.62)',
                    backdropFilter: 'blur(6px)',
                    WebkitBackdropFilter: 'blur(6px)',
                  }}
                >
                  <div
                    onClick={(e) => e.stopPropagation()}
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="leave-game-title"
                    style={{
                      width: 'min(420px, 100%)',
                      padding: '18px 18px 16px',
                      background: 'linear-gradient(180deg, rgba(4,12,8,0.94), rgba(2,5,8,0.9))',
                      border: '1px solid rgba(77,255,170,0.55)',
                      borderRadius: 12,
                      boxShadow: '0 0 28px rgba(77,255,170,0.22)',
                      color: '#c8ffe0',
                      fontFamily: "'IBM Plex Mono','SF Mono',Menlo,monospace",
                    }}
                  >
                    <div
                      id="leave-game-title"
                      style={{
                        fontFamily: "'Cinzel Decorative','Cinzel',serif",
                        fontSize: 18,
                        letterSpacing: '0.12em',
                        color: '#8effc4',
                        textShadow: '0 0 12px rgba(77,255,170,0.4)',
                        marginBottom: 8,
                      }}
                    >
                      LEAVE CASE FILE?
                    </div>
                    <div style={{ fontSize: 13, lineHeight: 1.45, color: '#a8d8c2', marginBottom: 16 }}>
                      Your scans, notes, and progress on this case will be discarded. You can pick a new path from the lobby.
                    </div>
                    <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                      <button
                        type="button"
                        onClick={() => setShowLeaveGameConfirm(false)}
                        style={{
                          padding: '9px 16px',
                          background: 'transparent',
                          color: '#c8ffe0',
                          border: '1px solid rgba(77,255,170,0.35)',
                          borderRadius: 8,
                          fontFamily: 'inherit',
                          fontSize: 12,
                          letterSpacing: '0.18em',
                          cursor: 'pointer',
                        }}
                      >
                        STAY
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowLeaveGameConfirm(false);
                          returnToServiceRail();
                        }}
                        style={{
                          padding: '9px 16px',
                          background: 'rgba(255,77,109,0.14)',
                          color: '#ff8aa0',
                          border: '1px solid rgba(255,77,109,0.55)',
                          borderRadius: 8,
                          fontFamily: 'inherit',
                          fontSize: 12,
                          letterSpacing: '0.18em',
                          cursor: 'pointer',
                          textShadow: '0 0 8px rgba(255,77,109,0.35)',
                        }}
                      >
                        LEAVE CASE
                      </button>
                    </div>
                  </div>
                </div>,
                document.body
              )
            }

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
                if (liveEntry && stationForScreen && hasRichVisual(caseData.id, stationKey, liveEntry)) {
                  return (
                    <EvidenceOverlay
                      isActive={true}
                      caseId={caseData.id}
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
