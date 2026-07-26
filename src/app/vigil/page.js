"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import dynamic from "next/dynamic";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader";
import CoinLoader from "@/components/CoinLoader";
import CyberButton from "@/components/CyberButton";
import CharacterSelect from "@/components/CharacterSelect";
import GlitchTransition from "@/components/GlitchTransition";
import BuyModal from "@/components/BuyModal";
import { useBuyModal } from "@/lib/useBuyModal";
import Confessional from "@/components/Confessional";
import SitePalExpressionPanel from "@/components/SitePalExpressionPanel";
import { askOracle, speakOracle, ORACLE_VOICE, pickGreeting } from "@/lib/oracleSpeech";
import { APPARITIONS as CHARACTERS } from "@/lib/apparitions";
import ApparitionTriptych from "@/components/ApparitionTriptych";
import { readApparitionKey, writeApparitionKey } from "@/lib/apparitionPrefs";
import { useMusic } from "@/components/MusicContext";
import MobileBottomNav from "@/components/MobileBottomNav";
import MainVigilPanel from "@/components/MainVigilPanel";
import GraceOfRecord from "@/components/GraceOfRecord";
import { readGrace, mintBlessing } from "@/lib/grace";
import useCyberConfirm from "@/components/useCyberConfirm";
import DropInTitle from "@/components/DropInTitle";

// The /main roster is Our Lady's APPARITIONS — her cultural faces (see
// src/lib/apparitions.js), imported above as CHARACTERS. The other pantheon
// characters live on their own pages, not in her shrine's carousel.
// (Former /main cameos, kept for reference:
//   { name: "Saint GR80", image: "/cameo_GR80.webp", model: "/models/GR80.glb", defaultAnim: "walk", frameHue: "#22ccff" },
//   { name: "H80Z", image: "/cameo_h80z.webp", model: "/models/H80Z.glb", defaultAnim: "skateSequence", frameHue: "#ff2d75" },
//   { name: "Virgil", image: "/cameo_kitty.webp", model: "/models/fluffyCat.glb", defaultAnim: "walk", frameHue: "#52ff7a" }, )

// Scene GLBs that aren't character models
const SCENE_GLBS = [
  "/models/Sun.glb",
  "/models/wireframePalmTree.glb",
  "/models/neonFrame.glb",
  "/models/framedOurLady2.glb",
];

function preloadImage(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = resolve;
    img.onerror = resolve; // don't block on failure
    img.src = src;
  });
}

function preloadGLB(url) {
  return fetch(url).then((r) => r.arrayBuffer()).catch(() => {});
}

// Fully parse a GLB with GLTFLoader so it's GPU-ready when the scene mounts
function preloadGLBParsed(url) {
  return new Promise((resolve) => {
    const loader = new GLTFLoader();
    const draco = new DRACOLoader();
    const dracoPath =
      typeof window !== "undefined" && window.location.hostname !== "localhost"
        ? `${window.location.origin}/draco/`
        : "/draco/";
    draco.setDecoderPath(dracoPath);
    loader.setDRACOLoader(draco);
    loader.load(url, (gltf) => {
      // Dispose parsed scene — we only wanted to warm the cache
      gltf.scene.traverse((child) => {
        if (child.isMesh) {
          child.geometry?.dispose();
          const mats = Array.isArray(child.material) ? child.material : [child.material];
          mats.forEach((m) => m?.dispose());
        }
      });
      draco.dispose();
      resolve();
    }, undefined, () => { draco.dispose(); resolve(); });
  });
}

// Toggle this to switch between video file and SitePal embed
const USE_SITEPAL = true;

// The page heading is now the shared DropInTitle component ("Our Lady of
// Perpetual Profit"), rendered in the panel below — see the JSX. (The former
// gold-neon-tube "Ask RL80" <h1> lives in git history if we want it back.)

// Her opening line — shown by the Confessional's typewriter AND spoken aloud
// on first drawer open
// Her opening lines now come from ORACLE_GREETINGS in lib/oracleSpeech.js —
// one is picked per visit and used for both the drawer text and the audio.

// SitePal embed config. Each apparition is its OWN embed (its own scene + token);
// SitePalEmbed builds the AC_VHost_Embed params from the active apparition. We
// re-embed FRESH per apparition (page reload via ?char) rather than swapping in
// place with loadSceneByID — the latter leaves the new scene's audio subsystem
// null ("setAudioElementMode of null") so she won't speak.
const SITEPAL_ACCOUNT = "9308752";
const SITEPAL_DEFAULT_SCENE = 2775218; // Our Lady's classic 2D scene
const SITEPAL_DEFAULT_EMBEDID = "zJsmiZ8gNv9BHZ93vMq3antYxZOiHmlX";

