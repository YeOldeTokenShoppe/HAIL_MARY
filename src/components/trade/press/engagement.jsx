"use client";
import React from "react";
import gsap from "gsap";
import { playSfx } from "@/lib/uiSfx";
import { PITCH_BOT } from "@/game/terminal-traders/press/desk";

// THE ARRIVAL — the opening beat, shared by both press surfaces.
//
// REPLACES arrival.jsx's ENIGMA CONSOLE (2026-07-29), which was the fifth object
// to be designed for this slot and cut from it: cards -> dice -> wheel -> dual
// wheel -> cipher machine. The console was rescued once, on the argument that it
// CHOOSES NOTHING and is only the channel Our Lady's instruction arrives on. That
// answered the charge that killed the dice (a VC meeting has no randomiser in it)
// and left the other one standing:
//
//   A VC MEETING HAS NO CIPHER MACHINE IN IT EITHER.
//
// The tell that it was never resolved is the shape of the fix. "Not a museum
// piece", "one low strip", "a hero-sized console advertises a cryptography game" —
// the prop was shrunk to keep it from being noticed, which left a beat too small
// to carry the moment it exists for and 40% of the briefing column empty. And the
// fiction had a hole a player finds in one question: a cipher implies an
// interceptor, there isn't one, and Our Lady encoding a memo to her own desk is
// ceremony with nothing at stake. The real reason the name is withheld is that the
// meeting hasn't started. That is an appointment, not a cryptogram.
//
// WHAT THIS IS INSTEAD. The fifth object is PAPERWORK: the agent's engagement
// record. The beat the player watches is not a decode, it is an unassigned agent
// being RETAINED BY A CLIENT — and the four tests this slot has failed five times
// all pass:
//
//   DIEGETIC        agents get retained; meetings have engagement letters.
//   CHOOSES NOTHING the client engaged the agent upstairs. The record LANDS
//                   already signed. Our Lady is still the one who picked.
//   INVARIANT 7     stronger than the cipher's version, not weaker: the name is
//                   blank because the engagement isn't signed yet, which is an
//                   honest reason where "it's encrypted" was a pretextual one.
//   TEACHES         the shield wakes here, so the first thing the player learns
//                   is that the bot's face is a READOUT. pressure() drives it for
//                   the next four minutes. The console taught nothing that ever
//                   came back.
//
// AND IT STAGES THE COMMISSION, which VC_GAME.md §1.2 calls load-bearing rather
// than colour and which was, until now, one sentence of body copy. As a term on a
// record that lands before a word is spoken, "PAID ONLY IF YOU FUND IT" is
// evidence the player watched arrive. `[A§13]` says copy cannot fix a mechanic
// mismatch; the converse is this beat — staging does what copy couldn't.
//
// THE ABSENCE IS NOT THE SUBJECT, and the first build of this record got that
// wrong (author, 2026-07-29: *"i don't like drawing attention to the missing
// nature of the client - no need to point that out. Treat it as a normal way of
// doing business - ai agents are everywhere - we're in the near future."*).
//
// It had shipped an empty dashed frame with a question mark in it, captioned NO
// CLIENT, stamped DID NOT ATTEND. Three separate elements narrating one absence,
// on a record whose whole job is to make representation look routine. `[A§17]`
// says the founder's absence "needs no explaining and is itself faintly damning"
// — and the operative word is NEEDS NO EXPLAINING. A UI that points at it three
// times is explaining it, which converts a quiet structural fact into a
// complaint the interface is making on the player's behalf.
//
// So: ONE party on the record, the bot, because that is the only party a document
// of this kind would carry a face for. The client is a NAME ON A LINE, which is
// how a client appears on every engagement letter ever written. Nothing anywhere
// says the client is not here. The commission still does the damning, and it does
// it on evidence rather than on tone.
//
// ONE WORD IS LOAD-BEARING AND IT IS "RETAINED". Not "ASSIGNED": assignment is the
// house acting on screen, which is the randomiser returning in a sixth costume and
// must be cut on sight (see §1, and `[A§13]` for the five precedents). The client
// acted, upstairs, before you got here. You are watching the paperwork, not a draw.
//
// WHAT SURVIVED THE SWAP, because it is a rule and not decoration: the deal sheet
// writes itself in only AFTER the name resolves. Invariant 7 — nothing names the
// deal before it exists — was enforced by the dice timeline, then by the decode,
// and is enforced here by the signature. Do not overlap them.

/* THE ARRIVAL MAKES EXACTLY TWO SOUNDS, AND THEY ARE DIFFERENT ACTIONS.
 * The beat is a form being filled in, so the audio is the two things that
 * physically happen to a piece of paper:
 *
 *   SIGN  — a pen writing the client's name onto the REPRESENTING line. Paper
 *           texture, a short scratchy stroke, no impact. It runs UNDER the
 *           typing, so it wants to be about TYPE long (0.62s) and to end
 *           rather than ring out; a tail still sounding when the stamp lands
 *           muddies the one percussive moment in the beat.
 *   STAMP  — the rubber stamp hitting the page. One percussive thud with a
 *           little wood in it, ~STAMP long (0.34s), landing with the scale
 *           snap. This is record_stamp.mp3 and it was always right.
 *
 * BOTH KEYS POINTED AT record_stamp.mp3, which is worse than a duplicate: it
 * fired the STAMP IMPACT at t=0, before anything had been written, let alone
 * stamped — and then fired the same impact again 0.72s later when the stamp
 * actually landed. The beat played its punchline first and then repeated it.
 *
 * record_sign.mp3 IS NOT IN public/audio YET, and this is deliberately pointed
 * at it anyway: playSfx no-ops safely on a missing file (uiSfx caches the
 * failed fetch and the element fallback swallows the rest), so the signature
 * beat is SILENT until the asset lands and then lights up by itself. Silence
 * is the correct placeholder here — a stamp thud over a pen stroke is the
 * interface describing something that is not on screen.
 */
export const SFX = {
  sign: "/audio/record_sign.mp3",
  stamp: "/audio/record_stamp.mp3",
};

export function prefersReducedMotion() {
  if (typeof window === "undefined") return false;
  return !!window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
}

/* THE TERM LEFT THE PAPERWORK (author, 2026-08-03: the bot "shouldn't get
   paid" on the record — the brief is about the deal, not the courier). The
   commission itself is untouched canon: the bot discloses it out loud in its
   pitch opening (PITCH_OPENING in desk.js) and the briefing's directive
   states it — the places an incentive actually confronts the player. The
   shield-wake beat went with the portrait; the face's introduction now
   belongs to the floor, where pressure() drives it. */

const TYPE = 0.62;    // the client's name going onto the line
const STAMP = 0.34;   // the stamps landing
const REVEAL = 0.42;  // the dossier

