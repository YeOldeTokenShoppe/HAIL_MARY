# The VC Game

*The game that ships on `/trade`. Written 2026-07-26. This supersedes
[CASE_TABLE.md](./CASE_TABLE.md) as the game design — that doc is 1,366 lines of
history across three pivots and is now ARCHIVE. [GENESIS.md](./GENESIS.md) still
governs the card set.*

**If this file passes 300 lines, that's the smoke alarm.**

**The north star, in the author's words (2026-07-28):** *"I am hoping for a nice
little engagement puzzle."* Not a social product, not a competitive ladder, not
a metagame. That sentence is why the daily deal, the leaderboard and the share
hook are all rejected below — each is a build-out for traction the game hasn't
earned, and each costs the player something now for a payoff that only exists at
scale. **Measure a proposal against it before measuring it against anything
else.** A fresh deal, four minutes, a pattern you didn't have before.

---

## 1. The game

**One deal. One pitch. Three interruptions. Four people at the desk, and a cat.**

John Barron brings you a deal. It's *his* deal — if you fund it, he gets paid.
He talks for about two minutes, making six claims. **Every fact he states is
true.** What you're judging is the inference he's selling on top of it.

You can interrupt him **three times**. Each interruption you either press *him*
— *"put a number on it"* — or **ask a colleague**, and who you ask is the
game:

| | | |
|---|---|---|
| **John Barron** | THE CHART | price, windows, momentum — and he's the one selling. **Unlimited** within the budget. |
| **Detective Marisol** | THE MONEY | money movement, wallet ages, unlocks. **One use, all session.** |
| **Saint GR80** | THE PAPERWORK | what the documents actually say. **One use.** |
| **Eugene** | THE STORY | narrative, reputation, who vouches for whom. **One use.** |
| **Virgil** | THE CAT · YOUR GUIDE | sits on the desk, has opinions, **cannot be asked anything**. Not a seat — see below. |

**EXPERTISE IS A GRADIENT, NOT A GATE.** Anyone can be sent at anything. The
lane decides **depth**:

- **in their lane** → the `sharp` block: the specialist finding, with the caveat
  the speaker hadn't volunteered
- **outside it** → the `generic` block: a true, shallow answer that mostly
  settles nothing, and they say so out loud

Both blocks already existed on every slot in every branch, so the change cost
**zero new archetype prose**.

The first cut made the lane a *permission* — off-lane sends were rejected as
no-ops, so two of four seats were dead on any claim and the row read as broken
buttons. That was the most-reported confusion in playtest, and both the lane
band and the free read had to be patched twice for telling players to do things
the controller would refuse. Author's reframing (2026-07-28): *"they each have
an area of expertise but can generalize too."*

The decision it produces is better. It is no longer "who is legal here", which
the UI can answer for you — it is **"is this claim worth my one specialist, or
will a shallow look do"**, which it can't. Three interruptions and three one-use
colleagues is a tight allocation.

Sending someone costs **both** an interruption and that colleague. A spent
specialist doesn't close a claim, it **caps** it, and every surface says so.

**A shallow look can never prove a negative.** `NOTHING ON FILE` requires both
that you sent somebody who isn't him *and* that it was their area. The wrong
specialist finding nothing is a fact about your choice, not about the deal, and
rendering it as the strong result would let you manufacture the game's most
damning outcome deliberately. Pinned by assertion.

**Every lane survives the cut.** A lane holding one slot is protected from the
6-of-7 shuffle — measured at 95 of 200 yield-mirage seeds leaving a specialist
with no deep target before this guard. They'd still be sendable, so nothing
would look broken; their expertise would just be silently decorative, which is
worse than an obvious failure.

### The fifth voice is a cat

**Virgil sits on the desk and cannot be sent anywhere.** He is not a seat, owns
no lane, and **never touches the resolver** — `virgil.js` reads run state and
returns two strings, and nothing in `pressRun` imports it. The game must be
fully playable and fully scoreable with him muted, which is exactly why muting
him is offered.

The free read used to be Eugene's, and that made him the one seat in four with a
permanent extra power. The asymmetry was reported three times, through three
different implementations — *"nothing happens when i click it"* (an unclickable
tile), *"I still don't get Eugene's off-sides role"* (moved beside his own
line), *"why does eugene have the special role?"* (given the agenda, still odd).
Each fix moved him; none worked, because the problem was never where he sat. **A
colleague with an exemption needs explaining, and an explanation in a design doc
is not an explanation at the table.**

Author's proposal, 2026-07-28: *"one option is to have a separate character,
like a cat, be the special friend that gives tips and advice."* That **dissolves**
the problem instead of justifying it. A cat is obviously not somebody you
dispatch to pull chain records, so nobody clicks him expecting a press — the
failure that started the whole thread becomes structurally impossible — and the
desk goes back to four seats, four lanes, one use each, **no exceptions**.
Eugene is a plain fourth seat now (SOCIAL, one use, his own board —
`__screen4Canvas`, which existed unused all along), and the older complaint
resolved itself on the way past: he can be in the product moment because he
finally has something to fetch.

