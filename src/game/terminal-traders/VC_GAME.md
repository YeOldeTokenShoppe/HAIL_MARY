# The VC Game

*The game that ships on `/trade`. Written 2026-07-26. This supersedes
[CASE_TABLE.md](./CASE_TABLE.md) as the game design — that doc is 1,366 lines of
history across three pivots and is now ARCHIVE. [GENESIS.md](./GENESIS.md) still
governs the card set.*

**If this file passes 300 lines, that's the smoke alarm.**

---

## 1. The game

**One deal. One pitch. Three interruptions. Four people at the desk.**

John Barron brings you a deal. It's *his* deal — if you fund it, he gets paid.
He talks for about two minutes, making six claims. **Every fact he states is
true.** What you're judging is the inference he's selling on top of it.

You can interrupt him **three times**. Each interruption you either press *him*
— *"put a number on it"* — or **send a colleague**, and who you send is the
game:

| | | |
|---|---|---|
| **John Barron** | THE DEAL | always available, unlimited within the budget. Gets you only what he'd concede about himself. |
| **Detective Marisol** | THE MONEY | the CHAIN lane. **One use, all session.** |
| **Saint GR80** | THE PAPERWORK | the RECORD lane. **One use, all session.** |
| **Eugene** | THE READ | free, every claim, cannot be sent. Names the *shape*, then **the agenda**. |

An adviser is legal only in their own lane, and sending one costs **both** an
interruption and the adviser. Two resources for one action is what makes the
timing real: GR80 has three valid targets in a backdoor-fork and one use, and
the agenda tells you what's coming. Some claims are `SHAPE` — nobody's lane, so
they're Barron or nothing.

**Eugene's job is the agenda, and it took three tries to find it.** He shipped
saying *"That one's onchain. Marisol can settle it."* — word for word what the
lane band directly above him already said. Half his output restated the UI and
the other half was an adjective, so he read as a character with no role
(*"I still don't get Eugene's off-sides role"*, the third complaint in a day;
moving him twice never had a chance). Now his second sentence reports **how much
runway is left in this lane** — *"Two more paperwork questions after this one"*
vs *"Last money question you'll get. Spend Detective Marisol now or don't."*

That is the one fact nobody else on the floor supplies, and it converts the
game's stated core decision from a coin flip into a decision: you were spending
your one Marisol without knowing whether a better money question was coming.
It is **leak-free by construction** — `laneOutlook` counts lanes only, never
backing, never `discriminates`, never the branch, and a harness assertion pins
that two deals with opposite outcomes produce identical agendas.

An adviser goes and *looks*, so the answer lands on **their** board, not his:
either a receipt, or **NOTHING ON FILE** — an absence somebody independently
looked for, which is strictly stronger than his board simply staying dark. It is
the only way this game can prove a negative.

### He reacts to being caught

The session used to have no arc: six claims of equal weight, and he delivered
the sixth exactly as he delivered the first no matter what you'd caught him
doing. A rigged, voiced character used as a tape recorder.

`pressure(run)` scores what the room has done to him — **NOTHING ON FILE +2**
(an independent party found an absence), **black board +1** (he declined; still
deniable), **partial +1**, **a real receipt −1** (you checked him and he held
up, and he gets to enjoy that). Four bands: `COOL · BACKED · RATTLED ·
CORNERED`. The band drives an **aside** he delivers before his next claim, a
badge, and the claim panel's border colour — pink, cooling to cyan when he's
vindicated, heating to amber then red as the room turns.

**It cannot leak.** `pressure()` reads `run.outcomes` and nothing else — never
`deal.truth`, never the branch, never `discriminates` — so every input is a
finding you already have. It is your own evidence summarised back at you, the
way showing your own score is not a leak. Pinned three ways: a source grep, an
assertion that identical findings give identical pressure on a rug and a legit
deal, and one that no aside names a lane, a seat or an outcome. (It will still
*correlate* with truth, because a legit deal yields fewer catches. That
correlation is information you earned.)

The 18 lines are archetype-agnostic and live in `desk.js`, so a new archetype
adds none. He never apologises and never concedes — a salesman who folds is a
different and much less interesting character to have to read.

Then you call it: long, short, or flat. Then the truth.

### Why seats replaced cards

The card layer was cut 2026-07-27 on the author's own critique: *"for cards to
be justified, a player should have to choose which to play, swap cards, discard
and draw — which the player never does."* Correct. A three-card hand where all
three are always playable is a menu, not a hand. **The scarcity moved onto the
people**, where it was already dramatised by four rigged characters sitting in a
room, and *"who do I send, and on which claim?"* is a decision a hand of cards
was never actually asking.

