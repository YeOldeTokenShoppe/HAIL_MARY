# VC_GAME — ARCHIVE

*Post-mortems and superseded reasoning lifted out of [VC_GAME.md](./VC_GAME.md)
so that file can go back to describing the game as it is rather than how it got
here. Nothing in this file is current design. It is kept because the REASONS
are load-bearing — several of these mistakes are the kind that get made twice,
and a rule with its argument attached survives contact with a future rewrite in
a way a bare assertion does not.*

*Rules that came out of these episodes and are still in force live in VC_GAME.md
§4 under "Authoring rules". If the two ever disagree, VC_GAME.md wins.*

**The full 1,006-line predecessor of VC_GAME.md — every argument at its original
length — is preserved in git:**

```
git show 039a015:src/game/terminal-traders/VC_GAME.md
```

*It was rewritten to a ~300-line spec on 2026-07-29 because spec and design
journal had been welded into one file. What follows is the journal half,
condensed to the reasoning that would otherwise be re-litigated.*

---

## 8. The acceptance test — failed, then fixed

**2026-07-28. The test the whole redesign rests on, run for the first time, and
it failed.** Measured across both archetypes: on **14 of 14 slots** the
`generic` block and the `sharp` block discriminated *identically* between the
rug and legit branches. Sending a specialist told you exactly as much about
which branch you were in as pressing the seller — more detail, better drama, no
better verdict. And because Barron is unlimited and lane-free while the
specialists are one-use and lane-locked, **three presses on him weakly dominated
the entire four-seat desk.**

**The cause was one field in the wrong place.** `backing` was authored PER
BRANCH — `VIBES` when rug, `HARD` when legit — and `resolvePress` zeroes every
receipt on VIBES. So the rug branch returned nothing to *anyone*, specialist
included: the whole signal lived one level above where depth could reach it.
Rewriting the receipts alone would not have touched it.

**The fix, and why it also improves the fiction.** `backing` and `generic` are
both hoisted to the SLOT. A claim either has a receipt to be had or it doesn't —
that's a property of the claim, not of whether the deal is rotten — and the
seller's shallow answer is now one shared script that *cannot* differ by branch,
because there is only one copy of it. He is confident, technically true, and
stops exactly short of the question that settles it, which is what selling is.
Previously he handed you the evidence against his own deal.

Measured after (500 seeds/archetype):

| | seller can settle | specialists can settle | route A lands | route B lands |
|---|---|---|---|---|
| backdoor-fork | 4.22 → **1.00** | 4.22 | 3.00 → **1.00** | **2.22** |
| yield-mirage | 5.28 → **2.00** | 5.28 | 3.00 → **2.00** | **2.28** |

Harness: `scratchpad/acceptance.mjs`, a session-scoped scratch file that is
**gone** — reconstruct it from the five assertions below if the measurement is
ever wanted again. Those five now pin the result permanently in
`verify-press-run.mjs` —
backing is never per-branch; no non-loadBearing slot lets the seller give away
the branch; the loadBearing claim IS still free (invariant 1); specialists must
settle *strictly more* than the seller; and at least one claim must let a
specialist prove a negative.