The name was already yours — `fluffyCat.glb` is listed as "Virgil" in the
commented-out `/vigil` roster. Dante's guide through hell, on a page about
spotting frauds. Model is the 580KB `fluffyCat.glb`, **not** the 15MB
`FR80Cat.glb`, which would land on top of an already-heavy scene.

**He says two things, and only one of them can be switched off.**

- **THE AGENDA — always on.** *"Two more paperwork questions after this one"* vs
  *"Last money question you'll get. Deep look now, or never."* This is the one
  fact nobody else on the floor supplies, and it converts the game's stated core
  decision from a coin flip into a decision: you were spending your one Marisol
  without knowing whether a better money question was coming. Measured: on
  backdoor-fork's first claim it reads *"last one you'll get"* in 2000 of 2000
  seeds, and holding there forfeits the deal's decisive deep look.
- **THE TIP — off switch, and that is the point.** What *kind* of weak argument
  this is (*"Survivors only. Where are the rest?"*), never whether the claim is
  true. As a colleague's line it was either teaching or noise with no way to
  tell which. As a cat's tip it is training wheels with a legible off switch:
  *"Virgil stops chiming in"* is a difficulty setting in a way *"turn off
  Eugene"* never could be.

Returned **separately**, never concatenated into one italic sentence — that is
what trained the eye to skip the block and miss the actionable half.

The agenda is **leak-free by construction** — `laneOutlook` counts lanes only,
never backing, never `discriminates`, never the branch, and a harness assertion
pins that two deals with opposite outcomes produce identical agendas. Three more
pin that Virgil is not a seat and owns no lane, that the tips can be silenced
while the agenda cannot, and that a `LANES.SHAPE` claim reports what's checkable
at all rather than naming a lane.

Moving the read off a seat also killed a bug by construction: the agenda used to
be able to refer to its own speaker (*"and me was already spent"*, shipped in
192 of 400 yield-mirage seeds). **A cat is never the lane owner.**

Whoever you ask *pulls the record themselves*, so the answer lands on **their**
board, not his: a receipt, or **NOTHING ON FILE** — an absence somebody
independently looked for, strictly stronger than his board simply staying dark,
and the only way this game can prove a negative.

**"SEND" WAS THE WRONG VERB AND THIS DOC TAUGHT IT.** The floor said *WHO DO
YOU SEND?* and this section said colleagues *"go and look"*, both describing a
thing the game never shows: *"the other analysts don't physically leave their
desks — that's why 'send' seems weird to me"* (author, 2026-07-28). Correct, and
the archetype-agnostic prose had agreed all along — Marisol says *"Give me a
second. I'll pull it."*, GR80 says *"I have read it. One moment."* Nobody moves;
on a press it's the **camera** that crosses the room, not the character.

The row header is now **ASK A FOLLOW-UP**, which fixes two further things a
straight *WHO DO YOU ASK?* would not have:

- It reads as the **alternative to `LET HIM GO ON`**, which is the choice the
  beat is actually about. Players kept describing the game as *"press him or
  let him go on"* with the four-seat desk left out of the account entirely.
- **It doesn't demand an answer.** *"Who do you ask?"* implies you must pick
  one (author, same day) — and holding is frequently the *correct* move, since
  Virgil's whole job is telling you a better money question is still coming.
  A header that pressures you to spend on the claim in front of you teaches the
  opposite of the decision this game is built around.

It also encodes, in one word, a rule that had only ever lived in the source: a
press never opens a new subject, it interrogates the claim he **just made** from
a sharper angle. Barron keeps his own verb — you **press** the man selling you
the deal, you **ask** a neutral colleague — because that distinction is real.

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

The 14 lines are archetype-agnostic and live in `desk.js`, so a new archetype
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
| **THE FLOOR** | Six claims, one at a time. Each carries `FACT` (always true) + `SPIN` (the inference), a **lane band** naming who goes deepest on it, and **Virgil's read** — the lane's remaining runway, plus a tip you can switch off. |
| **THE PRESS** | Three interruptions. Send anyone at anything — their lane decides how deep they get, not whether they answer. |
| **THE CALL** | One slider, `SHORT ← FLAT → LONG`. Plain-English readout including what you lose if wrong. |
| **RESOLUTION** | Truth. On desktop the four stand up and play their real reactions; the summary is a lower third so it never covers them. |
| **POST-DEAL ANALYSIS** | Two numbers — READ (did you press the hollow claims) and BOOK (P&L) — every chip flipped, and **the pattern named**. Called THE AUTOPSY until 2026-07-28; an autopsy presumes a corpse, and roughly a third of these deals are legit, so it told a player who called it right that they'd lost. Internal names (`PHASE.AUTOPSY`, `deal.autopsy`) are unchanged. |

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

## 3. Cards are gone. It's dice now.

**Done, 2026-07-28 (author: no cards in this game at all — they're saved for a
2D TCG).** The mechanic was cut on 2026-07-27; this cut the *visual vocabulary*
too, which was the half still shipping. `TradingCard`, `dealCard.js` and
`cardDeal.jsx` are out of this game entirely and the Genesis layer goes to the
TCG untouched.