/* THE FILE NUMBER IS THE DESK'S CASELOAD — a persistent local counter, never a
   roll. A random number was cut the day it shipped (author: "does it make
   sense to have a deal number?"): information-shaped, meant nothing, never
   returned. This one means exactly one thing — how many files this desk has
   opened — so replaying shows 001 become 002 and the stationery is honest.

   THE INDEPENDENCE RULE HOLDS BY CONSTRUCTION (VC_GAME.md §1.6's terms): the
   counter derives from nothing but itself, so the number printed on the folder
   is structurally unable to see the deal, the archetype, or the branch.

   PEEK AT REST, COMMIT ON OPEN. The tab shows the number the file WILL be
   (peek); the counter advances only when the file is actually opened —
   commit() is an INCREMENT, and the call sites hold a per-sitting ref so one
   sitting commits exactly once (runRoll's rolling/rolled guard is React state
   and can double-pass in one batch; a ref can't). Leave without opening and
   the next sitting shows the same number, which is what an unopened file
   does. Two tabs open at once may DISPLAY the same peeked number — accepted:
   the display is stationery, the stored count still advances once per actual
   open, and a cross-tab resync would buy cosmetics with a storage listener.

   EVERY STORAGE TOUCH IS GUARDED. Reading window.localStorage THROWS under
   Safari's Block All Cookies / cookie-blocked Chrome / sandboxed iframes, and
   peek runs inside a useState initializer — an unguarded read there
   white-screens the whole surface for those users. Denied storage degrades to
   a caseload of zero: every sitting reads NO. 001, nothing crashes. */
const FILE_NO_KEY = "trade_deal_file_no";

function readStoredFileNo() {
  try {
    const n = parseInt(window.localStorage.getItem(FILE_NO_KEY), 10);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  } catch { return 0; }
}

export function peekFileNo() {
  if (typeof window === "undefined") return 1;
  return readStoredFileNo() + 1;
}

export function commitFileNo() {
  if (typeof window === "undefined") return;
  try { window.localStorage.setItem(FILE_NO_KEY, String(readStoredFileNo() + 1)); } catch {}
}

/** 001-style padding until the caseload earns a fourth digit. */
export function fmtFileNo(n) {
  return String(n ?? 1).padStart(3, "0");
}

/* THE PAPERCLIP — a real gem clip, not an outlined box.
 *
 * The old version was one rounded rect with a border, which at 17px reads as a
 * ring, not a clip: no inner return loop, square-ended, and lit flat. This is
 * the actual wire topology in ONE continuous stroke — long outer U, up the left
 * rail, over the top hook, down and around the shorter inner U, ending in a free
 * tip tucked under the hook — so the eye gets the two nested loops that say
 * "paperclip" at any size.
 *
 * SVG rather than the CSS-pseudo-element build (three nested border-radius boxes
 * with `groove` borders): at this scale the wire is ~1.2px, and a groove border
 * degenerates to mush below ~2px while border-radius corners can't make a
 * continuous stroke. A stroked path gets round caps, true arcs, and stays crisp.
 *
 * GEOMETRY IS LOAD-BEARING. The 42px height and the -11px top are what put the
 * hook ~21px above .eng-cover's border box, and that polygon only clears 28px —
 * see the clip-path note there before raising either number.
 */
const COVER_CLIP_WIRE =
  "M 37 -12 L 37 70 A 17 17 0 0 1 3 70 L 3 -16 " +
  "A 13.5 13.5 0 0 1 30 -16 L 30 42 A 10.5 10.5 0 0 1 9 42 L 9 -18";

/* Three passes on the same path make the wire cylindrical: a mid-tone body, a
 * dark edge nudged one way and a specular nudged the other. Both offsets stay
 * inside the body's half-width (1.6), so they shade the wire instead of
 * doubling it. No gradient — a <defs> id would collide if the record ever
 * mounts twice, and offset strokes read as rounder metal anyway. */
function CoverClip() {
  return (
    <svg
      className="eng-cover-clip"
      viewBox="-1.8 -32 43.6 122"
      aria-hidden="true"
      focusable="false"
      shapeRendering="geometricPrecision"
    >
      <g fill="none" strokeLinecap="round">
        <path d={COVER_CLIP_WIRE} stroke="#8fa39e" strokeWidth="3.2" />
        <path
          d={COVER_CLIP_WIRE}
          stroke="rgba(3,15,13,.5)"
          strokeWidth="1"
          transform="translate(0.8 0.35)"
        />
        <path
          d={COVER_CLIP_WIRE}
          stroke="rgba(242,251,248,.85)"
          strokeWidth="1.1"
          transform="translate(-0.75 -0.3)"
        />
      </g>
    </svg>
  );
}

/**
 * THE RECORD — what sits where the console, and the dice tray before it, used to.
 *
 * Deliberately NOT a button and deliberately not a randomiser: it is a form that
 * arrives filled in. At rest it is
 * a BLANK FORM, which is the whole reason this shape works where the console's
 * did — a blank form is not an empty box, it is a box that tells you what is about
 * to be written in it.
 *
 * `arrived` MUST BE WIRED TO THE SETTLE AND NOT TO THE END OF THE TIMELINE. Both
 * surfaces carry two flags — `settled` (the client is named, mid-timeline) and
 * `rolled` (the timeline is done) — and passing the second one shipped a record
 * that read UNASSIGNED for half a second while its own RETAINED stamp was already
 * on it, because the stamps are tweened and the status is rendered. Pass
 * `identity`. Everything the class controls (the status, the frame glow, THE
 * CLIENT, the term) then lands on the same instant as the stamps.
 */