**One regression the fix caused, and the assertion that caused it.** Replacing
every null rug receipt with a documented-absence receipt killed `NOTHING ON
FILE` outright — it fired nowhere in backdoor-fork and in *both* branches of
yield-mirage, carrying no information. My own assertion ("every non-VIBES slot
returns a real deep receipt in BOTH branches") had forbidden the very pattern
that produces it. A null **sharp** receipt in one branch only is legitimate and
discriminating, because `generic` still supplies the shallow answer. Restored on
`ops` and `team`, where the absence *is* the finding, and the assertion now
requires it rather than banning it.

**Three content contradictions caught by adversarial verification**, all in
fields the authoring pass had been told not to touch: `stake`'s floor FACT
("same terms as you'd get") pre-answered the question the deep look exists to
settle; `apy`'s rug finding was arithmetically incompatible with the shared
generic pinning a realised trailing-30 rate; and `withdrawals`' rug answer key
described a test nobody had run, which the specialist can now run.

**`miss` blocks are now fully dead** — `instanceDeal` no longer assembles them
and `resolvePress` never read them. Delete on sight.

---

## 9. Why the free read became a cat

The free read used to be Eugene's, which made him the one seat in four with a
permanent extra power. The asymmetry was reported **three times, through three
different implementations** — *"nothing happens when i click it"* (an unclickable
tile), *"I still don't get Eugene's off-sides role"* (moved beside his own line),
*"why does eugene have the special role?"* (given the agenda, still odd). Each
fix moved him; none worked, because the problem was never where he sat. **A
colleague with an exemption needs explaining, and an explanation in a design doc
is not an explanation at the table.**

Author's proposal, 2026-07-28: *"one option is to have a separate character, like
a cat, be the special friend that gives tips and advice."* That **dissolves** the
problem instead of justifying it. A cat is obviously not somebody you dispatch to
pull chain records, so nobody clicks him expecting a press — the failure that
started the thread becomes structurally impossible — and the desk goes back to
four seats, four lanes, one use each, no exceptions. Eugene became a plain fourth
seat with his own board (`__screen4Canvas`, unused all along), and the older
complaint resolved itself: he can be in the product moment because he finally has
something to fetch.

Moving the read off a seat also killed a bug by construction: the agenda used to
be able to refer to its own speaker (*"and me was already spent"*, in 192 of 400
yield-mirage seeds). **A cat is never the lane owner.**

## 10. The lane was a gate before it was a gradient

The first cut made a lane a **permission** — off-lane sends were rejected as
no-ops, so two of four seats were dead on any claim and the row read as broken
buttons. Most-reported confusion in playtest, and both the lane band and the free
read had to be patched twice for telling players to do things the controller
would refuse. Author's reframing: *"they each have an area of expertise but can
generalize too."*

The resulting decision is better. It is no longer "who is legal here", which the
UI can answer for you — it is "is this claim worth my one specialist", which it
can't. And the change cost **zero new archetype prose**, because both blocks
already existed on every slot in every branch.

## 11. "SEND" was the wrong verb, and the doc taught it

The floor said *WHO DO YOU SEND?* and the doc said colleagues *"go and look"* —
both describing a thing the game never shows: *"the other analysts don't
physically leave their desks — that's why 'send' seems weird to me"* (author,
2026-07-28). The archetype-agnostic prose had agreed all along: Marisol says
*"Give me a second. I'll pull it."*, GR80 says *"I have read it. One moment."*

`ASK A FOLLOW-UP` fixed two further things a plain *WHO DO YOU ASK?* would not:
it reads as the alternative to `LET HIM GO ON` (players kept describing the game
as "press him or let him go on" with the desk left out entirely), and **it
doesn't demand an answer** — holding is frequently correct.

## 12. The three-step retreat from cards

1. **The mechanic**, cut 2026-07-27 on the author's own critique: *"for cards to
   be justified, a player should have to choose which to play, swap cards,
   discard and draw — which the player never does."* A three-card hand where all
   three are always playable is a menu, not a hand. The scarcity moved onto the
   **people**, where four rigged characters already dramatised it.
2. **The visual vocabulary**, cut 2026-07-28: *"no cards in this game at all —
   they're saved for a 2D TCG."* There was already a playtest failure logged
   against exactly this (`pressUi.jsx:201`): the seat row rendered four
   `TradingCard`s and a player described the whole game as *"i can either press
   him for a screen or let him go on to his next point"* — a complete account
   with the desk left out, from someone who had the desk on screen. **Four
   trading cards read as a cast list, not four buttons.**
3. **The exemplar coin as trophy**, cut in favour of collecting archetypes.

The pattern worth naming: cards kept surviving as **decoration for a game that
had stopped being about them.** A card face is an expensive thing to look at —
frame, foil, edition line, art box — and it earns that cost when you own it,
trade it, and choose it from a hand. None of which happens here.

Two freedoms the cut bought: the hero column stopped being locked to
`TradingCard`'s 744×1038 portrait box (the briefing's largest object had been an
empty dashed rectangle waiting for a card), and the copy column is now capped at
62ch instead of running ~965px of monospace per line.

## 13. The dice, and why the randomiser has to be a person

