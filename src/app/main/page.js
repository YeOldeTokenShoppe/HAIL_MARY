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
import OracleCard from "@/components/OracleCard";
import { readApparitionKey, writeApparitionKey } from "@/lib/apparitionPrefs";
import { useMusic } from "@/components/MusicContext";
import MobileBottomNav from "@/components/MobileBottomNav";
import {
  askCounsel,
  speakInPortal,
  waitForPortal,
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
import { adviserMouth } from "@/lib/adviserMouth";

// ── /main ── THE INNER STRUGGLE, staged as a triptych.
//
// The seeker asks. The advisers do NOT answer them — they whisper at Our Lady's
// shoulders, each pressing her to answer their way, and she alone turns and
// speaks to the seeker:
//   Connor (right) — the devil's advocate. Lobbies her FOR the appetite.
//   St. GR80 (left)     — the saint. Petitions her from duty (categorical imperative).
//   Our Lady (centre)   — one short line, TO THE SEEKER. Never a verdict.
// The advisers say "they" of the seeker and "you" of her; only her "you" means
// the seeker. This matches what the page actually DRAWS — two shoulder figures
// leaning in at her frame (see ShoulderFigure) — where lines aimed straight at
// the seeker read as talking past the very person they were hovering over.
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
// The triptych row's geometry. These are READ BACK to place the two fixed things
// that must line up with her column (the gear, the ask bar), so they have to be
// the same numbers the panels actually lay out with — not copies that drift.
const PANEL_MAX_W = 440;
const PANEL_GAP = 16;
// How much larger Our Lady's frame is than an adviser's. She presides, and with
// her name plate gone (the RL80 mark right above her already says whose shrine
// this is) SIZE is what carries the hierarchy — a row of three identical frames
// reads as a panel of equals. Kept modest: past ~1.25 she stops presiding over
// the wings and starts crowding them.
const LADY_FRAME_SCALE = 1.18;

// ── Bottom furniture ── Two fixed things stack at the foot of the page: the
// dock, and the ask bar floating just above it. Anything that scrolls has to
// clear BOTH, so the measurements live here rather than being retyped as magic
// numbers — the bar's own offset and the clearance reserved for it MUST move
// together or they drift apart silently.
const SAFE_B = "env(safe-area-inset-bottom, 0px)";
const DOCK_H = 96; // MobileBottomNav
const ASK_BAR_H = 52; // 36px control + 7px padding ×2 + 1px border ×2
const ASK_BAR_GAP = 12; // breathing room between the bar and the content above
// The ask bar sits directly on top of the dock.
const ASK_BAR_BOTTOM = `calc(${DOCK_H}px + ${SAFE_B})`;
// Scrollable content must clear the dock AND the bar. Reserving only the dock
// left the last ~52px of the column permanently behind the ask bar — which is
// exactly where her apparition medallions land, so the roster sat half-hidden
// under the input and couldn't be scrolled out.
const BOTTOM_CLEARANCE = `calc(${DOCK_H + ASK_BAR_H + ASK_BAR_GAP}px + ${SAFE_B})`;

// ── The phone transcript's share of the screen ── ONE number, read by both the
// band's own maxHeight and soloFrameSize's reserve. They were independent (a
// 24dvh band against a flat 135px reserve) and disagreed by ~75px, which the
// column paid for by running its foot under the ask bar.
// THIS IS THE FRAME-VS-WORDS DIAL, and on a phone the frame wins. On an 820px
// phone, after the fixed furniture (dock 96 + ask bar 52 + gaps, ~160) there are
// only ~660px for frame + caption + button, and the frame eats size × 1.3 + 44 —
// so every pixel here comes off her face:
//     0.24 → caption ~197px (6 lines), frame ~278  ← tried as a SCROLLBACK; her
//                                                    mouth stopped reading as
//                                                    animation, which is the one
//                                                    thing a live player is for
//     0.12 → caption  ~98px (3 lines), frame ~355
//     0.10 → caption  ~82px (2-3 lines), frame ~366 ← here
// It only got this small once the phone stopped showing a scrollback at all: a
// caption holds one voice's line and is replaced by the next, so it never needs
// room to be scanned, and the reveal writes it out as it is spoken. Two to three
// lines is a subtitle. The full log still lives in the desktop rail.
const TRANSCRIPT_DVH = 0.1;
// "keep her words" under the band: 31px tall + 12px margin, measured.
const SHARE_BUTTON_H = 43;

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
// CASTING (confirmed 2026-07-15): Saint GR80 left, Our Lady centre, Connor
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
    name: "Connor",
    title: "Connor",
    frameHue: "#ff2d75",
    image: "/cameo_h80z.webp",
    sitePalScene: 2775052,
    embedId: "j02HKEP7AzkdQlqrMiNJIjxwV90YgRz8",
  },
];

const SHOULDER_LAYER_IMAGES = [
  "/shoulder-layers/angel/body.png",
  "/shoulder-layers/angel/left-wing.png",
  "/shoulder-layers/angel/right-wing.png",
  "/shoulder-layers/demon/body.png",
  "/shoulder-layers/demon/left-wing.png",
  "/shoulder-layers/demon/right-wing.png",
];

const portalContainerId = (key) => `sitepal-portal-${key}`;

/* ── The advisers' mouths ── Sprite frames laid over the figure art, swapped by
      the live amplitude of the voice currently speaking (see lib/adviserMouth).

   ART CONTRACT — each frame MUST be the same pixel size as its character's
   body.png (angel 600×829, demon 600×901) and otherwise fully transparent. That
   is what makes registration automatic: every layer is width:100% at inset:0, so
   a mouth drawn in place on a full-size canvas lands in place at every rendered
   scale, with no per-character offsets to tune (and nothing to re-tune when the
   figures resize with her frame).

   Each frame must also PAINT OVER the mouth baked into body.png — include enough
   surrounding face colour to cover it. `closed` exists for exactly this reason:
   it is not "no overlay", it is the baked mouth repainted, so the swap in and out
   of speech is invisible.

   Missing files are not an error. The <img> onError below retires the whole
   overlay permanently, so until the art lands the figures render exactly as they
   do today — drop the PNGs in and the mouths start working with no code change. */
const MOUTH_ART = {
  GR: {
    closed: "/shoulder-layers/angel/mouth-closed.png",
    mid: "/shoulder-layers/angel/mouth-mid.png",
    open: "/shoulder-layers/angel/mouth-open.png",
  },
  JB: {
    closed: "/shoulder-layers/demon/mouth-closed.png",
    mid: "/shoulder-layers/demon/mouth-mid.png",
    open: "/shoulder-layers/demon/mouth-open.png",
  },
};

// Where each character's mouth sits, as a fraction of the body image box —
// x/y are the mouth's CENTRE, not its top-left (the rect is translate(-50%,-50%)).
//
// MEASURED off the source art, not guessed:
//   GR80  angel/body.png 600×829 — the dark slot spans x 290–337, y 265–272,
//         so centre (313.5, 268), i.e. 47×8 px.
//   Barron demon/body.png 600×901 — the smirk curve spans x 305–372, y 280–296,
//         so centre (338.5, 288), i.e. 67×16 px. His is a CURVE, so the box
//         approximates a region rather than tracing the shape.
// These same source-pixel figures are what the sprite art should be drawn
// against — see the art contract above.
//
// ONLY used by the ?mouthdebug=1 preview rect; the real sprites are full-canvas
// overlays and need no coordinates at all.
const MOUTH_DEBUG_BOX = {
  GR: { x: 0.5225, y: 0.3233, w: 0.078, h: 0.010 },
  JB: { x: 0.5620, y: 0.3196, w: 0.100, h: 0.014 },
};

// Amplitude thresholds for the three frames. RMS×3.8 (the gain playUnicornBeat
// uses for Eugene's jaw) spends most of a spoken line between ~0.1 and ~0.6.
const MOUTH_MID_AT = 0.12;
const MOUTH_OPEN_AT = 0.40;

function FigureMouth({ voice, speaking, debug }) {
  const frameRefs = useRef({});
  const debugRef = useRef(null);
  // One failed load retires the overlay for the session — a broken-image glyph
  // on her shoulder is far worse than no mouth at all.
  const [artBroken, setArtBroken] = useState(false);

  // The rAF loop runs ONLY while this adviser holds the floor. At rest there is
  // nothing to animate and no reason to keep a frame callback alive next to a
  // live SitePal player and an R3F canvas.
  useEffect(() => {
    if (!speaking) return;
    let raf;
    let smoothed = 0;
    const tick = () => {
      // Smoothed a little past the analyser's own smoothing: at sprite-swap
      // granularity, raw RMS chatters between frames on sibilants and reads as
      // a flicker rather than as speech.
      smoothed += ((adviserMouth[voice] || 0) - smoothed) * 0.45;
      const level = smoothed < MOUTH_MID_AT ? "closed" : smoothed < MOUTH_OPEN_AT ? "mid" : "open";
      for (const k of ["closed", "mid", "open"]) {
        const el = frameRefs.current[k];
        if (el) el.style.opacity = k === level ? "1" : "0";
      }
      const d = debugRef.current;
      if (d) d.style.transform = `translate(-50%, -50%) scaleY(${(0.35 + smoothed * 2.6).toFixed(3)})`;
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => {
      cancelAnimationFrame(raf);
      for (const k of ["closed", "mid", "open"]) {
        const el = frameRefs.current[k];
        if (el) el.style.opacity = k === "closed" ? "1" : "0";
      }
    };
  }, [speaking, voice]);

  if (debug) {
    const b = MOUTH_DEBUG_BOX[voice];
    return (
      <div
        ref={debugRef}
        aria-hidden="true"
        style={{
          position: "absolute",
          left: `${b.x * 100}%`,
          top: `${b.y * 100}%`,
          width: `${b.w * 100}%`,
          height: `${b.h * 100}%`,
          zIndex: 3,
          borderRadius: "40%",
          background: "#12060a",
          opacity: speaking ? 1 : 0,
          transform: "translate(-50%, -50%) scaleY(0.35)",
          pointerEvents: "none",
        }}
      />
    );
  }

  if (artBroken) return null;

  return (
    <>
      {["closed", "mid", "open"].map((k) => (
        <img
          key={k}
          ref={(el) => { frameRefs.current[k] = el; }}
          src={MOUTH_ART[voice][k]}
          alt=""
          aria-hidden="true"
          onError={() => setArtBroken(true)}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "auto",
            display: "block",
            zIndex: 3,
            // Closed is the resting frame, so an idle figure already reads with
            // its mouth painted rather than popping one on at the first word.
            opacity: k === "closed" ? 1 : 0,
            pointerEvents: "none",
          }}
        />
      ))}
    </>
  );
}

// Stacked copies behind the RL80 wordmark — the god-ray beams. Taken from
// /fountain's wordmark, NOT the root hero's: the root drops the per-copy
// opacity, so all 100 beams land at full strength and the mark reads as an
// opaque slab. /fountain fades each copy by 1/index, and that falloff is the
// whole difference — the beam dissolves instead of piling up.
//
// The falloff also makes this count mostly self-limiting: by copy ~40 opacity
// is under 0.04, so the tail is paying GPU for nothing. Every copy is its own
// blurred layer, and unlike /fountain this page also carries a live SitePal
// mirror and an R3F canvas on the same GPU. 100 matches /fountain exactly;
// drop toward ~40 if the phone struggles — it should look near-identical.
const RL80_RAYS = 100;

// ── Starter petitions ── Shown only before the first question, where the page
// otherwise sits empty AND silent: her greeting is only ever spoken (never
// rendered), and on iOS it can't even play until a gesture unlocks audio. So a
// first-timer met a shrine, a blank field, and nothing else.
//
// Written as the seeker, not as a menu — a question or a confession, which is
// what the counsel prompt expects. Lowercase and unhedged, matching the voices'
// register. Each is chosen to pull a DIFFERENT argument out of the triptych:
// appetite, shame, and a real question about limits. Barron has something to
// say about all three, which is the point.
//
// SECOND TEST, added with Our Lady's repertoire (/api/counsel's OL voice): each
// must also pull a different MOVE out of HER — rule on it, recognise them, take
// a position on a real question. That is what retired "is money evil?": it is a
// fine hook and there is no PERSON in it, so all three voices answer it in the
// abstract, and an abstract question is exactly where an oracle goes vague. Its
// replacement asks the same thing with a life attached, which she has to answer.
// A chip that can be answered without knowing who asked it does not belong here.
//
// ── WHY THESE ARE GROUPED, AND NOT ONE FLAT LIST ── The trio is a SET, not
// three questions. Drawing three at random from a single pool regularly deals
// three variations of the same register, and that visitor meets a one-note
// shrine — the exact opposite of what variety is for. So the registers below are
// the unit: shuffle THEM, take three, draw one line from each. The trio can
// never double up, and it is different every visit.
// Adding a register is better than lengthening one. Each should pull a
// different argument out of the advisers AND a different move out of her.
// ── THE TEST EVERY LINE HAS TO PASS: is this the FIRST thing a stranger says? ──
// Stricter than the "must have a person in it" rule above, and it retired four
// lines that passed that one:
//   "i refresh it like it's a prayer."      ← refresh WHAT
//   "i think this one's different."         ← which one
//   "why can't i leave it alone?"           ← leave what alone
//   "i can't stop checking."                ← checking what
// A pronoun with no referent — "it", "this one", "this" — reads as the middle of
// a conversation, and a chip is by definition the opening of one. Name the thing:
// the price, the chart, the mistake.
// AND THE SAME FAULT HIDES IN VERBS, which is how "when do i get to stop?"
// survived a pronoun sweep: stop WHAT. An objectless verb presumes a backstory
// the stranger has not told you yet, exactly as a bare "it" does.
//
// ── AND THE DEEPEST VERSION, which no sweep catches: THE LINE ALREADY CONTAINS
// THE INSIGHT. These all named their subjects and still had to go:
//   "i keep making the same mistake and calling it experience."
//   "how many times can i buy the top before it's just who i am?"
//   "i don't know what i'm chasing anymore."
//   "i never set a number. that's the problem."
// Every one is a polished read on oneself — the thing you arrive at AFTER an
// hour of talking, not the thing you walk in with. Nobody opens with their own
// diagnosis, and a seeker who turns up already holding it leaves the room
// nothing to do: the chip has done HER job, and the exchange has nowhere to go.
// THE DIVISION OF LABOUR IS THE WHOLE PAGE — the seeker brings the situation,
// she brings the meaning. So write the FACTS and stop: sold last week, bought
// at the high, told everyone I was done. Let her be the one who says what it
// means. If a line would sound wise coming from the seeker, it belongs in her
// mouth, not on a chip.
// The second half of the test is tone. "our lady, i lit a candle. that's all
// i've got tonight." named its subject and still failed: it REPORTS IN, like a
// chore logged, and gives the room nothing to take hold of. A seeker who came
// this far wants something. Every line must ask, confess, or invoke — never file
// a status update. When in doubt, read the line aloud cold to someone who has
// never seen the page; if they say "what is?", it does not belong here.
//
// MOOD IS BALANCED WITHIN EACH REGISTER, not across the list. Statements are
// confessions and belong here — the ask bar says "Inquire or confide" and the
// counsel prompt takes both — but the chips are also how a first-timer learns
// what the page accepts, and the mix used to be 5 questions to 11 statements
// with every question in ONE register. A quarter of visits therefore showed
// three confessions and never taught that you may simply ask. Each register now
// carries roughly half and half, so any draw teaches both.
const STARTER_REGISTERS = [
  // APPETITE — Barron's home ground; she has to rule on whether they may want it.
  [
    // "everyone's buying. am i late?",
    // "why does everyone else look so sure?",
    // "i've never wanted to buy something this badly.",
    // "i want to put in more than i planned to.",
  ],
  // REGRET — recognition, and the place she is most often simply delighted.
  [
    "i sold everything last week and the price went up the next day.",
    "i told everyone i was done and then i bought more.",
    "why do i always buy right before it drops?",
    "how do people know when to sell?",
  ],
  // LIMITS — a real question she must take a position on rather than reframe.
  [
    // "how much would be enough?",
    // "what would i do with the money if i actually won?",
    // "i said i'd cash out at 10k. i'm at 40k and still here.",
    // "i've never picked a number to stop at.",
  ],
  // COMPULSION — the register a RITE answers, which is the move she reaches for
  // least and the one that gives a seeker something to carry out of the shrine.
  [
    "i can't stop checking the price.",
    "i check the chart before i check on anyone i love.",
    "why can't i put my phone down?",
    // "why am i checking the price at 3am?",
  ],
  // INVOCATION — the only register with NO problem in it, and it earns its place
  // by breaking the rule above it: a bare prayer names nothing, so by the
  // "must have a person in it" test it should fail. Tested against the live
  // endpoint instead of assumed, and it is the strongest chip here — the room
  // treats the emptiness AS the content (Barron demands the confession, GR80
  // says a prayer deserves to be heard whole, she says "say the whole thing").
  // It is also the only chip that OPENS a conversation rather than closing one:
  // every other gets a complete answer and ends, this one asks for a second turn.
  [
    "our lady, hear my prayer.",
      
    "our lady, hear my confession.",
    // "our lady, hear my prayer. i don't know what i'm asking for.",
    // "our lady, i don't know how to pray for money.",
    // The one "this" that stays. It points at what the seeker is DOING right
    // now — standing in a shrine, having come here on purpose — not back at a
    // conversation that never happened. Deictic, not dangling.
    // "does this count as praying?",
  ],
];

