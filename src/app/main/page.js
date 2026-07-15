"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader";
import CoinLoader from "@/components/CoinLoader";
import CharacterSelect from "@/components/CharacterSelect";
import GlitchTransition from "@/components/GlitchTransition";
import BuyModal from "@/components/BuyModal";
import { useBuyModal } from "@/lib/useBuyModal";
import SitePalExpressionPanel from "@/components/SitePalExpressionPanel";
import { ORACLE_VOICE, pickGreeting } from "@/lib/oracleSpeech";
import { APPARITIONS as CHARACTERS } from "@/lib/apparitions";
import ApparitionTriptych from "@/components/ApparitionTriptych";
import { readApparitionKey, writeApparitionKey } from "@/lib/apparitionPrefs";
import { useMusic } from "@/components/MusicContext";
import MobileBottomNav from "@/components/MobileBottomNav";
import {
  askCounsel,
  speakInPortal,
  stopAllPortals,
  reactInPortal,
  recenterPortal,
  speakAdviserLine,
  unlockAdviserAudio,
  stopAdviserAudio,
  GAZE,
  COUNSEL_VOICES,
} from "@/lib/counselSpeech";
import useCyberConfirm from "@/components/useCyberConfirm";
import DropInTitle from "@/components/DropInTitle";

// ── /main ── THE INNER STRUGGLE, staged as a triptych.
//
// The seeker asks; the two advisers argue the classic shoulder-devil /
// shoulder-angel trope and Our Lady closes with a light touch:
//   John Barron (right) — the devil's advocate. Argues FOR the appetite.
//   St. GR80 (left)     — the saint. Answers from duty (categorical imperative).
//   Our Lady (centre)   — one short line. Never a verdict, never a summary.
// The composition IS the trope: temptation and duty flanking grace. They speak
// in that order (JB → GR → OL), each awaiting the previous speaker's talk-ended
// so they never overlap, and each line is captioned under the face making it.
//
// Where /main flanks the portrait with the Confessional (left) and YOUR VIGIL
// (right), those wings are advisers here. There is NO chat drawer: every line
// is captioned under the face that says it, so the triptych IS the transcript —
// a drawer would only duplicate Our Lady's line on top of an adviser's argument.
// Asking happens in the always-visible input bar above the dock, which frees the
// dock's centre FAB to be SPEAK (greet + unlock audio).
//
// Each character is a live SitePal player in its OWN iframe — see COUNCIL for
// why that is the only arrangement that works. Unlike /main, this page does NOT
// mint blessings: the counsel endpoint returns an argument, not a blessing.

// Number of portrait panels when the viewport can carry the full row.
const PANEL_COUNT = 3;

// ── THE COUNCIL ── Our Lady centre, an adviser either side. Each is a live
// SitePal character in its OWN same-origin iframe (`/sitepal-portal.html`).
//
// WHY IFRAMES: embedding several portals in ONE document does not work. Tested
// exhaustively 2026-07-15 — three 2D scenes, each with its own token, embedded
// sequentially: AC_VHost_Embed returned distinct refs (1/2/3), selectPortal
// existed, every scene fired vh_sceneLoaded, no 3D/DOM errors — yet only the
// FIRST portal ever built a player, all three `div#_html5Player` nodes landing
// in the first container. Same under SitePal's own single-script ordering.
// AC_VHost_Embed remembers one container after its first init, so a document
// can only ever host one character. One document PER character fixes it at the
// root: separate globals, its own player, its own sayText. Verified — three
// distinct faces live at once, all readable by the parent, none tainted.
//
// CASTING (confirmed 2026-07-15): Saint GR80 left, Our Lady centre, John Barron
// right. Each seat is a SEPARATE published embed token — a seat cannot reuse
// another's, and a new adviser needs its own token from SitePal's publish flow.
// The advisers have no lines yet: `oracleGreeting` is centre-only, so tapping
// their portraits is silent until they're given something to say.
const COUNCIL = [
  {
    key: "gr80",
    seat: "left",
    name: "Saint GR80",
    title: "Saint GR80",
    frameHue: "#22ccff",
    image: "/cameo_GR80.webp",
    sitePalScene: 2775053,
    embedId: "I0s05E8rXxvHYHdJIPmcIU5msqkW6t0A",
  },
  {
    key: "lady",
    seat: "center",
    fromApparition: true, // filled from the active APPARITION at render
  },
  {
    key: "john",
    seat: "right",
    name: "John Barron",
    title: "John Barron",
    frameHue: "#ff2d75",
    image: "/cameo_h80z.webp",
    sitePalScene: 2775052,
    embedId: "j02HKEP7AzkdQlqrMiNJIjxwV90YgRz8",
  },
];

const portalContainerId = (key) => `sitepal-portal-${key}`;

// The one seat that gets a live player on phones. Our Lady holds it: she
// presides, so she is the live, speaking face and the advisers are text +
// portrait only. Her frame is NEVER scene-swapped — see the speak loop for the
// scars from trying.
const SPOTLIGHT_KEY = "lady";

// Which voice speaks from which seat — the composition IS the trope: the
// appetite on one shoulder, duty on the other, grace between them.
const SEAT_VOICE = { left: "GR", center: "OL", right: "JB" };

// How each voice signs itself in the transcript. Phones read the deliberation
// as a group text — "Name: message" — rather than as captions under three
// faces, so the names carry the identity the portraits carry on desktop.
const SPEAKER = {
  you: { name: "You", hue: "#8b97a8" },
  JB: { name: "John Barron", hue: "#ff2d75" },
  GR: { name: "Saint GR80", hue: "#22ccff" },
  OL: { name: "Our Lady", hue: "#f4b53f" },
};

function preloadImage(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = resolve;
    img.onerror = resolve; // don't block on failure
    img.src = src;
  });
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

// SitePal config. Each character is its OWN embed (its own scene + token), one
// per iframe — see COUNCIL. Switching Our Lady's face reloads the page (?char)
// so her scene embeds FRESH; never swap in place with loadSceneByID, which
// leaves the new scene's audio subsystem null ("setAudioElementMode of null")
// and she won't speak.
const SITEPAL_ACCOUNT = "9308752";