Cards were replaced with **three dice** (author: *"a roll of the dice is a better
metaphor than playing cards"*) — three, not two, because a pair invites reading
the *sum*, and this game's players hunt for meaning in anything the house shows
them. The pips came from a tick counter, never the run seed; numbered RPG dice
were rejected because a d20 arrives with meaning pre-attached and a nat 1 in a
74%-rug game would read as a tell whether or not it was one.

**The roll also had to be real.** The deal originally came from `dailySeed()` —
the same for everybody until 00:00 UTC — which made the ceremony a lie: *"if the
deal is already predetermined for the day, then rolling the dice is pointless"*
(author). **Copy cannot fix a mechanic mismatch**; the first attempt was a caption
reading "THE HOUSE ROLLS ONCE A DAY", which is just a more honest description of
the same lie. `rollSeed()` replaced it.

**And then the dice went too.** Every attempt to stage the roll as an OBJECT
failed — three dice, blank dice, a wheel, a dual wheel — because a VC meeting has
no randomiser in it. **It needs a person**, and Our Lady was always canon for it.
This is why the enigma machine must stay *transmission*, never selection: a
machine that picks deals is this same failure returning in a fifth costume.

## 14. Rejected: a daily leaderboard

*2026-07-28, author: "if this game isn't suited to rankings, let's call that
out."* It isn't, and the reason is invariant 2 arriving through a side door.

The payout is proper **in expectation**. A daily leaderboard does not rank on
expectation — it ranks on **one realization**, and those come apart:

| | reports | tops a one-deal board |
|---|---|---|
| calibrated player | p = 0.74, their true belief | when the deal rugs *and* nobody went higher |
| reckless player | p = 0.99 | **whenever the deal rugs — ~74% of days** |

Maximising `E[P&L]` means reporting honestly. Maximising `P(top of today's
board)` means going to the extreme and hoping. **Roughly three days in four the
reckless player posts the higher number.** The calibrated player wins on average
— but a daily board never shows the average, and what players take from a
leaderboard is "do what the top row did". That is precisely the defect that
killed the conviction-coupled stake.

The rail exists and is complete — `POST /api/tcg-docket-reward` writes one atomic
claim per user per seed, `GET /api/tcg-docket-leaderboard` ranks it,
`Standings.jsx` renders it. **Not wiring it is a choice, not a gap.**

What ranking IS suited to, in order: (1) the archetype collection — completion,
not competition, no properness problem because it isn't a score; (2) cumulative
P&L over a season, where the luck term averages out; (3) your own book over time,
a personal curve needing no comparison to anybody.

**And the daily deal went with it.** Rejecting the ranking removed three of the
daily's four justifications at a stroke (fairness, anti-reroll-fishing, BOOK
continuity), leaving only "a shared thing to talk about" — the Wordle property,
real but **entirely latent until a share hook exists**, which is a bet on
traction: *"that seems like a build-out for the scenario where the game gets lots
and lots of traction and buzz — not likely. But I am hoping for a nice little
engagement puzzle."* A choice that gives the player nothing teaches them that
choices here don't matter, so the second button went. `dailySeed()` is kept and
unused — six lines, and the whole restore path.

**This is the shape of that whole session: a subsystem outlives its justification
and has to be re-audited when the justification goes.** Cards, the exemplar coin
and the daily all died that way within a few hours of each other.

## 15. Rejected: a live / moving market price

It has only two possible relationships to the truth and both are bad. Correlated,
it leaks and the optimal play becomes "watch the number, skip the room" — the
exact failure invariant 5 exists to prevent. Uncorrelated, it is noise dressed as
signal, and a ticking number out-competes the argument for attention, which is
the one thing the session cannot afford. If it ever touched P&L it would end
properness: the score is currently a pure function of calibration, and price
movement makes it calibration plus luck.

The lesson underneath is worth having and is nearly free: `chart` and `apy` are
already unsettleable-by-anyone claims. Naming that at the post-deal screen
teaches "price movement is not evidence" as content, with no live variable to
misfire.

## 16. The two axes the game had welded together

*Author, 2026-07-28: "we may only have a 1/10 hit rate on projects, but they'll
fail for different reasons, not just because they're legit or not"* — and *"I was
going to say 50/50 but that's not realistic. Most projects fail, even if
well-intentioned."*

**Honesty and success are independent axes.** `truth: 1/0` reads as rug/legit and
`RESOLUTION` quietly makes `legit` mean *succeeded*, so the only way to lose money
is to be cheated. That is false about the world, and it is why no single number
felt right: 50/50 prices honesty, 1/10 prices success, and they are not the same
question.

**The desk can only answer one of them, and it is already the right one.** Marisol
can tell you whether the money moved as claimed; GR80 can tell you what the audit
covered. **Nobody at that desk can tell you whether the market will show up.**