// ── The cold open ── What the room says before anyone asks it anything.
//
// The page used to sit silent until the first question, so a first-timer had no
// way to learn that there are three voices, that the advisers argue TO HER, or
// that she is the one who answers them. This demonstrates all of it in about ten
// seconds without the seeker typing a word — the staging is the thing that needs
// teaching, and it teaches far better than it explains.
//
// AUTHORED, NOT GENERATED, on purpose: an LLM call on every page load would cost
// money for something nobody asked for, add latency to the first impression, and
// risk breaking her voice rules on the one line most likely to be someone's only
// line. These are also free to be funnier than a generated line dares to be.
//
// Same staging as /api/counsel: JB and GR speak TO HER about the seeker, and only
// OL addresses the seeker. Keep it that way — this is the seeker's first lesson
// in how to read the page, so a line that breaks the staging here teaches the
// wrong thing permanently.
const COLD_OPENS = [
  [
    { s: "JB", t: "another one, my lady. they always come down here at this hour, and it is never because things are going well." },
    { s: "GR", t: "or they came for company while they think. barron reads arriving as weakness; usually it is just honesty." },
    { s: "OL", t: "sit down. you don't have to have the question ready." },
  ],
  [
    { s: "JB", t: "look at that face, my lady. that is a face that has already decided and came down here for absolution." },
    { s: "GR", t: "he says that about everyone who walks in. log it as a guess, not a finding." },
    { s: "OL", t: "whatever you decided, it's still yours. tell me anyway." },
  ],
  [
    { s: "JB", t: "the room's been loud all week, my lady. they heard it from here. let them ask me first." },
    { s: "GR", t: "they will ask whoever answers plainly. that has never been you, barron." },
    { s: "OL", t: "you're not late and you're not early. you're just here." },
  ],
  [
    { s: "JB", t: "my lady, i had the whole afternoon planned and then this one went and lit a candle." },
    { s: "GR", t: "the candle is not for you, barron." },
    { s: "OL", t: "ask me something. or don't, and just stay a minute." },
  ],
];

const pickColdOpen = () => COLD_OPENS[Math.floor(Math.random() * COLD_OPENS.length)];

// One line from each of up to `count` different registers, in a random order.
function drawStarters(count = 3) {
  // EMPTY REGISTERS ARE DROPPED FIRST, and this is not defensive padding — it
  // is the authoring workflow. Tuning this list means commenting lines out, and
  // commenting out ALL of a register leaves `[]` behind. Without this filter
  // that register is still dealt, `lines[Math.floor(Math.random() * 0)]` is
  // undefined, and the page renders a blank chip: a button with no words that
  // asks the shrine nothing. Filtering entries too, so a stray hole in an array
  // can't do the same thing.
  // Fewer live registers than `count` simply deals fewer chips — which is right.
  // Three chips is a layout, not a requirement.
  const registers = STARTER_REGISTERS.map((lines) => lines.filter(Boolean)).filter(
    (lines) => lines.length > 0,
  );
  // Fisher-Yates over the REGISTERS, so the three that show are always from
  // different ones — the whole point of the grouping above.
  for (let i = registers.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [registers[i], registers[j]] = [registers[j], registers[i]];
  }
  return registers
    .slice(0, count)
    .map((lines) => lines[Math.floor(Math.random() * lines.length)]);
}

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
  JB: { name: "Connor", hue: "#ff2d75" },
  GR: { name: "Saint GR80", hue: "#22ccff" },
  OL: { name: "Our Lady", hue: "#f4b53f" },
};

