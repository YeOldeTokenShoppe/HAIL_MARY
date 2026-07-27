# The VC Game

*The game that ships on `/trade`. Written 2026-07-26. This supersedes
[CASE_TABLE.md](./CASE_TABLE.md) as the game design — that doc is 1,366 lines of
history across three pivots and is now ARCHIVE. [GENESIS.md](./GENESIS.md) still
governs the card set.*

**If this file passes 300 lines, that's the smoke alarm.**

---

## 1. The game

**One deal. One pitch. Three interruptions.**

John Barron brings you a deal. It's *his* deal — if you fund it, he gets paid.
He talks for about two minutes, making six claims. **Every fact he states is
true.** What you're judging is the inference he's selling on top of it.

You can interrupt him **three times** and make him put a number on it. Whatever
he can actually back lands on his screen and stays there. Whatever he can't,
doesn't — and a confident man talking while his evidence board stays empty is
the whole product.

Then you call it: long, short, or flat. Then the truth.

### Why this shape

The previous design was an eight-screen CRT overlay that switched the 3D scene
off (`frameloop:'never'`) and rendered the four characters as static tiles. It
had twelve subsystems layered over three authored cases and no moment-to-moment
verb. The fixes, in order of importance:

1. **Play happens in the room.** No overlay. The characters are the interface.
2. **One verb, under your thumb, while they're still talking.** The input must
   land during the performance, not after it.
3. **Nothing is memorisable.** Outcomes are rolled, not authored.

---

## 2. The loop

| Beat | What happens |
|---|---|
| **THE DEAL** | An empty table and a deck. You press DEAL ME IN and the five cards come off it face-down — the deal, who's pitching, the three questions you drew — each turning over as it lands. All click-to-enlarge once landed. |
| **THE FLOOR** | Six claims, one at a time. Each drops a chip: `FACT` (always true) + `SPIN` (the inference). |
| **THE PRESS** | Three interruptions. Generic — *"put a number on it"* — or a card, which asks something sharper. |
| **THE CALL** | One slider, `SHORT ← FLAT → LONG`. Plain-English readout including what you lose if wrong. |
| **RESOLUTION** | Truth. On desktop the four stand up and play their real reactions; the summary is a lower third so it never covers them. |
| **THE AUTOPSY** | Two numbers — READ (did you press the hollow claims) and BOOK (P&L) — every chip flipped, and **the pattern named**. |

### The three press outcomes

| | You hear | His screen |
|---|---|---|
| **HARD** | number, source, and the caveat he hadn't volunteered | a receipt **stamps**, and stays |
| **SOFT** | a range and an honest hedge | grey half-receipt |
| **VIBES** | louder, faster, still no number | **stays black** |

On mobile a press **cuts** to his screen, so the absence is something you went
and looked at rather than something you failed to notice.

---

## 3. The three card types

Author's taxonomy, 2026-07-26. All render through the existing `TradingCard`.

**QUESTION cards** — a pool of eight, three dealt per session, one use each.
A card is a *sharper question*, never more information. It costs the same
interruption as the generic press, and **it can miss**: play it on a claim whose
weakness is a different shape and Barron gives you a true, confident, useless
answer — and you've spent it. There is no refund. That's what keeps cards an
edge you can misuse rather than a strictly-better button.

A card **never opens a new subject.** It interrogates a claim he raised. If
cards could introduce topics, the game becomes a hunt for hidden subjects rather
than a read on the ones in front of you.

Six shapes: `UNSOURCED · POSITIONED · SELECTIVE_WINDOW · BORROWED_CREDIBILITY ·
UNFALSIFIABLE · SURVIVORSHIP`.

**PROJECT/TOKEN cards** — the deal. Instanced from an archetype, so not a
Genesis card; marked `PROSPECT`, edition reads `live deal`. Deliberately carries
**no art** — wearing its archetype's face would announce the read before he
spoke.

**CHARACTER cards** — who's pitching. The four traders, straight through.

---

## 4. Archetypes — why nothing is memorisable

An archetype owns seven claim slots and all the prose. **The seed rolls the
outcome; the outcome only changes what he can PRODUCE when pressed.** Same six
questions, different answers. Each instance plays 6 of 7 slots, so which
question shapes are live also shifts day to day.

Two shipped, from `CASE_PATTERNS` in `cards.js`:

- **`backdoor-fork`** (74% rug) — hides a *mechanism*: an unaudited upgrade
  path. The tell is a scope boundary. Exemplar coin: **BlackPalm**.
- **`yield-mirage`** (68% rug) — hides an *accounting identity*: the yield is
  real, it's just paid from the inflows. The tell is that nobody can name where
  the money comes from without eventually saying "new deposits". Exemplar coin:
  **Ponzi Siren**.

Deliberately different silhouettes — learning one doesn't give you the other.

**The exception rate is load-bearing, not flavour.** A backdoor-fork-shaped
token is *usually* a rug and *sometimes* genuinely fine. That's why a perfect
read still shouldn't go to 100%, and therefore why the confidence slider has a
middle. Make an archetype deterministic and correct play collapses to a binary,
and the whole scoring kernel becomes decoration.

The exemplar coin defines the **archetype**, never this instance's outcome —
otherwise the pattern library becomes a lookup table. It's shown at the autopsy,
where naming the pattern is the teaching payload and the natural trophy hook.

---

## 5. Invariants — do not break these

1. **Truth is never for sale.** Every deal is solvable with zero cards. Enforced
   by the `loadBearing` flag: a decisive claim must be `HARD`, i.e. reachable on
   a free press. Linted per instance.