Which makes "most projects fail" free — a fact about the world rather than a
change to the base rate you're graded against. The full treatment is VC_GAME.md §7
item 7. If two separate numbers are ever wanted, the shape is READ becoming
*calibration* (proper, Brier) and BOOK becoming *venture returns* (power-law,
honest to the fiction) — a scoring-kernel redesign, not an afternoon.

## 17. Who pitches — bot, or a cast of humans

*2026-07-29. Resolved to a single pitch bot with a rolled client. Recorded because
the rotating-human-cast plan had been the roadmap's headline item for two days and
its central claim turned out to be false.*

**The claim that failed.** The plan held that a rotating pitcher *"multiplies both
archetypes by the number of speakers"* — the biggest content lever available. It
doesn't. The spec **requires** the pitcher to be rolled independently of archetype
and outcome, or it leaks. **A variable required to carry zero information about
the puzzle cannot be a lever on the puzzle.** It multiplies sessions that *feel*
different; it multiplies no decisions. Six speakers × 35 lines of
`generic`/`sharp` × 3 archetypes ≈ 630 lines, and a 210-line tax on every
archetype after — levied on flavour, charged against the one thing that measurably
pays (archetype recognition, worth a +0.10 → +4.08 swing).

**The author's argument, which is stronger than the cost argument** (2026-07-29):
a bot *"saves complexity, avoids relying on superficial biases, and it could be
that the future business convention is a pitch bot that founders and companies
employ as agents."* All three hold:

- **Superficial bias.** A varying human face invites the player to build priors on
  it — and those priors are pure noise by construction. Teaching face-reading in a
  game where faces carry no information is teaching a superstition. The bot's
  expression instead varies with `pressure(run)`, i.e. **with what the player
  found**, so the one thing that changes is a mirror of their own evidence.
- **Diegesis.** Founders employing pitch agents makes the founder's absence free
  to explain, and faintly damning on its own.
- **Complexity.** One character to model, rig, voice and light.

**The objection that had to be answered, and how.** A bot has no motive, and
motive is what makes spin readable as spin. `POSITIONED` — *"the speaker benefits
from you believing it"* — is live in all three archetypes (`stake`, `stake`,
`funding`), and `pressure()`'s four bands describe a person's composure. **The fix
is commission**: a closer paid on funding is *structurally* interested, which is
strictly harder to deny than a founder's *"obviously I'm holding, it's my deal"*.

**The objection that dissolved.** "A bot can't emote" was wrong — the model's face
shield is a screen and renders arbitrary images (author, with reference art). That
turned out to be an upgrade rather than a workaround: the four pressure bands
become four textures where they previously drove only a badge and a border colour;
invariant 9 becomes *provable*, because a texture keyed to `pressure(run)` is
auditable where a rigged facial performance is not; and the amplitude mouth stops
being a fudge hidden behind hologram scanlines.

**The thematic payoff, which no human pitcher could deliver.** A salesman's warmth
is ambiguous — he might believe it. A shield rendering warmth is unambiguously an
asset being deployed at you, and it works anyway. *The messenger's disposition is
not evidence* stops being a lesson the game asserts and becomes one it embodies.

**Consequence for the enigma machine, resolved 2026-07-29 in two steps.** First:
with the pitcher physically present, the projector should render **the asset**
rather than the person — a robot inside a projector is two layers of mediation with
one job between them.

