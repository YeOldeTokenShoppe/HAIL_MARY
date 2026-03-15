"use client";

import React, { useState, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import CoinLoader from "@/components/CoinLoader";
import CyberButton from "@/components/CyberButton";
import CharacterSelect from "@/components/CharacterSelect";
import GlitchTransition from "@/components/GlitchTransition";

const CHARACTERS = [
  { name: "Oracle", image: "/cameo_rl80.webp", model: "/models/fortuneTeller_not3.glb", defaultAnim: "textWalk" },
  { name: "H80Z", image: "/cameo_h80z.webp", model: "/models/H80Z.glb", defaultAnim: "walkText" },
  { name: "GR80", image: "/cameo_GR80.webp", model: "/models/GR80.glb", defaultAnim: "walk" },
  { name: "Kitty", image: "/cameo_kitty.webp", model: "/models/fluffyCat.glb", defaultAnim: "walk" },
];

const MainScene = dynamic(
  () => import("@/components/MainScene"),
  {
    ssr: false,
    loading: () => <CoinLoader loading={true} />,
  }
);

// Toggle this to switch between video file and SitePal embed
const USE_SITEPAL = false;

// SitePal embed config
const SITEPAL_ACCOUNT = "9308752";
const SITEPAL_EMBED_PARAMS = "9308752,600,800,\"\",1,1,2774644,0,1,0,\"Wis5vrj8IqhSAWDsZMw2mVtkUIjwPzMc\",0,1";

function SitePalEmbed() {
  const containerRef = useRef(null);

  useEffect(() => {
    // Load the SitePal embed script
    const script1 = document.createElement("script");
    script1.src = `//vhss-d.oddcast.com/vhost_embed_functions_v4.php?acc=${SITEPAL_ACCOUNT}&js=0`;
    script1.type = "text/javascript";

    script1.onload = () => {
      const script2 = document.createElement("script");
      script2.type = "text/javascript";
      script2.textContent = `AC_VHost_Embed(${SITEPAL_EMBED_PARAMS});`;
      containerRef.current?.appendChild(script2);

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
  const [isLoading, setIsLoading] = useState(true);
  const [activeAnim, setActiveAnim] = useState(null);
  const [activeCharIndex, setActiveCharIndex] = useState(0);
  const [displayedModel, setDisplayedModel] = useState(CHARACTERS[0].model);
  const [glitchActive, setGlitchActive] = useState(false);
  const [glitchIntensity, setGlitchIntensity] = useState(0);
  const pendingCharRef = useRef(null);
  const glitchAnimRef = useRef(null);
  const isTalking = activeAnim === "Talking";

  const handleCharacterSelect = (i) => {
    if (i === activeCharIndex || glitchActive) return;
    pendingCharRef.current = i;
    setActiveCharIndex(i);
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

  // Fallback timeout
  useEffect(() => {
    const timeout = setTimeout(() => setIsLoading(false), 8000);
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
  <div style={{
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
        </div>
      {/* SitePal embed — always mounted so texture is ready, audio controlled by scene */}
      {USE_SITEPAL && <SitePalEmbed />}

      <MainScene
        onLoaded={() => setIsLoading(false)}
        useSitePal={USE_SITEPAL}
        onAnimChange={setActiveAnim}
        characterModel={displayedModel}
        defaultAnim={CHARACTERS[activeCharIndex].defaultAnim}
        glitchIntensity={glitchIntensity}
      />

      {/* Glitch transition overlay */}
      <GlitchTransition
        active={glitchActive}
        onMidpoint={handleGlitchMidpoint}
        onComplete={handleGlitchComplete}
        duration={1000}
      />

      {/* ── Right sidebar HUD panel ── */}
      <div
        style={{
          position: "fixed",
          top: 0,
          right: 0,
          bottom: 0,
          width: 280,
          zIndex: 100,
          display: "flex",
          flexDirection: "column",
          fontFamily: "'Cyber', 'Geo', sans-serif",
          background: "rgba(0, 0, 0, 0.5)",
          backdropFilter: "saturate(180%) blur(8px)",
          borderLeft: "1px solid rgba(0, 255, 255, 0.2)",
          boxShadow: "-4px 0 20px rgba(0, 0, 0, 0.4), inset 1px 0 0 rgba(0, 255, 255, 0.05)",
        }}
      >
        {/* ── Agent Select section ── */}
        <div style={{ padding: "16px 16px 12px", borderBottom: "1px solid rgba(0, 255, 255, 0.1)" }}>
          <div
            style={{
              fontSize: "0.6rem",
              letterSpacing: "0.2em",
              textTransform: "uppercase",
              color: "hsl(183 38% 57%)",
              marginBottom: 12,
            }}
          >
            // Agent Select
          </div>
          <CharacterSelect
            characters={CHARACTERS}
            activeIndex={activeCharIndex}
            onSelect={handleCharacterSelect}
            size={220}
          />
        </div>

        {/* ── Portfolio section ── */}
        <div style={{ padding: "16px", flex: 1 }}>
          <div
            style={{
              fontSize: "0.6rem",
              letterSpacing: "0.2em",
              textTransform: "uppercase",
              color: "hsl(183 38% 57%)",
              marginBottom: 14,
            }}
          >
            // Portfolio
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
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
              style={{ fontSize: "1.1rem" }}
            />
            <CyberButton
              label="TG Crusaders"
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
              style={{ fontSize: "1.1rem" }}
            />
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
              style={{ fontSize: "1.1rem" }}
            />
            <CyberButton
              label="Staking"
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
              style={{ fontSize: "1.1rem" }}
            />
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
    </div>
  );
}
