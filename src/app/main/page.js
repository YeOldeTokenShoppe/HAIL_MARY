"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import dynamic from "next/dynamic";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader";
import CoinLoader from "@/components/CoinLoader";
import CyberButton from "@/components/CyberButton";
import CharacterSelect from "@/components/CharacterSelect";
import GlitchTransition from "@/components/GlitchTransition";
import BuyModal from "@/components/BuyModal";
import MainMobileNav from "@/components/MainMobileNav";
import { useMusic } from "@/components/MusicContext";

const CHARACTERS = [
  { name: "𝓞𝖚𝖗 𝕷𝖆𝖉𝖞", image: "/cameo_rl80.webp", model: "/models/fortuneTeller_not3.glb", defaultAnim: "textWalk" },

  { name: "Saint GR80", image: "/cameo_GR80.webp", model: "/models/GR80.glb", defaultAnim: "walk" },
  { name: "H80Z", image: "/cameo_h80z.webp", model: "/models/H80Z.glb", defaultAnim: "skateSequence" },
  { name: "VIRGIL", image: "/cameo_kitty.webp", model: "/models/fluffyCat.glb", defaultAnim: "walk" },
];

// Scene GLBs that aren't character models
const SCENE_GLBS = [
  "/models/Sun.glb",
  "/models/wireframePalmTree.glb",
  "/models/neonFrame.glb",
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
    loader.load(url, () => resolve(), undefined, () => resolve());
  });
}

const MainScene = dynamic(
  () => import("@/components/MainScene"),
  {
    ssr: false,
    loading: () => <CoinLoader loading={true} />,
  }
);

// Toggle this to switch between video file and SitePal embed
const USE_SITEPAL = true;

// SitePal embed config
const SITEPAL_ACCOUNT = "9308752";
const SITEPAL_EMBED_PARAMS = "9308752,600,800,\"\",1,1,2774644,0,1,1,\"Wis5vrj8IqhSAWDsZMw2mVtkUIjwPzMc\",0,1";

