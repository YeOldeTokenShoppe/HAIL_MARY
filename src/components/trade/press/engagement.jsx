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
const OPEN = 0.45;    // the cover swinging back

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
    stampRetainedRef = null, coverRef = null, fileNo = null,
    title = "Engagement Record",
    restStatus = "AVAILABLE", arrivedStatus = "RETAINED",
    stampLabel = "Retained" }, ref) {
  return (
    <div className={`eng${arrived ? " in" : ""}`} ref={ref}>
      {/* THE DEAL FILE. The record ships inside a closed folder, and the folder
          — not a caption — is what withholds the name: invariant 7 enforced by
          geometry, so no copy anywhere says SEALED. It replaced the sealed-state
          overlay (CLIENT // SEALED, the 02 glyph, the INBOUND FILE scan bars,
          and the readout's second AWAITING REVIEW), which had crept back to five
          "not yet" signals — the exact count [A§20] records this briefing dying
          of once already. DEAL FILE, never CASE FILE: case is detective
          vocabulary and a deal meeting doesn't contain it.

          THE COVER IS ALWAYS MOUNTED. runArrival opens it by ref, and the
          arrived state is held by CSS (.eng.in .eng-cover) so skipRoll's
          progress(1), reduced motion, and a re-mount that starts arrived all
          land closed-case correct without a frame of the wrong state.
          aria-hidden: the record's own status pill is the one status the
          accessibility tree carries — same one-signal rule, same place. */}
      {fileNo != null && (
        <>
          {/* THE FILE NUMBER IS REAL (author, 2026-08-03: "does it make sense
              to have a deal number?" / "if so, a real number?"). A random
              number was the 02 glyph's failure with more digits —
              information-shaped, meant nothing, never returned. This one is
              the desk's caseload: a persistent local counter (peekFileNo /
              commitFileNo), so replaying shows 001 become 002 and the
              bureaucracy is honest. Derived from nothing but the counter —
              structurally unable to see the deal. */}
          <span className="eng-tab" aria-hidden="true">
            DEAL FILE // NO. {fmtFileNo(fileNo)}
            <i className="eng-tab-ticker">{ticker ? ` · ${ticker}` : ""}</i>
          </span>
          <div className="eng-cover" ref={coverRef} aria-hidden="true">
            {/* PROSPECTUS, not DEAL INTAKE (author, 2026-08-03): the cover
                names the DOCUMENT, not the desk's process — it is what a deal
                arrives as in this world, and it rhymes with the PROSPECT block
                the record prints inside. Generic to every deal, so invariant 7
                is untouched. */}
            <div className="eng-cover-letter">PROSPECTUS<i /></div>
            {/* Printed stock, not information — see .eng-cover-ghost. */}
            <span className="eng-cover-ghost">NO. {fmtFileNo(fileNo)}</span>
            {/* THE AGENT'S PHOTO, CLIPPED TO THE FILE. The one pictorial element
                on the cover, and the face the briefing was missing at rest —
                [A§20] recorded the cipher dying partly because the thing that
                talks for two minutes had no face on this panel. It is the AGENT,
                never the client: the same rig-rolled portrait the record wakes,
                so the clipped photo previews the shield teach and cannot leak
                the deal. The caption restates desk data, not status. */}
            {/* NO CLASP. It was here as "one glyph of closed" — a circle with a
                bar — and the author read it as a strike/prohibited icon
                (2026-08-03). A glyph that needs explaining is failing, and the
                folder says closed five other ways now. */}
            <figure className="eng-cover-badge">
              <span className="eng-cover-clip" />
              <img src={PITCH_BOT.portrait} alt="" />
              <figcaption>PITCH BOT<i>ON COMMISSION</i></figcaption>
            </figure>
            {/* RECEIVED IS A STAMP, NOT A LINE — the same fact in physical ink:
                the file was logged before you got here, which is CHOOSES
                NOTHING staged as an artifact rather than asserted as copy.
                NO SOURCE ON THE STAMP: the desk is a non-hierarchical org
                (author, 2026-08-03) — nothing arrives from "upstairs", it just
                arrives, already logged. Faded relative to the photo: the stamp
                landed first, the attachment came after. */}
            <span className="eng-cover-received">RECEIVED</span>
            {/* Two routing lines, both affirmative process facts. STATUS is
                the cover's one waiting line — bronze ink, not gold: see
                .eng-cover-wait — and the surface's one "not yet"; nothing
                else here may wait. */}
            <div className="eng-cover-route">
              <span>VIA&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;// COMMISSIONED AGENT</span>
              <span className="eng-cover-wait">STATUS&nbsp;&nbsp;&nbsp;// AWAITING REVIEW</span>
            </div>
          </div>
        </>
      )}
      <div className="eng-head">
        <span className="eng-title">{title}</span>
        {/* THE ONE STATUS LABEL. The console shipped alongside four others —
            NOT IN YET, AWAITING TRAFFIC, the block glyphs, "still coded" and
            NOTHING ON THE TABLE YET, all on screen together, which reads as a
            surface that has hung rather than one that is waiting. Anything that
            wants to say "not yet" on this panel says it here or not at all. */}
        <span className="eng-status">{arrived ? arrivedStatus : restStatus}</span>
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
        {stampLabel}
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
 * @param cover        the deal-file cover (swings open on its top hinge, then
 *                     display:none — the arrived state is held by .eng.in).
 *                     Omitting it collapses `lead` to 0 and reproduces the
 *                     pre-folder timeline offsets exactly.
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
  particulars, cover, onSettled, onDone,
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
      // The cover's arrived state is display:none, held by .eng.in — clearing
      // display here is what makes that true: the timeline's own set() below
      // wrote it inline, and an inline display outlives the session while the
      // class-held one resets with the next mount.
      if (cover) gsap.set(cover, { clearProps: "opacity,transform,transformOrigin,willChange,display" });
      onDone?.();
    },
  });

  // THE FILE OPENS FIRST — the cover swings back on its top hinge and the blank
  // record is simply THERE, already on the desk. Nothing about the open may
  // read as a draw: the folder reveals a form that was under it all along,
  // which is the paperwork fiction doing what the five dead props in this slot
  // couldn't. transformPerspective on the tween keeps the 3D local to the
  // cover — no perspective property lands on .eng, so nothing else in the
  // record gains a containing block or a composited layer it didn't have.
  // Everything downstream is offset by `lead`; with no cover the offsets are
  // exactly the pre-folder timeline.
  const lead = cover ? OPEN + 0.05 : 0;
  if (cover) {
    tl.to(cover, {
      rotateX: -104, transformPerspective: 900, transformOrigin: "50% 0%",
      duration: OPEN, ease: "power2.inOut", willChange: "transform",
    }, 0.05);
    // The fade rides the back 40% of the swing so no backface handling is
    // needed; display:none the moment it lands drops the composited layer —
    // this beat plays over the live WebGL room (see the lag-smoothing note).
    tl.to(cover, { opacity: 0, duration: OPEN * 0.4, ease: "power1.in" }, 0.05 + OPEN * 0.6);
    tl.set(cover, { display: "none" }, 0.05 + OPEN);
  }

  // THE SHIELD WAKES as the cover clears it — and this is the beat's tutorial:
  // the face is a screen, and for the next four minutes it reads pressure().
  // Nothing else in the game gets to introduce it for free. Opening the file is
  // what wakes the agent clipped to it, which is why the overlap (the wake
  // starts on the swing's last frames) reads as cause rather than coincidence.
  if (shield) {
    tl.fromTo(shield, { opacity: 0.26, willChange: "opacity" },
      { opacity: 1, duration: SIGN, ease: "power2.out" }, Math.max(0, lead - 0.10));
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
    }, lead + 0.10);
  }

  const settledAt = lead + 0.10 + (client && clientText ? TYPE : 0);

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
.eng-stats dt{ flex:none; width:60px; font-size:8.5px; letter-spacing:.13em;
  color:rgba(234,255,249,.45); }