function SitePalEmbed({ scene = SITEPAL_DEFAULT_SCENE, embedId = SITEPAL_DEFAULT_EMBEDID, onReady }) {
  const containerRef = useRef(null);
  // Keep the latest onReady without re-running the mount-only effect below.
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;

  useEffect(() => {
    // Fire onReady on EVERY vh_sceneLoaded — the initial load AND every
    // loadSceneByID apparition swap — so the summoning swirl can re-hold and
    // re-reveal per face (the page drops sitePalReady to false on each switch).
    const markReady = () => {
      onReadyRef.current?.();
    };

    // Monkey-patch WebGL getContext to force preserveDrawingBuffer
    // so we can read SitePal's canvas each frame via drawImage
    const origGetContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, attrs) {
      if (type === "webgl" || type === "webgl2" || type === "experimental-webgl") {
        attrs = { ...attrs, preserveDrawingBuffer: true };
      }
      return origGetContext.call(this, type, attrs);
    };

    // Load the SitePal embed script
    const script1 = document.createElement("script");
    script1.src = `//vhss-d.oddcast.com/vhost_embed_functions_v4.php?acc=${SITEPAL_ACCOUNT}&js=0`;
    script1.type = "text/javascript";

    script1.onload = () => {
      const script2 = document.createElement("script");
      script2.type = "text/javascript";
      // Params from the active apparition — scene is #7, embedId is #11; load=1
      // (JS framework), responsive=1. Fresh embed => her audio comes up right.
      const params = `${SITEPAL_ACCOUNT},600,800,"",1,0,${scene},0,1,0,"${embedId}",0,1`;
      script2.textContent = `AC_VHost_Embed(${params});`;
      containerRef.current?.appendChild(script2);

      // Restore original getContext after SitePal has initialized
      setTimeout(() => {
        HTMLCanvasElement.prototype.getContext = origGetContext;
      }, 5000);

      // Paint the SitePal canvas background with skin tone once it appears
      const paintBg = setInterval(() => {
        const canvas = containerRef.current?.querySelector("canvas");
        if (canvas) {
          canvas.style.backgroundColor = "#af9682";
          clearInterval(paintBg);
        }
      }, 200);
      setTimeout(() => clearInterval(paintBg), 10000);
    };

    document.head.appendChild(script1);

    // Register vh_sceneLoaded callback — mute SitePal on load so it doesn't
    // talk until Talking mode, and signal the page that her face is fully
    // loaded & displayed so the magic-mirror swirl can dissolve to reveal her.
    // (Per SitePal docs, vh_sceneLoaded = "Scene is fully loaded & displayed".)
    window.vh_sceneLoaded = () => {
      if (typeof window.setPlayerVolume === "function") {
        window.setPlayerVolume(0);
      }
      markReady();
    };

    // Safety net: if the scene callback never arrives (network / SitePal
    // failure), reveal anyway after 20s so the swirl can't spin forever.
    const readyFallback = setTimeout(markReady, 20000);

    // Resume suspended AudioContexts on first user interaction
    // Don't unmute audio/video — the scene controls muting based on active animation
    const resumeAudio = () => {
      // SitePal JS Framework page activation (required per docs)
      if (typeof window.saySilent === "function") {
        window.saySilent(0);
      }
      const OrigAudioCtx = window.AudioContext || window.webkitAudioContext;
      if (OrigAudioCtx && OrigAudioCtx._instances) {
        OrigAudioCtx._instances.forEach((ctx) => ctx.resume());
      }
      if (window._vhssAudioCtx) window._vhssAudioCtx.resume();
    };
    window.addEventListener("click", resumeAudio);
    window.addEventListener("touchstart", resumeAudio);

    // Patch AudioContext to track instances for later resuming
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

    return () => {
      clearTimeout(readyFallback);
      if (script1.parentNode) script1.parentNode.removeChild(script1);
      window.removeEventListener("click", resumeAudio);
      window.removeEventListener("touchstart", resumeAudio);
      delete window.vh_sceneLoaded;
      // Clean up SitePal DOM contents
      if (containerRef.current) {
        containerRef.current.innerHTML = "";
      }
    };
  }, []);

  return (
    <div
      id="sitepal-container"
      ref={containerRef}
      style={{
        position: "fixed",
        left: -9999,
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

export default function VigilPage() {
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth < 768 : false
  );
  // Wide enough to flank the centered portrait with the two triptych side
  // panels (Confessional left, Vigil right) without crowding the 440px center.
  // Below this we keep the center-only layout.
  const [isWide, setIsWide] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth >= 1200 : false
  );
  const [isLoading, setIsLoading] = useState(true);
  const [sceneReady, setSceneReady] = useState(false);
  // True once SitePal's avatar has actually loaded & displayed (vh_sceneLoaded).
  // Gates the magic-mirror swirl so it dissolves only when her face is ready.
  const [sitePalReady, setSitePalReady] = useState(false);
  const handleSitePalReady = useCallback(() => setSitePalReady(true), []);
  // First-visit apparition chooser is DISABLED for now — the page just
  // defaults to Byzantine Protocol (CHARACTERS[0], the "classic" face) for
  // anyone who hasn't explicitly picked via ?char or a stored preference
  // (see the activeCharIndex initializer, which falls back to index 0).
  // Restore the commented initializer below to re-open the triptych.
  const [pickerOpen, setPickerOpen] = useState(false);
  // const [pickerOpen, setPickerOpen] = useState(() => {
  //   if (typeof window === "undefined") return false;
  //   const params = new URLSearchParams(window.location.search);
  //   const char = parseInt(params.get("char"), 10);
  //   if (!isNaN(char) && char >= 0 && char < CHARACTERS.length) return false;
  //   return !CHARACTERS.some((c) => c.key === readApparitionKey());
  // });
  // An explicit ?char deep link (incl. the arrow/medallion reload) is a
  // choice too — remember it so the triptych never re-asks this device.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const char = parseInt(params.get("char"), 10);
    if (!isNaN(char) && char >= 0 && char < CHARACTERS.length) {
      writeApparitionKey(CHARACTERS[char].key);
    }
  }, []);
  // Safety: never let the summoning swirl hang. Whenever we're waiting on a
  // SitePal scene (sitePalReady false — initial load OR an apparition swap),
  // force-reveal after 15s if vh_sceneLoaded never arrives. While the
  // triptych is open no embed is mounted at all — don't start the countdown
  // until a face has been chosen.
  useEffect(() => {
    if (sitePalReady || pickerOpen) return;
    const t = setTimeout(() => setSitePalReady(true), 15000);
    return () => clearTimeout(t);
  }, [sitePalReady, pickerOpen]);

  // Her greeting text appears a beat AFTER she's fully revealed. The summoning
  // swirl takes ~3.6s to dissolve past sitePalReady, so wait a touch longer
  // (~2.4s after) so the welcome never types itself out before her face.
  const [greetingVisible, setGreetingVisible] = useState(false);
  useEffect(() => {
    if (!sitePalReady) { setGreetingVisible(false); return; }
    const t = setTimeout(() => setGreetingVisible(true), 6000);
    return () => clearTimeout(t);
  }, [sitePalReady]);
  const [activeAnim, setActiveAnim] = useState(null);
  const assetsReadyRef = useRef(false);
  const sceneReadyRef = useRef(false);
  // True once CharacterSelect reports its canvas has PRESENTED frames with
  // the neon frame mounted. The CoinLoader (opaque solid black — the one
  // overlay Chrome can composite without rasterizing, so it can never
  // white-flash) holds until then: revealing the page before the GPU has
  // committed real frames is what showed white canvas-layer tiles.
  const portraitReadyRef = useRef(false);
  const maybeFinishLoading = useCallback(() => {
    if (assetsReadyRef.current && sceneReadyRef.current && portraitReadyRef.current) {
      setIsLoading(false);
    }
  }, []);
  const handlePortraitReady = useCallback(() => {
    if (portraitReadyRef.current) return;
    portraitReadyRef.current = true;
    // Signal time = frames committed, but CharacterSelect's dark cover is
    // only STARTING its 0.4s fade. Hold the loader a beat longer so the
    // whole crossfade happens behind solid black and the reveal lands on
    // the finished composition.
    setTimeout(maybeFinishLoading, 450);
  }, [maybeFinishLoading]);

  // Mobile + wide breakpoint detection
  useEffect(() => {
    const check = () => {
      setIsMobile(window.innerWidth < 768);
      setIsWide(window.innerWidth >= 1200);
    };
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // Preload the frame assets + stills + cameo images. The default character
  // is the live 2D SitePal mirror, so no character GLB is needed unless a
  // portraitModel character is in the roster.
  useEffect(() => {
    const firstGlb = CHARACTERS[0].portraitModel || CHARACTERS[0].model;
    Promise.all([
      ...(firstGlb ? [preloadGLBParsed(firstGlb)] : []),
      // The shared neon frame loads lazily inside CharacterSelect's canvas —
      // without this warm-up it arrives visibly AFTER the loader clears and
      // pops in against the already-revealed page.
      preloadGLBParsed("/models/neonFrame.glb"),
      preloadImage("/images/mary.png"),
      ...CHARACTERS.map((c) => preloadImage(c.image)),
    ]).then(() => {
      assetsReadyRef.current = true;
      maybeFinishLoading();
    });
  }, [maybeFinishLoading]);

  const handleSceneLoaded = useCallback(() => {
    sceneReadyRef.current = true;
    setSceneReady(true);
    maybeFinishLoading();
  }, [maybeFinishLoading]);

  // No walking scene mounts anymore — mark the scene "ready" so the loader
  // clears and the SitePal embed (the portrait's face source) mounts
  useEffect(() => {
    handleSceneLoaded();
  }, [handleSceneLoaded]);

  // Music controls — force 80s playlist on this page
  const { play, pause, isPlaying: contextIsPlaying, nextTrack, is80sMode, setIs80sMode } = useMusic();
  const prevModeRef = useRef(null);
  useEffect(() => {
    prevModeRef.current = is80sMode;
    if (!is80sMode) setIs80sMode(true);
    return () => {
      if (prevModeRef.current === false) setIs80sMode(false);
    };
  }, []);
  const [showMusicControls, setShowMusicControls] = useState(contextIsPlaying);
  useEffect(() => {
    if (contextIsPlaying && !showMusicControls) setShowMusicControls(true);
  }, [contextIsPlaying]);
  const handleMusicToggle = useCallback((show) => {
    setShowMusicControls(show);
    if (show && !contextIsPlaying) play();
  }, [contextIsPlaying, play]);
  const [buyModalOpen, setBuyModalOpen] = useBuyModal();
  const [activeCharIndex, setActiveCharIndex] = useState(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const char = parseInt(params.get('char'), 10);
      if (!isNaN(char) && char >= 0 && char < CHARACTERS.length) return char;
      // No explicit ?char — fall back to the face this device chose before
      const storedIdx = CHARACTERS.findIndex((c) => c.key === readApparitionKey());
      if (storedIdx >= 0) return storedIdx;
    }
    return 0;
  });
  const [displayedModel, setDisplayedModel] = useState(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const char = parseInt(params.get('char'), 10);
      if (!isNaN(char) && char >= 0 && char < CHARACTERS.length) return CHARACTERS[char].model;
    }
    return CHARACTERS[0].model;
  });
  const [glitchActive, setGlitchActive] = useState(false);
  const [glitchIntensity, setGlitchIntensity] = useState(0);
  const [glitchKey, setGlitchKey] = useState(0);
  const pendingCharRef = useRef(null);
  const glitchAnimRef = useRef(null);
  const isTalking = activeAnim === "Talking";
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessage, setChatMessage] = useState("");
  // Bottom-dock MORE popover + shared cyberpunk confirm modal for its
  // destinations (mirrors the root page's dock treatment).
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [moreConfirmModal, moreConfirm] = useCyberConfirm();

  // Show Confessional FAB when a character speaks (Talking anim triggered)
  const hasOfferedChatRef = useRef(false);
  useEffect(() => {
    if (isTalking && !hasOfferedChatRef.current) {
      hasOfferedChatRef.current = true;
      const model = CHARACTERS[activeCharIndex]?.model || "";
      if (model.includes("fortuneTeller")) {
        setChatMessage("Oh, hello!");
      }
    }
  }, [isTalking, activeCharIndex]);

  // Reset chat offer when character changes
  useEffect(() => {
    hasOfferedChatRef.current = false;
    setChatOpen(false);
    setChatMessage("");
  }, [activeCharIndex]);

  const handleCharacterSelect = (i) => {
    if (i === activeCharIndex) return;
    // Each apparition is its own SitePal embed (its own scene + token). Swap by
    // reloading with ?char so her scene embeds FRESH — an in-place loadSceneByID
    // leaves the new scene's audio null (SitePal "setAudioElementMode of null",
    // and she won't speak). The reload's own loader + swirl cover the summoning.
    writeApparitionKey(CHARACTERS[i]?.key);
    if (typeof window !== "undefined") window.location.assign(`/vigil?char=${i}`);
  };

  // First-visit triptych choice — remember the face and summon her. The
  // SitePal embed hasn't mounted yet (gated on !pickerOpen), so unlike a
  // later switch this needs no reload: the chosen scene embeds fresh now.
  const handleApparitionChoose = (i) => {
    writeApparitionKey(CHARACTERS[i]?.key);
    setActiveCharIndex(i);
    setPickerOpen(false);
  };

  // Oracle conversation: POST the drawer history to /api/oracle, speak the
  // reply through SitePal (ElevenLabs voice) with timed facial expressions.
  // The request carries whether her favor already rests on the seeker (so
  // she declines to stack — one flame per altar); a `blessing` inscription
  // in the reply is minted to the device ledger, and GraceOfRecord re-reads
  // it via GRACE_EVENT.
  const handleOracleMessage = useCallback(async (text, history) => {
    const app = CHARACTERS[activeCharIndex];
    const standing = readGrace();
    const data = await askOracle(history, undefined, app?.key, { standing: standing?.kind });
    if (!standing && data.blessing) mintBlessing(data.blessing);
    speakOracle(data, app?.voice || ORACLE_VOICE);
    return data.reply;
  }, [activeCharIndex]);

  // Localized her-voice strings for the active apparition (empty for the
  // English faces — components fall back to their English defaults).
  const appUi = CHARACTERS[activeCharIndex]?.ui || {};

  // Wide desktop shows the Confessional docked as the always-open left triptych
  // wing (its own input included), so the dock's center FAB isn't needed to
  // OPEN a chat there — it's repurposed into a "hear her aloud" voice control
  // instead (see the MobileBottomNav center props). Mobile / narrow desktop
  // keep the floating drawer, where the FAB is the sole way in.
  const chatDocked = isWide && !isMobile;

  // (Scene swapping removed — each apparition embeds its own scene fresh on
  // load via ?char; see handleCharacterSelect + SitePalEmbed.)

  // One greeting picked per visit — shared by the drawer's typewriter text
  // and the spoken line so they always match
  const oracleGreeting = useMemo(
    () => pickGreeting(CHARACTERS[activeCharIndex]?.key),
    [activeCharIndex],
  );

  // Speak her greeting aloud. The triggering tap doubles as the browser's
  // audio-unlock gesture, and the drawer's typewriter text runs in step.
  // Mobile/narrow: fired on first drawer-open (effect below). Wide desktop:
  // fired by the dock's repurposed voice FAB (the docked drawer is already
  // open, so there's no open-tap to hang it on).
  const hasGreetedRef = useRef(false);
  const speakGreetingAloud = useCallback(() => {
    speakOracle(
      {
        reply: oracleGreeting,
        expressions: [{ name: "ClosedSmile", amplitude: 0.6, duration: 3, at: 0 }],
      },
      // Soft delivery via ElevenLabs voice settings: high stability + zero
      // style = calm, gentle read. (v3 audio tags like "[softly]" are
      // rejected by SitePal's engine-14 proxy as of Jul 2026 — retest later;
      // speakOracle auto-falls-back if an xData call ever fails.)
      { ...(CHARACTERS[activeCharIndex]?.voice || ORACLE_VOICE), xData: "stability=0.9,style=0,similarity_boost=0.4" }
    );
  }, [oracleGreeting, activeCharIndex]);
  useEffect(() => {
    if (chatOpen && !hasGreetedRef.current) {
      hasGreetedRef.current = true;
      speakGreetingAloud();
    }
  }, [chatOpen, speakGreetingAloud]);

  const handleGlitchMidpoint = () => {
    if (pendingCharRef.current !== null) {
      setDisplayedModel(CHARACTERS[pendingCharRef.current].model);
    }
  };

  const handleGlitchComplete = () => {
    setGlitchActive(false);
    setGlitchIntensity(0);
    pendingCharRef.current = null;
    if (glitchAnimRef.current) cancelAnimationFrame(glitchAnimRef.current);
  };

  // Auto-advance character every 10 seconds — paused when user interacts
  const charIndexRef = useRef(activeCharIndex);
  charIndexRef.current = activeCharIndex;
  const glitchActiveRef = useRef(glitchActive);
  glitchActiveRef.current = glitchActive;
  const handleCharacterSelectRef = useRef(handleCharacterSelect);
  handleCharacterSelectRef.current = handleCharacterSelect;
  const lastInteractionRef = useRef(0);
  // Auto-advance disabled — stay on Our Lady; characters switch only via manual select
  // useEffect(() => {
  //   const onInteract = () => { lastInteractionRef.current = Date.now(); };
  //   window.addEventListener("pointerdown", onInteract, true);
  //   window.addEventListener("touchstart", onInteract, true);
  //   const timer = setInterval(() => {
  //     if (Date.now() - lastInteractionRef.current < 10000) return;
  //     if (glitchActiveRef.current) return;
  //     const next = (charIndexRef.current + 1) % CHARACTERS.length;
  //     handleCharacterSelectRef.current(next);
  //   }, 10000);
  //   return () => {
  //     clearInterval(timer);
  //     window.removeEventListener("pointerdown", onInteract, true);
  //     window.removeEventListener("touchstart", onInteract, true);
  //   };
  // }, []);

  // Fallback timeout — don't wait forever if something fails to load
  useEffect(() => {
    const timeout = setTimeout(() => setIsLoading(false), 15000);
    return () => clearTimeout(timeout);
  }, []);

  return (
    <div
      style={{
        backgroundColor: "#0a0a0f",
        height: "100vh",
        width: "100vw",
        margin: 0,
        padding: 0,
        position: "fixed",
        left: 0,
        top: 0,
        overflow: "hidden",
      }}
    >
      {isLoading && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100vw",
            height: "100vh",
            backgroundColor: "#000",
            zIndex: 99999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <CoinLoader loading={isLoading} />
        </div>
      )}
  {/* <div style={{
          position: "fixed",
          top: "20px", 
          left: "20px",
          borderRadius: "8px",
          padding: "10px",
          pointerEvents: "auto",
          zIndex: 10,
        }}>
        <div 
            id="text"
            style={{
              position: "relative",
              fontFamily: "'UnifrakturMaguntia', serif",
              fontSize:  "4rem",
              color: "#ffffff",
              cursor: "pointer",
              userSelect: "none",
            }}
            // onClick={(e) => {
            //   e.preventDefault();
            //   e.stopPropagation();
            //   window.location.href = "/about";
            // }}
          >
            RL80
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
                    color: 
                    `rgba(${255 - index * 2}, ${255 - index * 3}, ${255 - index * 2})`,
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
      {/* Mobile shows the side panel full-width — it carries its own title */}

      {/* Music controls — top left (desktop only) */}
      {/* <div style={{ position: "fixed", top: "1rem", left: "1rem", zIndex: 290, display: isMobile ? "none" : "block" }}>
        {!showMusicControls ? (
          <button
            onClick={() => handleMusicToggle(true)}
            style={{
              width: "3.5rem",
              height: "3.5rem",
              borderRadius: "0.5rem",
              backgroundColor: "transparent",
              border: "2px solid rgba(255, 255, 255, 0.2)",
              color: "#ffffff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              transition: "all 0.3s ease",
              backdropFilter: "blur(10px)",
              boxShadow: "0 0.125rem 0.5rem rgba(0, 0, 0, 0.3)",
            }}
            title="Toggle Music"
          >
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 18V5l12-2v13" />
              <circle cx="6" cy="18" r="3" />
              <circle cx="18" cy="16" r="3" />
            </svg>
          </button>
        ) : (
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <div
              style={{
                width: "3.5rem",
                height: "3.5rem",
                borderRadius: "50%",
                overflow: "hidden",
                animation: contextIsPlaying ? "spin 4s linear infinite" : "none",
                cursor: "pointer",
              }}
              onClick={() => (contextIsPlaying ? pause() : play())}
            >
              <div style={{ width: "100%", height: "100%", backgroundImage: "url('/virginRecords.jpg')", backgroundSize: "cover", backgroundPosition: "center" }} />
            </div>
            <button
              onClick={() => nextTrack && nextTrack()}
              style={{
                width: "2.5rem",
                height: "2.5rem",
                borderRadius: "0.25rem",
                backgroundColor: "transparent",
                border: "2px solid rgba(255, 255, 255, 0.2)",
                color: "#ffffff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                transition: "all 0.3s ease",
                backdropFilter: "blur(10px)",
                boxShadow: "0 0.125rem 0.375rem rgba(0, 0, 0, 0.3)",
              }}
              title="Next Track"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="5 4 15 12 5 20 5 4" />
                <line x1="19" y1="5" x2="19" y2="19" />
              </svg>
            </button>
            <button
              onClick={() => { handleMusicToggle(false); pause && pause(); }}
              style={{
                width: "2rem",
                height: "2rem",
                borderRadius: "0.25rem",
                backgroundColor: "transparent",
                border: "1px solid rgba(255, 255, 255, 0.2)",
                color: "#ffffff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                transition: "all 0.3s ease",
                backdropFilter: "blur(10px)",
                boxShadow: "0 0.125rem 0.375rem rgba(0, 0, 0, 0.3)",
              }}
              title="Close Music"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        )}
      </div> */}

      {/* SitePal embed — deferred until Three.js scene is ready to avoid WebGL
          context conflict, and until the first-visit triptych (if any) has
          been answered, so the chosen face is the one that embeds. */}
      {USE_SITEPAL && sceneReady && !pickerOpen && (
        <SitePalEmbed
          scene={CHARACTERS[activeCharIndex]?.sitePalScene || SITEPAL_DEFAULT_SCENE}
          embedId={CHARACTERS[activeCharIndex]?.embedId || SITEPAL_DEFAULT_EMBEDID}
          onReady={handleSitePalReady}
        />
      )}

      {/* Walking scene retired from /main — the framed-portrait panel is the
          page on all viewports. (The old MainScene walking-character component
          was deleted; recover it from git history if it's ever wanted back.) */}

      {/* Glitch transition overlay */}
      <GlitchTransition
        key={glitchKey}
        active={glitchActive}
        onMidpoint={handleGlitchMidpoint}
        onComplete={handleGlitchComplete}
        duration={1000}
      />

      {/* ── Right sidebar HUD panel (desktop only) ── */}
      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          width: "100%",
          maxWidth: isMobile ? "100%" : 440,
          margin: "0 auto",
          zIndex: 100,
          display: "flex",
          flexDirection: "column",
          overflowY: "auto",
          // iOS: the rotated/skewed title's transformed bounds extend past the
          // viewport, which Safari treats as pannable overflow ("horizontal
          // play"). Clip it and restrict touch gestures to vertical panning.
          overflowX: "hidden",
          touchAction: "pan-y",
          overscrollBehavior: "contain",
          // Clearance for the fixed bottom dock: without it the column's
          // last ~100px (the altar module's tail — the CONFESS/PETITION
          // button + footer) can never scroll out from behind the nav —
          // visible above the fold, unreachable below it, and the scroll
          // rubber-bands back before reaching it. The dock is present on
          // desktop too (it's the unified nav), so this clearance is NOT
          // mobile-only.
          paddingBottom: "calc(96px + env(safe-area-inset-bottom, 0px))",
          fontFamily: "'Cyber', 'Geo', sans-serif",
          background: "rgba(0, 0, 0, 0.5)",
          backdropFilter: "saturate(180%) blur(8px)",
          borderLeft: "1px solid rgba(0, 255, 255, 0.2)",
          borderRight: "1px solid rgba(0, 255, 255, 0.2)",
          boxShadow: "0 0 20px rgba(0, 0, 0, 0.4), inset 1px 0 0 rgba(0, 255, 255, 0.05)",
        }}
      >
        {/* ── Title heading ── DropInTitle "Our Lady of Perpetual Profit"
            (letters drop in on mount, per the shared landing-page component).
            The green "Profit" line echoes Our Lady's glowing green eyes in the
            portrait below. Collapses while the chat drawer is open on phones so
            the portrait can rise above the conversation. */}
        <div
          className="custom-title"
          style={{
            position: "relative",
            zIndex: 1000,
            paddingTop: "1.25rem",
            pointerEvents: "auto",
            maxHeight: isMobile && chatOpen ? 0 : 320,
            opacity: isMobile && chatOpen ? 0 : 1,
            // Clip only while collapsed — at rest the rotated/skewed letters
            // render outside their layout box and must not be cut
            overflow: isMobile && chatOpen ? "hidden" : "visible",
            transition: "max-height 0.35s ease, opacity 0.25s ease",
          }}
        >
          <DropInTitle
            lines={["Our Lady", "of Perpetual", "Profit"]}
            colors={["#f4e4c1", "#f4b53f", "#3ad17a"]}
            fontSize={{ mobile: "1.85rem", desktop: "2.4rem" }}
            isMobile={isMobile}
          />
        </div>

        {/* ── Agent Select section ── shrinks toward the top while the chat
            drawer is open on phones, keeping her whole face visible above it */}
        <div
          style={{
            padding: "16px 16px 12px",
            borderBottom: "1px solid rgba(0, 255, 255, 0.1)",
            transform: isMobile && chatOpen ? "scale(0.7) translateY(-4%)" : "none",
            transformOrigin: "top center",
            transition: "transform 0.35s ease",
          }}
        >
          {/* <div
            style={{
              fontSize: "0.6rem",
              letterSpacing: "0.2em",
              textTransform: "uppercase",
              color: "hsl(183 38% 57%)",
              marginBottom: 12,
            }}
          >
            // Agent Select
          </div> */}
          <CharacterSelect
            characters={CHARACTERS}
            activeIndex={activeCharIndex}
            onSelect={handleCharacterSelect}
            size={340}
            /* Hold the summoning swirl until SitePal's face is actually loaded
               & displayed — not just when the page's asset loader clears. */
            pageLoading={!sitePalReady}
            /* The line she speaks on a portrait tap = the one the Confessional
               shows, so audio matches the on-screen transcript (no 2nd caption). */
            greeting={sitePalReady ? oracleGreeting : ""}
            /* Hold the CoinLoader until the frame canvas has committed real
               frames — the reveal must find the GPU already settled. */
            onReady={handlePortraitReady}
          />
        </div>

        {/* ── Grace of Record ── the visitor's standing blessing + the
            parish ledger + today's reading, beneath the portrait on every
            viewport (the panel column scrolls on phones). Favor expires after
            its allotted days, reopening the altar. Reads the REAL device
            ledger (lib/grace). A reading/ledger DISPLAY — no CTA of its own;
            the conversation is entered via the dock's ASK button or the
            docked drawer. (Parish tally still mock.) Hidden while the phone
            drawer is up — the shrunken portrait + conversation own that
            screen. */}
        {!(isMobile && chatOpen) && (
          <GraceOfRecord
            ui={appUi}
            /* Today's reading fills the module's featured slot when no
               blessing stands — her daily proof she has something to say. */
            apparitionKey={CHARACTERS[activeCharIndex]?.key}
          />
        )}

        {/* Portfolio + Buy moved into the bottom dock (MobileBottomNav) so
            /main shares the site's unified nav. Destination taps still run
            through the cyberpunk confirm modal — the panel just keeps the
            portrait + character picker now. Spacer pins the footer down. */}
        <div style={{ flex: 1 }} />

        {/* ── Footer status line ── */}
        <div
          style={{
            padding: "10px 16px",
            borderTop: "1px solid rgba(0, 255, 255, 0.1)",
            fontSize: "0.5rem",
            letterSpacing: "0.15em",
            color: "rgba(0, 255, 255, 0.3)",
            textTransform: "uppercase",
          }}
        >
          sys.status // online
        </div>
      </div>

      {/* Buy Modal */}
      <BuyModal isOpen={buyModalOpen} onClose={() => setBuyModalOpen(false)} />

      {/* SitePal animation-control experiment panel — dev only */}
      {process.env.NODE_ENV !== "production" && <SitePalExpressionPanel />}

      {/* ── Unified bottom dock ── App-style nav (MobileBottomNav) carrying
          the portfolio that used to live in the panel. Destination taps run
          through the shared cyberpunk confirm modal (glitch + sounds); Buy
          opens BuyModal directly and the center FAB opens the Confessional.
          Slots L→R: $ BUY | CANDELARIUM | SPEAK (center) | TERMINAL | MORE.
          Hidden on phones while the Confessional is open so the conversation
          reclaims the ~88px the dock (and the drawer's clearance offset) ate —
          the keyboard was leaving only a sliver for the chat. Close via the
          drawer's X to bring the dock back. */}
      {!(isMobile && chatOpen) && (
      <MobileBottomNav
        neonMode
        is80sMode={false}
        show80sButton={false}
        hideWallet
        isMobile
        accountOnLeft
        /* Left slot — BUY RL80 → BuyModal (no confirm, matches root). */
        onBookClick={() => setBuyModalOpen(true)}
        bookLabel="BUY RL80"
        bookIcon={
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 22, height: 22, color: "#39ff14", filter: "drop-shadow(0 0 4px rgba(57, 255, 20, 0.6))" }}>
            <line x1="12" y1="1" x2="12" y2="23" />
            <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
          </svg>
        }
        /* Center FAB. Mobile / narrow desktop: ASK → opens the floating
           Confessional (the sole way in). Wide desktop: the drawer is already
           docked-open with its own input, so ASK there would be redundant —
           the FAB is repurposed into SPEAK, a "hear her aloud" control that
           speaks her greeting and unlocks audio (the tap is the gesture). */
        onBuyClick={
          chatDocked
            ? () => { hasGreetedRef.current = true; speakGreetingAloud(); }
            : () => setChatOpen(true)
        }
        centerSubLabel={chatDocked ? "SPEAK" : "ASK"}
        centerTitle={chatDocked ? "Hear Our Lady's voice" : "Speak to Our Lady"}
        centerLabel={
          chatDocked ? (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 28, height: 28, display: "block", color: "#ffffff" }} aria-hidden="true">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
              <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 28, height: 28, display: "block", color: "#ffffff" }} aria-hidden="true">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
          )
        }
        /* Far-right — MORE popover (Hail Mary, Coin Fountain, Ex Libris). */
        onMenuClick={() => setShowMoreMenu((v) => !v)}
        menuLabel="MORE"
        menuIcon={
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 24, height: 24, color: "#2ad6ee" }} aria-hidden="true">
            <circle cx="12" cy="12" r="10" />
            <path d="M17 12h.01" />
            <path d="M12 12h.01" />
            <path d="M7 12h.01" />
          </svg>
        }
        extraLeft={[
          {
            key: "candelarium",
            label: "ex Machina",
            title: "ex Machina",
            onClick: () => { window.location.href = "/"; },
            confirm: {
              title: "ex Machina",
              body: "Return to home",
              accent: "hsl(189, 84%, 55%)",
              shadow: "hsl(189, 70%, 38%)",
            },
            // Same flame mark the other pages use for the candelarium slot.
            iconSrc: "/favicon.svg",
          },
        ]}
        extraRight={[
          {
            key: "terminal",
            /* Label stays short — the dock's slot labels ellipsize past
               ~88px. The full name lands in the confirm's title. */
            label: "Terminal",
            title: "The Liminal Terminal",
            onClick: () => { window.location.href = "/trade"; },
            confirm: {
              title: "The Liminal Terminal",
              body: "Read the tape. Four consultants, one verdict — the market confesses to those who listen.",
              accent: "hsl(189, 84%, 55%)",
              shadow: "hsl(189, 70%, 38%)",
            },
            icon: (
              <svg viewBox="0 0 24 24" fill="none" stroke="#39ff14" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 24, height: 24, display: "block", filter: "drop-shadow(0 0 4px rgba(57, 255, 20, 0.6))" }} aria-hidden="true">
                <rect width="20" height="14" x="2" y="3" rx="2" />
                <line x1="8" x2="16" y1="21" y2="21" />
                <line x1="12" x2="12" y1="17" y2="21" />
              </svg>
            ),
          },
        ]}
      />
      )}

      {/* MORE popover — anchored above the far-right dock slot. Holds
          secondary destinations (Hail Mary, Coin Fountain, Ex Libris),
          confirm-gated. */}
      {showMoreMenu && (
        <>
          <div
            onClick={() => setShowMoreMenu(false)}
            style={{ position: "fixed", inset: 0, zIndex: 10001, background: "transparent" }}
          />
          <div
            role="menu"
            aria-label="More"
            style={{
              position: "fixed",
              right: "10px",
              bottom: "calc(74px + env(safe-area-inset-bottom, 0px))",
              zIndex: 10002,
              display: "flex",
              flexDirection: "column",
              minWidth: "184px",
              padding: "6px",
              borderRadius: "14px",
              background: "rgba(6, 10, 18, 0.97)",
              border: "1px solid rgba(42, 214, 238, 0.3)",
              backdropFilter: "blur(20px)",
              WebkitBackdropFilter: "blur(20px)",
              boxShadow: "0 -2px 24px rgba(42, 214, 238, 0.18), 0 8px 32px rgba(0, 0, 0, 0.5)",
              fontFamily: "'Rajdhani', sans-serif",
            }}
          >
            {[
              {
                label: "Hail Mary",
                /* Amber/gold — matches the Hail Mary entry on the root dock. */
                stroke: "#f4b53f",
                onSelect: () => moreConfirm({
                  title: "Hail Mary Prospecting Co",
                  body: "Find your fortune in the digital frontier. Our Lady's prospectors never rest.",
                  accent: "hsl(189, 84%, 55%)",
                  shadow: "hsl(189, 70%, 38%)",
                  onProceed: () => { window.location.href = "/hailmary?mode=test"; },
                }),
                icon: (
                  <>
                    <path d="m14 13-8.381 8.38a1 1 0 0 1-3.001-3L11 9.999" />
                    <path d="M15.973 4.027A13 13 0 0 0 5.902 2.373c-1.398.342-1.092 2.158.277 2.601a19.9 19.9 0 0 1 5.822 3.024" />
                    <path d="M16.001 11.999a19.9 19.9 0 0 1 3.024 5.824c.444 1.369 2.26 1.676 2.603.278A13 13 0 0 0 20 8.069" />
                    <path d="M18.352 3.352a1.205 1.205 0 0 0-1.704 0l-5.296 5.296a1.205 1.205 0 0 0 0 1.704l2.296 2.296a1.205 1.205 0 0 0 1.704 0l5.296-5.296a1.205 1.205 0 0 0 0-1.704z" />
                  </>
                ),
              },
              {
                label: "Coin Fountain",
                stroke: "#2ad6ee",
                onSelect: () => moreConfirm({
                  title: "Coin Fountain",
                  body: "Toss a coin, whisper a wish. Our Lady keeps every offering the faithful let fall.",
                  accent: "hsl(189, 84%, 55%)",
                  shadow: "hsl(189, 70%, 38%)",
                  onProceed: () => { window.location.href = "/fountain"; },
                }),
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
                label: "Ex Libris",
                stroke: "#ff44d4",
                onSelect: () => moreConfirm({
                  title: "Ex Libris",
                  body: "The perpetual ledger. Every flame, every name, inscribed for those who came to pray.",
                  accent: "hsl(189, 84%, 55%)",
                  shadow: "hsl(189, 70%, 38%)",
                  onProceed: () => { window.location.href = "/exlibris"; },
                }),
                icon: (
                  <>
                    <path d="M15 12h-5" />
                    <path d="M15 8h-5" />
                    <path d="M19 17V5a2 2 0 0 0-2-2H4" />
                    <path d="M8 21h12a2 2 0 0 0 2-2v-1a1 1 0 0 0-1-1H11a1 1 0 0 0-1 1v1a2 2 0 1 1-4 0V5a2 2 0 1 0-4 0v2a1 1 0 0 0 1 1h3" />
                  </>
                ),
              },
              // "Shrine" moved to the dock's dedicated slot (was here + there).
            ].map((link) => (
              <button
                key={link.label}
                role="menuitem"
                onClick={() => { setShowMoreMenu(false); link.onSelect(); }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  width: "100%",
                  padding: "11px 12px",
                  borderRadius: "10px",
                  border: "none",
                  background: "transparent",
                  cursor: "pointer",
                  textAlign: "left",
                  transition: "background 0.15s ease",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(42, 214, 238, 0.12)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke={link.stroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 22, height: 22, flexShrink: 0, display: "block" }} aria-hidden="true">
                  {link.icon}
                </svg>
                <span style={{ fontSize: "0.95rem", fontWeight: 700, letterSpacing: "0.5px", textTransform: "uppercase", color: "#ffffff" }}>
                  {link.label}
                </span>
              </button>
            ))}
          </div>
        </>
      )}

      {/* Cyberpunk confirm modal for the MORE-popover destinations. */}
      {moreConfirmModal}

      {/* Confessional chat drawer — converse with the framed portrait.
          Replies come from /api/oracle and are spoken with timed expressions. */}
      {(CHARACTERS[activeCharIndex]?.portraitModel || CHARACTERS[activeCharIndex]?.sitePalScene) && (
        <Confessional
          isOpen={chatOpen}
          onToggle={() => setChatOpen((o) => !o)}
          characterName={CHARACTERS[activeCharIndex]?.speaker || "Our Lady"}
          /* Hold the greeting text until a beat after she's fully revealed
             (greetingVisible), so it never types out before her face. */
          initialMessage={greetingVisible ? oracleGreeting : ""}
          onSendMessage={handleOracleMessage}
          /* Input placeholder follows the apparition's tongue */
          placeholder={appUi.inputPlaceholder}
          /* SPEAK (center dock FAB) is the sole launcher — no auto-appearing
             conversation bubble before the user chooses to speak. */
          hideLauncher
          /* Lift the drawer above the bottom dock so its input row (and the
             protruding center FAB) don't occlude the reply field. On phones
             the dock is hidden while the chat is open (see MobileBottomNav
             gating), so the drawer only needs to clear the safe area — anchor
             it low to give the conversation maximum room above the keyboard. */
          bottomOffset={isMobile ? 16 : 88}
          /* On wide viewports the confession docks as the left triptych wing
             (always visible) instead of a floating drawer. */
          docked={chatDocked}
        />
      )}

      {/* ── Right triptych wing — YOUR VIGIL (price + the user's candle) ── */}
      <MainVigilPanel show={isWide && !isMobile} />

      {/* ── First-visit apparition triptych ── all of Our Lady's faces, side
          by side, before any one of them reads as the default. Held until the
          asset loader clears so its entrance animation is actually seen. */}
      {pickerOpen && !isLoading && (
        <ApparitionTriptych apparitions={CHARACTERS} onChoose={handleApparitionChoose} />
      )}

    </div>
  );
}