**The replacement metaphor is a roll of the dice** (author: *"a roll of the dice
is a better metaphor than playing cards"*), and it is what the game was doing
all along — `instanceDeal(seed)` rolls the archetype, the outcome, the identity,
the surface numbers and which 6 of 7 slots play. A dealt hand implied cards you
chose between. Dice imply what is true: something was rolled at you and you play
it.

**Three dice, not two.** A pair invites reading the *sum* — snake eyes, boxcars,
seven — and this game's players are already hunting for meaning in anything the
house shows them. Three has no canonical total.

**The pips are decoration and may never come from the run seed.** `facesFor()`
takes a tick counter; `diceRoll.jsx` does not import `instanceDeal`. If the
faces came off the PRNG that picks the archetype, the correlation would be found
long before the game deserved to be beaten — invariant 5, applied to the one
surface that looks most like it ought to mean something. **Numbered RPG dice
were considered and rejected for the same reason**: a d20 arrives with meaning
pre-attached, and a nat 1 in a game that's 74% rug would read as a tell whether
or not it was one.

**And the roll is real.** The deal is rolled fresh when you sit down —
`rollSeed()` — so pressing ROLL genuinely determines what you're pitched.

It didn't used to. The deal came from `dailySeed()`, the same one for everybody
until 00:00 UTC, which made the dice ceremony over a result decided at midnight:
*"if the deal is already predetermined for the day, then rolling the dice is
pointless"* (author, 2026-07-28). **Copy cannot fix a mechanic mismatch** — the
first attempt was a caption reading "THE HOUSE ROLLS ONCE A DAY", which is just
a more honest description of the same lie.

A LOCAL/DAILY mode split was built, then cut hours later once the daily's
justifications were audited and all but one belonged to the rejected
leaderboard (below). The survivor — a shared deal to talk about — is the Wordle
property and it's real, but it is **entirely latent until a share hook exists**,
which is a bet on traction: *"that seems like a build-out for the scenario where
the game gets lots and lots of traction and buzz — not likely. But I am hoping
for a nice little engagement puzzle."* A choice that gives the player nothing
teaches them that choices here don't matter, so the second button went.

`dailySeed()` is kept and unused — six lines, and the whole restore path if a
spoiler-free share ever lands (`OracleCard.jsx` and the Team Chat are the rails).
The tray is still never a button and has no hover state: one roll per sitting.

Real 3D dice — three.js + cannon-es rigid-body physics — were evaluated and
declined for now: a second `WebGLRenderer` over the live temple on desktop, a
second physics engine in a bundle that already vendors Rapier, and on mobile it
contradicts `PressFlat`'s no-3D premise on a page with a documented iOS GPU
crash. What was taken instead is the *pip treatment* from the reference pen
(MIT, Mant0u): red 1 and 4, warm near-black rather than `#000`, oversized single
pip. The dice are real CSS 3D cubes — six faces, `preserve-3d` — and on mobile
the gyro that used to drive card holofoil now tilts the tray.

This is the third and last step of the same retreat, and it's worth naming the
pattern: cards kept surviving as **decoration for a game that had stopped being
about them**. A card face is an expensive thing to look at — frame, foil,
edition line, art box — and it earns that cost when you own it, trade it, and
choose it from a hand. None of which happens here.

There is already a playtest failure logged against exactly this
(`pressUi.jsx:201`): the seat row rendered four `TradingCard`s and a player
described the whole game as *"i can either press him for a screen or let him go
on to his next point"* — a complete account with the desk left out of it, from
someone who had the desk on screen. **Four trading cards read as a cast list,
not as four buttons.** It was patched with a verb header and per-tile
sub-labels; the cards were the cause and stayed.

**What replaced the five render sites:**

| Was | Is |
|---|---|
| seat button wrapping a character card | **portrait tile** — `DESK[seat].portrait`, one path per seat |
| deal card hero in the opening beat | **the deal sheet** — a terminal dossier, sized to its own content |
| four character cards in the deal choreography | **portrait row**, plus Virgil introduced beside it |
| exemplar card at the autopsy | **pattern panel** — coin art as a plain framed illustration |
| the inspect zoom viewer | **gone** — nothing left to enlarge |

Two carried real weight. The **opening beat** was choreography built around
cards coming off a deck, so it was re-authored rather than deleted. The
**autopsy** still needs a trophy-shaped object, because naming the archetype is
the teaching payload — it keeps the coin's artwork, but as an illustration with
no frame, foil, edition line or rules box.

**Two freedoms the cut bought.** The hero column is no longer locked to
`TradingCard`'s 744×1038 portrait box, so the briefing's largest object stopped
being an empty dashed rectangle waiting for a card; and the copy column is now
capped at 62ch instead of running ~965px of monospace per line.

**What survived, and had to:** the deal's identity (name, ticker, stats,
`PROSPECT` framing) and the exemplar coin's name and note. Those are content,
not presentation — `instanceDeal` owns them. Invariant 7 is now a statement
about the **deal sheet** and reads *nothing names the deal before the dice
stop*; it still holds.