**AND THEN THE EASEL WAS CUT, hours later** (author, 2026-07-29: *"i'm removing
the whole chart and frame, leaving just the pitch-bot"*). So the paragraph below
records a decision that lasted an afternoon, and the position it overturned is the
one that shipped: **the projector casts the pitcher, the console takes the
arrival.** Kept because the reasoning is still the right test — a physical easel
WOULD have been the better pitch surface if it existed — and because this is the
fourth time in this file that a prop was designed around and then removed. The
lesson is the one §12 already draws about cards: do not let an asset that happens
to be in a file become the thing the design rests on.

Then the model arrived carrying `Presentation_Chart` — an easel — plus a
`Presentation_Chart_Page` quad with UVs and its own unused material, and that
settled it the other way. **The easel takes the pitch; the projector takes the
arrival.** The deciding argument is the same diegetic test that made Our Lady the
randomiser instead of dice: a VC meeting has no randomiser in it, but it *does*
have an easel. Two objects with one job each beats one object doing both — and the
built `HologramCard` shader keeps a real role (the deal arriving, then dimming)
rather than being kept merely because it already exists, which is exactly how cards
survived three cuts `[A§12]`.

**One wrong call worth recording.** The first export's chart looked ~90×
oversized. It wasn't: that was raw mesh-accessor bounds read without the node's
`scale: 0.01`. **Read the node transform, not the accessor, before calling a prop
broken.**

## 19. The line ceiling, and why it keeps moving

VC_GAME.md carries a hard line ceiling because its predecessor reached 1,006 lines
by welding the spec to this journal. The number has been wrong three times, always
in the same direction:

**300** — inherited from the old doc, set when the game was two archetypes and one
surface, then carried forward unexamined while the game grew. That is the same
"outlived its justification" failure this file documents for cards, the daily and
the exemplar coin. **450** — measured against nine invariants, six authoring rules,
three archetypes, two presentations. **500** — the pitch-bot decision added five
rules and a build.

Every raise so far was preceded by stripping argument that had been written into
BOTH files, which is the rule working: the first response to "it's over" is to look
for reasons masquerading as rules, and there have always been some. Only raise the
number when that search comes up empty.

## 20. The sixth object in the arrival slot, and the first one that isn't a machine

*2026-07-29, same day as `[A§17]`. The enigma console lasted hours. Recorded
because the slot has now eaten six designs and the test that kills them has been
the same test every time.*

**cards → dice → wheel → dual wheel → cipher machine → paperwork.** `[A§12]` and
`[A§13]` cover the first four. The console was rescued from the dice's fate on the
argument that **it chooses nothing** — it is only the channel Our Lady's
instruction arrives on. That answered the charge that killed the dice and left the
other one standing: **a VC meeting has no cipher machine in it either.**

**The tell that it was never resolved is the shape of the fix.** "Not a museum
piece", "one low strip", "a hero-sized console advertises a cryptography game" —
the prop was shrunk until it stopped being noticed. That is not a resolution, and
it cost twice: a beat too small to carry the moment it exists for, and 40% of the
briefing column standing empty around it.

**Three more, and the third is the one that generalises:**

- **The fiction had no threat model.** A cipher implies an interceptor. There
  isn't one, and Our Lady encoding a memo to her own desk is ceremony with nothing
  at stake. The real reason the name is withheld is that the meeting hasn't
  started — an *appointment*, not a cryptogram.
- **The pitcher was the one character with no face on the briefing.** Five
  portraits, four analysts and a cat explicitly labelled NOT A SEAT, and the thing
  that talks for two minutes was absent — while `PITCH_BOT.portrait` had been desk
  data the whole time.
- **IT TAUGHT NOTHING THAT CAME BACK.** The console appeared once and never
  returned. The record's first frame wakes the shield, so the first thing the
  player learns is that the bot's face is a readout — and `pressure()` drives it
  for the next four minutes. **Ask what a beat teaches that the next four minutes
  use. An object that answers "nothing" is decoration however well it is drawn.**

**What paperwork buys that no machine could.** `POSITIONED` and the commission are
called load-bearing in §1 and were, until this, one sentence of body copy. As a
term on a record that lands before a word is spoken, PAID · ONLY IF YOU FUND IT is
evidence the player watched arrive. `[A§13]` established that **copy cannot fix a
mechanic mismatch**; this is the converse and it is worth having both: **staging
does what copy can't.**

**One word is load-bearing: RETAINED, never ASSIGNED.** Assignment is the house
acting on screen, which is the randomiser in a seventh costume. The client acted,
upstairs, before you arrived.

### The absence was not the subject, and the first build got that wrong

*Same day, on the author's read of the shipped record: "i don't like drawing
attention to the missing nature of the client — no need to point that out. Treat it
as a normal way of doing business — ai agents are everywhere — we're in the near
future."*

It had shipped an empty dashed frame with a question mark in it, captioned NO
CLIENT, stamped DID NOT ATTEND: **three elements narrating one absence**, on a
record whose job is to make representation look routine. `[A§17]` says the
founder's absence *"needs no explaining and is itself faintly damning"* — and the
operative words are NEEDS NO EXPLAINING. **A UI that points at it three times is
explaining it,** which converts a quiet structural fact into a complaint the
interface is making on the player's behalf.

The fix was subtraction: one party on the record, because that is the only party a
document of this kind carries a face for, and the client as a **name on a line**,
which is how a client appears on every engagement letter ever written. A lone
centred portrait then read as a placeholder for something missing, so it moved
left, beside its caption, where it reads as a headshot on a file.

**And the caption went for the same reason, hours later**: SENT DOWN TO YOU · YOU
DON'T GET TO ASK WHY THIS ONE (author: *"this line seems unnecessary"*). It had been
load-bearing exactly once — against the dice, where naming *who chose* was the one
thing a randomiser could never do for itself `[A§13]`. **A form that arrives already
signed does not raise the question, so the answer stopped being needed**, and what
was left was the interface rebutting a complaint no player had made. The
generalisation, three cuts deep in one day: **when a prop goes, grep the copy that
was defending it.** Captions outlive their arguments silently, because nothing
breaks.

**And `SEND IT IN` finally went too** (author: *"seems like strange wording to
me"*). It is: *send it in* is receptionist-speak for a person you can point at, and
the "it" named nothing the player had met. Now `TAKE THE MEETING`. **`[A§11]`
rejected "send" for the ANALYSTS because they never leave their desks; the verb has
now failed on both sides of the table, which is enough to stop proposing it.**

**The particulars were in a second box, and that is the last thing the two-column
briefing cost.** A 270px record could name a client but had no room to describe one,
so the surface stats went into their own bordered panel beside it — one deal
arriving as two objects (author: *"the pitch project is in 2 separate boxes"*).
Giving the record the full width made it one document with three columns (who is
pitching · what they signed · the particulars), and that **deleted the swap cell**
rather than staging around it: stat rows sitting at `——` from the start cover their
own rest state, so nothing needed cross-fading and the house rules went back to
being copy. **The empty-box problem was never a staging problem. It was a width
problem.**

**Two more the author cut on sight, both narrating rather than telling:** *"one deal
on the table"* (the top bar already reports the count, and "on the table" was a
card-room idiom left over from `[A§12]`) and *"the desk — always these four, and the
cat"* (reassurance about a rotating cast that `[A§17]` had already deleted). Now YOUR
NEXT APPOINTMENT and YOUR ANALYSTS. **"The Trade Agents" was the other candidate and
was rejected for putting "agent" back on the player's side of the table the same day
the pitcher stopped being called one.**

**"The Agent" became "Pitch Bot" in the same pass** — desk data, so it reached the
record, the seat row, the transcript and Barron's asides at once. AGENT is a role
that invites *"agent for whom, and where are they?"*; PITCH BOT is just what the
thing is. **The name was asking the question the copy had stopped asking.**

## 18. Smaller decisions worth not re-making

- **Why this shape at all.** The design before it was an eight-screen CRT overlay
  that switched the 3D scene off (`frameloop:'never'`) and rendered the four
  characters as static tiles — twelve subsystems over three authored cases, and
  no moment-to-moment verb. Three fixes, in order: **play happens in the room**
  (no overlay, the characters are the interface); **one verb, under your thumb,
  while they're still talking**; **nothing is memorisable** (outcomes rolled, not
  authored).
