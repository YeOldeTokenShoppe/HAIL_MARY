"use client";
import React, { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { adviserMouth } from "@/lib/adviserMouth";
import { PITCHER, SEATS } from "@/game/terminal-traders/press/questions";
import { seatMeta } from "@/game/terminal-traders/press/desk";
import { VIRGIL } from "@/game/terminal-traders/press/virgil";
import { VIRGIL_PORTAL_ID } from "@/lib/trade/virgilVoice";
import { seatPortalId } from "@/lib/trade/seatVoice";
import SitePalPortalTile from "./SitePalPortalTile";
import {
  pitcherPortrait, pitcherVoice, pitcherHasStage, resolvePitcherId,
} from "@/game/terminal-traders/press/pitchers";

/**
 * THE LIVE RIG, LOADED ONLY IF ONE IS CAST.
 *
 * `dynamic` with ssr:false is doing real work here, not ceremony: PressBotStage
 * pulls in three, GLTFLoader, DRACOLoader and the whole face system, and this
 * surface's entire premise is that a phone can play the game without any of
 * that. A static import would put the renderer in the bundle for every session,
 * including the ones staging a rig that cannot use it and the ones showing an
 * analyst's still. Split, it arrives only when the roll actually lands on a rig
 * with a drivable face.
 */
const PressBotStage = dynamic(() => import("./PressBotStage"), { ssr: false });

// PRESS FIGURE — the live feed on a surface with no 3D. WHOEVER IS TALKING.
//
// WHY THIS EXISTS: this path has no SitePal and no WebGL, so neither of the two
// mouths desktop uses is available — not the face projection, and not the LED
// viseme plates that live inside the pitch-bot glb. What IS available is the
// amplitude scalar: counselSpeech runs an AnalyserNode over the decoded
// ElevenLabs buffer and writes one number per frame into `adviserMouth`, and a
// number is renderer-agnostic. The same signal that rotates Eugene's jaw bone in
// R3F drives everything below.
//
// IT WAS BARRON UNTIL 2026-08-02, and had been wrong since 2026-07-29 in a way
// that looked fine: two headshot frames cross-faded on `adviserMouth.JB`, from
// back when Connor did the selling. When the pitch bot took the pitch over, this
// surface kept showing HIS FACE while the BOT's voice played, and read the mouth
// off a key nothing was writing — so the one animation on the panel silently
// stopped.
//
// THREE RIGS, ONE ROLE. Which shell is staged comes from press/pitchers — the
// SAME resolver desktop's pitchBotScene uses to pick a glb — so the face here,
// the tile in the seat row and the thing in the beam cannot disagree, and
// `?pitchbot=v2` swaps all three at once. Nothing else about the rig reaches
// this file: VC_GAME.md §1 rule 6 is one character in several bodies, so a shell
// may carry its own face and its own throat and must never carry its own script.

/* ────────────────────────────────────────────────────────────────────────────
   WHY THE BOT'S MOUTH IS DRAWN AND THE ANALYSTS' ARE NOT.

   THE PITCH BOT CAN NEVER BE A SITEPAL CHARACTER, and the reason is in its
   script rather than in its geometry. `sayAudio` resolves NAMES IN THE ACCOUNT,
   NEVER URLS (api/trade/director, "verified via the spike"), so a SitePal face
   can only lip-sync clips somebody uploaded ahead of time. The bot's lines name
   the deal — "I'm here for TIDEWATER — $TIDE, on Base" — and the deal is rolled
   per sitting, so there is no clip to upload. Its rigs are glb, too. Both facts
   point the same way: its mouth has to be driven from the audio, live.

   So it is DRAWN: a plate that covers the mouth baked into the portrait, and an
   LED bar inside it scaled by the amplitude. That works here because these
   faces are FLAT EMISSIVE GLYPHS — the same reason the unicorn gets a code-made
   oval mouth in CyborgTempleScene instead of a jaw bone. A drawn LED and a
   rendered LED are the same drawing.

   THE ANALYSTS ARE THE OPPOSITE CASE and deliberately get no drawn mouth. Their
   press lines are a FIXED BANK OF TWENTY (ADVISER_LINES in desk.js — four seats
   x dispatch/found/partial/nothing, plus one shallow each), which is exactly
   what SitePal can lip-sync: three of them already have scenes in the account
   (Demon 2774900, Detective 2774916, Monk 2774449) and `SitePalFeed` is already
   the one-character-at-a-time 2D feed this slot wants. Drawing them a sprite
   mouth would be building the worse version of a thing that is one upload pass
   away. See THE SITEPAL SLOT below for what is left to do.
   ──────────────────────────────────────────────────────────────────────────── */

/** Amplitude at or above this reads as speech rather than as room tone. */
const OPEN_AT = 0.12;
/** Level treated as a fully open mouth. Above PressSession's 0.38 "Open"
 *  threshold, because a drawn mouth is continuous and hitting the ceiling early
 *  makes every loud syllable look identical. */
const FULL_AT = 0.46;

/**
 * HOW EACH SHELL SITS IN A SQUARE TILE, AND WHERE ITS MOUTH IS.
 *
 * The three portraits are framed differently in their own files — v1 is a 241px
 * chibi that is mostly head, v2 a 444px humanoid shot to the chest, v3 a 406x480
 * with a hairdo taller than its face — so one crop cannot serve all three.
 *
 * `mouth` IS IN PERCENT OF THE TILE, NOT OF THE SOURCE IMAGE, and that is the
 * only reason the numbers stay true: the portrait is `object-fit:cover` in a
 * square, so a source-pixel measurement has to be re-derived through the crop
 * for each rig's aspect. Tile percentages are what you can see and nudge. The
 * mouth lives inside the SAME transformed wrapper as the image, so `scale` and
 * `origin` move both together and registration survives a reframing.
 *
 * THESE WERE EYEBALLED, NOT MEASURED — the portraits are 241-444px renders and
 * there is no source file to take a slot measurement off, the way /main's
 * MOUTH_ART numbers came off body.png. Register them by eye instead:
 *
 *     ?botmouth=1   then Shift+B to arm, arrows move, [ ] width, - = height,
 *                   and the console logs a paste-ready block.
 *
 * THIS IS THE FLAT SURFACE'S FRAMING AND IT BELONGS HERE, not in pitchers.js.
 * That module is identity — which rig, its portrait, its voice — and is imported
 * by pure game code; the 3D room likewise keeps its own framing next to three.
 */
const FEED_FRAMING = {
  v1: {
    scale: 1.06, origin: "50% 45%",
    // Chibi robot: a black screen for a face, so the plate is nearly invisible
    // against it — the easiest of the three to paint over.
    mouth: { x: 50.5, y: 54.5, w: 17, h: 7, open: 5.5, r: 45, plate: "#050d0c" },
  },
  v2: {
    scale: 1.02, origin: "50% 38%",
    // Humanoid: a pale cyan face with a small white bar for a mouth. The plate
    // has to match a lit surface rather than a dark one, so it is the one most
    // worth checking with the tuner.
    mouth: { x: 46.5, y: 45.5, w: 11, h: 5, open: 4, r: 35, plate: "#9fd8d6" },
  },
  v3: {
    scale: 1.00, origin: "50% 40%",
    // Split-face rig: dark face, white LED mouth, big hair. Sits lower in the
    // tile than the others because the hair pushes the face down in the crop.
    mouth: { x: 48, y: 57, w: 13, h: 6, open: 4.5, r: 40, plate: "#0a1a1c" },
  },
};
const FEED_FRAMING_DEFAULT = { scale: 1.04, origin: "50% 44%", mouth: null };

/**
 * SEATS THAT GET A DRAWN MOUTH AFTER ALL.
 *
 * The note at the top of this file rules the analysts out of drawn mouths, and
 * the reasoning still holds for three of them: their press lines are a fixed bank
 * of twenty, three of them have SitePal scenes in the account, and a sprite mouth
 * would be the worse version of an upload pass.
 *
 * EUGENE IS THE ONE IT DOES NOT HOLD FOR, and the same note says why without
 * drawing the conclusion: "Eugene has no scene — an equine head needed a custom
 * build — so he stays on this panel's amplitude path". He was left on a path that
 * had nothing to drive. The panel lit its lamp and ran its meter off
 * adviserMouth.EU while his face sat still, which reads as a broken panel, and
 * unlike the others he has no upload pass waiting to fix it. Desktop has moved
 * his jaw for him all along (playUnicornBeat -> a real bone); this is the flat
 * surface finally doing the 2D equivalent of the same amplitude.
 *
 * HIS MOUTH IS ALREADY OPEN IN THE ART, which is what makes this cheap: the
 * plate covers a dark slot that is exactly mouth-shaped, so at rest he simply
 * closes. The pitch bot's plates hide a drawn LED and light up; his hides a hole
 * and fills it back in.
 *
 * MEASURED, NOT EYEBALLED — twice, because the first measurement was of the
 * wrong thing. Thresholding thumbnail_eugene.png (570x604) at luminance 130 and
 * taking the LONGEST CONTIGUOUS DARK RUN per row inside the muzzle, the slot is
 * x 223-354, y 333-351 — 131 x 18 source pixels.
 *
 * SAMPLING A SINGLE ROW GAVE 90px AND THAT IS WHY THE FIRST TRY WAS TOO NARROW.
 * The mouth's corners droop, so its widest point is at the TOP (131px at y337,
 * tapering to 98px by y351); one row through the middle misses a third of it.
 * A bare threshold does not work either — the portrait's background is dark, so
 * a naive scan reports the window edges on every row. Longest-run-within-the-
 * muzzle is the measurement that survives both.
 *
 * THEN PUSHED THROUGH THIS PANEL'S TRANSFORMS, which is what makes source
 * percentages useless on their own:
 *   COVER-CROP. 570x604 into a square fills on WIDTH, so height overflows by
 *               604/570 = 1.0596 and ~2.98% is cropped off top and bottom.
 *               y_tile = y_src * 1.0596 - 0.0298; x is untouched.
 *   THE IMG'S OWN 1.04, about origin 50% 50% (the default — .pf-frame sets none).
 *               v = 50 + (v - 50) * 1.04.
 *
 * NOT .pf-reg's 1.04, and getting that wrong cost a round: the wrapper's scale
 * (origin 50% 44%) applies to the mouth and the image ALIKE, since both live
 * inside it, so it cancels and must not appear in this derivation. Only the
 * scale the <img> carries on its own displaces one relative to the other.
 *
 * Lands at: x 38.69-62.59 (centre 50.64, w 23.90), y 55.66-58.94 (h 3.28).
 *
 * Adjust by eye from here — the derivation gets you onto the mouth, not into it:
 *
 *     ?botmouth=1   then Shift+B to arm, arrows move, [ ] width, - = height,
 *                   and the console logs a paste-ready block.
 */
const SEAT_MOUTH = {
  [SEATS.EUGENE]: {
    /* THE BOX IS THE OPENING, NOT THE SLOT. Its TOP edge lands on the top of the
       measured slot (55.66%) and it hangs down from there, so the mouth grows
       DOWNWARD out of the line already drawn on his face the way a jaw does.
       `y` is a CENTRE — translate(-50%,-50%) — so it is 55.66 + h/2.
       The slot itself is only 3.28% tall; 7% is how far a wide-open mouth should
       reach, and it is the one number here that is a judgement rather than a
       measurement. Lower h and `open` TOGETHER if it reads as a yawn — unequal
       and the fill stops filling the box. */
    x: 50.6, y: 58.5, w: 23.9, h: 5.6, open: 5.6,
    /* A LENS, NOT A LOZENGE. `r` takes a full CSS border-radius here, and the
       shape is the whole point: an opening is nearly FLAT across the top, where
       the upper teeth sit in a line, and curves away underneath as the jaw drops.
       A uniform radius gives a rounded rectangle with a flat bottom, which is
       what read as wrong even once the size was right — and the measurement says
       so too, the slot being 131px across at its top and 98px by its bottom.
       Slash syntax so the horizontal and vertical radii differ: barely rounded at
       the top corners, strongly rounded at the bottom. */
    r: "14% 14% 52% 52% / 10% 10% 92% 92%",
    align: "flex-start",
    /* FULL WIDTH. The shared default is 82%, an inset that exists so the pitch
       bot's LED bar sits INSIDE its plate with a rim of plate showing. Eugene has
       no plate, so 82% just made his mouth a third too narrow on top of the
       measurement error — 13.5% of tile against a real 23.9%. */
    fillW: "100%",
    /* SQUARE, because the BOX is now the mouth shape and it clips (.pf-mouth is
       overflow:hidden). The fill's own 44% default would round its corners a
       second time inside an already-rounded box and pull the teeth away from the
       corners of the opening. */
    fillRadius: "0",
    /* NO PLATE. This is the whole fix for the pale lozenge, and it is a change of
       approach rather than a better colour.
       THE PITCH BOT NEEDS A PLATE because its portrait has a drawn LED mouth that
       must be hidden before a new one is painted. EUGENE DOES NOT: his art
       already carries a thin dark slot that reads perfectly well as a closed
       mouth, and it is visible at rest in every screenshot of the panel. Covering
       it meant painting a flat patch over a muzzle that is a gradient, on an
       image that SWELLS up to 2.2% while he speaks (the per-frame scale is on the
       <img> alone, so the patch cannot track it) — a lozenge that lit up the
       moment he went live and never quite sat right. Drawing only the OPENING
       leaves his own face doing the work and has nothing to misregister. */
    plate: "transparent",
    /* A MOUTH, NOT AN LED — and specifically HIS mouth. The default fill is the
       robots' emissive cyan bar, which is right on a face that is a screen and
       badly wrong on an animal.
       THE TEETH ARE THE CHARACTER. The rig has big cream front teeth along the
       upper rim with the dark opening below, and a plain dark oval loses the one
       feature that makes the face read as his (author, 2026-08-04: "missing large
       front teeth"). So the fill is banded — cream across the top ~42%, dark
       under it — with a repeating layer scratching in the gaps between teeth.
       Both bands scale together, so the proportion holds at every opening. */
    /* THREE TEETH, NOT A ROW — author's call, 2026-08-04, and it is the fix for
       the last thing that looked wrong rather than a stylistic preference. A
       full-width band has to follow the top edge of the opening, and that edge is
       a CURVE (see `r`) while a gradient stop is a straight line: the two
       disagreed at the corners no matter how the band was coloured or how thin it
       was cut. Three discrete teeth sit in the middle, where the opening is at
       its full height and the curve has not started, so there is nothing left to
       disagree with. It also matches the rig, where the teeth are a cluster in
       the centre with dark mouth continuing past them on both sides.
       Each is its own background layer — position / size / no-repeat — over the
       dark interior. The middle one is slightly longer, as incisors are; a row of
       three identical rectangles reads as a grille.
       COLOURS OFF THE ART: the interior is #575357, nowhere near black, and the
       teeth in this render are a pale lavender-white rather than the rig's cream.
       A patch is only invisible if it is made of the same paint as its
       surroundings. */
    /* SHORT ENOUGH TO BELONG TO THE UPPER JAW (author, 2026-08-04). At ~half the
       opening's height they read as free-floating in the middle of it; at a third
       they are clearly hanging from the top edge, which is where teeth are.
       THE GAPS ARE NARROW, and the arithmetic is the part worth writing down:
       percentage background-position aligns the LAYER's own P% point to the
       CONTAINER's P%, so a 12%-wide layer at 34% has its left edge at
       34 * (100-12)/100 = 29.92%, not at 34%. Which makes the gap between two
       teeth (P2-P1) * 0.88 - 12. At 33/50/67 x 11% that was 4.1% of the opening —
       a visible space, more gum than mouth. 34/50/66 x 12% lands at 2.1%. Below
       about 1.5% they fuse into one plate and the count stops reading. */
    fill:
      "linear-gradient(180deg,#efe6f2,#ddd0e6) 34% 0 / 12% 32% no-repeat," +
      "linear-gradient(180deg,#efe6f2,#ddd0e6) 50% 0 / 12% 36% no-repeat," +
      "linear-gradient(180deg,#efe6f2,#ddd0e6) 66% 0 / 12% 32% no-repeat," +
      "linear-gradient(180deg,#575357,#46414a)",
    glow: "none",
    /* THE JAW DROPS; THE TOP LIP DOES NOT. The shared default scales from the
       centre, which on a mouth with teeth on its upper rim slides them down into
       the opening as it closes — a horse chewing its own face. Anchoring the top
       edge means the teeth stay put and the jaw swings away from them, which is
       what the rig does and what the eye expects. Paired with `align`, it also
       means the closed state collapses onto the baked slot rather than hovering
       below it. */
    origin: "50% 0%",
  },
};

/* BARS, CARRIER AND BARS_REST WENT WITH THE LEVEL METER (2026-08-04).
 *
 * Worth keeping the carrier's reasoning, because it argues against its own
 * feature and the argument is what retired the whole effect. The carrier was a
 * floor the meter idled at so that a FAILED voice — speakAdviserLine returns
 * false on any non-200 from /api/counsel-voice, and the game plays on because
 * voice is enrichment and never a gate — did not render as ON AIR over a row of
 * dead bars. That is a fake level existing to cover for a real absence, which
 * is the same job the whole meter was doing on an analyst: standing in for a
 * face that is not there. The lamp already says the line is open, and it says
 * it without inventing a signal.
 */

/* ── the tuner ──
   Same shape as CyborgTempleScene's __rl80Mouth: a window object you can edit
   from the console, plus key nudging behind a flag, plus a log line you paste
   back into FEED_FRAMING. It exists because the defaults above are eyeballed —
   shipping numbers I could not measure without shipping the means to fix them
   would be leaving the next person to re-derive them by trial and rebuild. */
function tunerOn() {
  if (typeof window === "undefined") return false;
  try { return new URLSearchParams(window.location.search).get("botmouth") === "1"; }
  catch { return false; }
}

export default function PressFigure({
  speaking = false, voice = null, band = "cool", who = PITCHER, className = "",
  /** Which seat's SitePal player to keep warm — the current claim's lane owner.
   *  See the mount note below for why it is not "whoever was pressed". */
  portalSeat = null,
}) {
  const portalSeatCfg = portalSeat ? seatMeta(portalSeat)?.sitepal || null : null;
  /** This seat's own player is mounted AND the camera is on them, so the live
   *  face is what the panel should be showing — see the still-suppression note
   *  at the render site for what happens when this is forgotten. */
  const portalOnCamera = !!portalSeatCfg && who === portalSeat;
  const ledRef = useRef(null);
  const mouthRef = useRef(null);
  // One failed load retires the portrait for the session — a broken-image glyph
  // where a face goes is far worse than a plate with the name on it.
  const [artBroken, setArtBroken] = useState(false);
  useEffect(() => { setArtBroken(false); }, [who]);
  // The live rig couldn't load — a 404, a poisoned CDN entry, a refused WebGL
  // context. Fall back to the still for the rest of the session rather than
  // leaving the panel empty, and never retry: whatever failed will fail again,
  // and a rig that pops in three claims late is worse than one that never came.
  const [stageFailed, setStageFailed] = useState(false);

  /**
   * WHO IS ON CAMERA. The pitcher resolves through press/pitchers so the face
   * matches the staged rig; a seat resolves through the desk like everywhere
   * else. seatMeta covers both — the pitcher is deliberately not in DESK, and
   * every surface that grew its own `id === PITCHER ? ... : DESK[id]` ternary
   * has drifted from the others eventually.
   */
  const cast = useMemo(() => {
    // ASKED WHATEVER THE CAMERA IS DOING. Whether the staged rig can be rendered
    // live is a property of the RIG, not of who happens to be on screen — the
    // stage stays mounted behind an analyst, so this has to answer the same way
    // while the camera is away from it.
    const canStage = pitcherHasStage();
    if (who === PITCHER) {
      const id = resolvePitcherId();
      const frame = FEED_FRAMING[id] || FEED_FRAMING_DEFAULT;
      return {
        id, canStage,
        name: seatMeta(PITCHER)?.name || "Pitch Bot",
        src: pitcherPortrait(id),
        voice: voice || pitcherVoice(id),
        frame,
        // THE DRAWN MOUTH IS THE FALLBACK NOW, not the plan. A rig that can be
        // staged live gets its authored face; only a rig that can't — v1 today —
        // gets a mouth painted over its portrait.
        mouth: canStage ? null : frame.mouth,
        onStage: canStage,
      };
    }
    /* VIRGIL IS NOT A SEAT AND NOT IN THE DESK — seatMeta answers null for him,
       which would render the no-signal plate with a blank name while his voice
       played. He carries the same three fields a seat does (name / portrait /
       voice), so once he is resolved nothing below needs to know he is a cat.
       Resolved here rather than by teaching seatMeta about him: desk.js is
       imported by pressRun, and virgil.js may never be (virgil.js, THE
       INVARIANT). */
    const m = who === VIRGIL.id ? VIRGIL : seatMeta(who);
    return {
      id: who, canStage,
      name: m?.name || "",
      src: m?.portrait || null,
      voice: voice || m?.voice,
      frame: FEED_FRAMING_DEFAULT,
      /* NO DRAWN MOUTH FOR MOST SEATS — see the note at the top of the file:
         for the three with SitePal scenes this is the SitePal slot, not a gap,
         and drawing a sprite mouth would be building the worse version of an
         upload pass. SEAT_MOUTH carries the exception (Eugene, who has no scene
         to wait for and was therefore waiting for nothing). */
      mouth: SEAT_MOUTH[who] || null,
      onStage: false,
    };
  }, [who, voice]);
  const showStage = cast.onStage && !stageFailed;
  const isVirgil = who === VIRGIL.id;

  const rest = `scale(${cast.frame.scale})`;

  /* Live tuning handles. Written every render so the object always describes the
     character actually on camera, and reads back through the same fields the
     defaults use — paste the logged block straight into FEED_FRAMING. */
  useEffect(() => {
    if (!tunerOn() || !cast.mouth) return;
    const m = { ...cast.mouth };
    window.__botMouth = m;
    let armed = false;
    const apply = () => {
      const el = mouthRef.current;
      if (!el) return;
      el.style.left = `${m.x}%`; el.style.top = `${m.y}%`;
      el.style.width = `${m.w}%`; el.style.height = `${m.h}%`;
      // Same number-or-string rule the render uses; a bare `${m.r}%` turns a
      // shaped radius into "14% 14% ... 92%%" and the browser drops the lot,
      // so the tuner would silently square off the mouth it is meant to fit.
      el.style.borderRadius = typeof m.r === "string" ? m.r : `${m.r}%`;
      el.style.background = m.plate;
    };
    const onKey = (e) => {
      if (e.key === "B" && e.shiftKey) {
        armed = !armed;
        console.log(`[botMouth] nudging ${armed ? "ARMED" : "off"} for ${cast.id}`);
        return;
      }
      if (!armed) return;
      const step = e.shiftKey ? 1 : 0.25;
      const map = {
        ArrowLeft: () => { m.x -= step; }, ArrowRight: () => { m.x += step; },
        ArrowUp: () => { m.y -= step; }, ArrowDown: () => { m.y += step; },
        "[": () => { m.w -= step; }, "]": () => { m.w += step; },
        "-": () => { m.h -= step; }, "=": () => { m.h += step; },
        ",": () => { m.open -= step; }, ".": () => { m.open += step; },
      };
      if (!map[e.key]) return;
      e.preventDefault();
      map[e.key]();
      apply();
      console.log(`[botMouth] ${cast.id}: mouth: { x: ${+m.x.toFixed(2)}, y: ${+m.y.toFixed(2)}, `
        + `w: ${+m.w.toFixed(2)}, h: ${+m.h.toFixed(2)}, open: ${+m.open.toFixed(2)}, `
        + `r: ${typeof m.r === "string" ? JSON.stringify(m.r) : m.r}, `
        + `plate: ${JSON.stringify(m.plate)} },`);
    };
    console.log("[botMouth] tuner ready — Shift+B to arm, arrows move, [ ] width, - = height, , . openness");
    window.addEventListener("keydown", onKey);
    return () => { window.removeEventListener("keydown", onKey); };
  }, [cast]);

  /* THE PANEL NO LONGER MIMES SPEECH IT CANNOT PERFORM (author, 2026-08-04:
     "she is not speaking through sitepal — no face movement — just that screen
     trick of synching the screen pulses with the voice. Let's retire that
     effect").

     THREE OF THE FOUR AMPLITUDE WRITES WERE STANDING IN FOR A FACE, and they
     stood in for it on exactly the characters that have none: the glow
     brightening, a 2.2% "breath" scale on the portrait, and a fourteen-bar
     level meter, all riding the same RMS scalar. On the pitch bot they were
     decoration next to a real mouth; on an analyst they WERE the performance,
     and a still portrait behind a pulsing chrome reads as the panel pretending.
     The honest version is a still portrait, the ON AIR lamp, and the voice.

     WHAT SURVIVES IS THE ONE THING THAT IS ACTUALLY A FACE — the LED plate,
     where the character has one. And the effect now runs ONLY when there is a
     plate to drive: with no mouth there is nothing to animate, so the loop does
     not start at all rather than starting and writing to nothing.

     NOT RETIRED, AND DO NOT CONFUSE THEM WITH THIS: the border's mood ring
     (pressure, not amplitude — §1 rule 3) and the ON AIR lamp and LIVE plate
     (binary state, set once per utterance, never per frame). Those say who is
     talking and how the pitch is going. Only the frame-by-frame mimicry went.

     THE SLOT THIS LEAVES OPEN IS SITEPAL — §6's "the analysts are the SitePal
     slot, deliberately unfilled". Twenty banked lines per seat is what would
     put real mouths here; until then the panel says nothing it cannot back. */
  useEffect(() => {
    if (!speaking || !cast.mouth) return;
    let raf;
    let smoothed = 0;
    const openSpan = Math.max(0.001, FULL_AT - OPEN_AT);
    const tick = () => {
      // Smoothed past the analyser's own smoothing: raw RMS chatters on
      // sibilants and reads as flicker rather than as speech. Paired with
      // counselSpeech.speakingLevel's per-line normalisation (95th percentile,
      // not max — one plosive sets a max that makes the whole line read quiet).
      smoothed += ((adviserMouth[cast.voice] || 0) - smoothed) * 0.45;
      const lvl = Math.min(1, Math.max(0, smoothed));
      const open = lvl >= OPEN_AT;

      // THE MOUTH. Continuous rather than the three discrete states desktop
      // uses: those exist because a mesh swap has nothing between Closed and
      // Mid, and a drawn bar does. No hysteresis needed for the same reason —
      // there is no threshold to sit on and strobe across.
      if (ledRef.current) {
        const o = Math.min(1, Math.max(0, (lvl - OPEN_AT) / openSpan));
        ledRef.current.style.transform = `scaleY(${0.14 + o * 0.86})`;
      }
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => {
      cancelAnimationFrame(raf);
      // Never leave the panel mid-word after the voice stops.
      if (ledRef.current) ledRef.current.style.transform = "scaleY(0.14)";
    };
  }, [speaking, cast]);

  const m = cast.mouth;
  return (
    <div className={`pf-feed ${speaking ? "live" : ""} ${className}`}
         data-band={band} aria-hidden="true">
      <style>{CSS}</style>
      <div className="pf-feed-inner">
        {/* THE ACTUAL RIG. Its own LED viseme plates, driven by the same
            amplitude everything else on this panel reads — so the mouth is the
            authored one rather than a bar drawn over a photograph.

            MOUNTED FOR THE WHOLE SESSION, HIDDEN WHEN THE CAMERA IS ELSEWHERE.
            Rendering it only while `showStage` was the obvious shape and it is
            the expensive one: the feed cuts to an analyst on every press, so
            unmounting would re-parse a ~900KB Draco rig, re-init 19 plates and
            re-align them three or more times a session, and the pitcher would
            pop back in late each time. Hiding costs a hidden DOM node; the rAF
            loop already stops on its own, because `display:none` makes
            `offsetParent` null and that is exactly the gate it checks.
            `speaking` is gated too — the rig must not mime an analyst's line
            behind the panel and come back mid-word. */}
        {cast.canStage && !stageFailed && (
          <div className="pf-live" style={{ display: showStage ? "block" : "none" }}>
            <PressBotStage speaking={showStage && speaking} band={band}
                           onFail={() => setStageFailed(true)} />
          </div>
        )}
        {/* VIRGIL'S LIVE PLAYER, IN PLACE OF HIS STILL — the SitePal slot this
            file's closing note describes, taken for the one character who needs
            it most and can have it cheapest.

            WHY HIM AND NOT THE SEATS. The note below says the analysts are the
            obvious candidates because their twenty press lines are a fixed bank
            that could be uploaded and lip-synced by name. Virgil is the opposite
            case and gets there first anyway: his agenda names a COUNT that is
            rolled per deal ("Two more money questions after this one"), so there
            is no clip to upload and never will be — live TTS is the only thing
            that can say his lines at all. SitePal's engine 14 does exactly that
            in his own ElevenLabs voice, and lip-syncs what it generated.

            AND WHY NOT THE PITCH BOT. It has a rig with real viseme plates
            (PressBotStage above); a 2D player would be a downgrade.

            MOUNTED FOR THE WHOLE SESSION AND HIDDEN BY OPACITY — the same shape
            as the bot's stage above, arrived at from the opposite direction and
            for two reasons that both bite hard:

            COLD START. He holds the camera for about three seconds per claim and
            the player needs several to boot. Mounting on `isVirgil` looked
            obviously right and is unshippable: the portal would still be loading
            every time he finished talking, so the tile would show the still for
            the entire session and the whole feature would silently do nothing.
            Measured that way round on the first build of this.

            AND IT MAY NOT BE display:none. That is the correct hide for the bot's
            rig — its rAF loop gates on offsetParent, so hiding parks it — but a
            SUBFRAME with an empty clip rect is throttled by WebKit to ~0.1fps,
            and audio is untouched by that, so he would come back speaking with a
            frozen face. Which is the exact bug this component exists to fix.
            Opacity keeps it painting; see [[sitepal-iframe-offscreen-throttle]],
            which has already been re-broken twice by hiding a portal some other
            way. */}
        {VIRGIL.sitepal && (
          <SitePalPortalTile
            id={VIRGIL_PORTAL_ID}
            sitepal={VIRGIL.sitepal}
            still={VIRGIL.portrait}
            active={isVirgil}
          />
        )}
        {/* ONE ANALYST'S PLAYER, MOUNTED A CLAIM AHEAD OF THE PRESS.
            `portalSeat` is the LANE OWNER of the claim now being made — the
            seat the lane band is pointing at, and the one a player is most
            likely to spend. Not the seat that was pressed: by then it is far
            too late, which is the cold-start finding directly above, arrived at
            once already on Virgil. Mounting at claim start buys the whole of
            the bot's spin plus the cat's line as boot time, and the seat row
            does not even appear until that speech ends, so the player cannot
            press before the window has run.

            WHY NOT ALL FOUR, WHICH IS WHAT VIRGIL'S NOTE WOULD IMPLY. He is
            mounted for the session because he speaks on EVERY claim; a seat
            speaks at most three times in six. Four live SitePal players on a
            phone to warm three that may never be asked is a poor trade
            (author: one iframe, not four). The cost of the choice is honest and
            bounded: press a seat who is not the lane owner and their portal
            was never mounted, so they take the voice-only path — the same
            fallback a portal that failed to boot would take.

            KEYED BY SEAT so a claim whose lane owner changes REMOUNTS rather
            than reusing the player. SitePalPortalTile's own rule: one tile, one
            character, for the life of the mount — loadSceneByID on a live
            player can leave its audio subsystem null and it then plays nothing
            at all, silently. */}
        {portalSeatCfg && (
          <SitePalPortalTile
            key={portalSeat}
            id={seatPortalId(portalSeat)}
            sitepal={portalSeatCfg}
            still={seatMeta(portalSeat)?.portrait}
            active={who === portalSeat}
          />
        )}
        {/* WHOEVER HAS A LIVE FACE DOES NOT ALSO GET A STILL PAINTED OVER IT.
            This list is every character whose mouth is real, and an analyst
            with a portal was missing from it — which is the entire reason
            Virgil lip-synced and Marisol did not (author, 2026-08-04: "marisol
            still doesn't move — are we just showing an image or are we using
            the sitepal embed?").

            BOTH. Her portal was healthy the whole time — measured mid-session:
            still faded to 0, stage at 1, sayText registered, no STILL flag —
            and then this block rendered her `.pf-frame` portrait AFTER the tile
            in the DOM, so the still she had already faded out of covered the
            player that was moving underneath it. Virgil escaped only because
            `isVirgil` was hard-coded here when he was the one exception.

            The condition is now the PROPERTY, not the name: does the character
            in frame have a player of their own. Add a seat to DESK with a
            sitepal block and it is covered; take one away and its still comes
            back, with no second place to remember. */}
        {isVirgil || portalOnCamera ? null : showStage ? null : artBroken || !cast.src ? (
          <div className="pf-feed-nosig">
            <b>{(cast.name || "NO SIGNAL").toUpperCase()}</b>
            <span>AUDIO ONLY</span>
          </div>
        ) : (
          /* ONE TRANSFORMED WRAPPER FOR THE FACE AND ITS MOUTH. The scale used
             to sit on the <img>; the mouth has to take the same transform or it
             slides off the face the moment a rig is reframed, so the transform
             moved out here and the image inside is untransformed at rest. */
          <div className="pf-reg" style={{ transform: rest, transformOrigin: cast.frame.origin }}>
            <img
              className="pf-frame"
              src={cast.src}
              alt=""
              onError={() => setArtBroken(true)}
            />
            {m && (
              /* The PLATE covers the mouth drawn into the portrait — the same
                 requirement /main's art contract puts on its sprite frames
                 ("each frame must PAINT OVER the mouth baked into body.png"),
                 which is why it fades in with the voice instead of sitting
                 there: at rest you want the character's own face. */
              <span ref={mouthRef} className="pf-mouth"
                    style={{ left: `${m.x}%`, top: `${m.y}%`, width: `${m.w}%`,
                             height: `${m.h}%`,
                             // A number is a percentage on all four corners (the
                             // bot rigs' pill). A STRING is a full CSS
                             // border-radius, so a shape can be described rather
                             // than approximated — see Eugene's lens.
                             borderRadius: typeof m.r === "string" ? m.r : `${m.r}%`,
                             background: m.plate,
                             // Default is centred (the bot rigs' plate is the
                             // mouth); flex-start lets a fill hang from the top
                             // edge so it opens downward out of baked-in art.
                             ...(m.align ? { alignItems: m.align } : null) }}>
                {/* `fill`/`glow`/`origin` are per-character overrides on the
                    shared LED styling — an emissive bar scaled from its centre
                    is right for a face that IS a screen and wrong for one that
                    isn't. Omitted, the CSS defaults (the robots' cyan, centre
                    origin) apply. */}
                <i ref={ledRef}
                   style={{ height: `${(m.open / m.h) * 100}%`,
                            ...(m.fill ? { background: m.fill } : null),
                            ...(m.fillW ? { width: m.fillW } : null),
                            ...(m.fillRadius != null ? { borderRadius: m.fillRadius } : null),
                            ...(m.glow ? { boxShadow: m.glow } : null),
                            ...(m.origin ? { transformOrigin: m.origin } : null) }} />
              </span>
            )}
          </div>
        )}
        {/* .pf-glow AND .pf-meter ARE GONE — the brightening that rode the
            voice and the fourteen-bar level row. See the note on the effect
            above for why. .pf-scan and .pf-sweep stay: they are the panel's
            own CRT idle and run whether or not anyone is speaking, so they
            are furniture rather than a performance. */}
        <span className="pf-scan" />
        <span className="pf-sweep" />
      </div>
      <span className="pf-lamp">{speaking ? "● ON AIR" : "○ STANDBY"}</span>
      <span className="pf-cap">{cast.name} · LIVE</span>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
   THE SITEPAL SLOT — what replaces a seat's still, and what it costs.

   `<SitePalFeed sceneId={...} line={{ key, audio, text, voice }} />` already
   does everything this slot needs: one embed, one character at a time (three
   live players OOM-crash iOS Safari), `sayAudio(name)` when the line has a
   banked clip and `sayText` TTS when it doesn't, plus `vh_talkEnded` so a turn
   can be sequenced. Drop it in place of the <img> when `cast` has a scene.

   THE THREE THAT CAN, AND HOW THEY DIFFER:
     Monk / GR80        2774449   speaks ANY text live (Gilbert TTS)
     Demon / Connor     2774900   banked clips only
     Detective / Marisol 2774916  banked clips only
   Eugene has no scene — an equine head needed a custom build — so he stays on
   this panel's amplitude path, which he can, because he has an ElevenLabs voice
   (EU) like everyone else.

   THE ONE PIECE OF WORK IS AN UPLOAD PASS, NOT CODE. Generate the twenty
   ADVISER_LINES through /api/counsel-voice in each seat's own ElevenLabs voice,
   upload them to the SitePal Audio Manager, and name them (`MR_found`,
   `JB_nothing`, ...). Then Connor and Marisol lip-sync THEIR OWN VOICES rather
   than a TTS stand-in, and the `audioNames` machinery in
   SITEPAL_PROJECTION_CONFIG is already the pattern for it. Until then they can
   ship on TTS — the slot takes either, and `line.audio` is the only field that
   changes.

   TWO TRAPS BEFORE YOU WIRE IT:
     • SitePalFeed installs GLOBAL `window.vh_*` callbacks and a fixed DOM id.
       On `?flat=1` this surface renders OVER the live temple, which owns those
       same globals — so mounting it there will fight CyborgTempleScene. The CRT
       path (MobileTerminalGame) has no temple running and is safe.
     • Audio has to start inside a real gesture, and the press beat fires from a
       promise chain. SitePalFeed is tap-to-replay for exactly this reason.
   ──────────────────────────────────────────────────────────────────────────── */

const CSS = `
.pf-feed { position:relative; height:100%; aspect-ratio:1/1; flex:none;
  border:1px solid rgba(47,214,214,0.35); background:#020f0d; overflow:hidden;
  box-shadow:0 0 0 1px rgba(0,0,0,0.5) inset; transition:box-shadow .25s ease, border-color .35s ease; }
/* THE BORDER IS THE MOOD RING, and it is the same ring pressUi puts down the
   left edge of the claim (.pu-claim[data-mood]) with the same four colours —
   the panel and the words under it are reading one number, so they had better
   look like it. Cool pink while it is comfortable, cyan when you check it and
   it holds up, amber then red as the room turns. */
.pf-feed[data-band="cool"]     { border-color:rgba(255,95,158,0.45); }
.pf-feed[data-band="backed"]   { border-color:rgba(47,214,214,0.55); }
.pf-feed[data-band="rattled"]  { border-color:rgba(255,210,58,0.6); }
.pf-feed[data-band="cornered"] { border-color:rgba(255,45,45,0.7); }
.pf-feed.live { box-shadow:0 0 22px rgba(47,214,214,0.22), 0 0 0 1px rgba(0,0,0,0.5) inset; }
.pf-feed-inner { position:absolute; inset:0; }
.pf-reg { position:absolute; inset:0; }
/* The live rig's canvas host. Stays in the tree while the camera is on an
   analyst — see the note by the element — and its own loop idles because
   display:none takes offsetParent to null. */
.pf-live { position:absolute; inset:0; }
.pf-frame { position:absolute; inset:0; width:100%; height:100%; object-fit:cover;
  pointer-events:none; will-change:transform; }
/* THE DRAWN MOUTH. Fades with the voice so the portrait keeps its own face at
   rest — the plate is a patch over baked-in art, and a patch parked on an idle
   character is just a smudge. */
.pf-mouth { position:absolute; transform:translate(-50%,-50%); z-index:2;
  display:flex; align-items:center; justify-content:center; overflow:hidden;
  opacity:0; transition:opacity .14s ease; pointer-events:none; }
.pf-feed.live .pf-mouth { opacity:1; }
.pf-mouth i { display:block; width:82%; border-radius:44%;
  background:linear-gradient(180deg,#ffffff,#bdfff6);
  box-shadow:0 0 7px rgba(140,255,244,0.75);
  transform:scaleY(0.14); transform-origin:50% 50%; }
/* The portrait failed to load. Its NAME, never a borrowed face — see desk.js on
   why a stand-in headshot is not an acceptable fallback for this character. */
.pf-feed-nosig { position:absolute; inset:0; display:flex; flex-direction:column;
  align-items:center; justify-content:center; gap:5px;
  background:repeating-linear-gradient(135deg,#04100e 0 6px,#061613 6px 12px); }
.pf-feed-nosig b { color:#2fd6d6; font:bold 11px/1 'Courier New',monospace; letter-spacing:0.14em; }
.pf-feed-nosig span { color:rgba(234,255,249,0.45); font:9px/1 'Courier New',monospace; letter-spacing:0.12em; }
/* Lit by the voice. opacity only — see the note by the element. */
.pf-scan { position:absolute; inset:0; pointer-events:none; z-index:4;
  background:repeating-linear-gradient(180deg, rgba(0,0,0,0.22) 0 1px, transparent 1px 3px); }
/* A carrier that never stops, so a silent character still reads as a live
   projection rather than as a photograph of one. */
.pf-sweep { position:absolute; left:0; right:0; height:34%; z-index:4;
  pointer-events:none; opacity:0.5;
  background:linear-gradient(180deg, transparent, rgba(140,255,244,0.10), transparent);
  animation:pfSweep 5.5s linear infinite; }
@keyframes pfSweep { from { top:-34%; } to { top:100%; } }
.pf-lamp { position:absolute; top:7px; right:9px; z-index:5;
  font:bold 9px/1 'Courier New', monospace; letter-spacing:0.12em;
  color:rgba(191,238,222,0.55); }
.pf-feed.live .pf-lamp { color:#ff2d6f; text-shadow:0 0 9px rgba(255,45,111,0.75); }
/* CLEAR OF THE METER, which owns the bottom strip. */
.pf-cap { position:absolute; left:9px; bottom:18px; z-index:5;
  padding:2px 5px; background:rgba(2,10,9,0.55);
  font:bold 8.5px/1 'Courier New', monospace; letter-spacing:0.12em;
  color:rgba(234,255,249,0.7); }
/* TALL ENOUGH TO READ AS A LEVEL. At 7px the carrier came out under a pixel and
   even a loud syllable was three, so the row was doing its job arithmetically
   and none of it visually. */
.pf-feed:not(.live) @media (prefers-reduced-motion:reduce) {
  .pf-sweep { animation:none; opacity:0.22; top:33%; }
  }
`;