export const EngagementRecord = React.forwardRef(function EngagementRecord(
  { arrived = false, client = null, surface = null, ticker = null, chain = null,
    // WHAT THE PROSPECT ACTUALLY IS. New 2026-08-04 — the record carried six
    // market numbers and never said what the business was, so a player signed a
    // deal sheet for a ticker and a market cap. Public surface data like every
    // other field here, and rolled blind of archetype and branch (identities.js).
    sector = null,
    clientRef = null, particularsRef = null,
    stampRetainedRef = null, coverRef = null,
    fileNo = null,
    title = "Engagement Record",
    restStatus = "AVAILABLE", arrivedStatus = "RETAINED",
    stampLabel = "Retained" }, ref) {
  const record = (
    <div className={`eng${arrived ? " in" : ""}`} ref={ref}>
      <div className="eng-head">
        <span className="eng-title">{title}</span>
        {/* THE ONE STATUS LABEL. The console shipped alongside four others —
            NOT IN YET, AWAITING TRAFFIC, the block glyphs, "still coded" and
            NOTHING ON THE TABLE YET, all on screen together, which reads as a
            surface that has hung rather than one that is waiting. Anything that
            wants to say "not yet" on this panel says it here or not at all. */}
        <span className="eng-status">{arrived ? arrivedStatus : restStatus}</span>
      </div>

      {/* TWO COLUMNS, ONE PROJECT DOCUMENT: the name, and the particulars.

          THE AGENT BLOCK IS GONE (author, 2026-08-03: "the pitchbot is just an
          agent, and shouldn't get paid either" / "don't show the pitchbot
          again"). The portrait, the idents, and the PAID // ONLY IF YOU FUND
          IT row all left the paperwork — the courier's photo is on the folder,
          and the commission is DISCLOSED BY THE BOT ITSELF in its pitch
          opening (PITCH_OPENING in desk.js) and stated in the briefing's
          directive copy, which are the two places an incentive actually
          confronts the player. The brief is about the deal.

          THE PARTICULARS USED TO BE A SECOND BOX (`.ps-sheet`) and the author
          caught it immediately: "the pitch project is in 2 separate boxes".
          With the stat rows visible from the start at ——, the blank form
          covers its own rest state and nothing needs cross-fading. See the
          note on `particulars` in runArrival. */}
      <div className="eng-body">
      <div className="eng-terms">
        <div className="eng-field">
          <span className="eng-label">REPRESENTING</span>
          {/* THE REVEAL LANDS HERE, and it is the largest type in the record
              because a name belongs on the file rather than in a paragraph beside
              it. The panel used to print it three times (top bar, headline, sheet
              header) and animate the copy, which put the ceremony on the prose
              and left the object watching.

              Two lines are reserved at all widths: LANTERN WORKS wraps and
              ALDERMAN doesn't, and a record that grows a line mid-signature
              shunts the dossier below it. */}
          <div className={`eng-client${client ? " named" : ""}`} ref={clientRef}>
            {client || "————"}
          </div>
        </div>
      </div>

        {/* THE PARTICULARS. Every field is public surface data and none of it
            correlates with the outcome — asserted in the suite, because the moment
            the listing leaks the answer the analysts stop mattering.

            THE ROWS ARE PRESENT FROM THE START, at ——, and that is what makes the
            blank form honest: invariant 7 forbids naming the deal early, not
            admitting that a deal has fields. The block sits dimmed until the
            record is signed and comes up to full with the values, so the reveal is
            the form being COMPLETED rather than a panel appearing. */}
        <div className="eng-particulars" ref={particularsRef}>
          <div className="eng-part-h">
            PROSPECT{ticker && chain ? ` · ${ticker} · ${chain}` : ""}
          </div>
          <dl className="eng-stats">
            <div className="eng-sector"><dt>WHAT IT IS</dt><dd>{sector ?? "——"}</dd></div>
            <div><dt>MCAP</dt><dd>{surface?.mcap ?? "——"}</dd></div>
            <div><dt>HOLDERS</dt><dd>{surface?.holders ?? "——"}</dd></div>
            <div><dt>AGE</dt><dd>{surface?.age ?? "——"}</dd></div>
            <div><dt>24H</dt><dd>{surface?.change24h ?? "——"}</dd></div>
            <div><dt>SOCIAL</dt><dd>{surface?.social ?? "——"}</dd></div>
          </dl>
        </div>
      </div>

      <span className="eng-stamp retained" ref={stampRetainedRef} aria-hidden={!arrived}>
        {stampLabel}
      </span>
    </div>
  );

  if (fileNo == null) return record;

  /* THE FOLDER IS THE WHOLE OBJECT (author, 2026-08-03: "let's stop and think
     of how we should show an outline of the proposal that makes sense
     visually"). There is no second document and no transition between two
     materials — the failure every previous attempt shared. Four openings died
     first (top hinge, book spine, bottom drop, slide-away) and then a dark
     sheet dropped onto the manila, which read as "a black semi-opaque
     background over the first version" for a reason no easing could fix: THE
     VALUE RELATIONSHIP WAS INVERTED. Paper is the bright thing on a dark desk;
     anything darker laid over lighter stock reads as a scrim, never an object.

     So the cover IS the form. Blank client line and stat rows sit on the
     manila from the first frame, the arrival types them in, and the stamp
     lands — which is this slot's oldest doctrine restated on paper: "a blank
     form is not an empty box, it is a box that tells you what is about to be
     written in it." Invariant 7 is unchanged: the fields exist at ————, and
     admitting a deal HAS fields is not naming one. */
  return (
    <div className={`eng-file${arrived ? " in" : ""}`} ref={ref}>
      <div className="eng-file-back" aria-hidden="true" />
      <div className="eng-cover" ref={coverRef}>
        {/* PROSPECTUS (author, 2026-08-03): the sheet names the DOCUMENT, not
            the desk's process, and it is what a deal arrives as in this world.
            Generic to every deal, so invariant 7 is untouched. */}
        <div className="eng-cover-letter" aria-hidden="true">PROSPECTUS<i /></div>

        {/* THE AGENT'S ONE APPEARANCE (author: "leave the polaroid of the
            pitchbot, but then don't show the pitchbot again"). The clipped
            photo is where the bot lives on paper; nothing else on the file
            carries its face, and no term pays it — the commission is disclosed
            aloud in the pitch opening and in the briefing's directive, which
            are the places an incentive actually confronts the player. */}
        <figure className="eng-cover-badge" aria-hidden="true">
          <CoverClip />
          <img src={PITCH_BOT.portrait} alt="" />
          {/* THE PLATE NUMBER, not a job description (author, 2026-08-03).
              ON COMMISSION was the third place the briefing stated the
              commission and the only one that couldn't argue it — the
              directive says it in a sentence and the bot says it out loud in
              its opening. What a photo caption on a file carries is WHICH
              MACHINE this is: per-rig data, rolled before the deal exists. */}
          <figcaption>
            <i>PRESENTED BY</i>PITCH BOT {PITCH_BOT.model}
          </figcaption>
        </figure>

        {/* RECEIVED IS A STAMP, NOT A LINE — the same fact in physical ink:
            the file was logged before you got here, which is CHOOSES NOTHING
            staged as an artifact rather than asserted as copy. NO SOURCE ON
            THE STAMP: the desk is a non-hierarchical org (author) — nothing
            arrives from anywhere above, it just arrives, already logged. */}
        <span className="eng-cover-received" aria-hidden="true">RECEIVED</span>

        {/* THE FORM. Cleared of the polaroid by its own right padding, never
            by a magic offset — the photo shrinks with the container and the
            padding tracks the same clamp. */}
        <div className="eng-form">
          <span className="eng-label">REPRESENTING</span>
          {/* THE REVEAL LANDS HERE, the largest type on the file, because a
              name belongs on the document rather than in a paragraph beside
              it. Two lines are reserved at all widths: LANTERN WORKS wraps and
              ALDERMAN doesn't, and a form that grows a line mid-signature
              shunts the particulars below it. */}
          <div className={`eng-client${client ? " named" : ""}`} ref={clientRef}>
            {client || "————"}
          </div>

          {/* THE PARTICULARS. Every field is public surface data and none of it
              correlates with the outcome — asserted in the suite, because the
              moment the listing leaks the answer the analysts stop mattering.
              Dimmed until the file is signed, then up to full WITH the values,
              so the reveal is the form being COMPLETED rather than a panel
              appearing. */}
          <div className="eng-particulars" ref={particularsRef}>
            <div className="eng-part-h">
              PROSPECT{ticker && chain ? ` · ${ticker} · ${chain}` : ""}
            </div>
            <dl className="eng-stats">
              <div className="eng-sector"><dt>WHAT IT IS</dt><dd>{sector ?? "——"}</dd></div>
              <div><dt>MCAP</dt><dd>{surface?.mcap ?? "——"}</dd></div>
              <div><dt>HOLDERS</dt><dd>{surface?.holders ?? "——"}</dd></div>
              <div><dt>AGE</dt><dd>{surface?.age ?? "——"}</dd></div>
              <div><dt>24H</dt><dd>{surface?.change24h ?? "——"}</dd></div>
              <div><dt>SOCIAL</dt><dd>{surface?.social ?? "——"}</dd></div>
            </dl>
          </div>
        </div>

        {/* Two routing lines, both affirmative process facts. STATUS is the
            file's one waiting line and the surface's one "not yet" — and it
            dies the frame the stamp lands, the same handover the status pill
            had, for the same reason: two statuses on one document is a
            surface that has hung. */}
        <div className="eng-cover-route">
          <span>VIA&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;// COMMISSIONED AGENT</span>
          <span className="eng-cover-wait">STATUS&nbsp;&nbsp;&nbsp;// AWAITING REVIEW</span>
        </div>

        {/* ONE STAMP, on the file itself. There is one document now, so there
            is one impression — the second (on the old dark record) went with
            the record. */}
        <span className="eng-cover-stamp" ref={stampRetainedRef} aria-hidden={!arrived}>
          {stampLabel}
        </span>
      </div>

      {/* THE FILE NUMBER IS REAL (author: "does it make sense to have a deal
          number?" / "if so, a real number?"). A random number was the 02
          glyph's failure with more digits — information-shaped, meant nothing,
          never returned. This is the desk's caseload: a persistent local
          counter (peekFileNo / commitFileNo), so replaying shows 001 become
          002 and the stationery is honest. */}
      <span className="eng-tab" aria-hidden="true">
        DEAL FILE // NO. {fmtFileNo(fileNo)}
      </span>
    </div>
  );
});

