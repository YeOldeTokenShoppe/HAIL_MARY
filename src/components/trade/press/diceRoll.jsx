"use client";
import React from "react";
import gsap from "gsap";
import { playSfx } from "@/lib/uiSfx";

// THE ROLL — shared by both presentations of the VC game.
//
// Replaces cardDeal.jsx (2026-07-28). Cards were cut from this game entirely
// and reserved for a 2D TCG; the metaphor that survives is a roll of the dice,
// which is what the game was doing all along. `instanceDeal(seed)` rolls the
// archetype, the outcome, the identity, the surface numbers and which 6 of 7
// claim slots play. A dealt hand implied cards you could choose between. Dice
// imply what is actually true: something was rolled at you and you play it.
//
// TWO RULES THIS FILE ENFORCES, BOTH LOAD-BEARING:
//
// 1. THE PIPS ARE DECORATION AND MUST NEVER COME FROM THE RUN SEED. If the
//    faces were drawn from the same PRNG that picks the archetype, the pips
//    would correlate with the read and a player would find that correlation
//    long before the game deserved to be beaten. `facesFor()` takes a tick
//    counter, never a seed, and nothing here imports instanceDeal. This is the
//    same rule as invariant 5 (no surface stat leaks the outcome), applied to
//    the one surface that looks most like it should mean something.
//
// 2. ONE ROLL PER SITTING. The deal is rolled fresh when you arrive and cannot
//    be re-rolled without leaving and coming back, so the tray is never a
//    button and never has a hover state — anything inviting a second click
//    inside a session is a lie. (This rule used to exist for a different
//    reason: the deal came from dailySeed() and was the same for everybody
//    until midnight. That was cut on 2026-07-28 — see instanceDeal.js — and
//    the rule outlived it, because a die you can throw again mid-session is
//    still the one wrong idea this metaphor can plant.)
//
// PRESENTATION ONLY, like the two components that use it. It owns no rule and
// never touches the run. The roll is choreography over a deal pressRun.js has
// already decided.

// Three, not two: a pair invites reading the SUM — snake eyes, boxcars, seven —
// and this game's players are already looking for meaning in anything the house
// shows them. Three has no canonical total, so no face reads as significant.
export const DICE = 3;

const TUMBLE   = 0.72;  // dice in motion
const SETTLE   = 0.18;  // the small bounce as each lands
const STAGGER  = 0.09;  // gap between dice coming to rest
const REVEAL   = 0.42;  // the sheet writing itself in after the last die lands

export const SFX = {
  // playSfx no-ops safely on a missing file (uiSfx caches the failed fetch and
  // the element fallback swallows the rest), so these light up by themselves
  // once audio lands at these paths.
  roll: "/audio/dice_roll.mp3",
  land: "/audio/dice_land.mp3",
};
// Measured the same way cardDeal's were: one hit per die, opening at 0.7 and
// easing down, so three landings in ~0.9s settle rather than machine-gun.
const LAND_VOL = 0.7, LAND_DECAY = 0.1;

export function prefersReducedMotion() {
  if (typeof window === "undefined") return false;
  return !!window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
}

/* ---------------------------------------------------------------------- *
 * PIPS
 *
 * Pip layout per face, on a 3x3 grid indexed 0-8. Authored rather than
 * computed: the diagonals on 2/3/6 are a convention people recognise instantly
 * and a generated layout gets them subtly wrong.
 *
 * The treatment is lifted from Mant0u's 3D dice pen (MIT,
 * https://codepen.io/Mant0uStudio/pen/ZYWywJB), which draws its faces to a
 * canvas texture. Three details from it are what make a die read as a real die
 * rather than a square with dots on it, and all three are free in CSS:
 * the 1 and 4 pips are RED, the rest are a warm near-black rather than #000,
 * and the single pip on the 1-face is drawn oversized.
 * ---------------------------------------------------------------------- */
const PIPS = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
};

// Opposite faces sum to 7, which is what makes a cube read as a die from any
// angle. front 1 / back 6 / right 2 / left 5 / top 3 / bottom 4.
//
// NUMBERS, NOT TRANSFORM STRINGS, and that distinction was a bug. These were
// authored as strings, so the tumble had nothing to tween toward and animated
// to rotation ZERO instead — which is face 1 — before snapping to the real
// face on completion. Every die therefore flashed the single red pip and then
// changed: *"all 3 die go to a single red dot and then change to the final
// outcome"* (author, 2026-07-28). The roll has to LAND on its result, not
// arrive somewhere else and be corrected.
const FACE_ROT = {
  1: { rx: 0, ry: 0 },
  6: { rx: 0, ry: 180 },
  2: { rx: 0, ry: -90 },
  5: { rx: 0, ry: 90 },
  3: { rx: -90, ry: 0 },
  4: { rx: 90, ry: 0 },
};
const SIDES = [
  { n: 1, t: "translateZ(23px)" },
  { n: 6, t: "rotateY(180deg) translateZ(23px)" },
  { n: 2, t: "rotateY(90deg) translateZ(23px)" },
  { n: 5, t: "rotateY(-90deg) translateZ(23px)" },
  { n: 3, t: "rotateX(90deg) translateZ(23px)" },
  { n: 4, t: "rotateX(-90deg) translateZ(23px)" },
];

