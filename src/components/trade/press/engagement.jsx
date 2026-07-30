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

export const SFX = {
  // playSfx no-ops safely on a missing file (uiSfx caches the failed fetch and
  // the element fallback swallows the rest), so these light up by themselves
  // once audio lands at these paths.
  arrive: "/audio/record_sign.mp3",
  settle: "/audio/record_stamp.mp3",
};

export function prefersReducedMotion() {
  if (typeof window === "undefined") return false;
  return !!window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
}

/* THE TERM. Constant, and deliberately not a number — a percentage invites the
   player to price the agent's incentive, and the lesson is that its direction is
   what matters and that direction is never in doubt. */
export const TERMS = "ONLY IF YOU FUND IT";

const SIGN = 0.50;    // the shield waking
const TYPE = 0.62;    // the client's name going onto the line
const STAMP = 0.34;   // the stamps landing
const REVEAL = 0.42;  // the dossier

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
    shieldRef = null, clientRef = null, termsRef = null, particularsRef = null,
    stampRetainedRef = null }, ref) {
  return (
    <div className={`eng${arrived ? " in" : ""}`} ref={ref}>
      <div className="eng-head">
        <span className="eng-title">Engagement Record</span>
        {/* THE ONE STATUS LABEL. The console shipped alongside four others —
            NOT IN YET, AWAITING TRAFFIC, the block glyphs, "still coded" and
            NOTHING ON THE TABLE YET, all on screen together, which reads as a
            surface that has hung rather than one that is waiting. Anything that
            wants to say "not yet" on this panel says it here or not at all. */}
        <span className="eng-status">{arrived ? "RETAINED" : "AVAILABLE"}</span>
      </div>

      {/* THREE COLUMNS, ONE DOCUMENT: who is pitching, what they signed, and the
          particulars of the thing being pitched.

          THE PARTICULARS USED TO BE A SECOND BOX (`.ps-sheet`, in the copy column
          beside this one) and the author caught it immediately: "the pitch project
          is in 2 separate boxes". It was — the client's NAME was on the record and
          the client's NUMBERS were in a bordered panel four inches to the right,
          so one deal arrived as two objects. A record that names a party and then
          declines to describe it is not a document, it is a layout.

          Folding them in also deleted the swap cell this panel needed when the
          dossier lived outside: with the stat rows visible from the start at ——,
          the blank form covers its own rest state and there is nothing left to
          cross-fade. See the note on `particulars` in runArrival. */}
      <div className="eng-body">
      <div className="eng-parties">
        <div className="eng-frame">
          {/* THE SHIELD. Dim until retained, then lit — an opacity cross-fade and
              NOT a filter swap, which does not repaint on iOS next to an animated
              subtree. The lit state is held by `.eng.in` so the timeline's
              clearProps hands it back to CSS at full. */}
          <img className="eng-pic" src={PITCH_BOT.portrait} alt="" aria-hidden="true"
               ref={shieldRef} />
        </div>
        <div className="eng-idents">
          <span className="eng-who">{PITCH_BOT.name.toUpperCase()}</span>
          <span className="eng-role">ON COMMISSION</span>
        </div>
      </div>

      {/* THE CONTRACT LINES. Two, because a third would be restating what the
          portrait already says — the bot's name is under its own photograph. */}
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
        <div className="eng-field row">
          <span className="eng-label">PAID</span>
          {/* GSAP WRITES THIS ONE TOO, for the same reason it writes the client
              line: the value has to change at the settle, and React's own render
              of it arrives with `client`. Gated on `client` and not on `arrived`
              so the two agree — keyed to `arrived` it stayed a dash for the whole
              back half of the timeline and then popped in unanimated, while the
              fade played on the placeholder. */}
          <span className="eng-value" ref={termsRef}>{client ? TERMS : "——"}</span>
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
            <div><dt>MCAP</dt><dd>{surface?.mcap ?? "——"}</dd></div>
            <div><dt>HOLDERS</dt><dd>{surface?.holders ?? "——"}</dd></div>
            <div><dt>AGE</dt><dd>{surface?.age ?? "——"}</dd></div>
            <div><dt>24H</dt><dd>{surface?.change24h ?? "——"}</dd></div>
            <div><dt>SOCIAL</dt><dd>{surface?.social ?? "——"}</dd></div>
          </dl>
        </div>
      </div>

      <span className="eng-stamp retained" ref={stampRetainedRef} aria-hidden={!arrived}>
        Retained
      </span>
    </div>
  );
});

/**
 * Play the arrival.
 *
 * @param record       the EngagementRecord element
 * @param shield       the agent's portrait (wakes)
 * @param client       the client-name node (typed in place)
 * @param clientText   what it types TO
 * @param terms        the PAID value node
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
  record, shield, client, clientText, terms, stampRetained,
  particulars, onSettled, onDone,
}) {
  if (!record && !particulars && !client) return null;

  playSfx(SFX.arrive, { volume: 0.5 });

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
      if (shield) gsap.set(shield, { clearProps: "opacity,transform,willChange" });
      if (stampRetained) gsap.set(stampRetained, { clearProps: "opacity,transform,willChange" });
      onDone?.();
    },
  });

  // THE SHIELD WAKES FIRST, and this is the beat's tutorial: the face is a screen,
  // and for the next four minutes it reads pressure(). Nothing else in the game
  // gets to introduce it for free.
  if (shield) {
    tl.fromTo(shield, { opacity: 0.26, willChange: "opacity" },
      { opacity: 1, duration: SIGN, ease: "power2.out" }, 0);
  }

  // THE NAME GOES ONTO THE LINE — typed, not scrambled. A random-letter resolve
  // was the cipher's own effect and has no motive once the machine is gone; a name
  // appearing a character at a time is a form being filled in, which is what is
  // actually happening. Text only: no layout property is touched, so the 3D
  // underneath keeps its frames.
  if (client && clientText) {
    const t = { p: 0 };
    tl.to(t, {
      p: 1, duration: TYPE, ease: "none",
      onUpdate: () => {
        const n = Math.floor(t.p * clientText.length);
        client.textContent = clientText.slice(0, n) + (n < clientText.length ? "▍" : "");
      },
      onComplete: () => { client.textContent = clientText; },
    }, 0.10);
  }

  const settledAt = 0.10 + (client && clientText ? TYPE : 0);

  // The term arrives just before the stamps, so it is read as part of the deal
  // being struck rather than as a footnote to it.
  if (terms) {
    // immediateRender:false OR THE PLACEHOLDER VANISHES AT t=0. A fromTo renders
    // its `from` state the moment the timeline is BUILT, not when the tween
    // starts, so opacity:0 landed half a second before onStart wrote the term —
    // the PAID row simply went blank in between. The other fromTos here are safe
    // from it only because their `from` values already match the CSS at rest.
    tl.fromTo(terms, { opacity: 0 }, {
      opacity: 1, duration: 0.3, ease: "power1.out", immediateRender: false,
      onStart: () => { terms.textContent = TERMS; },
    }, Math.max(0, settledAt - 0.22));
  }

  tl.call(() => { playSfx(SFX.settle, { volume: 0.4 }); onSettled?.(); }, null, settledAt);

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
   pill fades as the stamp lands, so the record never carries two of them. */
.eng-stamp.retained{
  position:absolute; right:8px; top:5px;
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
.eng-stats dt{ flex:none; width:60px; font-size:8.5px; letter-spacing:.13em;
  color:rgba(234,255,249,.45); }
.eng-stats dd{ margin:0; font-size:11px; font-weight:bold; color:#eafff9; }
`;