/* ── One live SitePal character per iframe ──
   Each council seat gets its own same-origin `/sitepal-portal.html` frame: its
   own document, its own SitePal globals, its own player and its own sayText.
   That is what makes several live characters possible at all (see the COUNCIL
   note above for why a single document cannot host more than one).
   The frames are same-origin, so each panel mirrors its canvas with drawImage
   and speech is aimed by calling straight into the frame's window. */
function SitePalPortals({ portals, onPortalReady }) {
  const onReadyRef = useRef(onPortalReady);
  onReadyRef.current = onPortalReady;

  useEffect(() => {
    // Each frame reports itself ready via postMessage (see sitepal-portal.html).
    const onMessage = (e) => {
      if (e.origin !== window.location.origin) return;
      if (e.data?.type === "sitepal-portal-ready") onReadyRef.current?.(e.data.scene);
    };
    window.addEventListener("message", onMessage);

    // Browsers need a gesture before audio; unlock every frame's player on the
    // first interaction. Each frame owns its own AudioContext, so they must be
    // resumed individually. (iOS allows only ONE context in practice — the
    // council is desktop-only via the isWide gate.)
    const resumeAudio = () => {
      portals.forEach((p) => {
        const w = document.getElementById(portalContainerId(p.key))
          ?.querySelector("iframe")?.contentWindow;
        if (!w) return;
        try {
          w.saySilent?.(0);
          const Ctx = w.AudioContext || w.webkitAudioContext;
          if (Ctx?._instances) Ctx._instances.forEach((c) => c.resume());
          w._vhssAudioCtx?.resume();
        } catch (err) { /* frame not ready yet */ }
      });
    };
    window.addEventListener("click", resumeAudio);
    window.addEventListener("touchstart", resumeAudio);

    // Safety net: never let the summoning swirl spin forever.
    const readyFallback = setTimeout(() => onReadyRef.current?.("fallback"), 25000);

    return () => {
      clearTimeout(readyFallback);
      window.removeEventListener("message", onMessage);
      window.removeEventListener("click", resumeAudio);
      window.removeEventListener("touchstart", resumeAudio);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Hidden frames — the visible faces are the panels' mirrored canvases.
  return (
    <>
      {portals.map((p) => (
        <div
          key={p.key}
          id={portalContainerId(p.key)}
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
        >
          <iframe
            title={`SitePal portal: ${p.key}`}
            src={`/sitepal-portal.html?acc=${SITEPAL_ACCOUNT}&scene=${p.sitePalScene}&embed=${encodeURIComponent(p.embedId || "")}`}
            style={{ width: 600, height: 800, border: 0 }}
          />
        </div>
      ))}
    </>
  );
}

/* ── A shoulder figure ── The trope, drawn: the saint at one shoulder, the
      devil's advocate at the other, both hovering at her frame.
      ALWAYS FULL COLOUR. Greying them out was tried and killed them: against
      this near-black shrine a desaturated figure is just a shadow — the halo
      and the horns barely register, so at rest the composition read as Our
      Lady alone. Presence is the point; they are always in the room. Speaking
      is carried by the halo of their own hue plus a slight lean-in instead.
      The wrapper owns the hover animation and the <img> owns the mirror/lean,
      so the transforms never fight — a keyframe on the same element would
      clobber the flip on every frame. */
function ShoulderFigure({ src, side, lit, hue, mirrored = false, alt, arrived = true }) {
  return (
    // THREE layers, because three things animate the same property and would
    // otherwise clobber each other:
    //   outer — the fly-in (translateX), a one-shot transition
    //   middle — the endless hover (keyframed translateY/rotate)
    //   img   — the mirror + lean-in (scaleX/scale)
    // Collapse any two of these onto one element and the keyframe wins every
    // frame, freezing or teleporting the others.
    <div
      style={{
        position: "absolute",
        top: "15%",
        [side]: -28,
        width: 112,
        zIndex: 3,
        pointerEvents: "none",
        // They fly in from off-screen to attend her once she's summoned. The
        // right figure trails slightly — arriving in lockstep looks mechanical.
        transform: arrived
          ? "translateX(0)"
          : `translateX(${side === "left" ? "-260%" : "260%"})`,
        opacity: arrived ? 1 : 0,
        transition:
          "transform 1.15s cubic-bezier(0.16, 1.02, 0.30, 1.16), opacity 0.7s ease",
        transitionDelay: side === "left" ? "0ms" : "170ms",
        filter: lit
          ? `drop-shadow(0 0 14px ${hue}) drop-shadow(0 0 30px ${hue}66) drop-shadow(0 6px 10px rgba(0,0,0,0.55))`
          : "drop-shadow(0 6px 10px rgba(0,0,0,0.55))",
      }}
    >
      <div className={`hm2-figure hm2-figure--${side}`}>
        <img
          src={src}
          alt={alt}
          style={{
            width: "100%",
            height: "auto",
            display: "block",
            // Mirror (Barron whispers toward her) composed with a small lean-in
            // while speaking. transformOrigin MUST stay centred: an edge origin
            // makes scaleX(-1) mirror the figure across that edge, i.e. bodily
            // outside its own box — it threw Barron a full width leftward, on
            // top of her face. Scale from the centre; the flip happens in place.
            transform: `${mirrored ? "scaleX(-1)" : ""} scale(${lit ? 1.07 : 1})`.trim(),
            transformOrigin: "center center",
            transition: "transform 0.45s ease",
          }}
        />
      </div>
    </div>
  );
}

/* ── One portrait panel ── /main's center column, extracted so the row can
      render it PANEL_COUNT times. Every copy is identical: same apparition,
      same greeting, same live SitePal mirror. */
function PortraitPanel({
  isMobile,
  characters,
  activeCharIndex,
  onSelect,
  sitePalReady,
  oracleGreeting,
  onPortraitReady,
  sourceContainerId,
  title = null,
  caption = "",
  speaking = false,
  hue = "#2ad6ee",
  halftone = false,
  hasLiveSource = true,
  // Half-size seat: on phones the two advisers sit SIDE BY SIDE beneath Our
  // Lady, so they flank each other and she still presides.
  compact = false,
  // Phones drop the adviser panels entirely and hover the two shoulder figures
  // at her frame instead — the literal iconography of the trope. Needs the
  // global speaker so each figure knows when it's the one talking.
  figures = false,
  speakingKey = null,
  // False until Our Lady is summoned and revealed — then the advisers fly in.
  figuresIn = false,
}) {
  const frameSize = compact ? 150 : isMobile ? 250 : 340;
  // NOTE: the speaking panel used to scroll itself into view on phones. The
  // transcript now owns that job (it follows its own newest line), and two
  // things fighting over the scroll position yanks the page mid-argument.
  const panelRef = useRef(null);
  return (
    <div
      ref={panelRef}
      style={{
        // compact = one of the two advisers sharing a row; it flexes to half
        // the width instead of claiming a row of its own.
        flex: compact ? "1 1 0" : isMobile ? "0 0 auto" : "1 1 0",
        minWidth: 0,
        width: !compact && isMobile ? "100%" : undefined,
        maxWidth: 440,
        height: isMobile ? "auto" : "100%",
        pointerEvents: "auto",
        display: "flex",
        flexDirection: "column",
        // The stacked column scrolls as ONE list on phones; each panel sizes to
        // its content instead of owning a scroller.
        overflowY: isMobile ? "visible" : "auto",
        // iOS: the rotated/skewed title's transformed bounds extend past the
        // viewport, which Safari treats as pannable overflow ("horizontal
        // play"). Clip it and restrict touch gestures to vertical panning.
        overflowX: "hidden",
        touchAction: "pan-y",
        overscrollBehavior: "contain",
        // Clearance for the fixed bottom dock: without it the column's last
        // ~100px can never scroll out from behind the nav. On phones the
        // stacked column owns that clearance ONCE — repeating it per panel
        // stacked ~100px of void between every face.
        paddingBottom: isMobile ? 10 : "calc(96px + env(safe-area-inset-bottom, 0px))",
        fontFamily: "'Cyber', 'Geo', sans-serif",
        // Panel chrome is a TRIPTYCH device — three columns need seams and a
        // backing to read as separate panels. On a phone there's one
        // composition, and that 50%-black backing would just mute the apse
        // gradient the figures are lit against.
        ...(isMobile
          ? { background: "transparent" }
          : {
              background: "rgba(0, 0, 0, 0.5)",
              backdropFilter: "saturate(180%) blur(8px)",
              borderLeft: "1px solid rgba(0, 255, 255, 0.2)",
              borderRight: "1px solid rgba(0, 255, 255, 0.2)",
              boxShadow:
                "0 0 20px rgba(0, 0, 0, 0.4), inset 1px 0 0 rgba(0, 255, 255, 0.05)",
            }),
      }}
    >
      {/* ── Title heading ── DropInTitle "Our Lady of Perpetual Profit".
          Collapses while the chat drawer is open on phones so the portrait can
          rise above the conversation. */}
      <div
        className="custom-title"
        style={{
          position: "relative",
          zIndex: 1000,
          paddingTop: "1.25rem",
          pointerEvents: "auto",
          // Clip only while collapsed — at rest the rotated/skewed letters
          // render outside their layout box and must not be cut
          overflow: "visible",
          transition: "max-height 0.35s ease, opacity 0.25s ease",
        }}
      >
        {/* Her name over the centre seat; an adviser's name over theirs. */}
        <DropInTitle
          lines={title ? [title] : ["Our Lady", "of Perpetual", "Profit"]}
          colors={title ? ["#f4e4c1"] : ["#f4e4c1", "#f4b53f", "#3ad17a"]}
          fontSize={{
            mobile: compact ? "1rem" : "1.85rem",
            desktop: title ? "1.9rem" : "2.4rem",
          }}
          isMobile={isMobile}
        />
      </div>

      {/* ── Agent Select section ── shrinks toward the top while the chat
          drawer is open on phones, keeping her whole face visible above it */}
      <div
        style={{
          padding: compact ? "8px 6px 10px" : "16px 16px 12px",
          borderBottom: "1px solid rgba(0, 255, 255, 0.1)",
        }}
      >
        {/* Relative box so the shoulder figures can hover against HER frame
            rather than against the panel — CharacterSelect centres its own
            frame at exactly this width. */}
        <div style={{ position: "relative", width: frameSize, margin: "0 auto" }}>
        {figures && (
          <>
            {/* St. GR80 at her right hand (screen left); Barron at her left,
                MIRRORED so his cupped hand whispers toward her rather than out
                of frame. Each greys out until it's their turn to argue. */}
            <ShoulderFigure
              src="/shoulder_angel.webp"
              side="left"
              lit={speakingKey === "GR"}
              hue={SPEAKER.GR.hue}
              alt="Saint GR80"
              arrived={figuresIn}
            />
            <ShoulderFigure
              src="/shoulder_demon.webp"
              side="right"
              mirrored
              lit={speakingKey === "JB"}
              hue={SPEAKER.JB.hue}
              alt="John Barron"
              arrived={figuresIn}
            />
          </>
        )}
        <CharacterSelect
          characters={characters}
          activeIndex={activeCharIndex}
          onSelect={onSelect}
          /* Half-size for the paired advisers; Our Lady keeps the larger frame
             so the composition still reads as her presiding. */
          size={frameSize}
          /* Which SitePal embed this panel mirrors. */
          sourceContainerId={sourceContainerId}
          /* Dormant advisers read as printed cards until they speak. */
          halftone={halftone}
          /* No live player behind this seat = no summoning to veil. */
          hasLiveSource={hasLiveSource}
          /* Hold the summoning swirl until SitePal's face is actually loaded
             & displayed — not just when the page's asset loader clears. */
          pageLoading={!sitePalReady}
          /* The line she speaks on a portrait tap = the one shown in her
             caption, so the audio matches the on-screen text. */
          greeting={sitePalReady ? oracleGreeting : ""}
          /* Hold the CoinLoader until the frame canvas has committed real
             frames — the reveal must find the GPU already settled. */
          onReady={onPortraitReady}
        />
        </div>
      </div>

      {/* ── What this voice just said ── The argument reads under the face
          that's making it. The speaker holding the floor is lit in their own
          hue, so the eye follows the deliberation across the triptych.
          (Desktop only — phones read the group text instead.) */}
      {caption && (
        <div
          style={{
            margin: compact ? "8px 6px 0" : "10px 14px 0",
            padding: compact ? "8px 9px" : "10px 12px",
            borderRadius: 10,
            border: `1px solid ${speaking ? hue : "rgba(255,255,255,0.10)"}`,
            background: speaking ? `${hue}14` : "rgba(255,255,255,0.03)",
            boxShadow: speaking ? `0 0 16px ${hue}44` : "none",
            transition: "border-color 0.3s ease, box-shadow 0.3s ease, background 0.3s ease",
            fontFamily: "'Rajdhani', sans-serif",
            fontSize: compact ? "0.82rem" : "0.95rem",
            lineHeight: compact ? 1.35 : 1.45,
            color: speaking ? "#ffffff" : "rgba(255,255,255,0.72)",
          }}
        >
          {caption}
        </div>
      )}


      {/* Spacer + footer are a full-height-column device: they pin the status
          line to the bottom of a panel that owns the viewport. Stacked on a
          phone each panel sizes to its content, so a spacer would just inject
          dead space between faces and the footer would repeat three times. */}
      {!isMobile && (
        <>
          <div style={{ flex: 1 }} />
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
        </>
      )}
    </div>
  );
}

export default function MainPage() {
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth < 768 : false
  );
  // Wide enough to carry the full row of portrait panels side by side without
  // crowding them. Below this we fall back to the single center panel.
  const [isWide, setIsWide] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth >= 1200 : false
  );
  const [isLoading, setIsLoading] = useState(true);
  const [sceneReady, setSceneReady] = useState(false);
  // True once SitePal's avatar has actually loaded & displayed (vh_sceneLoaded).
  // Gates the magic-mirror swirl so it dissolves only when her face is ready.
  const [sitePalReady, setSitePalReady] = useState(false);
  const handleSitePalReady = useCallback(() => setSitePalReady(true), []);
  // First-visit apparition chooser is DISABLED (as on /main) — the page
  // defaults to Byzantine Protocol (CHARACTERS[0]) for anyone who hasn't
  // explicitly picked via ?char or a stored preference.
  const [pickerOpen, setPickerOpen] = useState(false);
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
  // SitePal scene, force-reveal after 15s if vh_sceneLoaded never arrives.
  useEffect(() => {
    if (sitePalReady || pickerOpen) return;
    const t = setTimeout(() => setSitePalReady(true), 15000);
    return () => clearTimeout(t);
  }, [sitePalReady, pickerOpen]);

  // The advisers fly in to attend her ONCE SHE'S THERE — not before. Her
  // summoning swirl holds 2s then dissolves over 1.6s from the moment her
  // scene reports ready (see MirrorSwirl's SWIRL_MS / SWIRL_DISSOLVE_MS), so
  // this waits out the reveal and lands them just as her face settles. Order
  // matters dramatically: she is summoned, THEN they arrive to flank her.
  const [figuresIn, setFiguresIn] = useState(false);
  useEffect(() => {
    if (!sitePalReady) {
      setFiguresIn(false);
      return;
    }
    const t = setTimeout(() => setFiguresIn(true), 3800);
    return () => clearTimeout(t);
  }, [sitePalReady]);

  const [activeAnim, setActiveAnim] = useState(null);
  const assetsReadyRef = useRef(false);
  const sceneReadyRef = useRef(false);
  // True once the FIRST CharacterSelect reports its canvas has PRESENTED
  // frames with the neon frame mounted. The other panels are the same
  // composition off the same feed — the loader doesn't wait on each one.
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

  // No walking scene mounts — mark the scene "ready" so the loader clears and
  // the SitePal embed (the portraits' shared face source) mounts
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
  const [glitchActive, setGlitchActive] = useState(false);
  const [glitchKey, setGlitchKey] = useState(0);
  const isTalking = activeAnim === "Talking";
  // Bottom-dock MORE popover + shared cyberpunk confirm modal for its
  // destinations (mirrors the root page's dock treatment).
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [moreConfirmModal, moreConfirm] = useCyberConfirm();

  // The deliberation in flight: what each voice said, and who holds the floor.
  const [captions, setCaptions] = useState({}); // { JB|GR|OL: line }
  const [speakingKey, setSpeakingKey] = useState(null);
  const counselRunRef = useRef(0);
  // The input bar, and the question currently under deliberation.
  const [inputText, setInputText] = useState("");
  const [busy, setBusy] = useState(false);
  // The transcript — the seeker's questions and every voice's reply, in the
  // order they landed. Phones render this as the group text; it also restores
  // the scrollback that went away with the chat drawer.
  const [chatLog, setChatLog] = useState([]); // [{ who: "you"|"JB"|"GR"|"OL", text }]
  // Keep the newest line in view as the argument unfolds, the way a group chat
  // follows itself. Scrolls the BOX's own scrollTop rather than calling
  // scrollIntoView on the line: scrollIntoView walks up and moves every
  // scrollable ancestor, which drags the page (and the faces) around too.
  const chatBoxRef = useRef(null);
  useEffect(() => {
    const box = chatBoxRef.current;
    if (!box || !chatLog.length) return;
    box.scrollTo({ top: box.scrollHeight, behavior: "smooth" });
  }, [chatLog]);
  // Prior turns, fed back so a follow-up knows what was already argued. A ref,
  // not state — nothing renders it, and it must never re-trigger the flow.
  const historyRef = useRef([]);

  // A seat is "lit" (full colour, live) while its voice holds the floor —
  // and Our Lady is lit at rest, since she presides over an idle triptych.
  const isLit = useCallback(
    (seat) => speakingKey === SEAT_VOICE[seat] || (speakingKey === null && seat === "center"),
    [speakingKey],
  );

  // One seat, rendered. Desktop lays three of these across; phones stack Our
  // Lady above a paired row of half-size advisers (compact).
  const renderSeat = (s, { compact = false, figures = false } = {}) =>
    !s ? null : (
      <PortraitPanel
        key={s.key}
        isMobile={isMobile}
        compact={compact}
        /* The shoulder figures hover at HER frame only, and need the global
           speaker so each knows when it's the one arguing. */
        figures={figures}
        speakingKey={speakingKey}
        figuresIn={figuresIn}
        /* Her seat gets the whole roster, so her carousel (arrows + medallions)
           renders and her face can still be changed — CharacterSelect only
           draws it when there's more than one character. The advisers get a
           single-entry roster: they have no other faces, and a carousel under
           them would imply otherwise. */
        characters={s.seat === "center" ? CHARACTERS : [s]}
        activeCharIndex={s.seat === "center" ? activeCharIndex : 0}
        onSelect={s.seat === "center" ? handleCharacterSelect : undefined}
        /* Desktop: this panel mirrors its OWN character's portal.
           PHONE: only Our Lady is live — the advisers point at a container that
           doesn't exist, so SitePalLivePortrait falls back to their cameo. This
           must stay pinned to the SEAT, never to "who's speaking": the single
           player holds HER scene, so pointing an adviser's frame at it would
           put her face inside Barron's frame. */
        sourceContainerId={
          !isMobile
            ? portalContainerId(s.key)
            : s.seat === "center"
            ? portalContainerId(SPOTLIGHT_KEY)
            : `sitepal-portal-still-${s.key}`
        }
        sitePalReady={sitePalReady}
        /* Desktop: every seat has its own portal, so every arrival is a real
           summoning. Phone: only she is summoned; the advisers are stills and
           skip the veil. */
        hasLiveSource={!isMobile || s.seat === "center"}
        /* Only Our Lady has oracle greetings; advisers speak only their
           counsel lines. */
        oracleGreeting={s.seat === "center" ? oracleGreeting : ""}
        onPortraitReady={handlePortraitReady}
        title={s.seat === "center" ? null : s.name}
        /* Desktop reads the argument under the face making it. Phones read it
           as the group text below, so per-panel captions would just print every
           line twice. */
        caption={isMobile ? "" : captions[SEAT_VOICE[s.seat]] || ""}
        speaking={speakingKey === SEAT_VOICE[s.seat]}
        hue={s.frameHue}
        /* PHONE: she never greys — she presides throughout, and the shoulder
           figures' glow alone marks whose turn it is. Dimming her (portrait AND
           gold frame) for the ~10s the advisers argue read as a glitch on the
           one live avatar, and made no sense once the figures stopped greying.
           DESKTOP: the advisers are full panels, so the old rule still earns its
           keep — inactive seats sit greyed, the speaker goes full colour. */
        halftone={isMobile ? false : !isLit(s.seat)}
      />
    );

  const handleCharacterSelect = useCallback((i) => {
    if (i === activeCharIndex) return;
    // Each apparition is its own SitePal embed (its own scene + token). Swap by
    // reloading with ?char so her scene embeds FRESH — an in-place loadSceneByID
    // leaves the new scene's audio null (SitePal "setAudioElementMode of null",
    // and she won't speak). The reload's own loader + swirl cover the summoning.
    writeApparitionKey(CHARACTERS[i]?.key);
    if (typeof window !== "undefined") window.location.assign(`/main?char=${i}`);
  }, [activeCharIndex]);

  // First-visit triptych choice — remember the face and summon her.
  const handleApparitionChoose = (i) => {
    writeApparitionKey(CHARACTERS[i]?.key);
    setActiveCharIndex(i);
    setPickerOpen(false);
  };

  // ── The inner struggle ── The seeker asks; Barron argues for the appetite,
  // GR80 answers from duty, Our Lady weighs in last and lightest. Each line is
  // spoken by its OWN character's portal, awaited in turn, so the argument
  // plays across the triptych as a conversation instead of three portraits
  // talking over each other. Every line lands as a caption under the face
  // making it — the triptych IS the transcript, so there's no drawer.
  //
  // The page owns the history (the input bar drives this directly). Prior turns
  // are fed back so a follow-up question knows what was already argued.
  const handleAsk = useCallback(async (text) => {
    const question = String(text || "").trim();
    if (!question || busy) return;
    const run = ++counselRunRef.current;
    // A new question interrupts whatever is still being said — and drops any
    // expression she was holding, so she doesn't answer the next question still
    // wearing her disgust at the last one.
    stopAllPortals(COUNCIL.map((s) => portalContainerId(s.key)));
    stopAdviserAudio();
    recenterPortal(portalContainerId(SPOTLIGHT_KEY));
    setCaptions({});
    setSpeakingKey(null);
    setBusy(true);
    setChatLog((l) => [...l, { who: "you", text: question }]);

    const messages = [...historyRef.current, { role: "user", content: question }];
    let data;
    try {
      data = await askCounsel(messages);
    } catch (err) {
      console.warn("[main] counsel failed:", err);
      if (run === counselRunRef.current) {
        setBusy(false);
        setCaptions({ OL: "the channel is quiet. ask again." });
      }
      return;
    }
    if (run !== counselRunRef.current) return; // superseded by a newer ask

    const lineFor = (s) => data.lines?.find((l) => l.s === s);
    const lineOf = (s) => lineFor(s)?.t || "";
    const seatFor = { JB: "john", GR: "gr80", OL: "lady" };
    const voiceFor = {
      JB: COUNSEL_VOICES.JB,
      GR: COUNSEL_VOICES.GR,
      OL: CHARACTERS[activeCharIndex]?.voice || ORACLE_VOICE,
    };

    // Speak in the trope's order — temptation, duty, then grace.
    (async () => {
      for (const s of ["JB", "GR", "OL"]) {
        if (run !== counselRunRef.current) return;
        const t = lineOf(s);
        if (!t) continue;
        setCaptions((c) => ({ ...c, [s]: t }));
        // Lands in the transcript as this voice takes the floor — not all three
        // at once, so the group text unfolds at the pace of the argument.
        setChatLog((l) => [...l, { who: s, text: t }]);

        setSpeakingKey(s);

        // ── She watches them argue ──
        // While an adviser speaks she TURNS toward them and reacts to what they
        // actually said (the counsel endpoint picks her expression per line —
        // Disgust at something odious, a smile when Barron amuses her). GR80
        // sits screen-left, Barron screen-right, on both layouts. Her gaze
        // recenters on its own the instant she's asked to speak, so her own
        // turn needs no cleanup — she simply faces front and delivers it.
        if (s !== "OL") {
          reactInPortal(portalContainerId(SPOTLIGHT_KEY), {
            gaze: s === "GR" ? GAZE.LEFT : GAZE.RIGHT,
            expression: lineFor(s)?.react,
            seconds: 7,
          });
        }

        // Who says this out loud, and how:
        //  • Desktop — everyone owns a portal, so everyone speaks through it.
        //  • Phone, Our Lady — her player, never scene-swapped. (Swapping was
        //    tried 2026-07-15: loadSceneByID nulls the player's audio, so
        //    NOBODY spoke, her included, and every turn paid a scene load.)
        //  • Phone, advisers — no player at all, so they speak straight from
        //    ElevenLabs through a plain <audio> element: no SitePal, no OOM, no
        //    AudioContext. Returns false if that adviser has no voice yet
        //    (GR80), and we fall through to the silent reading beat below.
        let spoke;
        if (!isMobile) {
          spoke = await speakInPortal(portalContainerId(seatFor[s]), t, voiceFor[s]);
        } else if (s === "OL") {
          spoke = await speakInPortal(portalContainerId(SPOTLIGHT_KEY), t, voiceFor[s]);
        } else {
          spoke = await speakAdviserLine(s, t);
        }
        if (run !== counselRunRef.current) return;

        // No voice for this line — hold the caption roughly as long as it takes
        // to READ, so the argument still paces instead of flashing past.
        if (!spoke) {
          await new Promise((r) => setTimeout(r, Math.min(5200, Math.max(2000, t.length * 30))));
          if (run !== counselRunRef.current) return;
        }
        await new Promise((r) => setTimeout(r, 300)); // beat between speakers
      }
      if (run === counselRunRef.current) setSpeakingKey(null);
    })();

    // Record the turn so a follow-up knows what was already argued. The whole
    // deliberation is ONE assistant turn, tagged per speaker — the same shape
    // the counsel prompt's style reference uses.
    historyRef.current = [
      ...messages,
      {
        role: "assistant",
        content: ["JB", "GR", "OL"]
          .map((s) => (lineOf(s) ? `[${s}] ${lineOf(s)}` : ""))
          .filter(Boolean)
          .join("\n"),
      },
    ].slice(-8); // keep the tail; the server truncates anyway
    setBusy(false);
  }, [activeCharIndex, isMobile, busy]);


  // Three seats across once the viewport can carry them; below that the
  // stacked phone layout takes over (Our Lady above the paired advisers).
  const panelCount = isWide && !isMobile ? PANEL_COUNT : 1;

  // One greeting picked per visit — shared by the drawer's typewriter text
  // and the spoken line so they always match
  const oracleGreeting = useMemo(
    () => pickGreeting(CHARACTERS[activeCharIndex]?.key),
    [activeCharIndex],
  );

  // The council, resolved: the centre seat is whichever apparition is active,
  // the flanking seats are her advisers. Each seat carries the scene + token
  // its own iframe portal embeds.
  const seats = useMemo(
    () =>
      COUNCIL.map((s) =>
        s.fromApparition ? { ...CHARACTERS[activeCharIndex], seat: s.seat, key: s.key } : s
      ),
    [activeCharIndex],
  );


  // Speak her greeting aloud on first drawer-open. The triggering tap doubles
  // as the browser's audio-unlock gesture, and the drawer's typewriter text
  // runs in step.
  // Her player lives in an iframe, so speakOracle (which drives the ONE global
  // window.sayText) can't reach her here — speak into her portal instead.
  const hasGreetedRef = useRef(false);
  const speakGreetingAloud = useCallback(() => {
    speakInPortal(
      portalContainerId("lady"),
      oracleGreeting,
      CHARACTERS[activeCharIndex]?.voice || ORACLE_VOICE,
    );
  }, [oracleGreeting, activeCharIndex]);
  // Browsers only start audio inside a real user gesture, and focusing the
  // input is the first one this page reliably gets. Spend it on unlocking the
  // players AND on her greeting — so the triptych introduces itself the moment
  // the seeker goes to type, instead of staying mute until the first answer.
  const unlockAndGreet = useCallback(() => {
    // The advisers' <audio> element must be unlocked INSIDE this gesture — iOS
    // grants playback permission per element, not per page, so a later
    // programmatic play() only works if this element played during a real tap.
    unlockAdviserAudio();
    if (hasGreetedRef.current) return;
    hasGreetedRef.current = true;
    speakGreetingAloud();
  }, [speakGreetingAloud]);

  const handleGlitchComplete = () => {
    setGlitchActive(false);
  };

  // Fallback timeout — don't wait forever if something fails to load
  useEffect(() => {
    const timeout = setTimeout(() => setIsLoading(false), 15000);
    return () => clearTimeout(timeout);
  }, []);

  return (
    <div
      style={{
        // A lit apse rather than a void. Flat #0a0a0f gave the figures nothing
        // to stand against — dark art on dark ground reads as smudges (it's why
        // greying them out failed). This puts a warm glow BEHIND her, falling
        // off to deep indigo at the edges, so the advisers are silhouetted by
        // light and the neon frames have something to bloom against.
        backgroundColor: "#0a0a0f",
        backgroundImage: [
          // Her aureole — warm, centred on the portrait, not the viewport.
          "radial-gradient(120% 78% at 50% 26%, rgba(244, 181, 63, 0.16) 0%, rgba(244, 181, 63, 0.05) 34%, rgba(0,0,0,0) 62%)",
          // Cool counter-light so the amber doesn't read as sepia.
          "radial-gradient(90% 60% at 50% 96%, rgba(42, 214, 238, 0.09) 0%, rgba(0,0,0,0) 70%)",
          // The apse itself: indigo shoulders down to near-black.
          "linear-gradient(180deg, #131126 0%, #0d0b18 45%, #08070d 100%)",
        ].join(", "),
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
      {/* Hover cycles for the shoulder figures. Deliberately different periods
          and phases so the two never bob in lockstep — synchronised hovering
          reads as a loop, drift reads as alive. */}
      <style>{`
        @keyframes hm2-hover-left {
          0%, 100% { transform: translateY(0) rotate(-2deg); }
          50%      { transform: translateY(-9px) rotate(1.5deg); }
        }
        @keyframes hm2-hover-right {
          0%, 100% { transform: translateY(-5px) rotate(2deg); }
          50%      { transform: translateY(6px) rotate(-1.5deg); }
        }
        .hm2-figure--left  { animation: hm2-hover-left 5.5s ease-in-out infinite; }
        .hm2-figure--right { animation: hm2-hover-right 6.7s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) {
          .hm2-figure--left, .hm2-figure--right { animation: none; }
        }
      `}</style>

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

      {/* SitePal portals — one per panel, embedded sequentially. Deferred
          until the scene is ready to avoid a WebGL context conflict, and until
          the first-visit triptych (if any) has been answered. */}
      {/* MOBILE MOUNTS ONE PLAYER ONLY — hers.
          Three live players OOM-crash iOS Safari (tested on a real phone
          2026-07-15: "a problem repeatedly occurred", tab reload loop). And the
          obvious workaround — one player, scene-swapped per speaker — is worse:
          loadSceneByID leaves the player's audio null, so NOBODY spoke at all,
          and every turn paid for a scene load. So phones get her live and
          speaking, with the advisers as text + portrait. The advisers need no
          fallback code: SitePalLivePortrait draws stillSrc when its container
          holds no frame. Do NOT mount their portals on phones without a new
          device test. */}
      {USE_SITEPAL && sceneReady && !pickerOpen && (
        <SitePalPortals
          portals={isMobile ? seats.filter((s) => s.seat === "center") : seats}
          onPortalReady={handleSitePalReady}
        />
      )}

      {/* Glitch transition overlay */}
      <GlitchTransition
        key={glitchKey}
        active={glitchActive}
        onComplete={handleGlitchComplete}
        duration={1000}
      />

      {/* ── Portrait panel row ── the whole triptych is the same panel, three
          times over. Narrow viewports get the single center panel. */}
      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 100,
          display: "flex",
          // Phones get the triptych STACKED — three ornate frames side by side
          // at 390px would be ~120px each and the filigree turns to mush. The
          // column scrolls, and the speaking panel scrolls itself into view.
          flexDirection: isMobile ? "column" : "row",
          justifyContent: isMobile ? "flex-start" : "center",
          alignItems: isMobile ? "center" : "stretch",
          gap: panelCount > 1 ? 16 : 0,
          overflowY: isMobile ? "auto" : "visible",
          // The stacked column IS the scroller on phones, so it must accept
          // touch — pointerEvents:"none" here silently made the page unscrollable
          // (panels 2 and 3 rendered but were unreachable). Desktop keeps none so
          // the gaps between panels stay click-through.
          pointerEvents: isMobile ? "auto" : "none",
          WebkitOverflowScrolling: "touch",
          overscrollBehavior: "contain",
          // Clearance for the fixed dock, which the panels no longer carry.
          paddingBottom: isMobile ? "calc(96px + env(safe-area-inset-bottom, 0px))" : 0,
        }}
      >
        {isMobile ? (
          <>
            {/* ONE composition: Our Lady live and framed, with the saint and
                the devil's advocate hovering at her shoulders. This is the
                trope drawn literally, and it replaces the stacked adviser
                panels — three ornate frames never belonged on a phone, and the
                advisers have no player here anyway. Their words go to the
                transcript below. */}
            {renderSeat(seats.find((s) => s.seat === "center"), { figures: true })}

            {/* ── The transcript ── The deliberation as a group text: name,
                colon, message, in each voice's own colour. This is what the
                advisers have INSTEAD of a voice on phones, and it doubles as
                the scrollback — every question and every reply, in order. */}
            {chatLog.length > 0 && (
              <div
                ref={chatBoxRef}
                style={{
                  width: "100%",
                  maxWidth: 440,
                  margin: "14px 0 0",
                  padding: "12px 14px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                  // CONTAINED, and it scrolls itself. Left unbounded the
                  // transcript grows with every exchange and shoves the whole
                  // composition off the top of the screen — the faces are the
                  // page, so the chat gets a window, not the run of it.
                  maxHeight: "32vh",
                  overflowY: "auto",
                  overscrollBehavior: "contain",
                  WebkitOverflowScrolling: "touch",
                  borderTop: "1px solid rgba(0, 255, 255, 0.12)",
                  borderBottom: "1px solid rgba(0, 255, 255, 0.12)",
                  background: "rgba(0, 0, 0, 0.35)",
                  fontFamily: "'Rajdhani', sans-serif",
                }}
              >
                {chatLog.map((m, i) => {
                  const who = SPEAKER[m.who] || SPEAKER.you;
                  const live = speakingKey === m.who && i === chatLog.length - 1;
                  return (
                    <div
                      key={i}
                      style={{
                        fontSize: "0.92rem",
                        lineHeight: 1.5,
                        color: live ? "#ffffff" : "rgba(255,255,255,0.74)",
                        transition: "color 0.3s ease",
                      }}
                    >
                      <span
                        style={{
                          color: who.hue,
                          fontWeight: 700,
                          letterSpacing: "0.02em",
                          textShadow: live ? `0 0 10px ${who.hue}88` : "none",
                        }}
                      >
                        {who.name}:
                      </span>{" "}
                      {m.text}
                    </div>
                  );
                })}
                {busy && (
                  <div style={{ fontSize: "0.8rem", color: "rgba(255,255,255,0.4)" }}>
                    the council is deliberating…
                  </div>
                )}
              </div>
            )}

            {/* The advisers are mute here by necessity (one player per phone —
                see the portals note). Rather than apologise for it, point at
                where they DO speak. Written in her register, not as an error. */}
            <div
              style={{
                margin: "14px 16px 4px",
                padding: "9px 12px",
                borderRadius: 10,
                border: "1px solid rgba(42, 214, 238, 0.22)",
                background: "rgba(42, 214, 238, 0.06)",
                textAlign: "center",
                fontFamily: "'Rajdhani', sans-serif",
                fontSize: "0.8rem",
                lineHeight: 1.45,
                color: "rgba(255,255,255,0.66)",
              }}
            >
              Her advisers keep their voices for the wider altar.{" "}
              <span style={{ color: "#2ad6ee" }}>
                Open the shrine on a desktop to hear the council speak aloud.
              </span>
            </div>
          </>
        ) : (
          (panelCount > 1 ? seats : seats.filter((s) => s.seat === "center")).map((s) =>
            renderSeat(s),
          )
        )}
      </div>

      {/* ── The ask ── Always present, pinned above the dock. This page exists
          to be asked a question, so the input is the page's main affordance
          rather than something hidden behind a FAB. Sits above the panel row
          (z 100) and below the dock (z 10000). */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const t = inputText.trim();
          if (!t || busy) return;
          setInputText("");
          handleAsk(t);
        }}
        style={{
          position: "fixed",
          left: 0,
          right: 0,
          bottom: "calc(96px + env(safe-area-inset-bottom, 0px))",
          marginLeft: "auto",
          marginRight: "auto",
          width: "min(560px, calc(100vw - 24px))",
          zIndex: 600,
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "7px 8px 7px 14px",
          borderRadius: 999,
          background: "rgba(6, 10, 18, 0.92)",
          border: "1px solid rgba(42, 214, 238, 0.34)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          boxShadow: "0 6px 28px rgba(0,0,0,0.55), 0 0 20px rgba(42,214,238,0.10)",
        }}
      >
        <input
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          /* The first focus is a real user gesture — the one moment we're
             allowed to unlock the players' audio, so her greeting rides it. */
          onFocus={unlockAndGreet}
          placeholder={busy ? "the council is deliberating…" : "Bring them your question…"}
          disabled={busy}
          aria-label="Ask the council"
          style={{
            flex: 1,
            minWidth: 0,
            background: "transparent",
            border: "none",
            outline: "none",
            color: "#ffffff",
            fontFamily: "'Rajdhani', sans-serif",
            fontSize: "1rem",
            letterSpacing: "0.02em",
          }}
        />
        <button
          type="submit"
          disabled={busy || !inputText.trim()}
          aria-label="Ask"
          style={{
            flexShrink: 0,
            width: 36,
            height: 36,
            display: "grid",
            placeItems: "center",
            borderRadius: "50%",
            border: "1px solid rgba(42, 214, 238, 0.45)",
            background: busy || !inputText.trim() ? "transparent" : "rgba(42, 214, 238, 0.16)",
            cursor: busy || !inputText.trim() ? "default" : "pointer",
            opacity: busy || !inputText.trim() ? 0.45 : 1,
            transition: "opacity 0.2s ease, background 0.2s ease",
          }}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="#2ad6ee" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 17, height: 17 }} aria-hidden="true">
            <line x1="22" y1="2" x2="11" y2="13" />
            <polygon points="22 2 15 22 11 13 2 9 22 2" />
          </svg>
        </button>
      </form>

      {/* Buy Modal */}
      <BuyModal isOpen={buyModalOpen} onClose={() => setBuyModalOpen(false)} />

      {/* SitePal animation-control experiment panel — dev only */}
      {process.env.NODE_ENV !== "production" && <SitePalExpressionPanel />}

      {/* ── Unified bottom dock ── App-style nav (MobileBottomNav).
          Slots L→R: $ BUY | CANDELARIUM | SPEAK (center) | TERMINAL | MORE.
          Always visible: asking now happens in the input bar above, so the dock
          never has to yield the screen to a drawer. */}
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
        /* Center FAB — the input bar below owns ASKing, so the FAB is a
           "hear her aloud" control instead: it speaks her greeting and, being a
           real gesture, unlocks the players' audio (same repurposing /main does
           when its drawer is already docked open). */
        onBuyClick={unlockAndGreet}
        centerSubLabel="SPEAK"
        centerTitle="Hear Our Lady's voice"
        centerLabel={
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 28, height: 28, display: "block", color: "#ffffff" }} aria-hidden="true">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
            <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
          </svg>
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
            label: "Candelarium",
            title: "Return to the candelarium",
            onClick: () => { window.location.href = "/"; },
            confirm: {
              title: "Return to the Candelarium",
              body: "Step back into Our Lady's candlelit hall — your vigil keeps burning.",
              accent: "hsl(189, 84%, 55%)",
              shadow: "hsl(189, 70%, 38%)",
            },
            // Same flame mark the other pages use for the candelarium slot.
            iconSrc: "/images/flame.svg",
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
                  body: "Strike gold in the digital frontier. Our Lady's miners never rest.",
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

      {/* ── First-visit apparition triptych ── all of Our Lady's faces, side
          by side, before any one of them reads as the default. Held until the
          asset loader clears so its entrance animation is actually seen. */}
      {pickerOpen && !isLoading && (
        <ApparitionTriptych apparitions={CHARACTERS} onChoose={handleApparitionChoose} />
      )}

    </div>
  );
}