Not one word of archetype prose was rewritten. The `sharp` block that used to be
a card's payoff is now an adviser's finding.

### Why this shape

The design before this one was an eight-screen CRT overlay that switched the 3D
scene off (`frameloop:'never'`) and rendered the four characters as static
tiles — twelve subsystems over three authored cases, and no moment-to-moment
verb. Three fixes, in order: **play happens in the room** (no overlay, the
characters are the interface); **one verb, under your thumb, while they're still
talking**; **nothing is memorisable** (outcomes are rolled, not authored).

---

## 2. The loop

| Beat | What happens |
|---|---|
| **THE DEAL** | An empty table and a deck. You press DEAL ME IN and five cards come off it — the deal face-down, then the four people at the desk. Only the deal turns over: the desk is the same four every session, so flipping them was ceremony for a non-event. |
| **THE FLOOR** | Six claims, one at a time. Each carries `FACT` (always true) + `SPIN` (the inference), a **lane band** naming who could settle it, and **Eugene's free read**. |
| **THE PRESS** | Three interruptions. Press him, or send the one colleague whose lane this is. |
| **THE CALL** | One slider, `SHORT ← FLAT → LONG`. Plain-English readout including what you lose if wrong. |
| **RESOLUTION** | Truth. On desktop the four stand up and play their real reactions; the summary is a lower third so it never covers them. |
| **THE AUTOPSY** | Two numbers — READ (did you press the hollow claims) and BOOK (P&L) — every chip flipped, and **the pattern named**. |

### The three press outcomes

| | You hear | His screen |
|---|---|---|
| **HARD** | number, source, and the caveat he hadn't volunteered | a receipt **stamps**, and stays |
| **SOFT** | a range and an honest hedge | grey half-receipt |
| **VIBES** | louder, faster, still no number | **stays black** |