/**
 * Play the arrival.
 *
 * @param record       the EngagementRecord element
 * @param client       the client-name node (typed in place)
 * @param clientText   what it types TO
 * @param stampRetained RETAINED, on the record
 * @param particulars  the prospect block inside the record (dim -> full)
 * @param onSettled    () => void — signed; safe to name the deal
 * @param onDone       () => void — the record has finished filling in
 *
 * Returns the timeline, or null when there is nothing to animate — callers treat
 * null as "go straight to the arrived state" rather than stranding the player on
 * a button that does nothing. Measured at CLICK time, never at mount.
 *
 * THE SIGNATURE LANDS ON THE TRUTH AND STOPS THERE. Its final frame is exactly the
 * string React renders once `onSettled` flips `identity`, so the two agree and the
 * re-render changes nothing on screen — including the cursor, which must not be in
 * that frame. This is the contract the decode had with its ciphertext and the dice
 * had with their resting transform; break it and the name visibly rewrites itself
 * one frame after it finished.
 */
export function runArrival({
  record, client, clientText, stampRetained,
  particulars, onSettled, onDone,
}) {
  if (!record && !particulars && !client) return null;

  // LAG SMOOTHING OFF FOR THE DURATION, AND THIS SURFACE NEEDS IT MORE THAN MOST.
  // GSAP's default clamps any frame longer than 500ms to a 33ms step, which is the
  // right call for a scroll-linked effect and the wrong one here: this beat plays
  // over a live WebGL room that is still streaming glbs, so a few multi-second
  // frames stretched a 1.2s arrival into a fifteen-second crawl with the button
  // stuck reading SIGNING… (measured in dev, 2026-07-29). With it off, a stall
  // makes the timeline JUMP — the player may miss the choreography, but they land
  // in the right state, which is what skipRoll and the reduced-motion path already
  // do deliberately. Restored on completion; it is a global default either way.
  gsap.ticker.lagSmoothing(0);

  const tl = gsap.timeline({
    defaults: { force3D: true },
    onComplete: () => {
      gsap.ticker.lagSmoothing(500, 33);
      // Hand the elements back untransformed. A leftover inline transform keeps a
      // composited layer alive for the rest of the session — over a live WebGL
      // scene, on desktop. The lit/stamped end states are all held by `.eng.in`,
      // which is what makes clearing them safe.
      // transform TOO, even though nothing here tweens it: the timeline's
      // force3D default stamps translate3d(0,0,0) on every target, so an
      // opacity-only tween still leaves a promoted layer behind. Verified in the
      // DOM after a completed arrival, 2026-07-29.
      if (stampRetained) gsap.set(stampRetained, { clearProps: "opacity,transform,willChange" });
      onDone?.();
    },
  });

  /* A SKIPPED ARRIVAL IS SILENT, AND THE SKIP HAS TO SAY SO EXPLICITLY.
     skipArrival ends the beat with tl.progress(1), which does not suppress
     callbacks — it fires every cue it passes through in a single frame. State
     callbacks WANT that (onSettled has to run or the deal is never named);
     sound does not, because the pen and the stamp would land on one tick and
     read as a click rather than as two actions. Silence also matches the
     reduced-motion path, which builds no timeline and so has never made a
     sound, and it is the honest reading of the gesture: the player asked for
     the ceremony to stop.

     THE FLAG IS SET BY THE SKIP, NOT INFERRED FROM THE PLAYHEAD. Inferring it
     was the first attempt and it silenced normal playback: lagSmoothing is off
     for this timeline precisely because frames here can run into seconds over
     a still-streaming WebGL room, so "the playhead moved much further than one
     frame" is ALSO what an ordinary stall looks like. Measured — a full,
     unskipped arrival played no sound at all. A stall must still sound; only a
     skip must not, and only the skip knows which it is.

     A HARD ENOUGH STALL STILL STACKS THEM, and that is accepted rather than
     guarded. Measured over the live temple: the whole arrival resolved inside
     one frame and the two cues fired 1ms apart. No guard fixes that honestly
     — dropping the later cue keeps the pen over a stamped record, dropping the
     earlier one cannot be decided until the later one exists — and the smear
     only happens on a machine already dropping seconds. The bug that mattered
     was a stamp impact over a blank line, twice; this is two right sounds
     close together. */
  const sfxAt = (url, volume) => {
    if (tl.__skipped) return;
    playSfx(url, { volume });
  };

  // NO OPENING BEAT AND NO SECOND OBJECT (2026-08-03). The file's own fields
  // are what fill in, so the timeline is exactly what it was before the folder
  // existed: the name types onto the line, the stamp lands after it, the
  // particulars complete. Four openings and a dropped sheet died to get back
  // here — see the note on the folder in EngagementRecord for why.
  const lead = 0;

  // THE NAME GOES ONTO THE LINE — typed, not scrambled. A random-letter resolve
  // was the cipher's own effect and has no motive once the machine is gone; a name
  // appearing a character at a time is a form being filled in, which is what is
  // actually happening. Text only: no layout property is touched, so the 3D
  // underneath keeps its frames.
  if (client && clientText) {
    // THE PEN STARTS WHEN THE WRITING DOES. This used to fire at t=0, outside
    // the timeline — 100ms before the first character and, with the wrong
    // asset on it, a stamp impact over a blank line. Scheduled here it is
    // inside the same `if` as the typing, so a record with no name to write
    // makes no writing sound.
    tl.call(() => sfxAt(SFX.sign, 0.5), null, lead + 0.10);
    const t = { p: 0 };
    tl.to(t, {
      p: 1, duration: TYPE, ease: "none",
      onUpdate: () => {
        const n = Math.floor(t.p * clientText.length);
        client.textContent = clientText.slice(0, n) + (n < clientText.length ? "▍" : "");
      },
      onComplete: () => { client.textContent = clientText; },
    }, lead + 0.10);
  }

  const settledAt = lead + 0.10 + (client && clientText ? TYPE : 0);

  // THE THUD IS THE STAMP'S, so it is scheduled with the stamp's own +0.04
  // offset rather than on the frame the name finishes. It was 40ms early —
  // inaudible on its own, but it is the difference between the sound being
  // the impact and the sound being a cue that something is about to happen.
  tl.call(() => onSettled?.(), null, settledAt);
  if (stampRetained) {
    tl.call(() => sfxAt(SFX.stamp, 0.4), null, settledAt + 0.04);
  }

  // THE STAMP. After the name, never during — a record stamped before the client
  // is named is invariant 7 with a rubber stamp on it.
  if (stampRetained) {
    tl.fromTo(stampRetained,
      { opacity: 0, scale: 1.35, willChange: "transform" },
      { opacity: 1, scale: 1, duration: STAMP, ease: "back.out(2.2)" }, settledAt + 0.04);
  }

  // THE PARTICULARS COME UP AFTER THE CLIENT IS NAMED, never during. Overlapping
  // them would describe the deal before anyone had been retained to bring it,
  // which is invariant 7 and the one thing this beat must not do.
  //
  // FROM DIM TO FULL, not from nothing: the rows are already on screen at ——, so a
  // fade from 0 would blink the labels out and back. immediateRender:false for the
  // same reason it is on the term — a fromTo applies its from-state when the
  // timeline is BUILT, which would have dimmed the block a beat early.
  if (particulars) {
    tl.fromTo(particulars,
      { opacity: 0.45, y: 5 },
      { opacity: 1, y: 0, duration: REVEAL, ease: "power2.out",
        immediateRender: false, clearProps: "transform,opacity" },
      settledAt + 0.06);
  }

  return tl;
}