- **"THE AUTOPSY" was renamed to POST-DEAL ANALYSIS.** An autopsy presumes a
  corpse, and roughly a third of these deals are legit — so it told a player who
  called it right that they'd lost. Internal names (`PHASE.AUTOPSY`,
  `deal.autopsy`) are unchanged.
- **"THE TAPE" failed invariant 6 on the author**, 2026-07-28: *"what does 'the
  tape' mean? I never quite got what it meant."* It was the only one of four lane
  labels that had to be *known* rather than read. Now THE CHART. Barron still
  says "tape" in his own dialogue, where it's characterisation — the rule binds
  the UI, not the salesman. **The generalisation: a term can fail this invariant
  years after shipping, and the person who notices is the one who didn't write
  it.**
- **The mobile reveal timing.** Two earlier shapes were wrong. Cutting on the
  press put the board up as he started talking, so you heard the reply over a
  panel that hadn't changed. Cutting when he finished fixed the timing but did
  the looking for you, which is the one thing that beat exists to make you do.
- **Why the exemplar coin stopped being rendered.** It named a second token the
  player had never met: *"why reference a different project?"* (author). Replaced
  by the archetype's own TELL, which is the transferable half.
- **`ARCHETYPE_LABEL` exists because the code slug was leaking.** `backdoor-fork`
  was printing kebab-case onto the post-deal screen next to a ticker. Naming the
  pattern is the teaching payload, so it has to be plain English and has to
  describe the mechanism.