function SitePalEmbed() {
  const containerRef = useRef(null);

  useEffect(() => {
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
      script2.textContent = `AC_VHost_Embed(${SITEPAL_EMBED_PARAMS});`;
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

    // Register vh_sceneLoaded callback — mute SitePal on load so it doesn't talk until Talking mode
    window.vh_sceneLoaded = () => {
      if (typeof window.setPlayerVolume === "function") {
        window.setPlayerVolume(0);
      }
    };

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
      if (script1.parentNode) script1.parentNode.removeChild(script1);
      window.removeEventListener("click", resumeAudio);
      window.removeEventListener("touchstart", resumeAudio);
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

export default function MainPage() {
  const [isMobile, setIsMobile] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [sceneReady, setSceneReady] = useState(false);
  const [activeAnim, setActiveAnim] = useState(null);
  const assetsReadyRef = useRef(false);
  const sceneReadyRef = useRef(false);

  // Mobile breakpoint detection
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // Preload all GLB models and character images
  useEffect(() => {
    // First character GLB gets fully parsed so it's GPU-ready immediately
    const firstModel = CHARACTERS[0].model;
    const otherGlbs = [
      ...CHARACTERS.slice(1).map((c) => c.model),
      ...SCENE_GLBS,
    ];
    const imageUrls = CHARACTERS.map((c) => c.image);

    Promise.all([
      preloadGLBParsed(firstModel),
      ...otherGlbs.map(preloadGLB),
      ...imageUrls.map(preloadImage),
    ]).then(() => {
      assetsReadyRef.current = true;
      if (sceneReadyRef.current) setIsLoading(false);
    });
  }, []);

  const handleSceneLoaded = useCallback(() => {
    sceneReadyRef.current = true;
    setSceneReady(true);
    if (assetsReadyRef.current) setIsLoading(false);
  }, []);

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
  const [buyModalOpen, setBuyModalOpen] = useState(false);
  const [activeCharIndex, setActiveCharIndex] = useState(0);
  const [displayedModel, setDisplayedModel] = useState(CHARACTERS[0].model);
  const [glitchActive, setGlitchActive] = useState(false);
  const [glitchIntensity, setGlitchIntensity] = useState(0);
  const [glitchKey, setGlitchKey] = useState(0);
  const pendingCharRef = useRef(null);
  const glitchAnimRef = useRef(null);
  const isTalking = activeAnim === "Talking";

  const handleCharacterSelect = (i) => {
    if (i === activeCharIndex || glitchActive) return;
    pendingCharRef.current = i;
    setActiveCharIndex(i);
    setGlitchKey((k) => k + 1);
    setGlitchActive(true);

    // Animate glitchIntensity: 0 → 1 → 0 over the duration
    const duration = 1000;
    const start = performance.now();
    const animate = () => {
      const elapsed = performance.now() - start;
      const t = Math.min(elapsed / duration, 1);
      // Peak at 0.45 (midpoint), smooth triangle curve
      const peak = 0.45;
      const intensity = t < peak
        ? t / peak
        : 1 - (t - peak) / (1 - peak);
      setGlitchIntensity(Math.max(0, intensity));
      if (t < 1) {
        glitchAnimRef.current = requestAnimationFrame(animate);
      } else {
        setGlitchIntensity(0);
      }
    };
    glitchAnimRef.current = requestAnimationFrame(animate);
  };

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

  // Auto-advance character every 10 seconds
  const charIndexRef = useRef(activeCharIndex);
  charIndexRef.current = activeCharIndex;
  const glitchActiveRef = useRef(glitchActive);
  glitchActiveRef.current = glitchActive;
  const handleCharacterSelectRef = useRef(handleCharacterSelect);
  handleCharacterSelectRef.current = handleCharacterSelect;
  useEffect(() => {
    const timer = setInterval(() => {
      if (glitchActiveRef.current) return;
      const next = (charIndexRef.current + 1) % CHARACTERS.length;
      handleCharacterSelectRef.current(next);
    }, 10000);
    return () => clearInterval(timer);
  }, []);

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
      {/* Mobile title — top left */}
      {isMobile && (
        <h1
          className="custom-title"
          style={{
            position: "fixed",
            top: "1rem",
            left: "1rem",
            zIndex: 290,
            color: "#f6f5f1ff",
            fontFamily: "UnifrakturCook, serif",
            textShadow: "0 0 10px rgba(212, 175, 55, 0.8), 0 0 20px rgba(212, 175, 55, 0.6), 0 0 30px rgba(212, 175, 55, 0.8), 6px 6px 16px rgba(0, 0, 0, 1), -2px -2px 8px rgba(255, 192, 203, 0.7)",
            fontSize: "2.5rem",
            fontWeight: 900,
            lineHeight: 0.85,
            transform: "rotate(-8deg) skew(-15deg)",
            whiteSpace: "nowrap",
            pointerEvents: "none",
            margin: 0,
          }}
        >
          <span className="title-line" style={{ display: "block" }}>Our Lady</span>
          <span className="title-line" style={{ display: "block" }}>
            <span style={{ fontSize: "1rem" }}>    of    </span>
            Perpetual
          </span>
          <span className="title-line" style={{ display: "block", marginLeft: "2rem" }}>Profit</span>
        </h1>
      )}

      {/* Music controls — top left (desktop only) */}
      <div style={{ position: "fixed", top: "1rem", left: "1rem", zIndex: 290, display: isMobile ? "none" : "block" }}>
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
      </div>

      {/* SitePal embed — deferred until Three.js scene is ready to avoid WebGL context conflict */}
      {USE_SITEPAL && sceneReady && <SitePalEmbed />}

      <MainScene
        onLoaded={handleSceneLoaded}
        useSitePal={USE_SITEPAL}
        onAnimChange={setActiveAnim}
        characterModel={displayedModel}
        defaultAnim={CHARACTERS[activeCharIndex].defaultAnim}
        characterZOffset={CHARACTERS[activeCharIndex].zOffset || 0}
        glitchIntensity={glitchIntensity}
        isMobile={isMobile}
      />

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
          right: 0,
          bottom: 0,
          width: 280,
          zIndex: 100,
          display: isMobile ? "none" : "flex",
          flexDirection: "column",
          fontFamily: "'Cyber', 'Geo', sans-serif",
          background: "rgba(0, 0, 0, 0.5)",
          backdropFilter: "saturate(180%) blur(8px)",
          borderLeft: "1px solid rgba(0, 255, 255, 0.2)",
          boxShadow: "-4px 0 20px rgba(0, 0, 0, 0.4), inset 1px 0 0 rgba(0, 255, 255, 0.05)",
        }}
      >
        {/* ── Title heading ── */}
        <h1
          className="custom-title"
          style={{
            position: "relative",
            left: "3rem",
            top: "1.0rem",
            color: "#f6f5f1ff",
            fontFamily: "UnifrakturCook, serif",
            textShadow: "0 0 10px rgba(212, 175, 55, 0.8), 0 0 20px rgba(212, 175, 55, 0.6), 0 0 30px rgba(212, 175, 55, 0.8), 6px 6px 16px rgba(0, 0, 0, 1), -2px -2px 8px rgba(255, 192, 203, 0.7), 0 0 100px rgba(212, 175, 55, 0.1)",
            fontSize: "2rem",
            fontWeight: 900,
            lineHeight: 0.85,
            transform: "rotate(-8deg) skew(-15deg)",
            zIndex: 1000,
            whiteSpace: "nowrap",
            cursor: "pointer",
            marginTop: "0",
            pointerEvents: "auto",
          }}
        >
          <span className="title-line" style={{ display: 'block', position: 'relative' }}>Our Lady</span>
          <span className="title-line" style={{ display: 'block', position: 'relative' }}>
            <span style={{ fontSize: "1rem" }}>    of    </span>
            Perpetual
          </span>
          <span className="title-line" style={{ display: 'block', marginLeft: "3rem", position: 'relative' }}>Profit</span>
        </h1>

        {/* ── Agent Select section ── */}
        <div style={{ padding: "16px 16px 12px", borderBottom: "1px solid rgba(0, 255, 255, 0.1)" }}>
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
            size={220}
          />
        </div>

        {/* ── Action buttons (Buy + Stake) ── */}
        <div style={{ padding: "12px 16px 0", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          {/* Buy RL80 — green accent, opens BuyModal directly (no CyberButton modal) */}
          <CyberButton
            label="Buy RL80"
            accent="hsl(152, 100%, 45%)"
            shadow="hsl(152, 80%, 35%)"
            icon={
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8" />
                <path d="M12 18V6" />
              </svg>
            }
            modalTitle="Buy RL80"
            modalBody={<p>Purchase RL80 tokens on Base. Fund the mission — Our Lady rewards the faithful.</p>}
            onProceed={() => setBuyModalOpen(true)}
            style={{ fontSize: "1.05rem" }}
          />

          {/* Stake button — gold accent to differentiate */}
          <CyberButton
            label="Stake"
            accent="hsl(45, 90%, 55%)"
            shadow="hsl(30, 100%, 50%)"
            icon={
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 15h2a2 2 0 1 0 0-4h-3c-.6 0-1.1.2-1.4.6L3 17" />
                <path d="m7 21 1.6-1.4c.3-.4.8-.6 1.4-.6h4c1.1 0 2.1-.4 2.8-1.2l4.6-4.4a2 2 0 0 0-2.75-2.91l-4.2 3.9" />
                <path d="m2 16 6 6" />
                <circle cx="16" cy="9" r="2.9" />
                <circle cx="6" cy="5" r="3" />
              </svg>
            }
            modalTitle="Staking Services"
            modalBody={<p>Stake your faith and reap the rewards. Perpetual profit awaits the devoted.</p>}
            onProceed={() => window.location.href = "/"}
            style={{ fontSize: "1.05rem" }}
          />
        </div>

        {/* ── Divider ── */}
        <div style={{ padding: "0 16px", margin: "6px 0" }}>
          <div style={{ height: "1px", background: "linear-gradient(90deg, transparent, rgba(0, 255, 255, 0.2), transparent)" }} />
        </div>

        {/* ── Portfolio section (micro-businesses) ── */}
        <div style={{ padding: "4px 16px 16px", flex: 1 }}>
          <div
            style={{
              fontSize: "0.6rem",
              letterSpacing: "0.2em",
              textTransform: "uppercase",
              color: "hsl(183 38% 57%)",
              marginBottom: 10,
            }}
          >
            // Portfolio
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {/* Prospecting Co — LIVE */}
            <div style={{ position: "relative" }}>
              <CyberButton
                label="Prospecting Co"
                icon={
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m14 13-8.381 8.38a1 1 0 0 1-3.001-3L11 9.999" />
                    <path d="M15.973 4.027A13 13 0 0 0 5.902 2.373c-1.398.342-1.092 2.158.277 2.601a19.9 19.9 0 0 1 5.822 3.024" />
                    <path d="M16.001 11.999a19.9 19.9 0 0 1 3.024 5.824c.444 1.369 2.26 1.676 2.603.278A13 13 0 0 0 20 8.069" />
                    <path d="M18.352 3.352a1.205 1.205 0 0 0-1.704 0l-5.296 5.296a1.205 1.205 0 0 0 0 1.704l2.296 2.296a1.205 1.205 0 0 0 1.704 0l5.296-5.296a1.205 1.205 0 0 0 0-1.704z" />
                  </svg>
                }
                modalTitle="Hail Mary Prospecting Co"
                modalBody={<p>Strike gold in the digital frontier. Our Lady&apos;s miners never rest.</p>}
                onProceed={() => console.log("Prospecting")}
                style={{ fontSize: "1rem" }}
              />
              {/* Live indicator dot */}
              <span style={{
                position: "absolute",
                top: "50%",
                right: 6,
                transform: "translateY(-50%)",
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: "#00e572",
                boxShadow: "0 0 6px rgba(0, 229, 114, 0.8)",
              }} />
            </div>

            {/* Party Rentals — COMING SOON */}
            <div style={{ position: "relative", opacity: 0.38, pointerEvents: "none" }}>
              <CyberButton
                label="Party Rentals"
                icon={
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M10 11h.01" />
                    <path d="M14 6h.01" />
                    <path d="M18 6h.01" />
                    <path d="M6.5 13.1h.01" />
                    <path d="M22 5c0 9-4 12-6 12s-6-3-6-12c0-2 2-3 6-3s6 1 6 3" />
                    <path d="M17.4 9.9c-.8.8-2 .8-2.8 0" />
                    <path d="M10.1 7.1C9 7.2 7.7 7.7 6 8.6c-3.5 2-4.7 3.9-3.7 5.6 4.5 7.8 9.5 8.4 11.2 7.4.9-.5 1.9-2.1 1.9-4.7" />
                    <path d="M9.1 16.5c.3-1.1 1.4-1.7 2.4-1.4" />
                  </svg>
                }
                modalTitle="Telegram Crusaders"
                modalBody={<p>Join the faithful in the digital crusade. Spread the word across all channels.</p>}
                onProceed={() => console.log("Telegram")}
                style={{ fontSize: "1rem" }}
              />
              {/* Coming soon badge */}
              <span style={{
                position: "absolute",
                top: "50%",
                right: 4,
                transform: "translateY(-50%)",
                fontSize: "0.4rem",
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: "hsl(40, 100%, 60%)",
                fontFamily: "'Cyber', 'Geo', sans-serif",
              }}>soon</span>
            </div>

            {/* Interventions — COMING SOON */}
            <div style={{ position: "relative", opacity: 0.38, pointerEvents: "none" }}>
              <CyberButton
                label="Interventions"
                icon={
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M15 4V2" />
                    <path d="M15 16v-2" />
                    <path d="M8 9h2" />
                    <path d="M20 9h2" />
                    <path d="M17.8 11.8 19 13" />
                    <path d="M15 9h.01" />
                    <path d="M17.8 6.2 19 5" />
                    <path d="m3 21 9-9" />
                    <path d="M12.2 6.2 11 5" />
                  </svg>
                }
                modalTitle="Divine Interventions"
                modalBody={<p>When all else fails, call upon the divine. Miracles available on demand.</p>}
                onProceed={() => console.log("Interventions")}
                style={{ fontSize: "1rem" }}
              />
              {/* Coming soon badge */}
              <span style={{
                position: "absolute",
                top: "50%",
                right: 4,
                transform: "translateY(-50%)",
                fontSize: "0.4rem",
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: "hsl(40, 100%, 60%)",
                fontFamily: "'Cyber', 'Geo', sans-serif",
              }}>soon</span>
            </div>
          </div>
        </div>

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

      {/* Mobile bottom nav */}
      {isMobile && (
        <MainMobileNav
          isPlaying={contextIsPlaying}
          onPlay={play}
          onPause={pause}
          onSkip={nextTrack}
          characters={CHARACTERS}
          activeCharIndex={activeCharIndex}
          onCharSelect={handleCharacterSelect}
          onBuyClick={() => setBuyModalOpen(true)}
          onStakeClick={() => { window.location.href = "/"; }}
          businesses={[
            {
              label: "Prospecting Co",
              live: true,
              onProceed: () => console.log("Prospecting"),
              icon: (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m14 13-8.381 8.38a1 1 0 0 1-3.001-3L11 9.999" />
                  <path d="M18.352 3.352a1.205 1.205 0 0 0-1.704 0l-5.296 5.296a1.205 1.205 0 0 0 0 1.704l2.296 2.296a1.205 1.205 0 0 0 1.704 0l5.296-5.296a1.205 1.205 0 0 0 0-1.704z" />
                </svg>
              ),
            },
            {
              label: "Party Rentals",
              live: false,
              icon: (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 5c0 9-4 12-6 12s-6-3-6-12c0-2 2-3 6-3s6 1 6 3" />
                  <path d="M10.1 7.1C9 7.2 7.7 7.7 6 8.6c-3.5 2-4.7 3.9-3.7 5.6 4.5 7.8 9.5 8.4 11.2 7.4.9-.5 1.9-2.1 1.9-4.7" />
                </svg>
              ),
            },
            {
              label: "Interventions",
              live: false,
              icon: (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M15 4V2" />
                  <path d="M15 16v-2" />
                  <path d="M8 9h2" />
                  <path d="M20 9h2" />
                  <path d="M15 9h.01" />
                  <path d="m3 21 9-9" />
                </svg>
              ),
            },
          ]}
        />
      )}

    </div>
  );
}