On mobile the absence is something **you go and look at**: he answers holding
the frame, then stops — the board changes silently and the `HIS SCREEN` tab
pulses *cyan* (gold is the receipt colour; pulsing gold would announce a receipt
before you'd seen one) — and the verdict lands only when you arrive.

Two earlier shapes were wrong and the reasons generalise. Cutting on the press
put the board up as he started talking, so you heard the reply over a panel that
hadn't changed. Cutting when he finished fixed the timing but did the looking
for you, which is the one thing this beat exists to make you do.

**Nothing may name the outcome before the reveal.** The verdict copy, the
panel's border colour and the tab badge are all derivable the instant you press,
so each leaks by default and each is explicitly gated. Not looking is allowed —
it's the same forfeiting choice as not pressing.

---

## 3. Cards, after the cut

Cards are still the **visual vocabulary** — every face renders through the
existing `TradingCard` — but they are no longer a *mechanic*. Two types survive:

**PROJECT/TOKEN cards** — the deal. Instanced from an archetype, so not a
Genesis card; marked `PROSPECT`, edition reads `live deal`. Deliberately carries
**no art** — wearing its archetype's face would announce the read before he
spoke.

**CHARACTER cards** — the four at the desk. They are the seat buttons on the
floor: you click a person's card to send them.

**QUESTION cards are gone.** The eight-card pool and its seeded draw survive as
`press/hand.js`, which **nothing imports** — kept for one more session in case
the cut needs reversing, and deletable after that. The six shapes it tagged are
*not* gone: `UNSOURCED · POSITIONED · SELECTIVE_WINDOW · BORROWED_CREDIBILITY ·
UNFALSIFIABLE · SURVIVORSHIP` still classify every claim and are what Eugene
reads from.

The lanes that replaced them: `CHAIN` (Marisol) · `RECORD` (GR80) · `SHAPE`
(nobody). A claim's lane is **public from second zero** — the skill is
materiality and timing, *which claim inside a lane deserves the one use*, not a
lane map you memorise.

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
token is *usually* a rug and *sometimes* genuinely fine — which is why a perfect
read still shouldn't go to 100%, and therefore why the slider has a middle. Make
an archetype deterministic and correct play collapses to a binary, taking the
scoring kernel with it.

The exemplar coin defines the **archetype**, never this instance's outcome, or
the pattern library becomes a lookup table. Shown at the autopsy, where naming
the pattern is the teaching payload and the natural trophy hook.

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
   deal's name, ticker and stats until its card lands — headline, top bar and
   body copy included — or it announces the deal before it exists.
8. **The floor never issues an instruction the controller would reject.** The
   lane band and Eugene's read both take `run.advisersSpent`. They shipped
   without it and said *"only Detective Marisol can settle it"* on a claim where
   she was spent and two interruptions remained — an instruction `press()`
   discards as a no-op. Four assertions pin it.
9. **Animation reinforces, never informs.** No outcome may be readable from body
   language, and no reaction clip may fire before the reveal. Author's call, and
   it's what keeps new animation cheap: a clip can always be added, but it can
   never be load-bearing.

### The discipline rule

> **An idea ships only if the session resolver can score the session without
> reading the collection.** If it needs the collection passed in, it's a content
> request wearing a mechanic's costume, and the correct build is another deal.

It rejects eleven of the twelve subsystems that killed the last design (backers,
holdings, precedent, docket events, horizon dial, research overage, crowd odds,
a 4th press, a loss floor…) and permits unlimited new archetypes — zero code.

---

## 6. Architecture

**The controller is pure and renders nothing.** Two presentations sit over the
same run. A rule in a presentation is a bug.

```
game/terminal-traders/press/
  questions.js        SHAPES + BACKING + LANES + SEATS; canSend() legality
  desk.js             WHO SITS WHERE + every archetype-agnostic line bank
  pressRun.js         the controller: turn queue, press budget, resolution, settle
  instanceDeal.js     seed -> archetype, outcome, identity, exemplar coin
  dealCard.js         card faces for TradingCard
  archetypes/         backdoorFork.js, yieldMirage.js
  hand.js             ORPHANED — the cut card pool. Nothing imports it.

components/trade/press/
  pressUi.jsx         THE SHARED FLOOR — canPress, ClaimBody, AnswerBody,
                      SeatRow, Meter, Nav + one stylesheet
  PressSession.jsx    DESKTOP — positions the shared floor over the live room
  PressFlat.jsx       MOBILE + ?flat=1 — positions it in the CRT
  PressFigure.jsx     Barron's talking head (2-frame amplitude mouth)
  cardDeal.jsx        the opening deal — one choreography, both surfaces
  evidenceScreen.js   the receipt board, both surfaces

scripts/verify-press-run.mjs    87 assertions
```

**`desk.js` is the reason the four-character layer is cheap.** It holds ~40
lines of prose — Eugene's shape and lane reads, the eight adviser result lines —
that every archetype reuses. An archetype authors claims and **never** authors a
word for Eugene or for an adviser's dispatch, so archetypes 3 through 13 cost
nothing on this axis.

### The shared floor — why `pressUi.jsx` exists

Two hand-written copies of the same floor is how the surfaces drifted: **every**
desktop bug in the seat migration came from porting a *mechanic* without the
*state gating* that made it work elsewhere — CTA row swallowed, claim and answer
anchored at the same `bottom`, the seat row left ungated so a settled claim left
one unclickable tile as the brightest thing on screen, `canPress` defined on one
surface and referenced on both. Four bugs, one cause.

The gate, claim body, answer body, seat row, meter and nav now live in
`pressUi.jsx`, styled once; **each surface supplies only positioning.** The
containers deliberately did *not* move — desktop is an absolute column over a
live room, mobile a scroll region above a pinned dock with a deferred-reveal
beat desktop doesn't need. A prop only one caller passes probably belongs in
that caller's container.

### Desktop

Plays over the live temple. **`CyborgTempleScene.jsx` has zero edits** — the
receipt paints into the seat's existing shared canvas (`window.__screen2Canvas`,
created by `VideoScreens`) via the `evidenceActive` handshake. An earlier attempt
to bind its own texture to `Screen2` was invisible: those monitors are owned.
**Desktop is currently mute** — `PressSession` flips `onSpeechActive(true)` for
the speaking idle, then says nothing. See §8.

### Mobile

Inside the CRT the laptop zoom opens (`TradeLaptop` → `MobileTerminalGame`). No
3D. **Barron actually speaks** — `speakAdviserLine("JB", …)` → `/api/counsel-voice`,
with the `adviserMouth` RMS bridge driving a two-frame mouth
(`/barron-headshot.png` closed, `demon-headshot-upright-mouth.png` open), framed
as a live video feed. Plus gyro holofoil — tilt the phone, the foil moves.
`?flat=1` exposes this view at any width: buildable without a phone, and a
permanent fallback if the scene regresses.

