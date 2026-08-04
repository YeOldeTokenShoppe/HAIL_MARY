"use client";
import React, { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { adviserMouth } from "@/lib/adviserMouth";
import { PITCHER } from "@/game/terminal-traders/press/questions";
import { seatMeta } from "@/game/terminal-traders/press/desk";
import { VIRGIL } from "@/game/terminal-traders/press/virgil";
import { VIRGIL_PORTAL_ID } from "@/lib/trade/virgilVoice";
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

/** How many bars in the level meter. Cheap: one style write each per frame. */
const BARS = 14;

/**
 * THE CARRIER — the floor the meter idles at while the lamp says ON AIR.
 *
 * NOT A FAKE LEVEL, and the distinction is the reason the number is this small:
 * real speech runs three to six times higher, so the carrier can never be
 * mistaken for it, and ONLY THE METER gets it. The glow, the swell and the mouth
 * stay honest to the amplitude — those are the panel saying "it is talking", and
 * the meter is the panel saying "the line is open".
 *
 * IT EXISTS BECAUSE THE VOICE IS ALLOWED TO FAIL. speakAdviserLine returns false
 * on any non-200 from /api/counsel-voice — no key configured, a rate limit, an
 * offline phone — and the game deliberately plays on regardless (voice is
 * enrichment, never a gate). Without a floor that failure renders as ON AIR over
 * a row of dead bars, which reads as a broken panel rather than as a quiet one.
 */
const CARRIER = 0.13;

/** Where the bars sit when nothing is on the line. Must match .pf-meter i. */
const BARS_REST = "scaleY(0.06)";

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
}) {
  const imgRef = useRef(null);
  const glowRef = useRef(null);
  const barsRef = useRef([]);
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
      // NO DRAWN MOUTH FOR A SEAT — see the note at the top of the file. This is
      // the SitePal slot, not a gap.
      mouth: null,
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
      el.style.borderRadius = `${m.r}%`;
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
        + `r: ${m.r}, plate: "${m.plate}" },`);
    };
    console.log("[botMouth] tuner ready — Shift+B to arm, arrows move, [ ] width, - = height, , . openness");
    window.addEventListener("keydown", onKey);
    return () => { window.removeEventListener("keydown", onKey); };
  }, [cast]);

  useEffect(() => {
    if (!speaking) return;
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

      if (glowRef.current) glowRef.current.style.opacity = String(open ? 0.25 + lvl * 0.75 : 0);
      // A breath, not a bounce. Anything past a couple of percent stops reading
      // as a signal fluctuating and starts reading as the image being animated.
      if (imgRef.current) {
        imgRef.current.style.transform = `scale(${cast.frame.scale * (1 + lvl * 0.022)})`;
      }
      // THE MOUTH. Continuous rather than the three discrete states desktop
      // uses: those exist because a mesh swap has nothing between Closed and
      // Mid, and a drawn bar does. No hysteresis needed for the same reason —
      // there is no threshold to sit on and strobe across.
      if (ledRef.current) {
        const o = Math.min(1, Math.max(0, (lvl - OPEN_AT) / openSpan));
        ledRef.current.style.transform = `scaleY(${0.14 + o * 0.86})`;
      }
      // The meter is the panel's "line is open" readout, so it gets the detail:
      // each bar rides the same level through its own slow oscillator, which
      // turns one scalar into something that looks like speech rather than like
      // fourteen copies of one number. performance.now() rather than a stored
      // phase so a dropped frame cannot drift the row out of step.
      const t = performance.now() / 1000;
      for (let i = 0; i < barsRef.current.length; i++) {
        const el = barsRef.current[i];
        if (!el) continue;
        const wob = 0.62 + 0.38 * Math.sin(t * (5.5 + i * 0.47) + i * 1.7);
        el.style.transform = `scaleY(${Math.max(CARRIER, lvl) * wob})`;
      }
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => {
      cancelAnimationFrame(raf);
      // Never leave the panel lit, swollen or mid-word after the voice stops.
      if (glowRef.current) glowRef.current.style.opacity = "0";
      if (imgRef.current) imgRef.current.style.transform = rest;
      if (ledRef.current) ledRef.current.style.transform = "scaleY(0.14)";
      barsRef.current.forEach((el) => { if (el) el.style.transform = BARS_REST; });
    };
  }, [speaking, cast, rest]);

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
        {isVirgil ? null : showStage ? null : artBroken || !cast.src ? (
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
              ref={imgRef}
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
                             height: `${m.h}%`, borderRadius: `${m.r}%`,
                             background: m.plate }}>
                <i ref={ledRef} style={{ height: `${(m.open / m.h) * 100}%` }} />
              </span>
            )}
          </div>
        )}
        {/* The projection brightening as it speaks. A separate element so the
            per-frame write is an opacity on a compositor layer and never
            touches the image's own paint — a `filter` mutated beside an animated
            subtree computes and never paints on iOS Safari. */}
        <span className="pf-glow" ref={glowRef} />
        <span className="pf-scan" />
        <span className="pf-sweep" />
      </div>
      <span className="pf-lamp">{speaking ? "● ON AIR" : "○ STANDBY"}</span>
      <span className="pf-cap">{cast.name} · LIVE</span>
      <span className="pf-meter">
        {Array.from({ length: BARS }, (_, i) => (
          <i key={i} ref={(el) => { barsRef.current[i] = el; }} />
        ))}
      </span>
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
.pf-glow { position:absolute; inset:0; z-index:3; opacity:0; pointer-events:none;
  background:radial-gradient(ellipse at 50% 42%, rgba(140,255,244,0.30), transparent 62%);
  mix-blend-mode:screen; }
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
.pf-meter { position:absolute; left:0; right:0; bottom:0; z-index:5; height:13px;
  display:flex; align-items:flex-end; gap:2px; padding:0 8px 2px;
  background:linear-gradient(0deg, rgba(2,10,9,0.62), transparent);
  pointer-events:none; }
.pf-meter i { flex:1; height:100%; transform:scaleY(0.06); transform-origin:50% 100%;
  background:linear-gradient(180deg,#8cfff4,#2fd6d6); opacity:0.85;
  transition:transform .05s linear; }
.pf-feed:not(.live) .pf-meter i { opacity:0.22; }
@media (prefers-reduced-motion:reduce) {
  .pf-sweep { animation:none; opacity:0.22; top:33%; }
  .pf-meter i { transition:none; }
}
`;