**The one remaining tie.** `instanceDeal.js` still calls `getCardById` and
`getCardArt` to build `deal.exemplar`. Three of the four fields it pulls are
plain data; only `art` is card-specific. Inlining the exemplar's name and note
into each archetype severs the last dependency — worth doing, not urgent, and
`questions.js:6` already states the rule it violates (*"nothing in this
directory may import from cards.js"*).

**QUESTION cards were already gone.** The eight-card pool and its seeded draw survive as
`press/hand.js`, which **nothing imports** — kept for one more session in case
the cut needs reversing, and deletable after that. The six shapes it tagged are
*not* gone: `UNSOURCED · POSITIONED · SELECTIVE_WINDOW · BORROWED_CREDIBILITY ·
UNFALSIFIABLE · SURVIVORSHIP` still classify every claim and are what Virgil's
tips read from.

The lanes that replaced them, one per seat: `CHAIN` (Marisol) · `RECORD` (GR80)
· `CHART` (Barron, who sells on the chart) · `SOCIAL` (Eugene). `SHAPE` is
retained for an archetype that wants a claim nobody specialises in, but **no
slot uses it today** — with four lanes the surface is covered, and "nobody can
settle this" is now carried by `BACKING.VIBES`, which is the honest place for
it: a property of the claim, not of who's in the room.
A claim's lane is **public from second zero** — the skill is
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
the pattern library becomes a lookup table. It is no longer rendered — the
post-deal screen shows the archetype's own TELL instead, because naming a second
token the player never met was a promise the screen couldn't keep.

### The number that justifies a new archetype

**Not the hit rate. The edge from recognition.** Measured in expected P&L per
deal over 8000 seeds:

| | base rate | blind (reports the base rate) | knows the archetype | **edge** |
|---|---|---|---|---|
| 2 archetypes | 71.5% | +4.61 | +4.71 | **+0.10** |
| 3 archetypes | 57.3% | +0.54 | +4.62 | **+4.08** |
| *perfect read* | | | **+24.99** | |

With two archetypes, recognising which one you faced was worth a tenth of a
point — **a game whose stated skill did not pay.** `anon-but-real` runs 70%
legit against the others' ~70% rug, and that inversion is what took it to 4.08.
Note the other column too: blind play got *worse* (4.61 → 0.54), because a
lopsided world is easy to score in once you know it's lopsided. The right third
archetype made the game harder for the uninformed and more rewarding for the
informed at the same time. **That is the test a fourth archetype has to pass.**

**A correction kept because it is an easy mistake to make twice.** The original
argument was *"blind SHORT is correct on 71% of deals"*. That is a **hit rate**,
and hit rate is not the score. `casePnl` is an affine transform of Brier, so
always-short-with-conviction earns **−16.83** per deal — the worst strategy
available, not an exploit. Under a proper scoring rule, being directionally
right most of the time is worth almost nothing if you can't say how confident to
be. **Measure expected P&L, never how often a heuristic points the right way.**

### Authoring rules — read before writing archetype #4

*Every one of these is a mistake already made once. The reasoning is in
[VC_GAME_ARCHIVE.md](./VC_GAME_ARCHIVE.md); the rules are here because this is
where you'll be looking.*

1. **`backing` is SLOT-LEVEL and never per-branch.** A claim either has a
   receipt to be had or it doesn't — a property of the claim, not of whether the
   deal is rotten. Authored per branch it *was* the leak that made the entire
   four-seat desk decorative: `resolvePress` zeroes every receipt on VIBES, so a
   VIBES-in-rug slot returned nothing to anyone, specialist included.
2. **`generic` is hoisted to the slot**, so the seller's shallow answer cannot
   differ by branch — there is only one copy of it. **Only the `loadBearing`
   slot may keep a per-branch `generic`**, because invariant 1 requires the
   decisive claim stay reachable on a free press, which means it must
   discriminate.
3. **A null `sharp` receipt in ONE branch only is legitimate and wanted.** It is
   what produces `NOTHING ON FILE`, the single way this game proves a negative.
   An assertion once *forbade* the pattern and silently killed the feature.
4. **Every lane a spendable seat owns needs ≥1 slot, and one needs ≥2.** Six of
   seven slots play, so a lane with a single slot is pinned by the `mustKeep`
   guard; get this wrong and a specialist is decoration for that session.
5. **Nothing visible may correlate with the archetype or the outcome.** Names
   come from the shared pool in `identities.js` — never author them per
   archetype. This failure has appeared three times in three costumes.
6. **`miss` blocks are dead.** `instanceDeal` doesn't assemble them and
   `resolvePress` never read them. Delete on sight.

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
   **"THE TAPE" FAILED IT ON 2026-07-28**, on the author: *"what does 'the tape'
   mean? I never quite got what it meant."* Ticker-tape slang — reading the tape
   is watching price and volume action. It was the only one of four lane labels
   that had to be *known* rather than read ("the money", "the paperwork", "the
   story" against "the tape"), and it sat on a seat tile, the lane band and in
   Virgil's mouth on every chart claim. Now **THE CHART**, matching the
   `LANES.CHART` enum. Barron still says "tape" in his own dialogue, where it's
   characterisation and the next sentence glosses it — the rule binds the UI,
   not the salesman.
   **The generalisation: a term can fail this invariant years after shipping,
   and the person who notices is the one who didn't write it.** Both catches
   this day came from the author reading his own finished screen, not from a
   playtest.
7. **Nothing names a card that isn't face-up.** The briefing withholds the
   deal's name, ticker and stats until its card lands — headline, top bar and
   body copy included — or it announces the deal before it exists.
8. **The floor never issues an instruction the controller would reject.** The
   lane band and Virgil's agenda both take `run.advisersSpent`. They shipped
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
  virgil.js           THE CAT — shape tips + the lane agenda. Not a seat, and
                      pressRun does not import it.
  pressRun.js         the controller: turn queue, press budget, resolution, settle
  instanceDeal.js     seed -> archetype, outcome, identity, exemplar coin
  archetypes/         backdoorFork.js, yieldMirage.js
  hand.js             ORPHANED — the cut card pool. Nothing imports it.
  deals/mrdn.js       ORPHANED — slice 1's hand-authored MERIDIAN deal,
                      superseded by archetypes. Nothing imports it.

components/trade/press/
  pressUi.jsx         THE SHARED FLOOR — canPress, ClaimBody, AnswerBody,
                      SeatRow, Meter, Nav + one stylesheet
  PressSession.jsx    DESKTOP — positions the shared floor over the live room
  PressFlat.jsx       MOBILE + ?flat=1 — positions it in the CRT
  PressFigure.jsx     Barron's talking head (2-frame amplitude mouth)
  diceRoll.jsx        THE ROLL — CSS 3D dice, one choreography, both surfaces.
                      Pips never come from the run seed.
  evidenceScreen.js   the receipt board, both surfaces

scripts/verify-press-run.mjs    109 assertions
```

**`desk.js` and `virgil.js` are the reason the character layer is cheap.**
Between them they hold every archetype-agnostic line on the floor: the lane
band, Barron's 14 pressure asides, the 15 adviser result lines (3 advisers ×
dispatch / found / partial / nothing / shallow), and Virgil's 18 shape tips and
agenda phrasings. An archetype authors claims and **never** authors a word for
Virgil or for an adviser's dispatch, so archetypes 3 through 13 cost nothing on
this axis.

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

**Shipped:** both archetypes · seeded instancing · the dice roll and the deal
sheet · the four-seat desk
with one lane each and adviser scarcity · Virgil and the switchable tips ·
`NOTHING ON FILE` · the shared floor · desktop
in-room play · mobile CRT view with voice + mouth · lower-third reveal · the
autopsy with the pattern card · 109 assertions green · `The VC Game` tile on the
`/trade` rail (default). The Case Table is parked behind `?classic=1` — intact,
not deleted; shipping one game was a deliberate call.

### THE ROOM, RESHAPED — design note, 2026-07-28

*Not built. This is the frame the next build should start from, and it arrived
by pulling threads rather than by planning, so it is written down before it
evaporates. It supersedes item 1 below.*

**The problem it solves.** John Barron is currently both the adversary and a
seat you can use, which is why he needs a special case everywhere:
`SPENDABLE_SEATS` excludes him, he alone is "unlimited", his tile alone says
PRESS instead of ASK, and — unnoticed until now — **his own lane is deeply
answerable for free**, because sending him at a CHART claim is in-lane and
costs no specialist, while every other lane costs one.

Author's resolution (2026-07-28): *"not sure why Barron would have a different
role than the other analysts. Barron probably specializes in leverage and
shorting and technical analysis. He's just another specialist, although somewhat
vice prone."* So the pitch goes to an **outsider**, and the desk becomes
symmetric.

```
OUR LADY      remote, unseen        surfaces the deal. You don't get to ask why this one.
   ↓
THE FOUNDER   projected hologram    pitches, gets paid if you fund. UNLIMITED presses.
   ↓
FOUR ANALYSTS at the desk, yours    Barron CHART · Marisol CHAIN · GR80 RECORD · Eugene SOCIAL
              one use each          + Virgil on the desk
   ↓
YOU           the fifth seat        call it
```

**Our Lady is the randomiser, and she was always canon.** Every attempt to stage
the roll as an OBJECT failed — three dice, blank dice, a wheel, a dual wheel —
because a VC meeting has no randomiser in it. It needs a **person**.
`council-chat/route.js:16` already establishes her as *"in the channel but NOT
in the room — nobody knows where she posts from"*, and `Lobby.jsx:48` already
tells the player they are *"the fifth seat at Our Lady of Perpetual Profit's
trading desk"*. The desk is hers, the four are her staff, and she sends work
down. She costs no model and no portal — a line arriving on the channel is
exactly the canon. **Her line may never editorialise on the deal**; the moment
her tone tracks the outcome she is the pitcher-leak wearing a habit. And never
"child" — seeker or pilgrim.

**The founder is a hologram, and that is what makes rotation affordable.** The
projector already exists dead-centre of the four workstations, throwing a
decorative globe above the monitor line. The monitors cannot host the pitch —
they are the evidence boards, and a receipt landing on a seat's own screen is
the payoff of the whole four-seat design. Projected also gives the page a
coherent ladder of presence: Our Lady absent, the founder an image, the analysts
bodies, Virgil on the desk, you behind the camera. Crucially a new founder is a
PORTRAIT plus prose, not a rigged character at a workstation — and hologram
scanline and flicker *hide* low-fidelity lip-sync rather than exposing it, so
the amplitude mouth `PressFigure` already drives is enough.

**Two biases the cast now teaches, for free.** Marisol is a detective, so players
will over-trust a deal she likes; Barron is vice-prone and short-biased, so they
will over-discount one he likes. Same lesson from opposite directions — *the
messenger's disposition is not evidence* — which is `BORROWED_CREDIBILITY`
operating across a whole session instead of one claim.

**Rolled independently of everything.** Founder must not correlate with
archetype OR outcome. If Marisol-only-pitches-legit the pitcher leaks the
answer; if a founder maps to an archetype it is the name-leak again (see
`identities.js`). This is the third time this exact bug has appeared today.

**What it costs.** Code is small — the pitcher special-case in `pressRun.js` is
already *"is this the pitcher?"* wearing Barron's name; rename it and add him to
`SPENDABLE_SEATS`. Content is the real bill: a founder cast, and **Barron's
`sharp` findings as a specialist, which do not exist** because archetypes
currently author his pitch prose instead. The 14 pressure asides are in his
voice and move to the founder — mostly generic enough to survive, worth
re-reading.

**Delete on the way through:** `diceRoll.jsx` and the roll beat. The arrival
replaces it — your next appointment is here, `SEND THEM IN ▸`, which is diegetic,
implies a queue, and stages nothing false about variety.

### The 1/10 hit rate — half of it is free, half is a trap

*Author, 2026-07-28: "we may only have a 1/10 hit rate on projects, but they'll
fail for different reasons, not just because they're legit or not."*

**THE REAL INSIGHT IS THAT THERE ARE TWO AXES, AND THE GAME WELDED THEM
TOGETHER** (author: *"I was going to say 50/50 but that's not realistic. Most
projects fail, even if well-intentioned."*):

|  | did it work? |
|---|---|
| **were they honest?** | independent of it |

`truth: 1 / 0` reads as rug/legit, and `RESOLUTION` quietly makes `legit` mean
*succeeded* — so the only way to lose money in this game is to be cheated. That
is false about the world and it is the reason no single number felt right: 50/50
prices honesty, 1/10 prices success, and they are not the same question.

**The desk can only answer one of them, and it is already the right one.**
Marisol can tell you whether the money moved as claimed; GR80 can tell you what
the audit covered. **Nobody at that desk can tell you whether the market will
show up.** So the player's call is *am I being told the truth* — which means the
SCORING AXIS IS ALREADY CORRECT and only the narration is wrong.

That makes "most projects fail" free. It becomes a fact about the world rather
than a change to the base rate you're graded against:

- **`legit` splits into outcomes, not one outcome.** Ran out of runway,
  out-competed, the team split, the market never showed — and occasionally, it
  worked. All of them are still a **correct LONG call**, because the claims held
  up and that is what you were asked to judge.
- **`rug` keeps its meaning.** Something was hidden behind the claims and the
  desk could have found it.

**The teaching payload this unlocks is the best one available here: a good
decision and a bad outcome are not the same mistake.** A player who funds an
honest project that dies deserves to be told, in as many words, *you read it
right, it failed anyway, and that is not the error you think it is.* Separating
process from outcome is the deepest thing a calibration game can teach, and this
is the only place in the design where it can be said out loud.

**One mismatch to handle deliberately.** If a `legit` deal fails, P&L still pays
the LONG call — the score says you won while the story says it died. Do not
paper over it; **say it**. That gap IS the lesson, and the resolution copy
should name it rather than let the player think the numbers glitched. Anything
else and BOOK quietly re-teaches outcome-chasing, which is what the proper
scoring rule exists to prevent.

**The trap: making 1/10 the actual base rate.** A realistic venture hit rate
makes blind PASS correct 90% of the time — and while hit rate is *not* the score
(see §4), a base rate that lopsided is one an uninformed player can bank without
reading: at 71.5% rug, blind base-rate reporting earned **+4.61** per deal
against a perfect read's +25, and archetype recognition was worth **+0.10**.
Push it to 90% and the gap the game is built on closes further. Real VC survives its hit
rate only through **asymmetric payoffs**: nine 1x losses against one 100x
winner. This game has `STAKE = 25`, fixed, and `casePnl` is an affine transform
of Brier — symmetric by construction. Power-law payoffs would end properness
(invariant 2) the same way the conviction-coupled stake did.

**If it is ever wanted, the shape is two numbers, which the autopsy already
has.** READ becomes *calibration* (proper, Brier) and BOOK becomes *venture
returns* (power-law, honest to the fiction) — so the game can teach both "be
calibrated" and "venture math means funding things that probably fail" without
either corrupting the other. That is a scoring-kernel redesign, not an
afternoon, and it needs its own note before a line of it is written.

**Next, roughly in order** *(dropped from this doc in the seat rewrite and
restored 2026-07-28 — the roadmap is the point of §7, not just the defect list):*

1. **The rotating pitcher — "will other characters pitch?"** Yes, and it is the
   biggest content lever there is: it multiplies both archetypes by the number
   of speakers. `claim.speaker` already exists in `instanceDeal` — hardcoded
   `"demon"`, read by nothing. **The lane-coverage blocker is already gone** —
   it was the reason this sat behind a redesign, and the 2026-07-28 restructure
   dissolved it in passing. All four seats now own exactly one lane (Barron
   CHART, Marisol CHAIN, GR80 RECORD, Eugene SOCIAL), so whoever pitches is
   simply excluded, the other three still cover theirs, and **the pitcher's own
   lane becomes unsettleable**: the only person who could verify it is the one
   selling you the deal. That is emergent rather than authored, which is better
   than the old `SHAPE` tag. Solvability survives — `loadBearing` claims are
   HARD, i.e. answerable by pressing the pitcher directly, so the free press
   still reaches every verdict.
   What remains is **prose and wiring**: ~35 lines of `generic`/`sharp` per
   speaker per archetype, plus reading `claim.speaker` on both surfaces
   (portrait, voice, and the answer panel's byline).
2. **More archetypes.** Eleven of the thirteen `CASE_PATTERNS` reads are
   unbuilt. Pure content — no code. `serial-deployer` and `celeb-shill` are the
   next highest-contrast pair.
3. **Let Virgil be wrong.** The tips are currently an oracle that never
   misreads, which makes them a hint system with a face on it. A pattern-matcher
   who *misreads* at the archetype's own exception rate is a character. Leak-safe
   as long as his confidence tracks the base rate and never the branch.
   **The cat makes this cheaper than it was when the read belonged to a
   colleague** — a specialist you dispatched being wrong undermines the seat
   economy, whereas a cat being wrong about vibes costs nothing structural, and
   the tips already have an off switch for anyone who'd rather not gamble on
   him. Note the ordering constraint: this only reads as character if the tip
   is *sometimes* wrong; make him wrong on the agenda and you have broken the
   one number the seat decision rests on. **The agenda must stay exact.**
4. **Trophies — and the collectible is the ARCHETYPE, not a coin** (author,
   2026-07-28: *"i like having a collection of archetypes. Maybe these are
   collectible as trophies."*). Read a deal well → the PATTERN goes into your
   collection, stamped with your call. Rails exist (`PackReveal`, `OwnBinder`,
   grant routes). Decoupled by design: trophies never touch the resolver, so
   this passes the discipline rule.

   This supersedes the previous plan — mint the deal's *exemplar coin* — which
   was quietly reintroducing the thing §3 just removed: a Genesis card, a
   different token, pointing at the 2D TCG. **You collect what you've learned to
   recognise**, which is what this game actually teaches, and the set is the
   thirteen `CASE_PATTERNS` rather than a parallel coin set.

   Four things fall out of it, and they're why it's the better design:

   - **It gives the thirteen a purpose.** Eleven are unbuilt names today. As a
     collection they have a visible shape — *2 of 13* — and every new archetype
     is both content and a collectible for zero extra code.
   - **It answers "why come back on day two"** (item 5) without persistence of
     P&L. The collection is the thing that survives the session.
   - **It kills the last cards.js dependency.** `deal.exemplar` exists *only*
     for the old trophy plan; nothing renders it since the tell replaced it.
     Drop it and `instanceDeal.js` stops calling `getCardById`/`getCardArt`,
     which is the import `questions.js:6` forbids.
   - **It makes a deleted line true.** The post-deal panel used to open
     *"YOU'VE SEEN THIS SHAPE BEFORE"*, cut for being false on a first play.
     Once the archetype is a thing you own, the claim is accurate and *earned* —
     show it only when the pattern is already in the collection, and it becomes
     a recognition beat instead of an assumption.
5. **Persist the collection and your own book — NOT a leaderboard.** Today BOOK
   resets to 100 every session, so nothing you do survives the tab and there is
   no reason to come back on day two. What should persist is (a) which
   archetypes you've collected and (b) your own cumulative book, shown as a
   personal curve. **A daily leaderboard is explicitly rejected below** — it
   ranks one realization rather than an expectation, which pays you to
   overstate. Ranking, if it ever ships, has to be cumulative over a season.

**Considered and declined: a DAILY LEADERBOARD** (2026-07-28, author: *"if this
game isn't suited to rankings, let's call that out"*). It isn't, and the reason
is invariant 2 arriving through a side door.

The payout is proper **in expectation** — the harness asserts *honest reporting
maximises expected P&L at every belief*. A daily leaderboard does not rank on
expectation. It ranks on **one realization**, and those come apart:

| | reports | tops a one-deal board |
|---|---|---|
| calibrated player | p = 0.74, their true belief | when the deal rugs *and* nobody went higher |
| reckless player | p = 0.99 | **whenever the deal rugs — ~74% of days** |

Maximising `E[P&L]` means reporting honestly. Maximising `P(top of today's
board)` means going to the extreme and hoping. On a backdoor-fork day the deal
is a rug 74% of the time, so **roughly three days in four the reckless player
posts the higher number**. The calibrated player wins on average — but a daily
board never shows the average, and what players take from a leaderboard is
"do what the top row did".

That is precisely the defect that killed the conviction-coupled stake
(*"it pays you to overstate"*), and precisely what disqualified the live price:
*the score is currently a pure function of calibration, and price movement makes
it calibration plus luck.* **A one-deal-per-day leaderboard is calibration plus
luck, ranked on the luck.** It would also collapse fast at two archetypes, where
the read is memorised within a week and only the luck term is left.

The rail exists and is genuinely complete — `POST /api/tcg-docket-reward` writes
one atomic claim per user per seed (a day really is one shot),
`GET /api/tcg-docket-leaderboard` ranks it, `Standings.jsx` renders it. Not
wiring it is a **choice**, not a gap.

**And the daily deal went with it.** Rejecting the ranking removed three of the
daily's four justifications at a stroke (fairness, anti-reroll-fishing, BOOK
continuity), leaving only "a shared thing to talk about" — which needs a share
hook nobody has built. Rather than keep a mode whose reason had been deleted, it
was cut the same day; §3 has the detail. **This is the shape of the whole
session: a subsystem outlives its justification and has to be re-audited when
the justification goes.** Cards, the exemplar coin and the daily all died that
way within a few hours of each other.

What ranking IS suited to, if it ever comes back, in order:

1. **The archetype collection** (§7 item 4) — measures what you've learned to
   recognise, which is what this game teaches. Completion, not competition:
   nobody loses for you to win, and it has no properness problem because it is
   not a score.
2. **Cumulative P&L over a season.** Proper — the luck term averages out and
   calibration wins over enough deals. Needs real persistence, and it is not
   worth much until there are more than two reads.
3. **Your own book over time.** A personal curve, not a ranking. *"Twelve deals
   in, up 31"* is honest feedback and needs no comparison to anybody.

**Considered and declined: a live/moving market price** (author, 2026-07-28).
It has only two possible relationships to the truth and both are bad. Correlated,
it leaks and the optimal play becomes "watch the number, skip the room" — the
exact failure invariant 5 exists to prevent. Uncorrelated, it is noise dressed
as signal, and a ticking number out-competes the argument for attention, which
is the one thing the session cannot afford. If it ever touched P&L it would also
end properness: the score is currently a pure function of calibration, and price
movement makes it calibration plus luck — the defect that got the
conviction-coupled stake rejected.

The lesson underneath it is worth having and is nearly free: Barron owns THE
TAPE, and `chart` / `apy` are already unsettleable-by-anyone claims. Naming that
at the autopsy teaches "price movement is not evidence" as content, with no live
variable to misfire.

**Worth building, from the same conversation: a FACE-DOWN CLAIM.** One claim per
session whose LANE is hidden until you spend an interruption on it — you gamble
a specialist blind. No resolver change. The honest cost: it fights the
deliberate rule that lanes are public from second zero (§3), which exists so the
skill is timing rather than a memorised lane map. A real trade, not a freebie.

**And the missing dimension is persistence, not a variable.** Nothing survives a
session — BOOK resets to 100 and the archetype you just learned to read is
forgotten the moment you close the tab. That is where "dynamic" pays: across days,
not inside four minutes. See item 5 above.

**Known, unfixed:**

- The SUBJECTIVE half of the acceptance test still hasn't been run: same seed,
  three presses on Barron vs. the desk. *If run B doesn't feel like a different
  and better decision, the direction is wrong.* The objective half now passes
  (§8), so it is finally worth running.
- Desktop end-to-end is unverified past the copy paths: the receipt landing on
  the **adviser's** in-room monitor, `NOTHING ON FILE` in-scene, and the curtain
  call still firing. (Getting to the floor in an automated browser requires
  skipping the deal animation — gsap stalls in a background tab.)
- `press/hand.js` and `press/deals/mrdn.js` are both orphaned — the cut card
  pool and slice 1's hand-authored MERIDIAN deal. Delete once the card cut is
  settled.
- **Virgil has no body yet.** He is a portrait (`/cameo_kitty.webp`) and two
  lines of text on the floor; `VIRGIL.model` points at `/models/fluffyCat.glb`
  and nothing loads it. The desk is where he sits — an in-scene cat is the
  cheapest character on the floor, because he has no lane, no lip-sync and no
  reaction clip that could leak an outcome (invariant 9).
- The harness still labels five Virgil assertions as *"Eugene's read …"* and
  imports `agenda as eugeneAgenda`. Tests pass and test the right thing; the
  names are pre-cat.
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


## 8. History lives in the archive

The acceptance-test post-mortem that reshaped `backing` and `generic` moved to
[VC_GAME_ARCHIVE.md](./VC_GAME_ARCHIVE.md) on 2026-07-28. **The rules it
produced are not in the archive** — they're in §4 under *Authoring rules*, which
is where anyone writing an archetype will actually be looking. The archive keeps
the argument; this file keeps the game.

---


## 9. Voice — decided, not yet built

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

The only genuinely fixed sets are the **15 adviser result lines** in `desk.js`
`ADVISER_LINES` (3 advisers × dispatch/found/partial/nothing/shallow) and
Barron's **14 pressure asides**. If a human performance is ever wanted, those 29
lines are the bounded session worth booking — nothing else.

**Virgil is deliberately not on this list.** His 18 tips and the agenda's
generated phrasings are the one bank that should probably never be spoken at
all: he is a cat, the agenda is a *readout* rather than dialogue, and text is
also what makes the off switch instant. A purr or a chirp on the tip is the
whole audio budget he needs.

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