/**
 * Kill an arrival and put the ticker back — use this instead of tl.kill().
 *
 * runArrival turns lag smoothing off and restores it in onComplete, and a kill is
 * the one path that never reaches onComplete. Leaving it off page-wide is not a
 * visual bug, which is exactly why it would have survived unnoticed: it changes
 * only how every OTHER animation on this page handles a >500ms frame. Both
 * surfaces unmount-kill, so the pairing lives here rather than in each of them.
 */
export function endArrival(tl) {
  tl?.kill();
  gsap.ticker.lagSmoothing(500, 33);
}

/**
 * COMPLETE THE ARRIVAL NOW — the player tapped through it.
 *
 * This is `tl.progress(1)` with one thing added, and it exists so that one
 * thing lives next to the timeline that depends on it. progress(1) fires every
 * callback it passes over, which is REQUIRED here (onSettled names the deal,
 * onComplete clears the transforms) and wrong for the two sounds, which would
 * land stacked on a single tick. The flag is what tells the cues that their
 * moment was jumped rather than played; nothing else can tell, because a
 * stalled frame moves the playhead exactly the same way — see sfxAt.
 *
 * Callers used to inline progress(1). Reaching for it directly still works and
 * still lands in the right state; it just makes the noise this suppresses.
 */
export function skipArrival(tl) {
  if (!tl) return;
  tl.__skipped = true;
  tl.progress(1);
}