**The floor's height contract — one scroller, three pinned rows.** Tabs, feed
and dock are fixed furniture; `.pf-read` is the only child that may grow. A new
row goes inside it or gets a height budget. Learned the hard way: every row was
`flex:none` in an `overflow:hidden` column, so under ~900px of viewport the dock
ran off the bottom and `LET HIM GO ON` / `CALL IT` were clipped — 839px of rows
in a 700px box. **The pitch had no exit.**

---

## 7. State

**Shipped:** both archetypes · seeded instancing · the deal · the four-seat desk
with lanes and adviser scarcity · `NOTHING ON FILE` · the shared floor · desktop
in-room play · mobile CRT view with voice + mouth · lower-third reveal · the
autopsy with the pattern card · 87 assertions green · `The VC Game` tile on the
`/trade` rail (default). The Case Table is parked behind `?classic=1` — intact,
not deleted; shipping one game was a deliberate call.

**Known, unfixed:**

- **The acceptance test has never been run.** Same seed, three presses on Barron
  vs. GR80 + Marisol + one Barron. *If run B doesn't feel like a different and
  better decision, the direction is wrong.* This is the gate on everything below.
- Desktop end-to-end is unverified past the copy paths: the receipt landing on
  the **adviser's** in-room monitor, `NOTHING ON FILE` in-scene, and the curtain
  call still firing. (Getting to the floor in an automated browser requires
  skipping the deal animation — gsap stalls in a background tab.)
- `press/hand.js` is orphaned. Delete it once the card cut is settled.
- 28 authored `miss` blocks in the archetypes are never read by `resolvePress` —
  card-era leftovers. Dead prose, not dead code.
- `STARTER_SET` grants 21 cards free per userId (`collection.js:10`). Harmless
  for trophies, fatal if trading ever ships.
- `PackReveal.jsx:139` renders `DUPLICATE — CRAFT LATER` against an unchecked
  box in `GENESIS.md:318`.
- A stray canvas click on desktop can unfocus the camera and it won't re-focus
  (re-sending an unchanged `externalFocusAgent` is a React bail-out). A re-park
  fix is designed but unbuilt; the `autoRotate` gate fixed the visible drift.

---

## 8. Voice — decided, not yet built

**Decision (author, 2026-07-27): live ElevenLabs, no recorded clips. SitePal on
desktop for real lip-sync; the amplitude mouth on mobile, which already works.**

### Why no clips — the counts that settled it

Barron's *reachable* lines, counted: 7 spins + 14 `generic` + 14 `sharp` per
archetype = **35 each, 70 total**, and **+35 for every archetype added**. The
archetype design exists so content scales without new code; pre-recorded clips
would re-couple content growth to studio time.

**Nine of those lines can never be clips at all** — they interpolate per-seed
variables (`auditor`, `name`, `days`, `apy`, `collapseDay`, `priorA/B`, `seed`,
`pump`). The auditor's name and the headline APY are rolled fresh daily, so
there is no fixed audio for them.

The only genuinely fixed set is the **8 adviser result lines** in
`desk.js` `ADVISER_LINES` (2 advisers × dispatch/found/partial/nothing). If a
human performance is ever wanted, that is the bounded session worth booking —
nothing else.

### What to build

1. **Marisol has no voice.** `/api/counsel-voice` `VOICES` has `JB` and `GR`
   only. Needs an ElevenLabs voice id for the Detective + an
   `ELEVENLABS_VOICE_MARISOL` env key. **This is the one real blocker.**
2. **Desktop → SitePal `sayText`, engine 14.** The pipeline already exists and
   already carries `{type:'text', text, voice, lang, engine}` through
   `window.__sitePalPendingSpeech` → `__sitePalSpeakPending` → `runSpeechRequest`
   (`page.js:283`). Three scenes, one per seat, in `SITEPAL_PROJECTION_CONFIG`:
   `Demon` 2774900 · `Detective` 2774916 · `Monk` 2774449.
   **Watch the scene swap** — one player, three scenes; a line for Marisol must
   wait for `__sitePalCurrentSceneId` to match, which `vh_sceneLoaded` handles.
   The TTS-removal note at `page.js:1978` is about **engine 1 (Acapela)** —
   em-dash 503s, voice-id mismatches. Engine 14 is the ElevenLabs path `/main`
   uses in production.
3. **Eugene stays on his own path** — `playUnicornBeat`, no SitePal mesh.
4. **Two voices per press.** The adviser reports the finding, *then* Barron
   reacts. That ordering is already in the answer panel and the audio must match
   it, or the reaction lands under the wrong name.
