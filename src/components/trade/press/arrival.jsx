"use client";
import React from "react";
import gsap from "gsap";
import { playSfx } from "@/lib/uiSfx";
import { PITCH_BOT } from "@/game/terminal-traders/press/desk";

// THE ARRIVAL — the opening beat, shared by both press surfaces.
//
// REPLACES diceRoll.jsx (2026-07-29). The dice were the third and last survivor
// of a retreat: cards -> dice -> nothing. Every attempt to stage the deal's
// selection as an OBJECT failed for the same reason each time, and the reason is
// worth keeping written down because it will be proposed again:
//
//   A VC meeting has no randomiser in it. It needs a PERSON.
//
// Three dice, blank dice, a wheel, a dual wheel — all of them put a gambling
// prop in a room that is supposed to be an office, and all of them implied the
// player was wagering when what they are actually doing is taking a meeting.
// Our Lady decides which deal comes down; the agent walks in with it.
//
// THE ENIGMA CONSOLE IS THE FIFTH OBJECT, AND IT SURVIVES ON ONE CONDITION:
// IT CHOOSES NOTHING. It is the CHANNEL — Our Lady's instruction arrives coded,
// the console decodes it, the agent brings it in. The moment it starts reading
// as the thing that PICKS your deal it is the dice again in a fifth costume, and
// it should be cut for exactly the same reason. See VC_GAME.md §1.
//
// The metaphor only works in this direction: Enigma ENCODED the traffic, and a
// room of specialists broke it. The intro is the message landing; the next four
// minutes are the room.
//
// WHAT SURVIVED THE SWAP, because it is a rule and not decoration: the deal
// sheet writes itself in only AFTER the arrival completes. Invariant 7 —
// nothing names the deal before it exists — was enforced by the dice timeline,
// and the decode now enforces it *visibly*: the name is unreadable until the
// rotors stop. Do not overlap them.

export const SFX = {
  // playSfx no-ops safely on a missing file (uiSfx caches the failed fetch and
  // the element fallback swallows the rest), so these light up by themselves
  // once audio lands at these paths.
  arrive: "/audio/enigma_key.mp3",
  settle: "/audio/enigma_settle.mp3",
};

export function prefersReducedMotion() {
  if (typeof window === "undefined") return false;
  return !!window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
}

const ALPHA = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const ROTORS = 3;

const STEP = 0.68;    // rotors stepping
const DECODE = 0.58;  // the name resolving
const REVEAL = 0.42;  // the sheet

/**
 * WHERE THE ROTORS COME TO REST — from a module tick, NEVER from the run seed.
 *
 * This is the dice-pip rule and it is the reason it exists: three letters in a
 * window is the most meaningful-looking thing you can put on this screen, and a
 * display that looks like it ought to mean something WILL be mined for
 * correlation long before the game deserves to be beaten. `facesFor()` took a
 * tick for the same reason and diceRoll.jsx never imported instanceDeal. This
 * module must never import it either.
 */
let tick = 0;
export function rotorsFor(t = tick++) {
  return Array.from({ length: ROTORS },
    (_, i) => ALPHA[(t * 7 + i * 11 + 3) % 26]);
}

const randLetter = () => ALPHA[Math.floor(Math.random() * 26)];

/**
 * One frame of the decode: everything left of `progress` is true, everything
 * right of it is still ciphertext. Punctuation and spacing are never scrambled —
 * the shape of the name has to hold steady or the line reflows while it resolves
 * and reads as the paragraph rewriting itself rather than the name filling in.
 */
function decodeFrame(target, progress) {
  const shown = Math.floor(progress * target.length);
  let out = "";
  for (let i = 0; i < target.length; i++) {
    const ch = target[i];
    out += (i < shown || !/[A-Za-z0-9]/.test(ch)) ? ch : randLetter();
  }
  return out;
}