// The face beside each line in the wide transcript rail. The advisers no longer
// hold panels of their own on ANY layout — they're the shoulder figures now, and
// a figure hovering at her frame is too small to read as a portrait. The rail is
// where their faces are legible, so the cameo goes there. Our Lady's is not
// listed: hers is whichever apparition is active, passed in at render.
const SPEAKER_FACE = { JB: "/cameo_h80z.webp", GR: "/cameo_GR80.webp" };

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
  //
  // HIDE BY OPACITY, NEVER BY DISTANCE. A subframe parked off-screen has an
  // empty window clip rect, and WebKit throttles it hard: requestAnimationFrame
  // drops to one tick per 10s. Measured on an iPhone with left:-9999 — the frame
  // ran at 0.1fps and her canvas changed 3 times in 34s. The player stays alive
  // and audible (audio is untouched by rendering throttles), so she speaks with a
  // frozen face and never lip-syncs. Desktop Chrome doesn't throttle same-origin
  // frames, which is why this only ever showed on a phone.
  //
  // The pre-triptych /main embedded SitePal in THIS document, where left:-9999
  // was harmless — a visible top document never throttles. An iframe is its own
  // document: off-screen means asleep. So the frames sit AT the origin, hidden
  // by opacity and z-order instead. To re-verify after touching this, count rAF
  // ticks INSIDE the frame: ~60/s means awake, 0.1/s means it's asleep again.
  //
  // ── WHY 0.002 AND NOT 0.01 ── The opacity is not just "hidden enough", it is a
  // BRIGHTNESS BUDGET. These are three 600×800 boxes stacked at the origin, and
  // whatever fraction survives is three copies of a brightly-lit SitePal scene
  // painted over a near-black apse. At 0.01 that is ~3×2.5 = 7 levels of extra
  // light inside a 600×800 rectangle — plainly visible as a lighter panel whose
  // right edge lands at x=600: a hard vertical seam straight down the page.
  // It went unnoticed for as long as it did because nothing used to sit under it.
  // The triptych covered this corner with her panel's opaque chrome, and a phone
  // is narrower than 600 so the rectangle spans the whole screen and has no
  // visible edge — the seam only exists on a WIDE, TRANSPARENT layout, which is
  // exactly what the desktop stage is. 0.002 puts three stacked copies under one
  // 8-bit level, so it cannot quantise to a visible step at any backdrop.
  // Do NOT take it to 0: that is the one value that reads as "not rendered" and
  // risks the throttling this whole note exists to prevent.
  return (
    <>
      {portals.map((p) => (
        <div
          key={p.key}
          id={portalContainerId(p.key)}
          style={{
            position: "fixed",
            left: 0,
            top: 0,
            width: 600,
            height: 800,
            opacity: 0.002,
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
      is carried by the halo of their own hue plus a slight lean-in instead. */
function ShoulderFigure({
  src,
  side,
  lit,
  hue,
  mirrored = false,
  alt,
  arrived = true,
  layers = null,
  wingMotion = "angel",
  // Sized in PROPORTION to her frame, never flat. These were 112/28 constants,
  // tuned against the phone's 250px frame — correct there and wrong everywhere
  // else: on the desktop stage her frame runs to ~520 and the same 112px figures
  // read as insects perched on the filigree rather than as the two advisers.
  // PortraitPanel derives both from frameSize, and at 250 the arithmetic returns
  // these exact numbers, so the phone composition is untouched.
  size = 112,
  offset = 28,
  // Which voice this figure speaks with ("GR" | "JB"), so its mouth can follow
  // the right analyser. Null = no mouth (the figure is decoration only).
  voice = null,
  mouthDebug = false,
}) {
  return (
    // FOUR layers, because four things animate independently and would
    // otherwise clobber each other:
    //   outer — the fly-in (translateX), a one-shot transition
    //   hover — the endless hover (keyframed translateY/rotate)
    //   lean  — the mirror + lean-in (scaleX/scale)
    //   glow  — the halo, cross-faded by opacity (see its note below)
    // Collapse any two transforms onto one element and the keyframe wins every
    // frame, freezing or teleporting the others.
    <div
      style={{
        position: "absolute",
        top: "15%",
        [side]: -offset,
        width: size,
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
        // STATIC. Never make this depend on `lit` — see the glow layer below.
        filter: "drop-shadow(0 6px 10px rgba(0,0,0,0.55))",
      }}
    >
      <div className={`hm2-figure hm2-figure--${side}`}>
        {/* Mirror (Barron whispers toward her) composed with a small lean-in
            while speaking. transformOrigin MUST stay centred: an edge origin
            makes scaleX(-1) mirror the figure across that edge, i.e. bodily
            outside its own box — it threw Barron a full width leftward, on top
            of her face. Scale from the centre; the flip happens in place.
            Lives on its own layer so the hover keyframe above can't clobber it. */}
        <div
          style={{
            position: "relative",
            transform: `${mirrored ? "scaleX(-1)" : ""} scale(${lit ? 1.07 : 1})`.trim(),
            transformOrigin: "center center",
            transition: "transform 0.45s ease",
          }}
        >
          {/* ── The glow, as its own layer ── A copy of the silhouette carrying
              a STATIC hue filter, cross-faded by OPACITY alone.
              Do NOT collapse this back into a `lit ? glow : none` filter on an
              ancestor. That's what it was, and iOS never painted it: measured on
              an iPhone (2026-07-15) mid-line with Barron audible — React had the
              speaker right and the element computed all 3 drop-shadows, yet
              nothing rendered. The hover keyframe promotes this subtree to a
              composited layer that iOS rasterises once and won't re-raster when
              an ancestor's filter changes. A filter that never changes rasterises
              correctly, and opacity is the one thing iOS always recomposites — so
              the glow fades in instead of switching on. Desktop never showed it:
              only WebKit rasterises this way. */}
          {/* ── Backglow, and why it carries NO filter ── Light behind the
              figure, drawn as a plain radial gradient cross-faded by opacity.
              Nothing here is filtered and nothing inside it animates, which is
              the entire point: it is the one layer WebKit cannot decline to
              paint, so the "who is speaking" signal survives even when the
              halo below it is dropped. On desktop the two simply stack. */}
          <div
            aria-hidden="true"
            style={{
              position: "absolute",
              left: "50%",
              top: "50%",
              width: "165%",
              height: "165%",
              transform: "translate(-50%, -50%)",
              background: `radial-gradient(closest-side, ${hue}59 0%, ${hue}24 42%, rgba(0,0,0,0) 70%)`,
              opacity: lit ? 1 : 0,
              transition: "opacity 0.35s ease",
              pointerEvents: "none",
              zIndex: 0,
            }}
          />
          {layers ? (
            <div
              aria-hidden="true"
              style={{
                position: "absolute",
                left: 0,
                top: 0,
                width: "100%",
                filter: `drop-shadow(0 0 14px ${hue}) drop-shadow(0 0 30px ${hue}66)`,
                opacity: lit ? 1 : 0,
                transition: "opacity 0.35s ease",
                willChange: "opacity",
              }}
            >
              {/* BODY ONLY — the wings are deliberately not copied here.
                  They were, from 14da623 (2026-07-16) until this, and that is
                  what silently broke the iOS fix landed the day before in
                  fe5b38f: the filter value stayed static, but the subtree it
                  filtered now animated every frame, so WebKit went back to
                  rasterising once and never repainting the halo. A filter is
                  only "static" to WebKit if what's UNDER it holds still too.
                  Cost of the fix: the halo hugs the body and not the wingtips.
                  Do not re-add the wings here — add light to the backglow above. */}
              <img
                src={layers.body}
                alt=""
                aria-hidden="true"
                style={{
                  position: "relative",
                  zIndex: 2,
                  width: "100%",
                  height: "auto",
                  display: "block",
                }}
              />
            </div>
          ) : (
            <img
              src={src}
              alt=""
              aria-hidden="true"
              style={{
                position: "absolute",
                left: 0,
                top: 0,
                width: "100%",
                height: "auto",
                display: "block",
                filter: `drop-shadow(0 0 14px ${hue}) drop-shadow(0 0 30px ${hue}66)`,
                opacity: lit ? 1 : 0,
                transition: "opacity 0.35s ease",
                willChange: "opacity",
              }}
            />
          )}
          {/* The figure itself, sitting exactly on top of its own glow so only
              the halo spills past the silhouette. When wing layers exist, the
              body establishes the box and each wing gets its own transform. */}
          {layers ? (
            <div
              style={{
                position: "relative",
                width: "100%",
              }}
            >
              <img
                className={`hm2-wing hm2-wing--${wingMotion} hm2-wing--left`}
                src={layers.left}
                alt=""
                aria-hidden="true"
              />
              <img
                className={`hm2-wing hm2-wing--${wingMotion} hm2-wing--right`}
                src={layers.right}
                alt=""
                aria-hidden="true"
              />
              <img
                src={layers.body}
                alt={alt}
                style={{
                  position: "relative",
                  zIndex: 2,
                  width: "100%",
                  height: "auto",
                  display: "block",
                }}
              />
              {/* The mouth rides ON the body layer (z 3 > the body's z 2) and
                  inside this same box, so it scales with the figure for free.
                  Deliberately NOT added to the glow copy above: the halo is a
                  silhouette, and a mouth inside it would just smear. */}
              {voice && (
                <FigureMouth voice={voice} speaking={lit} debug={mouthDebug} />
              )}
            </div>
          ) : (
            <img
              src={src}
              alt={alt}
              style={{
                position: "relative",
                width: "100%",
                height: "auto",
                display: "block",
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}

/* ── One portrait panel ── /main's center column, extracted so the row can
      render it PANEL_COUNT times. Every copy is identical: same apparition,
      same greeting, same live SitePal mirror. */
function PortraitPanel({
  isMobile,
  // ONE panel on screen, so this is the whole composition rather than a column
  // of three. Drives layout (stacking, scrolling, panel chrome); isMobile still
  // drives sizes and the phone-only corner mark. See MainPage's isSolo.
  isSolo,
  // Responsive frame size for the solo layout (see MainPage's soloFrameSize).
  soloSize = 250,
  // Responsive frame size for the triptych (see MainPage's triptychFrameSize) —
  // 340 wherever it fits, smaller only on a window too short to hold it.
  triptychSize = 340,
  characters,
  activeCharIndex,
  onSelect,
  sitePalReady,
  oracleGreeting,
  onPortraitReady,
  sourceContainerId,
  title = null,
  // Which seat stamps the RL80 corner mark. This USED to be inferred from
  // `!title` — the advisers had name plates, she didn't, so "untitled" meant
  // "hers". Giving her a plate broke that inference and silently deleted the
  // wordmark from the page, so the mark is now asked for explicitly.
  showMark = false,
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
  // ?mouthdebug=1 — draw a plain rect where each mouth will be, so the amplitude
  // pipeline can be verified before the sprite art exists.
  mouthDebug = false,
  // Solo on a WIDE viewport: same composition, but standing on a stage with room
  // around it rather than filling a phone. Only affects chrome that was sized
  // for a 375px column (the corner mark); the composition itself scales off
  // frameSize and needs no flag.
  wide = false,
}) {
  // Phones stay at 250. 285 was tried and reverted: the room freed by moving the
  // title and roster into the corners was NOT spare — the transcript was already
  // using it. A bigger frame just pushed the transcript under the ask bar, and
  // flexbox squeezed it to a clipped single line. She and the transcript are in
  // direct competition for one column; 250 leaves the argument legible.
  // CEILING if this is ever raised: the shoulder figures hang 28px off each side
  // of this box (see ShoulderFigure's [side]: -28), so it must stay under
  // viewportWidth - 56 or the saint and Barron get clipped by the panel's
  // overflowX — i.e. under ~319 on a 375px phone.
  const frameSize = compact ? 150 : isSolo ? soloSize : triptychSize;
  // The shoulder figures, scaled to whatever frame they're attending. The two
  // ratios are the phone's tuned 112/28 divided by its 250px frame, so a 250
  // frame reproduces the original numbers exactly and every larger stage keeps
  // the same silhouette. Anything that reserves horizontal room for this
  // composition must use OVERHANG (see MainPage's soloFrameSize).
  const figureSize = Math.round(frameSize * 0.45);
  const figureOverhang = Math.round(frameSize * 0.112);
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
        flex: compact ? "1 1 0" : isSolo ? "0 0 auto" : "1 1 0",
        minWidth: 0,
        width: !compact && isSolo ? "100%" : undefined,
        // PANEL_MAX_W is a TRIPTYCH number — three 440px columns laid across a
        // monitor. The solo composition is WIDER than one of those columns: the
        // frame runs to 520 on a desktop stage (soloFrameSize's cap) and a
        // shoulder figure hangs figureOverhang off each side of it. Capping the
        // panel at 440 broke the stage two ways, both of them visible:
        //   • `overflowX:"hidden"` below clipped at the panel's edge, slicing
        //     the devil's advocate down a hard vertical line ~2/3 of the way
        //     through him — the "extra div" seam on the right of the scene.
        //   • `margin:"0 auto"` on the frame box CANNOT centre a box wider than
        //     its parent — it overflows to the RIGHT — so the whole composition
        //     drifted ~56px off the stage axis that the ask bar and the starter
        //     chips are centred on (both do `left:0; right:railWidth`).
        // Solo sizes the cap to the composition it actually holds. This never
        // exceeds the stage: soloFrameSize's widthCap already solves
        // frameSize × 1.224 + 16 ≤ stageWidth for exactly this box.
        maxWidth: isSolo ? frameSize + 2 * figureOverhang : PANEL_MAX_W,
        height: isSolo ? "auto" : "100%",
        pointerEvents: "auto",
        display: "flex",
        flexDirection: "column",
        // The stacked column scrolls as ONE list on phones; each panel sizes to
        // its content instead of owning a scroller.
        overflowY: isSolo ? "visible" : "auto",
        // iOS: the rotated/skewed title's transformed bounds extend past the
        // viewport, which Safari treats as pannable overflow ("horizontal
        // play"). Clip it and restrict touch gestures to vertical panning.
        // TRIPTYCH ONLY, and that is precisely where the guard applies: the
        // title is position:fixed, and only the triptych's backdrop-filter makes
        // this panel its containing block (see the mark's note below). In solo
        // it pins to the VIEWPORT, so it contributes nothing to this box's
        // overflow and there is nothing here left to clip — except the scene.
        // And it did clip the scene: the wings sweep up to frameSize × 0.08 past
        // the composition at the top of a flap, so even a panel sized exactly to
        // the composition cuts the devil's advocate's wingtips against a hard
        // vertical edge. Nothing below this is unbounded — the stage is itself a
        // scroll container (overflowY:auto ⇒ overflowX:auto) with touchAction
        // pan-y, so it still backstops the gesture the note above is about.
        overflowX: isSolo ? "visible" : "hidden",
        touchAction: "pan-y",
        overscrollBehavior: "contain",
        // Clearance for the dock and the ask bar: without it a panel's last
        // ~150px can never scroll out from behind them. On phones the stacked
        // column owns that clearance ONCE — repeating it per panel stacked
        // ~150px of void between every face.
        paddingBottom: isSolo ? 10 : BOTTOM_CLEARANCE,
        fontFamily: "'Cyber', 'Geo', sans-serif",
        // Panel chrome is a TRIPTYCH device — three columns need seams and a
        // backing to read as separate panels. On a phone there's one
        // composition, and that 50%-black backing would just mute the apse
        // gradient the figures are lit against.
        ...(isSolo
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
      {/* ── The page's mark ── The RL80 wordmark, in the corner, on EVERY layout.
          It renders from HER seat only (`showMark`) — the advisers must not each
          stamp their own copy into the same corner.
          It was a centred DropInTitle above the frame. On a phone that ate ~110px
          off the top of a 375px screen and pushed her medallions under the ask
          bar; across the triptych, three full-size titles read as a headline row
          competing with the three portraits under them. Out of flow it costs the
          composition nothing, and it is now the only thing naming the page, since
          the character names shrank to plates under their frames.
          SCALED, not re-sized: the letters carry a fixed 6px text-shadow stack
          and 2px letter-spacing, so dropping fontSize alone leaves the shadow at
          half the glyph height and turns the type to mud. A transform shrinks
          the shadow with the letters. */}
      {!compact && showMark && (
      <div
        className="custom-title"
        style={{
          zIndex: 1000,
          // Clip only while collapsed — at rest the rotated/skewed letters
          // render outside their layout box and must not be cut
          overflow: "visible",
          // "fixed" RESOLVES TO TWO DIFFERENT BOXES HERE, and that is
          // load-bearing rather than sloppy:
          //   SOLO — the panel is background:transparent with no backdrop-filter,
          //     so this pins to the VIEWPORT: the phone's top-left corner.
          //   TRIPTYCH — the panel carries backdropFilter for its chrome, and a
          //     backdrop-filter makes an element the containing block for its
          //     position:fixed descendants (the same spec quirk the shared candle
          //     picker had to portal past). So this pins to HER PANEL, and the
          //     rays fall from her own corner onto her instead of landing on
          //     GR80 clear across the screen. That is the look we want — but it
          //     is a CONSEQUENCE OF THE PANEL CHROME, not of this rule. Strip the
          //     backdrop-filter and the mark silently jumps to the viewport
          //     corner; if that happens, anchor it explicitly rather than
          //     re-tuning `left` until it looks right again.
          position: "fixed",
          // Room to breathe under the browser chrome. The inset is 0 in normal
          // Safari (the toolbar already holds that space) but real if this is
          // ever added to the home screen and runs standalone, where the mark
          // would otherwise sit in the status bar.
          top: "calc(16px + env(safe-area-inset-top, 0px))",
          // Measured from the viewport on solo, from her panel on the triptych.
          left: isSolo && !wide ? 10 : 18,
          // Bigger where there's room to be bigger. 0.46 is the PHONE's answer —
          // it exists because the mark competes with a 375px column for width,
          // which is not a problem a desktop stage has.
          transform: isSolo && !wide ? "scale(0.46)" : "scale(0.6)",
          transformOrigin: "top left",
          // A corner mark must never eat taps meant for the scene.
          pointerEvents: "none",
        }}
      >
        {
          /* The RL80 wordmark + god rays, lifted from the root's hero. The root
             ALTERNATES this with a gothic "Our Lady" face; here it's fixed — a
             corner mark that swaps identity every few seconds pulls the eye off
             her, which is the one thing this page is for. fontFamily is inline
             to match the app's font-loading convention (layout.js keys its
             reveal off [style*="Unifraktur…"]). */
          <div
            className="hm2-rl80"
            role="img"
            aria-label="RL80 — Our Lady of Perpetual Profit"
            style={{ fontFamily: "'UnifrakturMaguntia', serif" }}
          >
            RL80
            {Array.from({ length: RL80_RAYS }).map((_, i) => {
              const index = i + 1;
              return (
                <span
                  key={index}
                  className="hm2-rl80-ray"
                  aria-hidden="true"
                  style={{
                    color: `rgb(${Math.max(0, 255 - index * 2)}, ${Math.max(
                      0,
                      255 - index * 3,
                    )}, ${Math.max(0, 255 - index * 2)})`,
                    // The whole reason this reads softer than the root's: each
                    // copy fades hyperbolically, so the beam dissolves instead
                    // of stacking 100 opaque copies into a slab.
                    opacity: (1 / index) * 1.5,
                    transform: `translate(${index * 0.1}rem, ${index * 0.1}rem) scale(${
                      1 + index * 0.01
                    })`,
                  }}
                >
                  RL80
                </span>
              );
            })}
          </div>
        }
      </div>
      )}

      {/* ── Matting above the frame ── The triptych panel owns the full viewport
          height but its content is one 340px frame, so pinned to flex-start it
          put every face in the top ~45% with a half-screen of black under it —
          the single loudest reason the desktop layout read as broken rather than
          as composed. This spacer and the caption band below split the slack
          0.6 : 1, which lands the group a little ABOVE centre: the face is the
          subject, and matting a portrait dead-centre reads as bottom-heavy.
          (Both grow values must keep summing to >1 — flexbox hands out only that
          FRACTION of the free space when the total is under 1, so trimming this
          to, say, 0.3 without touching the band would strand slack at the foot.)
          Solo has no slack to split — its column is sized to the frame — so it
          stays pinned. */}
      {!isSolo && <div style={{ flex: 0.6 }} />}

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
              wingMotion="angel"
              size={figureSize}
              offset={figureOverhang}
              voice="GR"
              mouthDebug={mouthDebug}
              layers={{
                body: "/shoulder-layers/angel/body.png",
                left: "/shoulder-layers/angel/left-wing.png",
                right: "/shoulder-layers/angel/right-wing.png",
              }}
            />
            <ShoulderFigure
              src="/shoulder_demon.webp"
              side="right"
              mirrored
              lit={speakingKey === "JB"}
              hue={SPEAKER.JB.hue}
              alt="Connor"
              arrived={figuresIn}
              wingMotion="demon"
              size={figureSize}
              offset={figureOverhang}
              voice="JB"
              mouthDebug={mouthDebug}
              layers={{
                body: "/shoulder-layers/demon/body.png",
                left: "/shoulder-layers/demon/left-wing.png",
                right: "/shoulder-layers/demon/right-wing.png",
              }}
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
          /* The block under the frame — arrows, medallions, name — is off on
             EVERY layout here; the corner gear owns the roster now. It was
             costing ~66px of a phone column that had none to spare; on the
             triptych it printed each adviser's name a second time under a frame
             already titled with it; and mid-size it collided with the SPEAK
             button. Nothing was left for it to do. */
          showRoster={false}
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

      {/* ── Name plate ── Under the face, small. This replaced a full DropInTitle
          shouting each adviser's name over their frame: at that size the type
          competed with the portrait it was labelling, and three of them across
          the triptych read as a headline row rather than a composition. A name
          is a label — it should be legible and then get out of the way.
          The ADVISERS get one; she does not (see renderSeat's `title`) — the RL80
          mark hangs directly over her head, so a plate would be the same answer
          twice. Lights in the speaker's own hue as they take the floor, so the
          name tracks the argument. */}
      {title && (
        <div
          style={{
            textAlign: "center",
            marginTop: 8,
            fontFamily: "'Rajdhani', sans-serif",
            fontSize: "0.8rem",
            fontWeight: 600,
            letterSpacing: "0.22em",
            textTransform: "uppercase",
            color: speaking ? hue : "rgba(255, 255, 255, 0.46)",
            textShadow: speaking ? `0 0 12px ${hue}99` : "none",
            transition: "color 0.3s ease, text-shadow 0.3s ease",
          }}
        >
          {title}
        </div>
      )}

      {/* ── What this voice just said ── The argument reads under the face
          that's making it. The speaker holding the floor is lit in their own
          hue, so the eye follows the deliberation across the triptych.
          (Desktop only — phones read the group text instead.)
          THE BAND IS THE SPACER. It used to be a bare `flex:1` div that pushed
          the status line to the floor, with the caption box adding its own height
          above it — so the first answer grew the panel and shoved the whole
          composition upward as it landed. A fixed minHeight reserve was tried
          first and is worse: it adds ~92px unconditionally, which tipped a panel
          that only just fits at ~690px tall (a laptop window) into scrolling and
          pushed the status line out of view. Making the empty slack itself the
          caption's container costs zero height, so the line arrives INTO space
          the panel already had — no reflow, no scrollbar, nothing to reserve.
          `1 0 auto`, not `1`: an argument longer than the slack must keep its own
          height (basis auto, no shrink) rather than being crushed into it. */}
      {!isSolo && (
        <div
          style={{
            flex: "1 0 auto",
            margin: compact ? "8px 6px 0" : "10px 14px 0",
          }}
        >
          {caption && (
            <div
              style={{
                padding: compact ? "8px 9px" : "10px 12px",
                borderRadius: 10,
                border: `1px solid ${speaking ? hue : "rgba(255,255,255,0.10)"}`,
                background: speaking ? `${hue}14` : "rgba(255,255,255,0.03)",
                boxShadow: speaking ? `0 0 16px ${hue}44` : "none",
                transition:
                  "border-color 0.3s ease, box-shadow 0.3s ease, background 0.3s ease",
                fontFamily: "'Rajdhani', sans-serif",
                fontSize: compact ? "0.82rem" : "0.95rem",
                lineHeight: compact ? 1.35 : 1.45,
                color: speaking ? "#ffffff" : "rgba(255,255,255,0.72)",
              }}
            >
              {caption}
            </div>
          )}
        </div>
      )}


      {/* ── Status line ── Pinned to the floor of a panel that owns the viewport.
          The spacer that used to do the pinning is gone: the caption band above
          is now the growing element, so it holds the status line down by itself.
          Stacked on a phone each panel sizes to its content, so there is nothing
          to pin and the footer would just repeat three times. */}
      {!isSolo && (
        <>
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

/* ── The transcript rail ── What the wide layout does with the room the phone
      doesn't have. The composition is IDENTICAL at every width — Our Lady framed
      with the saint and the devil's advocate at her shoulders — so a desktop's
      spare 400px cannot go to the scene without changing it. It goes to the
      argument instead: the deliberation as a standing record beside the stage,
      where a phone can only afford a 24dvh window of it under her.

      This is the same chatLog the phone renders, laid out for a column that runs
      the full height of the window rather than a band squeezed between her frame
      and the ask bar. It gets what that band can't afford: the speaker's face,
      breathing room between turns, and the seeker's own questions set as rules
      across the column so the exchanges are separable at a glance.

      NOT captions. The triptych captioned each line under the face making it,
      which is why it needed no scrollback; the solo stage has one face and two
      figures, so the transcript IS the record and has to hold everything. */
function TranscriptRail({ width, chatLog, speakingKey, busy, boxRef, ladyFace, onShare, reveal }) {
  const faceFor = (who) => (who === "OL" ? ladyFace : SPEAKER_FACE[who]);
  // The line currently being spoken shows only as far as the voice has got —
  // see MainPage's `reveal`. Everything else shows whole.
  const shown = (m, i) =>
    reveal && reveal.i === i ? m.text.slice(0, reveal.chars) : m.text;
  return (
    <div
      style={{
        width,
        flexShrink: 0,
        height: "100%",
        display: "flex",
        flexDirection: "column",
        pointerEvents: "auto",
        // The triptych's panel chrome, kept: this page already says "a bounded
        // column of its own" with a hairline over a black wash, and the rail is
        // exactly that. It WANTS a defined edge — the stage is a lit apse and the
        // rail is a surface set against it, so letting the two blend just makes
        // the transcript look like text floating on the scene.
        //
        // This was briefly a soft transparent-to-black ramp with no border, while
        // hunting a vertical seam down the purple. That was a misdiagnosis: the
        // seam was the SitePal portal boxes (see SitePalPortals — three 600×800
        // layers at the origin, whose right edge lands at x=600), and it survived
        // this element being stripped entirely. Fixed at the source there, so the
        // border is free to be a border. NOTE the backdrop-filter is deliberately
        // NOT restored: saturate(180%) re-tints the apse gradient behind the rail,
        // which puts a second, softer tonal step alongside this one. The hairline
        // alone is a cleaner edge.
        borderLeft: "1px solid rgba(0, 255, 255, 0.18)",
        background: "rgba(0, 0, 0, 0.42)",
        fontFamily: "'Rajdhani', sans-serif",
      }}
    >
      <div
        style={{
          padding: "16px 18px 12px",
          borderBottom: "1px solid rgba(0, 255, 255, 0.1)",
          fontSize: "0.62rem",
          letterSpacing: "0.28em",
          textTransform: "uppercase",
          color: "rgba(42, 214, 238, 0.55)",
        }}
      >
        the deliberation
      </div>

      <div
        ref={boxRef}
        style={{
          flex: 1,
          minHeight: 0, // or the list's own height wins and the column never scrolls
          overflowY: "auto",
          overscrollBehavior: "contain",
          padding: "18px 18px 22px",
          display: "flex",
          flexDirection: "column",
          gap: 16,
        }}
      >
        {chatLog.length === 0 ? (
          // An empty rail must still say what the column is FOR — otherwise the
          // first-time visitor's widest layout is a stage plus a blank slab.
          // IT ALSO TEACHES THE STAGING, which is not self-evident from a still
          // frame: the two advisers argue TO HER, about the seeker's question,
          // and she is the only one who turns and answers the seeker (see
          // /api/counsel's SYSTEM_PROMPT). "the council is seated and silent /
          // ask, and they will argue it out here" promised the opposite — the
          // wings arguing AT the seeker — so the first reply read as three
          // voices talking past the person who asked. "hired consultants to help
          // HER consider" fixes the direction in the joke itself: they are
          // retained by her, and the seeker simply overhears the meeting.
          // If the staging over there ever changes, this line changes with it.
          // The line break is a comic beat, not a wrap — "… and your questions"
          // is the punchline and has to land alone. The rest wraps naturally to
          // the rail (~294–404px of content, see railWidth), so don't add breaks
          // to it: a hand-set break lands mid-clause at some rail widths.
          // No "ask" instruction any more, deliberately — the ask bar's own
          // placeholder ("Inquire or confide") is directly under her and says it,
          // and a shrine that captions its own input twice reads as a form.
          <div
            style={{
              margin: "auto 0",
              textAlign: "center",
              fontSize: "0.86rem",
              lineHeight: 1.6,
              color: "rgba(255,255,255,0.34)",
            }}
          >
            Our Lady has hired consultants to help her consider both sides of
            any coin.
            <br />
            … and your questions.
          </div>
        ) : (
          chatLog.map((m, i) => {
            const who = SPEAKER[m.who] || SPEAKER.you;
            const live = speakingKey === m.who && i === chatLog.length - 1;

            // The seeker's own line is not a reply — it's what the replies are
            // ABOUT. Set as a rule across the column it doubles as the divider
            // between turns, so a long scrollback stays parseable without any
            // extra chrome to separate exchanges.
            if (m.who === "you") {
              return (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    margin: i === 0 ? "0 0 2px" : "8px 0 2px",
                  }}
                >
                  <span style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.12)" }} />
                  <span
                    style={{
                      flexShrink: 1,
                      fontSize: "0.82rem",
                      lineHeight: 1.4,
                      textAlign: "center",
                      color: "rgba(255,255,255,0.55)",
                      fontStyle: "italic",
                    }}
                  >
                    {m.text}
                  </span>
                  <span style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.12)" }} />
                </div>
              );
            }

            return (
              <div key={i} style={{ display: "flex", gap: 11, alignItems: "flex-start" }}>
                <span
                  aria-hidden="true"
                  style={{
                    width: 32,
                    height: 32,
                    flexShrink: 0,
                    borderRadius: "50%",
                    border: `1px solid ${live ? who.hue : `${who.hue}55`}`,
                    backgroundImage: `url(${faceFor(m.who)})`,
                    backgroundSize: "cover",
                    backgroundPosition: "center top",
                    // Lights with the voice, the same way the shoulder figures
                    // and the name plates do — one rule for "who has the floor",
                    // applied everywhere it shows.
                    boxShadow: live ? `0 0 12px ${who.hue}aa` : "none",
                    opacity: live ? 1 : 0.66,
                    transition: "opacity 0.3s ease, box-shadow 0.3s ease",
                  }}
                />
                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: "0.68rem",
                      fontWeight: 700,
                      letterSpacing: "0.16em",
                      textTransform: "uppercase",
                      color: who.hue,
                      textShadow: live ? `0 0 10px ${who.hue}88` : "none",
                      marginBottom: 3,
                    }}
                  >
                    {who.name}
                  </div>
                  <div
                    style={{
                      fontSize: "0.95rem",
                      lineHeight: 1.5,
                      color: live ? "#ffffff" : "rgba(255,255,255,0.74)",
                      transition: "color 0.3s ease",
                    }}
                  >
                    {shown(m, i)}
                  </div>
                </div>
              </div>
            );
          })
        )}
        {busy && (
          <div
            style={{
              fontSize: "0.78rem",
              letterSpacing: "0.08em",
              color: "rgba(255,255,255,0.4)",
            }}
          >
            processing…
          </div>
        )}
      </div>

      {/* ── Status line, and the way an answer leaves the building ── The share
          affordance lives HERE rather than on each of her lines in the log: the
          rail is a composed column and a control repeated down it reads as a
          toolbar. It also appears only once she has actually spoken (onShare is
          null until then), so the empty state stays a shrine and not a product. */}
      <div
        style={{
          padding: "10px 18px",
          borderTop: "1px solid rgba(0, 255, 255, 0.1)",
          fontSize: "0.5rem",
          letterSpacing: "0.15em",
          color: "rgba(0, 255, 255, 0.3)",
          textTransform: "uppercase",
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}
      >
        <span>sys.status // online</span>
        {onShare && (
          <button
            onClick={onShare}
            style={{
              marginLeft: "auto",
              background: "transparent",
              border: "1px solid rgba(244, 181, 63, 0.4)",
              borderRadius: 3,
              padding: "4px 9px",
              color: "rgba(244, 181, 63, 0.85)",
              fontFamily: "'Rajdhani', sans-serif",
              fontSize: "0.58rem",
              fontWeight: 600,
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              cursor: "pointer",
            }}
          >
            mark her words
          </button>
        )}
      </div>
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
  // Actual viewport dimensions, so the solo frame can size to fill rather than
  // sit at a fixed 250 in a sea of empty space on a taller phone.
  const [viewport, setViewport] = useState(() => ({
    w: typeof window !== "undefined" ? window.innerWidth : 1200,
    h: typeof window !== "undefined" ? window.innerHeight : 800,
  }));
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
      setViewport({ w: window.innerWidth, h: window.innerHeight });
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
      preloadImage("/shoulder_angel.webp"),
      preloadImage("/shoulder_demon.webp"),
      ...SHOULDER_LAYER_IMAGES.map((src) => preloadImage(src)),
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

  // ── Words arriving as they are SPOKEN ── The transcript used to drop each
  // line in whole the instant its voice took the floor, so a phone showed a
  // finished paragraph while the audio was still on its first clause — you read
  // the ending before you heard the middle. This reveals the line across the
  // length of the utterance instead, which is what makes the band feel like a
  // transcript of something happening rather than a log of something finished.
  //
  // Paced on an ESTIMATE (~62ms/char, the same rate speakInPortal's own watchdog
  // assumes), not on real audio position: SitePal exposes no playback clock, and
  // an estimate that self-corrects is better than plumbing a duration out of two
  // different speech paths. It always ends exactly right because finishReveal()
  // snaps to the full line the moment the speech promise resolves — so a slow
  // estimate can lag mid-line but can never truncate or outrun the voice.
  //
  // setInterval, NOT requestAnimationFrame: rAF does not fire in a backgrounded
  // tab (the same trap OracleCard's capture hit), which would freeze a line
  // half-revealed for as long as the seeker looked away.
  const [reveal, setReveal] = useState(null); // { i, chars } | null = show all
  const revealTimer = useRef(null);
  // Where the NEXT line will land in chatLog. Kept eagerly rather than read off
  // chatLog.length, because the setState updater hasn't run yet when the reveal
  // has to start — the two must agree or the wrong line animates.
  const chatLenRef = useRef(0);

  const startReveal = useCallback((i, text) => {
    clearInterval(revealTimer.current);
    const total = text.length;
    const dur = Math.max(1200, total * 62);
    const t0 = Date.now();
    setReveal({ i, chars: 0 });
    revealTimer.current = setInterval(() => {
      const p = Math.min(1, (Date.now() - t0) / dur);
      setReveal({ i, chars: Math.round(total * p) });
      if (p >= 1) clearInterval(revealTimer.current);
    }, 50);
  }, []);

  const finishReveal = useCallback(() => {
    clearInterval(revealTimer.current);
    setReveal(null);
  }, []);

  useEffect(() => () => clearInterval(revealTimer.current), []);

  // ── The share card ── HER most recent line, plus the question that drew it.
  // Only OL is offered: the advisers argue TO HER (see /api/counsel's staging),
  // so a Barron line on its own is half a scene and reads as the shrine
  // endorsing him. The question is carried along so the card CAN show it, but
  // OracleCard keeps it off by default — the confession belongs to the seeker.
  // ── The three petitions this visit gets ── Drawn AFTER mount, never during
  // render: Math.random() in a render body gives the server and the client
  // different answers and React tears the tree down over it. Drawn ONCE and
  // held, so they can't reshuffle under someone who is mid-read — the chips are
  // gated on sitePalReady anyway, so the empty first frame is never seen.
  const [starters, setStarters] = useState([]);
  useEffect(() => setStarters(drawStarters()), []);
  const coldOpenRef = useRef(null);
  useEffect(() => {
    coldOpenRef.current = pickColdOpen();
  }, []);

  const [cardOpen, setCardOpen] = useState(false);
  const lastOracle = useMemo(() => {
    for (let i = chatLog.length - 1; i >= 0; i--) {
      // Skip anything that isn't HER answering THEM: a server-patched fallback
      // (not her words at all) and the cold open (authored, and identical for
      // everyone — a card of it is a card of the welcome mat). Skipping rather
      // than stopping: the last REAL thing she said is still worth keeping.
      if (chatLog[i].who !== "OL" || chatLog[i].fellBack || chatLog[i].canned)
        continue;
      let question = "";
      for (let j = i - 1; j >= 0; j--) {
        if (chatLog[j].who === "you") {
          question = chatLog[j].text;
          break;
        }
      }
      return { line: chatLog[i].text, question };
    }
    return null;
  }, [chatLog]);

  // ── The card is only offered when THE ROOM IS QUIET ── The scene is a live,
  // speaking face; the card is a full-screen still. Opening one over the other
  // covers her mid-sentence with a photograph of herself while her voice keeps
  // going, which is the single worst thing this feature can do to the page.
  //
  // The gate is `speakingKey`, NOT `busy`: busy clears the moment the API
  // returns, which is BEFORE any of the three have said a word — it tracks the
  // fetch, not the argument. speakingKey is held for the whole deliberation
  // (JB → GR → OL) and cleared once at the end, so it is the only thing here
  // that actually means "someone has the floor". It also fixes the stale case:
  // on a second question the previous answer's button vanishes the instant the
  // new argument starts, instead of lingering over it.
  const canShare = Boolean(lastOracle) && !speakingKey && !busy;
  // Has a real question been asked? The cold open fills chatLog on its own, so
  // "the log is empty" no longer means "nothing has happened yet".
  const hasAsked = chatLog.some((m) => !m.canned);

  // And if a voice takes the floor while the card is open — a queued reply
  // landing, say — get out of the way rather than sitting on top of her.
  useEffect(() => {
    if (speakingKey) setCardOpen(false);
  }, [speakingKey]);
  // Keep the newest line in view as the argument unfolds, the way a group chat
  // follows itself. Scrolls the BOX's own scrollTop rather than calling
  // scrollIntoView on the line: scrollIntoView walks up and moves every
  // scrollable ancestor, which drags the page (and the faces) around too.
  const chatBoxRef = useRef(null);
  useEffect(() => {
    const box = chatBoxRef.current;
    if (!box || !chatLog.length) return;
    // ── Follow the SPEAKER, not the bottom ── Each line lands as its voice
    // takes the floor, so this fires once per turn and is the only thing
    // syncing the words to the audio. Scrolling to scrollHeight put the newest
    // line's END at the foot of the box, which on a phone (the band holds ~6
    // lines of a much longer argument) meant a long reply was already scrolled
    // past its own opening the moment it arrived — you heard the first sentence
    // while looking at the last. Aligning the newest line's TOP instead starts
    // it at its first word and lets it read down as it is spoken. The browser
    // clamps this to max scroll, so a short line still just sits at the bottom.
    const newest = box.lastElementChild;
    box.scrollTo({
      top: newest ? newest.offsetTop - box.offsetTop : box.scrollHeight,
      behavior: "smooth",
    });
  }, [chatLog]);

  // ── Then FOLLOW it as it writes ── The jump above puts the new line's first
  // word at the top; this keeps its growing tail in view once the line gets
  // longer than the band (~6 lines on a phone, and her answers run past that).
  // Only ever nudges DOWNWARD by the exact overflow, so it can't fight the
  // reader: scroll up to re-read an earlier line and it stays put until what is
  // being spoken actually falls off the bottom. Instant, not smooth — a 0.3s
  // smooth scroll re-triggered every 50ms never arrives anywhere.
  useEffect(() => {
    if (!reveal) return;
    const box = chatBoxRef.current;
    const newest = box?.lastElementChild;
    if (!newest) return;
    const bottom = newest.offsetTop - box.offsetTop + newest.offsetHeight;
    const overflow = bottom - (box.scrollTop + box.clientHeight);
    if (overflow > 0) box.scrollTop += overflow;
  }, [reveal]);
  // Prior turns, fed back so a follow-up knows what was already argued. A ref,
  // not state — nothing renders it, and it must never re-trigger the flow.
  const historyRef = useRef([]);

  // A seat is "lit" (full colour, live) while its voice holds the floor. At rest
  // NOBODY holds it — the halftone rule in renderSeat greys the other seats only
  // once an argument is actually running, so an idle triptych has no lit/unlit
  // distinction to draw.
  const isLit = useCallback((seat) => speakingKey === SEAT_VOICE[seat], [speakingKey]);

  // One seat, rendered. Desktop lays three of these across; phones stack Our
  // Lady above a paired row of half-size advisers (compact).
  const renderSeat = (s, { compact = false, figures = false } = {}) =>
    !s ? null : (
      <PortraitPanel
        key={s.key}
        isMobile={isMobile}
        isSolo={isSolo}
        wide={isWideSolo}
        soloSize={soloFrameSize}
        /* She presides, so her frame runs larger than the wings'. The scale is
           applied HERE rather than inside the panel so the panel never has to
           know which seat it is. */
        triptychSize={
          s.seat === "center"
            ? Math.round(triptychFrameSize * LADY_FRAME_SCALE)
            : triptychFrameSize
        }
        compact={compact}
        /* The shoulder figures hover at HER frame only, and need the global
           speaker so each knows when it's the one arguing. */
        figures={figures}
        speakingKey={speakingKey}
        figuresIn={figuresIn}
        mouthDebug={mouthDebug}
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
        /* The ADVISERS are plated; she is not, on either layout. The RL80 mark
           sits directly above her head and already says whose shrine this is, so
           a plate under her frame is the same answer twice — and naming the wings
           while she goes unnamed is itself the hierarchy, not a dropped label.
           Her larger frame (LADY_FRAME_SCALE) carries what the plate would have.
           Solo has no plates at all: the shoulder figures aren't panels. */
        title={isSolo || s.seat === "center" ? null : s.name}
        /* Hers alone stamps the corner mark, on every layout. */
        showMark={s.seat === "center"}
        /* Desktop reads the argument under the face making it. Phones read it
           as the group text below, so per-panel captions would just print every
           line twice. */
        caption={isSolo ? "" : captions[SEAT_VOICE[s.seat]] || ""}
        speaking={speakingKey === SEAT_VOICE[s.seat]}
        hue={s.frameHue}
        /* PHONE: she never greys — she presides throughout, and the shoulder
           figures' glow alone marks whose turn it is. Dimming her (portrait AND
           gold frame) for the ~10s the advisers argue read as a glitch on the
           one live avatar, and made no sense once the figures stopped greying.
           DESKTOP: the advisers are full panels, so following the speaker across
           the row still earns its keep — but only WHILE SOMEONE IS SPEAKING.
           Keying this to isLit alone greyed both wings at rest, which is the
           state every first-time visitor lands in: two dithered faces over an
           empty caption band read as "failed to load", not as "waiting their
           turn" (the same glitch the phone rule above was written to avoid, one
           seat over). At rest all three sit full-colour and dormant; the moment
           a voice takes the floor, the other two drop back. */
        halftone={!isSolo && speakingKey !== null && !isLit(s.seat)}
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

  /* ── The roster, hoisted into a corner gear (phones) ──
     The medallion row under her frame cost ~46px of a column that had none to
     spare, and the faces are switched rarely. It does NOT reuse the pickerOpen
     ApparitionTriptych: the portals are gated on !pickerOpen, so opening that
     would tear down her live player and re-summon her on dismiss, and it offers
     no cancel — fine for a first-visit choice, wrong for a settings affordance.
     Choosing routes through handleCharacterSelect, so a swap still reloads with
     ?char= and her scene embeds fresh. */
  const [rosterOpen, setRosterOpen] = useState(false);

  // NOTE: this block sits ABOVE handleAsk deliberately. handleAsk lists isSolo
  // in its dependency array, and a dep array is evaluated during render — so a
  // `const isSolo` declared further down threw "Cannot access 'isSolo' before
  // initialization" on every mount. Layout mode must be resolved before the
  // first thing that depends on it.
  // ── The triptych is now OPT-IN ── `?triptych=1` on a wide window brings back
  // the three-panel row. It is NOT the default at any width any more: the solo
  // composition — Our Lady framed, the saint and the devil's advocate hovering
  // at her shoulders — IS the trope drawn literally, where three equal frames
  // read as a panel discussion. Desktop gets that same composition on a stage,
  // and spends its extra width on the transcript rail instead of on two more
  // frames. Kept rather than deleted so the two can still be compared directly;
  // everything it needs (panel chrome, captions, name plates) is still here.
  const [forceTriptych, setForceTriptych] = useState(false);
  // ?mouthdebug=1 — preview the adviser mouth pipeline with a plain rect before
  // the sprite art exists. Remove once the PNGs are in and tuned.
  const [mouthDebug, setMouthDebug] = useState(false);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setForceTriptych(params.get("triptych") === "1");
    setMouthDebug(params.get("mouthdebug") === "1");
  }, []);
  const panelCount = forceTriptych && isWide && !isMobile ? PANEL_COUNT : 1;
  // ── SOLO vs TRIPTYCH ── The composition question is "how many panels fit?",
  // NOT "is this a phone". Keying the advisers' representation to isMobile left
  // 768–1199 with no advisers AT ALL: too narrow for three panels, but the
  // shoulder figures, the transcript and the chips were all phone-only, so they
  // argued at you from off-screen with nothing to look at and no scrollback.
  //
  // Solo = one panel, so the advisers are the shoulder figures and the argument
  // is the transcript. Triptych = three panels, so they are their own faces and
  // the argument is captioned under each. Device still decides how many PLAYERS
  // to mount (three OOM-crash iOS — see SitePalPortals); that stays on isMobile
  // and must not be folded into this.
  const isSolo = panelCount === 1;

  // ── SOLO, WIDE ── The same composition with room around it. A window this
  // wide can't spend the extra width on the scene (the scene is a centred
  // portrait — growing it past ~520 just makes a big portrait), so it spends it
  // on the argument: the stage keeps the middle, and the transcript moves out of
  // its cramped band under her frame into a full-height rail down the side.
  //
  // This is the ONLY thing that splits the layout now. Everything else — the
  // frame, the figures, the chips, the ask bar — is the phone's composition,
  // measured against the STAGE instead of against the window.
  const isWideSolo = isSolo && isWide && !isMobile;

  // ── The inner struggle ── The seeker asks; Barron argues for the appetite,
  // GR80 answers from duty, Our Lady weighs in last and lightest. Each line is
  // spoken by its OWN character's portal, awaited in turn, so the argument
  // plays across the triptych as a conversation instead of three portraits
  // talking over each other. Every line lands as a caption under the face
  // making it — the triptych IS the transcript, so there's no drawer.
  //
  // The page owns the history (the input bar drives this directly). Prior turns
  // are fed back so a follow-up question knows what was already argued.
  // Which voice each character speaks with. Not derived from the reply, so both
  // the consultation and the overture read the same map.
  const voiceFor = useMemo(
    () => ({
      JB: COUNSEL_VOICES.JB,
      GR: COUNSEL_VOICES.GR,
      OL: CHARACTERS[activeCharIndex]?.voice || ORACLE_VOICE,
    }),
    [activeCharIndex],
  );

  /* ── Say ONE line as ONE character ── Extracted from handleAsk's loop so the
        overture below shares it. It was inline, and duplicating it for the
        greeting would have meant two copies of the portal-wait and the
        ElevenLabs fallback — exactly the pair that has already broken twice.
     Who speaks how, by WHOSE FACE IS ON SCREEN:
       • Our Lady, always — her own player, never scene-swapped. (Swapping was
         tried 2026-07-15: loadSceneByID nulls the player's audio, so NOBODY
         spoke, her included, and every turn paid a scene load.)
       • Advisers, TRIPTYCH — their SitePal faces are visible there, so they
         speak through their own players and SitePal lip-syncs them.
       • Advisers, SOLO — no face on screen, only the shoulder figures, so they
         speak from ElevenLabs through a Web Audio graph we own. That is what
         makes their 2D mouths possible: an AnalyserNode on our own graph yields
         the per-frame amplitude (see adviserMouth), where audio inside a SitePal
         iframe is unreachable from here.
     Returns false when nothing was spoken, and the caller holds a reading beat.
     Side effect worth knowing: this also settles the split noted in
     /api/counsel-voice — the advisers used to sound like SitePal "Gilbert" on
     desktop and like their ElevenLabs voices on a phone. Solo is now ElevenLabs
     at every width, so a character sounds like himself. */
  const speakOne = useCallback(
    async (s, t) => {
      const seatFor = { JB: "john", GR: "gr80", OL: "lady" };
      if (s !== "OL") {
        return isSolo
          ? speakAdviserLine(s, t)
          : speakInPortal(portalContainerId(seatFor[s]), t, voiceFor[s]);
      }
      // ── Wait for her frame before handing her the line ──
      // SHE is the only voice that needs a SitePal player; the advisers go
      // straight to ElevenLabs. So when the portals are down she is the ONLY one
      // who goes quiet while the page still looks busy — two voices argue and
      // her reply lands as text with no sound. Reported from a phone.
      // The portals unmount whenever the apparition picker opens (see the
      // `!pickerOpen` gate on <SitePalPortals>) and the replacements take seconds
      // to register sayText, so a question asked around then lands in the hole.
      // 3s, not 8: long enough for a portal that is merely remounting, short
      // enough that a portal which is never coming back doesn't buy silence
      // before the fallback.
      await waitForPortal(portalContainerId(SPOTLIGHT_KEY), 3000);
      const viaPortal = await speakInPortal(
        portalContainerId(SPOTLIGHT_KEY),
        t,
        voiceFor.OL,
      );
      if (viaPortal) return true;
      // ── HER VOICE MUST NOT DEPEND ON HER PLAYER ──
      // Measured on a phone where the portal never came up at all: her frame
      // fell back to the still cameo and she answered in silence while both
      // advisers spoke. She presides — a mute presiding face with two audible
      // advisers is worse than no advisers at all. Cost of the fallback: no
      // lip-sync that turn. Silence reads as broken; a still face over a real
      // voice reads as a portrait.
      return speakAdviserLine("OL", t, {
        apparition: CHARACTERS[activeCharIndex]?.key,
      });
    },
    [isSolo, voiceFor, activeCharIndex],
  );

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
    // The seeker's own line appears WHOLE — they wrote it, so revealing it back
    // to them a character at a time would be theatre at their expense.
    chatLenRef.current += 1;
    finishReveal();
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
    // seatFor / voiceFor now live with speakOne above — one copy, so a greeting
    // and an answer can't end up using different voices for the same character.

    // Speak in the trope's order — temptation, duty, then grace.
    (async () => {
      for (const s of ["JB", "GR", "OL"]) {
        if (run !== counselRunRef.current) return;
        const t = lineOf(s);
        if (!t) continue;
        setCaptions((c) => ({ ...c, [s]: t }));
        // Lands in the transcript as this voice takes the floor — not all three
        // at once, so the group text unfolds at the pace of the argument.
        // `fellBack` marks a line the SERVER patched in because the model's
        // reply didn't parse (see /api/counsel). It still speaks and still shows
        // — but it is not hers, so it must never reach the share card.
        const lineIndex = chatLenRef.current;
        chatLenRef.current = lineIndex + 1;
        setChatLog((l) => [
          ...l,
          { who: s, text: t, fellBack: data.fellBack?.includes(s) || false },
        ]);
        // Start writing it out as the voice starts saying it.
        startReveal(lineIndex, t);

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

        // Who says this out loud, and how, lives in speakOne — shared with the
        // overture so a greeting and an answer can never drift into using
        // different voices or different fallbacks for the same character.
        const spoke = await speakOne(s, t);
        if (run !== counselRunRef.current) return;

        // The voice has stopped, so the words stop being a guess: show the whole
        // line. This is what keeps the estimated pace honest — it may lag behind
        // a fast delivery mid-line, but it can never end early or leave a line
        // unfinished, because the truth arrives here.
        finishReveal();

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
  }, [activeCharIndex, isMobile, isSolo, busy]);



  // ── The rail's width, and what's left for the stage ── Every fixed thing that
  // must stay centred UNDER HER (the ask bar, the chips, the gear in her corner)
  // is centred on the window by default, so each one has to be pulled back by
  // the rail. They all measure from these two numbers rather than each carrying
  // its own copy of the arithmetic — a rail width that only three of the four
  // knew about is exactly how the ask bar ends up a few pixels off her axis.
  // Bounded both ways: under ~330 the argument sets too narrow to read as
  // paragraphs, over ~440 the rail starts out-weighing the stage it's beside.
  const railWidth = isWideSolo
    ? Math.round(Math.min(440, Math.max(330, viewport.w * 0.28)))
    : 0;
  const stageWidth = viewport.w - railWidth;

  // ── Solo frame size ── Fill the column, keep a band for the transcript.
  // A fixed 250 floated in a void on a tall phone; this grows the scene to the
  // SMALLER of two ceilings, so it fills whichever axis is tighter:
  //   • WIDTH — the frame plus its shoulder figures (which hang off each side in
  //     PROPORTION to the frame, see PortraitPanel's figureOverhang) must fit
  //     inside the STAGE, which is the window minus the rail.
  //   • HEIGHT — the solo column runs top:0 → the ask bar (~160 up), and on a
  //     phone the transcript claims a band at the bottom of it (~135), leaving
  //     the rest for the frame; the frame renders at size × 1.3 tall
  //     (CharacterSelect), minus ~44 of panel padding.
  // Floored at 250 so small phones never shrink below the size they were tuned
  // at (the height ceiling binds there and would otherwise pull it down). The
  // triptych has its own ceiling — see triptychFrameSize.
  const soloFrameSize = useMemo(() => {
    // The frame is CENTRED and a figure hangs frameSize × 0.112 off each side,
    // so the composition's half-width is frameSize × 0.612. Keeping 8px of
    // margin: frameSize × 1.224 + 16 ≤ stageWidth.
    const widthCap = (stageWidth - 16) / 1.224;
    // WIDE: the transcript is BESIDE her, not under her, so the 135px band a
    // phone has to reserve for it is not spent here — that reserve is the whole
    // reason the phone frame stops where it does, and charging a desktop for it
    // would leave her small in the middle of an empty stage for no one.
    // It still owes the STARTER CHIPS their row (~48). They're fixed on top of
    // the ask bar and the frame is sized to end exactly at that band, so without
    // this the two land on the same 40px on a short laptop window — measured at
    // 685px tall, the chips crossing the foot of her frame. Phones never showed
    // it because their 135 reserve covers the chips incidentally. Only short
    // windows pay: anything tall enough is bound by the 520 cap below instead.
    // ── The phone reserve is DERIVED, not a guess ── It was a flat 135 while
    // the band it reserves for is capped at TRANSCRIPT_DVH of the viewport
    // (~197px on an 820px phone) plus its 14px margin — so the column always
    // asked for ~75px more than it had, and the foot of the transcript sat under
    // the ask bar. Adding the share button below it pushed that button clean out
    // of the column and behind the dock: measured at 430×820, the band ran to
    // y=700 and the button to y=743 in a column that ends at ~666.
    // Anything added to the bottom of the narrow column from here on MUST be
    // added to this number too, or it lands underneath the fixed furniture and
    // is invisible without scrolling to a place the user has no reason to look.
    const narrowReserve =
      Math.round(viewport.h * TRANSCRIPT_DVH) + 14 + SHARE_BUTTON_H;
    const heightCap =
      (viewport.h - 160 - (isWideSolo ? 48 : narrowReserve) - 44) / 1.3;
    // 440 was the ceiling when the frame shared a phone column with the
    // transcript. On a stage of its own she can carry more, but not unbounded:
    // past ~520 the neon filigree outgrows the shoulder figures attending it and
    // the composition stops reading as a shrine and starts reading as a poster.
    const cap = isWideSolo ? 520 : 440;
    return Math.round(Math.max(250, Math.min(widthCap, heightCap, cap)));
  }, [viewport, stageWidth, isWideSolo]);

  // ── Triptych frame size ── The ADVISERS' frame: 340 wherever 340 fits, which
  // is the case on the big monitors this layout is really for. The flat constant
  // it replaces was right about the common case and simply had no answer for a
  // SHORT one, where 340 (rendered at size × 1.3, see CharacterSelect) leaves the
  // panel's content taller than the panel. That overflow is not cosmetic: a
  // scroll container clips at its PADDING edge, so an overflowing panel renders
  // its caption straight through the paddingBottom that was supposed to reserve
  // the ask bar's band — the argument comes out from under the input. (The solo
  // layout learned the same lesson: padding cannot hold a gap above a fixed
  // element.) Sizing the frame to the room keeps the content inside the box, so
  // the reserve holds and nothing has to be clipped or scrolled.
  //
  // Floored at 200 so a very short window shrinks the filigree rather than
  // colliding. The frame's WIDTH never binds (three 340s need ~1100 and the
  // triptych only exists past 1200), so unlike soloFrameSize there's no width cap.
  const triptychFrameSize = useMemo(() => {
    // Everything the frame shares its column with: the bottom furniture the panel
    // pads for (160), the status line (~30), a name plate (~24), panel padding
    // (~44), and the band under the plate (~110). That band is sized for the
    // WORST of its two occupants rather than their sum — the starter chips and a
    // caption are mutually exclusive (chips show only while chatLog is empty), so
    // reserving for both would shrink the frame for a state that never happens.
    // 110 is ~4 lines, not the longest argument seen (~150): the band is `1 0
    // auto` and takes the panel's leftover slack FIRST, so this only has to cover
    // what slack doesn't. Reserving the true maximum measurably shrank the wings
    // at ordinary laptop heights to buy nothing — verified at 689px and 860px
    // that a 5-line argument still clears the ask bar at 110.
    const room = viewport.h - 160 - 30 - 24 - 44 - 110;
    // Cap on an ADVISER's frame, NOT on hers — even though hers is the biggest.
    // Her frame is ~1.18× taller, but her panel is the one with SLACK: she has no
    // name plate, and her brief is one short line where the advisers argue for
    // four or five (see COUNCIL — "never a verdict, never a summary"). Measured,
    // her column comes out SHORTER than theirs despite the larger frame, so
    // sizing the row to her made both wings pay for room she wasn't using.
    // The wings bind; she is derived. This is also why her bigger frame is safe
    // against the ask bar: the bar sits in HER column alone (see its width), and
    // hers is the column with height to spare.
    const heightCap = room / 1.3;
    return Math.round(Math.max(200, Math.min(340, heightCap)));
  }, [viewport]);

  // ── Her panel's width ── The three panels are `flex: 1 1 0` under a 440 cap
  // with 16px gaps, and the row is centred, so the CENTRE panel is centred on the
  // viewport: its edges are 50% ± half this. Two fixed things need that number —
  // the gear that belongs in her corner, and the ask bar, which must not grow
  // wider than her column and reach into the advisers' captions.
  const ladyPanelWidth = useMemo(() => {
    const rowW = Math.min(viewport.w, 3 * PANEL_MAX_W + 2 * PANEL_GAP);
    return Math.min(PANEL_MAX_W, (rowW - 2 * PANEL_GAP) / 3);
  }, [viewport]);

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

  /* ── The overture ── The cold open, played once, on the first real gesture.
     NOT ON LOAD, and that is a platform rule rather than a choice: browsers only
     start audio inside a user gesture, so anything that speaks itself on arrival
     is silently swallowed — on iOS especially. The first touch is as close to
     "on load" as this can get.
     It replaces a greeting that was HER ALONE and wired to the input gaining
     FOCUS — which is a reasonable first gesture on a desktop and close to
     unreachable on a phone, where nobody focuses a text field before looking
     around and doing so throws the keyboard over the whole composition. So in
     practice the shrine has been introducing itself to almost nobody.
     Lines go into chatLog like any others, so the caption, the reveal, the rail
     and the scroll-following all work unchanged — but marked `canned`, because
     they are not an answer to anything: the share card must not offer them (see
     lastOracle) and the starter chips must not treat them as a real exchange. */
  const overtureRef = useRef(false);
  const runOverture = useCallback(async () => {
    const set = coldOpenRef.current;
    if (!set) return;
    // Belongs to the current run, so a question asked mid-overture kills it at
    // the next line boundary — handleAsk increments this and also stops every
    // player outright, which cuts the audio already in flight.
    const run = counselRunRef.current;
    for (const { s, t } of set) {
      if (run !== counselRunRef.current) return;
      const i = chatLenRef.current;
      chatLenRef.current = i + 1;
      setChatLog((l) => [...l, { who: s, text: t, canned: true }]);
      startReveal(i, t);
      setSpeakingKey(s);
      const spoke = await speakOne(s, t);
      if (run !== counselRunRef.current) return;
      finishReveal();
      if (!spoke) {
        await new Promise((r) => setTimeout(r, Math.min(4600, Math.max(1800, t.length * 28))));
        if (run !== counselRunRef.current) return;
      }
      await new Promise((r) => setTimeout(r, 260));
    }
    if (run === counselRunRef.current) setSpeakingKey(null);
  }, [speakOne, startReveal, finishReveal]);

  // First touch anywhere wakes the room. Capture phase so it still fires for a
  // tap that lands on a control, and `once` so it can never run twice.
  useEffect(() => {
    if (!sitePalReady) return;
    const onFirstGesture = () => {
      if (overtureRef.current) return;
      overtureRef.current = true;
      // Inside the gesture, or iOS will not grant playback later.
      unlockAdviserAudio();
      hasGreetedRef.current = true; // the overture IS the greeting now
      // A GRACE BEAT, because this same tap may have been a starter chip or the
      // send button: pointerdown fires before click, so without this the overture
      // and the answer to the question just asked would start together. If a
      // consultation began in that window, handleAsk has bumped counselRunRef
      // and the overture stands down.
      const before = counselRunRef.current;
      setTimeout(() => {
        if (counselRunRef.current !== before) return;
        runOverture();
      }, 420);
    };
    window.addEventListener("pointerdown", onFirstGesture, { capture: true, once: true });
    return () =>
      window.removeEventListener("pointerdown", onFirstGesture, { capture: true });
  }, [sitePalReady, runOverture]);

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
        //
        // The bloom is amethyst — the root page's magenta rotated blue-ward. The
        // root never paints its crimson at all: that scene's background is flat
        // #000 and the colour is an illusion thrown by the holographic statue's
        // chromatic ghosting. /main has no hologram, so this glow is painted by
        // hand and is free to pick its own hue.
        //
        // It must stay a VIOLET or a MAGENTA. Cyan was tried and reverted: cyan
        // spreads its luminance across green and blue, so at the low alphas this
        // field runs it desaturates to slate-grey over near-black and stops
        // reading as light — where magenta carries on the red channel alone and
        // stays saturated all the way down. Worse, the gold below is a near
        // complement of cyan and the two averaged to olive around her frame.
        // Layers are listed TOP-first: gold sits ON the bloom, which is why the
        // aureole is tight — spread wide it averages with the field into mud.
        backgroundColor: "#0a0a0f",
        backgroundImage: [
          // (Structure lives in the perspective floor below — a flat lattice
          // here fought it wherever the two met.)
          // ── Vignette ── Corners driven back to black. The bloom below needs
          // somewhere to FALL OFF to: spread evenly with no dark left, magenta
          // stops reading as light and starts reading as a flat mauve field.
          // This is what makes it a glow instead of a wash.
          "radial-gradient(125% 82% at 50% 40%, rgba(0,0,0,0) 38%, rgba(0,0,0,0.62) 100%)",
          // Her aureole — warm, centred on the portrait, not the viewport.
          "radial-gradient(70% 46% at 50% 24%, rgba(244, 181, 63, 0.16) 0%, rgba(244, 181, 63, 0.04) 40%, rgba(0,0,0,0) 68%)",
          // The holographic bloom — tight and hot, so it burns behind her frame
          // and is gone by the edges. Violet is far enough off gold's complement
          // that her neon frame reads as its own light against it rather than
          // averaging into the field; that separation is the whole job here.
          "radial-gradient(76% 46% at 50% 40%, rgba(150, 72, 255, 0.30) 0%, rgba(58, 20, 122, 0.12) 50%, rgba(0,0,0,0) 78%)",
          // Cool counter-light at her feet so the violet doesn't go uniformly
          // hot, and the cyan chrome down there has something to sit against.
          "radial-gradient(90% 60% at 50% 97%, rgba(42, 214, 238, 0.07) 0%, rgba(0,0,0,0) 70%)",
          // The apse itself: violet shoulders down to near-black. The darkness
          // ramp is what gives the field depth — brightening it so the hue
          // "reads" more would leave the vignette nothing to drive back to.
          "linear-gradient(180deg, #160a26 0%, #0c0716 45%, #05060a 100%)",
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
        .hm2-wing {
          position: absolute;
          inset: 0;
          z-index: 1;
          width: 100%;
          height: auto;
          display: block;
          will-change: transform;
          pointer-events: none;
          user-select: none;
          -webkit-user-drag: none;
        }
        .hm2-wing--angel.hm2-wing--left {
          transform-origin: 40% 38%;
          animation: hm2-angel-left-flap 1.55s ease-in-out infinite;
        }
        .hm2-wing--angel.hm2-wing--right {
          transform-origin: 60% 38%;
          animation: hm2-angel-right-flap 1.55s ease-in-out infinite;
        }
        .hm2-wing--demon.hm2-wing--left {
          transform-origin: 39% 37%;
          animation: hm2-demon-left-flap 0.86s ease-in-out infinite;
        }
        .hm2-wing--demon.hm2-wing--right {
          transform-origin: 62% 37%;
          animation: hm2-demon-right-flap 0.86s ease-in-out infinite;
        }
        @keyframes hm2-angel-left-flap {
          0%, 100% { transform: rotate(-5deg) scaleX(1) translateY(0); }
          50%      { transform: rotate(9deg) scaleX(0.9) translateY(2%); }
        }
        @keyframes hm2-angel-right-flap {
          0%, 100% { transform: rotate(5deg) scaleX(1) translateY(0); }
          50%      { transform: rotate(-9deg) scaleX(0.9) translateY(2%); }
        }
        @keyframes hm2-demon-left-flap {
          0%, 100% { transform: rotate(-7deg) skewY(0deg) scaleX(1); }
          50%      { transform: rotate(14deg) skewY(-3deg) scaleX(0.84); }
        }
        @keyframes hm2-demon-right-flap {
          0%, 100% { transform: rotate(7deg) skewY(0deg) scaleX(1); }
          50%      { transform: rotate(-14deg) skewY(3deg) scaleX(0.84); }
        }
        /* The waiting caption in the ask bar's slot — breathes rather than
           spins, so it reads as the shrine waking up and not as a progress bar. */
        @keyframes hm2-summon-pulse {
          0%, 100% { opacity: 0.55; }
          50%      { opacity: 1; }
        }

        @media (prefers-reduced-motion: reduce) {
          .hm2-figure--left,
          .hm2-figure--right,
          .hm2-wing {
            animation: none;
          }
        }

        /* ── RL80 corner mark ── Ported from the root's .rl80-ticker-title
           rather than reused: those rules are scoped under .shrine-page.neon,
           and adopting that class here would drag in the rest of that sheet —
           including its \`> *:not(...)\` child rules — to borrow a font and a
           skew. Copied deliberately; they are free to drift. */
        .hm2-rl80 {
          position: relative;
          font-size: 3.4rem;
          line-height: 0.9;
          color: #ffffff;
          letter-spacing: 0.02em;
          white-space: nowrap;
          transform: rotate(-6deg) skew(-12deg);
          transform-origin: left center;
        }
        .hm2-rl80-ray {
          position: absolute;
          top: 0;
          left: 0;
          z-index: -1;
          pointer-events: none;
          filter: blur(0.1rem);
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
      {/* SOLO MOUNTS ONE PLAYER — hers — AT EVERY WIDTH. The advisers' players
          existed to lip-sync faces the solo layout doesn't show; now that they
          speak from ElevenLabs through our own graph (see handleAsk), keeping
          their portals mounted bought two hidden iframes, two more live SitePal
          players and two more 600×800 near-transparent layers (the seam in
          SitePalPortals' note) for nothing. Only the triptych, where their faces
          are actually on screen, still mounts all three. */}
      {USE_SITEPAL && sceneReady && !pickerOpen && (
        <SitePalPortals
          portals={isSolo ? seats.filter((s) => s.seat === "center") : seats}
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

      {/* ── Her answer, as an image ── Portals to document.body from inside
          OracleCard, so it is never trapped by this page's stacking or by a
          panel's chrome (the scar the shared candle picker left). Mounted only
          while open: its captured node holds a full-size portrait, and there is
          no reason for that to sit in the tree behind a live WebGL scene. */}
      {cardOpen && lastOracle && (
        <OracleCard
          open
          onClose={() => setCardOpen(false)}
          line={lastOracle.line}
          question={lastOracle.question}
          face={CHARACTERS[activeCharIndex]?.image}
          apparitionName={CHARACTERS[activeCharIndex]?.name}
        />
      )}

      {/* ── The scene ── One composition at every width: Our Lady framed, the
          saint and the devil's advocate at her shoulders. Wide windows set it on
          a stage with the transcript rail beside it; phones get the same thing
          with the transcript in a band underneath. `?triptych=1` restores the
          old three-panel row. */}
      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          // SOLO: end the scroll box ABOVE the ask bar, don't just pad it. The
          // ask bar is position:fixed and out of flow, so paddingBottom only
          // buys room at the very bottom of the SCROLL range — it can't hold a
          // gap above the bar when content is short and pinned flex-start, so
          // the transcript's last line rolled under the input (same failure the
          // chips had). Ending the box here makes overflow clip exactly at the
          // bar's top edge: nothing in the column can render beneath it, at any
          // frame height or scroll position. TRIPTYCH keeps bottom:0 — its
          // panels carry their own clearance and the ask bar floats over dead
          // space between them.
          // WIDE SOLO stops at the DOCK, not at the ask bar: the bar is centred
          // on the stage and never crosses the rail, so ending the whole box
          // above it would strand ~64px of dead space down the side of the
          // transcript. The stage column pads for the bar itself instead.
          bottom: isWideSolo
            ? `calc(${DOCK_H}px + ${SAFE_B})`
            : isSolo
            ? BOTTOM_CLEARANCE
            : 0,
          zIndex: 100,
          display: "flex",
          flexDirection: "row",
          justifyContent: "center",
          alignItems: "stretch",
          gap: panelCount > 1 ? PANEL_GAP : 0,
          // SOLO: the STAGE inside is the scroller (and the rail scrolls itself),
          // so this box never scrolls. Two independently-growing columns cannot
          // share one scroll position — the argument filling the rail would drag
          // her frame off the top of the window.
          overflowY: isSolo ? "hidden" : "visible",
          // The solo column IS a scroller, so it must accept touch —
          // pointerEvents:"none" here silently made the page unscrollable (panels
          // 2 and 3 rendered but were unreachable). Triptych keeps none so the
          // gaps between panels stay click-through.
          pointerEvents: isSolo ? "auto" : "none",
          WebkitOverflowScrolling: "touch",
          overscrollBehavior: "contain",
          // Solo already reserves this space via `bottom` above, so no padding
          // there (it would double the gap). Triptych keeps none.
          paddingBottom: 0,
        }}
      >
        {isSolo ? (
          <>
            {/* ── The stage ── ONE composition at every width: Our Lady live and
                framed, with the saint and the devil's advocate hovering at her
                shoulders. This is the trope drawn literally, and it replaces the
                adviser panels — three ornate frames read as a panel discussion,
                and on a phone they were never legible anyway.

                THE STAGE WRAPPER IS UNCONDITIONAL, and that is load-bearing. It
                began as the wide layout's own branch, with narrow rendering the
                panel straight into the row — so crossing 1200px changed the
                panel's PARENT, React unmounted it, and her frame came back a
                black rectangle: a remounted R3F canvas loses its WebGL context,
                and this page has no spare ones (three SitePal players plus the
                frame). Keeping one wrapper at both widths reconciles the panel in
                place, so a resize restyles the stage instead of rebuilding her.
                The conditional siblings around it are `{cond && …}`, which render
                as holes rather than collapsing — the panel keeps its child index
                either way. Do not "simplify" this back into two branches. */}
            <div
              style={{
                flex: 1,
                minWidth: 0,
                height: "100%",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "flex-start",
                overflowY: "auto",
                overscrollBehavior: "contain",
                WebkitOverflowScrolling: "touch",
                touchAction: "pan-y",
                // WIDE: the ask bar and the chips float over the foot of THIS
                // column (both are measured to the stage, not the window), so the
                // stage owes them clearance — the outer box stops at the dock so
                // the rail can run past them. NARROW: the outer box already ends
                // above the bar, and padding here would double the gap.
                paddingBottom: isWideSolo ? ASK_BAR_H + ASK_BAR_GAP : 0,
              }}
            >
              {/* ── Matting ── The same 0.6 : 1 split the triptych panels use, and
                  for the same reason: the stage owns the window's full height but
                  its content is one frame, so pinned to flex-start she sits in the
                  top half with a growing void under her — worse the taller the
                  monitor, since the frame stops growing at its ceiling. Splitting
                  the slack unevenly lands her a little ABOVE centre, which is how
                  a portrait is matted; dead-centre reads as bottom-heavy.
                  `0.6 1 0` / `1 1 0`, not `0.6` / `1`: these must SHRINK to
                  nothing when the frame is taller than the stage (a short laptop
                  window), or they'd hold their share and push her under the ask
                  bar instead of letting the column scroll.
                  NARROW has no slack to split — the frame is sized to fill the
                  column and the transcript takes the rest — so it stays pinned. */}
              {isWideSolo && <div style={{ flex: "0.6 1 0" }} />}
              {renderSeat(seats.find((s) => s.seat === "center"), { figures: true })}
              {isWideSolo && <div style={{ flex: "1 1 0" }} />}

            {/* ── The transcript, narrow ── The deliberation as a group text:
                name, colon, message, in each voice's own colour. This is what the
                advisers have INSTEAD of a voice on phones, and it doubles as the
                scrollback — every question and every reply, in order. Wide gets
                the same log as a standing rail beside her (below); a phone has
                only one column, so it gets a band of it under her instead. */}
            {!isWideSolo && chatLog.length > 0 && (
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
                  // NEVER let the column squeeze this. The parent is a flex
                  // column and PortraitPanel is flex:"0 0 auto", so this was the
                  // only item that would yield: when her frame grew, flexbox
                  // took the whole difference out of the transcript and crushed
                  // it to a clipped single line with a scroller ~40px tall.
                  // It owns its own height, capped below; the column scrolls.
                  flexShrink: 0,
                  // CONTAINED, and it scrolls itself. Left unbounded the
                  // transcript grows with every exchange and shoves the whole
                  // composition off the top of the screen — the faces are the
                  // page, so the chat gets a window, not the run of it.
                  // dvh, NOT vh: iOS Safari resolves vh against the
                  // TOOLBAR-HIDDEN viewport, so 32vh measured ~260px against a
                  // ~617px visible area — 42% of the screen, not the 32% it
                  // asks for. Chrome's emulator computes it against the visible
                  // height and looks right, so this only ever bites on a phone.
                  maxHeight: `${TRANSCRIPT_DVH * 100}dvh`,
                  overflowY: "auto",
                  overscrollBehavior: "contain",
                  WebkitOverflowScrolling: "touch",
                  borderTop: "1px solid rgba(0, 255, 255, 0.12)",
                  borderBottom: "1px solid rgba(0, 255, 255, 0.12)",
                  background: "rgba(0, 0, 0, 0.35)",
                  fontFamily: "'Rajdhani', sans-serif",
                }}
              >
                {/* ── ONE LINE AT A TIME ── A caption, not a scrollback. The
                    phone used to render the whole log here, which is what made
                    this box fight her frame for height: a transcript wants room
                    to be scanned, and every pixel it won came off her face until
                    the mouth stopped reading as animation.
                    A caption doesn't need that room. It holds exactly what is
                    being said right now and is replaced by the next voice, so
                    ~3 lines is sufficient at any argument length and there is
                    nothing to scroll or discover. The reveal writes it out as it
                    is spoken; a line longer than the box follows itself (see the
                    two scroll effects) instead of asking the seeker to chase it.
                    The FULL scrollback still exists on desktop, in the rail —
                    that column has room the phone never did. */}
                {(() => {
                  const i = chatLog.length - 1;
                  const m = chatLog[i];
                  if (!m) return null;
                  const who = SPEAKER[m.who] || SPEAKER.you;
                  const revealing = reveal && reveal.i === i && m.who !== "you";
                  return (
                    <div
                      key={i}
                      style={{
                        fontSize: "0.92rem",
                        lineHeight: 1.5,
                        color: "#ffffff",
                      }}
                    >
                      <span
                        style={{
                          color: who.hue,
                          fontWeight: 700,
                          letterSpacing: "0.02em",
                          textShadow: `0 0 10px ${who.hue}88`,
                        }}
                      >
                        {who.name}:
                      </span>{" "}
                      {revealing ? m.text.slice(0, reveal.chars) : m.text}
                    </div>
                  );
                })()}
                {busy && (
                  <div style={{ fontSize: "0.8rem", color: "rgba(255,255,255,0.4)" }}>
                    considering your question…
                  </div>
                )}
              </div>
            )}

            {/* The narrow layout's share affordance. The wide one lives in the
                rail's status bar; this column has no such bar, so it sits under
                the band — INSIDE the scrolling stage column, not fixed, or it
                would join the ask bar and the dock in competing for the same
                ~150px of phone screen. */}
            {!isWideSolo && canShare && (
              <button
                onClick={() => setCardOpen(true)}
                style={{
                  margin: "12px auto 0",
                  background: "transparent",
                  border: "1px solid rgba(244, 181, 63, 0.4)",
                  borderRadius: 3,
                  padding: "7px 14px",
                  color: "rgba(244, 181, 63, 0.85)",
                  fontFamily: "'Rajdhani', sans-serif",
                  fontSize: "0.7rem",
                  fontWeight: 600,
                  letterSpacing: "0.16em",
                  textTransform: "uppercase",
                  cursor: "pointer",
                  flexShrink: 0,
                }}
              >
                mark her words
              </button>
            )}

            {/* The advisers are mute here by necessity (one player per phone —
                see the portals note). Rather than apologise for it, point at
                where they DO speak. Written in her register, not as an error. */}
            {/* <div
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
            </div> */}
            </div>

            {/* ── The transcript, wide ── The same log, standing full-height
                beside her. This is what the wide layout buys with the width it
                can't spend on the scene: the composition is a centred portrait,
                so growing it past its ceiling just makes a bigger portrait — the
                argument is the thing that actually wants the room. */}
            {isWideSolo && (
              <TranscriptRail
                width={railWidth}
                chatLog={chatLog}
                speakingKey={speakingKey}
                busy={busy}
                boxRef={chatBoxRef}
                ladyFace={CHARACTERS[activeCharIndex]?.image}
                onShare={canShare ? () => setCardOpen(true) : null}
                reveal={reveal}
              />
            )}
          </>
        ) : (
          (panelCount > 1 ? seats : seats.filter((s) => s.seat === "center")).map((s) =>
            renderSeat(s),
          )
        )}
      </div>

      {/* ── Her faces, behind a gear ── On phones it mirrors the wordmark in the
          opposite corner; on every layout it is now the ONLY way to reach the
          roster, since the row under her frame is gone. Out of flow, so the
          scene keeps the column.
          On the TRIPTYCH it sits in HER panel's corner, not the viewport's. It
          changes HER apparition, and parked in the window's top-right it was
          sitting in Connor's frame, offering to restyle the one face it
          can't touch. It is placed by arithmetic rather than by living inside her
          panel: the wordmark gets away with `position:fixed` in there because the
          panel's backdrop-filter makes it the containing block, but that same
          rule also makes the panel a STACKING CONTEXT — the roster sheet's z-1401
          would collapse to the panel row's z-100 and the tap-away layer would
          only cover her column. So the sheet stays at page level and the gear is
          measured to her panel's right edge: the row is centred and she is the
          middle seat, so her edges are 50% ± half ladyPanelWidth. */}
      {!isLoading && !pickerOpen && (
        <>
          <button
            onClick={() => setRosterOpen((o) => !o)}
            aria-label="Change her apparition"
            aria-expanded={rosterOpen}
            style={{
              position: "fixed",
              // Sits on the wordmark's line in the opposite corner — keep this
              // in step with the title's top if either moves.
              top: "calc(12px + env(safe-area-inset-top, 0px))",
              // Solo: the STAGE's top-right corner, opposite the mark — which is
              // the window's on a phone and the rail's edge on a wide window.
              // Triptych: 8px inside HER panel's right edge, which sits at 50% +
              // half her panel — so the inset from the window is 50% − half her
              // panel + 8.
              right: isSolo
                ? railWidth + 8
                : `calc(50% - ${Math.round(ladyPanelWidth / 2) - 8}px)`,
              zIndex: 1401,
              width: 34,
              height: 34,
              display: "grid",
              placeItems: "center",
              borderRadius: "50%",
              border: "1px solid rgba(42, 214, 238, 0.3)",
              background: "rgba(6, 10, 18, 0.72)",
              backdropFilter: "blur(8px)",
              WebkitBackdropFilter: "blur(8px)",
              // Present but never competing with her — it brightens on open.
              opacity: rosterOpen ? 1 : 0.5,
              transition: "opacity 0.25s ease",
              cursor: "pointer",
              padding: 0,
            }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="#2ad6ee" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ width: 17, height: 17 }} aria-hidden="true">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </button>

          {rosterOpen && (
            <>
              {/* Tap-away layer, UNDER the sheet so the sheet still takes taps. */}
              <div
                onClick={() => setRosterOpen(false)}
                style={{ position: "fixed", inset: 0, zIndex: 1400, background: "transparent" }}
              />
              <div
                role="menu"
                style={{
                  position: "fixed",
                  top: "calc(52px + env(safe-area-inset-top, 0px))",
                  // Hangs from the gear, so it tracks it onto her panel.
                  right: isSolo
                    ? railWidth + 8
                    : `calc(50% - ${Math.round(ladyPanelWidth / 2) - 8}px)`,
                  zIndex: 1402,
                  display: "flex",
                  flexDirection: "column",
                  gap: 4,
                  padding: 6,
                  borderRadius: 12,
                  background: "rgba(6, 10, 18, 0.94)",
                  border: "1px solid rgba(42, 214, 238, 0.28)",
                  backdropFilter: "blur(20px)",
                  WebkitBackdropFilter: "blur(20px)",
                  boxShadow: "0 8px 30px rgba(0,0,0,0.6)",
                }}
              >
                {CHARACTERS.map((c, i) => {
                  const active = i === activeCharIndex;
                  const hue = c.frameHue || "#22ccff";
                  return (
                    <button
                      key={c.key || i}
                      role="menuitem"
                      aria-current={active}
                      onClick={() => {
                        setRosterOpen(false);
                        // No-ops when it's already her — handleCharacterSelect
                        // bails on the same index rather than reloading.
                        handleCharacterSelect(i);
                      }}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        padding: "5px 10px 5px 5px",
                        borderRadius: 999,
                        border: "1px solid transparent",
                        background: active ? "rgba(42, 214, 238, 0.12)" : "transparent",
                        cursor: active ? "default" : "pointer",
                        textAlign: "left",
                      }}
                    >
                      <span
                        style={{
                          width: 28,
                          height: 28,
                          flexShrink: 0,
                          borderRadius: "50%",
                          border: `2px solid ${hue}`,
                          backgroundImage: `url(${c.image}), radial-gradient(circle at 50% 38%, ${hue}66 0%, #0d0d15 80%)`,
                          backgroundSize: "cover",
                          backgroundPosition: "center top",
                          boxShadow: active ? `0 0 8px ${hue}` : "none",
                          opacity: active ? 1 : 0.65,
                        }}
                      />
                      <span
                        style={{
                          fontFamily: "'Rajdhani', sans-serif",
                          fontSize: "0.8rem",
                          letterSpacing: "0.08em",
                          textTransform: "uppercase",
                          whiteSpace: "nowrap",
                          color: active ? "#ffffff" : "rgba(255,255,255,0.68)",
                        }}
                      >
                        {c.name}
                      </span>
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </>
      )}

      {/* ── Starter petitions ── Before the first question, on EVERY layout.
          PINNED above the ask bar, NOT flowed in the column: they began life as
          the column's last flow items, but the ask bar is position:fixed and
          lifted out of flow, so a tall frame pushed the chips down INTO the
          bar's band and the column's paddingBottom couldn't stop it (padding
          only makes scroll room at the very bottom, it can't hold a gap above a
          floating element). Fixing them directly on top of the bar — the same
          way the bar sits on the dock — means no frame height can ever reach
          them. They vanish the moment there's a transcript.
          These were solo-only, which left the triptych's empty state as three
          faces, a blank field and nothing else — no reason the page is here and
          nothing to touch. The chips are what SAY what the page is for, and the
          triptych's void needed that more than the phone did, not less. They
          stack on solo (a phone column has width for one per row) and run as a
          single row across the triptych, where they read as a line of offerings
          laid at the foot of the composition. */}
      {/* `hasAsked`, not chatLog.length: the cold open puts lines in the log
          without anyone having asked anything, and the chips are the invitation —
          they must survive the overture and leave only on a real question. */}
      {!hasAsked && (
        <div
          style={{
            position: "fixed",
            left: 0,
            // Centred on the STAGE, not the window: `right` ends the auto-margin
            // box at the rail's edge, so the chips (and the ask bar below, the
            // same way) sit on her axis instead of drifting right of it by half
            // the rail. Every fixed thing that belongs UNDER HER does this.
            right: railWidth,
            // Sit exactly on top of the ask bar: dock + bar + gap.
            bottom: BOTTOM_CLEARANCE,
            marginLeft: "auto",
            marginRight: "auto",
            width: isWideSolo
              ? `min(760px, ${stageWidth - 48}px)`
              : isSolo
              ? "min(440px, calc(100vw - 28px))"
              : "min(920px, calc(100vw - 48px))",
            zIndex: 600,
            display: "flex",
            // A phone column has width for one chip per row. The stage does not
            // have that problem, so the three lie as a row of offerings at the
            // foot of the composition — the same thing the triptych did with them.
            flexDirection: isSolo && !isWideSolo ? "column" : "row",
            justifyContent: "center",
            flexWrap: "wrap",
            gap: 8,
            // Held back with the ask bar until she has arrived — a tappable
            // chip is a louder invitation than the input, and tapping one
            // before the room exists is how you get an answer with no face.
            opacity: sitePalReady ? 1 : 0,
            pointerEvents: sitePalReady ? "auto" : "none",
            transition: "opacity 0.7s ease",
          }}
        >
          {/* <div
            style={{
              textAlign: "center",
              fontFamily: "'Rajdhani', sans-serif",
              fontSize: "0.7rem",
              letterSpacing: "0.2em",
              textTransform: "uppercase",
              color: "rgba(255,255,255,0.32)",
              marginBottom: 2,
            }}
          >
            bring her something
          </div> */}
          {starters.map((q) => (
            <button
              key={q}
              onClick={() => {
                // THE TAP IS THE GESTURE. iOS only grants audio inside a real
                // one, and this is the first one the page reliably gets —
                // without it the advisers' <audio> stays locked and their lines
                // are silent all session.
                unlockAdviserAudio();
                // Deliberately NOT unlockAndGreet: handleAsk stops every player
                // as it starts, so the greeting would be cut off mid-word by the
                // argument it was introducing. Mark her as greeted — they've
                // asked, the room is no longer cold.
                hasGreetedRef.current = true;
                handleAsk(q);
              }}
              style={{
                // Stacked (phone): one per row, so each fills the column and
                // reads as a list. In a row: sized to its own text so the three
                // sit as a centred row rather than three equal slabs.
                width: isSolo && !isWideSolo ? "100%" : "auto",
                padding: "9px 14px",
                borderRadius: 999,
                border: "1px solid rgba(42, 214, 238, 0.22)",
                background: "rgba(6, 10, 18, 0.72)",
                backdropFilter: "blur(8px)",
                WebkitBackdropFilter: "blur(8px)",
                color: "rgba(255,255,255,0.78)",
                fontFamily: "'Rajdhani', sans-serif",
                fontSize: "0.92rem",
                letterSpacing: "0.02em",
                textAlign: isSolo && !isWideSolo ? "left" : "center",
                whiteSpace: isSolo && !isWideSolo ? "normal" : "nowrap",
                cursor: "pointer",
              }}
            >
              {q}
            </button>
          ))}
        </div>
      )}

      {/* ── The ask ── Pinned above the dock. This page exists to be asked a
          question, so the input is the page's main affordance rather than
          something hidden behind a FAB. Sits above the panel row (z 100) and
          below the dock (z 10000).
          NOT OFFERED UNTIL SHE IS THERE (`sitePalReady`). The bar and the chips
          used to render instantly while the players and the frame were still
          loading, so a seeker could ask into an empty shrine and get voices out
          of a room with nobody in it — the answer arrived before the faces did.
          It is also the same hole as the mute-Our-Lady bug from the other end:
          she is the only voice that needs a live portal, so a question asked
          before hers exists is exactly the one she cannot answer aloud.
          Kept MOUNTED and merely inert, rather than unmounted: it holds its
          place in the layout, keeps the input's identity across the transition,
          and fades in instead of popping.
          Safe against SitePal never loading — `sitePalReady` is forced true by
          the 15s timer above (and the portals' own 25s fallback), so the worst
          case is a late input, never a page that can't be used. */}
      {/* ── What stands in the ask bar's place while she is summoned ──
          An input that simply isn't there reads as a broken page, so the slot
          keeps its shape and says what it is waiting for. Same fixed box and
          the same width rules as the form below, so the two cross-fade in place
          with nothing moving. Inert and hidden from assistive tech throughout —
          it is a status line, not a control.
          Deliberately NOT a spinner: this page's whole idea is that she is being
          summoned, and the frame already carries the swirl. This is the caption
          to that, in the same lowercase register as the transcript. */}
      {!sitePalReady && (
        <div
          aria-hidden="true"
          style={{
            position: "fixed",
            left: 0,
            right: railWidth,
            bottom: ASK_BAR_BOTTOM,
            marginLeft: "auto",
            marginRight: "auto",
            width: isWideSolo
              ? `min(620px, ${stageWidth - 24}px)`
              : isSolo
              ? "min(560px, calc(100vw - 24px))"
              : `min(${Math.round(ladyPanelWidth)}px, calc(100vw - 24px))`,
            zIndex: 600,
            pointerEvents: "none",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "7px 8px 7px 14px",
            borderRadius: 999,
            border: "1px solid rgba(42, 214, 238, 0.14)",
            background: "rgba(6, 10, 18, 0.55)",
            minHeight: ASK_BAR_H,
            boxSizing: "border-box",
            fontFamily: "'Rajdhani', sans-serif",
            fontSize: "0.86rem",
            letterSpacing: "0.08em",
            color: "rgba(255,255,255,0.42)",
            animation: "hm2-summon-pulse 2.4s ease-in-out infinite",
          }}
        >
          summoning the spirits…
        </div>
      )}

      <form
        aria-hidden={!sitePalReady}
        onSubmit={(e) => {
          e.preventDefault();
          const t = inputText.trim();
          if (!t || busy || !sitePalReady) return;
          setInputText("");
          handleAsk(t);
        }}
        style={{
          position: "fixed",
          left: 0,
          // Ends at the rail, so the auto margins centre this on the STAGE — the
          // input belongs under her, and the transcript beside her must stay
          // readable to its last line. (Same rule as the chips above.)
          right: railWidth,
          bottom: ASK_BAR_BOTTOM,
          marginLeft: "auto",
          marginRight: "auto",
          // Inert until she has arrived — see the note above.
          opacity: sitePalReady ? 1 : 0,
          pointerEvents: sitePalReady ? "auto" : "none",
          transition: "opacity 0.7s ease",
          // TRIPTYCH: never wider than HER COLUMN. At 560 the bar overhung the
          // centre panel (capped at 440) by 60px a side and reached into both
          // wings — so an adviser's caption ran under the input, which is the
          // one thing on this page you must be able to read. It is the centre
          // column's input in every other sense (she presides, the roster and
          // the mark are hers), so it should measure like it.
          width: isWideSolo
            ? `min(620px, ${stageWidth - 24}px)`
            : isSolo
            ? "min(560px, calc(100vw - 24px))"
            : `min(${Math.round(ladyPanelWidth)}px, calc(100vw - 24px))`,
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
          /* The invitation is for an empty room. Once the argument is running,
             the transcript right above says what this field is for, so the
             prompt is just repetition sitting under her. "Deliberating" stays —
             that's status, not invitation, and it's the only cue the council is
             still thinking. */
          placeholder={
            busy
              ? "considering your question…"
              : chatLog.length
              ? ""
              : "Inquire or confide...…"
          }
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
            label: "ex Machina",
            title: "ex Machina",
            onClick: () => { window.location.href = "/"; },
            confirm: {
              title: "ex Machina",
              body: "Return to home.",
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
            label: "Liminal Terminal",
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