/**
 * Which face each die comes to rest on. Deliberately a plain integer hash of
 * (die index, tick) — NOT the run seed, NOT Math.random. Not the seed because
 * of rule 1 above; not Math.random because a reduced-motion or skipped roll
 * should land on the same faces the full roll would have, and because random()
 * during render is a hydration mismatch waiting to happen.
 */
export function facesFor(t = 0) {
  const out = [];
  for (let i = 0; i < DICE; i++) {
    const h = Math.imul(t * 73 + i * 151 + 17, 2654435761) >>> 0;
    out.push((h % 6) + 1);
  }
  return out;
}

/** The resting rotation that puts `face` toward the viewer. */
export const faceRot = (face) => FACE_ROT[face] || FACE_ROT[1];
/** Same thing as a CSS transform, for the resting inline style. */
export const faceTransform = (face) => {
  const { rx, ry } = faceRot(face);
  return `rotateX(${rx}deg) rotateY(${ry}deg)`;
};

/**
 * One die: a real CSS 3D cube, six faces, no WebGL and no images.
 *
 * TWO NESTED ELEMENTS, ON PURPOSE. `.dice-die` is the THROW — gsap owns its
 * x/y/scale — and `.dice-cube` is the TUMBLE, which gsap owns separately. One
 * element can only have one transform, so a single-element die would have the
 * throw and the spin overwriting each other. (Same class of bug as the three
 * transform owners cardDeal.jsx had to keep apart.)
 */
export function Die({ face = 1, index = 0, register, registerCube }) {
  return (
    <span className="dice-die" ref={(el) => register?.(index, el)} aria-hidden="true">
      <span className="dice-cube" ref={(el) => registerCube?.(index, el)}
            style={{ transform: faceTransform(face) }}>
        {SIDES.map(({ n, t }) => (
          <span key={n} className="dice-side" style={{ transform: t }}>
            {Array.from({ length: 9 }, (_, i) => (
              <span key={i}
                    className={`dice-pip${PIPS[n].includes(i) ? " on" : ""}`
                      + (n === 1 || n === 4 ? " red" : "")
                      + (n === 1 ? " big" : "")} />
            ))}
          </span>
        ))}
      </span>
    </span>
  );
}

/**
 * The three dice. Holds its own layout box open from first paint so nothing
 * reflows when they start moving — the same discipline the card slots had, and
 * the reason it mattered is unchanged: on desktop this plays over the LIVE
 * temple scene, so a reflow is a frame the 3D loses.
 */
export const DiceTray = React.forwardRef(function DiceTray(
  { faces, spent = false, register, registerCube }, ref
) {
  return (
    <span className={`dice-tray${spent ? " is-spent" : ""}`} ref={ref}>
      {faces.map((f, i) => (
        <Die key={i} face={f} index={i} register={register} registerCube={registerCube} />
      ))}
    </span>
  );
});

/**
 * Roll them.
 *
 * @param dice       the die elements, in order
 * @param sheet      the deal sheet element, revealed once they settle
 * @param onFace     (faces) => void, called each flicker so the caller can
 *                   re-render the pips while they're in the air
 * @param onSettled  () => void, when the last die stops
 * @param onDone     () => void, when the sheet has finished revealing
 *
 * Returns the timeline, or null when there is nothing to animate — callers
 * treat null as "go straight to the rolled state" rather than stranding the
 * player on a button that does nothing.
 *
 * Measured at CLICK time, never at mount: the panel is fully laid out by the
 * time anyone can press the button, so every rect is honest and there is no
 * load-order race to lose.
 */