export const ENGAGEMENT_CSS = `
/* THE ENGAGEMENT RECORD. Paperwork, not a machine — see the header of
   engagement.jsx for the five props that came before it and why this one is a
   form. Inherits the surface's monospace on purpose: the console set its own
   ui-monospace and read as a component borrowed from somewhere else. */
.eng{
  position:relative;
  border:1px solid rgba(47,214,214,.28);
  border-left:2px solid rgba(255,95,158,.5);
  background:
    linear-gradient(180deg, rgba(9,28,26,.78), rgba(2,14,13,.78));
  padding:0 0 13px;
  transition:border-color .45s ease, box-shadow .45s ease;
}
.eng.in{
  border-color:rgba(47,214,214,.5);
  border-left-color:#ff5f9e;
  box-shadow:0 0 22px -6px rgba(47,214,214,.35);
}

.eng-head{
  display:flex; align-items:baseline; gap:8px;
  padding:7px 10px 6px;
  border-bottom:1px solid rgba(47,214,214,.2);
}
/* The one display face on the panel, and it is here because a record has a
   letterhead. The room owns a blackletter logo 200px away and the briefing was
   four sizes of one monospace. */
.eng-title{
  font-family:'Bebas Neue', Impact, sans-serif;
  font-size:15px; line-height:1; letter-spacing:.09em;
  color:#eafff9;
}
.eng-status{
  margin-left:auto; flex:none; white-space:nowrap;
  font-size:7.5px; font-weight:bold; letter-spacing:.2em;
  color:rgba(234,255,249,.42);
  border:1px solid rgba(234,255,249,.18); border-radius:999px;
  padding:.2em .5em;
}


/* ONE PORTRAIT, BESIDE ITS OWN IDENTITY BLOCK. This was two centred frames in a
   row while the second one stood for the client; with that gone, a lone centred
   square looked like a placeholder for something missing — which is the exact
   reading the change was made to remove. Left-aligned next to its caption it
   reads as a headshot on a file. */
/* THREE COLUMNS ON A WIDE RECORD, STACKED ON A NARROW ONE. flex-wrap does the
   whole job: the flat surface's column gets down to ~266px and each part has a
   basis it can't be squeezed under, so they drop one by one instead of crushing.
   No media query — the record is used at 756px and at 246px by two different
   surfaces and should not have to be told which. */
.eng-body{ display:flex; flex-wrap:wrap; gap:13px 22px; padding:12px 11px 0; }
.eng-parties{ flex:none; display:flex; align-items:center; gap:11px; }
.eng-frame{
  position:relative; flex:none; width:78px; aspect-ratio:1;
  border:1px solid rgba(47,214,214,.3); background:#020f0d;
  overflow:hidden;
  transition:border-color .45s ease, box-shadow .45s ease;
}
.eng.in .eng-frame{
  border-color:rgba(127,232,232,.6);
  box-shadow:0 0 14px -2px rgba(127,232,232,.45), inset 0 0 12px -4px rgba(127,232,232,.5);
}
.eng-pic{ width:100%; height:100%; object-fit:cover; display:block; opacity:.26; }
.eng.in .eng-pic{ opacity:1; }
.eng-idents{ min-width:0; display:flex; flex-direction:column; gap:3px; }
.eng-who{ font-size:9.5px; font-weight:bold; letter-spacing:.13em;
  color:rgba(234,255,249,.9); }
.eng-role{ font-size:7.5px; letter-spacing:.13em; color:rgba(255,210,58,.65); }

/* THE STAMP. Bebas, boxed and rotated — a rubber stamp reads as one from its
   weight and its angle, so this needs no new font file. Held at 0 by CSS and
   handed back to CSS at 1, which is what lets the timeline clearProps it. */
.eng-stamp{
  font-family:'Bebas Neue', Impact, sans-serif;
  letter-spacing:.06em; line-height:.98; text-transform:uppercase;
  border:1.5px solid currentColor; border-radius:2px;
  padding:2px 4px; opacity:0; pointer-events:none;
}
/* TOP-RIGHT, ACROSS THE HEADER, which is where a stamp goes on a form and — the
   reason it moved off the bottom — is not where the terms are. At the foot it
   overlapped "ONLY IF YOU FUND IT", and reserving 94px for it wrapped the term
   onto two lines with an orphaned "IT". It also lets the stamp BE the status: the
   pill fades as the stamp lands, so the record never carries two of them.
   NEGATIVE top since the folder: the stamp straddles the record's top edge into
   the tab band, so it reads as hitting the open FILE rather than just the sheet —
   one actioned document, not a sheet in a wrapper. z-index above tab and cover. */
.eng-stamp.retained{
  position:absolute; right:8px; top:-9px; z-index:7;
  transform:rotate(-7deg);
  font-size:16px; color:#8fe6c4; background:rgba(2,14,13,.72);
}
.eng.in .eng-stamp.retained{ opacity:1; }
/* The pill is the rest state's status and the stamp is the arrived one. NO
   TRANSITION ON THE HANDOVER, deliberately: the stamp scaling in is the motion at
   that instant, and a 300ms fade on the pill only creates a window where the
   record shows two statuses. It also removed a dependency on frames arriving — a
   CSS transition does not advance without them, and this beat plays over a WebGL
   room that can stall (see the lag-smoothing note in runArrival). */
.eng.in .eng-status{ opacity:0; }

.eng-terms{ flex:1 1 170px; min-width:0; }
.eng-field + .eng-field{ margin-top:10px; }
.eng-field.row{ display:flex; align-items:baseline; gap:8px; }
.eng-label{ flex:none; font-size:7.5px; font-weight:bold; letter-spacing:.2em;
  color:#ff5f9e; }
.eng-value{ font-size:10px; letter-spacing:.06em; color:#ffd23a;
  overflow-wrap:anywhere; }
/* Two lines reserved at every width — see the note at the render site. */
.eng-client{
  margin-top:4px; min-height:2.3em;
  font-size:17px; font-weight:bold; letter-spacing:.02em; line-height:1.15;
  color:rgba(234,255,249,.28);
  overflow-wrap:anywhere;
}
.eng-client.named{ color:#eafff9; }

/* THE PARTICULARS — the third column, and the reason there is only one box. Dimmed
   until signed; the timeline brings it to full and hands the end state back here. */
.eng-particulars{ flex:1 1 215px; min-width:0; opacity:.45; }
.eng.in .eng-particulars{ opacity:1; }
.eng-part-h{ font-size:7.5px; font-weight:bold; letter-spacing:.2em; color:#ff5f9e;
  padding-bottom:7px; border-bottom:1px solid rgba(47,214,214,.18); }
.eng-stats{ margin:8px 0 0; display:flex; flex-direction:column; gap:3px; }
.eng-stats > div{ display:flex; align-items:baseline; gap:9px; }
/* 74px, not 60: "WHAT IT IS" is a longer label than the five market fields and
   the column has to stay aligned, so every dt widens rather than that one row
   hanging out of the stack. */
.eng-stats dt{ flex:none; width:74px; font-size:8.5px; letter-spacing:.13em;
  color:rgba(234,255,249,.45); }
.eng-stats dd{ margin:0; font-size:11px; font-weight:bold; color:#eafff9; }
/* The premise is a phrase, not a metric — normal weight so it doesn't read as
   another number, and it leads the block because it is what the rest describes. */
.eng-stats .eng-sector dd{ font-weight:normal; }

/* THE DEAL FILE — the closed cover over the record: MANILA on purpose (author,
   2026-08-03), the one warm paper object on a teal terminal, wearing the same
   corner-cut and hairline vocabulary as the instruments around it. Dark inks
   only — bright terminal colors vanish on this stock (see the tab-label and
   STATUS-line notes). A composed surface, not a crowded one; the fix for a
   weak rest state is one object with mass, not more elements. The cover is
   absolutely inset over the record so it inherits the record's footprint at
   every width — a tall portrait folder on a 266px phone, which is what folders
   are — and the blank form beneath locks the height: zero layout shift on open. */
/* pointer-events:none ON BOTH FOLDER ELEMENTS IS LOAD-BEARING, not hygiene: on
   the desktop surface .ps-skip-deal is a sibling overlay at the same z-band and
   must stay clickable through the whole arrival — the sealed overlay this cover
   replaced carried the same property for the same reason. The flat surface's
   skip lives on an ancestor and only works because clicks pass through here. */
.eng-cover{
  /* IN FLOW, not absolute: with the record gone the cover is the only thing
     that can give the file its height. The back panel sits absolute behind
     it, so the wrapper's padding still shows as the folder's rim. */
  position:relative; z-index:5; pointer-events:none;
  padding:16px 16px 46px; min-height:150px;
  /* MANILA, FOR REAL (author, 2026-08-03: "beige manila color") — noir manila:
     desaturated a step and scanlit so it sits in the dark room instead of
     glowing out of it. The one warm paper object on a teal terminal; every ink
     on it goes dark, like print. The pink spine stays — the record's own left
     rule, worn by the folder. */
  background:linear-gradient(165deg,#dbc896,#a98f58 72%);
  border:1px solid rgba(59,44,12,.55);
  border-left:2px solid rgba(255,95,158,.5);
  /* The polygon runs PAST the border box on purpose — 5px below for the
     sheet-edge ::after, 28px above for the paperclip: a polygon ending at the
     box edge clips both out of existence. The extra points keep the top-right
     corner cut's diagonal exactly where it was.
     The 28 was sized to the old clip, which topped out ~27px above the border
     box with no slack. The drawn gem clip sits lower (top:-11px) and tops out
     ~21px, so there is ~7px of headroom now — that is the budget for lowering
     .eng-cover-clip's top further or growing its height, and the number to
     re-derive against if either moves. */
  clip-path:polygon(0 -28px,calc(100% - 14px) -28px,calc(100% - 14px) 0,100% 14px,100% calc(100% + 5px),0 calc(100% + 5px));
}
.eng-cover::before{
  content:""; position:absolute; inset:0; pointer-events:none;
  background:repeating-linear-gradient(0deg,rgba(11,22,20,.05) 0 1px,transparent 1px 3px);
}
/* THE FILE IS THE QUERY CONTAINER, and --badge-w is the photo's width as ONE
   number: the stamps clear the photo by measuring it, and the form's right
   padding clears it the same way, so nothing is a magic offset that drifts
   when the photo resizes. cqw is declared on .eng-cover, not on .eng-file —
   container units on the container element itself resolve against an ANCESTOR
   container, which silently falls back to the viewport. */
.eng-file{ container-type:inline-size; }
.eng-cover{ --badge-w:clamp(96px, 31cqw, 150px); }

/* THE GHOST NUMBER IS GONE (2026-08-03). It existed to fill an empty middle —
   the file's middle is the form now, and a watermark under live values is
   noise the tab already prints. */

/* THE CLIPPED PHOTO. The matte is deliberately the brightest surface on the
   closed file — the face is the point, and a pale print on dark stock is how a
   photo reads on a case cover. ROTATED WHERE THE FOLDER IS NOT: the file is
   filed straight, the attachment is crooked, and that contrast is what makes
   it read as a physical thing clipped on rather than a component drawn in.
   Sits above the ghost number (an attachment lies on the printing). */
.eng-cover-badge{
  /* CLIPPED TO THE EDGE, NOT LYING ON THE FACE: the matte pokes above the
     cover's top edge and the clip grips across it — attached TO the folder
     (author, 2026-08-03), the way a paperclip actually holds a photo. */
  position:absolute; right:8%; top:-9px; z-index:2;
  width:var(--badge-w); margin:0; padding:5px 5px 0;
  background:rgba(234,255,249,.92);
  transform:rotate(2.5deg);
  box-shadow:0 7px 18px rgba(0,0,0,.6);
}
.eng-cover-badge img{
  display:block; width:100%; aspect-ratio:1; object-fit:cover;
  background:#031311;
}
.eng-cover-badge figcaption{
  padding:4px 2px 5px; text-align:center; text-wrap:balance;
  font-size:7.5px; font-weight:bold; letter-spacing:.1em; color:#0b1614;
}
/* The credit line above the plate — lighter and smaller, so the caption reads
   as one photo credit rather than two labels. */
.eng-cover-badge figcaption i{
  display:block; margin-bottom:2px; font-style:normal; font-weight:normal;
  font-size:5.8px; letter-spacing:.16em; color:rgba(11,22,20,.6);
}
/* One paperclip, drawn: a gem-clip wire gripping the photo's top edge. The SVG
   carries the shape and its own shading (see CoverClip) — all this rule owns is
   where it sits, how crooked it is, and the shadow it casts on the matte.
   drop-shadow, not box-shadow: the shadow has to follow the WIRE, and a box
   shadow would print the element's rectangle onto the photo.
   15px wide, not 17: the viewBox is narrower than the old rounded rect, and the
   height/top pair is the clip-path headroom constraint documented on the
   component — at top:-11px the rotated hook lands ~21px above .eng-cover, well
   inside the 28 the polygon clears. */
.eng-cover-clip{
  position:absolute; left:16px; top:-11px; width:15px; height:42px;
  overflow:visible;
  transform:rotate(-9deg);
  filter:drop-shadow(0 1px 2px rgba(0,0,0,.55));
}
/* Sheet edges under the cover's bottom lip: white paper peeking from a manila
   folder. Affirmative — "there is a file here" — the opposite of narrating an
   absence. */
.eng-cover::after{
  content:""; position:absolute; left:8px; right:8px; bottom:-4px; height:4px;
  border-top:1px solid rgba(238,232,214,.85);
  box-shadow:0 3px 0 -1px rgba(11,22,20,.4);
}
/* The arrived state is CLOSED-CASE CSS, not a leftover inline style: skipRoll's
   progress(1), reduced motion, and an arrived re-mount all land here. */
.eng-cover-letter{
  padding:0;
  font-family:'Bebas Neue', Impact, sans-serif;
  font-size:15px; letter-spacing:.14em; color:#241c08; font-weight:400;
}
.eng-cover-letter i{
  display:block; height:1px; max-width:150px; margin-top:7px;
  background:rgba(36,28,8,.35);
}
/* The clasp glyph is gone — see the render site. */

.eng-cover-route{
  position:absolute; left:16px; bottom:14px;
  display:flex; flex-direction:column; gap:4px;
  font-size:8px; letter-spacing:.14em; color:#4a3b17;
}
/* The intake desk's ink — pink family (the cover's left edge), never the mint
   of MEETING SET: that stamp is the settle's; this one was already on the file
   when it arrived — logged before you ever saw it, from no one in particular
   (no source: the desk is non-hierarchical, see the render-site note).
   Half-faded so the fresh attachments (photo, manila tab) read as newer than
   the print under them. */
.eng-cover-received{
  position:absolute; right:calc(8% + var(--badge-w) + 14px); top:20px;
  transform:rotate(-8deg);
  font-family:'Bebas Neue', Impact, sans-serif;
  font-size:21px; line-height:1; letter-spacing:.16em; white-space:nowrap;
  color:rgba(197,36,105,.68);
  border:2px solid currentColor; border-radius:2px; padding:5px 12px;
  pointer-events:none;
}
/* On a narrow cover the 34% anchor runs the stamp under the polaroid's matte —
   most of the word occluded at every phone width. Below the ghost's own
   threshold the stamp moves to the clear band under the letterhead instead of
   shrinking into illegibility. */
/* NARROW: THE STAMPS GET THEIR OWN BAND AT THE FOOT. Right-anchoring clears
   the photo but drops them onto the name and the stats — the reveal and the
   data — because a narrow cover has no free middle. So the file grows a
   stamp band instead: both impressions side by side under the form, above
   the routing lines, which is where a clerk stamps a page anyway. */
@container (max-width: 519px){
  .eng-cover{ padding-bottom:92px; }
  .eng-cover-received{
    right:auto; left:16px; top:auto; bottom:52px;
    font-size:17px; padding:4px 9px;
  }
}
/* Squeezed containers (a narrowed desktop pane, not a phone — the flat surface
   never gets this thin): the badge's 104px floor starts eating the letterhead
   and the relocated stamp below ~300px, so both step down once. */
@container (max-width: 299px){
  .eng-cover-received{ font-size:16px; border-width:1.5px; padding:4px 9px; }
}
/* THE ONE WAITING LINE — the surface's single "not yet", in dark bronze:
   gold's voice as ink (bright #ffd23a vanishes on beige, and the lighter
   #7c5f0a measured ~1.9:1 on the gradient's dark end — near-invisible for the
   one line that must read). Everything else on the cover is an affirmative
   fact: number, letterhead, received, via, photo, pages. */
.eng-cover-wait{ color:#443305; }

/* THE WRAPPER holds the folder's geometry; THE BACK LAYER holds its manila.
   Split on purpose: the record inside never moves, so when the file is FILED
   the boards leave without it — the cover and tab slide off, this layer fades,
   and the wrapper keeps its box so nothing reflows. NO clip-path on either —
   the tab and the polaroid's paperclip poke above this box, and a polygon
   would shear them; the cover carries the corner-cut language. */
.eng-file{
  position:relative;
  padding:14px 12px 12px;
}
.eng-file-back{
  position:absolute; inset:0; z-index:0;
  background:linear-gradient(170deg,#c9b47f,#96794a 75%);
  border:1px solid rgba(59,44,12,.6);
  box-shadow:inset 0 1px 0 rgba(238,232,214,.25), 0 8px 20px rgba(0,0,0,.45);
}
/* THE FORM, printed on the file. Right padding clears the polaroid and tracks
   the same clamp the photo uses, so nothing collides at any container width.
   Every ink is DARK — this is print on beige stock, and the terminal's bright
   accents vanish here (the tab-label lesson). */
.eng-form{
  position:relative; z-index:2; margin-top:15px;
  padding-right:calc(var(--badge-w) + 20px);
}
.eng-form .eng-label{ color:#8c2b52; }
.eng-form .eng-client{
  margin-top:5px; min-height:2.3em;
  font-size:clamp(17px, 3.4cqw, 23px); font-weight:bold; line-height:1.12;
  letter-spacing:.02em; color:rgba(36,28,8,.32); overflow-wrap:anywhere;
}
.eng-form .eng-client.named{ color:#1c1505; }
.eng-form .eng-particulars{ margin-top:13px; opacity:.45; }
.eng-file.in .eng-form .eng-particulars{ opacity:1; }
.eng-form .eng-part-h{
  color:#8c2b52; padding-bottom:6px;
  border-bottom:1px solid rgba(36,28,8,.28);
}
.eng-form .eng-stats{
  margin-top:8px; display:grid; grid-template-columns:repeat(2, minmax(0,1fr));
  gap:3px 20px;
}
.eng-form .eng-stats > div{ display:flex; align-items:baseline; gap:8px; }
.eng-form .eng-stats dt{ width:58px; color:rgba(36,28,8,.58); }
.eng-form .eng-stats dd{ color:#1c1505; }
/* THE PREMISE SPANS THE FORM. On the paper record the particulars are a
   two-column grid of short market numbers, and "a money market" is neither
   short nor a number — sharing a cell with MCAP wrapped its label onto two
   lines. Full width, label sized to its own text, sitting above the grid it
   describes. */
.eng-form .eng-stats .eng-sector{ grid-column:1 / -1; }
.eng-form .eng-stats .eng-sector dt{ width:auto; white-space:nowrap; }
/* One document, one impression: the stamp's landed state is class-held so
   skipRoll, reduced motion and arrived re-mounts all show it without a
   timeline — and the STATUS line dies the same frame, no transition, the
   handover rule the status pill used to carry. */
.eng-file.in .eng-cover-stamp{ opacity:1; transform:rotate(-6deg) scale(1); }
.eng-file.in .eng-cover-wait{ opacity:0; }

/* THE APPROVAL STAMP, on the cover — SAME STYLE AND PLACEMENT FAMILY AS
   RECEIVED (author, 2026-08-03): identical metrics, struck just below it at a
   slightly different angle, the way the same desk stamps the same document
   twice. Only the ink differs — mint is MEETING SET's, pink is intake's. */
.eng-cover-stamp{
  position:absolute; right:calc(8% + var(--badge-w) + 14px); top:58px; z-index:3;
  transform:rotate(-6deg) scale(1.35);
  font-family:'Bebas Neue', Impact, sans-serif;
  font-size:21px; line-height:1; letter-spacing:.16em; text-transform:uppercase;
  color:rgba(46,143,107,.8);
  border:2px solid currentColor; border-radius:2px; padding:5px 12px;
  opacity:0; pointer-events:none; white-space:nowrap;
}
@container (max-width: 519px){
  .eng-cover-stamp{
    left:auto; right:16px; top:auto; bottom:52px;
    font-size:17px; padding:4px 10px;
  }
}

/* THE TAB — cut from the back panel it rides on, so it survives the open (the
   cover leaves; the folder stays). Lives in the shell's top padding on both
   surfaces. At the settle it takes the ticker and becomes the deal's handle
   for the rest of the session. */
.eng-tab{
  position:absolute; top:-17px; left:12px; z-index:6; pointer-events:none;
  padding:3px 14px 2px;
  font-family:'Bebas Neue', Impact, sans-serif;
  /* Dark ink on manila — the gold label was a leftover from the dark-folder
     pass and vanished against beige. */
  font-size:11px; letter-spacing:.12em; color:#2c2108; text-transform:uppercase;
  /* Cut from the folder's own stock — manila, like the cover, so tab and
     folder read as one object with the record filed inside. Dark ink label;
     the tab keeps its manila fill after the open, so the handle stays paper. */
  background:linear-gradient(180deg,#e0cd9b,#b59b60);
  border-top:1px solid rgba(59,44,12,.5);
  clip-path:polygon(6px 0,calc(100% - 6px) 0,100% 100%,0 100%);
  white-space:nowrap;
}
/* The ticker pops with the settle, the same frame as the stamp — the stamp
   scaling in is the motion at that instant, so the tab gets no transition of its
   own (the pill/stamp handover rule, for the same frame-drop reason). */
/* The tab's ticker mechanic is GONE (2026-08-03): the tab is filed away with
   the boards before the settle, so a ticker on it would never be seen. The
   brief's own header carries the deal's name from the settle on. */
`;