.eng-stats dd{ margin:0; font-size:11px; font-weight:bold; color:#eafff9; }

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
  position:absolute; inset:0; z-index:5; pointer-events:none;
  /* MANILA, FOR REAL (author, 2026-08-03: "beige manila color") — noir manila:
     desaturated a step and scanlit so it sits in the dark room instead of
     glowing out of it. The one warm paper object on a teal terminal; every ink
     on it goes dark, like print. The pink spine stays — the record's own left
     rule, worn by the folder. */
  background:linear-gradient(165deg,#dbc896,#a98f58 72%);
  border:1px solid rgba(59,44,12,.55);
  border-left:2px solid rgba(255,95,158,.5);
  /* The polygon runs PAST the border box on purpose — 5px below for the
     sheet-edge ::after, 28px above for the paperclip (its rotated loop tops
     out ~27px above the border box at the badge clamp's max — no slack, do
     not shrink it):
     a polygon ending at the box edge clips both out of existence. The extra
     points keep the top-right corner cut's diagonal exactly where it was. */
  clip-path:polygon(0 -28px,calc(100% - 14px) -28px,calc(100% - 14px) 0,100% 14px,100% calc(100% + 5px),0 calc(100% + 5px));
}
.eng-cover::before{
  content:""; position:absolute; inset:0; pointer-events:none;
  background:repeating-linear-gradient(0deg,rgba(11,22,20,.05) 0 1px,transparent 1px 3px);
}
/* THE GHOST NUMBER — printed stock, not information. On the wide desktop cover
   the empty middle read as unrendered rather than restrained (author,
   2026-08-03), and what a real folder carries there is printed material: the
   cover's one identity fact, oversized and embossed (~12% dark ink with a 7%
   stroke — see the declaration). It repeats the tab, so it says nothing new —
   filling, never signalling — and it cannot leak (the number is the desk's
   caseload counter, derived from nothing but itself). A CONTAINER query, not a
   media query: the record consults its own width, per the no-MQ rule (two
   surfaces, one record), and the ghost exists only where the cover has room —
   the narrow portrait folder already composes without it. */
.eng{ container-type:inline-size; }
.eng-cover-ghost{
  position:absolute; left:45%; top:50%; transform:translate(-50%,-50%);
  font-family:'Bebas Neue', Impact, sans-serif;
  font-size:clamp(60px, 14cqw, 128px); line-height:1; letter-spacing:.06em;
  color:rgba(36,28,8,.12);
  -webkit-text-stroke:1px rgba(36,28,8,.07);
  pointer-events:none; user-select:none; white-space:nowrap;
  display:none;
}
@container (min-width: 520px){ .eng-cover-ghost{ display:block; } }

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
  width:clamp(104px, 18cqw, 150px); margin:0; padding:5px 5px 0;
  background:rgba(234,255,249,.92);
  transform:rotate(2.5deg);
  box-shadow:0 7px 18px rgba(0,0,0,.6);
}
.eng-cover-badge img{
  display:block; width:100%; aspect-ratio:1; object-fit:cover;
  background:#031311;
}
.eng-cover-badge figcaption{
  padding:4px 2px 5px; text-align:center;
  font-size:7px; font-weight:bold; letter-spacing:.14em; color:#0b1614;
}
.eng-cover-badge figcaption i{
  display:block; margin-top:2px; font-style:normal;
  font-size:5.5px; letter-spacing:.12em; color:rgba(11,22,20,.62);
}
/* One paperclip, drawn: an outlined loop over the photo's top edge. */
.eng-cover-clip{
  position:absolute; left:16px; top:-16px; width:17px; height:42px;
  border:2px solid rgba(205,224,219,.92); border-radius:9px;
  transform:rotate(-9deg);
  box-shadow:inset 0 0 0 1.5px rgba(2,15,13,.4), 0 1px 3px rgba(0,0,0,.35);
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
.eng.in .eng-cover{ display:none; }
.eng-cover-letter{
  padding:18px 16px 0;
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
  position:absolute; left:34%; top:20px;
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
@container (max-width: 519px){
  .eng-cover-received{ left:16px; top:52px; }
}
/* THE ONE WAITING LINE — the surface's single "not yet", in dark bronze:
   gold's voice as ink (bright #ffd23a vanishes on beige, and the lighter
   #7c5f0a measured ~1.9:1 on the gradient's dark end — near-invisible for the
   one line that must read). Everything else on the cover is an affirmative
   fact: number, letterhead, received, via, photo, pages. */
.eng-cover-wait{ color:#443305; }

/* THE TAB — the folder's handle, riding the record's top edge so it survives the
   open (the cover leaves; the file stays). Lives in the shell's top padding on
   both surfaces. At the settle it takes the ticker and becomes the deal's handle
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
/* #053a36, not #0e6b64: the lighter teal measured ~3.1:1 on the manila tab —
   below AA at 11px. This one clears 4.5:1 across the tab's whole gradient. */
.eng-tab-ticker{ font-style:normal; color:#053a36; opacity:0; }
.eng.in .eng-tab-ticker{ opacity:1; }
`;