/**
 * THE CONSOLE — what sits where the dice tray used to.
 *
 * Deliberately NOT a button and deliberately not a randomiser: it is the channel
 * a meeting is announced on. `arrived` flips it from awaiting traffic to
 * received. Kept to a single low strip and styled as this room's own equipment
 * rather than 1940s wood — a hero-sized museum piece advertises a cryptography
 * game, and the next four minutes are a token pitch.
 */
export const EnigmaConsole = React.forwardRef(function EnigmaConsole(
  { arrived = false, lampRef = null, registerRotor = null }, ref) {
  const resting = React.useMemo(() => rotorsFor(0), []);
  return (
    <div className={`ar-enig${arrived ? " in" : ""}`} ref={ref}>
      <div className="ar-rotors">
        {resting.map((ch, i) => (
          <span className="ar-rotor" key={i}
                ref={(el) => registerRotor?.(i, el)}>{ch}</span>
        ))}
      </div>
      <span className="ar-badge" aria-hidden="true">ENIGMA</span>
      <span className="ar-lamp" ref={lampRef} aria-hidden="true" />
      <span className="ar-status">
        {arrived ? "MESSAGE RECEIVED" : "AWAITING TRAFFIC"}
      </span>
    </div>
  );
});

/**
 * Play the arrival.
 *
 * @param panel     the EnigmaConsole element
 * @param rotors    the three rotor elements, in order
 * @param lamp      the lamp element
 * @param name      the headline name element (decoded in place)
 * @param nameText  what it decodes TO
 * @param sheet     the deal sheet, revealed once the message is decoded
 * @param onSettled () => void — decoded; safe to name the deal
 * @param onDone    () => void — the sheet has finished writing in
 *
 * Returns the timeline, or null when there is nothing to animate — callers treat
 * null as "go straight to the arrived state" rather than stranding the player on
 * a button that does nothing. Measured at CLICK time, never at mount.
 *
 * THE DECODE LANDS ON THE TRUTH AND STOPS THERE. Its final frame is exactly the
 * string React renders once `onSettled` flips `identity`, so the two agree and
 * the re-render changes nothing on screen. This is the same contract the dice
 * cubes had with their resting transform; break it and the name visibly
 * re-writes itself one frame after it finished resolving.
 */
export function runArrival({ panel, rotors, lamp, name, nameText, sheet, onSettled, onDone }) {
  if (!panel && !sheet && !name) return null;

  playSfx(SFX.arrive, { volume: 0.5 });
  const spin = (rotors || []).filter(Boolean);
  const land = rotorsFor();

  const tl = gsap.timeline({
    defaults: { force3D: true },
    onComplete: () => {
      // Hand the elements back untransformed. A leftover inline transform keeps
      // a composited layer alive for the rest of the session — over a live
      // WebGL scene, on desktop.
      if (panel) gsap.set(panel, { clearProps: "transform,willChange" });
      if (lamp) gsap.set(lamp, { clearProps: "opacity,transform,willChange" });
      onDone?.();
    },
  });

  if (panel) {
    tl.fromTo(panel,
      { opacity: 0, y: 8, willChange: "transform" },
      { opacity: 1, y: 0, duration: STEP * 0.6, ease: "power2.out" }, 0);
  }

  // THE ROTORS STEP. Each cycles letters and comes to rest on its tick-derived
  // face — never the run seed. Text only: no layout property is touched, so the
  // 3D underneath keeps its frames.
  if (spin.length) {
    const cycle = { p: 0 };
    tl.to(cycle, {
      p: 1, duration: STEP, ease: "power2.out",
      onUpdate: () => {
        spin.forEach((el, i) => {
          // Each rotor locks in turn, left to right, so they settle as a
          // sequence rather than all snapping on the same frame.
          const locked = cycle.p >= (i + 1) / (spin.length + 0.6);
          el.textContent = locked ? (land[i] ?? "A") : randLetter();
        });
      },
      onComplete: () => spin.forEach((el, i) => { el.textContent = land[i] ?? "A"; }),
    }, 0);
  }

  if (lamp) {
    tl.fromTo(lamp,
      { opacity: 0.15, willChange: "opacity" },
      { opacity: 1, duration: STEP * 0.5, ease: "power1.inOut", yoyo: true, repeat: 1 }, 0);
  }

  // THE DECODE. Starts only once the rotors are down — a name resolving while
  // they are still turning reads as the machine decorating a result it already
  // had, which is exactly backwards.
  if (name && nameText) {
    const d = { p: 0 };
    tl.to(d, {
      p: 1, duration: DECODE, ease: "none",
      onUpdate: () => { name.textContent = decodeFrame(nameText, d.p); },
      onComplete: () => { name.textContent = nameText; },
    }, STEP);
  }

  const settledAt = STEP + (name && nameText ? DECODE : 0);
  tl.call(() => { playSfx(SFX.settle, { volume: 0.4 }); onSettled?.(); }, null, settledAt);

  // THE SHEET WRITES ITSELF IN AFTER THE MESSAGE IS DECODED, never during.
  // Overlapping them would name the deal before anyone had brought it, which is
  // invariant 7 and the one thing this beat must not do.
  if (sheet) {
    tl.fromTo(sheet,
      { opacity: 0, y: 10 },
      { opacity: 1, y: 0, duration: REVEAL, ease: "power2.out", clearProps: "transform" },
      settledAt + 0.05);
  }

  return tl;
}