2. **Payout stays a proper scoring rule.** `casePnl(p, truth, STAKE)` is an
   affine transform of Brier, so honest reporting maximises expected P&L. The
   suite asserts this at every belief. **Fixed stake, single slider** — a
   conviction-coupled stake was tried and is provably improper (it peaks at
   `-4d/3` where honest is `-d`, i.e. it pays you to overstate). A loss floor
   breaks it the same way.
3. **`PRESSES = 3` is frozen.** Nothing ownable may read or write it.
4. **One door to the collection.** `resolvePress` and the settle path take no
   collection or loadout parameter, ever.
5. **No surface stat leaks the outcome.** Listing stats are asserted uncorrelated
   with truth; otherwise the optimal play is "skim the stats, skip the analysts".
6. **Plain language.** Every player-facing term must parse with no finance
   literacy. "Brier" and "diligence" both failed playtest. P&L, research, long /
   short / hold pass.
7. **Nothing names a card that isn't face-up.** The briefing withholds the
   deal's name, ticker and stats until its card lands, and the speaker's name
   until his does — headline, top bar and body copy all included. Printing them
   over an empty table announces the deal before it exists and spends the
   reveal the dealing beat is there to stage.

### The discipline rule

> **A card idea ships only if the session resolver can score the session without
> reading the collection.** If it needs the collection passed in, it's a content
> request wearing a mechanic's costume, and the correct build is another deal.

Tested against the twelve subsystems that killed the last design: it rejects
eleven (backers, holdings, precedent, docket events, horizon dial, research
overage, crowd odds, a 4th-press card, a loss-floor card…) and permits unlimited
new questions and archetypes — which need zero new code.

---

## 6. Architecture

**The controller is pure and renders nothing.** Two presentations sit over the
same run. A rule in a presentation is a bug.

```
game/terminal-traders/press/
  questions.js        SHAPES + BACKING enums — the game owns these, cards don't
  pressRun.js         the controller: turn queue, press budget, resolution, settle
  hand.js             the 8-card pool + seeded deal (MIN_LIVE = 2)
  instanceDeal.js     seed -> archetype, outcome, identity, exemplar coin
  dealCard.js         all three card faces for TradingCard
  archetypes/         backdoorFork.js, yieldMirage.js

components/trade/press/
  PressSession.jsx    DESKTOP — DOM over the live 3D room
  PressFlat.jsx       MOBILE + ?flat=1 — no WebGL, portrait-first
  PressFigure.jsx     Barron's talking head (2-frame amplitude mouth)
  cardDeal.jsx        the opening deal — one choreography, both surfaces
  evidenceScreen.js   the receipt board, both surfaces

scripts/verify-press-run.mjs    100 assertions
```

### Desktop

Plays over the live temple. **`CyborgTempleScene.jsx` has zero edits** — the
receipt paints into the seat's existing shared canvas (`window.__screen2Canvas`,
created by `VideoScreens`) through the `evidenceActive` handshake that
`EvidenceScreens.jsx` established. An earlier attempt to bind its own texture to
the `Screen2` mesh was invisible, because those monitors are already owned.

### Mobile

Renders inside the CRT the laptop zoom opens (`TradeLaptop` → `MobileTerminalGame`).
No 3D. **Barron actually speaks** — `speakAdviserLine("JB", …)` hits
`/api/counsel-voice`, and the `adviserMouth` RMS bridge drives a two-frame mouth
(`/barron-headshot.png` closed, `demon-headshot-upright-mouth.png` open), framed
as a live video feed.

**Mobile has better voice than desktop**, and this is the point: desktop is
limited to clips hand-uploaded to SitePal's Audio Manager (real-time TTS was
removed for cause), so it can't voice generated content. Mobile can voice all of
it. Also carries gyro holofoil — tilt the phone, the card foil moves.

`?flat=1` exposes the flat view at any width: buildable without a phone, and a
permanent fallback if the scene ever regresses.

---

## 7. State

**Shipped:** both archetypes · seeded instancing · the draw · all three card
types · desktop in-room play · mobile CRT view with voice + mouth · lower-third
reveal · the autopsy with the pattern card · 100 assertions green · `The VC Game`
tile on the `/trade` rail (default). The Case Table is parked behind `?classic=1`
— intact, not deleted; shipping one game was a deliberate call.

**Next, roughly in order:**

1. **The character shuffle.** The speaker's lens decides which claims they can
   back — Marisol produces onchain receipts cold but is weak on people, Barron
   the inverse. Same archetype, different blind spots. Turns the skill into
   *"whose expertise actually applies here?"* Cost: one voice pass per character
   per archetype.
2. **More archetypes.** Eleven of the thirteen `CASE_PATTERNS` reads are unbuilt.
   Pure content — no code. `serial-deployer` and `celeb-shill` are the next
   highest-contrast pair.
3. **Trophies.** Read a deal well → mint its exemplar coin into the binder,
   stamped with your call. Rails exist (`PackReveal`, `OwnBinder`, grant routes).
   Decoupled by design: trophies never touch the resolver.
4. **Daily + leaderboard.** `dailySeed()` already gives everyone the same deal;
   the read-side leaderboard API exists.

**Known, unfixed:**

- `STARTER_SET` grants 21 cards free per userId (`collection.js:10`). Harmless
  for trophies, fatal if trading ever ships.
- `PackReveal.jsx:139` renders `DUPLICATE — CRAFT LATER` against an unchecked
  box in `GENESIS.md:318`.
- A stray canvas click on desktop can unfocus the camera and it won't re-focus
  (re-sending an unchanged `externalFocusAgent` is a React bail-out). A re-park
  fix is designed but unbuilt; the `autoRotate` gate fixed the visible drift.