export function runDiceRoll({ dice, cubes, sheet, faces, onSettled, onDone }) {
  const live = (dice || []).filter(Boolean);
  const spin = (cubes || []).filter(Boolean);
  if (!live.length) return null;

  playSfx(SFX.roll, { volume: 0.55 });
  const land = faces && faces.length ? faces : facesFor(0);

  const tl = gsap.timeline({
    defaults: { force3D: true },
    onComplete: () => {
      // Hand the elements back untransformed. Leaving an inline transform in
      // place would keep a composited layer alive per die for the rest of the
      // session — over a live WebGL scene, on desktop. The CUBES keep theirs:
      // that transform is which face is showing, not an animation artefact.
      gsap.set(live, { clearProps: "transform,willChange" });
      onDone?.();
    },
  });

  live.forEach((die, i) => {
    const at = i * STAGGER;
    // Thrown from off to the left. Pure transform/opacity: no layout property
    // is touched, so the 3D underneath keeps its frames.
    tl.fromTo(die, {
      x: -90 - i * 26, y: -34 + i * 12, scale: 0.72,
      opacity: 0, willChange: "transform",
    }, {
      x: 0, y: 0, scale: 1, opacity: 1,
      duration: TUMBLE, ease: "power3.out",
      onStart: () => playSfx(SFX.land, { volume: Math.max(0.2, LAND_VOL - i * LAND_DECAY) }),
    }, at);

    // The settle. A die that arrives and stops dead reads as a sprite being
    // positioned; the small overshoot is what makes it read as weight.
    tl.to(die, { scale: 1.06, duration: SETTLE / 2, ease: "power2.out" }, at + TUMBLE);
    tl.to(die, { scale: 1, duration: SETTLE / 2, ease: "power2.in" }, at + TUMBLE + SETTLE / 2);

    // THE TUMBLE, on the inner cube. It LANDS ON ITS RESULT — the tween's end
    // state is the target face's own rotation, offset by whole turns so it
    // spins rather than merely rotating into position. It must not end at 0 and
    // then be corrected: 0 is face 1, so that made every die flash the single
    // red pip before changing to its real face.
    //
    // `faces` comes from facesFor(), never the run seed, so a skip mid-air
    // still resolves to the same result the full roll would have shown.
    const cube = spin[i];
    if (cube) {
      const { rx, ry } = faceRot(land[i]);
      tl.fromTo(cube, {
        rotationX: rx - 360 * 2 - i * 55, rotationY: ry - 360 * 2 - i * 40,
        transformPerspective: 620, willChange: "transform",
      }, {
        rotationX: rx, rotationY: ry,
        duration: TUMBLE + SETTLE, ease: "power3.out",
        // No clearProps and no snap. gsap's final transform IS the resting
        // pose, and it matches what React's style prop would write, so the two
        // agree and a re-render changes nothing on screen.
        onComplete: () => gsap.set(cube, { willChange: "auto" }),
      }, at);
    }
  });

  const settledAt = (live.length - 1) * STAGGER + TUMBLE + SETTLE;
  tl.call(() => { onSettled?.(); }, null, settledAt);

  // The sheet writes itself in AFTER the dice stop, never during. Overlapping
  // them would make the roll look like it was decorating a result that was
  // already on screen, which is exactly backwards.
  if (sheet) {
    tl.fromTo(sheet,
      { opacity: 0, y: 10 },
      { opacity: 1, y: 0, duration: REVEAL, ease: "power2.out", clearProps: "transform" },
      settledAt + 0.05);
  }

  return tl;
}

/** Shared styles. Each surface concatenates this into its own <style>. */
export const DICE_CSS = `
.dice-tray { display:flex; gap:20px; align-items:center; justify-content:center;
  flex:none; perspective:600px; transition:opacity .5s ease; }
.dice-tray.is-spent { opacity:0.55; }

/* THE THROW owns this element's transform (gsap x/y/scale). */
.dice-die { position:relative; display:block; width:46px; height:46px; flex:none; }

/* THE TUMBLE owns this one. Two elements because one element has one
   transform, and the throw and the spin would otherwise overwrite each other. */
.dice-cube { position:absolute; inset:0; transform-style:preserve-3d; }

.dice-side { position:absolute; inset:0; display:grid;
  grid-template-columns:repeat(3,1fr); grid-template-rows:repeat(3,1fr);
  padding:6px; border-radius:8px; backface-visibility:visible;
  background:linear-gradient(150deg,#fdfffe,#dfeae6 72%,#c4d4cf);
  border:1px solid rgba(255,255,255,0.7);
  box-shadow:inset 0 1px 0 rgba(255,255,255,0.95),
    inset 0 -2px 6px rgba(0,0,0,0.16); }

.dice-pip { display:block; width:7px; height:7px; border-radius:50%;
  place-self:center; background:transparent; }
/* Warm near-black rather than #000, and the 1 and 4 in red — the traditional
   treatment, taken from the reference pen. Pure black pips read as printed
   dots; #331e18 reads as drilled and inked. */
.dice-pip.on { background:#331e18; box-shadow:inset 0 1px 1px rgba(0,0,0,0.55); }
.dice-pip.on.red { background:#e03e3e; }
/* The single pip on the 1-face is oversized. Same source, and it is the detail
   that most makes a die look like a die rather than a grid. */
.dice-pip.on.big { width:11px; height:11px; }

/* THE HOUSE'S DICE, NOT YOURS — the tray is never a button and never has a
   hover state, because the deal is fixed by the UTC date and cannot be
   re-rolled. Anything that invites a second click here is a lie. */
.dice-tray, .dice-die, .dice-cube { pointer-events:none; user-select:none; }

@media (prefers-reduced-motion: reduce) {
  .dice-tray { transition:none; }
}
`;