export const ARRIVAL_CSS = `
/* THE ENIGMA CONSOLE. One low strip of the room's own equipment — not a museum
   piece. It is the channel Our Lady sends down, and it chooses nothing. */
.ar-enig{
  display:flex; align-items:center; gap:.55rem; flex-wrap:wrap;
  padding:.5rem .6rem;
  border:1px solid rgba(120,200,255,.2);
  background:linear-gradient(180deg, rgba(10,20,32,.7), rgba(6,12,20,.7));
  border-radius:3px;
  font-family:ui-monospace, "SFMono-Regular", Menlo, monospace;
}
.ar-enig.in{ border-color:rgba(120,200,255,.38); }

/* THE ROTORS. Decoration — their resting letters come from a module tick and
   must never come from the run seed (see rotorsFor). */
.ar-rotors{ display:flex; gap:.22rem; }
.ar-rotor{
  width:1.15rem; height:1.5rem;
  display:flex; align-items:center; justify-content:center;
  font-size:.78rem; font-weight:700; color:#0b1118;
  background:linear-gradient(180deg,#e8eef4,#aab6c2 48%,#e8eef4);
  border:1px solid rgba(0,0,0,.45); border-radius:2px;
  box-shadow:inset 0 0 4px rgba(0,0,0,.5);
  font-variant-numeric:tabular-nums;
}
.ar-badge{
  font-size:.52rem; letter-spacing:.28em; color:rgba(160,200,230,.42);
  border:1px solid rgba(160,200,230,.2); border-radius:999px;
  padding:.12rem .42rem;
}
.ar-lamp{
  width:.44rem; height:.44rem; border-radius:50%;
  background:rgba(150,190,220,.3); opacity:.15;
}
.ar-enig.in .ar-lamp{
  background:#ffd479; opacity:1;
  box-shadow:0 0 .35rem rgba(255,212,121,.7);
}
/* flex:none + nowrap so that when the row is too narrow for it (the CRT column
   gets down to ~266px) the status WRAPS to its own line instead of shrinking and
   having its text clipped by .pf-wrap's overflow:hidden. A shrunk flex item whose
   TEXT overflows is invisible to element-rect overflow checks, which is exactly
   how this got missed once. */
.ar-status{
  margin-left:auto; flex:none; white-space:nowrap;
  font-size:.58rem; letter-spacing:.12em; text-transform:uppercase;
  color:rgba(160,200,230,.55);
}
.ar-enig.in .ar-status{ color:#8fe6c4; }
`;
